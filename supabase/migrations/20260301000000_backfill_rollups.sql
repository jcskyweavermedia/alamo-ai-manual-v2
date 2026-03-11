-- One-time backfill: run rollup functions for ALL historical review dates.
-- The rollup functions are SECURITY DEFINER and use UPSERT, so re-running is safe.
-- This migration runs as postgres, which owns the functions and has EXECUTE permission.
--
-- Estimated time: 3-10 minutes depending on review volume (~188 unique dates, ~866 reviews).

DO $$
DECLARE
  rec          RECORD;
  daily_count  INTEGER;
  intel_count  INTEGER;
  total_daily  INTEGER := 0;
  total_intel  INTEGER := 0;
  date_count   INTEGER := 0;
  start_ts     TIMESTAMPTZ := clock_timestamp();
BEGIN
  RAISE NOTICE '=== BACKFILL PHASE 1: Daily Flavor Index ===';

  -- Phase 1: Run daily rollup for every unique review date
  FOR rec IN
    SELECT DISTINCT review_date::date AS d
    FROM public.restaurant_reviews
    WHERE review_date IS NOT NULL
      AND review_date::date <= CURRENT_DATE - 1  -- functions reject future dates
    ORDER BY d
  LOOP
    SELECT public.rollup_daily_flavor_index(rec.d) INTO daily_count;
    total_daily := total_daily + daily_count;
    date_count := date_count + 1;

    -- Log every 20 dates for progress
    IF date_count % 20 = 0 THEN
      RAISE NOTICE '  ... processed % dates (% daily rows so far)', date_count, total_daily;
    END IF;
  END LOOP;

  RAISE NOTICE 'Phase 1 complete: % dates → % daily rollup rows (%.1fs)',
    date_count, total_daily,
    EXTRACT(EPOCH FROM clock_timestamp() - start_ts);

  -- Phase 2: Run intelligence rollup for each unique date
  -- (function internally computes week/month/quarter containing each date;
  --  UPSERT makes redundant period recomputation harmless)
  RAISE NOTICE '=== BACKFILL PHASE 2: Review Intelligence ===';
  date_count := 0;

  FOR rec IN
    SELECT DISTINCT review_date::date AS d
    FROM public.restaurant_reviews
    WHERE review_date IS NOT NULL
      AND review_date::date <= CURRENT_DATE - 1
    ORDER BY d
  LOOP
    SELECT public.rollup_review_intelligence(rec.d) INTO intel_count;
    total_intel := total_intel + intel_count;
    date_count := date_count + 1;

    IF date_count % 20 = 0 THEN
      RAISE NOTICE '  ... processed % dates (% intelligence rows so far)', date_count, total_intel;
    END IF;
  END LOOP;

  RAISE NOTICE 'Phase 2 complete: % dates → % intelligence rows (%.1fs total)',
    date_count, total_intel,
    EXTRACT(EPOCH FROM clock_timestamp() - start_ts);

  RAISE NOTICE '=== BACKFILL COMPLETE ===';
  RAISE NOTICE '  flavor_index_daily:  % rows upserted', total_daily;
  RAISE NOTICE '  review_intelligence: % rows upserted', total_intel;
  RAISE NOTICE '  Total time: %.1fs', EXTRACT(EPOCH FROM clock_timestamp() - start_ts);
END $$;
