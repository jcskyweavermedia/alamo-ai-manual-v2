import { usePinned } from '@/hooks/use-pinned';

export function usePinnedRecipes() {
  return usePinned('recipes');
}
