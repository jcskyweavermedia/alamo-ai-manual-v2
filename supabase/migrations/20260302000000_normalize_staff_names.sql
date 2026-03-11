-- =============================================================================
-- Phase 5b: Staff Name Normalization + Aggregation Hardening
-- =============================================================================
-- 1. Enable unaccent extension (handles José/Jose merging)
-- 2. Normalize existing staff_mentioned JSONB in-place
-- 3. Harden aggregate_staff_mentions() with normalized GROUP BY
-- 4. Re-run rollup_review_intelligence to refresh top_staff
-- =============================================================================

-- ── Phase 1: Enable unaccent ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- ── Phase 2: Normalize existing staff_mentioned JSONB ─────────────────────
-- COALESCE prevents NULL when all entries are generic descriptions (CRITICAL)
UPDATE public.review_analyses
SET staff_mentioned = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_set(elem, '{name}',
        to_jsonb(
          initcap(split_part(trim(extensions.unaccent(elem->>'name')), ' ', 1))
        )
      )
    )
    FROM jsonb_array_elements(staff_mentioned) AS elem
    WHERE lower(trim(elem->>'name')) NOT IN (
      'our server', 'the server', 'our waiter', 'the waiter',
      'our bartender', 'the bartender', 'our host', 'the host',
      'the manager', 'our manager', 'a server', 'a waiter',
      'my server', 'my waiter', 'my bartender', 'the hostess',
      'our hostess', 'my hostess', 'the chef', 'our chef'
    )
    AND length(trim(elem->>'name')) > 1
  ),
  '[]'::jsonb
)
WHERE jsonb_array_length(staff_mentioned) > 0;

-- ── Phase 3: Harden aggregate_staff_mentions() ───────────────────────────
CREATE OR REPLACE FUNCTION public.aggregate_staff_mentions(
  p_restaurant_id UUID,
  p_start_date    DATE,
  p_end_date      DATE,
  p_limit         INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT
      initcap(split_part(trim(extensions.unaccent(staff->>'name')), ' ', 1)) AS name,
      staff->>'role'  AS role,
      COUNT(*)        AS mentions,
      COUNT(*) FILTER (WHERE staff->>'sentiment' = 'positive') AS positive,
      COUNT(*) FILTER (WHERE staff->>'sentiment' = 'negative') AS negative
    FROM public.review_analyses ra,
         jsonb_array_elements(ra.staff_mentioned) AS staff
    WHERE ra.restaurant_id = p_restaurant_id
      AND ra.review_date >= p_start_date::timestamptz
      AND ra.review_date <  (p_end_date + 1)::timestamptz
      AND length(trim(staff->>'name')) > 1
      AND lower(trim(staff->>'name')) NOT IN (
        'our server', 'the server', 'our waiter', 'the waiter',
        'our bartender', 'the bartender', 'our host', 'the host',
        'the manager', 'our manager', 'a server', 'a waiter',
        'my server', 'my waiter', 'my bartender', 'the hostess',
        'our hostess', 'my hostess', 'the chef', 'our chef'
      )
    GROUP BY initcap(split_part(trim(extensions.unaccent(staff->>'name')), ' ', 1)),
             staff->>'role'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;
$$;

-- Keep EXECUTE permissions consistent with original
REVOKE ALL ON FUNCTION public.aggregate_staff_mentions(UUID, DATE, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aggregate_staff_mentions(UUID, DATE, DATE, INTEGER)
  TO authenticated;

-- ── Phase 4: Re-run rollup_review_intelligence only ──────────────────────
-- (staff data doesn't affect flavor_index_daily, so skip that)
DO $$
DECLARE
  rec   RECORD;
  total INTEGER := 0;
  start_ts TIMESTAMPTZ := clock_timestamp();
BEGIN
  RAISE NOTICE '=== Re-running rollup_review_intelligence for staff normalization ===';

  FOR rec IN
    SELECT DISTINCT review_date::date AS d
    FROM public.restaurant_reviews
    WHERE review_date IS NOT NULL
      AND review_date::date <= CURRENT_DATE - 1
    ORDER BY d
  LOOP
    PERFORM public.rollup_review_intelligence(rec.d);
    total := total + 1;
    IF total % 30 = 0 THEN
      RAISE NOTICE '  ... processed % dates', total;
    END IF;
  END LOOP;

  RAISE NOTICE '=== Done: re-rolled % dates in % ===',
    total, (clock_timestamp() - start_ts)::text;
END $$;
