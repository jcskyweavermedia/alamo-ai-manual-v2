# Phase 9: Save/Publish Pipeline — Updated Plan (2026-02-24)

## Status Summary

Phase 9 was defined as 10 steps in the master plan. After a full 5-agent codebase audit on 2026-02-24, **9 of 10 steps are fully implemented**, 1 was intentionally dropped, and **1 new critical gap** was discovered that was not in the original plan.

| # | Step | Status | Notes |
|---|------|--------|-------|
| 1 | Validate required fields | DONE | All 4 enabled product types, toast-based |
| 2 | Auto-generate slug from name | DONE | NFD normalization + 5-attempt dedup loop |
| 3 | INSERT into product table | DONE | All types, create + edit modes |
| 4 | Update session status + product_id | DONE | Bidirectional linkage (session → product, product → source_session_id) |
| 5 | Call /embed-products | DONE | Fire-and-forget, all 4 enabled types |
| 6 | Set ai_ingestion_meta | DONE | source_type, confidence_score, missing_fields, last_ai_generated_at |
| 7 | Write sub_recipe_links | N/A | Table intentionally dropped; JSONB refs are canonical |
| 8 | Write product_translations | DONE | All 5 types: 1st publish auto-translate + re-publish staleness check |
| 9 | Invalidate react-query cache | DONE | All 5 cache keys present (including beer_liquor) |
| 10 | Auto-save every 5s | DONE | 5s setInterval + beforeunload warning + isPublishing guard |

### Previously Planned Tasks — All Completed

| Task | Original Status | Current Status | When Fixed |
|------|----------------|----------------|------------|
| A: Fix slug NFD normalization | Bug in 4 files | DONE in all 4 locations | Prior commit |
| B: Plate spec sub-recipe validation | Missing function | DONE — `validatePlateSpecComponentRefs()` exists + wired at line 1115 | Prior commit |
| C: Wire translations for wine/cocktail/plate spec | Missing | DONE — all 5 types have 1st-publish + staleness checks | Prior commit |
| D: Auto-save + beforeunload | Missing | DONE — 5s interval at lines 392-398, beforeunload at lines 403-411 | Prior commit |
| E: Beer & liquor cache key | Missing | DONE — `beer_liquor: 'beer-liquor'` at line 80 | Prior commit |

---

## Remaining Scope of Work

### Task F: Implement `handleRetranslateAndPublish()` (Critical — Runtime Crash)

**Problem**: The stale translations warning dialog has a "Re-translate & Publish" button (IngestPage.tsx ~line 2324) that calls `handleRetranslateAndPublish`, but **this function is never defined**. Clicking the button will crash at runtime with `ReferenceError: handleRetranslateAndPublish is not defined`.

**Affected UI flow**:
1. Admin edits an existing published product (wine, cocktail, prep recipe, or plate spec)
2. Changes a translated field (e.g., tasting notes)
3. Clicks "Publish"
4. Staleness check detects that existing translations reference old text
5. Warning dialog appears: "Translations are stale. Re-translate & Publish?"
6. User clicks "Re-translate & Publish" → **CRASH**

**Impact**: All 4 enabled product types in edit/re-publish mode when translations exist.

**File to modify**: `src/pages/IngestPage.tsx`

**Implementation**:

> **Audit note (2026-02-24)**: The original sketch had 3 issues caught by the final audit team. All corrected below.

```typescript
const handleRetranslateAndPublish = useCallback(async () => {
  if (!user || !state.draft) return;

  const productTable = ACTIVE_TYPE_TABLE[state.activeType];
  if (!productTable) return;

  const productId = state.editingProductId;
  if (!productId) return;

  setShowStaleWarning(false);
  setIsPublishing(true);

  try {
    // 1. Convert camelCase draft → snake_case DB shape for extractTranslatableTexts()
    //    CRITICAL: extractTranslatableTexts() expects snake_case keys (tasting_notes, not tastingNotes)
    //    Follow the same conversion pattern used in each product type's publish handler.
    let dbData: Record<string, unknown>;

    if (isWineType) {
      const wd = state.draft as WineDraft;
      dbData = {
        tasting_notes: wd.tastingNotes,
        producer_notes: wd.producerNotes,
        notes: wd.notes,
      };
    } else if (isCocktailType) {
      const cd = state.draft as CocktailDraft;
      dbData = {
        procedure: cd.procedure,
        tasting_notes: cd.tastingNotes,
        description: cd.description,
        notes: cd.notes,
      };
    } else if (isPlateSpecType) {
      const ps = state.draft as PlateSpecDraft;
      dbData = {
        assembly_procedure: ps.assemblyProcedure,
        notes: ps.notes,
      };
    } else {
      // prep_recipe — uses categories, mirror handlePublish logic
      const rd = state.draft as PrepRecipeDraft;
      dbData = {
        name: rd.name,
        ingredients: rd.ingredients,
        procedure: rd.procedure,
        training_notes: rd.trainingNotes,
      };
    }

    const texts = extractTranslatableTexts(productTable, dbData);

    // 2. Re-translate all fields
    if (texts.length > 0) {
      const results = await translateFields(productTable, productId, texts);
      if (results.length > 0) {
        const merged = results.map(r => ({
          fieldPath: r.fieldPath,
          sourceText: texts.find(t => t.fieldPath === r.fieldPath)?.sourceText ?? '',
          translatedText: r.translatedText,
        }));
        await saveTranslations(productTable, productId, merged);
      }
    }

    // 3. For plate specs, also re-translate FOH dish guide
    //    CRITICAL: FohPlateSpecDraft does NOT have an `id` field — must query DB
    //    Uses same pattern as handlePublishPlateSpec lines 1196-1200
    if (isPlateSpecType && (state.draft as PlateSpecDraft).dishGuide) {
      const { data: existingDg } = await supabase
        .from('foh_plate_specs')
        .select('id')
        .eq('plate_spec_id', productId)
        .maybeSingle();

      if (existingDg) {
        const dg = (state.draft as PlateSpecDraft).dishGuide!;
        const fohDbData: Record<string, unknown> = {
          short_description: dg.shortDescription,
          detailed_description: dg.detailedDescription,
          notes: dg.notes,
        };
        const fohTexts = extractTranslatableTexts('foh_plate_specs', fohDbData);
        if (fohTexts.length > 0) {
          const fohResults = await translateFields('foh_plate_specs', existingDg.id, fohTexts);
          if (fohResults.length > 0) {
            const fohMerged = fohResults.map(r => ({
              fieldPath: r.fieldPath,
              sourceText: fohTexts.find(t => t.fieldPath === r.fieldPath)?.sourceText ?? '',
              translatedText: r.translatedText,
            }));
            await saveTranslations('foh_plate_specs', existingDg.id, fohMerged);
          }
        }
      }
    }

    // 4. Now publish with skipStaleWarning=true to avoid re-triggering the dialog
    if (isPlateSpecType) {
      await handlePublishPlateSpec(false, true);
    } else {
      await handlePublish(false, true);
    }
  } catch (err) {
    console.error('handleRetranslateAndPublish failed:', err);
    toast({
      title: 'Translation failed',
      description: 'Could not re-translate. You can still publish without re-translating.',
    });
    setIsPublishing(false);
  }
}, [user, state, isWineType, isCocktailType, isPlateSpecType, translateFields, saveTranslations, handlePublish, handlePublishPlateSpec, toast]);
```

**Key design decisions**:
- Must call `setShowStaleWarning(false)` before re-publishing to close the dialog
- **`skipStaleWarning` parameter already exists** — both `handlePublish(skipImageWarning, skipStaleWarning)` and `handlePublishPlateSpec(skipImageWarning, skipStaleWarning)` accept it (line 416, line 1087). Pass `(false, true)` to skip re-triggering.
- **camelCase → snake_case conversion required** — `extractTranslatableTexts()` expects DB-shape keys. Each product type needs type-specific conversion (same pattern as existing publish handlers).
- **FOH dish guide id must be queried from DB** — `FohPlateSpecDraft` does not have an `id` field. Query `foh_plate_specs` by `plate_spec_id` to find the existing record (same pattern as lines 1196-1200).
- Plate spec: handles BOTH BOH and FOH translations
- On translation failure: show toast but don't block — user can still publish without translation
- Must reset `isPublishing` on error
- **Dependency array**: Uses full `state` object (not individual fields) for consistency with `handlePublish`/`handlePublishPlateSpec`. `extractTranslatableTexts` is a pure import — NOT included.

**No state additions needed** — the `skipStaleWarning` parameter already works via function arguments.

**Integration points** (already wired in dialog, only handler missing):
- Line ~2324: "Re-translate & Publish" button `onClick={handleRetranslateAndPublish}` — **needs the function defined**
- Line ~2315: "Publish Anyway" button already calls `handlePublishPlateSpec(false, true)` / `handlePublish(false, true)` — **already works**
- Cancel button via `<AlertDialogCancel>` — **already works**

---

### Task G: Add Beer/Liquor Table Mappings (Low — Future-Proofing)

**Problem**: `ACTIVE_TYPE_TABLE` and `TABLE_TO_ACTIVE_TYPE` are missing `beer_liquor` entries. If beer/liquor ingestion is ever enabled, the publish handler would silently fall back to `prep_recipes` table.

**Current code** (IngestPage.tsx lines 67-72, 92-97):
```typescript
const ACTIVE_TYPE_TABLE: Record<string, string> = {
  prep_recipe: 'prep_recipes',
  plate_spec: 'plate_specs',
  wine: 'wines',
  cocktail: 'cocktails',
  // beer_liquor: MISSING
};

const TABLE_TO_ACTIVE_TYPE: Record<string, ProductType> = {
  prep_recipes: 'prep_recipe',
  plate_specs: 'plate_spec',
  wines: 'wine',
  cocktails: 'cocktail',
  // beer_liquor_list: MISSING
};
```

**Fix**:
```typescript
const ACTIVE_TYPE_TABLE: Record<string, string> = {
  prep_recipe: 'prep_recipes',
  plate_spec: 'plate_specs',
  wine: 'wines',
  cocktail: 'cocktails',
  beer_liquor: 'beer_liquor_list',
};

const TABLE_TO_ACTIVE_TYPE: Record<string, ProductType> = {
  prep_recipes: 'prep_recipe',
  plate_specs: 'plate_spec',
  wines: 'wine',
  cocktails: 'cocktail',
  beer_liquor_list: 'beer_liquor',
};
```

**Also add to `ACTIVE_TYPE_LABEL`** (if missing):
```typescript
const ACTIVE_TYPE_LABEL: Record<string, string> = {
  prep_recipe: 'Prep Recipe',
  plate_spec: 'Plate Spec',
  wine: 'Wine',
  cocktail: 'Cocktail',
  beer_liquor: 'Beer & Liquor',
};
```

**Effort**: Trivial (5 min). No functional impact until beer/liquor editor is built.

---

## Implementation Order

| Order | Task | Priority | Effort | Dependencies |
|-------|------|----------|--------|--------------|
| 1 | Task F: `handleRetranslateAndPublish()` | Critical | Medium (2-3 hrs) | None |
| 2 | Task G: Beer/liquor table mappings | Low | Trivial (5 min) | None |

Tasks F and G are independent and can be implemented in parallel.

---

## Verification Checklist

### Task F — Re-translate & Publish

**Setup**: Must have a published product with existing translations.

- [ ] Edit published wine → change tasting notes → Publish → staleness warning appears
- [ ] Click "Re-translate & Publish" → translations are regenerated → product publishes successfully
- [ ] Verify `product_translations` table has updated `source_text` and `translated_text`
- [ ] Edit published cocktail → same flow → works
- [ ] Edit published prep recipe → same flow → works
- [ ] Edit published plate spec → same flow → BOTH BOH and FOH translations regenerated
- [ ] If translation API fails → error toast shown, publish does NOT proceed (or graceful fallback)
- [ ] Click "Skip & Publish Without Translating" → publishes without re-translating → old translations remain
- [ ] Click "Cancel" → dialog closes, no publish
- [ ] Auto-save does NOT fire during re-translate flow (`isPublishing` guard)
- [ ] No runtime errors in console

### Task G — Beer/Liquor Mappings

- [ ] `ACTIVE_TYPE_TABLE` includes `beer_liquor: 'beer_liquor_list'`
- [ ] `TABLE_TO_ACTIVE_TYPE` includes `beer_liquor_list: 'beer_liquor'`
- [ ] `ACTIVE_TYPE_LABEL` includes `beer_liquor: 'Beer & Liquor'`
- [ ] Delete handler correctly resolves `beer_liquor_list` → cache key `'beer-liquor'`
- [ ] No TypeScript errors (`npx tsc --noEmit`)

### General

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] All existing publish flows still work (regression test: wine, cocktail, prep recipe, plate spec)
- [ ] No new console warnings/errors
- [ ] Stale translation flow works end-to-end for all 4 enabled types

---

## Files Modified (Summary)

| File | Tasks | Changes |
|------|-------|---------|
| `src/pages/IngestPage.tsx` | F, G | Add `handleRetranslateAndPublish()`, add beer/liquor to table mappings |

---

## Out of Scope (Deferred)

These were identified during audit but are NOT part of Phase 9:

1. **Beer/liquor editor UI** — Separate phase; `enabled: false` in PRODUCT_TYPES
2. **Inline validation feedback** (red borders on invalid fields) — Phase 10 polish
3. **Error aggregation** (show all errors at once vs one-at-a-time) — Phase 10 polish
4. **Translation error visibility** — `.catch(() => {})` swallows failures silently; consider warning toast (matches existing pattern)
5. **FOH translatable field expansion** — `flavor_profile`, `allergy_notes`, `upsell_notes` could be added to TRANSLATABLE_FIELDS
6. **DB CHECK constraints** on product tables — separate migration, low priority
7. **Fix existing broken slugs** — one-time manual audit after deployment (if any exist from pre-NFD-fix era)

---

## Audit History

| Date | Auditor | Findings |
|------|---------|----------|
| Original | Single-pass analysis | 5 tasks (A-E): 2 bugs, 2 gaps, 1 quick fix |
| 2026-02-24 | 5-agent team audit | Tasks A-E all completed in prior commits; 1 new critical gap (Task F) + 1 low-priority gap (Task G) discovered |

### Agent Team Composition (2026-02-24 Audit)

| Agent | Role | Key Finding |
|-------|------|-------------|
| Schema Auditor | DB state verification | All 8 checks PASS — 15 columns, 6 RLS, FKs, ai_ingestion_meta, embeddings all correct |
| Slug & Validation Auditor | Tasks A & B verification | Both ALREADY FIXED — NFD normalization in all 4 files, `validatePlateSpecComponentRefs()` exists and wired |
| Translation Auditor | Task C verification | All 5 types have 1st-publish auto-translate + staleness checks; beer/liquor deferred (disabled) |
| Auto-Save & Cache Auditor | Tasks D & E verification | Both IMPLEMENTED — 5s auto-save + beforeunload + beer_liquor cache key present |
| Integration Auditor | End-to-end pipeline | 9/10 steps DONE; discovered `handleRetranslateAndPublish()` missing (Task F) |
