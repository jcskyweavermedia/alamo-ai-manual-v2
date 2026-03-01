# Sprint 2 Audit Report -- Devil's Advocate Code Review

> **Reviewer**: Devil's Advocate Agent (Opus 4.6)
> **Date**: 2026-02-25
> **Sprint**: 2 (Builder Core UI)
> **Verdict**: **CONDITIONAL PASS** -- 6 Critical, 8 Major, 12 Minor issues found
> **Files Reviewed**: 19 source files + App.tsx routing, package.json, form-builder.ts types

---

## 1. Executive Summary

Sprint 2 delivers a functional form builder with drag-and-drop field reordering, inline field property editing, live preview with phone frame, an admin forms list page, and supporting hooks. The code quality is generally high -- zero TypeScript errors, bilingual strings throughout, proper context usage, and good adherence to the UX plan's visual language.

However, the audit uncovered **6 critical issues** that must be fixed before Sprint 3, **8 major issues** that should be fixed, and **12 minor issues** that are nice-to-fix. The most serious findings involve:

1. **Two competing auto-save systems** that will conflict at runtime (CRIT-1)
2. **`useBuilderAutoSave` and `useFormBuilder` hooks are written but never wired into any component** (CRIT-2)
3. **Duplicate `validateForPublish` functions** with different return signatures (CRIT-3)
4. **FieldBlockItem props interface diverges from the type definition** in form-builder.ts (CRIT-4)
5. **LivePreview props interface diverges from the type definition** (CRIT-5)
6. **AdminFormsListPage orders by `sort_order` which does not exist** on form_templates (CRIT-6)

---

## 2. Critical Issues (MUST FIX)

### CRIT-1: Two Competing Auto-Save Systems

**Files**: `BuilderContext.tsx` (lines 325-336), `useBuilderAutoSave.ts` (entire file)

`BuilderContext.tsx` contains an inline auto-save effect (3s debounce, lines 325-336) with its own `saveDraftInternal()` function (lines 364-406). Separately, `useBuilderAutoSave.ts` is a fully featured auto-save hook with serial queue, retry, and conflict detection. **Neither calls the other.** If `useBuilderAutoSave` were ever wired in alongside the existing context auto-save, they would race against each other -- exactly the scenario R20 was designed to prevent.

**Fix**: Remove the inline auto-save from `BuilderContext.tsx` and wire `useBuilderAutoSave` + `useFormBuilder` into `AdminFormBuilderPage.tsx` (or into `BuilderProvider`). The inline save in BuilderContext should be replaced by the hook.

**Risk**: R20 (auto-save race conditions)

---

### CRIT-2: `useBuilderAutoSave` and `useFormBuilder` Are Dead Code

**Files**: `useBuilderAutoSave.ts`, `useFormBuilder.ts`

These two hooks are fully implemented but **never imported or used by any component or page**. `useBuilderAutoSave` is imported by nobody (grep confirms only the file itself). `useFormBuilder` is imported only by `useBuilderAutoSave.ts` (for its `UpdateResult` type).

The actual save logic at runtime is the inline `saveDraftInternal()` inside `BuilderContext.tsx`, which:
- Has **no optimistic concurrency guard** (missing `.eq('updated_at', ...)`)
- Has **no serial queue** (only an `isSaving` guard)
- Has **no retry logic**
- Has **no conflict detection**

This means all the R20 mitigations built into `useBuilderAutoSave` are **inoperative**.

**Fix**: Wire `useFormBuilder.updateTemplate` into the save path (either via `useBuilderAutoSave` in `AdminFormBuilderPage` or by refactoring `BuilderProvider` to accept an injected save function).

---

### CRIT-3: Duplicate `validateForPublish` with Incompatible Signatures

**Files**: `builder-utils.ts` (line 299), `publish-validation.ts` (line 65)

Two different `validateForPublish` functions exist:

| File | Signature | Return |
|------|-----------|--------|
| `builder-utils.ts` | `validateForPublish(state: BuilderState): ValidationError[]` | Flat array |
| `publish-validation.ts` | `validateForPublish(template: BuilderState): { valid: boolean; errors: ValidationError[] }` | Object with `valid` + `errors` |

`useFormBuilder.ts` imports from `builder-utils.ts` and calls `validateForPublish(state)` expecting a flat array (line 239: `const validationErrors = validateForPublish(state)`), then checks `.some(e => e.severity === 'error')`. This works with the builder-utils version.

But `publish-validation.ts` also exports `validateForPublish` and is far more thorough (11 checks vs. ~6). The comprehensive version is the one that should be canonical, but it has a different return type.

**Fix**: Delete the simpler version in `builder-utils.ts`. Update `useFormBuilder.ts` to import from `publish-validation.ts` and destructure `{ errors }` from the return value.

---

### CRIT-4: FieldBlockItem Props Diverge from Type Definition

**File**: `FieldBlockItem.tsx` (lines 100-111 vs. form-builder.ts lines 332-338)

The type definition in `form-builder.ts` defines:
```ts
export interface FieldBlockItemProps {
  field: FormFieldDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  language: 'en' | 'es';
}
```

The actual component uses a **completely different interface** (defined locally):
```ts
interface FieldBlockItemProps {
  field: FormFieldDefinition;
  isSelected: boolean;
  isExpanded: boolean;     // NOT in type def
  isFirst: boolean;        // NOT in type def
  isLast: boolean;         // NOT in type def
  allFieldKeys: string[];  // NOT in type def
  language: 'en' | 'es';
  onToggleExpand: (key: string) => void;  // NOT in type def (replaces onSelect)
  onMoveUp: (key: string) => void;        // NOT in type def
  onMoveDown: (key: string) => void;      // NOT in type def
}
```

The component does NOT import `FieldBlockItemProps` from `@/types/form-builder`. It defines its own local interface. This means the type definition is orphaned and misleading.

**Fix**: Update `form-builder.ts` `FieldBlockItemProps` to match the actual component interface, OR import from the type definition and adapt.

---

### CRIT-5: LivePreview Props Diverge from Type Definition

**File**: `LivePreview.tsx` (line 39-41 vs. form-builder.ts lines 376-379)

The type definition specifies:
```ts
export interface LivePreviewProps {
  fields: FormFieldDefinition[];
  language: 'en' | 'es';
}
```

But the component:
```ts
interface LivePreviewProps {
  language: 'en' | 'es';
}
```

`LivePreview` reads `fields` from `useBuilder()` context, not from props. The type definition says `fields` should be a prop. The component defines its own local interface and does NOT import `LivePreviewProps` from the types file.

**Fix**: Update `form-builder.ts` to match reality (remove `fields` from `LivePreviewProps`), or make `LivePreview` accept `fields` as a prop for testability.

---

### CRIT-6: useAdminFormTemplates Orders by Non-Existent Column

**File**: `useAdminFormTemplates.ts` (line 17)

```ts
.order('sort_order', { ascending: true })
```

The `form_templates` table does **not** have a `sort_order` column. The DB schema has `updated_at` but not `sort_order`. This query will either:
- Silently return unordered results (Supabase may ignore unknown columns in `.order()`)
- Throw a Postgres error at runtime

The plan specifies ordering by `updated_at` descending (most recently edited first).

**Fix**: Change to `.order('updated_at', { ascending: false })`.

---

## 3. Major Issues (SHOULD FIX)

### MAJ-1: BuilderContext `saveDraftInternal` Lacks Optimistic Concurrency

**File**: `BuilderContext.tsx` (lines 370-391)

The actual save function does:
```ts
.update({ ... })
.eq('id', state.templateId)
.select('updated_at')
.single();
```

Missing: `.eq('updated_at', state.serverUpdatedAt)` concurrency guard. This was flagged as PARTIAL in Sprint 1 audit and remains unfixed in the **active** save path. The fix exists in `useBuilderAutoSave` (which uses `useFormBuilder.updateTemplate`), but that code is dead (see CRIT-2).

**Risk**: R20 scenario: concurrent edit by two admins silently overwrites data.

---

### MAJ-2: FieldPropertyPanel Missing `in` Condition Operator

**File**: `FieldPropertyPanel.tsx` (line 46-50)

The `CONDITION_OPERATORS` array defines:
```ts
{ value: 'eq', ... }, { value: 'neq', ... }, { value: 'exists', ... }
```

Missing: `{ value: 'in', labelEn: 'One of', labelEs: 'Uno de' }`. The `FormFieldCondition` type in `forms.ts` defines `operator: 'eq' | 'neq' | 'in' | 'exists'`. The `in` operator is omitted from the UI, making it impossible for admins to create `in` conditions through the builder.

**Fix**: Add the `in` operator to `CONDITION_OPERATORS` and render a multi-value input when selected.

---

### MAJ-3: FieldPropertyPanel Missing Pattern Input for phone/email Types

**File**: `FieldPropertyPanel.tsx`

The UX plan Section 5.2 specifies: "text/phone/email: Pattern input for regex validation". The property panel renders AI hint, placeholder, hint, width, section, and condition for all non-layout types, but there is **no pattern/regex input** for phone or email fields. The `FormFieldValidation` type likely supports a `pattern` field, but the UI does not surface it.

**Fix**: Add a "Pattern" input for phone and email types in the type-specific section.

---

### MAJ-4: FieldPropertyPanel Missing Image Max Photos Selector

**File**: `FieldPropertyPanel.tsx`

The Arch plan Section 2.3 specifies: "image: Max photos selector (1-5)". The property panel has no special handling for the `image` type -- it gets the standard property set but no max photos selector.

**Fix**: Add a max photos selector (1-5 number input or stepper) for image type fields.

---

### MAJ-5: AdminFormsListPage Has No Publish/Unpublish Action

**File**: `AdminFormsListPage.tsx` (lines 523-567)

The action menu has: Edit, Duplicate, Archive/Unarchive, Delete. Missing: **Publish / Unpublish toggle** (checklist item 5.6.4). The UX plan Section 9.4 specifies this as a required action.

**Fix**: Add Publish/Unpublish menu item.

---

### MAJ-6: AdminFormsListPage Does Not Check Submissions Before Delete

**File**: `AdminFormsListPage.tsx` (lines 275-293)

The delete handler directly calls `supabase.from('form_templates').delete()` without first checking if the template has submissions. The UX plan 9.4 states: "only for never-published templates with 0 submissions". The delete button is always visible and enabled regardless of submission count.

The `useFormBuilder.deleteTemplate` properly handles FK constraint errors as a fallback, but the list page does not use `useFormBuilder` -- it has its own inline `handleDelete`.

**Fix**: Either (a) query `form_submissions` count before enabling delete and hide/disable the button, or (b) use `useFormBuilder.deleteTemplate` which handles the FK error gracefully.

---

### MAJ-7: FieldBlockList Imports Non-Existent FieldBlockItem from Different Module Path

**File**: `AdminFormBuilderPage.tsx` (line 16)

```ts
import { FieldList } from '@/components/form-builder/FieldList';
```

The page imports `FieldList` (the Sprint 1 placeholder) instead of `FieldBlockList` (the Sprint 2 DnD-enabled field list). `FieldList` is a bare-bones 34-line placeholder with no DnD, no type icons, no drag handles, and no expand/collapse. The full `FieldBlockList` component is never imported anywhere.

**Fix**: Replace `FieldList` import with `FieldBlockList` in `AdminFormBuilderPage.tsx`. Rename the import usage throughout.

---

### MAJ-8: BuilderToolbar Positioned at `bottom-0`, Not `bottom-[72px]`

**File**: `BuilderToolbar.tsx` (line 86)

The UX plan Section 8.5 specifies the floating toolbar should be at `bottom-[72px]` to sit above the MobileTabBar. The component uses `bottom-0`:

```ts
'fixed bottom-0 left-0 right-0 z-20',
```

This will overlap with the app's bottom tab bar on mobile.

**Fix**: Change to `bottom-[72px]` or use `bottom-[env(safe-area-inset-bottom)+72px]` to account for both the tab bar and safe area.

---

## 4. Minor Issues (NICE TO FIX)

### MIN-1: Phone Frame Dimensions Differ from UX Plan

**File**: `LivePreview.tsx` (lines 126-180)

Plan specifies: `w-[375px] h-[700px] rounded-[40px] border-[6px]`
Actual: `w-[320px]` container, `rounded-[32px]`, `border-[5px]`, notch `w-[100px] h-[24px]`

The dimensions are smaller and the border radii differ from spec.

---

### MIN-2: OptionsEditor No Paste Support

**File**: `OptionsEditor.tsx`

Checklist item 3.4.6: "Paste support: parses clipboard content (comma or newline separated) into options". Not implemented. The bulk add mode handles newline-separated input, but there is no `onPaste` handler to intercept clipboard content when pasting into the individual option inputs.

---

### MIN-3: OptionsEditor No Warning at 15+ Options for Radio/Checkbox

**File**: `OptionsEditor.tsx`

Checklist item 3.4.9: "Warning shown at 15+ options for radio/checkbox: 'Consider converting to searchable select'". Not implemented. The component does not know the parent field type, so it cannot show this type-specific warning.

---

### MIN-4: Mobile Move Up/Down Buttons Below 44px Touch Target

**File**: `FieldBlockItem.tsx` (lines 251-277)

Move Up/Down buttons have `className="h-7 text-xs px-2"` -- 28px height, below the 44px Apple HIG minimum. The drag handle is correctly 44x44.

---

### MIN-5: No `aria-live` Region for Save Status Changes

**Files**: `BuilderTopBar.tsx`

Save status changes (Saving/Saved/Error) are visually indicated but not announced to screen readers via an `aria-live` region.

---

### MIN-6: SettingsTab Does Not Accept Props Type from form-builder.ts

**File**: `SettingsTab.tsx` (line 161)

Uses inline `{ language: 'en' | 'es' }` instead of importing a props interface from form-builder.ts. Minor consistency issue but does not affect functionality.

---

### MIN-7: BuilderToolbar Uses Local Props Interface

**File**: `BuilderToolbar.tsx` (lines 44-47)

Defines its own `BuilderToolbarProps` locally. No corresponding type in `form-builder.ts`. Should be aligned for consistency.

---

### MIN-8: `AdminFormBuilderPage` Loads Template with Raw Cast

**File**: `AdminFormBuilderPage.tsx` (line 90)

```ts
const tmpl = data as unknown as FormTemplate;
```

The raw DB row uses snake_case. Casting it to `FormTemplate` (camelCase) without transformation means properties like `tmpl.titleEn` will be `undefined` -- the actual DB column is `title_en`. The `useFormBuilder.loadTemplate` uses `transformTemplateRow()` correctly, but `AdminFormBuilderPage` does its own loading with a raw cast.

**Severity escalation note**: This could actually be a **CRITICAL** issue if the HYDRATE payload receives `undefined` for all template fields. However, Supabase JS client returns snake_case by default, so `data.title_en` works but `(data as FormTemplate).titleEn` would be `undefined`. This means the edit-mode loading is likely broken.

**Fix**: Use `transformTemplateRow(data)` or map columns manually.

---

### MIN-9: Duplicate Title/Slug Auto-Generation Logic

**Files**: `BuilderTopBar.tsx` (lines 123-132), `SettingsTab.tsx` (lines 178-187)

Both components independently implement the same title-to-slug auto-generation logic. If the user edits the title in the TopBar, the slug updates. If they edit in Settings, the slug also updates. But the duplication means behavior could drift.

**Fix**: Move to a single `handleTitleChange` in `BuilderContext` or a shared hook.

---

### MIN-10: `FieldBlockList` Has Two Identical `useMemo` Calls

**File**: `FieldBlockList.tsx` (lines 48-51)

```ts
const fieldKeys = useMemo(() => fields.map(f => f.key), [fields]);
const allFieldKeys = useMemo(() => fields.map(f => f.key), [fields]);
```

These are identical computations. `allFieldKeys` is passed to `FieldBlockItem` for key uniqueness checking.

**Fix**: Use a single variable.

---

### MIN-11: No `React.memo` Custom Comparator on FieldBlockItem

**File**: `FieldBlockItem.tsx` (line 117)

The component uses `memo(function FieldBlockItem(...))` but without a custom `areEqual` comparator (checklist 6.3.2). All props including callbacks will cause re-renders if parent re-renders, even when field data hasn't changed. The `memo` wrapper helps with reference equality but callbacks from `useCallback` in the parent may still create new references on state changes.

---

### MIN-12: AdminFormsListPage Uses Direct Supabase Calls

**File**: `AdminFormsListPage.tsx` (lines 214-293)

The page contains 3 inline `supabase.from(...)` calls for duplicate, archive, and delete operations. The `useFormBuilder` hook provides `duplicateTemplate`, `deleteTemplate`, and (partially) `unpublishTemplate` -- but is not used. This duplicates logic and misses the FK-constraint handling in `useFormBuilder.deleteTemplate`.

---

## 5. Risk Mitigation Verification

### R9 (Condition references)

| Check | Status | Notes |
|-------|--------|-------|
| Condition editor lists ALL field keys except self | PASS | `otherKeys` filters correctly |
| Self-reference prevented | PASS | Dropdown excludes current field key |
| Condition validation in publish | PASS | `publish-validation.ts` checks both self-ref and non-existent refs |
| `in` operator supported | **FAIL** | Missing from `CONDITION_OPERATORS` (MAJ-2) |
| Header/Instructions excluded from condition editor | PASS | Condition editor only renders inside `!isLayout` block |

### R10 (Key uniqueness)

| Check | Status | Notes |
|-------|--------|-------|
| Real-time key uniqueness check | PASS | `keyCollision` computed from `otherKeys.includes(localKey)` |
| Inline error shown | PASS | Red border + descriptive message |
| Auto-generated keys with dedup | PASS | `generateFieldKey()` in builder-utils handles this |
| Key format validation (regex) | **PARTIAL** | `handleKeyChange` enforces `[a-z0-9_]` but uses `.slice(0, 50)` not 64 |
| Save not blocked | PASS | `handleKeyBlur` only commits if no collision |

### R19 (Touch DnD unreliability)

| Check | Status | Notes |
|-------|--------|-------|
| PointerSensor with distance:8 | PASS | Line 55-56 of FieldBlockList |
| KeyboardSensor present | PASS | Line 58-60 |
| Drag handle 44x44px | PASS | `w-[44px] h-[44px]` on handle button |
| touch-action: manipulation on handle | PASS | `style={{ touchAction: 'manipulation' }}` |
| touch-action: pan-y on scroll container | PASS | `style={{ touchAction: 'pan-y' }}` on list div |
| restrictToVerticalAxis modifier | PASS | `modifiers={[restrictToVerticalAxis]}` |
| setActivatorNodeRef on handle only | PASS | `ref={setActivatorNodeRef}` on handle button, NOT card |
| Move Up/Down fallback | PASS | Present but only on mobile (sm:hidden) |
| Move Up/Down 44px targets | **FAIL** | h-7 = 28px (MIN-4) |
| Auto-save paused during drag | **NOT VERIFIED** | No `enabled` flag passed to auto-save (CRIT-2 makes this moot) |

### R20 (Auto-save race conditions)

| Check | Status | Notes |
|-------|--------|-------|
| Serial save queue | **FAIL (dead code)** | `useBuilderAutoSave` has it, but is never used (CRIT-2) |
| 3s debounce | PASS | Both systems use 3000ms |
| Optimistic concurrency | **FAIL** | Active save path has no `.eq('updated_at', ...)` (MAJ-1) |
| Conflict detection + user feedback | **FAIL (dead code)** | Only in `useBuilderAutoSave` |
| Retry with backoff | **FAIL (dead code)** | Only in `useBuilderAutoSave` |
| Timer cleared on unmount | PASS | BuilderContext lines 332-334 |

**R20 Overall: FAIL** -- The comprehensive mitigations exist in code but are inert.

### R22 (Performance with many fields)

| Check | Status | Notes |
|-------|--------|-------|
| React.memo on FieldBlockItem | PASS | `memo(function FieldBlockItem(...))` |
| Custom areEqual comparator | FAIL | Not provided (MIN-11) |
| useCallback on handlers | PASS | All parent handlers wrapped in useCallback |
| Local state + blur-to-commit | PASS | Key editing uses local state + onBlur |
| useMemo for derived values | PASS | fillableFieldCount, fieldKeys |
| Unnecessary re-renders | PARTIAL | Memo helps, but no custom comparator |

### R23 (Blank canvas overwhelm)

| Check | Status | Notes |
|-------|--------|-------|
| Empty state panel | PASS | "No fields yet" with icon and instructions |
| Options: blank/AI/upload | **PARTIAL** | Only "Add Field" button shown; no AI generate CTA |
| AI Generate prominent CTA | FAIL | Not visible on the empty state |
| Field type picker accessible | PASS | Popover on desktop, Sheet on mobile |
| 17 field types in picker | PASS | All 17 types present in FIELD_CATEGORIES |

### R33 (Options editor bulk operations)

| Check | Status | Notes |
|-------|--------|-------|
| Mini-list of text inputs | PASS | Each option is an Input |
| Add Option + auto-focus | PASS | handleAddOption uses requestAnimationFrame |
| Enter to auto-add | PASS | handleKeyDown on Enter |
| Bulk add mode | PASS | Textarea + "Add All" button |
| Paste support | **FAIL** | No onPaste handler (MIN-2) |
| Presets | PASS | 4 presets available |
| 50 option limit | PASS | MAX_OPTIONS = 50 enforced |

---

## 6. Cross-Component Consistency Matrix

### 6.1 Dispatch Actions Used vs. Reducer Cases

| Action | Dispatched By | Reducer Case | Status |
|--------|--------------|--------------|--------|
| `HYDRATE` | AdminFormBuilderPage | YES | PASS |
| `RESET` | (none in Sprint 2) | YES | OK (unused is fine) |
| `SET_TITLE_EN` | BuilderTopBar, SettingsTab | YES | PASS |
| `SET_TITLE_ES` | SettingsTab | YES | PASS |
| `SET_DESCRIPTION_EN` | SettingsTab | YES | PASS |
| `SET_DESCRIPTION_ES` | SettingsTab | YES | PASS |
| `SET_SLUG` | BuilderTopBar, SettingsTab | YES | PASS |
| `SET_ICON` | SettingsTab | YES | PASS |
| `SET_STATUS` | BuilderTopBar, BuilderToolbar | YES | PASS |
| `SET_ACTIVE_TAB` | BuilderTabBar, AdminFormBuilderPage | YES | PASS |
| `SET_SELECTED_FIELD` | FieldList (placeholder), keyboard shortcut | YES | PASS |
| `SET_PREVIEW_MODE` | LivePreview | YES | PASS |
| `ADD_FIELD` | BuilderContext.addField | YES | PASS |
| `UPDATE_FIELD` | BuilderContext.updateField | YES | PASS |
| `REMOVE_FIELD` | BuilderContext.removeField | YES | PASS |
| `REORDER_FIELDS` | BuilderContext.moveField | YES | PASS |
| `SET_INSTRUCTIONS_EN` | InstructionsEditor (placeholder) | YES | PASS |
| `SET_INSTRUCTIONS_ES` | InstructionsEditor (placeholder) | YES | PASS |
| `SET_INSTRUCTION_LANGUAGE` | InstructionsEditor (placeholder) | YES | PASS |
| `TOGGLE_TOOL` | BuilderContext.toggleTool | YES | PASS |
| `SAVE_START` / `SAVE_SUCCESS` / `SAVE_ERROR` | BuilderContext.saveDraftInternal | YES | PASS |
| `UNDO` / `REDO` | BuilderContext.undo/redo, keyboard | YES | PASS |
| `PUBLISH_CHANGES` | (not dispatched in Sprint 2) | YES | OK (deferred) |

**No orphaned or phantom actions found.** All dispatched actions have reducer cases.

### 6.2 Props Interfaces: Type Definition vs. Actual Usage

| Component | Type Def | Actual | Match? |
|-----------|----------|--------|--------|
| BuilderTopBar | `{ language }` | `{ language }` | PASS |
| BuilderTabBar | `{ language }` | `{ language }` | PASS |
| FieldBlockItem | `{ field, isSelected, onSelect, onRemove, language }` | `{ field, isSelected, isExpanded, isFirst, isLast, allFieldKeys, language, onToggleExpand, onMoveUp, onMoveDown }` | **CRIT-4** |
| FieldTypePicker | `{ onSelect, onClose, language }` | (3 variants, combined matches) | PASS |
| FieldPropertyPanel | `{ field, allFieldKeys, language }` | `{ field, allFieldKeys, language }` | PASS |
| LivePreview | `{ fields, language }` | `{ language }` (reads fields from context) | **CRIT-5** |
| AIFillabilityIndicator | `{ score, issues, language }` | `{ score, issues, language }` | PASS |
| OptionsEditor | `{ options, onChange, language }` | `{ options, onChange, language }` | PASS |

### 6.3 Import Path Correctness

| Import | Files | Status | Notes |
|--------|-------|--------|-------|
| `@/contexts/BuilderContext` | All builder components | PASS | Consistent |
| `@/types/form-builder` | FieldPropertyPanel, AIFillabilityIndicator, OptionsEditor, FieldTypePicker, BuilderTopBar, BuilderTabBar | PASS | Correct path |
| `@/types/forms` | FieldBlockItem, FieldBlockList, AdminFormsListPage, FieldTypePicker | PASS | For FormFieldType, FormFieldDefinition |
| `@/lib/form-builder/builder-utils` | BuilderTopBar, SettingsTab, AdminFormBuilderPage, AdminFormsListPage | PASS | |
| `@/components/forms/FormBody` | LivePreview | PASS | Reuses viewer component |
| `@/hooks/use-mobile` | FieldBlockList | PASS | File exists as `.tsx` |

No circular imports detected.

---

## 7. File-by-File Review

### 7.1 BuilderTopBar.tsx
**Verdict**: PASS (minor issues)
- Bilingual strings complete (EN + ES)
- Status badges match UX plan colors exactly
- Inline-editable title with blur/enter handling
- Slug locked after publish (correct logic)
- Save status 4-state indicator
- Undo/redo buttons with proper disabled states
- Minor: Back button uses `window.confirm` (not the prettiest UX)
- Minor: Duplicate slug-from-title logic (MIN-9)

### 7.2 BuilderTabBar.tsx
**Verdict**: PASS
- Desktop: 4 underline tabs matching plan
- Mobile: 3-tab segmented control with orange active state
- Proper `role="tablist"` and `aria-selected` accessibility
- Clean separation of DESKTOP_TABS vs MOBILE_TABS arrays

### 7.3 SettingsTab.tsx
**Verdict**: PASS (minor issues)
- 3 card sections (Details, Appearance, Status) with correct `rounded-[20px]` containers
- 24 icon options in a grid picker with popover
- Slug locked after publish with lock icon
- All inputs have `htmlFor`/`id` label associations
- Minor: No props interface import (MIN-6)
- Minor: Duplicate slug-from-title logic (MIN-9)

### 7.4 BuilderToolbar.tsx
**Verdict**: MAJOR ISSUE (MAJ-8)
- Frosted glass effect correct (`bg-muted/90 backdrop-blur-md`)
- Safe area padding for notch devices
- Add Field + Publish/Save buttons
- **Positioned at `bottom-0` instead of `bottom-[72px]`** -- will overlap mobile tab bar

### 7.5 FieldBlockList.tsx
**Verdict**: PASS (minor issues)
- DnD fully configured: PointerSensor (distance:8), KeyboardSensor, restrictToVerticalAxis
- SortableContext with field keys as IDs
- Mobile move up/down handlers
- Empty state with icon + bilingual text
- Field count warnings at 30 and 50
- Desktop: Popover picker, Mobile: Sheet picker
- Minor: Duplicate `fieldKeys`/`allFieldKeys` memo (MIN-10)

### 7.6 FieldBlockItem.tsx
**Verdict**: PASS (critical type drift, minor issues)
- `memo` wrapper for performance
- `useSortable` with `setActivatorNodeRef` on handle only
- 44x44 drag handle with touch-action: manipulation
- All 17 type icons mapped
- AI fillability dot (green/amber/null)
- Type badge pill, required asterisk
- Mobile move up/down buttons (but height too small -- MIN-4)
- **Props interface diverges from type def (CRIT-4)**

### 7.7 FieldPropertyPanel.tsx
**Verdict**: PASS (major gaps for some types)
- All 17 types handled (header, instructions, all standard types)
- Key uniqueness validation with local state + onBlur commit
- Width selector (full/half)
- Condition editor with toggle, field dropdown, operator, value
- Delete with confirmation (3-second auto-reset)
- StandaloneFieldPropertyPanel wrapper for desktop right panel
- **Missing**: phone/email pattern input (MAJ-3)
- **Missing**: image max photos selector (MAJ-4)
- **Missing**: `in` condition operator (MAJ-2)

### 7.8 FieldTypePicker.tsx
**Verdict**: PASS
- All 17 types organized in 6 categories
- Grid layout with bilingual labels and Lucide icons
- 3 variants: standalone, Popover (desktop), Sheet (mobile)
- Proper open/close state management
- Tile size meets touch target minimum (p-3 + min-h-[68px])

### 7.9 OptionsEditor.tsx
**Verdict**: PASS (minor gaps)
- Inline editing with individual inputs
- Add/remove/reorder options
- Bulk add mode with textarea
- 4 common presets
- 50-option limit with warning
- Enter for fast entry, Backspace to remove empty
- Move up/down arrows per option
- **Missing**: paste support (MIN-2)
- **Missing**: 15+ radio/checkbox warning (MIN-3)

### 7.10 LivePreview.tsx
**Verdict**: PASS (type drift, dimension differences)
- Phone frame with notch + home indicator bar
- Desktop preview mode (no frame)
- Language toggle (EN/ES)
- Reuses `FormBody` from viewer (no duplication!)
- `pointer-events-none` for read-only preview
- AI fillability indicator below preview
- "Open in new tab" link when template saved
- Sticky positioning (`sticky top-4`)
- **Props diverge from type def (CRIT-5)**
- **Phone frame dimensions differ from spec (MIN-1)**

### 7.11 AIFillabilityIndicator.tsx
**Verdict**: PASS
- SVG circular progress ring with animated transition
- Color coding: red (<40), amber (40-70), green (>70)
- Expandable issues list
- Score number + "/100" label
- "No issues" positive message
- Matches props interface exactly

### 7.12 AdminFormsListPage.tsx
**Verdict**: CONDITIONAL PASS (critical + major issues)
- Status filter tabs with counts (All/Draft/Published/Archived)
- Search with case-insensitive filtering
- Card grid layout (responsive 1/2/3 columns)
- Template cards with icon, title, status badge, version, field count, relative time
- Dropdown action menu (Edit, Duplicate, Archive, Delete)
- Delete confirmation dialog
- Bilingual strings complete
- **Orders by non-existent `sort_order` column (CRIT-6)**
- **No Publish/Unpublish action (MAJ-5)**
- **No submission count check before delete (MAJ-6)**
- **Direct Supabase calls instead of useFormBuilder (MIN-12)**
- Published status badge uses `emerald` instead of `green` (very minor color drift from plan spec)

### 7.13 AdminFormBuilderPage.tsx
**Verdict**: CONDITIONAL PASS (major wiring issue)
- BuilderProvider wraps page content (correct pattern)
- Edit mode: loads template from DB
- New mode: creates empty template
- Desktop: two-column layout with right panel (preview or field properties)
- Mobile: segmented tab bar with sub-tabs
- **Imports `FieldList` placeholder instead of `FieldBlockList` (MAJ-7)**
- **Raw `as unknown as FormTemplate` cast without transformation (MIN-8)**
- **`useBuilderAutoSave` not wired (CRIT-2)**

### 7.14 useFormBuilder.ts
**Verdict**: PASS (dead code)
- Complete CRUD hook: create, update, publish, unpublish, delete, duplicate, load
- Optimistic concurrency in update (`.eq('updated_at', expectedUpdatedAt)`)
- Unique slug generation with collision handling
- FK constraint handling in delete
- **Not imported by any component** (CRIT-2)

### 7.15 useBuilderAutoSave.ts
**Verdict**: PASS (dead code)
- Serial save queue with isInFlightRef + queuedStateRef
- 3s debounce with timer cleanup
- Exponential backoff retry (3s, 6s, 12s, max 3 retries)
- Conflict detection with toast notification
- Force save for Ctrl+S bypass
- Unmount cleanup
- **Not imported by any component** (CRIT-2)

### 7.16 useRefineInstructions.ts
**Verdict**: PASS
- Multi-turn conversation history management
- Edge function invocation via supabase.functions.invoke
- Field summarization (strips unnecessary properties)
- History maintained via ref + state for stale closure prevention
- Clear history function

### 7.17 publish-validation.ts
**Verdict**: PASS (duplicate concern)
- 11 validation checks covering all plan requirements
- Error vs. warning severity levels
- Warnings for missing instructions/tools/hints
- **Duplicate of simpler version in builder-utils.ts (CRIT-3)**

### 7.18 BuilderContext.tsx
**Verdict**: PASS (save system concerns)
- 34 action types in reducer, all properly handled
- Undo/redo with snapshot stack (30 max)
- Deep-copy snapshots via spread
- Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, Escape)
- Convenience actions (addField, removeField, etc.)
- **Inline auto-save competes with useBuilderAutoSave (CRIT-1)**
- **No optimistic concurrency in saveDraftInternal (MAJ-1)**

### 7.19 form-builder.ts (Types)
**Verdict**: PASS (drift issues documented above)
- 34 BuilderAction types defined
- All state properties typed
- Component props interfaces defined (some drifted -- CRIT-4, CRIT-5)
- Hook return types defined
- FormAITool matches DB schema (CRIT-1 from Sprint 1 audit: FIXED)

---

## 8. Sprint 1 Audit Fixes Verified

| Sprint 1 Item | Status | Notes |
|----------------|--------|-------|
| CRIT-1: FormAITool ghost columns | PASS | form-builder.ts lines 26-37 match DB |
| MAJ-2: Lazy loading for admin form routes | PASS | `React.lazy` + `Suspense` in App.tsx |
| MAJ-3: refine-form-instructions returns conversationHistory | PASS | `useRefineInstructions` manages history internally |
| R20 PARTIAL: Optimistic concurrency guard | **STILL PARTIAL** | Guard exists in dead-code `useFormBuilder.updateTemplate`, not in active save path |

---

## 9. Security Review

| Check | Status | Notes |
|-------|--------|-------|
| No `dangerouslySetInnerHTML` | PASS | None found in any builder file |
| No API keys/secrets | PASS | Clean |
| No direct `supabase` in components (except pages) | PARTIAL | AdminFormsListPage has direct calls; AdminFormBuilderPage has direct load/create |
| Delete checks submission count | FAIL | Not checked (MAJ-6) |
| Slug sanitized | PASS | `handleSlugChange` enforces `[a-z0-9-]` |
| Slug immutable for published | PASS | `isSlugLocked` in both TopBar and Settings |

---

## 10. TypeScript Quality

| Check | Status | Notes |
|-------|--------|-------|
| `npx tsc --noEmit` passes | **PASS (0 errors)** | Verified |
| No `any` types in Sprint 2 files | PASS | None found (AdminFormsListPage uses `Record<string, React.ComponentType>` for Lucide which is typed) |
| All dispatch actions match union type | PASS | Verified in Section 6.1 |

---

## 11. Recommendations (Ordered by Priority)

### Must-Fix Before Sprint 3

1. **Wire `useBuilderAutoSave` into `AdminFormBuilderPage`** and remove the inline auto-save from `BuilderContext.tsx`. This single change addresses CRIT-1, CRIT-2, and MAJ-1. The `useFormBuilder.updateTemplate` function should be the canonical save path.

2. **Delete the simpler `validateForPublish` from `builder-utils.ts`** and point `useFormBuilder.ts` to `publish-validation.ts`. Update the import to destructure `{ errors }`.

3. **Update `form-builder.ts` type definitions** to match actual component interfaces (CRIT-4 + CRIT-5). Alternatively, refactor components to import and use the defined types.

4. **Replace `FieldList` import with `FieldBlockList`** in `AdminFormBuilderPage.tsx` (MAJ-7). The placeholder component makes the entire DnD system unreachable.

5. **Fix `useAdminFormTemplates` ordering** -- change `sort_order` to `updated_at desc` (CRIT-6).

6. **Fix `AdminFormBuilderPage` template loading** -- use `transformTemplateRow()` instead of raw cast (MIN-8, likely a runtime bug in edit mode).

### Should-Fix

7. Add `in` operator to condition editor (MAJ-2)
8. Add phone/email pattern input (MAJ-3)
9. Add image max photos selector (MAJ-4)
10. Add Publish/Unpublish action to forms list (MAJ-5)
11. Add submission count check before delete (MAJ-6)
12. Fix BuilderToolbar position to `bottom-[72px]` (MAJ-8)

### Nice-to-Fix

13. Unify title-to-slug logic (MIN-9)
14. Add paste support to OptionsEditor (MIN-2)
15. Match phone frame dimensions to UX spec (MIN-1)
16. Increase move up/down button height to 44px (MIN-4)
17. Add `aria-live` for save status (MIN-5)

---

## 12. Summary Scorecard

| Section | Items | Pass | Fail | Partial | N/A |
|---------|-------|------|------|---------|-----|
| 1. DnD Implementation (R19) | 25 | 21 | 2 | 1 | 1 |
| 2. Auto-Save (R20) | 21 | 8 | 10 | 2 | 1 |
| 3. Field Editor | 36 | 30 | 4 | 2 | 0 |
| 4. Live Preview | 18 | 14 | 2 | 2 | 0 |
| 5. Forms List | 26 | 19 | 5 | 2 | 0 |
| 6. Component Quality | 32 | 26 | 3 | 3 | 0 |
| 7. Cross-Component | 21 | 18 | 2 | 1 | 0 |
| 8. Sprint 1 Fixes | 7 | 5 | 1 | 1 | 0 |
| 9. Published Template | 6 | 4 | 1 | 1 | 0 |
| 10. Blank Canvas (R23) | 7 | 4 | 2 | 1 | 0 |
| 11. File Organization | 17 | 12 | 3 | 2 | 0 |
| 12. Security | 6 | 4 | 1 | 1 | 0 |
| 13. Code Quality | 10 | 9 | 0 | 1 | 0 |
| **Total** | **232** | **174** | **36** | **18** | **2** |

**Pass rate: 75%** (174/230 applicable items)

---

*This audit was conducted by the Devil's Advocate agent (Opus 4.6) through exhaustive file-by-file review of all 19 Sprint 2 deliverables plus supporting context files. Each finding includes the specific file path, line numbers, and concrete fix recommendation. The 6 critical issues primarily revolve around dead-code integration (the well-built hooks are not wired in) and type definition drift.*
