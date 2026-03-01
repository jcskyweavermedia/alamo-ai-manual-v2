-- =============================================================================
-- Migration: Schedule daily review rollup via pg_cron
-- =============================================================================
-- Schedules public.run_daily_review_rollups() to run daily at 4 AM UTC.
-- This wrapper (created in M01: 20260225040000) calls both:
--   1. rollup_daily_flavor_index()   — aggregates flavor_index_daily rows
--   2. rollup_review_intelligence()  — aggregates review_intelligence period rows
--
-- Why 4 AM UTC: Runs 1 hour after the session cleanup job (3 AM UTC), giving
-- ample buffer for any late-arriving Apify ingestion webhooks to complete
-- before rollup computation begins.
--
-- pg_cron extension already enabled in migration 20260218170452.
-- =============================================================================

-- 1. Unschedule first for idempotency (safe if job doesn't exist yet)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-review-rollups');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job doesn't exist yet, that's fine
END;
$$;

-- 2. Schedule daily review rollups at 4 AM UTC
SELECT cron.schedule(
  'daily-review-rollups',
  '0 4 * * *',
  'SELECT * FROM public.run_daily_review_rollups()'
);
