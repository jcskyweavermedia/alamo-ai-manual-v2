import { useActiveUnit } from '@/hooks/useActiveUnit';

/**
 * @deprecated Use `useActiveUnit()` instead for multi-unit support.
 * This hook is a thin wrapper kept for backward compatibility.
 */
export function useGroupId(): string | null {
  const { activeGroupId } = useActiveUnit();
  return activeGroupId;
}
