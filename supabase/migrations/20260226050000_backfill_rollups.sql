-- =============================================================================
-- One-time backfill: run rollup functions for all seeded review data
-- Seeded reviews span 2025-12-01 to 2026-02-28
-- This migration runs as postgres, so SECURITY DEFINER functions are accessible
-- =============================================================================

DO $$
DECLARE
  v_date DATE;
  v_count INTEGER;
BEGIN
  -- Step 1: rollup_daily_flavor_index for each day with review data
  RAISE NOTICE 'Starting daily flavor index backfill...';
  FOR v_date IN
    SELECT generate_series('2025-12-01'::date, CURRENT_DATE - 1, '1 day')::date
  LOOP
    PERFORM public.rollup_daily_flavor_index(v_date);
  END LOOP;

  SELECT COUNT(*) INTO v_count FROM public.flavor_index_daily;
  RAISE NOTICE 'flavor_index_daily: % rows after backfill', v_count;

  -- Step 2: rollup_review_intelligence for sampled dates (covers all week/month/quarter periods)
  RAISE NOTICE 'Starting review intelligence backfill...';
  FOR v_date IN
    SELECT generate_series('2025-12-01'::date, CURRENT_DATE - 1, '7 days')::date
  LOOP
    PERFORM public.rollup_review_intelligence(v_date);
  END LOOP;
  -- Also run for last day to ensure latest period is covered
  PERFORM public.rollup_review_intelligence(CURRENT_DATE - 1);

  SELECT COUNT(*) INTO v_count FROM public.review_intelligence;
  RAISE NOTICE 'review_intelligence: % rows after backfill', v_count;

  RAISE NOTICE 'Backfill complete.';
END;
$$;
