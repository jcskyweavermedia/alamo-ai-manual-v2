# Phase 4: Main AI Chat Integration — Database & Backend Plan

> **Status:** Planning
> **Date:** 2026-02-24
> **Estimated effort:** ~1 session
> **Dependencies:** Phase 1 (DB Foundation, complete) + Phase 3 (AI Form Filling, planning complete)
> **Output:** 1 migration (optional), edge function modifications to `/ask`
> **Author:** Senior Database Expert (Opus)

---

## Table of Contents

1. [Schema Assessment](#i1-schema-assessment)
2. [Migration: Seed Form Intent Prompt](#i2-migration-seed-form-intent-detection-prompt)
3. [No Other Migrations Needed](#i3-no-other-migrations-needed-and-why)
4. [Edge Function Changes to /ask](#i4-edge-function-changes-to-ask)
5. [search_forms Tool Definition](#i5-search_forms-tool-definition)
6. [Tool Dispatch Implementation](#i6-tool-dispatch-implementation)
7. [Response Format Extension](#i7-response-format-extension)
8. [Context Extraction for Pre-Fill](#i8-context-extraction-for-pre-fill)
9. [Session/History Considerations](#i9-sessionhistory-considerations)
10. [Security Analysis](#i10-security-analysis)
11. [Performance Considerations](#i11-performance-considerations)
12. [Verification Queries](#i12-verification-queries)

---

## I.1. Schema Assessment

### What Already Exists and Is Sufficient

Phase 1 and Phase 3 migrations have prepared everything the backend needs. The following require **no changes:**

| Table / Object | Phase 4 Relevance | Changes Needed |
|---|---|---|
| `form_templates` | `search_forms` searches this table by FTS | **None** |
| `form_templates.search_vector` TSVECTOR | GIN-indexed, auto-populated by trigger from title/description EN+ES | **None** |
| `search_forms` RPC function | FTS search returning `id, slug, title, description, icon, score` | **None** -- already returns exactly what Phase 4 needs |
| `chat_sessions` | Session persistence for `/ask` conversations | **None** -- `context_type = 'manual'` is used for main chat sessions; no change needed |
| `chat_messages` | Message persistence for conversation history | **None** |
| `ai_prompts` (base-persona, tool-map, behavior-rules) | System prompt assembly for `/ask` | **tool-map needs updating** (see Section I.2) |
| `get_or_create_chat_session` | Session management | **None** |
| `get_chat_history` | History loading | **None** |
| `get_user_usage` / `increment_usage` | Usage limit check/increment | **None** |

### What Needs Changes

| # | Change | Reason |
|---|---|---|
| 1 | Update `tool-map` ai_prompt to mention `search_forms` | The `/ask` system prompt needs to tell the AI about the new tool so it knows when to call it |

**Total: 1 small migration. Zero new tables. Zero new columns.**

### Key Finding: `search_forms` Already Exists

The `search_forms` RPC was created in Phase 1 migration `20260223200006_create_search_forms.sql`. It returns exactly what the Phase 4 feature overview specifies:

```sql
RETURNS TABLE (
  id          UUID,
  slug        TEXT,
  title       TEXT,       -- language-aware (EN or ES)
  description TEXT,       -- ts_headline with <mark> tags
  icon        TEXT,
  score       FLOAT
)
```

Parameters:
- `search_query TEXT` -- the FTS query
- `search_language TEXT DEFAULT 'en'` -- determines tsconfig and title/description language
- `match_count INT DEFAULT 5` -- result limit
- `p_group_id UUID DEFAULT NULL` -- group scope (NULL = all groups)

It filters by `status = 'published'` and orders by FTS rank. This is a pure FTS function (no vector embeddings needed -- form templates are few and well-titled). No changes needed.

---

## I.2. Migration: Seed Form Intent Detection Prompt

### Problem

The current `tool-map` prompt in `ai_prompts` lists 6 search tools (manual, dishes, wines, cocktails, recipes, beer_liquor) but does **not** mention `search_forms`. The AI will never call a tool it does not know exists.

### Approach: Update `tool-map` Instead of Adding a New Row

The `tool-map` prompt is a system-level prompt (category='system', domain=NULL) that enumerates all available tools. The cleanest approach is to add `search_forms` to this list. However, updating an existing `ai_prompts` row via migration has a risk: if the admin has manually edited the prompt, the migration overwrites their changes.

**Decision:** Add a **new** prompt row `form-intent-map` rather than modifying `tool-map`. This is additive and non-destructive. The `/ask` edge function will load both `tool-map` and `form-intent-map` in search mode.

### SQL

```sql
-- =============================================================================
-- MIGRATION: seed_form_intent_prompt
-- Adds an ai_prompts row that teaches the /ask AI about the search_forms tool.
-- The /ask edge function loads this alongside tool-map in search mode.
-- Phase 4 of Form Builder System
-- =============================================================================

BEGIN;

INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, sort_order)
VALUES
  ('form-intent-map', 'system', NULL,
   E'You also have access to a form search tool:\n\n- search_forms(query): Search the restaurant''s operational forms library (injury reports, write-ups, incident reports, etc.). Use this tool when the user expresses intent to fill out, complete, file, document, or submit a form or report. Examples of form-related intent:\n  - "I need to fill out an injury report"\n  - "Write up John for being late"\n  - "I need to document an incident"\n  - "File a report about..."\n  - "Where''s the form for..."\n\nWhen you detect form-filling intent:\n1. Call search_forms with a concise query extracted from the user''s message\n2. Present the matching form(s) to the user\n3. Ask "Would you like to fill out this form?" or similar confirmation\n4. Extract any contextual information from the user''s original message that could pre-fill form fields (names, dates, descriptions, etc.) and include it in your response\n\nIMPORTANT: When search_forms returns results, you MUST include a structured JSON block at the END of your response in this exact format:\n```json\n{"form_navigation": {"forms": [{"slug": "...", "title": "...", "icon": "...", "description": "..."}], "extractedContext": "...the user''s original description with details for pre-fill..."}}\n```\nThis JSON block must appear after your conversational text, wrapped in a ```json code fence.',
   E'Tambien tienes acceso a una herramienta de busqueda de formularios:\n\n- search_forms(query): Buscar en la biblioteca de formularios operativos del restaurante (reportes de lesiones, amonestaciones, reportes de incidentes, etc.). Usa esta herramienta cuando el usuario exprese intencion de llenar, completar, presentar, documentar o enviar un formulario o reporte. Ejemplos de intencion relacionada con formularios:\n  - "Necesito llenar un reporte de lesion"\n  - "Amonestar a Juan por llegar tarde"\n  - "Necesito documentar un incidente"\n  - "Presentar un reporte sobre..."\n  - "Donde esta el formulario para..."\n\nCuando detectes intencion de llenar formularios:\n1. Llama a search_forms con una consulta concisa extraida del mensaje del usuario\n2. Presenta el/los formulario(s) encontrados al usuario\n3. Pregunta "Quieres llenar este formulario?" o una confirmacion similar\n4. Extrae cualquier informacion contextual del mensaje original del usuario que pueda pre-llenar campos del formulario (nombres, fechas, descripciones, etc.) e incluyela en tu respuesta\n\nIMPORTANTE: Cuando search_forms devuelva resultados, DEBES incluir un bloque JSON estructurado al FINAL de tu respuesta en este formato exacto:\n```json\n{"form_navigation": {"forms": [{"slug": "...", "title": "...", "icon": "...", "description": "..."}], "extractedContext": "...la descripcion original del usuario con detalles para pre-llenado..."}}\n```\nEste bloque JSON debe aparecer despues de tu texto conversacional, envuelto en un bloque de codigo ```json.',
   2);

COMMIT;
```

### Why a Separate Prompt Row

1. **Non-destructive** -- does not touch the existing `tool-map` row
2. **Toggleable** -- admin can set `is_active = false` to disable form routing without affecting other tool descriptions
3. **Clean separation** -- form intent detection logic is isolated from the 6 product/manual tool descriptions
4. **Consistent pattern** -- follows how `form-tool-map` was added for Phase 3's `ask-form` function

### Why the JSON Block Convention

The AI needs to communicate structured form data back to the frontend within the standard `/ask` text response. The approach uses a JSON code fence block at the end of the response because:

1. The existing `UnifiedAskResponse` type has `mode: "action" | "search"` -- we do not want to add `"form_navigation"` as a mode on the response envelope because that would break existing frontend consumers
2. Instead, the frontend parses the AI's answer text to detect the `{"form_navigation": ...}` block
3. This is the same pattern used by many AI systems for structured output within free-text responses
4. The extractedContext field carries the user's original description for pre-fill passthrough

---

## I.3. No Other Migrations Needed (and Why)

### Why No New CHECK Constraint Changes

The `chat_sessions.context_type_check` already includes `'forms'` (added by Phase 3 migration `20260225100000`). Phase 4 conversations happen in the main `/ask` chat, which uses `context_type = 'manual'` -- the existing session infrastructure handles this natively.

### Why No New Tables

Phase 4 does not create new data -- it routes users to existing forms. The form navigation is transient (URL state or context provider), not persisted.

### Why No Changes to `search_forms`

The RPC already returns `id, slug, title, description, icon, score` -- exactly matching the Phase 4 requirement of `{ slug, title, icon, description }`. The `id` and `score` are bonus fields the frontend can ignore or use for sorting.

### Why No Changes to `form_templates`

The table already has all needed columns. Published templates with `search_vector` populated are searchable by `search_forms`.

### Why No Changes to `ai_prompts` Constraints

The `form-intent-map` row uses `category = 'system'` and `domain = NULL`, which satisfies both `ai_prompts_category_check` (allows 'system') and `ai_prompts_domain_required` (system category allows NULL domain). No constraint changes needed.

---

## I.4. Edge Function Changes to `/ask`

### Overview

The `/ask` edge function (`supabase/functions/ask/index.ts`) needs 5 targeted changes:

1. **Add `search_forms` to the `SEARCH_TOOLS` array** -- new tool definition
2. **Add `search_forms` to the `SEARCH_FN_TO_CONTEXT` map** -- for citation tagging
3. **Load the new `form-intent-map` prompt** -- add its slug to the prompt loading query
4. **Handle `search_forms` tool execution** -- dispatch to the `search_forms` RPC (FTS-only, no embedding)
5. **Include form-intent-map in system prompt** -- append to the search-mode system prompt

### Change 1: Add `search_forms` Tool Definition

Add to the `SEARCH_TOOLS` array after the existing 6 tools:

```typescript
// In SEARCH_TOOLS array, add:
{
  type: "function",
  function: {
    name: "search_forms",
    description:
      "Search the restaurant's operational forms library (injury reports, write-ups, incident reports). " +
      "Use when the user wants to fill out, complete, file, document, or submit a form or report.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query -- key terms about the form (e.g., "injury report", "employee write-up", "incident")',
        },
      },
      required: ["query"],
    },
  },
},
```

### Change 2: Add to SEARCH_FN_TO_CONTEXT Map

```typescript
// Add to SEARCH_FN_TO_CONTEXT:
const SEARCH_FN_TO_CONTEXT: Record<string, ContextType> = {
  search_manual_v2: "manual",
  search_dishes: "dishes",
  search_wines: "wines",
  search_cocktails: "cocktails",
  search_recipes: "recipes",
  search_beer_liquor: "beer_liquor",
  search_forms: "forms",  // NEW
};
```

**Note:** This requires adding `"forms"` to the `ContextType` union type at the top of the file:

```typescript
type ContextType =
  | "manual"
  | "dishes"
  | "wines"
  | "cocktails"
  | "recipes"
  | "beer_liquor"
  | "training"
  | "forms";  // NEW
```

And to `VALID_CONTEXTS`:

```typescript
const VALID_CONTEXTS: ContextType[] = [
  "manual", "dishes", "wines", "cocktails", "recipes", "beer_liquor", "training",
  "forms",  // NEW -- not used as an inbound domain, but needed for citation tagging
];
```

### Change 3: Load form-intent-map Prompt

In the prompt loading section (step 7), add `form-intent-map` to the slugs list for search mode:

```typescript
const promptSlugs = [
  "base-persona",
  "tool-map",
  "form-intent-map",  // NEW -- always loaded so AI knows about search_forms
  "behavior-rules",
  `domain-${domain}`,
  ...(isActionMode ? [`action-${domain}-${action}`] : []),
];
```

### Change 4: Append form-intent-map to System Prompt

In the search mode branch of prompt assembly (step 7), load and append:

```typescript
// After adding tool-map and behavior-rules:
const formIntentMap = getPrompt("form-intent-map");
if (formIntentMap) systemParts.push(formIntentMap);
```

### Change 5: Handle `search_forms` in executeSearch

The existing `executeSearch` function requires a `queryEmbedding` parameter and passes it to all RPCs. But `search_forms` is FTS-only -- it does not accept an embedding parameter. We need a special case in the tool execution flow.

The cleanest approach is to add a conditional branch in the tool-use loop where tool calls are dispatched. In the current `/ask` code, the tool execution happens inline in the for-loop at line ~1442. Add a branch before the standard `executeSearch` call:

```typescript
// Inside the tool call execution loop:
for (const toolCall of assistantMsg.tool_calls) {
  const fnName = toolCall.function.name;
  const fnArgs = JSON.parse(toolCall.function.arguments);
  const rawQuery = fnArgs.query;
  const searchQuery = stripStopWords(rawQuery);

  console.log(`[ask] Executing tool: ${fnName}(query="${searchQuery}")`);

  let results: SearchResult[];

  if (fnName === "search_forms") {
    // search_forms is FTS-only -- no embedding needed
    const { data, error } = await supabase.rpc("search_forms", {
      search_query: searchQuery,
      search_language: language,
      match_count: 5,
      p_group_id: groupId,  // scope to user's group
    });

    if (error) {
      console.error(`[ask] search_forms error:`, error.message);
      results = [];
    } else {
      // Map search_forms result shape to SearchResult
      results = (data || []).map((r: any) => ({
        id: r.id,
        slug: r.slug,
        name: r.title,  // search_forms returns 'title', not 'name'
        snippet: r.description,
        // Include icon in a field the AI can reference
        category: r.icon,  // Reuse category field to carry the icon name
      }));
    }
  } else {
    // Standard search: generate embedding + call hybrid RPC
    const queryEmbedding = await getQueryEmbedding(rawQuery);
    results = await executeSearch(supabase, fnName, searchQuery, queryEmbedding, language);
  }

  // Collect results for citation building
  allSearchResults.push(...results.map((r) => ({ result: r, fnName })));

  // Format results as tool response
  messages.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: fnName === "search_forms"
      ? formatFormSearchResults(results)
      : formatSearchResults(results),
  });

  console.log(`[ask] ${fnName}: ${results.length} results`);
}
```

### New Helper: formatFormSearchResults

```typescript
function formatFormSearchResults(results: SearchResult[]): string {
  if (!results.length) return "No forms found matching that query.";

  return results
    .map((r, i) => {
      const parts = [`${i + 1}. ${r.name} (slug: ${r.slug})`];
      if (r.snippet) parts.push(`   ${r.snippet.replace(/<\/?mark>/g, "")}`);
      if (r.category) parts.push(`   Icon: ${r.category}`);  // category carries icon name
      return parts.join("\n");
    })
    .join("\n\n");
}
```

### Change 6: Skip Product Expansion for Form Results

The product expansion logic (line ~1544) fetches full records for non-manual search results. Form results should be excluded since they are not products:

```typescript
// Existing line:
const productSearchResults = allSearchResults.filter(
  (r) => r.fnName !== "search_manual_v2"
);

// Updated:
const productSearchResults = allSearchResults.filter(
  (r) => r.fnName !== "search_manual_v2" && r.fnName !== "search_forms"
);
```

---

## I.5. search_forms Tool Definition

### OpenAI Function Calling Schema

```typescript
{
  type: "function",
  function: {
    name: "search_forms",
    description:
      "Search the restaurant's operational forms library (injury reports, employee write-ups, " +
      "incident reports, etc.). Use when the user wants to fill out, complete, file, document, " +
      "or submit a form or report.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query -- key terms about the form (e.g., "injury report", ' +
            '"employee write-up", "incident report", "documentation form")',
        },
      },
      required: ["query"],
    },
  },
}
```

### Why a Minimal Schema

- Only `query` is required -- the function handles language and group scoping internally
- No `match_count` parameter exposed -- default of 5 is appropriate (there are only 2 templates currently)
- No `language` parameter -- inherited from the request-level language
- No `group_id` parameter -- injected from the authenticated request context

### How the AI Knows When to Call search_forms

The AI decides which tools to call based on the system prompt (which describes each tool's purpose) and the user's message. The `form-intent-map` prompt provides:

1. **Tool description** -- "Search operational forms... injury reports, write-ups"
2. **Intent examples** -- "fill out", "write up", "document", "file a report"
3. **Behavioral instructions** -- "When you detect form-filling intent, call search_forms"

Combined with the tool's OpenAI `description` field, this gives the AI two signals: the system prompt guidance AND the function schema description. The AI will prefer `search_forms` over `search_manual_v2` when form intent is detected because:

- `search_manual_v2` is described as "SOPs, policies, training materials"
- `search_forms` is described as "injury reports, write-ups, incident reports"

The descriptions are intentionally non-overlapping.

---

## I.6. Tool Dispatch Implementation

### Full Dispatch Logic

```typescript
// NEW: search_forms dispatch (FTS-only, no embedding)
if (fnName === "search_forms") {
  const { data, error } = await supabase.rpc("search_forms", {
    search_query: searchQuery,
    search_language: language,
    match_count: 5,
    p_group_id: groupId,
  });

  if (error) {
    console.error("[ask] search_forms error:", error.message);
    results = [];
  } else {
    results = (data || []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.title,
      snippet: r.description,
      category: r.icon,
    }));
  }
}
```

### Why FTS-Only (No Embedding)

1. **Few templates** -- Currently 2 published, unlikely to exceed 50 even at scale
2. **Well-titled** -- "Employee Write-Up" and "Employee Injury Report" are highly descriptive titles
3. **FTS is sufficient** -- `plainto_tsquery('english', 'injury report')` matches perfectly against `to_tsvector('english', 'Employee Injury Report')`
4. **No embedding column** -- `form_templates` does not have an embedding column (by design -- Phase 1 plan noted this)
5. **Performance** -- Skipping the OpenAI embedding API call saves 100-200ms per search_forms invocation

### groupId Availability

The `groupId` is already available in the `/ask` handler -- it comes from the request body (`body.groupId`). The existing code validates it at step 2 and uses it for usage checks at step 5. It can be passed directly to `search_forms`'s `p_group_id` parameter.

---

## I.7. Response Format Extension

### Current Response Type

```typescript
interface UnifiedAskResponse {
  answer: string;
  citations: UnifiedCitation[];
  usage: UsageInfo;
  mode: "action" | "search";
  sessionId: string;
}
```

### Decision: Do NOT Change the Response Envelope

Adding `mode: "form_navigation"` to the response type would be a breaking change for all existing frontend consumers. Instead, the form navigation data is embedded within the `answer` text as a structured JSON block.

### How the Frontend Detects Form Navigation

The AI's response (in `answer`) will contain a conversational message followed by a JSON block:

```
I found the Employee Injury Report form, which is used to document workplace injuries
and ensure proper medical response. Would you like me to help you fill it out?

```json
{"form_navigation": {"forms": [{"slug": "employee-injury-report", "title": "Employee Injury Report", "icon": "HeartPulse", "description": "Document workplace injuries..."}], "extractedContext": "John cut his hand on the slicer at 3pm today in the kitchen"}}
```
```

The frontend parses this with a simple regex/JSON extraction:

```typescript
function extractFormNavigation(answer: string): FormNavigationData | null {
  const match = answer.match(/```json\s*\n?\s*(\{"form_navigation"[\s\S]*?\})\s*\n?\s*```/);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed.form_navigation || null;
  } catch {
    return null;
  }
}

interface FormNavigationData {
  forms: Array<{
    slug: string;
    title: string;
    icon: string;
    description: string;
  }>;
  extractedContext: string;
}
```

### Why This Approach

1. **Zero breaking changes** -- The response type is unchanged. Existing consumers ignore the JSON block.
2. **Graceful degradation** -- If parsing fails, the user still sees the conversational text with form names mentioned.
3. **AI-native** -- The AI naturally formats JSON in code fences. The prompt instructs it to do so.
4. **Extensible** -- The `form_navigation` object can carry additional fields in future phases.

### Alternative Considered: Adding `mode: "form_navigation"` to Response

Rejected because:
- Requires updating `UnifiedAskResponse` type definition
- Requires updating the frontend `AskResult` type in `use-ask-ai.ts`
- Requires conditional logic in `Ask.tsx` to handle the new mode
- Risk of breaking existing consumers that switch on `mode`

The in-band JSON approach requires frontend changes only in `Ask.tsx` (parsing) and a new `FormNavigationCard` component, with no type changes needed.

---

## I.8. Context Extraction for Pre-Fill

### What Gets Extracted

When the user says "John cut his hand on the slicer at 3pm today in the kitchen", the AI extracts:

```json
{
  "extractedContext": "John cut his hand on the slicer at 3pm today in the kitchen"
}
```

This is the **raw user description** -- not parsed field values. Parsing into structured `fieldUpdates` is the job of the Phase 3 `ask-form` edge function. Phase 4 merely passes the context through.

### Why Raw Context, Not Parsed Fields

1. **Separation of concerns** -- `/ask` detects intent and routes. `/ask-form` does structured extraction.
2. **Simpler prompt** -- The `/ask` AI does not need the form's field definitions to detect intent.
3. **Less error-prone** -- Field extraction without template context would be unreliable.
4. **Consistent architecture** -- The `ask-form` function already has the full extraction pipeline (prompt, validation, contact resolution).

### Frontend Pre-Fill Flow

```
1. User types "John cut his hand on the slicer at 3pm" in /ask chat
2. AI calls search_forms("injury report")
3. AI responds with form card + extractedContext
4. User clicks "Fill out this form" on the FormNavigationCard
5. Frontend navigates to /forms/employee-injury-report
6. Navigation state carries: { extractedContext: "John cut his hand..." }
7. FormDetail page detects extractedContext in navigation state
8. FormDetail auto-opens AI panel
9. AI panel auto-sends extractedContext as the first message to /ask-form
10. ask-form extracts structured fields from the context
```

### Navigation State Passing

Two options for carrying `extractedContext` from `/ask` to `/forms/:slug`:

**Option A: React Router state (recommended)**
```typescript
navigate(`/forms/${slug}`, {
  state: { extractedContext: "John cut his hand..." }
});
```

**Option B: Context provider**
```typescript
// FormNavigationContext stores extractedContext
// Cleared after FormDetail consumes it
```

Option A is simpler and sufficient. The state is transient (lost on page refresh), which is acceptable -- the user can manually describe the situation again in the AI panel.

---

## I.9. Session/History Considerations

### Does the Chat Session Carry Form Context?

**No.** The `/ask` chat session uses `context_type = 'manual'` (the default domain). When the AI calls `search_forms` and returns form suggestions, this is just a regular search-mode response stored in `chat_messages`. The session does not change context type.

### Conversation Transition from `/ask` to `/ask-form`

There is **no session continuity** between `/ask` and `/ask-form`. They are separate edge functions with separate session types:

| Aspect | `/ask` (Phase 4) | `/ask-form` (Phase 3) |
|--------|------------------|----------------------|
| Context type | `manual` (or whatever domain) | `forms` |
| Session scope | Main chat (all topics) | Per-template (one form) |
| Output format | Free text + optional JSON block | Structured JSON (fieldUpdates) |
| Tool set | 7 tools (6 search + search_forms) | 1-4 tools (from template.ai_tools) |

The bridge is the `extractedContext` string passed via navigation state. This is a clean handoff:

1. `/ask` session: User asks -> AI detects form intent -> returns form suggestion + context
2. Navigation: User clicks form card -> navigates to form page with context
3. `/ask-form` session: New session created -> context becomes first user message -> extraction begins

### Why No Shared Session

- Different AI personas (general assistant vs. form extraction specialist)
- Different system prompts (search-oriented vs. extraction-oriented)
- Different output formats (text vs. JSON)
- Different tool sets
- Session isolation prevents context pollution

---

## I.10. Security Analysis

### No New Attack Surface

Phase 4 adds `search_forms` as a tool in the existing `/ask` edge function. The security posture is unchanged:

| Concern | Analysis |
|---------|----------|
| **Auth** | Same auth flow (Bearer token -> getClaims) |
| **RLS bypass** | `search_forms` is `SECURITY DEFINER` with `SET search_path = 'public'`. It filters by `status = 'published'` and `group_id`. Service role client calls it but the function itself enforces access. |
| **Prompt injection** | The AI calls `search_forms` with a sanitized query. The RPC uses `plainto_tsquery()` which parameterizes the input -- no SQL injection risk. |
| **Data exposure** | `search_forms` only returns title, description, icon, slug -- no sensitive data. Field definitions are NOT returned. |
| **Tool abuse** | Max 3 tool rounds (existing limit). The AI cannot call `search_forms` in an infinite loop. |
| **Cross-group access** | `p_group_id` parameter scoped to the authenticated user's group. Forms from other groups are invisible. |

### extractedContext Safety

The `extractedContext` is a string extracted from the user's own message. It passes through:
1. User -> `/ask` AI (AI echoes the user's description)
2. Navigation state (client-side, not persisted)
3. `/ask-form` AI (becomes a user message, processed by the extraction pipeline)

At no point does it bypass auth or RLS. The `/ask-form` function will authenticate independently when it receives the context.

---

## I.11. Performance Considerations

### Added Latency from search_forms

| Step | Time |
|------|------|
| AI decides to call search_forms | 0ms (part of the existing OpenAI call) |
| `search_forms` RPC execution | ~2-5ms (FTS query on 2-50 rows, GIN index) |
| No embedding generation needed | Saves 100-200ms vs. product search tools |
| Format results + feed back to AI | ~0ms |
| AI generates final response | Part of the follow-up OpenAI call |

**Net impact: ~2-5ms added to tool execution.** This is negligible compared to the 200-800ms OpenAI API calls.

### System Prompt Token Budget

The `form-intent-map` prompt adds approximately 250-300 tokens to the system prompt. The existing budget:

| Component | Tokens |
|-----------|--------|
| base-persona | ~50 |
| tool-map | ~150 |
| behavior-rules | ~100 |
| domain-manual | ~50 |
| language instruction | ~20 |
| **form-intent-map (NEW)** | **~280** |
| History (up to 20 messages) | ~1000-3000 |
| **Total** | **~1650-3650** |

This is well within gpt-4o-mini's 128K context window. The additional cost is approximately $0.0001 per request at current pricing.

---

## I.12. Verification Queries

### 1. Verify form-intent-map prompt is seeded

```sql
SELECT slug, category, domain, length(prompt_en) AS en_len, length(prompt_es) AS es_len
FROM ai_prompts
WHERE slug = 'form-intent-map' AND is_active = true;
-- Expected: 1 row, category='system', domain=NULL, en_len > 200
```

### 2. Verify search_forms still works correctly

```sql
-- English search
SELECT id, slug, title, description, icon, score
FROM search_forms('injury report', 'en', 5, NULL);
-- Expected: employee-injury-report with high score

-- Spanish search
SELECT id, slug, title, description, icon, score
FROM search_forms('amonestacion empleado', 'es', 5, NULL);
-- Expected: employee-write-up with high score

-- Ambiguous query
SELECT id, slug, title, description, icon, score
FROM search_forms('employee', 'en', 5, NULL);
-- Expected: both templates returned

-- No match
SELECT id, slug, title, description, icon, score
FROM search_forms('pizza recipe', 'en', 5, NULL);
-- Expected: 0 rows
```

### 3. Verify search_forms respects group scope

```sql
-- With valid group
SELECT count(*) FROM search_forms(
  'injury',
  'en',
  5,
  (SELECT id FROM groups WHERE slug = 'alamo-prime')
);
-- Expected: 1

-- With non-existent group
SELECT count(*) FROM search_forms(
  'injury',
  'en',
  5,
  '00000000-0000-0000-0000-000000000000'::UUID
);
-- Expected: 0
```

### 4. Verify all ai_prompts that /ask loads are present

```sql
SELECT slug, category, domain, is_active
FROM ai_prompts
WHERE slug IN ('base-persona', 'tool-map', 'form-intent-map', 'behavior-rules', 'domain-manual')
ORDER BY sort_order;
-- Expected: 5 rows, all is_active = true
```

### 5. Verify existing /ask functionality is unbroken

```sql
-- search_manual_v2 still works (Phase 4 changes should not affect this)
SELECT count(*) FROM search_manual_v2(
  'hand washing',
  '[]'::TEXT,  -- empty embedding (will fall back to FTS only)
  'en',
  5
);
-- Expected: > 0 (if manual content exists)
```

### 6. End-to-End Test Scenarios (Manual via cURL or Frontend)

| # | User Input | Expected AI Behavior |
|---|-----------|---------------------|
| 1 | "I need to fill out an injury report" | AI calls `search_forms("injury report")`, returns Employee Injury Report form card |
| 2 | "Write up John for being late" | AI calls `search_forms("write up")`, returns Employee Write-Up form card with extractedContext containing "John" and "being late" |
| 3 | "Where is the form for documenting an injury?" | AI calls `search_forms("injury")`, returns form card |
| 4 | "How do I properly store raw chicken?" | AI calls `search_manual_v2` (NOT search_forms) -- this is a manual question, not form intent |
| 5 | "What temperature should steak be cooked to?" | AI calls `search_dishes` or `search_recipes` -- no form intent detected |
| 6 | "I need a form for something we don't have" | AI calls `search_forms`, gets 0 results, says "I don't have a form for that" |
| 7 | "John hurt his hand at 3pm on the slicer" | AI may or may not detect form intent -- ambiguous. If it does, it should suggest the injury report |

---

## Summary

### Migration Required

| File | SQL Lines | Description |
|------|-----------|-------------|
| `supabase/migrations/YYYYMMDDHHMMSS_seed_form_intent_prompt.sql` | ~30 | Seed `form-intent-map` ai_prompt |

### Edge Function Changes

| File | Changes |
|------|---------|
| `supabase/functions/ask/index.ts` | 6 targeted changes: add `search_forms` tool def, update type union, update context map, load new prompt, handle FTS dispatch, skip product expansion for forms |

### Files NOT Changed

| File | Reason |
|------|--------|
| `search_forms` RPC | Already returns the exact data Phase 4 needs |
| `form_templates` table | No schema changes needed |
| `chat_sessions` table | Already supports 'forms' context type from Phase 3 |
| `ai_prompts` constraints | New row satisfies existing constraints |
| Shared modules (`_shared/*`) | No changes needed |

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| AI fails to detect form intent | Moderate | Intent examples in prompt + tool description. Tunable via ai_prompts admin edit. |
| AI calls search_forms for non-form queries | Low | Tool description is specific. Behavior-rules prompt limits search rounds. |
| JSON block not present in AI response | Low | Frontend gracefully degrades -- shows text response without form card. |
| JSON block malformed | Low | Three-tier parser (exact JSON, code fence, brace match). Fallback: show text only. |
| extractedContext lost on page refresh | Low | Acceptable UX -- user can describe situation again in AI panel. |

---

*This is the database & backend plan for Phase 4: Main AI Chat Integration. It covers schema assessment, migration details, edge function changes, session considerations, and verification queries.*
