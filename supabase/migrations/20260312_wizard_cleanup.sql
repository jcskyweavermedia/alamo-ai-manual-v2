-- =============================================================================
-- Migration: 20260312_wizard_cleanup.sql
-- Purpose:
--   1. pg_cron job to clean up orphaned draft courses every 6 hours.
--      Orphaned drafts are created when a user starts the course wizard
--      (which INSERTs a draft row) but closes the browser tab without
--      clicking Cancel. These drafts are older than 24 hours and have
--      no course_sections (i.e., never went through the build pipeline).
--
--   2. RLS policy allowing creators to delete their own draft courses.
--      Previously only admins could delete courses, so managers who
--      cancel the wizard couldn't clean up the draft they just created.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. pg_cron job: cleanup-orphaned-wizard-drafts
-- ---------------------------------------------------------------------------

-- Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Unschedule existing job if it exists (idempotent)
DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-orphaned-wizard-drafts');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule cleanup every 6 hours (at minute 0)
-- Safety guarantees:
--   - Only deletes 'draft' status (never published/archived)
--   - Only deletes if older than 24 hours (no race with active wizard sessions)
--   - Only deletes if no sections exist (built courses always have sections)
SELECT cron.schedule(
  'cleanup-orphaned-wizard-drafts',
  '0 */6 * * *',
  $$
    DELETE FROM public.courses
    WHERE status = 'draft'
      AND created_at < now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.course_sections cs WHERE cs.course_id = courses.id
      );
  $$
);

-- ---------------------------------------------------------------------------
-- 2. RLS policy: creators can delete their own draft courses
-- ---------------------------------------------------------------------------

-- Drop existing policy if present (idempotent)
DROP POLICY IF EXISTS "Creators can delete own draft courses" ON public.courses;

-- Allow any authenticated user to delete their OWN draft courses
-- within their group. The status = 'draft' constraint prevents
-- deletion of published/active courses. The group_id check ensures
-- group isolation.
CREATE POLICY "Creators can delete own draft courses"
  ON public.courses
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND status = 'draft'
    AND group_id = public.get_user_group_id()
  );
