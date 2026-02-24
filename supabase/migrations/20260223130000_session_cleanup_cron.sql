-- =============================================================================
-- Migration: Automated cleanup of stale ingestion sessions
-- =============================================================================
-- Adds a cleanup function and schedules it via pg_cron (daily at 3 AM UTC).
-- Thresholds:
--   drafting  > 7 days untouched → abandoned
--   abandoned > 30 days          → hard DELETE
--   deleted   > 7 days           → hard DELETE
--   failed    > 30 days          → hard DELETE
-- =============================================================================

-- 1. Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_stale_ingestion_sessions()
RETURNS TABLE(abandoned_count INT, deleted_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_abandoned INT;
  v_deleted INT;
BEGIN
  -- Auto-abandon drafting sessions untouched for 7+ days
  WITH abandoned AS (
    UPDATE ingestion_sessions
    SET status = 'abandoned', updated_at = now()
    WHERE status = 'drafting'
      AND updated_at < now() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT count(*)::INT INTO v_abandoned FROM abandoned;

  -- Hard-delete abandoned sessions older than 30 days
  -- (CASCADE deletes ingestion_messages too)
  WITH deleted_abandoned AS (
    DELETE FROM ingestion_sessions
    WHERE status = 'abandoned'
      AND updated_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT count(*)::INT INTO v_deleted FROM deleted_abandoned;

  -- Hard-delete 'deleted' sessions older than 7 days
  WITH deleted_soft AS (
    DELETE FROM ingestion_sessions
    WHERE status = 'deleted'
      AND updated_at < now() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT v_deleted + count(*)::INT INTO v_deleted FROM deleted_soft;

  -- Hard-delete 'failed' sessions older than 30 days
  WITH deleted_failed AS (
    DELETE FROM ingestion_sessions
    WHERE status = 'failed'
      AND updated_at < now() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT v_deleted + count(*)::INT INTO v_deleted FROM deleted_failed;

  abandoned_count := v_abandoned;
  deleted_count := v_deleted;
  RETURN NEXT;
END;
$$;

-- 2. Schedule via pg_cron — daily at 3 AM UTC
--    (pg_cron extension already enabled in migration 20260218170452)
--    Unschedule first for idempotency (safe if job doesn't exist yet)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-stale-ingestion-sessions');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Job doesn't exist yet, that's fine
END;
$$;

SELECT cron.schedule(
  'cleanup-stale-ingestion-sessions',
  '0 3 * * *',
  'SELECT * FROM public.cleanup_stale_ingestion_sessions()'
);
