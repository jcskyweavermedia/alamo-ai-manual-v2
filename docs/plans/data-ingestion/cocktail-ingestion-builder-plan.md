# Plan: Cocktail Builder — Full Ingest Support for Cocktails Table

## Context

Prep recipes and wines are fully supported in the ingest system. Cocktails are the next product type to enable. Unlike wines (flat scalar fields, web enrichment) and prep recipes (deeply nested ingredient/procedure groups), cocktails sit in the middle: **flat ingredients as a text string, a simple procedure array, and a handful of classification fields**.

The user specified: the AI model should help build cocktail recipes **from scratch using its own knowledge** — no web search needed. This makes the cocktail builder closer to the prep recipe flow (operator gives info, AI structures it) with the added benefit that the model is deeply knowledgeable about classic and modern cocktail recipes and can suggest full specs from just a name.

**Existing cocktails table columns**: `name, slug, style, glass, ingredients, key_ingredients, procedure (JSONB), tasting_notes, description, notes, image, is_top_seller, status, version, embedding, search_vector, ai_ingestion_meta, created_by`

No schema migration needed — editor uses existing columns only.

---

## Key Differences from Wine & Prep Recipe

| Aspect | Prep Recipe | Wine | Cocktail |
|--------|-------------|------|----------|
| **Ingredients** | Nested groups → items (JSONB) | None | Plain text string |
| **Procedure** | Grouped steps with `critical` flag | None | Flat array `[{step, instruction}]` |
| **Classification** | prepType (sauce/marinade/...) | style + body + region + country | style + glass |
| **Unique fields** | yield, shelf life, batch scaling, training notes, tags, allergens | vintage, varietal, blend, producer, producerNotes | key_ingredients, description |
| **Image** | `images[]` (array) | `image` (string) | `image` (string) |
| **Web enrichment** | No | Yes | **No** (model knows recipes) |
| **AI knowledge** | Needs operator details | Needs operator + web | **Model can suggest full specs** |

---

## Phase A: Types, Context & Draft State

### A1. Add `CocktailDraft` type

**File**: `src/types/ingestion.ts`

```typescript
import type { CocktailStyle, CocktailProcedureStep } from './products';

export interface CocktailDraft {
  name: string;
  slug: string;
  style: CocktailStyle;            // 'classic' | 'modern' | 'tiki' | 'refresher'
  glass: string;                    // free text: "Rocks", "Coupe", "Highball", "Nick & Nora", etc.
  ingredients: string;              // full ingredient list as plain text (DB: text)
  keyIngredients: string;           // summary of primary spirits/mixers (DB: key_ingredients)
  procedure: CocktailProcedureStep[]; // [{step: 1, instruction: "..."}, ...]
  tastingNotes: string;
  description: string;              // cocktail story/description
  notes: string;                    // service/prep notes
  image: string | null;             // single URL
  isTopSeller: boolean;
}
```

Add `createEmptyCocktailDraft()` factory:
```typescript
export function createEmptyCocktailDraft(): CocktailDraft {
  return {
    name: '', slug: '', style: 'classic', glass: '',
    ingredients: '', keyIngredients: '',
    procedure: [], tastingNotes: '', description: '',
    notes: '', image: null, isTopSeller: false,
  };
}
```

Update `ChatMessage.draftPreview` type to `PrepRecipeDraft | WineDraft | CocktailDraft | null`.

Enable cocktail: Change `{ key: 'cocktail', label: 'Cocktail', enabled: false }` to `enabled: true` in `PRODUCT_TYPES` array.

### A2. Update IngestDraftContext — cocktail actions

**File**: `src/contexts/IngestDraftContext.tsx`

**State change**: `draft: PrepRecipeDraft | WineDraft` → `draft: PrepRecipeDraft | WineDraft | CocktailDraft`

Add type guard:
```typescript
function isCocktailDraft(draft: PrepRecipeDraft | WineDraft | CocktailDraft): draft is CocktailDraft {
  return 'glass' in draft && 'keyIngredients' in draft;
}
```

Add update helper:
```typescript
function updateCocktailDraft(state: IngestState, update: Partial<CocktailDraft>): IngestState {
  return { ...state, draft: { ...(state.draft as CocktailDraft), ...update }, isDirty: true };
}
```

**New actions** (add to `IngestAction` union):
```
// Cocktail metadata
| { type: 'SET_COCKTAIL_STYLE'; payload: CocktailStyle }
| { type: 'SET_COCKTAIL_GLASS'; payload: string }
| { type: 'SET_COCKTAIL_INGREDIENTS'; payload: string }
| { type: 'SET_COCKTAIL_KEY_INGREDIENTS'; payload: string }
| { type: 'SET_COCKTAIL_PROCEDURE'; payload: CocktailProcedureStep[] }
| { type: 'SET_COCKTAIL_TASTING_NOTES'; payload: string }
| { type: 'SET_COCKTAIL_DESCRIPTION'; payload: string }
| { type: 'SET_COCKTAIL_NOTES'; payload: string }
| { type: 'SET_COCKTAIL_IMAGE'; payload: string | null }
| { type: 'SET_COCKTAIL_TOP_SELLER'; payload: boolean }
```

**Modify existing actions**:
- `SET_NAME`: Already generic (both types have `name` + `slug`). No change needed.
- `SET_DRAFT`: Widen to accept `CocktailDraft`
- `RESET_DRAFT`: Add cocktail branch → `createEmptyCocktailDraft()`
- `SET_ACTIVE_TYPE`: Reset draft when switching to cocktail type

### A3. Enable cocktail in IngestWizard

**File**: `src/pages/IngestWizard.tsx`

Change `{ key: 'cocktail', label: 'Cocktail', icon: ..., enabled: false }` → `enabled: true`

---

## Phase B: Cocktail Editor Component

### B1. Create `CocktailEditor.tsx`

**New file**: `src/components/ingest/editor/CocktailEditor.tsx`

Form using shadcn components (Input, Textarea, Select, Switch, Label). Uses `useIngestDraft()` context.

**Layout**: Single Accordion (type="multiple", all open by default) with these sections:

1. **Cocktail Info** — name (Input), style (Select: classic/modern/tiki/refresher), glass (Input, placeholder "e.g., Rocks, Coupe, Highball")

2. **Ingredients** — ingredients (Textarea, 5 rows, placeholder "List all ingredients with measurements, one per line\ne.g., 2 oz Bourbon\n0.5 oz Demerara syrup\n2 dashes Angostura bitters"), keyIngredients (Input, placeholder "Primary spirits/mixers, e.g., Bourbon, Angostura bitters")

3. **Method** — Procedure step editor:
   - List of steps, each with a step number and instruction text
   - Add step button at bottom
   - Remove step (X) button per row
   - Move up/down buttons per row
   - Auto-renumber steps on reorder/delete
   - Pattern: simpler than PrepRecipeEditor's grouped procedure (no groups, just flat steps)

4. **Tasting & Description** — tastingNotes (Textarea, 3 rows), description (Textarea, 3 rows, placeholder "Cocktail history, story, or context"), notes (Textarea, 3 rows, placeholder "Service notes, garnish details, technique tips...")

5. **Image** — `<CocktailImageEditor />` (see B2). Same pattern as WineImageEditor: single image, not array.

6. **Options** — isTopSeller (Switch with label "Top Seller")

### B2. Create `CocktailImageEditor.tsx`

**New file**: `src/components/ingest/editor/CocktailImageEditor.tsx`

Copy pattern from `WineImageEditor.tsx` — single-image editor:
- Shows current image with loading skeleton
- Upload photo / Take photo / Generate with AI buttons
- Remove button (X) overlaid on image
- Dispatches `SET_COCKTAIL_IMAGE` with URL string or `null`

For AI generation: pass `productTable: 'cocktails'`, `name: draft.name`, `prepType: draft.style`, `description: draft.keyIngredients`.

### B3. Create `CocktailProcedureEditor.tsx`

**New file**: `src/components/ingest/editor/CocktailProcedureEditor.tsx`

Simple flat step list editor (no groups):

```typescript
interface CocktailProcedureEditorProps {
  steps: CocktailProcedureStep[];
  onChange: (steps: CocktailProcedureStep[]) => void;
}
```

- Renders numbered steps in order
- Each step: Input or Textarea for instruction text, move up/down arrows, delete (X)
- "Add Step" button at bottom adds `{ step: N+1, instruction: '' }`
- Auto-renumbers all steps after any add/remove/reorder
- Dispatches `SET_COCKTAIL_PROCEDURE` on every change

---

## Phase C: Cocktail Preview Component

### C1. Create `CocktailIngestPreview.tsx`

**New file**: `src/components/ingest/CocktailIngestPreview.tsx`

Mirrors `CocktailCardView.tsx` layout:

- Title + style badge (`CocktailStyleBadge` from `@/components/cocktails/CocktailStyleBadge`)
- Sub-meta: key ingredients, glass type
- Top seller badge if enabled (`TopSellerBadge` from `@/components/shared/TopSellerBadge`)
- "Edit" button to switch to editor
- Two-column layout (desktop):
  - **Left** (30-35%): Cocktail image with lightbox (portrait `aspect-[3/4]`, `object-cover`, `bg-muted`). Same lightbox pattern as CocktailCardView.
  - **Right** (flex-1): Ingredients (plain text block), Method (numbered steps), Tasting Notes, Description, Notes — each as a titled section.
- Empty state: If `!draft.name` → show GlassWater icon + "No cocktail to preview" message

**Props**: `{ draft: CocktailDraft; onSwitchToEdit: () => void }`

---

## Phase D: Wire into IngestPage

### D1. Update IngestPage to support cocktails

**File**: `src/pages/IngestPage.tsx`

**Extend table mappings** (near top):
```typescript
const ACTIVE_TYPE_TABLE: Record<string, string> = {
  prep_recipe: 'prep_recipes',
  wine: 'wines',
  cocktail: 'cocktails',   // NEW
};

const ACTIVE_TYPE_CACHE_KEY: Record<string, string> = {
  prep_recipe: 'recipes',
  wine: 'wines',
  cocktail: 'cocktails',   // NEW
};

const TABLE_NAVIGATE: Record<string, string> = {
  prep_recipes: '/recipes',
  wines: '/wines',
  cocktails: '/cocktails',  // NEW
};
```

**Editor rendering**: Add cocktail branch:
```tsx
const isCocktailType = state.activeType === 'cocktail';
const editorComponent = isCocktailType
  ? <CocktailEditor />
  : isWineType
    ? <WineEditor />
    : <PrepRecipeEditor />;
```

**Preview rendering**: Add cocktail branch:
```tsx
const previewComponent = isCocktailType
  ? <CocktailIngestPreview draft={state.draft as CocktailDraft} onSwitchToEdit={...} />
  : isWineType
    ? <WineIngestPreview ... />
    : <IngestPreview ... />;
```

**`hasDraft` check**: Add cocktail condition:
```tsx
const hasDraft = isCocktailType
  ? (state.draft as CocktailDraft).name !== ''
  : isWineType
    ? (state.draft as WineDraft).name !== ''
    : (state.draft as PrepRecipeDraft).name !== '' || ...;
```

**`handlePublish`** — add cocktail branch:
- **Validation (cocktail)**: name, style, glass, ingredients, keyIngredients, procedure (at least 1 step) required
- **Slug generation**: `generateSlug(draft.name)`, check uniqueness against `cocktails` table
- **Row mapping**:
  ```typescript
  const cd = draft as CocktailDraft;
  const row = {
    slug,
    name: cd.name,
    style: cd.style,
    glass: cd.glass,
    ingredients: cd.ingredients,
    key_ingredients: cd.keyIngredients,
    procedure: cd.procedure,
    tasting_notes: cd.tastingNotes,
    description: cd.description,
    notes: cd.notes,
    image: cd.image,
    is_top_seller: cd.isTopSeller,
    status: 'published',
    version: 1,
    ai_ingestion_meta: { source_type: 'ai_ingestion', confidence_score: 0.9, missing_fields: [], last_ai_generated_at: new Date().toISOString() },
    created_by: user.id,
  };
  ```
- **INSERT/UPDATE**: `cocktails` table
- **Embed**: Call `embed-products` with `{ table: 'cocktails', rowId }`
- **Invalidate**: `queryKey: ['cocktails']`
- **Navigate**: To `/cocktails` after publish

**Edit mode load**: Add cocktail branch for loading existing cocktail:
```tsx
if (table === 'cocktails' && data) {
  const draft: CocktailDraft = {
    name: data.name || '', slug: data.slug || '',
    style: data.style || 'classic', glass: data.glass || '',
    ingredients: data.ingredients || '',
    keyIngredients: data.key_ingredients || '',
    procedure: (data.procedure as CocktailProcedureStep[]) || [],
    tastingNotes: data.tasting_notes || '',
    description: data.description || '',
    notes: data.notes || '', image: data.image || null,
    isTopSeller: data.is_top_seller ?? false,
  };
  dispatch({ type: 'SET_ACTIVE_TYPE', payload: 'cocktail' });
  dispatch({ type: 'SET_DRAFT', payload: draft });
}
```

**No-image warning**: Add cocktail branch (same pattern as wine — single `image` field, not array).

**AI panel label**: `isCocktailType ? 'AI Cocktail Builder' : isWineType ? 'AI Wine Builder' : 'AI Recipe Builder'`

### D2. Update `DraftPreviewCard`

**File**: `src/components/ingest/DraftPreviewCard.tsx`

Add cocktail variant using discriminant check (`'glass' in draft && 'keyIngredients' in draft`):
- **Icon**: GlassWater (from lucide-react)
- **Title**: draft.name
- **Subtitle**: draft.style + " - " + draft.glass
- **Details**: key ingredients, step count, description snippet
- **Badge**: CocktailStyleBadge

### D3. Update hooks for cocktail support

Widen draft types in existing hooks (these were already updated for wine — just add `CocktailDraft` to the union):

- **`use-ingest-chat.ts`**: `ChatResult.draft` → `PrepRecipeDraft | WineDraft | CocktailDraft | null`
- **`use-file-upload.ts`**: `FileUploadResult.draft` → add CocktailDraft to union
- **`use-image-upload.ts`**: `ImageUploadResult.draft` → add CocktailDraft to union
- **`use-ingestion-session.ts`**: `IngestionSession.draftData` → add CocktailDraft to union

### D4. Update CocktailCardView — add Edit button for admins

**File**: `src/components/cocktails/CocktailCardView.tsx`

Add an edit pencil button (same pattern as WineCardView edit button) that navigates to `/admin/ingest/edit/cocktails/{id}`.

---

## Phase E: Edge Functions — Cocktail AI Prompts & Schemas

### E1. Add cocktail to PROMPT_SLUG_MAP

**File**: `supabase/functions/ingest/index.ts`

```typescript
const PROMPT_SLUG_MAP: Record<string, { chat: string; extract: string }> = {
  prep_recipes: { chat: "ingest-chat-prep-recipe", extract: "ingest-extract-prep-recipe" },
  wines: { chat: "ingest-chat-wine", extract: "ingest-extract-wine" },
  cocktails: { chat: "ingest-chat-cocktail", extract: "ingest-extract-cocktail" },  // NEW
};
```

### E2. Add COCKTAIL_DRAFT_SCHEMA

**File**: `supabase/functions/ingest/index.ts`

Add new schema alongside PREP_RECIPE_DRAFT_SCHEMA and WINE_DRAFT_SCHEMA:

```typescript
const COCKTAIL_DRAFT_SCHEMA = {
  name: "cocktail_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      style: { type: "string", enum: ["classic", "modern", "tiki", "refresher"] },
      glass: { type: "string", description: "Glass type, e.g., Rocks, Coupe, Highball, Nick & Nora, Collins" },
      ingredients: { type: "string", description: "Full ingredient list with measurements, one per line" },
      keyIngredients: { type: "string", description: "Primary spirits/mixers summary" },
      procedure: {
        type: "array",
        items: {
          type: "object",
          properties: {
            step: { type: "number" },
            instruction: { type: "string" },
          },
          required: ["step", "instruction"],
          additionalProperties: false,
        },
        description: "Ordered preparation steps",
      },
      tastingNotes: { type: "string" },
      description: { type: "string", description: "Cocktail story, history, or context" },
      notes: { type: "string", description: "Service notes, garnish details, technique tips" },
      isTopSeller: { type: "boolean" },
      confidence: { type: "number", description: "0-1 confidence score" },
      missingFields: {
        type: "array",
        items: { type: "string" },
        description: "Fields the AI couldn't determine from the input",
      },
      aiMessage: {
        type: "string",
        description: "Brief summary of what was extracted or updated in this turn",
      },
    },
    required: [
      "name", "style", "glass", "ingredients", "keyIngredients",
      "procedure", "tastingNotes", "description", "notes",
      "isTopSeller", "confidence", "missingFields", "aiMessage",
    ],
    additionalProperties: false,
  },
};
```

### E3. Update buildExtractResponseSchema

**File**: `supabase/functions/ingest/index.ts`

```typescript
function buildExtractResponseSchema(productTable: string) {
  const draftSchema = productTable === "wines"
    ? WINE_DRAFT_SCHEMA.schema
    : productTable === "cocktails"
      ? COCKTAIL_DRAFT_SCHEMA.schema
      : PREP_RECIPE_DRAFT_SCHEMA.schema;
  // ... rest unchanged
}
```

### E4. Update buildResponsesTools — no web search for cocktails

**File**: `supabase/functions/ingest/index.ts`

The existing `buildResponsesTools()` only adds `web_search_preview` for wines. Cocktails should get the base tools only (search_recipes, search_products) — **no web search**. The existing logic already handles this correctly since it only checks `productTable === "wines"`. No code change needed.

### E5. Update post-extraction draft patching

**File**: `supabase/functions/ingest/index.ts` (around line 895)

Add cocktail branch for slug and image defaults:
```typescript
if (productTable === "wines") {
  (currentDraft as any).slug = generateSlug(extractResult.draft.name);
  if ((currentDraft as any).image === undefined) (currentDraft as any).image = null;
} else if (productTable === "cocktails") {
  (currentDraft as any).slug = generateSlug(extractResult.draft.name);
  if ((currentDraft as any).image === undefined) (currentDraft as any).image = null;
} else {
  (currentDraft as any).slug = generateSlug(extractResult.draft.name);
  (currentDraft as any).images = (currentDraft as any).images || [];
}
```

Also update the return-draft patching section (around line 949):
```typescript
if (productTable === "wines" || productTable === "cocktails") {
  if (d.image === undefined) d.image = null;
} else {
  if (!d.images) d.images = [];
}
```

### E6. Add cocktail to FILE_PROMPT_MAP (ingest-vision + ingest-file)

**File**: `supabase/functions/ingest-vision/index.ts`
**File**: `supabase/functions/ingest-file/index.ts`

Both files — add cocktail entry:
```typescript
const FILE_PROMPT_MAP: Record<string, string> = {
  prep_recipes: "ingest-file-prep-recipe",
  wines: "ingest-file-wine",
  cocktails: "ingest-file-cocktail",   // NEW
};
```

Also add `COCKTAIL_DRAFT_SCHEMA` to both files (same as E2), and update:
- Schema selection: `productTable === "cocktails" ? COCKTAIL_DRAFT_SCHEMA : ...`
- User message text: cocktail-specific merge/extract text
- Post-processing: cocktails get `slug` + `image` (string, same as wine)
- Draft type unions: add `CocktailDraft` interface

### E7. Add WineDraft + CocktailDraft interface to ingest-vision and ingest-file

Both edge functions need the `CocktailDraft` interface added to their types section, and `ProductDraft` union widened:
```typescript
type ProductDraft = PrepRecipeDraft | WineDraft | CocktailDraft;
```

---

## Phase F: Database Migration — AI Prompts

### F1. Create cocktail AI prompts migration

**New migration**: `supabase/migrations/XXXXXX_ingest_cocktail_prompts.sql`

Insert **three** prompt pairs into `ai_prompts`:

#### `ingest-chat-cocktail` (EN + ES)

System prompt for the conversational chat (Call 1):
- Role: Expert bartender and mixologist assistant for Alamo Prime steakhouse
- **Can suggest full cocktail recipes from scratch** — if user says "make me an Old Fashioned", AI should provide complete spec (ingredients with measurements, method, glass, garnish)
- Conversational: ask about spirit preference, style direction, occasion
- Priorities: confirm exact spirit brands/types, measurements in oz, glass type, garnish, technique (shaken/stirred/built)
- Available tools: `search_recipes` (find house-made syrups/infusions), `search_products` (check for duplicates)
- **No web search** — model uses its own knowledge
- Suggest food pairings from the steakhouse menu context
- Tone: skilled bartender, concise, practical
- Ask 1-2 questions at a time, use Markdown
- Always format ingredients as: `{qty} oz {spirit}` or `{qty} dashes {modifier}` (one per line)

#### `ingest-extract-cocktail` (EN + ES)

System prompt for structured extraction (Call 2):
- Role: Deterministic cocktail data extraction engine
- Reads chat exchange, extracts cocktail fields into JSON schema
- **Ingredients**: Format as plain text, one ingredient per line with measurement (e.g., "2 oz Bourbon\n0.5 oz Demerara syrup\n2 dashes Angostura bitters")
- **Key ingredients**: Extract 2-3 primary spirits/mixers (e.g., "Bourbon, Angostura bitters")
- **Procedure**: Generate ordered steps `[{step: 1, instruction: "..."}, ...]`
- **Style mapping**: classic (pre-prohibition & timeless), modern (contemporary twists), tiki (tropical/rum-based), refresher (light/sparkling/low-ABV)
- **Glass mapping**: Rocks, Coupe, Highball, Collins, Nick & Nora, Martini, Copper Mug, Hurricane, Flute
- Confidence scoring: 0.9+ = all fields filled, deduct ~0.1 per missing field
- Required for full confidence: name, style, glass, ingredients, keyIngredients, procedure, tastingNotes
- Preserve existing data when merging, list missingFields, set aiMessage

#### `ingest-file-cocktail` (EN + ES)

System prompt for file/image upload (single-call extraction):
- Role: Cocktail data extraction engine for uploaded files/images
- Extracts from: cocktail recipe cards, bar menus, spec sheets, photos of recipe books
- Same field mapping as extract prompt
- If multiple cocktails in source, extract only the first and mention others in aiMessage
- For well-known cocktails, supplement missing procedure/tasting notes from knowledge

---

## Files Summary

| # | File | Action | What |
|---|------|--------|------|
| 1 | `src/types/ingestion.ts` | Edit | Add CocktailDraft, createEmptyCocktailDraft, widen unions, enable cocktail |
| 2 | `src/contexts/IngestDraftContext.tsx` | Edit | Cocktail actions, type guard, updateCocktailDraft, RESET_DRAFT branch |
| 3 | `src/components/ingest/editor/CocktailEditor.tsx` | **New** | 6-section accordion form editor |
| 4 | `src/components/ingest/editor/CocktailImageEditor.tsx` | **New** | Single-image upload/generate/remove (copy WineImageEditor pattern) |
| 5 | `src/components/ingest/editor/CocktailProcedureEditor.tsx` | **New** | Flat step list editor (add/remove/reorder) |
| 6 | `src/components/ingest/CocktailIngestPreview.tsx` | **New** | CocktailCardView-matching preview |
| 7 | `src/components/cocktails/CocktailCardView.tsx` | Edit | Add admin edit button |
| 8 | `src/pages/IngestPage.tsx` | Edit | Branch editor/preview/publish/validate/edit-load/resume/delete on cocktail type |
| 9 | `src/pages/IngestWizard.tsx` | Edit | Enable cocktail card (1 line) |
| 10 | `src/hooks/use-ingest-chat.ts` | Edit | Widen ChatResult.draft type |
| 11 | `src/hooks/use-file-upload.ts` | Edit | Widen FileUploadResult.draft type |
| 12 | `src/hooks/use-image-upload.ts` | Edit | Widen ImageUploadResult.draft type |
| 13 | `src/hooks/use-ingestion-session.ts` | Edit | Widen IngestionSession.draftData type |
| 14 | `src/components/ingest/DraftPreviewCard.tsx` | Edit | Add cocktail variant layout |
| 15 | `supabase/functions/ingest/index.ts` | Edit | PROMPT_SLUG_MAP, COCKTAIL_DRAFT_SCHEMA, buildExtractResponseSchema, post-patching |
| 16 | `supabase/functions/ingest-vision/index.ts` | Edit | CocktailDraft type, COCKTAIL_DRAFT_SCHEMA, FILE_PROMPT_MAP, branching |
| 17 | `supabase/functions/ingest-file/index.ts` | Edit | CocktailDraft type, COCKTAIL_DRAFT_SCHEMA, FILE_PROMPT_MAP, branching |
| 18 | `supabase/migrations/XXXXXX_ingest_cocktail_prompts.sql` | **New** | 3 prompts: chat + extract + file (EN + ES) |

**4 new files, 13 edited files, 1 new migration.**

---

## Implementation Order

1. **A1-A2**: Types + context (foundation — CocktailDraft, actions, type guards). Run `npx tsc --noEmit` to verify no regressions.
2. **A3**: Enable cocktail in PRODUCT_TYPES + IngestWizard
3. **B1-B3**: CocktailEditor + CocktailImageEditor + CocktailProcedureEditor (can test with manual dispatch)
4. **C1**: CocktailIngestPreview
5. **D1-D4**: Wire into IngestPage — editor/preview/publish/validate/edit-load/hooks/DraftPreviewCard/CocktailCardView edit button
6. **E1-E7**: Edge functions — schema, PROMPT_SLUG_MAP, FILE_PROMPT_MAP, branching, type unions
7. **F1**: Migration — 3 AI prompts (chat + extract + file, EN + ES)
8. **Deploy**: `npx supabase db push && npx supabase functions deploy ingest && npx supabase functions deploy ingest-vision && npx supabase functions deploy ingest-file`

**Run `npx tsc --noEmit` after each phase.**

---

## Verification

1. `npx tsc --noEmit` — 0 errors after each phase
2. Existing prep recipe & wine flows — verify no regression
3. IngestWizard → select Cocktail → Start → opens session with CocktailEditor
4. AI chat: "Make me an Old Fashioned" → AI provides full spec → draft populates with name, style (classic), glass (Rocks), ingredients, procedure, tasting notes
5. AI chat: "Make it with rye instead of bourbon" → merges update, preserves existing fields
6. Editor: all fields editable, style dropdown works, glass input works, procedure steps add/remove/reorder
7. Preview: matches CocktailCardView layout (image left, ingredients right, numbered method steps)
8. Publish: creates row in `cocktails` table, generates embedding, navigates to `/cocktails`
9. Edit: Click pencil on CocktailCardView → opens editor pre-filled → Update works
10. Resume: Save cocktail draft → dashboard → click session → cocktail editor loads correctly
11. Delete: Delete cocktail from editor → row removed, cache invalidated, navigate to dashboard
12. DraftPreviewCard: AI response in chat shows cocktail-specific preview (style badge, glass, key ingredients)
13. File upload: Upload a cocktail recipe PDF → AI extracts ingredients, method, glass
14. Image upload: Upload a cocktail photo → AI describes likely cocktail, suggests spec
15. `npx supabase db push` — migration applies cleanly
16. `npx supabase functions deploy` — all 3 functions deploy without error

---

## Out of Scope

- **Web enrichment**: Not needed per user requirement — model knows cocktail recipes
- **Ingredient parsing**: Ingredients stored as plain text (DB schema). Future enhancement could parse into structured `{qty, unit, name}` objects
- **Batch scaling**: Not applicable to cocktails (single-serve recipes)
- **Training notes**: Not in cocktails schema — covered by `notes` field
- **Allergen tracking**: Not in cocktails schema — could be added in future migration
