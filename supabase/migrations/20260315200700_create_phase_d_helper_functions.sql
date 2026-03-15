-- =============================================================================
-- MIGRATION: create_phase_d_helper_functions
-- Creates send_notification, mark_notification_read, expire_stale_training_actions
-- Phase D: Auto-Assignment + Insights
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Function 1: send_notification
-- Inserts a notification row and returns its UUID.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_notification(
  p_group_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (id, group_id, user_id, type, title, body, metadata)
  VALUES (extensions.gen_random_uuid(), p_group_id, p_user_id, p_type, p_title, p_body, p_metadata)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function 2: mark_notification_read
-- Marks a notification as read for the calling user. Returns true if a row was
-- actually updated, false otherwise.
-- GET DIAGNOSTICS ROW_COUNT returns an integer, so we compare against 0.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count INT;
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = now()
  WHERE id = p_notification_id
    AND user_id = auth.uid()
    AND read = false;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

-- -----------------------------------------------------------------------------
-- Function 3: expire_stale_training_actions
-- Bulk-expires pending training actions whose expires_at has passed.
-- Returns the number of rows updated.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_training_actions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.training_actions
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
