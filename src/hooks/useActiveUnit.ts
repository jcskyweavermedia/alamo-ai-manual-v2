/**
 * useActiveUnit — Hook for accessing the active unit context.
 * Returns { activeGroupId, allMemberships, switchUnit, isLoading }
 */
export { useUnitContext as useActiveUnit } from '@/contexts/UnitContext';
export type { GroupMembership } from '@/contexts/UnitContext';
