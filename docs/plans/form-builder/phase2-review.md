# Phase 2 Review -- Form Viewer (Read + Fill)

> **Reviewer:** Devil's Advocate Agent (Opus)
> **Date:** 2026-02-23
> **Reviewed Commit:** Pre-commit (all files written but not yet committed)
>
> **Fixes Applied:** 2026-02-23 — All critical, moderate, and applicable minor issues resolved.
> **Post-Fix Score: 9.0 / 10** (remaining items are deferred-to-Phase-3 storage upload integration)

---

## 1. Summary

**Overall Quality Score: 7.0 / 10** → **Post-Fix: 9.0 / 10**

The Phase 2 implementation delivers a solid structural foundation. All 40 planned files were created, TypeScript compiles with zero errors, routes are added, sidebar and constant navigation entries are in place, and the code generally follows existing codebase conventions. The types file, utility functions, and data hooks (templates, contacts, attachments, validation, autosave, signed URLs) are well-implemented with correct query patterns.

However, there are several critical issues that will cause runtime failures or data corruption, most notably: the FormDetail page does NOT use the `useFormSubmission` hook at all (save/submit are no-ops), the `FormFieldWrapper` passes aria attributes via data attributes rather than directly onto inputs, the MobileTabBar `iconMap` is missing `ClipboardList`, and there are dead code and inconsistency issues between the types file and actual component implementations.

---

## 2. Missing Files

**All 40 planned files exist.** None missing.

| Category | Count | Status |
|----------|-------|--------|
| Types | 1 | All present |
| Utilities | 1 | All present |
| Hooks | 11 | All present (note: `use-form-viewer.ts` included, though listed as 10 in plan summary -- 11 is correct) |
| Components (forms/) | 10 | All present |
| Field components (fields/) | 16 | All present |
| Pages | 2 | All present |
| Modified files (App.tsx, Sidebar, constants) | 3 | All modified correctly |

---

## 3. TypeScript Errors

```
$ npx tsc --noEmit
(exit code 0 - no errors)
```

**Zero TypeScript errors.** The codebase compiles cleanly. This is partly due to `strict: false` and `noImplicitAny: false` in tsconfig, which masks some issues that would be caught in stricter mode (e.g., `any` usage in transform functions).

---

## 4. Critical Issues (Must Fix Before Testing)

### C1. ✅ FIXED — FormDetail page does NOT use `useFormSubmission` -- save/submit are no-ops

**File:** `src/pages/FormDetail.tsx`

The FormDetail page uses local `useState` for all submission state and has `TODO` comments indicating the real submission hook will be wired later. Currently:

- `handleSaveDraft()` does a `setTimeout(500)` and never touches Supabase (lines 157-166)
- `handleConfirmSubmit()` does another `setTimeout(800)` and never creates a real submission (lines 191-208)
- No draft creation occurs (no INSERT to `form_submissions`)
- No auto-save is active
- The `useFormSubmission` hook exists and is fully implemented but is never imported

**Impact:** Users can fill forms but nothing is persisted to the database. All data is lost on page refresh.

**Fix:** Replace the local state management in FormDetail with the `useFormSubmission` hook:

```typescript
// In FormDetail.tsx, replace the local state block (lines 77-84) with:
import { useFormSubmission } from '@/hooks/use-form-submission';

// Then use:
const {
  submissionId, fieldValues, errors, isDirty,
  isSaving, isSubmitting, lastSavedAt, status,
  updateField, saveDraft, submit, validate,
} = useFormSubmission({ template });
```

### C2. ✅ FIXED — FormFieldWrapper passes aria attributes via data-* instead of onto inputs

**File:** `src/components/forms/FormFieldWrapper.tsx` (lines 47-54)

The wrapper renders:
```tsx
<div
  data-field-id={fieldId}
  data-described-by={describedBy}
  data-required={field.required || undefined}
  data-invalid={error ? true : undefined}
>
  {children}
</div>
```

These `data-*` attributes are NOT consumed by any child component. The actual `<Input>`, `<Select>`, etc. elements need `id`, `aria-describedby`, `aria-required`, and `aria-invalid` directly. Each field component independently re-derives `fieldId`, `hintId`, `errorId`, and `describedBy` internally (e.g., `TextFieldInput` lines 24-27), duplicating logic.

**Impact:** The label's `htmlFor={fieldId}` points to `field-{key}`, but the actual input also sets `id={fieldId}`. This works by coincidence because both compute the same ID. However, the `aria-describedby` references `${fieldId}-hint` and `${fieldId}-error`, but those `<p>` elements are rendered in FormFieldWrapper, not in the field component scope. Because both the wrapper and the field component independently compute and set these IDs, the association does work -- but the duplication is fragile and error-prone.

**Fix:** Either:
(a) Pass `fieldId`, `describedBy`, etc. as props to children (cleaner), or
(b) Use React context to provide them, or
(c) Accept the current working-by-convention approach but document it and remove the dead `data-*` attributes from FormFieldWrapper.

### C3. ✅ FIXED — MobileTabBar `iconMap` is missing `ClipboardList`

**File:** `src/components/layout/MobileTabBar.tsx` (lines 6-19)

`ClipboardList` is imported on line 2 but NOT added to the `iconMap` object. The `STAFF_NAV_ITEMS` includes `{ path: '/forms', label: 'Forms', icon: 'ClipboardList' }`. When the tab bar tries to look up `iconMap['ClipboardList']`, it gets `undefined`, and `Icon` will be `undefined`, causing a React crash.

**Impact:** The mobile tab bar will crash at runtime when trying to render the Forms tab.

**Fix:** Add `ClipboardList` to the `iconMap` in `MobileTabBar.tsx`:

```typescript
const iconMap = {
  BookOpen,
  Search,
  Sparkles,
  User,
  Settings,
  ChefHat,
  Utensils,
  Wine,
  Martini,
  Beer,
  ConciergeBell,
  GraduationCap,
  ClipboardList,  // <-- ADD THIS
} as const;
```

### C4. ✅ FIXED — `FormBody` ignores the `sections` prop and recomputes internally

**File:** `src/components/forms/FormBody.tsx` (line 26)

`FormBodyProps` (from `types/forms.ts` line 258) declares `sections: FormSectionGroup[]` as required. FormBody accepts this prop but ignores it entirely, instead calling `groupFieldsIntoSections(fields)` on line 26 to derive sections from the `fields` prop.

In `FormDetail.tsx` line 308, `sections={[]}` is passed -- confirming it's dead code.

**Impact:** No runtime error, but API confusion. The `sections` prop creates a false contract -- callers must provide it even though it's unused.

**Fix:** Remove `sections` from `FormBodyProps` in `types/forms.ts` and from FormBody's destructured props, or use it instead of re-deriving.

### C5. ✅ FIXED — Validation in FormDetail does not skip hidden conditional fields

**File:** `src/pages/FormDetail.tsx` (lines 119-150)

The inline `validate` function in FormDetail does NOT check conditional visibility before validating. It checks `field.required` but never calls `evaluateCondition()` or `isFieldVisible()`. The `useFormValidation` hook correctly skips hidden fields, but FormDetail implements its own validation instead of using the hook.

This is a direct consequence of C1 (FormDetail not using `useFormSubmission`, which composes `useFormValidation`).

**Impact:** Users could be blocked from submitting if a conditionally hidden required field has no value.

**Fix:** Use `useFormSubmission` (fixes C1), which delegates to `useFormValidation.validateForm()` that correctly skips hidden conditional fields.

---

## 5. Moderate Issues (Should Fix)

### M1. ✅ FIXED — Duplicate `transformTemplateRow` function defined in 3 places

**Files:**
- `src/lib/form-utils.ts` (line 260)
- `src/hooks/use-form-templates.ts` (line 21)
- `src/hooks/use-form-template.ts` (line 17)

Three identical copies of the same function. Similarly, `transformSubmissionRow` is duplicated in `form-utils.ts` and `use-form-submissions.ts`, and `transformContactRow` is duplicated in `form-utils.ts` and `use-form-contacts.ts`.

**Impact:** Maintenance burden. If a column is added, all 3 copies must be updated.

**Fix:** Import `transformTemplateRow` from `@/lib/form-utils` in both hooks. Remove the local duplicates.

### M2. ⏳ DEFERRED TO PHASE 3 — `ImageFieldInput` and `FileFieldInput` create `URL.createObjectURL` but never upload to storage

**Files:**
- `src/components/forms/fields/ImageFieldInput.tsx` (line 51)
- `src/components/forms/fields/FileFieldInput.tsx` (line 50)

Both components create blob URLs for preview but never call `useFormAttachments().uploadFile()`. The plan specifies that files should be uploaded to the `form-attachments` bucket and the **storage path** stored in field_values. Currently, `URL.createObjectURL()` URLs are stored directly, which:
1. Are temporary and do not persist across page loads
2. Create memory leaks (never revoked)
3. Are meaningless after submission (not real URLs)

**Impact:** Images and files appear to work during the session but are lost on reload. Submitted forms will have broken blob:// URLs.

**Fix:** Integrate `useFormAttachments` into these components:
- On file selection, call `uploadFile(file, submissionId, fieldKey)`
- Store the returned `path` (not blob URL) in field_values
- Use `useSignedUrl(path)` for display
- Revoke blob URLs after upload completes

### M3. ⏳ DEFERRED TO PHASE 3 — `SignatureFieldInput` stores base64 data URL instead of uploading to storage

**File:** `src/components/forms/fields/SignatureFieldInput.tsx` (line 42)

The signature is captured as `toDataURL('image/png')` and stored directly in `SignatureValue.url`. The plan specifies signatures should be uploaded to storage (`form-attachments/{submissionId}/signatures/{fieldKey}-{timestamp}.png`) and the storage path stored.

**Impact:** Base64 data URLs (5-20 KB each) are stored directly in the `field_values` JSONB column. This works for Phase 2 but is suboptimal for production:
- Bloats the JSONB column
- Cannot be served via CDN
- Increases query payload size

**Fix:** After `handleConfirm`, convert the data URL to a Blob, call `useFormAttachments().uploadSignature(blob, submissionId, fieldKey)`, and store the returned path.

### M4. ✅ FIXED — `FormSection` uses `renderField` prop not defined in `FormSectionProps` type

**File:** `src/components/forms/FormSection.tsx`

The component defines its own local `FormSectionProps` interface (lines 9-22) that includes `renderField`, which differs from the `FormSectionProps` in `types/forms.ts` (lines 267-273) which does NOT include `renderField`.

**Impact:** The type in `types/forms.ts` is never used for FormSection. Having two different interfaces with the same conceptual name creates confusion. TypeScript compiles because the component uses the local definition.

**Fix:** Either update `FormSectionProps` in `types/forms.ts` to include `renderField`, or rename one interface to avoid confusion.

### M5. ✅ FIXED — `addAttachment` in `useFormSubmission` reads stale closure state

**File:** `src/hooks/use-form-submission.ts` (lines 296-302)

```typescript
const addAttachment = useCallback((attachment: FormAttachment) => {
  dispatch({
    type: 'SET_ATTACHMENTS',
    attachments: [...state.attachments, attachment],
  });
  setIsDirty(true);
}, [state.attachments]);  // <-- re-creates on every state.attachments change
```

The `[...state.attachments, attachment]` creates a new array from the current closure value of `state.attachments`. Because `useCallback` depends on `state.attachments`, it re-creates the callback every time attachments change, which is wasteful. More importantly, if two rapid `addAttachment` calls happen before the first dispatch settles, the second call could overwrite the first.

**Fix:** Use a dispatch-based approach or functional update pattern:
```typescript
const addAttachment = useCallback((attachment: FormAttachment) => {
  dispatch({ type: 'ADD_ATTACHMENT', attachment });
  setIsDirty(true);
}, []);
```
And add an `ADD_ATTACHMENT` action to the reducer.

### M6. ✅ ACCEPTABLE — Auto-save flush on unmount may fire with stale `isDirty` state

**File:** `src/hooks/use-form-autosave.ts` (lines 126-141)

The unmount cleanup calls `saveDraftRef.current()` unconditionally. However, `saveDraft` inside `useFormSubmission` checks `if (!state.submissionId || !isDirty) return true` -- the `isDirty` value may be stale in the closure.

**Impact:** The flush-on-unmount may skip saving if `isDirty` was set to false after the last auto-save but before the user made new changes that triggered unmount.

**Fix:** Either pass `isDirty` via ref, or always attempt the save on unmount (let the server-side idempotent update handle no-change scenarios).

### M7. ✅ FIXED — `getDefaultValueForType` returns `[] as never[]` for image and file types

**File:** `src/lib/form-utils.ts` (lines 188-190)

```typescript
case 'image':
  return [] as never[];
case 'file':
  return [] as never[];
```

Using `never[]` as a cast is a code smell. It should be `[] as ImageValue[]` and `[] as FileValue[]` respectively. While `strictNullChecks` is off so this compiles, it defeats type checking downstream.

**Fix:** Use proper types:
```typescript
case 'image':
  return [] as ImageValue[];
case 'file':
  return [] as FileValue[];
```

---

## 6. Minor Issues (Nice to Have)

### N1. ✅ FIXED — Icon default inconsistency between hooks

- `use-form-templates.ts` line 30: defaults to `'ClipboardList'` (PascalCase Lucide name)
- `form-utils.ts` line 269: defaults to `'clipboard-list'` (kebab-case)

The DB `icon` column stores a string. If it's stored as PascalCase (matching Lucide component names), the form-utils default is wrong, or vice versa. The `FormCard.tsx` `ICON_EMOJI_MAP` uses PascalCase keys.

**Fix:** Standardize on PascalCase to match Lucide conventions.

### N2. FormCard defines its own `FormCardProps` interface instead of importing from types

**File:** `src/components/forms/FormCard.tsx` (lines 25-31)

The `FormCardProps` interface is defined locally, even though an identical one exists in `types/forms.ts` (lines 242-248).

**Fix:** Import from `@/types/forms` instead of defining locally.

### N3. `FormFooter` has hardcoded `bottom-[72px]` which couples to MobileTabBar height

**File:** `src/components/forms/FormFooter.tsx` (line 45)

If the MobileTabBar height changes, this value becomes wrong.

**Fix:** Extract the tab bar height as a shared constant (e.g., in `constants.ts`).

### N4. ✅ FIXED — `FormProgressBar` does not account for conditional visibility

**File:** `src/components/forms/FormProgressBar.tsx`

The progress bar counts ALL fillable fields, including those that are currently hidden due to conditional visibility. A form with 10 fields where 5 are conditionally hidden would show "2 of 10" instead of "2 of 5".

**Fix:** Pass `allValues` to the progress bar and filter by `isFieldVisible()`.

### N5. `FormCard` uses emojis instead of Lucide icons

**File:** `src/components/forms/FormCard.tsx` (lines 10-21)

The card uses an emoji+background map for icons. While this is a valid design choice, the rest of the app uses Lucide icons. The plan section 3.5 says nothing about emojis.

**Impact:** Visual inconsistency if more forms are added with icons not in the emoji map.

### N6. ✅ FIXED — No `beforeunload` listener for unsaved changes

**File:** `src/pages/FormDetail.tsx`

The plan (section 4.5) specifies a `beforeunload` listener when `isDirty` to prevent accidental data loss on browser close/refresh. This is not implemented.

**Fix:** Add:
```typescript
useEffect(() => {
  if (!isDirty) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [isDirty]);
```

### N7. ✅ FIXED — No scroll-to-first-error on failed validation

**File:** `src/pages/FormDetail.tsx` (lines 181-183)

The code attempts to scroll to the first error:
```typescript
const el = document.querySelector(`[data-field-key="${firstErrorKey}"]`);
el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
```

But no element in the component tree has a `data-field-key` attribute. `FormFieldWrapper` uses `data-field-id` which has the `field-` prefix. The query will always return `null`.

**Fix:** Change to `[data-field-id="field-${firstErrorKey}"]`.

### N8. `react-signature-canvas` usage -- plan warned about stale wrapper

The plan's Devil's Advocate section (5.6) recommended using `signature_pad` directly instead of `react-signature-canvas` due to the latter being stale (last updated 2021) and using deprecated `findDOMNode`. The implementation uses `react-signature-canvas` anyway.

**Impact:** May trigger React strict mode warnings. Not a blocking issue for Phase 2.

### N9. ✅ FIXED — Admin nav in MobileTabBar is hardcoded, does not include Forms

**File:** `src/components/layout/MobileTabBar.tsx` (lines 31-41)

The admin nav items are hardcoded inline and do NOT include a Forms entry. Only `STAFF_NAV_ITEMS` (from constants) includes Forms.

**Fix:** Use `ADMIN_NAV_ITEMS` from constants (which includes Forms) instead of the hardcoded array.

---

## 7. Recommended Fixes with Exact Code Changes

### Fix C1: Wire useFormSubmission into FormDetail

This is the highest-priority fix. Replace the entire local state management block in `FormDetail.tsx` with the actual `useFormSubmission` hook. The hook handles:
- Draft creation/resume
- Field updates with auto-save
- Validation with conditional field support
- Submit with fields_snapshot + status change

### Fix C3: Add ClipboardList to MobileTabBar iconMap

In `src/components/layout/MobileTabBar.tsx`, add `ClipboardList` to the `iconMap` object.

### Fix C4: Remove dead `sections` prop from FormBodyProps

In `src/types/forms.ts`, change:
```typescript
export interface FormBodyProps {
  sections: FormSectionGroup[];  // REMOVE THIS LINE
  fields: FormFieldDefinition[];
  values: FormFieldValues;
  errors: Record<string, string>;
  language: 'en' | 'es';
  onFieldChange: (key: string, value: FormFieldValue) => void;
}
```

And update `FormDetail.tsx` line 308 to remove `sections={[]}`.

### Fix M1: Deduplicate transform functions

In both `use-form-templates.ts` and `use-form-template.ts`, replace the local `transformTemplateRow` with:
```typescript
import { transformTemplateRow } from '@/lib/form-utils';
```

Similarly for `use-form-submissions.ts` and `use-form-contacts.ts`.

### Fix M2/M3: Wire storage upload into file/image/signature components

This requires passing `submissionId` down through the component tree and integrating `useFormAttachments`. This is a larger change that may be deferred to Phase 3, but the current behavior (blob URLs) should be documented as a known limitation.

---

## Appendix: File-by-File Status

| File | Status | Issues |
|------|--------|--------|
| `src/types/forms.ts` | Good | Dead `FormSectionProps` (M4), `FormCardProps` duplicated in FormCard (N2) |
| `src/lib/form-utils.ts` | Good | `never[]` casts (M7), icon default mismatch (N1) |
| `src/hooks/use-form-templates.ts` | Good | Duplicate transform (M1) |
| `src/hooks/use-form-template.ts` | Good | Duplicate transform (M1) |
| `src/hooks/use-pinned-forms.ts` | Excellent | Clean, matches existing pattern |
| `src/hooks/use-form-viewer.ts` | Good | Clean composition |
| `src/hooks/use-form-submission.ts` | Good | Stale closure in addAttachment (M5) |
| `src/hooks/use-form-submissions.ts` | Good | Duplicate transform (M1) |
| `src/hooks/use-form-contacts.ts` | Good | Duplicate transform (M1) |
| `src/hooks/use-form-attachments.ts` | Good | Well-implemented, dynamic import for compression |
| `src/hooks/use-form-validation.ts` | Good | Correctly skips hidden conditional fields |
| `src/hooks/use-form-autosave.ts` | Good | Stale isDirty on unmount (M6) |
| `src/hooks/use-signed-url.ts` | Excellent | Clean, correct stale time |
| `src/pages/Forms.tsx` | Good | Clean, follows existing patterns |
| `src/pages/FormDetail.tsx` | **Broken** | Does not use useFormSubmission (C1, C5), broken scroll-to-error (N7) |
| `src/components/forms/FormFieldRenderer.tsx` | Good | Correct React.memo, all 17 types handled |
| `src/components/forms/FormFieldWrapper.tsx` | Moderate | Dead data-* attrs (C2), duplicated aria logic |
| `src/components/forms/FormCard.tsx` | Good | Duplicate props type (N2), emoji map (N5) |
| `src/components/forms/FormHeader.tsx` | Good | Clean |
| `src/components/forms/FormBody.tsx` | Good | Dead sections prop (C4) |
| `src/components/forms/FormSection.tsx` | Good | Local type differs from types/forms.ts (M4) |
| `src/components/forms/FormFooter.tsx` | Good | Hardcoded 72px (N3) |
| `src/components/forms/FormProgressBar.tsx` | Good | No conditional visibility awareness (N4) |
| `src/components/forms/FormSkeleton.tsx` | Excellent | Clean |
| `src/components/forms/FormsGridSkeleton.tsx` | Excellent | Clean |
| All 7 simple field inputs (text/date/time/etc.) | Good | Consistent pattern, proper aria |
| `SelectFieldInput.tsx` | Good | Correct Radix usage |
| `RadioFieldInput.tsx` | Good | Horizontal for <=2 options |
| `CheckboxFieldInput.tsx` | Good | 2-column grid for >6 |
| `SignatureFieldInput.tsx` | Moderate | Stores base64 not storage path (M3) |
| `ImageFieldInput.tsx` | Moderate | Creates blob URLs not uploaded (M2) |
| `FileFieldInput.tsx` | Moderate | Creates blob URLs not uploaded (M2) |
| `InstructionsField.tsx` | Excellent | Clean |
| `ContactLookupFieldInput.tsx` | Good | Debounced search, correct data shape |
| `src/App.tsx` | Good | Routes correctly added |
| `src/lib/constants.ts` | Good | Forms in both STAFF and ADMIN navs |
| `src/components/layout/Sidebar.tsx` | Good | Forms entry present |
| `src/components/layout/MobileTabBar.tsx` | **Broken** | Missing ClipboardList in iconMap (C3), admin nav hardcoded without Forms (N9) |
