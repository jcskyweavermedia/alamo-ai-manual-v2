# Sprint 1 Audit Report -- Devil's Advocate

> **Reviewer**: Devil's Advocate Agent (Opus 4.6)
> **Date**: 2026-02-25
> **Sprint**: 1 (Database + Backend Foundation)
> **Files Reviewed**: 14 (4 migrations, 3 edge functions, 7 frontend files)
> **Checklist Used**: `05-sprint1-review-checklist.md`

---

## 1. Executive Summary

**Verdict: CONDITIONAL PASS -- 1 critical issue, 3 major issues, 8 minor issues**

Sprint 1 is well-executed overall. The database migrations are solid, the edge functions follow established patterns, and the frontend types/context/utilities are comprehensive. However, there is **1 critical issue** (obsolete `FormAITool` interface with ghost columns) and **3 major issues** (missing `.catch()` safety analysis, `incrementUsage` pattern inconsistency, and lazy-loading omission) that should be addressed before deployment.

| Category | Critical | Major | Minor | Pass |
|----------|----------|-------|-------|------|
| Database Migrations | 0 | 0 | 2 | 4 files |
| Edge Functions | 0 | 1 | 2 | 3 files |
| Frontend Types | 1 | 0 | 1 | 2 files |
| Frontend Context | 0 | 1 | 1 | 1 file |
| Frontend Utilities | 0 | 0 | 1 | 2 files |
| Routes & Config | 0 | 1 | 1 | 2 files |
| **Total** | **1** | **3** | **8** | **14 files** |

---

## 2. Critical Issues (must fix before deployment)

### CRIT-1: `FormAITool` interface has ghost columns that do not exist on DB table

**File**: `src/types/form-builder.ts` (lines 21-31)

**Problem**: The `FormAITool` interface defines two properties that do not exist on the `form_ai_tools` DB table:
- `toolId: string` -- the DB uses `id TEXT PRIMARY KEY`, not a separate `tool_id` column
- `defaultEnabled: boolean` -- this column was explicitly removed in the migration comment (line 10 of migration 2: "removed default_enabled column")

Additionally, `FormAITool` is **missing** properties that DO exist on the DB table:
- `searchFunction` (maps to `search_function`)
- `status` (maps to `status`)
- `createdAt` (maps to `created_at`)

**Impact**: Any hook (e.g., `UseFormAIToolsReturn`) that uses `FormAITool` as its return type will have a type mismatch when mapping DB rows. The `toolId` and `defaultEnabled` properties will be `undefined` at runtime, while `searchFunction`, `status`, and `createdAt` will be missing from the type.

**Note**: The `AIToolDefinition` interface (lines 37-48) in the same file IS correct and matches the DB table exactly. The fix is to either:
1. Delete `FormAITool` entirely and use `AIToolDefinition` everywhere, or
2. Fix `FormAITool` to match the DB table (remove `toolId` and `defaultEnabled`, add `searchFunction`, `status`, `createdAt`)

**Checklist ref**: 3.2.6

---

## 3. Major Issues (should fix)

### MAJ-1: `incrementUsage(...).catch(console.error)` pattern in edge functions

**Files**: `refine-form-instructions/index.ts` (line 345), `generate-form-template/index.ts` (line 437)

**Problem**: Both new edge functions use `await incrementUsage(supabase, userId, groupId).catch(console.error)`. The MEMORY.md warns: "Supabase JS client in Deno: `supabase.rpc()` returns a `PostgrestFilterBuilder` (thenable), NOT a native Promise -- `.catch()` does not exist on it."

**Analysis**: In this specific case, `incrementUsage` is an `async function` in `_shared/usage.ts` that wraps the `.rpc()` call. Because `async function` always returns a native `Promise`, the `.catch()` IS valid here. However, this is a fragile pattern -- if `incrementUsage` were ever refactored to return the `PostgrestFilterBuilder` directly, `.catch()` would silently fail.

**Recommendation**: Wrap in `try/catch` for consistency with the documented Deno limitation, or add a comment explaining why `.catch()` is safe here (because `incrementUsage` is an async wrapper). This matches the pattern used in `ask-form/index.ts` line 1414 which uses the same `.catch()` approach.

**Severity justification**: Major because the current code works, but the pattern contradicts the project's documented safety rule.

**Checklist ref**: 2.1.30

### MAJ-2: Admin form routes do not use lazy loading

**File**: `src/App.tsx` (lines 32-33)

**Problem**: The plan (arch plan Section 8.5) specifies that builder pages should use `React.lazy` + `Suspense` for code splitting:
```
import AdminFormsListPage from "./pages/admin/AdminFormsListPage";
import AdminFormBuilderPage from "./pages/admin/AdminFormBuilderPage";
```

These are static imports. The form builder is a large, admin-only feature. Every user (including regular staff who never see the builder) will download the builder bundle.

**Recommendation**: Convert to lazy imports:
```tsx
const AdminFormsListPage = React.lazy(() => import("./pages/admin/AdminFormsListPage"));
const AdminFormBuilderPage = React.lazy(() => import("./pages/admin/AdminFormBuilderPage"));
```
And wrap the route elements in `<Suspense>`.

**Checklist ref**: 5.1.8

### MAJ-3: `refine-form-instructions` does not return updated `conversationHistory`

**File**: `refine-form-instructions/index.ts` (lines 348-358)

**Problem**: The backend plan (Section 1.2) specifies the response should include `conversationHistory` for multi-turn support. The checklist item 2.1.25 requires `conversationHistory` in the response. The actual response (lines 348-358) returns `refinedInstructions`, `explanation`, `suggestions`, and `usage` -- but NOT the updated `conversationHistory`.

The frontend would need to manually reconstruct the conversation history from the request + response, which is error-prone and means the edge function's contract differs from its plan.

**Recommendation**: Include `conversationHistory` in the response that appends the current turn (user message + assistant response) to the sanitized input history, capped at `MAX_HISTORY_MESSAGES`.

**Checklist ref**: 2.1.25, 2.1.33

---

## 4. Minor Issues (nice to fix)

### MIN-1: Publish trigger `ai_refinement_log` cap ordering is reversed

**File**: `20260225200300_add_publish_trigger.sql` (lines 79-87)

**Problem**: The cap logic uses `ORDER BY idx DESC LIMIT 20` in the subquery, then wraps with `jsonb_agg(elem ORDER BY idx)`. The outer `ORDER BY idx` re-sorts ascending, so the final result is the last 20 entries in their original order -- this IS correct. However, the intermediate `ORDER BY idx DESC LIMIT 20` paired with `ORDER BY idx` in the outer agg is confusing. A simpler approach would be:

```sql
-- Slice the last 20 entries directly
NEW.ai_refinement_log := (
  SELECT jsonb_agg(elem)
  FROM (
    SELECT elem
    FROM jsonb_array_elements(NEW.ai_refinement_log) WITH ORDINALITY AS t(elem, idx)
    ORDER BY idx
    OFFSET jsonb_array_length(NEW.ai_refinement_log) - 20
  ) sub
);
```

**Impact**: Cosmetic / maintainability only. The current code produces the correct result.

**Checklist ref**: 1.4.14

### MIN-2: Publish trigger name mismatch with plan

**File**: `20260225200300_add_publish_trigger.sql` (line 96)

**Problem**: The trigger is named `trg_handle_form_template_publish` but the DB plan (line 836) uses `trg_form_template_publish`. The checklist item 1.4.15 expects `trg_handle_form_template_publish`. The trigger ordering comment (lines 101-112) correctly documents the actual name. This is a cosmetic inconsistency with the plan, not a functional issue -- the trigger works regardless of its name.

**Checklist ref**: 1.4.15

### MIN-3: First publish version bump starts at 2, not 1

**File**: `20260225200300_add_publish_trigger.sql` (line 43)

**Problem**: The trigger uses `COALESCE(OLD.template_version, 0) + 1`. A newly created template has `template_version = 1` (default from the table definition). On first publish, it becomes `1 + 1 = 2`. The DB plan verification query 7.10 (line 1119) expects `v_version <> 2` which confirms this is intentional. However, this means the first published version is 2, not 1, which may confuse users who see "Version 2" on a brand-new template.

**Impact**: Behavioral quirk, not a bug. The plan explicitly expects version 2 after first publish. Document this in the UI ("Version 2" means "first published version").

**Checklist ref**: 1.4.18

### MIN-4: `generate-form-template` temperature is 0.5, plan says 0.7

**File**: `generate-form-template/index.ts` (line 388)

**Problem**: The temperature is set to 0.5 but the checklist item 2.2.18 expects 0.7 per the backend plan. Both values are reasonable -- 0.5 is slightly more conservative for form structure generation.

**Impact**: Marginal. 0.5 will produce slightly less creative but more consistent templates.

**Checklist ref**: 2.2.18

### MIN-5: `generate-form-template` description minimum length not enforced

**File**: `generate-form-template/index.ts` (lines 250-298)

**Problem**: The checklist item 2.2.8 specifies "description validated: required, minimum length (10 chars)." The actual validation checks for empty/missing description but does not enforce a 10-character minimum. A description like "A form" (6 chars) would be accepted.

**Impact**: Low. Very short descriptions will produce low-confidence results (the AI handles this gracefully via the confidence score).

**Checklist ref**: 2.2.8

### MIN-6: No `console.log` audit for production edge functions

**Files**: `generate-form-template/index.ts` (lines 327-328, 347, 356-357)

**Problem**: The function uses `console.log` for informational logging (input mode, character counts). While `console.error` is standard for errors in edge functions, `console.log` for non-error information is technically acceptable in Supabase edge functions but adds noise to production logs.

**Impact**: Cosmetic. Does not affect functionality.

**Checklist ref**: 11.1

### MIN-7: `UseFormAIToolsReturn` uses the incorrect `FormAITool` type

**File**: `src/types/form-builder.ts` (lines 420-424)

**Problem**: `UseFormAIToolsReturn` references `FormAITool[]` which has the ghost columns (see CRIT-1). Should reference `AIToolDefinition[]` instead.

**Impact**: Type mismatch when the hook is implemented. Directly related to CRIT-1.

**Checklist ref**: 3.2.4, 3.2.6

### MIN-8: `GenerateResponse` includes `width` property not in OpenAI schema

**File**: `src/types/form-builder.ts` (line 248)

**Problem**: The `GenerateResponse` interface includes `width: 'full' | 'half'` on fields, but the `FORM_TEMPLATE_DRAFT_SCHEMA` in `generate-form-template/index.ts` does NOT include a `width` property in the field schema. The AI will never return `width` because it is not in the JSON schema. The mapper `sanitizeGeneratedFields` defaults to `'full'` (line 73 of template-mapper.ts), which handles this gracefully.

**Impact**: Cosmetic type mismatch. Runtime behavior is correct because the mapper provides a default.

**Checklist ref**: 2.2.29

---

## 5. Cross-Section Consistency Matrix

### 5.1 Tool IDs (Audit C1)

| Location | `search_contacts` | `search_manual` | `search_products` | `search_standards` | `search_steps_of_service` |
|----------|:-:|:-:|:-:|:-:|:-:|
| DB seed (`form_ai_tools`) | PASS | PASS | PASS | PASS | PASS |
| `ask-form` TOOL_REGISTRY | PASS | PASS | PASS | PASS | PASS |
| `ask-form` executeTool switch | PASS | PASS | PASS | PASS | PASS |
| `refine-form-instructions` tool descriptions | PASS | PASS | PASS | PASS | PASS |
| `generate-form-template` prompt + schema | PASS | PASS | PASS | PASS | PASS |
| `search_restaurant_standards` occurrences | **EXTINCT** (only in plan docs, not in code) |

**Verdict: PASS** -- All 5 tool IDs are consistent across all code files. The deprecated `search_restaurant_standards` only appears in planning documents, not in any implementation file.

### 5.2 Limits (Audit C2/C3)

| Location | Max Fields | Max Options |
|----------|:-:|:-:|
| DB trigger (migration 3) | 50 | 50 |
| Frontend `validateForPublish()` | 50 | 50 |
| Edge function prompts | Not enforced (implicit) | Not enforced (implicit) |

**Verdict: PASS** -- Both limits are 50/50 everywhere they are enforced.

### 5.3 Field Types (R28)

| Location | Count | Types |
|----------|:-----:|-------|
| `FormFieldType` in `forms.ts` | 17 | text, textarea, date, time, datetime, select, radio, checkbox, number, phone, email, signature, image, file, header, instructions, contact_lookup |
| DB trigger `valid_types` | 17 | Same 17 (verified character-by-character) |
| `generate-form-template` schema `type.enum` | 17 | Same 17 (verified) |
| `generate-form-template` system prompt | 17 | Same 17 (listed in "Available Field Types" section) |
| `refine-form-instructions` prompt | Indirect | References "field types" but does not enumerate them (acceptable -- the refine function does not validate types) |
| SYNC comment in trigger | PRESENT | Line 14 and line 35 of migration 3 |

**Verdict: PASS** -- All 17 types are synchronized. SYNC comments are present.

### 5.4 Template Columns (Audit G14)

| Column | DB | `FormTemplate` TS | `BuilderState` TS |
|--------|:--:|:-:|:-:|
| `builder_state` / `builderState` | PASS | PASS (line 106) | N/A (not stored in builder state -- it IS builder state) |
| `ai_refinement_log` / `aiRefinementLog` | PASS | PASS (line 107) | N/A (mapped to `refinementHistory`) |
| `published_at` / `publishedAt` | PASS | PASS (line 105) | PASS (line 98) |

**Verdict: PASS** -- All 3 new columns are mapped correctly.

### 5.5 Trigger Naming (Audit C4)

| Check | Status |
|-------|--------|
| `handle_form_template_publish()` exists | PASS |
| `bump_form_template_version()` does NOT exist | PASS |
| Backend plan superseded function not created | PASS |

**Verdict: PASS**

### 5.6 Casing Convention (Audit C5)

| Check | Status |
|-------|--------|
| `generate-form-template` response uses snake_case | PASS |
| `GenerateResponse` interface uses snake_case | PASS |
| `mapGeneratedTemplate()` utility exists | PASS (template-mapper.ts) |
| `sanitizeGeneratedFields()` handles AI output cleanup | PASS |

**Verdict: PASS**

### 5.7 BuilderAction Types vs Reducer Cases

| Action | Defined in types | Handled in reducer |
|--------|:---:|:---:|
| HYDRATE | PASS | PASS |
| RESET | PASS | PASS |
| SET_TITLE_EN | PASS | PASS |
| SET_TITLE_ES | PASS | PASS |
| SET_DESCRIPTION_EN | PASS | PASS |
| SET_DESCRIPTION_ES | PASS | PASS |
| SET_SLUG | PASS | PASS |
| SET_ICON | PASS | PASS |
| SET_STATUS | PASS | PASS |
| SET_ACTIVE_TAB | PASS | PASS |
| SET_RIGHT_PANEL_MODE | PASS | PASS |
| SET_SELECTED_FIELD | PASS | PASS |
| SET_PREVIEW_MODE | PASS | PASS |
| SET_CREATION_MODE | PASS | PASS |
| ADD_FIELD | PASS | PASS |
| UPDATE_FIELD | PASS | PASS |
| REMOVE_FIELD | PASS | PASS |
| REORDER_FIELDS | PASS | PASS |
| SET_INSTRUCTIONS_EN | PASS | PASS |
| SET_INSTRUCTIONS_ES | PASS | PASS |
| SET_INSTRUCTION_LANGUAGE | PASS | PASS |
| SET_AI_TOOLS | PASS | PASS |
| TOGGLE_TOOL | PASS | PASS |
| SAVE_START | PASS | PASS |
| SAVE_SUCCESS | PASS | PASS |
| SAVE_ERROR | PASS | PASS |
| PUBLISH_CHANGES | PASS | PASS |
| AI_GENERATE_START | PASS | PASS |
| AI_GENERATE_SUCCESS | PASS | PASS |
| AI_GENERATE_ERROR | PASS | PASS |
| ADD_REFINEMENT_MESSAGE | PASS | PASS |
| CLEAR_REFINEMENT_HISTORY | PASS | PASS |
| ACCEPT_REFINED_INSTRUCTIONS | PASS | PASS |
| UNDO | PASS | PASS |
| REDO | PASS | PASS |

**Verdict: PASS** -- Every defined action has a corresponding reducer case. No orphaned actions. No unhandled cases (the `default` returns unchanged state).

---

## 6. Security Checklist Results

### 6.1 Database Security

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | `validate_form_template_fields()` is SECURITY DEFINER | PASS | Line 22 of migration 3 |
| 2 | `validate_form_template_fields()` has SET search_path = public | PASS | Line 23 of migration 3 |
| 3 | `handle_form_template_publish()` is SECURITY DEFINER | PASS | Line 25 of migration 4 |
| 4 | `handle_form_template_publish()` has SET search_path = public | PASS | Line 26 of migration 4 |
| 5 | `form_ai_tools` has RLS enabled | PASS | Line 34 of migration 2 |
| 6 | `form_ai_tools` has SELECT-only policy for authenticated | PASS | Lines 36-38 of migration 2 |
| 7 | `form_ai_tools` has NO INSERT/UPDATE/DELETE policies | PASS | Verified -- no other policies created |
| 8 | No `public.gen_random_uuid()` usage (must be `extensions.`) | PASS | No UUID generation in migrations |
| 9 | CHECK constraint on `ai_refinement_log` | PASS | `chk_ai_refinement_log_is_array` in migration 1 |

### 6.2 Edge Function Security

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | `refine-form-instructions` verify_jwt = false | PASS | config.toml confirmed |
| 2 | `refine-form-instructions` uses authenticateWithClaims | PASS | Line 197 |
| 3 | `refine-form-instructions` admin/manager check | PASS | Lines 200-208 |
| 4 | `generate-form-template` verify_jwt = false | PASS | config.toml confirmed |
| 5 | `generate-form-template` uses authenticateWithClaims | PASS | Line 233 |
| 6 | `generate-form-template` admin/manager check | PASS | Lines 236-248 |
| 7 | Role check queries actual DB table | PASS | Both query `group_memberships` table |
| 8 | No hardcoded API keys | PASS | `Deno.env.get("OPENAI_API_KEY")` used |
| 9 | `OPENAI_API_KEY` null check before use | PASS | Both functions check |
| 10 | JSON.parse wrapped in try-catch (refine) | PASS | Lines 333-342 |
| 11 | JSON.parse wrapped in try-catch (generate) | PASS | Lines 422-434 |
| 12 | finish_reason checked before parsing (refine) | PASS | Lines 321-330 |
| 13 | finish_reason checked before parsing (generate) | PASS | Lines 410-419 |
| 14 | No `.catch()` on PostgrestFilterBuilder | SEE MAJ-1 | `.catch()` on `incrementUsage()` is technically safe (async wrapper) |
| 15 | No XSS vectors | PASS | All responses are JSON |

### 6.3 Input Sanitization

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | `rawInstructions` validated non-empty | PASS | Line 220-222 |
| 2 | `rawInstructions` length capped at 5000 | PASS | Lines 223-229 |
| 3 | `description` length capped at 10,000 | PASS | Lines 285-291 |
| 4 | `fileContent` length capped at 50,000 | PASS | Lines 292-298 |
| 5 | Conversation history sanitized (role filter) | PASS | Lines 264-274 |
| 6 | History message content capped at 2000 chars | PASS | Line 273 |
| 7 | `groupId` required | PASS | Both functions validate |
| 8 | `templateContext` validated | PASS | Lines 230-236 |

---

## 7. Risk Mitigation Checklist Results

### R9: Condition-Order Coupling (two-pass validation)

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Pass 1 collects ALL field keys upfront | PASS | Migration 3 lines 60-64 |
| 2 | Pass 2 validates conditions against full key set | PASS | Lines 150-154 |
| 3 | Self-reference check exists | PASS | Lines 144-147 |
| 4 | Forward references allowed | PASS | Field f2 can reference f3 at a later position |
| 5 | Pass 1 filters out NULL/empty keys | PASS | Line 63 `WHERE f->>'key' IS NOT NULL AND f->>'key' != ''` |

**Verdict: R9 FULLY MITIGATED**

### R20: Auto-save Race Conditions

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Auto-save uses debounced timer (3s) | PASS | BuilderContext.tsx line 328 |
| 2 | Auto-save only fires when `isDirty && !isSaving && templateId` | PASS | Line 326 |
| 3 | Timer cleared on unmount | PASS | Lines 332-334 |
| 4 | Timer cleared on new change | PASS | Line 327 (clears before setting new timer) |
| 5 | Save uses `try/catch` (not `.catch()` on Postgrest) | PASS | Lines 369-405 |
| 6 | Optimistic concurrency via `updated_at` | PARTIAL | The save function returns `updated_at` from DB (line 390-391) and stores it in state (line 397), but does NOT check `updated_at` match before writing. The optimistic concurrency guard described in the DB plan (Section 4.6) is not implemented in the save function. |

**Verdict: R20 PARTIALLY MITIGATED** -- The infrastructure is in place (serverUpdatedAt stored), but the actual `WHERE updated_at = $expected` guard is not in the save query. This is acceptable for Sprint 1 since concurrent editing is rare for a single-restaurant admin team, but should be added in Sprint 2.

### R28: Field Type Validator Maintenance

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | SYNC comment at top of migration | PASS | Migration 3 line 14 |
| 2 | SYNC comment inline with `valid_types` array | PASS | Migration 3 line 35 |
| 3 | References `src/types/forms.ts` | PASS | Both comments reference it |
| 4 | References `FormFieldRenderer.tsx` | PASS | Line 14 |
| 5 | References `ask-form prompt` | PASS | Line 14 |

**Verdict: R28 FULLY MITIGATED**

---

## 8. File-by-File Review

### 8.1 Migration 1: `20260225200000_add_form_builder_columns.sql`

**Verdict: PASS**

| # | Check | Status |
|---|-------|--------|
| 3 columns added | PASS |
| IF NOT EXISTS on all ADD COLUMN | PASS |
| CHECK constraint (idempotent DO block) | PASS |
| Backfill published_at | PASS |
| BEGIN/COMMIT | PASS |
| No deferred columns (lock, parent, max_fields) | PASS |
| No `public.gen_random_uuid()` | PASS |

### 8.2 Migration 2: `20260225200100_create_form_ai_tools.sql`

**Verdict: PASS**

| # | Check | Status |
|---|-------|--------|
| TEXT PRIMARY KEY (not UUID) | PASS |
| All 10 columns present | PASS |
| Status CHECK constraint | PASS |
| created_at DEFAULT now() | PASS |
| RLS enabled | PASS |
| SELECT-only policy for authenticated | PASS |
| No write policies | PASS |
| 5 seed rows | PASS |
| Tool IDs match plan exactly | PASS |
| Icons match: BookUser, BookOpen, UtensilsCrossed, Star, ListChecks | PASS |
| sort_order: 1,2,3,4,5 | PASS |
| search_function correctly maps | PASS |
| DROP TABLE IF EXISTS CASCADE | PASS |
| BEGIN/COMMIT | PASS |

### 8.3 Migration 3: `20260225200200_enhance_field_validation_trigger.sql`

**Verdict: PASS**

| # | Check | Status |
|---|-------|--------|
| CREATE OR REPLACE FUNCTION | PASS |
| SECURITY DEFINER | PASS |
| SET search_path = public | PASS |
| NULL fields handled | PASS (line 43) |
| Empty array handled | PASS (line 43) |
| Max 50 fields | PASS |
| 17 valid types match FormFieldType | PASS |
| Non-empty key required | PASS |
| Non-empty type required | PASS |
| Key format regex | PASS |
| Duplicate key detection | PASS |
| Select/radio/checkbox require options | PASS |
| Max 50 options | PASS |
| Two-pass condition validation | PASS |
| Self-reference rejected | PASS |
| Forward references allowed | PASS |
| Order property required | PASS |
| Non-integer order caught | PASS |
| Duplicate order rejected | PASS |
| SYNC comments present | PASS |
| No trigger re-creation (function only) | PASS |
| BEGIN/COMMIT | PASS |

### 8.4 Migration 4: `20260225200300_add_publish_trigger.sql`

**Verdict: PASS (with minor notes)**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| Function created | PASS | |
| SECURITY DEFINER | PASS | |
| SET search_path = public | PASS | |
| Slug immutability | PASS | Uses IS DISTINCT FROM |
| First publish: version bump | PASS | |
| First publish: published_at set | PASS | |
| First publish: builder_state cleared | PASS | |
| First publish: ai_refinement_log cleared | PASS | |
| Re-publish: version bump on content change | PASS | Lines 55-69 |
| Re-publish: IS DISTINCT FROM for comparison | PASS | |
| No-change publish: no version bump | PASS | The ELSIF only fires when fields/instructions changed |
| ai_refinement_log capped at 20 | PASS | |
| Preserves most recent 20 | PASS | See MIN-1 |
| Trigger fires BEFORE UPDATE FOR EACH ROW | PASS | |
| DROP TRIGGER IF EXISTS before recreate | PASS | Line 20 |
| COALESCE for version bump | PASS | |
| BEGIN/COMMIT | PASS | |

### 8.5 `refine-form-instructions/index.ts`

**Verdict: PASS (with MAJ-1, MAJ-3)**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| File location correct | PASS | |
| verify_jwt = false in config.toml | PASS | |
| Imports from _shared/cors | PASS | |
| Uses authenticateWithClaims | PASS | |
| Admin/manager role check | PASS | |
| Returns 403 for non-admin | PASS | |
| Returns 401 for auth error | PASS | |
| rawInstructions validated | PASS | |
| language defaults to "en" | PASS | |
| conversationHistory defaults to [] | PASS | |
| Uses gpt-4o-mini | PASS | |
| response_format json_object | PASS | |
| max_tokens >= 1200 | PASS (1200) | |
| temperature 0.4 | PASS | |
| OPENAI_API_KEY from env | PASS | |
| Bilingual system prompt | PASS | |
| finish_reason checked | PASS | |
| JSON.parse in try-catch | PASS | |
| Empty content check | PARTIAL | Checks `data.choices[0].message.content` but does not explicitly check for null/empty before parse -- relies on JSON.parse failing |
| History capped at 6 | PASS | |
| History sanitized (role filter) | PASS | |
| AbortController timeout | PASS (30s) | |
| conversationHistory NOT returned | **FAIL** | See MAJ-3 |

### 8.6 `generate-form-template/index.ts`

**Verdict: PASS**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| File location correct | PASS | |
| verify_jwt = false in config.toml | PASS | |
| Uses authenticateWithClaims | PASS | |
| Admin/manager check | PASS | |
| Returns 403 for non-admin | PASS | |
| Description length validated | PASS (10,000 chars) | |
| Language defaults to "en" | PASS | |
| Uses gpt-4o-mini | PASS | |
| Structured JSON schema output | PASS | |
| Schema defines all 17 field types | PASS | |
| Schema includes ai_tools array | PASS | |
| Tool IDs in prompt match DB | PASS | All 5 listed |
| Response in snake_case | PASS | |
| max_tokens = 4000 | PASS | |
| temperature = 0.5 | MIN-4 | Plan says 0.7 |
| finish_reason checked | PASS | |
| JSON.parse in try-catch | PASS | |
| System prompt lists field types | PASS | |
| System prompt includes key format | PASS | |
| System prompt includes section grouping | PASS | |
| System prompt includes bilingual | PASS | |
| System prompt includes tool recommendations | PASS | |
| System prompt includes ai_hint guidance | PASS | |
| Minimum description length not enforced | MIN-5 | Plan says 10 chars |

### 8.7 `ask-form/index.ts` (tool aliases added)

**Verdict: PASS**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| search_standards in TOOL_REGISTRY | PASS | Line 277 |
| search_steps_of_service in TOOL_REGISTRY | PASS | Line 278 |
| Both route to search_manual_v2 | PASS | Lines 577-613 |
| Proper OpenAI function calling schema | PASS | Lines 228-270 |
| executeTool switch has cases | PASS | Lines 577-613 |
| Error handling (console.error, empty results) | PASS | Lines 594-595 |
| formatToolResults handles new tools | PASS | Lines 647-659 (case "search_standards" / "search_steps_of_service") |
| Citation source set correctly | PASS | "manual/standards" and "manual/service" |

### 8.8 `src/types/form-builder.ts`

**Verdict: FAIL (CRIT-1)**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| BuilderTab type | PASS | 4 values |
| RightPanelMode type | PASS | 3 values |
| SaveStatus type | PASS | 4 values |
| FormAITool matches DB | **FAIL** | Has `toolId` and `defaultEnabled` which don't exist on DB table. See CRIT-1 |
| AIToolDefinition matches DB | PASS | Correct interface |
| BuilderSnapshot | PASS | fields, instructionsEn, instructionsEs |
| BuilderState has all required fields | PASS | 27+ properties verified |
| BuilderAction covers all operations | PASS | 34 action types |
| GenerateResponse uses snake_case | PASS | |
| BuilderContextValue has expected API | PASS | |
| ValidationError defined | PASS | |

### 8.9 `src/types/forms.ts`

**Verdict: PASS**

| # | Check | Status |
|---|-------|--------|
| FormFieldType has 17 values | PASS |
| FormTemplate includes publishedAt | PASS |
| FormTemplate includes builderState | PASS |
| FormTemplate includes aiRefinementLog | PASS |

### 8.10 `src/contexts/BuilderContext.tsx`

**Verdict: PASS (with partial R20 note)**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| Uses createContext + useContext + useReducer | PASS | |
| BuilderProvider wraps children | PASS | |
| useBuilder throws outside provider | PASS | |
| Initial state defaults sensible | PASS | |
| All action types handled in reducer | PASS | 34 cases |
| Metadata setters mark isDirty | PASS | |
| SET_ACTIVE_TAB does NOT mark dirty | PASS | |
| SET_SELECTED_FIELD sets rightPanelMode | PASS | |
| ADD_FIELD pushes undo, adds, selects | PASS | |
| UPDATE_FIELD pushes undo | PASS | |
| REMOVE_FIELD clears selected if removed | PASS | |
| REORDER_FIELDS reassigns order 1,2,3... | PASS | |
| SET_INSTRUCTIONS_EN/ES push undo | PASS | |
| SET_INSTRUCTION_LANGUAGE does NOT push undo | PASS | |
| UNDO pops past, pushes to future | PASS | |
| REDO pops future, pushes to past | PASS | |
| Past capped at maxHistory (30) | PASS | |
| Undoable actions clear future | PASS | via pushUndo |
| takeSnapshot deep-copies fields | PASS | `state.fields.map(f => ({ ...f }))` |
| Auto-save 3s debounce | PASS | |
| Auto-save guards: isDirty && !isSaving && templateId | PASS | |
| Timer cleared on unmount | PASS | |
| Save uses try/catch (not .catch) | PASS | |
| Save includes builder_state | PASS | |
| Save maps camelCase to snake_case | PASS | |
| SAVE_SUCCESS on published sets hasUnpublishedChanges | PASS | Line 219 |
| Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, Escape | PASS | Lines 339-355 |
| HYDRATE preserveUIState option | PASS | |

### 8.11 `src/lib/form-builder/builder-utils.ts`

**Verdict: PASS**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| generateFieldKey produces valid keys | PASS | |
| generateSlug produces valid slugs | PASS | |
| getDefaultField creates proper defaults | PASS | All 17 types mapped |
| Select/radio/checkbox get default options | PASS | |
| reorderFields reassigns order 1..N | PASS | |
| computeAiFillabilityScore computes 0-100 | PASS | |
| getToolRecommendations uses correct 5 tool IDs | PASS | |
| validateForPublish checks 50 field limit | PASS | |
| validateForPublish checks 50 option limit | PASS | |
| validateForPublish checks condition self-reference | PASS | |
| validateForPublish checks condition dangling reference | PASS | |

### 8.12 `src/lib/form-builder/template-mapper.ts`

**Verdict: PASS**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| mapGeneratedTemplate maps snake_case to camelCase | PASS | |
| sanitizeGeneratedFields deduplicates keys | PASS | |
| sanitizeGeneratedFields ensures options for choice fields | PASS | |
| sanitizeGeneratedFields resequences order | PASS | |
| sanitizeGeneratedFields validates key format | PASS | |

### 8.13 `src/App.tsx` (routes)

**Verdict: PASS (with MAJ-2 note)**

| # | Check | Status | Notes |
|---|-------|--------|-------|
| /admin/forms route | PASS | |
| /admin/forms/new route | PASS | |
| /admin/forms/:id/edit route | PASS | |
| All use ProtectedRoute with requiredRole="manager" | PASS | |
| Above catch-all "*" route | PASS | |
| AdminFormsListPage imported | PASS | |
| AdminFormBuilderPage imported | PASS | |
| Lazy loading | **FAIL** | See MAJ-2 -- static imports used |

### 8.14 `supabase/config.toml`

**Verdict: PASS**

| # | Check | Status |
|---|-------|--------|
| `[functions.refine-form-instructions]` section | PASS |
| verify_jwt = false | PASS |
| `[functions.generate-form-template]` section | PASS |
| verify_jwt = false | PASS |

---

## 9. Recommendations

### Before Deployment (must fix)

1. **Fix `FormAITool` interface** (CRIT-1): Either delete it and use `AIToolDefinition` everywhere, or update it to match the DB schema. Update `UseFormAIToolsReturn` accordingly.

2. **Add `conversationHistory` to refine response** (MAJ-3): The multi-turn flow depends on the server returning the updated history. Without it, the frontend must reconstruct history manually, which is error-prone.

### Before Sprint 2 (should fix)

3. **Add lazy loading for admin form routes** (MAJ-2): Convert imports to `React.lazy` + `Suspense`.

4. **Document the `incrementUsage().catch()` pattern** (MAJ-1): Add a comment explaining why `.catch()` is safe here (async wrapper returns native Promise), or refactor to `try/catch` for consistency.

5. **Add optimistic concurrency guard to save function**: The `serverUpdatedAt` is tracked but not used in the WHERE clause. Add `AND updated_at = :expected` to the save query.

### Nice to have

6. Fix `generate-form-template` temperature to 0.7 per plan, or document why 0.5 was chosen (MIN-4).

7. Add minimum description length validation (10 chars) to `generate-form-template` (MIN-5).

8. Add `width` property to `FORM_TEMPLATE_DRAFT_SCHEMA` in `generate-form-template` so the AI can suggest half-width fields (MIN-8).

9. Simplify the `ai_refinement_log` cap SQL in the publish trigger (MIN-1).

---

## 10. Summary Scorecard

| Section | Items | Pass | Fail | Partial | N/A |
|---------|-------|------|------|---------|-----|
| 1. DB Migrations (4 files) | 83 | 83 | 0 | 0 | 0 |
| 2. Edge Functions (3 files) | 64 | 62 | 2 | 0 | 0 |
| 3. Frontend Types (2 files) | 22 | 20 | 2 | 0 | 0 |
| 4. Context & State (1 file) | 28 | 27 | 0 | 1 | 0 |
| 5. Route Registration (1 file) | 8 | 7 | 1 | 0 | 0 |
| 6. Cross-Section Consistency | 7 | 7 | 0 | 0 | 0 |
| 7. Security | 27 | 26 | 0 | 1 | 0 |
| 8. Utilities (2 files) | 11 | 11 | 0 | 0 | 0 |
| 9. Risk Mitigations | 3 | 2 | 0 | 1 | 0 |
| **Total** | **253** | **245** | **5** | **3** | **0** |

**Pass rate: 96.8%**

---

*This audit was conducted by the Devil's Advocate agent (Opus 4.6) through a line-by-line review of all 14 Sprint 1 files against the review checklist, plan documents, and codebase conventions. Every finding includes specific file paths and line numbers for traceability.*
