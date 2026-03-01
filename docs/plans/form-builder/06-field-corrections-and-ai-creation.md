# Phase 6: Field Label Corrections + AI Form Creation

> **Status:** Planning
> **Date:** 2026-02-26
> **Authors:** Technical Architect, Database Expert, UI/UX Designer, Devil's Advocate (all Opus 4.6)
> **Dependencies:** Phase 5 complete (Form Builder Admin, AI Instruction Refinement, Settings Auto-Population)
> **Estimated effort:** 2 sessions (10 files modified, 1 new component)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Part A: Field Label Spell-Checking](#3-part-a-field-label-spell-checking)
4. [Part B: AI Form Creation](#4-part-b-ai-form-creation)
5. [Database Impact](#5-database-impact)
6. [UI/UX Design](#6-uiux-design)
7. [Risk Assessment](#7-risk-assessment)
8. [Implementation Order](#8-implementation-order)
9. [Verification Plan](#9-verification-plan)

---

## 1. Executive Summary

Two features extend the existing Form Builder:

**Part A — Field Label Spell-Checking:** The "Refine with AI" button already corrects titles, descriptions, icons, instructions, and tools. But it does NOT touch field labels. If an admin types "empoloyeeee name" as a field label, it passes through uncorrected. We extend the refinement flow to also return `suggestedFieldCorrections` and apply them atomically (one Undo reverts everything).

**Part B — AI Form Creation from Description:** The entire backend stack is **already built and deployed** but **not wired to any UI**. The `generate-form-template` edge function, `useGenerateTemplate` hook, `template-mapper`, and reducer actions (`AI_GENERATE_START/SUCCESS/ERROR`) all exist. We need a creation dialog component and navigation wiring, plus 2 blocking bug fixes.

**Complexity verdict:** Low (Part A) + Medium (Part B). No new edge functions. No database migrations. Totally doable.

---

## 2. Architecture Overview

### 2.1 Current Data Flow — Refinement

```
Admin clicks "Refine with AI"
       |
       v
AdminFormBuilderPage.handleRefine()
       |
       v
useRefineInstructions().refine({
  rawInstructions, templateContext, language, groupId, currentMetadata
})
       |
       v
POST /functions/v1/refine-form-instructions
       |
       v
OpenAI Structured Outputs (json_schema, strict: true)
       |
       v
RefineInstructionsResult {
  refinedInstructions, refinedInstructionsEs,
  recommendedTools, suggestedSystemPrompt,
  suggestedTitleEn/Es, suggestedDescriptionEn/Es,
  suggestedIcon, explanation, suggestions
}
       |
       v
dispatch('ACCEPT_REFINEMENT_RESULT', { ...all fields })
       |
       v
Reducer: pushUndo() → apply all changes atomically
       |
       v
Auto-save (3s debounce) → Supabase UPDATE
```

**Part A extends this flow** by adding `suggestedFieldCorrections` to the response and applying them in the same reducer case.

### 2.2 Current Data Flow — Form Generation (Backend Only)

```
generate-form-template edge function (DEPLOYED)
       |
       v
Returns: { draft: { title_en, fields, ... }, confidence, aiMessage }
       |
       v
useGenerateTemplate hook (EXISTS, has bugs)
       |  BUG: mapGeneratedTemplate(data) should be (data.draft)
       |  BUG: does not pass groupId
       v
mapGeneratedTemplate() → Partial<BuilderState>
       |
       v
dispatch('AI_GENERATE_SUCCESS', payload) (REDUCER EXISTS)
```

**Part B wires this to a UI dialog** and fixes the 2 blocking bugs.

### 2.3 Files to Modify

| # | File | Part | Change |
|---|------|------|--------|
| 1 | `supabase/functions/refine-form-instructions/index.ts` | A | Add `suggestedFieldCorrections` to schema + prompt |
| 2 | `src/types/form-builder.ts` | A | Extend `RefineInstructionsResult` + `ACCEPT_REFINEMENT_RESULT` |
| 3 | `src/hooks/useRefineInstructions.ts` | A | Map new field from response |
| 4 | `src/contexts/BuilderContext.tsx` | A | Apply field corrections in reducer |
| 5 | `src/pages/admin/AdminFormBuilderPage.tsx` | A+B | Pass corrections in dispatch + consume AI draft |
| 6 | `src/hooks/useGenerateTemplate.ts` | B | Fix `data.draft` bug + add `groupId` |
| 7 | `src/lib/form-builder/template-mapper.ts` | B | Fix hyphen in key regex + set `instructionsRefined` |
| 8 | `src/components/form-builder/FormCreationDialog.tsx` | B | **NEW** — Creation dialog component |
| 9 | `src/pages/admin/AdminFormsListPage.tsx` | B | Wire dialog to "New Form" button |
| 10 | `supabase/functions/generate-form-template/index.ts` | B | Add `yes_no` to field type enum |

---

## 3. Part A: Field Label Spell-Checking

### 3.1 Edge Function — Add `suggestedFieldCorrections`

**File:** `supabase/functions/refine-form-instructions/index.ts`

The AI already receives all field labels in the `FIELDS_BLOCK` of the system prompt. We add a new output field and instruction.

#### Schema Addition

Add to the structured output JSON schema's `properties`:

```json
"suggestedFieldCorrections": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "key":      { "type": "string" },
      "label":    { "type": "string" },
      "label_es": { "type": "string" }
    },
    "required": ["key", "label", "label_es"],
    "additionalProperties": false
  }
}
```

Add `"suggestedFieldCorrections"` to the `required` array.

#### System Prompt Addition

Add this paragraph to the system prompt, after the field definitions block:

> "Review the field labels in the FIELDS block. If any have spelling errors, bad capitalization, grammatically incorrect phrasing, or missing/incorrect Spanish translations, include corrections in `suggestedFieldCorrections`. Use proper Title Case for English labels and standard capitalization for Spanish. Only include fields that actually need changes — return an empty array `[]` if all labels are correct. Use the field's `key` to identify it."

#### Validation

After parsing the AI response, filter corrections to only keys that exist in the input fields:

```typescript
const validKeys = new Set(
  templateContext.fields.map((f: { key: string }) => f.key)
);
const filteredCorrections = (parsed.suggestedFieldCorrections || [])
  .filter((c: { key: string }) => validKeys.has(c.key));
```

#### Token Budget

Increase `max_tokens` from 2200 → 2500. Field corrections are small (3 strings per correction), but a form with 20 misspelled labels needs buffer.

### 3.2 Types — Extend Interfaces

**File:** `src/types/form-builder.ts`

```typescript
// In RefineInstructionsResult:
suggestedFieldCorrections?: Array<{
  key: string;
  label: string;
  label_es: string;
}>;

// In ACCEPT_REFINEMENT_RESULT payload:
fieldCorrections?: Array<{
  key: string;
  label: string;
  label_es: string;
}>;
```

### 3.3 Hook — Map New Field

**File:** `src/hooks/useRefineInstructions.ts`

After the existing response mapping, add:

```typescript
suggestedFieldCorrections: Array.isArray(data.suggestedFieldCorrections)
  ? data.suggestedFieldCorrections
  : [],
```

### 3.4 Reducer — Apply Corrections Atomically

**File:** `src/contexts/BuilderContext.tsx`

In the `ACCEPT_REFINEMENT_RESULT` case, after existing field spreads:

```typescript
// Apply field label corrections (if any)
const correctedFields = action.payload.fieldCorrections?.length
  ? s.fields.map(f => {
      const fix = action.payload.fieldCorrections!.find(c => c.key === f.key);
      return fix
        ? { ...f, label: fix.label, label_es: fix.label_es || f.label_es }
        : f;
    })
  : undefined;

// In the return object:
...(correctedFields ? { fields: correctedFields } : {}),
```

This runs inside `pushUndo()` — a single Undo reverts everything including label corrections.

Also extend `takeSnapshot()` to capture `fields` (it should already since fields are part of the snapshot — verify).

### 3.5 Page — Pass Corrections in Dispatch

**File:** `src/pages/admin/AdminFormBuilderPage.tsx`

In `handleRefine`, add to the `ACCEPT_REFINEMENT_RESULT` dispatch:

```typescript
fieldCorrections: result.suggestedFieldCorrections,
```

---

## 4. Part B: AI Form Creation

### 4.1 Bug Fixes (Blocking — Must Fix First)

#### Bug 1: `data.draft` Unwrap Missing

**File:** `src/hooks/useGenerateTemplate.ts` (line ~32)

The edge function returns `{ draft: { title_en, ... }, confidence, ... }` but the hook passes the top-level object to the mapper:

```typescript
// CURRENT (BUG):
return mapGeneratedTemplate(data as GenerateResponse);

// FIX:
return mapGeneratedTemplate(data.draft as GenerateResponse);
```

Without this fix, every field in `mapGeneratedTemplate` reads `undefined` because `title_en` etc. are nested under `draft`.

#### Bug 2: Missing `groupId` Parameter

**File:** `src/hooks/useGenerateTemplate.ts`

The edge function requires `groupId` for usage tracking, but the hook doesn't accept or pass it:

```typescript
// Update params interface:
const generate = useCallback(async (params: {
  description: string;
  language?: 'en' | 'es';
  groupId: string;           // ADD
  existingTemplateContext?: string;
}) => {
  // ...
  const { data, error } = await supabase.functions.invoke(
    'generate-form-template',
    {
      body: {
        description: params.description,
        language: params.language || 'en',
        groupId: params.groupId,    // ADD
      },
    },
  );
  // ...
});
```

#### Bug 3: Hyphen in Key Regex

**File:** `src/lib/form-builder/template-mapper.ts`

The `sanitizeGeneratedFields()` function allows hyphens in keys:

```typescript
// CURRENT (allows hyphens):
.replace(/[^a-z0-9_-]/g, '_')

// FIX (match DB trigger regex: ^[a-z][a-z0-9_]{0,63}$):
.replace(/[^a-z0-9_]/g, '_')
```

Without this fix, AI-generated keys like `employee-name` pass client-side but fail the DB trigger.

#### Bug 4: Missing `instructionsRefined` Flag

**File:** `src/lib/form-builder/template-mapper.ts`

AI-generated instructions are already production quality. Add to the mapper return:

```typescript
instructionsRefined: true,
```

#### Bug 5: Missing `yes_no` Field Type

**File:** `supabase/functions/generate-form-template/index.ts`

The field type enum in the structured output schema has 17 types but omits `yes_no`. The app supports 18 types. Add `"yes_no"` to the enum array.

### 4.2 New Component — `FormCreationDialog`

**File:** `src/components/form-builder/FormCreationDialog.tsx` (NEW)

A dialog with two paths: Blank Form or Generate with AI.

#### Props Interface

```typescript
interface FormCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlank: () => void;
  onGenerated: (draft: Partial<BuilderState>) => void;
  language: 'en' | 'es';
}
```

#### Component Structure

Uses existing shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `Button`, `Textarea`.

**State machine:**
1. `idle` — Two cards: "Blank Form" and "Generate with AI"
2. `input` — Textarea visible, "Generate" button enabled
3. `generating` — Sparkles spinner, textarea disabled
4. `error` — Error message with retry button
5. `success` — Calls `onGenerated(draft)` and closes

#### Bilingual Strings

```typescript
const STRINGS = {
  en: {
    title: 'Create New Form',
    blankTitle: 'Blank Form',
    blankDesc: 'Start from scratch',
    aiTitle: 'Generate with AI',
    aiDesc: 'Describe your form and AI builds it',
    placeholder: 'e.g. Employee write-up form with name, date, rule broken, corrective action...',
    generate: 'Generate',
    generating: 'Generating...',
    cancel: 'Cancel',
    back: 'Back',
    errorRetry: 'Try again',
  },
  es: {
    title: 'Crear Nuevo Formulario',
    blankTitle: 'Formulario en Blanco',
    blankDesc: 'Comenzar desde cero',
    aiTitle: 'Generar con IA',
    aiDesc: 'Describe tu formulario y la IA lo construye',
    placeholder: 'ej. Formulario de amonestacion con nombre, fecha, regla infringida, accion correctiva...',
    generate: 'Generar',
    generating: 'Generando...',
    cancel: 'Cancelar',
    back: 'Volver',
    errorRetry: 'Intentar de nuevo',
  },
};
```

#### Quick-Start Chips

Below the textarea, show 3-4 example chips that auto-fill the description:

```
[Daily Checklist]  [Employee Write-Up]  [Incident Report]  [Temperature Log]
```

Tapping a chip fills the textarea with a pre-written description. This solves the "blank canvas" problem.

### 4.3 Wire into Forms List Page

**File:** `src/pages/admin/AdminFormsListPage.tsx`

```typescript
// Add state:
const [showCreateDialog, setShowCreateDialog] = useState(false);

// Replace existing "New Form" button onClick:
// FROM: onClick={() => navigate('/admin/forms/new')}
// TO:   onClick={() => setShowCreateDialog(true)}

// Both the header button AND the empty-state button get this treatment.

// Add dialog render:
<FormCreationDialog
  open={showCreateDialog}
  onOpenChange={setShowCreateDialog}
  onBlank={() => {
    setShowCreateDialog(false);
    navigate('/admin/forms/new');
  }}
  onGenerated={(draft) => {
    setShowCreateDialog(false);
    navigate('/admin/forms/new', { state: { aiDraft: draft } });
  }}
  language={lang}
/>
```

### 4.4 Wire into Builder Page

**File:** `src/pages/admin/AdminFormBuilderPage.tsx`

In the "create new template" `useEffect`, after the template row is created in Supabase:

```typescript
import { useLocation } from 'react-router-dom';

const location = useLocation();

// Inside the createTemplate effect, after INSERT succeeds:
const aiDraft = (location.state as any)?.aiDraft as Partial<BuilderState> | undefined;

if (aiDraft) {
  dispatch({ type: 'AI_GENERATE_SUCCESS', payload: aiDraft });
  // Clear location state so refresh doesn't re-apply
  window.history.replaceState({}, '', window.location.pathname);
}
```

The `AI_GENERATE_SUCCESS` reducer case already calls `pushUndo()` and spreads the draft onto state, setting `isDirty: true`. The auto-save will persist it.

---

## 5. Database Impact

### 5.1 Zero Migrations Required

Both features operate entirely within the existing schema:

| Concern | Status |
|---------|--------|
| `form_templates.fields` JSONB | Already stores labels — corrections are just UPDATE |
| `form_templates.instructions_*` | Already stored — AI generation populates them |
| `form_templates.ai_tools` TEXT[] | Already stored — AI generation sets them |
| Field validation trigger | Already validates keys, types, options |
| `generate-form-template` usage tracking | Already uses `increment_usage()` with `ai_usage_log` |
| RLS policies | No changes — managers/admins can already INSERT/UPDATE |

### 5.2 Data Flow Through Existing Constraints

**Part A (field corrections):** The corrected labels are applied in the reducer's `ACCEPT_REFINEMENT_RESULT` case, then saved via the normal auto-save `UPDATE form_templates SET fields = $1`. The field validation trigger runs on this UPDATE and validates keys, types, options — labels are free-text and not constrained.

**Part B (AI form creation):** The generated fields go through `sanitizeGeneratedFields()` which:
- Deduplicates keys (appends `_2`, `_3` suffix)
- Slugifies keys to `^[a-z][a-z0-9_]+$` (after our hyphen fix)
- Ensures choice fields have `options` arrays
- Resequences `order` values 1..N

Then saved via `INSERT form_templates` (new row) + `UPDATE` (AI_GENERATE_SUCCESS changes). The validation trigger runs on both.

### 5.3 Slug Uniqueness

When creating a new form via AI, a new template row is created first (with a generated slug from "Untitled Form"), then the AI draft is applied (which may include a new title). The slug auto-update logic in `ACCEPT_REFINEMENT_RESULT` / `AI_GENERATE_SUCCESS` uses the conservative approach:

```
Only update slug IF:
  1. New title is provided
  2. Template is not published
  3. Current slug was auto-derived from old title
```

This prevents collision with existing slugs from manually-named forms.

### 5.4 Usage Tracking

Both features consume AI credits:
- **Part A:** `refine-form-instructions` already calls `increment_usage()` with `feature: 'form_instructions'`
- **Part B:** `generate-form-template` already calls `increment_usage()` with `feature: 'form_generation'`

No changes needed — both are already tracked and rate-limited (100 daily / 2000 monthly).

---

## 6. UI/UX Design

### 6.1 Field Label Corrections — Visual Feedback

When labels are corrected, the explanation banner (Section A of `FormInstructionsPanel`) should mention the corrections:

> "I refined your instructions, corrected the form title, and fixed 3 field label spelling errors (Employee Name, Date of Incident, Department)."

The AI's `explanation` field should naturally describe label corrections since we instruct it to do so in the system prompt. No additional UI changes needed — the corrected labels appear instantly in the canvas/field list.

#### Flash Animation (Optional Enhancement)

For corrected field labels, briefly flash the label text with a subtle highlight:

```css
@keyframes label-corrected {
  0% { background-color: hsl(var(--primary) / 0.2); }
  100% { background-color: transparent; }
}
.label-corrected {
  animation: label-corrected 1.5s ease-out;
}
```

This is optional — the explanation banner is the primary feedback mechanism.

### 6.2 Form Creation Dialog — Desktop Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│         Create New Form                        [X]  │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │              │    │                          │   │
│  │   📄         │    │    ✨                    │   │
│  │              │    │                          │   │
│  │  Blank Form  │    │  Generate with AI        │   │
│  │              │    │                          │   │
│  │  Start from  │    │  Describe your form      │   │
│  │  scratch     │    │  and AI builds it        │   │
│  │              │    │                          │   │
│  └──────────────┘    └──────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

After clicking "Generate with AI":

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  <- Back        Generate with AI               [X]  │
│                                                     │
│  Describe the form you need:                        │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │ Employee write-up form with name, date,       │  │
│  │ department, rule broken, description of       │  │
│  │ incident, corrective action, and signatures   │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Quick start:                                       │
│  [Daily Checklist] [Write-Up] [Incident Report]     │
│                                                     │
│                    [Cancel]  [Generate ✨]           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.3 Form Creation Dialog — Loading State

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│         Generating Your Form...                [X]  │
│                                                     │
│              ✨ (spinning)                           │
│                                                     │
│         Creating fields and instructions...         │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ ████████████████████░░░░░░░░░░░░  65%       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  This usually takes 10-15 seconds                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The progress bar is cosmetic (fake) — it advances smoothly from 0% to 90% over 12 seconds, then holds at 90% until the response arrives.

### 6.4 Form Creation Dialog — Error State

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  <- Back        Generate with AI               [X]  │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ ⚠ Generation failed: [error message]        │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [textarea still shows the description]             │
│                                                     │
│                    [Cancel]  [Try Again ✨]          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.5 Mobile Layout

On mobile (`< 640px`), the dialog becomes a full-screen sheet:
- The two cards stack vertically
- The textarea gets full width
- Quick-start chips wrap onto 2 lines
- The generate button is full-width at the bottom

### 6.6 Post-Generation Flow

After the AI generates the form:
1. Dialog closes
2. Builder opens with all fields, instructions, settings pre-populated
3. A one-time banner at the top: "AI generated this form. Review and edit before publishing."
4. The "Refine with AI" button shows "Refined" status (instructions are already AI-quality)
5. Admin can modify any field, reorder, delete, or add more fields
6. Undo reverts to blank state (the entire AI generation is one undo step)

---

## 7. Risk Assessment

### 7.1 Critical Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | `data.draft` bug causes blank form on generation | **Certain** (confirmed bug) | High — feature doesn't work | Fix in `useGenerateTemplate.ts` line 32 |
| R2 | Missing `groupId` causes edge function 400 error | **Certain** (confirmed bug) | High — feature doesn't work | Add `groupId` to hook params and request body |

### 7.2 High-Priority Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R3 | Hyphen in AI-generated keys (`employee-name`) fails DB trigger | Medium | High — save fails with opaque error | Fix regex in `template-mapper.ts` |
| R4 | AI-generated slug collides with existing template | Low | Medium — save error, user confusion | Conservative slug update logic (only if auto-derived) + retry with suffix |
| R5 | Token truncation on large forms (30+ fields) with corrections | Low | Medium — corrections may be cut off | Increase `max_tokens` to 2500, field corrections are small per item |
| R6 | AI over-corrects intentional abbreviations (e.g., "Dept" → "Department") | Medium | Low — annoying but harmless | Prompt instruction: "Only correct obvious spelling errors. Preserve intentional abbreviations." |

### 7.3 Moderate Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R7 | AI returns corrections for non-existent field keys | Low | Low — filtered out | Server-side validation: filter to only existing keys |
| R8 | Spanish label correction quality poor | Medium | Low — admin can fix | AI sees both EN and ES labels; Spanish corrections are best-effort |
| R9 | Generated form has too many/few fields | Medium | Low — admin reviews | Confidence score shown; admin can edit freely |
| R10 | `sanitizeGeneratedFields` dedup suffix creates ugly keys | Low | Low — cosmetic | Keys like `employee_name_2` are ugly but functional |
| R11 | Race condition: dialog closes before generation completes | Low | Medium | Disable close button during generation; track in-flight state |
| R12 | Empty description submitted to generation endpoint | Low | Low | Disable Generate button when textarea is empty |

### 7.4 Risk Summary

- **2 critical bugs** must be fixed before Part B works at all
- **1 high-priority regex bug** affects AI-generated forms with hyphens
- **All other risks** are medium/low with straightforward mitigations
- **Zero security risks** — both features use existing auth (manager/admin role check) and rate limiting

---

## 8. Implementation Order

### Sprint 1: Part A — Field Label Corrections (4 small edits + 1 deploy)

| Step | File | Description | Risk |
|------|------|-------------|------|
| 1 | `supabase/functions/refine-form-instructions/index.ts` | Add schema field, prompt instruction, validation, max_tokens bump | Low |
| 2 | `src/types/form-builder.ts` | Add types for corrections | None |
| 3 | `src/hooks/useRefineInstructions.ts` | Map new response field | None |
| 4 | `src/contexts/BuilderContext.tsx` | Apply corrections in reducer | Low |
| 5 | `src/pages/admin/AdminFormBuilderPage.tsx` | Pass corrections to dispatch | None |
| 6 | Deploy edge function | `npx supabase functions deploy refine-form-instructions --no-verify-jwt` | Low |
| 7 | **Test** | Create form with misspelled labels → Refine → verify corrections | — |

### Sprint 2: Part B — AI Form Creation (3 bug fixes + 1 new component + 2 page edits)

| Step | File | Description | Risk |
|------|------|-------------|------|
| 1 | `src/hooks/useGenerateTemplate.ts` | Fix `data.draft` + add `groupId` | **Critical** |
| 2 | `src/lib/form-builder/template-mapper.ts` | Fix hyphen regex + add `instructionsRefined` | **High** |
| 3 | `supabase/functions/generate-form-template/index.ts` | Add `yes_no` to field type enum | Low |
| 4 | `src/components/form-builder/FormCreationDialog.tsx` | New component (~150 lines) | Medium |
| 5 | `src/pages/admin/AdminFormsListPage.tsx` | Wire dialog to "New Form" buttons | Low |
| 6 | `src/pages/admin/AdminFormBuilderPage.tsx` | Consume `location.state.aiDraft` | Low |
| 7 | Deploy edge function | `npx supabase functions deploy generate-form-template --no-verify-jwt` | Low |
| 8 | **Test** | Forms List → New Form → Generate → verify builder populated | — |

### Post-Sprint: Type Check

```bash
npx tsc --noEmit  # Must be zero errors
```

---

## 9. Verification Plan

### 9.1 Part A — Field Label Corrections

| Test | Steps | Expected |
|------|-------|----------|
| Misspelled label correction | Create form → add field "empoloyeeee name" → Write instructions → Refine | Label corrected to "Employee Name", explanation mentions correction |
| Spanish translation added | Create form → add field "Employee Name" (no ES label) → Refine | `label_es` populated with "Nombre del Empleado" |
| No corrections needed | Create form with correctly spelled labels → Refine | Empty corrections array, no label changes |
| Undo reverts corrections | After successful refinement with corrections → Ctrl+Z | All labels revert to original, title/description/instructions also revert |
| Non-existent key filtered | (Edge function test) Return correction for key "nonexistent" | Filtered out, no error |

### 9.2 Part B — AI Form Creation

| Test | Steps | Expected |
|------|-------|----------|
| Blank form creation | Forms List → New Form → Blank Form | Navigates to `/admin/forms/new`, empty builder |
| AI form generation | Forms List → New Form → Generate with AI → "Employee write-up form with name, date, rule broken" → Generate | Builder opens with fields, instructions, title, icon populated |
| Quick-start chips | Click "Daily Checklist" chip | Textarea fills with checklist description |
| Error handling | Disconnect network → Generate | Error shown inline, retry button works |
| Generated form editable | After generation → edit a field label → add a field → delete a field | All operations work normally |
| Undo generation | After generation → Ctrl+Z | All AI-generated content removed, blank form |
| Auto-save after generation | After generation → wait 3 seconds | Template saved to DB with all generated content |
| `groupId` passed correctly | Check edge function logs after generation | No 400 error, usage tracked |

### 9.3 Integration Tests

| Test | Steps | Expected |
|------|-------|----------|
| Generate then Refine | Generate form with AI → Refine instructions → verify labels also checked | Full pipeline works end-to-end |
| TypeScript check | `npx tsc --noEmit` | Zero errors |
| Build check | `npm run build` | Success, no warnings |

---

## Appendix A: Edge Function Schema After Changes

### `refine-form-instructions` — Full Response Schema

```json
{
  "type": "object",
  "properties": {
    "refinedInstructions":       { "type": "string" },
    "refinedInstructionsEs":     { "type": "string" },
    "recommendedTools":          { "type": "array", "items": { "type": "string" } },
    "suggestedSystemPrompt":     { "type": "string" },
    "suggestedTitleEn":          { "type": "string" },
    "suggestedTitleEs":          { "type": "string" },
    "suggestedDescriptionEn":    { "type": "string" },
    "suggestedDescriptionEs":    { "type": "string" },
    "suggestedIcon":             { "type": "string" },
    "suggestedFieldCorrections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key":      { "type": "string" },
          "label":    { "type": "string" },
          "label_es": { "type": "string" }
        },
        "required": ["key", "label", "label_es"],
        "additionalProperties": false
      }
    },
    "explanation":  { "type": "string" },
    "suggestions":  { "type": "array", "items": { "type": "string" } }
  },
  "required": [
    "refinedInstructions", "refinedInstructionsEs",
    "recommendedTools", "suggestedSystemPrompt",
    "suggestedTitleEn", "suggestedTitleEs",
    "suggestedDescriptionEn", "suggestedDescriptionEs",
    "suggestedIcon", "suggestedFieldCorrections",
    "explanation", "suggestions"
  ],
  "additionalProperties": false
}
```

### `generate-form-template` — Field Type Enum (After Fix)

```json
["text", "textarea", "date", "time", "datetime", "select", "radio",
 "checkbox", "number", "phone", "email", "signature", "image", "file",
 "header", "instructions", "contact_lookup", "yes_no"]
```

---

## Appendix B: Existing Infrastructure Inventory

Everything marked "EXISTS" requires zero new code — it's already deployed and tested:

| Component | Status | File |
|-----------|--------|------|
| `generate-form-template` edge function | EXISTS (deployed) | `supabase/functions/generate-form-template/index.ts` |
| `refine-form-instructions` edge function | EXISTS (deployed) | `supabase/functions/refine-form-instructions/index.ts` |
| `useGenerateTemplate` hook | EXISTS (has 2 bugs) | `src/hooks/useGenerateTemplate.ts` |
| `useRefineInstructions` hook | EXISTS | `src/hooks/useRefineInstructions.ts` |
| `mapGeneratedTemplate` mapper | EXISTS (has 2 bugs) | `src/lib/form-builder/template-mapper.ts` |
| `sanitizeGeneratedFields` sanitizer | EXISTS | `src/lib/form-builder/template-mapper.ts` |
| `GenerateResponse` type | EXISTS | `src/types/form-builder.ts` |
| `CreationMode` type | EXISTS | `src/types/form-builder.ts` |
| `AI_GENERATE_START/SUCCESS/ERROR` actions | EXISTS | `src/contexts/BuilderContext.tsx` |
| `ACCEPT_REFINEMENT_RESULT` action | EXISTS | `src/contexts/BuilderContext.tsx` |
| `pushUndo()` / `takeSnapshot()` | EXISTS | `src/contexts/BuilderContext.tsx` |
| `increment_usage()` DB function | EXISTS | Supabase migrations |
| `generateSlug()` utility | EXISTS | `src/lib/form-builder/builder-utils.ts` |
| `computeAiFillabilityScore()` utility | EXISTS | `src/lib/form-builder/builder-utils.ts` |
| `getToolRecommendations()` utility | EXISTS | `src/lib/form-builder/builder-utils.ts` |
| shadcn Dialog, Button, Textarea | EXISTS | `src/components/ui/` |
| Form templates table + RLS | EXISTS | Supabase |
| 18 field types | EXISTS | `src/types/forms.ts` |
| 24 valid icons | EXISTS | `src/components/form-builder/SettingsTab.tsx` |
| 5 AI tools | EXISTS | `form_ai_tools` table |

---

*This document was assembled from analysis by four specialized agents: Technical Architect (data flow, file map, implementation order), Database Expert (zero-migration confirmation, constraint analysis, usage tracking), UI/UX Designer (dialog wireframes, mobile layout, loading states, post-generation flow), and Devil's Advocate (26 risks identified, 5 blocking bugs found, mitigation strategies).*
