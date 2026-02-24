# Phase 6: Translation System

> **Goal**: Let admins translate product content from English to Spanish using AI-assisted batch translation, with review/approval before publishing. Translations are viewing-only — no impact on search, embeddings, or FTS.

---

## 1. Architecture Overview

### Data Flow

```
Admin opens product → clicks "Translate" tab/button
  → TranslationSheet opens (bottom sheet)
  → Shows all translatable fields with current English text
  → Admin clicks "Translate All" (or selects specific fields)
  → Frontend calls /ingest edge function with mode: "translate"
  → Edge function sends batch to gpt-4o-mini for translation
  → Returns translated text per field
  → Admin reviews each translation in the sheet
  → Admin approves/edits → upsert to product_translations table
  → Badge on product card shows translation status
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Translation storage | Overlay table (`product_translations`) | Non-destructive; English stays in source tables |
| AI model | gpt-4o-mini | Cost-effective for translation, good quality |
| Translation trigger | Manual batch (not auto) | Chef controls timing and quality |
| Publish gate | Soft (warning, not blocking) | Products usable in English without translations |
| Staleness detection | Compare `source_text` snapshot vs current English | No extra column needed |
| Language support | EN → ES only (schema supports future langs) | Current business requirement |
| Search/FTS impact | None | Translations are viewing-only |

---

## 2. Existing Infrastructure

### Already Built (Phase 1 Migration)

The `product_translations` table already exists in `20260220000000_phase1_ingestion_foundation.sql`:

```sql
CREATE TABLE public.product_translations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  product_table TEXT NOT NULL CHECK (product_table IN (
    'prep_recipes','plate_specs','foh_plate_specs','wines','cocktails','beer_liquor_list'
  )),
  product_id UUID NOT NULL,
  field_path TEXT NOT NULL,        -- e.g. "procedure[0].steps[1].instruction"
  source_lang TEXT NOT NULL DEFAULT 'en',
  translated_lang TEXT NOT NULL DEFAULT 'es',
  source_text TEXT NOT NULL,       -- snapshot of English at translation time
  translated_text TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_table, product_id, field_path, translated_lang)
);
```

- RLS: Admin-only CRUD, authenticated SELECT
- Index: `idx_product_translations_lookup (product_table, product_id)`
- Trigger: Auto-updates `updated_at`

### Existing Components Used

- `useLanguage()` hook — detects user language preference (en/es)
- `LanguageToggle` — switches between EN/ES
- `TranslationBanner.tsx` — fallback banner when Spanish not available
- `IngestDraftContext` — full reducer for draft management
- `/ingest` edge function — two-call pipeline (chat + extract)

---

## 3. Translatable Fields by Product Type

### field_path Convention

Use dot notation with array indices for JSONB paths:

| Pattern | Example |
|---------|---------|
| Top-level string | `notes` |
| Nested string | `trainingNotes.notes` |
| Array of strings | `trainingNotes.common_mistakes[0]` |
| JSONB array item field | `procedure[0].group_name` |
| Deeply nested | `procedure[0].steps[1].instruction` |

### Per-Product Translatable Fields

#### prep_recipes
| field_path | Source Field | Notes |
|-----------|-------------|-------|
| `procedure[i].group_name` | Procedure group name | Short text |
| `procedure[i].steps[j].instruction` | Procedure step text | Main content |
| `training_notes.notes` | Training notes body | Paragraph |
| `training_notes.common_mistakes[k]` | Common mistake item | Short text |
| `training_notes.quality_checks[k]` | Quality check item | Short text |

#### plate_specs
| field_path | Source Field | Notes |
|-----------|-------------|-------|
| `assembly_procedure[i].group_name` | Assembly group name | Short text |
| `assembly_procedure[i].steps[j].instruction` | Assembly step text | Main content |
| `notes` | Plating notes | Paragraph |

#### foh_plate_specs (Dish Guides)
| field_path | Source Field | Notes |
|-----------|-------------|-------|
| `short_description` | Short description | 1-2 sentences |
| `detailed_description` | Detailed description | Paragraph |
| `notes` | Notes | Paragraph |

#### wines
| field_path | Source Field | Notes |
|-----------|-------------|-------|
| `tasting_notes` | Tasting notes | Paragraph |
| `producer_notes` | Producer notes | Paragraph |
| `notes` | General notes | Paragraph |

#### cocktails
| field_path | Source Field | Notes |
|-----------|-------------|-------|
| `procedure[i].instruction` | Procedure step | Short text |
| `tasting_notes` | Tasting notes | Paragraph |
| `description` | Description | Paragraph |
| `notes` | General notes | Paragraph |

#### beer_liquor_list
| field_path | Source Field | Notes |
|-----------|-------------|-------|
| `description` | Description | Paragraph |
| `notes` | General notes | Paragraph |

---

## 4. Implementation Steps

### Step 1: Translation Field Registry

**New file**: `src/lib/translatable-fields.ts`

A pure config module that maps each product type to its translatable fields:

```typescript
export interface TranslatableField {
  fieldPath: string;         // dot notation path
  label: string;             // human-readable label for UI
  isArray?: boolean;         // true for procedure steps, mistakes, etc.
  arrayItemField?: string;   // which field in the array item to translate
}

export const TRANSLATABLE_FIELDS: Record<string, TranslatableField[]> = {
  prep_recipes: [
    { fieldPath: 'procedure', label: 'Procedure Steps', isArray: true, arrayItemField: 'steps' },
    { fieldPath: 'training_notes.notes', label: 'Training Notes' },
    { fieldPath: 'training_notes.common_mistakes', label: 'Common Mistakes', isArray: true },
    { fieldPath: 'training_notes.quality_checks', label: 'Quality Checks', isArray: true },
  ],
  plate_specs: [
    { fieldPath: 'assembly_procedure', label: 'Assembly Steps', isArray: true, arrayItemField: 'steps' },
    { fieldPath: 'notes', label: 'Plating Notes' },
  ],
  // ... etc for each product type
};
```

**Purpose**: Single source of truth for what can be translated. Used by both the frontend (to build the UI) and the edge function (to know which fields to extract and translate).

---

### Step 2: `useProductTranslations` Hook

**New file**: `src/hooks/use-product-translations.ts`

Fetches existing translations for a product:

```typescript
function useProductTranslations(productTable: string, productId: string | null) {
  // Returns: { translations: Map<fieldPath, TranslationRow>, loading, error, refetch }
  // Queries: product_translations WHERE product_table = X AND product_id = Y AND translated_lang = 'es'
  // Groups results by field_path for O(1) lookup
}
```

**Staleness detection**: Compare `source_text` in the translation row vs the current English value in the product. If different → translation is stale (show warning badge).

---

### Step 3: Translation Edge Function Mode

**Modified file**: `supabase/functions/ingest/index.ts`

Add a new `translate` mode alongside existing `chat`/`extract`:

```
POST /ingest
{
  "mode": "translate",
  "product_table": "prep_recipes",
  "product_id": "uuid",
  "target_lang": "es",
  "fields": [
    { "field_path": "procedure[0].steps[0].instruction", "source_text": "Dice the onions..." },
    { "field_path": "training_notes.notes", "source_text": "Always check temperature..." },
    ...
  ]
}
```

**Response**:
```json
{
  "translations": [
    { "field_path": "procedure[0].steps[0].instruction", "translated_text": "Corta las cebollas..." },
    { "field_path": "training_notes.notes", "translated_text": "Siempre verifica la temperatura..." }
  ]
}
```

**Implementation details**:
- Uses `gpt-4o-mini` (not the more expensive models used for chat)
- Single API call with all fields batched in one prompt
- System prompt: "You are a professional restaurant operations translator. Translate the following English text to Spanish. Maintain culinary terminology, cooking measurements, and technical terms. Keep the same tone (instructional, professional). Return JSON."
- Structured output via `response_format: { type: "json_schema" }` for reliable parsing
- Max ~50 fields per batch (well within token limits for gpt-4o-mini)

---

### Step 4: `useTranslateProduct` Hook

**New file**: `src/hooks/use-translate-product.ts`

Orchestrates the translation flow:

```typescript
function useTranslateProduct() {
  // translateFields(productTable, productId, fields): Promise<TranslationResult[]>
  //   → Calls /ingest with mode: "translate"
  //   → Returns array of { fieldPath, translatedText }

  // saveTranslations(productTable, productId, translations, userId): Promise<void>
  //   → Upserts to product_translations table via supabase client
  //   → Sets is_approved = true, approved_by = userId, source_text = current English
}
```

---

### Step 5: TranslationSheet Component

**New file**: `src/components/ingest/editor/TranslationSheet.tsx`

Bottom sheet UI for batch translation review:

```
┌─────────────────────────────────────┐
│ 🌐 Translate to Spanish            │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [Translate All]  [Save All]     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ── Procedure Steps ──────────────── │
│                                     │
│ Step 1: "Dice the onions..."        │
│ ES: "Corta las cebollas..."    [✓]  │
│                                     │
│ Step 2: "Heat oil to 350°F"        │
│ ES: "Calienta aceite a 175°C" [✓]  │
│                                     │
│ ── Training Notes ───────────────── │
│                                     │
│ Notes: "Always check temp..."       │
│ ES: "Siempre verifica..."      [✓]  │
│                                     │
│ Common Mistakes:                    │
│ 1. "Over-seasoning..."             │
│ ES: "Exceso de sal..."         [✓]  │
│                                     │
│ [Cancel]              [Save ✓]      │
└─────────────────────────────────────┘
```

**UX Flow**:
1. Admin clicks "Translate" button on editor
2. Bottom sheet opens showing all translatable fields grouped by section
3. Each field shows English source text (read-only) and Spanish field (editable)
4. "Translate All" calls the edge function → populates all Spanish fields
5. Admin reviews, edits any field manually if needed
6. Checkmarks indicate approval per field
7. "Save" upserts all approved translations to `product_translations`

**Features**:
- Fields with existing translations show them pre-populated
- Stale translations (source changed since last translation) show a warning icon
- Individual "Re-translate" button per field for selective updates
- "Translate All" only translates fields that are empty or stale (skips up-to-date ones unless forced)

---

### Step 6: TranslationBadge Component

**New file**: `src/components/ingest/TranslationBadge.tsx`

Small status indicator shown on product cards and the editor:

| State | Badge | Color |
|-------|-------|-------|
| No translations | `🌐 Not translated` | Gray |
| Partially translated | `🌐 3/8 translated` | Amber |
| Fully translated | `🌐 Translated` | Green |
| Has stale translations | `🌐 Needs update` | Orange |

Placed on:
- IngestDashboard product list items (next to status badge)
- Editor header (next to product name)
- Publish confirmation dialog (as a reminder)

---

### Step 7: Wire into Existing Editors

**Modified files**:
- `src/components/ingest/editor/PrepRecipeEditor.tsx`
- `src/components/ingest/editor/WineEditor.tsx`
- `src/components/ingest/editor/CocktailEditor.tsx`

Changes per editor:
1. Add "Translate" button in the editor toolbar/header
2. Button opens `TranslationSheet` as a bottom sheet
3. Pass product type, product ID, and current draft data
4. After saving translations, refetch translation badge status

---

### Step 8: Soft Publish Gate

**Modified file**: Publish flow in each editor

When admin clicks "Publish":
- Check if product has any translations
- If no translations exist → show soft warning: "This product has not been translated to Spanish. Publish anyway?"
- If translations are stale → show warning: "Some translations may be outdated. Review translations before publishing?"
- Neither case blocks publishing — admin can always proceed

---

### Step 9: Viewer Translation Overlay

**Modified files**: Product viewer hooks

When a user views a product in Spanish:
1. Fetch product data (English) as normal
2. Fetch `product_translations` for that product
3. Overlay translated text onto the English data before rendering
4. If a field has no translation → show English with fallback banner

**New hook**: `src/hooks/use-translated-product.ts`

```typescript
function useTranslatedProduct<T>(product: T, productTable: string, productId: string): T {
  const { language } = useLanguage();
  const { translations } = useProductTranslations(productTable, productId);

  if (language === 'en' || !translations.size) return product;

  // Deep clone product, apply translations at each field_path
  return applyTranslations(product, translations);
}
```

---

## 5. File Manifest

### New Files (5)

| File | Description |
|------|-------------|
| `src/lib/translatable-fields.ts` | Field registry: which fields are translatable per product type |
| `src/hooks/use-product-translations.ts` | Fetch existing translations for a product |
| `src/hooks/use-translate-product.ts` | Call edge function + save translations |
| `src/components/ingest/editor/TranslationSheet.tsx` | Bottom sheet UI for batch translation review |
| `src/components/ingest/TranslationBadge.tsx` | Status badge for translation completeness |

### Modified Files (6)

| File | Change |
|------|--------|
| `supabase/functions/ingest/index.ts` | Add `translate` mode handler |
| `src/components/ingest/editor/PrepRecipeEditor.tsx` | Add Translate button + sheet |
| `src/components/ingest/editor/WineEditor.tsx` | Add Translate button + sheet |
| `src/components/ingest/editor/CocktailEditor.tsx` | Add Translate button + sheet |
| `src/hooks/use-translated-product.ts` | New hook for viewer overlay |
| Publish flow (per editor) | Soft translation warning |

### Existing (No Changes Needed)

| File | Status |
|------|--------|
| `product_translations` table | Already created in Phase 1 migration |
| `useLanguage()` hook | Already works |
| `LanguageToggle` component | Already works |
| `TranslationBanner.tsx` | Already shows fallback message |
| Search functions / FTS / embeddings | No changes — translations are viewing-only |

---

## 6. Edge Function: Translate Mode Specification

### Request Contract

```typescript
interface TranslateRequest {
  mode: "translate";
  product_table: string;
  product_id: string;
  target_lang: "es";
  fields: Array<{
    field_path: string;
    source_text: string;
  }>;
}
```

### System Prompt

```
You are a professional bilingual translator for a high-end steakhouse restaurant.
Translate the following English restaurant operations text to Latin American Spanish.

Rules:
- Maintain all culinary terminology accurately (e.g., "sear" → "sellar", "deglaze" → "deglasear")
- Keep cooking measurements in their original units (°F, oz, cups) — do not convert
- Preserve the instructional, professional tone
- Keep proper nouns unchanged (brand names, recipe names)
- For ingredient names, use Latin American Spanish variants (not Castilian)
- If a term has no standard Spanish equivalent, keep the English term in quotes
- Translate each field independently; do not add or remove content
```

### Response Schema

```json
{
  "type": "object",
  "properties": {
    "translations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "field_path": { "type": "string" },
          "translated_text": { "type": "string" }
        },
        "required": ["field_path", "translated_text"]
      }
    }
  },
  "required": ["translations"]
}
```

### Token Budget

- Input: ~50 fields × ~100 tokens avg = ~5,000 tokens
- System prompt: ~200 tokens
- Output: ~5,000 tokens (same size as input)
- Total: ~10,200 tokens per batch
- Cost: ~$0.0015 per product translation (gpt-4o-mini pricing)

---

## 7. Staleness Detection

### How It Works

1. When a translation is saved, `source_text` captures the English value at that moment
2. When loading translations, compare `source_text` vs the current English value in the product
3. If they differ → translation is stale

### Implementation

```typescript
function isStale(translation: TranslationRow, currentEnglishValue: string): boolean {
  return translation.source_text !== currentEnglishValue;
}
```

### No Extra Migration Needed

The `source_text` column already exists in the `product_translations` table. Staleness is computed at read time — no DB changes required.

---

## 8. Out of Scope

These items are explicitly NOT part of Phase 6:

- Auto-translation on publish (translations are manual, admin-controlled)
- Inline per-field translation in the editor (batch approach via bottom sheet instead)
- Real-time translation (no WebSocket/streaming)
- Translation memory or glossary management
- Additional languages beyond Spanish
- Search/FTS in Spanish (translations are viewing-only)
- Spanish embeddings for product search
- Translation of ingredient/component names (these are culinary terms, kept in English)
- Automated staleness notification/email alerts

---

## 9. UX Workflow: Where Translation Fits

### Recommended Workflow

```
1. Create product via chat/manual entry (English)
2. Review & edit all fields
3. Add images
4. Link sub-recipes (prep recipes)
5. ──── TRANSLATE (Phase 6) ────
6. Open TranslationSheet
7. Click "Translate All"
8. Review AI translations
9. Approve / edit as needed
10. Save translations
11. ──── PUBLISH ────
12. Soft gate reminds if translations missing
```

### Reminder Triggers

Translation reminders appear at three points:
1. **TranslationBadge** on the editor header — always visible during editing
2. **TranslationBadge** on dashboard product cards — visible when browsing products
3. **Soft publish gate** — warning dialog when publishing without translations

### Edit After Publish

If an admin edits a published product's English content:
- Existing translations become stale (detected automatically)
- TranslationBadge changes to "Needs update"
- Admin can re-translate only stale fields (efficient partial update)

---

## 10. Verification Plan

### Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Open TranslationSheet for untranslated prep recipe | All fields shown, Spanish columns empty |
| 2 | Click "Translate All" | Edge function called, all Spanish fields populated |
| 3 | Edit a translated field manually | Field updates in the sheet |
| 4 | Save translations | Upserted to product_translations, badge updates to "Translated" |
| 5 | View product in Spanish | Translated text displayed, English fallback for missing |
| 6 | Edit English source after translating | Badge changes to "Needs update" |
| 7 | Re-translate stale fields only | Only stale fields sent to AI, others preserved |
| 8 | Publish without translations | Soft warning shown, can proceed |
| 9 | Translate wine (simple fields) | 3 text fields translated correctly |
| 10 | Translate cocktail with procedure steps | Array items translated individually |
| 11 | View partially translated product in Spanish | Translated fields in Spanish, others in English with banner |
| 12 | Translation with culinary terms | Terms preserved correctly (°F, brand names, etc.) |

---

## 11. Implementation Order

| Step | Deliverable | Depends On |
|------|-------------|------------|
| 1 | `translatable-fields.ts` registry | — |
| 2 | `use-product-translations.ts` hook | Step 1 |
| 3 | Translate mode in `/ingest` edge function | — |
| 4 | `use-translate-product.ts` hook | Step 3 |
| 5 | `TranslationSheet.tsx` component | Steps 1, 2, 4 |
| 6 | `TranslationBadge.tsx` component | Step 2 |
| 7 | Wire into editors (PrepRecipe, Wine, Cocktail) | Steps 5, 6 |
| 8 | Soft publish gate | Step 6 |
| 9 | Viewer translation overlay hook | Step 2 |
| 10 | End-to-end testing | All steps |
