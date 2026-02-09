/**
 * RoleGate
 * 
 * Conditionally renders content based on user role.
 * Use for in-page permission checks (buttons, sections, etc.)
 */

import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/types/auth';

interface RoleGateProps {
  children: React.ReactNode;
  /** Role(s) allowed to see this content */
  allowedRoles: UserRole | UserRole[];
  /** Optional fallback to show if not allowed */
  fallback?: React.ReactNode;
}

export function RoleGate({
  children,
  allowedRoles,
  fallback = null,
}: RoleGateProps) {
  const { hasAnyRole, isAuthenticated, isLoading } = useAuth();

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // Not authenticated → show fallback
  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  // Check if user has any of the allowed roles
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const hasAccess = hasAnyRole(roles);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
