# Decouple Translation from Build Pipeline — On-Demand Translation

## Context

Translation is currently Phase 4 of the 4-phase build pipeline (Structure → Content → Layout → Translation). This adds significant build time and translates content the user hasn't reviewed yet. The user wants to review the EN course first, then translate on-demand before publishing.

**Goal**: Remove translation from the automated build pipeline. Add an on-demand 🌐 Translate button in the toolbar and a pre-publish prompt asking "Want to translate before publishing?"

**The `handleTranslate` edge function already exists and works — no backend changes needed.**

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-build-course.ts` | Remove Phase 4 translation loop, back to 3 phases |
| `src/contexts/CourseBuilderContext.tsx` | Add `translateCourse` function to context |
| `src/components/course-builder/CourseBuilderTopBar.tsx` | Add Translate button + pre-publish dialog |
| `src/components/course-builder/PhaseStepIndicator.tsx` | Remove `translation` from PHASE_ICONS |
| `src/components/course-builder/PhaseAnimation.tsx` | Remove `translation` from progress labels |

---

## Step 1: Remove Phase 4 from Build Pipeline

**File**: `src/hooks/use-build-course.ts`

### 1A. Remove translation phase from phases config (~line 273)

Change from 4 phases to 3, reduce estimated time:
```typescript
phases: [
  { id: 'structure', label: 'Structure Planner', status: 'waiting' },
  { id: 'content', label: 'Content Writer', status: 'waiting' },
  { id: 'layout', label: 'Layout & Assembly', status: 'waiting' },
],
estimatedSeconds: 120,
```

### 1B. Delete Phase 4 translation loop (~lines 568-626)

Remove the entire block:
```typescript
// ── Phase 4: Translation (per-section, non-fatal) ────────────────
if (!cancelledRef.current && layoutSuccessIds.size > 0) { ... }
```

### 1C. Clean up unused imports

Remove `validateTranslationClient` import if it becomes unused in this file (keep the function definition in the file — it will be reused by the context).

---

## Step 2: Add `translateCourse` to Context

**File**: `src/contexts/CourseBuilderContext.tsx`

Add a `translateCourse` function that:
1. Finds sections with `generationStatus === 'generated'` (untranslated)
2. Calls `build-course` with `step: 'translate'` per-section sequentially
3. First section call includes `translate_page_header: true`
4. Dispatches `AI_HYDRATE_SECTIONS` with `generationStatus: 'translated'` on success
5. Returns `{ translated: number; failed: number; total: number }`
6. Accepts `onProgress` callback for UI updates
7. Failures are non-fatal (section stays `generated`)

Export `translateCourse` from the context value and the `useCourseBuilder` hook.

---

## Step 3: Translate Button + Pre-Publish Dialog

**File**: `src/components/course-builder/CourseBuilderTopBar.tsx`

### 3A. 🌐 Translate button (between Save and Publish)

Show when:
- Course has sections with `generationStatus === 'generated'`
- Not currently translating or building

```
[Save Draft] [🌐 Translate] [Publish]
```

- Uses `Languages` icon from lucide-react
- Shows progress while translating: "Translating 2/5..."
- Disappears when all sections are `translated`

### 3B. Pre-publish intercept

When user clicks Publish and untranslated sections exist, show a dialog:

```
┌──────────────────────────────────────────────┐
│  🌐 Translate before publishing?             │
│                                              │
│  3 of 5 sections haven't been translated     │
│  to Spanish yet.                             │
│                                              │
│  [Publish EN Only]    [Translate & Publish]  │
└──────────────────────────────────────────────┘
```

- **Publish EN Only** → publish immediately (ES falls back to EN in player)
- **Translate & Publish** → translate all sections, then publish

When ALL sections are already `translated` → publish directly, no dialog.

### 3C. Local state for translation

```typescript
const [isTranslating, setIsTranslating] = useState(false);
const [translateProgress, setTranslateProgress] = useState('');
const [showPublishDialog, setShowPublishDialog] = useState(false);
```

### 3D. Computed flags

```typescript
const untranslatedCount = state.sections.filter(s => s.generationStatus === 'generated').length;
const hasUntranslated = untranslatedCount > 0;
const allTranslated = state.sections.length > 0 && state.sections.every(
  s => s.generationStatus === 'translated' || s.generationStatus === 'reviewed'
);
```

### 3E. STRINGS additions (both en and es)

```
translate / traducir
translating / traduciendo
publishDialogTitle / ¿Traducir antes de publicar?
publishDialogDesc (with count) / X de Y secciones no han sido traducidas al español.
publishEnOnly / Publicar solo en inglés / Publish EN Only
translateAndPublish / Traducir y publicar / Translate & Publish
```

---

## Step 4: Clean Up Phase Indicators

### 4A. `PhaseStepIndicator.tsx`

Remove `translation: Languages` from `PHASE_ICONS`. Remove `Languages` import if unused.

### 4B. `PhaseAnimation.tsx`

Remove `translation: 'Translating to Spanish'` from the progress bar `labels` map.

---

## UX Flow Summary

### During Build (3 phases)
```
Structure Planner ✅ → Content Writer ✅ → Layout & Assembly ✅
→ Sections status: 'generated' (green) — EN-only, ready for review
```

### After Build — Toolbar
```
[Back] [Title] [Status] ··· [Editor tools] [EN|ES] [🌐 Translate] [Save] [Publish]
```

### User clicks 🌐 Translate
- Button shows spinner + "Translating 2/5..."
- Sections flip green→teal as each completes
- Toast: "Translation complete!" or "3 translated, 1 failed"
- Button disappears when all done

### User clicks Publish (untranslated)
- Dialog: "Translate before publishing?"
- Two options: Publish EN Only / Translate & Publish

### User clicks Publish (all translated)
- Publishes directly, no dialog

---

## What We're NOT Changing

- **`handleTranslate` edge function** — already works (note: rejects re-translation of already-translated sections)
- **Status colors** — `generated` green, `translated` teal stay as-is
- **Course player** — already falls back to EN
- **DB schema** — no migrations needed

## Implementation Status: COMPLETE

- `validateTranslationClient` removed (dead code after Phase 4 removal)
- `translateCourse` added to context with `translatingRef` lock, `aiGenerating` dispatch, save-before/after
- Auto-save suppressed during translation (`!state.aiGenerating` guard)
- "Translate & Publish" checks result before publishing (won't publish if all translations fail)
- Publish button guarded against `state.aiGenerating`
- Progress display uses actual translatable count, not total sections
- Failure messages localized (EN/ES)
- `translate_page_header` keyed on `section.sortOrder === 0` (not array index)

---

## Verification

1. `npx tsc --noEmit` — 0 errors
2. Build a course → completes in 3 phases (no translation step visible)
3. Sections show `generated` (green) after build
4. Click 🌐 Translate → sections flip to `translated` (teal)
5. Switch to ES preview → translated content visible
6. Click Publish with untranslated sections → dialog appears
7. "Publish EN Only" → publishes, ES shows EN fallback
8. "Translate & Publish" → translates then publishes
