-- =============================================================================
-- MIGRATION: create_form_templates
-- Creates form_templates table + FTS trigger + updated_at trigger +
-- GIN/B-tree indexes + RLS policies (5 group-scoped policies)
-- Phase 1 of Form Builder System
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLE: form_templates
-- ---------------------------------------------------------------------------

CREATE TABLE public.form_templates (
  id               UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES public.groups(id),
  slug             TEXT UNIQUE NOT NULL,
  title_en         TEXT NOT NULL,
  title_es         TEXT,
  description_en   TEXT,
  description_es   TEXT,
  icon             TEXT DEFAULT 'ClipboardList',
  header_image     TEXT,
  fields           JSONB NOT NULL DEFAULT '[]'
    CONSTRAINT chk_fields_is_array CHECK (jsonb_typeof(fields) = 'array'),
  instructions_en  TEXT,
  instructions_es  TEXT,
  ai_tools         TEXT[] DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order       INTEGER DEFAULT 0,
  template_version INTEGER NOT NULL DEFAULT 1,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector    TSVECTOR
);

-- ---------------------------------------------------------------------------
-- INDEXES: GIN (FTS) + B-tree
-- Note: HNSW vector index deferred to Phase 7 -- 2-50 templates don't need
-- semantic search. FTS on title/description is sufficient.
-- ---------------------------------------------------------------------------

CREATE INDEX idx_form_templates_search
  ON public.form_templates USING gin(search_vector);

CREATE INDEX idx_form_templates_group_id
  ON public.form_templates (group_id);

CREATE INDEX idx_form_templates_status
  ON public.form_templates (status);

-- ---------------------------------------------------------------------------
-- FTS TRIGGER FUNCTION
-- Auto-populates search_vector from title + description fields (EN + ES)
-- Weighted: title_en/title_es = A, description_en/description_es = B
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_form_templates_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.title_es, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description_en, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(NEW.description_es, '')), 'B');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_form_templates_search_vector
  BEFORE INSERT OR UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_form_templates_search_vector();

-- ---------------------------------------------------------------------------
-- FIELD VALIDATION TRIGGER
-- Ensures every field has non-empty key + type, and no duplicate keys
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_form_template_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field_keys TEXT[];
  field_key TEXT;
  field_record JSONB;
BEGIN
  -- Empty array is valid (new/blank template)
  IF NEW.fields = '[]'::JSONB OR jsonb_array_length(NEW.fields) = 0 THEN
    RETURN NEW;
  END IF;

  field_keys := '{}';

  FOR field_record IN SELECT jsonb_array_elements(NEW.fields)
  LOOP
    -- Every field must have a non-empty 'key'
    IF field_record->>'key' IS NULL OR field_record->>'key' = '' THEN
      RAISE EXCEPTION 'Every field must have a non-empty "key" property';
    END IF;

    -- Every field must have a non-empty 'type'
    IF field_record->>'type' IS NULL OR field_record->>'type' = '' THEN
      RAISE EXCEPTION 'Every field must have a non-empty "type" property';
    END IF;

    field_key := field_record->>'key';

    -- Duplicate key check
    IF field_key = ANY(field_keys) THEN
      RAISE EXCEPTION 'Duplicate field key "%" in fields array', field_key;
    END IF;

    field_keys := array_append(field_keys, field_key);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_form_template_fields
  BEFORE INSERT OR UPDATE OF fields ON public.form_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_form_template_fields();

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER (reuses shared set_updated_at from training system)
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_form_templates_updated_at
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS POLICIES (5 policies, group-scoped -- matches training_programs pattern)
-- Uses get_user_group_id() + get_user_role() for multi-tenant safety
-- ---------------------------------------------------------------------------

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user in the same group can view published/archived templates
CREATE POLICY "Users can view published form_templates in their group"
  ON public.form_templates FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND status IN ('published', 'archived')
  );

-- SELECT: managers/admins can also see drafts in their group
CREATE POLICY "Managers can view draft form_templates in their group"
  ON public.form_templates FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- INSERT: managers and admins in the same group
CREATE POLICY "Managers can insert form_templates"
  ON public.form_templates FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- UPDATE: managers and admins in the same group
CREATE POLICY "Managers can update form_templates"
  ON public.form_templates FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- DELETE: admin only in the same group
CREATE POLICY "Admins can delete form_templates"
  ON public.form_templates FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );

COMMIT;
