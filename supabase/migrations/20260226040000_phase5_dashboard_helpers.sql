-- ============================================================================
-- Phase 5: Dashboard helper functions for real-time review dashboard wiring
-- ============================================================================
--
-- 4 new functions that replace mock data with live DB queries:
--   1. get_dashboard_competitors()  — batch competitor scores in one call
--   2. get_severity_alerts()        — high-severity alerts with restaurant names
--   3. get_category_trend_weekly()  — weekly sentiment by category + restaurant
--   4. get_subcategory_breakdown()  — sub-category detail with trend deltas
--
-- All use LANGUAGE plpgsql STABLE SET search_path = public, NO SECURITY DEFINER
-- (RLS enforced for browser callers).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_dashboard_competitors
-- ─────────────────────────────────────────────────────────────────────────────
-- Replaces N×2 individual compute_flavor_index_range() calls with one batch.
-- Returns own restaurant + all its competitors with scores and deltas.

CREATE OR REPLACE FUNCTION public.get_dashboard_competitors(
  p_unit_id    UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE (
  restaurant_id UUID,
  name          TEXT,
  is_own        BOOLEAN,
  flavor_index  NUMERIC(5,2),
  delta         NUMERIC(5,2),
  avg_rating    NUMERIC(3,2),
  total_reviews BIGINT
)
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
  v_all_ids     UUID[];
  v_prev_start  DATE;
  v_prev_end    DATE;
  v_duration    INTEGER;
  v_rid         UUID;
  v_fi_cur      RECORD;
  v_fi_prev     RECORD;
BEGIN
  -- Build array: own unit + competitors
  v_all_ids := ARRAY[p_unit_id] || public.get_competitor_ids(p_unit_id);

  -- Compute previous period of same duration
  v_duration   := p_end_date - p_start_date;
  v_prev_end   := p_start_date - 1;
  v_prev_start := v_prev_end - v_duration;

  FOREACH v_rid IN ARRAY v_all_ids
  LOOP
    -- Current period
    SELECT INTO v_fi_cur *
    FROM public.compute_flavor_index_range(v_rid, p_start_date, p_end_date);

    -- Previous period
    SELECT INTO v_fi_prev *
    FROM public.compute_flavor_index_range(v_rid, v_prev_start, v_prev_end);

    -- Build result row
    SELECT tr.name, (tr.restaurant_type = 'own')
    INTO name, is_own
    FROM public.tracked_restaurants tr
    WHERE tr.id = v_rid;

    restaurant_id := v_rid;
    flavor_index  := v_fi_cur.flavor_index;
    avg_rating    := v_fi_cur.avg_rating;
    total_reviews := v_fi_cur.total_reviews;

    IF v_fi_prev.total_reviews > 0 THEN
      delta := v_fi_cur.flavor_index - v_fi_prev.flavor_index;
    ELSE
      delta := NULL;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_severity_alerts
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns high-severity alerts with restaurant names, pre-joined.

CREATE OR REPLACE FUNCTION public.get_severity_alerts(
  p_restaurant_ids UUID[],
  p_start_date     DATE,
  p_end_date       DATE,
  p_limit          INTEGER DEFAULT 20
)
RETURNS TABLE (
  alert_id        UUID,
  alert_type      TEXT,
  summary         TEXT,
  review_date     DATE,
  restaurant_name TEXT,
  restaurant_id   UUID
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT
    ra.id                          AS alert_id,
    detail->>'type'                AS alert_type,
    detail->>'summary'             AS summary,
    ra.review_date::date           AS review_date,
    tr.name                        AS restaurant_name,
    ra.restaurant_id
  FROM public.review_analyses ra
  INNER JOIN public.tracked_restaurants tr ON tr.id = ra.restaurant_id
  CROSS JOIN LATERAL jsonb_array_elements(ra.high_severity_details) AS detail
  WHERE ra.high_severity_flag = true
    AND ra.restaurant_id = ANY(p_restaurant_ids)
    AND ra.review_date::date >= p_start_date
    AND ra.review_date::date <= p_end_date
  ORDER BY ra.review_date DESC
  LIMIT p_limit;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. get_category_trend_weekly
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns weekly average sentiment for a specific category bucket,
-- grouped by restaurant. Uses dynamic SQL to reference the correct
-- sentiment column (food_sentiment, service_sentiment, etc.).

CREATE OR REPLACE FUNCTION public.get_category_trend_weekly(
  p_restaurant_ids UUID[],
  p_category       TEXT,
  p_start_date     DATE,
  p_end_date       DATE
)
RETURNS TABLE (
  week_start    DATE,
  restaurant_id UUID,
  sentiment     NUMERIC(4,3)
)
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
  v_column TEXT;
BEGIN
  -- Map category to column name (whitelist to prevent injection)
  v_column := CASE p_category
    WHEN 'food'     THEN 'food_sentiment'
    WHEN 'service'  THEN 'service_sentiment'
    WHEN 'ambience' THEN 'ambience_sentiment'
    WHEN 'value'    THEN 'value_sentiment'
    ELSE NULL
  END;

  IF v_column IS NULL THEN
    RAISE EXCEPTION 'Invalid category: %. Must be food, service, ambience, or value.', p_category;
  END IF;

  RETURN QUERY EXECUTE format(
    $q$
    SELECT
      date_trunc('week', fid.date)::date AS week_start,
      fid.restaurant_id,
      CASE WHEN SUM(CASE WHEN fid.%I IS NOT NULL THEN fid.total_reviews ELSE 0 END) > 0
        THEN ROUND(
          SUM(fid.%I * fid.total_reviews)
          / SUM(CASE WHEN fid.%I IS NOT NULL THEN fid.total_reviews ELSE 0 END)
        , 3)
        ELSE NULL
      END AS sentiment
    FROM public.flavor_index_daily fid
    WHERE fid.restaurant_id = ANY($1)
      AND fid.date >= $2
      AND fid.date <= $3
    GROUP BY date_trunc('week', fid.date), fid.restaurant_id
    ORDER BY week_start
    $q$,
    v_column, v_column, v_column
  ) USING p_restaurant_ids, p_start_date, p_end_date;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. get_subcategory_breakdown
-- ─────────────────────────────────────────────────────────────────────────────
-- Unnests strengths + opportunities from review_analyses, maps categories
-- to the requested bucket (same CASE WHEN as rollup_daily_flavor_index),
-- and returns grouped sub-category stats with trend deltas vs previous period.

CREATE OR REPLACE FUNCTION public.get_subcategory_breakdown(
  p_restaurant_id UUID,
  p_start_date    DATE,
  p_end_date      DATE,
  p_bucket        TEXT,
  p_limit         INTEGER DEFAULT 10
)
RETURNS TABLE (
  category       TEXT,
  avg_intensity  NUMERIC(3,1),
  mentions       BIGINT,
  trend_delta    BIGINT
)
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
  v_duration   INTEGER;
  v_prev_start DATE;
  v_prev_end   DATE;
BEGIN
  -- Validate bucket
  IF p_bucket NOT IN ('food', 'service', 'ambience', 'value') THEN
    RAISE EXCEPTION 'Invalid bucket: %. Must be food, service, ambience, or value.', p_bucket;
  END IF;

  -- Compute previous period of same duration
  v_duration   := p_end_date - p_start_date;
  v_prev_end   := p_start_date - 1;
  v_prev_start := v_prev_end - v_duration;

  RETURN QUERY
  WITH current_period AS (
    SELECT
      raw_cat.category AS cat,
      ROUND(AVG(
        NULLIF(regexp_replace(raw_cat.intensity_str, '[^0-9.]', '', 'g'), '')::numeric
      ), 1) AS avg_int,
      COUNT(*) AS cnt
    FROM public.review_analyses ra
    CROSS JOIN LATERAL (
      SELECT
        s.elem->>'category' AS category,
        s.elem->>'intensity' AS intensity_str
      FROM jsonb_array_elements(ra.strengths) AS s(elem)
      UNION ALL
      SELECT
        o.elem->>'category' AS category,
        o.elem->>'intensity' AS intensity_str
      FROM jsonb_array_elements(ra.opportunities) AS o(elem)
    ) raw_cat
    WHERE ra.restaurant_id = p_restaurant_id
      AND ra.review_date::date >= p_start_date
      AND ra.review_date::date <= p_end_date
      AND (CASE raw_cat.category
        WHEN 'Food Quality'           THEN 'food'
        WHEN 'Presentation'           THEN 'food'
        WHEN 'Service Attitude'       THEN 'service'
        WHEN 'Service Speed'          THEN 'service'
        WHEN 'Wait Time'              THEN 'service'
        WHEN 'Reservation Experience' THEN 'service'
        WHEN 'Management'             THEN 'service'
        WHEN 'Ambience'               THEN 'ambience'
        WHEN 'Cleanliness'            THEN 'ambience'
        WHEN 'Value'                  THEN 'value'
        ELSE NULL
      END) = p_bucket
    GROUP BY raw_cat.category
  ),
  prev_period AS (
    SELECT
      raw_cat.category AS cat,
      COUNT(*) AS cnt
    FROM public.review_analyses ra
    CROSS JOIN LATERAL (
      SELECT s.elem->>'category' AS category
      FROM jsonb_array_elements(ra.strengths) AS s(elem)
      UNION ALL
      SELECT o.elem->>'category' AS category
      FROM jsonb_array_elements(ra.opportunities) AS o(elem)
    ) raw_cat
    WHERE ra.restaurant_id = p_restaurant_id
      AND ra.review_date::date >= v_prev_start
      AND ra.review_date::date <= v_prev_end
      AND (CASE raw_cat.category
        WHEN 'Food Quality'           THEN 'food'
        WHEN 'Presentation'           THEN 'food'
        WHEN 'Service Attitude'       THEN 'service'
        WHEN 'Service Speed'          THEN 'service'
        WHEN 'Wait Time'              THEN 'service'
        WHEN 'Reservation Experience' THEN 'service'
        WHEN 'Management'             THEN 'service'
        WHEN 'Ambience'               THEN 'ambience'
        WHEN 'Cleanliness'            THEN 'ambience'
        WHEN 'Value'                  THEN 'value'
        ELSE NULL
      END) = p_bucket
    GROUP BY raw_cat.category
  )
  SELECT
    cp.cat           AS category,
    cp.avg_int       AS avg_intensity,
    cp.cnt           AS mentions,
    (cp.cnt - COALESCE(pp.cnt, 0)) AS trend_delta
  FROM current_period cp
  LEFT JOIN prev_period pp ON pp.cat = cp.cat
  ORDER BY cp.cnt DESC
  LIMIT p_limit;
END;
$$;
