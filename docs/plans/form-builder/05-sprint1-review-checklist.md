# Sprint 1 Review Checklist -- Devil's Advocate

> **Reviewer**: Devil's Advocate Agent (Opus 4.6)
> **Date**: 2026-02-25
> **Sprint**: 1 (Database + Backend Foundation)
> **Plan References**: Master plan, DB section, Backend section, Arch section, UX section, Risks section, Audit report
> **Codebase References**: `src/types/forms.ts`, `src/types/form-builder.ts`, `src/contexts/BuilderContext.tsx`, `src/App.tsx`, existing edge functions, existing migrations

---

## How to Use This Checklist

Each item has a status field. Mark as:
- `[PASS]` -- Verified correct
- `[FAIL]` -- Defect found (describe the issue)
- `[PARTIAL]` -- Mostly correct, minor issue noted
- `[N/A]` -- Not applicable to the current sprint
- `[ ]` -- Not yet reviewed

---

## Section 1: Database Migrations

### 1.1 Migration: `add_builder_columns` (20260225200000)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.1.1 | Three columns added: `builder_state` (JSONB, nullable), `ai_refinement_log` (JSONB, default `[]`), `published_at` (TIMESTAMPTZ, nullable) | [ ] | |
| 1.1.2 | `IF NOT EXISTS` used on all `ADD COLUMN` statements (idempotent) | [ ] | |
| 1.1.3 | CHECK constraint `chk_ai_refinement_log_is_array` exists and enforces `jsonb_typeof(ai_refinement_log) = 'array'` | [ ] | |
| 1.1.4 | Backfill `published_at = updated_at` for existing published templates | [ ] | |
| 1.1.5 | Wrapped in `BEGIN; ... COMMIT;` transaction | [ ] | |
| 1.1.6 | No use of `public.gen_random_uuid()` -- must use `extensions.gen_random_uuid()` if UUIDs generated | [ ] | |
| 1.1.7 | Does NOT add columns that the plan explicitly defers (no `builder_lock_user_id`, no `parent_template_id`, no `max_fields`) | [ ] | |

### 1.2 Migration: `create_form_ai_tools` (20260225200100)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.2.1 | Table `form_ai_tools` created with `id TEXT PRIMARY KEY` (NOT UUID) | [ ] | |
| 1.2.2 | All required columns present: `id`, `label_en`, `label_es`, `description_en`, `description_es`, `search_function`, `icon`, `status`, `sort_order`, `created_at` | [ ] | |
| 1.2.3 | `status` column has CHECK constraint: `status IN ('active', 'deprecated')` | [ ] | |
| 1.2.4 | `created_at` has `DEFAULT now()` | [ ] | |
| 1.2.5 | RLS enabled: `ALTER TABLE public.form_ai_tools ENABLE ROW LEVEL SECURITY;` | [ ] | |
| 1.2.6 | Single SELECT policy for `authenticated` role with `USING (true)` | [ ] | |
| 1.2.7 | NO INSERT, UPDATE, or DELETE policies exist (migration-only management) | [ ] | |
| 1.2.8 | Exactly 5 seed rows inserted | [ ] | |
| 1.2.9 | **Tool IDs match exactly**: `search_contacts`, `search_manual`, `search_products`, `search_standards`, `search_steps_of_service` | [ ] | Audit C1 fix -- must NOT be `search_restaurant_standards` |
| 1.2.10 | **Icons match plan**: BookUser, BookOpen, UtensilsCrossed, Star, ListChecks | [ ] | |
| 1.2.11 | **sort_order values**: 1, 2, 3, 4, 5 (sequential) | [ ] | |
| 1.2.12 | `search_function` column correctly maps: `search_contacts`, `search_manual_v2`, `search_dishes`, `search_manual_v2`, `search_manual_v2` | [ ] | |
| 1.2.13 | Wrapped in `BEGIN; ... COMMIT;` transaction | [ ] | |
| 1.2.14 | `DROP TABLE IF EXISTS` used if replacing a prior version of the table (handles re-run from earlier migration) | [ ] | |

### 1.3 Migration: `enhance_field_validation_trigger` (20260225200200)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.3.1 | Uses `CREATE OR REPLACE FUNCTION` (not DROP + CREATE) | [ ] | |
| 1.3.2 | Function is `SECURITY DEFINER` | [ ] | |
| 1.3.3 | Function has `SET search_path = public` | [ ] | |
| 1.3.4 | Empty array `[]` is handled: returns NEW without validation | [ ] | |
| 1.3.5 | NULL fields is handled: returns NEW without validation | [ ] | |
| 1.3.6 | **Rule 1**: Max 50 fields (NOT 60, NOT 30) | [ ] | Audit C2 resolution |
| 1.3.7 | **Rule 2**: Valid types list matches `FormFieldType` in `src/types/forms.ts` EXACTLY: `text`, `textarea`, `date`, `time`, `datetime`, `select`, `radio`, `checkbox`, `number`, `phone`, `email`, `signature`, `image`, `file`, `header`, `instructions`, `contact_lookup` (17 types) | [ ] | Critical R28 -- must be in sync |
| 1.3.8 | **Rule 3**: Every field has non-empty `key` AND non-empty `type` | [ ] | |
| 1.3.9 | **Rule 4**: Key format regex `^[a-z][a-z0-9_]{0,63}$` | [ ] | |
| 1.3.10 | **Rule 5a**: `select`, `radio`, `checkbox` require non-empty `options` array | [ ] | |
| 1.3.11 | **Rule 5b**: Max 50 options per field (NOT 30) | [ ] | Audit C3 resolution |
| 1.3.12 | **Rule 6**: Duplicate key detection works | [ ] | |
| 1.3.13 | **Rule 7a**: Condition `field` reference validated against ALL field keys (two-pass) | [ ] | Critical R9 fix -- NOT earlier-only |
| 1.3.14 | **Rule 7b**: Self-reference condition rejected | [ ] | |
| 1.3.15 | **Rule 7c**: Forward references allowed (field A at position 3 can reference field B at position 5) | [ ] | This is the key R9 resolution |
| 1.3.16 | Order validation: `order` property must be present, must be integer, no duplicates | [ ] | |
| 1.3.17 | Non-integer `order` values caught with proper error message | [ ] | |
| 1.3.18 | `SYNC` comment present referencing `src/types/forms.ts`, `FormFieldRenderer.tsx`, and `ask-form prompt` | [ ] | Critical R28 mitigation |
| 1.3.19 | Does NOT recreate the trigger (only replaces the function; trigger already exists from `20260223200000`) | [ ] | |
| 1.3.20 | Wrapped in `BEGIN; ... COMMIT;` transaction | [ ] | |

### 1.4 Migration: `add_publish_trigger` (20260225200300)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.4.1 | Function `handle_form_template_publish()` created | [ ] | |
| 1.4.2 | Function is `SECURITY DEFINER` | [ ] | |
| 1.4.3 | Function has `SET search_path = public` | [ ] | |
| 1.4.4 | **Slug immutability**: When `OLD.published_at IS NOT NULL` and slug changes, raises exception | [ ] | |
| 1.4.5 | Uses `IS DISTINCT FROM` for slug comparison (handles NULLs) | [ ] | |
| 1.4.6 | **First publish**: When status transitions TO `published` from non-published, bumps `template_version` | [ ] | |
| 1.4.7 | **First publish**: Sets `published_at = now()` | [ ] | |
| 1.4.8 | **First publish**: Clears `builder_state = NULL` | [ ] | |
| 1.4.9 | **First publish**: Clears `ai_refinement_log = '[]'::JSONB` | [ ] | |
| 1.4.10 | **Re-publish**: When already published and fields/instructions changed, bumps version | [ ] | |
| 1.4.11 | **Re-publish**: Uses `IS DISTINCT FROM` for field/instruction comparison | [ ] | |
| 1.4.12 | **No-change publish**: When already published and nothing changed, does NOT bump version | [ ] | |
| 1.4.13 | `ai_refinement_log` capped at 20 entries on any update | [ ] | |
| 1.4.14 | Refinement log cap preserves most recent entries (not oldest) | [ ] | |
| 1.4.15 | Trigger name: `trg_handle_form_template_publish` | [ ] | |
| 1.4.16 | Trigger fires `BEFORE UPDATE ON public.form_templates FOR EACH ROW` (all updates, not just status) | [ ] | Needed for slug immutability |
| 1.4.17 | Does NOT use the superseded `bump_form_template_version()` approach from backend plan | [ ] | Audit C4 resolution |
| 1.4.18 | Version bump uses `COALESCE(OLD.template_version, 0) + 1` (handles NULL) | [ ] | |
| 1.4.19 | Wrapped in `BEGIN; ... COMMIT;` transaction | [ ] | |
| 1.4.20 | Old trigger dropped if exists (`DROP TRIGGER IF EXISTS`) before recreating | [ ] | |

### 1.5 Existing Template Compatibility

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.5.1 | Seed templates (`employee-write-up`, `employee-injury-report`) pass all 7 validation rules | [ ] | Verification query 7.13 |
| 1.5.2 | All existing field keys match the regex `^[a-z][a-z0-9_]{0,63}$` | [ ] | |
| 1.5.3 | All existing `select`/`radio`/`checkbox` fields have non-empty `options` arrays | [ ] | |
| 1.5.4 | All existing condition references point to valid field keys | [ ] | |
| 1.5.5 | All existing `order` values are present, integer, and unique within each template | [ ] | |
| 1.5.6 | Neither existing template exceeds 50 fields | [ ] | |

---

## Section 2: Edge Functions

### 2.1 `refine-form-instructions` Edge Function

#### 2.1a Structure & Patterns

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.1 | File location: `supabase/functions/refine-form-instructions/index.ts` | [ ] | |
| 2.1.2 | `config.toml` exists with `verify_jwt = false` | [ ] | |
| 2.1.3 | Imports from `../_shared/cors.ts`: `corsHeaders`, `jsonResponse`, `errorResponse` | [ ] | |
| 2.1.4 | Imports from `../_shared/auth.ts`: uses `authenticateWithUser` (NOT `authenticateWithClaims`) for write operation | [ ] | |
| 2.1.5 | `Deno.serve(async (req) => { ... })` pattern used | [ ] | |
| 2.1.6 | OPTIONS preflight handled: `if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })` | [ ] | |

#### 2.1b Auth & Authorization

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.7 | Auth uses `authenticateWithUser(req)` -- NOT `authenticateWithClaims` | [ ] | Write operations need full auth |
| 2.1.8 | Admin/manager role check via `group_members` table (NOT `group_memberships` -- check actual table name) | [ ] | Verify correct table name |
| 2.1.9 | Returns 403 Forbidden for non-manager/non-admin users | [ ] | |
| 2.1.10 | Returns 401 Unauthorized for missing/invalid auth | [ ] | via AuthError catch |

#### 2.1c Input Validation

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.11 | `rawInstructions` validated as required (or `conversationHistory` non-empty) | [ ] | |
| 2.1.12 | `language` defaults to `"en"` if not provided | [ ] | |
| 2.1.13 | `conversationHistory` defaults to `[]` if not provided | [ ] | |

#### 2.1d OpenAI Call

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.14 | Uses `gpt-4o-mini` model | [ ] | |
| 2.1.15 | Uses `response_format: { type: "json_object" }` | [ ] | |
| 2.1.16 | `max_tokens` set to at least 1200 (NOT 800 -- audit G7 fix) | [ ] | |
| 2.1.17 | `temperature` is 0.4-0.5 | [ ] | |
| 2.1.18 | `OPENAI_API_KEY` read from `Deno.env.get()` | [ ] | |
| 2.1.19 | System prompt is bilingual (separate EN/ES prompts based on `language` param) | [ ] | |
| 2.1.20 | Cross-language context appended to system prompt when provided | [ ] | |

#### 2.1e Response Handling (Critical -- Audit G7)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.21 | `finish_reason` checked BEFORE parsing content | [ ] | If `"length"`, return error |
| 2.1.22 | `JSON.parse(content)` wrapped in `try-catch` | [ ] | Critical: audit G7 requirement |
| 2.1.23 | Parse failure returns user-friendly error (NOT raw exception) | [ ] | |
| 2.1.24 | Empty content checked before parse | [ ] | |
| 2.1.25 | Response includes `refinedInstructions`, `suggestions`, `conversationHistory` | [ ] | |
| 2.1.26 | If `refinedInstructions` missing from parsed response, falls back to `rawInstructions` | [ ] | |

#### 2.1f Error Handling

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.27 | `AuthError` caught and returns 401 | [ ] | |
| 2.1.28 | OpenAI non-OK response returns 500 with error message | [ ] | |
| 2.1.29 | General errors caught with `console.error` and 500 response | [ ] | |
| 2.1.30 | No `.catch()` on PostgrestFilterBuilder (use `try/catch` instead) | [ ] | Critical Supabase Deno limitation |
| 2.1.31 | No `AbortController` timeout is OK if not critical, but ideally has one | [ ] | |

#### 2.1g Conversation History

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1.32 | History is capped (6 messages or similar) to prevent token overflow | [ ] | |
| 2.1.33 | Updated history returned in response (includes current turn) | [ ] | |
| 2.1.34 | History messages correctly structured: `{ role: string, content: string }` | [ ] | |

### 2.2 `generate-form-template` Edge Function

#### 2.2a Structure & Patterns

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.2.1 | File location: `supabase/functions/generate-form-template/index.ts` | [ ] | |
| 2.2.2 | `config.toml` exists with `verify_jwt = false` | [ ] | |
| 2.2.3 | Imports from `../_shared/cors.ts`: `corsHeaders`, `jsonResponse`, `errorResponse` | [ ] | |
| 2.2.4 | Imports from `../_shared/auth.ts`: uses `authenticateWithUser` | [ ] | |
| 2.2.5 | Imports from `../_shared/openai.ts`: `callOpenAI`, `OpenAIError` | [ ] | |

#### 2.2b Auth & Authorization

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.2.6 | Admin/manager role check (same pattern as refine function) | [ ] | |
| 2.2.7 | Returns 403 for non-admin/non-manager | [ ] | |

#### 2.2c Input Validation

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.2.8 | `description` validated: required, minimum length (10 chars) | [ ] | |
| 2.2.9 | `language` defaults to `"en"` | [ ] | |

#### 2.2d OpenAI Structured Output

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.2.10 | Uses `gpt-4o-mini` model (per backend plan -- cheaper, sufficient for form structure extraction) | [ ] | |
| 2.2.11 | Uses structured JSON schema output via `callOpenAI` helper | [ ] | |
| 2.2.12 | Schema defines all 17 field types in `type.enum` | [ ] | |
| 2.2.13 | Schema field types match `FormFieldType` exactly (17 values) | [ ] | Cross-check with forms.ts |
| 2.2.14 | Schema includes `ai_tools` array with tool IDs | [ ] | |
| 2.2.15 | Tool IDs in prompt match DB seed: `search_contacts`, `search_manual`, `search_products`, `search_standards`, `search_steps_of_service` | [ ] | Audit C1 fix |
| 2.2.16 | Response is returned in snake_case (matching DB JSONB) | [ ] | Arch plan C5 -- frontend maps it |
| 2.2.17 | `max_tokens` set high enough for large forms (4000+) | [ ] | |
| 2.2.18 | `temperature` at 0.7 (creative but not wild) | [ ] | |

#### 2.2e Error Handling

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.2.19 | `AuthError` caught and returns 401 | [ ] | |
| 2.2.20 | `OpenAIError` caught and returns appropriate status | [ ] | |
| 2.2.21 | General errors caught with `console.error` and 500 response | [ ] | |
| 2.2.22 | No `.catch()` on PostgrestFilterBuilder | [ ] | |

#### 2.2f System Prompt Quality

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.2.23 | System prompt lists all 17 field types with usage guidance | [ ] | |
| 2.2.24 | System prompt includes key format rule: `snake_case` | [ ] | |
| 2.2.25 | System prompt includes section grouping guidance (headers as dividers) | [ ] | |
| 2.2.26 | System prompt includes bilingual requirement | [ ] | |
| 2.2.27 | System prompt includes tool recommendation rules | [ ] | |
| 2.2.28 | System prompt includes `ai_hint` guidance | [ ] | |
| 2.2.29 | System prompt includes `width` guidance (half/full) | [ ] | |

### 2.3 `ask-form` Modifications (if applicable in Sprint 1)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.3.1 | `search_standards` added to `TOOL_REGISTRY` (NOT `search_restaurant_standards`) | [ ] | Audit C1 |
| 2.3.2 | `search_steps_of_service` added to `TOOL_REGISTRY` | [ ] | |
| 2.3.3 | Both new tools route to `search_manual_v2` RPC | [ ] | |
| 2.3.4 | Both new tools have proper OpenAI function calling schema (name, description, parameters) | [ ] | |
| 2.3.5 | `executeTool` switch has cases for both new tool names | [ ] | |
| 2.3.6 | Error handling for tool execution (console.error, return empty results) | [ ] | |

---

## Section 3: Frontend Types

### 3.1 `src/types/forms.ts` Updates

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.1.1 | `FormTemplate` interface includes `publishedAt: string | null` | [ ] | Audit G14 |
| 3.1.2 | `FormTemplate` interface includes `builderState: Record<string, unknown> | null` | [ ] | Audit G14 |
| 3.1.3 | `FormTemplate` interface includes `aiRefinementLog: Array<{ role: string; content: string; timestamp: string }>` | [ ] | Audit G14 |
| 3.1.4 | `FormFieldType` union has exactly 17 values matching the DB trigger | [ ] | R28 cross-check |
| 3.1.5 | All 17 types in `FormFieldType`: `text`, `textarea`, `date`, `time`, `datetime`, `select`, `radio`, `checkbox`, `number`, `phone`, `email`, `signature`, `image`, `file`, `header`, `instructions`, `contact_lookup` | [ ] | |

### 3.2 `src/types/form-builder.ts` (New File)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.2.1 | `BuilderTab` type: `'fields' | 'instructions' | 'ai-tools' | 'settings'` | [ ] | |
| 3.2.2 | `RightPanelMode` type: `'preview' | 'field-properties' | 'ai-refine'` | [ ] | Audit M7/G26 fix |
| 3.2.3 | `SaveStatus` type: `'saved' | 'saving' | 'unsaved' | 'error'` | [ ] | |
| 3.2.4 | `FormAITool` interface matches `form_ai_tools` DB columns (camelCase) | [ ] | |
| 3.2.5 | `FormAITool` has fields: `id`, `labelEn`, `labelEs`, `descriptionEn`, `descriptionEs`, `icon`, `status`, `sortOrder` | [ ] | |
| 3.2.6 | Check: does `FormAITool` have obsolete fields like `toolId` or `defaultEnabled` that do NOT exist on the DB table? | [ ] | The DB has `id TEXT PK`, NOT `tool_id` |
| 3.2.7 | `BuilderSnapshot` includes: `fields`, `instructionsEn`, `instructionsEs` | [ ] | |
| 3.2.8 | `BuilderState` has `templateId`, `slug`, `titleEn`, `titleEs`, `descriptionEn`, `descriptionEs`, `icon`, `status`, `templateVersion`, `publishedAt` | [ ] | |
| 3.2.9 | `BuilderState` has `fields`, `selectedFieldKey` | [ ] | |
| 3.2.10 | `BuilderState` has `activeTab` (BuilderTab), `rightPanelMode` (RightPanelMode) | [ ] | |
| 3.2.11 | `BuilderState` has `instructionsEn`, `instructionsEs`, `instructionLanguage` | [ ] | |
| 3.2.12 | `BuilderState` has `aiTools: string[]` | [ ] | |
| 3.2.13 | `BuilderState` has `isDirty`, `saveStatus`, `isSaving`, `serverUpdatedAt`, `hasUnpublishedChanges` | [ ] | |
| 3.2.14 | `BuilderState` has undo/redo: `past: BuilderSnapshot[]`, `future: BuilderSnapshot[]`, `maxHistory: number` (30) | [ ] | |
| 3.2.15 | `BuilderState` has `previewMode` | [ ] | |
| 3.2.16 | `BuilderAction` covers: HYDRATE, RESET, metadata setters, field ops (ADD, UPDATE, REMOVE, REORDER), instruction setters, AI tools, save lifecycle, publish, AI generate, UNDO, REDO | [ ] | |
| 3.2.17 | `GenerateResponse` interface uses snake_case properties (matches edge function output) | [ ] | C5 resolution |
| 3.2.18 | `BuilderContextValue` has: `state`, `dispatch`, `saveDraft`, `undo`, `redo`, `canUndo`, `canRedo` | [ ] | |
| 3.2.19 | `ValidationError` interface defined with `fieldKey`, `message`, `severity` | [ ] | |

---

## Section 4: Frontend Context & State Management

### 4.1 `src/contexts/BuilderContext.tsx`

#### 4.1a Setup

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.1 | Uses `createContext`, `useContext`, `useReducer` pattern (matches `IngestDraftContext`) | [ ] | |
| 4.1.2 | `BuilderProvider` wraps children with context | [ ] | |
| 4.1.3 | `useBuilder()` hook throws if used outside `BuilderProvider` | [ ] | |
| 4.1.4 | Initial state has sensible defaults: empty fields, `status: 'draft'`, `templateVersion: 1`, etc. | [ ] | |

#### 4.1b Reducer -- All Actions Handled

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.5 | `HYDRATE` -- loads template data into state | [ ] | |
| 4.1.6 | `HYDRATE` has `preserveUIState` option to keep UI state during reload | [ ] | |
| 4.1.7 | `RESET` -- returns to initial state | [ ] | |
| 4.1.8 | Metadata setters: `SET_TITLE_EN`, `SET_TITLE_ES`, `SET_DESCRIPTION_EN`, `SET_DESCRIPTION_ES`, `SET_SLUG`, `SET_ICON`, `SET_STATUS` | [ ] | |
| 4.1.9 | All metadata setters mark `isDirty: true` and `saveStatus: 'unsaved'` | [ ] | |
| 4.1.10 | `SET_ACTIVE_TAB` -- updates tab without marking dirty | [ ] | UI-only change |
| 4.1.11 | `SET_RIGHT_PANEL_MODE` -- updates panel mode | [ ] | |
| 4.1.12 | `SET_SELECTED_FIELD` -- selects field AND sets `rightPanelMode` to `'field-properties'` (or `'preview'` when null) | [ ] | |
| 4.1.13 | `SET_PREVIEW_MODE` -- toggles mobile/desktop preview | [ ] | |

#### 4.1c Reducer -- Field Operations (Undoable)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.14 | `ADD_FIELD` pushes undo snapshot BEFORE adding field | [ ] | |
| 4.1.15 | `ADD_FIELD` adds field to array and selects it | [ ] | |
| 4.1.16 | `UPDATE_FIELD` pushes undo snapshot, updates field by key | [ ] | |
| 4.1.17 | `REMOVE_FIELD` pushes undo snapshot, filters field by key | [ ] | |
| 4.1.18 | `REMOVE_FIELD` clears `selectedFieldKey` if removed field was selected | [ ] | |
| 4.1.19 | `REMOVE_FIELD` resets `rightPanelMode` to `'preview'` if removed field was selected | [ ] | |
| 4.1.20 | `REORDER_FIELDS` pushes undo snapshot, reassigns `order` values sequentially (1, 2, 3...) | [ ] | |
| 4.1.21 | All field operations mark `isDirty: true` and `saveStatus: 'unsaved'` | [ ] | |

#### 4.1d Reducer -- Instructions (Undoable)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.22 | `SET_INSTRUCTIONS_EN` pushes undo snapshot | [ ] | |
| 4.1.23 | `SET_INSTRUCTIONS_ES` pushes undo snapshot | [ ] | |
| 4.1.24 | `SET_INSTRUCTION_LANGUAGE` does NOT push undo (UI-only) | [ ] | |

#### 4.1e Reducer -- Undo/Redo

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.25 | `UNDO` pops from `past`, pushes current to `future` | [ ] | |
| 4.1.26 | `UNDO` returns unchanged state if `past` is empty | [ ] | |
| 4.1.27 | `REDO` pops from `future`, pushes current to `past` | [ ] | |
| 4.1.28 | `REDO` returns unchanged state if `future` is empty | [ ] | |
| 4.1.29 | `past` stack capped at `maxHistory` (30) entries | [ ] | |
| 4.1.30 | Undoable actions clear `future` stack (new mutations invalidate redo) | [ ] | |
| 4.1.31 | `takeSnapshot()` deep-copies fields (not reference copy) | [ ] | Uses spread or structuredClone |

#### 4.1f Save Lifecycle

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.32 | `SAVE_START` sets `isSaving: true`, `saveStatus: 'saving'` | [ ] | |
| 4.1.33 | `SAVE_SUCCESS` sets `isSaving: false`, `isDirty: false`, `saveStatus: 'saved'`, updates `serverUpdatedAt` | [ ] | |
| 4.1.34 | `SAVE_SUCCESS` on a published template sets `hasUnpublishedChanges: true` | [ ] | Edit-published flow (G12) |
| 4.1.35 | `SAVE_ERROR` sets `isSaving: false`, `saveStatus: 'error'` | [ ] | |
| 4.1.36 | `PUBLISH_CHANGES` updates `status`, `templateVersion`, `publishedAt`, resets `hasUnpublishedChanges` | [ ] | |

#### 4.1g Auto-Save

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1.37 | Auto-save uses debounced timer (3 seconds) | [ ] | |
| 4.1.38 | Auto-save only fires when `isDirty && !isSaving && templateId` is set | [ ] | |
| 4.1.39 | Timer is cleared on unmount and on new change | [ ] | |
| 4.1.40 | Save function sends update to `form_templates` table | [ ] | |
| 4.1.41 | Save includes `builder_state` with UI state (selectedFieldKey, activeTab, etc.) | [ ] | |
| 4.1.42 | Save payload maps camelCase state to snake_case DB columns correctly | [ ] | |
| 4.1.43 | Save does NOT use `.catch()` on PostgrestFilterBuilder -- uses `try/catch` instead | [ ] | Critical Deno limitation |

---

## Section 5: Route Registration

### 5.1 `src/App.tsx`

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.1.1 | `/admin/forms` route exists | [ ] | |
| 5.1.2 | `/admin/forms/new` route exists | [ ] | |
| 5.1.3 | `/admin/forms/:id/edit` route exists | [ ] | |
| 5.1.4 | All three routes use `ProtectedRoute` with `requiredRole="manager"` | [ ] | Allows manager + admin |
| 5.1.5 | Routes are placed ABOVE the catch-all `"*"` route | [ ] | |
| 5.1.6 | `AdminFormsListPage` imported (from `./pages/admin/AdminFormsListPage` or similar) | [ ] | |
| 5.1.7 | `AdminFormBuilderPage` imported (from `./pages/admin/AdminFormBuilderPage` or similar) | [ ] | |
| 5.1.8 | Lazy loading used for builder pages (`React.lazy` + `Suspense`) | [ ] | Arch plan 8.5 |

---

## Section 6: Cross-Section Consistency

### 6.1 Tool IDs (Audit C1 -- Critical)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.1.1 | DB seed `form_ai_tools.id` values: `search_contacts`, `search_manual`, `search_products`, `search_standards`, `search_steps_of_service` | [ ] | |
| 6.1.2 | `generate-form-template` system prompt lists the same 5 tool IDs | [ ] | |
| 6.1.3 | `refine-form-instructions` system prompt references tools by these exact IDs | [ ] | |
| 6.1.4 | `ask-form` TOOL_REGISTRY uses these exact IDs (if modified in Sprint 1) | [ ] | |
| 6.1.5 | Frontend `BuilderState.aiTools` stores these exact string IDs | [ ] | |
| 6.1.6 | NO occurrence of `search_restaurant_standards` anywhere in codebase | [ ] | Must be extinct |

### 6.2 Limits (Audit C2/C3)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.2.1 | Max fields: **50** everywhere (DB trigger, frontend validation, edge function prompts) | [ ] | |
| 6.2.2 | Max options: **50** everywhere (DB trigger, frontend validation) | [ ] | |
| 6.2.3 | No remnant of "60 fields" or "30 options" limits anywhere | [ ] | |

### 6.3 Field Types (R28 -- Critical)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.3.1 | `FormFieldType` union in `src/types/forms.ts` -- 17 values | [ ] | |
| 6.3.2 | DB trigger `valid_types` array -- same 17 values | [ ] | |
| 6.3.3 | `generate-form-template` schema `type.enum` -- same 17 values | [ ] | |
| 6.3.4 | `refine-form-instructions` system prompt references field types consistently | [ ] | |

### 6.4 Template Columns (Audit G14)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.4.1 | DB has columns: `builder_state`, `ai_refinement_log`, `published_at` | [ ] | |
| 6.4.2 | `FormTemplate` TS interface has: `builderState`, `aiRefinementLog`, `publishedAt` | [ ] | |
| 6.4.3 | `BuilderState` TS interface has: `publishedAt` | [ ] | |

### 6.5 Trigger Naming (Audit C4)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.5.1 | Only `handle_form_template_publish()` exists -- NOT `bump_form_template_version()` | [ ] | |
| 6.5.2 | No migration creates the superseded `bump_form_template_version()` function | [ ] | |

### 6.6 Casing Convention (Audit C5)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.6.1 | `generate-form-template` response uses snake_case at top level | [ ] | |
| 6.6.2 | `GenerateResponse` interface in `form-builder.ts` uses snake_case properties | [ ] | |
| 6.6.3 | A mapper function exists (or will exist) to convert snake_case to camelCase for BuilderState | [ ] | `mapGeneratedTemplate()` or dispatch handler |

---

## Section 7: Security Review

### 7.1 Edge Function Security

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.1.1 | Both new functions use `verify_jwt = false` with internal auth | [ ] | Matches existing pattern |
| 7.1.2 | Both new functions check admin/manager role | [ ] | |
| 7.1.3 | Role check queries actual DB table (not just JWT claims) | [ ] | |
| 7.1.4 | No API keys or secrets hardcoded in function code | [ ] | |
| 7.1.5 | `OPENAI_API_KEY` read from environment variables | [ ] | |

### 7.2 Database Security

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.2.1 | All new trigger functions are `SECURITY DEFINER` | [ ] | |
| 7.2.2 | All new trigger functions have `SET search_path = public` | [ ] | |
| 7.2.3 | `form_ai_tools` has RLS enabled | [ ] | |
| 7.2.4 | `form_ai_tools` has NO write policies (migration-only) | [ ] | |
| 7.2.5 | No use of `extensions.gen_random_uuid()` needed (no UUID generation in these migrations) | [ ] | |

### 7.3 Input Sanitization

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.3.1 | `refine-form-instructions`: `rawInstructions` input validated (non-empty) | [ ] | |
| 7.3.2 | `generate-form-template`: `description` validated (minimum length) | [ ] | |
| 7.3.3 | No SQL injection vectors: JSONB parameters use parameterized queries | [ ] | |
| 7.3.4 | No XSS in edge functions: responses are JSON, not HTML | [ ] | |

---

## Section 8: Verification Queries

### 8.1 DB Verification Tests (from DB Plan Section 7)

| # | Test | Expected | Status | Notes |
|---|------|----------|--------|-------|
| 8.1.1 | Column existence (3 new columns) | 3 rows in `information_schema.columns` | [ ] | |
| 8.1.2 | `form_ai_tools` populated | 5 rows | [ ] | |
| 8.1.3 | Max fields check (51 fields insert) | Exception: "more than 50 fields" | [ ] | |
| 8.1.4 | Invalid type check (`type: "text_area"`) | Exception: "Invalid field type" | [ ] | |
| 8.1.5 | Select without options | Exception: "non-empty options array" | [ ] | |
| 8.1.6 | Invalid key format (`key: "Employee Name"`) | Exception: "must be lowercase alphanumeric" | [ ] | |
| 8.1.7 | Dangling condition reference | Exception: "non-existent field" | [ ] | |
| 8.1.8 | Condition self-reference | Exception: "cannot have a condition referencing itself" | [ ] | |
| 8.1.9 | Forward condition reference (two-pass) | SUCCESS: field f2 references f3 at later position | [ ] | R9 fix validation |
| 8.1.10 | Publish trigger: version bump + state cleanup | Version incremented, `builder_state` NULL, `published_at` set | [ ] | |
| 8.1.11 | Slug immutability after publish | Exception: "Cannot change slug" | [ ] | |
| 8.1.12 | RLS on `form_ai_tools`: anon blocked, authenticated can read | Anon: error, Auth: 5 rows | [ ] | |
| 8.1.13 | Existing templates pass enhanced validation | Both seed templates returned without error | [ ] | |

### 8.2 Edge Function Verification (Manual Tests)

| # | Test | Expected | Status | Notes |
|---|------|----------|--------|-------|
| 8.2.1 | `refine-form-instructions`: Basic refinement | Returns `refinedInstructions` + `suggestions` | [ ] | |
| 8.2.2 | `refine-form-instructions`: Multi-turn conversation | Updated `conversationHistory` returned | [ ] | |
| 8.2.3 | `refine-form-instructions`: Spanish language | Response in Spanish | [ ] | |
| 8.2.4 | `refine-form-instructions`: Auth (non-admin) | 403 Forbidden | [ ] | |
| 8.2.5 | `refine-form-instructions`: Auth (no token) | 401 Unauthorized | [ ] | |
| 8.2.6 | `refine-form-instructions`: Empty input | 400 bad_request | [ ] | |
| 8.2.7 | `generate-form-template`: Text description | Valid template draft returned | [ ] | |
| 8.2.8 | `generate-form-template`: Bilingual output | Both `title_en` and `title_es` populated | [ ] | |
| 8.2.9 | `generate-form-template`: Auth (non-admin) | 403 Forbidden | [ ] | |
| 8.2.10 | `generate-form-template`: Short description (<10 chars) | 400 bad_request | [ ] | |

---

## Section 9: Known Risks to Watch For

### 9.1 Critical Risks (from Risk Assessment)

| # | Risk | What to Check | Status | Notes |
|---|------|---------------|--------|-------|
| 9.1.1 | **R9**: Condition-order coupling | Verify trigger uses two-pass (allows forward refs) | [ ] | |
| 9.1.2 | **R19**: Mobile DnD reliability | Sprint 2 item -- just ensure types support it | [ ] | N/A for Sprint 1 |
| 9.1.3 | **R20**: Auto-save race conditions | Verify save queue is serial (not concurrent) | [ ] | Check BuilderContext |
| 9.1.4 | **R24**: Orphaned field values | Sprint 2 item -- ensure `fields_snapshot` pattern intact | [ ] | N/A for Sprint 1 |
| 9.1.5 | **R28**: Field type validator maintenance | Verify SYNC comments in trigger SQL | [ ] | |

### 9.2 Audit Must-Fix Items

| # | Audit Item | What to Verify | Status | Notes |
|---|------------|----------------|--------|-------|
| 9.2.1 | **C1**: Tool ID unified to `search_standards` | No occurrence of `search_restaurant_standards` | [ ] | |
| 9.2.2 | **C2/C3**: Limits unified to 50/50 | No occurrence of 60 or 30 limits | [ ] | |
| 9.2.3 | **C4**: Single publish trigger | Only `handle_form_template_publish`, no `bump_form_template_version` | [ ] | |
| 9.2.4 | **C5**: Response casing handled | `GenerateResponse` uses snake_case | [ ] | |
| 9.2.5 | **G2**: Header/Instructions property panel spec | Types support `content` via `hint` property | [ ] | |
| 9.2.6 | **G7**: JSON error handling in refine | try-catch, finish_reason check, max_tokens >= 1200 | [ ] | |
| 9.2.7 | **G12**: Edit-published flow decided | `hasUnpublishedChanges` flag in BuilderState | [ ] | |
| 9.2.8 | **G14**: FormTemplate type updated | 3 new properties added | [ ] | |
| 9.2.9 | **G30/R9**: Condition ordering relaxed | Two-pass validation in trigger | [ ] | |

---

## Section 10: Deployment Checklist

| # | Step | Status | Notes |
|---|------|--------|-------|
| 10.1 | Push 4 DB migrations: `npx supabase db push` | [ ] | |
| 10.2 | Verify all 13 verification queries pass | [ ] | |
| 10.3 | Deploy `refine-form-instructions`: `npx supabase functions deploy refine-form-instructions` | [ ] | |
| 10.4 | Deploy `generate-form-template`: `npx supabase functions deploy generate-form-template` | [ ] | |
| 10.5 | Deploy updated `ask-form` (if tool aliases added): `npx supabase functions deploy ask-form` | [ ] | |
| 10.6 | Verify edge functions respond (not 404) | [ ] | |
| 10.7 | TypeScript compilation: `npx tsc --noEmit` | [ ] | 0 errors expected |

---

## Section 11: Code Quality & Style

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 11.1 | No `console.log` in production code (only `console.error` for actual errors) | [ ] | Edge functions may use console.error |
| 11.2 | Consistent naming: DB columns snake_case, TS properties camelCase | [ ] | |
| 11.3 | All new files have descriptive header comments | [ ] | |
| 11.4 | No unused imports in new files | [ ] | |
| 11.5 | Edge function file structure matches existing functions (types, system prompt, handler sections) | [ ] | |
| 11.6 | Migration SQL formatted consistently (indentation, comments, section headers) | [ ] | |
| 11.7 | No TODO or FIXME comments left unaddressed | [ ] | |

---

## Summary Scorecard

| Section | Items | Pass | Fail | Partial | N/A |
|---------|-------|------|------|---------|-----|
| 1. DB Migrations | -- | -- | -- | -- | -- |
| 2. Edge Functions | -- | -- | -- | -- | -- |
| 3. Frontend Types | -- | -- | -- | -- | -- |
| 4. Context & State | -- | -- | -- | -- | -- |
| 5. Route Registration | -- | -- | -- | -- | -- |
| 6. Cross-Section Consistency | -- | -- | -- | -- | -- |
| 7. Security | -- | -- | -- | -- | -- |
| 8. Verification | -- | -- | -- | -- | -- |
| 9. Risk Mitigations | -- | -- | -- | -- | -- |
| 10. Deployment | -- | -- | -- | -- | -- |
| 11. Code Quality | -- | -- | -- | -- | -- |
| **Total** | **--** | **--** | **--** | **--** | **--** |

---

*This checklist was built by the Devil's Advocate agent from a thorough reading of all 7 plan documents, the audit report, the existing codebase patterns (types, contexts, edge functions, migrations), and the actual Sprint 1 implementation files. Each item traces to a specific plan requirement, audit finding, or risk mitigation.*
