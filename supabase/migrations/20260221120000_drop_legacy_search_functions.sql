-- =============================================================================
-- MIGRATION: Drop legacy search functions
-- Makes search_manual_v2 accept optional embedding (FTS-only when NULL),
-- then drops the legacy search_manual and hybrid_search_manual functions.
-- =============================================================================

-- 1. Upgrade search_manual_v2 to accept optional query_embedding
--    When NULL → pure FTS (keyword_weight=1.0, skip vector CTE)
CREATE OR REPLACE FUNCTION public.search_manual_v2(
  search_query      TEXT,
  query_embedding   vector(1536) DEFAULT NULL,
  search_language   TEXT DEFAULT 'en',
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  category        TEXT,
  tags            TEXT[],
  combined_score  FLOAT,
  file_path       TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query    tsquery;
  ts_config   regconfig;
BEGIN
  -- Determine language config
  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
  ELSE
    ts_config := 'english'::regconfig;
  END IF;

  ts_query := plainto_tsquery(ts_config, search_query);

  -- =========================================================================
  -- FTS-only path (no embedding provided)
  -- =========================================================================
  IF query_embedding IS NULL THEN
    RETURN QUERY
    SELECT
      ms.id,
      ms.slug,
      CASE
        WHEN search_language = 'es' AND ms.title_es IS NOT NULL AND ms.title_es <> ''
          THEN ms.title_es
        ELSE ms.title_en
      END AS name,
      ts_headline(
        ts_config,
        CASE
          WHEN search_language = 'es' AND ms.content_es IS NOT NULL AND ms.content_es <> ''
            THEN ms.content_es
          ELSE ms.content_en
        END,
        ts_query,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
      ) AS snippet,
      ms.category,
      ms.tags,
      ts_rank(
        CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END,
        ts_query
      )::FLOAT AS combined_score,
      ms.file_path
    FROM public.manual_sections ms
    WHERE ms.is_category = false
      AND CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END @@ ts_query
    ORDER BY combined_score DESC
    LIMIT result_limit;

    RETURN;
  END IF;

  -- =========================================================================
  -- Hybrid path (FTS + vector with RRF)
  -- =========================================================================
  RETURN QUERY
  WITH kw AS (
    SELECT
      ms.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(
        CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END,
        ts_query
      ) DESC) AS pos
    FROM public.manual_sections ms
    WHERE ms.is_category = false
      AND CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END @@ ts_query
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      ms.id,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL
              THEN ms.embedding_es
            ELSE ms.embedding_en
          END <=> query_embedding
      ) AS pos
    FROM public.manual_sections ms
    WHERE ms.is_category = false
      AND CASE
            WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL
              THEN ms.embedding_es
            ELSE ms.embedding_en
          END IS NOT NULL
    ORDER BY
      CASE
        WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL
          THEN ms.embedding_es
        ELSE ms.embedding_en
      END <=> query_embedding
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    ms.id,
    ms.slug,
    CASE
      WHEN search_language = 'es' AND ms.title_es IS NOT NULL AND ms.title_es <> ''
        THEN ms.title_es
      ELSE ms.title_en
    END AS name,
    ts_headline(
      ts_config,
      CASE
        WHEN search_language = 'es' AND ms.content_es IS NOT NULL AND ms.content_es <> ''
          THEN ms.content_es
        ELSE ms.content_en
      END,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ) AS snippet,
    ms.category,
    ms.tags,
    c.score AS combined_score,
    ms.file_path
  FROM combined c
  JOIN public.manual_sections ms ON ms.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;

-- 2. Drop legacy functions (no remaining callers)
DROP FUNCTION IF EXISTS public.search_manual(TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.hybrid_search_manual(TEXT, vector(1536), TEXT, INT, FLOAT, FLOAT);
