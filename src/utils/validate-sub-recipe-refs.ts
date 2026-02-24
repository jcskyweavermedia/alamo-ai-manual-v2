/**
 * validate-sub-recipe-refs.ts
 *
 * Publish-time validation for sub-recipe references.
 * Ensures every `prep_recipe_ref` slug inside a recipe's ingredients JSONB
 * points to an existing, published prep recipe before the recipe is saved.
 *
 * Usage:
 *   const result = await validateSubRecipeRefs(draft.ingredients);
 *   if (!result.valid) {
 *     // block publish, show result.danglingRefs to the user
 *   }
 */

import { supabase } from '@/integrations/supabase/client';
import type { RecipeIngredientGroup } from '@/types/products';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export interface SubRecipeValidationResult {
  /** True when every referenced slug resolves to a published prep recipe */
  valid: boolean;
  /** Slugs that do NOT exist as published prep recipes */
  danglingRefs: string[];
}

/**
 * Extract all unique `prep_recipe_ref` slugs from ingredient groups and verify
 * each one exists in `prep_recipes` with `status = 'published'`.
 *
 * @param ingredients - The recipe's ingredient groups (JSONB structure)
 * @param excludeSlug - Optional slug to exclude from validation (the recipe
 *   being published itself, to avoid a false positive when a recipe references
 *   itself -- though that would be a circular ref, not a dangling one).
 * @returns A promise resolving to the validation result.
 */
export async function validateSubRecipeRefs(
  ingredients: RecipeIngredientGroup[],
  excludeSlug?: string,
): Promise<SubRecipeValidationResult> {
  // 1. Collect every unique prep_recipe_ref slug
  const refSlugs = extractSubRecipeRefSlugs(ingredients);

  // Remove the recipe's own slug if provided (self-ref is a separate concern)
  if (excludeSlug) {
    refSlugs.delete(excludeSlug);
  }

  // Nothing to validate -- trivially valid
  if (refSlugs.size === 0) {
    return { valid: true, danglingRefs: [] };
  }

  // 2. Query DB for which of those slugs are published
  const slugArray = Array.from(refSlugs);

  const { data, error } = await supabase
    .from('prep_recipes')
    .select('slug')
    .in('slug', slugArray)
    .eq('status', 'published');

  if (error) {
    // If the query itself fails, we cannot guarantee validity.
    // Treat it as a hard failure so the user doesn't silently publish bad data.
    console.error('validateSubRecipeRefs: query failed', error.message);
    return {
      valid: false,
      danglingRefs: slugArray, // assume all are dangling to be safe
    };
  }

  // 3. Diff: which requested slugs came back from the DB?
  const foundSlugs = new Set((data ?? []).map((row) => row.slug));
  const danglingRefs = slugArray.filter((s) => !foundSlugs.has(s));

  return {
    valid: danglingRefs.length === 0,
    danglingRefs,
  };
}

// -----------------------------------------------------------------------------
// Helpers (exported for unit testing)
// -----------------------------------------------------------------------------

/**
 * Walk all ingredient groups/items and collect unique `prep_recipe_ref` values.
 * Skips empty strings and undefined values.
 */
export function extractSubRecipeRefSlugs(
  ingredients: RecipeIngredientGroup[],
): Set<string> {
  const slugs = new Set<string>();

  for (const group of ingredients) {
    for (const item of group.items) {
      const ref = item.prep_recipe_ref;
      if (ref && ref.trim().length > 0) {
        slugs.add(ref.trim());
      }
    }
  }

  return slugs;
}
