# Phase 8: Plate Spec Ingestion + Auto Dish Guide Generation

## Overview

Enable full plate spec data ingestion (chat/file/image/manual), then auto-generate a FOH Dish Guide (`foh_plate_specs`) from the finalized plate spec. The preview shows **both** the plate spec and dish guide in a tabbed layout, each with an EN/ES toggle. A "Generate Dish Guide" button in the toolbar triggers AI generation.

### User Flow

1. Admin starts new ingestion → picks "Plate Spec"
2. Builds plate spec via chat/file/image/manual (components, assembly procedure, allergens, etc.)
3. Preview shows live plate spec on right panel
4. When satisfied, clicks **"Generate Dish Guide"** button in toolbar
5. AI reads the plate spec + linked prep_recipes (resolved server-side) → produces a complete dish guide
6. Preview switches to **dual mode**: "Plate Spec" tab + "Dish Guide" tab (both with EN/ES toggle)
7. Admin can edit the dish guide fields inline before publishing
8. **Publish** saves plate_spec AND foh_plate_spec atomically in one flow

---

## Architecture Decision: Nested Draft (NOT Envelope)

> **Audit finding**: A `{ plateSpec, dishGuide }` envelope breaks `saveDraft()` type signatures, `loadSession()` deserialization (`draftData.name` check), `handleSaveDraft` call sites, edge function pipeline, and optimistic concurrency — at every layer.

**Solution**: Nest the dish guide **inside** `PlateSpecDraft` as a `dishGuide: FohPlateSpecDraft | null` field.

- `state.draft` is always a flat `PlateSpecDraft` (same pattern as other product types)
- `PlateSpecDraft.name` exists at top level → `draftData.name` check works
- `saveDraft(state.draft, version)` works unchanged — no envelope wrapping
- `SET_DRAFT` replaces the entire draft including nested dish guide
- Single `draftVersion` governs one object — no concurrency split
- `isDirty` triggers normally through `updatePlateSpecDraft` helper
- No new DB column needed — `draft_data` JSONB stores the whole `PlateSpecDraft`

---

## Step 0: Database Prep Migration

**New file:** `supabase/migrations/YYYYMMDDHHMMSS_plate_spec_fk_improvements.sql`

> **Audit finding**: Missing index on `foh_plate_specs.plate_spec_id`, no uniqueness constraint, no ON DELETE behavior.

```sql
-- 1. B-tree index for FK lookups (edit flow, cascade checks)
CREATE INDEX IF NOT EXISTS idx_foh_plate_specs_plate_spec_id
  ON public.foh_plate_specs(plate_spec_id)
  WHERE plate_spec_id IS NOT NULL;

-- 2. Partial unique index: enforce 1:1 relationship (one dish guide per plate spec)
CREATE UNIQUE INDEX IF NOT EXISTS uq_foh_plate_specs_plate_spec_id
  ON public.foh_plate_specs(plate_spec_id)
  WHERE plate_spec_id IS NOT NULL;

-- 3. Set ON DELETE SET NULL (orphan dish guide if plate spec deleted)
ALTER TABLE public.foh_plate_specs
  DROP CONSTRAINT IF EXISTS foh_plate_specs_plate_spec_id_fkey,
  ADD CONSTRAINT foh_plate_specs_plate_spec_id_fkey
    FOREIGN KEY (plate_spec_id) REFERENCES public.plate_specs(id) ON DELETE SET NULL;
```

---

## Step 1: Types Layer

**File:** `src/types/ingestion.ts`

### 1a. Enable plate_spec in PRODUCT_TYPES (do this FIRST for testability)

```typescript
{ key: 'plate_spec', label: 'Plate Spec', enabled: true },
// foh_plate_spec stays disabled — auto-generated from plate spec, not directly creatable
{ key: 'foh_plate_spec', label: 'Dish Guide', enabled: false },
```

### 1b. Add PlateSpecDraft interface (with nested dish guide)

```typescript
export interface PlateSpecDraft {
  name: string;
  slug: string;
  plateType: string;                          // entree, appetizer, side, dessert
  menuCategory: string;                       // steaks, seafood, salads, etc.
  tags: string[];
  allergens: string[];
  components: PlateComponentGroup[];          // from products.ts
  assemblyProcedure: RecipeProcedureGroup[];  // from products.ts
  notes: string;
  images: RecipeImage[];
  dishGuide: FohPlateSpecDraft | null;        // nested dish guide — NOT a separate state field
}
```

### 1c. Add FohPlateSpecDraft interface

```typescript
export interface FohPlateSpecDraft {
  menuName: string;
  slug: string;
  plateType: string;
  plateSpecId: string | null;     // FK, set at publish time
  shortDescription: string;
  detailedDescription: string;
  ingredients: string[];
  keyIngredients: string[];
  flavorProfile: string[];
  allergens: string[];
  allergyNotes: string;
  upsellNotes: string;
  notes: string;
  image: string | null;
  isTopSeller: boolean;
}
```

### 1d. Add empty draft creators

```typescript
export function createEmptyFohPlateSpecDraft(): FohPlateSpecDraft {
  return {
    menuName: '', slug: '', plateType: '', plateSpecId: null,
    shortDescription: '', detailedDescription: '',
    ingredients: [], keyIngredients: [], flavorProfile: [],
    allergens: [], allergyNotes: '', upsellNotes: '',
    notes: '', image: null, isTopSeller: false,
  };
}

export function createEmptyPlateSpecDraft(): PlateSpecDraft {
  return {
    name: '', slug: '', plateType: '', menuCategory: '',
    tags: [], allergens: [],
    components: [], assemblyProcedure: [],
    notes: '', images: [],
    dishGuide: null,   // no dish guide until generated
  };
}
```

### 1e. Add type guards

```typescript
export function isPlateSpecDraft(d: unknown): d is PlateSpecDraft {
  return d !== null && typeof d === 'object'
    && 'components' in d && 'assemblyProcedure' in d && 'menuCategory' in d;
}

export function isFohPlateSpecDraft(d: unknown): d is FohPlateSpecDraft {
  return d !== null && typeof d === 'object'
    && 'menuName' in d && 'shortDescription' in d && 'plateSpecId' in d;
}
```

> **Audit fix**: Added `menuCategory` check to `isPlateSpecDraft` to prevent collision with any future type that might have `components` + `assemblyProcedure`.

### 1f. Update union types

Add `PlateSpecDraft` to ALL draft union types:
- `IngestState.draft` union
- `saveDraft()` parameter type in `UseIngestionSessionReturn`
- `IngestionSession.draftData` type
- `ChatMessage.draftPreview` type
- `reuseSessionForEdit()` parameter type

---

## Step 2: Context Layer — IngestDraftContext

**File:** `src/contexts/IngestDraftContext.tsx`

### 2a. Expand IngestState draft union

```typescript
draft: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft;
```

No `dishGuideDraft` or `hasDishGuide` fields needed — they live inside `PlateSpecDraft.dishGuide`.

### 2b. Add plate spec actions

```typescript
// Plate Spec metadata
| { type: 'SET_PLATE_TYPE'; payload: string }
| { type: 'SET_MENU_CATEGORY'; payload: string }
| { type: 'SET_PLATE_ALLERGENS'; payload: string[] }
| { type: 'SET_PLATE_TAGS'; payload: string[] }
| { type: 'SET_PLATE_NOTES'; payload: string }

// Component groups (NEW dedicated actions — do NOT reuse prep recipe procedure actions)
| { type: 'ADD_COMPONENT_GROUP'; payload: PlateComponentGroup }
| { type: 'UPDATE_COMPONENT_GROUP'; payload: { index: number; group: PlateComponentGroup } }
| { type: 'REMOVE_COMPONENT_GROUP'; payload: number }
| { type: 'REORDER_COMPONENT_GROUPS'; payload: PlateComponentGroup[] }

// Assembly procedure (NEW dedicated actions — cannot reuse ADD_PROCEDURE_GROUP etc.
// because those cast to PrepRecipeDraft and access .procedure, not .assemblyProcedure)
| { type: 'ADD_ASSEMBLY_GROUP'; payload: RecipeProcedureGroup }
| { type: 'UPDATE_ASSEMBLY_GROUP'; payload: { index: number; group: RecipeProcedureGroup } }
| { type: 'REMOVE_ASSEMBLY_GROUP'; payload: number }
| { type: 'REORDER_ASSEMBLY_GROUPS'; payload: RecipeProcedureGroup[] }

// Dish guide (nested inside PlateSpecDraft)
| { type: 'SET_DISH_GUIDE'; payload: FohPlateSpecDraft }
| { type: 'UPDATE_DISH_GUIDE_FIELD'; payload: { field: keyof FohPlateSpecDraft; value: FohPlateSpecDraft[keyof FohPlateSpecDraft] } }
| { type: 'CLEAR_DISH_GUIDE' }
```

> **Audit fix**: Assembly procedure actions are NEW and dedicated (`ADD_ASSEMBLY_GROUP` etc.), NOT reused from `ADD_PROCEDURE_GROUP` which casts to `PrepRecipeDraft` and accesses `.procedure`.

> **Audit fix**: `UPDATE_DISH_GUIDE_FIELD` uses `FohPlateSpecDraft[keyof FohPlateSpecDraft]` instead of `unknown` for type safety.

### 2c. Add `updatePlateSpecDraft` helper + reducer cases

```typescript
function updatePlateSpecDraft(
  state: IngestState,
  updater: (d: PlateSpecDraft) => Partial<PlateSpecDraft>
): IngestState {
  const d = state.draft as PlateSpecDraft;
  return { ...state, draft: { ...d, ...updater(d) }, isDirty: true };
}
```

Reducer cases:
- `RESET_DRAFT` → `createEmptyPlateSpecDraft()` when `activeType === 'plate_spec'` (dish guide cleared automatically since it's nested)
- `SET_NAME` → add `isPlateSpecDraft` branch BEFORE the fallthrough to wine (prevents corrupt casting)
- `SET_PLATE_TYPE`, `SET_MENU_CATEGORY`, etc. → use `updatePlateSpecDraft`
- Component group CRUD → update `d.components` via `updatePlateSpecDraft`
- Assembly group CRUD → update `d.assemblyProcedure` via `updatePlateSpecDraft`
- `SET_DISH_GUIDE` → `updatePlateSpecDraft(state, () => ({ dishGuide: action.payload }))`
- `UPDATE_DISH_GUIDE_FIELD` → spread into nested `dishGuide` object
- `CLEAR_DISH_GUIDE` → `updatePlateSpecDraft(state, () => ({ dishGuide: null }))`

> **Audit fix**: All dish guide mutations go through `updatePlateSpecDraft`, which sets `isDirty: true`.

> **Audit fix**: `RESET_DRAFT` always clears dish guide because it's nested inside `createEmptyPlateSpecDraft()`.

> **Audit fix**: `SET_NAME` type guard chain updated — add `isPlateSpecDraft` check before wine fallthrough.

### 2d. Stale dish guide detection

When `SET_DRAFT` fires (from AI chat extraction replacing the plate spec), check if the existing draft had a dish guide. If so, mark it stale by adding a `dishGuideStale: boolean` field to `PlateSpecDraft`:

```typescript
// In SET_DRAFT reducer case, when activeType === 'plate_spec':
const oldDraft = state.draft as PlateSpecDraft;
const newDraft = action.payload as PlateSpecDraft;
if (oldDraft.dishGuide && !newDraft.dishGuide) {
  // AI returned plate spec without dish guide — preserve but mark stale
  newDraft.dishGuide = oldDraft.dishGuide;
  newDraft.dishGuideStale = true;
}
```

The "Generate Dish Guide" button shows "Regenerate" when `dishGuideStale === true`.

---

## Step 3: Mapping Constants + hasDraft + buildDraftFromProduct

**File:** `src/pages/IngestPage.tsx`

### 3a. Add entries to all 5 maps

```typescript
// ACTIVE_TYPE_TABLE
plate_spec: 'plate_specs',

// ACTIVE_TYPE_CACHE_KEY
plate_spec: 'plate_specs',

// ACTIVE_TYPE_LABEL
plate_spec: 'Plate Spec',

// TABLE_TO_ACTIVE_TYPE
plate_specs: 'plate_spec',

// TABLE_NAVIGATE
plate_specs: '/recipes',
```

### 3b. Fix `hasDraft` check

> **Audit fix**: Add plate spec branch to prevent falling through to prep recipe cast.

```typescript
const isPlateSpecType = state.activeType === 'plate_spec';
// ...in hasDraft:
isPlateSpecType
  ? (state.draft as PlateSpecDraft).name !== '' || (state.draft as PlateSpecDraft).components.length > 0
  : // ...existing checks
```

### 3c. Add `buildDraftFromProduct` branch for plate_specs

> **Audit fix**: Without this, editing an existing plate spec loads an empty draft.

```typescript
case 'plate_specs': {
  const row = data as PlateSpec;
  return {
    name: row.name,
    slug: row.slug,
    plateType: row.plateType,
    menuCategory: row.menuCategory,
    tags: row.tags ?? [],
    allergens: row.allergens ?? [],
    components: row.components ?? [],
    assemblyProcedure: row.assemblyProcedure ?? [],
    notes: row.notes ?? '',
    images: row.images ?? [],
    dishGuide: null,         // loaded separately from foh_plate_specs
    dishGuideStale: false,
  } as PlateSpecDraft;
}
```

### 3d. Load linked dish guide in edit mode

In the edit-mode `useEffect`, after loading the plate spec draft, query for a linked `foh_plate_specs` row:

```typescript
if (table === 'plate_specs' && productId) {
  const { data: dishGuideRow } = await supabase
    .from('foh_plate_specs')
    .select('*')
    .eq('plate_spec_id', productId)
    .maybeSingle();

  if (dishGuideRow) {
    const dg = mapFohRowToFohPlateSpecDraft(dishGuideRow);
    dispatch({ type: 'SET_DISH_GUIDE', payload: dg });
  }
}
```

### 3e. Add `previewComponent` branch for plate spec

```typescript
isPlateSpecType ? (
  <PlateSpecDualPreview
    draft={state.draft as PlateSpecDraft}
    onSwitchToEdit={onSwitchToEdit}
    productId={state.editingProductId}
  />
) : // ...existing branches
```

### 3f. Add `DraftPreviewCard` branch for plate spec

> **Audit fix**: Without this, plate spec chat previews fall through to WinePreviewCard.

Add `isPlateSpecDraft` check in `DraftPreviewCard` to render plate spec fields.

---

## Step 4: Edge Function — Add Plate Spec Support

**File:** `supabase/functions/ingest/index.ts`

### 4a. Add Deno-side types

```typescript
interface PlateComponentItem {
  type: "raw" | "prep_recipe";
  name: string;
  quantity: number;
  unit: string;
  order: number;
  allergens?: string[];
  prep_recipe_ref?: string;
}

interface PlateComponentGroup {
  group_name: string;
  order: number;
  items: PlateComponentItem[];
}

interface PlateSpecDraft {
  name: string;
  slug: string;
  plateType: string;
  menuCategory: string;
  tags: string[];
  allergens: string[];
  components: PlateComponentGroup[];
  assemblyProcedure: ProcedureGroup[];  // reuse existing ProcedureGroup
  notes: string;
  images: RecipeImage[];
  confidence?: number;
  missingFields?: string[];
  aiMessage?: string;
}
```

> **Audit fix**: Added `confidence`, `missingFields`, `aiMessage` to match extraction pipeline expectations.

### 4b. Update `ProductDraft` union type

```typescript
type ProductDraft = PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft;
```

### 4c. Add PROMPT_SLUG_MAP entry

```typescript
plate_specs: { chat: "ingest-chat-plate-spec", extract: "ingest-extract-plate-spec" },
```

### 4d. Add extraction schema in `buildExtractResponseSchema()`

New `plate_specs` branch with full JSON schema:

```typescript
case "plate_specs":
  return {
    type: "object",
    properties: {
      name: { type: "string" },
      plateType: { type: "string", enum: ["entree", "appetizer", "side", "dessert"] },
      menuCategory: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      allergens: { type: "array", items: { type: "string" } },
      components: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_name: { type: "string" },
            order: { type: "integer" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["raw", "prep_recipe"] },
                  name: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                  order: { type: "integer" },
                  allergens: { type: "array", items: { type: "string" } },
                  prep_recipe_ref: { type: "string" },
                },
                required: ["type", "name", "quantity", "unit", "order"],
              },
            },
          },
          required: ["group_name", "order", "items"],
        },
      },
      assemblyProcedure: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_name: { type: "string" },
            order: { type: "integer" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step_number: { type: "integer" },
                  instruction: { type: "string" },
                  critical: { type: "boolean" },
                },
                required: ["step_number", "instruction", "critical"],
              },
            },
          },
          required: ["group_name", "order", "steps"],
        },
      },
      notes: { type: "string" },
      confidence: { type: "number" },
      missingFields: { type: "array", items: { type: "string" } },
      aiMessage: { type: "string" },
    },
    required: ["name", "plateType", "menuCategory", "components", "assemblyProcedure", "confidence", "missingFields", "aiMessage"],
  };
```

### 4e. Add `generate-dish-guide` mode

> **Audit fix**: Needs a new dispatcher branch in the main handler, NOT falling through to `handlePipeline`.

Add to main Deno.serve handler:

```typescript
if (body.mode === 'generate-dish-guide') {
  return handleGenerateDishGuide(req, body, supabaseClient);
}
```

**New `handleGenerateDishGuide` function:**

1. Auth check (same pattern as pipeline)
2. Parse `body.plateSpec` (PlateSpecDraft) and `body.sessionId`
3. **Resolve linked prep_recipes server-side** — extract `prep_recipe_ref` slugs from components, query `prep_recipes` table for full data
4. Build AI prompt context: plate spec + linked recipes + Alamo Prime context
5. Call OpenAI with structured output for the 5 AI-generated fields
6. Compute auto-fill fields server-side:
   - `menuName` ← `plateSpec.name`
   - `plateType` ← `plateSpec.plateType`
   - `allergens` ← union of all component allergens + plate spec allergens (deduplicated)
   - `ingredients` ← all component item names
   - `keyIngredients` ← first item from each component group (most prominent per station)
   - `image` ← first plate spec image URL (if any)
7. Merge auto-fill + AI output into `FohPlateSpecDraft`
8. Return `{ dishGuide: FohPlateSpecDraft }`

**Request/Response types:**

```typescript
// Separate from IngestRequest — discriminated union on mode
interface GenerateDishGuideRequest {
  mode: 'generate-dish-guide';
  sessionId: string;           // for audit trail
  plateSpec: PlateSpecDraft;
}

// Response:
{ dishGuide: FohPlateSpecDraft }
```

**Model:** Use same model as existing extract pipeline (currently gpt-5-mini) for consistency.

**Structured output schema:**

```typescript
{
  shortDescription: { type: "string" },
  detailedDescription: { type: "string" },
  flavorProfile: { type: "array", items: { type: "string" } },
  allergyNotes: { type: "string" },
  upsellNotes: { type: "string" },
}
```

---

## Step 5: AI Prompts Migration

**New file:** `supabase/migrations/YYYYMMDDHHMMSS_ingest_plate_spec_prompts.sql`

> **Audit fix**: Use `domain = NULL` (not `'plate_specs'`) to avoid `ai_prompts_domain_check` constraint violation. Follow existing pattern: `category = 'system'`.

### 5a. Chat prompt: `ingest-chat-plate-spec`

System prompt for conversational plate spec building:
- Schema awareness: components (grouped items with `type: "raw" | "prep_recipe"`, prep_recipe_ref links), assembly_procedure (grouped steps with critical flags)
- Alamo Prime menu categories (steaks, seafood, salads, sides, desserts, appetizers)
- Can search existing prep_recipes via `search_recipes` tool to find linkable sub-recipes
- Plate type categories (entree, appetizer, side, dessert)
- Guides user through: name → plate type/category → components → assembly → allergens → notes

### 5b. Extract prompt: `ingest-extract-plate-spec`

Structured extraction prompt. Takes chat history → outputs PlateSpecDraft JSON:
- Group components logically (Grill, Plate, Garnish, Sauce, etc.)
- Identify prep_recipe_ref links when names match existing recipes
- Extract allergens from ingredient descriptions
- Mark critical steps (temperature/timing-sensitive) in assembly
- Auto-assign plate type and menu category from context

### 5c. Dish guide generation prompt: `generate-dish-guide`

System prompt for auto-generating FOH dish guide from plate spec:
- Restaurant context: Alamo Prime, upscale steakhouse
- Input: full plate spec (name, components, assembly, allergens) + linked prep recipe details
- Output: shortDescription (1-2 sentences, appetizing menu copy), detailedDescription (3-4 sentences, server training), flavorProfile[] (3-6 descriptors), allergyNotes (server allergy guidance), upsellNotes (selling points + pairing suggestions)
- Tone: professional, warm, appetizing
- Must accurately reflect all allergens from the plate spec

---

## Step 6: Editor Components

### 6a. PlateSpecEditor (main editor)

**New file:** `src/components/ingest/editor/PlateSpecEditor.tsx`

| Section | Component | Fields |
|---------|-----------|--------|
| Metadata | Inline fields | name, plateType (select), menuCategory (select), tags (chips), allergens (chips) |
| Components | `PlateComponentEditor` | Grouped component items with DnD |
| Assembly | `AssemblyProcedureEditor` | Grouped assembly steps with DnD (NEW, not reused ProcedureEditor) |
| Notes | Textarea | Free-form notes |
| Images | `ImageGalleryEditor` (reuse existing) | Upload/manage images |

> **Audit fix**: Assembly uses a NEW `AssemblyProcedureEditor` component that dispatches `ADD_ASSEMBLY_GROUP` etc., NOT the existing `ProcedureEditor` which dispatches `ADD_PROCEDURE_GROUP`.

### 6b. PlateComponentEditor

**New file:** `src/components/ingest/editor/PlateComponentEditor.tsx`

- **Groups**: Named groups (Grill, Plate, Garnish, etc.) with drag-to-reorder
- **Items per group**: Each item has:
  - `type`: select — `"raw"` or `"prep_recipe"` (enum enforced)
  - `name`: text input (auto-complete when type=prep_recipe)
  - `quantity`: number input
  - `unit`: select (oz, pc, ptn, sprig, etc.)
  - `prep_recipe_ref`: auto-set slug when linked to prep_recipe
  - `allergens`: chip input (only for raw items)
- **Add Group** / **Add Item** buttons
- DnD: reorder groups, reorder items within groups, drag items between groups

### 6c. AssemblyProcedureEditor

**New file:** `src/components/ingest/editor/AssemblyProcedureEditor.tsx`

Similar structure to existing `ProcedureEditor` but dispatches `ADD_ASSEMBLY_GROUP`, `UPDATE_ASSEMBLY_GROUP`, etc. Each step has:
- `step_number`: auto-numbered
- `instruction`: text input
- `critical`: boolean toggle (highlighted in orange when true)

### 6d. DishGuideEditor

**New file:** `src/components/ingest/editor/DishGuideEditor.tsx`

> **Audit fix**: The original plan had NO dish guide editor — the user could only view the generated dish guide but not edit fields. This is a UX gap since the plan says "Admin can edit either draft before publishing."

Inline editor for dish guide fields:
- `menuName`: text input
- `shortDescription`: textarea (2 rows)
- `detailedDescription`: textarea (4 rows)
- `keyIngredients`: chip editor
- `flavorProfile`: chip editor
- `allergens`: chip editor
- `allergyNotes`: textarea
- `upsellNotes`: textarea
- `isTopSeller`: toggle
- `image`: image picker (reuse existing pattern)
- `notes`: textarea

All fields dispatch `UPDATE_DISH_GUIDE_FIELD` actions.

### 6e. Prep recipe search for component linking

When user selects `type: "prep_recipe"` on a component item:
- Debounced search of `prep_recipes` by name (client-side query, RLS allows SELECT for authenticated users)
- Show dropdown with matching recipes
- On select: auto-fill `name` + set `prep_recipe_ref` to recipe slug
- Visual badge showing "Linked" with recipe icon

---

## Step 7: Preview Components

### 7a. PlateSpecIngestPreview

**New file:** `src/components/ingest/PlateSpecIngestPreview.tsx`

Mirrors `RecipeCardView` layout:
- **Header**: Name, plate type badge, menu category, allergen pills
- **Components section**: Grouped cards with ingredient items
  - Raw items: quantity + unit + name
  - Prep recipe items: name with link badge
- **Assembly section**: Grouped procedure steps with critical flags highlighted in orange
- **Notes section**
- **Images**: Gallery with lightbox
- **EN/ES toggle**: When `productId` exists (edit mode), show language toggle using `useProductTranslations`

### 7b. DishGuideIngestPreview

**New file:** `src/components/ingest/DishGuideIngestPreview.tsx`

Mirrors `DishCardView` layout:
- **Header**: Menu name, plate type badge, top seller badge
- **Allergen pills**
- **Short description**
- **Info grid** (2x2):
  - Key Ingredients (chip list)
  - Flavor Profile (chip list)
  - Allergy Notes
  - Upsell Notes
- **Detailed description**
- **Notes**
- **Image**
- **EN/ES toggle**: When linked product exists (edit mode)

### 7c. PlateSpecDualPreview (tabbed container)

**New file:** `src/components/ingest/PlateSpecDualPreview.tsx`

- **Tabs**: "Plate Spec" | "Dish Guide"
- Tab badges: checkmark when content exists, dimmed when not yet generated
- "Dish Guide" tab disabled until `draft.dishGuide !== null`
- Each tab renders its respective preview component
- Both tabs independently have EN/ES toggle (per-tab state)
- On mobile: same tabs within the Preview panel (nested under existing mobile mode tabs)

---

## Step 8: "Generate Dish Guide" Button + AI Generation

### 8a. Toolbar button

**File:** `src/pages/IngestPage.tsx`

Show when `activeType === 'plate_spec'`:

| State | Button Label | Icon | Action |
|-------|-------------|------|--------|
| No dish guide, min fields met | "Generate Dish Guide" | `Sparkles` | Generate |
| Dish guide exists, not stale | "Regenerate Dish Guide" | `Sparkles` | Regenerate (with confirm) |
| Dish guide exists, stale | "Regenerate Dish Guide" (warning badge) | `Sparkles` | Regenerate |
| Min fields NOT met | Button disabled | — | — |
| Generating | "Generating..." | Spinner | Disabled |

**Min fields**: `name` non-empty AND at least 1 component group with at least 1 item.

**Disable Save Draft while generating**: Prevents saving before dish guide is set.

### 8b. useGenerateDishGuide hook

**New file:** `src/hooks/use-generate-dish-guide.ts`

```typescript
export function useGenerateDishGuide() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (
    draft: PlateSpecDraft,
    sessionId: string | null,
  ): Promise<FohPlateSpecDraft | null> => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'generate-dish-guide',
          sessionId,
          plateSpec: draft,
        }),
      });
      const { dishGuide } = await response.json();
      return dishGuide;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating };
}
```

**In IngestPage.tsx**, on successful generation:

```typescript
const dishGuide = await generate(state.draft as PlateSpecDraft, state.sessionId);
if (dishGuide) {
  dispatch({ type: 'SET_DISH_GUIDE', payload: dishGuide });
  // Auto-save immediately after generation to persist
  await handleSaveDraft();
}
```

> **Audit fix**: Auto-save after generation prevents loss if user navigates away.

---

## Step 9: Publish Flow (Atomic)

**File:** `src/pages/IngestPage.tsx`

> **Audit fix**: Publish plate spec + dish guide in ONE flow, not two separate button clicks. This prevents orphaned states.

### 9a. Plate spec validation

Required:
- `name` (non-empty)
- `plateType` (non-empty)
- `menuCategory` (non-empty)
- `components` (>= 1 group with >= 1 item)
- `assemblyProcedure` (>= 1 group with >= 1 step)

### 9b. Dish guide validation (if exists)

If `draft.dishGuide !== null`, also validate:
- `menuName` (non-empty)
- `shortDescription` (non-empty)
- `detailedDescription` (non-empty)

### 9c. Combined publish handler: `handlePublishPlateSpec`

1. Validate plate spec fields
2. If dish guide exists, validate dish guide fields
3. Show image warning if no images
4. Auto-generate plate spec slug (check uniqueness)
5. Build plate spec DB row (camelCase → snake_case mapping):
   - Set `created_by` from auth user
   - Set `source_session_id` from session
   - Set `ai_ingestion_meta` with `source_type: 'ingestion'`
6. **INSERT plate_spec** (or UPDATE if editing)
7. Get the published plate spec ID
8. If dish guide exists:
   - Auto-generate dish guide slug
   - Set `plate_spec_id` to published plate spec ID
   - Set `created_by`, `source_session_id`, `ai_ingestion_meta`
   - **INSERT foh_plate_spec** (or UPDATE if editing and linked dish guide exists)
   - If dish guide INSERT fails → show error but plate spec is already saved. Toast: "Plate spec saved but dish guide failed — you can retry from the edit screen."
9. Update `ingestion_sessions.product_id` + status = 'published'
10. Fire embedding for plate_spec: `{ table: 'plate_specs', rowId: plateSpecId }`
11. If dish guide published: fire embedding for foh_plate_spec: `{ table: 'foh_plate_specs', rowId: dishGuideId }`
12. Invalidate cache keys: `plate_specs`, `dishes` (if dish guide)
13. Navigate to `/recipes`

> **Audit fix**: `created_by`, `source_session_id`, and `ai_ingestion_meta` explicitly set (not relying on defaults). Embedding calls specify explicit `table` + `rowId` params.

### 9d. Edit publish flow

- Plate spec: UPDATE instead of INSERT
- Dish guide: UPDATE if existing (matched by `plate_spec_id`), INSERT if new
- Both re-embedded after save

---

## Step 10: Mobile UX

> **Audit fix**: Mobile tab layout addressed. The existing 3-tab mobile layout (Chat | Preview | Edit) is preserved. The "Preview" tab renders `PlateSpecDualPreview` which has its own nested "Plate Spec" / "Dish Guide" tabs. The "Edit" tab renders `PlateSpecEditor` for the plate spec, with a "Dish Guide" section below (using `DishGuideEditor`) when `dishGuide !== null`.

No new `MobileMode` enum values needed — the existing layout accommodates both.

---

## Step 11: Edit Existing Plate Spec

### 11a. Edit button already exists on RecipeCardView

For plate specs (`recipe.type === 'plate'`), routes to `/admin/ingest/edit/plate_specs/{id}`.

### 11b. Pre-fill flow (in `buildDraftFromProduct` + edit-mode useEffect)

1. Fetch plate spec row → map to PlateSpecDraft (Step 3c)
2. Query `foh_plate_specs` for linked row: `.eq('plate_spec_id', productId).maybeSingle()`
3. If found → map to FohPlateSpecDraft, dispatch `SET_DISH_GUIDE`
4. Load into context

### 11c. Delete handling

> **Audit fix**: When deleting a plate spec, the FK is now `ON DELETE SET NULL` (from Step 0 migration). The linked dish guide will be orphaned (plate_spec_id set to NULL), not deleted. The delete handler should warn: "This plate spec has a linked dish guide. The dish guide will be unlinked but not deleted."

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/..._plate_spec_fk_improvements.sql` | NEW | FK index + unique + ON DELETE SET NULL |
| `supabase/migrations/..._ingest_plate_spec_prompts.sql` | NEW | 3 AI prompts (chat, extract, generate-dish-guide) |
| `src/types/ingestion.ts` | MODIFY | PlateSpecDraft (with nested dishGuide), FohPlateSpecDraft, type guards, empty creators, enable plate_spec, update all union types |
| `src/contexts/IngestDraftContext.tsx` | MODIFY | Plate spec + assembly + dish guide actions, reducer cases, updatePlateSpecDraft helper, SET_NAME fix |
| `src/pages/IngestPage.tsx` | MODIFY | Mapping constants, hasDraft, buildDraftFromProduct, preview selection, publish handler, toolbar buttons, edit flow |
| `src/hooks/use-generate-dish-guide.ts` | NEW | Hook for AI dish guide generation |
| `src/components/ingest/editor/PlateSpecEditor.tsx` | NEW | Master plate spec editor |
| `src/components/ingest/editor/PlateComponentEditor.tsx` | NEW | Component groups editor with DnD + prep recipe linking |
| `src/components/ingest/editor/AssemblyProcedureEditor.tsx` | NEW | Assembly procedure editor (dedicated, not reused) |
| `src/components/ingest/editor/DishGuideEditor.tsx` | NEW | Inline dish guide field editor |
| `src/components/ingest/PlateSpecIngestPreview.tsx` | NEW | Plate spec preview with EN/ES toggle |
| `src/components/ingest/DishGuideIngestPreview.tsx` | NEW | Dish guide preview with EN/ES toggle |
| `src/components/ingest/PlateSpecDualPreview.tsx` | NEW | Tabbed dual preview container |
| `src/components/ingest/DraftPreviewCard.tsx` | MODIFY | Add plate spec branch |
| `supabase/functions/ingest/index.ts` | MODIFY | PlateSpec types, ProductDraft union, PROMPT_SLUG_MAP, extraction schema, generate-dish-guide handler, dispatcher branch |

### New files: 9
### Modified files: 6
### New migrations: 2

---

## Implementation Order

1. **DB migration** — FK index + unique + ON DELETE SET NULL
2. **Types** — PlateSpecDraft (with nested dishGuide), FohPlateSpecDraft, guards, creators, unions (enable plate_spec here)
3. **Context** — Actions, reducer, updatePlateSpecDraft, SET_NAME fix, stale detection
4. **Mapping constants** — All 5 maps + hasDraft + buildDraftFromProduct + preview selection
5. **AI Prompts migration** — 3 prompts (chat, extract, generate-dish-guide)
6. **Edge function** — Types, ProductDraft union, PROMPT_SLUG_MAP, extraction schema, generate-dish-guide handler + dispatcher
7. **PlateComponentEditor** — Component groups DnD editor
8. **AssemblyProcedureEditor** — Assembly steps DnD editor
9. **PlateSpecEditor** — Master editor wiring
10. **DishGuideEditor** — Inline dish guide editor
11. **PlateSpecIngestPreview** — Plate spec preview
12. **DishGuideIngestPreview** — Dish guide preview
13. **PlateSpecDualPreview** — Tabbed container
14. **DraftPreviewCard** — Add plate spec branch
15. **useGenerateDishGuide hook** — AI generation + auto-save after
16. **Toolbar buttons** — Generate/Regenerate Dish Guide
17. **Publish flow** — Atomic plate spec + dish guide publish
18. **Edit flow** — Load linked dish guide, delete warning
19. **TypeScript check** — `npx tsc --noEmit` → 0 errors

---

## Verification Checklist

- [ ] Create new plate spec via chat → AI builds components + assembly procedure
- [ ] Editor shows component groups with prep recipe linking
- [ ] Assembly editor with critical step toggles
- [ ] Preview displays plate spec correctly
- [ ] "Generate Dish Guide" button appears after min fields filled
- [ ] AI generates accurate dish guide from plate spec data
- [ ] Linked prep_recipes resolved server-side for context
- [ ] Dual preview shows both tabs with independent EN/ES toggles
- [ ] "Dish Guide" tab disabled until generated
- [ ] Dish guide editor allows field editing
- [ ] Save draft persists plate spec + nested dish guide
- [ ] Resume draft loads both correctly (draftData.name check works)
- [ ] isDirty triggers on dish guide edits
- [ ] "Regenerate" shows when plate spec changed after dish guide generation
- [ ] Publish saves BOTH plate_spec and foh_plate_spec atomically
- [ ] created_by, source_session_id, ai_ingestion_meta set correctly
- [ ] Embeddings generated for both (explicit table + rowId params)
- [ ] Edit existing plate spec → loads plate spec + linked dish guide
- [ ] Delete plate spec → warning about linked dish guide, FK SET NULL
- [ ] foh_plate_specs.plate_spec_id has index + unique constraint
- [ ] Mobile: nested tabs work within Preview panel
- [ ] DraftPreviewCard renders plate spec fields in chat
- [ ] TypeScript: 0 errors
