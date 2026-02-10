-- =============================================================================
-- MIGRATION: create_product_tables
-- Creates 6 product tables + indexes + FTS triggers + RLS policies
-- Phase 2 of Product AI System
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: prep_recipes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.prep_recipes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  prep_type TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  yield_qty NUMERIC NOT NULL,
  yield_unit TEXT NOT NULL,

  shelf_life_value INTEGER NOT NULL,
  shelf_life_unit TEXT NOT NULL,

  tags TEXT[] NOT NULL DEFAULT '{}',
  images JSONB NOT NULL DEFAULT '[]',

  ingredients JSONB NOT NULL,
  procedure JSONB NOT NULL,
  batch_scaling JSONB NOT NULL DEFAULT '{}',
  training_notes JSONB NOT NULL DEFAULT '{}',

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: plate_specs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.plate_specs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  plate_type TEXT NOT NULL,
  menu_category TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  allergens TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  images JSONB NOT NULL DEFAULT '[]',

  components JSONB NOT NULL,
  assembly_procedure JSONB NOT NULL,
  notes TEXT NOT NULL DEFAULT '',

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: foh_plate_specs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.foh_plate_specs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  plate_spec_id UUID REFERENCES public.plate_specs(id),
  menu_name TEXT NOT NULL,
  plate_type TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  short_description TEXT NOT NULL,
  detailed_description TEXT NOT NULL,

  ingredients TEXT[] NOT NULL DEFAULT '{}',
  key_ingredients TEXT[] NOT NULL DEFAULT '{}',

  flavor_profile TEXT[] NOT NULL DEFAULT '{}',

  allergens TEXT[] NOT NULL DEFAULT '{}',
  allergy_notes TEXT NOT NULL DEFAULT '',
  upsell_notes TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',

  image TEXT,

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: wines
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.wines (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  producer TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  vintage TEXT,

  varietal TEXT NOT NULL,
  blend BOOLEAN NOT NULL DEFAULT FALSE,
  style TEXT NOT NULL,
  body TEXT NOT NULL,

  tasting_notes TEXT NOT NULL,
  producer_notes TEXT NOT NULL DEFAULT '',

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  notes TEXT NOT NULL DEFAULT '',

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  image TEXT,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 5: cocktails
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.cocktails (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  style TEXT NOT NULL,
  glass TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  ingredients TEXT NOT NULL,
  key_ingredients TEXT NOT NULL,

  procedure JSONB NOT NULL,
  tasting_notes TEXT NOT NULL,
  description TEXT NOT NULL,

  notes TEXT NOT NULL DEFAULT '',

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  image TEXT,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 6: beer_liquor_list
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.beer_liquor_list (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,

  producer TEXT NOT NULL,
  country TEXT NOT NULL,

  description TEXT NOT NULL,
  style TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  notes TEXT NOT NULL DEFAULT '',

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES: GIN (FTS) + HNSW (vector) per table
-- =============================================================================

CREATE INDEX idx_prep_recipes_search ON prep_recipes USING gin(search_vector);
CREATE INDEX idx_prep_recipes_embedding ON prep_recipes USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_plate_specs_search ON plate_specs USING gin(search_vector);
CREATE INDEX idx_plate_specs_embedding ON plate_specs USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_foh_plate_specs_search ON foh_plate_specs USING gin(search_vector);
CREATE INDEX idx_foh_plate_specs_embedding ON foh_plate_specs USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_wines_search ON wines USING gin(search_vector);
CREATE INDEX idx_wines_embedding ON wines USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_cocktails_search ON cocktails USING gin(search_vector);
CREATE INDEX idx_cocktails_embedding ON cocktails USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_beer_liquor_search ON beer_liquor_list USING gin(search_vector);
CREATE INDEX idx_beer_liquor_embedding ON beer_liquor_list USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- FTS TRIGGER FUNCTIONS + TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_prep_recipes_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.prep_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prep_recipes_search_vector
  BEFORE INSERT OR UPDATE ON prep_recipes
  FOR EACH ROW EXECUTE FUNCTION update_prep_recipes_search_vector();

CREATE OR REPLACE FUNCTION update_plate_specs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.plate_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.menu_category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plate_specs_search_vector
  BEFORE INSERT OR UPDATE ON plate_specs
  FOR EACH ROW EXECUTE FUNCTION update_plate_specs_search_vector();

CREATE OR REPLACE FUNCTION update_foh_plate_specs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.menu_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.plate_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.detailed_description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.key_ingredients, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.upsell_notes, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_foh_plate_specs_search_vector
  BEFORE INSERT OR UPDATE ON foh_plate_specs
  FOR EACH ROW EXECUTE FUNCTION update_foh_plate_specs_search_vector();

CREATE OR REPLACE FUNCTION update_wines_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.producer, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.varietal, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.region, '') || ' ' || coalesce(NEW.country, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '') || ' ' || coalesce(NEW.body, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.tasting_notes, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.producer_notes, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wines_search_vector
  BEFORE INSERT OR UPDATE ON wines
  FOR EACH ROW EXECUTE FUNCTION update_wines_search_vector();

CREATE OR REPLACE FUNCTION update_cocktails_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.key_ingredients, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.ingredients, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.tasting_notes, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cocktails_search_vector
  BEFORE INSERT OR UPDATE ON cocktails
  FOR EACH ROW EXECUTE FUNCTION update_cocktails_search_vector();

CREATE OR REPLACE FUNCTION update_beer_liquor_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.producer, '') || ' ' || coalesce(NEW.country, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_beer_liquor_search_vector
  BEFORE INSERT OR UPDATE ON beer_liquor_list
  FOR EACH ROW EXECUTE FUNCTION update_beer_liquor_search_vector();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- prep_recipes
ALTER TABLE public.prep_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prep_recipes"
  ON public.prep_recipes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert prep_recipes"
  ON public.prep_recipes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update prep_recipes"
  ON public.prep_recipes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete prep_recipes"
  ON public.prep_recipes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- plate_specs
ALTER TABLE public.plate_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view plate_specs"
  ON public.plate_specs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert plate_specs"
  ON public.plate_specs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update plate_specs"
  ON public.plate_specs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete plate_specs"
  ON public.plate_specs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- foh_plate_specs
ALTER TABLE public.foh_plate_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view foh_plate_specs"
  ON public.foh_plate_specs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert foh_plate_specs"
  ON public.foh_plate_specs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update foh_plate_specs"
  ON public.foh_plate_specs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete foh_plate_specs"
  ON public.foh_plate_specs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- wines
ALTER TABLE public.wines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wines"
  ON public.wines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert wines"
  ON public.wines FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update wines"
  ON public.wines FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete wines"
  ON public.wines FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- cocktails
ALTER TABLE public.cocktails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cocktails"
  ON public.cocktails FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert cocktails"
  ON public.cocktails FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update cocktails"
  ON public.cocktails FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete cocktails"
  ON public.cocktails FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- beer_liquor_list
ALTER TABLE public.beer_liquor_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view beer_liquor_list"
  ON public.beer_liquor_list FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert beer_liquor_list"
  ON public.beer_liquor_list FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update beer_liquor_list"
  ON public.beer_liquor_list FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete beer_liquor_list"
  ON public.beer_liquor_list FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
