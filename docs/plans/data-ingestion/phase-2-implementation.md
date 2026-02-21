# Phase 2: /ingest Edge Function — Text Structuring + Chat — Implementation Plan

**Plan Date:** 2026-02-19
**Status:** In Progress (~70% complete)
**Depends On:** Phase 1 (complete), OpenAI API key configured

---

## What's Already Built

### Edge Function: `supabase/functions/ingest/index.ts` (1008 lines)

| Feature | Status | Notes |
|---------|--------|-------|
| CORS handling | DONE | Inline corsHeaders, OPTIONS preflight |
| Auth (manual JWT) | DONE | `getClaims()` + admin check via `group_memberships.role` |
| Request validation | DONE | mode, content, productTable, language validated |
| Mode: `structure` | DONE | Raw text → structured JSON via `response_format: json_schema` |
| Mode: `chat` | DONE | Multi-turn with message history (last 20), session load/create |
| Tool: `update_draft` | DONE | Deep merge partial updates into `draft_data` JSONB |
| Tool loop | DONE | Max 3 rounds, breaks on no tool_calls, strips tools on last round |
| Session persistence | DONE | Creates/loads `ingestion_sessions`, bumps `draft_version` |
| Message persistence | DONE | Saves user + assistant + tool messages to `ingestion_messages` |
| Draft confidence | DONE | Auto-computes from missing required fields |
| Slug generation | DONE | Auto-generates from recipe name |
| System prompt | DONE | Loads `ingest-prep-recipe` from `ai_prompts` (bilingual EN/ES) |
| Draft context injection | DONE | Appends current `draft_data` JSON to system prompt for chat |

### Frontend (all built in Phase 1)

| Component | Status |
|-----------|--------|
| `use-ingest-chat.ts` hook | DONE — calls `/ingest` with `mode: 'structure'` or `'chat'` |
| `ChatIngestionPanel.tsx` | DONE — message list, input, read-only draft preview cards |
| `IngestPreview.tsx` | DONE — read-only preview with batch scaling |
| `IngestPage.tsx` | DONE — session loading from URL params, edit mode |
| `DraftPreviewCard.tsx` | DONE — read-only inline draft summary in chat (no action buttons) |

---

## What's Missing / Needs Upgrade

### 1. Upgrade model from `gpt-4o-mini` to `gpt-5.2`

**Priority:** HIGH — user requested high quality output

The edge function currently uses `gpt-4o-mini` in 3 places:
- Line 410: `model: "gpt-4o-mini"` (structure mode)
- Line 669: `model: "gpt-4o-mini"` (chat mode, initial call)
- Line 773: `model: "gpt-4o-mini"` (chat mode, follow-up with tool results)

**Change to:** `gpt-5.2`

**API compatibility:** Confirmed — GPT-5.2 is a drop-in replacement in Chat Completions API:
- Same `tools` array format
- Same `response_format: { type: "json_schema" }` support
- Same message role format (supports both `system` and `developer` roles)
- 400K context window (up from 128K), 128K max output (up from 16K)

**New optional parameters to add:**
- `reasoning_effort: "medium"` for structure mode (thorough extraction)
- `reasoning_effort: "low"` for chat mode follow-ups (fast responses)

**Pricing impact:**
- gpt-4o-mini: $0.15/1M input, $0.60/1M output
- gpt-5.2: $1.75/1M input, $14.00/1M output
- ~12x more expensive per token, but dramatically higher quality

**Max tokens adjustments:**
- Structure mode: `max_tokens: 2000` → `max_tokens: 4000` (GPT-5.2 can handle richer output)
- Chat mode: `max_tokens: 1000` → `max_tokens: 2000`

### 2. Add `search_recipes` tool

**Priority:** MEDIUM — enables sub-recipe linking during conversation

The AI should be able to search existing prep_recipes when a chef mentions an ingredient that might be an existing recipe (e.g., "use the chimichurri from the pantry").

**Tool definition:**
```typescript
{
  type: "function",
  function: {
    name: "search_recipes",
    description: "Search existing prep recipes in the database. Use this when the user mentions an ingredient or sub-recipe that might already exist (e.g., 'chimichurri', 'demi-glace', 'compound butter').",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for recipe name or ingredient"
        }
      },
      required: ["query"]
    }
  }
}
```

**Implementation:** Call the existing `search_recipes` Postgres function via Supabase RPC:
```typescript
const { data, error } = await supabase.rpc('search_recipes', {
  search_query: query,
  query_embedding: null, // FTS-only for speed
  result_limit: 5,
});
```

**Tool result format:** Return JSON array of `{ id, slug, name, source_table, snippet }`.

### 3. Add `search_products` tool

**Priority:** MEDIUM — helps avoid duplicate products

The AI should be able to search any product table to check if a product already exists before creating a new one.

**Tool definition:**
```typescript
{
  type: "function",
  function: {
    name: "search_products",
    description: "Search across all product tables to check for duplicates or find related products. Use this when the user describes a product that might already exist.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for product name"
        },
        table: {
          type: "string",
          enum: ["foh_plate_specs", "wines", "cocktails", "beer_liquor_list", "prep_recipes", "plate_specs"],
          description: "Which product table to search (optional, searches dishes by default)"
        }
      },
      required: ["query"]
    }
  }
}
```

**Implementation:** Map `table` to the correct search function:
```typescript
const searchFnMap: Record<string, string> = {
  foh_plate_specs: 'search_dishes',
  wines: 'search_wines',
  cocktails: 'search_cocktails',
  beer_liquor_list: 'search_beer_liquor',
  prep_recipes: 'search_recipes',
  plate_specs: 'search_recipes',
};
```

### 4. Add `ingest-chat-system` prompt

**Priority:** LOW — currently the same `ingest-prep-recipe` prompt is used for both modes

The plan specifies a separate `ingest-chat-system` prompt optimized for conversation mode (more conversational, explains what tools are available, guides the chef through the process).

**Migration:** Insert into `ai_prompts` table.

**Content should include:**
- Explain to the AI that it's having a conversation with a chef
- Mention available tools (update_draft, search_recipes, search_products)
- Instruct to ask clarifying questions when info is missing
- Instruct to call update_draft whenever the user provides recipe info
- Instruct to search for existing recipes when sub-recipes are mentioned

### 5. Deploy the function

The function exists locally but may not be deployed with latest changes.

```bash
npx supabase functions deploy ingest
```

---

## Implementation Tasks

### Task 1: Upgrade model + add tools in edge function

**File:** `supabase/functions/ingest/index.ts`

**Changes:**

1. Replace all 3 occurrences of `"gpt-4o-mini"` with `"gpt-5.2"`

2. Add `reasoning_effort` parameter:
   - Structure mode: `reasoning_effort: "medium"`
   - Chat initial call: `reasoning_effort: "low"`
   - Chat follow-up: `reasoning_effort: "low"`

3. Increase `max_tokens`:
   - Structure mode: `2000` → `4000`
   - Chat mode (both calls): `1000` → `2000`

4. Add `search_recipes` tool definition to `CHAT_TOOLS` array

5. Add `search_products` tool definition to `CHAT_TOOLS` array

6. Add tool execution handlers in the tool loop (alongside existing `update_draft`):
   ```typescript
   if (fnName === "search_recipes") {
     const { query } = JSON.parse(toolCall.function.arguments);
     const { data } = await supabase.rpc('search_recipes', {
       search_query: query, query_embedding: null, result_limit: 5
     });
     messages.push({
       role: "tool",
       tool_call_id: toolCall.id,
       content: JSON.stringify(data || []),
     });
   } else if (fnName === "search_products") {
     // similar pattern, map table to search function
   }
   ```

### Task 2: Add `ingest-chat-system` prompt (migration)

**File:** `supabase/migrations/20260220100000_ingest_chat_prompt.sql`

Insert a new row into `ai_prompts` with:
- `slug: 'ingest-chat-system'`
- `category: 'system'`
- Bilingual prompt (EN + ES)
- Explains conversation mode, available tools, chef-friendly tone

### Task 3: Update edge function to use chat-specific prompt

In `handleChat()`, change the prompt slug from `ingest-prep-recipe` to `ingest-chat-system` (keep `ingest-prep-recipe` for structure mode).

### Task 4: Deploy

```bash
npx supabase db push          # Push new prompt migration
npx supabase functions deploy ingest  # Deploy updated function
```

---

## Files Changed / Created Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `supabase/functions/ingest/index.ts` | Upgrade to GPT-5.2, add search tools, use chat prompt |
| CREATE | `supabase/migrations/20260220100000_ingest_chat_prompt.sql` | Chat-specific system prompt |

**Total: 1 modified file, 1 new migration**

---

## Testing Plan

### Edge Function Tests (via curl or frontend)

**Structure mode:**
```bash
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "structure",
    "content": "Chimichurri sauce: bunch of parsley, bunch of cilantro, 4 cloves garlic, 1 cup olive oil, 1/4 cup red wine vinegar, 1 tsp red pepper flakes, salt to taste. Chop herbs finely, mix everything, let sit 2 hours. Yields 2 cups, keeps 5 days refrigerated.",
    "productTable": "prep_recipes",
    "language": "en"
  }'
```
**Expected:** JSON with `draft` containing structured recipe, `confidence` > 0.7, `sessionId`

**Chat mode (follow-up):**
```bash
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "chat",
    "content": "Actually, add a teaspoon of oregano to the herb base",
    "sessionId": "<sessionId_from_above>",
    "productTable": "prep_recipes",
    "language": "en"
  }'
```
**Expected:** AI calls `update_draft` to add oregano, returns updated draft

**Search tool test:**
```bash
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "chat",
    "content": "This recipe uses our house demi-glace as a base. Can you find it?",
    "sessionId": "<sessionId>",
    "productTable": "prep_recipes",
    "language": "en"
  }'
```
**Expected:** AI calls `search_recipes` with "demi-glace", finds existing red-wine-demi-glace recipe

### Frontend Smoke Test

1. Navigate to `/admin/ingest/new`
2. Select "Prep Recipe" → "Chat with AI" → Create Session
3. Paste a recipe description → verify structured draft appears
4. Send follow-up messages → verify draft updates
5. Mention an existing recipe (e.g., "use our chimichurri") → verify AI finds it via search
6. Verify all messages persist (reload page, session reloads with history)

### Quality Comparison

Compare GPT-5.2 output vs old gpt-4o-mini:
- Structure a complex recipe with incomplete info → check confidence score and missing fields
- Ask ambiguous questions → check if AI asks clarifying questions instead of guessing
- Verify ingredient grouping quality (should create logical groups, not dump everything in one)
- Verify procedure step quality (should flag critical steps, proper ordering)
