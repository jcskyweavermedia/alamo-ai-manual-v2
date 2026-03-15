-- =============================================================================
-- MIGRATION: Upgrade get_user_group_id() for multi-unit context
-- Phase A.6: Active unit context via GUC setting with fallback
-- =============================================================================

-- Rewrite from SQL to plpgsql for branching logic
-- Backward compatible: same signature, same return type
-- Single-unit users get identical behavior (GUC is empty -> fallback to LIMIT 1)
CREATE OR REPLACE FUNCTION public.get_user_group_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_unit UUID;
  v_fallback UUID;
BEGIN
  -- Check for active unit context set by the app layer
  -- current_setting returns '' when not set (due to the true flag)
  v_active_unit := NULLIF(current_setting('app.active_unit_id', true), '')::UUID;

  -- If an active unit is set, verify the user is actually a member
  IF v_active_unit IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE user_id = auth.uid() AND group_id = v_active_unit
    ) THEN
      RETURN v_active_unit;
    END IF;
    -- Not a member of the requested unit — fall through to default
  END IF;

  -- Fallback: first group membership (same as previous behavior)
  SELECT gm.group_id INTO v_fallback
  FROM public.group_memberships gm
  WHERE gm.user_id = auth.uid()
  LIMIT 1;

  RETURN v_fallback;
END;
$$;

-- Helper function to set the active unit context
-- Called by frontend via supabase.rpc() before queries
CREATE OR REPLACE FUNCTION public.set_active_unit(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the user is a member of this unit
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE user_id = auth.uid() AND group_id = p_unit_id
  ) THEN
    RETURN false;
  END IF;

  -- Set the session-level GUC (persists for the connection)
  PERFORM set_config('app.active_unit_id', p_unit_id::TEXT, false);
  RETURN true;
END;
$$;
