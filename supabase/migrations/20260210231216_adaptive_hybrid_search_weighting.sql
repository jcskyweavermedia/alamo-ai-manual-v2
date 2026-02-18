-- Adaptive hybrid search: when FTS returns 0 hits, trust vector search 100%
-- instead of capping it at 60%. Fixes synonym gaps (e.g. "creator" vs "founder")
-- where the embedding model understands semantic equivalence but FTS stemming doesn't.

CREATE OR REPLACE FUNCTION public.hybrid_search_manual(
  search_query TEXT,
  query_embedding vector(1536),
  search_language TEXT DEFAULT 'en',
  result_limit INT DEFAULT 10,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  snippet TEXT,
  category TEXT,
  tags TEXT[],
  combined_score FLOAT,
  file_path TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
  ts_config regconfig;
BEGIN
  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
    ts_query := plainto_tsquery('spanish', search_query);
  ELSE
    ts_config := 'english'::regconfig;
    ts_query := plainto_tsquery('english', search_query);
  END IF;

  RETURN QUERY
  WITH
  -- Keyword results with position
  kw AS (
    SELECT
      ms.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(
        CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END,
        ts_query
      ) DESC) as pos
    FROM manual_sections ms
    WHERE ms.is_category = false
      AND CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END @@ ts_query
    LIMIT result_limit * 2
  ),

  -- Count FTS hits to decide weighting strategy
  kw_stats AS (
    SELECT COUNT(*)::INT as hit_count FROM kw
  ),

  -- Vector results with position
  vec AS (
    SELECT
      ms.id,
      ROW_NUMBER() OVER (ORDER BY
        CASE WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL
             THEN ms.embedding_es ELSE ms.embedding_en END <=> query_embedding
      ) as pos
    FROM manual_sections ms
    WHERE ms.is_category = false
      AND CASE WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL
               THEN ms.embedding_es ELSE ms.embedding_en END IS NOT NULL
    LIMIT result_limit * 2
  ),

  -- Adaptive RRF combination:
  -- When FTS has hits: normal weighted blend (40% keyword + 60% vector)
  -- When FTS has 0 hits: 100% vector (don't penalize for synonym gaps)
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) as id,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT as score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )

  SELECT
    c.id,
    ms.slug,
    CASE WHEN search_language = 'es' AND ms.title_es IS NOT NULL THEN ms.title_es ELSE ms.title_en END,
    ts_headline(ts_config,
      COALESCE(CASE WHEN search_language = 'es' AND ms.content_es IS NOT NULL THEN ms.content_es ELSE ms.content_en END, ''),
      ts_query, 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'),
    ms.category,
    ms.tags,
    c.score,
    ms.file_path
  FROM combined c
  JOIN manual_sections ms ON ms.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
