-- =============================================================================
-- MIGRATION: add_department_and_linked_recipes
-- Phase 1 of Cocktail ↔ Prep Recipe Linking
--
-- 1A. Add `department` column to prep_recipes (kitchen | bar)
-- 1B. Add `linked_prep_recipes` JSONB column to cocktails
-- 1C. Update cocktails search_vector trigger to include linked recipe names
-- 1D. Update search_recipes function with optional department filter
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1A. Add `department` column to prep_recipes
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prep_recipes
  ADD COLUMN department TEXT NOT NULL DEFAULT 'kitchen'
  CHECK (department IN ('kitchen', 'bar'));

CREATE INDEX idx_prep_recipes_department ON public.prep_recipes (department);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1B. Add `linked_prep_recipes` column to cocktails
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cocktails
  ADD COLUMN linked_prep_recipes JSONB NOT NULL DEFAULT '[]'
  CHECK (jsonb_typeof(linked_prep_recipes) = 'array');

-- ─────────────────────────────────────────────────────────────────────────────
-- 1C. Update cocktails search_vector trigger function
-- Adds linked_prep_recipes names as weight 'B' terms
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_cocktails_search_vector()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.key_ingredients, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(r->>'name', ' ') FROM jsonb_array_elements(NEW.linked_prep_recipes) AS r),
      ''
    )), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.ingredients, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.tasting_notes, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1D. Update search_recipes function with optional department filter
-- Adds filter_department TEXT DEFAULT NULL parameter.
-- When not null, only prep_recipes with matching department are included.
-- Drop old 5-param overload first to avoid ambiguous function resolution.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.search_recipes(TEXT, vector(1536), INT, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION public.search_recipes(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6,
  filter_department TEXT DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  source_table    TEXT,
  combined_score  FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery := plainto_tsquery('english', search_query);
BEGIN
  RETURN QUERY
  WITH
  all_fts AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           ts_rank(r.search_vector, ts_query) AS rank
    FROM public.prep_recipes r
    WHERE r.search_vector @@ ts_query
      AND r.status = 'published'
      AND (filter_department IS NULL OR r.department = filter_department)
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           ts_rank(p.search_vector, ts_query) AS rank
    FROM public.plate_specs p
    WHERE p.search_vector @@ ts_query
      AND p.status = 'published'
  ),
  kw AS (
    SELECT af.id, af.src,
           ROW_NUMBER() OVER (ORDER BY af.rank DESC) AS pos
    FROM all_fts af
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  all_vec AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           r.embedding <=> query_embedding AS dist
    FROM public.prep_recipes r
    WHERE r.embedding IS NOT NULL
      AND r.status = 'published'
      AND (filter_department IS NULL OR r.department = filter_department)
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           p.embedding <=> query_embedding AS dist
    FROM public.plate_specs p
    WHERE p.embedding IS NOT NULL
      AND p.status = 'published'
  ),
  vec AS (
    SELECT av.id, av.src,
           ROW_NUMBER() OVER (ORDER BY av.dist ASC) AS pos
    FROM all_vec av
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      COALESCE(kw.src, vec.src) AS src,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  ),
  with_names AS (
    SELECT
      c.id,
      c.src,
      c.score,
      CASE c.src
        WHEN 'prep_recipe' THEN r.slug
        WHEN 'plate_spec' THEN p.slug
      END AS slug,
      CASE c.src
        WHEN 'prep_recipe' THEN r.name
        WHEN 'plate_spec' THEN p.name
      END AS name,
      CASE c.src
        WHEN 'prep_recipe' THEN COALESCE(r.name, '') || ' ' || COALESCE(r.prep_type, '') || ' ' || COALESCE(array_to_string(r.tags, ' '), '')
        WHEN 'plate_spec' THEN COALESCE(p.name, '') || ' ' || COALESCE(p.plate_type, '') || ' ' || COALESCE(p.notes, '')
      END AS headline_text
    FROM combined c
    LEFT JOIN public.prep_recipes r  ON c.src = 'prep_recipe' AND r.id = c.id
    LEFT JOIN public.plate_specs  p  ON c.src = 'plate_spec'  AND p.id = c.id
  )
  SELECT
    wn.id,
    wn.slug,
    wn.name,
    ts_headline('english',
      wn.headline_text,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    wn.src,
    wn.score
  FROM with_names wn
  WHERE wn.score > 0
  ORDER BY wn.score DESC
  LIMIT result_limit;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1E. Recompute search_vector for existing cocktails (trigger only fires on
-- INSERT/UPDATE, so existing rows need a touch to pick up the new trigger)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.cocktails SET updated_at = now();
