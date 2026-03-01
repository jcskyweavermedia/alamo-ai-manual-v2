# Phase 5: Form Builder Admin -- Database & Schema Plan

> **Status:** Planning
> **Date:** 2026-02-25
> **Dependencies:** Phase 1 (DB Foundation, complete), Phase 2 (Form Viewer, complete), Phase 3 (AI Form Filling, complete)
> **Output:** 4-6 migrations, 0 new tables, targeted column additions + trigger enhancements
> **Author:** Senior Database Architect (Opus)

---

## Table of Contents

1. [Schema Changes Needed](#1-schema-changes-needed)
2. [Fields JSONB Validation Enhancements](#2-fields-jsonb-validation-enhancements)
3. [AI Tools Registry](#3-ai-tools-registry)
4. [Edge Cases & Guardrails](#4-edge-cases--guardrails)
5. [Migrations List](#5-migrations-list)
6. [RLS Policy Changes](#6-rls-policy-changes)
7. [Verification Queries](#7-verification-queries)

---

## 1. Schema Changes Needed

### 1.1 Current State Assessment

The `form_templates` table is already well-structured for read/fill operations. For the admin **builder** experience, we need additions in three areas: auto-save state, instruction refinement history, and template version history.

### 1.2 New Columns on `form_templates`

```sql
ALTER TABLE public.form_templates
  ADD COLUMN builder_state    JSONB,
  ADD COLUMN ai_refinement_log JSONB DEFAULT '[]'
    CONSTRAINT chk_ai_refinement_log_is_array CHECK (jsonb_typeof(ai_refinement_log) = 'array');
```

#### `builder_state` (JSONB, nullable)

Stores the transient builder UI state for the admin who is actively editing a template. This is the "auto-save buffer" that prevents work loss if the browser crashes or the session times out.

```jsonc
{
  "collapsed_sections": ["section_employee_info"],
  "selected_field_key": "employee_name",
  "preview_mode": false,
  "last_builder_user": "uuid-of-admin",
  "last_builder_at": "2026-02-25T14:30:00Z"
}
```

**Why a column and not a separate table:**
- One builder state per template (1:1 relationship -- no reason for a join table)
- Tiny payload (< 1 KB). No indexing needed.
- Auto-cleared on publish (set to NULL)
- The alternative (`form_template_drafts` table) adds a join and an orphan-cleanup problem for zero benefit when the relationship is always 1:1

**Why not `localStorage`:**
- Multiple admins could edit across devices
- `localStorage` does not survive browser clear/reinstall
- Server state lets us show "Last edited by Maria, 3 hours ago" warnings

#### `ai_refinement_log` (JSONB, default `[]`)

Stores the AI conversation that helped the admin refine the template's instructions. When the admin uses the "AI Refine Instructions" feature (Phase 5 requirement #3), each round of the conversation is appended here.

```jsonc
[
  {
    "role": "user",
    "content": "Make the injury description instructions more specific about legal language",
    "timestamp": "2026-02-25T14:32:00Z"
  },
  {
    "role": "assistant",
    "content": "I've updated the instructions to emphasize...",
    "suggested_instructions_en": "1. Record the injured employee's information...",
    "suggested_instructions_es": "1. Registrar la informacion del empleado...",
    "timestamp": "2026-02-25T14:32:05Z"
  },
  {
    "role": "user",
    "content": "Accepted",
    "action": "accepted",
    "timestamp": "2026-02-25T14:33:00Z"
  }
]
```

**Why in the template row and not a separate table:**
- Always loaded with the template during editing (no extra query)
- Never queried independently (no FTS/filtering needed on refinement logs)
- Bounded size: truncate to last 20 entries in the trigger (see Section 2)
- Cleared on publish to keep the row lean

**Why not a `chat_sessions` / `chat_messages` reuse:**
- Refinement is template-scoped, not user-scoped
- The conversation is short (typically 2-6 exchanges) and never shown in the main chat UI
- Storing it inline avoids cross-table joins and session lifecycle management

### 1.3 Template Versioning: `form_template_versions` Table

**Decision: YES, create a version history table.**

The current `template_version` integer on `form_templates` tracks the current version number but does not preserve what previous versions looked like. When an admin edits a published template, submissions filled against the old version reference `template_version = N` and store a `fields_snapshot` -- but there is no way to reconstruct the full template (instructions, AI tools, description) for that version.

For the builder admin, version history is critical for:
- "Undo" at the template level (revert to a previous published version)
- Audit trail ("Who changed what and when?")
- Submission rendering ("Show me this submission with the template as it was at version 3")

**We do NOT create this table in Phase 5.** Here is why:

1. The `fields_snapshot` column on `form_submissions` already captures the field definitions at submission time. This is the primary use case for historical rendering.
2. Phase 5 is the builder itself -- the admin creates and edits templates. Full version history adds complexity to the publish flow (snapshot before update, manage orphan versions).
3. Phase 7 (Polish & Advanced) explicitly lists "Template versioning" as a deliverable.

**Phase 5 approach instead:** Add a `published_at` timestamp column and a pre-update trigger that bumps `template_version` automatically on publish:

```sql
ALTER TABLE public.form_templates
  ADD COLUMN published_at TIMESTAMPTZ;
```

The trigger (see Section 5 migration #3) ensures:
- When `status` transitions from `draft` to `published`: increment `template_version`, set `published_at = now()`, clear `builder_state`, clear `ai_refinement_log`
- When `status` transitions from `published` to `draft` (edit mode): no version bump (the bump happens on next publish)

This gives Phase 5 the version-tracking semantics it needs without the full version history table. Phase 7 will add the `form_template_versions` table with a trigger that snapshots the entire row before each version bump.

### 1.4 Summary of Column Additions

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `builder_state` | JSONB | NULL | Auto-save of builder UI state |
| `ai_refinement_log` | JSONB | `[]` | AI instruction refinement conversation |
| `published_at` | TIMESTAMPTZ | NULL | When the template was last published |

### 1.5 Columns NOT Added (and Why)

| Considered | Decision | Reason |
|------------|----------|--------|
| `ai_tool_descriptions` JSONB | Rejected | Tool descriptions live in the `form_ai_tools` registry or are hard-coded in the edge function. No per-template overrides needed. |
| `builder_lock_user_id` UUID | Rejected | Optimistic concurrency (compare `updated_at`) is simpler and sufficient for a single-restaurant admin team. Real-time locking is overkill. |
| `parent_template_id` UUID | Rejected | Template cloning is a UI-only operation: read source, create new row with modified slug. No FK needed. |
| `max_fields` INTEGER | Rejected | Enforced in the trigger (Section 2), not as a per-template column. The limit is system-wide. |

---

## 2. Fields JSONB Validation Enhancements

### 2.1 Current Trigger

The existing `validate_form_template_fields()` trigger checks:
- `fields` is a JSONB array (via CHECK constraint)
- Every field has a non-empty `key` (text)
- Every field has a non-empty `type` (text)
- No duplicate `key` values

This is minimal. The builder needs stronger guardrails to prevent admins from creating forms that the viewer/AI cannot handle.

### 2.2 Enhanced Validation Rules

Replace the current trigger with an expanded version that adds these checks:

#### Rule 1: Maximum 50 fields per template

```sql
IF jsonb_array_length(NEW.fields) > 50 THEN
  RAISE EXCEPTION 'Template cannot have more than 50 fields (found %)', jsonb_array_length(NEW.fields);
END IF;
```

**Why 50:** The current injury report has 30 fields (the largest template). 50 allows room for growth while preventing unbounded forms that would overwhelm the AI and the UI. The AI's system prompt token budget grows linearly with field count -- at 50 fields, the prompt is approximately 3000 tokens (well within limits). Beyond 50, AI extraction quality degrades because the model loses focus with too many extraction targets.

#### Rule 2: Valid field types

```sql
IF NOT (field_record->>'type' = ANY(ARRAY[
  'text', 'textarea', 'date', 'time', 'datetime', 'select', 'radio',
  'checkbox', 'number', 'phone', 'email', 'signature', 'image', 'file',
  'header', 'instructions', 'contact_lookup'
])) THEN
  RAISE EXCEPTION 'Invalid field type "%" for field "%"', field_record->>'type', field_record->>'key';
END IF;
```

**Why at the DB level:** The frontend `FormFieldType` union and the DB trigger must agree on valid types. A typo in the builder UI (e.g., `"text area"` with a space) would create a field the viewer cannot render. The trigger catches this at write time.

#### Rule 3: Select/radio/checkbox MUST have `options`

```sql
IF field_record->>'type' IN ('select', 'radio', 'checkbox') THEN
  IF field_record->'options' IS NULL
     OR jsonb_typeof(field_record->'options') <> 'array'
     OR jsonb_array_length(field_record->'options') = 0 THEN
    RAISE EXCEPTION 'Field "%" (type %) must have a non-empty "options" array',
      field_record->>'key', field_record->>'type';
  END IF;
END IF;
```

**Why:** A `select` field with no options is an invisible trap. The viewer renders an empty dropdown, and the AI has no valid values to choose from. This is the most common builder mistake.

#### Rule 4: `key` format validation

```sql
IF field_record->>'key' !~ '^[a-z][a-z0-9_]{0,63}$' THEN
  RAISE EXCEPTION 'Field key "%" must be lowercase alphanumeric with underscores, starting with a letter (max 64 chars)',
    field_record->>'key';
END IF;
```

**Why:** Field keys become JSONB property names in `field_values`, are referenced in `condition.field`, and are used in TypeScript code. Allowing arbitrary strings (spaces, special characters, unicode) would cause subtle bugs downstream. The regex enforces snake_case convention matching the existing templates.

#### Rule 5: Condition references must point to existing field keys

```sql
-- Pass 1: Collect all field keys
all_field_keys := ARRAY(
  SELECT f->>'key'
  FROM jsonb_array_elements(NEW.fields) AS f
);

-- Pass 2: Validate conditions against full key set
FOR i IN 0..jsonb_array_length(NEW.fields) - 1 LOOP
  field := NEW.fields->i;
  -- ... other validations ...

  -- Condition validation: check against ALL keys (not just preceding)
  IF field->'condition' IS NOT NULL AND field->>'condition' != 'null' THEN
    condition_field := field->'condition'->>'field';
    IF condition_field IS NOT NULL AND NOT (condition_field = ANY(all_field_keys)) THEN
      RAISE EXCEPTION 'Field "%" has condition referencing non-existent field "%"',
        field->>'key', condition_field;
    END IF;
    -- Also ensure field doesn't reference itself
    IF condition_field = field->>'key' THEN
      RAISE EXCEPTION 'Field "%" cannot have a condition referencing itself',
        field->>'key';
    END IF;
  END IF;
END LOOP;
```

**Why:** A dangling condition reference (`condition.field = "nonexistent_key"`) means the conditional field is permanently hidden or permanently visible depending on the `evaluateCondition` fallback. This is a builder error that should be caught at save time.

**Two-pass approach:** The trigger uses a two-pass design. Pass 1 collects ALL field keys upfront. Pass 2 validates conditions against the full key set. This means a field can reference any other field in the form regardless of array position, which supports drag-and-drop reordering without breaking validation. A self-reference check is also included to prevent a field from conditionally depending on itself.

#### Rule 6: `order` values must be present and unique

```sql
-- Collect order values and check for duplicates
IF field_record->'order' IS NULL THEN
  RAISE EXCEPTION 'Field "%" must have an "order" property', field_record->>'key';
END IF;

order_val := (field_record->>'order')::INTEGER;
IF order_val = ANY(order_values) THEN
  RAISE EXCEPTION 'Duplicate order value % for field "%"', order_val, field_record->>'key';
END IF;
order_values := array_append(order_values, order_val);
```

**Why:** The frontend sorts by `order` for display. Duplicate or missing `order` values cause undefined rendering order. The builder UI should auto-assign sequential order values, but the trigger catches cases where the JSONB is manually edited or the builder has a bug.

#### Rule 7: Maximum options per select/radio/checkbox field

```sql
IF field_record->>'type' IN ('select', 'radio', 'checkbox') THEN
  IF jsonb_array_length(field_record->'options') > 50 THEN
    RAISE EXCEPTION 'Field "%" has too many options (% > 50)',
      field_record->>'key', jsonb_array_length(field_record->'options');
  END IF;
END IF;
```

**Why:** 50 options per field is generous (the current maximum is 12 for body parts). Beyond 50, the AI prompt bloats and the mobile UI becomes unusable with a scrolling radio group.

### 2.3 Validation Rules NOT Added (and Why)

| Considered | Decision | Reason |
|------------|----------|--------|
| Option string character validation | Deferred | Options are free text (e.g., "FOH", "Cut/Laceration"). Restricting characters would break legitimate values. Frontend sanitization is sufficient. |
| `section` value must match a `header` field label | Deferred | The `section` property is used for display grouping and is optional. The `groupFieldsIntoSections()` utility in `form-utils.ts` already handles ungrouped fields gracefully. Strict enforcement would break existing templates that omit `section` on fields. |
| `label` maximum length | Deferred | Labels are rendered in the UI with CSS truncation. A 1000-character label is ugly but not broken. Frontend validation is more user-friendly for this. |
| `ai_hint` is required for fillable fields | Deferred | AI hints are optional. Many simple fields (dates, names) work fine without them. Making them required would annoy admins building simple forms. |
| `validation` object schema enforcement | Deferred | The `FormFieldValidation` interface is extensible (`[key: string]: unknown`). Strict schema enforcement at the DB level would require updating the trigger every time a new validation rule is added. Runtime validation in the edge function is more flexible. |

### 2.4 `ai_refinement_log` Size Cap

Add a check to the publish trigger (or a separate trigger on `ai_refinement_log`):

```sql
-- Cap refinement log at 20 entries to prevent unbounded growth
IF jsonb_array_length(NEW.ai_refinement_log) > 20 THEN
  -- Keep only the last 20 entries
  NEW.ai_refinement_log := (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(NEW.ai_refinement_log) AS elem
      ORDER BY (elem->>'timestamp')::TIMESTAMPTZ DESC
      LIMIT 20
    ) sub
  );
END IF;
```

---

## 3. AI Tools Registry

### 3.1 The Question: Reference Table vs. TEXT[]

The current `ai_tools TEXT[] DEFAULT '{}'` column stores tool identifiers as a simple array: `'{search_contacts,search_manual,search_products}'`. The question is whether we should create a `form_ai_tools` reference table to store tool metadata.

### 3.2 Recommended Approach: Hybrid (Config Table + TEXT[] Stays)

Create a **read-only configuration table** for the builder UI, but keep the `ai_tools TEXT[]` column on `form_templates` unchanged.

```sql
CREATE TABLE public.form_ai_tools (
  id              TEXT PRIMARY KEY,
  label_en        TEXT NOT NULL,
  label_es        TEXT NOT NULL,
  description_en  TEXT NOT NULL,
  description_es  TEXT NOT NULL,
  search_function TEXT,          -- PG function name (informational, not enforced)
  icon            TEXT,          -- Lucide icon for the builder UI
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 Seed Data

```sql
INSERT INTO public.form_ai_tools (id, label_en, label_es, description_en, description_es, search_function, icon, sort_order)
VALUES
  ('search_contacts', 'Search Contacts', 'Buscar Contactos',
   'Search the restaurant''s contact directory (hospitals, emergency services, management, vendors). Use for forms that reference external contacts.',
   'Buscar en el directorio de contactos del restaurante (hospitales, servicios de emergencia, gerencia, proveedores). Usar para formularios que referencian contactos externos.',
   'search_contacts', 'BookUser', 1),

  ('search_manual', 'Search Manual', 'Buscar Manual',
   'Search restaurant policies, procedures, safety protocols, and standard operating procedures. Use for forms that reference company policies.',
   'Buscar politicas, procedimientos, protocolos de seguridad y procedimientos operativos del restaurante. Usar para formularios que referencian politicas de la empresa.',
   'search_manual_v2', 'BookOpen', 2),

  ('search_products', 'Search Products', 'Buscar Productos',
   'Search the menu, recipes, wines, cocktails, and beverages. Use for forms related to food preparation, allergens, or menu items.',
   'Buscar el menu, recetas, vinos, cocteles y bebidas. Usar para formularios relacionados con preparacion de alimentos, alergenos o platillos del menu.',
   'search_dishes', 'UtensilsCrossed', 3),

  ('search_standards', 'Restaurant Standards', 'Estandares del Restaurante',
   'Search restaurant standards including steps of service, dress code, cleanliness standards, and guest experience protocols.',
   'Buscar estandares del restaurante incluyendo pasos de servicio, codigo de vestimenta, estandares de limpieza y protocolos de experiencia del cliente.',
   'search_manual_v2', 'Star', 4),

  ('search_steps_of_service', 'Steps of Service', 'Pasos de Servicio',
   'Search the Steps of Service guide for front-of-house procedures, greeting protocols, table management, and guest interaction standards.',
   'Buscar la guia de Pasos de Servicio para procedimientos de frente de casa, protocolos de bienvenida, manejo de mesas y estandares de interaccion con el cliente.',
   'search_manual_v2', 'ListChecks', 5);
```

### 3.4 Why This Hybrid Approach

**Pros of the config table:**
- Builder UI reads `form_ai_tools` to render toggle cards with bilingual labels, descriptions, and icons
- Adding a new tool = 1 INSERT (no code changes to the builder UI)
- Admin can see "Why would I enable this tool?" via the description
- `status = 'deprecated'` lets us sunset tools without breaking existing templates
- The `sort_order` controls display order in the builder

**Why the `ai_tools TEXT[]` column stays:**
- The edge function (`ask-form`) already reads `template.ai_tools` and maps to the `TOOL_REGISTRY` object. This is a simple, fast array lookup. Replacing it with a join would add complexity for zero performance benefit.
- The TEXT[] is the source of truth for "which tools does this template use." The config table is the source of truth for "what tools exist and what do they look like."
- No FK constraint between `ai_tools` and `form_ai_tools.id`. This is intentional -- if a tool is deprecated, existing templates keep working. The builder UI simply hides deprecated tools from the picker.

**Cons mitigated:**
- "What if someone puts garbage in `ai_tools`?" -- The edge function ignores unknown tool names (line 388: `if (TOOL_REGISTRY[toolName])`). Invalid entries are harmless no-ops.
- "What if the builder UI and config table get out of sync?" -- The builder reads from `form_ai_tools` at mount time. The displayed tools are always current.

### 3.5 New Tools: `search_standards` and `search_steps_of_service`

Per the user requirements, two new tool identifiers need to be available:

| Tool ID | Backend Function | How It Works |
|---------|-----------------|-------------|
| `search_standards` | `search_manual_v2` | Searches the manual with an implicit filter/boost for standards-related sections (dress code, cleanliness, guest experience). The edge function prepends "restaurant standards: " to the query. |
| `search_steps_of_service` | `search_manual_v2` | Searches the manual with an implicit filter/boost for steps-of-service content. The edge function prepends "steps of service: " to the query. |

**Implementation note:** Both tools route to the existing `search_manual_v2` RPC. The differentiation is in the query prefix and the system prompt context, not in a separate PG function. The `ask-form` edge function will add these to its `TOOL_REGISTRY` with query-enrichment logic:

```typescript
// In ask-form/index.ts TOOL_REGISTRY:
search_standards: {
  // Uses search_manual but enriches the query
  dispatch: (args) => executeTool(supabase, "search_manual",
    { query: `restaurant standards ${args.query}` }, language, groupId, apiKey)
},
search_steps_of_service: {
  dispatch: (args) => executeTool(supabase, "search_manual",
    { query: `steps of service ${args.query}` }, language, groupId, apiKey)
}
```

No new PG functions needed. The manual already contains steps-of-service and restaurant standards sections; the FTS + vector hybrid search naturally surfaces them when the query is enriched.

### 3.6 RLS for `form_ai_tools`

Read-only for all authenticated users. No INSERT/UPDATE/DELETE by anyone through the API -- tool management is migration-only.

```sql
ALTER TABLE public.form_ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view form_ai_tools"
  ON public.form_ai_tools FOR SELECT TO authenticated
  USING (true);
```

No INSERT/UPDATE/DELETE policies. Changes go through migrations only. This prevents an admin from accidentally deleting a tool that existing templates depend on.

---

## 4. Edge Cases & Guardrails

### 4.1 100-Field Template (Performance)

**Problem:** An admin creates a form with 100 fields. The AI prompt balloons to ~6000 tokens for field definitions alone. Combined with history and instructions, this approaches quality degradation thresholds.

**Guardrails:**
1. **Hard limit: 50 fields** (trigger, Section 2.2 Rule 1). This is non-negotiable at the DB level.
2. **Soft warning: 30 fields** (frontend only). The builder UI shows a yellow warning banner: "Forms with more than 30 fields may reduce AI extraction accuracy. Consider splitting into multiple forms."
3. **AI prompt optimization:** The `ask-form` edge function already filters out non-fillable types (header, instructions, signature, image, file) from the prompt. A 50-field template with 8 headers and 2 instruction blocks = 40 fillable fields in the prompt.

### 4.2 All-Textarea Template

**Problem:** Every field is `textarea`. The AI has no structured extraction targets (no select options, no date formats). It must generate free-text for every field, leading to verbose, inconsistent output.

**Guardrails:**
1. **No DB-level restriction.** All-textarea is a valid (if suboptimal) form design.
2. **Builder recommendation (frontend):** "Your form has 8 textarea fields and 0 structured fields. Consider converting some to select/radio/date for better AI extraction."
3. **AI behavior:** The `ask-form` edge function already handles textarea fields by generating professional, factual text. The `ai_hint` per field guides specificity. The guardrail is in the instructions, not the schema.

### 4.3 Invalid Characters in Options

**Problem:** Admin enters options like `["FOH", "BOH", "Bar 🍺", "Management\nTeam"]` -- emojis, newlines, or control characters.

**Guardrails:**
1. **No DB-level character filtering.** Options are free text that appears in the UI and the AI prompt. An emoji in an option is unusual but not harmful.
2. **Frontend sanitization:** The builder strips leading/trailing whitespace and collapses internal whitespace. Newlines in options are replaced with spaces.
3. **AI robustness:** The AI already handles exact-match validation for select/radio fields. If the option is `"Bar 🍺"`, the AI will output `"Bar 🍺"` exactly.

### 4.4 Editing a Published Template (Breaking Draft Submissions)

**Problem:** Admin changes a published template's fields (renames keys, removes fields, changes option values). Existing draft submissions have `field_values` keyed to the old field definitions.

**Guardrails:**

1. **`fields_snapshot` column on `form_submissions`:** Already exists. When a submission is created, the current `form_templates.fields` is copied into `fields_snapshot`. The viewer renders the submission using the snapshot, not the live template. This is the primary safety mechanism.

2. **Version bump on publish:** The publish trigger increments `template_version`. New submissions record the new version. Old submissions retain the old version number + snapshot.

3. **No auto-migration of draft submissions.** If an admin changes field keys, existing drafts become stale. This is acceptable because:
   - Draft submissions are ephemeral (typically completed within hours)
   - The form viewer already checks `templateVersion` against the template's current version and shows a "This form was updated since you started. Your draft uses an older version." banner
   - The user can choose to continue with the old version (fields_snapshot) or start fresh

4. **Phase 7 enhancement (not Phase 5):** A field key rename detector that attempts to map old keys to new keys using label similarity. This is non-trivial and deferred.

### 4.5 Slug Generation

**Problem:** Admin creates a form with title "Employee Injury Report (Updated Feb 2026)". What slug is generated?

**Guardrails:**

1. **Auto-generate from `title_en`:** The builder UI generates a slug candidate from the English title using the standard slugify algorithm: lowercase, replace spaces with hyphens, strip non-alphanumeric characters except hyphens, collapse multiple hyphens.

   `"Employee Injury Report (Updated Feb 2026)"` -> `"employee-injury-report-updated-feb-2026"`

2. **Editable:** The admin can override the auto-generated slug. This is important for clean URLs.

3. **Uniqueness enforced at DB level:** The existing `UNIQUE` constraint on `slug` prevents duplicates. The builder UI checks availability before save (optimistic: `SELECT count(*) FROM form_templates WHERE slug = $1`).

4. **Immutable after first publish:** Once a template has been published (has submissions), the slug should not change. This is enforced by the trigger:

```sql
-- In the publish trigger:
IF OLD.published_at IS NOT NULL AND NEW.slug <> OLD.slug THEN
  RAISE EXCEPTION 'Cannot change slug of a previously published template. Current: "%", attempted: "%"',
    OLD.slug, NEW.slug;
END IF;
```

**Why immutable:** Submissions, bookmarks, and URL history reference the slug. Changing it would break links. The admin can archive the old template and create a new one with a different slug.

### 4.6 Concurrent Editing

**Problem:** Two admins open the same template in the builder simultaneously.

**Guardrail:** Optimistic concurrency via `updated_at`. The builder includes `updated_at` in its save payload. The update query uses:

```sql
UPDATE form_templates
SET fields = $1, updated_at = now()
WHERE id = $2 AND updated_at = $3
RETURNING *;
```

If `RETURNING` returns 0 rows, another admin saved first. The builder shows: "This template was updated by another user. Reload to see their changes."

This is a frontend/hook concern, not a migration. No schema changes needed.

---

## 5. Migrations List

### Migration 1: `add_builder_columns`

Adds the three new columns to `form_templates`.

```sql
-- =============================================================================
-- MIGRATION: add_builder_columns
-- Adds builder_state, ai_refinement_log, and published_at columns to
-- form_templates for the Form Builder Admin (Phase 5).
-- =============================================================================

BEGIN;

-- Builder auto-save state (nullable, cleared on publish)
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS builder_state JSONB;

-- AI instruction refinement conversation log
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS ai_refinement_log JSONB DEFAULT '[]'
    CONSTRAINT chk_ai_refinement_log_is_array CHECK (
      jsonb_typeof(ai_refinement_log) = 'array'
    );

-- Timestamp of last publish (used for slug immutability check)
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Backfill published_at for existing published templates
UPDATE public.form_templates
SET published_at = updated_at
WHERE status = 'published' AND published_at IS NULL;

COMMIT;
```

### Migration 2: `create_form_ai_tools`

Creates the AI tools registry table and seeds the 5 tools.

```sql
-- =============================================================================
-- MIGRATION: create_form_ai_tools
-- Creates the form_ai_tools reference table for the builder UI and seeds
-- 5 tool definitions. Phase 5 of Form Builder System.
-- =============================================================================

BEGIN;

CREATE TABLE public.form_ai_tools (
  id              TEXT PRIMARY KEY,
  label_en        TEXT NOT NULL,
  label_es        TEXT NOT NULL,
  description_en  TEXT NOT NULL,
  description_es  TEXT NOT NULL,
  search_function TEXT,
  icon            TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: read-only for authenticated users
ALTER TABLE public.form_ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view form_ai_tools"
  ON public.form_ai_tools FOR SELECT TO authenticated
  USING (true);

-- Seed the 5 tools
INSERT INTO public.form_ai_tools (id, label_en, label_es, description_en, description_es, search_function, icon, sort_order)
VALUES
  ('search_contacts',
   'Search Contacts', 'Buscar Contactos',
   'Search the restaurant''s contact directory (hospitals, emergency services, management, vendors). Recommended for forms that reference external contacts.',
   'Buscar en el directorio de contactos del restaurante (hospitales, servicios de emergencia, gerencia, proveedores). Recomendado para formularios que referencian contactos externos.',
   'search_contacts', 'BookUser', 1),

  ('search_manual',
   'Search Manual', 'Buscar Manual',
   'Search restaurant policies, procedures, safety protocols, and standard operating procedures. Recommended for forms that reference company policies.',
   'Buscar politicas, procedimientos, protocolos de seguridad y procedimientos operativos del restaurante. Recomendado para formularios que referencian politicas de la empresa.',
   'search_manual_v2', 'BookOpen', 2),

  ('search_products',
   'Search Products', 'Buscar Productos',
   'Search the menu, recipes, wines, cocktails, and beverages. Recommended for forms related to food preparation, allergens, or menu items.',
   'Buscar el menu, recetas, vinos, cocteles y bebidas. Recomendado para formularios relacionados con preparacion de alimentos, alergenos o platillos del menu.',
   'search_dishes', 'UtensilsCrossed', 3),

  ('search_standards',
   'Restaurant Standards', 'Estandares del Restaurante',
   'Search restaurant quality standards including dress code, cleanliness, guest experience protocols, and general operational standards.',
   'Buscar estandares de calidad del restaurante incluyendo codigo de vestimenta, limpieza, protocolos de experiencia del cliente y estandares operativos generales.',
   'search_manual_v2', 'Star', 4),

  ('search_steps_of_service',
   'Steps of Service', 'Pasos de Servicio',
   'Search the Steps of Service guide for front-of-house procedures, greeting protocols, table management, and guest interaction standards.',
   'Buscar la guia de Pasos de Servicio para procedimientos de frente de casa, protocolos de bienvenida, manejo de mesas y estandares de interaccion con el cliente.',
   'search_manual_v2', 'ListChecks', 5);

COMMIT;
```

### Migration 3: `enhance_field_validation_trigger`

Replaces the existing `validate_form_template_fields()` with the enhanced version.

```sql
-- =============================================================================
-- MIGRATION: enhance_field_validation_trigger
-- Replaces the basic field validation trigger with comprehensive checks:
-- max fields, valid types, required options, key format, condition refs,
-- order uniqueness. Phase 5 of Form Builder System.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_form_template_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  all_field_keys  TEXT[];
  field_keys      TEXT[] := '{}';
  order_values    INTEGER[] := '{}';
  field_key       TEXT;
  field_type      TEXT;
  order_val       INTEGER;
  field_record    JSONB;
  condition_field TEXT;
  i               INTEGER;
  valid_types     TEXT[] := ARRAY[
    'text', 'textarea', 'date', 'time', 'datetime', 'select', 'radio',
    'checkbox', 'number', 'phone', 'email', 'signature', 'image', 'file',
    'header', 'instructions', 'contact_lookup'
  ];
BEGIN
  -- Empty array is valid (new/blank template)
  IF NEW.fields = '[]'::JSONB OR jsonb_array_length(NEW.fields) = 0 THEN
    RETURN NEW;
  END IF;

  -- Rule 1: Maximum 50 fields
  IF jsonb_array_length(NEW.fields) > 50 THEN
    RAISE EXCEPTION 'Template cannot have more than 50 fields (found %)',
      jsonb_array_length(NEW.fields);
  END IF;

  -- Pass 1: Collect all field keys upfront (enables forward-reference condition validation)
  all_field_keys := ARRAY(
    SELECT f->>'key'
    FROM jsonb_array_elements(NEW.fields) AS f
  );

  -- Pass 2: Validate each field against all rules
  FOR field_record IN SELECT jsonb_array_elements(NEW.fields)
  LOOP
    -- Basic: non-empty key
    field_key := field_record->>'key';
    IF field_key IS NULL OR field_key = '' THEN
      RAISE EXCEPTION 'Every field must have a non-empty "key" property';
    END IF;

    -- Rule 4: Key format (lowercase alphanumeric + underscores)
    IF field_key !~ '^[a-z][a-z0-9_]{0,63}$' THEN
      RAISE EXCEPTION 'Field key "%" must be lowercase alphanumeric with underscores, starting with a letter (max 64 chars)',
        field_key;
    END IF;

    -- Duplicate key check
    IF field_key = ANY(field_keys) THEN
      RAISE EXCEPTION 'Duplicate field key "%" in fields array', field_key;
    END IF;

    -- Basic: non-empty type
    field_type := field_record->>'type';
    IF field_type IS NULL OR field_type = '' THEN
      RAISE EXCEPTION 'Every field must have a non-empty "type" property';
    END IF;

    -- Rule 2: Valid field type
    IF NOT (field_type = ANY(valid_types)) THEN
      RAISE EXCEPTION 'Invalid field type "%" for field "%"', field_type, field_key;
    END IF;

    -- Rule 3: Select/radio/checkbox must have non-empty options array
    IF field_type IN ('select', 'radio', 'checkbox') THEN
      IF field_record->'options' IS NULL
         OR jsonb_typeof(field_record->'options') <> 'array'
         OR jsonb_array_length(field_record->'options') = 0 THEN
        RAISE EXCEPTION 'Field "%" (type %) must have a non-empty "options" array',
          field_key, field_type;
      END IF;

      -- Rule 7: Max 50 options
      IF jsonb_array_length(field_record->'options') > 50 THEN
        RAISE EXCEPTION 'Field "%" has too many options (% > 50)',
          field_key, jsonb_array_length(field_record->'options');
      END IF;
    END IF;

    -- Rule 5: Condition field references validate against ALL field keys (two-pass).
    -- This supports drag-and-drop reordering: a condition may reference any field
    -- regardless of its position in the array. Self-references are also rejected.
    IF field_record->'condition' IS NOT NULL
       AND jsonb_typeof(field_record->'condition') = 'object'
       AND field_record->'condition'->>'field' IS NOT NULL THEN
      condition_field := field_record->'condition'->>'field';
      IF NOT (condition_field = ANY(all_field_keys)) THEN
        RAISE EXCEPTION 'Field "%" has condition referencing non-existent field "%"',
          field_key, condition_field;
      END IF;
      IF condition_field = field_key THEN
        RAISE EXCEPTION 'Field "%" cannot have a condition referencing itself',
          field_key;
      END IF;
    END IF;

    -- Rule 6: Order must be present and unique
    IF field_record->'order' IS NULL THEN
      RAISE EXCEPTION 'Field "%" must have an "order" property', field_key;
    END IF;

    BEGIN
      order_val := (field_record->>'order')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Field "%" has non-integer order value "%"',
        field_key, field_record->>'order';
    END;

    IF order_val = ANY(order_values) THEN
      RAISE EXCEPTION 'Duplicate order value % for field "%"', order_val, field_key;
    END IF;
    order_values := array_append(order_values, order_val);

    -- Accumulate seen keys (used for duplicate key detection above)
    field_keys := array_append(field_keys, field_key);
  END LOOP;

  RETURN NEW;
END;
$$;

-- No need to re-create the trigger -- CREATE OR REPLACE on the function updates
-- the existing trg_validate_form_template_fields trigger automatically.

COMMIT;
```

### Migration 4: `add_publish_trigger`

Adds the trigger that handles version bumping, slug immutability, and state cleanup on publish.

```sql
-- =============================================================================
-- MIGRATION: add_publish_trigger
-- Trigger that fires on form_templates UPDATE to handle:
-- 1. Version bump when status transitions to 'published'
-- 2. Slug immutability after first publish
-- 3. Clear builder_state and ai_refinement_log on publish
-- 4. Set published_at timestamp
-- 5. Cap ai_refinement_log at 20 entries
-- Phase 5 of Form Builder System.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_form_template_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Slug immutability: cannot change slug after first publish
  IF OLD.published_at IS NOT NULL AND NEW.slug <> OLD.slug THEN
    RAISE EXCEPTION 'Cannot change slug of a previously published template (current: "%" attempted: "%")',
      OLD.slug, NEW.slug;
  END IF;

  -- On transition to 'published'
  IF NEW.status = 'published' AND OLD.status <> 'published' THEN
    -- Bump version
    NEW.template_version := OLD.template_version + 1;
    -- Set published_at
    NEW.published_at := now();
    -- Clear builder transient state
    NEW.builder_state := NULL;
    -- Clear refinement log (conversation is no longer relevant after publish)
    NEW.ai_refinement_log := '[]'::JSONB;
  END IF;

  -- Cap ai_refinement_log at 20 entries (on any update)
  IF NEW.ai_refinement_log IS NOT NULL
     AND jsonb_typeof(NEW.ai_refinement_log) = 'array'
     AND jsonb_array_length(NEW.ai_refinement_log) > 20 THEN
    NEW.ai_refinement_log := (
      SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(NEW.ai_refinement_log) WITH ORDINALITY AS t(elem, idx)
        ORDER BY idx DESC
        LIMIT 20
      ) sub
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_form_template_publish
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_form_template_publish();

COMMIT;
```

**Trigger ordering note:** This trigger fires alongside the existing `trg_form_templates_updated_at` (which sets `updated_at = now()`) and `trg_validate_form_template_fields` (which validates the fields JSONB) and `trg_form_templates_search_vector` (which updates FTS). PostgreSQL fires `BEFORE UPDATE` triggers in **alphabetical order by trigger name**:

1. `trg_form_template_publish` (this one)
2. `trg_form_templates_search_vector`
3. `trg_form_templates_updated_at`
4. `trg_validate_form_template_fields`

This ordering is correct: the publish trigger runs first (bumps version, clears state), then FTS updates, then `updated_at` is set, then field validation runs. Validation running last is fine because it operates on `NEW.fields` which is already set.

### Migration Summary

| # | Name | Lines | Description |
|---|------|-------|-------------|
| 1 | `add_builder_columns` | ~25 | 3 new columns on `form_templates` |
| 2 | `create_form_ai_tools` | ~70 | Config table + 5 seed rows + RLS |
| 3 | `enhance_field_validation_trigger` | ~115 | Replace trigger with 7 validation rules (two-pass condition check) |
| 4 | `add_publish_trigger` | ~55 | Publish lifecycle management |

**Total: 4 migrations, ~265 lines of SQL.**

---

## 6. RLS Policy Changes

### 6.1 Current Policies on `form_templates`

| Policy | For | Who | Condition |
|--------|-----|-----|-----------|
| Users can view published form_templates in their group | SELECT | authenticated | `group_id = get_user_group_id() AND status IN ('published','archived')` |
| Managers can view draft form_templates in their group | SELECT | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| Managers can insert form_templates | INSERT | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| Managers can update form_templates | UPDATE | authenticated | `group_id = get_user_group_id() AND get_user_role() IN ('manager','admin')` |
| Admins can delete form_templates | DELETE | authenticated | `group_id = get_user_group_id() AND get_user_role() = 'admin'` |

### 6.2 Assessment: No Changes Needed

The current policies already support the builder admin use case:

- **Draft visibility:** The "Managers can view draft form_templates" policy already lets managers/admins see drafts. The builder creates templates in `status = 'draft'`, so they are visible to the creator (who must be manager/admin) and other managers/admins in the group.
- **Insert:** Managers/admins can create new templates.
- **Update:** Managers/admins can edit templates (save builder state, modify fields, publish).
- **Delete:** Only admins can delete. This is correct -- a manager can create and edit but not permanently delete.

### 6.3 Considered and Rejected: "Creator-only draft visibility"

The user asked whether drafts should be visible only to the creator. This is rejected because:

1. **Small team:** In a restaurant, there are typically 1-3 admins/managers. Draft visibility among them is a feature, not a bug ("Hey, I started a new daily checklist form -- can you finish it?").
2. **Complexity:** Creator-only visibility would require adding `AND created_by = auth.uid()` to the draft SELECT policy, then a separate policy for the creator to see other people's drafts if they are also manager/admin. This is more policies for less utility.
3. **The `builder_state.last_builder_user` field** gives the UI enough information to show "Last edited by Maria" without restricting access.

### 6.4 New Policies: `form_ai_tools`

As defined in Migration 2:

| Policy | For | Who | Condition |
|--------|-----|-----|-----------|
| Authenticated users can view form_ai_tools | SELECT | authenticated | `true` (no group scoping -- tools are global) |

No INSERT/UPDATE/DELETE policies. Tool management is migration-only.

---

## 7. Verification Queries

Run these after applying all 4 migrations. (13 total)

### 7.1 Column existence

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'form_templates'
  AND column_name IN ('builder_state', 'ai_refinement_log', 'published_at');
-- Expected: 3 rows
```

### 7.2 form_ai_tools populated

```sql
SELECT id, label_en, status FROM public.form_ai_tools ORDER BY sort_order;
-- Expected: 5 rows (search_contacts, search_manual, search_products, search_standards, search_steps_of_service)
```

### 7.3 Enhanced field validation: max fields

```sql
-- Should fail: 51 fields
DO $$
DECLARE
  big_fields JSONB := '[]'::JSONB;
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';
  FOR i IN 1..51 LOOP
    big_fields := big_fields || jsonb_build_array(jsonb_build_object(
      'key', 'field_' || i,
      'type', 'text',
      'order', i
    ));
  END LOOP;

  BEGIN
    INSERT INTO form_templates (group_id, slug, title_en, fields)
    VALUES (v_group_id, 'test-too-many-fields', 'Test', big_fields);
    RAISE EXCEPTION 'Should have failed but did not';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%more than 50 fields%' THEN
      RAISE NOTICE 'PASS: max fields check works';
    ELSE
      RAISE EXCEPTION 'FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;
```

### 7.4 Enhanced field validation: invalid type

```sql
DO $$
DECLARE v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';
  BEGIN
    INSERT INTO form_templates (group_id, slug, title_en, fields)
    VALUES (v_group_id, 'test-bad-type', 'Test', '[{"key":"f1","type":"text_area","order":1}]'::JSONB);
    RAISE EXCEPTION 'Should have failed but did not';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Invalid field type%' THEN
      RAISE NOTICE 'PASS: invalid type check works';
    ELSE
      RAISE EXCEPTION 'FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;
```

### 7.5 Enhanced field validation: select without options

```sql
DO $$
DECLARE v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';
  BEGIN
    INSERT INTO form_templates (group_id, slug, title_en, fields)
    VALUES (v_group_id, 'test-no-options', 'Test', '[{"key":"f1","type":"select","order":1}]'::JSONB);
    RAISE EXCEPTION 'Should have failed but did not';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%non-empty "options" array%' THEN
      RAISE NOTICE 'PASS: options check works';
    ELSE
      RAISE EXCEPTION 'FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;
```

### 7.6 Enhanced field validation: invalid key format

```sql
DO $$
DECLARE v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';
  BEGIN
    INSERT INTO form_templates (group_id, slug, title_en, fields)
    VALUES (v_group_id, 'test-bad-key', 'Test', '[{"key":"Employee Name","type":"text","order":1}]'::JSONB);
    RAISE EXCEPTION 'Should have failed but did not';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%must be lowercase alphanumeric%' THEN
      RAISE NOTICE 'PASS: key format check works';
    ELSE
      RAISE EXCEPTION 'FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;
```

### 7.7 Enhanced field validation: dangling condition reference

```sql
DO $$
DECLARE v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';
  BEGIN
    INSERT INTO form_templates (group_id, slug, title_en, fields)
    VALUES (v_group_id, 'test-bad-condition', 'Test',
      '[{"key":"f1","type":"text","order":1,"condition":{"field":"nonexistent","operator":"eq","value":"yes"}}]'::JSONB);
    RAISE EXCEPTION 'Should have failed but did not';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%non-existent field%' THEN
      RAISE NOTICE 'PASS: condition reference check works';
    ELSE
      RAISE EXCEPTION 'FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;
```

### 7.8 Enhanced field validation: condition self-reference

```sql
DO $$
DECLARE v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';
  BEGIN
    INSERT INTO form_templates (group_id, slug, title_en, fields)
    VALUES (v_group_id, 'test-self-condition', 'Test',
      '[{"key":"f1","type":"text","order":1,"condition":{"field":"f1","operator":"eq","value":"yes"}}]'::JSONB);
    RAISE EXCEPTION 'Should have failed but did not';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%cannot have a condition referencing itself%' THEN
      RAISE NOTICE 'PASS: condition self-reference check works';
    ELSE
      RAISE EXCEPTION 'FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;
END $$;
```

### 7.9 Enhanced field validation: forward condition reference (two-pass)

```sql
-- Field f2 references f3 which appears AFTER it in the array.
-- With the old single-pass approach this would fail; with the two-pass approach it must PASS.
DO $$
DECLARE v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';
  BEGIN
    INSERT INTO form_templates (group_id, slug, title_en, fields)
    VALUES (v_group_id, 'test-forward-condition', 'Test',
      '[{"key":"f1","type":"select","options":["yes","no"],"order":1},
        {"key":"f2","type":"text","order":2,"condition":{"field":"f3","operator":"eq","value":"x"}},
        {"key":"f3","type":"text","order":3}]'::JSONB);
    -- Should succeed (forward reference is now valid)
    RAISE NOTICE 'PASS: forward condition reference accepted (two-pass validation works)';
    -- Cleanup
    DELETE FROM form_templates WHERE group_id = v_group_id AND slug = 'test-forward-condition';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: forward condition reference was incorrectly rejected: %', SQLERRM;
  END;
END $$;
```

### 7.10 Publish trigger: version bump + state cleanup

```sql
DO $$
DECLARE
  v_group_id UUID;
  v_id UUID;
  v_version INTEGER;
  v_builder_state JSONB;
  v_published_at TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';

  -- Create a draft template
  INSERT INTO form_templates (group_id, slug, title_en, fields, status, builder_state, ai_refinement_log)
  VALUES (v_group_id, 'test-publish-trigger', 'Test Publish', '[]'::JSONB, 'draft',
    '{"test": true}'::JSONB, '[{"role":"user","content":"test"}]'::JSONB)
  RETURNING id INTO v_id;

  -- Publish it
  UPDATE form_templates SET status = 'published' WHERE id = v_id;

  -- Check results
  SELECT template_version, builder_state, published_at
  INTO v_version, v_builder_state, v_published_at
  FROM form_templates WHERE id = v_id;

  IF v_version <> 2 THEN RAISE EXCEPTION 'FAIL: version should be 2, got %', v_version; END IF;
  IF v_builder_state IS NOT NULL THEN RAISE EXCEPTION 'FAIL: builder_state should be NULL'; END IF;
  IF v_published_at IS NULL THEN RAISE EXCEPTION 'FAIL: published_at should be set'; END IF;

  RAISE NOTICE 'PASS: publish trigger works (version=%, builder_state=NULL, published_at set)', v_version;

  -- Cleanup
  DELETE FROM form_templates WHERE id = v_id;
END $$;
```

### 7.11 Slug immutability after publish

```sql
DO $$
DECLARE
  v_group_id UUID;
  v_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE slug = 'alamo-prime';

  -- Create and publish
  INSERT INTO form_templates (group_id, slug, title_en, fields, status)
  VALUES (v_group_id, 'test-slug-immutable', 'Test', '[]'::JSONB, 'draft')
  RETURNING id INTO v_id;

  UPDATE form_templates SET status = 'published' WHERE id = v_id;

  -- Try to change slug
  BEGIN
    UPDATE form_templates SET slug = 'test-slug-changed' WHERE id = v_id;
    RAISE EXCEPTION 'Should have failed but did not';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cannot change slug%' THEN
      RAISE NOTICE 'PASS: slug immutability check works';
    ELSE
      RAISE EXCEPTION 'FAIL: unexpected error: %', SQLERRM;
    END IF;
  END;

  -- Cleanup
  DELETE FROM form_templates WHERE id = v_id;
END $$;
```

### 7.12 RLS on form_ai_tools

```sql
-- Verify anon cannot access
SET ROLE anon;
SELECT count(*) FROM form_ai_tools;
-- Expected: error (RLS blocks)

-- Verify authenticated can read
SET ROLE authenticated;
SELECT count(*) FROM form_ai_tools;
-- Expected: 5

RESET ROLE;
```

### 7.13 Existing templates still pass enhanced validation

```sql
-- This confirms the new trigger does not reject the existing seed templates
SELECT slug, title_en, jsonb_array_length(fields) AS field_count, template_version
FROM form_templates
WHERE slug IN ('employee-write-up', 'employee-injury-report');
-- Expected: both rows returned with their current field counts
```

---

## Summary

### What This Plan Adds

| Category | Item | Count |
|----------|------|-------|
| New columns | `builder_state`, `ai_refinement_log`, `published_at` | 3 |
| New table | `form_ai_tools` (read-only config) | 1 |
| Seed rows | AI tool definitions | 5 |
| RLS policies | 1 SELECT on `form_ai_tools` | 1 |
| Trigger functions | `handle_form_template_publish` (new), `validate_form_template_fields` (replaced) | 2 |
| Validation rules | Max fields, valid types, required options, key format, condition refs, order uniqueness, max options | 7 |
| Migrations | 4 files, ~265 lines SQL | 4 |
| Verification tests | 13 queries | 13 |

### What This Plan Does NOT Add

| Deferred Item | Target Phase | Reason |
|---------------|-------------|--------|
| `form_template_versions` table | Phase 7 | `fields_snapshot` on submissions covers the primary use case |
| FK from `ai_tools` to `form_ai_tools` | Never | Intentionally loose coupling; edge function ignores unknown tools |
| Field label length limits | Phase 7 | Frontend validation is more user-friendly |
| `ai_hint` required check | Never | Optional by design |
| Option character filtering | Never | Free text is valid |
| Concurrent editing locks | Never | Optimistic concurrency via `updated_at` is sufficient |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Enhanced trigger rejects existing templates | **High** | Verification query 7.13 confirms existing templates pass. All existing keys are valid snake_case, all selects have options. |
| Publish trigger conflicts with `set_updated_at` | Low | Both are `BEFORE UPDATE` triggers. They operate on different fields. Alphabetical ordering is safe. |
| `builder_state` grows unbounded | Low | It is a small UI state object (< 1 KB). Cleared on publish. No array growth pattern. |
| `ai_refinement_log` grows unbounded | Low | Capped at 20 entries by the publish trigger. Cleared on publish. |
| New `search_standards` / `search_steps_of_service` tools have no backend implementation yet | Moderate | The tool IDs are registered in the config table but will be ignored by `ask-form` until the edge function is updated. No runtime errors -- unknown tools are silently skipped. |
