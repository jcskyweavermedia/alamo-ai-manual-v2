-- ============================================================
-- Product Search Functions (FTS + Vector Hybrid via RRF)
-- ============================================================
-- Pattern: Same as hybrid_search_manual (manual sections)
-- English-only (no language parameter)
-- Gracefully degrades to FTS-only when embeddings are NULL
-- All CTEs filter by status = 'published' for future-safety
-- ============================================================

-- 1. search_dishes (foh_plate_specs)
CREATE OR REPLACE FUNCTION public.search_dishes(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  plate_type TEXT,
  is_top_seller BOOLEAN,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  kw AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(d.search_vector, ts_query) DESC
      ) AS pos
    FROM foh_plate_specs d
    WHERE d.search_vector @@ ts_query
      AND d.status = 'published'
    LIMIT result_limit * 2
  ),
  vec AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        ORDER BY d.embedding <=> query_embedding
      ) AS pos
    FROM foh_plate_specs d
    WHERE d.embedding IS NOT NULL
      AND d.status = 'published'
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    c.id,
    d.slug,
    d.menu_name,
    ts_headline('english',
      COALESCE(d.short_description, '') || ' ' || COALESCE(d.detailed_description, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    d.plate_type,
    d.is_top_seller,
    c.score
  FROM combined c
  JOIN foh_plate_specs d ON d.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;

-- 2. search_wines (wines)
CREATE OR REPLACE FUNCTION public.search_wines(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  varietal TEXT,
  style TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  kw AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(w.search_vector, ts_query) DESC
      ) AS pos
    FROM wines w
    WHERE w.search_vector @@ ts_query
      AND w.status = 'published'
    LIMIT result_limit * 2
  ),
  vec AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (
        ORDER BY w.embedding <=> query_embedding
      ) AS pos
    FROM wines w
    WHERE w.embedding IS NOT NULL
      AND w.status = 'published'
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    c.id,
    w.slug,
    w.name,
    ts_headline('english',
      COALESCE(w.tasting_notes, '') || ' ' || COALESCE(w.producer_notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    w.varietal,
    w.style,
    c.score
  FROM combined c
  JOIN wines w ON w.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;

-- 3. search_cocktails (cocktails)
CREATE OR REPLACE FUNCTION public.search_cocktails(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  style TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  kw AS (
    SELECT
      ct.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(ct.search_vector, ts_query) DESC
      ) AS pos
    FROM cocktails ct
    WHERE ct.search_vector @@ ts_query
      AND ct.status = 'published'
    LIMIT result_limit * 2
  ),
  vec AS (
    SELECT
      ct.id,
      ROW_NUMBER() OVER (
        ORDER BY ct.embedding <=> query_embedding
      ) AS pos
    FROM cocktails ct
    WHERE ct.embedding IS NOT NULL
      AND ct.status = 'published'
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    c.id,
    ct.slug,
    ct.name,
    ts_headline('english',
      COALESCE(ct.description, '') || ' ' || COALESCE(ct.tasting_notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    ct.style,
    c.score
  FROM combined c
  JOIN cocktails ct ON ct.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;

-- 4. search_recipes (UNION: prep_recipes + plate_specs)
-- Note: FULL OUTER JOIN on id is safe because UUIDs are globally unique across tables
CREATE OR REPLACE FUNCTION public.search_recipes(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  source_table TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  all_fts AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           ts_rank(r.search_vector, ts_query) AS rank
    FROM prep_recipes r
    WHERE r.search_vector @@ ts_query
      AND r.status = 'published'
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           ts_rank(p.search_vector, ts_query) AS rank
    FROM plate_specs p
    WHERE p.search_vector @@ ts_query
      AND p.status = 'published'
  ),
  kw AS (
    SELECT af.id, af.src,
           ROW_NUMBER() OVER (ORDER BY af.rank DESC) AS pos
    FROM all_fts af
    LIMIT result_limit * 2
  ),
  all_vec AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           r.embedding <=> query_embedding AS dist
    FROM prep_recipes r
    WHERE r.embedding IS NOT NULL
      AND r.status = 'published'
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           p.embedding <=> query_embedding AS dist
    FROM plate_specs p
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
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
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
    LEFT JOIN prep_recipes r  ON c.src = 'prep_recipe' AND r.id = c.id
    LEFT JOIN plate_specs  p  ON c.src = 'plate_spec'  AND p.id = c.id
  )
  SELECT
    wn.id,
    wn.slug,
    wn.name,
    ts_headline('english',
      wn.headline_text,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    wn.src,
    wn.score
  FROM with_names wn
  WHERE wn.score > 0
  ORDER BY wn.score DESC
  LIMIT result_limit;
END;
$$;

-- 5. search_beer_liquor (beer_liquor_list)
CREATE OR REPLACE FUNCTION public.search_beer_liquor(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  category TEXT,
  subcategory TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  kw AS (
    SELECT
      bl.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(bl.search_vector, ts_query) DESC
      ) AS pos
    FROM beer_liquor_list bl
    WHERE bl.search_vector @@ ts_query
      AND bl.status = 'published'
    LIMIT result_limit * 2
  ),
  vec AS (
    SELECT
      bl.id,
      ROW_NUMBER() OVER (
        ORDER BY bl.embedding <=> query_embedding
      ) AS pos
    FROM beer_liquor_list bl
    WHERE bl.embedding IS NOT NULL
      AND bl.status = 'published'
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    c.id,
    bl.slug,
    bl.name,
    ts_headline('english',
      COALESCE(bl.description, '') || ' ' || COALESCE(bl.style, '') || ' ' || COALESCE(bl.notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    bl.category,
    bl.subcategory,
    c.score
  FROM combined c
  JOIN beer_liquor_list bl ON bl.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
