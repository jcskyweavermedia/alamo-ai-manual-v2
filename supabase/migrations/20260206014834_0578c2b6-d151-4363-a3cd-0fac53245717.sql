-- ============================================
-- REQUIRED EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================
-- ROLE ENUM
-- ============================================
CREATE TYPE public.user_role AS ENUM ('staff', 'manager', 'admin');

-- ============================================
-- PROFILES: Extended user data beyond auth.users
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en', 'es')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for active user lookups
CREATE INDEX idx_profiles_active ON public.profiles(is_active) WHERE is_active = true;

-- ============================================
-- GROUPS: Organizational units (locations, departments)
-- ============================================
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- GROUP_MEMBERSHIPS: User-to-group assignments with roles
-- ============================================
CREATE TABLE public.group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Index for user role lookups
CREATE INDEX idx_group_memberships_user ON public.group_memberships(user_id);
CREATE INDEX idx_group_memberships_group ON public.group_memberships(group_id);

-- ============================================
-- ROLE_POLICIES: Feature limits per role per group
-- ============================================
CREATE TABLE public.role_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  daily_ai_limit INTEGER NOT NULL DEFAULT 20,
  monthly_ai_limit INTEGER NOT NULL DEFAULT 500,
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  can_view_manual BOOLEAN NOT NULL DEFAULT true,
  can_use_search BOOLEAN NOT NULL DEFAULT true,
  can_use_ai BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, role)
);

-- ============================================
-- INVITES: Invite tokens for onboarding
-- ============================================
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  email TEXT,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'staff',
  invited_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for token lookups
CREATE INDEX idx_invites_token ON public.invites(token) WHERE used_at IS NULL;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTIONS (CRITICAL for RLS)
-- ============================================

-- Check if user has a specific role anywhere
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_memberships
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user has a specific role in a specific group
CREATE OR REPLACE FUNCTION public.has_role_in_group(
  _user_id UUID, 
  _group_id UUID, 
  _role public.user_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_memberships
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND role = _role
  )
$$;

-- Check if user is a member of a group (any role)
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_memberships
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- Get all group IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_groups(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id
  FROM public.group_memberships
  WHERE user_id = _user_id
$$;

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ACCEPT INVITE FUNCTION
-- ============================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GET USER PERMISSIONS FUNCTION
-- ============================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES: PROFILES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles in their groups
CREATE POLICY "Admins can view group profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND
    EXISTS (
      SELECT 1 FROM public.get_user_groups(auth.uid()) admin_groups
      WHERE admin_groups IN (SELECT group_id FROM public.group_memberships WHERE user_id = profiles.id)
    )
  );

-- ============================================
-- RLS POLICIES: GROUPS
-- ============================================

-- Users can view groups they belong to
CREATE POLICY "Users can view their groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (public.is_group_member(auth.uid(), id));

-- ============================================
-- RLS POLICIES: GROUP_MEMBERSHIPS
-- ============================================

-- Users can view their own memberships
CREATE POLICY "Users can view own memberships"
  ON public.group_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all memberships in their groups
CREATE POLICY "Admins can view group memberships"
  ON public.group_memberships FOR SELECT
  TO authenticated
  USING (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- Admins can insert memberships in their groups
CREATE POLICY "Admins can insert group memberships"
  ON public.group_memberships FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- Admins can update memberships in their groups
CREATE POLICY "Admins can update group memberships"
  ON public.group_memberships FOR UPDATE
  TO authenticated
  USING (public.has_role_in_group(auth.uid(), group_id, 'admin'))
  WITH CHECK (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- Admins can delete memberships in their groups
CREATE POLICY "Admins can delete group memberships"
  ON public.group_memberships FOR DELETE
  TO authenticated
  USING (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- ============================================
-- RLS POLICIES: ROLE_POLICIES
-- ============================================

-- Users can view policies for their groups
CREATE POLICY "Users can view group policies"
  ON public.role_policies FOR SELECT
  TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

-- Admins can manage policies for their groups
CREATE POLICY "Admins can manage group policies"
  ON public.role_policies FOR ALL
  TO authenticated
  USING (public.has_role_in_group(auth.uid(), group_id, 'admin'))
  WITH CHECK (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- ============================================
-- RLS POLICIES: INVITES
-- ============================================

-- Anyone authenticated can read invites (for acceptance flow)
CREATE POLICY "Anyone can view invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (true);

-- Admins can create invites for their groups
CREATE POLICY "Admins can create invites"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- Admins can delete invites for their groups
CREATE POLICY "Admins can delete invites"
  ON public.invites FOR DELETE
  TO authenticated
  USING (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_memberships_updated_at
  BEFORE UPDATE ON public.group_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_policies_updated_at
  BEFORE UPDATE ON public.role_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED DATA: Default group and role policies
-- ============================================
INSERT INTO public.groups (id, name, slug, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Restaurant',
  'demo-restaurant',
  'Default demo location for development'
);

INSERT INTO public.role_policies (group_id, role, daily_ai_limit, monthly_ai_limit, voice_enabled)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'staff', 20, 500, false),
  ('00000000-0000-0000-0000-000000000001', 'manager', 50, 1000, true),
  ('00000000-0000-0000-0000-000000000001', 'admin', 100, 2000, true);