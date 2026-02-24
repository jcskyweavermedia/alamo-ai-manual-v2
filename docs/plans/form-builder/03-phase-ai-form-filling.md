# Phase 3: AI-Assisted Form Filling — Unified Implementation Plan

> **Status:** Planning
> **Date:** 2026-02-24
> **Estimated effort:** ~2 sessions
> **Dependencies:** Phase 1 (DB Foundation, complete) + Phase 2 (Form Viewer, complete)
> **Output:** 3 migrations, 1 edge function, 1 hook, 10+ frontend components, modified FormDetail page
> **Authors:** Senior Database Architect, Technical Architect, Senior UX/UI Designer, Devil's Advocate (all Opus)

---

## Table of Contents

### Part I — Database & Backend
1. [Schema Assessment](#i1-schema-assessment)
2. [Migration 1: Extend chat_sessions](#i2-migration-1-extend-chat_sessions-for-form-context)
3. [Migration 2: Seed ai_prompts](#i3-migration-2-seed-ai_prompts-for-forms-domain)
4. [Migration 3: Enhance search_contacts](#i4-migration-3-enhance-search_contacts-return-columns)
5. [No New Tables Needed](#i5-no-new-tables-needed-and-why)
6. [ai_session_id Design](#i6-ai_session_id-design)
7. [Conversation History Strategy](#i7-conversation-history-strategy)
8. [Attachments During AI Fill](#i8-attachments-during-ai-fill)
9. [Template Reading from Edge Function](#i9-template-reading-from-edge-function)
10. [Usage Limit Strategy](#i10-usage-limit-strategy)
11. [Concurrency Analysis](#i11-concurrency-analysis)
12. [Performance Considerations](#i12-performance-considerations)
13. [Storage Path Convention](#i13-storage-path-convention)
14. [Edge Function Backend Design](#i14-edge-function-ask-form-backend-design)
15. [Migration Summary](#i15-migration-summary)
16. [Verification Queries](#i16-verification-queries)

### Part II — Technical Architecture
1. [System Prompt Design](#ii1-system-prompt-design)
2. [Tool Definitions](#ii2-tool-definitions)
3. [Field Extraction Strategy](#ii3-field-extraction-strategy)
4. [Multi-Turn Conversation](#ii4-multi-turn-conversation)
5. [Voice Input Flow](#ii5-voice-input-flow)
6. [Image and File Input](#ii6-image-and-file-input)
7. [Error Handling](#ii7-error-handling)
8. [Usage Limits](#ii8-usage-limits)
9. [Response Format](#ii9-response-format)
10. [Security](#ii10-security)
11. [Edge Function: ask-form](#ii11-edge-function-ask-form)

### Part III — Frontend: Hook & Components
1. [Frontend Hook: useAskForm](#iii1-frontend-hook-useaskform)
2. [Frontend Components](#iii2-frontend-components)
3. [Integration with FormDetail](#iii3-integration-with-formdetail)

### Part IV — UX/UI Design Specification
1. [Design Principles](#iv1-design-principles)
2. [AI Fill Button Placement](#iv2-ai-fill-button-placement)
3. [Desktop AI Panel — Docked Split View](#iv3-desktop-ai-panel--docked-split-view)
4. [Mobile AI Drawer — Bottom Sheet](#iv4-mobile-ai-drawer--bottom-sheet)
5. [Multi-Modal Input Bar](#iv5-multi-modal-input-bar)
6. [AI Response Display — Extracted Fields Card](#iv6-ai-response-display--extracted-fields-card)
7. [Apply-to-Form Flow](#iv7-apply-to-form-flow)
8. [Field Highlight Animation](#iv8-field-highlight-animation)
9. [Missing Field Indicators](#iv9-missing-field-indicators)
10. [Follow-Up Question Flow](#iv10-follow-up-question-flow)
11. [Mobile-Specific Concerns](#iv11-mobile-specific-concerns)
12. [New CSS Additions](#iv12-new-css-additions)
13. [Component File Map](#iv13-component-file-map)
14. [ASCII Mockups](#iv14-ascii-mockups)
15. [Accessibility Checklist](#iv15-accessibility-checklist)
16. [Design Decision Log](#iv16-design-decision-log)

### Part V — Risks & Edge Cases (Devil's Advocate)
- [Risk Assessment Matrix](#v-risk-assessment-matrix)
- [R1–R34: All Risks](#v1-ai-field-extraction-accuracy)
- [Summary by Priority](#v-summary-by-priority)
- [Recommendations for Implementation](#v-recommendations-for-the-implementation-plan)

### Part VI — File Manifest & Verification Plan
1. [Unified File Manifest](#vi1-unified-file-manifest)
2. [Unified Verification Plan](#vi2-unified-verification-plan)
3. [Existing Code References](#vi3-existing-code-references)

---
---

# Part I — Database & Backend

> **Scope:** Database migrations, RPC functions, edge function backend design, storage policies — everything the `ask-form` edge function and frontend hooks need

---

## I.1. Schema Assessment

### What Already Exists and Is Sufficient

The Phase 1 schema was designed with Phase 3 in mind. The following need **no changes:**

| Table / Object | Phase 3 Relevance | Changes Needed |
|---|---|---|
| `form_templates` | Edge function reads `fields`, `instructions_en/es`, `ai_tools` by template ID | **None** -- all columns present |
| `form_templates.ai_tools` | `TEXT[]` -- `{'search_contacts','search_manual'}` etc. | **None** -- edge function reads this array to enable tools |
| `form_templates.instructions_en/es` | AI system prompt includes these | **None** |
| `form_templates.fields` JSONB | Edge function reads field definitions (key, type, ai_hint, required, options) to build structured extraction prompt | **None** |
| `form_submissions` | Draft creation, field_values updates, ai_session_id storage | **None** -- all columns present |
| `form_submissions.ai_session_id` | Links to `chat_sessions.id` | **None** -- column exists as `TEXT` (see Section I.6) |
| `form_submissions.field_values` | AI writes extracted values here via frontend | **None** -- JSONB `{}` default is correct |
| `form_submissions.attachments` | AI vision uploads stored here | **None** -- JSONB `[]` default is correct |
| `contacts` | `search_contacts` RPC called as AI tool | **None** |
| `form-attachments` bucket | AI vision image uploads | **None** -- private bucket, authenticated upload policy |
| `search_forms` RPC | Used by Phase 4 (main chat integration), not Phase 3 | **None** |
| `search_contacts` RPC | Called by `ask-form` edge function as a tool | **Minor enhancement** (Section I.4) |
| `get_user_usage` / `increment_usage` RPCs | Usage limit check/increment | **None** |
| Storage RLS policies | Upload/read for authenticated, delete for admin | **None** |
| `form_submissions` RLS | Users create/update own drafts, managers see group | **None** |

### What Needs Changes (3 Migrations)

| # | Migration | Reason |
|---|---|---|
| 1 | Extend `chat_sessions.context_type` CHECK constraint | Add `'forms'` so form AI conversations use the existing session infrastructure |
| 2 | Seed `ai_prompts` rows for the forms domain | `ask-form` loads its system prompt from `ai_prompts`, consistent with the unified `/ask` pattern |
| 3 | Enhance `search_contacts` return columns | Add `email` and `notes` -- the AI needs these when recommending contacts during form filling |

**Total: 3 small migrations. Zero new tables. Zero new columns on existing tables.**

---

## I.2. Migration 1: Extend `chat_sessions` for Form Context

### Problem

The `chat_sessions` table has a CHECK constraint restricting `context_type` to:

```sql
CHECK (context_type IN (
  'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor'
))
```

The `ask-form` edge function needs to create chat sessions with `context_type = 'forms'` so form AI conversations are properly segmented, history is isolated per form, and sessions auto-expire independently from manual/product sessions.

### Why Use `chat_sessions` Instead of a New Table

The existing `chat_sessions` + `chat_messages` infrastructure provides:
- Session creation/reuse via `get_or_create_chat_session`
- History loading with token-aware truncation via `get_chat_history`
- Stale session cleanup via `close_stale_sessions`
- RLS (user-private sessions, admin read-all)
- Message persistence (user + assistant + tool roles)

Building a parallel `form_ai_sessions` table would duplicate all of this. The only change needed is adding `'forms'` to the `context_type` enum.

### SQL

```sql
-- =============================================================================
-- MIGRATION: extend_chat_sessions_for_forms
-- Adds 'forms' to the chat_sessions.context_type CHECK constraint so the
-- ask-form edge function can use the existing session infrastructure.
-- Also adds 'forms' to ai_prompts.domain_check.
-- =============================================================================

BEGIN;

-- Drop and recreate the context_type CHECK constraint
ALTER TABLE public.chat_sessions
  DROP CONSTRAINT chat_sessions_context_type_check;

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_context_type_check
  CHECK (context_type IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor', 'forms'
  ));

-- Also extend ai_prompts.domain_check to allow 'forms' domain
ALTER TABLE public.ai_prompts
  DROP CONSTRAINT ai_prompts_domain_check;

ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_domain_check
  CHECK (domain IS NULL OR domain IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor', 'forms'
  ));

COMMIT;
```

### Notes

- `ALTER TABLE ... DROP CONSTRAINT` + `ADD CONSTRAINT` is the standard PostgreSQL pattern for modifying CHECK constraints. There is no `ALTER CONSTRAINT`.
- This is backward-compatible: existing rows are unaffected.
- The `get_or_create_chat_session` function uses the `context_type` parameter directly -- it does not validate against a hardcoded list, so no function changes are needed.

---

## I.3. Migration 2: Seed `ai_prompts` for Forms Domain

### Why

The unified `/ask` edge function loads its system prompt from the `ai_prompts` table by slug convention: `base-persona`, `domain-{domain}`, `tool-map`, `behavior-rules`. The `ask-form` edge function follows the same convention. This keeps prompts in the database (editable by admin without redeployment) and maintains consistency with the existing AI architecture.

### Prompt Design

The form AI assistant has a fundamentally different job than the manual/product AI. It needs to:

1. **Understand form structure** -- parse field definitions, types, required fields, ai_hints
2. **Extract structured data** -- from unstructured user input (text, voice transcript, image description)
3. **Map to specific field keys** -- output must be a valid `field_values` JSONB object
4. **Use form-specific tools** -- only the tools enabled in `form_templates.ai_tools`
5. **Follow form instructions** -- read `instructions_en/es` as step-by-step guidance
6. **Identify missing required fields** -- and ask follow-up questions

This is structured extraction, not conversational QA. The system prompt must be precise about output format.

### SQL

```sql
-- =============================================================================
-- MIGRATION: seed_form_ai_prompts
-- Adds ai_prompts rows for the forms domain used by the ask-form edge function.
-- Follows the same slug convention as other domains:
--   domain-forms       (domain context + extraction rules)
--   form-tool-map      (tool descriptions specific to form filling)
-- =============================================================================

BEGIN;

INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, sort_order)
VALUES
  -- Domain prompt: sets the overall context for the form AI
  ('domain-forms', 'domain', 'forms',
   E'You are an AI assistant helping a restaurant manager fill out an operational form. Your job is to extract structured field values from the user''s unstructured description of a situation.\n\nYou will be given:\n1. The form''s field definitions (field key, type, label, required, options, ai_hint)\n2. The form''s step-by-step instructions\n3. Any values already filled in\n4. The user''s description of the situation\n\nYour output must be a JSON object with two keys:\n- "fieldUpdates": an object mapping field keys to extracted values\n- "followUpQuestion": a string asking about missing required fields (or null if all required fields are filled)\n\nRules for extraction:\n- Match extracted values to the correct field key using the ai_hint and label as guidance\n- For "select" fields, only use values from the provided options array\n- For "radio" fields, only use values from the provided options array\n- For "checkbox" fields, return an array of selected option strings\n- For "date" fields, return ISO format (YYYY-MM-DD). If the user says "today", use the current date.\n- For "time" fields, return 24-hour format (HH:MM)\n- For "contact_lookup" fields, use the search_contacts tool to find the contact and return the contact object\n- Never invent information not present in the user''s input\n- If a required field cannot be determined from the input, include it in your follow-up question\n- Be factual and professional -- these are legal/compliance documents',
   E'Eres un asistente de IA ayudando a un gerente de restaurante a llenar un formulario operativo. Tu trabajo es extraer valores de campos estructurados de la descripcion no estructurada del usuario sobre una situacion.\n\nSe te dara:\n1. Las definiciones de campos del formulario (clave, tipo, etiqueta, requerido, opciones, ai_hint)\n2. Las instrucciones paso a paso del formulario\n3. Cualquier valor ya llenado\n4. La descripcion del usuario de la situacion\n\nTu salida debe ser un objeto JSON con dos claves:\n- "fieldUpdates": un objeto mapeando claves de campo a valores extraidos\n- "followUpQuestion": una cadena preguntando sobre campos requeridos faltantes (o null si todos estan llenos)\n\nReglas de extraccion:\n- Empata los valores extraidos con la clave de campo correcta usando el ai_hint y label como guia\n- Para campos "select", solo usa valores del array de opciones proporcionado\n- Para campos "radio", solo usa valores del array de opciones proporcionado\n- Para campos "checkbox", retorna un array de cadenas de opciones seleccionadas\n- Para campos "date", retorna formato ISO (YYYY-MM-DD). Si el usuario dice "hoy", usa la fecha actual.\n- Para campos "time", retorna formato 24 horas (HH:MM)\n- Para campos "contact_lookup", usa la herramienta search_contacts para encontrar el contacto\n- Nunca inventes informacion no presente en la entrada del usuario\n- Si un campo requerido no puede determinarse, incluyelo en tu pregunta de seguimiento\n- Se factual y profesional -- estos son documentos legales/de cumplimiento',
   10);

-- Form-specific tool map (loaded alongside generic tool-map for form context)
INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, sort_order)
VALUES
  ('form-tool-map', 'system', NULL,
   E'During form filling, you have access to these tools based on the form''s ai_tools configuration:\n\n- search_contacts(query, category?): Search the restaurant''s contact directory (hospitals, managers, vendors, emergency services). Use when the form has contact_lookup fields or the instructions mention finding contact information.\n- search_manual(query): Search the operations manual for SOPs, policies, and procedures. Use when the form instructions reference company policies or standard procedures.\n- search_products(query, domain): Search product databases (dishes, wines, cocktails, recipes, beer/liquor). Use when the form relates to food safety, menu items, or product-related incidents.\n\nOnly call tools that are listed in the form''s enabled ai_tools. Do not call tools that are not enabled for this form.',
   E'Durante el llenado de formularios, tienes acceso a estas herramientas segun la configuracion ai_tools del formulario:\n\n- search_contacts(query, category?): Buscar en el directorio de contactos del restaurante (hospitales, gerentes, proveedores, servicios de emergencia). Usar cuando el formulario tiene campos contact_lookup o las instrucciones mencionan encontrar informacion de contacto.\n- search_manual(query): Buscar en el manual de operaciones SOPs, politicas y procedimientos. Usar cuando las instrucciones del formulario referencian politicas de la empresa o procedimientos estandar.\n- search_products(query, domain): Buscar bases de datos de productos (platillos, vinos, cocteles, recetas, cerveza/licor). Usar cuando el formulario se relaciona con seguridad alimentaria, items del menu o incidentes relacionados con productos.\n\nSolo llama herramientas que esten listadas en los ai_tools habilitados del formulario. No llames herramientas que no esten habilitadas para este formulario.',
   3);

COMMIT;
```

### Notes

- `domain-forms` uses `category = 'domain'`, `domain = 'forms'` -- follows the exact pattern of `domain-manual`, `domain-dishes`, etc.
- `form-tool-map` uses `category = 'system'`, `domain = NULL` -- it is a shared system prompt, not domain-scoped.
- No action prompts are seeded because form AI has a single mode (multi-turn structured extraction), not button-press actions like product AI.

---

## I.4. Migration 3: Enhance `search_contacts` Return Columns

### Problem

The current `search_contacts` RPC returns:

```sql
RETURNS TABLE (
  id, name, category, subcategory, phone, contact_person, address, is_demo_data, score
)
```

Missing: `email` and `notes`. When the AI searches for a hospital contact during injury form filling, it needs the full contact record to present useful results.

### SQL

```sql
-- =============================================================================
-- MIGRATION: enhance_search_contacts
-- Adds email and notes to the search_contacts return columns.
-- =============================================================================

BEGIN;

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
  email           TEXT,
  notes           TEXT,
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
  ts_query := plainto_tsquery('simple', search_query);

  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.category,
    ct.subcategory,
    ct.phone,
    ct.contact_person,
    ct.address,
    ct.email,
    ct.notes,
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

COMMIT;
```

### Notes

- `CREATE OR REPLACE FUNCTION` replaces the existing function in-place.
- Adding columns to RETURNS TABLE is safe -- existing callers are unaffected.
- `SECURITY DEFINER` + `SET search_path` preserved from the original.

---

## I.5. No New Tables Needed (and Why)

### Why No `form_ai_conversations` Table?

The `form_submissions.ai_session_id TEXT` column links a submission to a `chat_sessions` row. Conversation messages are stored in `chat_messages`. This gives us full conversation persistence, token-aware history loading, session auto-expiry (4 hours), admin visibility, and message persistence.

### Why No `form_ai_field_extractions` Table?

The conversation itself (in `chat_messages`) provides a complete audit trail. The `field_values` JSONB on `form_submissions` is the source of truth. If per-field audit becomes a Phase 7 requirement, it can be added as a supplementary table.

### Why No `form_ai_tool_calls` Table?

Tool call results are already stored in `chat_messages` as `role = 'tool'` messages with the `tool_call_id` reference.

---

## I.6. `ai_session_id` Design

### Column: `form_submissions.ai_session_id TEXT`

This column already exists. It stores the UUID of the `chat_sessions` row that tracks the AI conversation used to fill this form.

### Lifecycle

```
1. User opens form --> creates draft submission (ai_session_id = NULL)
2. User clicks [AI Fill] --> frontend calls ask-form edge function
3. Edge function calls get_or_create_chat_session(
     _user_id, _group_id,
     _context_type = 'forms',
     _context_id = template_id::TEXT,
     _mode = 'text'
   )
4. Edge function returns sessionId in response
5. Frontend writes sessionId to submission:
     UPDATE form_submissions SET ai_session_id = :sessionId WHERE id = :submissionId
6. Subsequent AI turns reuse the same session (get_or_create finds the active session)
7. Session expires after 4 hours of inactivity (standard behavior)
```

### Why `TEXT` Not `UUID REFERENCES`?

1. **No FK constraint** -- The session can be closed/deleted independently of the submission.
2. **Soft reference** -- If the session is deleted, the submission remains valid.
3. **Flexibility** -- If we later switch session mechanisms, the column type does not need to change.

---

## I.7. Conversation History Strategy

### Approach: Use Existing `chat_sessions` + `chat_messages`

```
1. get_or_create_chat_session --> session_id
2. get_chat_history(session_id, 20, 4000) --> recent messages
3. Build messages array: [system_prompt, ...history, user_message]
4. Call OpenAI with tools
5. Persist user message + AI response to chat_messages
6. Return extraction results to frontend
```

### Multi-Turn Context

```
Turn 1: "John cut his hand on the slicer at 3pm"
  AI extracts: employee_name="John", description="...", time="15:00",
               injury_type="Cut/Laceration", body_parts=["Hand"]
  AI asks: "What is John's last name and position?"

Turn 2: "He's John Smith, a line cook"
  AI extracts: employee_name="John Smith", position="Line Cook"
  AI calls search_contacts --> finds hospital + regional manager
  AI asks: "Was 911 called? Was he transported to the hospital?"

Turn 3: "No to both, we did first aid on site"
  AI extracts: called_911="No", transported_to_hospital="No",
               first_aid="First aid administered on site"
```

### Voice + Image Turns

Voice input is transcribed by `/transcribe` BEFORE hitting `ask-form`. Image input is processed by `/ingest-vision` which returns text. The edge function always receives text.

---

## I.8. Attachments During AI Fill

### Answer: Same `form-attachments` Bucket, Submission-Scoped Path

1. Frontend compresses the image (existing `browser-image-compression`)
2. Frontend uploads to Storage: `form-attachments/{group_id}/{submission_id}/ai/{filename}`
3. Frontend sends the signed URL to `/ingest-vision` for text extraction
4. `/ingest-vision` returns a text description
5. Frontend sends the text to `ask-form` as the user message
6. Frontend appends the image reference with `"source": "ai_fill"` tag

No new bucket or policies needed.

---

## I.9. Template Reading from Edge Function

The edge function uses a **service role client** (bypasses RLS) for all database reads. This is the established pattern across all edge functions. Authorization is enforced in application code.

**No template caching needed** in Phase 3 -- reads are ~2ms by PK, OpenAI dominates at 200-800ms.

---

## I.10. Usage Limit Strategy

### Decision: Shared Counters

The `ask-form` edge function uses the **same** `get_user_usage` and `increment_usage` RPCs as `/ask` and `/ask-product`. Each AI form-fill turn counts as 1 question toward daily/monthly limits. Admin: 100 daily / 2000 monthly.

A typical form fill takes 2-4 turns. At 100 daily limit, a manager could fill 25-50 forms per day.

---

## I.11. Concurrency Analysis

Each fill creates a **separate `form_submissions` row** with a unique UUID PK. Completely isolated. Each user gets their own chat session. No concurrency issues.

---

## I.12. Performance Considerations

### System Prompt Token Budget

| Component | Estimated Tokens |
|---|---|
| Base persona prompt | ~100 |
| Domain-forms prompt | ~400 |
| Form-tool-map prompt | ~200 |
| Template instructions | ~200-400 |
| Field definitions (serialized) | ~500-1000 |
| Current field values | ~100-500 |
| Conversation history (up to 20 messages) | ~1000-3000 |
| **Total** | **~2500-5600** |

### Database Round Trips Per Request

| Step | Time |
|---|---|
| Auth check | ~0ms |
| Usage check | ~2ms |
| Template read (by PK) | ~2ms |
| Session get/create | ~3ms |
| History load | ~3ms |
| **OpenAI call (1-3 rounds)** | **200-800ms** |
| Tool execution (0-3 RPCs) | ~2-6ms each |
| Message persistence | ~4ms |
| Usage increment | ~2ms |
| **Total DB: ~20-30ms. Total request: ~250-900ms** | |

---

## I.13. Storage Path Convention

```
form-attachments/{group_id}/{submission_id}/{category}/{filename}
```

| Category | Contents |
|---|---|
| `photos` | Field images (injury photos, scene photos) |
| `signatures` | Signature pad PNGs |
| `documents` | File attachments (PDFs, supporting docs) |
| `ai` | Images uploaded for AI vision during form filling |

---

## I.14. Edge Function: `ask-form` Backend Design

### Request/Response Contract

```typescript
// POST /functions/v1/ask-form

interface AskFormRequest {
  question: string;
  templateId: string;
  submissionId?: string;
  currentValues?: Record<string, unknown>;
  language?: "en" | "es";
  groupId: string;
}

interface AskFormResponse {
  fieldUpdates: Record<string, unknown>;
  missingFields: string[];
  followUpQuestion: string | null;
  toolResults: Record<string, unknown>;
  citations: FormCitation[];
  usage: UsageInfo;
  sessionId: string;
}
```

### System Prompt Construction

```
1. base-persona (from ai_prompts)
2. domain-forms (from ai_prompts)
3. form-tool-map (from ai_prompts)
4. LANGUAGE_INSTRUCTIONS[language]
5. "## Form Structure\n" + serializeFieldDefinitions(template.fields)
6. "## Form Instructions\n" + template.instructions_en (or _es)
7. "## Current Values\n" + JSON.stringify(currentValues)
```

### Tool Definitions (Dynamic)

```typescript
const FORM_TOOL_DEFS: Record<string, object> = {
  search_contacts: { /* ... FTS-only, no embedding needed ... */ },
  search_manual: { /* ... hybrid search, needs embedding ... */ },
  search_products: { /* ... hybrid search, needs embedding ... */ },
};

const tools = (template.ai_tools || [])
  .filter((t: string) => t in FORM_TOOL_DEFS)
  .map((t: string) => FORM_TOOL_DEFS[t]);
```

### Tool Execution Dispatch

```typescript
async function executeTool(supabase, toolName, args, language, groupId) {
  switch (toolName) {
    case "search_contacts": {
      // FTS-only (no embedding needed)
      const { data } = await supabase.rpc("search_contacts", {
        search_query: args.query,
        match_count: 5,
        p_group_id: groupId,
        p_category: args.category || null,
      });
      return data || [];
    }
    case "search_manual": {
      const embedding = await getQueryEmbedding(args.query);
      if (!embedding) return [];
      const { data } = await supabase.rpc("search_manual_v2", {
        search_query: args.query,
        query_embedding: JSON.stringify(embedding),
        search_language: language,
        result_limit: 3,
      });
      return data || [];
    }
    case "search_products": {
      const domain = args.domain || "dishes";
      const fnMap = { dishes: "search_dishes", wines: "search_wines", cocktails: "search_cocktails", recipes: "search_recipes", beer_liquor: "search_beer_liquor" };
      const fnName = fnMap[domain] || "search_dishes";
      const embedding = await getQueryEmbedding(args.query);
      if (!embedding) return [];
      const { data } = await supabase.rpc(fnName, {
        search_query: args.query,
        query_embedding: JSON.stringify(embedding),
        result_limit: 5,
        keyword_weight: 0.4,
        vector_weight: 0.6,
      });
      return data || [];
    }
    default:
      return [];
  }
}
```

### Structured Output

Uses OpenAI's `response_format: { type: "json_schema" }` to guarantee valid JSON.

### Tool-Use Loop

Max 3 rounds, identical to the unified `/ask`.

### Field Serialization Helper

```typescript
function serializeFieldDefinitions(fields: any[]): string {
  return fields
    .filter((f: any) => f.type !== "header" && f.type !== "instructions")
    .map((f: any) => {
      const parts = [
        `- ${f.key} (${f.type})`,
        `  Label: ${f.label}`,
        f.required ? "  REQUIRED" : "",
        f.ai_hint ? `  AI Hint: ${f.ai_hint}` : "",
        f.options ? `  Options: ${JSON.stringify(f.options)}` : "",
        f.condition ? `  Condition: show when ${f.condition.field} ${f.condition.operator} "${f.condition.value}"` : "",
      ];
      return parts.filter(Boolean).join("\n");
    })
    .join("\n\n");
}
```

---

## I.15. Migration Summary

### Files and Order

```
supabase/migrations/
  20260225HHMMSS_extend_chat_sessions_for_forms.sql    (Migration 1)
  20260225HHMMSS_seed_form_ai_prompts.sql              (Migration 2)
  20260225HHMMSS_enhance_search_contacts.sql            (Migration 3)
```

**Must run in order: 1 --> 2 --> 3.**

All three are additive and backward-compatible.

---

## I.16. Verification Queries

```sql
-- 1. Verify chat_sessions accepts 'forms' context
INSERT INTO public.chat_sessions (user_id, group_id, context_type, mode)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'forms',
  'text'
);
DELETE FROM public.chat_sessions WHERE context_type = 'forms';

-- 2. Verify ai_prompts seeded
SELECT slug, category, domain, length(prompt_en) AS prompt_len
FROM ai_prompts
WHERE slug IN ('domain-forms', 'form-tool-map');

-- 3. Verify search_contacts returns email and notes
SELECT id, name, category, phone, email, notes, score
FROM search_contacts('hospital', 5, NULL, 'medical');

-- 4. Verify get_or_create_chat_session works with 'forms'
SELECT get_or_create_chat_session(
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'forms', NULL, 'text', 4
);

-- 5. Verify existing functionality is unbroken
SELECT id, name, category, phone, score
FROM search_contacts('fire', 5, NULL, 'emergency');
```

### Appendix: All 10 Questions Answered

| # | Question | Answer |
|---|---|---|
| 1 | New migrations needed? | **Yes, 3 small.** No new tables or columns. |
| 2 | How should `ai_session_id` be managed? | Stores `chat_sessions.id` UUID. Created on first AI turn. |
| 3 | Persist conversation history? | **Yes**, via existing `chat_sessions` + `chat_messages`. |
| 4 | Where do AI vision attachments go? | Same `form-attachments` bucket, path `{group_id}/{submission_id}/ai/{filename}`. |
| 5 | Service role for edge function? | **Yes.** Established pattern. |
| 6 | Same usage counters or separate? | **Same counters.** |
| 7 | Concurrency risk? | **None.** |
| 8 | Template caching? | **No.** |
| 9 | Storage path convention? | `form-attachments/{group_id}/{submission_id}/{category}/{filename}`. |
| 10 | RLS for edge function reads? | **Service role bypasses RLS.** |

---
---

# Part II — Technical Architecture

> **Scope:** System prompt design, tool schemas, field extraction strategy, multi-turn conversation, voice/image flows, error handling, edge function skeleton

> See also Part I for the database perspective on session management, migrations, and backend design.

---

## II.1. System Prompt Design

### II.1.1 Prompt Structure

The system prompt is assembled dynamically per request from four segments:

```
[BASE IDENTITY]     -- who the AI is, what it does, output format rules
[FORM CONTEXT]      -- template structure, field definitions, current values
[INSTRUCTIONS]      -- template-specific step-by-step instructions
[TOOL DECLARATIONS] -- which tools are available (from template.ai_tools)
```

### II.1.2 Base Identity Segment

```text
You are the AI form assistant for Alamo Prime steakhouse. You help restaurant
staff fill out operational forms (write-ups, injury reports, etc.) by extracting
structured field values from unstructured natural language input.

Today's date is YYYY-MM-DD.

Your job:
1. Read the user's description of the situation.
2. Extract values for as many form fields as possible.
3. Use available tools to look up missing information (contacts, manual procedures).
4. Report which required fields are still missing and ask about them.
5. Be factual, professional, and concise.

CRITICAL RULES:
- Only populate fields defined in the form schema below. Never invent field keys.
- For select/radio fields, the value MUST be one of the defined options (exact match).
- For checkbox fields, the value MUST be an array of strings from the defined options.
- For date fields, output ISO 8601 format: YYYY-MM-DD.
- For time fields, output 24-hour format: HH:MM.
- For datetime fields, output ISO 8601: YYYY-MM-DDTHH:MM.
- For number fields, output a numeric value (not a string).
- Never populate signature, image, or file fields -- those require user interaction.
- If you cannot determine a field value with confidence, omit it from fieldUpdates
  and include the field key in missingFields.
- [LANGUAGE_INSTRUCTION]

Your response MUST be a JSON object with this exact structure:

{
  "fieldUpdates": { "<field_key>": "<value matching field type>", ... },
  "missingFields": ["<required_field_key>", ...],
  "followUpQuestion": "<question about missing fields or null>",
  "message": "<your conversational response to the user>"
}
```

### II.1.3 Form Context Segment

Encodes the template's field definitions and current values into a structured text block:

```text
=== FORM: Employee Injury Report ===

FIELDS (23 fillable fields):

  [1] employee_name (text, REQUIRED)
      Label: "Employee Full Name"
      AI Hint: "Extract the employee's full name from the input"
      Current Value: <empty>

  [2] position (text, REQUIRED)
      Label: "Position / Title"
      Current Value: "Line Cook"

  [3] body_parts (checkbox, REQUIRED)
      Options: ["Head", "Neck", "Back", "Shoulder", "Arm", "Hand", ...]
      Current Value: <empty>

ALREADY-FILLED FIELDS (2 of 23):
  - position = "Line Cook"
  - date_of_injury = "2026-02-24"
```

**Key design decisions:**
1. Non-fillable fields excluded (header, instructions, signature, image, file)
2. Conditional fields included with visibility note
3. Current values shown to prevent overwriting
4. Options listed inline for select/radio/checkbox

### II.1.4 Token Budget

| Segment | Estimated Tokens |
|---------|-----------------|
| Base identity + JSON schema | ~350 |
| Form context (34 fields) | ~1,200 |
| Instructions | ~200-400 |
| Tool declarations | ~300 |
| User message + history | ~200-800 |
| **Total input** | **~2,000-3,000** |

### II.1.5 System Prompt Builder Function

```typescript
const NON_FILLABLE_TYPES = new Set([
  'header', 'instructions', 'signature', 'image', 'file',
]);

function buildSystemPrompt(
  template: FormTemplateRow,
  currentValues: Record<string, unknown>,
  language: 'en' | 'es',
): string {
  const langInstruction = language === 'es'
    ? 'Responde en espanol.'
    : 'Respond in English.';

  const fields = template.fields as FormFieldDef[];
  const fillableFields = fields.filter(
    f => !NON_FILLABLE_TYPES.has(f.type)
  );

  const today = new Date().toISOString().split('T')[0];

  const fieldLines = fillableFields.map((f, i) => {
    const label = language === 'es' ? (f.label_es || f.label) : f.label;
    const parts = [
      `  [${i + 1}] ${f.key} (${f.type}${f.required ? ', REQUIRED' : ''})`,
      `      Label: "${label}"`,
    ];
    if (f.options?.length) parts.push(`      Options: ${JSON.stringify(f.options)}`);
    if (f.ai_hint) parts.push(`      AI Hint: "${f.ai_hint}"`);
    if (f.condition) {
      const condMet = evaluateCondition(f.condition, currentValues);
      if (!condMet) {
        parts.push(`      (Hidden until ${f.condition.field} ${f.condition.operator} ${JSON.stringify(f.condition.value)})`);
      }
    }
    const cv = currentValues[f.key];
    parts.push(`      Current Value: ${cv !== undefined && cv !== null && cv !== '' ? JSON.stringify(cv) : '<empty>'}`);
    return parts.join('\n');
  });

  const filledKeys = fillableFields
    .filter(f => { const v = currentValues[f.key]; return v !== undefined && v !== null && v !== ''; })
    .map(f => `  - ${f.key} = ${JSON.stringify(currentValues[f.key])}`);

  const filledSummary = filledKeys.length
    ? `\nALREADY-FILLED FIELDS (${filledKeys.length} of ${fillableFields.length}):\n${filledKeys.join('\n')}`
    : '\nALREADY-FILLED FIELDS: none';

  const formTitle = language === 'es' ? (template.title_es || template.title_en) : template.title_en;
  const instructions = language === 'es' ? template.instructions_es : template.instructions_en;

  return `${BASE_IDENTITY_PROMPT.replace('YYYY-MM-DD', today)}
- ${langInstruction}

=== FORM: ${formTitle} ===

FIELDS (${fillableFields.length} fillable fields):

${fieldLines.join('\n\n')}
${filledSummary}
${instructions ? `\n=== FORM INSTRUCTIONS ===\n${instructions}` : ''}`;
}
```

---

## II.2. Tool Definitions

### II.2.1 Tool Registry

Tools are conditionally included based on the template's `ai_tools TEXT[]` column, plus the always-available `get_form_instructions`.

### II.2.2 search_contacts Tool

```typescript
const TOOL_SEARCH_CONTACTS = {
  type: "function",
  function: {
    name: "search_contacts",
    description:
      "Search the restaurant's contacts database (hospitals, emergency services, " +
      "management, vendors, insurance). Use when the form needs contact information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: 'Search query -- e.g., "hospital", "regional manager"' },
        category: { type: "string", description: "Optional category filter", enum: ["emergency", "medical", "management", "vendor", "government", "insurance"] },
      },
      required: ["query"],
    },
  },
};
```

### II.2.3 search_manual Tool

```typescript
const TOOL_SEARCH_MANUAL = {
  type: "function",
  function: {
    name: "search_manual",
    description: "Search the restaurant operations manual for policies, procedures, safety protocols.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: 'Search query -- e.g., "injury reporting procedure"' },
      },
      required: ["query"],
    },
  },
};
```

### II.2.4 search_products Tool

```typescript
const TOOL_SEARCH_PRODUCTS = {
  type: "function",
  function: {
    name: "search_products",
    description: "Search the restaurant's menu, recipes, wines, cocktails, and beverages.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: 'Search query -- e.g., "ribeye allergens"' },
        domain: { type: "string", description: "Which product database to search", enum: ["dishes", "wines", "cocktails", "recipes", "beer_liquor"] },
      },
      required: ["query", "domain"],
    },
  },
};
```

### II.2.5 get_form_instructions Tool

Always available regardless of `ai_tools` config. Returns template instructions from memory (no DB query).

### II.2.6 Tool Registration Map

```typescript
const TOOL_REGISTRY: Record<string, unknown> = {
  search_contacts: TOOL_SEARCH_CONTACTS,
  search_manual: TOOL_SEARCH_MANUAL,
  search_products: TOOL_SEARCH_PRODUCTS,
};

function getToolsForTemplate(template: FormTemplateRow): unknown[] {
  const tools: unknown[] = [TOOL_GET_INSTRUCTIONS];
  for (const toolName of (template.ai_tools || [])) {
    if (TOOL_REGISTRY[toolName]) tools.push(TOOL_REGISTRY[toolName]);
  }
  return tools;
}
```

### II.2.7 JSON Extraction from Response

Three-tier parser for extracting structured JSON from AI response:

```typescript
function extractJsonFromResponse(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { /* not pure JSON */ }
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (match?.[1]) { try { return JSON.parse(match[1]); } catch {} }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch {} }
  return null;
}
```

---

## II.3. Field Extraction Strategy

### II.3.1 Natural Language to Field Key Mapping

The AI maps via `ai_hint` and field label. Example:

User: "John Smith in the kitchen cut his hand on the slicer at 3pm today"

```json
{
  "fieldUpdates": {
    "employee_name": "John Smith",
    "body_parts": ["Hand"],
    "location": "Kitchen",
    "time_of_injury": "15:00",
    "date_of_injury": "2026-02-24",
    "description": "Employee cut his hand on the meat slicer at approximately 3:00 PM."
  }
}
```

### II.3.2 Select/Radio Validation

Server-side validation after AI returns `fieldUpdates`:

```typescript
function validateFieldUpdates(
  fields: FormFieldDef[],
  updates: Record<string, unknown>,
): { valid: Record<string, unknown>; invalid: string[] } {
  const fieldMap = new Map(fields.map(f => [f.key, f]));
  const valid: Record<string, unknown> = {};
  const invalid: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    const field = fieldMap.get(key);
    if (!field) { invalid.push(key); continue; }
    if (NON_FILLABLE_TYPES.has(field.type)) { invalid.push(key); continue; }

    if ((field.type === 'select' || field.type === 'radio') && field.options?.length) {
      if (typeof value !== 'string' || !field.options.includes(value)) { invalid.push(key); continue; }
    }
    if (field.type === 'checkbox' && field.options?.length) {
      if (!Array.isArray(value) || !value.every(v => field.options!.includes(v))) { invalid.push(key); continue; }
    }
    if (field.type === 'number') {
      const num = typeof value === 'number' ? value : Number(value);
      if (isNaN(num)) { invalid.push(key); continue; }
      valid[key] = num; continue;
    }
    if (field.type === 'date' && typeof value === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { invalid.push(key); continue; }
    }
    if (field.type === 'time' && typeof value === 'string') {
      if (!/^\d{2}:\d{2}$/.test(value)) { invalid.push(key); continue; }
    }
    valid[key] = value;
  }
  return { valid, invalid };
}
```

### II.3.3 Contact Lookup Resolution

Edge function resolves AI contact names to full `ContactLookupValue`:

```typescript
async function resolveContactLookups(
  supabase: SupabaseClient, fields: FormFieldDef[],
  updates: Record<string, unknown>, groupId: string,
): Promise<Record<string, unknown>> {
  const resolved = { ...updates };
  for (const field of fields) {
    if (field.type !== 'contact_lookup') continue;
    const aiValue = updates[field.key];
    if (!aiValue || typeof aiValue !== 'string') continue;
    const { data } = await supabase.rpc('search_contacts', {
      search_query: aiValue, match_count: 1,
      p_group_id: groupId,
      p_category: field.validation?.contact_category || null,
    });
    if (data?.[0]) {
      resolved[field.key] = {
        contact_id: data[0].id, name: data[0].name,
        phone: data[0].phone, contact_person: data[0].contact_person,
      };
    }
  }
  return resolved;
}
```

---

## II.4. Multi-Turn Conversation

### II.4.1 Request Payload

```typescript
interface AskFormRequest {
  question: string;
  templateId: string;
  currentValues: Record<string, unknown>;
  language: 'en' | 'es';
  groupId: string;
  conversationHistory?: ConversationMessage[];
  attachments?: AttachmentInput[];
  sessionId?: string;
}
```

`currentValues` is sent fresh each request from React state.

### II.4.2 Message Assembly

Truncated to last 6 messages, each max 2000 chars:

```typescript
const messages = [
  { role: 'system', content: systemPrompt },
  ...conversationHistory.slice(-6).map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content.slice(0, 2000) : String(m.content),
  })),
  { role: 'user', content: question },
];
```

### II.4.3 Session ID

Frontend-generated UUID v4 on first turn, stored on `form_submissions.ai_session_id` when submitted.

---

## II.5. Voice Input Flow

Two-step: Record -> Transcribe -> Ask-Form.

```
[Record Audio] -> POST /functions/v1/transcribe (Whisper) -> { text }
                                                                |
                                                                v
                                             POST /functions/v1/ask-form
                                               (question: transcribed text)
```

Reuses existing `VoiceChatInput` component. No new components needed.

---

## II.6. Image and File Input

### Image Input (Vision)

```
[User uploads photo] -> Client-side compression (max 1MB)
                      -> Convert to base64 data URL
                      -> Send as attachment in ask-form request
                      -> Edge function sends to OpenAI gpt-4o-mini with vision
                      -> AI extracts fields from image
```

### File Input (.txt only for Phase 3)

```
[User selects .txt] -> FileReader.readAsText()
                     -> text content (max 10,000 chars)
                     -> Send as attachment { type: 'file', content: text }
                     -> Edge function appends to user message
```

---

## II.7. Error Handling

| Error | Detection | Recovery |
|-------|-----------|----------|
| Network failure | `fetch` throws/times out | Toast + retry button. Form state preserved. |
| Auth expired | 401 | Redirect to login. State restored from autosave. |
| Usage limit exceeded | 429 `limit_exceeded` | Toast + disable AI input. Manual fill still works. |
| OpenAI rate limit | 429 from OpenAI | Retry once after 2s. |
| Invalid field values | `validateFieldUpdates` | Drop invalid, move to `missingFields`. |
| JSON parse failure | `extractJsonFromResponse` null | Return raw text as `message`, empty `fieldUpdates`. |

---

## II.8. Usage Limits

Shared counters. Cost estimate: ~$0.002 per form fill. At 2000 monthly limit, max ~$4/month.

---

## II.9. Response Format

```typescript
interface AskFormResponse {
  fieldUpdates: Record<string, FormFieldValue>;
  missingFields: string[];
  followUpQuestion: string | null;
  message: string;
  toolResults: ToolResultSummary[];
  citations: FormCitation[];
  usage: UsageInfo;
  sessionId: string;
}

interface ToolResultSummary {
  tool: string;
  query: string;
  resultCount: number;
  topResult?: string;
}
```

---

## II.10. Security

### Authentication

Same as `ask-product`: `verify_jwt: false`, `authenticateWithClaims(req)`, service-role client.

### Authorization

1. User must be authenticated
2. User must be a group member
3. Template must exist, be published, and belong to user's group

### Input Sanitization

| Input | Sanitization |
|-------|-------------|
| `question` | Trimmed. Max 5,000 chars. |
| `templateId` | UUID format validated. |
| `conversationHistory` | Max 6 messages, each max 2,000 chars. |
| `attachments[].content` | Image: `data:image/`, max ~1.5 MB. File: max 10,000 chars. |

---

## II.11. Edge Function: ask-form

### Function Config

```toml
[ask-form]
verify_jwt = false
```

### Skeleton Structure

```typescript
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Step 1: Authenticate
    // Step 2: Parse and validate request body
    // Step 3: Check usage limits
    // Step 4: Fetch template (service client, published + group_id)
    // Step 5: Build system prompt
    // Step 6: Assemble messages (system + history + user + attachments)
    // Step 7: Tool-use loop (max 3 rounds)
    // Step 8: Extract JSON from final answer
    // Step 9: Validate field updates
    // Step 10: Resolve contact_lookup fields
    // Step 11: Compute missing required fields
    // Step 12: Increment usage
    // Step 13: Return structured response
  } catch (err) {
    // Handle AuthError (401), UsageError (500), generic (500)
  }
});
```

### Key Differences from ask-product

| Aspect | ask-product | ask-form |
|--------|-------------|----------|
| Modes | 3 (action, context, search) | 1 (always extract) |
| System prompt | Fixed per domain | Dynamic per template |
| Output format | Free text | Structured JSON |
| Tools | 5 product search | 1-4 from template config |
| Post-processing | Citations only | Field validation + contact resolution |
| History | None (single-turn) | Multi-turn |
| Attachments | None | Images (vision) + text files |

---
---

# Part III — Frontend: Hook & Components

---

## III.1. Frontend Hook: useAskForm

### Interface

```typescript
export interface UseAskFormReturn {
  askForm: (question: string, options?: { attachments?: AttachmentInput[] }) => Promise<AskFormResult | null>;
  clearConversation: () => void;
  isLoading: boolean;
  result: AskFormResult | null;
  error: string | null;
  conversationHistory: ConversationTurn[];
  sessionId: string | null;
  totalFieldsUpdated: number;
  hasFollowUp: boolean;
}
```

### Implementation Pattern

Follows `use-ask-product.ts` but adds conversation history, session ID tracking, cumulative field counter, and attachment forwarding.

```typescript
export function useAskForm({ template, currentValues }: UseAskFormOptions): UseAskFormReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AskFormResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const totalFieldsUpdatedRef = useRef(0);

  const askForm = useCallback(async (question, options) => {
    // Validate prerequisites, set loading, build request, call ask-form,
    // handle errors, update history, track totalFieldsUpdated, return result
  }, [user, primaryGroup, template, currentValues, language, conversationHistory, sessionId]);

  const clearConversation = useCallback(() => {
    setConversationHistory([]); setResult(null); setError(null);
    setSessionId(null); totalFieldsUpdatedRef.current = 0;
  }, []);

  return { askForm, clearConversation, isLoading, result, error,
    conversationHistory, sessionId, totalFieldsUpdated: totalFieldsUpdatedRef.current,
    hasFollowUp: !!(result?.followUpQuestion) };
}
```

---

## III.2. Frontend Components

### Component Architecture

```
FormDetail.tsx
  |
  +-- FormHeader.tsx (modified: add AI Fill button via onAIFill prop)
  +-- FormBody.tsx (existing)
  |
  +-- [Desktop >= 1024px] DockedFormAIPanel.tsx (NEW)
  |     +-- FormAIChat.tsx (NEW -- conversation UI + input)
  |
  +-- [Mobile < 1024px] FormAIDrawer.tsx (NEW)
        +-- FormAIChat.tsx (same)
```

### DockedFormAIPanel.tsx

Docked `<aside>` with `w-80 xl:w-96 h-full border-l`. Uses `AppShell`'s `aiPanel` prop.

### FormAIDrawer.tsx

Uses `Drawer`/`DrawerContent` with `max-h-[85vh]`.

### FormAIChat.tsx

Shared content for both panel and drawer. Contains conversation area (scrollable) + input bar (sticky bottom). "Apply N fields" button on each AI response card.

### FormAIFillButton.tsx

Small pill button in `FormHeader`. Uses `Sparkles` icon. Disabled when no `ai_tools` or form is submitted.

---

## III.3. Integration with FormDetail

### State Additions

```typescript
const submission = useFormSubmission({ template });
const askForm = useAskForm({ template, currentValues: submission.fieldValues });

const [aiPanelOpen, setAiPanelOpen] = useState(false);
const [aiHighlightedFields, setAiHighlightedFields] = useState<Set<string>>(new Set());
const [aiMissingFields, setAiMissingFields] = useState<Set<string>>(new Set());

const handleApplyAIUpdates = useCallback((updates) => {
  submission.updateFields(updates);
  setAiHighlightedFields(new Set(Object.keys(updates)));
  setTimeout(() => setAiHighlightedFields(new Set()), 2200);
}, [submission.updateFields]);
```

### Prop Threading

`aiHighlightedFields` and `aiMissingFields` threaded down to `FormBody` -> `FormSection` -> `FormFieldWrapper`.

### AI Session Linking

On submit, `ai_session_id: aiSessionId || null` added to the UPDATE payload.

---
---

# Part IV — UX/UI Design Specification

> **Scope:** Every visual element, interaction pattern, animation, and Tailwind class needed to implement the AI Form Filling experience on top of the Phase 2 form viewer.

---

## IV.1. Design Principles

| Principle | Application |
|-----------|-------------|
| **Reuse, do not reinvent** | Mirror `DockedProductAIPanel` + `ProductAIDrawer` + `AskAboutContent` patterns exactly. |
| **Non-destructive AI** | AI never writes directly to the form. It *proposes* values the user explicitly approves. |
| **Form stays visible** | Desktop: form scrollable beside panel. Mobile: header+progress bar remain visible. |
| **One-handed thumb zone** | On mobile, every primary action lives in the bottom 40%. |
| **Consistent tokens** | Every color, radius, shadow uses design token system. No ad-hoc hex codes. |

---

## IV.2. AI Fill Button Placement

### Solution: Pill Button Between Title and Save Indicator

```tsx
<button
  type="button"
  onClick={onAIFill}
  disabled={aiDisabled}
  className={cn(
    'shrink-0 flex items-center gap-1.5',
    'h-8 px-3 rounded-full',
    'bg-primary text-primary-foreground',
    'text-xs font-semibold',
    'hover:bg-primary-hover active:scale-[0.97]',
    'transition-all duration-micro',
    'disabled:opacity-40 disabled:pointer-events-none',
    'shadow-sm',
  )}
  aria-label={language === 'es' ? 'Llenar con IA' : 'AI Fill'}
>
  <Sparkles className="h-3.5 w-3.5" />
  <span className="hidden xs:inline">
    {language === 'es' ? 'IA' : 'AI Fill'}
  </span>
</button>
```

**Visual Hierarchy:** `[<--] Employee Write-Up... [* AI Fill] Saved`

### Responsive Breakpoints

| Viewport | Behavior |
|----------|----------|
| < 375px | Icon only (label hidden). Button is 32x32 circle. |
| 375-1023px | Full pill with label. Title truncates. |
| >= 1024px | Full pill. Title has ample room. |

### FormHeader Props Addition

```typescript
interface FormHeaderProps {
  // ... existing props ...
  onAIFill?: () => void;
  aiDisabled?: boolean;
  aiActive?: boolean;  // ring indicator when panel is open
}
```

---

## IV.3. Desktop AI Panel — Docked Split View

### Panel Sizing

| Property | Value | Tailwind |
|----------|-------|----------|
| Width | 320px (lg) / 384px (xl) | `w-80 xl:w-96` |
| Height | Full viewport | `h-full` |
| Background | Card surface with blur | `bg-background/95 backdrop-blur-sm` |
| Border | Left hairline | `border-l border-border` |
| Shadow | Elevated | `shadow-xl` |
| Enter animation | Slide from right + fade | `animate-in slide-in-from-right-4 fade-in-0 duration-500` |

### Panel Internal Structure

```
+------------------------------------------+
|  Header  [sparkle + title]         [X]   |  <- shrink-0, border-b
+------------------------------------------+
|  Usage Meter (daily remaining)           |  <- shrink-0, border-b
+------------------------------------------+
|  Conversation Area (scrollable)          |  <- flex-1, overflow-y-auto
+------------------------------------------+
|  Input Bar (text + voice + attach)       |  <- shrink-0, border-t
+------------------------------------------+
```

---

## IV.4. Mobile AI Drawer — Bottom Sheet

Uses existing `Drawer`/`DrawerContent` with `max-h-[85vh]`. Leaves ~15vh visible at top for FormHeader + progress bar. Form behind is dimmed and inert. User dismisses via drag, overlay tap, X, or Escape.

After applying fields, drawer auto-minimizes (closes) so user can review the form.

---

## IV.5. Multi-Modal Input Bar

```
+--------------------------------------------------------+
|  [text input field                    ] [mic] [+] [=>] |
+--------------------------------------------------------+
```

- **Text input**: Auto-grows up to 3 lines, `rounded-xl`
- **Attachment menu**: Popover with "Take photo" + "Upload file"
- **Mic button**: Plain icon, red when recording
- **Send button**: `bg-primary rounded-full w-9 h-9`

### AttachmentChip Component

Small preview chips above input when files are attached, with remove button.

---

## IV.6. AI Response Display — Extracted Fields Card

Response renders as a card with:
1. Summary header ("N fields extracted")
2. Toggleable field list (ExtractedFieldRow)
3. Missing fields callout (amber warning)
4. Tool results section
5. "Apply N fields" + "Skip" buttons

### ExtractedFieldRow

Each field is a toggleable `<button>` with checkbox indicator, field label (uppercase xs), and value preview.

### Why Individual Toggles

- Control: Users must verify each AI extraction
- Partial apply: Deselect wrong ones, apply the rest
- Select/Deselect All link for power users

---

## IV.7. Apply-to-Form Flow

```
1. User clicks [Apply N fields]
2. Drawer auto-closes (mobile) / stays open (desktop)
3. Selected values write into form state
4. Each updated field plays highlight animation
5. Toast confirmation at bottom-center
6. Progress bar updates
7. "Undo AI Fill" toast action available for 8 seconds
```

### Undo Mechanism

Store snapshot of previous `fieldValues` in a `useRef`. "Undo" button restores. Auto-dismiss after 8 seconds.

---

## IV.8. Field Highlight Animation

### Green Border Glow

```css
@keyframes ai-fill-glow {
  0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); border-color: hsl(var(--primary) / 0.6); }
  50% { box-shadow: 0 0 0 4px hsl(var(--primary) / 0.15); border-color: hsl(var(--primary) / 0.4); }
  100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); border-color: transparent; }
}

.ai-fill-highlight {
  animation: ai-fill-glow 2s ease-out forwards;
  border: 1px solid hsl(var(--primary) / 0.6);
  border-radius: var(--radius-card);
}
```

### Auto-Scroll to First Highlighted Field

```typescript
const firstKey = Object.keys(updates)[0];
if (firstKey) {
  document.querySelector(`[data-field-id="field-${firstKey}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

---

## IV.9. Missing Field Indicators

### Amber Dot Badge on Form Fields

```tsx
{aiMissing && (
  <span className={cn(
    'inline-flex items-center gap-1',
    'px-1.5 py-0.5 rounded-full',
    'bg-warning/15 dark:bg-warning/10',
    'text-[10px] font-semibold text-warning',
  )}>
    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
    {language === 'es' ? 'Pendiente' : 'Needed'}
  </span>
)}
```

Clears when user fills the field, AI fills it in follow-up, or AI panel is closed.

---

## IV.10. Follow-Up Question Flow

AI follow-up questions appear as left-aligned bubbles in conversation. User responds via same input bar. Multi-turn: each response appends to scrollable conversation area.

### Conversation Entry Types

```typescript
type ConversationEntry =
  | { type: 'user'; message: string; attachments?: File[] }
  | { type: 'ai-extraction'; fields: ExtractedField[]; missing: string[]; toolResults?: ToolResult[] }
  | { type: 'ai-followup'; question: string }
  | { type: 'ai-applied'; count: number }
  | { type: 'loading' };
```

---

## IV.11. Mobile-Specific Concerns

- **Keyboard overlap**: `max-h-[85vh]` adapts to visual viewport on iOS
- **Drawer vs form scroll**: Only one scrollable context at a time
- **Thumb reach**: All primary actions in bottom 40%
- **Landscape**: Acceptable with scroll; chip layout deferred to Phase 7

---

## IV.12. New CSS Additions

```css
/* AI Fill field highlight glow */
@keyframes ai-fill-glow {
  0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); border-color: hsl(var(--primary) / 0.6); }
  50% { box-shadow: 0 0 0 4px hsl(var(--primary) / 0.15); border-color: hsl(var(--primary) / 0.4); }
  100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); border-color: transparent; }
}

.ai-fill-highlight {
  animation: ai-fill-glow 2s ease-out forwards;
  border: 1px solid hsl(var(--primary) / 0.6);
  border-radius: var(--radius-card);
}

@media (prefers-reduced-motion: reduce) {
  .ai-fill-highlight {
    animation: none;
    border-color: hsl(var(--primary) / 0.4);
    transition: border-color 0.3s ease;
  }
}
```

---

## IV.13. Component File Map

### New Files

```
src/components/forms/
  FormAIFillButton.tsx
  FormAIContent.tsx
  DockedFormAIPanel.tsx
  FormAIDrawer.tsx
  ai/
    ExtractedFieldsCard.tsx
    ExtractedFieldRow.tsx
    FollowUpBubble.tsx
    UserMessageBubble.tsx
    ToolResultChip.tsx
    AttachmentMenu.tsx
    AttachmentChip.tsx
    AIFillToast.tsx
    MissingFieldBadge.tsx
```

### Modified Files

```
src/components/forms/FormHeader.tsx       -- Add onAIFill, aiDisabled, aiActive props
src/components/forms/FormFieldWrapper.tsx  -- Add aiHighlighted, aiMissing props
src/pages/FormDetail.tsx                  -- Add AI panel state, handlers
src/index.css                             -- Add ai-fill-glow keyframe
```

---

## IV.14. ASCII Mockups

### Desktop — AI Panel Open (>= 1024px)

```
+----------+------------------------------------------+--------------------+
| Sidebar  |  FormHeader                               |                    |
|          |  [<--] Employee Write-Up  [*AI Fill] Saved|                    |
|          +------------------------------------------+  AI PANEL (320px)  |
|  Forms   |  Progress: 45%            12/27           |                    |
|  Manual  +------------------------------------------+  [sparkle] AI      |
|  ...     |                                          |  Assistant    [X]  |
|          |  Section: Employee Info                   +--------------------+
|          |  +--------------------------------------+ |  Usage: 12/100     |
|          |  | Employee Name: [John Smith      ]  * | +--------------------+
|          |  | Position:      [Line Cook        ]    | |                    |
|          |  +--------------------------------------+ |  You said:         |
|          |                                          | |  "John cut his     |
|          |  Section: Incident Details                | |   hand..."        |
|          |  +--------------------------------------+ |                    |
|          |  | Date of Injury: [2026-02-24  ]    * | |  --- AI Response ---+
|          |  | Time of Injury: [15:00       ]    * | |  8 fields found    |
|          |  +--------------------------------------+ |                    |
|          |                                          | |  [x] Employee Name |
|          |  [Save Draft]  [Submit]                   | |  [x] Time: 15:00  |
|          |                                          | |  [Apply 5 fields]  |
|          |                                          | +--------------------+
|          |                                          | |  [input...] [+][o]|
+----------+------------------------------------------+--------------------+
```

### Mobile — Drawer Open (< 1024px)

```
+--------------------------------------+
| [<--] Employee Write-Up [*AI] Saved  |  <- Still visible (15vh)
+--------------------------------------+
| 45%                         12/27    |
+======================================+  <- Drawer starts here
|          --- drag handle ---         |
| [sparkle] AI Assistant          [X]  |
+--------------------------------------+
|  You said: "John cut his hand..."    |
|  +---------------------------------+ |
|  | [sparkle] 8 fields extracted    | |
|  | [x] Employee Name: John        | |
|  | [x] Time of Injury: 15:00      | |
|  | ! 3 fields still needed        | |
|  | [Apply 5 fields]  [Skip]       | |
|  +---------------------------------+ |
|  [sparkle] "What department?"       |
+--------------------------------------+
| [Describe...         ] [+] [mic] [>]|
+--------------------------------------+
```

---

## IV.15. Accessibility Checklist

| Element | Requirement | Implementation |
|---------|-------------|----------------|
| AI Fill button | Accessible name | `aria-label` bilingual |
| Panel/Drawer | Focus trap | Radix handles natively |
| Extracted field toggles | Keyboard operable | Native `<button>`, Enter/Space |
| Highlight animation | Reduced motion | `@media (prefers-reduced-motion)` |
| Missing field badge | Screen reader | `aria-label` bilingual |
| Toast | Role alert | `role="status"` + `aria-live="polite"` |
| Color contrast | WCAG 2.1 AA | All text meets 4.5:1 |

---

## IV.16. Design Decision Log

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| Button location | Header row pill | FAB, footer, progress row | Header is canonical action bar |
| Button color | Primary green | Orange | Green = positive action, orange reserved for nav |
| Panel icon | Green Sparkles | Robot emoji | Visual thread with AI Fill button |
| Apply flow | Individual toggles | Apply All button | Forces review, allows partial apply |
| Mobile after apply | Auto-close drawer | Keep open | User needs to see form to verify |
| Missing indicator | Amber dot badge | Red dot, border color | Amber = attention, not error |
| Field highlight | Green glow animation | Background change | Temporary, self-clearing |
| Input attachment | Popover menu | Two buttons | Saves horizontal space |
| Conversation layout | Bubble-style chat | Card-only | Multi-turn needs sender distinction |

---
---

# Part V — Risks & Edge Cases (Devil's Advocate Review)

> **Reviewer:** Devil's Advocate Agent (Opus)
> **Scope:** Edge function `ask-form` + frontend `useAskForm` hook + AI panel UI + field highlighting + multi-turn follow-up

---

## V. Risk Assessment Matrix

| Severity | Definition | Count |
|----------|------|-------|
| **Critical** | Data corruption, security breach, or total feature failure | 4 |
| **Major** | Broken UX, incorrect data, or frequent failures | 8 |
| **Moderate** | Edge-case failures or degraded experience | 10 |
| **Minor** | Cosmetic, sub-optimal, or future-proofing | 6 |

---

## V.1. AI Field Extraction Accuracy

### R1. Select/Radio Value Mismatch (Critical)

**Risk:** AI returns value not in `options` array (lowercase, synonym, paraphrase).
**Mitigation:** Server-side fuzzy matching (case-insensitive + prefix + Levenshtein). Include exact options in system prompt. Frontend guard validates before applying.

### R2. Checkbox Partial Match (Major)

**Risk:** AI returns single string instead of array, or values not in options.
**Mitigation:** Normalize to array, per-element fuzzy match.

### R3. Date/Time Parsing from Relative Expressions (Major)

**Risk:** "yesterday", "last Tuesday", "3 days ago" — timezone-dependent.
**Mitigation:** Send user's local date/time/timezone from frontend. Include in system prompt.

### R4. AI Maps Value to Wrong Field (Major)

**Risk:** Cross-contamination between similarly-named fields.
**Mitigation:** Use function calling with field descriptions + `ai_hint`. Field highlighting forces user review.

### R5. Contact Lookup Structure Mismatch (Major)

**Risk:** AI returns raw search result instead of `ContactLookupValue` shape.
**Mitigation:** Edge function maps contact search results to expected shape (not the AI).

### R6. AI Fills Non-Fillable Fields (Moderate)

**Risk:** AI tries to fill header, instructions, signature types.
**Mitigation:** Filter from system prompt. Post-processing strips non-fillable types.

---

## V.2. Multi-Turn Conversation

### R7. Conversation History Token Growth (Major)

**Risk:** After 5+ turns with tool calls, context exceeds 10K tokens.
**Mitigation:** Cap at 5 turns. Send `currentValues` instead of full history. Strip tool results.

### R8. Contradictory Information Across Turns (Moderate)

**Risk:** User corrects themselves. Merge might be additive-only.
**Mitigation:** `fieldUpdates` uses REPLACE semantics (not merge). System prompt instruction.

### R9. Off-Topic Input (Moderate)

**Risk:** User asks unrelated questions mid-fill.
**Mitigation:** System prompt boundary. Return empty `fieldUpdates`.

### R10. Infinite Tool-Use Loop (Moderate)

**Risk:** AI keeps calling tools without terminating.
**Mitigation:** Hard cap of 3 rounds. 45-second AbortController timeout.

---

## V.3. Voice Input

### R11. Whisper Transcription Errors on Proper Nouns (Major)

**Risk:** Employee names mistranscribed. Kitchen noise.
**Mitigation:** Show transcription for review. Follow-up flow handles corrections. Language hint.

### R12. Language Mismatch (Moderate)

**Risk:** Form in English, manager speaks Spanish or code-switches.
**Mitigation:** Auto-detect. Multilingual system prompt instruction.

### R13. Voice Recording Size/Duration (Minor)

**Risk:** Very long recordings slow to upload.
**Mitigation:** Client-side 120s cap. Upload progress indicator.

---

## V.4. Image / File Input

### R14. Irrelevant Image Upload (Moderate)

**Mitigation:** AI gracefully handles with "couldn't identify form information" response.

### R15. Large PDF Token Exhaustion (Major)

**Mitigation:** Client-side 5 MB limit. Server-side 5-page limit. Truncate to 4,000 tokens.

### R16. Handwritten Text Recognition (Moderate)

**Mitigation:** AI presents extracted text with [?] markers for uncertain words.

### R17. Image Compression (Minor)

**Mitigation:** Reuse `browser-image-compression` (max 1 MB, 1920px).

---

## V.5. Concurrency & State

### R18. Race Condition Between Auto-Save and AI Updates (Critical)

**Risk:** Simultaneous manual edit and AI response could overwrite user input.
**Mitigation:** Review-then-apply pattern (individual toggles) prevents race. AI never auto-writes.

### R19. Form State Sync When AI Panel Opens (Moderate)

**Mitigation:** Send `currentValues` from React state (not DB). Force save before AI call.

### R20. Apply Mode Consistency (Moderate)

**Mitigation:** Follow UX spec exactly: review-then-apply with toggles.

---

## V.6. Security

### R21. Prompt Injection Targeting Tool Calls (Critical)

**Risk:** Malicious input tricks AI into inappropriate tool calls.
**Mitigation:** All tools server-side. Fixed tool set per template. Parameterized RPCs.

### R22. XSS Payloads in AI-Filled Fields (Critical)

**Risk:** AI extracts script tags from user input.
**Mitigation:** React auto-escapes. No `dangerouslySetInnerHTML`. Strip HTML from field values.

### R23. Malicious File Upload (Moderate)

**Mitigation:** MIME type restriction. 10 MB limit. AI panel files processed in-memory only.

---

## V.7. UX Pitfalls

### R24. No Undo After AI Fill (Major)

**Mitigation:** UX spec includes undo via snapshot + toast. Store in `useRef`.

### R25. User Wanted Help With Specific Fields Only (Moderate)

**Mitigation:** "Do not overwrite existing values" prompt instruction + toggle UX.

### R26. Desktop Panel Covers Form (Moderate)

**Mitigation:** Scroll-to-field on apply. Collapsible panel.

### R27. Mobile Keyboard + Drawer (Moderate)

**Mitigation:** `max-h-[85vh]` adapts to visual viewport. Auto-close after apply.

### R28. AI Response Latency Perception (Moderate)

**Mitigation:** Progressive loading states. Optimistic UI. 15s timeout message.

---

## V.8. Cost & Performance

### R29. API Cost (Minor)

$0.01-0.03 per fill, $1-5/month at 100 forms/month. Usage limits in place.

### R30. OpenAI Outage (Minor)

Graceful degradation. Manual fill always works.

---

## V.9. Data Integrity

### R31. Template Change During Session (Minor)

Handled by `template_version` + `fields_snapshot`.

### R32. Empty Form + AI Fill (Minor)

System prompt handles: "Describe the situation in your own words."

### R33. Conditional Field Visibility Mismatch (Moderate)

Allow proactive fill. Also set controlling field when filling dependent fields.

---

## V.10. Integration & Deployment

### R34. Edge Function Cold Start (Minor)

1-3s cold start. Progressive feedback covers this.

---

## V. Summary by Priority

### Must-Fix (Critical)

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | Select/Radio mismatch | Server-side fuzzy matching + prompt constraints |
| R18 | Auto-Save race condition | Review-then-apply UX |
| R21 | Prompt injection | Fixed tool set, parameterized RPCs |
| R22 | XSS | No dangerouslySetInnerHTML, strip HTML |

### Should-Fix (Major)

| # | Risk | Mitigation |
|---|------|-----------|
| R2 | Checkbox match | Normalize arrays, per-element fuzzy |
| R3 | Date/time parsing | Send user timezone + local time |
| R4 | Wrong field mapping | Function calling + ai_hint |
| R5 | Contact lookup shape | Edge function maps, not AI |
| R7 | Token growth | Cap 5 turns, send currentValues |
| R11 | Whisper names | Show transcription, language hint |
| R15 | Large PDF | Size + page limits |
| R24 | No undo | Snapshot + toast undo |

---

## V. Recommendations for the Implementation Plan

### 1. Add to `ask-form` Edge Function

- Post-processing validation layer (R1, R2, R6, R22)
- Request includes `userTimezone` and `userLocalTime` (R3)
- Fixed tool set from `template.ai_tools` (R21)
- Contact lookup mapping in edge function (R5)
- Max 3 tool rounds + 45s timeout (R10)
- PDF: 5 pages, 4000 tokens (R15)

### 2. Add to `useAskForm` Hook

- Pre-apply snapshot for undo (R24)
- Send `currentValues` from React state (R19)
- Client-side option validation (R1)
- Cap conversation at 5 turns (R7)

### 3. Add to AI Panel UI

- Show transcription in chat (R11)
- Image compression before upload (R17)
- File size validation: max 5 MB (R15)
- Progressive loading states (R28)
- Undo toast with 8s dismiss (R24)

### 4. Add to System Prompt

- Exact option values + "use exact values only" (R1, R2)
- User's local date/time/timezone (R3)
- `ai_hint` for every field (R4)
- "Do not overwrite existing values" (R25)
- "Handle multilingual input" (R12)
- "Redirect off-topic questions" (R9)
- "Set controlling field with conditional fields" (R33)
- "fieldUpdates REPLACE previous values" (R8)

---
---

# Part VI — File Manifest & Verification Plan

---

## VI.1. Unified File Manifest

### New Files

| File | Type | Description |
|------|------|-------------|
| `supabase/migrations/..._extend_chat_sessions_for_forms.sql` | Migration | Add 'forms' to CHECK constraints |
| `supabase/migrations/..._seed_form_ai_prompts.sql` | Migration | Seed domain-forms + form-tool-map prompts |
| `supabase/migrations/..._enhance_search_contacts.sql` | Migration | Add email + notes to search_contacts return |
| `supabase/functions/ask-form/index.ts` | Edge function | AI form filling with tool use |
| `src/hooks/use-ask-form.ts` | React hook | Manages ask-form calls + conversation state |
| `src/components/forms/FormAIFillButton.tsx` | Component | Pill button to open AI panel |
| `src/components/forms/FormAIContent.tsx` | Component | Shared content for desktop panel + mobile drawer |
| `src/components/forms/DockedFormAIPanel.tsx` | Component | Desktop docked AI panel |
| `src/components/forms/FormAIDrawer.tsx` | Component | Mobile bottom drawer AI panel |
| `src/components/forms/ai/ExtractedFieldsCard.tsx` | Component | AI response card with field list + apply |
| `src/components/forms/ai/ExtractedFieldRow.tsx` | Component | Single toggleable field row |
| `src/components/forms/ai/FollowUpBubble.tsx` | Component | AI follow-up question bubble |
| `src/components/forms/ai/UserMessageBubble.tsx` | Component | User message bubble |
| `src/components/forms/ai/ToolResultChip.tsx` | Component | Tool result display chip |
| `src/components/forms/ai/AttachmentMenu.tsx` | Component | Popover for camera + file |
| `src/components/forms/ai/AttachmentChip.tsx` | Component | Preview chip for attachments |
| `src/components/forms/ai/AIFillToast.tsx` | Component | Toast with undo action |
| `src/components/forms/ai/MissingFieldBadge.tsx` | Component | Amber dot badge |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/FormDetail.tsx` | Add `useAskForm`, AI panel state, apply handler, field highlight/missing |
| `src/components/forms/FormHeader.tsx` | Add `onAIFill`, `aiDisabled`, `aiActive` props + AI Fill button |
| `src/components/forms/FormFieldWrapper.tsx` | Add `aiHighlighted`, `aiMissing` props |
| `src/hooks/use-form-submission.ts` | Add `ai_session_id` to submit payload |
| `src/index.css` | Add `ai-fill-glow` keyframe + `.ai-fill-highlight` class |

### Reused (Not Modified)

| File | Reuse |
|------|-------|
| `src/components/ui/voice-chat-input.tsx` | Voice recording in FormAIChat |
| `supabase/functions/transcribe/index.ts` | Whisper transcription |
| `supabase/functions/_shared/auth.ts` | `authenticateWithClaims()` |
| `supabase/functions/_shared/usage.ts` | `checkUsage()`, `incrementUsage()` |
| `supabase/functions/_shared/cors.ts` | `corsHeaders`, `jsonResponse`, `errorResponse` |
| `supabase/functions/_shared/supabase.ts` | `createServiceClient()` |

---

## VI.2. Unified Verification Plan

### Edge Function Tests

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Basic extraction | "John Smith, line cook, cut hand at 3pm" | fieldUpdates: employee_name, body_parts, time, date |
| 2 | Select matching | "He was in the bar area" | location = "Bar" |
| 3 | Checkbox multi-select | "Hurt his hand and knee" | body_parts = ["Hand", "Knee"] |
| 4 | Date parsing | "Yesterday at 2:30pm" | Correct date + "14:30" |
| 5 | search_contacts tool | Injury form | toolResults includes hospital |
| 6 | search_manual tool | Write-up form | toolResults includes policy |
| 7 | Missing fields | Only name provided | missingFields lists rest |
| 8 | Follow-up question | Partial info | followUpQuestion non-null |
| 9 | Multi-turn | Turn 1 + Turn 2 | Turn 2 adds from context |
| 10 | Invalid option | AI returns "Kitchen" for select | Dropped, added to missingFields |
| 11 | Usage limit | At daily limit | 429 limit_exceeded |
| 12 | No auth | Missing Authorization | 401 |
| 13 | Image attachment | Base64 image | AI extracts fields |
| 14 | Spanish language | `language: 'es'` | Response in Spanish |

### Frontend Tests

| # | Test | Action | Expected |
|---|------|--------|----------|
| 1 | AI Fill visible | Open form with ai_tools | Button in header |
| 2 | AI Fill disabled | Open form with empty ai_tools | Button disabled |
| 3 | Desktop panel | Click AI Fill (>= 1024px) | Docked panel slides in |
| 4 | Mobile drawer | Click AI Fill (< 1024px) | Bottom drawer opens |
| 5 | Text extraction | Type description, send | AI response with fields |
| 6 | Apply fields | Click "Apply N fields" | Fields update + glow |
| 7 | Highlight fades | Wait 2 seconds | Glow fades |
| 8 | Voice input | Tap mic, speak, stop | Transcription in input |
| 9 | Follow-up | Answer follow-up | New fields extracted |
| 10 | Error recovery | Network off, send | Toast error, data preserved |
| 11 | Close/reopen | Close, reopen panel | Conversation preserved |
| 12 | Clear conversation | Click clear | History reset |
| 13 | Submit with session | Submit after AI fill | ai_session_id on row |
| 14 | Missing badge | AI returns missingFields | Amber dot on fields |

### Database Verification

| # | Query | Expected |
|---|-------|----------|
| 1 | INSERT chat_sessions with 'forms' | Succeeds |
| 2 | SELECT ai_prompts domain-forms | Returns 2 rows |
| 3 | search_contacts with email/notes | Returns expanded columns |
| 4 | get_or_create_chat_session 'forms' | Returns UUID |
| 5 | Existing search_contacts call | Still works (backward compatible) |

### End-to-End Scenarios

1. **Full injury report:** Describe injury -> AI fills + looks up hospital -> follow-up -> review -> submit.
2. **Full write-up:** "John was late 3 times this week" -> AI fills + searches manual -> submit.
3. **Image upload:** Photo of handwritten notes -> AI extracts fields.
4. **Bilingual:** Spanish description -> response and fields in Spanish.
5. **Mobile:** Complete form fill via AI drawer on phone viewport.

---

## VI.3. Existing Code References

| Component | File | Relevance |
|-----------|------|-----------|
| ask-product edge function | `supabase/functions/ask-product/index.ts` | Auth, tool-use loop, usage, response format |
| ask unified edge function | `supabase/functions/ask/index.ts` | Tool-use loop (MAX_TOOL_ROUNDS=3) |
| transcribe edge function | `supabase/functions/transcribe/index.ts` | Whisper API call |
| ingest-vision edge function | `supabase/functions/ingest-vision/index.ts` | OpenAI vision messages |
| _shared/auth.ts | `supabase/functions/_shared/auth.ts` | `authenticateWithClaims()` |
| _shared/usage.ts | `supabase/functions/_shared/usage.ts` | `checkUsage()`, `incrementUsage()` |
| _shared/cors.ts | `supabase/functions/_shared/cors.ts` | CORS headers |
| useAskProduct hook | `src/hooks/use-ask-product.ts` | Hook pattern |
| useFormSubmission hook | `src/hooks/use-form-submission.ts` | `updateFields()`, autosave, submit |
| DockedProductAIPanel | `src/components/shared/DockedProductAIPanel.tsx` | Docked panel pattern |
| ProductAIDrawer | `src/components/shared/ProductAIDrawer.tsx` | Mobile drawer pattern |
| Form types | `src/types/forms.ts` | All TypeScript interfaces |
| search_contacts RPC | `supabase/migrations/20260223200007_create_search_contacts.sql` | Contact search |

### Appendix: Conditional Field Evaluation

```typescript
function evaluateCondition(
  condition: { field: string; operator: string; value: unknown },
  values: Record<string, unknown>,
): boolean {
  const fieldValue = values[condition.field];
  switch (condition.operator) {
    case 'eq': return fieldValue === condition.value;
    case 'neq': return fieldValue !== condition.value;
    case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'exists': return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    default: return true;
  }
}
```

---

*This is the unified implementation plan for Phase 3: AI-Assisted Form Filling. It consolidates the Database & Backend plan, Technical Architecture, UX/UI Design Specification, and Devil's Advocate risk review into a single reference document.*
