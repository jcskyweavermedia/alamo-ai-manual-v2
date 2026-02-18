# Unified AI Architecture — Master Plan

**Created**: 2026-02-11
**Status**: Planning
**Scope**: Complete redesign of AI interaction layer across all app viewers

---

## Executive Summary

Redesign the AI system from fragmented per-viewer implementations into a unified architecture with:

- **2 backend pipelines** serving **3 UX interaction modes** (text, mic/TTS, realtime voice)
- **Session-based chat memory** segmented by viewer context
- **6 domain-specific search functions** available to all pipelines via OpenAI tool calling
- **LLM-driven query expansion** (parallel multi-query, multi-domain) replacing the need for a separate expansion model
- **DB-driven prompt management** for all modes (not just voice)
- **Search status UX** across all interaction modes

---

## Current State (as of 2026-02-11)

### Edge Functions (8 deployed)

| Function | Purpose | Pipeline |
|----------|---------|----------|
| `ask` | Manual Q&A (grounded RAG) | Chat Completions |
| `ask-product` | Product AI (18 actions + open questions, 5 domains) | Chat Completions + tool calling |
| `realtime-voice` | WebSocket relay to OpenAI Realtime API | Realtime API |
| `realtime-session` | Mint ephemeral key for WebRTC connections | Realtime API |
| `realtime-search` | Execute `search_handbook` tool calls from WebRTC client | Realtime API |
| `transcribe` | Whisper audio transcription | Whisper API |
| `embed-sections` | Generate manual section embeddings | Embeddings |
| `embed-products` | Generate product table embeddings | Embeddings |

### Search Functions (7 in PostgreSQL)

| Function | Table(s) | Type |
|----------|----------|------|
| `search_manual` | `manual_sections` | FTS only (keyword) |
| `hybrid_search_manual` | `manual_sections` | FTS + vector (RRF) |
| `search_dishes` | `foh_plate_specs` | FTS + vector (RRF) |
| `search_wines` | `wines` | FTS + vector (RRF) |
| `search_cocktails` | `cocktails` | FTS + vector (RRF) |
| `search_recipes` | `prep_recipes` + `plate_specs` | FTS + vector (RRF) |
| `search_beer_liquor` | `beer_liquor_list` | FTS + vector (RRF) |

### Prompt Management

| Source | Scope | Storage |
|--------|-------|---------|
| `routing_prompts` table | Realtime voice sessions only | DB (EN/ES, voice selection) |
| `ask` edge function | Manual text AI | Hardcoded in Deno |
| `ask-product` edge function | Product text AI (18 action prompts) | Hardcoded in Deno |
| `realtime-voice` edge function | WebSocket voice AI | Hardcoded in Deno |

### Key Gaps

1. **No chat memory** — every question is stateless, no conversation continuity
2. **No unified prompt table** — text AI prompts are hardcoded, only voice uses DB
3. **Manual search is disconnected** — `ask` uses `hybrid_search_manual` directly, not exposed as a tool to `ask-product`
4. **Voice only searches manual** — `realtime-voice` and `realtime-search` only have `search_handbook`, cannot search products
5. **No query expansion** — single query per search, misses results when user phrasing doesn't match DB vocabulary
6. **No search status UX** — no feedback to user during search execution
7. **Two separate text AI edge functions** — `ask` (manual) and `ask-product` (products) with different architectures

---

## Target Architecture

### 3 UX Interaction Modes

```
                          ┌─────────────────────────────────┐
                          │         Frontend (React)         │
                          ├──────┬──────────┬───────────────┤
                          │ Text │ Mic/TTS  │ Realtime Voice│
                          │  ⌨️  │   🎤→🔊   │      🔊↔🔊     │
                          └──┬───┴────┬─────┴──────┬────────┘
                             │        │            │
                     ┌───────┴────────┴──┐   ┌────┴──────────────┐
                     │  Pipeline A       │   │  Pipeline B       │
                     │  Chat Completions │   │  Realtime API     │
                     │  (text + mic/TTS) │   │  (WebSocket/WebRTC)│
                     └────────┬──────────┘   └────┬──────────────┘
                              │                    │
                     ┌────────┴────────────────────┴──────────┐
                     │        Shared Search Layer              │
                     │  6 PG functions (all hybrid RRF)        │
                     │  search_manual | search_dishes | ...    │
                     └─────────────────────────────────────────┘
```

### Pipeline A: Chat Completions (serves Text + Mic/TTS)

**Single unified edge function** (`ask`) replacing both current `ask` and `ask-product`:

1. Receives: question (text or transcribed audio), viewer context, session ID, language
2. Loads session history from `chat_messages` (last N messages, token budget)
3. Loads system prompt from `ai_prompts` table (domain-specific)
4. Assembles prompt: base persona + domain context + history + tool map
5. Calls GPT-4o-mini with all 6 search tools defined
6. **Tool-use loop** (max 3 rounds):
   - Model emits parallel tool calls (e.g., `search_wines` + `search_dishes`)
   - Edge function executes all searches in parallel
   - Results returned to model
   - Model decides: synthesize answer OR search again with different phrasing
7. Saves user message + assistant response to `chat_messages`
8. Returns: answer, citations, usage info
9. For Mic/TTS mode: also returns TTS audio via OpenAI TTS API

### Pipeline B: Realtime API (serves Realtime Voice)

**Updated `realtime-voice` / `realtime-session` / `realtime-search`**:

1. Session creation loads system prompt from `ai_prompts` table
2. Tool definitions include all 6 search functions (not just `search_handbook`)
3. `realtime-search` becomes a general-purpose search dispatcher
4. On session end: transcript extracted and saved to `chat_messages`
5. System prompt instructs model to use filler phrases during search

### Shared Components

| Component | Description |
|-----------|-------------|
| `ai_prompts` table | All system prompts (text + voice), per domain, EN/ES |
| `chat_sessions` table | Session tracking per user per viewer context |
| `chat_messages` table | Full conversation history with role/content/tool metadata |
| 6 PG search functions | Unified RRF hybrid search, one per domain |
| `embed-sections` | Manual embedding generation (unchanged) |
| `embed-products` | Product embedding generation (unchanged) |
| `transcribe` | Whisper transcription (unchanged) |

---

## Phase Breakdown

### Phase 1: Database Foundation
**Goal**: New tables for chat memory + unified prompt management
**Effort**: Small — schema design + migration

Deliverables:
- `chat_sessions` table (id, user_id, context_type, context_id, mode, started_at, last_active_at, status)
- `chat_messages` table (id, session_id, role, content, tool_calls_json, citations_json, created_at)
- `ai_prompts` table (replacing + extending `routing_prompts`) with support for all modes
- RLS policies for all new tables
- Indexes for session lookup (user_id + context_type + status)
- Session expiry policy (auto-close after 4h inactivity)

Dependencies: None
Blocks: Phase 3, 4, 5

---

### Phase 2: Search Function Upgrades
**Goal**: Standardize all search functions, optimize for multi-query usage
**Effort**: Medium — PG function updates + testing

Deliverables:
- Rename `hybrid_search_manual` → `search_manual_v2` or update existing `search_manual` to hybrid (align naming with product functions)
- Ensure all 6 functions have identical signature pattern: `(search_query, query_embedding, result_limit, keyword_weight, vector_weight)`
- Add bilingual support to manual search (it already has it, just confirm alignment)
- Widen result limits: default 5 → 8 (LLM filters, more recall is better)
- Lower vector similarity floor slightly for better recall
- Return richer snippets (more context per result)
- Verify all functions handle NULL embeddings gracefully (FTS-only fallback)
- Test all 6 functions with representative queries

Dependencies: None
Blocks: Phase 3, 4

---

### Phase 3: Unified Text AI Edge Function ✅
**Goal**: Single `ask` edge function with tool-use loop, replacing both `ask` and `ask-product`
**Effort**: Large — core backend rewrite
**Status**: ✅ COMPLETE — Deployed v4, 2026-02-11 (1,301 lines, 11/12 deliverables, Mic/TTS deferred to Phase 4)

Deliverables:
- New unified `ask` edge function with:
  - Auth + usage enforcement (carried over from current)
  - Session management (create/resume sessions via `chat_sessions`)
  - Prompt assembly from `ai_prompts` table + viewer context + history
  - 6 search tool definitions for OpenAI function calling
  - Tool-use loop (max 3 rounds) with parallel search execution
  - Chat history injection (last N messages from session, token-budgeted)
  - Message persistence (save to `chat_messages`)
  - Citation extraction from search results
  - Support for action mode (predefined prompts) AND open question mode
  - Language detection/support (EN/ES)
- ~~Mic/TTS extension~~ — Deferred to Phase 4 (Voice Pipeline Integration). Phase 3 is text-only.
- Deprecate old `ask` and `ask-product` functions (keep temporarily for rollback)

Dependencies: Phase 1 (tables), Phase 2 (search functions)
Blocks: Phase 6

---

### Phase 4: Voice Pipeline Integration
**Goal**: Update Realtime Voice to use unified search and prompt architecture
**Effort**: Medium — update 3 edge functions

Deliverables:
- Update `realtime-session` to load prompts from `ai_prompts` table (replacing `routing_prompts`)
- Update tool definitions to include all 6 search functions (not just `search_handbook`)
- Update `realtime-search` to become a general search dispatcher:
  - Accept `function_name` parameter (which of the 6 search functions to call)
  - Execute the appropriate PG function
  - Return formatted results
- Update `realtime-voice` WebSocket relay:
  - Route tool calls to the appropriate search function
  - Inject all 6 tool definitions in session config
  - On session end: extract transcript, save to `chat_sessions` + `chat_messages`
- System prompt updates: instruct model to search across domains, use filler phrases
- Migrate `routing_prompts` seed data to `ai_prompts` table

Dependencies: Phase 1 (tables), Phase 2 (search functions)
Blocks: Phase 6

---

### Phase 5: Chat Memory Implementation
**Goal**: Session management, history injection, expiry
**Effort**: Medium — backend logic + session lifecycle

Deliverables:
- Session lifecycle management:
  - Create session on first interaction per viewer context
  - Resume session if last activity < 4 hours ago
  - Auto-close stale sessions
  - Session metadata (viewer type, optional item context)
- History injection for Pipeline A:
  - Load last N messages (configurable, default 15)
  - Token budget enforcement (~4000 tokens of history)
  - Role-aware formatting (user/assistant/tool)
- History injection for Pipeline B (Realtime Voice):
  - On session start, inject recent history as context in system prompt
  - On session end, persist transcript to chat_messages
- Session API for frontend:
  - GET session history for a viewer context
  - POST clear/reset session
- Cleanup job: Archive or delete sessions older than 30 days

Dependencies: Phase 1 (tables), Phase 3 (unified ask), Phase 4 (voice pipeline)
Blocks: Phase 6

---

### Phase 6: Frontend Wiring — 3 Interaction Modes
**Goal**: Unified UI components for text, mic/TTS, and realtime voice across all viewers
**Effort**: Large — frontend components + hooks

Deliverables:
- Unified AI interaction component (shared across all 6 viewers):
  - Text input mode (keyboard icon / default)
  - Mic/TTS mode (mic icon — press to record, transcribe, get audio response)
  - Realtime Voice mode (wave icon — streaming voice conversation)
- Mode selection UI (3 icons, contextually shown/hidden per viewer)
- Viewer-specific AI action buttons (carried over from current, standardized)
- Session awareness: show conversation thread for current viewer context
- Hook: `useAIInteraction(viewerContext)` — manages mode, session, messages
- Hook: `useAISession(contextType)` — session CRUD, history loading
- Wire all 6 viewers: Manual, Recipes, Dish Guide, Wines, Cocktails, Beer & Liquor
- Search status events: placeholder callbacks for Phase 7

Dependencies: Phase 3 (unified ask), Phase 4 (voice), Phase 5 (memory)
Blocks: Phase 7

---

### Phase 7: Search Status UX
**Goal**: Visual and audio feedback during AI search across all modes
**Effort**: Small-Medium — UX polish

Deliverables:
- **Text mode**: Animated indicators showing active search domains ("Searching wines...", "Searching dishes...")
- **Mic/TTS mode**: Same visual indicators during processing pause
- **Realtime Voice mode**:
  - System prompt instruction for filler phrases ("Let me look that up...")
  - Client-side visual animation (pulsing indicator) on tool call detection
- Event system: edge functions emit search lifecycle events (started, domain, complete)
- Frontend subscription: SSE or response metadata for search progress
- Differentiation: visual distinction between "thinking" and "searching"

Dependencies: Phase 6 (frontend wiring)
Blocks: Phase 8

---

### Phase 8: System Prompt Tuning & Testing
**Goal**: Optimize prompts per domain, end-to-end testing, production readiness
**Effort**: Medium — iteration + QA

Deliverables:
- Per-domain prompt optimization in `ai_prompts` table:
  - Manual: emphasize SOP accuracy, policy citation
  - Recipes: technique details, critical steps, cross-recipe references
  - Dish Guide: upsell language, allergen safety, guest-facing tone
  - Wines: pairing intelligence, region/varietal knowledge, sommelier tone
  - Cocktails: ingredient details, presentation, guest recommendations
  - Beer & Liquor: brand knowledge, serving suggestions, casual tone
- Multi-query behavior tuning: test that parallel search + retry works
- Cross-domain query testing: questions that span multiple domains
- Voice-specific tuning: filler phrase naturalness, response length
- Latency profiling: ensure voice pipeline stays under 2s for search round-trip
- Edge case testing: empty results, off-topic detection, language switching
- Usage limit verification across all modes
- Rollback: remove deprecated `ask-product` function, clean up `routing_prompts`

Dependencies: Phase 7 (all features complete)
Blocks: None (final phase)

---

## Phase Dependency Graph

```
Phase 1 (DB Foundation)
  │
  ├──→ Phase 2 (Search Upgrades)  [can run parallel with Phase 1]
  │       │
  │       ├──→ Phase 3 (Unified Text AI)
  │       │       │
  │       └──→ Phase 4 (Voice Pipeline)
  │               │
  └───────────────┤
                  │
            Phase 5 (Chat Memory)
                  │
            Phase 6 (Frontend Wiring)
                  │
            Phase 7 (Search Status UX)
                  │
            Phase 8 (Prompt Tuning & Testing)
```

**Parallel opportunities**:
- Phase 1 + Phase 2 can run simultaneously (no dependencies between them)
- Phase 3 + Phase 4 can run in parallel once Phase 1 + 2 are done
- Phase 5 needs Phase 3 + 4 to inject history into

---

## Key Architectural Decisions

### Decision 1: One unified `ask` vs. keep separate functions
**Choice**: One unified `ask` edge function
**Rationale**: Cross-domain queries are natural and common. One function with all 6 tools enables "what wine pairs with the ribeye?" to search both wines and dishes. Reduces maintenance surface.

### Decision 2: LLM-driven query expansion vs. separate expansion model
**Choice**: LLM-driven via parallel tool calls
**Rationale**: GPT-4o-mini supports parallel function calls natively. Eliminates 500-1500ms latency of a separate model. The LLM already understands the semantic intent — let it generate query variations as part of its tool calling. Critical for voice latency.

### Decision 3: Session segmentation by viewer context
**Choice**: One active session per user per viewer type (6 possible sessions)
**Rationale**: Keeps conversations focused. Wine questions don't pollute recipe context. Natural mapping to the app's navigation structure. Sessions expire after 4h inactivity.

### Decision 4: Prompt storage in DB vs. hardcoded
**Choice**: All prompts in `ai_prompts` table
**Rationale**: Enables prompt iteration without redeployment. Already proven with `routing_prompts` for voice. Extends pattern to text AI. Supports A/B testing later.

### Decision 5: Voice search scope
**Choice**: All 6 search functions available to voice (not just manual)
**Rationale**: A cook asking by voice "what wine goes with this?" should get a real answer. Limiting voice to manual-only is an artificial constraint.

---

## Data Model Preview

### `ai_prompts`
```
id              UUID PK
slug            TEXT UNIQUE       -- e.g., 'manual', 'recipes', 'wines', 'base-persona'
mode            TEXT              -- 'text' | 'voice' | 'both'
domain          TEXT              -- 'manual' | 'recipes' | 'dishes' | 'wines' | 'cocktails' | 'beer_liquor' | 'system'
prompt_en       TEXT NOT NULL
prompt_es       TEXT
voice           TEXT              -- voice ID for TTS/Realtime (null for text-only)
tools_config    JSONB             -- which tools this prompt enables, weight overrides
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### `chat_sessions`
```
id              UUID PK
user_id         UUID FK → auth.users
context_type    TEXT NOT NULL     -- 'manual' | 'recipes' | 'dishes' | 'wines' | 'cocktails' | 'beer_liquor'
context_id      TEXT              -- optional: specific item slug (e.g., viewing a particular wine)
mode            TEXT              -- 'text' | 'mic_tts' | 'realtime_voice'
started_at      TIMESTAMPTZ
last_active_at  TIMESTAMPTZ
status          TEXT DEFAULT 'active'  -- 'active' | 'closed'
```

### `chat_messages`
```
id              UUID PK
session_id      UUID FK → chat_sessions
role            TEXT NOT NULL     -- 'user' | 'assistant' | 'tool'
content         TEXT
audio_url       TEXT              -- for voice messages (optional future use)
tool_calls      JSONB             -- [{name, arguments, result_summary}]
citations       JSONB             -- [{domain, slug, name, snippet}]
tokens_used     INT               -- for budget tracking
created_at      TIMESTAMPTZ
```

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Unified function becomes too complex | High | Clean module separation within the function. Shared helpers for auth, search, prompt assembly. |
| Voice latency increases with 6 tools | Medium | Cap voice to 2 search rounds max. Pre-filter tool list based on viewer context. |
| Chat history inflates prompt tokens | Medium | Enforce token budget (4000 tokens max history). Summarize old messages. |
| Migration from old functions breaks existing UI | High | Keep old functions running during transition. Frontend switches to new endpoints per viewer as each is wired. |
| Prompt table changes require careful versioning | Low | Add `version` column later if needed. Start simple. |

---

## Success Criteria

1. Any question from any viewer can search across all 6 domains when relevant
2. Voice interactions have < 2s latency for search round-trip
3. Conversation memory maintains context within a viewer session
4. Prompts can be updated in DB without redeploying edge functions
5. All 3 interaction modes (text, mic/TTS, realtime voice) work from every viewer
6. Search recall improves measurably (parallel multi-query catches results that single-query misses)
7. Users get visual/audio feedback during search execution

---

## Phase Plan Documents

Each phase will have its own detailed plan document:

- `01-phase-db-foundation.md` — Schema design, migration SQL, RLS policies
- `02-phase-search-upgrades.md` — PG function standardization, testing queries
- `03-phase-unified-text-ai.md` — Edge function architecture, tool-use loop, prompt assembly
- `04-phase-voice-integration.md` — Realtime API updates, search dispatcher, transcript persistence
- `05-phase-chat-memory.md` — Session lifecycle, history injection, token budgeting
- `06-phase-frontend-wiring.md` — React components, hooks, viewer integration
- `07-phase-search-status-ux.md` — Visual/audio indicators, event system
- `08-phase-prompt-tuning-testing.md` — Per-domain optimization, QA checklist
