-- =============================================================================
-- MIGRATION: Add group_id to manual_sections + update all search functions
-- Phase A.7b: Manual sections scoping + search function group filtering
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Add group_id to manual_sections
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.manual_sections
  ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

UPDATE public.manual_sections
  SET group_id = '00000000-0000-0000-0000-000000000001'
  WHERE group_id IS NULL;

ALTER TABLE public.manual_sections
  ALTER COLUMN group_id SET NOT NULL;

CREATE INDEX idx_manual_sections_group ON public.manual_sections(group_id);

-- Make slug and file_path unique per group (drop old global unique, add group-scoped)
ALTER TABLE public.manual_sections DROP CONSTRAINT manual_sections_slug_key;
ALTER TABLE public.manual_sections ADD CONSTRAINT manual_sections_group_slug_key UNIQUE(group_id, slug);

ALTER TABLE public.manual_sections DROP CONSTRAINT manual_sections_file_path_key;
ALTER TABLE public.manual_sections ADD CONSTRAINT manual_sections_group_file_path_key UNIQUE(group_id, file_path);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: Update search_manual_v2 with group_id parameter
-- ─────────────────────────────────────────────────────────────────────────────
-- New last param: p_group_id UUID DEFAULT NULL
-- Resolution: COALESCE(p_group_id, get_user_group_id())
-- Added: AND ms.group_id = v_group_id in all WHERE clauses

CREATE OR REPLACE FUNCTION public.search_manual_v2(
  search_query      TEXT,
  query_embedding   vector(1536),
  search_language   TEXT DEFAULT 'en',
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6,
  p_group_id        UUID DEFAULT NULL
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
  v_group_id  UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
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
      AND ms.group_id = v_group_id
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
      AND ms.group_id = v_group_id
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


-- ─────────────────────────────────────────────────────────────────────────────
-- PART C: Update 5 product search functions with group_id parameter
-- ─────────────────────────────────────────────────────────────────────────────

-- ── search_dishes ──
CREATE OR REPLACE FUNCTION public.search_dishes(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6,
  p_group_id        UUID DEFAULT NULL
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
  v_group_id UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
  RETURN QUERY
  WITH
  kw AS (
    SELECT d.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(d.search_vector, ts_query) DESC) AS pos
    FROM public.foh_plate_specs d
    WHERE d.search_vector @@ ts_query AND d.status = 'published' AND d.group_id = v_group_id
    LIMIT result_limit * 2
  ),
  kw_stats AS (SELECT COUNT(*)::INT AS hit_count FROM kw),
  vec AS (
    SELECT d.id,
      ROW_NUMBER() OVER (ORDER BY d.embedding <=> query_embedding) AS pos
    FROM public.foh_plate_specs d
    WHERE d.embedding IS NOT NULL AND d.status = 'published' AND d.group_id = v_group_id
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT COALESCE(kw.id, vec.id) AS id,
      (CASE WHEN (SELECT hit_count FROM kw_stats) = 0 THEN COALESCE(1.0 / (60 + vec.pos), 0)
       ELSE keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) + vector_weight * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT c.id, d.slug, d.menu_name,
    ts_headline('english',
      COALESCE(d.short_description, '') || ' ' || COALESCE(d.detailed_description, ''),
      ts_query, 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'),
    d.plate_type, d.is_top_seller, c.score
  FROM combined c
  JOIN public.foh_plate_specs d ON d.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;

-- ── search_wines ──
CREATE OR REPLACE FUNCTION public.search_wines(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6,
  p_group_id        UUID DEFAULT NULL
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
  v_group_id UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
  RETURN QUERY
  WITH
  kw AS (
    SELECT w.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(w.search_vector, ts_query) DESC) AS pos
    FROM public.wines w
    WHERE w.search_vector @@ ts_query AND w.status = 'published' AND w.group_id = v_group_id
    LIMIT result_limit * 2
  ),
  kw_stats AS (SELECT COUNT(*)::INT AS hit_count FROM kw),
  vec AS (
    SELECT w.id,
      ROW_NUMBER() OVER (ORDER BY w.embedding <=> query_embedding) AS pos
    FROM public.wines w
    WHERE w.embedding IS NOT NULL AND w.status = 'published' AND w.group_id = v_group_id
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT COALESCE(kw.id, vec.id) AS id,
      (CASE WHEN (SELECT hit_count FROM kw_stats) = 0 THEN COALESCE(1.0 / (60 + vec.pos), 0)
       ELSE keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) + vector_weight * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT c.id, w.slug, w.name,
    ts_headline('english',
      COALESCE(w.tasting_notes, '') || ' ' || COALESCE(w.producer_notes, ''),
      ts_query, 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'),
    w.varietal, w.style, c.score
  FROM combined c
  JOIN public.wines w ON w.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;

-- ── search_cocktails ──
CREATE OR REPLACE FUNCTION public.search_cocktails(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6,
  p_group_id        UUID DEFAULT NULL
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
  v_group_id UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
  RETURN QUERY
  WITH
  kw AS (
    SELECT ct.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(ct.search_vector, ts_query) DESC) AS pos
    FROM public.cocktails ct
    WHERE ct.search_vector @@ ts_query AND ct.status = 'published' AND ct.group_id = v_group_id
    LIMIT result_limit * 2
  ),
  kw_stats AS (SELECT COUNT(*)::INT AS hit_count FROM kw),
  vec AS (
    SELECT ct.id,
      ROW_NUMBER() OVER (ORDER BY ct.embedding <=> query_embedding) AS pos
    FROM public.cocktails ct
    WHERE ct.embedding IS NOT NULL AND ct.status = 'published' AND ct.group_id = v_group_id
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT COALESCE(kw.id, vec.id) AS id,
      (CASE WHEN (SELECT hit_count FROM kw_stats) = 0 THEN COALESCE(1.0 / (60 + vec.pos), 0)
       ELSE keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) + vector_weight * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT c.id, ct.slug, ct.name,
    ts_headline('english',
      COALESCE(ct.description, '') || ' ' || COALESCE(ct.tasting_notes, ''),
      ts_query, 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'),
    ct.style, c.score
  FROM combined c
  JOIN public.cocktails ct ON ct.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;

-- ── search_recipes ──
CREATE OR REPLACE FUNCTION public.search_recipes(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6,
  p_group_id        UUID DEFAULT NULL
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
  v_group_id UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
  RETURN QUERY
  WITH
  all_fts AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           ts_rank(r.search_vector, ts_query) AS rank
    FROM public.prep_recipes r
    WHERE r.search_vector @@ ts_query AND r.status = 'published' AND r.group_id = v_group_id
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           ts_rank(p.search_vector, ts_query) AS rank
    FROM public.plate_specs p
    WHERE p.search_vector @@ ts_query AND p.status = 'published' AND p.group_id = v_group_id
  ),
  kw AS (
    SELECT af.id, af.src,
           ROW_NUMBER() OVER (ORDER BY af.rank DESC) AS pos
    FROM all_fts af
    LIMIT result_limit * 2
  ),
  kw_stats AS (SELECT COUNT(*)::INT AS hit_count FROM kw),
  all_vec AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           r.embedding <=> query_embedding AS dist
    FROM public.prep_recipes r
    WHERE r.embedding IS NOT NULL AND r.status = 'published' AND r.group_id = v_group_id
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           p.embedding <=> query_embedding AS dist
    FROM public.plate_specs p
    WHERE p.embedding IS NOT NULL AND p.status = 'published' AND p.group_id = v_group_id
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
      c.id, c.src, c.score,
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
    wn.id, wn.slug, wn.name,
    ts_headline('english', wn.headline_text, ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'),
    wn.src, wn.score
  FROM with_names wn
  WHERE wn.score > 0
  ORDER BY wn.score DESC
  LIMIT result_limit;
END;
$$;

-- ── search_beer_liquor ──
CREATE OR REPLACE FUNCTION public.search_beer_liquor(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6,
  p_group_id        UUID DEFAULT NULL
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
  v_group_id UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
  RETURN QUERY
  WITH
  kw AS (
    SELECT bl.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(bl.search_vector, ts_query) DESC) AS pos
    FROM public.beer_liquor_list bl
    WHERE bl.search_vector @@ ts_query AND bl.status = 'published' AND bl.group_id = v_group_id
    LIMIT result_limit * 2
  ),
  kw_stats AS (SELECT COUNT(*)::INT AS hit_count FROM kw),
  vec AS (
    SELECT bl.id,
      ROW_NUMBER() OVER (ORDER BY bl.embedding <=> query_embedding) AS pos
    FROM public.beer_liquor_list bl
    WHERE bl.embedding IS NOT NULL AND bl.status = 'published' AND bl.group_id = v_group_id
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT COALESCE(kw.id, vec.id) AS id,
      (CASE WHEN (SELECT hit_count FROM kw_stats) = 0 THEN COALESCE(1.0 / (60 + vec.pos), 0)
       ELSE keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) + vector_weight * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT c.id, bl.slug, bl.name,
    ts_headline('english',
      COALESCE(bl.description, '') || ' ' || COALESCE(bl.style, '') || ' ' || COALESCE(bl.notes, ''),
      ts_query, 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'),
    bl.category, bl.subcategory, c.score
  FROM combined c
  JOIN public.beer_liquor_list bl ON bl.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART D: Update manual utility functions with group_id parameter
-- ─────────────────────────────────────────────────────────────────────────────

-- ── get_manual_tree ──
CREATE OR REPLACE FUNCTION public.get_manual_tree(
  language    TEXT DEFAULT 'en',
  p_group_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  parent_id UUID,
  slug TEXT,
  title TEXT,
  icon TEXT,
  sort_order INTEGER,
  level INTEGER,
  is_category BOOLEAN,
  has_content BOOLEAN
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
  RETURN QUERY
  SELECT
    ms.id,
    ms.parent_id,
    ms.slug,
    CASE WHEN language = 'es' AND ms.title_es IS NOT NULL
         THEN ms.title_es
         ELSE ms.title_en
    END AS title,
    ms.icon,
    ms.sort_order,
    ms.level,
    ms.is_category,
    (CASE WHEN language = 'es'
          THEN ms.content_es IS NOT NULL OR ms.content_en IS NOT NULL
          ELSE ms.content_en IS NOT NULL
     END) AS has_content
  FROM public.manual_sections ms
  WHERE ms.group_id = v_group_id
  ORDER BY ms.level, ms.sort_order;
END;
$$;

-- ── get_manual_section ──
CREATE OR REPLACE FUNCTION public.get_manual_section(
  section_slug  TEXT,
  language      TEXT DEFAULT 'en',
  p_group_id    UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  parent_id UUID,
  slug TEXT,
  file_path TEXT,
  title TEXT,
  content TEXT,
  category TEXT,
  tags TEXT[],
  icon TEXT,
  updated_at TIMESTAMPTZ,
  has_translation BOOLEAN
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
  RETURN QUERY
  SELECT
    ms.id,
    ms.parent_id,
    ms.slug,
    ms.file_path,
    CASE WHEN language = 'es' AND ms.title_es IS NOT NULL
         THEN ms.title_es
         ELSE ms.title_en
    END AS title,
    CASE WHEN language = 'es' AND ms.content_es IS NOT NULL
         THEN ms.content_es
         ELSE ms.content_en
    END AS content,
    ms.category,
    ms.tags,
    ms.icon,
    ms.updated_at,
    (ms.content_es IS NOT NULL) AS has_translation
  FROM public.manual_sections ms
  WHERE ms.slug = section_slug
    AND ms.group_id = v_group_id;
END;
$$;

-- ── search_manual (FTS-only legacy function) ──
CREATE OR REPLACE FUNCTION public.search_manual(
  search_query    TEXT,
  search_language TEXT DEFAULT 'en',
  result_limit    INTEGER DEFAULT 20,
  p_group_id      UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  snippet TEXT,
  category TEXT,
  tags TEXT[],
  rank REAL,
  file_path TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts_query  tsquery;
  v_group_id UUID := COALESCE(p_group_id, public.get_user_group_id());
BEGIN
  IF search_language = 'es' THEN
    ts_query := plainto_tsquery('spanish', search_query);
  ELSE
    ts_query := plainto_tsquery('english', search_query);
  END IF;

  RETURN QUERY
  SELECT
    ms.id,
    ms.slug,
    CASE WHEN search_language = 'es' AND ms.title_es IS NOT NULL
         THEN ms.title_es
         ELSE ms.title_en
    END AS title,
    ts_headline(
      CASE WHEN search_language = 'es' THEN 'spanish' ELSE 'english' END,
      CASE WHEN search_language = 'es' AND ms.content_es IS NOT NULL
           THEN ms.content_es
           ELSE ms.content_en
      END,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ) AS snippet,
    ms.category,
    ms.tags,
    ts_rank(
      CASE WHEN search_language = 'es'
           THEN ms.search_vector_es
           ELSE ms.search_vector_en
      END,
      ts_query
    ) AS rank,
    ms.file_path
  FROM public.manual_sections ms
  WHERE ms.is_category = false
    AND ms.group_id = v_group_id
    AND (
      CASE WHEN search_language = 'es'
           THEN ms.search_vector_es
           ELSE ms.search_vector_en
      END @@ ts_query
    )
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;
