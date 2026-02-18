-- Integrate expire_rollouts() into the existing cleanup function
-- so that any scheduled cron job picks up rollout expiry automatically.

CREATE OR REPLACE FUNCTION public.cleanup_expired_training_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete expired conversations (only non-flagged ones)
  DELETE FROM public.course_conversations
  WHERE expires_at < now() AND is_flagged = false;

  -- Redact expired voice transcriptions (privacy compliance)
  UPDATE public.quiz_attempt_answers
  SET transcription = NULL
  WHERE transcription_expires_at IS NOT NULL
    AND transcription_expires_at < now()
    AND transcription IS NOT NULL;

  -- Expire rollouts past their expiry date and mark overdue assignments
  PERFORM public.expire_rollouts();
END;
$$;
