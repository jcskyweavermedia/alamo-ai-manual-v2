/**
 * PositionGate — Conditionally renders content based on employee department/position.
 * Use for in-page checks where role-based gating (RoleGate) isn't granular enough.
 */

import { useEmployeeProfile } from '@/hooks/useEmployeeProfile';
import { useAuth } from '@/hooks/use-auth';

interface PositionGateProps {
  children: React.ReactNode;
  allowedDepartments?: string[];
  allowedPositions?: string[];
  /** When true (default), managers and admins bypass the gate */
  managerBypass?: boolean;
  fallback?: React.ReactNode;
}

export function PositionGate({
  children,
  allowedDepartments,
  allowedPositions,
  managerBypass = true,
  fallback = null,
}: PositionGateProps) {
  const { department, position, isLoading } = useEmployeeProfile();
  const { isAdmin, isManager } = useAuth();

  if (isLoading) return null;

  // Manager/admin bypass
  if (managerBypass && (isAdmin || isManager)) {
    return <>{children}</>;
  }

  // Check department match (case-insensitive)
  if (allowedDepartments && department) {
    if (allowedDepartments.some(d => d.toUpperCase() === department.toUpperCase())) {
      return <>{children}</>;
    }
  }

  // Check position match (case-insensitive)
  if (allowedPositions && position) {
    if (allowedPositions.some(p => p.toUpperCase() === position.toUpperCase())) {
      return <>{children}</>;
    }
  }

  // No department/position restrictions specified → show children (permissive default)
  if (!allowedDepartments && !allowedPositions) {
    return <>{children}</>;
  }

  // No employee record → safe fallback: show children (don't block users without employee records)
  if (!department && !position) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
