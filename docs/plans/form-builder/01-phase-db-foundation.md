# Phase 1 -- Database Foundation

> **Status:** Planning
> **Estimated effort:** ~1 session
> **Dependencies:** None (first phase)
> **Output:** 8 SQL migrations, 0 frontend changes

---

## Database Deep Dive

---

### 1. FTS Configuration

#### Approach: Single Combined Vector with Mixed Language Configs

The codebase has two established FTS patterns:

1. **`manual_sections`** -- Separate vectors per language (`search_vector_en`, `search_vector_es`), each using its language-native config (`english`, `spanish`). The content is long-form prose where stemming quality matters per language.
2. **Product tables** (`prep_recipes`, `wines`, etc.) -- Single `search_vector` using `english` config. Content is English-only.

For `form_templates`, the overview schema defines a single `search_vector TSVECTOR` column. Because form templates have bilingual titles and descriptions but are **short text** (not long prose), and because this table will hold at most a few dozen rows, we follow the **product table pattern** with one enhancement: we concatenate both English and Spanish tsvectors into a single column so a search in either language returns results.

This is a pragmatic middle ground. The `manual_sections` two-column pattern is overkill for a table with 5-50 rows and 4 short text columns. A single combined vector that ingests both languages means `search_forms('lesion')` (Spanish) and `search_forms('injury')` (English) both match the Injury Report template, without requiring the search function to pick a vector column.

For the `search_forms()` function, the language parameter determines which tsquery config to use (for stemming the search input), but the search_vector itself contains tokens from both languages.

#### `form_templates` Search Vector Composition

| Column | tsvector Config | Weight | Rationale |
|--------|----------------|--------|-----------|
| `title_en` | `english` | **A** | Primary match target -- highest priority |
| `title_es` | `spanish` | **A** | Bilingual title parity |
| `description_en` | `english` | **B** | Secondary relevance signal |
| `description_es` | `spanish` | **B** | Bilingual description parity |

We intentionally **exclude** `instructions_en`/`instructions_es` from the search vector. Instructions are AI-facing internal text (step-by-step guides for the AI assistant), not user-facing search content. Including them would pollute FTS results with irrelevant matches. The instructions will be captured in the embedding vector (Phase 7) for semantic search where they are appropriate.

We also **exclude** the `fields` JSONB array. Extracting text from JSONB at trigger time (`jsonb_array_elements(NEW.fields)->>'label'`) is fragile, slow, and adds tokens from field labels that would confuse FTS ranking (every form has an "Employee Name" field -- it should not match a search for "employee name" since that is a field label, not a form identity). Field labels will be represented in the embedding vector.

**Trigger function:**

```sql
CREATE OR REPLACE FUNCTION public.update_form_templates_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.title_es, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description_en, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(NEW.description_es, '')), 'B');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_form_templates_search_vector
  BEFORE INSERT OR UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_form_templates_search_vector();
```

Key decisions:
- `SET search_path = public` on the function -- satisfies the Supabase security advisor (`function_search_path_mutable`). This is set inline on the function definition (not via a later `ALTER FUNCTION`) so it cannot be missed. The existing product table triggers were created *without* `search_path` and required a followup migration (`20260210171646_fix_trigger_search_path.sql`). We avoid repeating that.
- Mixed configs in one vector: PostgreSQL allows concatenating tsvectors built from different configs. The `english` stemmer reduces "injury" to "injuri"; the `spanish` stemmer reduces "lesion" to "lesion". Both tokens coexist in the single vector. A `plainto_tsquery('english', 'injury')` matches the English-stemmed tokens; a `plainto_tsquery('spanish', 'lesion')` matches the Spanish-stemmed tokens. The `search_forms()` function selects the tsquery config based on the `search_language` parameter.
- The `updated_at` timestamp is **not** set in this trigger (unlike the `manual_sections` pattern). Instead, a separate `updated_at` trigger handles it. This separation follows the product table pattern and keeps FTS logic isolated.

#### `contacts` Search Vector Composition

Contacts contain proper nouns (hospital names, personal names, addresses) that should **not** be stemmed. "Methodist Hospital" should match "Methodist", not "methodist hospit" (which `english` config would produce). However, the `notes` and `category` columns contain English descriptive text where stemming helps.

The solution: use `simple` config for proper-noun columns (tokenize + lowercase, no stemming) and `english` for descriptive columns.

| Column | tsvector Config | Weight | Rationale |
|--------|----------------|--------|-----------|
| `name` | `simple` | **A** | Proper noun -- exact token match, no stemming |
| `contact_person` | `simple` | **A** | Proper noun -- "Dr. Smith" should match "Smith" |
| `category` | `simple` | **B** | Short categorical label -- "emergency", "medical" |
| `subcategory` | `simple` | **B** | Short label -- "hospital", "urgent_care" |
| `address` | `simple` | **C** | Street names are proper nouns |
| `notes` | `english` | **C** | Descriptive text -- stemming helps ("deliveries" matches "delivery") |

**Trigger function:**

```sql
CREATE OR REPLACE FUNCTION public.update_contacts_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.contact_person, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.address, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_search_vector
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_contacts_search_vector();
```

Why not bilingual vectors for contacts? Contact data is structured (names, categories) not prose. "Hospital" is spelled identically in English and Spanish. "Departamento de Bomberos" would need to be stored in a Spanish column that does not exist yet. For Phase 1 with English-language contacts, a single mixed-config vector is correct. If Spanish contact names are needed later, a `name_es` column and Spanish tsvector contribution can be added.

#### Why Not Separate `search_vector_en` / `search_vector_es` on `form_templates`?

The `manual_sections` table has separate language vectors because:
1. Content is long-form markdown (1000+ words) where language-specific stemming quality matters.
2. The search function has separate CTEs for EN/ES vector matching.
3. There are 34 sections with full EN+ES content -- enough data for language-specific ranking to matter.

`form_templates` will have 5-50 rows with short titles and descriptions. At this scale, the ranking difference between language-specific vectors and a combined vector is negligible. The combined approach also simplifies the search function (one `WHERE` clause instead of a `CASE` expression selecting the vector column), the index count (one GIN index instead of two), and the migration complexity.

If form templates grow to hundreds of rows with substantial bilingual content, splitting to two vectors is a backward-compatible change: add columns, drop the old index, add new indexes, update the trigger.

---

### 2. Index Strategy

#### Naming Convention

The codebase uses `idx_{table}_{purpose}` consistently:
- Product tables: `idx_prep_recipes_search`, `idx_wines_embedding`
- Manual sections: `idx_manual_sections_fts_en`, `idx_manual_sections_category`

We follow the same pattern.

#### `form_templates` Indexes

```sql
-- GIN index for full-text search (single combined EN+ES vector)
CREATE INDEX idx_form_templates_search
  ON public.form_templates USING gin(search_vector);

-- HNSW index for vector similarity (Phase 7 embeddings)
CREATE INDEX idx_form_templates_embedding
  ON public.form_templates USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- B-tree: foreign key (JOIN/filter performance)
CREATE INDEX idx_form_templates_group_id
  ON public.form_templates(group_id);

-- B-tree: status filter (published/draft/archived)
CREATE INDEX idx_form_templates_status
  ON public.form_templates(status);
```

**Indexes NOT created (and why):**
- `slug`: Already has a `UNIQUE` constraint, which implicitly creates a unique B-tree index. Adding an explicit `idx_form_templates_slug` would be redundant. (The existing `manual_sections` migration has both `slug TEXT UNIQUE` and `idx_manual_sections_slug` -- that was unnecessary.)
- `sort_order`: Only used in `ORDER BY` on a table with at most 50 rows. Sequential scan + sort is faster than an index lookup at this scale. Add later if templates exceed 200 rows.
- `created_by`: Rarely queried directly. Not worth an index.

Total: **4 indexes** on `form_templates`.

#### `form_submissions` Indexes

```sql
-- B-tree: foreign key to templates (most common JOIN)
CREATE INDEX idx_form_submissions_template_id
  ON public.form_submissions(template_id);

-- B-tree: foreign key to groups
CREATE INDEX idx_form_submissions_group_id
  ON public.form_submissions(group_id);

-- B-tree: RLS policy uses filled_by = auth.uid() -- critical for performance
CREATE INDEX idx_form_submissions_filled_by
  ON public.form_submissions(filled_by);

-- B-tree: status filter (draft/completed/submitted/archived)
CREATE INDEX idx_form_submissions_status
  ON public.form_submissions(status);

-- Composite: admin's most common query pattern
-- "Show me all submissions for this template, by status, newest first"
CREATE INDEX idx_form_submissions_template_status_created
  ON public.form_submissions(template_id, status, created_at DESC);
```

The composite index covers the admin submissions list page query (`WHERE template_id = ? AND status = 'submitted' ORDER BY created_at DESC LIMIT 20`) with a single index scan. Without it, PostgreSQL would need to combine the `template_id` and `status` indexes via a bitmap index scan, which is slower.

**No FTS, GIN, or HNSW indexes.** Submissions are queried by FK and status, not by text search. The JSONB columns are addressed in Section 3.

Total: **5 indexes** on `form_submissions`.

#### `contacts` Indexes

```sql
-- GIN index for full-text search
CREATE INDEX idx_contacts_search
  ON public.contacts USING gin(search_vector);

-- HNSW index for vector similarity (Phase 7 embeddings)
CREATE INDEX idx_contacts_embedding
  ON public.contacts USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- B-tree: foreign key
CREATE INDEX idx_contacts_group_id
  ON public.contacts(group_id);

-- B-tree: category filter (used in search_contacts p_category param)
CREATE INDEX idx_contacts_category
  ON public.contacts(category);

-- B-tree: status filter
CREATE INDEX idx_contacts_status
  ON public.contacts(status);

-- Partial B-tree: fast lookup for priority contacts
CREATE INDEX idx_contacts_is_priority
  ON public.contacts(is_priority) WHERE is_priority = true;
```

The partial index on `is_priority` only indexes rows where `is_priority = true` (expected: 3-5 rows). It is tiny and accelerates the "show priority contacts first" query in `search_contacts()` (`ORDER BY is_priority DESC, score DESC`). The existing product tables do not have partial indexes, but this is a clean case for one.

Total: **6 indexes** on `contacts`.

#### HNSW Parameters

All three tables use `m = 16, ef_construction = 64`, matching every existing product table in the codebase:

| Parameter | Value | Effect |
|-----------|-------|--------|
| `m` | 16 | Bi-directional links per node. 16 is the pgvector default. Higher values improve recall at the cost of memory. |
| `ef_construction` | 64 | Search width during index build. 64 is the default. Higher values produce a better graph but slower builds. |

At the expected data volumes (2-50 templates, 20-500 contacts), these parameters are far beyond what is needed. The HNSW indexes are created now for forward-compatibility (Phase 7 embeddings) so no ALTER INDEX migration is needed later. Build time at this volume is under 100ms.

#### Unique Constraints

| Table | Column | Constraint | Implicit Index |
|-------|--------|-----------|---------------|
| `form_templates` | `id` | `PRIMARY KEY` | Unique B-tree |
| `form_templates` | `slug` | `UNIQUE NOT NULL` | Unique B-tree |
| `form_submissions` | `id` | `PRIMARY KEY` | Unique B-tree |
| `contacts` | `id` | `PRIMARY KEY` | Unique B-tree |

Contacts do not need a unique constraint on `name` (two groups could have contacts with the same name; even within a group, "Methodist Hospital" might appear under both "medical" and "emergency" categories).

#### Estimated Index Sizes

**Initial (2 templates, 0 submissions, 12 contacts):**

| Table | Index | Est. Size |
|-------|-------|-----------|
| `form_templates` | GIN (search) | < 8 KB |
| `form_templates` | HNSW (embedding) | ~ 8 KB (empty, no embeddings yet) |
| `form_templates` | B-tree x2 | < 8 KB each |
| `form_submissions` | B-tree x5 | 8 KB each (empty table, minimum page) |
| `contacts` | GIN (search) | ~ 16 KB |
| `contacts` | HNSW (embedding) | ~ 8 KB (empty) |
| `contacts` | B-tree x4 | < 8 KB each |
| **Total** | | **~150 KB** |

**At scale (50 templates, 10K submissions, 500 contacts):**

| Table | Index | Est. Size |
|-------|-------|-----------|
| `form_templates` | GIN (search) | ~ 32 KB |
| `form_templates` | HNSW (embedding) | ~ 400 KB |
| `form_submissions` | B-tree (composite) | ~ 600 KB |
| `form_submissions` | B-tree (filled_by) | ~ 300 KB |
| `form_submissions` | B-tree (template_id) | ~ 200 KB |
| `contacts` | GIN (search) | ~ 64 KB |
| `contacts` | HNSW (embedding) | ~ 3 MB |
| **Total** | | **~5 MB** |

Negligible overhead. The JSONB `field_values` column in submissions is the largest data consumer (avg 2 KB x 10K = 20 MB), not the indexes.

---

### 3. JSONB Patterns

#### 3.1 `form_templates.fields` -- Structure Validation

The `fields` column stores the form blueprint as a JSONB array. Each element defines one field:

```json
{
  "key": "employee_name",
  "label": "Employee Full Name",
  "label_es": "Nombre Completo del Empleado",
  "type": "text",
  "required": true,
  "placeholder": "Enter employee's full legal name",
  "section": "Employee Information",
  "hint": "As it appears on their ID",
  "ai_hint": "Extract the employee's full name from the input",
  "options": [],
  "validation": {},
  "default": null,
  "order": 1,
  "condition": null
}
```

**CHECK constraint -- lightweight guard:**

```sql
CONSTRAINT chk_fields_is_array CHECK (jsonb_typeof(fields) = 'array')
```

This prevents the most common mistake: inserting an object `{}` or a scalar instead of an array `[]`. It is cheap (single function call, no JSONB traversal) and catches structural errors at the database level.

We do **not** add deeper CHECK constraints (e.g., validating that each element has a `key` property) because:
1. PostgreSQL CHECK constraints cannot iterate JSONB arrays without PL/pgSQL.
2. Schema evolution (adding new field properties like `ai_hint`, `condition`) would require modifying the CHECK, which is a migration.
3. The frontend TypeScript interface and the edge function both validate the complete structure. Double validation in the DB adds rigidity without safety.

**Key uniqueness within a template -- trigger validation:**

Duplicate `key` values within a template's `fields` array would break the `field_values` mapping in submissions (two fields writing to the same key). This constraint cannot be expressed as a CHECK or UNIQUE index because it requires inspecting array element properties.

Solution: a validation trigger:

```sql
CREATE OR REPLACE FUNCTION public.validate_form_template_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field_keys TEXT[];
  field_key TEXT;
  field_record JSONB;
BEGIN
  -- Empty array is valid (new/blank template)
  IF NEW.fields = '[]'::JSONB OR jsonb_array_length(NEW.fields) = 0 THEN
    RETURN NEW;
  END IF;

  field_keys := '{}';

  FOR field_record IN SELECT jsonb_array_elements(NEW.fields)
  LOOP
    -- Every field must have a non-empty 'key'
    IF field_record->>'key' IS NULL OR field_record->>'key' = '' THEN
      RAISE EXCEPTION 'Every field must have a non-empty "key" property';
    END IF;

    -- Every field must have a non-empty 'type'
    IF field_record->>'type' IS NULL OR field_record->>'type' = '' THEN
      RAISE EXCEPTION 'Every field must have a non-empty "type" property';
    END IF;

    field_key := field_record->>'key';

    -- Duplicate key check
    IF field_key = ANY(field_keys) THEN
      RAISE EXCEPTION 'Duplicate field key "%" in fields array', field_key;
    END IF;

    field_keys := array_append(field_keys, field_key);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_form_template_fields
  BEFORE INSERT OR UPDATE OF fields ON public.form_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_form_template_fields();
```

The `UPDATE OF fields` clause ensures the trigger only fires when the `fields` column changes, not on every update (e.g., status change, sort_order change). Performance impact: negligible -- templates are written rarely (admin only, 10-40 fields per template).

**No GIN index on `fields`.** The fields array is always read as a whole unit (load the template, render the form). There is no query pattern that searches inside the fields JSONB (e.g., "find all templates that have a signature field"). If such a need arises in the form builder admin, it can be done with `jsonb_array_elements` in application code.

#### 3.2 `form_submissions.field_values` -- GIN Index Decision

The `field_values` column stores filled form data:

```json
{
  "employee_name": "John Smith",
  "department": "BOH",
  "severity": "Written Warning",
  "date_of_incident": "2026-02-23",
  "body_parts": ["Hand", "Finger"]
}
```

**Phase 1 decision: defer the GIN index.**

The existing document (Section 5.1) recommends creating the GIN index proactively. However, the deeper analysis favors deferral:

1. **No query uses it in Phase 1-6.** Submissions are always queried by `template_id` + `status` + `filled_by`. The admin submissions list page shows all fields for a template, not a cross-template search.

2. **GIN write amplification.** Every INSERT and UPDATE to `field_values` must update the GIN index. With form submissions averaging 15-25 keys, the index maintenance cost is non-trivial. At 200 submissions/month, this adds ~4K index updates/month for an index nobody queries.

3. **`jsonb_path_ops` is the correct variant when added.** When cross-submission queries are needed (Phase 7 reporting), use:
   ```sql
   CREATE INDEX idx_form_submissions_field_values
     ON public.form_submissions USING gin(field_values jsonb_path_ops);
   ```
   `jsonb_path_ops` is 2-3x smaller than default `jsonb_ops` and supports the containment operator (`@>`), which is the natural pattern:
   ```sql
   WHERE field_values @> '{"severity": "Termination"}'::jsonb
   ```
   It does **not** support existence operators (`?`, `?|`, `?&`), but those are unlikely patterns for form data. If both are needed, use default `jsonb_ops`.

4. **Alternative for ad-hoc queries without a GIN index:**
   ```sql
   -- Works without any index (sequential scan on a small table is fast)
   SELECT * FROM form_submissions
   WHERE template_id = 'uuid'
     AND field_values->>'severity' = 'Termination';
   ```
   At 2,400 submissions/year, this query takes <10ms even without indexing.

**Recommendation: do not create the GIN index in Phase 1. Add it in Phase 7 when reporting features are built and actual query patterns are known.**

#### 3.3 `form_submissions.attachments` -- Indexing Decision

The `attachments` column is a JSONB array:

```json
[
  {
    "type": "photo",
    "url": "https://...storage.../photo1.webp",
    "field_key": "injury_photos",
    "caption": ""
  },
  {
    "type": "signature",
    "url": "https://...storage.../sig.png",
    "field_key": "employee_signature",
    "caption": ""
  }
]
```

**No index needed.** Attachments are:
- Always loaded as part of a submission row (never queried independently).
- Never filtered or searched by content.
- Small arrays (0-10 elements per submission).

There is no use case for "find all submissions that have a photo attachment" that would not first filter by `template_id`. Any such query would scan a small result set from the B-tree index on `template_id`.

#### 3.4 Performance: `jsonb_ops` vs `jsonb_path_ops` GIN

| Aspect | Default `jsonb_ops` | `jsonb_path_ops` |
|--------|---------------------|------------------|
| Index size | Larger (~3x) | Smaller |
| Supports `@>` (containment) | Yes | Yes |
| Supports `?` (key existence) | Yes | **No** |
| Supports `?|`, `?&` | Yes | **No** |
| Supports `@?` (path queries) | Yes | Yes |
| Build time | Slower | Faster |
| Use case fit for `field_values` | Overkill | **Best fit** (containment is our pattern) |

When the GIN index is added (Phase 7), `jsonb_path_ops` is the right choice for `field_values`. The primary query pattern is containment:

```sql
-- "Find all termination write-ups"
WHERE field_values @> '{"severity": "Termination"}'

-- "Find all BOH injuries"
WHERE field_values @> '{"department": "BOH"}'
```

Key existence queries (`field_values ? 'employee_name'`) are meaningless because all submissions for a template have the same keys.

---

### 4. RLS Policy Deep Dive

#### How Admin Is Determined

The codebase uses the `has_role` function defined in the initial migration (`20260206014834`):

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

This checks `group_memberships` for a row where the user has the specified role in **any** group. There is also `has_role_in_group(_user_id, _group_id, _role)` for group-scoped checks.

The product tables (`prep_recipes`, `wines`, etc.) consistently use `has_role(auth.uid(), 'admin'::user_role)` (not group-scoped) for all write RLS policies. For consistency, the form builder tables use the same pattern.

The `user_role` enum has three values: `'staff'`, `'manager'`, `'admin'`.

#### `form_templates` -- Exact Policy Definitions

```sql
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can view all templates (including drafts)
-- Rationale: Matches product table pattern (USING true). Status filtering
-- is handled at the application/query layer. The search function hardcodes
-- status = 'published'. Admins need to see drafts in the builder.
CREATE POLICY "Authenticated users can view form_templates"
  ON public.form_templates FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Admin only
CREATE POLICY "Admins can insert form_templates"
  ON public.form_templates FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- UPDATE: Admin only (USING + WITH CHECK both required for UPDATE policies)
CREATE POLICY "Admins can update form_templates"
  ON public.form_templates FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- DELETE: Admin only
CREATE POLICY "Admins can delete form_templates"
  ON public.form_templates FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

**Why `USING (true)` for SELECT instead of status-based filtering?**

An alternative is two SELECT policies: one for published (`USING (status = 'published')`) for all users, and one for all statuses for admins. This is stricter but adds complexity. The existing product tables use `USING (true)` -- staff can see all wines, recipes, etc. regardless of status. The `search_forms()` function filters `status = 'published'`, and the frontend query filters by status. Defense in depth at the RLS level is reasonable, but for consistency with 6 existing product tables, we use `USING (true)`.

#### `form_submissions` -- Exact Policy Definitions

```sql
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own submissions
CREATE POLICY "Users can view own form_submissions"
  ON public.form_submissions FOR SELECT
  TO authenticated
  USING (filled_by = auth.uid());

-- SELECT: Admins can view all submissions (OR-merged with above policy)
CREATE POLICY "Admins can view all form_submissions"
  ON public.form_submissions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- INSERT: Any authenticated user can create a submission
-- WITH CHECK (true) allows any authenticated user. The application sets
-- filled_by = current user, but the RLS does not enforce it here because
-- a manager might create a submission on behalf of an absent employee.
CREATE POLICY "Authenticated users can insert form_submissions"
  ON public.form_submissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Users can update their own submissions
CREATE POLICY "Users can update own form_submissions"
  ON public.form_submissions FOR UPDATE
  TO authenticated
  USING (filled_by = auth.uid())
  WITH CHECK (filled_by = auth.uid());

-- UPDATE: Admins can update any submission (OR-merged with above)
CREATE POLICY "Admins can update all form_submissions"
  ON public.form_submissions FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- DELETE: Admin only (audit trail -- users cannot delete submissions)
CREATE POLICY "Admins can delete form_submissions"
  ON public.form_submissions FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

**Key design decisions:**

1. **Two SELECT policies (OR semantics):** PostgreSQL merges multiple `FOR SELECT` policies with OR. A non-admin user sees rows where `filled_by = auth.uid()`. An admin sees all rows (the admin policy returns true for every row).

2. **INSERT WITH CHECK (true):** We do not enforce `filled_by = auth.uid()` in RLS because a manager might create a submission on behalf of an employee who was injured and cannot fill the form themselves. The application layer sets `filled_by` appropriately. If stricter enforcement is needed later, change to `WITH CHECK (filled_by = auth.uid())`.

3. **No status restriction on UPDATE:** The application layer enforces that only `draft` status submissions can be edited by non-admins. Adding `AND status = 'draft'` to the USING clause would cause a subtle bug: when the user submits (changing status from `draft` to `submitted`), the UPDATE would fail because the current row has `status = 'draft'` but the new row has `status = 'submitted'`, and both USING and WITH CHECK must pass. Keeping RLS simple and enforcing business logic in the app is the correct approach.

4. **DELETE admin only:** Form submissions are audit records. A user deleting their own write-up would defeat the purpose. Only admins can delete.

#### `contacts` -- Exact Policy Definitions

```sql
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can view contacts
-- Contacts are reference data (phone numbers, addresses) -- everyone needs access
CREATE POLICY "Authenticated users can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Admin only
CREATE POLICY "Admins can insert contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- UPDATE: Admin only
CREATE POLICY "Admins can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- DELETE: Admin only
CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

This is the simplest pattern -- identical to product tables. `USING (true)` for SELECT means all authenticated users see all contacts (including inactive ones). The `search_contacts()` function filters `status = 'active'`, and the frontend query can filter as needed.

#### `SECURITY DEFINER` Search Functions and RLS

Both `search_forms()` and `search_contacts()` are `SECURITY DEFINER`, meaning they execute as the function owner (superuser) and **bypass all RLS policies**. This is intentional and matches every existing search function in the codebase.

The functions reimplement the access control logic in their WHERE clauses:
- `search_forms()`: `WHERE ft.status = 'published'` (only published templates are searchable)
- `search_contacts()`: `WHERE ct.status = 'active'` (only active contacts are searchable)

This approach is necessary because:
1. RLS would double-filter the results (once in the policy, once in the function), adding overhead.
2. `SECURITY DEFINER` is needed for the search function to access the table without the caller's role restrictions interfering with the query planner.
3. The function is the sole entry point for search -- it IS the access control for search.

---

### 5. Search Function Optimization

#### FTS Query Sanitization

Both functions use `plainto_tsquery(config, search_query)`. This is the same choice made in every existing search function (product and manual search).

`plainto_tsquery` provides safe, automatic sanitization:
- Strips all tsquery operators: `&`, `|`, `!`, `(`, `)`, `:`, `*`
- Lowercases input
- Applies the text-search config's stemmer and stop-word removal
- Treats all remaining tokens as AND-connected terms
- **Never throws a syntax error**, regardless of input

Alternatives considered and rejected:
- `to_tsquery()` -- requires pre-sanitized input; throws errors on special characters (`&`, `|`). The caller would need to escape/strip, adding a layer of fragility.
- `websearch_to_tsquery()` -- supports Google-style syntax (`"exact phrase"`, `-exclude`, `OR`). Overkill for our use case and allows users to craft queries that exploit OR to widen results unexpectedly.
- `phraseto_tsquery()` -- requires exact phrase proximity. Too strict; "injury employee" would not match "Employee Injury Report".

**Empty/short query handling:**

```sql
-- Guard: empty tsquery returns no results
-- plainto_tsquery returns empty tsquery for: empty string, whitespace,
-- or queries consisting entirely of stop words (e.g., "the", "is", "a")
ts_query := plainto_tsquery(ts_config, search_query);

-- When ts_query is empty, the @@ operator would match ALL rows with non-null
-- search_vector. The WHERE clause handles this correctly because empty_tsquery @@
-- any_tsvector returns false in PostgreSQL (verified: empty tsquery matches nothing).
```

Actually, in PostgreSQL, an empty `tsquery` (the result of `plainto_tsquery('english', 'the')`) does **not** match any tsvector -- the `@@` operator returns false. So the functions do not need an explicit empty-query guard. The `WHERE ft.search_vector @@ ts_query` clause naturally returns zero rows when the tsquery is empty. This is the same behavior the existing product search functions rely on (none of them have empty-query guards).

For a truly empty string (`''`), `plainto_tsquery('english', '')` returns an empty tsquery, and the function returns zero rows. This is correct behavior.

#### Ranking: `ts_rank` vs `ts_rank_cd`

The existing product search functions all use `ts_rank` (frequency-based ranking):

```sql
-- Existing pattern (product search v2):
ROW_NUMBER() OVER (ORDER BY ts_rank(d.search_vector, ts_query) DESC) AS pos
```

For the form builder search functions, we follow the same pattern and use `ts_rank`. Reasons:
1. **Consistency.** All 5 product search functions + manual search use `ts_rank`. Using `ts_rank_cd` for forms would be an unexplained deviation.
2. **Scale.** With 2-50 form templates, ranking quality differences between `ts_rank` and `ts_rank_cd` are undetectable.
3. **RRF dominance.** In Phase 7, when the function is upgraded to hybrid RRF, the FTS rank is only used for relative ordering within the `kw` CTE to assign `ROW_NUMBER`. The RRF formula (`1/(60 + pos)`) reduces rank differences to position differences. Whether position 1 vs 2 was determined by `ts_rank` or `ts_rank_cd` is irrelevant to the final combined score.

For the FTS-only Phase 1, the functions use `ts_rank` directly as the `score` return value (not `ROW_NUMBER`-based RRF). This provides a meaningful relevance score to the caller. When upgraded to RRF in Phase 7, the score calculation changes to the standard `(1/(60 + pos))` formula.

**Normalization:** Not applied. `ts_rank` normalization options (e.g., dividing by document length) are useful when comparing documents of vastly different lengths. Form titles and descriptions are uniformly short. The existing product search functions do not use normalization.

#### Return Type Definitions

**`search_forms()`:**

```sql
RETURNS TABLE (
  id          UUID,
  slug        TEXT,
  title       TEXT,       -- Language-aware: returns title_es when search_language = 'es'
  description TEXT,       -- ts_headline snippet with <mark> tags
  icon        TEXT,
  score       FLOAT       -- Phase 1: ts_rank. Phase 7: RRF combined score.
)
```

**`search_contacts()`:**

```sql
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  category        TEXT,
  subcategory     TEXT,
  phone           TEXT,
  contact_person  TEXT,
  address         TEXT,
  is_demo_data    BOOLEAN,
  score           FLOAT
)
```

The return types match the RPC call signatures that the frontend hooks will consume via `supabase.rpc('search_forms', { ... })`. Changing return columns is a breaking change, so the Phase 1 types are designed to be stable through Phase 7.

#### Function Volatility: `STABLE`

Both functions are marked `STABLE`:

```sql
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
```

`STABLE` means: "This function does not modify the database and returns the same results for the same arguments within a single transaction." This allows PostgreSQL to:
1. Cache results within a single query (e.g., if the function is called in a subquery).
2. Use the function in index expressions.
3. Avoid re-evaluating for the same arguments in a statement.

`VOLATILE` would be incorrect (no side effects). `IMMUTABLE` would be incorrect (results depend on table contents that can change between transactions). All existing search functions use `STABLE`.

#### `SECURITY DEFINER` + `search_path` Pattern

```sql
SECURITY DEFINER
SET search_path = 'public'
```

- **`SECURITY DEFINER`:** Executes as the function owner (postgres superuser on Supabase). Bypasses RLS on the queried tables. Required because the search function needs unrestricted access to the table, and the access control is reimplemented in the function body (`WHERE status = 'published'`).
- **`SET search_path = 'public'`:** Pins the search path to `public`, preventing a malicious user from creating objects in a schema that shadows `public` tables. This addresses the Supabase security advisory `function_search_path_mutable`. Note: we quote `'public'` with single quotes in the SET clause, matching the existing product search function pattern.

#### Forward-Compatible Signature for Hybrid Search (Phase 7)

The Phase 1 `search_forms()` function has 4 parameters. In Phase 7, it will gain `query_embedding vector(1536)` as the second parameter (with `DEFAULT NULL`), plus `keyword_weight` and `vector_weight` parameters. This is a backward-compatible change -- existing callers continue to work without modification.

The Phase 7 upgrade adds:
1. A `kw_stats` CTE to count FTS hits (for adaptive weighting when FTS returns 0 hits).
2. A `vec` CTE for vector similarity ranking.
3. A `combined` CTE with the RRF formula.
4. Adaptive weighting: when FTS has 0 hits, use 100% vector score (same as `search_dishes` v2).

---

### 6. Seed Data JSONB Structure

#### Employee Write-Up Template -- Complete `fields` Array

```json
[
  {
    "key": "section_employee_info",
    "label": "Employee Information",
    "label_es": "Informacion del Empleado",
    "type": "header",
    "required": false,
    "order": 1
  },
  {
    "key": "employee_name",
    "label": "Employee Full Name",
    "label_es": "Nombre Completo del Empleado",
    "type": "text",
    "required": true,
    "placeholder": "Enter employee's full legal name",
    "section": "Employee Information",
    "hint": "As it appears on their ID",
    "ai_hint": "Extract the employee's full name from the input",
    "order": 2
  },
  {
    "key": "position",
    "label": "Position / Title",
    "label_es": "Puesto / Titulo",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Line Cook, Server, Bartender",
    "section": "Employee Information",
    "ai_hint": "Extract the employee's job title or position",
    "order": 3
  },
  {
    "key": "department",
    "label": "Department",
    "label_es": "Departamento",
    "type": "select",
    "required": true,
    "options": ["FOH", "BOH", "Bar", "Management"],
    "section": "Employee Information",
    "ai_hint": "Determine the department based on the employee's role. Servers/hosts = FOH, cooks/prep = BOH, bartenders = Bar",
    "order": 4
  },
  {
    "key": "date_of_hire",
    "label": "Date of Hire",
    "label_es": "Fecha de Contratacion",
    "type": "date",
    "required": false,
    "section": "Employee Information",
    "ai_hint": "Extract the hire date if mentioned",
    "order": 5
  },
  {
    "key": "supervisor_name",
    "label": "Supervisor Name",
    "label_es": "Nombre del Supervisor",
    "type": "text",
    "required": true,
    "placeholder": "Manager on duty or direct supervisor",
    "section": "Employee Information",
    "ai_hint": "Extract the supervisor or manager name if mentioned",
    "order": 6
  },
  {
    "key": "section_writeup_details",
    "label": "Write-Up Details",
    "label_es": "Detalles del Reporte",
    "type": "header",
    "required": false,
    "order": 7
  },
  {
    "key": "date_of_incident",
    "label": "Date of Incident",
    "label_es": "Fecha del Incidente",
    "type": "date",
    "required": true,
    "section": "Write-Up Details",
    "ai_hint": "Extract the date when the incident occurred. If 'today' is mentioned, use the current date.",
    "order": 8
  },
  {
    "key": "violation_type",
    "label": "Type of Violation",
    "label_es": "Tipo de Violacion",
    "type": "select",
    "required": true,
    "options": ["Attendance", "Performance", "Conduct", "Policy", "Safety", "Other"],
    "section": "Write-Up Details",
    "ai_hint": "Categorize: tardiness/no-show = Attendance, poor work quality = Performance, rude/insubordinate = Conduct, broke a rule = Policy, unsafe behavior = Safety",
    "order": 9
  },
  {
    "key": "severity",
    "label": "Severity",
    "label_es": "Severidad",
    "type": "radio",
    "required": true,
    "options": ["Verbal Warning", "Written Warning", "Final Warning", "Suspension", "Termination"],
    "section": "Write-Up Details",
    "ai_hint": "Assess severity: first offense = Verbal or Written. Repeated = Final Warning. Serious safety/conduct = Suspension or Termination.",
    "order": 10
  },
  {
    "key": "prior_warnings",
    "label": "Number of Prior Warnings",
    "label_es": "Numero de Advertencias Previas",
    "type": "number",
    "required": false,
    "placeholder": "0",
    "section": "Write-Up Details",
    "hint": "How many prior warnings has this employee received?",
    "ai_hint": "Extract the count of previous warnings if mentioned",
    "order": 11
  },
  {
    "key": "section_incident",
    "label": "Incident Description",
    "label_es": "Descripcion del Incidente",
    "type": "header",
    "required": false,
    "order": 12
  },
  {
    "key": "incident_description",
    "label": "Description of Incident",
    "label_es": "Descripcion del Incidente",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe what happened in factual detail...",
    "section": "Incident Description",
    "ai_hint": "Write a clear, factual, professional description. No opinions or subjective language. Include what happened, when, where, and who was involved.",
    "order": 13
  },
  {
    "key": "employee_explanation",
    "label": "Employee's Explanation",
    "label_es": "Explicacion del Empleado",
    "type": "textarea",
    "required": false,
    "placeholder": "What did the employee say when asked about the incident?",
    "section": "Incident Description",
    "ai_hint": "If the employee's response or explanation is mentioned, capture it here",
    "order": 14
  },
  {
    "key": "corrective_action",
    "label": "Corrective Action Required",
    "label_es": "Accion Correctiva Requerida",
    "type": "textarea",
    "required": true,
    "placeholder": "What steps must the employee take to correct the behavior?",
    "section": "Incident Description",
    "ai_hint": "Suggest specific, actionable corrective steps based on the violation type and severity. Be professional and constructive.",
    "order": 15
  },
  {
    "key": "improvement_timeline",
    "label": "Timeline for Improvement",
    "label_es": "Plazo para Mejora",
    "type": "text",
    "required": false,
    "placeholder": "e.g., Immediate, 30 days, Next scheduled shift",
    "section": "Incident Description",
    "ai_hint": "Suggest a reasonable timeline based on the severity",
    "order": 16
  },
  {
    "key": "section_evidence",
    "label": "Supporting Evidence",
    "label_es": "Evidencia de Soporte",
    "type": "header",
    "required": false,
    "order": 17
  },
  {
    "key": "supporting_documents",
    "label": "Attach Photos/Documents",
    "label_es": "Adjuntar Fotos/Documentos",
    "type": "file",
    "required": false,
    "section": "Supporting Evidence",
    "hint": "Attach any relevant photos, documents, or evidence",
    "order": 18
  },
  {
    "key": "section_acknowledgment",
    "label": "Acknowledgment",
    "label_es": "Reconocimiento",
    "type": "header",
    "required": false,
    "order": 19
  },
  {
    "key": "employee_signature",
    "label": "Employee Signature",
    "label_es": "Firma del Empleado",
    "type": "signature",
    "required": false,
    "section": "Acknowledgment",
    "hint": "Employee signs to acknowledge receipt of this write-up",
    "order": 20
  },
  {
    "key": "manager_signature",
    "label": "Manager Signature",
    "label_es": "Firma del Gerente",
    "type": "signature",
    "required": true,
    "section": "Acknowledgment",
    "order": 21
  },
  {
    "key": "date_signed",
    "label": "Date Signed",
    "label_es": "Fecha de Firma",
    "type": "date",
    "required": true,
    "section": "Acknowledgment",
    "ai_hint": "Default to today's date",
    "order": 22
  },
  {
    "key": "employee_refused_to_sign",
    "label": "Employee Refused to Sign",
    "label_es": "Empleado Se Nego a Firmar",
    "type": "checkbox",
    "required": false,
    "options": ["Employee refused to sign this document"],
    "section": "Acknowledgment",
    "hint": "Check if the employee refused to sign",
    "order": 23
  }
]
```

**`instructions_en` for Employee Write-Up:**

```
1. Identify the employee and their role from the user's description.
2. Determine the type and severity of the violation.
3. Write a factual, professional description of the incident -- no opinions, just facts.
4. Suggest appropriate corrective action based on the severity.
5. If the user mentions prior incidents, note the count of previous warnings.
6. Use the manual search to reference relevant company policies if applicable.
```

#### Employee Injury Report Template -- Complete `fields` Array

```json
[
  {
    "key": "section_injured_employee",
    "label": "Injured Employee",
    "label_es": "Empleado Lesionado",
    "type": "header",
    "required": false,
    "order": 1
  },
  {
    "key": "employee_name",
    "label": "Employee Full Name",
    "label_es": "Nombre Completo del Empleado",
    "type": "text",
    "required": true,
    "placeholder": "Enter injured employee's full name",
    "section": "Injured Employee",
    "ai_hint": "Extract the injured employee's full name",
    "order": 2
  },
  {
    "key": "position",
    "label": "Position / Title",
    "label_es": "Puesto / Titulo",
    "type": "text",
    "required": true,
    "placeholder": "e.g., Line Cook, Dishwasher, Server",
    "section": "Injured Employee",
    "ai_hint": "Extract the employee's job title or position",
    "order": 3
  },
  {
    "key": "department",
    "label": "Department",
    "label_es": "Departamento",
    "type": "select",
    "required": true,
    "options": ["FOH", "BOH", "Bar", "Management"],
    "section": "Injured Employee",
    "ai_hint": "Determine department from role context",
    "order": 4
  },
  {
    "key": "date_of_hire",
    "label": "Date of Hire",
    "label_es": "Fecha de Contratacion",
    "type": "date",
    "required": false,
    "section": "Injured Employee",
    "order": 5
  },
  {
    "key": "section_incident_details",
    "label": "Incident Details",
    "label_es": "Detalles del Incidente",
    "type": "header",
    "required": false,
    "order": 6
  },
  {
    "key": "date_of_injury",
    "label": "Date of Injury",
    "label_es": "Fecha de la Lesion",
    "type": "date",
    "required": true,
    "section": "Incident Details",
    "ai_hint": "Extract the date of injury. If 'today' is mentioned, use the current date.",
    "order": 7
  },
  {
    "key": "time_of_injury",
    "label": "Time of Injury",
    "label_es": "Hora de la Lesion",
    "type": "time",
    "required": true,
    "section": "Incident Details",
    "ai_hint": "Extract the time. Convert to 24h format (e.g., '3pm' = '15:00').",
    "order": 8
  },
  {
    "key": "location_in_restaurant",
    "label": "Location in Restaurant",
    "label_es": "Ubicacion en el Restaurante",
    "type": "select",
    "required": true,
    "options": ["Kitchen", "Dining Room", "Bar", "Patio", "Parking", "Storage", "Office", "Restroom", "Other"],
    "section": "Incident Details",
    "ai_hint": "Determine the location where the injury occurred from context",
    "order": 9
  },
  {
    "key": "injury_description",
    "label": "Description of Injury",
    "label_es": "Descripcion de la Lesion",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe what happened in detail...",
    "section": "Incident Details",
    "ai_hint": "Write a detailed, factual account: the mechanism of injury (how it happened), the specific injury sustained, and any relevant environmental factors.",
    "order": 10
  },
  {
    "key": "body_parts_affected",
    "label": "Body Part(s) Affected",
    "label_es": "Parte(s) del Cuerpo Afectada(s)",
    "type": "checkbox",
    "required": true,
    "options": ["Head", "Neck", "Back", "Shoulder", "Arm", "Hand", "Finger", "Leg", "Knee", "Foot", "Torso", "Other"],
    "section": "Incident Details",
    "ai_hint": "Identify all body parts affected from the injury description",
    "order": 11
  },
  {
    "key": "injury_type",
    "label": "Type of Injury",
    "label_es": "Tipo de Lesion",
    "type": "select",
    "required": true,
    "options": ["Cut", "Burn", "Slip/Fall", "Strain", "Fracture", "Chemical", "Other"],
    "section": "Incident Details",
    "ai_hint": "Classify the type of injury from the description",
    "order": 12
  },
  {
    "key": "section_immediate_response",
    "label": "Immediate Response",
    "label_es": "Respuesta Inmediata",
    "type": "header",
    "required": false,
    "order": 13
  },
  {
    "key": "first_aid",
    "label": "First Aid Administered",
    "label_es": "Primeros Auxilios Administrados",
    "type": "textarea",
    "required": false,
    "placeholder": "Describe any first aid given...",
    "section": "Immediate Response",
    "ai_hint": "Document any first aid or immediate treatment described",
    "order": 14
  },
  {
    "key": "called_911",
    "label": "911 Called",
    "label_es": "Se Llamo al 911",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "section": "Immediate Response",
    "ai_hint": "Determine if 911 was called from the description",
    "order": 15
  },
  {
    "key": "transported_to_hospital",
    "label": "Transported to Hospital",
    "label_es": "Transportado al Hospital",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "section": "Immediate Response",
    "ai_hint": "Determine if the employee was taken to a hospital",
    "order": 16
  },
  {
    "key": "hospital_contact",
    "label": "Hospital / Medical Facility",
    "label_es": "Hospital / Centro Medico",
    "type": "contact_lookup",
    "required": false,
    "section": "Immediate Response",
    "hint": "Search for a hospital or medical facility",
    "ai_hint": "Use search_contacts with category 'medical' to find the nearest hospital. Pre-fill this field.",
    "condition": {
      "field": "transported_to_hospital",
      "operator": "eq",
      "value": "Yes"
    },
    "validation": {
      "contact_category": "medical"
    },
    "order": 17
  },
  {
    "key": "regional_manager_notified",
    "label": "Regional Manager Notified",
    "label_es": "Gerente Regional Notificado",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "section": "Immediate Response",
    "ai_hint": "Determine if the regional manager was notified",
    "order": 18
  },
  {
    "key": "regional_manager_contact",
    "label": "Regional Manager Contact",
    "label_es": "Contacto del Gerente Regional",
    "type": "contact_lookup",
    "required": false,
    "section": "Immediate Response",
    "hint": "Search for the regional manager",
    "ai_hint": "Use search_contacts with category 'management' to find the regional manager. Pre-fill this field.",
    "condition": {
      "field": "regional_manager_notified",
      "operator": "eq",
      "value": "Yes"
    },
    "validation": {
      "contact_category": "management"
    },
    "order": 19
  },
  {
    "key": "section_witnesses",
    "label": "Witnesses",
    "label_es": "Testigos",
    "type": "header",
    "required": false,
    "order": 20
  },
  {
    "key": "witnesses_present",
    "label": "Witnesses Present",
    "label_es": "Testigos Presentes",
    "type": "radio",
    "required": true,
    "options": ["Yes", "No"],
    "section": "Witnesses",
    "ai_hint": "Determine if any witnesses were present from the description",
    "order": 21
  },
  {
    "key": "witness_statements",
    "label": "Witness Names & Statements",
    "label_es": "Nombres y Declaraciones de Testigos",
    "type": "textarea",
    "required": false,
    "placeholder": "List witness names and their account of what happened...",
    "section": "Witnesses",
    "ai_hint": "Extract any witness names and statements mentioned",
    "condition": {
      "field": "witnesses_present",
      "operator": "eq",
      "value": "Yes"
    },
    "order": 22
  },
  {
    "key": "section_root_cause",
    "label": "Root Cause",
    "label_es": "Causa Raiz",
    "type": "header",
    "required": false,
    "order": 23
  },
  {
    "key": "injury_cause",
    "label": "What Caused the Injury",
    "label_es": "Que Causo la Lesion",
    "type": "textarea",
    "required": true,
    "placeholder": "Describe the root cause...",
    "section": "Root Cause",
    "ai_hint": "Analyze the incident and identify the root cause. Be specific: equipment malfunction, wet floor, improper technique, etc.",
    "order": 24
  },
  {
    "key": "preventable",
    "label": "Could It Have Been Prevented",
    "label_es": "Se Pudo Haber Prevenido",
    "type": "radio",
    "required": false,
    "options": ["Yes", "No", "Unsure"],
    "section": "Root Cause",
    "ai_hint": "Assess based on the root cause whether this was preventable",
    "order": 25
  },
  {
    "key": "corrective_action_taken",
    "label": "Corrective Action Taken",
    "label_es": "Accion Correctiva Tomada",
    "type": "textarea",
    "required": false,
    "placeholder": "What steps were taken to prevent this from happening again?",
    "section": "Root Cause",
    "ai_hint": "Document any corrective actions mentioned, or suggest appropriate ones based on the root cause",
    "order": 26
  },
  {
    "key": "section_attachments",
    "label": "Attachments",
    "label_es": "Adjuntos",
    "type": "header",
    "required": false,
    "order": 27
  },
  {
    "key": "injury_photos",
    "label": "Photos of Scene/Injury",
    "label_es": "Fotos de la Escena/Lesion",
    "type": "image",
    "required": false,
    "section": "Attachments",
    "hint": "Take photos of the injury and/or the scene where it occurred",
    "order": 28
  },
  {
    "key": "supporting_documents",
    "label": "Supporting Documents",
    "label_es": "Documentos de Soporte",
    "type": "file",
    "required": false,
    "section": "Attachments",
    "order": 29
  },
  {
    "key": "section_signatures",
    "label": "Signatures",
    "label_es": "Firmas",
    "type": "header",
    "required": false,
    "order": 30
  },
  {
    "key": "injured_employee_signature",
    "label": "Injured Employee Signature",
    "label_es": "Firma del Empleado Lesionado",
    "type": "signature",
    "required": false,
    "section": "Signatures",
    "hint": "If the employee is able to sign",
    "order": 31
  },
  {
    "key": "manager_signature",
    "label": "Manager on Duty Signature",
    "label_es": "Firma del Gerente en Turno",
    "type": "signature",
    "required": true,
    "section": "Signatures",
    "order": 32
  },
  {
    "key": "date_signed",
    "label": "Date Signed",
    "label_es": "Fecha de Firma",
    "type": "date",
    "required": true,
    "section": "Signatures",
    "ai_hint": "Default to today's date",
    "order": 33
  }
]
```

**`instructions_en` for Employee Injury Report:**

```
1. Record the injured employee's information (name, position, department).
2. Document exactly what happened -- when, where, how. Be specific and factual.
3. Identify the type of injury and body parts affected from the description.
4. CRITICAL -- Use the "Search Contacts" tool to look up:
   - The nearest hospital or urgent care facility (category: "medical")
   - The regional manager's contact information (category: "management")
   - Pre-fill the Hospital and Regional Manager fields with this data.
5. Note any first aid or immediate actions taken.
6. Record witness information if anyone saw what happened.
7. Assess root cause -- what led to the injury and if it could be prevented.
8. Use "Search Manual" to reference the emergency procedures section for compliance.
```

#### How the `condition` Property Works

The `condition` property controls **conditional field visibility**. When present on a field definition, that field is hidden by default and only rendered when the referenced field's current value satisfies the condition.

**Schema:**

```json
{
  "condition": {
    "field": "transported_to_hospital",
    "operator": "eq",
    "value": "Yes"
  }
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string` | The `key` of another field in the same form whose value is evaluated |
| `operator` | `string` | Comparison operator |
| `value` | `string \| string[] \| null` | The value to compare against |

**Supported operators:**

| Operator | Semantics | `value` type | Example |
|----------|-----------|-------------|---------|
| `eq` | Field value equals `value` | `string` | `{"operator": "eq", "value": "Yes"}` -- show when field = "Yes" |
| `neq` | Field value does not equal `value` | `string` | `{"operator": "neq", "value": "No"}` -- show when field is not "No" |
| `in` | Field value is one of the values in the array | `string[]` | `{"operator": "in", "value": ["Cut", "Burn"]}` -- show for Cut or Burn |
| `not_empty` | Field has any non-empty value | `null` | `{"operator": "not_empty", "value": null}` -- show when filled |

**Frontend evaluation (pseudocode):**

```typescript
function isFieldVisible(field: FormFieldDefinition, currentValues: Record<string, unknown>): boolean {
  if (!field.condition) return true;

  const { field: depKey, operator, value } = field.condition;
  const depValue = currentValues[depKey];

  switch (operator) {
    case 'eq':   return depValue === value;
    case 'neq':  return depValue !== value;
    case 'in':   return Array.isArray(value) && value.includes(depValue as string);
    case 'not_empty': return depValue != null && depValue !== '';
    default: return true;
  }
}
```

**Conditional fields in the Injury Report:**

| Conditional Field | Depends On | Condition | Behavior |
|-------------------|-----------|-----------|----------|
| `hospital_contact` | `transported_to_hospital` | `eq "Yes"` | Hidden until user confirms hospital transport. AI uses `search_contacts(category: 'medical')` to pre-fill. |
| `regional_manager_contact` | `regional_manager_notified` | `eq "Yes"` | Hidden until user confirms notification. AI uses `search_contacts(category: 'management')` to pre-fill. |
| `witness_statements` | `witnesses_present` | `eq "Yes"` | Hidden until user confirms witnesses were present. Prevents cluttering the form with an empty textarea. |

**AI behavior with conditions:**
The AI receives the condition definitions in its system prompt. When filling the form, the AI evaluates conditions against the values it has already extracted:
- If the user says "John was taken to Methodist Hospital," the AI sets `transported_to_hospital = "Yes"`, which activates the `hospital_contact` condition. The AI then calls `search_contacts` to find Methodist Hospital and pre-fills the field.
- If the user does not mention hospital transport, the AI leaves `transported_to_hospital = "No"` and skips the `hospital_contact` field entirely.

---

### 7. Migration Dependency Order

Migrations are applied sequentially by filename sort order. The dependencies between them are:

```
20260223200000_create_form_templates.sql
    Creates: form_templates table, FTS trigger, indexes, RLS
    Depends on: groups table (exists from initial migration)
    Depended on by: migrations 1, 4, 6
         |
         v
20260223200001_create_form_submissions.sql
    Creates: form_submissions table, indexes, RLS
    Depends on: form_templates table (FK template_id)
    Depends on: groups table (FK group_id)
    Depends on: auth.users (FK filled_by, submitted_by)
         |
         v
20260223200002_create_contacts.sql
    Creates: contacts table, FTS trigger, indexes, RLS
    Depends on: groups table (FK group_id)
    Independent of: form_templates, form_submissions
         |
         v
20260223200003_create_form_attachments_bucket.sql
    Creates: storage bucket, storage RLS policies
    Depends on: nothing (storage.buckets is a system table)
    Independent of: all data tables
         |
         v
20260223200004_seed_form_templates.sql
    Inserts: 2 published form templates
    Depends on: form_templates table (migration 0)
    Depends on: groups table (looks up 'alamo-prime' group)
         |
         v
20260223200005_seed_contacts.sql
    Inserts: 12 demo contacts
    Depends on: contacts table (migration 2)
    Depends on: groups table (looks up 'alamo-prime' group)
         |
         v
20260223200006_create_search_forms.sql
    Creates: search_forms() function
    Depends on: form_templates table (migration 0)
    Requires: search_vector column and GIN index to exist
         |
         v
20260223200007_create_search_contacts.sql
    Creates: search_contacts() function
    Depends on: contacts table (migration 2)
    Requires: search_vector column and GIN index to exist
```

**Why this specific order:**

1. **Tables before seeds:** Seeds INSERT into tables that must exist.
2. **`form_templates` before `form_submissions`:** The submissions table has `REFERENCES form_templates(id)`.
3. **`contacts` after `form_submissions`:** No dependency between them, but sequential ordering keeps the "table creation" phase together.
4. **Storage bucket after tables:** Independent but logically grouped after data tables.
5. **Seeds after all tables:** Seeds may cross-reference (e.g., a seed contact could reference a template, though they do not currently).
6. **Search functions last:** They depend on the tables and indexes being fully created. Placing them last ensures the GIN indexes and tsvector columns exist.

**Parallelization note:** Migrations 0 (form_templates) and 2 (contacts) are technically independent and could run in parallel. Migration 3 (storage) is independent of all data tables. However, Supabase migrations run sequentially by filename sort order, so true parallelism is not possible at the migration level. The sequential ordering is the correct approach.

---

## Architecture & Integration Plan

### 1. System Architecture Impact

The form builder introduces three new data domains (`form_templates`, `form_submissions`, `contacts`) and one new storage bucket (`form-attachments`) into an architecture that currently has five product tables, a manual sections table, a training system, and a unified AI layer (prompts, sessions, messages).

The new tables follow the same ownership model as existing product tables: every row is scoped to a `group_id`, every write operation requires authentication, and admin-only operations use the existing `has_role(auth.uid(), 'admin')` helper.

#### Data Flow Diagram

```
========================================================================
  DIRECT FORM FILLING (Entry Point 1: /forms/:slug)
========================================================================

  User
    |
    v
  /forms  (grid of FormCards)
    |
    v
  /forms/:slug  (FormDetail page)
    |
    +--[ manual fill ]---> field inputs ----+
    |                                       |
    +--[ AI Fill button ]                   |
         |                                  |
         v                                  |
    AI Panel (text / voice / image / file)  |
         |                                  |
         v                                  |
    POST /functions/v1/ask-form             |
         |                                  |
         +--- OpenAI gpt-4o-mini            |
         |     tool-use loop (max 3):       |
         |       search_contacts() RPC      |
         |       search_manual()   RPC      |
         |       search_products() RPC      |
         |       get_form_instructions()    |
         |                                  |
         v                                  |
    { fieldUpdates, missingFields,          |
      followUpQuestion, toolResults }       |
         |                                  |
         +-------> apply to form state <----+
                        |
                        v
               [Save Draft]  or  [Submit Form]
                        |
                        v
              INSERT/UPDATE form_submissions
              (field_values JSONB, status)
                        |
                        v
              Supabase DB (form_submissions)


========================================================================
  AI CHAT ROUTING (Entry Point 2: /ask)
========================================================================

  User opens /ask
    |
    v
  "I need to fill out an injury report.
   John cut his hand at 3pm."
    |
    v
  POST /functions/v1/ask
    |
    v
  OpenAI detects form-fill intent
    |
    v
  Calls search_forms(query) tool  -----> search_forms() RPC
    |                                      |
    v                                      v
  Returns form matches             form_templates (FTS)
    |
    v
  { mode: "form_navigation",
    forms: [{ slug, title, icon }],
    extractedContext: "John, hand cut, 3pm" }
    |
    v
  Frontend renders FormNavigationCard
    |
    v
  User confirms --> navigate to /forms/:slug
    |                   with extractedContext
    v
  FormDetail auto-opens AI Panel
    |
    v
  AI Panel sends extractedContext as first message
    |
    v
  (continues as Entry Point 1 above)


========================================================================
  STORAGE FLOW (Signatures & Photos)
========================================================================

  User taps [Sign] or [Add Photo]
    |
    v
  Canvas draw (signature)  OR  Native file picker (photo)
    |                            |
    v                            v
  getTrimmedCanvas()         browser-image-compression
  toDataURL('image/png')     { maxSizeMB: 1, webp }
    |                            |
    +------- compressed blob ----+
                  |
                  v
          supabase.storage
            .from('form-attachments')
            .upload(path, blob)
                  |
                  v
          Bucket: form-attachments/{type}/{submissionId}/{fieldKey}/{uuid}.{ext}
                  |
                  v
          Public URL returned
                  |
                  v
          Stored in field_values JSONB:
          {
            "employee_signature": {
              "url": "https://...storage.../signatures/abc.png",
              "signed_at": "2026-02-23T15:45:00Z",
              "signed_by": "user-uuid"
            },
            "injury_photos": [
              { "url": "https://...storage.../photos/img1.webp", "uploaded_at": "..." }
            ]
          }
```

---

### 2. JSONB Schema Design Decisions

#### Why JSONB `fields` array in `form_templates` (not a `form_fields` table)

The core question: should each field definition be a row in a relational `form_fields` table, or should the entire field list live as a JSONB array on the template row?

**Decision: JSONB array. Rationale:**

| Criterion | Relational `form_fields` table | JSONB `fields` array on template |
|-----------|-------------------------------|----------------------------------|
| **Read pattern** | JOIN to load fields every time a form renders; N+1 risk | Single row fetch returns the entire form definition |
| **Write pattern** | Multiple INSERT/UPDATE/DELETE per save; ordering requires `sort_order` column maintenance | Single UPDATE of one JSONB column; array order IS display order |
| **Drag-and-drop reorder** | Must update `sort_order` on every row; race conditions in concurrent edits | Replace entire array atomically; no ordering inconsistencies |
| **Schema evolution** | ALTER TABLE for every new field attribute (`ai_hint`, `condition`, `label_es`) | Add a key to the JSON object; no migration needed |
| **Template versioning (Phase 7)** | Must snapshot the entire `form_fields` table or use temporal tables | Snapshot the JSONB column value; trivial |
| **Query need** | Would allow `SELECT * FROM form_fields WHERE type = 'signature'` | Rarely needed; `jsonb_array_elements` handles ad-hoc queries |
| **Indexing** | Standard B-tree indexes on columns | GIN index on `fields` if needed (unlikely for template definitions) |

The operational pattern is overwhelmingly "load the entire form structure as a unit." There is no use case for querying individual field definitions across templates. The JSONB array is the natural fit.

**Validation strategy:** Field schema validation happens in the frontend (TypeScript interfaces) and in the `/ask-form` edge function (which reads and parses the fields). PostgreSQL CHECK constraints on the JSONB structure are intentionally omitted because they are brittle and hard to evolve. The `fields` column has a `NOT NULL DEFAULT '[]'` constraint to ensure it is always a valid JSON array.

#### Why JSONB `field_values` in `form_submissions` (not EAV)

The alternative is an Entity-Attribute-Value pattern: `(submission_id, field_key, field_value)`.

**Decision: JSONB object. Rationale:**

| Criterion | EAV table | JSONB `field_values` |
|-----------|-----------|---------------------|
| **Read pattern** | Pivot query to reconstruct a submission; complex and slow | Single row fetch returns all values |
| **Write pattern** | One INSERT per field per save; 20-30 rows per submission | Single UPDATE of one JSONB column |
| **Partial save (draft)** | Must upsert each field individually | Merge partial JSONB: `field_values \|\| new_values` |
| **AI fill** | Edge function must insert N rows per AI response | Edge function returns a JSONB object; direct merge |
| **Storage efficiency** | Row overhead per field (UUID PK, FK, timestamps) | Compact single JSONB document |
| **Reporting queries** | `WHERE field_key = 'employee_name' AND field_value = 'John'` is natural | `WHERE field_values->>'employee_name' = 'John'` requires GIN index or sequential scan |

The trade-off is that JSONB is harder to query for ad-hoc reporting ("find all submissions where severity = 'Termination'"). However:

1. This is a Phase 7+ concern (reporting/analytics), not Phase 1.
2. When needed, a GIN index on `field_values` enables `@>` containment queries: `WHERE field_values @> '{"severity": "Termination"}'::jsonb`.
3. For heavy reporting, a materialized view or a scheduled denormalization job can extract specific fields into columns.
4. The primary access pattern (render a filled form, export a PDF) is always "load the entire submission."

**Querying JSONB efficiently when needed:**

```sql
-- Find submissions where employee_name contains "John" (text search)
SELECT * FROM form_submissions
WHERE field_values->>'employee_name' ILIKE '%John%';

-- Find submissions where severity is exactly "Termination" (containment, uses GIN)
SELECT * FROM form_submissions
WHERE field_values @> '{"severity": "Termination"}'::jsonb;

-- Find submissions where a nested array contains a value
SELECT * FROM form_submissions
WHERE field_values->'body_parts' ? 'Hand';

-- Aggregate: count submissions by violation type for a template
SELECT field_values->>'type_of_violation' AS violation_type, COUNT(*)
FROM form_submissions
WHERE template_id = 'uuid'
GROUP BY 1;
```

A GIN index on `field_values` (deferred to Phase 7 per the Database Deep Dive analysis) will make the containment operator (`@>`) efficient when reporting features are built.

---

### 3. Integration Points with Existing System

#### 3.1 `groups` table FK relationship

Both `form_templates` and `form_submissions` carry a `group_id UUID NOT NULL REFERENCES groups(id)`. This follows the exact pattern used by product tables (`foh_plate_specs`, `wines`, etc.) and `chat_sessions`. The `contacts` table also carries a `group_id` FK.

Currently there is one group (`Alamo Prime`, slug `alamo-prime`). All seed data will reference this group. The FK ensures that templates, submissions, and contacts cannot exist without a valid group.

#### 3.2 `auth.users` FK relationships

- `form_templates.created_by` -> `auth.users(id)`: Tracks which admin created the template. Uses a soft reference (no `ON DELETE CASCADE`) because templates should persist even if the admin account is deleted.
- `form_submissions.filled_by` -> `auth.users(id)`: The user who filled the form (or initiated AI fill).
- `form_submissions.submitted_by` -> `auth.users(id)`: The user who submitted. May differ from `filled_by` if a manager submits on behalf of someone.

Note: Existing product tables do NOT have `created_by` columns, but form templates are a user-created content type (unlike seeded product data), so the audit trail matters.

#### 3.3 `ai_prompts` table -- new entries needed

The `ai_prompts` table currently stores prompts with categories (`system`, `domain`, `action`, `voice`) and domains (`manual`, `recipes`, `dishes`, `wines`, `cocktails`, `beer_liquor`).

**For Phase 1 (DB only), no new `ai_prompts` rows are needed.** However, the schema constraints must be updated to accommodate form-related prompts in Phase 3:

- The `ai_prompts.domain` CHECK constraint must be expanded to include `'forms'`.
- New prompts will be needed:
  - `domain-forms` (category: `domain`): Context prompt for the form-filling AI.
  - `action-forms-fill` (category: `action`): System prompt for AI field extraction.
  - `action-forms-instructions` (category: `action`): Prompt template for reading form instructions.

**Phase 1 decision:** We do NOT alter the `ai_prompts` domain constraint in Phase 1. That is a Phase 3 migration when the `/ask-form` edge function is built. Phase 1 focuses purely on the data tables, search functions, and storage bucket.

#### 3.4 `chat_sessions` / `chat_messages` -- form AI sessions

The `chat_sessions.context_type` CHECK constraint currently allows: `manual`, `recipes`, `dishes`, `wines`, `cocktails`, `beer_liquor`.

Form AI conversations should use the same session infrastructure. This means:

- **Phase 3 migration:** Add `'forms'` to the `context_type` CHECK constraint.
- `context_id` will store the `form_templates.id` UUID (the template being filled).
- The `get_or_create_chat_session` function works as-is once the constraint is relaxed.
- `form_submissions.ai_session_id` stores the `chat_sessions.id` to link a submission to its AI conversation.

**Phase 1 decision:** No changes to `chat_sessions` or `chat_messages` in Phase 1. The `form_submissions.ai_session_id` column is typed as `TEXT` (not a FK) to allow it to be populated in Phase 3 without a circular dependency.

#### 3.5 Existing usage limits (daily/monthly AI counters)

The `/ask-form` edge function (Phase 3) will share the same `usage_counters` table and `get_user_usage` / `increment_usage` RPCs. Form AI questions count against the same daily and monthly limits as manual and product questions.

**Phase 1 decision:** No changes to usage infrastructure. The counters are domain-agnostic by design.

#### 3.6 `search_forms` and `search_contacts` in the `/ask` tool-use loop

The `/ask` edge function currently has tools: `search_manual`, `search_dishes`, `search_wines`, `search_cocktails`, `search_recipes`, `search_beer_liquor`.

**Phase 4** will add `search_forms` as a new tool in the `/ask` function's `SEARCH_TOOLS` array. The tool definition will follow the exact same pattern:

```jsonc
{
  "type": "function",
  "function": {
    "name": "search_forms",
    "description": "Search available form templates by name or purpose. Use when the user wants to fill out a form, file a report, or document an incident.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Search terms about the form type" }
      },
      "required": ["query"]
    }
  }
}
```

The `search_contacts` tool will be available only within `/ask-form` (not in the general `/ask`) because contact lookups are form-filling-specific.

**Phase 1 deliverable:** The `search_forms()` and `search_contacts()` PostgreSQL functions are created and callable via `supabase.rpc()`. The edge functions that call them come in Phase 3 and 4.

---

### 4. Security Architecture

#### 4.1 RLS Strategy

All three new tables follow the same RLS pattern as existing tables, using the `has_role(auth.uid(), 'admin')` helper function.

**`form_templates`:**

| Operation | Who | Policy logic |
|-----------|-----|-------------|
| SELECT | All authenticated users | `true` (templates are reference data; status filtering is application-level) |
| INSERT | Admin only | `has_role(auth.uid(), 'admin')` |
| UPDATE | Admin only | `has_role(auth.uid(), 'admin')` |
| DELETE | Admin only | `has_role(auth.uid(), 'admin')` |

Note: The SELECT policy allows all authenticated users to see all templates (including drafts). The application layer filters by `status = 'published'` for non-admin users. This mirrors how `ai_prompts` uses `is_active = true` in its SELECT policy. An alternative (status-based RLS) would require two SELECT policies, which adds complexity. The search function already hardcodes `status = 'published'`, so unpublished templates never appear in search results.

**`form_submissions`:**

| Operation | Who | Policy logic |
|-----------|-----|-------------|
| SELECT own | Authenticated user | `filled_by = auth.uid()` |
| SELECT all | Admin | `has_role(auth.uid(), 'admin')` |
| INSERT | Authenticated user | `true` (any authenticated user) |
| UPDATE own | Authenticated user | `filled_by = auth.uid()` |
| UPDATE all | Admin | `has_role(auth.uid(), 'admin')` |
| DELETE | Admin only | `has_role(auth.uid(), 'admin')` |

Submissions are the most sensitive table. Regular users can only see and edit their own submissions. Admins can see all submissions (for audit, reporting, and review). PostgreSQL merges multiple policies for the same operation with OR logic, so having two SELECT policies is correct.

**`contacts`:**

| Operation | Who | Policy logic |
|-----------|-----|-------------|
| SELECT | All authenticated users | `true` (contacts are reference data) |
| INSERT | Admin only | `has_role(auth.uid(), 'admin')` |
| UPDATE | Admin only | `has_role(auth.uid(), 'admin')` |
| DELETE | Admin only | `has_role(auth.uid(), 'admin')` |

Contacts are read-accessible to everyone (they need to look up hospital phone numbers) but only admin-writable.

#### 4.2 Storage Bucket Policies

The `form-attachments` bucket is **public** (objects have public URLs once uploaded). This matches the existing `product-assets` bucket pattern.

| Operation | Who | Policy logic |
|-----------|-----|-------------|
| SELECT (read) | Authenticated | `bucket_id = 'form-attachments'` |
| INSERT (upload) | Authenticated | `bucket_id = 'form-attachments'` |
| UPDATE | Own uploads only | `bucket_id = 'form-attachments' AND owner = auth.uid()` |
| DELETE | Admin only | `bucket_id = 'form-attachments'` AND admin check |

**Why public?** Signatures and photos are embedded in forms that are viewed by multiple people (the employee, the manager, HR). Signed URLs add complexity and would expire, breaking saved/exported forms. The security boundary is at the RLS level on `form_submissions` -- you can only discover the URLs if you can see the submission row (and its `field_values` JSONB containing the URLs).

**Path convention:** `{type}/{submission_id}/{field_key}/{uuid}.{ext}`
- Example: `signatures/abc-def-123/employee_signature/f47ac10b.png`
- Example: `photos/abc-def-123/injury_photos/550e8400.webp`

The `submission_id` in the path provides natural namespacing. The `uuid` filename prevents collisions and is not guessable.

#### 4.3 Edge Function Auth

The `/ask-form` edge function (Phase 3) will follow the exact same auth pattern as `/ask-product`:

1. `verify_jwt: false` in the function config (the new publishable key format `sb_publishable_...` can cause gateway JWT validation to fail).
2. Manual auth via `getClaims(token)` on the `Authorization: Bearer <token>` header.
3. Service role client for database operations (bypasses RLS for search functions).
4. User identity extracted from claims for `filled_by` attribution.

#### 4.4 Search Function Security

Both `search_forms()` and `search_contacts()` follow the existing pattern:

- `SECURITY DEFINER`: Executes with the function owner's privileges (bypasses RLS for search queries).
- `SET search_path = 'public'`: Prevents search_path hijacking (addresses the Supabase security advisory).
- Status filter: `status = 'published'` (forms) / `status = 'active'` (contacts) hardcoded in the function body, ensuring unpublished/inactive records never appear in search results regardless of caller.

---

### 5. Scalability Considerations

#### 5.1 JSONB Indexing Strategy

**Phase 1 indexes (created now):**

| Table | Column | Index Type | Purpose |
|-------|--------|-----------|---------|
| `form_templates` | `search_vector` | GIN | FTS on title + description |
| `form_templates` | `embedding` | HNSW (vector_cosine_ops) | Future hybrid search (Phase 7) |
| `contacts` | `search_vector` | GIN | FTS on name + category + notes |
| `contacts` | `embedding` | HNSW (vector_cosine_ops) | Future hybrid search (Phase 7) |

**Deferred to Phase 7** (per Database Deep Dive Section 3.2):

| Table | Column | Index Type | Purpose |
|-------|--------|-----------|---------|
| `form_submissions` | `field_values` | GIN (`jsonb_path_ops`) | Reporting queries (`@>` containment) |

The GIN index on `field_values` is deferred because no Phase 1-6 query uses it. At the expected 200 submissions/month, sequential scans on indexed `template_id` are sufficient. When reporting features arrive (Phase 7), the index will be added with the more efficient `jsonb_path_ops` operator class.

**Indexes NOT created in Phase 1:**
- No partial/expression indexes on `field_values` (e.g., `(field_values->>'status')`) -- premature; wait for actual query patterns.
- No trigram indexes on `contacts.name` -- standard FTS covers the search need.

Note: Per the Database Deep Dive (Section 3.2), the GIN index on `field_values` is **deferred to Phase 7**. The `form_submissions` DDL in the backend implementation section below does NOT include it.

#### 5.2 Expected Data Volume

| Entity | Expected volume (per group, first 12 months) | Row size estimate |
|--------|----------------------------------------------|-------------------|
| Form templates | 5-20 templates | ~2-10 KB each (fields JSONB) |
| Form submissions | 50-200 per month (~600-2400/year) | ~1-5 KB each (field_values JSONB) |
| Contacts | 20-50 records | ~0.5-1 KB each |
| Storage objects (signatures) | 1-2 per submission (~100-400/month) | ~5-20 KB each |
| Storage objects (photos) | 0-3 per submission (~0-600/month) | ~200 KB-1 MB each (compressed) |

At this scale, PostgreSQL handles everything trivially. The indexing strategy is designed for 10x growth without changes.

**Storage bucket sizing:**
- Signatures: ~200 per month x 20 KB = ~4 MB/month
- Photos: ~200 per month x 500 KB = ~100 MB/month
- Annual projection: ~1.2 GB total
- Supabase free tier: 1 GB storage; Pro: 100 GB. Photo compression to WebP (maxSizeMB: 1) keeps this well within limits.

#### 5.3 Query Performance Notes

- Template listing (`SELECT * FROM form_templates WHERE group_id = ? AND status = 'published' ORDER BY sort_order`): Hits at most 20 rows. No performance concern.
- Submission listing (admin view): `SELECT * FROM form_submissions WHERE template_id = ? ORDER BY created_at DESC LIMIT 20`. The composite index on `(template_id)` plus the `created_at` column is sufficient. A composite index `(template_id, created_at DESC)` can be added in Phase 7 if needed.
- Search functions: FTS-only in Phase 1, same RRF hybrid pattern as product search in Phase 7. The FTS approach scales to thousands of templates.

---

### 6. Phase Boundaries & Contracts

Phase 1 produces the database layer. Phase 2 (frontend) and Phase 3 (AI edge function) build on top of it. This section defines the exact contracts.

#### 6.1 TypeScript Interfaces (Phase 2 will import these)

These interfaces represent the shape of data returned by Supabase queries. They should be defined in a shared types file (e.g., `src/types/forms.ts`).

```typescript
// =============================================================================
// form_templates row shape
// =============================================================================

interface FormFieldDefinition {
  key: string;                    // Unique within the form
  label: string;                  // Display label (EN)
  label_es?: string;              // Display label (ES)
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  section?: string;               // Visual grouping header
  hint?: string;                  // User-facing help text
  ai_hint?: string;               // AI-specific extraction instruction
  options?: string[];             // For select/radio/checkbox
  validation?: Record<string, unknown>;
  default?: unknown;
  order: number;
  condition?: {                   // Conditional visibility
    field: string;                // Key of the controlling field
    operator: 'eq' | 'neq' | 'in' | 'exists';
    value: unknown;
  };
}

type FormFieldType =
  | 'text' | 'textarea' | 'date' | 'time' | 'datetime'
  | 'select' | 'radio' | 'checkbox' | 'number'
  | 'phone' | 'email'
  | 'signature' | 'image' | 'file'
  | 'header' | 'instructions'
  | 'contact_lookup';

type FormTemplateStatus = 'draft' | 'published' | 'archived';

interface FormTemplate {
  id: string;
  group_id: string;
  slug: string;
  title_en: string;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
  icon: string;
  header_image: string | null;
  fields: FormFieldDefinition[];
  instructions_en: string | null;
  instructions_es: string | null;
  ai_tools: string[];
  status: FormTemplateStatus;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// form_submissions row shape
// =============================================================================

type FormSubmissionStatus = 'draft' | 'completed' | 'submitted' | 'archived';

interface FormSubmission {
  id: string;
  template_id: string;
  group_id: string;
  field_values: Record<string, unknown>;  // { "employee_name": "John", ... }
  status: FormSubmissionStatus;
  filled_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  attachments: FormAttachment[];
  ai_session_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FormAttachment {
  type: 'signature' | 'photo' | 'file';
  url: string;
  field_key: string;
  caption?: string;
  uploaded_at: string;
}

// =============================================================================
// contacts row shape
// =============================================================================

type ContactCategory = 'emergency' | 'medical' | 'management' | 'vendor' | 'government';

interface Contact {
  id: string;
  group_id: string;
  category: string;               // ContactCategory at app level, TEXT in DB
  subcategory: string | null;
  name: string;
  contact_person: string | null;
  phone: string | null;
  phone_alt: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_priority: boolean;
  sort_order: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Search function return shapes (what supabase.rpc() returns)
// =============================================================================

interface FormSearchResult {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  score: number;
}

interface ContactSearchResult {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  phone: string | null;
  contact_person: string | null;
  address: string | null;
  score: number;
}

// =============================================================================
// /ask-form edge function request/response (Phase 3 contract)
// =============================================================================

interface AskFormRequest {
  question: string;
  templateId: string;
  currentValues: Record<string, unknown>;
  language: 'en' | 'es';
  groupId: string;
  attachments?: { type: string; url: string }[];
}

interface AskFormResponse {
  fieldUpdates: Record<string, unknown>;
  missingFields: string[];
  followUpQuestion: string | null;
  toolResults: Record<string, unknown>;
  citations: { id: string; name: string; source: string }[];
  usage: { daily: { used: number; limit: number }; monthly: { used: number; limit: number } };
}
```

#### 6.2 RPC Function Signatures

**`search_forms`**

```
Function:  search_forms(
  search_query    TEXT,
  search_language TEXT      DEFAULT 'en',
  match_count     INT       DEFAULT 5,
  p_group_id      UUID      DEFAULT NULL
)

Returns:   TABLE (id UUID, slug TEXT, title TEXT, description TEXT, icon TEXT, score FLOAT)

Notes:
  - FTS-only in Phase 1 (no query_embedding parameter)
  - Searches title_en, title_es, description_en, description_es via search_vector
  - Filters: status = 'published'
  - Optional group_id filter (NULL = all groups)
  - Language-aware: uses 'spanish' regconfig when search_language = 'es'
  - SECURITY DEFINER, search_path = 'public'
  - Returns title in the requested language (falls back to EN)
```

**`search_contacts`**

```
Function:  search_contacts(
  search_query  TEXT,
  match_count   INT       DEFAULT 5,
  p_group_id    UUID      DEFAULT NULL,
  p_category    TEXT      DEFAULT NULL
)

Returns:   TABLE (id UUID, name TEXT, category TEXT, subcategory TEXT, phone TEXT,
                  contact_person TEXT, address TEXT, score FLOAT)

Notes:
  - FTS-only in Phase 1
  - Searches name, category, subcategory, contact_person, notes via search_vector
  - Filters: status = 'active'
  - Optional group_id and category filters
  - Priority contacts sort first (is_priority DESC, then score DESC)
  - SECURITY DEFINER, search_path = 'public'
```

**Phase 7 upgrade path:** Both functions will gain a `query_embedding vector(1536)` parameter and a vector CTE, converting them to hybrid RRF search (same as existing product search functions). The FTS-only Phase 1 signatures are forward-compatible: adding parameters with defaults is non-breaking.

#### 6.3 Storage Bucket Paths & Naming Convention

```
Bucket:  form-attachments

Path structure:
  {type}/{submission_id}/{field_key}/{uuid}.{ext}

Where:
  type           = "signatures" | "photos" | "files"
  submission_id  = UUID of the form_submissions row (or "draft-{timestamp}" before first save)
  field_key      = The field key from the template (e.g., "employee_signature", "injury_photos")
  uuid           = crypto.randomUUID() generated client-side
  ext            = "png" (signatures), "webp" (photos), original extension (files)

Examples:
  signatures/f47ac10b-58cc-4372-a567-0e02b2c3d479/employee_signature/8a5cc0f1.png
  photos/f47ac10b-58cc-4372-a567-0e02b2c3d479/injury_photos/550e8400.webp
  files/f47ac10b-58cc-4372-a567-0e02b2c3d479/supporting_docs/doc-abc.pdf
```

The path structure enables:
- Listing all attachments for a submission: `storage.from('form-attachments').list('signatures/{submission_id}')`
- Cleanup on submission deletion: delete the entire `{submission_id}/` prefix
- No collisions: UUID filenames are globally unique

#### 6.4 Verification Queries (Phase 1 acceptance criteria)

After all 8 migrations are applied, these queries must succeed:

```sql
-- 1. Templates exist and are published
SELECT id, slug, title_en, status FROM form_templates;
-- Expected: 2 rows (employee-write-up, employee-injury-report), both status = 'published'

-- 2. Contacts exist and are active
SELECT id, name, category, phone FROM contacts WHERE status = 'active';
-- Expected: 12 rows across emergency, medical, management, vendor, government categories

-- 3. FTS search works for forms
SELECT * FROM search_forms('injury');
-- Expected: 1 row (Employee Injury Report)

SELECT * FROM search_forms('write-up');
-- Expected: 1 row (Employee Write-Up)

-- 4. FTS search works for contacts
SELECT * FROM search_contacts('hospital');
-- Expected: 1+ rows with category = 'medical'

SELECT * FROM search_contacts('manager', p_category => 'management');
-- Expected: 1+ rows with category = 'management'

-- 5. RLS: non-admin can read published templates
-- (set role to authenticated user, verify SELECT returns rows)

-- 6. RLS: non-admin cannot insert templates
-- (set role to authenticated non-admin user, verify INSERT fails)

-- 7. RLS: user can create own submission
-- (INSERT into form_submissions with filled_by = own user_id, verify success)

-- 8. RLS: user cannot read other user's submissions
-- (verify SELECT on form_submissions returns only own rows for non-admin)

-- 9. Storage: form-attachments bucket exists
SELECT * FROM storage.buckets WHERE id = 'form-attachments';
-- Expected: 1 row, public = true
```

---
---

## Backend Implementation Plan

---

### 1. Migration Order & Naming

All migrations use the existing `YYYYMMDDHHMMSS_descriptive_name.sql` convention. The timestamp prefix `20260223` matches today's date. Each migration is sequential so later files can reference objects created in earlier ones.

| Order | File Name | Description |
|-------|-----------|-------------|
| 1 | `20260223200000_create_form_templates.sql` | `form_templates` table + FTS trigger + GIN/HNSW indexes + RLS |
| 2 | `20260223200001_create_form_submissions.sql` | `form_submissions` table + `updated_at` trigger + RLS |
| 3 | `20260223200002_create_contacts.sql` | `contacts` table + FTS trigger + GIN/HNSW indexes + RLS |
| 4 | `20260223200003_create_form_attachments_bucket.sql` | Supabase Storage bucket + RLS policies |
| 5 | `20260223200004_seed_form_templates.sql` | 2 published templates (Write-Up + Injury Report) |
| 6 | `20260223200005_seed_contacts.sql` | Demo contacts across 5 categories |
| 7 | `20260223200006_create_search_forms.sql` | `search_forms()` FTS function |
| 8 | `20260223200007_create_search_contacts.sql` | `search_contacts()` FTS function |

Apply order: strictly sequential (1 through 8). Migration 5 depends on table from migration 1. Migration 6 depends on table from migration 3. Migrations 7-8 depend on tables from migrations 1 and 3 respectively.

---

### 2. `form_templates` Table -- Full DDL

**File:** `supabase/migrations/20260223200000_create_form_templates.sql`

```sql
-- =============================================================================
-- MIGRATION: create_form_templates
-- Creates form_templates table + FTS trigger + GIN/HNSW indexes + RLS policies
-- Phase 1 of Form Builder System
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: form_templates
-- ---------------------------------------------------------------------------

CREATE TABLE public.form_templates (
  id               UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES public.groups(id),
  slug             TEXT UNIQUE NOT NULL,
  title_en         TEXT NOT NULL,
  title_es         TEXT,
  description_en   TEXT,
  description_es   TEXT,
  icon             TEXT DEFAULT 'ClipboardList',
  header_image     TEXT,
  fields           JSONB NOT NULL DEFAULT '[]',
  instructions_en  TEXT,
  instructions_es  TEXT,
  ai_tools         TEXT[] DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order       INTEGER DEFAULT 0,
  template_version INTEGER NOT NULL DEFAULT 1,  -- Bumped on publish-edit; submissions record which version
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Search (FTS only; embedding deferred to Phase 7 when form count justifies it)
  search_vector    TSVECTOR
);

-- ---------------------------------------------------------------------------
-- INDEXES: GIN (FTS) + B-tree
-- Note: HNSW vector index deferred to Phase 7 — 2-50 templates don't need
-- semantic search. FTS on title/description is sufficient.
-- ---------------------------------------------------------------------------

CREATE INDEX idx_form_templates_search
  ON public.form_templates USING gin(search_vector);

CREATE INDEX idx_form_templates_group_id
  ON public.form_templates (group_id);

CREATE INDEX idx_form_templates_status
  ON public.form_templates (status);

-- ---------------------------------------------------------------------------
-- FTS TRIGGER FUNCTION
-- Auto-populates search_vector from title + description fields (EN + ES)
-- Weighted: title_en/title_es = A, description_en/description_es = B
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_form_templates_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.title_es, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description_en, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(NEW.description_es, '')), 'B');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_form_templates_search_vector
  BEFORE INSERT OR UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_form_templates_search_vector();

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_form_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_form_templates_updated_at
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_form_templates_updated_at();

-- ---------------------------------------------------------------------------
-- RLS POLICIES (4 policies, group-scoped — matches training_programs pattern)
-- Uses get_user_group_id() + get_user_role() for multi-tenant safety
-- ---------------------------------------------------------------------------

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user in the same group can view published templates
CREATE POLICY "Users can view published form_templates in their group"
  ON public.form_templates FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND status IN ('published', 'archived')
  );

-- SELECT: managers/admins can also see drafts in their group
CREATE POLICY "Managers can view draft form_templates in their group"
  ON public.form_templates FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- INSERT: managers and admins in the same group
CREATE POLICY "Managers can insert form_templates"
  ON public.form_templates FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- UPDATE: managers and admins in the same group
CREATE POLICY "Managers can update form_templates"
  ON public.form_templates FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- DELETE: admin only in the same group
CREATE POLICY "Admins can delete form_templates"
  ON public.form_templates FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );
```

---

### 3. `form_submissions` Table -- Full DDL

**File:** `supabase/migrations/20260223200001_create_form_submissions.sql`

```sql
-- =============================================================================
-- MIGRATION: create_form_submissions
-- Creates form_submissions table + updated_at trigger + RLS policies
-- Phase 1 of Form Builder System
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: form_submissions
-- ---------------------------------------------------------------------------

CREATE TABLE public.form_submissions (
  id               UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  template_id      UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE RESTRICT,
  group_id         UUID NOT NULL REFERENCES public.groups(id),
  template_version INTEGER NOT NULL DEFAULT 1,       -- Which template version was used
  fields_snapshot  JSONB,                            -- Copy of template.fields at submission time
  field_values     JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','submitted','archived')),
  filled_by        UUID NOT NULL REFERENCES public.profiles(id),  -- Who filled it (always known)
  submitted_by     UUID REFERENCES public.profiles(id),           -- Who submitted (null until submitted)
  subject_user_id  UUID REFERENCES public.profiles(id),           -- Who the form is ABOUT (nullable)
  submitted_at     TIMESTAMPTZ,
  attachments      JSONB DEFAULT '[]',
  ai_session_id    TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTE: Templates with submissions cannot be hard-deleted (ON DELETE RESTRICT).
-- Use status='archived' as the soft-delete mechanism instead.

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Simple indexes for FK lookups
CREATE INDEX idx_form_submissions_template_id
  ON public.form_submissions (template_id);

CREATE INDEX idx_form_submissions_group_id
  ON public.form_submissions (group_id);

CREATE INDEX idx_form_submissions_filled_by
  ON public.form_submissions (filled_by);

CREATE INDEX idx_form_submissions_status
  ON public.form_submissions (status);

-- Composite indexes for common query patterns
CREATE INDEX idx_form_submissions_template_date
  ON public.form_submissions (template_id, created_at DESC);  -- Admin: list submissions per form

CREATE INDEX idx_form_submissions_group_date
  ON public.form_submissions (group_id, created_at DESC);     -- Group-level queries

CREATE INDEX idx_form_submissions_user_date
  ON public.form_submissions (filled_by, created_at DESC);    -- User's own submissions

CREATE INDEX idx_form_submissions_subject
  ON public.form_submissions (subject_user_id)
  WHERE subject_user_id IS NOT NULL;                          -- "View my write-ups" queries

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_form_submissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_form_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_form_submissions_updated_at();

-- ---------------------------------------------------------------------------
-- RLS POLICIES
-- form_submissions has more nuanced access than template tables:
--   SELECT: users see own submissions; admins see all
--   INSERT: any authenticated user can create a submission
--   UPDATE: users can update own submissions; admins can update all
--   DELETE: admin only
-- ---------------------------------------------------------------------------

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view submissions they filled
CREATE POLICY "Users can view own form_submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (filled_by = auth.uid());

-- SELECT: Users can view submissions about them (e.g., their own write-ups)
CREATE POLICY "Users can view form_submissions about them"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid());

-- SELECT: Managers/admins can view all submissions in their group
CREATE POLICY "Managers can view group form_submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- INSERT: Any authenticated user in the group can create a submission
CREATE POLICY "Users can insert form_submissions"
  ON public.form_submissions FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND filled_by = auth.uid()
  );

-- UPDATE: Users can update their own draft submissions
CREATE POLICY "Users can update own form_submissions"
  ON public.form_submissions FOR UPDATE TO authenticated
  USING (filled_by = auth.uid())
  WITH CHECK (filled_by = auth.uid());

-- UPDATE: Managers/admins can update any submission in their group
CREATE POLICY "Managers can update group form_submissions"
  ON public.form_submissions FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- DELETE: Admin only in the same group
CREATE POLICY "Admins can delete form_submissions"
  ON public.form_submissions FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );
```

---

### 4. `contacts` Table -- Full DDL

**File:** `supabase/migrations/20260223200002_create_contacts.sql`

```sql
-- =============================================================================
-- MIGRATION: create_contacts
-- Creates contacts table (Who to Call) + FTS trigger + GIN/HNSW indexes + RLS
-- Phase 1 of Form Builder System
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: contacts
-- ---------------------------------------------------------------------------

CREATE TABLE public.contacts (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.groups(id),
  category        TEXT NOT NULL,
  subcategory     TEXT,
  name            TEXT NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  phone_alt       TEXT,
  email           TEXT,
  address         TEXT,
  notes           TEXT,
  is_priority     BOOLEAN NOT NULL DEFAULT false,
  is_demo_data    BOOLEAN NOT NULL DEFAULT false,   -- TRUE for seed data; UI shows warning banner
  sort_order      INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Search (FTS only; embedding deferred to Phase 7 — 10-30 contacts don't need semantic search)
  search_vector   TSVECTOR,
  -- Prevent exact duplicates within same group+category
  UNIQUE (group_id, name, category)
);

-- ---------------------------------------------------------------------------
-- INDEXES: GIN (FTS) + B-tree
-- Note: HNSW vector index deferred to Phase 7 — 10-30 contacts don't need
-- semantic search. FTS on name/category/notes is sufficient.
-- ---------------------------------------------------------------------------

CREATE INDEX idx_contacts_search
  ON public.contacts USING gin(search_vector);

CREATE INDEX idx_contacts_group_id
  ON public.contacts (group_id);

CREATE INDEX idx_contacts_category
  ON public.contacts (category);

CREATE INDEX idx_contacts_status
  ON public.contacts (status);

CREATE INDEX idx_contacts_priority
  ON public.contacts (is_priority)
  WHERE is_priority = true;  -- Partial index for priority contacts

-- ---------------------------------------------------------------------------
-- FTS TRIGGER FUNCTION
-- Auto-populates search_vector from name, category, subcategory,
-- contact_person, notes
-- Weighted: name = A, category + subcategory + contact_person = B, notes = C
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_contacts_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Use 'simple' config for proper nouns (no stemming — "Methodist" stays "methodist")
  -- Use 'english' config for descriptive text in notes (stemming helps)
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.contact_person, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.address, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_search_vector
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_contacts_search_vector();

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_contacts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_contacts_updated_at();

-- ---------------------------------------------------------------------------
-- RLS POLICIES (4 policies: SELECT / INSERT / UPDATE / DELETE)
-- ---------------------------------------------------------------------------

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user in the same group
CREATE POLICY "Users can view contacts in their group"
  ON public.contacts FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

-- INSERT: managers and admins in the same group
CREATE POLICY "Managers can insert contacts"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- UPDATE: managers and admins in the same group
CREATE POLICY "Managers can update contacts"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- DELETE: admin only in the same group
CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );
```

---

### 5. Storage Bucket Migration

**File:** `supabase/migrations/20260223200003_create_form_attachments_bucket.sql`

```sql
-- =============================================================================
-- MIGRATION: create_form_attachments_bucket
-- Creates Supabase Storage bucket for form attachments (signatures, photos,
-- documents) + RLS policies for authenticated access
-- Phase 1 of Form Builder System
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BUCKET: form-attachments (PRIVATE — signatures and injury photos are PII)
-- Use createSignedUrl() for display (1-hour expiry)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-attachments',
  'form-attachments',
  false,                                                          -- PRIVATE: signed URLs required
  10485760,                                                       -- 10 MB max
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']  -- Photos, signatures, PDFs only
);

-- ---------------------------------------------------------------------------
-- RLS: Authenticated users can upload files
-- ---------------------------------------------------------------------------

CREATE POLICY "Authenticated users can upload form attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-attachments');

-- ---------------------------------------------------------------------------
-- RLS: Authenticated users can read files
-- ---------------------------------------------------------------------------

CREATE POLICY "Authenticated users can read form attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'form-attachments');

-- ---------------------------------------------------------------------------
-- RLS: Users can update their own uploaded files
-- ---------------------------------------------------------------------------

CREATE POLICY "Users can update own form attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'form-attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'form-attachments' AND owner = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: Admins can delete any form attachment
-- ---------------------------------------------------------------------------

CREATE POLICY "Admins can delete form attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'form-attachments'
    AND has_role(auth.uid(), 'admin'::user_role)
  );
```

---

### 6. `search_forms()` Function -- Full Implementation

**File:** `supabase/migrations/20260223200006_create_search_forms.sql`

This function is FTS-only for Phase 1. When embeddings are generated in Phase 7, this function will be upgraded to the full RRF hybrid pattern (matching `search_dishes` v2). The function signature already includes `query_embedding` and weight parameters so callers built now will not need to change when hybrid is enabled.

```sql
-- =============================================================================
-- MIGRATION: create_search_forms
-- FTS-only search function for form_templates
-- Pattern: matches existing product search functions
-- Will be upgraded to FTS + vector hybrid (RRF) in Phase 7
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_forms(
  search_query      TEXT,
  search_language   TEXT DEFAULT 'en',
  match_count       INT DEFAULT 5,
  p_group_id        UUID DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  slug        TEXT,
  title       TEXT,
  description TEXT,
  icon        TEXT,
  score       FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query  tsquery;
  ts_config regconfig;
BEGIN
  -- Determine language config
  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
  ELSE
    ts_config := 'english'::regconfig;
  END IF;

  ts_query := plainto_tsquery(ts_config, search_query);

  RETURN QUERY
  SELECT
    ft.id,
    ft.slug,
    CASE
      WHEN search_language = 'es' AND ft.title_es IS NOT NULL AND ft.title_es <> ''
        THEN ft.title_es
      ELSE ft.title_en
    END AS title,
    ts_headline(
      ts_config,
      CASE
        WHEN search_language = 'es' AND ft.description_es IS NOT NULL AND ft.description_es <> ''
          THEN ft.description_es
        ELSE COALESCE(ft.description_en, '')
      END,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ) AS description,
    ft.icon,
    ts_rank(ft.search_vector, ts_query)::FLOAT AS score
  FROM public.form_templates ft
  WHERE ft.search_vector @@ ts_query
    AND ft.status = 'published'
    AND (p_group_id IS NULL OR ft.group_id = p_group_id)
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;
```

---

### 7. `search_contacts()` Function -- Full Implementation

**File:** `supabase/migrations/20260223200007_create_search_contacts.sql`

Same pattern as `search_forms` -- FTS-only for Phase 1, upgradeable to hybrid RRF in Phase 7. Includes optional `p_category` filter for narrowing results to a specific contact category (e.g., `'medical'`, `'management'`).

```sql
-- =============================================================================
-- MIGRATION: create_search_contacts
-- FTS-only search function for contacts table
-- Pattern: matches existing product search functions
-- Will be upgraded to FTS + vector hybrid (RRF) in Phase 7
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_contacts(
  search_query      TEXT,
  match_count       INT DEFAULT 5,
  p_group_id        UUID DEFAULT NULL,
  p_category        TEXT DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  category        TEXT,
  subcategory     TEXT,
  phone           TEXT,
  contact_person  TEXT,
  address         TEXT,
  is_demo_data    BOOLEAN,
  score           FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.category,
    ct.subcategory,
    ct.phone,
    ct.contact_person,
    ct.address,
    ct.is_demo_data,
    ts_rank(ct.search_vector, ts_query)::FLOAT AS score
  FROM public.contacts ct
  WHERE ct.search_vector @@ ts_query
    AND ct.status = 'active'
    AND (p_group_id IS NULL OR ct.group_id = p_group_id)
    AND (p_category IS NULL OR ct.category = p_category)
  ORDER BY
    ct.is_priority DESC,
    score DESC
  LIMIT match_count;
END;
$$;
```

---

### 8. RLS Policy Matrix (Updated — Group-Scoped Pattern)

> **Pattern:** Uses `get_user_group_id()` + `get_user_role()` matching the `training_programs` RLS pattern (most recent in codebase). This ensures Group A admins cannot access Group B's data.

#### `form_templates` (5 policies)

| Policy Name | Operation | Role | Condition |
|-------------|-----------|------|-----------|
| `Users can view published form_templates in their group` | SELECT | authenticated | `group_id = get_user_group_id() AND status IN ('published','archived')` |
| `Managers can view draft form_templates in their group` | SELECT | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| `Managers can insert form_templates` | INSERT | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| `Managers can update form_templates` | UPDATE | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| `Admins can delete form_templates` | DELETE | authenticated | `group_id = get_user_group_id() AND get_user_role() = 'admin'` |

#### `form_submissions` (7 policies)

| Policy Name | Operation | Role | Condition |
|-------------|-----------|------|-----------|
| `Users can view own form_submissions` | SELECT | authenticated | `filled_by = auth.uid()` |
| `Users can view form_submissions about them` | SELECT | authenticated | `subject_user_id = auth.uid()` |
| `Managers can view group form_submissions` | SELECT | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| `Users can insert form_submissions` | INSERT | authenticated | `group_id = get_user_group_id() AND filled_by = auth.uid()` |
| `Users can update own form_submissions` | UPDATE | authenticated | `filled_by = auth.uid()` |
| `Managers can update group form_submissions` | UPDATE | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| `Admins can delete form_submissions` | DELETE | authenticated | `group_id = get_user_group_id() AND get_user_role() = 'admin'` |

Note: PostgreSQL OR-merges multiple policies for the same operation. A user sees submissions where they are the filler OR the subject OR a manager/admin in the group.

#### `contacts` (4 policies)

| Policy Name | Operation | Role | Condition |
|-------------|-----------|------|-----------|
| `Users can view contacts in their group` | SELECT | authenticated | `group_id = get_user_group_id()` |
| `Managers can insert contacts` | INSERT | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| `Managers can update contacts` | UPDATE | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| `Admins can delete contacts` | DELETE | authenticated | `group_id = get_user_group_id() AND get_user_role() = 'admin'` |

#### `storage.objects` (form-attachments bucket, 4 policies)

| Policy Name | Operation | Role | Condition |
|-------------|-----------|------|-----------|
| `Authenticated users can upload form attachments` | INSERT | authenticated | `bucket_id = 'form-attachments'` |
| `Authenticated users can read form attachments` | SELECT | authenticated | `bucket_id = 'form-attachments'` |
| `Users can update own form attachments` | UPDATE | authenticated | `bucket_id = 'form-attachments' AND owner = auth.uid()` |
| `Admins can delete form attachments` | DELETE | authenticated | `bucket_id = 'form-attachments' AND has_role(auth.uid(), 'admin'::user_role)` |

> **Note:** Storage bucket is **private**. Display requires `createSignedUrl(path, 3600)` — 1-hour expiry. This protects PII (signatures, injury photos).

---

### 9. Seed Data Strategy

#### Form Templates Seed

**File:** `supabase/migrations/20260223200004_seed_form_templates.sql`

The seed migration uses a `DO $$ ... $$` block to declare common variables (admin UUID, group UUID) and insert 2 published templates. Each template's `fields` column is a JSONB array where every object follows the field schema defined in `00-feature-overview.md`.

The `instructions_en`/`instructions_es` columns hold the AI step-by-step instructions. The `ai_tools` column is a `TEXT[]` array listing enabled tool names.

**Skeleton structure with the Employee Write-Up template's first 4 fields as example:**

```sql
-- =============================================================================
-- MIGRATION: seed_form_templates
-- Seeds 2 published form templates: Employee Write-Up + Employee Injury Report
-- Phase 1 of Form Builder System
-- =============================================================================

DO $$
DECLARE
  admin_uid UUID := 'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4';
  group_uid UUID;
BEGIN
  -- Get the Alamo Prime group ID
  SELECT id INTO group_uid FROM public.groups WHERE slug = 'alamo-prime' LIMIT 1;

  -- Template 1: Employee Write-Up
  INSERT INTO public.form_templates (
    group_id, slug, title_en, title_es, description_en, description_es,
    icon, fields, instructions_en, instructions_es,
    ai_tools, status, sort_order, created_by
  ) VALUES (
    group_uid,
    'employee-write-up',
    'Employee Write-Up',
    'Amonestacion de Empleado',
    'Document employee performance issues, policy violations, or behavioral concerns.',
    'Documentar problemas de desempeno, violaciones de politica o preocupaciones de conducta del empleado.',
    'FileWarning',
    '[
      {
        "key": "employee_name",
        "label": "Employee Full Name",
        "label_es": "Nombre Completo del Empleado",
        "type": "text",
        "required": true,
        "placeholder": "Enter employee full legal name",
        "section": "Employee Information",
        "hint": "As it appears on their ID",
        "ai_hint": "Extract the employee full name from the input",
        "options": [],
        "validation": {},
        "default": null,
        "order": 1
      },
      {
        "key": "position",
        "label": "Position / Title",
        "label_es": "Posicion / Titulo",
        "type": "text",
        "required": true,
        "placeholder": "e.g., Server, Line Cook, Bartender",
        "section": "Employee Information",
        "hint": null,
        "ai_hint": "Extract the employee position or job title",
        "options": [],
        "validation": {},
        "default": null,
        "order": 2
      },
      {
        "key": "department",
        "label": "Department",
        "label_es": "Departamento",
        "type": "select",
        "required": true,
        "placeholder": "Select department",
        "section": "Employee Information",
        "hint": null,
        "ai_hint": "Determine the department from context (FOH, BOH, Bar, or Management)",
        "options": ["FOH", "BOH", "Bar", "Management"],
        "validation": {},
        "default": null,
        "order": 3
      },
      {
        "key": "date_of_hire",
        "label": "Date of Hire",
        "label_es": "Fecha de Contratacion",
        "type": "date",
        "required": false,
        "placeholder": null,
        "section": "Employee Information",
        "hint": null,
        "ai_hint": "Extract hire date if mentioned",
        "options": [],
        "validation": {},
        "default": null,
        "order": 4
      }
      -- ... remaining fields follow the same pattern:
      --   supervisor_name (text, required, section: Employee Information, order: 5)
      --   date_of_incident (date, required, section: Write-Up Details, order: 6)
      --   type_of_violation (select, required, options: [Attendance, Performance, Conduct, Policy, Safety, Other], order: 7)
      --   severity (radio, required, options: [Verbal Warning, Written Warning, Final Warning, Suspension, Termination], order: 8)
      --   prior_warnings (number, optional, order: 9)
      --   section_header_incident (header, section: Incident Description, order: 10)
      --   incident_description (textarea, required, order: 11)
      --   employee_explanation (textarea, optional, order: 12)
      --   corrective_action (textarea, required, order: 13)
      --   improvement_timeline (text, optional, order: 14)
      --   section_header_evidence (header, section: Supporting Evidence, order: 15)
      --   evidence_files (file, optional, order: 16)
      --   section_header_signatures (header, section: Acknowledgment, order: 17)
      --   employee_signature (signature, optional, order: 18)
      --   manager_signature (signature, required, order: 19)
      --   date_signed (date, required, order: 20)
      --   employee_refused_to_sign (checkbox, optional, options: [Employee refused to sign], order: 21)
    ]'::jsonb,
    E'1. Identify the employee and their role from the user''s description.\n2. Determine the type and severity of the violation.\n3. Write a factual, professional description of the incident -- no opinions, just facts.\n4. Suggest appropriate corrective action based on the severity.\n5. If the user mentions prior incidents, note the count of previous warnings.\n6. Use the manual search to reference relevant company policies if applicable.',
    E'1. Identificar al empleado y su rol a partir de la descripcion del usuario.\n2. Determinar el tipo y la gravedad de la violacion.\n3. Escribir una descripcion factual y profesional del incidente -- sin opiniones, solo hechos.\n4. Sugerir la accion correctiva apropiada basada en la gravedad.\n5. Si el usuario menciona incidentes previos, anotar el numero de advertencias anteriores.\n6. Usar la busqueda del manual para referenciar politicas relevantes de la empresa si aplica.',
    ARRAY['search_manual'],
    'published',
    1,
    admin_uid
  );

  -- Template 2: Employee Injury Report
  INSERT INTO public.form_templates (
    group_id, slug, title_en, title_es, description_en, description_es,
    icon, fields, instructions_en, instructions_es,
    ai_tools, status, sort_order, created_by
  ) VALUES (
    group_uid,
    'employee-injury-report',
    'Employee Injury Report',
    'Reporte de Lesion de Empleado',
    'Document workplace injuries, ensure proper medical response, and maintain compliance records.',
    'Documentar lesiones en el trabajo, asegurar respuesta medica adecuada y mantener registros de cumplimiento.',
    'HeartPulse',
    '[
      -- Full JSONB array of fields following the same pattern as above.
      -- Sections: Injured Employee, Incident Details, Immediate Response,
      -- Witnesses, Root Cause, Attachments, Signatures
      -- See 00-feature-overview.md "Form 2: Employee Injury Report" for the complete field list.
      -- Each field object matches the field schema with key, label, label_es,
      -- type, required, placeholder, section, hint, ai_hint, options, validation, default, order.
    ]'::jsonb,
    E'1. Record the injured employee''s information (name, position, department).\n2. Document exactly what happened -- when, where, how. Be specific and factual.\n3. Identify the type of injury and body parts affected from the description.\n4. CRITICAL -- Use the "Search Contacts" tool to look up:\n   - The nearest hospital or urgent care facility (category: "medical")\n   - The regional manager''s contact information (category: "management")\n   - Pre-fill the Hospital and Regional Manager fields with this data.\n5. Note any first aid or immediate actions taken.\n6. Record witness information if anyone saw what happened.\n7. Assess root cause -- what led to the injury and if it could be prevented.\n8. Use "Search Manual" to reference the emergency procedures section for compliance.',
    E'1. Registrar la informacion del empleado lesionado (nombre, puesto, departamento).\n2. Documentar exactamente lo que sucedio -- cuando, donde, como. Ser especifico y factual.\n3. Identificar el tipo de lesion y partes del cuerpo afectadas a partir de la descripcion.\n4. CRITICO -- Usar la herramienta "Buscar Contactos" para buscar:\n   - El hospital o centro de atencion urgente mas cercano (categoria: "medical")\n   - La informacion de contacto del gerente regional (categoria: "management")\n   - Pre-llenar los campos de Hospital y Gerente Regional con estos datos.\n5. Anotar cualquier primer auxilio o accion inmediata tomada.\n6. Registrar informacion de testigos si alguien vio lo que sucedio.\n7. Evaluar la causa raiz -- que llevo a la lesion y si pudo prevenirse.\n8. Usar "Buscar Manual" para referenciar la seccion de procedimientos de emergencia.',
    ARRAY['search_contacts', 'search_manual'],
    'published',
    2,
    admin_uid
  );

END;
$$;
```

Note: The skeleton above shows comments for the remaining fields. The actual migration will expand the complete JSONB array for both templates with all fields defined in `00-feature-overview.md`.

#### Contacts Seed

**File:** `supabase/migrations/20260223200005_seed_contacts.sql`

The seed uses example/demo data across 5 categories, clearly labeled as editable by admin. The FTS trigger auto-populates `search_vector` on insert.

```sql
-- =============================================================================
-- MIGRATION: seed_contacts
-- Seeds demo contacts across 5 categories for Alamo Prime
-- All clearly marked as example data (admin-editable)
-- Phase 1 of Form Builder System
-- =============================================================================

DO $$
DECLARE
  group_uid UUID;
BEGIN
  SELECT id INTO group_uid FROM public.groups WHERE slug = 'alamo-prime' LIMIT 1;

  INSERT INTO public.contacts (
    group_id, category, subcategory, name, contact_person, phone, phone_alt,
    email, address, notes, is_priority, sort_order, status
  ) VALUES
  -- EMERGENCY
  (group_uid, 'emergency', 'police',
   'San Antonio Police Department - Non-Emergency', NULL,
   '210-207-7273', '911',
   NULL, '315 S Santa Rosa Ave, San Antonio, TX 78207',
   'Call 911 for emergencies. Non-emergency line for reports.',
   true, 1, 'active'),

  (group_uid, 'emergency', 'fire_dept',
   'San Antonio Fire Department', NULL,
   '210-207-7300', '911',
   NULL, '315 S Santa Rosa Ave, San Antonio, TX 78207',
   'Call 911 for fire emergencies.',
   true, 2, 'active'),

  (group_uid, 'emergency', 'poison_control',
   'Texas Poison Center', NULL,
   '1-800-222-1222', NULL,
   NULL, NULL,
   '24/7 poison emergency hotline. Free, confidential.',
   true, 3, 'active'),

  -- MEDICAL
  (group_uid, 'medical', 'hospital',
   'Methodist Hospital', 'Emergency Room',
   '210-575-4000', NULL,
   NULL, '7700 Floyd Curl Dr, San Antonio, TX 78229',
   '24/7 ER. Level I Trauma Center. Closest major hospital. ~15 min drive.',
   true, 1, 'active'),

  (group_uid, 'medical', 'urgent_care',
   'CareNow Urgent Care', NULL,
   '210-361-5555', NULL,
   NULL, '18626 Hardy Oak Blvd, San Antonio, TX 78258',
   'Walk-in urgent care. Open 8am-8pm Mon-Fri, 8am-5pm Sat-Sun. For non-life-threatening injuries.',
   false, 2, 'active'),

  -- MANAGEMENT
  (group_uid, 'management', 'regional_manager',
   'Regional Manager', 'Sarah Johnson (Example)',
   '210-555-0100', NULL,
   'regional.manager@example.com', NULL,
   'Notify for all injuries, incidents, and write-ups. Available 7am-10pm.',
   true, 1, 'active'),

  (group_uid, 'management', 'general_manager',
   'General Manager', 'Michael Torres (Example)',
   '210-555-0101', NULL,
   'gm@example.com', NULL,
   'On-site manager. First escalation point.',
   true, 2, 'active'),

  (group_uid, 'management', 'hr',
   'Human Resources', 'HR Department (Example)',
   '210-555-0102', NULL,
   'hr@example.com', NULL,
   'For write-ups, terminations, benefits questions, workers comp claims.',
   false, 3, 'active'),

  -- GOVERNMENT
  (group_uid, 'government', 'health_dept',
   'San Antonio Metro Health District', 'Food Safety Division',
   '210-207-8853', NULL,
   NULL, '332 W Commerce St, San Antonio, TX 78207',
   'Health inspections, food safety complaints, permits.',
   false, 1, 'active'),

  (group_uid, 'government', 'osha',
   'OSHA Area Office - San Antonio', NULL,
   '210-472-5040', '1-800-321-OSHA',
   NULL, '17319 San Pedro Ave, Suite 100, San Antonio, TX 78232',
   'Workplace safety complaints, injury reporting requirements.',
   false, 2, 'active'),

  -- VENDOR
  (group_uid, 'vendor', 'meat_supplier',
   'Premium Meats Co.', 'Account Rep (Example)',
   '210-555-0200', NULL,
   'orders@example.com', NULL,
   'Delivery Mon-Fri 6am. Order cutoff: previous day 2pm. Emergency orders: call rep directly.',
   false, 1, 'active'),

  (group_uid, 'vendor', 'produce_supplier',
   'Fresh Produce Supply', 'Account Rep (Example)',
   '210-555-0201', NULL,
   'produce@example.com', NULL,
   'Delivery Mon/Wed/Fri 7am. Order cutoff: previous day noon.',
   false, 2, 'active');

END;
$$;
```

---

### Summary

| Item | Count |
|------|-------|
| Migration files | 8 |
| New tables | 3 (`form_templates`, `form_submissions`, `contacts`) |
| Storage buckets | 1 (`form-attachments`) |
| FTS trigger functions | 2 (`form_templates`, `contacts`) |
| `updated_at` trigger functions | 3 (`form_templates`, `form_submissions`, `contacts`) |
| GIN indexes | 2 (`form_templates`, `contacts`) |
| HNSW indexes | 0 (deferred to Phase 7 — tables too small to benefit) |
| B-tree indexes | 7 simple + 4 composite on `form_submissions` + 1 partial on `contacts` |
| Unique constraints | 2 (`form_templates.slug`, `contacts(group_id, name, category)`) |
| RLS policies (data tables) | 16 (5 + 7 + 4) — group-scoped pattern |
| RLS policies (storage) | 4 |
| Search functions | 2 (`search_forms`, `search_contacts`) |
| Seed template rows | 2 (Employee Write-Up, Employee Injury Report) |
| Seed contact rows | 12 (across 5 categories, all `is_demo_data = true`) |

**Key design decisions applied from critical review:**
- All trigger functions use `SET search_path = public` (Supabase security advisor).
- All search functions use `SECURITY DEFINER` + `SET search_path = 'public'`.
- All tables use `extensions.gen_random_uuid()` for PKs.
- RLS uses group-scoped `get_user_group_id()` + `get_user_role()` pattern (matches `training_programs`).
- User FKs reference `public.profiles(id)` (matches training system, most recent pattern).
- `form_submissions.template_id` uses `ON DELETE RESTRICT` — templates with submissions cannot be hard-deleted.
- `form_submissions` includes `template_version`, `fields_snapshot`, and `subject_user_id` for data integrity.
- `form-attachments` bucket is **private** with `file_size_limit` + `allowed_mime_types`.
- `contacts` has `is_demo_data` flag — `search_contacts()` returns it so AI can caveat demo data.
- Embedding columns + HNSW indexes deferred to Phase 7 (2-50 rows per table don't justify them).

---

## UX/UI Considerations for Phase 1

### 1. Seed Data UX Impact

#### Field Labels & User-Friendliness

**Employee Write-Up:**
- Labels are clear and professional: "Employee Full Name," "Position / Title," "Department," "Supervisor Name."
- "Number of Prior Warnings" should include a `hint`: "Include verbal and written warnings" so the manager knows what to count.
- "Timeline for Improvement" is vague — add `placeholder`: "e.g., 30 days, by next review period."
- "Corrective Action Required" is well placed after incident description — follows natural mental flow.
- **Missing field:** Consider "Employee ID / Badge Number" — in high-turnover restaurants, multiple employees may share names. An ID disambiguates and is critical for HR.

**Employee Injury Report:**
- Sections flow naturally: who got hurt → what happened → what was done → who saw it → why it happened → evidence → signatures. Mirrors OSHA-style reporting.
- "Body Part(s) Affected" with 12 checkboxes could overwhelm on mobile. Render as a two-column grid (6 rows x 2 columns) instead of a single scrolling list.
- "Location in Restaurant" has 9 options — appropriate granularity. "Other" should include a conditional free-text field (e.g., "walk-in freezer" is not listed but is a common injury location).
- "Could It Have Been Prevented" — add `hint`: "Be honest — this is for prevention, not blame."
- **Missing fields:** Consider a "Return to Work" section: "Employee able to continue shift?" (Yes/No), "Light duty assigned?" (Yes/No), "Follow-up appointment date" (date).

#### Field Ordering

One adjustment: in the Injury Report, "Regional Manager Notified" and "Regional Manager Contact" should appear immediately after "911 Called" and "Transported to Hospital" — notification happens in the same urgency window. Ensure `order` values place these four fields consecutively.

#### Section Groupings

Rename "Supporting Evidence" in the Write-Up form to "Attachments" for consistency with the Injury Report. "Evidence" has a confrontational legal tone that may make managers hesitant.

### 2. Field Schema Recommendations

#### Type Coverage

The 17 field types cover both seed forms well. Gaps for future consideration (not Phase 1 blockers):
- **`toggle`/`boolean`**: Simple on/off switch. "Employee Refused to Sign" works as a single checkbox but a toggle renders more cleanly on mobile.
- **`currency`**: For future inventory loss or cash discrepancy forms.
- **`divider`**: Pure visual horizontal line (no text). `header` always has text.

**Verdict:** 17 types are sufficient. The schema is extensible since types are strings in JSONB — adding new ones later requires no migration.

#### Placeholder vs Hint Guidelines for Seed Data

- **`placeholder`**: Example input, not instructions. Good: "e.g., John Smith." Bad: "Enter the employee's full name." Placeholders disappear on focus.
- **`hint`**: Persistent help text below the input in small muted type. Good: "As it appears on their ID." Stays visible while typing.
- **`ai_hint`**: AI-only, not visible to users. Good separation of concerns.

**Recommendation:** Ensure every required field has a `placeholder` and every ambiguous field has a `hint` in the seed JSONB.

#### Conditional Fields UX

- **Preferred: Animate expand/collapse.** 200ms ease-out slide down when triggered, slide up when condition unmet.
- **Do NOT gray out.** Hidden-until-needed is simpler and less confusing.
- **Do NOT collapse entire sections** for one conditional field.
- **Condition schema in seed JSONB:**
  ```jsonc
  "condition": {
    "field": "transported_to_hospital",
    "operator": "equals",
    "value": "Yes"
  }
  ```

#### Signature Pad UX

- **Size:** `w-full h-48` (full width, 192px tall). On a 375px phone: ~343px x 192px signing area. Do not go below 160px tall.
- **Placement:** Always the last interactive section — fill the form, then sign. The seed data correctly positions signatures last.
- **Buttons:** [Clear] left-aligned (secondary/ghost), [Undo] next to it (secondary), [Confirm] right-aligned (primary/accent). All directly below the canvas, not floating.
- **"Employee Refused to Sign":** When checked, signature pad collapses with animation and a note appears: "Employee was informed and refused to sign. Manager signature required as witness."

#### Image Upload UX

- **Button:** Dashed-border rectangle with camera icon + "Add Photo" text. Full width, 48px tall minimum.
- **Previews:** 100x100px square thumbnails with rounded corners. Small (x) in top-right for removal.
- **Count indicator:** "2 of 5 photos" below the grid. At max: "5 of 5 photos (maximum)" and the add tile disappears.
- **Upload state:** Circular spinner overlay per photo while uploading. Green check flash on success.

### 3. Form Card Design

Form template cards differ from recipe cards: no food photo, uses a large Lucide icon instead.

```
+------------------------------------------+
|                                          |
|   +--------+                  [Pin/📌]   |
|   |        |                             |
|   | (icon) |                             |
|   |  48x48 |                             |
|   +--------+                             |
|                                          |
|   Employee Write-Up                      |
|   Document employee performance          |
|   issues and policy violations...        |
|                                          |
|   -  -  -  -  -  -  -  -  -  -  -  -  - |
|   📋 12 submissions             PUBLISHED|
+------------------------------------------+
```

| Element | Spec |
|---------|------|
| Container | `bg-card rounded-[20px] border border-black/[0.04] shadow-card p-5` (same as RecipeGrid) |
| Icon tile | 48x48px rounded-[14px] with tinted background. E.g., blue-100 for ClipboardList, red-100 for AlertTriangle |
| Pin | Top-right, 32x32 rounded-full, grey idle, orange-500 active |
| Title | `text-base font-semibold line-clamp-2` |
| Description | `text-xs text-muted-foreground line-clamp-2 mt-1` |
| Bottom row | Left: clipboard icon + "12 submissions". Right: status pill (green PUBLISHED / gray DRAFT) |

### 4. Contact Seed Data UX — Category Taxonomy

| Category | Subcategory | Examples | AI Triggers |
|----------|-------------|----------|-------------|
| `emergency` | `fire_dept`, `police`, `poison_control` | SA Fire Dept, SAPD | "fire", "police", "poison" |
| `medical` | `hospital`, `urgent_care`, `workers_comp` | Methodist Hospital, CareNow | "hospital", "ER", "injury" |
| `management` | `regional_manager`, `general_manager`, `hr`, `owner` | Regional VP, GM, HR Rep | "regional", "GM", "HR" |
| `vendor` | `meat_supplier`, `produce_supplier`, `beverage_dist`, `equipment_repair` | John's Meats, Fresh Harvest | "meat order", "equipment broken" |
| `government` | `health_dept`, `osha` | SA Metro Health, OSHA Area Office | "health inspector", "OSHA" |
| `insurance` | `general_liability`, `workers_comp` | Insurance carrier | "insurance", "claim" |

Seed 12-15 demo contacts across all categories. Mark with `is_demo_data = true`. Set `is_priority = true` on hospital, fire dept, regional manager, poison control.

### 5. Mobile-First Considerations

Restaurant staff fill these forms on personal phones during stressful situations. Speed, clarity, and fat-finger tolerance are critical.

#### Form Fill Flow on 375px

- **Full-width inputs.** No side-by-side fields on mobile. Even Date + Time stack vertically.
- **Sticky section headers** (`sticky top-0 bg-background z-10`) — user always knows which section they're in.
- **Progress indicator.** Thin bar at top: "Section 3 of 7" or percentage.
- **Fixed bottom action bar** (`fixed bottom-0 inset-x-0 pb-safe`) — [Save Draft] and [Submit] always reachable without scrolling.
- **Field spacing:** `gap-4` (16px) between fields minimum. Tighter spacing = accidental taps.

#### Signature Pad on Mobile

- **Width:** Full container width (~343px on 375px screen).
- **Height:** 180px minimum. Overview's `h-48` (192px) is good.
- **Hint:** "Rotate phone for more space" with rotation icon (don't force rotation).
- **`touch-action: none`** on canvas — mandatory to prevent scroll-while-signing.
- **Buttons:** Single row below canvas, full width, evenly spaced, 44px tall minimum each.

#### Photo Capture Prominence

- Camera button should be **at least 48px tall, full width, dashed border** with camera icon.
- In the Injury Report, consider placing the photo field in "Incident Details" (right after Description) rather than a separate "Attachments" section at the end. Managers remember to photograph while describing; they forget by the end.

#### Touch Target Sizes

| Element | Minimum | Recommended |
|---------|---------|-------------|
| Text inputs | 44px tall | 48px (`h-12`) |
| Radio/checkbox tap area | 44x44px | 48x48px with padding |
| Action buttons (Save/Submit) | 44px tall | 52px (`h-13`) |
| Photo thumbnail remove (x) | 32x32px | 32px + 8px hit padding |
| Signature pad buttons | 44px tall | 44px, spanning equal thirds |

#### Additional Mobile Considerations

- **Autosave:** Auto-save draft every 30s or on field blur. Losing a half-completed injury report because the app was backgrounded and killed is a UX failure.
- **Keyboard management:** `scrollIntoView({ block: 'center' })` on focus to keep the active field visible above the virtual keyboard.
- **Dark mode:** Signature pad needs visible border in both themes. Black stroke on white canvas (light), white stroke on dark canvas (dark).

### Summary: Phase 1 Seed Data Adjustments

These affect JSONB content only, not table DDL:

1. Add `condition` objects to the 4 conditional fields in the Injury Report.
2. Add `placeholder` to every required field.
3. Add `hint` to ambiguous fields (Timeline for Improvement, Number of Prior Warnings, Could It Have Been Prevented).
4. Consider adding "Employee ID" to both forms.
5. Consider adding "Return to Work" fields to the Injury Report.
6. Rename "Supporting Evidence" → "Attachments" in the Write-Up.
7. Seed 12-15 demo contacts with `is_demo_data = true` and `is_priority` set for emergency-critical ones.
8. Add "Other (specify)" conditional free-text for "Location in Restaurant."

---

## Critical Review & Risk Assessment

### 1. Over-Engineering Risks

**1a. HNSW index on form_templates — not worth it.**

The plan calls for `embedding vector(1536)` and an HNSW index on a table that will have 2-50 rows. HNSW has real costs: write amplification, memory overhead, maintenance complexity. A sequential scan on 50 rows completes in under 1ms. FTS alone will trivially distinguish "Employee Write-Up" from "Employee Injury Report."

**Recommendation:** Drop `embedding` column and HNSW index from `form_templates`. Add in Phase 7 via `ALTER TABLE` if ever needed.

**1b. The `contacts` table is debatable but justified.**

The structured table is needed for Phase 2's `ContactLookupField` and Phase 3's AI tool use. Keeping it in Phase 1 avoids blocking later phases. However, strip the `embedding vector(1536)` and HNSW index — same reasoning as above. 10-30 contacts don't need semantic search.

**1c. 16 field types — fine for schema, defer 4 renderers to later.**

The actually-used types across both seed forms are 13. Types `datetime`, `phone`, `email`, and `instructions` are unused. The JSONB schema can define all 17 (free), but Phase 2 should only build the 13 renderers actually needed.

**1d. Storage bucket in Phase 1 — keep it (one INSERT), but make it private.**

### 2. Under-Engineering Risks

**2a. Template versioning is a Phase 1 concern.**

If an admin edits a published template after submissions exist (possible by Phase 3), old submissions reference changed `fields` JSONB. Field keys may no longer match.

**Recommendation:** Add `template_version INTEGER NOT NULL DEFAULT 1` to both `form_templates` and `form_submissions`. Optionally add `fields_snapshot JSONB` to `form_submissions` to capture the template's fields at submission time.

**2b. Soft delete vs hard delete.**

No explicit `ON DELETE` behavior on `form_submissions.template_id` FK. Default is `NO ACTION` (RESTRICT), giving cryptic errors.

**Recommendation:** Explicitly set `ON DELETE RESTRICT`. Document that `status='archived'` is the soft-delete mechanism. Templates with submissions cannot be hard-deleted.

**2c. `field_values` JSONB has no schema validation.**

Acceptable for Phase 1-2 (frontend validates). Becomes riskier in Phase 3 when AI writes values. Add server-side validation in the `/ask-form` edge function.

**2d. No dedup on contacts.**

**Recommendation:** Add `UNIQUE(group_id, name, category)` to prevent exact duplicates.

**2e. Missing composite indexes on `form_submissions`.**

**Recommendation:** Add:
- `(template_id, created_at DESC)` — admin list view
- `(group_id, created_at DESC)` — group-level queries
- `(filled_by, created_at DESC)` — user's own submissions

### 3. Security Concerns

**3a. Signatures in a public bucket — HIGH RISK.**

Employee signatures and injury photos are PII. A public bucket means anyone with the URL can view them without authentication, forever. The existing `product-assets` bucket was made public because those are food photos. Form attachments are HR documents.

**Recommendation:** Make `form-attachments` **private** (`public = false`). Use `createSignedUrl(path, 3600)` (1-hour expiry) for display. Add `file_size_limit: 10485760` and `allowed_mime_types: ['image/jpeg','image/png','image/webp','application/pdf']`.

**3b. Add `subject_user_id` to `form_submissions`.**

Currently only `filled_by` (who filled) is tracked, not who the form is *about*. A manager fills a write-up about Employee A — Employee A has no way to see it. Add `subject_user_id UUID REFERENCES profiles(id)` (nullable) for the "view your own write-ups" use case.

**3c. Make `filled_by` NOT NULL.**

Users must be authenticated to create submissions. A NULL `filled_by` with the UPDATE RLS policy (`filled_by = auth.uid()`) would mean NULL comparisons — any user could potentially update orphaned submissions.

### 4. Integration Risks

**4a. FK pattern inconsistency.**

Three different FK patterns exist in the codebase:
- `REFERENCES auth.users(id)` — plan proposes this
- `REFERENCES public.profiles(id)` — training system uses this
- No FK, bare UUID — product tables use this

**Recommendation:** Use `REFERENCES public.profiles(id) ON DELETE CASCADE` to match the training system (most recent, most intentional pattern).

**4b. RLS pattern: use newer group-scoped functions.**

The codebase has two admin check patterns. The newer `get_user_group_id()` + `get_user_role()` pattern (from training system) is group-scoped. Since form tables have `group_id`, use the newer pattern so Group A admins can't edit Group B's templates.

**4c. `group_id` difference from product tables.**

Product tables have no `group_id`. Form tables do. This means `search_forms` needs `p_group_id` filtering while `search_dishes` does not. The `/ask` edge function's tool dispatch will need to handle this selectively. Document this discrepancy.

### 5. Seed Data Risks

**5a. Demo contacts used in real emergency — HIGH RISK.**

If a real injury occurs and the AI suggests a demo hospital with a fake phone number, someone might actually call it.

**Recommendation:**
1. Seed names: "DEMO - Sample Hospital (Replace with Real Data)"
2. Seed phones: `(555) 555-0100` range
3. Add `is_demo_data BOOLEAN NOT NULL DEFAULT false` to contacts table
4. `search_contacts` returns `is_demo_data` so AI can caveat: "Note: This is sample data. Verify actual contact information."

**5b. Field keys are immutable once submissions exist.**

The chosen `snake_case` keys are reasonable. Document them as immutable: "Once a template is published and submissions exist, field keys must not be changed."

### 6. Recommended Phase 1 Changes

| Change | Table | Severity |
|--------|-------|----------|
| Make storage bucket private | `form-attachments` | **HIGH** |
| Add `is_demo_data` + obvious fake data | `contacts` | **HIGH** |
| Add `template_version` | `form_templates` + `form_submissions` | **MEDIUM** |
| Add `subject_user_id` | `form_submissions` | **MEDIUM** |
| Drop `embedding` + HNSW | `form_templates` + `contacts` | **LOW** (simplification) |
| Add `UNIQUE(group_id, name, category)` | `contacts` | **MEDIUM** |
| Make `filled_by` NOT NULL | `form_submissions` | **LOW** |
| Add composite indexes | `form_submissions` | **LOW** |
| Use `profiles(id)` FK pattern | All tables | **LOW** |
| Use group-scoped RLS functions | All tables | **LOW** |
| Explicit `ON DELETE RESTRICT` | `form_submissions.template_id` | **LOW** |
| Add `file_size_limit` + `allowed_mime_types` | `form-attachments` bucket | **MEDIUM** |
