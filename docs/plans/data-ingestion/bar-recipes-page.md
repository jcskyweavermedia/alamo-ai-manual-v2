# Plan: `/bar-recipes` Listing Page

## Context

After publishing a bar prep recipe (syrup, infusion, shrub, bitters, etc.), users currently land on `/recipes` which shows ALL prep recipes mixed together. We need a dedicated `/bar-recipes` page that shows only `department = 'bar'` recipes.

The existing `/recipes` page (`src/pages/Recipes.tsx`) fetches from both `prep_recipes` and `plate_specs`, supports filter modes (all/prep/plate), and has a detail view with AI actions. The bar recipes page is simpler — only prep recipes, no plate specs, no filter mode toggle.

## Approach

Copy the recipes page pattern, strip the plate_specs/filter logic, add a `department='bar'` filter to the data hook. Reuse `RecipeGrid`, `RecipeCardView`, and AI panel components.

---

## Phase 1: Data Hook

### 1A. Create `use-supabase-bar-recipes.ts`

**New file**: `src/hooks/use-supabase-bar-recipes.ts`

Simplified copy of `use-supabase-recipes.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PrepRecipe } from '@/types/products';

export function useBarRecipes() {
  return useQuery({
    queryKey: ['bar-recipes'],
    queryFn: async (): Promise<PrepRecipe[]> => {
      const { data, error } = await supabase
        .from('prep_recipes')
        .select('*')
        .eq('status', 'published')
        .eq('department', 'bar')
        .order('name');

      if (error) throw error;

      return (data || []).map((row) => ({
        // Same mapping as use-supabase-recipes.ts for prep recipes
        // id, slug, name, type: 'prep', prepType, department, tags,
        // yieldQty, yieldUnit, shelfLifeValue, shelfLifeUnit,
        // ingredients, procedure, batchScaling, trainingNotes, images
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}
```

Key difference from `use-supabase-recipes.ts`:
- Only queries `prep_recipes` (no `plate_specs`)
- Adds `.eq('department', 'bar')` filter
- Uses `queryKey: ['bar-recipes']` (matches `ACTIVE_TYPE_CACHE_KEY['bar_prep']`)
- Returns `PrepRecipe[]` not `Recipe[]` (no plate spec union)

### 1B. Create `use-bar-recipe-viewer.ts`

**New file**: `src/hooks/use-bar-recipe-viewer.ts`

Simplified copy of `use-recipe-viewer.ts`. Remove:
- `filterMode` state (no prep/plate toggle — all items are prep recipes)
- `filteredByMode` step (no plate_specs to filter out)
- Cross-linking logic (no plate → prep navigation)

Keep:
- `selectedId` / `selectedRecipe` state
- Search query filtering (by name, tags, prepType)
- Prev/Next navigation
- Batch multiplier

```typescript
import { useState, useMemo, useCallback } from 'react';
import type { PrepRecipe } from '@/types/products';

export function useBarRecipeViewer(recipes: PrepRecipe[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchMultiplier, setBatchMultiplier] = useState(1);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    const q = searchQuery.toLowerCase();
    return recipes.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.prepType.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [recipes, searchQuery]);

  const selectedRecipe = useMemo(
    () => filtered.find(r => r.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  // ... selectRecipe, clearSelection, goNext, goPrev callbacks
  // Same pattern as use-recipe-viewer.ts

  return {
    recipes: filtered,
    selectedRecipe,
    searchQuery,
    setSearchQuery,
    selectRecipe: setSelectedId,
    clearSelection: () => setSelectedId(null),
    batchMultiplier,
    setBatchMultiplier,
    // goNext, goPrev
  };
}
```

---

## Phase 2: Page Component

### 2A. Create `BarRecipes.tsx`

**New file**: `src/pages/BarRecipes.tsx`

Copy from `Recipes.tsx`, with these differences:

| Aspect | Recipes.tsx | BarRecipes.tsx |
|--------|-------------|---------------|
| Data hook | `useRecipes()` | `useBarRecipes()` |
| Viewer hook | `useRecipeViewer(recipes)` | `useBarRecipeViewer(recipes)` |
| Filter mode buttons | Yes (All / Prep / Plate) | No (all items are bar preps) |
| Header title | "Recipes" | "Bar Recipes" |
| Intro text | "Crafted with Love & Fire" | "House-Made Syrups, Infusions & More" (or similar) |
| Empty state | "No recipes found" | "No bar recipes found" |
| AI panel | `DockedProductAIPanel` + `ProductAIDrawer` | Same (reuse) |
| Card view | `RecipeCardView` | Same (reuse — it already handles prep recipes) |
| Grid | `RecipeGrid` | Same (reuse) |

The page structure is identical:
- Loading state → skeleton
- Error state → error message
- Grid mode → search bar + RecipeGrid
- Detail mode → back button + RecipeCardView + AI panel

---

## Phase 3: Routing & Navigation

### 3A. Add route to `App.tsx`

**File**: `src/App.tsx`

```tsx
import BarRecipes from './pages/BarRecipes';

<Route path="/bar-recipes" element={
  <ProtectedRoute>
    <BarRecipes />
  </ProtectedRoute>
} />
```

### 3B. Add to sidebar navigation

**File**: `src/lib/constants.ts`

Add to both `STAFF_NAV_ITEMS` and `ADMIN_NAV_ITEMS`:

```typescript
{ path: '/bar-recipes', label: 'Bar Recipes', icon: 'Pipette' },
```

Place it after Cocktails (since bar recipes are used by the bar program):

```
Recipes       (BOH)
Dish Guide    (FOH)
Wines         (FOH)
Cocktails     (FOH)
Bar Recipes   (BAR)  ← NEW
Beer & Liquor (FOH)
```

### 3C. Update sidebar section header

**File**: `src/components/layout/Sidebar.tsx`

If there's a section header mapping, add:

```typescript
'/bar-recipes': 'BAR',
```

Or group it under the existing sections — check the current sidebar rendering logic.

### 3D. Update `TABLE_NAVIGATE` for bar_prep

**File**: `src/pages/IngestPage.tsx`

Currently `prep_recipes: '/recipes'` handles both. After publishing a bar_prep, navigate to `/bar-recipes`:

```typescript
// In the publish flow, after successful publish:
if (state.activeType === 'bar_prep') {
  navigate('/bar-recipes');
} else if (table === 'prep_recipes') {
  navigate('/recipes');
}
```

Or update `TABLE_NAVIGATE` with a custom override that checks `activeType`.

### 3E. Update `/recipes` page — filter out bar recipes

**File**: `src/hooks/use-supabase-recipes.ts`

The existing recipes hook should add `.eq('department', 'kitchen')` (or `.neq('department', 'bar')`) to the prep_recipes query so bar recipes don't appear on the kitchen recipes page:

```typescript
const { data: prepData } = await supabase
  .from('prep_recipes')
  .select('*')
  .eq('status', 'published')
  .eq('department', 'kitchen')  // NEW — exclude bar recipes
  .order('name');
```

---

## Files Summary

| # | File | Action | What |
|---|------|--------|------|
| 1 | `src/hooks/use-supabase-bar-recipes.ts` | **New** | Data hook: fetch prep_recipes WHERE department='bar' |
| 2 | `src/hooks/use-bar-recipe-viewer.ts` | **New** | Viewer hook: search, selection, navigation (no filter mode) |
| 3 | `src/pages/BarRecipes.tsx` | **New** | Page component (simplified copy of Recipes.tsx) |
| 4 | `src/App.tsx` | Edit | Add `/bar-recipes` route |
| 5 | `src/lib/constants.ts` | Edit | Add "Bar Recipes" to nav items |
| 6 | `src/components/layout/Sidebar.tsx` | Edit | Add section header or grouping for bar recipes |
| 7 | `src/pages/IngestPage.tsx` | Edit | Navigate to `/bar-recipes` after bar_prep publish |
| 8 | `src/hooks/use-supabase-recipes.ts` | Edit | Filter kitchen recipes only (exclude bar) |

**3 new files, 5 edited files, 0 migrations.**

---

## Verification

1. Navigate to `/bar-recipes` — shows empty state (no bar recipes yet)
2. Create a bar prep recipe via IngestWizard → "Bar Prep" → publish
3. After publish, lands on `/bar-recipes` — shows the new recipe
4. Navigate to `/recipes` — the bar recipe does NOT appear here (kitchen only)
5. Click a bar recipe card → detail view with RecipeCardView, AI panel works
6. Search works (by name, prepType, tags)
7. Sidebar shows "Bar Recipes" link in the correct position
8. Mobile: responsive grid (1 col → 2 col), AI drawer works
