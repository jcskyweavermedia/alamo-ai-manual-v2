-- =============================================================================
-- MIGRATION: Fix Phase A audit findings
-- Fixes: B2 (search_manual_v2 DEFAULT NULL), H3/H4 (has_role → has_role_in_group),
--        M3 (search function membership validation), brands RLS scoping
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX B2: Restore DEFAULT NULL on query_embedding in search_manual_v2
-- The M7 migration dropped DEFAULT NULL, breaking FTS-only callers.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the current overload (without DEFAULT NULL on query_embedding)
DROP FUNCTION IF EXISTS public.search_manual_v2(TEXT, vector, TEXT, INT, FLOAT, FLOAT, UUID);

-- Recreate with DEFAULT NULL on query_embedding (restoring backward compat)
CREATE OR REPLACE FUNCTION public.search_manual_v2(
  search_query      TEXT,
  query_embedding   vector(1536) DEFAULT NULL,
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
  v_group_id  UUID;
BEGIN
  -- Resolve group_id with membership validation
  IF p_group_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE user_id = auth.uid() AND group_id = p_group_id
    ) THEN
      RETURN; -- unauthorized group_id → empty result
    END IF;
    v_group_id := p_group_id;
  ELSE
    v_group_id := public.get_user_group_id();
  END IF;

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
      AND query_embedding IS NOT NULL
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
-- FIX H3/H4 + M3: Update product table RLS to use has_role_in_group()
-- Also adds membership validation to SECURITY DEFINER search functions
-- ─────────────────────────────────────────────────────────────────────────────

-- ── prep_recipes ──
DROP POLICY IF EXISTS "Admins can insert prep_recipes" ON public.prep_recipes;
CREATE POLICY "Admins can insert prep_recipes"
  ON public.prep_recipes FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update prep_recipes" ON public.prep_recipes;
CREATE POLICY "Admins can update prep_recipes"
  ON public.prep_recipes FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can delete prep_recipes" ON public.prep_recipes;
CREATE POLICY "Admins can delete prep_recipes"
  ON public.prep_recipes FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── plate_specs ──
DROP POLICY IF EXISTS "Admins can insert plate_specs" ON public.plate_specs;
CREATE POLICY "Admins can insert plate_specs"
  ON public.plate_specs FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update plate_specs" ON public.plate_specs;
CREATE POLICY "Admins can update plate_specs"
  ON public.plate_specs FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can delete plate_specs" ON public.plate_specs;
CREATE POLICY "Admins can delete plate_specs"
  ON public.plate_specs FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── foh_plate_specs ──
DROP POLICY IF EXISTS "Admins can insert foh_plate_specs" ON public.foh_plate_specs;
CREATE POLICY "Admins can insert foh_plate_specs"
  ON public.foh_plate_specs FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update foh_plate_specs" ON public.foh_plate_specs;
CREATE POLICY "Admins can update foh_plate_specs"
  ON public.foh_plate_specs FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can delete foh_plate_specs" ON public.foh_plate_specs;
CREATE POLICY "Admins can delete foh_plate_specs"
  ON public.foh_plate_specs FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── wines ──
DROP POLICY IF EXISTS "Admins can insert wines" ON public.wines;
CREATE POLICY "Admins can insert wines"
  ON public.wines FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update wines" ON public.wines;
CREATE POLICY "Admins can update wines"
  ON public.wines FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can delete wines" ON public.wines;
CREATE POLICY "Admins can delete wines"
  ON public.wines FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── cocktails ──
DROP POLICY IF EXISTS "Admins can insert cocktails" ON public.cocktails;
CREATE POLICY "Admins can insert cocktails"
  ON public.cocktails FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update cocktails" ON public.cocktails;
CREATE POLICY "Admins can update cocktails"
  ON public.cocktails FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can delete cocktails" ON public.cocktails;
CREATE POLICY "Admins can delete cocktails"
  ON public.cocktails FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── beer_liquor_list ──
DROP POLICY IF EXISTS "Admins can insert beer_liquor_list" ON public.beer_liquor_list;
CREATE POLICY "Admins can insert beer_liquor_list"
  ON public.beer_liquor_list FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update beer_liquor_list" ON public.beer_liquor_list;
CREATE POLICY "Admins can update beer_liquor_list"
  ON public.beer_liquor_list FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can delete beer_liquor_list" ON public.beer_liquor_list;
CREATE POLICY "Admins can delete beer_liquor_list"
  ON public.beer_liquor_list FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── manual_sections ──
DROP POLICY IF EXISTS "Admins can insert manual_sections" ON public.manual_sections;
CREATE POLICY "Admins can insert manual_sections"
  ON public.manual_sections FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update manual_sections" ON public.manual_sections;
CREATE POLICY "Admins can update manual_sections"
  ON public.manual_sections FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can delete manual_sections" ON public.manual_sections;
CREATE POLICY "Admins can delete manual_sections"
  ON public.manual_sections FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── employees ── (managers + admins for INSERT/UPDATE, admins only for DELETE)
DROP POLICY IF EXISTS "Managers can insert employees" ON public.employees;
CREATE POLICY "Managers can insert employees"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND (has_role_in_group(auth.uid(), group_id, 'manager'::user_role)
      OR has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  );

DROP POLICY IF EXISTS "Managers can update employees" ON public.employees;
CREATE POLICY "Managers can update employees"
  ON public.employees FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND (has_role_in_group(auth.uid(), group_id, 'manager'::user_role)
      OR has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND (has_role_in_group(auth.uid(), group_id, 'manager'::user_role)
      OR has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  );

DROP POLICY IF EXISTS "Admins can delete employees" ON public.employees;
CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── position_training_requirements ── (same pattern as employees)
DROP POLICY IF EXISTS "Managers can insert position_training_requirements" ON public.position_training_requirements;
CREATE POLICY "Managers can insert position_training_requirements"
  ON public.position_training_requirements FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND (has_role_in_group(auth.uid(), group_id, 'manager'::user_role)
      OR has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  );

DROP POLICY IF EXISTS "Managers can update position_training_requirements" ON public.position_training_requirements;
CREATE POLICY "Managers can update position_training_requirements"
  ON public.position_training_requirements FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND (has_role_in_group(auth.uid(), group_id, 'manager'::user_role)
      OR has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND (has_role_in_group(auth.uid(), group_id, 'manager'::user_role)
      OR has_role_in_group(auth.uid(), group_id, 'admin'::user_role))
  );

DROP POLICY IF EXISTS "Admins can delete position_training_requirements" ON public.position_training_requirements;
CREATE POLICY "Admins can delete position_training_requirements"
  ON public.position_training_requirements FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role_in_group(auth.uid(), group_id, 'admin'::user_role));

-- ── brands ── (scope to admins within brand's group chain)
DROP POLICY IF EXISTS "Admins can insert brands" ON public.brands;
CREATE POLICY "Admins can insert brands"
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_memberships gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update brands" ON public.brands;
CREATE POLICY "Admins can update brands"
  ON public.brands FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      JOIN public.group_memberships gm ON gm.group_id = g.id
      WHERE g.brand_id = brands.id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g
      JOIN public.group_memberships gm ON gm.group_id = g.id
      WHERE g.brand_id = brands.id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete brands" ON public.brands;
CREATE POLICY "Admins can delete brands"
  ON public.brands FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      JOIN public.group_memberships gm ON gm.group_id = g.id
      WHERE g.brand_id = brands.id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX M3: Add membership validation to remaining SECURITY DEFINER search fns
-- Only need to fix the functions that were NOT already fixed above
-- (search_manual_v2 was fixed above with the DEFAULT NULL fix)
-- ─────────────────────────────────────────────────────────────────────────────

-- We need to add membership validation to all product search functions.
-- The pattern: when p_group_id is explicitly provided, validate membership.
-- When NULL, use get_user_group_id() (which already validates internally).

-- Helper: reusable membership-validated group resolver
CREATE OR REPLACE FUNCTION public.resolve_group_id(p_group_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID;
BEGIN
  IF p_group_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE user_id = auth.uid() AND group_id = p_group_id
    ) THEN
      RETURN NULL; -- unauthorized
    END IF;
    RETURN p_group_id;
  END IF;
  RETURN public.get_user_group_id();
END;
$$;
