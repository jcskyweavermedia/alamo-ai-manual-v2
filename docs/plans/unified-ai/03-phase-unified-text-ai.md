# Phase 3: Unified Text AI Edge Function

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: ✅ COMPLETE — Deployed to production (v4, 2026-02-11)
**Dependencies**: Phase 1 (DB Foundation), Phase 2 (Search Upgrades)
**Blocks**: Phase 6 (Frontend Wiring)

### Audit Log (2026-02-11)

**Round 1** — Plan cross-referenced against 4 areas (27 checks total):

| Area | Checks | Result |
|------|--------|--------|
| Search function signatures (v2 migration) | 5 | 5 PASS |
| DB schema references (Phase 1 tables + RPCs) | 6 | 6 PASS |
| Edge function patterns (`/ask` + `/ask-product`) | 10 | 8 PASS, 1 FAIL, 1 WARN |
| Frontend backward compatibility (hooks + call sites) | 6 | 3 PASS, 3 FAIL |

Detailed findings:

| Check | Status |
|-------|--------|
| `executeSearch()` parameter names match all 6 PG functions | Confirmed |
| `search_language` only passed for `search_manual_v2` | Confirmed |
| `result_limit: 5` correctly overrides DB default of 8 | Confirmed |
| `ai_prompts` column names + all 29 slug patterns | Confirmed |
| `get_or_create_chat_session` RPC params (`_user_id`, `_group_id`, etc.) | Confirmed |
| `get_chat_history` RPC return table (role, content, citations, created_at) | Confirmed |
| `chat_messages` INSERT column names | Confirmed |
| Auth flow (Bearer → getClaims → service role) | Confirmed — identical in both functions |
| Usage RPCs (`get_user_usage`, `increment_usage`) | Confirmed |
| OpenAI parameters (temp, max_tokens per mode) | Confirmed |
| Off-topic patterns — plan expands from 4→10 | **Fixed** — noted as deliberate improvement, not carry-over |
| Stop word removal — new for product domains | **Fixed** — noted `/ask-product` had none |
| `message_count` increment — placeholder RPC | **Fixed** — replaced with fetch-then-update pattern |
| `domain` defaults to `'manual'` when missing | Confirmed — already in plan (backward compat) |
| Citations include both `title` and `name` | Confirmed — already in plan (backward compat) |
| `useAskAI` reads `c.title` not `c.name` | Confirmed — dual-field mitigation handles this |

**Round 2** — Implementation audit (40 checks): **39 PASS / 0 FAIL / 1 WARN**
- WARN: `tokens_used` hardcoded to null (deferred to Phase 8) — non-blocking

**Round 3** — Completion audit (57 checks across 6 areas):

| Area | Checks | Result |
|------|--------|--------|
| Master plan deliverables | 12 | 11 PASS, 1 NOT IMPLEMENTED (Mic/TTS — intentionally deferred to Phase 4) |
| Verification checklist (pre-deploy) | 13 | 9 PASS, 4 require runtime test |
| Verification checklist (post-deploy) | 8 | 4 PASS, 4 require runtime test |
| Search verification (per domain) | 7 | 0 PASS, 7 require runtime test (code verified) |
| Code structure | 14 | 14 PASS |
| DB dependencies | 14 | 14 PASS |
| Backward compatibility | 5 | 5 PASS |

**Totals**: 57 PASS / 0 FAIL / 15 runtime-only / 1 intentional deferral

---

## Objective

Replace the two existing edge functions (`ask` + `ask-product`) with a single unified `/ask` edge function that:

1. **Serves all 6 viewer contexts** (manual, dishes, wines, cocktails, recipes, beer_liquor) through one endpoint
2. **Loads prompts from `ai_prompts` table** instead of hardcoding them
3. **Manages chat sessions** via `chat_sessions` + `chat_messages` (Phase 1 tables)
4. **Uses OpenAI tool calling** with all 6 search functions (Phase 2) for open questions
5. **Supports both modes**: action (predefined prompts + itemContext) and open question (tool-use search)
6. **Persists conversation history** and injects it into the LLM context window
7. **Maintains full backward compatibility** with existing frontend hooks during transition

---

## Current State Audit

### What exists today

| Function | Purpose | Lines | Search | Mode |
|----------|---------|-------|--------|------|
| `/ask` | Manual Q&A | ~477 | `hybrid_search_manual` → FTS fallback | Single-turn, no tools |
| `/ask-product` | Product AI | ~1110 | 5 product search functions via tool calling | Dual-mode (action + search) |

### Key differences between the two

| Aspect | `/ask` | `/ask-product` |
|--------|--------|----------------|
| **Prompts** | Hardcoded system prompt | 18 hardcoded action prompts + domain hints |
| **Search** | Direct RPC call | OpenAI tool calling (5 tools) |
| **Content expansion** | Fetches full `manual_sections` content (top 3, 8000 chars each) | None (uses search snippets only) |
| **Tool use** | None | Yes (single-round, max 2 API calls) |
| **Temperature** | 0.3 | 0.4 (action) / 0.3 (search) |
| **Max tokens** | 500 (concise) / 1200 (expanded) | 600 (action) / 800 (search) |
| **Off-topic filter** | Regex-based | None |
| **Citations** | `{ id, slug, title }` | `{ id, slug, name, domain }` |
| **Chat memory** | None | None |
| **Bilingual** | Full (system prompt, canned messages, content) | Partial (language instruction only) |
| **Pairing enrichment** | N/A | For `foodPairings`/`suggestPairing` actions |

### What the unified function carries forward

| Feature | From | Notes |
|---------|------|-------|
| Auth flow (Bearer JWT → getClaims → service role) | Both | Identical in both functions |
| Usage enforcement (get_user_usage / increment_usage) | Both | Identical in both functions |
| CORS headers | Both | Identical in both functions |
| Off-topic detection | `/ask` | Extend to cover all domains |
| Tool-use loop | `/ask-product` | Expand to 6 tools, 3 rounds max |
| Action mode (predefined prompts + itemContext) | `/ask-product` | Load prompts from `ai_prompts` |
| Content expansion (full section fetch) | `/ask` | Keep for manual context only |
| Pairing enrichment | `/ask-product` | Keep for `foodPairings`/`suggestPairing` |
| serializeItemContext() | `/ask-product` | Carry over all 5 domain serializers |
| Query preprocessing (stop word removal) | `/ask` | Apply to all FTS queries (new for product domains — `/ask-product` had none) |

---

## Architecture

### Request Interface

```typescript
interface UnifiedAskRequest {
  // Required
  question: string;           // User's question or action phrase
  groupId: string;            // Group UUID for usage tracking
  domain: ContextType;        // 'manual' | 'dishes' | 'wines' | 'cocktails' | 'recipes' | 'beer_liquor'

  // Optional
  language?: 'en' | 'es';     // Default: 'en'
  expand?: boolean;           // Request expanded answer (manual only). Default: false
  sessionId?: string;         // Resume existing chat session (UUID)

  // Action mode (both required together, or both absent)
  action?: string;            // Action key (e.g., 'practicePitch', 'foodPairings')
  itemContext?: Record<string, unknown>;  // Full product object

  // Section context (manual domain only)
  context?: {
    sectionId?: string;
    sectionTitle?: string;
  };
}
```

### Response Interface

```typescript
interface UnifiedAskResponse {
  answer: string;              // AI-generated response
  citations: UnifiedCitation[];  // Source references
  usage: UsageInfo;            // Updated daily/monthly counts
  mode: 'action' | 'search';  // Which mode was used
  sessionId: string;           // Chat session ID (new or resumed)
}

interface UnifiedCitation {
  id: string;                  // Row UUID
  slug: string;                // URL-friendly identifier
  name: string;                // Display name (renamed from 'title' for consistency)
  domain: ContextType;         // Source domain
}

interface UsageInfo {
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}
```

### Error Response

```typescript
interface ErrorResponse {
  error: string;               // Machine-readable code
  message?: string;            // Human-readable message
  usage?: UsageInfo;           // Included for limit_exceeded
}
```

Error codes and HTTP statuses (unchanged from current):
- `400` — `bad_request` (missing fields)
- `401` — `unauthorized` (invalid/missing token)
- `403` — `forbidden` (not member of group)
- `429` — `limit_exceeded` (daily or monthly)
- `500` — `server_error` / `ai_error`

---

## Execution Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. CORS + Auth                                                       │
│    ├─ OPTIONS → 200 (preflight)                                      │
│    ├─ Extract Bearer token → getClaims → userId                      │
│    └─ Create service-role client                                     │
│                                                                      │
│ 2. Validate Request                                                  │
│    ├─ question (required, non-empty)                                 │
│    ├─ groupId (required)                                             │
│    ├─ domain (required, must be valid ContextType)                   │
│    └─ action + itemContext (both or neither)                         │
│                                                                      │
│ 3. Off-topic Guard (before usage check)                              │
│    └─ Regex patterns → canned response (no usage penalty)            │
│                                                                      │
│ 4. Usage Check                                                       │
│    ├─ get_user_usage(userId, groupId)                                │
│    └─ 429 if daily or monthly limit exceeded                         │
│                                                                      │
│ 5. Session Management                                                │
│    ├─ get_or_create_chat_session(userId, groupId, domain,            │
│    │     contextId, 'text', 4)                                       │
│    └─ get_chat_history(sessionId, 20, 4000)                          │
│                                                                      │
│ 6. Load Prompts from ai_prompts                                     │
│    ├─ system prompts: base-persona, tool-map, behavior-rules         │
│    ├─ domain prompt: domain-{domain}                                 │
│    └─ action prompt: action-{domain}-{action} (if action mode)       │
│                                                                      │
│ 7. Branch: Action vs Search                                         │
│    ├─ ACTION MODE (action + itemContext present)                      │
│    │   ├─ Serialize itemContext → contextText                        │
│    │   ├─ Pairing enrichment (if foodPairings/suggestPairing)        │
│    │   ├─ Build messages: system + history + user(contextText)       │
│    │   ├─ OpenAI call (no tools, temp 0.4, max 600 tokens)          │
│    │   └─ Citations: itemContext + enriched dishes                   │
│    │                                                                  │
│    └─ SEARCH MODE (open question)                                    │
│        ├─ Build messages: system + history + user(question)          │
│        ├─ OpenAI call #1 (6 tools, tool_choice auto, temp 0.3)      │
│        ├─ Tool loop (max 3 rounds):                                  │
│        │   ├─ For each tool_call:                                    │
│        │   │   ├─ Generate query embedding                           │
│        │   │   ├─ Execute search RPC                                 │
│        │   │   └─ Format results as tool response                    │
│        │   └─ OpenAI follow-up with tool results                     │
│        ├─ Manual content expansion (domain='manual' only):           │
│        │   ├─ Fetch full sections for top 3 results (8000 chars)     │
│        │   └─ Inject as supplementary context                        │
│        └─ Citations: deduplicated search results                     │
│                                                                      │
│ 8. Persist Messages                                                  │
│    ├─ INSERT user message → chat_messages                            │
│    ├─ INSERT assistant message → chat_messages (with citations)      │
│    └─ UPDATE chat_sessions.message_count, last_active_at             │
│                                                                      │
│ 9. Usage Increment + Response                                        │
│    ├─ increment_usage(userId, groupId)                               │
│    └─ Return { answer, citations, usage, mode, sessionId }           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Step 1: Prompt Assembly

Load prompts from `ai_prompts` table using the service-role client:

```typescript
// Load all needed prompts in one query
const { data: prompts } = await supabase
  .from('ai_prompts')
  .select('slug, category, prompt_en, prompt_es')
  .in('slug', [
    'base-persona',
    'tool-map',
    'behavior-rules',
    `domain-${domain}`,
    ...(action ? [`action-${domain}-${action}`] : []),
  ])
  .eq('is_active', true);

// Build prompt map for easy lookup
const promptMap = new Map(prompts.map(p => [p.slug, p]));

// Assemble system prompt
const lang = language === 'es' ? 'prompt_es' : 'prompt_en';
const systemParts: string[] = [
  promptMap.get('base-persona')?.[lang],
  promptMap.get(`domain-${domain}`)?.[lang],
];

// In search mode: add tool map + behavior rules
if (!isActionMode) {
  systemParts.push(promptMap.get('tool-map')?.[lang]);
  systemParts.push(promptMap.get('behavior-rules')?.[lang]);
}

// In action mode: add action instruction
if (isActionMode) {
  const actionPrompt = promptMap.get(`action-${domain}-${action}`);
  systemParts.push(actionPrompt?.[lang] || actionPrompt?.prompt_en);
}

const systemPrompt = systemParts.filter(Boolean).join('\n\n');
```

**Fallback**: If `prompt_es` is null for an action prompt, fall back to `prompt_en`. This matches the current behavior where action prompts are English-only but the language instruction tells GPT to respond in Spanish.

### Step 2: Chat History Injection

```typescript
// Get or create session
const sessionId = await supabase.rpc('get_or_create_chat_session', {
  _user_id: userId,
  _group_id: groupId,
  _context_type: domain,
  _context_id: context?.sectionId || null,
  _mode: 'text',
  _expiry_hours: 4,
});

// Load conversation history
const { data: history } = await supabase.rpc('get_chat_history', {
  _session_id: sessionId,
  _max_messages: 20,
  _max_tokens: 4000,
});

// Convert to OpenAI message format
const historyMessages = (history || []).map(msg => ({
  role: msg.role as 'user' | 'assistant',
  content: msg.content,
}));
```

### Step 3: Message Assembly

```typescript
// Search mode messages
const messages = [
  { role: 'system', content: systemPrompt },
  ...historyMessages,           // Chat history (oldest first)
  { role: 'user', content: userContent },
];

// Action mode messages
const messages = [
  { role: 'system', content: systemPrompt },
  ...historyMessages,
  { role: 'user', content: serializedContext + (menuEnrichment || '') },
];
```

### Step 4: Tool Definitions (6 tools)

```typescript
const SEARCH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_manual_v2',
      description: 'Search the restaurant operations manual — SOPs, policies, training materials, and culture guide.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — key terms about the topic' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_dishes',
      description: 'Search the dish menu — appetizers, entrees, sides, desserts. Returns menu names, descriptions, allergens, flavor profiles, and upsell notes.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — dish name, ingredient, allergen, or type' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_wines',
      description: 'Search the wine list — varietals, regions, producers, tasting notes, and pairing suggestions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — varietal, region, style, or pairing' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_cocktails',
      description: 'Search the cocktail menu — mixed drinks, ingredients, preparation methods, and presentation.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — cocktail name, spirit, ingredient, or style' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_recipes',
      description: 'Search BOH kitchen recipes — prep recipes and plate specifications. Returns ingredients, procedures, yield, shelf life, and training notes.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — recipe name, ingredient, technique, or dish' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_beer_liquor',
      description: 'Search the beer and spirits list — brands, categories, styles, serving notes, and descriptions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — beer name, spirit type, brand, or style' },
        },
        required: ['query'],
      },
    },
  },
];
```

### Step 5: Tool Execution Loop (max 3 rounds)

```typescript
const MAX_TOOL_ROUNDS = 3;
const allSearchResults: Array<{ result: SearchResult; fnName: string }> = [];

let response = await callOpenAI({
  model: 'gpt-4o-mini',
  messages,
  tools: SEARCH_TOOLS,
  tool_choice: 'auto',
  max_tokens: 800,
  temperature: 0.3,
});

for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
  const assistantMsg = response.choices[0].message;

  // If no tool calls, we have the final answer
  if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
    break;
  }

  // Add assistant message with tool_calls to conversation
  messages.push(assistantMsg);

  // Execute each tool call
  for (const toolCall of assistantMsg.tool_calls) {
    const fnName = toolCall.function.name;
    const fnArgs = JSON.parse(toolCall.function.arguments);
    const searchQuery = fnArgs.query;

    // Generate embedding for this search query
    const queryEmbedding = await getQueryEmbedding(searchQuery);

    // Dispatch to the correct PG function
    const results = await executeSearch(supabase, fnName, searchQuery, queryEmbedding, language);

    // Collect results for citation building
    allSearchResults.push(...results.map(r => ({ result: r, fnName })));

    // Format results as tool response
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: formatSearchResults(results),
    });
  }

  // Follow-up call with tool results (no tools on final round)
  const isLastRound = round === MAX_TOOL_ROUNDS - 1;
  response = await callOpenAI({
    model: 'gpt-4o-mini',
    messages,
    ...(isLastRound ? {} : { tools: SEARCH_TOOLS, tool_choice: 'auto' }),
    max_tokens: 800,
    temperature: 0.3,
  });
}
```

### Step 6: Search Dispatch

```typescript
async function executeSearch(
  supabase: SupabaseClient,
  fnName: string,
  searchQuery: string,
  queryEmbedding: number[] | null,
  language: string,
): Promise<SearchResult[]> {
  // Build RPC params — all functions share the same base signature
  const params: Record<string, unknown> = {
    search_query: searchQuery,
    query_embedding: queryEmbedding ? JSON.stringify(queryEmbedding) : null,
    result_limit: 5,
  };

  // search_manual_v2 has an extra search_language param
  if (fnName === 'search_manual_v2') {
    params.search_language = language;
  }

  const { data, error } = await supabase.rpc(fnName, params);

  if (error) {
    console.error(`[ask] Search error (${fnName}):`, error.message);
    return [];
  }

  return data || [];
}
```

### Step 7: Manual Content Expansion (domain='manual' only)

This carries over the `/ask` function's content expansion logic. When the domain is `manual`, after tool-use search completes, fetch full section content for richer context:

```typescript
if (domain === 'manual' && allSearchResults.length > 0) {
  const manualResults = allSearchResults
    .filter(r => r.fnName === 'search_manual_v2')
    .slice(0, 3);

  if (manualResults.length > 0) {
    const topSlugs = manualResults.map(r => r.result.slug);
    const { data: fullSections } = await supabase
      .from('manual_sections')
      .select('id, slug, title_en, title_es, content_en, content_es')
      .in('slug', topSlugs);

    if (fullSections?.length) {
      const manualContext = fullSections.map(s => {
        const title = language === 'es' && s.title_es ? s.title_es : s.title_en;
        const content = language === 'es' && s.content_es ? s.content_es : s.content_en;
        const truncated = content?.length > 8000 ? content.substring(0, 8000) + '...' : content;
        return `## ${title}\n${truncated || ''}`;
      }).join('\n\n---\n\n');

      // Inject as supplementary context in the final user message
      messages.push({
        role: 'user',
        content: `Here is the full manual content for the most relevant sections:\n\n${manualContext}`,
      });

      // One more OpenAI call to synthesize with full content
      response = await callOpenAI({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: expand ? 1200 : 500,
        temperature: 0.3,
      });
    }
  }
}
```

### Step 8: Pairing Enrichment (carried over from `/ask-product`)

```typescript
const PAIRING_ACTIONS = new Set(['foodPairings', 'suggestPairing']);

async function enrichWithMenuItems(
  supabase: SupabaseClient,
  itemContext: Record<string, unknown>,
  domain: string,
): Promise<{ menuText: string; dishCitations: UnifiedCitation[] }> {
  // Build search query from product attributes
  let searchQuery = 'steak entree';  // fallback
  if (domain === 'wines') {
    searchQuery = [itemContext.style, itemContext.body, itemContext.varietal].filter(Boolean).join(' ');
  } else if (domain === 'cocktails') {
    searchQuery = [itemContext.style, itemContext.key_ingredients].filter(Boolean).join(' ');
  } else if (domain === 'beer_liquor') {
    searchQuery = [itemContext.style, itemContext.category].filter(Boolean).join(' ');
  }

  const queryEmbedding = await getQueryEmbedding(searchQuery);
  const results = await executeSearch(supabase, 'search_dishes', searchQuery, queryEmbedding, 'en');

  if (!results.length) return { menuText: '', dishCitations: [] };

  const menuText = '\n\nAlamo Prime Menu Items (suggest pairings from these):\n' +
    results.map(r => {
      let line = `- ${r.name}`;
      if (r.plate_type) line += ` (${r.plate_type})`;
      if (r.is_top_seller) line += ' ★ Top Seller';
      return line;
    }).join('\n');

  const dishCitations = results.map(r => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    domain: 'dishes' as ContextType,
  }));

  return { menuText, dishCitations };
}
```

### Step 9: Message Persistence

```typescript
// Save user message
await supabase.from('chat_messages').insert({
  session_id: sessionId,
  role: 'user',
  content: question,
  input_mode: 'text',
});

// Save assistant message (with citations and token count)
const tokensUsed = response.usage?.total_tokens || null;
await supabase.from('chat_messages').insert({
  session_id: sessionId,
  role: 'assistant',
  content: answer,
  citations: citations.length > 0 ? JSON.stringify(citations) : null,
  tokens_used: tokensUsed,
});

// Update session counters
// Note: Supabase JS .update() doesn't support SQL expressions like `message_count + 2`,
// so we fetch-then-update. This is safe because a user's requests are sequential (not concurrent).
const { data: session } = await supabase
  .from('chat_sessions')
  .select('message_count')
  .eq('id', sessionId)
  .single();

await supabase
  .from('chat_sessions')
  .update({
    message_count: (session?.message_count || 0) + 2,  // +2 for user + assistant messages
    last_active_at: new Date().toISOString(),
  })
```

**Note**: Message persistence is fire-and-forget (non-blocking). If it fails, log the error but still return the AI response to the user. This matches the current pattern where `increment_usage` failures are non-fatal.

### Step 10: serializeItemContext() (carried over)

This function is carried over from `/ask-product` exactly as-is. It converts product objects to structured text for the AI prompt. Handles all 5 domains:

- **dishes**: menu_name, plate_type, description, ingredients, allergens, upsell notes
- **wines**: name, producer, vintage, varietal, region, tasting notes
- **cocktails**: name, style, glass, ingredients, tasting notes
- **recipes**: name, type, yield, shelf life, ingredients (JSONB), procedure (JSONB)
- **beer_liquor**: name, category, subcategory, producer, style, description

No changes needed — carry over verbatim.

---

## OpenAI Parameters

| Context | Model | Temperature | Max Tokens | Tools |
|---------|-------|-------------|------------|-------|
| Action mode | gpt-4o-mini | 0.4 | 600 | None |
| Search mode (with tool calls) | gpt-4o-mini | 0.3 | 800 | 6 search tools |
| Manual content expansion | gpt-4o-mini | 0.3 | 500 (concise) / 1200 (expanded) | None |
| Embeddings | text-embedding-3-small | — | — | — |

---

## Backward Compatibility Strategy

### Phase 3 deployment plan

1. **Deploy new `/ask` function** — this replaces the existing `/ask` endpoint in-place
2. **Keep `/ask-product` alive** temporarily — no changes, still functional
3. **Frontend Phase 6** will update hooks to call unified `/ask` only
4. **After Phase 6 ships**: deprecate and remove `/ask-product`

### Breaking changes and mitigations

| Change | Impact | Mitigation |
|--------|--------|------------|
| `/ask` now requires `domain` field | `useAskAI` doesn't send `domain` | Frontend hook must add `domain: 'manual'` (Phase 6) |
| Response adds `mode`, `sessionId` fields | Extra fields | Non-breaking — clients ignore unknown fields |
| Response `citations[].title` → `citations[].name` | `useAskAI` expects `title` | Frontend type update (Phase 6), OR return both fields temporarily |
| `/ask-product` unchanged | No impact | Existing product AI continues working |

### Transition period

During the transition (between Phase 3 and Phase 6), the new `/ask` function should accept requests without `domain` and default to `'manual'` for backward compatibility with the existing `useAskAI` hook. Similarly, `citations` should include both `title` and `name` fields until Phase 6 updates the types.

```typescript
// Backward compatibility defaults
const domain = body.domain || 'manual';

// Citation backward compatibility
const citations = results.map(r => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  title: r.name,  // Alias for legacy useAskAI consumers
  domain,
}));
```

---

## File Structure

```
supabase/functions/ask/index.ts          ← Rewrite (was ~477 lines, will be ~700-800)

supabase/functions/ask-product/index.ts  ← NO CHANGES (kept for rollback)
```

Single file — all logic in `index.ts` with clearly separated sections:
1. Types & constants
2. CORS & utility functions
3. serializeItemContext()
4. Search execution & formatting
5. Pairing enrichment
6. Main handler (Deno.serve)

---

## Off-topic Detection

**Expanded** from `/ask`'s original 4-pattern set to 10 more specific patterns. The original `/ask` had broad catch-all patterns (e.g., `/weather|sports|news|politics|celebrity|movie|music|game|joke|story/`); these are split into granular patterns for fewer false positives. The `/ask-product` function had no off-topic detection — this is new coverage for product domains.

The regex patterns detect non-restaurant questions and return a canned response without charging usage:

```typescript
const OFF_TOPIC_PATTERNS = [
  /\b(weather|forecast|temperature outside)\b/i,
  /\b(sports?|score|game|nfl|nba|mlb)\b/i,
  /\b(news|politics|election|president)\b/i,
  /\b(celebrity|movie|tv show|netflix|music|song)\b/i,
  /\b(joke|riddle|fun fact|trivia)\b/i,
  /\b(math|calcul|equation|algorithm|coding|program)/i,
  /\b(write me a|compose|draft a letter|essay)\b/i,
  /\b(who are you|what are you|your name)\b/i,
  /\b(stock|crypto|bitcoin|invest)\b/i,
  /\b(relationship|dating|love advice)\b/i,
];
```

Off-topic responses are bilingual:
- EN: "I'm the Alamo Prime training assistant — I can help with menu items, recipes, service techniques, and restaurant operations. What would you like to know?"
- ES: "Soy el asistente de capacitación de Alamo Prime — puedo ayudarte con items del menú, recetas, técnicas de servicio y operaciones del restaurante. ¿En qué te puedo ayudar?"

---

## Verification Checklist

### Pre-deployment

- [ ] All 29 `ai_prompts` rows load correctly (3 system + 6 domain + 2 voice + 18 action)
- [ ] `get_or_create_chat_session` creates new session on first call
- [ ] `get_or_create_chat_session` returns same session on subsequent calls (within 4 hours)
- [ ] `get_chat_history` returns messages in chronological order
- [ ] All 6 search tools callable via `executeSearch()`
- [ ] `search_manual_v2` works with `search_language` param
- [ ] Product search functions work without `search_language` param
- [ ] Action mode with all 18 action keys produces valid responses
- [ ] Pairing enrichment triggers for `foodPairings` and `suggestPairing` only
- [ ] Off-topic detection blocks non-restaurant questions
- [ ] Citations include both `name` and `title` for backward compatibility
- [ ] Domain defaults to `'manual'` when not provided
- [ ] `expand` mode works for manual domain (1200 max tokens)

### Post-deployment

- [ ] Existing `useAskAI` hook works without code changes (backward compat)
- [ ] Existing `useAskProduct` hook works (unchanged endpoint)
- [ ] Chat session created on first question
- [ ] Follow-up questions include previous context
- [ ] Usage counters increment correctly
- [ ] Error responses match expected format
- [ ] CORS headers present on all responses
- [ ] No security advisories triggered

### Search verification (one query per domain)

- [ ] Manual: "What is the dress code?" → `search_manual_v2` called
- [ ] Dishes: "Tell me about the ribeye" → `search_dishes` called
- [ ] Wines: "What red wines do we have?" → `search_wines` called
- [ ] Cocktails: "How do we make the Old Fashioned?" → `search_cocktails` called
- [ ] Recipes: "What's the prep for mashed potatoes?" → `search_recipes` called
- [ ] Beer: "What IPAs do we carry?" → `search_beer_liquor` called
- [ ] Cross-domain: "What wine pairs with the ribeye?" → `search_wines` + `search_dishes` called

---

## Estimated Size

| Component | Lines (approx) |
|-----------|----------------|
| Types & constants | ~80 |
| Utility functions (CORS, errors, query prep) | ~80 |
| serializeItemContext() | ~170 (carried over) |
| Search execution & formatting | ~80 |
| Pairing enrichment | ~60 |
| Prompt assembly | ~50 |
| Session & history management | ~40 |
| Tool-use loop | ~80 |
| Manual content expansion | ~40 |
| Message persistence | ~30 |
| Main handler | ~100 |
| **Total** | **~810 lines** |

Down from 1,587 combined lines (477 + 1,110) — a ~49% reduction.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| New `/ask` breaks existing frontend | High | Backward compat defaults (domain → 'manual', citation.title alias) |
| Prompt loading fails (empty `ai_prompts`) | Medium | Hardcoded fallback system prompt; log warning |
| Session management adds latency | Low | `get_or_create_chat_session` is a single RPC (not multiple queries) |
| 3-round tool loop increases cost | Low | Most queries resolve in 1 round; `behavior-rules` prompt guides efficient search |
| Message persistence fails | Low | Fire-and-forget pattern; AI response still returned |
