-- =============================================================================
-- MIGRATION: Security fixes for Phase A migrations
-- Fixes: C1 (manual_sections RLS), H3 (GUC scope), L1 (fallback ordering)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX C1: Update manual_sections RLS policies to be group-scoped
-- The original policies allow any authenticated user to view ALL sections.
-- Must match the pattern used for product tables in M6.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view manual sections" ON public.manual_sections;
CREATE POLICY "Users can view manual_sections in their group"
  ON public.manual_sections FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

DROP POLICY IF EXISTS "Admins can insert manual sections" ON public.manual_sections;
CREATE POLICY "Admins can insert manual_sections"
  ON public.manual_sections FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update manual sections" ON public.manual_sections;
CREATE POLICY "Admins can update manual_sections"
  ON public.manual_sections FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can delete manual sections" ON public.manual_sections;
CREATE POLICY "Admins can delete manual_sections"
  ON public.manual_sections FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX H3 + L1: Fix set_active_unit() GUC scope + get_user_group_id() ordering
-- H3: Change set_config third param from false (session) to true (transaction)
-- L1: Add ORDER BY gm.created_at ASC to fallback query
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_active_unit := NULLIF(current_setting('app.active_unit_id', true), '')::UUID;

  IF v_active_unit IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE user_id = auth.uid() AND group_id = v_active_unit
    ) THEN
      RETURN v_active_unit;
    END IF;
  END IF;

  -- FIX L1: deterministic ordering by created_at
  SELECT gm.group_id INTO v_fallback
  FROM public.group_memberships gm
  WHERE gm.user_id = auth.uid()
  ORDER BY gm.created_at ASC
  LIMIT 1;

  RETURN v_fallback;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_active_unit(p_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE user_id = auth.uid() AND group_id = p_unit_id
  ) THEN
    RETURN false;
  END IF;

  -- FIX H3: transaction-scoped (true) instead of session-scoped (false)
  PERFORM set_config('app.active_unit_id', p_unit_id::TEXT, true);
  RETURN true;
END;
$$;
