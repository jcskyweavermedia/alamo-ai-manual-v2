-- ============================================================
-- Phase 2: Search Function Upgrades (Unified AI Architecture)
-- ============================================================
-- Changes:
--   1. NEW: search_manual_v2 — hybrid RRF for manual sections
--      (replaces split search_manual + hybrid_search_manual for Phase 3)
--   2-6. UPGRADE: 5 product functions with adaptive weighting,
--      wider defaults (limit 8), richer snippets (MaxWords 50)
--
-- Backward compatibility:
--   - search_manual (FTS-only) and hybrid_search_manual are NOT modified
--   - Product function signatures are unchanged (only defaults change)
--   - All existing callers pass result_limit explicitly — zero impact
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. NEW: search_manual_v2 (manual_sections — hybrid RRF)
-- ────────────────────────────────────────────────────────────
-- Based on hybrid_search_manual with:
--   - Return field renamed: title → name (consistency with product functions)
--   - Default result_limit: 10 → 8
--   - Snippet MaxWords: 35 → 50, MinWords: 15 → 20
--   - Adaptive weighting carried over (0-hit FTS → 100% vector)

CREATE OR REPLACE FUNCTION public.search_manual_v2(
  search_query      TEXT,
  query_embedding   vector(1536),
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


-- ────────────────────────────────────────────────────────────
-- 2. UPGRADE: search_dishes (foh_plate_specs)
-- ────────────────────────────────────────────────────────────
-- Changes: default limit 5→8, adaptive weighting, snippet 50/20

CREATE OR REPLACE FUNCTION public.search_dishes(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  plate_type      TEXT,
  is_top_seller   BOOLEAN,
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
  kw AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(d.search_vector, ts_query) DESC
      ) AS pos
    FROM public.foh_plate_specs d
    WHERE d.search_vector @@ ts_query
      AND d.status = 'published'
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        ORDER BY d.embedding <=> query_embedding
      ) AS pos
    FROM public.foh_plate_specs d
    WHERE d.embedding IS NOT NULL
      AND d.status = 'published'
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
    c.id,
    d.slug,
    d.menu_name,
    ts_headline('english',
      COALESCE(d.short_description, '') || ' ' || COALESCE(d.detailed_description, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    d.plate_type,
    d.is_top_seller,
    c.score
  FROM combined c
  JOIN public.foh_plate_specs d ON d.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 3. UPGRADE: search_wines (wines)
-- ────────────────────────────────────────────────────────────
-- Changes: default limit 5→8, adaptive weighting, snippet 50/20

CREATE OR REPLACE FUNCTION public.search_wines(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  varietal        TEXT,
  style           TEXT,
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
  kw AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(w.search_vector, ts_query) DESC
      ) AS pos
    FROM public.wines w
    WHERE w.search_vector @@ ts_query
      AND w.status = 'published'
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (
        ORDER BY w.embedding <=> query_embedding
      ) AS pos
    FROM public.wines w
    WHERE w.embedding IS NOT NULL
      AND w.status = 'published'
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
    c.id,
    w.slug,
    w.name,
    ts_headline('english',
      COALESCE(w.tasting_notes, '') || ' ' || COALESCE(w.producer_notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    w.varietal,
    w.style,
    c.score
  FROM combined c
  JOIN public.wines w ON w.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 4. UPGRADE: search_cocktails (cocktails)
-- ────────────────────────────────────────────────────────────
-- Changes: default limit 5→8, adaptive weighting, snippet 50/20

CREATE OR REPLACE FUNCTION public.search_cocktails(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  style           TEXT,
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
  kw AS (
    SELECT
      ct.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(ct.search_vector, ts_query) DESC
      ) AS pos
    FROM public.cocktails ct
    WHERE ct.search_vector @@ ts_query
      AND ct.status = 'published'
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      ct.id,
      ROW_NUMBER() OVER (
        ORDER BY ct.embedding <=> query_embedding
      ) AS pos
    FROM public.cocktails ct
    WHERE ct.embedding IS NOT NULL
      AND ct.status = 'published'
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
    c.id,
    ct.slug,
    ct.name,
    ts_headline('english',
      COALESCE(ct.description, '') || ' ' || COALESCE(ct.tasting_notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    ct.style,
    c.score
  FROM combined c
  JOIN public.cocktails ct ON ct.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. UPGRADE: search_recipes (prep_recipes + plate_specs UNION)
-- ────────────────────────────────────────────────────────────
-- Changes: default limit 5→8, adaptive weighting, snippet 50/20
-- kw_stats counts from ranked kw CTE (unions both tables via all_fts)

CREATE OR REPLACE FUNCTION public.search_recipes(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
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


-- ────────────────────────────────────────────────────────────
-- 6. UPGRADE: search_beer_liquor (beer_liquor_list)
-- ────────────────────────────────────────────────────────────
-- Changes: default limit 5→8, adaptive weighting, snippet 50/20

CREATE OR REPLACE FUNCTION public.search_beer_liquor(
  search_query      TEXT,
  query_embedding   vector(1536),
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
  subcategory     TEXT,
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
  kw AS (
    SELECT
      bl.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(bl.search_vector, ts_query) DESC
      ) AS pos
    FROM public.beer_liquor_list bl
    WHERE bl.search_vector @@ ts_query
      AND bl.status = 'published'
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      bl.id,
      ROW_NUMBER() OVER (
        ORDER BY bl.embedding <=> query_embedding
      ) AS pos
    FROM public.beer_liquor_list bl
    WHERE bl.embedding IS NOT NULL
      AND bl.status = 'published'
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
    c.id,
    bl.slug,
    bl.name,
    ts_headline('english',
      COALESCE(bl.description, '') || ' ' || COALESCE(bl.style, '') || ' ' || COALESCE(bl.notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    bl.category,
    bl.subcategory,
    c.score
  FROM combined c
  JOIN public.beer_liquor_list bl ON bl.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
