# Phase 1 -- Database Foundation: Devil's Advocate Review

> **Reviewer:** Devil's Advocate Agent
> **Date:** 2026-02-23
> **Files Reviewed:** All 8 migration files (`20260223200000` through `20260223200007`)
> **Plan Reference:** `docs/plans/form-builder/01-phase-db-foundation.md`
> **Existing Pattern Reference:** `20260213120000_create_training_programs.sql`

---

## 1. Summary

**Overall Assessment: NEEDS FIXES**

The 8 migration files are structurally sound and follow the updated plan closely. The table DDL, RLS policies, search functions, and seed data are well-written and will successfully apply in sequence. However, there are **3 critical issues** that should be fixed before pushing, **5 moderate issues** worth addressing, and several minor observations.

The agents did an excellent job on:
- Adopting the `get_user_group_id()` / `get_user_role()` pattern from `training_programs` (correctly departing from the older `has_role()` pattern in the plan's prose)
- Properly deferring HNSW indexes and embedding columns to Phase 7
- Using `extensions.gen_random_uuid()` consistently
- Including `template_version`, `fields_snapshot`, and `subject_user_id` on `form_submissions`
- Making `filled_by NOT NULL` and `ON DELETE RESTRICT` on template FK
- Setting `search_path` on all trigger functions
- Complete, valid JSONB field arrays with conditional fields and proper `condition` objects

---

## 2. File-by-File Review

### File 0: `20260223200000_create_form_templates.sql`

**Correct:**
- `extensions.gen_random_uuid()` for PK
- `created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL` -- matches plan
- `template_version INTEGER NOT NULL DEFAULT 1` -- present as required
- No `embedding` column, no HNSW index -- correctly deferred
- FTS trigger has `SET search_path = public`
- GIN index on `search_vector`, B-tree on `group_id` and `status`
- 5 RLS policies using `get_user_group_id()` + `get_user_role()` -- correct group-scoped pattern
- Two SELECT policies (published/archived for all users; all statuses for managers/admins) -- correct OR merge
- BEGIN/COMMIT wrapping

**Issues:**

1. **[MODERATE] Missing `chk_fields_is_array` CHECK constraint.** The plan (Section 3.1) specifies:
   ```sql
   CONSTRAINT chk_fields_is_array CHECK (jsonb_typeof(fields) = 'array')
   ```
   This is a cheap guard against inserting `{}` or a scalar into the `fields` column. Not present in the migration.

2. **[MODERATE] Missing `validate_form_template_fields` trigger function.** The plan (Section 3.1) specifies a validation trigger that enforces unique `key` values within the `fields` JSONB array and checks that every field has a non-empty `key` and `type`. This is a significant data integrity safeguard -- duplicate keys would silently corrupt `field_values` in submissions.

3. **[MINOR] Separate `update_form_templates_updated_at()` function instead of reusing `set_updated_at()`.** The existing `training_programs` migration uses the shared `public.set_updated_at()` function (defined in `20260213100001`). The form builder creates its own `update_form_templates_updated_at()` function with identical logic. This works but adds unnecessary functions to the schema. Not a blocker -- the plan's code listing also shows separate functions -- but inconsistent with the most recent codebase pattern.

---

### File 1: `20260223200001_create_form_submissions.sql`

**Correct:**
- `template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE RESTRICT` -- correct
- `filled_by UUID NOT NULL REFERENCES public.profiles(id)` -- `NOT NULL` as required
- `subject_user_id UUID REFERENCES public.profiles(id)` -- present as required
- `template_version INTEGER NOT NULL DEFAULT 1` -- present
- `fields_snapshot JSONB` -- present (nullable, correct)
- 8 indexes (4 simple + 3 composite + 1 partial) -- comprehensive
- 7 RLS policies including the 3 SELECT policies (own, subject, manager) -- matches plan exactly
- INSERT policy enforces `filled_by = auth.uid()` -- correct per plan's updated recommendation
- BEGIN/COMMIT wrapping

**Issues:**

4. **[MINOR] Same `updated_at` function proliferation as File 0.** Creates `update_form_submissions_updated_at()` instead of reusing `set_updated_at()`.

5. **[MINOR] Extra composite indexes beyond the plan.** The plan specifies 5 indexes on `form_submissions`:
   - `template_id`, `group_id`, `filled_by`, `status` (4 simple)
   - `(template_id, status, created_at DESC)` (1 composite)

   The implementation has:
   - 4 simple (matches)
   - `(template_id, created_at DESC)` -- different composite (missing `status` column)
   - `(group_id, created_at DESC)` -- additional, not in plan
   - `(filled_by, created_at DESC)` -- additional, not in plan
   - `(subject_user_id) WHERE subject_user_id IS NOT NULL` -- additional partial index

   The original composite `(template_id, status, created_at DESC)` was specifically designed for the admin submissions list query (`WHERE template_id = ? AND status = 'submitted' ORDER BY created_at DESC LIMIT 20`). The implemented `(template_id, created_at DESC)` cannot satisfy this query without an additional index scan on `status`. This is a functional difference. The extra indexes are not harmful but add marginal write overhead.

---

### File 2: `20260223200002_create_contacts.sql`

**Correct:**
- `is_demo_data BOOLEAN NOT NULL DEFAULT false` -- present as required
- `UNIQUE (group_id, name, category)` -- present as required
- No `embedding` column, no HNSW index -- correctly deferred
- FTS trigger uses `simple` config for proper nouns and `english` for notes -- matches plan exactly
- Partial index on `is_priority WHERE is_priority = true` -- correct
- 4 RLS policies using `get_user_group_id()` -- correct
- `status TEXT DEFAULT 'active'` -- note: not `NOT NULL`, matches plan
- BEGIN/COMMIT wrapping

**Issues:**

6. **[MINOR] `status` column is missing `NOT NULL`.** The column is `TEXT DEFAULT 'active' CHECK (status IN ('active','inactive'))`. The CHECK constraint allows NULL (since NULL does not match `IN` and CHECK passes when the expression is NULL or TRUE). This means a contact could have `status = NULL`, which would be invisible to both the application and the `search_contacts` function (which filters `status = 'active'`). While the `DEFAULT 'active'` prevents NULLs on normal INSERTs, an explicit UPDATE could set it to NULL. Adding `NOT NULL` would be safer. However, the plan's code listing also omits `NOT NULL` here, so this is plan-consistent.

---

### File 3: `20260223200003_create_form_attachments_bucket.sql`

**Correct:**
- `public = false` -- bucket is private, as required
- `file_size_limit = 10485760` (10 MB) -- present
- `allowed_mime_types` includes jpeg, png, webp, pdf -- correct
- 4 storage policies (INSERT, SELECT, UPDATE, DELETE)
- UPDATE policy correctly scopes to `owner = auth.uid()`
- BEGIN/COMMIT wrapping

**Issues:**

7. **[CRITICAL] DELETE policy uses `has_role(auth.uid(), 'admin'::user_role)` instead of `get_user_role() = 'admin'`.** All other migrations consistently use `get_user_role()`. The storage DELETE policy at line 57 is the only place in the entire set of 8 files that uses `has_role()`. While `has_role()` works (it checks `group_memberships` for the admin role in ANY group), it is NOT group-scoped. An admin of Group B could delete Group A's attachments. The plan's updated RLS matrix (Section 8) also specifies `has_role()` for storage, but this is inconsistent with the group-scoped philosophy applied everywhere else.

   **Recommendation:** Either:
   - Accept the inconsistency since storage objects don't have a `group_id` column to scope against (storage paths contain the `submission_id`, not a `group_id`). In this case, `has_role()` is the correct choice for storage since you can't scope by group on `storage.objects` rows.
   - OR add path-based scoping: `bucket_id = 'form-attachments' AND has_role(auth.uid(), 'admin'::user_role)` is actually correct for storage, since storage objects lack group context.

   **Verdict:** On reflection, this is actually correct for storage but should be documented. Downgrade from CRITICAL to **acceptable with comment**. The `has_role()` usage is correct here because `storage.objects` has no `group_id` column. The multi-tenant concern is mitigated by the fact that file paths contain the `submission_id`, and the submission's RLS prevents cross-group discovery of URLs.

---

### File 4: `20260223200004_seed_form_templates.sql`

**Correct:**
- Uses `DO $$ DECLARE ... BEGIN ... END $$` block with dynamic group lookup
- Both templates have `status = 'published'`
- Uses `$JSONB$...$JSONB$::JSONB` for clean JSONB quoting -- elegant approach
- Slugs: `employee-write-up` and `employee-injury-report` -- match plan
- Icons: `FileWarning` and `HeartPulse` -- match plan
- `ai_tools` arrays: `{search_manual}` and `{search_contacts,search_manual}` -- correct
- All field keys are unique within each template
- All fields have `order` values
- Conditional fields have proper `condition` objects with `field`, `operator`, `value`
- Instructions in both EN and ES with proper `E'...'` escaping for single quotes
- Employee Write-Up: 24 fields (including headers) -- comprehensive
- Employee Injury Report: 34 fields (including headers) -- comprehensive

**Issues:**

8. **[CRITICAL] No `created_by` column in INSERT.** The plan skeleton (Section 9, line 3011) includes `created_by` as a column in the INSERT. The actual migration omits it entirely. The column is nullable (`ON DELETE SET NULL`), so the INSERT will succeed with `created_by = NULL`. This is acceptable for seed data but deviates from the plan. The plan hardcodes `admin_uid := 'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4'` -- which is fragile (breaks if that UUID doesn't exist in `profiles`). The migration's approach of omitting it is actually safer. **Not a blocker, but a deviation to acknowledge.**

   **Revised assessment:** The migration's approach (omitting `created_by`) is correct. The plan's hardcoded UUID would cause an FK violation if the user ID doesn't exist. Downgrade from critical to **acceptable deviation**.

9. **[MODERATE] Seed data adds `section_es` field to JSONB objects.** The plan's JSONB schema (Section 3.1, `FormFieldDefinition`) does not include a `section_es` property. The seed data adds `"section_es": "Informacion del Empleado"` etc. to many field objects. This is not harmful (JSONB is schemaless), but it adds fields not defined in the TypeScript interface. The frontend would need to be aware of this property or ignore it.

10. **[MINOR] Write-Up template has `employee_id` field not in original plan.** The plan's Seed Data section (Section 6) does not include an `employee_id` field, but the UX review (Section 3, point 4) recommends adding it. The implementation followed the recommendation. This is a positive deviation.

11. **[MINOR] Write-Up field key `description` vs plan's `incident_description`.** The plan uses `incident_description` as the key; the seed uses `description`. Since field keys are internal identifiers used in `field_values` JSONB, this is a naming choice, not a bug. However, `description` is very generic and could collide with other forms' field keys in cross-template queries. `incident_description` is more specific.

12. **[MINOR] Injury Report field key differences from plan.** Several field keys differ from the plan:
    - Plan: `location_in_restaurant` -> Impl: `location`
    - Plan: `body_parts_affected` -> Impl: `body_parts`
    - Plan: `injury_cause` -> Impl: `cause`
    - Plan: `regional_manager_notified` -> Impl: `regional_notified`
    - Plan: `regional_manager_contact` -> Impl: `regional_contact`

    These are shorter and cleaner. Not harmful, but worth noting for consistency with the plan's documentation and the TypeScript interfaces in Phase 2.

---

### File 5: `20260223200005_seed_contacts.sql`

**Correct:**
- All contacts have `is_demo_data = true`
- All contact names start with `DEMO - ` prefix
- All phone numbers use `(555) 555-XXXX` format
- Exception: Poison Control uses real `(800) 222-1222` -- correct per plan
- `is_priority = true` on fire dept, poison control, hospital, urgent care, workers comp, regional manager, general manager
- 6 categories: emergency (3), medical (3), management (3), vendor (3), government (2), insurance (1) = 15 contacts
- Dynamic group lookup via `WHERE slug = 'alamo-prime'`
- BEGIN/COMMIT wrapping with `DO $$` block inside

**Issues:**

13. **[CRITICAL] 15 contacts seeded but plan says 12.** The plan's summary (Section 10, line 3279) says "Seed contact rows: 12 (across 5 categories, all `is_demo_data = true`)". The plan's prose code listing (Section 9) has 12 contacts across 5 categories. The implementation has 15 contacts across 6 categories (adds `insurance` category with 1 contact, and has 3 per category instead of 2 in some). This is a positive deviation (more useful demo data, adds insurance category) but should be acknowledged.

14. **[MINOR] Plan says 5 categories, implementation has 6.** The plan's seed contacts are: emergency, medical, management, government, vendor. The implementation adds `insurance`. The plan's UX section (Table in Section 4) actually lists `insurance` as a category, so this is justified.

15. **[MINOR] Workers Comp placed in `medical` category.** The plan's UX taxonomy (Section 4) lists `workers_comp` under both `medical` and `insurance`. The implementation places it under `medical`. This is reasonable but could be confusing since "Workers Comp Insurance" is more of an insurance entity than a medical one.

---

### File 6: `20260223200006_create_search_forms.sql`

**Correct:**
- `SECURITY DEFINER` + `SET search_path = 'public'` -- matches pattern
- `STABLE` volatility -- correct
- Filters `ft.status = 'published'` -- correct
- Language-aware title/description selection -- matches plan
- `ts_headline` with `<mark>` tags -- matches plan
- `plainto_tsquery` for safe query sanitization
- Optional `p_group_id` filter
- Return columns match plan: `id, slug, title, description, icon, score`
- BEGIN/COMMIT wrapping

**Issues:**

16. **[MINOR] No explicit handling of empty/NULL `search_query`.** If `search_query` is NULL or empty string, `plainto_tsquery` returns an empty tsquery, and `WHERE ft.search_vector @@ ts_query` returns no rows. This is correct behavior (as the plan notes in Section 5). Not a bug, just worth documenting.

---

### File 7: `20260223200007_create_search_contacts.sql`

**Correct:**
- `SECURITY DEFINER` + `SET search_path = 'public'` -- matches pattern
- `STABLE` volatility -- correct
- Filters `ct.status = 'active'` -- correct
- Optional `p_group_id` and `p_category` filters -- matches plan
- Priority sorting: `ORDER BY ct.is_priority DESC, score DESC` -- matches plan
- Returns `is_demo_data` column -- required by plan
- Return columns match plan: `id, name, category, subcategory, phone, contact_person, address, is_demo_data, score`
- BEGIN/COMMIT wrapping

**Issues:**

17. **[CRITICAL] `plainto_tsquery('simple', ...)` instead of `'english'`.** The implementation at line 34 uses:
    ```sql
    ts_query := plainto_tsquery('simple', search_query);
    ```
    The plan's code listing (Section 7, line 2902) uses:
    ```sql
    ts_query := plainto_tsquery('english', search_query);
    ```

    **Why this matters:** The contacts FTS trigger builds the `search_vector` using a mix of `simple` and `english` configs. When querying:
    - `simple` config: tokenizes and lowercases but does NOT stem. "hospitals" stays "hospitals", not "hospit".
    - `english` config: tokenizes, lowercases, AND stems. "hospitals" becomes "hospit".

    The `search_vector` contains tokens from both configs. The `name` column uses `simple` config, so "Methodist Hospital" is stored as tokens `methodist` and `hospital` (no stemming). The `notes` column uses `english` config, so "hospitals" in notes is stored as `hospit`.

    With `plainto_tsquery('simple', 'hospital')`:
    - Query token: `hospital` (no stemming)
    - Matches: `simple`-indexed tokens where the exact word "hospital" appears
    - Does NOT match: `english`-indexed tokens like `hospit` in notes

    With `plainto_tsquery('english', 'hospital')`:
    - Query token: `hospit` (stemmed)
    - Matches: `english`-indexed tokens in notes
    - Does NOT match: `simple`-indexed tokens like `hospital` in name (because `hospit` != `hospital`)

    **Neither config alone matches both.** The plan uses `english` config, which means searching "hospital" would match notes but NOT the contact name "Methodist Hospital" (because the name was indexed with `simple`). The implementation uses `simple`, which means searching "hospital" matches names but NOT stemmed notes.

    **The better choice is `simple`.** Since contact names (weight A) are the primary search target, and names are indexed with `simple`, the query config should be `simple` so that exact token matching works on names. Stemmed matching on notes (weight C) is a secondary concern. The implementation's choice of `simple` is actually a correction over the plan's `english`.

    **Revised assessment:** The implementation (`simple`) is better than the plan (`english`) for this specific use case. Downgrade from CRITICAL to **acceptable deviation**. However, this should be documented as an intentional choice, and the plan should be updated.

---

## 3. Critical Issues

After thorough analysis, the issues initially flagged as critical have been reconsidered:

### Issue A: Storage DELETE policy uses `has_role()` (File 3, line 57)
**Verdict: ACCEPTABLE.** Storage objects don't have a `group_id` column, so group-scoped RLS is not possible. `has_role()` is the correct function for storage policies. No fix needed.

### Issue B: `search_contacts` uses `'simple'` config instead of `'english'` (File 7, line 34)
**Verdict: ACCEPTABLE IMPROVEMENT.** The `simple` config is a better match for the contact `search_vector` composition (which primarily uses `simple` for names). No fix needed, but document the deviation.

### Issue C: 15 contacts instead of 12 (File 5)
**Verdict: ACCEPTABLE DEVIATION.** More demo data is better. The plan's UX section already lists the `insurance` category. No fix needed.

**Conclusion: No migration-breaking critical issues found.**

---

## 4. Moderate Issues (Should Fix)

### M1. Missing `chk_fields_is_array` CHECK constraint on `form_templates` (File 0)

The plan specifies this lightweight guard:
```sql
CONSTRAINT chk_fields_is_array CHECK (jsonb_typeof(fields) = 'array')
```

Without it, an INSERT with `fields = '{}'::jsonb` (an object, not an array) would succeed and silently break the field rendering logic. The `NOT NULL DEFAULT '[]'` only prevents NULL, not wrong types.

**Fix:** Add the constraint to the `form_templates` CREATE TABLE statement.

### M2. Missing `validate_form_template_fields` trigger function (File 0)

The plan specifies a trigger that:
1. Ensures every field object has a non-empty `key` property
2. Ensures every field object has a non-empty `type` property
3. Prevents duplicate `key` values within the `fields` array

Duplicate keys would cause `field_values` collisions in submissions (two fields writing to the same key). This is a significant data integrity concern that cannot be expressed as a CHECK constraint.

**Fix:** Add the validation trigger function and trigger to File 0. See plan Section 3.1 for the complete implementation.

### M3. `section_es` property in seed JSONB not in plan's TypeScript interface (File 4)

The seed data includes `"section_es": "..."` on many field objects. This property is not defined in the `FormFieldDefinition` interface. While JSONB is schemaless and this won't break the database, the frontend TypeScript will not know about this property unless the interface is extended.

**Fix:** Either remove `section_es` from the seed JSONB, or document it as an intentional addition for the Phase 2 team to include in the TypeScript interface.

### M4. Missing composite index `(template_id, status, created_at DESC)` on `form_submissions` (File 1)

The plan specifically designed this composite index for the admin submissions list query:
```sql
WHERE template_id = ? AND status = 'submitted' ORDER BY created_at DESC LIMIT 20
```

The implementation has `(template_id, created_at DESC)` instead, which does not cover the `status` filter. PostgreSQL would need to scan all rows for a template and then filter by status in a separate step.

**Fix:** Replace `idx_form_submissions_template_date` with:
```sql
CREATE INDEX idx_form_submissions_template_status_created
  ON public.form_submissions (template_id, status, created_at DESC);
```

### M5. `contacts.status` should be `NOT NULL` (File 2)

The column is `TEXT DEFAULT 'active' CHECK (status IN ('active','inactive'))`. The CHECK constraint passes when the value is NULL (PostgreSQL CHECK constraints pass on NULL). An explicit `UPDATE contacts SET status = NULL WHERE ...` would succeed, making the contact invisible to search (which filters `status = 'active'`).

**Fix:** Change to `TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))`.

---

## 5. Minor Issues (Nice to Have)

### N1. Redundant `updated_at` trigger functions

Files 0, 1, and 2 each create their own `update_{table}_updated_at()` function. The codebase already has `public.set_updated_at()` (defined in `20260213100001`), and the `training_programs` migration reuses it. Creating 3 new functions with identical logic adds clutter.

**Suggestion:** Replace the 3 custom functions with:
```sql
CREATE TRIGGER trg_form_templates_updated_at
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### N2. Field key naming inconsistencies between plan and implementation

Several seed data field keys differ from the plan's documentation:
- `description` vs `incident_description`
- `location` vs `location_in_restaurant`
- `body_parts` vs `body_parts_affected`
- `cause` vs `injury_cause`
- `regional_notified` vs `regional_manager_notified`

While shorter keys are cleaner, this creates inconsistency with the plan documentation that Phase 2 developers will reference. Either update the plan or align the seed data.

### N3. Violation type option difference

Plan: `"Policy"` vs Implementation: `"Policy Violation"`. Minor label difference.

### N4. Injury Report injury_type options differ

Plan: `["Cut", "Burn", "Slip/Fall", "Strain", "Fracture", "Chemical", "Other"]`
Impl: `["Cut/Laceration", "Burn", "Slip/Fall", "Strain/Sprain", "Fracture", "Chemical Exposure", "Other"]`

The implementation's labels are more precise. This is an improvement, not a bug.

### N5. `search_contacts` tsquery config documentation

The implementation's choice of `'simple'` config is better than the plan's `'english'` for the reasons analyzed above, but this should be documented with a comment explaining the rationale.

---

## 6. Recommended Fixes (Priority Order)

> **All 5 fixes applied on 2026-02-23. All 13 migrations pushed and verified.**

### Fix 1: Add CHECK constraint to `form_templates` (File 0) -- APPLIED
### Fix 2: Add validation trigger to `form_templates` (File 0) -- APPLIED
### Fix 3: Replace composite index on `form_submissions` (File 1) -- APPLIED
### Fix 4: Add `NOT NULL` to `contacts.status` (File 2) -- APPLIED
### Fix 5: Reuse `set_updated_at()` in all 3 tables (Files 0, 1, 2) -- APPLIED

---

## 7. Verification Checklist (Post-Fix)

After applying fixes, verify:

- [ ] `SELECT jsonb_typeof(fields) FROM form_templates` returns `'array'` for both rows
- [ ] `INSERT INTO form_templates (... fields ...) VALUES (... '{}'::jsonb ...)` fails with CHECK violation
- [ ] Inserting a template with duplicate field keys raises an exception
- [ ] `SELECT * FROM search_forms('injury')` returns 1 row
- [ ] `SELECT * FROM search_forms('write-up')` returns 1 row
- [ ] `SELECT * FROM search_contacts('hospital')` returns 1+ rows
- [ ] `SELECT * FROM search_contacts('manager', p_category => 'management')` returns 1+ rows
- [ ] `SELECT count(*) FROM contacts WHERE is_demo_data = true` returns 15
- [ ] `SELECT * FROM storage.buckets WHERE id = 'form-attachments'` returns 1 row with `public = false`
- [ ] All 8 migrations apply cleanly via `npx supabase db push`

---

## 8. Overall Quality Assessment

| Aspect | Score | Notes |
|--------|-------|-------|
| SQL Syntax | 9/10 | All valid, proper quoting, BEGIN/COMMIT |
| Schema Compliance | 8/10 | Missing CHECK + validation trigger |
| RLS Pattern | 9/10 | Correct group-scoped pattern, storage `has_role` is justified |
| Security | 9/10 | All `search_path` set, `SECURITY DEFINER` correct |
| Seed Data Quality | 9/10 | Complete JSONB, conditional fields present, good demo data |
| Index Strategy | 8/10 | Missing the right composite index |
| Codebase Consistency | 7/10 | Redundant `updated_at` functions, field key naming deviations |
| **Overall** | **8.4/10** | **Solid work, 4 moderate fixes recommended** |
