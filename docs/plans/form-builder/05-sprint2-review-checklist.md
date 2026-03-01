# Sprint 2 Review Checklist -- Devil's Advocate

> **Reviewer**: Devil's Advocate Agent (Opus 4.6)
> **Date**: 2026-02-25
> **Sprint**: 2 (Builder Core UI)
> **Plan References**: UX Section (2, 5, 6, 8, 9), Arch Section (component tree, hooks, data flow), Risks Section (R9, R10, R19, R20, R22, R23, R33)
> **Sprint 1 Code References**: `src/types/form-builder.ts`, `src/contexts/BuilderContext.tsx`, `src/lib/form-builder/builder-utils.ts`
> **Sprint 1 Audit**: `05-sprint1-audit-report.md` (CRIT-1 fixed, MAJ-2 pending lazy loading, MAJ-3 pending conversationHistory, R20 partial)

---

## How to Use This Checklist

Each item has a status field. Mark as:
- `[PASS]` -- Verified correct
- `[FAIL]` -- Defect found (describe the issue)
- `[PARTIAL]` -- Mostly correct, minor issue noted
- `[N/A]` -- Not applicable or deferred
- `[ ]` -- Not yet reviewed

---

## Section 1: Drag-and-Drop Implementation (R19 -- Critical)

### 1.1 DnD Library Setup

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.1.1 | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities` installed in `package.json` | [ ] | |
| 1.1.2 | Imports: `DndContext`, `closestCenter`, `PointerSensor`, `KeyboardSensor`, `useSensor`, `useSensors` from `@dnd-kit/core` | [ ] | UX plan Section 5.4 |
| 1.1.3 | Imports: `SortableContext`, `verticalListSortingStrategy`, `useSortable`, `sortableKeyboardCoordinates` from `@dnd-kit/sortable` | [ ] | |
| 1.1.4 | Imports: `CSS` from `@dnd-kit/utilities` | [ ] | |
| 1.1.5 | Import: `restrictToVerticalAxis` from `@dnd-kit/modifiers` | [ ] | |

### 1.2 Sensor Configuration

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.2.1 | `PointerSensor` with `activationConstraint: { distance: 8 }` (8px movement before drag starts) | [ ] | UX plan 5.4, Risk R19 mitigation #2 |
| 1.2.2 | `KeyboardSensor` with `coordinateGetter: sortableKeyboardCoordinates` for a11y | [ ] | UX plan 5.4 |
| 1.2.3 | Both sensors passed via `useSensors(pointerSensor, keyboardSensor)` | [ ] | |

### 1.3 DnD Context Configuration

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.3.1 | `DndContext` wraps the field list with `collisionDetection={closestCenter}` | [ ] | |
| 1.3.2 | `restrictToVerticalAxis` modifier applied on DndContext `modifiers` prop | [ ] | Fields only move up/down |
| 1.3.3 | `SortableContext` uses `verticalListSortingStrategy` | [ ] | |
| 1.3.4 | `SortableContext` `items` array uses field keys (not indices) as unique identifiers | [ ] | |
| 1.3.5 | `onDragEnd` handler calls `moveField(activeKey, overKey)` from `useBuilder()` context | [ ] | Maps to REORDER_FIELDS action |
| 1.3.6 | `onDragEnd` checks `active.id !== over.id` before dispatching (no-op for same position) | [ ] | |

### 1.4 Drag Handle & Touch Targets (R19 mitigations)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.4.1 | Drag handle uses `GripVertical` Lucide icon | [ ] | UX plan Section 5.1 |
| 1.4.2 | Drag handle minimum touch target is 44x44px (Apple HIG) | [ ] | R19 mitigation #1: `min-w-[44px] min-h-[44px]` or equivalent |
| 1.4.3 | Drag handle has `touch-action: manipulation` CSS | [ ] | R19 mitigation #3: prevents browser default gestures on handle |
| 1.4.4 | Scroll container has `touch-action: pan-y` (allows vertical scrolling outside handles) | [ ] | R19 mitigation #3 |
| 1.4.5 | Only the drag handle initiates drag -- NOT the entire field card | [ ] | R19 mitigation #1 |
| 1.4.6 | `useSortable` `attributes` and `listeners` spread ONLY onto the handle element | [ ] | NOT on the parent card |

### 1.5 Mobile Fallback Reorder (R19 mitigation #4)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.5.1 | Move Up / Move Down buttons visible on each field block (mobile or always) | [ ] | R19 fallback for unreliable touch DnD |
| 1.5.2 | Move Up button disabled on first field | [ ] | |
| 1.5.3 | Move Down button disabled on last field | [ ] | |
| 1.5.4 | Move Up/Down buttons call `moveField()` correctly (swap with adjacent field) | [ ] | |
| 1.5.5 | Move Up/Down buttons have min 44x44px tap targets | [ ] | |

### 1.6 DnD Visual Feedback

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.6.1 | Dragging field has visual elevation/opacity change (`CSS.Transform.toString()` applied) | [ ] | |
| 1.6.2 | Drop placeholder/indicator visible during drag | [ ] | |
| 1.6.3 | Expanded field blocks collapse during drag (only collapsed rows participate in DnD) | [ ] | UX plan Section 5.4: "Only the collapsed rows participate" |
| 1.6.4 | Auto-save does NOT fire during an active drag operation | [ ] | R7 mitigation #2 |

### 1.7 Reorder Side Effects

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.7.1 | After reorder, `order` properties are reassigned sequentially (1, 2, 3...) | [ ] | REORDER_FIELDS in reducer |
| 1.7.2 | Reorder pushes undo snapshot before mutation | [ ] | Verified in BuilderContext line 182-189 |
| 1.7.3 | Reorder marks `isDirty: true`, `saveStatus: 'unsaved'` | [ ] | |
| 1.7.4 | Condition references remain valid after reorder (R9: two-pass validation allows any field key) | [ ] | DB trigger uses full field keys set, not position-based |

---

## Section 2: Auto-Save System (R20 -- Critical)

### 2.1 Save Queue (Serial, Never Concurrent)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.1 | Auto-save uses a serial queue: a new save NEVER fires while a previous save is in-flight | [ ] | R20 mitigation #1 |
| 2.1.2 | `state.isSaving` guard prevents concurrent saves (check: `if (isSaving) return` or queue) | [ ] | Currently at BuilderContext line 365 |
| 2.1.3 | If state changes during a save, the latest state is queued for a follow-up save after the in-flight one completes | [ ] | Prevents stale-overwrite from R20 scenario |
| 2.1.4 | Debounce interval is 3 seconds (not 1s, not 5s) | [ ] | R20 mitigation #3, BuilderContext line 330 |
| 2.1.5 | Auto-save timer is cleared on unmount | [ ] | BuilderContext lines 332-334 |
| 2.1.6 | Auto-save timer is cleared on each new state change (resets debounce) | [ ] | BuilderContext line 327 |
| 2.1.7 | Auto-save only fires when `isDirty && !isSaving && templateId` | [ ] | BuilderContext line 326 |

### 2.2 Optimistic Concurrency (R20 mitigation #2)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.2.1 | Save query includes `.eq('updated_at', state.serverUpdatedAt)` concurrency guard | [ ] | Arch plan Section 3.6 -- Sprint 1 audit flagged this as PARTIAL |
| 2.2.2 | When save returns 0 rows (conflict detected), dispatch `SAVE_ERROR` with descriptive message | [ ] | |
| 2.2.3 | Conflict error shows user-friendly message: "Template modified by another user" (not raw Postgres) | [ ] | R21 mitigation |
| 2.2.4 | After successful save, `serverUpdatedAt` is updated to the returned `data.updated_at` | [ ] | BuilderContext lines 396-397 |

### 2.3 Save Payload Correctness

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.3.1 | Save payload maps camelCase state to snake_case DB columns | [ ] | BuilderContext lines 372-387 |
| 2.3.2 | Save includes `builder_state` with UI state (selectedFieldKey, activeTab, previewMode) | [ ] | For session restore |
| 2.3.3 | Save includes `fields` as JSONB array | [ ] | |
| 2.3.4 | Save includes `instructions_en`, `instructions_es` | [ ] | |
| 2.3.5 | Save includes `ai_tools` array | [ ] | |
| 2.3.6 | Save includes `title_en`, `title_es`, `description_en`, `description_es`, `slug`, `icon` | [ ] | |
| 2.3.7 | Save does NOT use `.catch()` on PostgrestFilterBuilder -- uses `try/catch` | [ ] | Deno limitation, BuilderContext lines 369-405 |

### 2.4 User Feedback (Save Status)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.4.1 | Save status indicator visible in the UI: "Saved" / "Saving..." / "Unsaved changes" / "Error" | [ ] | 4 states from SaveStatus type |
| 2.4.2 | "Saving..." state shows during `SAVE_START` | [ ] | |
| 2.4.3 | "Saved" state shows after `SAVE_SUCCESS` | [ ] | |
| 2.4.4 | "Error" state shows after `SAVE_ERROR` with retry affordance | [ ] | |
| 2.4.5 | "Unsaved changes" shows when `isDirty && !isSaving` | [ ] | |
| 2.4.6 | Manual "Save Draft" button exists (in addition to auto-save) | [ ] | Ctrl+S shortcut already wired in BuilderContext |
| 2.4.7 | Retry mechanism on save failure (retry with exponential backoff or manual retry button) | [ ] | R20 mitigation #6 equivalent |

---

## Section 3: Field Editor / Property Panel

### 3.1 Field Block Collapsed State (UX plan 5.1)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.1.1 | Collapsed field shows: drag handle, type icon, label, type badge, required badge | [ ] | UX plan Section 5.1 |
| 3.1.2 | Type icon is a Lucide icon mapped to each of the 17 field types | [ ] | e.g., `Type` for text, `Calendar` for date, `List` for select |
| 3.1.3 | Label shows `label` (or `label_es` based on current language via `useLanguage()`) | [ ] | |
| 3.1.4 | Type badge renders as a small pill showing the type name (e.g., "text", "select") | [ ] | |
| 3.1.5 | Required badge shows red asterisk when `required = true` | [ ] | |
| 3.1.6 | AI fillability indicator dot: green (has ai_hint + structured type), amber (missing ai_hint), none (non-fillable) | [ ] | UX plan Section 5.7 |
| 3.1.7 | Clicking a collapsed field block selects it (dispatches `SET_SELECTED_FIELD`) | [ ] | |
| 3.1.8 | Selected field has visual highlight (border, background change) | [ ] | |

### 3.2 Field Block Expanded / Property Panel (UX plan 5.2)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.2.1 | Selecting a field opens the property panel (desktop: right panel, mobile: full-screen editor) | [ ] | `rightPanelMode: 'field-properties'` in reducer |
| 3.2.2 | Property panel shows: Label EN, Label ES, Key, Type, Required, Placeholder, Hint, AI Hint, Width, Section | [ ] | UX plan 5.2 |
| 3.2.3 | Key input is auto-generated from label via `generateFieldKey()` | [ ] | builder-utils.ts |
| 3.2.4 | Key input is read-only / locked after first save (when template has been persisted) | [ ] | UX plan 5.2: "Key: [employee_name] (locked)" |
| 3.2.5 | Width selector: Full / Half radio options | [ ] | |
| 3.2.6 | All property changes dispatch `UPDATE_FIELD` with `{ key, updates }` | [ ] | |
| 3.2.7 | `UPDATE_FIELD` pushes undo snapshot before mutation | [ ] | BuilderContext line 161 |
| 3.2.8 | "Delete Field" button at the bottom of the property panel | [ ] | With confirmation dialog for required fields |
| 3.2.9 | Delete dispatches `REMOVE_FIELD` which clears selection if deleted field was selected | [ ] | BuilderContext lines 171-181 |

### 3.3 All 17 Field Types Handled in Property Panel

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.3.1 | `text` -- shows: label, key, required, placeholder, hint, ai_hint, width, section, condition | [ ] | Full property set |
| 3.3.2 | `textarea` -- same as text | [ ] | |
| 3.3.3 | `number` -- standard + Min/Max inputs | [ ] | UX plan 5.2: "number: Shows Min and Max inputs" |
| 3.3.4 | `date` -- standard properties | [ ] | |
| 3.3.5 | `time` -- standard properties | [ ] | |
| 3.3.6 | `datetime` -- standard properties | [ ] | |
| 3.3.7 | `phone` -- standard + optional Pattern input | [ ] | UX plan 5.2: "text/phone/email: Pattern input for regex validation" |
| 3.3.8 | `email` -- standard + optional Pattern input | [ ] | |
| 3.3.9 | `select` -- standard + OptionsEditor | [ ] | |
| 3.3.10 | `radio` -- standard + OptionsEditor | [ ] | |
| 3.3.11 | `checkbox` -- standard + OptionsEditor | [ ] | |
| 3.3.12 | `signature` -- limited properties (no ai_hint, no placeholder) | [ ] | Non-AI-fillable type |
| 3.3.13 | `image` -- limited + Max photos selector (1-5) | [ ] | Arch plan Section 2.3 |
| 3.3.14 | `file` -- limited properties | [ ] | |
| 3.3.15 | `contact_lookup` -- standard + Category filter dropdown | [ ] | UX plan 5.2: "contact_lookup: Category dropdown" |
| 3.3.16 | `header` -- REDUCED property set: Header Text EN, Header Text ES, Width always Full | [ ] | UX plan 5.2b: no key/required/placeholder/ai_hint/options |
| 3.3.17 | `instructions` -- REDUCED property set: Content EN (hint), Content ES (hint_es), Width | [ ] | UX plan 5.2a: maps to `hint` property |

### 3.4 Options Editor (R33 -- for select/radio/checkbox)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.4.1 | Options editor displays as a mini-list of text inputs | [ ] | UX plan Section 5.3 |
| 3.4.2 | Each option row has an editable text input and a delete (X) button | [ ] | |
| 3.4.3 | "Add Option" button appends a new empty input and auto-focuses it | [ ] | |
| 3.4.4 | Pressing Enter in the last option auto-adds a new one (fast entry) | [ ] | UX plan 5.3 |
| 3.4.5 | **Bulk add mode**: textarea for one option per line + "Add all" button | [ ] | R33 mitigation #1 |
| 3.4.6 | **Paste support**: parses clipboard content (comma or newline separated) into options | [ ] | R33 mitigation #2 |
| 3.4.7 | Common presets available: "Yes/No", "Yes/No/N/A", "Departments", etc. | [ ] | R33 mitigation #3 (optional but recommended) |
| 3.4.8 | Options limited to 50 per field (UI-level enforcement matching DB trigger) | [ ] | Audit C3 resolution: limit is 50 |
| 3.4.9 | Warning shown at 15+ options for radio/checkbox: "Consider converting to searchable select" | [ ] | R12 mitigation |
| 3.4.10 | Inline editing of existing options (click to edit) | [ ] | |

### 3.5 Key Uniqueness Validation (R10)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.5.1 | Real-time key uniqueness check as admin types/edits a key | [ ] | R10 mitigation #1 |
| 3.5.2 | Inline error shown when key already exists: "This key is already used by [field label]" | [ ] | |
| 3.5.3 | Auto-generated keys use dedup suffix: `employee_name`, `employee_name_2`, etc. | [ ] | builder-utils.ts `generateFieldKey()` already does this |
| 3.5.4 | Key format validation: matches regex `^[a-z][a-z0-9_]{0,63}$` | [ ] | Must match DB trigger Rule 4 |
| 3.5.5 | Invalid key format shows inline error before save attempt | [ ] | |
| 3.5.6 | Save is NOT blocked by key validation (validation is advisory; DB trigger catches errors as fallback) | [ ] | Or alternatively: save IS blocked and shows all errors |

### 3.6 Condition Editor (R9)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.6.1 | Condition editor shows: enable/disable toggle, field dropdown, operator dropdown, value input | [ ] | Arch plan Section 2.3: FieldConditionEditor |
| 3.6.2 | Field dropdown lists ALL field keys in the template EXCEPT the current field | [ ] | R9 fix: any field, not just earlier ones |
| 3.6.3 | Self-reference is prevented (current field key excluded from dropdown) | [ ] | R9 mitigation |
| 3.6.4 | Operator options: eq, neq, in, exists | [ ] | From forms.ts FormFieldCondition type |
| 3.6.5 | Value input adapts based on referenced field type (text input for text, select for choice fields) | [ ] | |
| 3.6.6 | `FieldConditionEditorProps` matches: `condition`, `availableFieldKeys`, `fieldMap`, `onChange`, `language` | [ ] | form-builder.ts lines 387-393 |
| 3.6.7 | Condition changes dispatch `UPDATE_FIELD` with updated condition object | [ ] | |
| 3.6.8 | Header and Instructions field types do NOT show the condition editor | [ ] | UX plan 5.2: "All types except header and instructions" |

---

## Section 4: Live Preview

### 4.1 FormBody/FormSection/FormFieldRenderer Reuse

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.1 | LivePreview component reuses existing `FormBody` from the viewer | [ ] | Arch plan Section 2.1: "REUSED from viewer" |
| 4.1.2 | `FormBody` receives `fields`, `values: {}` (empty), `errors: {}`, `language`, `onFieldChange: () => {}` (no-op) | [ ] | UX plan Section 6.1 |
| 4.1.3 | All form inputs are rendered in disabled/read-only mode | [ ] | UX plan 6.2: "all inputs disabled" |
| 4.1.4 | `FormSection` components are reused from the viewer | [ ] | |
| 4.1.5 | `FormFieldRenderer` components are reused from the viewer | [ ] | |
| 4.1.6 | NO duplicate field rendering code in the builder (all rendering goes through the shared viewer components) | [ ] | |

### 4.2 Phone Frame (Desktop)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.2.1 | Phone frame wrapper: `w-[375px] h-[700px] rounded-[40px] border-[6px]` | [ ] | UX plan Section 6.1 |
| 4.2.2 | Decorative notch at top: `w-[120px] h-[28px] rounded-full` | [ ] | |
| 4.2.3 | Content area is scrollable: `overflow-y-auto` | [ ] | |
| 4.2.4 | Phone frame is sticky on desktop: `sticky top-*` positioning | [ ] | UX plan Section 2.1: "LIVE PREVIEW (sticky)" |
| 4.2.5 | Phone frame width: `w-80 xl:w-96` matching `DockedFormAIPanel` | [ ] | UX plan Section 2.1 |

### 4.3 Language Toggle

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.3.1 | Language toggle `[EN/ES]` displayed above the preview | [ ] | UX plan Section 6.2 |
| 4.3.2 | Toggle switches the `language` prop passed to `FormBody` | [ ] | |
| 4.3.3 | Labels, placeholders, hints, section headers switch between EN and ES variants | [ ] | |

### 4.4 AI Fillability Score

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.4.1 | AI Fillability score displayed below the phone frame | [ ] | UX plan Section 6.3 |
| 4.4.2 | Score computed via `computeAiFillabilityScore()` from builder-utils.ts | [ ] | Already implemented |
| 4.4.3 | Circular progress badge with color coding: red (<40), amber (40-70), green (>70) | [ ] | UX plan 6.3 |
| 4.4.4 | Clicking the score expands to show the issues list | [ ] | |
| 4.4.5 | `AIFillabilityIndicatorProps` matches: `score`, `issues`, `language` | [ ] | form-builder.ts lines 381-385 |

### 4.5 Preview Behavior

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.5.1 | Preview re-renders in real-time on field changes (title, fields, description) | [ ] | UX plan 6.2 |
| 4.5.2 | Empty state: "Add fields to see a preview" centered message | [ ] | UX plan 6.2 |
| 4.5.3 | "Open in new tab" link below preview (visible only if template has been saved) | [ ] | UX plan Section 6.4 |
| 4.5.4 | `LivePreviewProps` matches: `fields`, `language` | [ ] | form-builder.ts lines 376-379 |

### 4.6 Responsive Preview Behavior

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.6.1 | Desktop (>= 1024px): sticky sidebar with phone frame | [ ] | UX plan Section 2.1 |
| 4.6.2 | Mobile (< 1024px): separate "Preview" tab (full-width, no phone frame) | [ ] | UX plan Section 8.4 |
| 4.6.3 | Mobile preview has language toggle at top | [ ] | UX plan 8.4 |
| 4.6.4 | When AI Refine sidebar is open (desktop), it replaces the preview column | [ ] | UX plan Section 3.2 |

---

## Section 5: Admin Forms List Page

### 5.1 Route & Access

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.1.1 | Route `/admin/forms` exists and renders `AdminFormsListPage` | [ ] | Already registered in Sprint 1 |
| 5.1.2 | Protected by `ProtectedRoute` with `requiredRole="manager"` | [ ] | Sprint 1 verified |
| 5.1.3 | Lazy loaded via `React.lazy` + `Suspense` | [ ] | Sprint 1 audit MAJ-2: convert static imports |

### 5.2 Status Filter Tabs

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.2.1 | Filter tabs: All | Draft | Published | Archived | [ ] | UX plan Section 9.2, Arch plan 2.2 |
| 5.2.2 | Default active tab is "All" | [ ] | |
| 5.2.3 | Filtering is client-side (all templates fetched, filtered in memory) | [ ] | |
| 5.2.4 | `AdminFormsHeaderProps.statusFilter` type: `FormTemplateStatus | 'all'` | [ ] | form-builder.ts line 318 |
| 5.2.5 | `AdminFormsHeaderProps.onStatusFilterChange` callback provided | [ ] | |

### 5.3 Search

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.3.1 | Search input visible at top of the forms list | [ ] | UX plan Section 9.2 |
| 5.3.2 | Search filters templates by title (EN and ES) | [ ] | Local text filter |
| 5.3.3 | Search is case-insensitive | [ ] | |
| 5.3.4 | Search interacts with status filter (both filters applied simultaneously) | [ ] | |
| 5.3.5 | `AdminFormsHeaderProps.searchQuery` and `AdminFormsHeaderProps.onSearchChange` provided | [ ] | |

### 5.4 Card Grid / Table (Responsive)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.4.1 | Mobile (< 1024px): renders as a card list (one card per template) | [ ] | UX plan Section 9.2 mobile layout |
| 5.4.2 | Desktop (>= 1024px): renders as a compact table with columns | [ ] | UX plan Section 9.2 desktop layout |
| 5.4.3 | Card shows: icon + title, status badge, version, field count, last edited time | [ ] | |
| 5.4.4 | Table columns: Title, Status, Version, Fields, Updated, Actions | [ ] | Arch plan Section 2.2 |
| 5.4.5 | Empty state (no templates): CTA to create first form | [ ] | `EmptyFormsState` component |
| 5.4.6 | Empty state from filter (templates exist but none match): "No templates match your filters" | [ ] | |

### 5.5 Status Badges

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.5.1 | Draft badge: `bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300` | [ ] | UX plan Section 9.3 |
| 5.5.2 | Published badge: `bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300` | [ ] | |
| 5.5.3 | Archived badge: `bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400` | [ ] | |

### 5.6 Action Menu

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.6.1 | Overflow menu (`...`) per row/card with dropdown | [ ] | UX plan Section 9.4 |
| 5.6.2 | **Edit** action: navigates to `/admin/forms/:id/edit` | [ ] | |
| 5.6.3 | **Duplicate** action: creates a copy as a new draft | [ ] | |
| 5.6.4 | **Publish / Unpublish** toggle action | [ ] | |
| 5.6.5 | **Archive** action: sets status to `archived` | [ ] | |
| 5.6.6 | **Delete** action: confirmation dialog before deletion | [ ] | |
| 5.6.7 | Delete is BLOCKED (hidden or disabled) if template has submissions | [ ] | UX plan 9.4: "only for never-published templates with 0 submissions" |
| 5.6.8 | Delete blocked check: query `form_submissions` count before enabling delete | [ ] | R26 mitigation |
| 5.6.9 | Submission count shown in the list (so admin sees which forms have data) | [ ] | R26 mitigation #4 |

### 5.7 "New Form" Entry Point

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.7.1 | "New Form" button visible in the header / toolbar | [ ] | |
| 5.7.2 | Navigates to `/admin/forms/new` | [ ] | |
| 5.7.3 | Offers two paths: Blank Form vs. AI Generate | [ ] | UX plan Section 7.1 (R23 mitigation) |
| 5.7.4 | Blank Form path creates empty template in builder | [ ] | |
| 5.7.5 | AI Generate path opens the generation flow (chat/describe) | [ ] | |

### 5.8 Data Hook

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.8.1 | `useAdminFormTemplates()` hook (or similar) fetches all templates for the group | [ ] | Arch plan file 32 |
| 5.8.2 | Returns `templates`, `isLoading`, `error`, `refetch` | [ ] | `UseAdminFormTemplatesReturn` in form-builder.ts |
| 5.8.3 | Fetches ALL statuses (draft + published + archived) | [ ] | Admin sees everything |
| 5.8.4 | Ordered by `updated_at` descending (most recently edited first) | [ ] | |

---

## Section 6: Component Quality

### 6.1 Context Usage

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.1.1 | All builder components use `useBuilder()` from `BuilderContext` (not prop drilling state) | [ ] | |
| 6.1.2 | No component creates its own local copy of builder state (no duplicate state management) | [ ] | |
| 6.1.3 | Convenience actions (`addField`, `removeField`, `updateField`, `moveField`, `selectField`, `toggleTool`, `undo`, `redo`) used instead of raw `dispatch` where available | [ ] | BuilderContext lines 419-450 |
| 6.1.4 | Components that only need `state` do not destructure `dispatch` (avoids unnecessary re-renders) | [ ] | |
| 6.1.5 | `BuilderProvider` wraps `AdminFormBuilderPage` at the page level | [ ] | Arch plan Section 2.3 |

### 6.2 TypeScript Quality

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.2.1 | No `any` types in new Sprint 2 files | [ ] | |
| 6.2.2 | Props interfaces match definitions in `src/types/form-builder.ts` | [ ] | |
| 6.2.3 | All dispatch actions match `BuilderAction` union type cases | [ ] | Cross-ref with reducer |
| 6.2.4 | All new components have explicit return types or inferred `JSX.Element` | [ ] | |
| 6.2.5 | `FormFieldDefinition` imported from `@/types/forms` (not redeclared) | [ ] | |
| 6.2.6 | `FormFieldType` used for type params (not raw string literals) | [ ] | |
| 6.2.7 | `npx tsc --noEmit` passes with 0 errors after Sprint 2 changes | [ ] | |

### 6.3 Performance (R22)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.3.1 | `React.memo` on `FieldBlockItem` (or equivalent collapsed field card) | [ ] | R22 mitigation #1 |
| 6.3.2 | Custom `areEqual` comparator on memoized field cards (compares only field data, not array ref) | [ ] | |
| 6.3.3 | `useCallback` on all field update/select handlers passed as props | [ ] | R22 mitigation #2 |
| 6.3.4 | Field property panel edits use local state + blur-to-commit (or debounced dispatch) to avoid re-rendering the full field list on every keystroke | [ ] | R22 mitigation #3 |
| 6.3.5 | `useMemo` for derived values: `fillableFieldCount`, `canUndo`, `canRedo`, `aiFillabilityScore` | [ ] | BuilderContext lines 453-455 |
| 6.3.6 | No unnecessary re-renders: changing `selectedFieldKey` does NOT cause all field cards to re-render | [ ] | Only the selected/deselected card should update |
| 6.3.7 | Benchmark consideration: form with 30+ fields should not lag visibly on edit operations | [ ] | |

### 6.4 Responsive Design (Mobile-First)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.4.1 | Builder layout: single column on mobile (< 1024px), two-column on desktop (>= 1024px) | [ ] | UX plan Section 2.1, 2.2 |
| 6.4.2 | Mobile uses tabbed navigation: Fields / Settings / Preview | [ ] | UX plan Section 8.1 |
| 6.4.3 | Mobile tab bar: segmented control matching `FormToolbar` pattern | [ ] | `rounded-lg bg-muted/50 p-0.5` |
| 6.4.4 | Active tab: `bg-orange-500 text-white shadow-sm` | [ ] | UX plan Section 8.1 |
| 6.4.5 | Mobile Settings tab: Form Metadata + Instructions + AI Tools in single scroll | [ ] | UX plan 8.3 |
| 6.4.6 | Mobile field editing: full-screen editor (not inline) on field tap | [ ] | UX plan Section 8.2 |
| 6.4.7 | Mobile full-screen editor has "Done" button to return to field list | [ ] | |
| 6.4.8 | Mobile floating toolbar: `[+ Add Field] <spacer> [Publish]` at `bottom-[72px]` | [ ] | UX plan Section 8.5 |
| 6.4.9 | All touch targets are minimum 44x44px | [ ] | Apple HIG |
| 6.4.10 | Frosted glass toolbar: `bg-muted/90 backdrop-blur-md` | [ ] | UX plan Section 1.2 |

### 6.5 Accessibility

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.5.1 | Drag-and-drop supports keyboard navigation via `KeyboardSensor` | [ ] | Section 1.2 |
| 6.5.2 | All interactive elements have `aria-label` or visible label | [ ] | |
| 6.5.3 | Drag handle has `role="button"` and `aria-describedby` or `aria-roledescription="sortable"` | [ ] | @dnd-kit provides this via `attributes` spread |
| 6.5.4 | Status changes (save, error) announced via `aria-live` region or toast | [ ] | |
| 6.5.5 | Field type picker tiles are keyboard navigable (Tab + Enter) | [ ] | |
| 6.5.6 | Form inputs in property panel have associated `<label>` elements | [ ] | |
| 6.5.7 | Color is not the ONLY indicator (e.g., fillability score uses color + number + text) | [ ] | |
| 6.5.8 | Focus management: selecting a field moves focus to the property panel | [ ] | |
| 6.5.9 | Escape key deselects the current field | [ ] | BuilderContext line 353-354 |

### 6.6 Visual Design Match (UX Plan Compliance)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.6.1 | Card radius: `rounded-[20px]` for containers | [ ] | UX plan Section 1.2 |
| 6.6.2 | Tile radius: `rounded-[12px]` | [ ] | |
| 6.6.3 | Input radius: `rounded-xl` | [ ] | |
| 6.6.4 | Shadows: `shadow-card` for containers, `shadow-sm` for tiles | [ ] | |
| 6.6.5 | Borders: `border border-black/[0.04] dark:border-white/[0.06]` | [ ] | Ultra-subtle border |
| 6.6.6 | Accent: `bg-orange-500` for primary actions | [ ] | |
| 6.6.7 | Animation: `animate-in slide-in-from-right-4 fade-in-0 duration-500 ease-out` for panels | [ ] | |
| 6.6.8 | Section headers: `text-[13px] font-bold uppercase tracking-wider` | [ ] | |
| 6.6.9 | AI Tools card: all tools in one `bg-card rounded-[20px]` card, separated by hairline dividers | [ ] | UX plan Section 4.3 |
| 6.6.10 | Tool row layout: icon tile (9x9 `rounded-[10px] bg-primary/10`) + text + Switch toggle | [ ] | UX plan 4.3 code snippet |

---

## Section 7: Cross-Component Consistency

### 7.1 Dispatch Actions vs. Reducer Cases

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.1.1 | Every `dispatch({ type: ... })` call in Sprint 2 components matches a case in `builderReducer` | [ ] | |
| 7.1.2 | No new action types introduced without corresponding reducer case | [ ] | |
| 7.1.3 | No orphaned reducer cases that no component dispatches | [ ] | |
| 7.1.4 | Action payload shapes match the `BuilderAction` union type exactly | [ ] | |

### 7.2 Props Interfaces vs. Type Definitions

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.2.1 | `FieldBlockItemProps` matches: `field`, `isSelected`, `onSelect`, `onRemove`, `language` | [ ] | form-builder.ts lines 332-338 |
| 7.2.2 | `FieldTypePickerProps` matches: `onSelect`, `onClose`, `language` | [ ] | form-builder.ts lines 340-344 |
| 7.2.3 | `FieldPropertyPanelProps` matches: `field`, `allFieldKeys`, `language` | [ ] | form-builder.ts lines 346-350 |
| 7.2.4 | `InstructionsEditorProps` matches: `instructionsEn`, `instructionsEs`, `activeLanguage`, `onLanguageChange`, `onChange`, `onRefine`, `language` | [ ] | form-builder.ts lines 352-360 |
| 7.2.5 | `AIToolsPickerProps` matches: `enabledTools`, `onToggle`, `language` | [ ] | form-builder.ts lines 362-366 |
| 7.2.6 | `ToolRecommendationsProps` matches: `templateTitle`, `fields`, `enabledTools`, `onEnable`, `language` | [ ] | form-builder.ts lines 368-374 |
| 7.2.7 | `LivePreviewProps` matches: `fields`, `language` | [ ] | form-builder.ts lines 376-379 |
| 7.2.8 | `AIFillabilityIndicatorProps` matches: `score`, `issues`, `language` | [ ] | form-builder.ts lines 381-385 |
| 7.2.9 | `FieldConditionEditorProps` matches: `condition`, `availableFieldKeys`, `fieldMap`, `onChange`, `language` | [ ] | form-builder.ts lines 387-393 |
| 7.2.10 | `OptionsEditorProps` matches: `options`, `onChange`, `language` | [ ] | form-builder.ts lines 395-399 |
| 7.2.11 | `AdminFormsHeaderProps` matches: `searchQuery`, `onSearchChange`, `statusFilter`, `onStatusFilterChange`, `onCreateNew`, `language` | [ ] | form-builder.ts lines 315-322 |
| 7.2.12 | `BuilderTopBarProps` matches: `language` | [ ] | form-builder.ts lines 324-326 |

### 7.3 Import Path Correctness

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.3.1 | Types imported from `@/types/form-builder` (not `@/types/forms` for builder-specific types) | [ ] | |
| 7.3.2 | `FormFieldDefinition`, `FormFieldType`, `FormTemplateStatus` imported from `@/types/forms` | [ ] | |
| 7.3.3 | `useBuilder` imported from `@/contexts/BuilderContext` | [ ] | |
| 7.3.4 | Builder utilities imported from `@/lib/form-builder/builder-utils` | [ ] | |
| 7.3.5 | No circular imports between builder components | [ ] | |
| 7.3.6 | Existing viewer components (`FormBody`, `FormSection`, `FormFieldRenderer`) imported from their existing paths | [ ] | NOT duplicated into builder |

### 7.4 State Management Boundaries

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.4.1 | Template data lives in BuilderContext (not local state in child components) | [ ] | |
| 7.4.2 | UI-only state (e.g., "is FieldTypePicker open?", "is bulk-add mode active?") can be local component state | [ ] | This is correct -- ephemeral UI state |
| 7.4.3 | Field property panel inputs may use local state with debounced/blur commit to context | [ ] | R22 mitigation #3 |
| 7.4.4 | No component reads directly from `supabase` -- all DB operations go through context or hooks | [ ] | |
| 7.4.5 | `selectedFieldKey` is the single source of truth for which field is being edited | [ ] | In BuilderState |
| 7.4.6 | `activeTab` is the single source of truth for mobile tab navigation | [ ] | In BuilderState |

---

## Section 8: Sprint 1 Audit Fixes Verified

### 8.1 Must-Fix Items from Sprint 1

| # | Audit Item | Expected Fix | Status | Notes |
|---|------------|-------------|--------|-------|
| 8.1.1 | CRIT-1: `FormAITool` ghost columns | `FormAITool` now matches DB exactly: `id`, `labelEn`, `labelEs`, `descriptionEn`, `descriptionEs`, `searchFunction`, `icon`, `status`, `sortOrder`, `createdAt` | [ ] | Verified in form-builder.ts lines 26-37 |
| 8.1.2 | MAJ-2: Lazy loading for admin form routes | `React.lazy(() => import(...))` + `Suspense` for both admin form pages | [ ] | In App.tsx |
| 8.1.3 | MAJ-3: `refine-form-instructions` returns `conversationHistory` | Edge function response includes updated history | [ ] | Or: frontend reconstructs history (document which approach) |
| 8.1.4 | R20 PARTIAL: Optimistic concurrency guard in save query | Save includes `.eq('updated_at', serverUpdatedAt)` | [ ] | Was flagged as infrastructure-only in Sprint 1 |

### 8.2 Sprint 1 Patterns Preserved

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 8.2.1 | `BuilderProvider` still uses `useReducer` (not Zustand/Jotai) | [ ] | |
| 8.2.2 | `useBuilder()` throws outside `BuilderProvider` | [ ] | |
| 8.2.3 | All 34 original BuilderAction types still handled in reducer | [ ] | Sprint 1 audit Section 5.7 |
| 8.2.4 | Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, Escape) still work | [ ] | |
| 8.2.5 | `takeSnapshot()` deep-copies fields (not reference copy) | [ ] | Uses `map(f => ({ ...f }))` |
| 8.2.6 | Undo past stack capped at 30 (`maxHistory`) | [ ] | |
| 8.2.7 | `SAVE_SUCCESS` on published template sets `hasUnpublishedChanges: true` | [ ] | |

---

## Section 9: Editing a Published Template (UX plan 9.5)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 9.1 | Editing a published template keeps `status = 'published'` (does NOT revert to draft) | [ ] | UX plan 9.5 decision |
| 9.2 | Amber indicator "Unpublished changes" shown when `hasUnpublishedChanges === true` | [ ] | |
| 9.3 | "Publish Changes" button appears (replaces "Save Draft") for published templates with changes | [ ] | `bg-orange-500` primary |
| 9.4 | Clicking "Publish Changes" dispatches `PUBLISH_CHANGES` which bumps version and resets `hasUnpublishedChanges` | [ ] | |
| 9.5 | Slug field is read-only for published templates (`publishedAt !== null`) with lock icon and tooltip | [ ] | R25 mitigation |
| 9.6 | After publish, live form fillers see updated fields immediately | [ ] | |

---

## Section 10: Blank Canvas / Getting Started (R23)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 10.1 | Empty builder (0 fields, new template) shows a "Getting Started" panel | [ ] | R23 mitigation #1 |
| 10.2 | Options: "Start blank", "Describe your form (AI)", "Upload existing form" | [ ] | UX plan 7.1 |
| 10.3 | AI Generate is the most prominent CTA on the empty state | [ ] | R23 mitigation #5 |
| 10.4 | Field type picker accessible from "Add Field" button | [ ] | UX plan Section 5.5 |
| 10.5 | Field type picker grid: 17 tiles organized by category (Input, Date/Time, Choice, Special) | [ ] | UX plan 5.5 ASCII layout |
| 10.6 | Field type picker: Popover on desktop, bottom Sheet on mobile | [ ] | UX plan 5.5 |
| 10.7 | Selecting a type creates a new field with defaults from `getDefaultField()` | [ ] | builder-utils.ts |

---

## Section 11: File Organization

### 11.1 Expected New Files

| # | Expected File | Status | Notes |
|---|--------------|--------|-------|
| 11.1.1 | `src/pages/admin/AdminFormsListPage.tsx` (or `src/pages/AdminFormsList.tsx`) | [ ] | Page component |
| 11.1.2 | `src/pages/admin/AdminFormBuilderPage.tsx` (or `src/pages/AdminFormBuilder.tsx`) | [ ] | Page component |
| 11.1.3 | `src/components/forms/builder/BuilderLayout.tsx` | [ ] | Two-column / tabbed shell |
| 11.1.4 | `src/components/forms/builder/BuilderTopBar.tsx` (or BuilderHeader) | [ ] | Back, title, save, publish |
| 11.1.5 | `src/components/forms/builder/BuilderTabBar.tsx` | [ ] | Mobile tabs |
| 11.1.6 | `src/components/forms/builder/DraggableFieldList.tsx` | [ ] | DnD wrapper |
| 11.1.7 | `src/components/forms/builder/FieldBlockItem.tsx` (or FieldBlock) | [ ] | Collapsed/expanded field |
| 11.1.8 | `src/components/forms/builder/FieldTypePicker.tsx` | [ ] | 17-type grid picker |
| 11.1.9 | `src/components/forms/builder/FieldPropertyPanel.tsx` | [ ] | Property editing panel |
| 11.1.10 | `src/components/forms/builder/FieldOptionsEditor.tsx` | [ ] | Options list for select/radio/checkbox |
| 11.1.11 | `src/components/forms/builder/FieldConditionEditor.tsx` | [ ] | Conditional visibility setup |
| 11.1.12 | `src/components/forms/builder/LivePreview.tsx` | [ ] | Phone frame + FormBody |
| 11.1.13 | `src/components/forms/builder/AIFillabilityBadge.tsx` | [ ] | Score indicator |
| 11.1.14 | `src/components/forms/builder/AIToolsPicker.tsx` | [ ] | Tool toggle cards |
| 11.1.15 | `src/components/forms/builder/InstructionsEditor.tsx` | [ ] | EN/ES textarea + AI Refine |
| 11.1.16 | `src/components/forms/builder/AdminFormCard.tsx` | [ ] | Card/row for forms list |
| 11.1.17 | `src/hooks/use-admin-templates.ts` | [ ] | Fetch all templates hook |

### 11.2 Files Modified (Sprint 1 code touched by Sprint 2)

| # | Expected Modified File | Status | Notes |
|---|----------------------|--------|-------|
| 11.2.1 | `src/App.tsx` -- lazy loading imports (MAJ-2 fix) | [ ] | |
| 11.2.2 | `src/types/form-builder.ts` -- any new action types or interface changes | [ ] | Should be minimal; Sprint 1 types are comprehensive |
| 11.2.3 | `src/contexts/BuilderContext.tsx` -- save queue improvement, optimistic concurrency | [ ] | R20 full mitigation |

---

## Section 12: Security Review (Sprint 2 Specific)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 12.1 | No `dangerouslySetInnerHTML` used for field labels, options, or instructions rendering | [ ] | R29: XSS prevention |
| 12.2 | No API keys or secrets in any new frontend file | [ ] | |
| 12.3 | No direct `supabase.from(...)` calls in component files -- all through hooks/context | [ ] | |
| 12.4 | Delete action checks submission count before allowing delete (server-side or client-side pre-check) | [ ] | R26 |
| 12.5 | Slug input sanitized (no special characters that could be URL-injection vectors) | [ ] | `generateSlug()` already handles this |
| 12.6 | Published template slug is immutable in the UI (not just DB-enforced) | [ ] | R25 |

---

## Section 13: Code Quality & Style

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 13.1 | No `console.log` in production component code (only `console.error` for actual errors) | [ ] | |
| 13.2 | Consistent naming: DB columns snake_case, TS properties camelCase | [ ] | |
| 13.3 | No unused imports in new files | [ ] | |
| 13.4 | No TODO or FIXME comments left unaddressed (or explicitly deferred with ticket reference) | [ ] | |
| 13.5 | File structure matches plan: `src/components/forms/builder/` for builder components | [ ] | Arch plan Section 7 |
| 13.6 | Components follow single-responsibility principle (not monolithic 500+ line files) | [ ] | |
| 13.7 | Tailwind classes match plan spec (Section 1.2 visual language) | [ ] | |
| 13.8 | Dark mode compatibility: all color classes have `dark:` variants where needed | [ ] | |
| 13.9 | Bilingual: all user-facing strings support EN/ES via `language` prop or `useLanguage()` hook | [ ] | |
| 13.10 | No hardcoded English strings without a Spanish equivalent | [ ] | |

---

## Summary Scorecard

| Section | Items | Pass | Fail | Partial | N/A |
|---------|-------|------|------|---------|-----|
| 1. DnD Implementation (R19) | -- | -- | -- | -- | -- |
| 2. Auto-Save (R20) | -- | -- | -- | -- | -- |
| 3. Field Editor | -- | -- | -- | -- | -- |
| 4. Live Preview | -- | -- | -- | -- | -- |
| 5. Forms List | -- | -- | -- | -- | -- |
| 6. Component Quality | -- | -- | -- | -- | -- |
| 7. Cross-Component Consistency | -- | -- | -- | -- | -- |
| 8. Sprint 1 Fixes | -- | -- | -- | -- | -- |
| 9. Published Template Editing | -- | -- | -- | -- | -- |
| 10. Blank Canvas (R23) | -- | -- | -- | -- | -- |
| 11. File Organization | -- | -- | -- | -- | -- |
| 12. Security | -- | -- | -- | -- | -- |
| 13. Code Quality | -- | -- | -- | -- | -- |
| **Total** | **--** | **--** | **--** | **--** | **--** |

---

*This checklist was built by the Devil's Advocate agent (Opus 4.6) from a thorough reading of the Sprint 1 audit report, Sprint 1 review checklist, all 3 Phase 5 plan documents (UX, Arch, Risks), and the existing Sprint 1 implementation code (types, context, utilities). Each item traces to a specific plan requirement, risk mitigation, or Sprint 1 audit finding. Items are ordered to match the natural review flow: DnD first (most complex new subsystem), then auto-save (correctness-critical), then component-by-component, then cross-cutting concerns.*
