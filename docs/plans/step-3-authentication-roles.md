# STEP 3 — AUTHENTICATION & ROLES
## Alamo Prime AI Restaurant Ops

**Objective:** Implement secure access with email/password authentication and role-based control, ensuring the manual and future AI features are protected while keeping onboarding frictionless.

> **Prerequisites:** Step 1 (Design System + App Shell) and Step 2 (Manual Reader MVP) must be complete.  
> **References:** `docs/system-architecture.md`, `docs/design-specs.md`

---

## 1. OVERVIEW

### 1.1 What We're Building

A **Supabase-powered authentication system** with:
- **Email + password sign-in** (traditional, persistent credentials)
- **Shared group join link** for frictionless onboarding (one reusable link per group)
- **No email confirmation** (instant access for internal tools)
- Role-based access control (Staff, Manager, Admin)
- Group membership for multi-location support
- Policy-driven feature access (future AI limits, voice toggle)
- Persistent user preferences (language, theme)

### 1.2 Authentication Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    ONBOARDING FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Admin creates group → gets shareable join link             │
│     Example: /join/demo-restaurant                              │
│                                                                 │
│  2. Manager shares link with new staff member                  │
│                                                                 │
│  3. Staff clicks link → sees SignUp form                       │
│     • Email input                                               │
│     • Password input (user chooses)                             │
│     • Full name (optional)                                      │
│                                                                 │
│  4. Account created → auto-assigned to group as "staff"        │
│     → Immediately logged in → Redirected to /manual            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    RETURNING USER FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User visits /sign-in                                       │
│                                                                 │
│  2. Enters email + password                                    │
│                                                                 │
│  3. Authenticated → Redirected to /manual                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Success Criteria

- [ ] Users can sign up with email + password via shared group link
- [ ] Users can sign in with email + password
- [ ] **No email confirmation required** (instant access)
- [ ] New users are auto-assigned to group with "staff" role
- [ ] Role-based route protection works (staff vs. admin pages)
- [ ] User profile stores language preference (synced from localStorage)
- [ ] Session persists across page refreshes
- [ ] Sign-out works and clears session
- [ ] Disabled users cannot access the app
- [ ] RLS policies protect all user data

### 1.4 What We're NOT Building Yet

- Full admin user management UI (Step 6)
- AI usage limit enforcement (Step 5)
- SSO/OAuth providers (future)
- Multi-factor authentication (future)
- Password reset flow (can add later if needed)

### 1.5 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth method | Email + Password | Familiar pattern, persistent credentials |
| Email confirmation | **Disabled** | Internal tool, shared link = access control |
| Invite system | **Reusable group links** | One link per group, simpler than per-user tokens |
| Password | User-chosen | Avoids generated password friction |
| Default role | Staff | Safest default, admins promote manually |

---

## 2. DATABASE SCHEMA

### 2.1 Core Tables

```sql
-- ============================================
-- PROFILES: Extended user data beyond Supabase auth.users
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
  slug TEXT UNIQUE NOT NULL,  -- Used for join links: /join/:slug
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allow_signups BOOLEAN NOT NULL DEFAULT true,  -- Can disable join link
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- GROUP_MEMBERSHIPS: User-to-group assignments with roles
-- ============================================
CREATE TYPE public.user_role AS ENUM ('staff', 'manager', 'admin');

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
-- INVITES TABLE (SIMPLIFIED - Optional for future per-user invites)
-- ============================================
-- NOTE: For the shared link approach, we use group.slug directly.
-- This table is kept for future per-user invite functionality.
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email TEXT,  -- Optional: pre-assign to specific email
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
```

### 2.2 Row Level Security (RLS) Policies

> **IMPORTANT:** RLS policies use `SECURITY DEFINER` helper functions to check roles.
> This prevents recursive policy evaluation and privilege escalation attacks.

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all profiles in their groups (using helper function)
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
-- GROUPS POLICIES
-- ============================================

-- Users can view groups they belong to (using helper function)
CREATE POLICY "Users can view their groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (public.is_group_member(auth.uid(), id));

-- Anyone can view group by slug for join flow (unauthenticated)
CREATE POLICY "Anyone can view active groups by slug"
  ON public.groups FOR SELECT
  TO anon
  USING (is_active = true AND allow_signups = true);

-- ============================================
-- GROUP_MEMBERSHIPS POLICIES
-- ============================================

-- Users can view their own memberships
CREATE POLICY "Users can view own memberships"
  ON public.group_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all memberships in their groups (using helper function)
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
-- ROLE_POLICIES POLICIES
-- ============================================

-- Users can view policies for their groups (using helper function)
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
-- INVITES POLICIES (for future per-user invites)
-- ============================================

-- Anyone can read an invite by token (for acceptance flow)
CREATE POLICY "Anyone can view invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (true);

-- Admins can create invites for their groups (using helper function)
CREATE POLICY "Admins can create invites"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_in_group(auth.uid(), group_id, 'admin'));

-- Admins can delete invites for their groups
CREATE POLICY "Admins can delete invites"
  ON public.invites FOR DELETE
  TO authenticated
  USING (public.has_role_in_group(auth.uid(), group_id, 'admin'));
```

### 2.3 Database Functions

> **CRITICAL SECURITY NOTE:** All role-checking functions MUST use `SECURITY DEFINER` 
> to bypass RLS and prevent recursive policy evaluation. This is the recommended 
> Supabase pattern for avoiding privilege escalation.

```sql
-- ============================================
-- HAS_ROLE FUNCTION (CRITICAL: Prevents RLS Recursion)
-- ============================================
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

-- ============================================
-- HAS_ROLE_IN_GROUP FUNCTION (Group-scoped role check)
-- ============================================
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

-- ============================================
-- IS_GROUP_MEMBER FUNCTION (Check any membership)
-- ============================================
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

-- ============================================
-- GET_USER_GROUPS FUNCTION (Get all group IDs for a user)
-- ============================================
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
-- JOIN GROUP BY SLUG FUNCTION (For shared link signup)
-- ============================================
CREATE OR REPLACE FUNCTION public.join_group_by_slug(group_slug TEXT)
RETURNS JSON AS $$
DECLARE
  v_group RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Find active group that allows signups
  SELECT * INTO v_group
  FROM public.groups
  WHERE slug = group_slug
    AND is_active = true
    AND allow_signups = true;
  
  IF v_group IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or inactive group');
  END IF;
  
  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_id = v_group.id AND user_id = v_user_id
  ) THEN
    -- Already a member is fine, just return success
    RETURN json_build_object(
      'success', true,
      'group_id', v_group.id,
      'group_name', v_group.name,
      'role', 'staff',
      'already_member', true
    );
  END IF;
  
  -- Create membership with default 'staff' role
  INSERT INTO public.group_memberships (group_id, user_id, role)
  VALUES (v_group.id, v_user_id, 'staff');
  
  RETURN json_build_object(
    'success', true,
    'group_id', v_group.id,
    'group_name', v_group.name,
    'role', 'staff',
    'already_member', false
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
-- ACCEPT INVITE FUNCTION (For future per-user invites)
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
```

---

## 3. COMPONENT ARCHITECTURE

### 3.1 Component Tree

```
Auth Flow (Email + Password)
├── AuthProvider (Context)
│   ├── Session management
│   ├── User profile
│   ├── Permissions
│   └── Loading states
│
├── Pages
│   ├── SignIn.tsx (/sign-in)
│   │   └── SignInForm (email + password)
│   │
│   ├── JoinGroup.tsx (/join/:slug)
│   │   ├── GroupInfo (name, description)
│   │   └── SignUpForm (email + password + name)
│   │
│   └── Profile.tsx
│       ├── ProfileHeader
│       ├── LanguagePreference
│       ├── ThemePreference
│       └── SignOutButton
│
└── Components
    ├── ProtectedRoute.tsx (route guard)
    ├── RoleGate.tsx (conditional render by role)
    └── AuthLoadingScreen.tsx
```

### 3.2 File Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── AuthProvider.tsx         # Context provider
│   │   ├── ProtectedRoute.tsx       # Route guard wrapper
│   │   ├── RoleGate.tsx             # Render children by role
│   │   ├── SignInForm.tsx           # Email + password login
│   │   ├── SignUpForm.tsx           # Email + password + name signup
│   │   ├── AuthLoadingScreen.tsx    # Full-page loading
│   │   └── index.ts                 # Barrel export
│   │
│   └── profile/
│       ├── ProfileHeader.tsx        # Avatar + name + email
│       ├── LanguagePreference.tsx   # EN/ES radio select
│       ├── ThemePreference.tsx      # Light/Dark/System
│       └── SignOutButton.tsx        # Sign out action
│
├── hooks/
│   ├── use-auth.ts                  # Auth context consumer
│   ├── use-profile.ts               # Profile CRUD operations
│   └── use-permissions.ts           # Permission checks
│
├── pages/
│   ├── SignIn.tsx                   # /sign-in
│   ├── JoinGroup.tsx                # /join/:slug
│   └── Profile.tsx                  # /profile (update existing)
│
└── types/
    └── auth.ts                      # TypeScript interfaces
```

---

## 4. DETAILED COMPONENT SPECIFICATIONS

### 4.1 AuthProvider

**Purpose:** Manage authentication state and provide context to the app.

```typescript
// src/components/auth/AuthProvider.tsx

interface AuthContextValue {
  // Session
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Profile
  profile: Profile | null;
  permissions: UserPermissions | null;
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ error?: Error }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  
  // Role checks
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  highestRole: UserRole | null;
}
```

**Behavior:**
- Subscribe to `auth.onAuthStateChange()`
- On session change, fetch user permissions via `get_user_permissions()`
- Store profile/permissions in context
- Redirect to /sign-in if session expires
- Handle loading states during auth check

### 4.2 SignInForm

**Purpose:** Email + password login form.

**UI Layout:**
```
┌──────────────────────────────────────┐
│                                      │
│         🍽️ Alamo Prime               │
│      Restaurant Operations           │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Email address                  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Password                       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │         Sign In                │  │
│  └────────────────────────────────┘  │
│                                      │
│     Don't have an account?           │
│     Ask your manager for access.     │
│                                      │
└──────────────────────────────────────┘
```

**States:**
- Idle: form ready
- Submitting: button loading
- Error: show error message (invalid credentials, etc.)
- Success: redirect to /manual

### 4.3 SignUpForm

**Purpose:** Email + password signup form (used on /join/:slug page).

**UI Layout:**
```
┌──────────────────────────────────────┐
│                                      │
│         🍽️ Alamo Prime               │
│      Restaurant Operations           │
│                                      │
│   Join: Demo Restaurant              │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Full name (optional)           │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Email address                  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Password                       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     Create Account & Join      │  │
│  └────────────────────────────────┘  │
│                                      │
│     Already have an account?         │
│     Sign in instead                  │
│                                      │
└──────────────────────────────────────┘
```

**States:**
- Idle: form ready
- Submitting: button loading
- Error: show error message (email taken, weak password, etc.)
- Success: auto-join group → redirect to /manual

### 4.4 JoinGroup Page

**Purpose:** Handle shared group join link.

**Route:** `/join/:slug`

**Flow:**
1. Parse slug from URL
2. Fetch group info (name, description) from Supabase
3. If group not found or inactive: show error
4. If user already authenticated:
   - Call `join_group_by_slug()` function
   - Redirect to /manual
5. If not authenticated:
   - Show SignUpForm with group info displayed
   - On signup success: call `join_group_by_slug()` → redirect to /manual

**UI Layout:**
```
┌──────────────────────────────────────┐
│                                      │
│   Join Demo Restaurant               │
│                                      │
│   Welcome to the team! Create your   │
│   account to access the manual.      │
│                                      │
│   ┌────────────────────────────────┐ │
│   │  SignUpForm component          │ │
│   └────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘
```

### 4.5 ProtectedRoute

**Purpose:** Wrap routes that require authentication.

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];  // Optional role requirement
  fallback?: React.ReactNode;            // Loading fallback
  redirectTo?: string;                   // Custom redirect path
}
```

**Behavior:**
- If loading: show `AuthLoadingScreen`
- If not authenticated: redirect to `/sign-in`
- If user is disabled (`isActive = false`): show disabled message
- If role required and not met: show access denied or redirect
- Otherwise: render children

### 4.6 RoleGate

**Purpose:** Conditionally render content based on user role.

```typescript
interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles: UserRole | UserRole[];
  fallback?: React.ReactNode;  // What to show if not allowed
}
```

**Usage:**
```tsx
<RoleGate allowedRoles={['admin', 'manager']}>
  <AdminPanel />
</RoleGate>
```

### 4.7 Profile Page Updates

**Purpose:** Allow users to manage their preferences.

**Sections:**
1. **Profile Header** - Avatar, name, email (read-only)
2. **Language Preference** - EN/ES selection (synced to DB)
3. **Theme Preference** - Light/Dark/System
4. **Memberships** - List of groups and roles (read-only)
5. **Sign Out** - Button at bottom

---

## 5. HOOKS SPECIFICATION

### 5.1 useAuth

```typescript
// src/hooks/use-auth.ts

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 5.2 useProfile

```typescript
// src/hooks/use-profile.ts

interface UseProfileReturn {
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  updateLanguage: (language: 'en' | 'es') => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  // Uses useAuth for profile data
  // Provides mutation functions
}
```

### 5.3 usePermissions

```typescript
// src/hooks/use-permissions.ts

interface UsePermissionsReturn {
  canViewManual: boolean;
  canUseSearch: boolean;
  canUseAi: boolean;
  voiceEnabled: boolean;
  dailyAiLimit: number;
  monthlyAiLimit: number;
  highestRole: UserRole;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

export function usePermissions(): UsePermissionsReturn {
  // Aggregate permissions across all group memberships
  // Use highest privilege for each permission
}
```

---

## 6. ROUTES UPDATE

```tsx
// src/App.tsx

const routes = [
  // Public routes
  { path: '/sign-in', element: <SignIn /> },
  { path: '/join/:slug', element: <JoinGroup /> },
  
  // Protected routes (require auth)
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <Index /> },
      { path: '/manual', element: <Manual /> },
      { path: '/manual/:sectionId', element: <Manual /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/ask', element: <Ask /> },
      { path: '/profile', element: <Profile /> },
      
      // Admin routes (require admin role)
      {
        element: <ProtectedRoute requiredRole="admin" />,
        children: [
          { path: '/admin', element: <Admin /> },
          { path: '/admin/users', element: <AdminUsers /> },
        ],
      },
    ],
  },
  
  // 404
  { path: '*', element: <NotFound /> },
];
```

---

## 7. SUPABASE CONFIGURATION

### 7.1 Auth Settings (CRITICAL)

> **IMPORTANT:** Disable email confirmation for frictionless onboarding.

In Lovable Cloud dashboard or Supabase Auth settings:

```
Email confirmations: DISABLED
Enable email signup: ENABLED
```

### 7.2 Environment Variables

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 7.3 Client Configuration

The Supabase client is already configured in `src/integrations/supabase/client.ts`.

---

## 8. IMPLEMENTATION TASKS

### Phase 1: Database Setup (Day 1) ✅ COMPLETE
- [x] Enable Lovable Cloud (Supabase)
- [x] Create `profiles` table with trigger for auto-creation
- [x] Create `groups` table with `slug` and `allow_signups` columns
- [x] Create `group_memberships` table with role enum
- [x] Create `role_policies` table
- [x] Create `invites` table (for future use)
- [x] Implement RLS policies for all tables
- [x] Create `join_group_by_slug()` function
- [x] Create `get_user_permissions()` function
- [x] Seed default group and admin user for testing

### Phase 2: Auth Provider (Day 2) ✅ COMPLETE
- [x] Create TypeScript types in `src/types/auth.ts`
- [x] Create `AuthProvider` component with session management
- [x] Implement `signIn()` action (email + password)
- [x] Implement `signUp()` action (email + password + optional name)
- [x] Implement `signOut()` action
- [x] Implement `refreshProfile()` action
- [x] Create `useAuth` hook
- [x] Wrap app in `AuthProvider`

### Phase 3: Sign-In & Join Flow (Day 2-3)
- [ ] Create `SignInForm` component (email + password)
- [ ] Create `SignUpForm` component (email + password + name)
- [ ] Create `AuthLoadingScreen` component
- [ ] Create `SignIn` page (`/sign-in`)
- [ ] Create `JoinGroup` page (`/join/:slug`)
- [ ] **Disable email confirmation in Supabase Auth settings**
- [ ] Test signup + auto-join flow end-to-end

### Phase 4: Route Protection (Day 3)
- [ ] Create `ProtectedRoute` component
- [ ] Create `RoleGate` component
- [ ] Update `App.tsx` with protected routes
- [ ] Handle disabled user state
- [ ] Handle role-based access denied
- [ ] Redirect unauthenticated to /sign-in

### Phase 5: Profile & Preferences (Day 4)
- [ ] Create `useProfile` hook
- [ ] Create `ProfileHeader` component
- [ ] Create `LanguagePreference` component (sync with `use-language`)
- [ ] Create `ThemePreference` component (sync with `use-theme`)
- [ ] Create `SignOutButton` component
- [ ] Update `Profile` page with new components
- [ ] Sync language preference to database on change

### Phase 6: Polish & Testing (Day 5)
- [ ] Test all auth flows (sign-up via join link, sign-in, sign-out)
- [ ] Test role-based access (staff, manager, admin)
- [ ] Test disabled user handling
- [ ] Test session persistence across refresh
- [ ] Test language preference sync
- [ ] Verify RLS policies work correctly
- [ ] Accessibility audit (forms, focus states)
- [ ] Mobile testing for all auth screens

---

## 9. SEED DATA FOR DEVELOPMENT

```sql
-- Create default group with slug for join link
INSERT INTO public.groups (id, name, slug, description, allow_signups)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Restaurant',
  'demo-restaurant',
  'Default demo location for development',
  true
);

-- Create default role policies
INSERT INTO public.role_policies (group_id, role, daily_ai_limit, monthly_ai_limit, voice_enabled)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'staff', 20, 500, false),
  ('00000000-0000-0000-0000-000000000001', 'manager', 50, 1000, true),
  ('00000000-0000-0000-0000-000000000001', 'admin', 100, 2000, true);

-- Join link will be: /join/demo-restaurant
-- First user to sign up via this link will be staff by default
-- Manually promote to admin:
-- UPDATE public.group_memberships SET role = 'admin' WHERE user_id = 'your-user-id';
```

---

## 10. UI/UX DESIGN NOTES

### Design Per Spec

- **Sign-in page:** Calm, centered card, minimal chrome
- **Email input:** 44px height, 14px radius, clear focus state
- **Password input:** Same styling, show/hide toggle optional
- **Primary button:** Accent fill, disabled state during submit
- **Loading states:** Skeleton loaders for profile, subtle spinner for actions
- **Error states:** Inline error messages below inputs, toast for server errors
- **Success states:** Immediate redirect (no confirmation screen needed)

### Responsive Behavior

- **Mobile:** Full-screen sign-in, bottom-aligned form
- **Tablet/Desktop:** Centered card with max-width 400px

### Animations

- **Page transitions:** Fade + slide (200-260ms)
- **Button press:** scale(0.98) + opacity
- **Loading spinner:** Subtle pulse

---

## 11. SECURITY CONSIDERATIONS

### Best Practices Implemented

1. **RLS everywhere:** All tables have row-level security
2. **SECURITY DEFINER functions:** Database functions run with elevated permissions only where needed
3. **Group-based access:** Shared link only works for active groups with `allow_signups = true`
4. **Disabled users:** `isActive` flag prevents access
5. **Password requirements:** Supabase enforces minimum password strength

### Why No Email Confirmation?

For internal restaurant operations tools:
- The **shared join link is the access control** (only people with the link can join)
- Staff need **immediate access** when onboarding
- Managers control who receives the link
- Email verification can be added later if needed for password reset

### Session Management

- Sessions auto-refresh
- Session stored in localStorage (Supabase default)
- Sign-out clears session completely
- Auth state change triggers permission refresh

---

## 12. MIGRATION PATH

### From Mock Data (Step 2) to Supabase (Step 3)

1. **Profiles:** Auto-created on sign-up
2. **Language preference:** Migrate from localStorage to profile.default_language
3. **Bookmarks:** Keep in localStorage for now (migrate in Step 4)
4. **Manual content:** Remains mock data until Step 4

### Backward Compatibility

- App should work without authentication during development
- Feature flag or environment variable to enable/disable auth
- Graceful fallback if Supabase connection fails

---

## 13. SUCCESS METRICS

After Step 3 completion:

- [ ] Email + password sign-up works via shared link
- [ ] Email + password sign-in works on all devices
- [ ] Session persists across page refresh
- [ ] Protected routes redirect correctly
- [ ] Role-based UI shows/hides appropriately
- [ ] Join flow auto-assigns staff role to group
- [ ] Profile preferences sync to database
- [ ] Sign-out clears all session data
- [ ] Disabled users see appropriate message
- [ ] All RLS policies enforce correctly
- [ ] No console errors in production

---

## 14. DEPENDENCIES

### New Dependencies Required

```bash
# Supabase client (already in Lovable Cloud)
@supabase/supabase-js

# Form validation (already installed)
zod
react-hook-form
@hookform/resolvers

# No additional dependencies required
```

### Supabase Configuration

- Enable email auth provider
- **Disable email confirmation** (critical for frictionless flow)
- Set site URL for redirects
- Configure allowed redirect URLs

---

## 15. OUTCOME

After completing Step 3:

> **Users can securely sign up via shared group link (email + password, no confirmation), sign in with credentials, and access the manual based on their role—with preferences synced to the database.**

The app is now ready for:
- Step 4: Keyword Search
- Step 5: AI Assistant (with role-based limits)
- Step 6: Admin Panel (user management)
