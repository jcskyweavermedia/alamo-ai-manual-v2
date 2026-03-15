-- =============================================================================
-- MIGRATION: revoke_execute_phase_d_system_functions
-- Prevents authenticated users from directly calling system-only functions.
-- Also adds LIMIT 100 to get_pending_actions and get_recent_insights.
-- Phase D security hardening
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. REVOKE EXECUTE on system/cron-only functions
-- These are called only by pg_cron (as postgres) or internal triggers.
-- Without REVOKE, any authenticated user could call them via supabase.rpc().
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.send_notification(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_auto_enrollment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_training_insights() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_training_actions() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Add LIMIT 100 to get_pending_actions (CREATE OR REPLACE)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_pending_actions(
  p_group_id UUID
)
RETURNS TABLE (
  action_id UUID,
  action_type TEXT,
  status TEXT,
  source TEXT,
  employee_name TEXT,
  program_title TEXT,
  course_title TEXT,
  display_data JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
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
    ta.id AS action_id,
    ta.action_type::TEXT,
    ta.status::TEXT,
    ta.source::TEXT,
    e.display_name::TEXT AS employee_name,
    tp.title_en::TEXT AS program_title,
    c.title_en::TEXT AS course_title,
    ta.display_data,
    ta.expires_at,
    ta.created_at
  FROM public.training_actions ta
  LEFT JOIN public.employees e ON ta.target_employee_id = e.id
  LEFT JOIN public.training_programs tp ON ta.target_program_id = tp.id
  LEFT JOIN public.courses c ON ta.target_course_id = c.id
  WHERE ta.group_id = p_group_id
    AND ta.status = 'pending'
  ORDER BY ta.created_at DESC
  LIMIT 100;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Add LIMIT 100 to get_recent_insights (CREATE OR REPLACE)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_recent_insights(
  p_group_id UUID,
  p_insight_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  insight_id UUID,
  insight_type TEXT,
  severity TEXT,
  title TEXT,
  body TEXT,
  data JSONB,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ
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
    ti.id AS insight_id,
    ti.insight_type::TEXT,
    ti.severity::TEXT,
    ti.title::TEXT,
    ti.body::TEXT,
    ti.data,
    ti.period_start,
    ti.period_end,
    ti.created_at
  FROM public.training_insights ti
  WHERE ti.group_id = p_group_id
    AND ti.superseded_by IS NULL
    AND (p_insight_type IS NULL OR ti.insight_type = p_insight_type)
  ORDER BY
    CASE ti.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
    ti.created_at DESC
  LIMIT 100;
END;
$$;

COMMIT;
