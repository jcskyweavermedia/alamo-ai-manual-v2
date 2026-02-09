/**
 * ProtectedRoute
 * 
 * Wraps routes that require authentication.
 * Handles loading states, redirects, and role-based access.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/types/auth';
import { AuthLoadingScreen } from './AuthLoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Optional role(s) required to access this route */
  requiredRole?: UserRole | UserRole[];
  /** Custom loading fallback */
  fallback?: React.ReactNode;
  /** Custom redirect path (default: /sign-in) */
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallback,
  redirectTo = '/sign-in',
}: ProtectedRouteProps) {
  const location = useLocation();
  const { isLoading, isAuthenticated, permissions, hasRole, hasAnyRole } = useAuth();

  // Show loading state
  if (isLoading) {
    return fallback ?? <AuthLoadingScreen message="Checking access..." />;
  }

  // Not authenticated → redirect to sign-in
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check if user is active
  if (permissions && !permissions.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-md">
        <div className="text-center space-y-sm max-w-md">
          <h1 className="text-section font-semibold text-foreground">Account Disabled</h1>
          <p className="text-body text-muted-foreground">
            Your account has been disabled. Please contact your manager for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Check role requirements
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const hasRequiredRole = hasAnyRole(roles);

    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-md">
          <div className="text-center space-y-sm max-w-md">
            <h1 className="text-section font-semibold text-foreground">Access Denied</h1>
            <p className="text-body text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  // All checks passed → render children
  return <>{children}</>;
}
