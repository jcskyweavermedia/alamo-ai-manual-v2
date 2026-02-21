# Plan: Wine Editor — Full Ingest Support for Wines Table

## Context

The prep recipe ingest system is complete (chat AI, structured editor, preview, publish pipeline). Wine is the next product type to enable. Unlike prep recipes (complex nested JSONB with ingredient groups, procedure groups, batch scaling, training notes), wines have a **flat schema** — all scalar fields, a single image URL, and no nested arrays. This makes the editor simpler but requires a different draft type, different AI prompts, a new extraction schema, and web search enrichment (per the master plan Phase 7).

**Existing wines table columns**: `name, slug, producer, region, country, vintage, varietal, blend, style, body, tasting_notes, producer_notes, notes, image, is_top_seller, status, version, embedding, search_vector, ai_ingestion_meta, created_by`

No schema migration needed — editor uses existing columns only.

---

## Phase A: Types, Context & Draft State

### A1. Add `WineDraft` type

**File**: `src/types/ingestion.ts`

```typescript
import type { WineStyle, WineBody } from './products';

export interface WineDraft {
  name: string;
  slug: string;
  producer: string;
  region: string;
  country: string;
  vintage: string | null;   // null for NV wines (matches Wine type + DB nullable)
  varietal: string;
  blend: boolean;
  style: WineStyle;          // 'red' | 'white' | 'rosé' | 'sparkling' (from products.ts)
  body: WineBody;            // 'light' | 'medium' | 'full' (from products.ts)
  tastingNotes: string;
  producerNotes: string;
  notes: string;             // service/pairing notes
  image: string | null;      // single URL, not an array
  isTopSeller: boolean;
}
```

Add `createEmptyWineDraft()` factory:
```typescript
export function createEmptyWineDraft(): WineDraft {
  return {
    name: '', slug: '', producer: '', region: '', country: '',
    vintage: null, varietal: '', blend: false,
    style: 'red', body: 'medium',
    tastingNotes: '', producerNotes: '', notes: '',
    image: null, isTopSeller: false,
  };
}
```

Update `ChatMessage.draftPreview` type to `PrepRecipeDraft | WineDraft | null`.

Enable wine: Change `{ key: 'wine', label: 'Wine', enabled: false }` → `enabled: true` in `PRODUCT_TYPES` array (line 43).

> **Note**: The `DraftState` interface in this file (line 85) is vestigial and unused. The actual state interface is `IngestState` in `IngestDraftContext.tsx`.

### A2. Update IngestDraftContext — discriminated union + wine actions

**File**: `src/contexts/IngestDraftContext.tsx`

**State change**: `draft: PrepRecipeDraft` → `draft: PrepRecipeDraft | WineDraft`

**Critical: Type narrowing strategy for existing reducer cases.**
Widening `state.draft` to a union type will break all ~25 existing prep recipe reducer cases that access `state.draft.ingredients`, `state.draft.procedure`, etc. because `WineDraft` doesn't have these fields.

**Solution**: Add type guards and cast the existing `updateDraft` helper:
```typescript
function isWineDraft(draft: PrepRecipeDraft | WineDraft): draft is WineDraft {
  return 'varietal' in draft;
}

function isPrepDraft(draft: PrepRecipeDraft | WineDraft): draft is PrepRecipeDraft {
  return 'ingredients' in draft;
}

// Existing helper — add type assertion for prep-only cases
function updatePrepDraft(state: IngestState, draftUpdate: Partial<PrepRecipeDraft>): IngestState {
  return { ...state, draft: { ...(state.draft as PrepRecipeDraft), ...draftUpdate }, isDirty: true };
}

// New helper for wine cases
function updateWineDraft(state: IngestState, update: Partial<WineDraft>): IngestState {
  return { ...state, draft: { ...(state.draft as WineDraft), ...update }, isDirty: true };
}
```

Rename existing `updateDraft` → `updatePrepDraft` across all prep recipe cases. This is a safe rename (same logic, explicit type).

**New actions** (add to `IngestAction` union):
```
// Wine metadata
| { type: 'SET_WINE_PRODUCER'; payload: string }
| { type: 'SET_WINE_REGION'; payload: string }
| { type: 'SET_WINE_COUNTRY'; payload: string }
| { type: 'SET_WINE_VINTAGE'; payload: string | null }
| { type: 'SET_WINE_VARIETAL'; payload: string }
| { type: 'SET_WINE_BLEND'; payload: boolean }
| { type: 'SET_WINE_STYLE'; payload: WineStyle }
| { type: 'SET_WINE_BODY'; payload: WineBody }
| { type: 'SET_WINE_TASTING_NOTES'; payload: string }
| { type: 'SET_WINE_PRODUCER_NOTES'; payload: string }
| { type: 'SET_WINE_NOTES'; payload: string }
| { type: 'SET_WINE_IMAGE'; payload: string | null }
| { type: 'SET_WINE_TOP_SELLER'; payload: boolean }
```

**Modify existing actions**:
- `SET_NAME`: Works for both types (both have `name` + `slug`). Use a generic update: `{ ...state, draft: { ...state.draft, name: action.payload, slug: generateSlug(action.payload) }, isDirty: true }`
- `SET_DRAFT`: Accept `PrepRecipeDraft | WineDraft`
- `RESET_DRAFT`: Check `activeType` → call correct factory. **Also clears** `messages`, `sessionId`, `isSaving`, `draftVersion` (preserving existing behavior from line 139).
- `SET_ACTIVE_TYPE`: Reset draft to correct type **only if switching to a different type** (prevents data loss when clicking the already-active tab). ⚠️ This is new behavior — consider showing a dirty-check confirmation if `isDirty` is true.

### A3. Enable wine in IngestWizard

**File**: `src/pages/IngestWizard.tsx` (line 47)

Change `{ key: 'wine', label: 'Wine', icon: Wine, enabled: false }` → `enabled: true`

> **Note**: `ProductTypeNavbar` requires no changes — it reads from `PRODUCT_TYPES` dynamically.

---

## Phase B: Wine Editor Component

### B1. Create `WineEditor.tsx`

**New file**: `src/components/ingest/editor/WineEditor.tsx`

Simple form using existing shadcn components (Input, Textarea, Select, Switch, Label). No drag-and-drop, no nested groups.

**Layout**: Single Accordion (type="multiple", all open by default) with these sections:

1. **Wine Identity** — name (Input), producer (Input), vintage (Input, placeholder "Leave empty for NV"), varietal (Input), blend (Switch)
2. **Classification** — style (Select: red/white/rosé/sparkling), body (Select: light/medium/full), region (Input), country (Input)
3. **Tasting & Notes** — tastingNotes (Textarea, 4 rows), producerNotes (Textarea, 3 rows), notes (Textarea, 3 rows, placeholder "Service notes, food pairings...")
4. **Image** — `<WineImageEditor />` (see B2)
5. **Options** — isTopSeller (Switch with label "Top Seller")

**Bold section titles**: Apply same `text-base font-semibold tracking-tight` as PrepRecipeEditor.

**Pattern**: Uses `useIngestDraft()` context, dispatches wine-specific actions.

### B2. Create `WineImageEditor.tsx`

**New file**: `src/components/ingest/editor/WineImageEditor.tsx`

Simplified single-image editor (not an array):
- Shows current image with loading skeleton (reuse pattern from ImagesEditor: `loadedUrls` Set, `animate-pulse` placeholder, opacity transition)
- Upload photo / Take photo / Generate with AI buttons (same 3-button row pattern as ImagesEditor)
- Remove button (X) overlaid on the image
- Dispatches `SET_WINE_IMAGE` with URL string or `null` on remove

Reuses hooks: `useDirectImageUpload`, `useGenerateImage`, `useToast`.

For AI generation: pass `productTable: 'wines'`, `name: draft.name`, `prepType: draft.style`, `description: draft.varietal` to `generateImage()`.

---

## Phase C: Wine Preview Component

### C1. Extract `BodyIndicator` to shared file

**File**: `src/components/wines/WineCardView.tsx` → extract to `src/components/wines/BodyIndicator.tsx`

`BodyIndicator` is currently a file-scoped (non-exported) function in `WineCardView.tsx` (lines 22-40). Extract it to its own file and export it so both `WineCardView` and `WineIngestPreview` can import it.

Update `WineCardView.tsx` to import from the new file.

### C2. Create `WineIngestPreview.tsx`

**New file**: `src/components/ingest/WineIngestPreview.tsx`

Mirrors `WineCardView.tsx` layout exactly:

- Title + producer + region/country + vintage
- `WineStyleBadge` (import from `@/components/wines/WineStyleBadge`) + `BodyIndicator` (import from `@/components/wines/BodyIndicator`)
- "Edit" button to switch to editor
- Top seller badge (`TopSellerBadge` from `@/components/shared/TopSellerBadge`) if enabled
- Two-column layout (`md:flex-row`):
  - **Left** (30-35%): Bottle image with lightbox expand (portrait `aspect-[2/3]`, `object-contain`, `bg-muted`). Same lightbox pattern as WineCardView.
  - **Right** (flex-1): Tasting Notes, Producer Notes, Notes — each as a titled section with `text-xs font-bold uppercase tracking-wide text-muted-foreground` headers.
- Empty state: If `!draft.name` → show Eye icon + "No wine to preview" message

**Props**: `{ draft: WineDraft; onSwitchToEdit: () => void }`

> **Note**: `WineStyleBadge` imports `WineStyle` from `@/data/mock-wines.ts` (not `@/types/products.ts`). Both define the same union type. This coupling is inherited but harmless.

---

## Phase D: Wire into IngestPage

### D1. Update IngestPage to support wine

**File**: `src/pages/IngestPage.tsx`

**Shared table-name mapping** (add near top):
```typescript
const ACTIVE_TYPE_TO_TABLE: Record<ProductType, string> = {
  prep_recipe: 'prep_recipes', wine: 'wines',
  plate_spec: 'plate_specs', foh_plate_spec: 'foh_plate_specs',
  cocktail: 'cocktails', beer_liquor: 'beer_liquor_list',
};
const TABLE_TO_ACTIVE_TYPE: Record<string, ProductType> = Object.fromEntries(
  Object.entries(ACTIVE_TYPE_TO_TABLE).map(([k, v]) => [v, k as ProductType])
);
const ACTIVE_TYPE_TO_QUERY_KEY: Record<string, string> = {
  prep_recipe: 'recipes', wine: 'wines',
};
```

**Editor rendering**: Branch on `state.activeType`:
```tsx
{state.activeType === 'wine' ? <WineEditor /> : <PrepRecipeEditor />}
```
(Apply in both mobile edit mode + desktop edit view.)

**Preview rendering**: Branch on `state.activeType`:
```tsx
{state.activeType === 'wine'
  ? <WineIngestPreview draft={state.draft as WineDraft} onSwitchToEdit={...} />
  : <IngestPreview draft={state.draft as PrepRecipeDraft} onSwitchToEdit={...} />}
```

**`hasDraft` check**: Generalize:
```tsx
const hasDraft = state.activeType === 'wine'
  ? (state.draft as WineDraft).name !== ''
  : (state.draft as PrepRecipeDraft).name !== '' || (state.draft as PrepRecipeDraft).ingredients.length > 0;
```

**`handleSaveDraft`**: Replace hardcoded `createSession('prep_recipes')` with:
```tsx
const tableName = ACTIVE_TYPE_TO_TABLE[state.activeType];
const newId = await createSession(tableName);
```

**`handlePublish`** — add wine branch:
- **Validation** (wine): name, producer, region, country, varietal, style, body, tastingNotes required
- **Slug generation**: Use `generateSlug(draft.name)`, check uniqueness against `wines` table (not `prep_recipes`)
- **Row mapping** (wine):
  ```typescript
  const row = {
    slug,
    name: draft.name,
    producer: draft.producer,
    region: draft.region,
    country: draft.country,
    vintage: draft.vintage || null,
    varietal: draft.varietal,
    blend: draft.blend,
    style: draft.style,
    body: draft.body,
    tasting_notes: draft.tastingNotes,
    producer_notes: draft.producerNotes,
    notes: draft.notes,
    image: draft.image,
    is_top_seller: draft.isTopSeller,
    status: 'published',
    version: 1,
    ai_ingestion_meta: { source_type: 'ai_ingestion', confidence_score: 0.9, missing_fields: [], last_ai_generated_at: new Date().toISOString() },
    created_by: user.id,
  };
  ```
- **INSERT/UPDATE**: Use `wines` table
- **Embed**: Call `embed-products` with `{ table: 'wines', rowId }`
- **Invalidate**: `queryKey: ['wines']`
- **Navigate**: To `/wines` after publish

**`handleDelete`**: The Supabase delete call is already generic (uses `table` param). Fix:
- Cache invalidation: use `ACTIVE_TYPE_TO_QUERY_KEY[state.activeType]` instead of hardcoded `['recipes']`
- Toast message: "Wine deleted" / "Recipe deleted" based on `state.activeType`

**Edit mode load** (the `useEffect` at ~line 340): Add wine branch:
```tsx
if (table === 'wines' && data) {
  const draft: WineDraft = {
    name: data.name || '', slug: data.slug || '',
    producer: data.producer || '', region: data.region || '',
    country: data.country || '', vintage: data.vintage ?? null,
    varietal: data.varietal || '', blend: data.blend ?? false,
    style: data.style || 'red', body: data.body || 'medium',
    tastingNotes: data.tasting_notes || '', producerNotes: data.producer_notes || '',
    notes: data.notes || '', image: data.image || null,
    isTopSeller: data.is_top_seller ?? false,
  };
  dispatch({ type: 'SET_ACTIVE_TYPE', payload: 'wine' });
  dispatch({ type: 'SET_DRAFT', payload: draft });
}
```

**Session resume flow** (the `useEffect` at ~line 318): **CRITICAL GAP** — currently never dispatches `SET_ACTIVE_TYPE` when resuming a saved session. After `loadSession` resolves, detect `productTable` and dispatch accordingly:
```tsx
if (result) {
  dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
  // Detect product type from session
  const resumedType = TABLE_TO_ACTIVE_TYPE[result.session.productTable];
  if (resumedType) dispatch({ type: 'SET_ACTIVE_TYPE', payload: resumedType });
  // Restore draft...
}
```

**No-image warning dialog**: The entire dialog (lines 684-736) needs wine branching:
- **Trigger condition**: `state.activeType === 'wine' ? (draft as WineDraft).image === null : (draft as PrepRecipeDraft).images.length === 0`
- **AI generate call**: For wine, pass `productTable: 'wines'`, `name: draft.name`, `prepType: draft.style`, `description: draft.varietal`
- **After generation dispatch**: For wine, dispatch `SET_WINE_IMAGE` with `result.imageUrl` (string). For prep, dispatch `ADD_IMAGE` with RecipeImage object (existing behavior).

**AI panel label**: Change "AI Recipe Builder" to dynamic: `state.activeType === 'wine' ? 'AI Wine Builder' : 'AI Recipe Builder'`.

### D2. Update `useIngestChat` hook

**File**: `src/hooks/use-ingest-chat.ts`

Currently hardcoded: `productTable: 'prep_recipes'`. Change to accept parameter:
```typescript
export function useIngestChat(productTable: string = 'prep_recipes') {
  // ... use productTable in invoke body
}
```

Update `ChatResult.draft` type: `PrepRecipeDraft | WineDraft | null` (currently hardcoded to `PrepRecipeDraft | null`).

Add `productTable` to the `useCallback` dependency array.

**Callsite** in `IngestPage.tsx`:
```typescript
const productTable = ACTIVE_TYPE_TO_TABLE[state.activeType];
const { sendMessage, isProcessing } = useIngestChat(productTable);
```

### D3. Update file/image upload hooks

**File**: `src/hooks/use-file-upload.ts`
- Line 120: Replace `formData.append('productTable', 'prep_recipes')` → accept `productTable` parameter
- Update `FileUploadResult.draft` type to `PrepRecipeDraft | WineDraft | null`

**File**: `src/hooks/use-image-upload.ts`
- Line 152: Replace `formData.append('productTable', 'prep_recipes')` → accept `productTable` parameter
- Update `ImageUploadResult.draft` type to `PrepRecipeDraft | WineDraft | null`

**Callsite** in `IngestPage.tsx` `handleSendMessage`: Pass correct `productTable` to both hooks.

### D4. Update `use-ingestion-session.ts`

**File**: `src/hooks/use-ingestion-session.ts`

- Widen `IngestionSession.draftData` from `PrepRecipeDraft` to `PrepRecipeDraft | WineDraft`
- Widen `saveDraft` parameter from `(draft: PrepRecipeDraft, version: number)` to `(draft: PrepRecipeDraft | WineDraft, version: number)`
- Add `productTable` to `IngestionSession` interface (already in DB, just add to the type)
- Remove unsafe `as PrepRecipeDraft` cast in `mapRow` — use the raw JSON

### D5. Update `DraftPreviewCard`

**File**: `src/components/ingest/DraftPreviewCard.tsx`

Currently renders prep-recipe-specific fields: ingredients count, procedure steps count, yieldQty, shelfLife, prepType badge, ChefHat icon. All will crash on a `WineDraft`.

**Solution**: Accept `PrepRecipeDraft | WineDraft` and use discriminant check (`'varietal' in draft`):
- **Prep recipe variant**: existing layout (ingredient/step counts, yield, shelf life, ChefHat icon)
- **Wine variant**: Wine icon, name, producer, region/country, varietal, style badge, body indicator

### D6. Update `ChatIngestionPanel`

**File**: `src/components/ingest/ChatIngestionPanel.tsx`

Add `productLabel` prop (e.g., `"recipe"` or `"wine"`) to contextualize copy text:
- Empty state heading: "AI Recipe Builder" → "AI Wine Builder"
- Placeholder: "Describe your recipe..." → "Describe your wine..."
- Suggestion text: "Type ingredients, steps, and details" → "Type producer, region, tasting notes..."

---

## Phase E: Edge Function — Wine AI Prompts

### E1. Make ingest function load prompts dynamically

**File**: `supabase/functions/ingest/index.ts`

Currently hardcoded to `ingest-chat-prep-recipe` (line 442) and `ingest-extract-prep-recipe` (line 682).

**Change**: Map `productTable` to prompt slugs:
```typescript
const PROMPT_SLUG_MAP: Record<string, { chat: string; extract: string }> = {
  prep_recipes: { chat: 'ingest-chat-prep-recipe', extract: 'ingest-extract-prep-recipe' },
  wines:        { chat: 'ingest-chat-wine',        extract: 'ingest-extract-wine' },
};
```

Replace hardcoded `.eq("slug", "ingest-chat-prep-recipe")` with `.eq("slug", PROMPT_SLUG_MAP[productTable].chat)` (and same for extract).

### E2. Add wine-specific extraction schema + dynamic response wrapper

**File**: `supabase/functions/ingest/index.ts`

Add `WINE_DRAFT_SCHEMA` alongside existing `PREP_RECIPE_DRAFT_SCHEMA`:
```typescript
const WINE_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    producer: { type: "string" },
    region: { type: "string" },
    country: { type: "string" },
    vintage: { type: ["string", "null"] },   // null for NV wines
    varietal: { type: "string" },
    blend: { type: "boolean" },
    style: { type: "string", enum: ["red", "white", "rosé", "sparkling"] },
    body: { type: "string", enum: ["light", "medium", "full"] },
    tastingNotes: { type: "string" },
    producerNotes: { type: "string" },
    notes: { type: "string" },
    image: { type: ["string", "null"] },
    isTopSeller: { type: "boolean" },
    confidence: { type: "number" },
    missingFields: { type: "array", items: { type: "string" } },
    aiMessage: { type: "string" },
  },
  required: ["name", "producer", "region", "country", "vintage", "varietal",
    "blend", "style", "body", "tastingNotes", "producerNotes", "notes",
    "isTopSeller", "confidence", "missingFields", "aiMessage"],
  additionalProperties: false,
};
```

Map `productTable` to correct schema for `EXTRACT_RESPONSE_SCHEMA` wrapper:
```typescript
const draftSchema = productTable === 'wines' ? WINE_DRAFT_SCHEMA : PREP_RECIPE_DRAFT_SCHEMA;
const extractResponseSchema = {
  type: "object",
  properties: {
    has_updates: { type: "boolean" },
    draft: draftSchema,
  },
  required: ["has_updates", "draft"],
  additionalProperties: false,
};
```

### E3. Fix post-extraction draft patching

**File**: `supabase/functions/ingest/index.ts` (lines 777-782)

Currently injects `slug` and `images: []`. Branch by `productTable`:
```typescript
if (productTable === 'wines') {
  (currentDraft as any).slug = generateSlug(extractResult.draft.name);
  if ((currentDraft as any).image === undefined) (currentDraft as any).image = null;
} else {
  (currentDraft as any).slug = generateSlug(extractResult.draft.name);
  (currentDraft as any).images = (currentDraft as any).images || [];
}
```

### E4. Create wine AI prompts (migration)

**New migration**: `supabase/migrations/XXXXXX_ingest_wine_prompts.sql`

Insert two prompt pairs into `ai_prompts`:

**`ingest-chat-wine`** (EN + ES):
- Role: Bilingual sommelier assistant for Alamo Prime steakhouse
- Helps admins document wines for the restaurant operations manual
- Conversational mode — ask about: producer, region, vintage, varietal, style, body
- Prompts for tasting notes (aromas, palate, finish), producer story
- Suggests food pairings for steakhouse context (steak cuts, charcuterie, etc.)
- Can use `search_products` tool to check for duplicate wines
- Tone: knowledgeable, approachable, concise

**`ingest-extract-wine`** (EN + ES):
- Role: Wine data extraction engine
- Reads chat exchange, extracts wine fields into JSON schema
- Maps informal descriptions to enum values (e.g., "big red" → style: "red", body: "full")
- Infers `blend: true` if multiple grape varieties mentioned
- Sets `vintage: null` if "NV" or "non-vintage" mentioned
- Confidence scoring: 0.9+ = all required fields present, deduct ~0.1 per missing field
- Required fields for full confidence: name, producer, region, country, varietal, style, body, tastingNotes

### E5. Update edge function response types

**File**: `supabase/functions/ingest/index.ts`

- `IngestResponse.draft` type: `PrepRecipeDraft | WineDraft | null` (currently `PrepRecipeDraft | null`)
- `extractResult` type: handle both shapes based on `productTable`

---

## Phase F: Web Search Enrichment

### F1. Add `enrich` mode to ingest edge function

**File**: `supabase/functions/ingest/index.ts`

New mode: when `mode: 'enrich'` is sent, the function:
1. Receives `{ mode: 'enrich', productTable: 'wines', content: JSON.stringify(currentDraft) }`
2. Auth check (admin-only, same as chat mode)
3. Calls OpenAI Responses API with `web_search_preview` tool enabled
4. System prompt: "You are a wine research assistant for Alamo Prime steakhouse. Given this wine's name, producer, region, vintage, and varietal, search the web for: detailed tasting notes (aromas, palate, finish), producer background and winemaking philosophy, region characteristics, and food pairing suggestions. Return a JSON array of suggestions."
5. Response format (forced JSON schema):
   ```typescript
   { suggestions: Array<{ field: string; current: string; suggested: string; source?: string }> }
   ```
6. Fields to enrich: `tastingNotes`, `producerNotes`, `notes` (pairings)

### F2. Create `useWebEnrich` hook

**New file**: `src/hooks/use-web-enrich.ts`

```typescript
export function useWebEnrich() {
  const [isEnriching, setIsEnriching] = useState(false);

  const enrich = async (productTable: string, draft: WineDraft) => {
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ingest', {
        body: { mode: 'enrich', productTable, content: JSON.stringify(draft) },
      });
      if (error) throw error;
      return data?.suggestions as EnrichSuggestion[] | undefined;
    } finally {
      setIsEnriching(false);
    }
  };

  return { enrich, isEnriching };
}
```

### F3. Add enrichment UI to WineEditor

**In `WineEditor.tsx`**: Add an "Enrich with Web" button (Globe/Search icon + label) above or below the accordion. When clicked:
1. Calls `enrich('wines', draft)`
2. Shows enrichment suggestions in a Sheet (bottom drawer on mobile)
3. Each suggestion row: field label, current value (truncated), suggested value, source URL link
4. Accept/reject per field (accept → dispatch the corresponding `SET_WINE_*` action)
5. "Accept All" button for convenience
6. Button disabled until `name` + `producer` are filled. Shows toast if no suggestions found.

---

## Files Summary

| # | File | Action | What |
|---|------|--------|------|
| 1 | `src/types/ingestion.ts` | Edit | Add WineDraft, createEmptyWineDraft, widen ChatMessage type, enable wine |
| 2 | `src/contexts/IngestDraftContext.tsx` | Edit | Wine actions, type guards, updateWineDraft/updatePrepDraft, RESET_DRAFT branch |
| 3 | `src/components/ingest/editor/WineEditor.tsx` | **New** | 5-section accordion form editor |
| 4 | `src/components/ingest/editor/WineImageEditor.tsx` | **New** | Single-image upload/generate/remove |
| 5 | `src/components/wines/BodyIndicator.tsx` | **New** | Extracted from WineCardView for reuse |
| 6 | `src/components/ingest/WineIngestPreview.tsx` | **New** | WineCardView-matching preview |
| 7 | `src/hooks/use-web-enrich.ts` | **New** | Web enrichment hook |
| 8 | `src/components/wines/WineCardView.tsx` | Edit | Import BodyIndicator from new file |
| 9 | `src/pages/IngestPage.tsx` | Edit | Branch editor/preview/publish/validate/edit-load/resume/delete on activeType |
| 10 | `src/pages/IngestWizard.tsx` | Edit | Enable wine card (1 line) |
| 11 | `src/hooks/use-ingest-chat.ts` | Edit | Accept productTable param, widen ChatResult.draft type |
| 12 | `src/hooks/use-file-upload.ts` | Edit | Accept productTable param, widen FileUploadResult.draft type |
| 13 | `src/hooks/use-image-upload.ts` | Edit | Accept productTable param, widen ImageUploadResult.draft type |
| 14 | `src/hooks/use-ingestion-session.ts` | Edit | Widen IngestionSession.draftData + saveDraft param types, add productTable field |
| 15 | `src/components/ingest/DraftPreviewCard.tsx` | Edit | Accept union type, wine variant layout |
| 16 | `src/components/ingest/ChatIngestionPanel.tsx` | Edit | Accept productLabel prop, dynamic copy text |
| 17 | `supabase/functions/ingest/index.ts` | Edit | Dynamic prompt loading, wine schema, enrich mode, post-extraction branching |
| 18 | `supabase/migrations/XXXXXX_ingest_wine_prompts.sql` | **New** | Wine chat + extract prompts (EN + ES) |

**5 new files, 12 edited files, 1 new migration.**

---

## Phase G: Make ingest-vision & ingest-file Wine-Aware

> Image and file upload edge functions were hardcoded for prep recipes only.
> When a user uploaded a wine bottle label, the AI responded with prep recipe fields.

### G1. New migration: `ingest-file-wine` prompt

**New migration**: `supabase/migrations/20260220210000_ingest_file_wine_prompt.sql`

Insert `ingest-file-wine` slug (EN + ES) into `ai_prompts`. Tells the AI to extract wine fields (name, producer, region, country, vintage, varietal, blend, style, body, tastingNotes, etc.) from uploaded images/files (label photos, wine lists, tasting sheets).

### G2. Update `ingest-vision/index.ts`

**File**: `supabase/functions/ingest-vision/index.ts`

| Section | Change |
|---------|--------|
| Types | Add `WineDraft` interface + `ProductDraft` union |
| Schema | Add `WINE_DRAFT_SCHEMA` |
| Prompt lookup | Add `FILE_PROMPT_MAP: { prep_recipes: "ingest-file-prep-recipe", wines: "ingest-file-wine" }` |
| Schema selection | `isWine ? WINE_DRAFT_SCHEMA : PREP_RECIPE_DRAFT_SCHEMA` |
| User message text | Branch: wines get wine-specific text |
| Post-processing | Branch: wines get `slug` + `image` (string), recipes keep `slug` + `images[]` |

### G3. Update `ingest-file/index.ts`

**File**: `supabase/functions/ingest-file/index.ts`

Same changes as G2: WineDraft type, WINE_DRAFT_SCHEMA, FILE_PROMPT_MAP, dynamic prompt lookup, user message branching, schema selection, post-processing.

### G4. Files added to summary

| # | File | Action | What |
|---|------|--------|------|
| 19 | `supabase/functions/ingest-vision/index.ts` | Edit | WineDraft, WINE_DRAFT_SCHEMA, FILE_PROMPT_MAP, dynamic branching |
| 20 | `supabase/functions/ingest-file/index.ts` | Edit | Same as ingest-vision |
| 21 | `supabase/migrations/20260220210000_ingest_file_wine_prompt.sql` | **New** | Prompt: `ingest-file-wine` (EN+ES) |

**Updated totals: 6 new files, 14 edited files, 2 new migrations.**

---

## Phase H: Deployment

### H1. Push all migrations

```bash
npx supabase db push
```

Applies:
- `20260220195010_ingest_wine_prompts.sql` — chat + extract prompts
- `20260220210000_ingest_file_wine_prompt.sql` — file/image upload prompt

### H2. Deploy edge functions

```bash
npx supabase functions deploy ingest
npx supabase functions deploy ingest-vision
npx supabase functions deploy ingest-file
```

### H3. TypeScript verification

```bash
npx tsc --noEmit
```

Must report 0 errors.

---

## Implementation Order

1. **A1-A2**: Types + context (foundation — everything depends on this). Start with type guards + rename `updateDraft` → `updatePrepDraft` to verify existing prep recipe flow still compiles.
2. **A3**: Enable wine in PRODUCT_TYPES + IngestWizard
3. **B1-B2**: WineEditor + WineImageEditor (can test in isolation with mock dispatch)
4. **C1-C2**: Extract BodyIndicator + WineIngestPreview
5. **D1-D6**: Wire into IngestPage — editor/preview/publish/validate/edit-load/resume/delete/hooks/DraftPreviewCard/ChatPanel
6. **E1-E5**: Edge function + prompts + migration (AI chat works for wine)
7. **F1-F3**: Web enrichment (polish feature, can ship without)
8. **G1-G3**: Make ingest-vision & ingest-file wine-aware (image/file upload support)
9. **H1-H3**: Deploy — push migrations, deploy 3 edge functions, verify TypeScript

**Run `npx tsc --noEmit` after each phase.**

---

## Verification

1. `npx tsc --noEmit` — 0 errors after each phase
2. Existing prep recipe flow: create, edit, publish — verify no regression
3. IngestWizard → select Wine → Start → opens session with WineEditor
4. AI chat: "Add Château Margaux 2018, a full-bodied Bordeaux blend" → draft populates wine fields
5. Editor: all fields editable, style/body dropdowns work, image upload works
6. Preview: matches WineCardView layout (image left portrait, notes right, style badge, body dots)
7. Publish: creates row in `wines` table, generates embedding, navigates to `/wines`
8. Edit: Click pencil on WineCardView → opens editor pre-filled with existing wine data → Update works
9. Resume: Save wine draft → go to dashboard → click session card → wine editor loads (not prep recipe editor)
10. Delete: Delete a wine from editor → row removed from wines table, cache invalidated, navigates to dashboard
11. DraftPreviewCard: AI response in chat shows wine-specific preview (not ingredients/steps)
12. Web Enrich: Click "Enrich with Web" → suggestions appear → accept populates tasting notes
13. `npx supabase db push` — migration applies cleanly (both wine prompt migrations)
14. `npx supabase functions deploy ingest` — deploys without error
15. `npx supabase functions deploy ingest-vision` — deploys without error
16. `npx supabase functions deploy ingest-file` — deploys without error
17. Image upload: Upload a wine bottle label → AI extracts wine fields (NOT recipe fields)
18. File upload: Upload a wine list PDF → AI extracts wine data correctly
