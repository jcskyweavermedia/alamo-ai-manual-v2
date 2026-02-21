-- =============================================================================
-- MIGRATION: phase1_ingestion_foundation
-- Phase 1 of the Data Ingestion System — foundational schema additions:
--   1. sub_recipe_links       — cross-references between product tables
--   2. product_translations   — bilingual field translations with approval workflow
--   3. product-assets bucket  — storage bucket for uploaded files/images
--   4. source_session_id FK   — links each product row back to its ingestion session
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: sub_recipe_links
-- Cross-reference table linking any product row to any other product row
-- (e.g., a plate_spec component → a prep_recipe, or a cocktail → a garnish recipe)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.sub_recipe_links (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  parent_table TEXT NOT NULL CHECK (parent_table IN (
    'prep_recipes','plate_specs','foh_plate_specs','wines','cocktails','beer_liquor_list'
  )),
  parent_id UUID NOT NULL,
  child_table TEXT NOT NULL CHECK (child_table IN (
    'prep_recipes','plate_specs','foh_plate_specs','wines','cocktails','beer_liquor_list'
  )),
  child_id UUID NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_table, parent_id, child_table, child_id)
);

-- Indexes
CREATE INDEX idx_sub_recipe_links_parent
  ON public.sub_recipe_links (parent_table, parent_id);

CREATE INDEX idx_sub_recipe_links_child
  ON public.sub_recipe_links (child_table, child_id);

-- RLS
ALTER TABLE public.sub_recipe_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sub_recipe_links"
  ON public.sub_recipe_links FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert sub_recipe_links"
  ON public.sub_recipe_links FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update sub_recipe_links"
  ON public.sub_recipe_links FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete sub_recipe_links"
  ON public.sub_recipe_links FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: product_translations
-- Stores bilingual translations for individual fields of product rows
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.product_translations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  product_table TEXT NOT NULL CHECK (product_table IN (
    'prep_recipes','plate_specs','foh_plate_specs','wines','cocktails','beer_liquor_list'
  )),
  product_id UUID NOT NULL,
  field_path TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'en',
  translated_lang TEXT NOT NULL DEFAULT 'es',
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_table, product_id, field_path, translated_lang)
);

-- Index
CREATE INDEX idx_product_translations_lookup
  ON public.product_translations (product_table, product_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_product_translations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_translations_updated_at
  BEFORE UPDATE ON public.product_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_product_translations_updated_at();

-- RLS
ALTER TABLE public.product_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_translations"
  ON public.product_translations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert product_translations"
  ON public.product_translations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update product_translations"
  ON public.product_translations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete product_translations"
  ON public.product_translations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET: product-assets
-- Private bucket for uploaded files (images, PDFs, spreadsheets, docs, text)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-assets',
  'product-assets',
  false,
  10485760,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
);

-- Storage policies
CREATE POLICY "Authenticated users can download product assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-assets');

CREATE POLICY "Admins can upload product assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-assets' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update product assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-assets' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete product assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-assets' AND has_role(auth.uid(), 'admin'::user_role));

-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER: Add source_session_id FK on all 6 product tables
-- Links each product row back to the ingestion session that created/edited it
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prep_recipes
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.plate_specs
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.foh_plate_specs
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.wines
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.cocktails
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.beer_liquor_list
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);
