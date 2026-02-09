-- =============================================================================
-- Phase 3: Group Signup Controls and Auto-Join Function
-- =============================================================================

-- Add allow_signups column to control join link availability
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS allow_signups boolean NOT NULL DEFAULT true;

-- Index for efficient lookup on join pages
CREATE INDEX IF NOT EXISTS idx_groups_slug_signups 
ON public.groups (slug) 
WHERE is_active = true AND allow_signups = true;

-- Drop old policy and recreate with allow_signups check
DROP POLICY IF EXISTS "Anyone can view active groups by slug" ON public.groups;

CREATE POLICY "Anyone can view active groups by slug"
  ON public.groups FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND allow_signups = true);

-- =============================================================================
-- join_group_by_slug: Auto-assign user to group after signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.join_group_by_slug(group_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group RECORD;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Find active group that accepts signups
  SELECT id, name, slug INTO v_group
  FROM public.groups
  WHERE slug = group_slug
    AND is_active = true
    AND allow_signups = true;
  
  IF v_group IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Group not found or not accepting signups');
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_id = v_group.id AND user_id = v_user_id
  ) THEN
    -- Already a member is not an error - return success
    RETURN json_build_object(
      'success', true,
      'already_member', true,
      'group_id', v_group.id,
      'group_name', v_group.name
    );
  END IF;
  
  -- Create membership with staff role
  INSERT INTO public.group_memberships (group_id, user_id, role)
  VALUES (v_group.id, v_user_id, 'staff');
  
  RETURN json_build_object(
    'success', true,
    'already_member', false,
    'group_id', v_group.id,
    'group_name', v_group.name,
    'role', 'staff'
  );
END;
$$;