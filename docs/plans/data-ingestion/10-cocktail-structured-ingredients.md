# Cocktail Structured Ingredients Migration

## Context
Cocktail ingredients are currently stored as a plain TEXT string (`"2 oz Bourbon\n0.5 oz Syrup"`) — unstructured, unvalidated, and hard for AI to parse reliably. Prep recipes already use a JSONB grouped structure with quantities, units, allergens, and sub-recipe linking. This migration brings cocktails to the same standard, preventing data entry errors and enabling proper AI search, cross-linking to bar prep recipes (syrups, infusions), and consistent UI across the app.

## Scope
- **Cocktails only** — convert `cocktails.ingredients` from TEXT to JSONB
- **Sub-recipe linking** — `prep_recipe_ref` on each ingredient for bar preps
- **Bar preps live in `prep_recipes`** — add a `category` column (`'kitchen'` | `'bar'`) to separate kitchen vs bar prep recipes. No new table needed — bar preps (syrups, infusions, shrubs) are just prep recipes with a different audience.
- **Keep `key_ingredients` as TEXT** — it's a display-only summary string

## Design Decision: Bar Prep Recipes

Bar prep items (demerara syrup, honey-ginger syrup, infusions) go into the **existing `prep_recipes` table** with a new `category` column to distinguish them from kitchen preps. Rationale:

- Bar preps ARE prep recipes — they have ingredients, procedure, yield, shelf life
- All existing infrastructure works: search, AI enrichment, sub-recipe linking, ingestion
- A `category` filter lets bartenders see only bar preps, cooks see only kitchen preps
- Zero new tables, RLS policies, search functions, or edge function domains
- Cocktail `prep_recipe_ref` linking works identically to plate spec → prep recipe linking

## JSONB Structure (matching prep_recipes)
```json
[
  {
    "group_name": "Spirit",
    "order": 1,
    "items": [
      {
        "name": "Bourbon",
        "quantity": 2,
        "unit": "oz",
        "prep_note": null,
        "allergens": [],
        "prep_recipe_ref": null
      }
    ]
  },
  {
    "group_name": "Modifier",
    "order": 2,
    "items": [...]
  },
  {
    "group_name": "Garnish",
    "order": 3,
    "items": [...]
  }
]
```

---

## Steps

### Step 1a — Database Migration: Cocktail Ingredients
**New file**: `supabase/migrations/20260225210000_cocktail_ingredients_to_jsonb.sql`

- Add temp `ingredients_jsonb JSONB` column
- UPDATE all 5 seed cocktails with hand-crafted JSONB (split into Spirit/Modifier/Garnish groups with parsed quantities/units)
- DROP old TEXT `ingredients` column, RENAME temp → `ingredients`, SET NOT NULL
- CREATE OR REPLACE `update_cocktails_search_vector()` trigger to extract ingredient names from JSONB groups for FTS indexing
- UPDATE all cocktail rows to rebuild `search_vector`

### Step 1b — Database Migration: Prep Recipe Category
**New file**: `supabase/migrations/20260225210100_add_prep_recipe_category.sql`

- `ALTER TABLE prep_recipes ADD COLUMN category TEXT NOT NULL DEFAULT 'kitchen'`
- `CHECK (category IN ('kitchen', 'bar'))`
- UPDATE existing 4 kitchen prep recipes to `category = 'kitchen'` (already default)
- Add index: `CREATE INDEX idx_prep_recipes_category ON prep_recipes(category)`
- Update FTS trigger to include `category` in search_vector (weight C)

### Step 2 — TypeScript Types
**Edit**: `src/types/products.ts`
- `Cocktail.ingredients`: `string` → `RecipeIngredientGroup[]` (reuse existing type)
- `PrepRecipe`: add `category: 'kitchen' | 'bar'`

**Edit**: `src/types/ingestion.ts`
- `CocktailDraft.ingredients`: `string` → `RecipeIngredientGroup[]`
- `createEmptyCocktailDraft()`: `ingredients: ''` → `ingredients: []`
- `PrepRecipeDraft`: add `category: 'kitchen' | 'bar'` with default `'kitchen'`

### Step 3 — Data Hook
**Edit**: `src/hooks/use-supabase-cocktails.ts`
- Cast `row.ingredients` from JSONB to `RecipeIngredientGroup[]`

**Edit**: `src/hooks/use-supabase-recipes.ts`
- Add `category` to SELECT and type mapping
- Expose optional `category` filter parameter (for future bar-only views)

### Step 4 — Cocktail Card View (display)
**Edit**: `src/components/cocktails/CocktailCardView.tsx`
- Remove `parseIngredientLines` import
- Replace `<ul>` of text lines with `IngredientsColumn` component (reused from recipes)
- Add `onTapPrepRecipe` prop for sub-recipe cross-navigation

**Reuse** (no changes needed):
- `src/components/recipes/IngredientsColumn.tsx` — grouped ingredient display
- `src/components/recipes/LinkedItemRow.tsx` — single row with qty/unit/name/allergens/link

### Step 5 — Cocktails Page (cross-nav)
**Edit**: `src/pages/Cocktails.tsx`
- Add `handleTapPrepRecipe` callback → `navigate('/recipes?slug=...')`
- Pass to `CocktailCardView`

### Step 6 — Ingest Draft Context (reducer)
**Edit**: `src/contexts/IngestDraftContext.tsx`
- Change `SET_COCKTAIL_INGREDIENTS` payload: `string` → `RecipeIngredientGroup[]`
- Generalize ingredient group actions (`ADD_INGREDIENT_GROUP`, `REMOVE_INGREDIENT_GROUP`, `RENAME_INGREDIENT_GROUP`, `MOVE_GROUP_UP/DOWN`, `ADD_INGREDIENT`, `UPDATE_INGREDIENT`, `REMOVE_INGREDIENT`, `MOVE_INGREDIENT_UP/DOWN`) to work for BOTH `PrepRecipeDraft` and `CocktailDraft` — add a helper that checks draft type and calls the right updater
- Add `SET_PREP_CATEGORY` action for kitchen/bar toggle

### Step 7 — Cocktail Editor (ingestion)
**Edit**: `src/components/ingest/editor/CocktailEditor.tsx`
- Replace `<Textarea>` for ingredients with `IngredientsEditor` component (reused from prep recipe editor)
- Wire ingredient group dispatch actions

**Edit**: `src/components/ingest/editor/PrepRecipeEditor.tsx`
- Add category toggle (Kitchen / Bar) in the metadata section

**Reuse** (no changes needed):
- `src/components/ingest/editor/IngredientsEditor.tsx`
- `src/components/ingest/editor/IngredientGroupCard.tsx`
- `src/components/ingest/editor/IngredientItemRow.tsx`
- `src/components/ingest/editor/SubRecipeLinker.tsx`

### Step 8 — Cocktail Ingest Preview
**Edit**: `src/components/ingest/CocktailIngestPreview.tsx`
- Remove `parseIngredientLines` import
- Replace text list with `IngredientsColumn` (same as card view)

### Step 9 — Edge Functions
**Edit**: `supabase/functions/ask-product/index.ts`
- Update cocktail context serialization: flatten JSONB groups → ingredient text (same pattern as recipes case)
- Enable sub-recipe enrichment for cocktails domain (add `|| domain === "cocktails"` to the two enrichment gates)

**Edit**: `supabase/functions/embed-products/index.ts`
- Update `buildCocktailText()`: extract names from JSONB groups instead of passing raw TEXT

**Edit**: `supabase/functions/ingest/index.ts`
- Update `COCKTAIL_DRAFT_SCHEMA`: `ingredients` from `{type: "string"}` to nested array-of-groups schema
- Add `category` field to `PREP_RECIPE_DRAFT_SCHEMA`

**Edit**: `supabase/functions/ingest-file/index.ts` — same schema changes

**Edit**: `supabase/functions/ingest-vision/index.ts` — same schema changes

### Step 10 — Publish Validation
**Edit**: `src/pages/IngestPage.tsx`
- Add `validateSubRecipeRefs()` call before cocktail publish (reuse from `src/utils/validate-sub-recipe-refs.ts`)
- Include `category` in prep recipe publish payload

### Step 11 — Cleanup
**Delete**: `src/lib/parse-ingredient-lines.ts` (no longer used after steps 4 and 8)

### Step 12 — Deploy & Verify
- `npx supabase db push` (migrations)
- `npx supabase functions deploy ask-product embed-products ingest ingest-file ingest-vision`
- Regenerate cocktail embeddings
- Verify: build, FTS search, card view, ingest editor, AI Q&A

---

## Files Changed (18 total)

| # | File | Action |
|---|------|--------|
| 1 | `supabase/migrations/20260225210000_cocktail_ingredients_to_jsonb.sql` | NEW |
| 2 | `supabase/migrations/20260225210100_add_prep_recipe_category.sql` | NEW |
| 3 | `src/types/products.ts` | EDIT (Cocktail.ingredients + PrepRecipe.category) |
| 4 | `src/types/ingestion.ts` | EDIT (CocktailDraft + PrepRecipeDraft) |
| 5 | `src/hooks/use-supabase-cocktails.ts` | EDIT (JSONB cast) |
| 6 | `src/hooks/use-supabase-recipes.ts` | EDIT (add category to select/mapping) |
| 7 | `src/components/cocktails/CocktailCardView.tsx` | EDIT (replace ingredient section) |
| 8 | `src/pages/Cocktails.tsx` | EDIT (add cross-nav callback) |
| 9 | `src/contexts/IngestDraftContext.tsx` | EDIT (generalize ingredient actions + category) |
| 10 | `src/components/ingest/editor/CocktailEditor.tsx` | EDIT (replace textarea with IngredientsEditor) |
| 11 | `src/components/ingest/editor/PrepRecipeEditor.tsx` | EDIT (add category toggle) |
| 12 | `src/components/ingest/CocktailIngestPreview.tsx` | EDIT (structured display) |
| 13 | `supabase/functions/ask-product/index.ts` | EDIT (serialization + enrichment) |
| 14 | `supabase/functions/embed-products/index.ts` | EDIT (buildCocktailText) |
| 15 | `supabase/functions/ingest/index.ts` | EDIT (COCKTAIL_DRAFT_SCHEMA + category) |
| 16 | `supabase/functions/ingest-file/index.ts` | EDIT (schema) |
| 17 | `supabase/functions/ingest-vision/index.ts` | EDIT (schema) |
| 18 | `src/pages/IngestPage.tsx` | EDIT (publish validation + category) |
| 19 | `src/lib/parse-ingredient-lines.ts` | DELETE |

## Reused Components (no changes)
- `IngredientsColumn`, `LinkedItemRow`, `AllergenBadge` (display)
- `IngredientsEditor`, `IngredientGroupCard`, `IngredientItemRow`, `SubRecipeLinker` (editor)
- `validateSubRecipeRefs` (publish validation)
- `RecipeIngredientGroup`, `RecipeIngredient` types

## Verification
1. `npx vite build` — zero TS errors
2. Open cocktail card → ingredients show grouped with qty/unit
3. Open ingest editor for cocktail → structured ingredient groups with add/remove/reorder
4. Open ingest editor for prep recipe → category toggle (Kitchen / Bar)
5. AI ask-product on cocktail → ingredients context includes structured data + sub-recipe enrichment
6. FTS search "bourbon" → Old Fashioned, Smoked Old Fashioned found
7. Sub-recipe ref → tap linked ingredient navigates to prep recipe
8. Bar prep recipe (e.g., demerara syrup) → shows in prep recipes with `category: 'bar'`
