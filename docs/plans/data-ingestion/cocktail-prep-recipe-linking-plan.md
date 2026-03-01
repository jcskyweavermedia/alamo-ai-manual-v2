# Plan: Bar Prep Recipes & Cocktail ↔ Prep Recipe Linking

## Problem

Cocktails often use house-made ingredients (syrups, infusions, shrubs, bitters) that should live in the **prep_recipes** system — the same way kitchen plate specs already link to chimichurri, demi-glace, and compound butter. Today:

- `prep_recipes` has no way to distinguish **bar** vs **kitchen** recipes
- `cocktails.ingredients` is plain `TEXT` — no structured linking to prep recipes
- The AI cocktail chat prompt mentions `search_recipes` but there's no schema to store the result
- Plate specs already have full linking infrastructure (components JSONB, `prep_recipe_ref`, `SubRecipeLinker` UI, `search_recipes` tool) — we reuse all of it

## Approach

**Don't reinvent — extend.** Add a `department` column to `prep_recipes`, add bar-specific prep types, and add a lightweight `linked_prep_recipes` JSONB column to `cocktails` for references. Keep `ingredients TEXT` as-is for display/search.

## UX Model — Route-Driven, Not Toggle-Driven

The user **never sees** a department toggle. Instead, the IngestWizard shows **two separate cards**:

| Card | Internal `activeType` | DB table | Department (locked) | AI prompts |
|------|-----------------------|----------|---------------------|------------|
| **Prep Recipe** | `prep_recipe` | `prep_recipes` | `kitchen` | ingest-chat-prep-recipe |
| **Bar Prep** | `bar_prep` | `prep_recipes` | `bar` | ingest-chat-bar-prep |

Both render the **same `PrepRecipeEditor`** component, but:
- `department` is set automatically from `activeType` — never exposed as a field
- The prep type dropdown shows **only** the types for that department
- The AI chat prompt is department-specific (kitchen context vs. bar context)
- After publish, bar preps navigate to a bar prep recipes listing; kitchen preps to the existing recipes listing

When the cocktail builder's `SubRecipeLinker` searches for recipes, it **only shows bar prep recipes** (`department = 'bar'`).

---

## Phase 1: Database Migration

### 1A. Add `department` column to `prep_recipes`

```sql
ALTER TABLE public.prep_recipes
  ADD COLUMN department TEXT NOT NULL DEFAULT 'kitchen'
  CHECK (department IN ('kitchen', 'bar'));

CREATE INDEX idx_prep_recipes_department ON public.prep_recipes (department);
```

Existing 4 recipes → all get `department = 'kitchen'` (correct: demi-glace, chimichurri, compound butter, creamed spinach).

### 1B. Add `linked_prep_recipes` column to `cocktails`

```sql
ALTER TABLE public.cocktails
  ADD COLUMN linked_prep_recipes JSONB NOT NULL DEFAULT '[]'
  CHECK (jsonb_typeof(linked_prep_recipes) = 'array');
```

**Structure:**
```json
[
  {
    "prep_recipe_ref": "honey-ginger-syrup",
    "name": "Honey-Ginger Syrup",
    "quantity": 0.75,
    "unit": "oz"
  }
]
```

### 1C. Update `cocktails` search_vector trigger

Add `linked_prep_recipes` names to the search vector so searching "honey ginger syrup" finds cocktails that use it:

```sql
CREATE OR REPLACE FUNCTION public.cocktails_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.key_ingredients, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.ingredients, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW.tasting_notes, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(r->>'name', ' ') FROM jsonb_array_elements(NEW.linked_prep_recipes) AS r),
      ''
    )), 'B');
  RETURN NEW;
END;
$$;
```

### 1D. Add `search_bar_recipes` helper (optional)

Create a thin wrapper or add a `department` parameter to the existing `search_recipes` RPC so the SubRecipeLinker can filter by department:

```sql
-- Option A: Add department param to existing search_recipes
-- Option B: Create search_bar_recipes that wraps search_recipes with department='bar' filter
-- Simplest: Just add a department filter param to search_recipes (default NULL = all)
CREATE OR REPLACE FUNCTION public.search_recipes(
  search_query TEXT,
  query_embedding vector(1536) DEFAULT NULL,
  result_limit INT DEFAULT 10,
  filter_department TEXT DEFAULT NULL  -- NEW: NULL = all, 'bar' = bar only, 'kitchen' = kitchen only
)
RETURNS TABLE(...) AS $$
  -- existing body + WHERE (filter_department IS NULL OR pr.department = filter_department)
$$;
```

---

## Phase 2: Routing — `bar_prep` as a New Product Type

### 2A. Add `bar_prep` to `ProductType` union

**File**: `src/types/ingestion.ts`

```typescript
export type ProductType =
  | 'prep_recipe'
  | 'bar_prep'        // NEW — same table, different department
  | 'plate_spec'
  | 'foh_plate_spec'
  | 'wine'
  | 'cocktail'
  | 'beer_liquor';
```

Add to `PRODUCT_TYPES` metadata array:
```typescript
{ key: 'bar_prep', label: 'Bar Prep', enabled: true },
```

### 2B. Add `bar_prep` to IngestWizard

**File**: `src/pages/IngestWizard.tsx`

Add card to `PRODUCT_TYPE_CARDS`:
```typescript
{ key: 'bar_prep', label: 'Bar Prep', icon: Pipette, emoji: '🧪', enabled: true },
```

Add to `PRODUCT_TABLE_MAP`:
```typescript
bar_prep: 'prep_recipes',  // same DB table as prep_recipe
```

### 2C. Add `bar_prep` to IngestPage mappings

**File**: `src/pages/IngestPage.tsx`

```typescript
// All 5 mappings:
ACTIVE_TYPE_TABLE['bar_prep'] = 'prep_recipes';
ACTIVE_TYPE_CACHE_KEY['bar_prep'] = 'bar-recipes';    // separate cache key
ACTIVE_TYPE_LABEL['bar_prep'] = 'Bar Prep';
TABLE_NAVIGATE — needs context-aware routing (see 2D)

// TABLE_TO_ACTIVE_TYPE — special handling:
// Can't map prep_recipes → both prep_recipe and bar_prep
// On session resume, check the row's department column to determine activeType
```

### 2D. Session resume: Determine `bar_prep` vs `prep_recipe` from `department`

When resuming a session for `productTable = 'prep_recipes'`, we need to distinguish:

```typescript
// In the session resume handler:
if (table === 'prep_recipes' && data) {
  const department = data.department || 'kitchen';
  const activeType = department === 'bar' ? 'bar_prep' : 'prep_recipe';
  dispatch({ type: 'SET_ACTIVE_TYPE', payload: activeType });
  // ... build draft as usual
}
```

For NEW sessions (no existing row), the `activeType` is already set from the wizard card click.

### 2E. Editor rendering — both types use `PrepRecipeEditor`

```typescript
const isBarPrepType = state.activeType === 'bar_prep';
const isPrepType = state.activeType === 'prep_recipe' || isBarPrepType;

const editorComponent = isPlateSpecType
  ? <PlateSpecEditor />
  : isCocktailType
    ? <CocktailEditor />
    : isWineType
      ? <WineEditor />
      : isPrepType
        ? <PrepRecipeEditor />  // handles both kitchen and bar
        : null;
```

### 2F. Navigate after publish

```typescript
// Bar preps go to bar prep listing; kitchen preps to recipes listing
if (state.activeType === 'bar_prep') {
  navigate('/bar-recipes');  // or '/recipes?department=bar' — depends on routing setup
} else if (table === 'prep_recipes') {
  navigate('/recipes');
}
```

---

## Phase 3: TypeScript Types

### 3A. Add `department` to PrepRecipe types

**File**: `src/types/products.ts`

```typescript
export interface PrepRecipe {
  // ... existing fields ...
  department: 'kitchen' | 'bar';
}
```

**File**: `src/types/ingestion.ts`

```typescript
export interface PrepRecipeDraft {
  // ... existing fields ...
  department: 'kitchen' | 'bar';
}

// Update createEmptyPrepRecipeDraft — now accepts department param:
export function createEmptyPrepRecipeDraft(department: 'kitchen' | 'bar' = 'kitchen'): PrepRecipeDraft {
  return {
    name: '', slug: '',
    department,
    prepType: department === 'bar' ? 'syrup' : 'sauce',  // department-aware default
    // ... rest unchanged
  };
}
```

### 3B. Add `LinkedPrepRecipe` type and update CocktailDraft

**File**: `src/types/ingestion.ts`

```typescript
export interface LinkedPrepRecipe {
  prep_recipe_ref: string;  // slug
  name: string;
  quantity: number;
  unit: string;
}

export interface CocktailDraft {
  // ... existing fields ...
  linkedPrepRecipes: LinkedPrepRecipe[];
}

// Update createEmptyCocktailDraft:
linkedPrepRecipes: [],
```

### 3C. Update IngestDraftContext

**File**: `src/contexts/IngestDraftContext.tsx`

```typescript
// RESET_DRAFT — department-aware:
case 'RESET_DRAFT': {
  const emptyDraft = state.activeType === 'bar_prep'
    ? createEmptyPrepRecipeDraft('bar')
    : state.activeType === 'prep_recipe'
      ? createEmptyPrepRecipeDraft('kitchen')
      : state.activeType === 'cocktail'
        ? createEmptyCocktailDraft()
        // ... etc
}

// SET_ACTIVE_TYPE — auto-set department when switching:
case 'SET_ACTIVE_TYPE': {
  // When wizard sets activeType to 'bar_prep', create draft with department='bar'
  const draft = action.payload === 'bar_prep'
    ? createEmptyPrepRecipeDraft('bar')
    : action.payload === 'prep_recipe'
      ? createEmptyPrepRecipeDraft('kitchen')
      : // ... existing logic
}

// New cocktail actions:
| { type: 'SET_COCKTAIL_LINKED_RECIPES'; payload: LinkedPrepRecipe[] }
| { type: 'ADD_COCKTAIL_LINKED_RECIPE'; payload: LinkedPrepRecipe }
| { type: 'REMOVE_COCKTAIL_LINKED_RECIPE'; payload: string }  // by slug
```

No `SET_PREP_DEPARTMENT` action needed — department is locked by route, never user-editable.

---

## Phase 4: Prep Recipe Editor — Department-Aware Prep Types

### 4A. Filter prep types by department in `MetadataFields.tsx`

**File**: `src/components/ingest/editor/MetadataFields.tsx`

The editor reads `draft.department` and shows only the relevant prep types:

```typescript
const KITCHEN_PREP_TYPES = [
  'sauce', 'base', 'dressing', 'marinade', 'rub', 'compound-butter',
  'brine', 'stock', 'garnish', 'dessert-component', 'bread', 'dough',
  'batter', 'cure', 'pickle', 'ferment', 'other',
];

const BAR_PREP_TYPES = [
  'syrup', 'infusion', 'shrub', 'bitters', 'cordial', 'tincture', 'other',
];

// In component:
const prepTypes = draft.department === 'bar' ? BAR_PREP_TYPES : KITCHEN_PREP_TYPES;
```

**No department toggle/selector shown.** The field is invisible to the user — it's derived from which wizard card they clicked.

### 4B. Fix current PREP_TYPES sync issue

Replace the current out-of-sync `PREP_TYPES` array:

**Current (broken — missing 6 from prompts, has 4 orphans):**
```typescript
const PREP_TYPES = ['sauce', 'marinade', 'brine', 'stock', 'dressing', 'garnish', 'protein', 'starch', 'vegetable', 'dessert', 'other'];
```

Replace with the two department-aware arrays above.

### 4C. Update AI panel label

```typescript
const aiPanelLabel = isBarPrepType
  ? 'AI Bar Prep Builder'
  : isPrepType
    ? 'AI Recipe Builder'
    : isCocktailType
      ? 'AI Cocktail Builder'
      : // ...
```

---

## Phase 5: Cocktail Editor — Linked Recipes Section

### 5A. Add "House-Made Ingredients" accordion section to `CocktailEditor.tsx`

**File**: `src/components/ingest/editor/CocktailEditor.tsx`

New accordion section (between Ingredients and Method):

```tsx
<AccordionItem value="linked-recipes">
  <AccordionTrigger>
    House-Made Ingredients {draft.linkedPrepRecipes.length > 0 && `(${draft.linkedPrepRecipes.length})`}
  </AccordionTrigger>
  <AccordionContent>
    {draft.linkedPrepRecipes.map((recipe) => (
      <LinkedRecipeRow
        key={recipe.prep_recipe_ref}
        recipe={recipe}
        onUpdateQuantity={(qty, unit) => { /* update in array */ }}
        onRemove={() => dispatch({ type: 'REMOVE_COCKTAIL_LINKED_RECIPE', payload: recipe.prep_recipe_ref })}
      />
    ))}
    <SubRecipeLinker
      department="bar"
      onLink={(slug, name) => dispatch({
        type: 'ADD_COCKTAIL_LINKED_RECIPE',
        payload: { prep_recipe_ref: slug, name, quantity: 0, unit: 'oz' },
      })}
      excludeSlugs={draft.linkedPrepRecipes.map(r => r.prep_recipe_ref)}
    />
  </AccordionContent>
</AccordionItem>
```

### 5B. Create `LinkedRecipeRow.tsx` component

**New file**: `src/components/ingest/editor/LinkedRecipeRow.tsx`

Small row component:
- Link2 icon (emerald) + recipe name
- Quantity input + unit dropdown (oz, dash, barspoon, splash, rinse)
- X button to unlink

### 5C. Update `SubRecipeLinker` — add `department` filter prop

**File**: `src/components/ingest/editor/SubRecipeLinker.tsx`

Add optional `department` prop:

```typescript
interface SubRecipeLinkerProps {
  onLink: (slug: string, name: string) => void;
  excludeSlugs?: string[];
  department?: 'kitchen' | 'bar';  // NEW: filter search results by department
}
```

When `department` is set, pass it to `search_recipes` RPC (or filter client-side).

**From plate spec editor**: no department prop → shows all recipes (kitchen items for plate components)
**From cocktail editor**: `department="bar"` → shows only bar prep recipes (syrups, infusions, etc.)

---

## Phase 6: Edge Functions — AI Schema + Prompt Updates

### 6A. Update `COCKTAIL_DRAFT_SCHEMA`

**Files**: `supabase/functions/ingest/index.ts`, `ingest-vision/index.ts`, `ingest-file/index.ts`

Add `linkedPrepRecipes` to the extraction schema:

```typescript
linkedPrepRecipes: {
  type: "array",
  items: {
    type: "object",
    properties: {
      prep_recipe_ref: { type: "string", description: "Slug of the linked prep recipe" },
      name: { type: "string", description: "Display name of the prep recipe" },
      quantity: { type: "number", description: "Amount used in the cocktail" },
      unit: { type: "string", description: "Unit of measurement (oz, dash, barspoon, etc.)" },
    },
    required: ["prep_recipe_ref", "name", "quantity", "unit"],
    additionalProperties: false,
  },
  description: "House-made ingredients linked to bar prep recipes (syrups, infusions, bitters, etc.)",
},
```

Add to `required` array.

### 6B. Update `PREP_RECIPE_DRAFT_SCHEMA`

**Files**: `supabase/functions/ingest/index.ts`, `ingest-vision/index.ts`, `ingest-file/index.ts`

Add `department` field:

```typescript
department: {
  type: "string",
  enum: ["kitchen", "bar"],
  description: "kitchen = BOH food prep, bar = syrups, infusions, bitters, shrubs, cordials, tinctures",
},
```

Add to `required` array.

### 6C. Add `PROMPT_SLUG_MAP` entry for bar_prep

**File**: `supabase/functions/ingest/index.ts`

The ingest function selects AI prompts based on `productTable`. Since both `prep_recipe` and `bar_prep` use `prep_recipes` table, we need a way to select different prompts.

**Option**: Pass the `activeType` (or department) from the frontend session to the edge function. The session already stores `productTable` — we also store `department` or `activeType` in the session metadata.

```typescript
// When creating session (IngestWizard):
const session = await createSession({
  productTable: 'prep_recipes',
  metadata: { department: 'bar' },  // or activeType: 'bar_prep'
});

// In edge function:
const isBarPrep = session.metadata?.department === 'bar';
const promptSlugs = isBarPrep
  ? { chat: "ingest-chat-bar-prep", extract: "ingest-extract-bar-prep" }
  : PROMPT_SLUG_MAP[productTable];
```

### 6D. New AI prompts migration — bar prep

**New migration**: `supabase/migrations/XXXXXX_ingest_bar_prep_prompts.sql`

Insert **3 prompt pairs** (EN + ES):

#### `ingest-chat-bar-prep`
- Role: Expert bartender and bar prep assistant for Alamo Prime
- Specializes in: simple syrups, infused syrups, shrubs, house-made bitters, cordials, tinctures, spirit infusions
- Asks about: base spirit/liquid, sweetener ratio, infusion time, shelf life, batch size
- Does NOT suggest web search — model knows bar prep techniques
- Suggests cocktail pairings from the menu context
- Prep types: syrup, infusion, shrub, bitters, cordial, tincture, other

#### `ingest-extract-bar-prep`
- Same structure as ingest-extract-prep-recipe but with bar-specific field guidance
- Auto-sets `department: "bar"`
- Prep type validation: syrup/infusion/shrub/bitters/cordial/tincture/other
- Yield units: oz, qt, bottle, batch
- Shelf life awareness: syrups (2 weeks), infusions (varies), bitters (months)

#### `ingest-file-bar-prep`
- Same as above but for file/image upload context

### 6E. Update cocktail AI prompts — linked recipes

**New migration**: `supabase/migrations/XXXXXX_update_cocktail_prompts_linked_recipes.sql`

Update `ingest-chat-cocktail` (EN + ES) — add section:
```
## House-Made Ingredients

When the user mentions a house-made ingredient (e.g., "our honey-ginger syrup",
"house grenadine", "our lavender tincture"), **immediately call `search_recipes`**
to find it in the prep recipes database.

If found: include it in `linkedPrepRecipes` with the slug, name, quantity, and unit.
If not found: mention that the recipe doesn't exist yet and suggest creating it
as a bar prep recipe first, then linking it.

Always ask about measurements for linked prep recipes.
```

Update `ingest-extract-cocktail` (EN + ES) — add section:
```
## linkedPrepRecipes

When the chat mentions house-made ingredients found via search_recipes:
- Set `prep_recipe_ref` to the slug returned by the search
- Set `name` to the canonical recipe name
- Set `quantity` and `unit` from the conversation context
- These ingredients should ALSO appear in the `ingredients` text field
  (linked_prep_recipes is a structured overlay, not a replacement)
```

---

## Phase 7: Publish Flow Updates

### 7A. Cocktail publish — add `linked_prep_recipes`

**File**: `src/pages/IngestPage.tsx`

```typescript
const row = {
  // ... existing cocktail fields ...
  linked_prep_recipes: cd.linkedPrepRecipes,
};
```

### 7B. Cocktail edit-load — deserialize linked recipes

```typescript
linkedPrepRecipes: (data.linked_prep_recipes as LinkedPrepRecipe[]) || [],
```

### 7C. Prep recipe publish — add `department`

```typescript
const row = {
  // ... existing prep fields ...
  department: rd.department,
};
```

### 7D. Prep recipe edit-load — determine activeType from department

```typescript
if (table === 'prep_recipes' && data) {
  const department = data.department || 'kitchen';
  const activeType = department === 'bar' ? 'bar_prep' : 'prep_recipe';
  dispatch({ type: 'SET_ACTIVE_TYPE', payload: activeType });
  // build draft with department field set
}
```

### 7E. Navigate after publish

```typescript
if (state.activeType === 'bar_prep') {
  navigate('/bar-recipes');
} else if (table === 'prep_recipes') {
  navigate('/recipes');
}
```

---

## Phase 8: Preview & Card View Updates

### 8A. Update `CocktailIngestPreview.tsx`

Add "House-Made Ingredients" section showing linked recipes with Link2 icon + name + quantity.

### 8B. Update `CocktailCardView.tsx`

Show linked prep recipes (if any) as small emerald-highlighted pills with recipe names.

### 8C. Update prep recipe cards (optional)

Add a subtle department indicator (e.g., bar prep cards have a slightly different accent color or icon) so admins can distinguish in lists. Not a toggle — just visual.

---

## Files Summary

| # | File | Action | What |
|---|------|--------|------|
| 1 | `supabase/migrations/XXXXXX_add_department_and_linked_recipes.sql` | **New** | ALTER prep_recipes (department), ALTER cocktails (linked_prep_recipes), search_vector trigger, search_recipes department param |
| 2 | `src/types/ingestion.ts` | Edit | `bar_prep` in ProductType union + PRODUCT_TYPES, `department` in PrepRecipeDraft, `linkedPrepRecipes` + `LinkedPrepRecipe` in CocktailDraft, update factories |
| 3 | `src/types/products.ts` | Edit | `department` in PrepRecipe, `linkedPrepRecipes` in Cocktail, `LinkedPrepRecipe` interface |
| 4 | `src/contexts/IngestDraftContext.tsx` | Edit | RESET_DRAFT/SET_ACTIVE_TYPE department-aware, cocktail linked recipe actions (ADD/REMOVE/SET) |
| 5 | `src/pages/IngestWizard.tsx` | Edit | Add "Bar Prep" card (Pipette icon, key: bar_prep), add to PRODUCT_TABLE_MAP |
| 6 | `src/pages/IngestPage.tsx` | Edit | All 5 mappings for bar_prep, editor rendering (isPrepType includes bar_prep), publish/load with department + linked_prep_recipes, session resume department detection, navigate after publish |
| 7 | `src/components/ingest/editor/MetadataFields.tsx` | Edit | Replace PREP_TYPES with department-aware KITCHEN_PREP_TYPES + BAR_PREP_TYPES, read draft.department to select list, no toggle visible |
| 8 | `src/components/ingest/editor/CocktailEditor.tsx` | Edit | Add "House-Made Ingredients" accordion section with SubRecipeLinker(department="bar") |
| 9 | `src/components/ingest/editor/LinkedRecipeRow.tsx` | **New** | Row: link icon + name + qty + unit + remove button |
| 10 | `src/components/ingest/editor/SubRecipeLinker.tsx` | Edit | Add optional `department` filter prop, pass to search_recipes RPC |
| 11 | `src/components/ingest/CocktailIngestPreview.tsx` | Edit | Show linked recipes section |
| 12 | `src/components/cocktails/CocktailCardView.tsx` | Edit | Show linked recipes if present |
| 13 | `supabase/functions/ingest/index.ts` | Edit | COCKTAIL_DRAFT_SCHEMA (linkedPrepRecipes), PREP_RECIPE_DRAFT_SCHEMA (department), department-aware prompt selection |
| 14 | `supabase/functions/ingest-vision/index.ts` | Edit | Same schema updates |
| 15 | `supabase/functions/ingest-file/index.ts` | Edit | Same schema updates |
| 16 | `supabase/migrations/XXXXXX_ingest_bar_prep_prompts.sql` | **New** | 3 bar prep prompts: chat + extract + file (EN + ES) |
| 17 | `supabase/migrations/XXXXXX_update_cocktail_prompts_linked_recipes.sql` | **New** | Update cocktail prompts for linkedPrepRecipes |

**3 new files, 12 edited files, 4 new migrations.**

---

## Implementation Order

1. **Phase 1** (DB): `department` column + `linked_prep_recipes` column + search_vector + search_recipes param
2. **Phase 2** (Routing): `bar_prep` ProductType + wizard card + IngestPage mappings + session resume
3. **Phase 3** (Types): TypeScript interfaces + draft factories + LinkedPrepRecipe
4. **Phase 4** (Prep Editor): Department-aware prep types in MetadataFields (no toggle)
5. **Phase 5** (Cocktail Editor): Linked recipes section + LinkedRecipeRow + SubRecipeLinker department filter
6. **Phase 6** (Edge Functions): Schemas + prompt migrations + department-aware prompt selection
7. **Phase 7** (Publish/Load): Row mapping + deserialization + department-based activeType on resume
8. **Phase 8** (Preview/Cards): Visual updates

**Run `npx tsc --noEmit` after phases 2-5 and 7.**

---

## Verification

1. `npx supabase db push` — migration applies cleanly
2. Existing 4 prep recipes get `department = 'kitchen'` ✓
3. Existing 5 cocktails get `linked_prep_recipes = '[]'` ✓
4. **IngestWizard**: Shows both "Prep Recipe" and "Bar Prep" cards
5. **Bar prep flow**:
   - Click "Bar Prep" → session created with `productTable: 'prep_recipes'`, metadata: `{ department: 'bar' }`
   - PrepRecipeEditor opens with bar prep types (syrup, infusion, shrub, bitters, cordial, tincture)
   - **No department toggle visible** — it's locked to 'bar'
   - AI chat: "I want to make a honey-ginger syrup" → AI responds with bar context
   - Publish → `department = 'bar'`, `prep_type = 'syrup'`
   - Navigates to `/bar-recipes`
6. **Kitchen prep flow** (regression):
   - Click "Prep Recipe" → same editor but with kitchen prep types (sauce, marinade, stock...)
   - AI uses kitchen context prompts
   - Publish → `department = 'kitchen'`
   - Navigates to `/recipes`
7. **Cocktail flow with linking**:
   - AI chat: "Make me a Penicillin with our honey-ginger syrup"
   - AI calls `search_recipes("honey ginger syrup")` → finds bar prep recipe
   - AI populates `linkedPrepRecipes: [{ prep_recipe_ref: "honey-ginger-syrup", ... }]`
   - Editor shows "House-Made Ingredients (1)" section with emerald-highlighted recipe
   - SubRecipeLinker in cocktail editor only shows bar prep recipes
   - Publish → `linked_prep_recipes` saved to cocktails table
8. **Manual linking**: In cocktail editor, click "Link Recipe" → search shows only bar preps → select → saved
9. **Session resume**: Open saved bar prep session → `department = 'bar'` detected → editor shows bar prep types
10. **No regression**: Plate spec linking unchanged (uses all recipes, no department filter)
11. `npx tsc --noEmit` — 0 errors
12. `npx supabase functions deploy ingest ingest-vision ingest-file` — all deploy

---

## Out of Scope

- **Allergen tracking on cocktails**: Could be added later (same pattern as plate spec components)
- **Automatic ingredients text sync**: When a linked recipe is added, we could auto-insert it into the ingredients text — deferred (dual representation is manual)
- **Bar prep recipe templates**: Pre-built templates for common syrups — nice-to-have, not MVP
- **Cross-department linking from plate specs**: Plate specs could theoretically link to bar preps (e.g., a dessert plate using a shrub) — already works because plate spec SubRecipeLinker has no department filter
- **Bar prep recipes listing page**: `/bar-recipes` route + page component — needed but outside scope of this plan (it's a simple filtered view of prep_recipes)
