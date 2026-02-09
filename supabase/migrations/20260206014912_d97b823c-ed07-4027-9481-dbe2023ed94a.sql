-- Fix search_path for functions that were flagged by linter

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix accept_invite function
CREATE OR REPLACE FUNCTION public.accept_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Find valid invite
  SELECT * INTO v_invite
  FROM public.invites
  WHERE token = invite_token
    AND used_at IS NULL
    AND expires_at > now()
    AND (email IS NULL OR email = (SELECT email FROM auth.users WHERE id = v_user_id));
  
  IF v_invite IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_id = v_invite.group_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Already a member of this group');
  END IF;
  
  -- Create membership
  INSERT INTO public.group_memberships (group_id, user_id, role)
  VALUES (v_invite.group_id, v_user_id, v_invite.role);
  
  -- Mark invite as used
  UPDATE public.invites
  SET used_at = now(), used_by = v_user_id
  WHERE id = v_invite.id;
  
  RETURN json_build_object(
    'success', true,
    'group_id', v_invite.group_id,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix get_user_permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT json_build_object(
    'user_id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'default_language', p.default_language,
    'is_active', p.is_active,
    'memberships', COALESCE((
      SELECT json_agg(json_build_object(
        'group_id', gm.group_id,
        'group_name', g.name,
        'group_slug', g.slug,
        'role', gm.role,
        'policy', (
          SELECT json_build_object(
            'daily_ai_limit', rp.daily_ai_limit,
            'monthly_ai_limit', rp.monthly_ai_limit,
            'voice_enabled', rp.voice_enabled,
            'can_view_manual', rp.can_view_manual,
            'can_use_search', rp.can_use_search,
            'can_use_ai', rp.can_use_ai
          )
          FROM public.role_policies rp
          WHERE rp.group_id = gm.group_id AND rp.role = gm.role
        )
      ))
      FROM public.group_memberships gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.user_id = p.id AND g.is_active = true
    ), '[]'::json)
  ) INTO v_result
  FROM public.profiles p
  WHERE p.id = v_user_id AND p.is_active = true;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;