/**
 * Authentication Types
 * 
 * TypeScript interfaces for auth, profiles, roles, and permissions.
 */

// =============================================================================
// USER ROLES
// =============================================================================

export type UserRole = 'staff' | 'manager' | 'admin';

// =============================================================================
// PROFILE
// =============================================================================

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  defaultLanguage: 'en' | 'es';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// GROUP & MEMBERSHIP
// =============================================================================

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RolePolicy {
  dailyAiLimit: number;
  monthlyAiLimit: number;
  voiceEnabled: boolean;
  canViewManual: boolean;
  canUseSearch: boolean;
  canUseAi: boolean;
}

export interface GroupMembership {
  groupId: string;
  groupName: string;
  groupSlug: string;
  role: UserRole;
  policy: RolePolicy | null;
}

// =============================================================================
// USER PERMISSIONS (from get_user_permissions function)
// =============================================================================

export interface UserPermissions {
  userId: string;
  email: string;
  fullName: string | null;
  defaultLanguage: 'en' | 'es';
  isActive: boolean;
  memberships: GroupMembership[];
}

// Raw response from database (snake_case)
export interface UserPermissionsRaw {
  user_id: string;
  email: string;
  full_name: string | null;
  default_language: 'en' | 'es';
  is_active: boolean;
  memberships: {
    group_id: string;
    group_name: string;
    group_slug: string;
    role: UserRole;
    policy: {
      daily_ai_limit: number;
      monthly_ai_limit: number;
      voice_enabled: boolean;
      can_view_manual: boolean;
      can_use_search: boolean;
      can_use_ai: boolean;
    } | null;
  }[];
}

// =============================================================================
// INVITE
// =============================================================================

export interface Invite {
  id: string;
  token: string;
  email: string | null;
  groupId: string;
  role: UserRole;
  invitedBy: string | null;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  createdAt: string;
  // Joined data
  groupName?: string;
  groupSlug?: string;
}

// Raw response from database (snake_case)
export interface InviteRaw {
  id: string;
  token: string;
  email: string | null;
  group_id: string;
  role: UserRole;
  invited_by: string | null;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
  groups?: {
    name: string;
    slug: string;
  };
}

// =============================================================================
// AUTH CONTEXT
// =============================================================================

export interface AuthContextValue {
  // Session state
  session: import('@supabase/supabase-js').Session | null;
  user: import('@supabase/supabase-js').User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Profile & permissions
  profile: Profile | null;
  permissions: UserPermissions | null;
  
  // Actions
  signInWithMagicLink: (email: string) => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  
  // Role checks (checks highest role across all memberships)
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  highestRole: UserRole | null;
}

// =============================================================================
// ACCEPT INVITE RESPONSE
// =============================================================================

export interface AcceptInviteResult {
  success: boolean;
  error?: string;
  group_id?: string;
  role?: UserRole;
}

// =============================================================================
// TRANSFORM HELPERS
// =============================================================================

/**
 * Transform raw permissions from database to camelCase
 */
export function transformPermissions(raw: UserPermissionsRaw): UserPermissions {
  return {
    userId: raw.user_id,
    email: raw.email,
    fullName: raw.full_name,
    defaultLanguage: raw.default_language,
    isActive: raw.is_active,
    memberships: raw.memberships.map((m) => ({
      groupId: m.group_id,
      groupName: m.group_name,
      groupSlug: m.group_slug,
      role: m.role,
      policy: m.policy
        ? {
            dailyAiLimit: m.policy.daily_ai_limit,
            monthlyAiLimit: m.policy.monthly_ai_limit,
            voiceEnabled: m.policy.voice_enabled,
            canViewManual: m.policy.can_view_manual,
            canUseSearch: m.policy.can_use_search,
            canUseAi: m.policy.can_use_ai,
          }
        : null,
    })),
  };
}

/**
 * Transform raw invite from database to camelCase
 */
export function transformInvite(raw: InviteRaw): Invite {
  return {
    id: raw.id,
    token: raw.token,
    email: raw.email,
    groupId: raw.group_id,
    role: raw.role,
    invitedBy: raw.invited_by,
    expiresAt: raw.expires_at,
    usedAt: raw.used_at,
    usedBy: raw.used_by,
    createdAt: raw.created_at,
    groupName: raw.groups?.name,
    groupSlug: raw.groups?.slug,
  };
}

// =============================================================================
// ROLE HIERARCHY
// =============================================================================

const ROLE_HIERARCHY: Record<UserRole, number> = {
  staff: 1,
  manager: 2,
  admin: 3,
};

/**
 * Get the highest role from a list of memberships
 */
export function getHighestRole(memberships: GroupMembership[]): UserRole | null {
  if (memberships.length === 0) return null;
  
  return memberships.reduce((highest, membership) => {
    if (!highest) return membership.role;
    return ROLE_HIERARCHY[membership.role] > ROLE_HIERARCHY[highest]
      ? membership.role
      : highest;
  }, null as UserRole | null);
}

/**
 * Check if user has at least the specified role
 */
export function hasMinimumRole(
  memberships: GroupMembership[],
  requiredRole: UserRole
): boolean {
  const highest = getHighestRole(memberships);
  if (!highest) return false;
  return ROLE_HIERARCHY[highest] >= ROLE_HIERARCHY[requiredRole];
}
