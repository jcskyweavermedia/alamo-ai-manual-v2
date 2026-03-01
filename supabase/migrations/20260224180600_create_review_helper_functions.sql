-- M07: Review helper functions — Flavor Index computation, competitor lookup, JSONB aggregation

-- Compute Flavor Index for any time range (from daily rollups)
-- NOTE: No SECURITY DEFINER — runs as the calling user, so RLS on
-- flavor_index_daily enforces group_id scoping automatically.
-- Edge functions use service role (bypasses RLS anyway).
CREATE OR REPLACE FUNCTION public.compute_flavor_index_range(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_reviews BIGINT,
  five_star BIGINT,
  four_star BIGINT,
  low_star BIGINT,
  flavor_index NUMERIC(5,2),
  avg_rating NUMERIC(3,2)
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(fid.total_reviews), 0),
    COALESCE(SUM(fid.five_star), 0),
    COALESCE(SUM(fid.four_star), 0),
    COALESCE(SUM(fid.one_star + fid.two_star + fid.three_star), 0),
    CASE WHEN SUM(fid.total_reviews) > 0
      THEN ROUND(
        (SUM(fid.five_star)::numeric / SUM(fid.total_reviews)) * 100
        - (SUM(fid.one_star + fid.two_star + fid.three_star)::numeric / SUM(fid.total_reviews)) * 100
      , 2)
      ELSE 0
    END,
    -- Weighted average (not average-of-averages)
    CASE WHEN SUM(fid.total_reviews) > 0
      THEN ROUND(
        (SUM(fid.one_star * 1.0 + fid.two_star * 2.0 + fid.three_star * 3.0
           + fid.four_star * 4.0 + fid.five_star * 5.0)
         / SUM(fid.total_reviews))
      , 2)
      ELSE NULL
    END
  FROM public.flavor_index_daily fid
  WHERE fid.restaurant_id = p_restaurant_id
    AND fid.date >= p_start_date
    AND fid.date <= p_end_date;
$$;

-- Get competitor IDs for a given unit
-- NOTE: No SECURITY DEFINER — RLS on tracked_restaurants handles group scoping.
CREATE OR REPLACE FUNCTION public.get_competitor_ids(p_unit_id UUID)
RETURNS UUID[]
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(id), '{}')
  FROM public.tracked_restaurants
  WHERE parent_unit_id = p_unit_id
    AND restaurant_type = 'competitor'
    AND status = 'active';
$$;

-- Aggregate staff mentions for arbitrary date ranges
-- Moved from Phase 7 to Phase 1: Phase 5 (Full Dashboard) needs this
-- for useStaffPerformance() hook. Uses ::date cast for correct TIMESTAMPTZ boundary comparisons.
CREATE OR REPLACE FUNCTION public.aggregate_staff_mentions(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT
      staff->>'name' AS name,
      staff->>'role' AS role,
      COUNT(*) AS mentions,
      COUNT(*) FILTER (WHERE staff->>'sentiment' = 'positive') AS positive,
      COUNT(*) FILTER (WHERE staff->>'sentiment' = 'negative') AS negative
    FROM public.review_analyses ra,
         jsonb_array_elements(ra.staff_mentioned) AS staff
    WHERE ra.restaurant_id = p_restaurant_id
      AND ra.review_date::date >= p_start_date
      AND ra.review_date::date <= p_end_date
    GROUP BY staff->>'name', staff->>'role'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;
$$;

-- Aggregate item mentions for arbitrary date ranges
-- Moved from Phase 7 to Phase 1: Phase 5 (Full Dashboard) needs this
-- for useTopMentions() hook.
CREATE OR REPLACE FUNCTION public.aggregate_item_mentions(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT
      item->>'name' AS name,
      item->>'item_type' AS item_type,
      item->>'course_type' AS course_type,
      COUNT(*) AS mentions,
      COUNT(*) FILTER (WHERE item->>'sentiment' = 'positive') AS positive,
      COUNT(*) FILTER (WHERE item->>'sentiment' = 'negative') AS negative,
      ROUND(AVG((item->>'intensity')::numeric), 1) AS avg_intensity
    FROM public.review_analyses ra,
         jsonb_array_elements(ra.items_mentioned) AS item
    WHERE ra.restaurant_id = p_restaurant_id
      AND ra.review_date::date >= p_start_date
      AND ra.review_date::date <= p_end_date
    GROUP BY item->>'name', item->>'item_type', item->>'course_type'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;
$$;
