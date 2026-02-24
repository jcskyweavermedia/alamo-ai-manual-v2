import { useMemo } from 'react';
import { useSupabaseRecipes } from '@/hooks/use-supabase-recipes';
import { useSupabaseDishes } from '@/hooks/use-supabase-dishes';

/**
 * Builds lookup maps between BOH plate_specs and FOH foh_plate_specs
 * using already-cached TanStack Query data (no extra network requests).
 */
export function useCrossNavLookup() {
  const { recipes } = useSupabaseRecipes();
  const { dishes } = useSupabaseDishes();

  // plate_spec.id → foh dish slug
  const bohToFoh = useMemo(() => {
    const map = new Map<string, string>();
    for (const dish of dishes) {
      if (dish.plateSpecId) {
        map.set(dish.plateSpecId, dish.slug);
      }
    }
    return map;
  }, [dishes]);

  // plate_spec.id → plate_spec slug
  const fohToBoh = useMemo(() => {
    const map = new Map<string, string>();
    for (const recipe of recipes) {
      if (recipe.type === 'plate') {
        map.set(recipe.id, recipe.slug);
      }
    }
    return map;
  }, [recipes]);

  const getFohSlug = (plateSpecId: string): string | null =>
    bohToFoh.get(plateSpecId) ?? null;

  const getBohSlug = (plateSpecId: string | null): string | null =>
    plateSpecId ? (fohToBoh.get(plateSpecId) ?? null) : null;

  return { getFohSlug, getBohSlug };
}
