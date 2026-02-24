-- =============================================================================
-- MIGRATION: create_search_forms
-- FTS-only search function for form_templates
-- Pattern: matches existing product search functions
-- Will be upgraded to FTS + vector hybrid (RRF) in Phase 7
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.search_forms(
  search_query      TEXT,
  search_language   TEXT DEFAULT 'en',
  match_count       INT DEFAULT 5,
  p_group_id        UUID DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  slug        TEXT,
  title       TEXT,
  description TEXT,
  icon        TEXT,
  score       FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query  tsquery;
  ts_config regconfig;
BEGIN
  -- Determine language config
  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
  ELSE
    ts_config := 'english'::regconfig;
  END IF;

  ts_query := plainto_tsquery(ts_config, search_query);

  RETURN QUERY
  SELECT
    ft.id,
    ft.slug,
    CASE
      WHEN search_language = 'es' AND ft.title_es IS NOT NULL AND ft.title_es <> ''
        THEN ft.title_es
      ELSE ft.title_en
    END AS title,
    ts_headline(
      ts_config,
      CASE
        WHEN search_language = 'es' AND ft.description_es IS NOT NULL AND ft.description_es <> ''
          THEN ft.description_es
        ELSE COALESCE(ft.description_en, '')
      END,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ) AS description,
    ft.icon,
    ts_rank(ft.search_vector, ts_query)::FLOAT AS score
  FROM public.form_templates ft
  WHERE ft.search_vector @@ ts_query
    AND ft.status = 'published'
    AND (p_group_id IS NULL OR ft.group_id = p_group_id)
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

COMMIT;
