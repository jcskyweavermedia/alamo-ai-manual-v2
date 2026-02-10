# Phase 6 — Wire Viewers to Database

> Replace mock data with Supabase queries. All 5 product viewers fetch from the database. ~2-3 sessions.

## Context

Phases 1-5 built the complete backend: 6 product tables (44 rows), 5 hybrid search functions, 44 vector embeddings, and the `/ask-product` edge function. The frontend still renders mock data from `src/data/mock-*.ts` files.

This phase replaces mock data with live Supabase queries while preserving the existing UI/UX. The two-layer hook architecture stays: **data hooks** (new) fetch from DB, **viewer hooks** (existing) manage UI state.

---

## Prerequisites

- [x] 6 product tables created and seeded (44 rows total)
- [x] RLS policies: authenticated can read, admin can write
- [x] All 44 rows have vector embeddings
- [x] `/ask-product` edge function deployed and tested
- [x] Supabase client configured in `src/integrations/supabase/client.ts`

---

## Architecture: Two-Layer Hook Pattern

```
┌─────────────────────────────────────────────────┐
│  Component Layer (CardView, Grid, List)          │
│  Uses: viewer hook values (filteredItems, etc.)  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  Viewer Hooks (useDishViewer, useWineViewer...)  │
│  Manages: selection, filtering, search, nav      │
│  Data source: ← swapped from mock to data hook  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  Data Hooks (useSupabaseDishes, etc.)  [NEW]     │
│  Fetches: supabase.from(table).select(...)       │
│  Maps: snake_case → camelCase                    │
│  Caches: React Query (staleTime 5min)            │
└─────────────────────────────────────────────────┘
```

**Why two layers?**
- Data hooks are reusable (multiple components can share the same cached query)
- Viewer hooks are page-specific (each viewer page has its own selection/filter state)
- Separating concerns makes testing and debugging easier

---

## Step 1 — Regenerate Supabase TypeScript Types

The auto-generated `types.ts` currently lacks the 6 product tables added in Phase 2.

### Command

```bash
npx supabase gen types typescript --project-id nxeorbwqsovybfttemrw > src/integrations/supabase/types.ts
```

### Expected Result

The `Database['public']['Tables']` type will now include:
- `foh_plate_specs` (Row, Insert, Update)
- `wines` (Row, Insert, Update)
- `cocktails` (Row, Insert, Update)
- `prep_recipes` (Row, Insert, Update)
- `plate_specs` (Row, Insert, Update)
- `beer_liquor_list` (Row, Insert, Update)

### Verification

```bash
npx tsc --noEmit
```

Should compile with zero errors (or only pre-existing ones unrelated to product tables).

---

## Step 2 — Define Frontend TypeScript Types

Create a new file `src/types/products.ts` with camelCase interfaces that match the DB schema. These replace the mock interfaces.

### File: `src/types/products.ts`

```typescript
// =============================================================================
// DISHES (foh_plate_specs)
// =============================================================================

export type DishCategory = 'appetizer' | 'entree' | 'side' | 'dessert';
export type AllergenType = 'dairy' | 'gluten' | 'eggs' | 'shellfish' | 'fish' | 'tree-nuts' | 'soy' | 'peanuts';

export interface Dish {
  id: string;
  slug: string;
  menuName: string;             // DB: menu_name (was mock: name)
  plateType: DishCategory;      // DB: plate_type (was mock: category)
  shortDescription: string;
  detailedDescription: string;
  ingredients: string[];         // DB: text[] (full ingredient list)
  keyIngredients: string[];      // DB: text[]
  flavorProfile: string[];       // DB: text[]
  allergens: AllergenType[];     // DB: text[]
  allergyNotes: string;          // DB: allergy_notes
  upsellNotes: string;           // DB: upsell_notes
  notes: string;
  image: string | null;
  isTopSeller: boolean;          // DB: is_top_seller (was mock: topSeller)
  plateSpecId: string | null;    // DB: plate_spec_id (links to plate_specs)
}

// =============================================================================
// WINES
// =============================================================================

export type WineStyle = 'red' | 'white' | 'rosé' | 'sparkling';
export type WineBody = 'light' | 'medium' | 'full';

export interface Wine {
  id: string;
  slug: string;
  name: string;
  producer: string;
  region: string;
  country: string;
  vintage: string | null;
  varietal: string;              // DB: varietal (was mock: grape)
  blend: boolean;                // DB: blend (was mock: isBlend)
  style: WineStyle;
  body: WineBody;
  tastingNotes: string;          // DB: tasting_notes
  producerNotes: string;         // DB: producer_notes (was mock: producerStory)
  notes: string;
  image: string | null;
  isTopSeller: boolean;          // DB: is_top_seller (was mock: topSeller)
}

// =============================================================================
// COCKTAILS
// =============================================================================

export type CocktailStyle = 'classic' | 'modern' | 'tiki' | 'refresher';

export interface CocktailProcedureStep {
  step: number;
  instruction: string;
}

export interface Cocktail {
  id: string;
  slug: string;
  name: string;
  style: CocktailStyle;
  glass: string;
  ingredients: string;           // DB: text (plain string, not array)
  keyIngredients: string;        // DB: text (plain string)
  procedure: CocktailProcedureStep[];  // DB: jsonb [{step, instruction}]
  tastingNotes: string;          // DB: tasting_notes
  description: string;
  notes: string;
  image: string | null;
  isTopSeller: boolean;          // DB: is_top_seller (was mock: topSeller)
}

// =============================================================================
// RECIPES (prep_recipes + plate_specs — unified)
// =============================================================================

// --- Shared sub-types ---

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
  prep_note?: string;
  allergens?: string[];
  prep_recipe_ref?: string;     // Cross-link to prep recipe slug
}

export interface RecipeIngredientGroup {
  group_name: string;
  order: number;
  items: RecipeIngredient[];
}

export interface RecipeProcedureStep {
  step_number: number;
  instruction: string;
  critical?: boolean;
}

export interface RecipeProcedureGroup {
  group_name: string;
  order: number;
  steps: RecipeProcedureStep[];
}

export interface RecipeImage {
  url: string;
  alt?: string;
  caption?: string;
}

// --- Prep Recipe ---

export interface PrepRecipe {
  id: string;
  slug: string;
  type: 'prep';                  // Discriminator
  name: string;
  prepType: string;              // DB: prep_type (was mock: category)
  tags: string[];
  yieldQty: number;              // DB: yield_qty NUMERIC (was mock: yield string)
  yieldUnit: string;             // DB: yield_unit
  shelfLifeValue: number;        // DB: shelf_life_value INT (was mock: shelfLife string)
  shelfLifeUnit: string;         // DB: shelf_life_unit
  ingredients: RecipeIngredientGroup[];  // DB: jsonb
  procedure: RecipeProcedureGroup[];     // DB: jsonb
  batchScaling: Record<string, unknown>; // DB: jsonb
  trainingNotes: Record<string, unknown>; // DB: jsonb
  images: RecipeImage[];         // DB: jsonb[]
}

// --- Plate Spec ---

export interface PlateComponent {
  type: string;
  name: string;
  quantity: string;
  unit: string;
  prep_recipe_ref?: string;
  allergens?: string[];
}

export interface PlateComponentGroup {
  group_name: string;
  order: number;
  items: PlateComponent[];
}

export interface PlateSpec {
  id: string;
  slug: string;
  type: 'plate';                 // Discriminator
  name: string;
  plateType: string;             // DB: plate_type (was mock: category)
  menuCategory: string;          // DB: menu_category
  tags: string[];
  allergens: string[];           // DB: text[]
  components: PlateComponentGroup[];     // DB: jsonb
  assemblyProcedure: RecipeProcedureGroup[];  // DB: assembly_procedure jsonb
  notes: string;
  images: RecipeImage[];         // DB: jsonb[]
}

export type Recipe = PrepRecipe | PlateSpec;

// =============================================================================
// BEER & LIQUOR
// =============================================================================

export type BeerLiquorCategory = 'Beer' | 'Liquor';

export interface BeerLiquorItem {
  id: string;
  slug: string;
  name: string;
  category: BeerLiquorCategory;
  subcategory: string;
  producer: string;
  country: string;
  description: string;
  style: string;
  notes: string;
}
```

### Key Renames (Mock → DB → Frontend)

| Domain | Mock Field | DB Column | Frontend Field |
|--------|-----------|-----------|----------------|
| Dishes | `name` | `menu_name` | `menuName` |
| Dishes | `category` | `plate_type` | `plateType` |
| Dishes | `topSeller` | `is_top_seller` | `isTopSeller` |
| Wines | `grape` | `varietal` | `varietal` |
| Wines | `isBlend` | `blend` | `blend` |
| Wines | `producerStory` | `producer_notes` | `producerNotes` |
| Wines | `topSeller` | `is_top_seller` | `isTopSeller` |
| Cocktails | `topSeller` | `is_top_seller` | `isTopSeller` |
| Recipes | `category` | `prep_type`/`plate_type` | `prepType`/`plateType` |
| Recipes | `yield` (string) | `yield_qty` + `yield_unit` | `yieldQty` + `yieldUnit` |
| Recipes | `shelfLife` (string) | `shelf_life_value` + `shelf_life_unit` | `shelfLifeValue` + `shelfLifeUnit` |
| Recipes | `ingredientGroups` | `ingredients` (jsonb) | `ingredients` |
| Recipes | `procedureGroups` | `procedure` (jsonb) | `procedure` |
| Recipes | `componentGroups` | `components` (jsonb) | `components` |
| Recipes | `assemblyGroups` | `assembly_procedure` (jsonb) | `assemblyProcedure` |

### Fields Removed (Mock-Only)

| Domain | Removed Field | Reason |
|--------|---------------|--------|
| All | `aiResponses` | Replaced by live `/ask-product` calls (Phase 7) |

---

## Step 3 — Create Data-Fetching Hooks

Five new hooks, one per domain. Each follows the pattern from `use-manual-sections.ts`:
- Uses `@tanstack/react-query` (`useQuery`)
- Fetches via `supabase.from(table).select(...)`
- Maps `snake_case` DB columns → `camelCase` frontend types
- Filters by `status = 'published'`
- Returns `{ data, isLoading, error }`

### File: `src/hooks/use-supabase-dishes.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Dish } from '@/types/products';

export function useSupabaseDishes() {
  const { data: dishes = [], isLoading, error } = useQuery({
    queryKey: ['dishes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('foh_plate_specs')
        .select('id, slug, menu_name, plate_type, short_description, detailed_description, ingredients, key_ingredients, flavor_profile, allergens, allergy_notes, upsell_notes, notes, image, is_top_seller, plate_spec_id')
        .eq('status', 'published')
        .order('menu_name');
      if (error) throw error;
      return (data || []).map((row): Dish => ({
        id: row.id,
        slug: row.slug,
        menuName: row.menu_name,
        plateType: row.plate_type as Dish['plateType'],
        shortDescription: row.short_description,
        detailedDescription: row.detailed_description,
        ingredients: row.ingredients ?? [],
        keyIngredients: row.key_ingredients ?? [],
        flavorProfile: row.flavor_profile ?? [],
        allergens: row.allergens as Dish['allergens'] ?? [],
        allergyNotes: row.allergy_notes ?? '',
        upsellNotes: row.upsell_notes ?? '',
        notes: row.notes ?? '',
        image: row.image,
        isTopSeller: row.is_top_seller,
        plateSpecId: row.plate_spec_id,
      }));
    },
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime: 10 * 60 * 1000,     // 10 minutes
    retry: 2,
  });

  return { dishes, isLoading, error };
}
```

### File: `src/hooks/use-supabase-wines.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Wine } from '@/types/products';

export function useSupabaseWines() {
  const { data: wines = [], isLoading, error } = useQuery({
    queryKey: ['wines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wines')
        .select('id, slug, name, producer, region, country, vintage, varietal, blend, style, body, tasting_notes, producer_notes, notes, image, is_top_seller')
        .eq('status', 'published')
        .order('name');
      if (error) throw error;
      return (data || []).map((row): Wine => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        producer: row.producer,
        region: row.region,
        country: row.country,
        vintage: row.vintage,
        varietal: row.varietal,
        blend: row.blend,
        style: row.style as Wine['style'],
        body: row.body as Wine['body'],
        tastingNotes: row.tasting_notes,
        producerNotes: row.producer_notes ?? '',
        notes: row.notes ?? '',
        image: row.image,
        isTopSeller: row.is_top_seller,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { wines, isLoading, error };
}
```

### File: `src/hooks/use-supabase-cocktails.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Cocktail } from '@/types/products';

export function useSupabaseCocktails() {
  const { data: cocktails = [], isLoading, error } = useQuery({
    queryKey: ['cocktails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cocktails')
        .select('id, slug, name, style, glass, ingredients, key_ingredients, procedure, tasting_notes, description, notes, image, is_top_seller')
        .eq('status', 'published')
        .order('name');
      if (error) throw error;
      return (data || []).map((row): Cocktail => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        style: row.style as Cocktail['style'],
        glass: row.glass,
        ingredients: row.ingredients,
        keyIngredients: row.key_ingredients,
        procedure: (row.procedure as any[]) ?? [],
        tastingNotes: row.tasting_notes,
        description: row.description,
        notes: row.notes ?? '',
        image: row.image,
        isTopSeller: row.is_top_seller,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { cocktails, isLoading, error };
}
```

### File: `src/hooks/use-supabase-recipes.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PrepRecipe, PlateSpec, Recipe } from '@/types/products';

export function useSupabaseRecipes() {
  const { data: recipes = [], isLoading, error } = useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      // Fetch both tables in parallel
      const [prepResult, plateResult] = await Promise.all([
        supabase
          .from('prep_recipes')
          .select('id, slug, name, prep_type, tags, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, ingredients, procedure, batch_scaling, training_notes, images')
          .eq('status', 'published')
          .order('name'),
        supabase
          .from('plate_specs')
          .select('id, slug, name, plate_type, menu_category, tags, allergens, components, assembly_procedure, notes, images')
          .eq('status', 'published')
          .order('name'),
      ]);

      if (prepResult.error) throw prepResult.error;
      if (plateResult.error) throw plateResult.error;

      const prepRecipes: PrepRecipe[] = (prepResult.data || []).map((row) => ({
        id: row.id,
        slug: row.slug,
        type: 'prep' as const,
        name: row.name,
        prepType: row.prep_type,
        tags: row.tags ?? [],
        yieldQty: Number(row.yield_qty),
        yieldUnit: row.yield_unit,
        shelfLifeValue: row.shelf_life_value,
        shelfLifeUnit: row.shelf_life_unit,
        ingredients: (row.ingredients as any[]) ?? [],
        procedure: (row.procedure as any[]) ?? [],
        batchScaling: (row.batch_scaling as Record<string, unknown>) ?? {},
        trainingNotes: (row.training_notes as Record<string, unknown>) ?? {},
        images: (row.images as any[]) ?? [],
      }));

      const plateSpecs: PlateSpec[] = (plateResult.data || []).map((row) => ({
        id: row.id,
        slug: row.slug,
        type: 'plate' as const,
        name: row.name,
        plateType: row.plate_type,
        menuCategory: row.menu_category,
        tags: row.tags ?? [],
        allergens: row.allergens ?? [],
        components: (row.components as any[]) ?? [],
        assemblyProcedure: (row.assembly_procedure as any[]) ?? [],
        notes: row.notes ?? '',
        images: (row.images as any[]) ?? [],
      }));

      return [...prepRecipes, ...plateSpecs] as Recipe[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { recipes, isLoading, error };
}
```

### File: `src/hooks/use-supabase-beer-liquor.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BeerLiquorItem } from '@/types/products';

export function useSupabaseBeerLiquor() {
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['beer-liquor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beer_liquor_list')
        .select('id, slug, name, category, subcategory, producer, country, description, style, notes')
        .eq('status', 'published')
        .order('category')
        .order('subcategory')
        .order('name');
      if (error) throw error;
      return (data || []).map((row): BeerLiquorItem => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category as BeerLiquorItem['category'],
        subcategory: row.subcategory,
        producer: row.producer,
        country: row.country,
        description: row.description,
        style: row.style,
        notes: row.notes ?? '',
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { items, isLoading, error };
}
```

---

## Step 4 — Rewire Viewer Hooks

Each existing viewer hook currently imports from `src/data/mock-*.ts`. The change is minimal: swap the data source from the mock array to the data hook, and update field references for renamed fields.

### Pattern (applied to each viewer hook)

**Before:**
```typescript
import { ALL_DISHES, getDishBySlug, type Dish } from '@/data/mock-dishes';

export function useDishViewer() {
  const filteredDishes = useMemo(() => {
    let dishes = ALL_DISHES;
    // ... filter logic using dish.name, dish.category, etc.
  }, [filterMode, searchQuery]);
  // ...
}
```

**After:**
```typescript
import { useSupabaseDishes } from '@/hooks/use-supabase-dishes';
import type { Dish } from '@/types/products';

export function useDishViewer() {
  const { dishes: allDishes, isLoading, error } = useSupabaseDishes();

  const filteredDishes = useMemo(() => {
    let dishes = allDishes;
    // ... filter logic using dish.menuName, dish.plateType, etc.
  }, [allDishes, filterMode, searchQuery]);

  // Add allDishes to dependency arrays where ALL_DISHES was used
  // Return isLoading and error alongside existing return values
  return { ...existingReturn, isLoading, error };
}
```

### Per-Hook Changes

| Hook File | Import Change | Data Source | Field Renames in Filter/Search |
|-----------|---------------|-------------|-------------------------------|
| `use-dish-viewer.ts` | `mock-dishes` → `use-supabase-dishes` | `ALL_DISHES` → `allDishes` from hook | `name` → `menuName`, `category` → `plateType`, `topSeller` → `isTopSeller` |
| `use-wine-viewer.ts` | `mock-wines` → `use-supabase-wines` | `ALL_WINES` → `allWines` from hook | `grape` → `varietal`, `isBlend` → `blend`, `producerStory` → `producerNotes`, `topSeller` → `isTopSeller` |
| `use-cocktail-viewer.ts` | `mock-cocktails` → `use-supabase-cocktails` | `ALL_COCKTAILS` → `allCocktails` from hook | `topSeller` → `isTopSeller` |
| `use-recipe-viewer.ts` | `mock-recipes` → `use-supabase-recipes` | `ALL_RECIPES` → `allRecipes` from hook | `category` → `prepType`/`plateType` |
| `use-beer-liquor-viewer.ts` | `mock-beer-liquor` → `use-supabase-beer-liquor` | `ALL_BEER_LIQUOR` → `allItems` from hook | (no renames — B&L fields match) |

### Helper Functions

Each viewer hook currently has helpers like `getDishBySlug()` imported from mock data. These become local `useCallback` functions:

```typescript
const getDishBySlug = useCallback(
  (slug: string | null) => allDishes.find(d => d.slug === slug),
  [allDishes]
);
```

---

## Step 5 — Update Component Renderers

Components that render product data need field name updates. The structure stays the same; only property accesses change.

### 5a. Dishes — `DishCardView.tsx`

| Current | New | Notes |
|---------|-----|-------|
| `dish.name` | `dish.menuName` | Card header, AI sheet title |
| `dish.category` | `dish.plateType` | Category badge |
| `dish.topSeller` | `dish.isTopSeller` | Top seller badge |
| `dish.aiResponses` | *(remove)* | Phase 7 wires live AI |

Also update:
- `DishGrid.tsx` (if it accesses dish fields directly)
- `DishAISheet.tsx` — remove `aiResponses` rendering, show "Coming soon" placeholder or remove AI sheet temporarily (Phase 7 wires it)
- `DISH_CATEGORY_CONFIG` keys — verify they match `plate_type` values in DB (`appetizer`, `entree`, `side`, `dessert`)
- Type imports: `from '@/data/mock-dishes'` → `from '@/types/products'`

### 5b. Wines — `WineCardView.tsx`

| Current | New | Notes |
|---------|-----|-------|
| `wine.grape` | `wine.varietal` | Varietal badge/text |
| `wine.isBlend` | `wine.blend` | Blend indicator |
| `wine.producerStory` | `wine.producerNotes` | Producer section |
| `wine.topSeller` | `wine.isTopSeller` | Top seller badge |
| `wine.aiResponses` | *(remove)* | Phase 7 wires live AI |

Also update:
- `WineAISheet.tsx` — remove `aiResponses`, placeholder for Phase 7
- `WINE_STYLE_CONFIG` keys — verify they match `style` values in DB (`red`, `white`, `rosé`, `sparkling`)
- Type imports

### 5c. Cocktails — `CocktailCardView.tsx`

| Current | New | Notes |
|---------|-----|-------|
| `cocktail.topSeller` | `cocktail.isTopSeller` | Top seller badge |
| `cocktail.aiResponses` | *(remove)* | Phase 7 wires live AI |

Also update:
- `CocktailAISheet.tsx` — remove `aiResponses`, placeholder for Phase 7
- `COCKTAIL_STYLE_CONFIG` keys — verify they match DB values
- Type imports

### 5d. Recipes — `RecipeCardView.tsx`

This domain has the most changes due to structural differences:

| Current | New | Notes |
|---------|-----|-------|
| `recipe.category` | `recipe.prepType` or `recipe.plateType` | Use `recipe.type` discriminator |
| `recipe.yield` (string) | `${recipe.yieldQty} ${recipe.yieldUnit}` | Only on PrepRecipe |
| `recipe.shelfLife` (string) | `${recipe.shelfLifeValue} ${recipe.shelfLifeUnit}` | Only on PrepRecipe |
| `recipe.ingredientGroups[].label` | `recipe.ingredients[].group_name` | JSONB contract |
| `recipe.ingredientGroups[].items[].qty` | `recipe.ingredients[].items[].quantity` | JSONB contract |
| `recipe.ingredientGroups[].items[].text` | `recipe.ingredients[].items[].name` | JSONB contract |
| `recipe.procedureGroups[].label` | `recipe.procedure[].group_name` | JSONB contract |
| `recipe.procedureGroups[].steps[].text` | `recipe.procedure[].steps[].instruction` | JSONB contract |
| `recipe.procedureGroups[].steps[].critical` | `recipe.procedure[].steps[].critical` | Same |
| `recipe.componentGroups[].label` | `recipe.components[].group_name` | PlateSpec JSONB |
| `recipe.assemblyGroups` | `recipe.assemblyProcedure` | PlateSpec field |
| `recipe.image` (string) | `recipe.images[0]?.url` | JSONB array |
| `recipe.batchScaling` (string) | Render from JSONB object | Structure TBD |
| `recipe.trainingNotes` (string) | Render from JSONB object | Structure TBD |

Helper functions to add:

```typescript
// Format yield display
function formatYield(recipe: PrepRecipe): string {
  return `${recipe.yieldQty} ${recipe.yieldUnit}`;
}

// Format shelf life display
function formatShelfLife(recipe: PrepRecipe): string {
  return `${recipe.shelfLifeValue} ${recipe.shelfLifeUnit}`;
}

// Get primary image URL
function getRecipeImage(recipe: Recipe): string | null {
  return recipe.images?.[0]?.url ?? null;
}
```

### 5e. Beer & Liquor — `BeerLiquorList.tsx`

Minimal changes — field names already match between mock and DB:

| Current | New | Notes |
|---------|-----|-------|
| (all fields) | (same) | B&L mock types already match DB |

Update:
- Type imports: `from '@/data/mock-beer-liquor'` → `from '@/types/products'`

---

## Step 6 — Build BeerLiquorCardView + BeerLiquorAISheet

Beer & Liquor currently only has a list view with expandable items. Add a detail card view following the pattern of other domains.

### File: `src/components/beer-liquor/BeerLiquorCardView.tsx`

**Design:**
- No hero image (B&L stays image-less per scope decision)
- Simple info card: name, category badge, subcategory badge, producer, country
- Expandable sections: style, description, notes
- AI action buttons at bottom (wired in Phase 7, placeholder for now)
- Swipe navigation (prev/next)

**Props:**
```typescript
interface BeerLiquorCardViewProps {
  item: BeerLiquorItem;
  onBack: () => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
}
```

**Layout:**
```
┌──────────────────────────────────┐
│  ← Back              < 3/15 >   │
├──────────────────────────────────┤
│  [Beer] [Bock]                   │  ← category + subcategory badges
│  Shiner Bock                     │  ← name (h2)
│  Spoetzl Brewery · USA           │  ← producer · country
├──────────────────────────────────┤
│  Style                           │
│  Malty, smooth, amber            │
├──────────────────────────────────┤
│  Description                     │
│  Texas' most iconic dark lager...│
├──────────────────────────────────┤
│  Service Notes                   │
│  Serve at 38-42°F in a pint...   │
├──────────────────────────────────┤
│  [🤖 AI buttons - Phase 7]      │
└──────────────────────────────────┘
```

### Update `use-beer-liquor-viewer.ts`

Add selection state + prev/next navigation (currently missing — B&L only has list, no card):

```typescript
// Add to existing hook:
const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

const selectedItem = useMemo(
  () => filteredItems.find(i => i.slug === selectedSlug),
  [filteredItems, selectedSlug]
);

const currentIndex = useMemo(
  () => selectedSlug ? filteredItems.findIndex(i => i.slug === selectedSlug) : -1,
  [filteredItems, selectedSlug]
);

const hasPrev = currentIndex > 0;
const hasNext = currentIndex < filteredItems.length - 1;

const goToPrev = useCallback(() => {
  if (hasPrev) setSelectedSlug(filteredItems[currentIndex - 1].slug);
}, [hasPrev, filteredItems, currentIndex]);

const goToNext = useCallback(() => {
  if (hasNext) setSelectedSlug(filteredItems[currentIndex + 1].slug);
}, [hasNext, filteredItems, currentIndex]);

const selectItem = useCallback((slug: string) => setSelectedSlug(slug), []);
const clearSelection = useCallback(() => setSelectedSlug(null), []);
```

### Wire into `BeerLiquorList.tsx`

Make list items clickable → opens `BeerLiquorCardView`.

---

## Step 7 — Loading, Error, and Empty States

All viewer pages need to handle the three states that come with async data:

### Loading State

```tsx
if (isLoading) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
```

### Error State

```tsx
if (error) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-2">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-sm text-muted-foreground">Failed to load data</p>
      <Button variant="outline" size="sm" onClick={() => refetch()}>
        Try again
      </Button>
    </div>
  );
}
```

### Empty State

```tsx
if (filteredItems.length === 0 && !searchQuery) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-sm text-muted-foreground">No items available</p>
    </div>
  );
}
```

---

## Step 8 — Config Objects and Constants

The mock data files export config objects (`DISH_CATEGORY_CONFIG`, `WINE_STYLE_CONFIG`, `COCKTAIL_STYLE_CONFIG`, `ALLERGEN_CONFIG`, `BEER_LIQUOR_SUBCATEGORY_CONFIG`) that define badge colors and labels. These are UI-only and do not change.

### Strategy

Move config objects from `src/data/mock-*.ts` to a shared location:

```
src/config/
  dish-config.ts       ← DISH_CATEGORY_CONFIG, ALLERGEN_CONFIG, CATEGORY_ORDER, DISH_AI_ACTIONS
  wine-config.ts       ← WINE_STYLE_CONFIG, WINE_AI_ACTIONS
  cocktail-config.ts   ← COCKTAIL_STYLE_CONFIG, COCKTAIL_AI_ACTIONS
  recipe-config.ts     ← ALLERGEN_CONFIG (recipe version), scaleQuantity()
  beer-liquor-config.ts ← BEER_LIQUOR_SUBCATEGORY_CONFIG, MENU_SECTIONS
```

This separates configuration (colors, labels) from data (mock arrays) so the mock data files can eventually be deleted.

**Alternative (simpler):** Keep configs in mock files for now, just stop importing the data arrays. Delete mock arrays but keep exports of config objects. This avoids creating new files and moving imports.

---

## Step 9 — Verification Checklist

### Type Check
```bash
npx tsc --noEmit  # Zero new errors
```

### Visual Verification (Manual)

For each domain, verify:

| Check | Dishes | Wines | Cocktails | Recipes | Beer/Liquor |
|-------|--------|-------|-----------|---------|-------------|
| Grid/list loads with DB data | | | | | |
| Search filters correctly | | | | | |
| Category/style filter works | | | | | |
| Card view opens on click/tap | | | | | |
| All fields render (no undefined) | | | | | |
| Images display (where applicable) | | | | | |
| Top seller badge shows | | | | | |
| Prev/next navigation works | | | | | |
| Swipe navigation works (mobile) | | | | | |
| Back button returns to grid | | | | | |
| Empty search shows "no results" | | | | | |
| Loading spinner on first load | | | | | |

### Data Integrity

```sql
-- Verify all published rows are returned (should match grid counts)
SELECT 'dishes' AS domain, count(*) FROM foh_plate_specs WHERE status = 'published'
UNION ALL
SELECT 'wines', count(*) FROM wines WHERE status = 'published'
UNION ALL
SELECT 'cocktails', count(*) FROM cocktails WHERE status = 'published'
UNION ALL
SELECT 'recipes', count(*) FROM prep_recipes WHERE status = 'published'
UNION ALL
SELECT 'plate_specs', count(*) FROM plate_specs WHERE status = 'published'
UNION ALL
SELECT 'beer_liquor', count(*) FROM beer_liquor_list WHERE status = 'published';
-- Expected: 12, 5, 5, 4, 3, 15
```

### RLS Verification

```bash
# Unauthenticated request (should return empty or 401)
curl "https://nxeorbwqsovybfttemrw.supabase.co/rest/v1/foh_plate_specs?select=id,menu_name&limit=1" \
  -H "apikey: <PUBLISHABLE_KEY>"
# Expected: empty array [] (RLS blocks anonymous reads)
```

### Network Tab

- Verify only one request per table (React Query deduplication)
- Verify no `embedding` or `search_vector` columns are fetched (they're excluded from SELECT)
- Verify response size is reasonable (no accidental `select(*)`)

---

## Files Modified (Summary)

### New Files
| File | Purpose |
|------|---------|
| `src/types/products.ts` | Frontend TypeScript types for all 5 domains |
| `src/hooks/use-supabase-dishes.ts` | Data hook: foh_plate_specs → Dish[] |
| `src/hooks/use-supabase-wines.ts` | Data hook: wines → Wine[] |
| `src/hooks/use-supabase-cocktails.ts` | Data hook: cocktails → Cocktail[] |
| `src/hooks/use-supabase-recipes.ts` | Data hook: prep_recipes + plate_specs → Recipe[] |
| `src/hooks/use-supabase-beer-liquor.ts` | Data hook: beer_liquor_list → BeerLiquorItem[] |
| `src/components/beer-liquor/BeerLiquorCardView.tsx` | New card view for B&L domain |

### Modified Files
| File | Changes |
|------|---------|
| `src/integrations/supabase/types.ts` | Regenerated (adds 6 product table types) |
| `src/hooks/use-dish-viewer.ts` | Swap mock → data hook, rename fields |
| `src/hooks/use-wine-viewer.ts` | Swap mock → data hook, rename fields |
| `src/hooks/use-cocktail-viewer.ts` | Swap mock → data hook, rename fields |
| `src/hooks/use-recipe-viewer.ts` | Swap mock → data hook, rename fields |
| `src/hooks/use-beer-liquor-viewer.ts` | Swap mock → data hook, add selection/nav |
| `src/components/dishes/DishCardView.tsx` | Field renames (name→menuName, etc.) |
| `src/components/dishes/DishAISheet.tsx` | Remove aiResponses, placeholder |
| `src/components/wines/WineCardView.tsx` | Field renames (grape→varietal, etc.) |
| `src/components/wines/WineAISheet.tsx` | Remove aiResponses, placeholder |
| `src/components/cocktails/CocktailCardView.tsx` | Field renames (topSeller→isTopSeller) |
| `src/components/cocktails/CocktailAISheet.tsx` | Remove aiResponses, placeholder |
| `src/components/recipes/RecipeCardView.tsx` | Structural changes (JSONB contracts) |
| `src/components/beer-liquor/BeerLiquorList.tsx` | Make items clickable → card view |
| Various grid/page components | Add isLoading/error handling, type imports |

### Files Eventually Deprecated (Not Deleted Yet)
| File | Reason to Keep |
|------|----------------|
| `src/data/mock-dishes.ts` | Config objects still imported (DISH_CATEGORY_CONFIG, etc.) |
| `src/data/mock-wines.ts` | Config objects still imported |
| `src/data/mock-cocktails.ts` | Config objects still imported |
| `src/data/mock-recipes.ts` | Config objects still imported |
| `src/data/mock-beer-liquor.ts` | Config objects still imported |

Config objects will be extracted in a cleanup pass or left in mock files with data arrays removed.

---

## Implementation Order

1. **Regenerate types** (Step 1) — prerequisite for everything
2. **Create `src/types/products.ts`** (Step 2) — shared types
3. **Create 5 data hooks** (Step 3) — can be done in parallel
4. **Rewire viewer hooks** (Step 4) — sequential, one domain at a time
5. **Update component renderers** (Step 5) — per domain, alongside step 4
6. **Build BeerLiquorCardView** (Step 6) — standalone, can overlap with steps 4-5
7. **Add loading/error/empty states** (Step 7) — after data flows
8. **Extract config objects** (Step 8) — optional cleanup
9. **Verify** (Step 9) — final pass

**Recommended domain order:** Beer/Liquor (simplest, fewest renames) → Cocktails → Wines → Dishes → Recipes (most complex).

---

## Implementation Checklist

- [ ] Regenerate `types.ts` from DB schema
- [ ] Create `src/types/products.ts` with all domain interfaces
- [ ] Create `use-supabase-dishes.ts` data hook
- [ ] Create `use-supabase-wines.ts` data hook
- [ ] Create `use-supabase-cocktails.ts` data hook
- [ ] Create `use-supabase-recipes.ts` data hook
- [ ] Create `use-supabase-beer-liquor.ts` data hook
- [ ] Rewire `use-dish-viewer.ts` (mock → Supabase)
- [ ] Rewire `use-wine-viewer.ts` (mock → Supabase)
- [ ] Rewire `use-cocktail-viewer.ts` (mock → Supabase)
- [ ] Rewire `use-recipe-viewer.ts` (mock → Supabase)
- [ ] Rewire `use-beer-liquor-viewer.ts` (mock → Supabase + add selection)
- [ ] Update `DishCardView.tsx` field renames
- [ ] Update `WineCardView.tsx` field renames
- [ ] Update `CocktailCardView.tsx` field renames
- [ ] Update `RecipeCardView.tsx` structural changes
- [ ] Build `BeerLiquorCardView.tsx`
- [ ] Update AI sheets (remove aiResponses, placeholder for Phase 7)
- [ ] Add loading/error/empty states to all viewer pages
- [ ] Verify: `npx tsc --noEmit` passes
- [ ] Verify: all 5 grids render DB data
- [ ] Verify: all card views display correctly
- [ ] Verify: search and filter work
- [ ] Verify: RLS blocks unauthenticated access
- [ ] Verify: no embedding/search_vector columns fetched
