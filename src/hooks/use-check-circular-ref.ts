/**
 * checkCircularRef
 *
 * Detects direct circular references between prep recipes.
 * Given a target recipe slug and the current recipe slug, queries the
 * target recipe's `ingredients` JSONB to see if any ingredient item
 * already has a `prep_recipe_ref` pointing back to the current recipe.
 *
 * This prevents A -> B -> A cycles when linking sub-recipes.
 */

import { supabase } from '@/integrations/supabase/client';
import type { RecipeIngredientGroup } from '@/types/products';

/**
 * Check whether linking to `targetSlug` from `currentSlug` would create
 * a direct circular reference (targetSlug already references currentSlug).
 *
 * @param targetSlug  - The slug of the recipe the user wants to link TO
 * @param currentSlug - The slug of the recipe being edited (the one that
 *                      would gain the `prep_recipe_ref`)
 * @returns `true` if a circular reference is detected, `false` otherwise.
 *          Also returns `false` on query errors (fail-open so linking is
 *          not blocked by transient network issues).
 */
export async function checkCircularRef(
  targetSlug: string,
  currentSlug: string,
): Promise<boolean> {
  if (!targetSlug || !currentSlug) return false;

  try {
    const { data, error } = await supabase
      .from('prep_recipes')
      .select('ingredients')
      .eq('slug', targetSlug)
      .single();

    if (error || !data) return false;

    const groups = data.ingredients as RecipeIngredientGroup[] | null;
    if (!Array.isArray(groups)) return false;

    for (const group of groups) {
      if (!Array.isArray(group.items)) continue;
      for (const item of group.items) {
        if (item.prep_recipe_ref === currentSlug) {
          return true;
        }
      }
    }

    return false;
  } catch {
    // Fail-open: if the check itself errors, do not block linking
    return false;
  }
}
