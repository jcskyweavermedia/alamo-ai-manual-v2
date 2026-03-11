/**
 * image-category-helpers.ts
 *
 * Shared helpers that derive DALL-E category keys from product draft data.
 * These keys are passed to the generate-image edge function, which maps them
 * to specific surface/backdrop/lighting prompt variants.
 */

/** Maps beer/liquor category + subcategory to a surface variant for DALL-E prompting. */
export function deriveBeerLiquorCategory(category: string, subcategory: string): string {
  const cat = (category || '').toLowerCase();
  const sub = (subcategory || '').toLowerCase();
  if (cat === 'beer') {
    if (/stout|porter/.test(sub)) return 'dark-beer';
    if (/ipa|pale ale/.test(sub)) return 'ipa-craft';
    return 'light-beer';
  }
  // Liquor
  if (/bourbon|whiskey|whisky|scotch|rye|irish/.test(sub)) return 'whiskey';
  if (/vodka|gin/.test(sub)) return 'vodka-gin';
  if (/rum/.test(sub)) return 'rum';
  if (/tequila|mezcal/.test(sub)) return 'tequila';
  return 'spirit';
}

/** Maps plate spec type + dish name to a surface category for DALL-E prompting. */
export function derivePlateCategory(plateType: string, name: string): string {
  const n = (name || '').toLowerCase();
  if (/shrimp|lobster|salmon|tuna|halibut|cod|crab|oyster|scallop|\bfish\b|seafood/.test(n)) return 'seafood';
  const pt = (plateType || '').toLowerCase();
  if (pt === 'appetizer' || pt === 'starter') return 'appetizer';
  if (pt === 'salad') return 'salad';
  if (pt === 'dessert') return 'dessert';
  return 'entree';
}

/** Maps cocktail key ingredients to a visual mood for DALL-E prompting. */
export function detectCocktailMood(keyIngredients: string): string {
  const text = (keyIngredients || '').toLowerCase();
  if (/bourbon|whiskey|whisky|rye|brandy|scotch|cognac/.test(text)) return 'amber';
  if (/rum|coconut|pineapple|mango|tropical|passion fruit/.test(text)) return 'tropical';
  if (/espresso|coffee|kahlúa|kahlua|baileys|cream liqueur|chocolate/.test(text)) return 'midnight';
  return 'bright';
}
