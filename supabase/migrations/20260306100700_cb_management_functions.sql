-- =============================================================================
-- Course Builder Phase 5A: MANAGEMENT FUNCTIONS
-- Creates 3 functions + 1 cron job for the Course Player:
--   1. get_team_progress()          — Manager dashboard: team progress across courses
--   2. cleanup_expired_training_data() — Daily cleanup of expired conversations/transcriptions
--   3. expire_rollouts()            — Placeholder (no-op, replaced in Phase 8)
--   4. Cron job: cleanup-training-data at 2 AM UTC daily
--
-- All functions use SECURITY DEFINER + SET search_path = public
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FUNCTION 1: get_team_progress(p_group_id UUID)
-- Returns user progress across courses for the manager dashboard.
-- One row per (user, course) enrollment with progress details.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_team_progress(p_group_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  user_full_name TEXT,
  user_role TEXT,
  course_id UUID,
  course_title TEXT,
  program_id UUID,
  program_title TEXT,
  enrollment_status TEXT,
  total_sections INTEGER,
  completed_sections INTEGER,
  progress_pct NUMERIC,
  final_score INTEGER,
  final_passed BOOLEAN,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_overdue BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Caller must be a manager or admin in the target group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id = p_group_id
      AND gm.role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: must be a manager or admin in the target group';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.email AS user_email,
    COALESCE(p.full_name, p.email) AS user_full_name,
    gm.role::TEXT AS user_role,
    c.id AS course_id,
    c.title_en AS course_title,
    c.program_id,
    tp.title_en AS program_title,
    ce.status AS enrollment_status,
    ce.total_sections,
    ce.completed_sections,
    CASE WHEN ce.total_sections > 0
      THEN ROUND((ce.completed_sections::NUMERIC / ce.total_sections::NUMERIC) * 100, 1)
      ELSE 0
    END AS progress_pct,
    ce.final_score,
    ce.final_passed,
    ce.started_at,
    ce.completed_at,
    ce.expires_at,
    CASE WHEN ce.expires_at IS NOT NULL AND ce.expires_at < now() AND ce.status != 'completed'
      THEN true
      ELSE false
    END AS is_overdue
  FROM public.course_enrollments ce
  JOIN public.profiles p ON p.id = ce.user_id
  JOIN public.group_memberships gm ON gm.user_id = p.id AND gm.group_id = p_group_id
  JOIN public.courses c ON c.id = ce.course_id
  LEFT JOIN public.training_programs tp ON tp.id = c.program_id
  WHERE ce.group_id = p_group_id
  ORDER BY p.full_name, c.sort_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- FUNCTION 2: cleanup_expired_training_data()
-- Daily maintenance: delete expired conversations, redact voice transcriptions,
-- and clean up expired conversation_messages.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_expired_training_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversations_deleted INTEGER;
  v_transcriptions_redacted INTEGER;
  v_messages_deleted INTEGER;
BEGIN
  -- 1. Delete expired conversations (only non-flagged ones)
  DELETE FROM public.course_conversations
  WHERE expires_at < now()
    AND is_flagged = false;
  GET DIAGNOSTICS v_conversations_deleted = ROW_COUNT;

  -- 2. Redact expired voice transcriptions (privacy compliance)
  UPDATE public.quiz_attempt_answers
  SET transcription = NULL
  WHERE transcription_expires_at IS NOT NULL
    AND transcription_expires_at < now()
    AND transcription IS NOT NULL;
  GET DIAGNOSTICS v_transcriptions_redacted = ROW_COUNT;

  -- 3. Delete conversation_messages from expired/abandoned quiz attempts
  --    where the transcript has expired
  DELETE FROM public.conversation_messages cm
  WHERE EXISTS (
    SELECT 1 FROM public.quiz_attempts qa
    WHERE qa.id = cm.attempt_id
      AND qa.transcript_expires_at IS NOT NULL
      AND qa.transcript_expires_at < now()
  );
  GET DIAGNOSTICS v_messages_deleted = ROW_COUNT;

  -- Log results for monitoring (visible in pg_cron job output)
  RAISE NOTICE 'cleanup_expired_training_data: conversations=%, transcriptions=%, messages=%',
    v_conversations_deleted, v_transcriptions_redacted, v_messages_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- FUNCTION 3: expire_rollouts()
-- Placeholder (no-op). Will be replaced with real logic in Phase 8
-- when the Rollouts system is rebuilt.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_rollouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Placeholder: replaced in Phase 8 with rollout expiration logic
  NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- CRON JOB: cleanup-training-data
-- Runs daily at 2 AM UTC. Wrapped in DO block with exception handler
-- because pg_cron may not be available in all environments.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Attempt to unschedule first (idempotent)
  BEGIN
    PERFORM cron.unschedule('cleanup-training-data');
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'pg_cron not available, skipping unschedule';
    WHEN OTHERS THEN
      RAISE NOTICE 'Cron job cleanup-training-data may not exist, skipping: %', SQLERRM;
  END;

  -- Schedule the cleanup job
  BEGIN
    PERFORM cron.schedule(
      'cleanup-training-data',
      '0 2 * * *',
      'SELECT public.cleanup_expired_training_data()'
    );
    RAISE NOTICE 'Scheduled cleanup-training-data cron job at 0 2 * * *';
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'pg_cron not available, skipping schedule. Run manually or enable pg_cron.';
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
  END;
END;
$$;
