# Phase 4: Main AI Chat Integration -- Unified Implementation Plan

> **Status:** Planning
> **Date:** 2026-02-24
> **Estimated effort:** ~1 session
> **Dependencies:** Phase 3 (AI Form Filling, complete)
> **Output:** 1 migration, edge function update, 1 new component, 3 modified files
> **Authors:** Senior Database Architect, Technical Architect, Senior UX/UI Designer, Devil's Advocate (all Opus)

---

## Table of Contents

### Part I -- Database & Backend
1. [I.1. Schema Assessment](#i1-schema-assessment)
2. [I.2. Migration: Seed form-intent-map Prompt](#i2-migration-seed-form-intent-map-prompt)
3. [I.3. Edge Function Changes Overview](#i3-edge-function-changes-overview)
4. [I.4. Verification Queries](#i4-verification-queries)

### Part II -- Technical Architecture
1. [II.1. /ask Edge Function Modification](#ii1-ask-edge-function-modification)
2. [II.2. Tool Execution: FTS-Only Path](#ii2-tool-execution-fts-only-path)
3. [II.3. Response Format Extension](#ii3-response-format-extension)
4. [II.4. Intent Detection Strategy](#ii4-intent-detection-strategy)
5. [II.5. Pre-fill Context Strategy](#ii5-pre-fill-context-strategy)
6. [II.6. Multi-Turn Flow](#ii6-multi-turn-flow)
7. [II.7. Error Handling](#ii7-error-handling)
8. [II.8. Security](#ii8-security)

### Part III -- Frontend: Components & Integration
1. [III.1. Design Principles](#iii1-design-principles)
2. [III.2. FormNavigationCard Component](#iii2-formnavigationcard-component)
3. [III.3. Chat-to-Form Navigation Flow](#iii3-chat-to-form-navigation-flow)
4. [III.4. Context Passing Mechanism](#iii4-context-passing-mechanism)
5. [III.5. Ask.tsx Modifications](#iii5-asktsx-modifications)
6. [III.6. FormDetail.tsx Pre-fill Integration](#iii6-formdetailtsx-pre-fill-integration)
7. [III.7. Type Additions](#iii7-type-additions)
8. [III.8. Mobile vs Desktop](#iii8-mobile-vs-desktop)
9. [III.9. Component File Map](#iii9-component-file-map)
10. [III.10. ASCII Mockups](#iii10-ascii-mockups)
11. [III.11. Accessibility Checklist](#iii11-accessibility-checklist)

### Part IV -- Risks & Edge Cases (Devil's Advocate)
1. [IV. Risk Assessment Matrix](#iv-risk-assessment-matrix)
2. [IV.1-IV.8 All Risks by Category](#iv1-intent-detection-accuracy)
3. [IV. Summary by Priority](#iv-summary-by-priority)
4. [IV. Recommendations for Implementation](#iv-recommendations-for-the-implementation-plan)

### Part V -- File Manifest & Verification Plan
1. [V.1. Unified File Manifest](#v1-unified-file-manifest)
2. [V.2. Verification Plan](#v2-verification-plan)
3. [V.3. Existing Code References](#v3-existing-code-references)

---
---

# Part I -- Database & Backend

## I.1. Schema Assessment

### What Already Exists and Is Sufficient

Phase 1 and Phase 3 migrations have prepared everything the backend needs. The following require **no changes:**

| Table / Object | Phase 4 Relevance | Changes Needed |
|---|---|---|
| `form_templates` | `search_forms` searches this table by FTS | **None** |
| `form_templates.search_vector` TSVECTOR | GIN-indexed, auto-populated by trigger from title/description EN+ES | **None** |
| `search_forms` RPC function | FTS search returning `id, slug, title, description, icon, score` | **None** -- already returns exactly what Phase 4 needs |
| `chat_sessions` | Session persistence for `/ask` conversations | **None** -- `context_type = 'manual'` is used for main chat sessions |
| `chat_messages` | Message persistence for conversation history | **None** |
| `ai_prompts` (base-persona, tool-map, behavior-rules) | System prompt assembly for `/ask` | **tool-map needs updating** (see Section I.2) |
| `get_or_create_chat_session` | Session management | **None** |
| `get_chat_history` | History loading | **None** |
| `get_user_usage` / `increment_usage` | Usage limit check/increment | **None** |

### What Needs Changes

| # | Change | Reason |
|---|---|---|
| 1 | Add new `form-intent-map` ai_prompt row | The `/ask` system prompt needs to tell the AI about the `search_forms` tool so it knows when to call it |

**Total: 1 small migration. Zero new tables. Zero new columns.**

### Key Finding: `search_forms` Already Exists

The `search_forms` RPC was created in Phase 1 migration `20260223200006_create_search_forms.sql`. It returns exactly what Phase 4 needs:

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

## I.2. Migration: Seed form-intent-map Prompt

### Problem

The current `tool-map` prompt in `ai_prompts` lists 6 search tools (manual, dishes, wines, cocktails, recipes, beer_liquor) but does **not** mention `search_forms`. The AI will never call a tool it does not know exists.

### Approach: Add New `form-intent-map` Row (Not Modify `tool-map`)

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
   E'You also have access to a form search tool:\n\n- search_forms(query): Search the restaurant''s operational forms library (injury reports, write-ups, incident reports, etc.). Use this tool when the user expresses intent to fill out, complete, file, document, or submit a form or report. Examples of form-related intent:\n  - "I need to fill out an injury report"\n  - "Write up John for being late"\n  - "I need to document an incident"\n  - "File a report about..."\n  - "Where''s the form for..."\n\nWhen you detect form-filling intent:\n1. Call search_forms with a concise query extracted from the user''s message\n2. Present the matching form(s) to the user\n3. Ask "Would you like to fill out this form?" or similar confirmation\n4. Extract any contextual information from the user''s original message that could pre-fill form fields (names, dates, descriptions, etc.) and include it in your response\n\nIMPORTANT: Only call search_forms when the user explicitly wants to START filling out a form, not when they want to LEARN ABOUT a form or its procedures. If unsure, answer the informational question first and then offer the form as an option.',
   E'Tambien tienes acceso a una herramienta de busqueda de formularios:\n\n- search_forms(query): Buscar en la biblioteca de formularios operativos del restaurante (reportes de lesiones, amonestaciones, reportes de incidentes, etc.). Usa esta herramienta cuando el usuario exprese intencion de llenar, completar, presentar, documentar o enviar un formulario o reporte. Ejemplos de intencion relacionada con formularios:\n  - "Necesito llenar un reporte de lesion"\n  - "Amonestar a Juan por llegar tarde"\n  - "Necesito documentar un incidente"\n  - "Presentar un reporte sobre..."\n  - "Donde esta el formulario para..."\n\nCuando detectes intencion de llenar formularios:\n1. Llama a search_forms con una consulta concisa extraida del mensaje del usuario\n2. Presenta el/los formulario(s) encontrados al usuario\n3. Pregunta "Quieres llenar este formulario?" o una confirmacion similar\n4. Extrae cualquier informacion contextual del mensaje original del usuario que pueda pre-llenar campos del formulario (nombres, fechas, descripciones, etc.) e incluyela en tu respuesta\n\nIMPORTANTE: Solo llama a search_forms cuando el usuario quiera COMENZAR a llenar un formulario, no cuando quiera APRENDER sobre un formulario o sus procedimientos. Si no estas seguro, responde la pregunta informativa primero y luego ofrece el formulario como opcion.',
   2);

COMMIT;
```

### Why a Separate Prompt Row

1. **Non-destructive** -- does not touch the existing `tool-map` row
2. **Toggleable** -- admin can set `is_active = false` to disable form routing without affecting other tool descriptions
3. **Clean separation** -- form intent detection logic is isolated from the 6 product/manual tool descriptions
4. **Constraint-safe** -- `category = 'system'` with `domain = NULL` satisfies both `ai_prompts_category_check` and `ai_prompts_domain_required`

---

## I.3. Edge Function Changes Overview

The `/ask` edge function (`supabase/functions/ask/index.ts`) needs these targeted changes:

| # | Change | Description |
|---|---|---|
| 1 | Add `"forms"` to `ContextType` + `VALID_CONTEXTS` | For citation tagging |
| 2 | Add `search_forms` tool to `SEARCH_TOOLS` array | New OpenAI function calling definition |
| 3 | Add `search_forms: "forms"` to `SEARCH_FN_TO_CONTEXT` | Maps tool name to domain |
| 4 | Load `form-intent-map` prompt slug | Add to the slugs array in prompt loading |
| 5 | Add `executeSearchForms` helper | FTS-only dispatch (no embedding) |
| 6 | Handle `search_forms` in tool-use loop | Branch before embedding generation |
| 7 | Extend response with `formSuggestions` + `prefillContext` | New optional fields |
| 8 | Skip product expansion for form results | Exclude `search_forms` from product fetch |
| 9 | **Fix OFF_TOPIC_PATTERNS** | The regex `/\b(write me a\|compose\|draft a letter\|essay)\b/i` blocks "write me a write-up" |

Full implementation details in Part II.

---

## I.4. Verification Queries

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

### 3. Verify all ai_prompts that /ask loads are present

```sql
SELECT slug, category, domain, is_active
FROM ai_prompts
WHERE slug IN ('base-persona', 'tool-map', 'form-intent-map', 'behavior-rules', 'domain-manual')
ORDER BY sort_order;
-- Expected: 5 rows, all is_active = true
```

### 4. Verify search_forms respects group scope

```sql
-- With valid group
SELECT count(*) FROM search_forms(
  'injury', 'en', 5,
  (SELECT id FROM groups WHERE slug = 'alamo-prime')
);
-- Expected: 1

-- With non-existent group
SELECT count(*) FROM search_forms(
  'injury', 'en', 5,
  '00000000-0000-0000-0000-000000000000'::UUID
);
-- Expected: 0
```

---
---

# Part II -- Technical Architecture

## II.1. /ask Edge Function Modification

### Current Architecture

The unified `/ask` edge function operates in two modes:

| Mode | Trigger | Tools | Description |
|------|---------|-------|-------------|
| **Action** | `action` + `itemContext` present | None (data in context) | Button-press actions with full card data |
| **Search** | No `action` | 6 `SEARCH_TOOLS` | Freeform questions with tool-use loop (max 3 rounds) |

There is also an early-branch for `domain === 'training'` that bypasses the normal flow entirely.

Phase 4 adds a **seventh search tool** (`search_forms`) to the existing `SEARCH_TOOLS` array. The AI decides when to call it based on intent signals in the user's question.

### Type and Constant Changes

```typescript
// 1. Add "forms" to ContextType union (line ~40)
type ContextType =
  | "manual"
  | "dishes"
  | "wines"
  | "cocktails"
  | "recipes"
  | "beer_liquor"
  | "training"
  | "forms";       // <-- NEW

// 2. Add to VALID_CONTEXTS (line ~49)
const VALID_CONTEXTS: ContextType[] = [
  "manual", "dishes", "wines", "cocktails", "recipes",
  "beer_liquor", "training",
  "forms",         // <-- NEW (not used as inbound domain, needed for citations)
];

// 3. Add to SEARCH_FN_TO_CONTEXT (line ~144)
const SEARCH_FN_TO_CONTEXT: Record<string, ContextType> = {
  search_manual_v2: "manual",
  search_dishes: "dishes",
  search_wines: "wines",
  search_cocktails: "cocktails",
  search_recipes: "recipes",
  search_beer_liquor: "beer_liquor",
  search_forms: "forms",   // <-- NEW
};
```

### New Tool Definition

Append to the `SEARCH_TOOLS` array after `search_beer_liquor`:

```typescript
{
  type: "function",
  function: {
    name: "search_forms",
    description:
      "Search available operational forms (write-ups, injury reports, incident reports, " +
      "checklists). Use when the user wants to fill out, complete, submit, or file a form " +
      "or report. Also use when the user mentions documenting an incident, writing someone " +
      "up, or filing a complaint. ONLY use when the user wants to START filling a form, " +
      "NOT when they want to learn about procedures.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query -- e.g., "injury report", "employee write-up", "incident form"',
        },
      },
      required: ["query"],
    },
  },
},
```

### Load form-intent-map Prompt

In prompt loading section (step 7), add `form-intent-map` to the slugs array:

```typescript
const promptSlugs = [
  "base-persona",
  "tool-map",
  "form-intent-map",  // <-- NEW: always loaded so AI knows about search_forms
  "behavior-rules",
  `domain-${domain}`,
  ...(isActionMode ? [`action-${domain}-${action}`] : []),
];
```

Append in the search mode prompt assembly:

```typescript
// After adding tool-map and behavior-rules:
const formIntentMap = getPrompt("form-intent-map");
if (formIntentMap) systemParts.push(formIntentMap);
```

### OFF_TOPIC_PATTERNS Fix (CRITICAL)

The existing regex at line 176:

```typescript
/\b(write me a|compose|draft a letter|essay)\b/i,
```

This **will block** "write me a write-up for John" -- a core Phase 4 use case. The fix:

```typescript
// Change from:
/\b(write me a|compose|draft a letter|essay)\b/i,

// Change to:
/\b(compose|draft a letter|essay)\b/i,
```

Remove "write me a" from the off-topic pattern. The risk of "write me a poem" or similar getting through is acceptable -- the AI will handle it via the search tools and respond appropriately.

---

## II.2. Tool Execution: FTS-Only Path

### Why FTS-Only (No Embedding)

1. **Few templates** -- Currently 2 published, unlikely to exceed 50 even at scale
2. **Well-titled** -- "Employee Write-Up" and "Employee Injury Report" are highly descriptive
3. **No embedding column** -- `form_templates` does not have an embedding column (by design)
4. **Performance** -- Skipping the OpenAI embedding API call saves 100-200ms per invocation

### New Helper: executeSearchForms

```typescript
// =============================================================================
// HELPER: executeSearchForms (FTS-only, no embedding)
// =============================================================================

async function executeSearchForms(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  searchQuery: string,
  language: string,
  groupId: string,
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc("search_forms", {
    search_query: searchQuery,
    search_language: language,
    match_count: 5,
    p_group_id: groupId,
  });

  if (error) {
    console.error("[ask] search_forms error:", error.message);
    return [];
  }

  if (!data?.length) return [];

  // Map search_forms result shape to the generic SearchResult interface
  // deno-lint-ignore no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.title,      // search_forms returns 'title', not 'name'
    snippet: row.description || "",
    category: row.icon,   // Reuse category field to carry the icon name
  }));
}
```

### Modified Tool Execution Loop

Replace the inner tool call dispatch in the search mode for-loop:

```typescript
for (const toolCall of assistantMsg.tool_calls) {
  const fnName = toolCall.function.name;
  const fnArgs = JSON.parse(toolCall.function.arguments);
  const rawQuery = fnArgs.query;
  const searchQuery = stripStopWords(rawQuery);

  console.log(`[ask] Executing tool: ${fnName}(query="${searchQuery}")`);

  let results: SearchResult[];

  if (fnName === "search_forms") {
    // search_forms is FTS-only -- no embedding needed (saves 100-200ms)
    results = await executeSearchForms(supabase, searchQuery, language, groupId);
  } else {
    // All other tools use hybrid (FTS + vector) search
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
      if (r.category) parts.push(`   Icon: ${r.category}`);
      return parts.join("\n");
    })
    .join("\n\n");
}
```

### Skip Product Expansion for Form Results

Update the product expansion filter (line ~1544) to exclude forms:

```typescript
// Change from:
const productSearchResults = allSearchResults.filter(
  (r) => r.fnName !== "search_manual_v2"
);

// Change to:
const productSearchResults = allSearchResults.filter(
  (r) => r.fnName !== "search_manual_v2" && r.fnName !== "search_forms"
);
```

---

## II.3. Response Format Extension

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

### Extended Response Type

Add optional fields -- **do NOT break the existing response envelope**:

```typescript
interface FormSuggestion {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
}

interface UnifiedAskResponse {
  answer: string;
  citations: UnifiedCitation[];
  usage: UsageInfo;
  mode: "action" | "search" | "form_navigation";  // <-- extended
  sessionId: string;
  formSuggestions?: FormSuggestion[];               // <-- NEW optional
  prefillContext?: string;                           // <-- NEW optional
}
```

### Building the Response

After the tool-use loop completes in search mode, detect form results:

```typescript
// After extracting the final answer (around line 1617-1646):

// Detect form search results
const formSearchResults = allSearchResults.filter(
  (r) => r.fnName === "search_forms"
);
const hasFormResults = formSearchResults.length > 0;

// Build mode and optional fields
const responseMode: "action" | "search" | "form_navigation" = hasFormResults
  ? "form_navigation"
  : mode;

const formSuggestions: FormSuggestion[] | undefined = hasFormResults
  ? formSearchResults.map(({ result: r }) => ({
      id: r.id,
      slug: r.slug,
      title: r.name,
      description: (r.snippet || "").replace(/<\/?mark>/g, ""),
      icon: r.category || "FileText",
    }))
  : undefined;

const prefillContext = hasFormResults ? question : undefined;

// In the final return:
return jsonResponse({
  answer,
  citations,
  usage: updatedUsage,
  mode: responseMode,
  sessionId: activeSessionId,
  ...(formSuggestions && { formSuggestions }),
  ...(prefillContext && { prefillContext }),
});
```

### Backward Compatibility

Existing consumers that only check `mode === "search"` or `mode === "action"` will treat `"form_navigation"` as unknown and fall through to default rendering. The `formSuggestions` field is optional and will be `undefined` for all non-form responses.

---

## II.4. Intent Detection Strategy

### Approach: OpenAI Function Calling (No Separate Classifier)

Intent detection is **entirely handled by OpenAI's function calling**. The system prompt and tool description work together:

1. The **tool description** contains explicit intent patterns ("fill out", "write-up", "incident report")
2. The **system prompt** (`form-intent-map` in `ai_prompts`) lists `search_forms` with behavioral guidance
3. The **behavior rules** prompt already instructs parallel tool calls for broad questions

**Why not a separate classification step?**

| Approach | Pros | Cons |
|----------|------|------|
| Separate classifier (regex/prompt) | Explicit control | Extra latency, maintenance burden, two AI calls |
| Function calling (chosen) | Zero extra latency, model sees full context, proven pattern | Occasional miss or false-positive |

The function calling approach is already proven with the existing 6 tools. Adding a 7th follows the exact same pattern.

### Intent Patterns the Model Will Recognize

**Direct form intent (high confidence):**
- "I need to fill out an injury report"
- "Write up John for being late"
- "I need the employee write-up form"
- "File an incident report"

**Indirect form intent (medium confidence -- AI may call both tools):**
- "John got hurt, what do I do?"
- "Someone was late again"
- "There was a slip and fall"

**Non-form intent (AI should NOT call search_forms):**
- "What's the procedure for injury reporting?" (policy question)
- "Tell me about the ribeye" (menu question)
- "What temperature for chicken?" (food safety)

---

## II.5. Pre-fill Context Strategy

### Pass Raw Text, Not Structured Fields

When the user says "John cut his hand on the slicer at 3pm", the `prefillContext` is the **entire original question as a string**. The `/ask` edge function does NOT attempt to parse or structure the context.

**Why:**
1. **Separation of concerns** -- `/ask` detects intent and routes. `/ask-form` does structured extraction.
2. **Accuracy** -- `/ask-form` has the full template schema (field definitions, types, options, ai_hints). `/ask` does not.
3. **Simplicity** -- One string field vs. an arbitrary structured object.

### Flow

```
1. User types "John cut his hand on the slicer at 3pm" in /ask chat
2. AI calls search_forms("injury report")
3. AI responds with form suggestion + answer text
4. /ask returns: { mode: "form_navigation", formSuggestions: [...], prefillContext: "John cut..." }
5. User clicks "Fill out this form" on FormNavigationCard
6. Frontend navigates to /forms/employee-injury-report with state
7. FormDetail detects prefillContext in navigation state
8. FormDetail auto-opens AI panel
9. AI panel auto-sends prefillContext as first message to /ask-form
10. /ask-form extracts structured fields from the context
```

---

## II.6. Multi-Turn Flow

### Happy Path: Single Form Match

```
User: "I need to fill out an injury report"
AI:   [calls search_forms("injury report")]
      -> 1 result: Employee Injury Report
AI:   "I found the Employee Injury Report form. Would you like to fill it out?"
      + formSuggestions: [{ slug: "employee-injury-report", ... }]

Frontend: Shows FormNavigationCard. User clicks it.
          -> Navigates to /forms/employee-injury-report
```

### Multiple Form Matches

```
User: "I need to file a report"
AI:   [calls search_forms("report")]
      -> 2 results: Employee Injury Report, Employee Write-Up
AI:   "I found 2 forms that might help:
       1. Employee Injury Report -- for documenting workplace injuries
       2. Employee Write-Up -- for documenting policy violations
       Which one would you like to fill out?"
      + formSuggestions: [both forms]

Frontend: Shows 2 FormNavigationCards. User clicks one.
```

### User Says "No, Not That Form"

The conversation continues naturally via chat session history:

```
User: "No, I meant a food safety incident report"
AI:   [calls search_forms("food safety incident report")]
      -> No results
AI:   "I don't see a food safety incident report form. The closest option
       is the Employee Injury Report. Would you like me to search the
       manual for food safety procedures instead?"
```

### User Provides Context Before Choosing

```
User: "John cut his hand on the slicer at 3pm, I need to document this"
AI:   [calls search_forms("injury report")]
AI:   "I found the Employee Injury Report form. I can help you fill it
       out with the details you've shared."
      + formSuggestions: [{ slug: "employee-injury-report", ... }]
      + prefillContext: "John cut his hand on the slicer at 3pm..."

User clicks card -> navigates with prefillContext
FormDetail auto-opens AI -> ask-form extracts fields
```

---

## II.7. Error Handling

### No Forms Found

```
User: "I need a vacation request form"
AI:   [calls search_forms("vacation request")] -> 0 results
AI:   "I couldn't find a vacation request form. The available forms are
       for operational needs like injury reports and employee write-ups.
       Would you like me to search the manual for vacation procedures?"
```

Mode stays as `"search"` -- no `formSuggestions` in response.

### search_forms RPC Fails

```typescript
// Already handled in executeSearchForms:
if (error) {
  console.error("[ask] search_forms error:", error.message);
  return [];
}
```

The AI receives "No forms found" and responds conversationally.

### Form Template No Longer Published

If the user clicks a form card but the template has been unpublished:

1. Frontend navigates to `/forms/:slug`
2. `useFormTemplate` queries by slug + status='published'
3. Returns null -> FormDetail renders "Form not found" error state
4. User clicks "Back to Forms"

This is already handled by the existing FormDetail error state (lines 344-358).

### Other Failures

| Failure | Detection | Recovery |
|---------|-----------|----------|
| OpenAI timeout | Existing error handling | Returns 500 |
| Invalid form slug | FormDetail shows "not found" | Existing error state |
| User ignores card | No action needed | Card simply not clicked |

---

## II.8. Security

### No New Attack Surface

| Concern | Analysis |
|---------|----------|
| **Auth** | Same auth flow (Bearer token -> getClaims) |
| **RLS bypass** | `search_forms` is `SECURITY DEFINER` with `SET search_path = 'public'`. Filters by `status = 'published'` and `group_id`. |
| **Prompt injection** | `search_forms` uses `plainto_tsquery()` which parameterizes input -- no SQL injection. |
| **Data exposure** | Returns title, description, icon, slug -- no sensitive data. Field definitions NOT returned. |
| **Tool abuse** | Max 3 tool rounds. AI cannot loop infinitely. |
| **Cross-group access** | `p_group_id` scoped to authenticated user's group. |

### extractedContext Safety

The `prefillContext` is a string from the user's own message. It passes through:
1. User -> `/ask` AI (echoed back)
2. Navigation state (client-side, not persisted to URL)
3. `/ask-form` AI (becomes a user message, processed by extraction pipeline)

At no point does it bypass auth or RLS. The `/ask-form` function authenticates independently.

---
---

# Part III -- Frontend: Components & Integration

## III.1. Design Principles

| Principle | Application |
|-----------|-------------|
| **Continuity over interruption** | The transition from `/ask` chat to `/forms/:slug` should feel like a natural continuation of the conversation, not a jarring page change. |
| **Show, then confirm** | When the AI detects form intent, it shows matching form(s) as visual cards *inside the chat*. The user explicitly confirms before navigation. No auto-redirects. |
| **Context travels with you** | Whatever the user described in the chat travels to the form page. They do not repeat themselves. |
| **Reuse existing patterns** | `FormCard` already exists with icon emoji tiles. `FormNavigationCard` inherits this visual language. |
| **Reversible** | The user can dismiss the suggestion, go back from the form page, or ignore the pre-fill context. |
| **Mobile-first, desktop-enhanced** | On mobile, navigation replaces the view. On desktop, the chat lives in `AppShell.aiPanel`. Both paths lead to the same `FormDetail` page with the same pre-fill logic. |

---

## III.2. FormNavigationCard Component

### File: `src/components/chat/FormNavigationCard.tsx`

```tsx
import { cn } from '@/lib/utils';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Reuse the same icon map from FormCard.tsx
const ICON_EMOJI_MAP: Record<string, { emoji: string; bg: string; darkBg: string }> = {
  ClipboardList:   { emoji: '\u{1F4CB}', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  AlertTriangle:   { emoji: '\u{26A0}\u{FE0F}',  bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  FileWarning:     { emoji: '\u{26A0}\u{FE0F}',  bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  ShieldAlert:     { emoji: '\u{1F6E1}\u{FE0F}', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  UserX:           { emoji: '\u{1F464}', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  FileText:        { emoji: '\u{1F4C4}', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Stethoscope:     { emoji: '\u{1FA7A}', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  Wrench:          { emoji: '\u{1F527}', bg: 'bg-gray-100',   darkBg: 'dark:bg-gray-800' },
  CheckSquare:     { emoji: '\u{2705}', bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-900/30' },
  Calendar:        { emoji: '\u{1F4C5}', bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/30' },
};

const DEFAULT_ICON = { emoji: '\u{1F4CB}', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30' };

const STRINGS = {
  en: {
    fillForm: 'Fill this form',
    notNeeded: 'Not what I need',
    navigating: 'Opening form...',
    bestMatch: 'Best match',
  },
  es: {
    fillForm: 'Llenar formulario',
    notNeeded: 'No es lo que necesito',
    navigating: 'Abriendo formulario...',
    bestMatch: 'Mejor resultado',
  },
} as const;

export interface FormNavigationOption {
  slug: string;
  title: string;
  description: string | null;
  icon: string;
}

export interface FormNavigationCardProps {
  /** The AI's message text */
  message: string;
  /** Array of matching forms (1-3 typically) */
  forms: FormNavigationOption[];
  /** Called when user clicks "Fill this form" */
  onSelect: (slug: string) => void;
  /** Called when user dismisses the suggestion */
  onDismiss: () => void;
  /** Current language */
  language: 'en' | 'es';
  /** Whether navigation is in progress */
  isNavigating?: boolean;
}

export function FormNavigationCard({
  message,
  forms,
  onSelect,
  onDismiss,
  language,
  isNavigating = false,
}: FormNavigationCardProps) {
  const t = STRINGS[language];

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/60',
        'bg-card shadow-card',
        'p-4',
      )}
    >
      {/* AI message */}
      <p className="text-sm text-foreground mb-3 leading-relaxed">
        {message}
      </p>

      {/* Form option cards */}
      <div className="space-y-2">
        {forms.map((form, idx) => {
          const iconConfig = ICON_EMOJI_MAP[form.icon] ?? DEFAULT_ICON;
          const isTopMatch = idx === 0 && forms.length > 1;

          return (
            <div
              key={form.slug}
              className={cn(
                'flex items-start gap-3 p-3',
                'rounded-xl',
                'border transition-all duration-150',
                isTopMatch
                  ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                  : 'border-border/60 bg-muted/20 dark:bg-muted/10',
              )}
            >
              {/* Icon tile -- 40x40 */}
              <div
                className={cn(
                  'flex items-center justify-center shrink-0',
                  'w-10 h-10 rounded-[10px]',
                  iconConfig.bg,
                  iconConfig.darkBg,
                )}
              >
                <span className="text-[20px] h-[20px] leading-[20px]">
                  {iconConfig.emoji}
                </span>
              </div>

              {/* Title + description + button */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
                  {form.title}
                </h4>
                {form.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {form.description}
                  </p>
                )}
                {isTopMatch && (
                  <span
                    className={cn(
                      'inline-flex items-center mt-1',
                      'px-1.5 py-0.5 rounded-full',
                      'bg-primary/10 dark:bg-primary/15',
                      'text-[10px] font-semibold text-primary',
                    )}
                  >
                    {t.bestMatch}
                  </span>
                )}

                <Button
                  size="sm"
                  onClick={() => onSelect(form.slug)}
                  disabled={isNavigating}
                  className={cn(
                    'mt-2 h-8 px-3 text-xs font-semibold',
                    'rounded-full',
                    isTopMatch
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  {isNavigating ? t.navigating : (
                    <>
                      {t.fillForm}
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dismiss link */}
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'flex items-center gap-1 mt-3',
          'text-xs text-muted-foreground',
          'hover:text-foreground',
          'transition-colors duration-100',
        )}
      >
        <X className="h-3 w-3" />
        {t.notNeeded}
      </button>
    </div>
  );
}
```

---

## III.3. Chat-to-Form Navigation Flow

### 10-Step User Journey

```
Step 1:  User types in /ask chat
         "I need to fill out an injury report for John who cut his hand at 3pm"

Step 2:  Frontend sends question to /ask edge function

Step 3:  /ask detects form intent via OpenAI function calling, calls search_forms

Step 4:  /ask returns { mode: "form_navigation", formSuggestions: [...], prefillContext }

Step 5:  Chat displays FormNavigationCard with form option(s)

Step 6:  User clicks "Fill this form"

Step 7:  App navigates: navigate(`/forms/${slug}`, { state: { prefillContext, fromChat: true } })

Step 8:  FormDetail detects prefillContext in location.state

Step 9:  AI panel auto-opens, auto-sends prefillContext to /ask-form

Step 10: ask-form extracts structured fields, auto-applies to form
```

---

## III.4. Context Passing Mechanism

**Chosen:** React Router `navigate(path, { state })`.

| Mechanism | Pros | Cons | Verdict |
|-----------|------|------|---------|
| `navigate(path, { state })` | Built-in, no URL pollution, cleared on refresh | Lost on manual URL entry | **Selected** |
| URL search params | Bookmarkable | Long text = ugly URL, security concerns | Rejected |
| sessionStorage | Survives refresh | Manual cleanup, race conditions | Backup option |
| React Context | Fast, in-memory | Lost on refresh, requires provider wrapper | Rejected |

**Why `navigate` state is ideal:**
1. Pre-fill context is ephemeral by nature -- should fire once from chat
2. If user refreshes, form loads normally (acceptable)
3. No URL pollution -- `/forms/employee-injury-report` stays clean
4. No global state management needed

### Navigation State Interface

```typescript
// Add to src/types/forms.ts

export interface FormPrefillState {
  /** The user's original description from the /ask chat */
  prefillContext: string;
  /** Flag indicating this navigation came from the main AI chat */
  fromChat: true;
}
```

---

## III.5. Ask.tsx Modifications

### Extended State

```typescript
const [currentAnswer, setCurrentAnswer] = useState<{
  question: string;
  answer: string;
  citations: Citation[];
  isLoading: boolean;
  isExpanding: boolean;
  // NEW fields for form navigation:
  formSuggestions?: FormSuggestion[];
  prefillContext?: string;
  mode?: string;
} | null>(null);

const [formNavResult, setFormNavResult] = useState<{
  message: string;
  forms: FormSuggestion[];
  prefillContext: string;
} | null>(null);

const [isFormNavigating, setIsFormNavigating] = useState(false);
```

### Modified handleAsk

```typescript
const handleAsk = async () => {
  if (!question.trim() || isLoading || isAtLimit) return;

  const askedQuestion = question;
  setQuestion("");
  setFormNavResult(null); // Clear any previous form suggestion

  setCurrentAnswer({
    question: askedQuestion,
    answer: "",
    citations: [],
    isLoading: true,
    isExpanding: false,
  });

  const result = await ask(askedQuestion);

  if (result) {
    incrementUsageOptimistically();

    // Check if this is a form navigation response
    if (result.mode === 'form_navigation' && result.formSuggestions?.length) {
      setCurrentAnswer(null);
      setFormNavResult({
        message: result.answer,
        forms: result.formSuggestions,
        prefillContext: result.prefillContext || askedQuestion,
      });
    } else {
      setCurrentAnswer({
        question: askedQuestion,
        answer: result.answer,
        citations: result.citations,
        isLoading: false,
        isExpanding: false,
      });
    }
  } else {
    setCurrentAnswer(null);
  }
};
```

### Navigation Handlers

```typescript
const handleFormSelect = useCallback((slug: string) => {
  if (!formNavResult) return;
  setIsFormNavigating(true);

  navigate(`/forms/${slug}`, {
    state: {
      prefillContext: formNavResult.prefillContext,
      fromChat: true,
    } as FormPrefillState,
  });
}, [navigate, formNavResult]);

const handleFormDismiss = useCallback(() => {
  setFormNavResult(null);
}, []);
```

### Rendering FormNavigationCard

In both the desktop `aiPanel` and mobile content area, add:

```tsx
{/* Where AIAnswerCard currently renders, add a branch: */}
{formNavResult ? (
  <FormNavigationCard
    message={formNavResult.message}
    forms={formNavResult.forms.map(f => ({
      slug: f.slug,
      title: f.title,
      description: f.description,
      icon: f.icon,
    }))}
    onSelect={handleFormSelect}
    onDismiss={handleFormDismiss}
    language={language}
    isNavigating={isFormNavigating}
  />
) : currentAnswer ? (
  <AIAnswerCard ... />
) : null}
```

### Source Click Update

```typescript
const handleSourceClick = (citation: Citation) => {
  // Check if this is a form citation
  if ((citation as any).domain === 'forms') {
    navigate(`/forms/${citation.slug}`);
  } else {
    navigate(`/manual/${citation.slug}`);
  }
};
```

---

## III.6. FormDetail.tsx Pre-fill Integration

### Detect Navigation State

```typescript
import { useLocation } from 'react-router-dom';
import type { FormPrefillState } from '@/types/forms';

// Inside FormDetail component:
const location = useLocation();
const prefillState = location.state as FormPrefillState | null;
const prefillConsumedRef = useRef(false);
```

### Auto-Open AI Panel and Send Context

```typescript
// Pre-fill from /ask chat integration
useEffect(() => {
  if (prefillConsumedRef.current) return;
  if (!prefillState?.fromChat || !prefillState.prefillContext) return;
  if (!template || !hasAiTools || isCreating) return;

  prefillConsumedRef.current = true;

  // Open the AI panel
  setAiPanelOpen(true);

  // Auto-send the prefill context after a brief delay for panel mount
  const timer = setTimeout(() => {
    aiWithCurrentValues.askForm(prefillState.prefillContext);
  }, 300);

  // Clear location state to prevent re-trigger on back navigation
  window.history.replaceState({}, document.title);

  return () => clearTimeout(timer);
}, [template, hasAiTools, isCreating, prefillState, aiWithCurrentValues.askForm]);
```

### Key Behaviors

| Behavior | Implementation |
|----------|---------------|
| AI panel auto-opens | `setAiPanelOpen(true)` works for both desktop docked panel and mobile drawer |
| First message auto-sent | `askForm(prefillContext)` after 300ms delay for panel mount |
| Fields auto-applied | Existing `FormAIContent` auto-apply effect handles this (Phase 3 behavior) |
| Context consumed once | `prefillConsumedRef` prevents re-firing; `replaceState` clears location state |
| Refresh-safe | After `replaceState`, refresh loads form normally without pre-fill |
| No AI tools fallback | If form has no `ai_tools`, pre-fill context silently ignored |

---

## III.7. Type Additions

### In `src/hooks/use-ask-ai.ts`

```typescript
// Add new interface:
export interface FormSuggestion {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
}

// Extend existing AskResult:
export interface AskResult {
  answer: string;
  citations: Citation[];
  usage: UsageInfo;
  sessionId?: string;
  mode?: 'action' | 'search' | 'form_navigation';  // <-- extended
  formSuggestions?: FormSuggestion[];                 // <-- NEW
  prefillContext?: string;                            // <-- NEW
}
```

No changes needed to the `useAskAI` hook implementation -- it already passes through all data from the edge function response via `return data as AskResult`.

### In `src/types/forms.ts`

```typescript
// Add at the end of the file:
export interface FormPrefillState {
  prefillContext: string;
  fromChat: true;
}
```

---

## III.8. Mobile vs Desktop

### Mobile Flow (< 1024px)

```
/ask page (full screen)
  User types "fill out an injury report for John"
  AI response: FormNavigationCard in mobile content area
  User taps "Fill this form"

Page transition (full page navigation)
  navigate('/forms/employee-injury-report', { state: { ... } })

/forms/employee-injury-report (full screen)
  FormDetail loads, pre-fill detected
  FormAIDrawer auto-opens (bottom sheet, 85vh)
  askForm("John cut his hand...") fires
  AI extracts fields -> auto-applied to form
  User reviews and completes
```

### Desktop Flow (>= 1024px)

```
/ask page with aiPanel
  Chat in the right-side aiPanel (320/384px)
  AI response: FormNavigationCard in aiPanel

User clicks "Fill this form"
  navigate('/forms/employee-injury-report', { state: { ... } })

/forms/employee-injury-report with aiPanel
  FormDetail loads in main content area
  DockedFormAIPanel auto-opens in aiPanel slot
  askForm fires, fields extracted
  Form and AI panel visible side by side
```

### Key Differences

| Aspect | Mobile | Desktop |
|--------|--------|---------|
| FormNavigationCard location | Main content scroll area | AI panel sidebar |
| Post-navigation AI panel | FormAIDrawer (bottom sheet) | DockedFormAIPanel (docked right) |
| Back button target | `/forms` | `/forms` |

---

## III.9. Component File Map

### New Files

| File | Type | Description |
|------|------|-------------|
| `src/components/chat/FormNavigationCard.tsx` | Component | Form suggestion card in `/ask` chat stream |
| `supabase/migrations/YYYYMMDDHHMMSS_seed_form_intent_prompt.sql` | Migration | Seed `form-intent-map` ai_prompt |

### Modified Files

| File | Changes |
|------|---------|
| `supabase/functions/ask/index.ts` | Add `"forms"` to types, add search_forms tool, FTS dispatch, form_navigation response mode, fix OFF_TOPIC_PATTERNS |
| `src/hooks/use-ask-ai.ts` | Add `FormSuggestion` interface, extend `AskResult` type |
| `src/pages/Ask.tsx` | Import FormNavigationCard, add form navigation state/handlers, render cards, update source click |
| `src/pages/FormDetail.tsx` | Import useLocation, read prefillState, auto-open AI panel, auto-send context, clear state |
| `src/types/forms.ts` | Add `FormPrefillState` interface |

### Reused (Not Modified)

| File | Reuse |
|------|-------|
| `supabase/migrations/20260223200006_create_search_forms.sql` | Existing RPC (Phase 1) |
| `supabase/functions/ask-form/index.ts` | Existing edge function (Phase 3) |
| `src/hooks/use-ask-form.ts` | `askForm()` called with pre-fill context |
| `src/components/forms/DockedFormAIPanel.tsx` | Auto-opened by pre-fill |
| `src/components/forms/FormAIDrawer.tsx` | Auto-opened by pre-fill |
| `src/components/forms/FormAIContent.tsx` | Existing auto-apply behavior |
| `src/components/layout/AppShell.tsx` | `aiPanel` prop unchanged |

---

## III.10. ASCII Mockups

### Desktop -- Chat with Form Suggestion (>= 1024px)

```
+----------+------------------------------------------+--------------------+
| Sidebar  |  Ask AI                                  |  AI Panel (320px)  |
|          |  Get instant answers from your manual     |                    |
|  Forms   +------------------------------------------+  [sparkle] AI      |
|  Manual  |                                          |  Assistant         |
|  Ask     |  [Ask a question about procedures...   ] +--------------------+
|  ...     |  [voice]                                 |  Usage: 88/100     |
|          +------------------------------------------+--------------------+
|          |                                          |                    |
|          |  Try asking:                              |  I found a form    |
|          |  [What temperature...] [How often...]    |  that matches your |
|          |                                          |  request:          |
|          |                                          |                    |
|          |                                          | +----------------+ |
|          |                                          | | [!!] Employee  | |
|          |                                          | | Injury Report  | |
|          |                                          | | Document and   | |
|          |                                          | | track employee | |
|          |                                          | | injuries...    | |
|          |                                          | | [Best match]   | |
|          |                                          | | [Fill this ->] | |
|          |                                          | +----------------+ |
|          |                                          |                    |
|          |                                          | x Not what I need  |
|          |                                          |                    |
+----------+------------------------------------------+--------------------+
```

### Mobile -- Chat with Form Suggestion (< 1024px)

```
+--------------------------------------+
|  [=] Ask AI              [EN] [user] |
+--------------------------------------+
|                                      |
|  Ask AI                              |
|  Get instant answers from your       |
|  operations manual                   |
|                                      |
|  +----------------------------------+|
|  |[Ask a question...       ] [send] ||
|  +----------------------------------+|
|                                      |
|  +----------------------------------+|
|  |  I found a form that matches     ||
|  |  your request:                    ||
|  |                                   ||
|  | +------------------------------+ ||
|  | | [!!] Employee Injury Report  | ||
|  | | Document and track employee  | ||
|  | | injuries in the workplace... | ||
|  | | [Best match]                 | ||
|  | | [    Fill this form ->     ] | ||
|  | +------------------------------+ ||
|  |                                   ||
|  |  x Not what I need               ||
|  +----------------------------------+|
|                                      |
+--------------------------------------+
|  [home] [manual] [ask] [profile]     |
+--------------------------------------+
```

### Desktop -- FormDetail with Pre-fill AI Panel Open

```
+----------+------------------------------------------+--------------------+
| Sidebar  |  [<-] Employee Injury Report [*AI] Saved |                    |
|          +------------------------------------------+  AI PANEL (320px)  |
|  Forms   |  Progress: 35%             8/23           |                    |
|  Manual  +------------------------------------------+  [sparkle] AI      |
|  ...     |                                          |  Assistant    [X]  |
|          |  Section: Employee Info                   +--------------------+
|          |  +--------------------------------------+ |                    |
|          |  | Employee Name: [John Smith      ]  * | |  You said:         |
|          |  | Position:      [________________ ]    | |  "fill out injury  |
|          |  +--------------------------------------+ | |   report for John" |
|          |                                          | +--------------------+
|          |  Section: Incident Details                | |  5 fields found    |
|          |  +--------------------------------------+ | |  [v] Employee Name |
|          |  | Date: [2026-02-24  ]            *   | | |  [v] Date: 02-24  |
|          |  | Time: [15:00       ]            *   | | |  [v] Time: 15:00  |
|          |  | Description: [Employee cut...]  *   | | |  [v] Body: Hand   |
|          |  +--------------------------------------+ | |  [v] Description   |
|          |                                          | | ! 3 required fields|
|          |  [Save Draft]  [Submit]                   | |   still needed     |
|          |                                          | +--------------------+
|          |                                          | |  [input...] [+][o]|
+----------+------------------------------------------+--------------------+
```

---

## III.11. Accessibility Checklist

| Element | Requirement | Implementation |
|---------|-------------|----------------|
| FormNavigationCard | Semantic structure | Uses `<button>` for interactive elements, heading for form title |
| Form option cards | Keyboard operable | Native `<button>` wrapping. Enter/Space triggers `onSelect` |
| "Fill this form" button | Accessible name | Visually labeled text content |
| "Not what I need" dismiss | Keyboard operable | Native `<button>`, focus ring visible |
| "Best match" badge | Screen reader | Text content read naturally alongside card |
| Top match highlight | Not color-only | Badge text "Best match" provides non-color indicator |
| Navigation transition | Focus management | Focus moves to FormHeader on load |
| Pre-fill loading | Announcement | `aria-live="polite"` in FormAIContent announces "Thinking..." |
| Color contrast | WCAG 2.1 AA | All text meets 4.5:1 ratio |
| Reduced motion | `prefers-reduced-motion` | No animations in FormNavigationCard |
| Bilingual | All strings | `STRINGS` object with `en`/`es` variants |

---
---

# Part IV -- Risks & Edge Cases (Devil's Advocate)

## IV. Risk Assessment Matrix

| Severity | Definition | Count |
|----------|------------|-------|
| **Critical** | Data loss, security breach, total feature failure, or breaks existing production functionality | 3 |
| **Major** | Broken UX, wrong navigation, incorrect data, or frequent failures | 7 |
| **Moderate** | Edge-case failures, degraded experience, or confusing behavior | 8 |
| **Minor** | Cosmetic, sub-optimal, or future-proofing concerns | 4 |
| **Total** | | **22** |

---

## IV.1. Intent Detection Accuracy

### R1. False Positive -- Form Queries Hijack Manual Answers (Critical)

**Risk:** User asks "What is the procedure for filing an injury report?" expecting the SOP from the manual. AI detects "injury report" and calls `search_forms` instead of `search_manual_v2`.

**Mitigation:**
1. System prompt explicitly states: "Only call `search_forms` when user wants to START filling a form, NOT to LEARN ABOUT procedures."
2. AI should answer informational queries first, then offer the form as follow-up.
3. "Not what I need" dismiss button falls back to normal search.

### R2. False Negative -- AI Misses Form Intent (Major)

**Risk:** User says "Write up John for showing up late" and AI treats it as a manual search.

**Mitigation:** Explicit intent patterns in system prompt + tool description. Test with comprehensive phrasing variations.

### R3. Language-Dependent Intent Misses (Moderate)

**Risk:** Spanish queries like "Necesito documentar un accidente" fail to trigger `search_forms`.

**Mitigation:** Bilingual intent examples in the `form-intent-map` prompt (already included in the migration SQL).

### R4. Ambiguous Domain Overlap (Moderate)

**Risk:** "I need to file a report" could mean injury report, daily close-out, or food safety.

**Mitigation:** AI asks clarifying question when ambiguous. Shows all matching forms with descriptions.

---

## IV.2. Navigation & State

### R5. Cross-Page Navigation Loses Chat Context (Major)

**Risk:** After navigating to form, pressing Back returns to a blank Ask page.

**Mitigation:** This is an existing limitation of the Ask page (uses useState, lost on unmount). Document for awareness. Future enhancement: persist via `chat_sessions`.

### R6. URL State Size Limits (Moderate)

**Risk:** Large pre-fill context objects could exceed `history.state` limits.

**Mitigation:** Pre-fill context is a single string (the user's message), not structured data. Typical messages are < 1KB. The 640KB browser limit is not a concern.

### R7. Back Button Loop After Form Submit (Major)

**Risk:** Ask -> FormDetail -> Submit -> Success. Back cycles through stale states.

**Mitigation:** FormDetail already navigates to `/forms` on success. `replaceState` clears navigation state.

### R8. Page Refresh Loses Pre-fill Context (Moderate)

**Risk:** User refreshes FormDetail after chat navigation. Location state is gone.

**Mitigation:** Acceptable degradation -- form loads normally, user can manually open AI Fill. `replaceState` is called immediately so refresh is expected to lose context.

---

## IV.3. Pre-fill Context

### R9. Context Mismatch Between Chat AI and Form AI (Major -- Addressed)

**Risk:** `/ask` extracts structured fields that don't match form field keys.

**Mitigation:** **Addressed by design.** `/ask` passes raw user text, NOT structured fields. Only `/ask-form` (which has the template schema) does field extraction.

### R10. Wrong Form Selected with Pre-fill Applied (Major)

**Risk:** User picks the wrong form from multiple matches.

**Mitigation:** Never auto-navigate. User explicitly clicks card. Pre-fill context is the user's own words -- it will produce different extractions depending on the template.

### R11. Stale Context After Delay (Moderate)

**Risk:** User waits minutes before clicking form card. "at 3pm today" becomes outdated.

**Mitigation:** Inherent limitation of async workflows. Form AI prompt includes today's date. Low severity.

---

## IV.4. Existing Functionality Regression

### R12. Adding search_forms Changes Tool-Calling for ALL Queries (Critical)

**Risk:** The AI may start calling `search_forms` for non-form queries, degrading quality.

**Mitigation:**
1. Hyper-specific tool description: "ONLY when user wants to START filling a form."
2. Test top 20 most common manual/product queries post-change.
3. The `form-intent-map` prompt reinforces when NOT to call search_forms.

### R13. New `form_navigation` Mode Breaks Frontend (Major)

**Risk:** Frontend code that switches on `mode` does not handle `"form_navigation"`.

**Mitigation:** `Ask.tsx` checks `result.mode` and `result.formSuggestions`. Default behavior is normal search rendering. The `useAskAI` hook passes through all data unchanged.

### R14. OFF_TOPIC_PATTERNS Blocks Form Intent (Critical -- MUST FIX)

**Risk:** The regex `/\b(write me a|compose|draft a letter|essay)\b/i` at line 176 of `/ask` **WILL BLOCK** "write me a write-up for John" -- returning a canned off-topic response before the AI even sees the question.

**Mitigation:** **Remove "write me a" from the off-topic pattern.** Change to: `/\b(compose|draft a letter|essay)\b/i`. This is a must-fix for Phase 4.

### R15. Training Domain Branch Skips Form Intent (Moderate)

**Risk:** Training domain has an early branch that bypasses tool-use.

**Mitigation:** Form intent is only expected from the main chat (domain='manual'). The training domain is set explicitly by the frontend. Document for awareness.

---

## IV.5. Security

### R16. Prompt Injection via search_forms (Moderate)

**Risk:** Crafted query tries to enumerate all forms or bypass published filter.

**Mitigation:** MAX_TOOL_ROUNDS=3 limits searches. `search_forms` is SECURITY DEFINER with parameterized queries. Form titles/descriptions are not sensitive.

### R17. URL State Injection (Moderate)

**Risk:** Tampered `location.state` could contain malicious pre-fill content.

**Mitigation:** `location.state` cannot be set via URL. React auto-escapes rendered text. Pre-fill is sent to `/ask-form` which validates via `validateFieldUpdates()`.

### R18. AI Calls search_forms AND Search Tools Together (Moderate)

**Risk:** AI calls both, producing a confusing mixed response.

**Mitigation:** Frontend prioritizes form_navigation mode when forms are found. System prompt instructs separation. This is actually the ideal case for ambiguous queries (answers the question AND offers the form).

---

## IV.6. UX Pitfalls

### R19. Confusing Transition from Chat to Form Card (Major)

**Risk:** User expects a text answer but gets a clickable card instead.

**Mitigation:** The `answer` field always contains conversational text explaining the form suggestion. The card renders BELOW the text, not instead of it.

### R20. Lost Conversation After Navigation (Moderate)

**Risk:** Multi-turn chat context lost when navigating to form.

**Mitigation:** Existing limitation. The user's message is preserved in `prefillContext`. Future enhancement: persist chat sessions.

### R21. Mobile Tab Bar Switches from "Ask" to "Forms" (Minor)

**Risk:** Active tab changes after navigation, disorienting user.

**Mitigation:** Standard navigation behavior. Acceptable UX.

### R22. AI Panel Auto-Open Surprises Users (Minor)

**Risk:** Direct URL access triggers auto-open.

**Mitigation:** Only triggers when `location.state?.fromChat === true`, which is only set by `navigate()` from Ask.tsx.

---

## IV.7. Performance

### R23. Wasted Embedding for FTS-Only Tool (Moderate -- Addressed)

**Risk:** Edge function generates embedding for `search_forms` query unnecessarily.

**Mitigation:** **Addressed by design.** The `executeSearchForms` helper skips `getQueryEmbedding` entirely. FTS-only path saves 100-200ms.

### R24. Extra OpenAI Round-Trip (Minor)

**Risk:** Form search adds a tool round, increasing latency by 200-400ms.

**Mitigation:** Acceptable for the new functionality. System prompt optimization keeps rounds minimal.

---

## IV.8. Edge Cases

### R25. FTS Stemming Misses (Minor)

**Risk:** "write someone up" may not match "Employee Write-Up" due to hyphenation.

**Mitigation:** The AI can rephrase the query across tool rounds. With only 2 templates, a "show all" fallback is acceptable.

### R26. No Published Forms in Group (Moderate)

**Risk:** AI calls search_forms, gets 0 results, must handle gracefully.

**Mitigation:** System prompt instructs: "If no forms found, inform user and suggest manual search."

### R27. Multiple Matching Forms (Moderate)

**Risk:** Ambiguous query returns all forms. User must choose.

**Mitigation:** FormNavigationCard renders all options with descriptions. "Best match" badge on highest score.

### R28. Unpublished Forms Not Found (Minor)

**Risk:** Admin told user a form exists but forgot to publish it.

**Mitigation:** Correct behavior. AI response: "No matching forms found. Check with your administrator."

### R29. Shared Usage Counters (Minor)

**Risk:** AI questions in /ask consume quota needed for /ask-form.

**Mitigation:** By design (shared counters). Form AI panel shows usage remaining.

### R30. Form Has No ai_tools After Navigation (Minor)

**Risk:** Pre-fill context arrives at form without AI tools.

**Mitigation:** The `hasAiTools` check prevents AI panel from opening. Form loads in manual-fill mode.

---

## IV. Summary by Priority

### Must-Fix (Critical) -- 3 Risks

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | False positive intent detection | System prompt precision + two-step approach |
| R12 | Tool regression for existing queries | Hyper-specific tool description + regression testing |
| R14 | OFF_TOPIC_PATTERNS blocks "write me a write-up" | **Remove "write me a" from regex** |

### Should-Fix (Major) -- 7 Risks

| # | Risk | Mitigation |
|---|------|-----------|
| R2 | False negative intent | Explicit patterns in system prompt |
| R5 | Lost chat context on navigation | Document limitation, future enhancement |
| R7 | Back button loop | `replaceState` + existing success redirect |
| R9 | Context mismatch | Pass raw text, not structured fields |
| R10 | Wrong form selected | Never auto-navigate, require confirmation |
| R13 | New mode breaks frontend | Type updates + mode-based rendering |
| R19 | Confusing transition | Text answer + card below, not instead of |

### Nice-to-Fix (Moderate) -- 8 Risks

R3, R4, R6, R8, R11, R15, R16, R17, R18, R20, R23, R24, R26, R27

### Low Priority (Minor) -- 4 Risks

R21, R22, R25, R28, R29, R30

---

## IV. Recommendations for the Implementation Plan

1. **Fix OFF_TOPIC_PATTERNS first** (R14) -- Remove "write me a" from the regex before any other changes.
2. **Hyper-specific tool description** (R1, R12) -- Include "ONLY when user wants to START filling a form, NOT for information queries."
3. **Never auto-navigate** (R10) -- Always show cards and require explicit click.
4. **Pass raw text for pre-fill** (R9) -- Let `/ask-form` do structured extraction.
5. **Skip embedding for search_forms** (R23) -- FTS-only dispatch path.
6. **Test regression** (R12) -- Verify top 20 existing queries still work after adding the 7th tool.

---
---

# Part V -- File Manifest & Verification Plan

## V.1. Unified File Manifest

### New Files (2)

| File | Type | Lines | Description |
|------|------|-------|-------------|
| `src/components/chat/FormNavigationCard.tsx` | Component | ~150 | Form suggestion card rendered in `/ask` chat |
| `supabase/migrations/YYYYMMDDHHMMSS_seed_form_intent_prompt.sql` | Migration | ~30 | Seed `form-intent-map` ai_prompt |

### Modified Files (5)

| File | Estimated Changes | Description |
|------|-------------------|-------------|
| `supabase/functions/ask/index.ts` | ~100 new, ~25 modified | Add search_forms tool, FTS dispatch, form_navigation response, fix OFF_TOPIC_PATTERNS |
| `src/hooks/use-ask-ai.ts` | ~10 new | Add FormSuggestion interface, extend AskResult type |
| `src/pages/Ask.tsx` | ~50 new, ~15 modified | FormNavigationCard rendering, navigation handlers, form state |
| `src/pages/FormDetail.tsx` | ~25 new | useLocation, pre-fill detection, auto-open AI panel, auto-send context |
| `src/types/forms.ts` | ~5 new | Add FormPrefillState interface |

### Reused Files (7, not modified)

| File | Reuse |
|------|-------|
| `supabase/migrations/20260223200006_create_search_forms.sql` | Existing RPC (Phase 1) |
| `supabase/functions/ask-form/index.ts` | Existing edge function (Phase 3) |
| `src/hooks/use-ask-form.ts` | `askForm()` called with pre-fill context |
| `src/components/forms/DockedFormAIPanel.tsx` | Auto-opened by pre-fill |
| `src/components/forms/FormAIDrawer.tsx` | Auto-opened by pre-fill |
| `src/components/forms/FormAIContent.tsx` | Existing auto-apply behavior |
| `src/components/layout/AppShell.tsx` | `aiPanel` prop unchanged |

---

## V.2. Verification Plan

### Edge Function Tests

| # | Input | Expected |
|---|-------|----------|
| 1 | "I need to fill out an injury report" | `mode: "form_navigation"`, formSuggestions includes Employee Injury Report |
| 2 | "Write up John for being late" | `mode: "form_navigation"`, formSuggestions includes Employee Write-Up, prefillContext = original question |
| 3 | "John got hurt, what do I do?" | May return both manual answer AND formSuggestions |
| 4 | "What temperature for raw chicken?" | `mode: "search"`, no formSuggestions |
| 5 | "I need a vacation request form" | `mode: "search"`, no formSuggestions, AI says no form found |
| 6 | "I need to file a report" | formSuggestions with 2 items |
| 7 | (ES) "Necesito llenar un reporte de lesion" | formSuggestions with Spanish title |
| 8 | "Tell me about the ribeye" | `mode: "search"`, search_dishes called, no form results |
| 9 | "What's the weather?" | Off-topic response, no tools called |
| 10 | "Write me a write-up for John" | NOT caught by off-topic guard, form_navigation mode |

### Frontend Tests

| # | Action | Expected |
|---|--------|----------|
| 1 | Ask "fill out injury report" | FormNavigationCard appears |
| 2 | Click form card | Navigates to `/forms/:slug` with prefillContext |
| 3 | Navigate from chat with prefillContext | AI panel opens, first message sent |
| 4 | prefillContext sent to ask-form | Fields extracted from context |
| 5 | Ask "file a report" | Multiple cards, first highlighted |
| 6 | Ask "hand washing procedure" | Normal AI answer, no cards |
| 7 | Mobile viewport | Card renders in mobile content area |
| 8 | Click "Not what I need" | Cards dismissed, can type new question |
| 9 | Refresh form page after pre-fill | Form loads normally, no re-trigger |
| 10 | Form with no ai_tools | Pre-fill silently ignored |

### E2E Scenarios

1. **Full injury flow:** Ask "John cut his hand" -> AI finds form -> click card -> FormDetail opens with AI panel -> fields extracted -> submit.
2. **Full write-up flow:** Ask "Write up Maria for no-call no-show" -> AI finds Write-Up -> click card -> AI extracts employee_name="Maria", violation_type -> complete remaining fields.
3. **Rejection flow:** Ask "I need a form" -> shows 2 forms -> dismiss -> type "injury report" -> navigate.
4. **Bilingual flow:** Switch to ES -> "Necesito reportar una lesion" -> Spanish form card -> navigate -> Spanish AI panel.

---

## V.3. Existing Code References

| File | Path | Relevance |
|------|------|-----------|
| Feature overview (Phase 4 spec) | `docs/plans/form-builder/00-feature-overview.md` lines 994-1039 | Requirements definition |
| Phase 3 plan (format reference) | `docs/plans/form-builder/03-phase-ai-form-filling.md` | Document structure pattern |
| /ask edge function | `supabase/functions/ask/index.ts` | 1737 lines, primary modification target |
| /ask-form edge function | `supabase/functions/ask-form/index.ts` | 1234 lines, receives pre-fill context |
| /ask-product reference | `supabase/functions/ask-product/index.ts` | 1388 lines, tool integration pattern |
| Shared auth | `supabase/functions/_shared/auth.ts` | authenticateWithClaims pattern |
| Shared CORS | `supabase/functions/_shared/cors.ts` | Response helpers |
| Shared usage | `supabase/functions/_shared/usage.ts` | checkUsage/incrementUsage |
| Ask page | `src/pages/Ask.tsx` | 336 lines, chat UI |
| FormDetail page | `src/pages/FormDetail.tsx` | 513 lines, form fill UI |
| useAskAI hook | `src/hooks/use-ask-ai.ts` | 186 lines, frontend /ask integration |
| useAskForm hook | `src/hooks/use-ask-form.ts` | 283 lines, frontend /ask-form integration |
| FormAIContent | `src/components/forms/FormAIContent.tsx` | 424 lines, AI panel content with auto-apply |
| FormCard | `src/components/forms/FormCard.tsx` | 127 lines, icon emoji map pattern |
| Form types | `src/types/forms.ts` | 427 lines, TypeScript interfaces |
| App routing | `src/App.tsx` | 200 lines, route definitions |
| search_forms RPC | `supabase/migrations/20260223200006_create_search_forms.sql` | 71 lines, FTS search function |
| ai_prompts schema | `supabase/migrations/20260211153126_create_unified_ai_tables.sql` | 519 lines, ai_prompts table + seeds |

---

*This is the complete unified implementation plan for Phase 4: Main AI Chat Integration. It covers database assessment, migration, edge function modification, frontend components, context passing, risk analysis (22 risks across 8 categories), and verification plan. All modifications are minimal and leverage existing patterns from Phase 3.*
