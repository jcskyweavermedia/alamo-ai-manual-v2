# Phase 5: Form Builder Admin -- Master Plan

> **Status:** Planning
> **Date:** 2026-02-25
> **Phase:** 5 of 7 (Form Builder System)
> **Estimated effort:** ~6-8 sessions
> **Dependencies:** Phase 1 (DB Foundation, complete), Phase 2 (Form Viewer, complete), Phase 3 (AI Form Filling, complete)
> **Team:** 5 expert agents on Opus 4.6 (UX/UI, Backend, Architecture, Database, Devil's Advocate)

---

## Executive Summary

Phase 5 is the **hardest phase** of the Form Builder system. It gives admins/managers the ability to create, edit, and publish form templates through an intuitive, Apple-like builder UI with AI assistance. The builder must feel like a consumer product -- a restaurant manager should be able to create a simple form within 3 minutes without reading instructions.

### The 5 Core Requirements

| # | Requirement | Solution |
|---|-------------|----------|
| 1 | **Instructions at the top** -- AI reads these to know how to fill the form | Instructions editor tab with plain textarea + AI refine sidebar |
| 2 | **AI tools picker** -- Let admins choose what data sources the AI can access | Toggle-switch cards powered by `form_ai_tools` config table (5 tools) |
| 3 | **AI instruction refiner** -- Chat-based bot that helps mold instructions | `refine-form-instructions` edge function with multi-turn conversation |
| 4 | **AI-fillable form blocks** -- Fields must be easily filled by AI with edge case rails | Enhanced validation trigger (7 rules), AI fillability score, ai_hint per field |
| 5 | **Follow current design** -- Form blocks match the existing form viewer mockup | Reuse `FormBody` / `FormSection` / `FormFieldRenderer` for live preview |

---

## Detailed Section Documents

This master plan is supported by 5 detailed section documents, each written by a domain expert:

| Section | File | Author | Pages | Key Deliverables |
|---------|------|--------|-------|-----------------|
| **UX/UI Design** | [`05-phase-ux-section.md`](./05-phase-ux-section.md) | Sr. UX/UI Designer | ~800 lines | Builder layout, field blocks, live preview, ASCII mockups, 36 new component files, accessibility checklist, 15 design decisions |
| **Frontend Architecture** | [`05-phase-arch-section.md`](./05-phase-arch-section.md) | Sr. Technical Architect | ~700 lines | Component tree, `useReducer` + Context + undo/redo, BuilderState/BuilderAction types, 6 data flow diagrams, reuse strategy, ~25 new files |
| **Database & Schema** | [`05-phase-db-section.md`](./05-phase-db-section.md) | Sr. Database Architect | ~1100 lines | 3 new columns, `form_ai_tools` table (5 rows), enhanced validation trigger (7 rules), publish trigger, 4 migrations (~250 lines SQL), 11 verification tests |
| **Backend & Edge Functions** | [`05-phase-form-builder-admin-backend.md`](./05-phase-form-builder-admin-backend.md) | Sr. Backend Developer | ~1350 lines | 2 new edge functions (`refine-form-instructions`, `generate-form-template`), 2 new tool aliases, template CRUD API, version trigger |
| **Risk Assessment** | [`05-phase-risks-section.md`](./05-phase-risks-section.md) | Devil's Advocate | ~600 lines | 34 risks across 7 categories (5 Critical, 10 Major, 13 Moderate, 6 Minor), mitigations, 5 critical-path blockers |

---

## Audit Status

**Audited**: 2026-02-25 by 4 specialized agents
**Full report**: `05-phase-audit-report.md`

| Audit | Result |
|-------|--------|
| Cross-Section Consistency | 25 findings → all resolved |
| Template Compatibility | ✅ Both seed templates pass all 7 rules |
| Codebase Feasibility | ✅ 18/20 verified, 2 partial, 0 incorrect |
| Implementation Gaps | 31 findings → 9 critical items resolved |

### Resolutions Applied (post-audit)

1. **Tool ID unified**: `search_standards` everywhere (DB seed = source of truth)
2. **Limits unified**: max 50 fields, max 50 options (backend plan updated)
3. **Single publish trigger**: `handle_form_template_publish()` (backend plan's version marked SUPERSEDED)
4. **Response casing**: `mapGeneratedTemplate()` utility handles snake→camel mapping (arch plan updated)
5. **Instructions/header fields**: Property panel spec added for display-only field types (UX plan updated)
6. **JSON error handling**: try-catch + finish_reason check added to refine function (backend plan updated)
7. **Edit-published flow**: Keep `published` status, show "Unpublished changes" badge, explicit "Publish Changes" (UX + arch plans updated)
8. **FormTemplate type**: `publishedAt`, `builderState`, `aiRefinementLog` added to interface spec (arch plan updated)
9. **Condition ordering**: Two-pass validation, conditions reference ANY field key (DB plan updated)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  ROUTES                                                             │
│  /admin/forms              → AdminFormsListPage                     │
│  /admin/forms/new          → AdminFormBuilderPage (blank/AI/clone)  │
│  /admin/forms/:id/edit     → AdminFormBuilderPage (edit existing)   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │     BuilderProvider          │
                     │  (Context + useReducer +     │
                     │   undo/redo middleware)       │
                     └──────────────┬──────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
    ┌────┴────┐              ┌──────┴──────┐            ┌──────┴──────┐
    │ Builder │              │   Builder    │            │    Live     │
    │ Header  │              │    Tabs      │            │  Preview    │
    │ (title, │              │              │            │ (phone      │
    │  slug,  │              │ ┌──────────┐ │            │  frame,     │
    │  icon)  │              │ │  Fields  │ │            │  FormBody   │
    └─────────┘              │ │  tab     │ │            │  reuse)     │
                             │ ├──────────┤ │            └─────────────┘
                             │ │  Instrs  │ │
                             │ │  tab     │ │
                             │ ├──────────┤ │
                             │ │ AI Tools │ │
                             │ │  tab     │ │
                             │ ├──────────┤ │
                             │ │ Settings │ │
                             │ │  tab     │ │
                             │ └──────────┘ │
                             └──────────────┘
```

### Desktop Layout (>= 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [<] Employee Write-Up          Draft     slug: employee-write-up   │
├────────────────────────────────────────────┬─────────────────────────┤
│  [Fields] [Instructions] [AI Tools] [⚙]   │  📱 PREVIEW             │
├────────────────────────────────────────────┤  ┌───────────────────┐  │
│                                            │  │  (phone frame)    │  │
│  ☰ ■ Employee Name        text   *req     │  │                   │  │
│  ☰ ■ Position              select         │  │  Employee Write-Up│  │
│  ☰ ■ Department            select         │  │  ═══ 0% ═══      │  │
│  ────────────────────────────────────      │  │                   │  │
│  ☰ ■ Violation Type        radio   *req   │  │  EMPLOYEE INFO    │  │
│  ☰ ■ Description           textarea *req  │  │  [Name______]     │  │
│  ────────────────────────────────────      │  │  [Position__▾]    │  │
│                                            │  │                   │  │
│  [ + Add Field ]                           │  │  VIOLATION        │  │
│                                            │  │  ○ Attendance     │  │
│                                            │  │  ○ Conduct        │  │
│                                            │  │                   │  │
│                                            │  └───────────────────┘  │
│                                            │  AI Score: 78/100 🟢    │
├────────────────────────────────────────────┴─────────────────────────┤
│              [ Save Draft ]        [ Publish ]                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (< 1024px)

```
┌──────────────────────────────┐
│ [<] Employee Write-Up  Draft │
├──────────────────────────────┤
│ [Fields] [Settings] [Preview]│
├──────────────────────────────┤
│                              │
│  ☰ ■ Employee Name    text * │
│  ☰ ■ Position       select   │
│  ☰ ■ Department     select   │
│  ──────────────────────────  │
│  ☰ ■ Violation Type radio *  │
│  ☰ ■ Description   textarea* │
│                              │
│                              │
├──────────────────────────────┤
│  [ + Add Field ]  [ Publish ]│  ← floating toolbar
└──────────────────────────────┘
```

---

## What Gets Built

### New Database Objects (4 migrations, ~250 lines SQL)

| Object | Type | Purpose |
|--------|------|---------|
| `builder_state` column | JSONB on `form_templates` | Auto-save of builder UI state |
| `ai_refinement_log` column | JSONB on `form_templates` | AI instruction refinement conversation |
| `published_at` column | TIMESTAMPTZ on `form_templates` | Last publish timestamp |
| `form_ai_tools` table | Config table, 5 rows | AI tool definitions for builder picker UI |
| `validate_form_template_fields()` | Enhanced trigger | 7 validation rules (max fields, valid types, required options, key format, condition refs, order uniqueness, max options) |
| `handle_form_template_publish()` | New trigger | Version bump, slug immutability, state cleanup on publish |

### New Edge Functions (2)

| Function | Purpose | Auth |
|----------|---------|------|
| `refine-form-instructions` | Multi-turn AI chat to refine template instructions | Manager/Admin |
| `generate-form-template` | Generate complete template from text/voice/image/file | Manager/Admin |

### Modified Edge Functions (1)

| Function | Changes |
|----------|---------|
| `ask-form` | Add `search_restaurant_standards` and `search_steps_of_service` tool aliases (route to `search_manual_v2`) |

### New Frontend Files (~30-36 files)

| Category | Files | Key Components |
|----------|-------|---------------|
| Pages | 2 | `AdminFormsList`, `AdminFormBuilder` |
| Builder components | ~22 | `BuilderHeader`, `BuilderTabs`, `FieldBlockList`, `FieldBlockItem`, `FieldPropertyPanel`, `InstructionsEditor`, `AIRefineChat`, `AIToolsPicker`, `LivePreview`, `FieldTypePicker`, `BuilderToolbar`, etc. |
| Hooks | 5 | `useFormBuilder`, `useRefineInstructions`, `useGenerateTemplate`, `useFormAITools`, `useBuilderAutoSave` |
| Context | 1 | `BuilderContext` (Provider + useReducer + undo/redo) |
| Types | 1 | `builder-types.ts` |
| Utilities | 2 | `builder-utils.ts` (slug generation, field ordering, AI fillability score), `src/lib/form-builder/template-mapper.ts` (snake→camel response mapping) |

### New Dependency

| Package | Size | Purpose |
|---------|------|---------|
| `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | ~18 kB gzipped | Drag-and-drop field reordering |

---

## State Management

The builder uses **React Context + `useReducer`** with an undo/redo middleware, following the existing `IngestDraftContext` pattern.

```typescript
interface BuilderState {
  // Template data
  template: FormTemplateDraft;
  // UI state
  selectedFieldKey: string | null;
  activeTab: 'fields' | 'instructions' | 'ai-tools' | 'settings';
  previewLanguage: 'en' | 'es';
  // Tracking
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  serverUpdatedAt: string | null;  // Optimistic concurrency guard
  // Undo/Redo
  undoStack: FormTemplateDraft[];   // Max 30 snapshots
  redoStack: FormTemplateDraft[];
}

type BuilderAction =
  | { type: 'ADD_FIELD'; payload: { field: FormFieldDefinition; afterKey?: string } }
  | { type: 'REMOVE_FIELD'; payload: { key: string } }
  | { type: 'MOVE_FIELD'; payload: { activeKey: string; overKey: string } }
  | { type: 'UPDATE_FIELD'; payload: { key: string; updates: Partial<FormFieldDefinition> } }
  | { type: 'UPDATE_INSTRUCTIONS'; payload: { language: 'en' | 'es'; value: string } }
  | { type: 'TOGGLE_TOOL'; payload: { toolId: string } }
  | { type: 'SET_TEMPLATE_META'; payload: Partial<FormTemplateDraft> }
  | { type: 'HYDRATE'; payload: { template: FormTemplate; serverUpdatedAt: string } }
  | { type: 'APPLY_AI_DRAFT'; payload: { draft: GenerateTemplateResult['draft'] } }
  | { type: 'APPLY_REFINED_INSTRUCTIONS'; payload: { instructions: string; language: 'en' | 'es' } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_SAVED'; payload: { savedAt: Date; serverUpdatedAt: string } }
  // ... more actions
```

---

## Implementation Order

### Sprint 1: Database + Backend Foundation (~2 sessions)

**Goal:** All server-side infrastructure in place before building UI.

| Step | Task | Details |
|------|------|---------|
| 1.1 | Push 4 DB migrations | `add_builder_columns`, `create_form_ai_tools`, `enhance_field_validation_trigger`, `add_publish_trigger` |
| 1.2 | Run 11 verification queries | Validate columns, trigger behavior, RLS |
| 1.3 | Deploy `refine-form-instructions` | New edge function |
| 1.4 | Deploy `generate-form-template` | New edge function |
| 1.5 | Update `ask-form` | Add 2 new tool aliases (`search_restaurant_standards`, `search_steps_of_service`) |
| 1.6 | Deploy updated `ask-form` | `npx supabase functions deploy ask-form` |
| 1.7 | Test edge functions | curl or frontend manual tests (10 tests per function) |

### Sprint 2: Builder Core UI (~2-3 sessions)

**Goal:** Admin can create, edit, and publish forms via the builder.

| Step | Task | Details |
|------|------|---------|
| 2.1 | Install `@dnd-kit` | `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` |
| 2.2 | Create `BuilderContext` | Provider + reducer + undo/redo middleware |
| 2.3 | Create `AdminFormsListPage` | Template list with status filter, search, action menu |
| 2.4 | Create `AdminFormBuilderPage` | Split-pane layout with `BuilderProvider` wrapper |
| 2.5 | Build `BuilderHeader` | Title, slug, icon picker |
| 2.6 | Build `BuilderTabs` | 4-tab navigation (Fields, Instructions, AI Tools, Settings) |
| 2.7 | Build `FieldBlockList` + `FieldBlockItem` | DnD sortable list with collapsed field rows |
| 2.8 | Build `FieldPropertyPanel` | Inline/full-screen field editing (label, type, options, ai_hint, required, condition) |
| 2.9 | Build `FieldTypePicker` | Popover (desktop) / bottom sheet (mobile) with categorized field type grid |
| 2.10 | Build `LivePreview` | Phone-frame wrapper reusing `FormBody` + `FormSection` + `FormFieldRenderer` |
| 2.11 | Wire auto-save | `useBuilderAutoSave` hook with 3s debounce |
| 2.12 | Wire publish flow | Validation → save → status update → DB trigger fires |
| 2.13 | Add routes to `App.tsx` | `/admin/forms`, `/admin/forms/new`, `/admin/forms/:id/edit` |
| 2.14 | TypeScript verification | `npx tsc --noEmit` |

### Sprint 3: AI Features (~2 sessions)

**Goal:** AI-powered instruction refinement and template generation.

| Step | Task | Details |
|------|------|---------|
| 3.1 | Build `InstructionsEditor` | EN/ES language tabs, plain textarea, character counter |
| 3.2 | Build `AIRefineChat` | Sidebar/sheet with multi-turn conversation, "Apply" / "Edit" actions |
| 3.3 | Build `useRefineInstructions` hook | Calls `refine-form-instructions` edge function |
| 3.4 | Build `AIToolsPicker` | Tool cards from `form_ai_tools` table with toggle switches |
| 3.5 | Build `useFormAITools` hook | Fetches tool definitions from `form_ai_tools` table |
| 3.6 | Build AI template generation flow | `ChatIngestionPanel`-style chat for text/voice/image/file input |
| 3.7 | Build `useGenerateTemplate` hook | Calls `generate-form-template` edge function |
| 3.8 | Add AI fillability score | Client-side computation with progress ring display |
| 3.9 | Add smart tool recommendations | Keyword-based suggestions (amber chips) |
| 3.10 | TypeScript verification | `npx tsc --noEmit` |

### Sprint 4: Polish & Mobile (~1 session)

**Goal:** Mobile builder experience, edge cases, final verification.

| Step | Task | Details |
|------|------|---------|
| 4.1 | Mobile field editor | Full-screen sheet for field property editing |
| 4.2 | Mobile DnD refinement | Larger handles, activation distance, Move Up/Down fallback |
| 4.3 | Mobile builder toolbar | Frosted-glass floating bar with "Add Field" + "Publish" |
| 4.4 | Keyboard shortcuts | Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+S (save), Escape (deselect) |
| 4.5 | Error states | Concurrent edit warning, save failure recovery, validation error display |
| 4.6 | Admin nav integration | Add "Form Builder" link in admin sidebar/menu |
| 4.7 | Full TypeScript verification | `npx tsc --noEmit` |
| 4.8 | Manual testing | All 20+ test scenarios from verification plan |

---

## Critical-Path Risks (Must-Fix Before Implementation)

From the Devil's Advocate assessment (34 total risks, 5 critical):

| # | Risk | Impact | Resolution |
|---|------|--------|------------|
| R9 | **Condition-order coupling** -- The enhanced validation trigger requires condition references to point to *earlier* fields only. DnD reorder would break existing conditions. | Data loss on reorder | Relax trigger to allow any existing field key, not just earlier ones. Update trigger before Sprint 2. |
| R12 | **Max options inconsistency** -- DB plan says 50, backend plan says 30 | Migration conflict | **Resolve: Use 50** as the limit (DB plan's value). Update backend plan to match. |
| R19 | **Mobile drag-and-drop reliability** | Unusable on mobile | 44px drag handles, 8px activation distance, keyboard sensor, Move Up/Down button fallback |
| R20 | **Auto-save race conditions** | Data corruption | Serial save queue with optimistic concurrency (`updated_at` guard) |
| R28 | **Hardcoded valid types in trigger** | Forgotten when new types added | Add comment in trigger referencing `FormFieldType` union in `src/types/forms.ts`. Document in MEMORY.md. |

### Conflict Resolutions

| Conflict | DB Plan | Backend Plan | Resolution |
|----------|---------|-------------|------------|
| Max options per field | 50 | 30 | **Use 50** -- generous enough for real-world use cases |
| Max fields per template | 50 | 60 | **Use 50** -- DB plan's reasoning about AI quality is sound |
| Version bump trigger | In `handle_form_template_publish()` | Separate `bump_form_template_version()` | **Use DB plan's approach** -- single publish trigger handles version bump + state cleanup + slug immutability |
| Tool ID for standards search | varies | varies | **`search_standards`** -- DB seed is canonical; backend `TOOL_REGISTRY` updated to match |
| Condition ordering | earlier-fields-only | n/a | **Relaxed** -- two-pass trigger validation; conditions may reference ANY field key in the template |
| Edit-published flow | n/a | n/a | **Keep `published` status** -- show "Unpublished changes" badge; explicit "Publish Changes" button triggers version bump |
| Response casing (AI generate) | snake_case from OpenAI | camelCase expected by frontend | **`mapGeneratedTemplate()`** utility in `src/lib/form-builder/template-mapper.ts` handles snake→camel mapping |

---

## Files Changed Summary

### New Files (~35)

| Category | Count | Key Files |
|----------|-------|-----------|
| SQL Migrations | 4 | `add_builder_columns`, `create_form_ai_tools`, `enhance_field_validation_trigger`, `add_publish_trigger` |
| Edge Functions | 2 | `refine-form-instructions/index.ts`, `generate-form-template/index.ts` |
| Pages | 2 | `AdminFormsList.tsx`, `AdminFormBuilder.tsx` |
| Builder Components | ~22 | `BuilderHeader`, `BuilderTabs`, `FieldBlockList`, `FieldBlockItem`, `FieldPropertyPanel`, `InstructionsEditor`, `AIRefineChat`, `AIToolsPicker`, `LivePreview`, `FieldTypePicker`, `BuilderToolbar`, etc. |
| Context | 1 | `BuilderContext.tsx` |
| Hooks | 5 | `useFormBuilder`, `useRefineInstructions`, `useGenerateTemplate`, `useFormAITools`, `useBuilderAutoSave` |
| Types | 1 | `builder-types.ts` |
| Utilities | 2 | `builder-utils.ts`, `src/lib/form-builder/template-mapper.ts` |

### Modified Files (~5)

| File | Changes |
|------|---------|
| `src/App.tsx` | Add 3 new admin routes |
| `supabase/functions/ask-form/index.ts` | Add 2 tool aliases to `TOOL_REGISTRY` + `executeTool` |
| `src/types/forms.ts` | Add builder-specific types (if not in separate file) |
| `supabase/config.toml` | Add `[functions.refine-form-instructions]` and `[functions.generate-form-template]` sections |

### Deleted Files

None.

---

## Verification Plan

### Database Verification (11 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | Column existence (3 new columns) | 3 rows in `information_schema.columns` |
| 2 | `form_ai_tools` populated | 5 rows |
| 3 | Max fields check (51 fields) | Exception: "more than 50 fields" |
| 4 | Invalid type check | Exception: "Invalid field type" |
| 5 | Select without options | Exception: "non-empty options array" |
| 6 | Invalid key format | Exception: "must be lowercase alphanumeric" |
| 7 | Dangling condition reference | Exception: "non-existent or later field" |
| 8 | Publish trigger (version bump + cleanup) | Version incremented, builder_state NULL, published_at set |
| 9 | Slug immutability after publish | Exception: "Cannot change slug" |
| 10 | RLS on `form_ai_tools` | Anon blocked, authenticated can read |
| 11 | Existing templates pass enhanced validation | Both seed templates still valid |

### Edge Function Verification (20 tests)

| # | Function | Test | Expected |
|---|----------|------|----------|
| 1-10 | `refine-form-instructions` | Basic refinement, tool awareness, field references, multi-turn, Spanish, no tools, auth checks, usage limit, empty input | See backend plan Section 7.1 |
| 11-20 | `generate-form-template` | Text description, image, file, tool recommendations, bilingual, icon suggestion, auth, confidence, ambiguous, large form | See backend plan Section 7.2 |

### Frontend Verification (20+ tests)

| # | Test | Expected |
|---|------|----------|
| 1 | Create blank template | New draft created, builder opens |
| 2 | Add 5 fields of different types | Fields appear in list and preview |
| 3 | Drag-reorder fields | Order updates, preview reflects change |
| 4 | Edit field properties | Changes reflected in preview |
| 5 | Add options to select field | Options appear in preview dropdown |
| 6 | Set field as required | Required badge appears, preview shows asterisk |
| 7 | Write instructions (EN + ES) | Saved to template |
| 8 | AI refine instructions | Refined instructions returned, "Apply" button works |
| 9 | Toggle AI tools | `ai_tools` array updated |
| 10 | Save draft (auto + manual) | Draft persisted, "Saved" indicator |
| 11 | Publish template | Status changes, version bumps, appears in /forms list |
| 12 | Unpublish template | Status changes back to draft |
| 13 | Undo/Redo | Field changes reversed/restored |
| 14 | Duplicate template | New template created with fields copied |
| 15 | Delete template (no submissions) | Template removed |
| 16 | Delete template (has submissions) | Error: cannot delete |
| 17 | AI generate from text | Draft template created with fields |
| 18 | AI generate from image | Draft template created from paper form photo |
| 19 | Mobile: full field editor | Full-screen sheet opens for field editing |
| 20 | Mobile: DnD reorder | Drag handles work, Move Up/Down fallback available |
| 21 | Concurrent edit warning | "Updated by another user" toast if `updated_at` mismatch |
| 22 | AI fillability score | Score updates as fields are added/modified |
| 23 | Live preview language toggle | Preview switches between EN/ES |

---

## What Gets Reused (No Changes)

| Component/Hook | Reuse |
|----------------|-------|
| `FormBody` | Live preview rendering |
| `FormSection` | Live preview sections |
| `FormFieldRenderer` | Live preview field inputs |
| All 16 field input components | Live preview (read-only mode) |
| `FormHeroMicButton` | Voice input in AI generation flow |
| `ChatIngestionPanel` pattern | AI template generation chat UI |
| `AppShell` | Layout wrapper |
| `ProtectedRoute` | Admin route protection |
| `useVoiceRecording` | Voice-to-text in AI generation |

---

## What This Phase Does NOT Include

| Deferred Item | Target Phase | Reason |
|---------------|-------------|--------|
| `form_template_versions` table | Phase 7 | `fields_snapshot` on submissions covers primary use case |
| Template version diff/comparison | Phase 7 | Requires version history table |
| Conditional logic builder (visual) | Phase 7 | Complex UX; Phase 5 uses JSON condition editing |
| Form analytics dashboard | Phase 7 | Requires submission aggregation queries |
| Multi-language field label editor | Phase 7 | Phase 5 supports `label_es` but no inline translation UI |
| Real-time collaborative editing | Never | Optimistic concurrency is sufficient for 1-3 admin teams |

---

*This is the master plan for Phase 5: Form Builder Admin. Refer to the 5 detailed section documents for implementation specifics. All sections were produced by expert agents on Opus 4.6 and cross-reviewed for consistency.*
