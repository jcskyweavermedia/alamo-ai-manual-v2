-- =============================================================================
-- Migration: Schedule Phase D training automation cron jobs
-- =============================================================================
-- Two pg_cron jobs:
--   1. auto-enrollment-daily  (5 AM UTC daily)
--      - Expire stale training actions, then run auto-enrollment
--   2. insights-weekly        (6 AM UTC Sundays)
--      - Generate training insights for the past week
-- =============================================================================

BEGIN;

-- -------------------------------------------------------
-- 1. auto-enrollment-daily — 5 AM UTC daily
-- -------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('auto-enrollment-daily');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job doesn't exist yet, that's fine
END;
$$;

SELECT cron.schedule(
  'auto-enrollment-daily',
  '0 5 * * *',
  $$SELECT public.expire_stale_training_actions(); SELECT public.run_auto_enrollment();$$
);

-- -------------------------------------------------------
-- 2. insights-weekly — 6 AM UTC on Sundays
-- -------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('insights-weekly');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job doesn't exist yet, that's fine
END;
$$;

SELECT cron.schedule(
  'insights-weekly',
  '0 6 * * 0',
  $$SELECT public.generate_training_insights();$$
);

COMMIT;
