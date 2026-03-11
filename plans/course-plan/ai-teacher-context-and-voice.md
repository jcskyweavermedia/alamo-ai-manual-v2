# Plan: AI Teacher Context Enrichment + Live Trainer Voice

**Date:** 2026-03-02
**Status:** Audited — revised with findings from DB Expert, Technical Architect, Devil's Advocate

---

## Background

The AI Teacher system (Phases 1–3) is complete. Courses have assigned teacher slugs (food-101, wine-101, beer-liquor-101, standards-101). The teacher slug flows from DB → hook → ask edge function. The food teacher currently receives only the FOH plate spec as context. The Live Trainer button only opens a text chat — no voice.

---

## Confirmed Data Architecture

```
foh_plate_specs.plate_spec_id  ──FK──▶  plate_specs.id
                                              │
                              components JSONB (prep_recipe_ref: slug)
                                              ▓
                                        prep_recipes.slug
```

- `foh_plate_specs` → guest-facing description, allergens, flavor, upsell
- `plate_specs` → BOH assembly, plating steps, components JSONB
- `prep_recipes` → ingredient prep, procedures, yield, shelf life, training notes
- Links: FOH→BOH via FK (`plate_spec_id`); BOH→Recipes via slug in JSONB components

---

## Plan A — Hybrid Context Enrichment + Search for Food Teacher

### Problem
The `ask` function receives `section_id` but ignores it for content loading — the frontend passes a pre-serialized `content_context` string with only the FOH plate spec. The teacher has no knowledge of how the dish is actually made (BOH) or what prep components it uses. It also cannot answer pairing questions (wines, cocktails) mid-conversation.

### Phase A-1 — Eager Bundle (server-side enrichment in `ask` edge function)

**File:** `supabase/functions/ask/index.ts` → `handleTrainingDomain()`

When a training request arrives, auto-enrich using `section_id`:

```
Step 1: Fetch course_sections WHERE id = section_id
        → read content_source, content_ids[]

Step 2: Branch by content_source:

  'foh_plate_specs':
    a. Fetch foh_plate_specs WHERE id IN content_ids
       (menu_name, short_description, detailed_description, ingredients,
        key_ingredients, flavor_profile, allergens, upsell_notes)
    b. For each FOH row: fetch plate_specs WHERE id = foh.plate_spec_id
       (plate_type, components JSONB, assembly_procedure JSONB, notes)
    c. Parse plate_spec.components[] for prep_recipe_ref slugs
       → fetch prep_recipes WHERE slug IN [refs]
       (prep_type, yield_qty, yield_unit, shelf_life, ingredients,
        procedure, training_notes)
    → Bundle into: [FOH CONTEXT] + [BOH CONTEXT] + [PREP RECIPES]

  'wines':
    Fetch full wines row (producer_notes, tasting_notes, region, vintage,
    varietal, style, body)

  'cocktails':
    Fetch full cocktails row (ingredients, procedure, tasting_notes,
    key_ingredients, glass, style)

  'beer_liquor_list':
    Fetch full beer_liquor_list row

  'manual_sections':
    Fetch full manual_sections row (content_en/es)

  'custom':
    Use frontend content_context as-is (no enrichment available)

Step 3: Assemble enriched system prompt:

  ## Content Being Taught
  ### What the Guest Sees (FOH)
  [foh data]

  ### How the Kitchen Makes It (BOH)
  [plate_spec data]

  ### Prep Recipes Used
  [prep_recipe data for each referenced component]
```

**Fallback:** If `section_id` not provided OR enrichment fails → fall back to `content_context` from frontend (current behavior). No breaking change.

---

### Phase A-2 — Tool Calls Pre-Pass (cross-menu search)

**File:** `supabase/functions/ask/index.ts` → `handleTrainingDomain()`

Before generating the structured teacher response JSON, add a **tool-use pre-pass**:

```
Step 1: Build messages array with system prompt + conversation history + question

Step 2: Call OpenAI with tools enabled:
  - search_dishes
  - search_wines
  - search_cocktails
  - search_recipes
  - search_beer_liquor
  (Same RPCs already used by ask/search mode and realtime-search)

Step 3: If AI calls tools:
  - Execute RPC with FTS + vector hybrid search
  - Inject results into system prompt as "## Additional Context from Search"
  - Re-call OpenAI for final structured response

Step 4: If AI calls no tools:
  - Go straight to structured response (no overhead)
```

**Triggers naturally for:**
- Pairing questions: "what wine goes with the ribeye?"
- Comparison questions: "how does this compare to the filet?"
- Cross-domain questions: "what cocktail would complement this?"
- Recipe questions beyond current section: "what's in the compound butter?"

**Structured output preserved:** Final call always uses `response_format: json_schema` for teacher reply, suggested_replies, topics_update, should_suggest_quiz.

---

### Phase A-3 — Content Source Awareness per Teacher

Enrichment logic extended to all content types:

| `content_source` | Eager bundle fetches | Teacher benefits |
|---|---|---|
| `foh_plate_specs` | FOH + BOH plate spec + prep recipes | Full dish knowledge |
| `wines` | Full wine row (all columns) | Producer, vintage, structure |
| `cocktails` | Full cocktail row | Recipe, procedure, spirit |
| `beer_liquor_list` | Full item row | Style, origin, descriptor |
| `manual_sections` | Full content_en/es | Policy depth |
| `custom` | Frontend content_context only | No change |

---

### Files Changed — Plan A

| File | Change |
|---|---|
| `supabase/functions/ask/index.ts` | Phase A-1: auto-fetch BOH + recipes by section_id; Phase A-2: tool-use pre-pass in training mode |
| No DB migrations | All tables and RPCs already exist |
| No frontend changes | Enrichment is server-side |

---

---

## Plan B — Live Trainer → Realtime Voice + Transcript Logging

### Problem
Clicking "Live Trainer" currently calls `setPendingMode('quiz_me')` and opens a text chat. No voice session is started. All voice infrastructure is complete and tested (`useRealtimeWebRTC`, `VoiceModeButton`, `realtime-session`). The `realtime-session` edge function uses `routing_prompts` table — not `ai_teachers` — so teacher personas are not applied to voice sessions. Voice transcripts are not logged to the chat or the DB.

### Phase B-1 — Wire `realtime-session` to `ai_teachers`

**File:** `supabase/functions/realtime-session/index.ts`

Add optional params: `teacher_slug: string`, `section_id: string`

**New logic when `teacher_slug` is provided:**

```
Step 1: Fetch ai_teachers WHERE slug = teacher_slug AND is_active = true
        → use prompt_en (or prompt_es if language='es') as base system instructions

Step 2: If section_id also provided:
        → Apply same eager enrichment as Plan A Phase A-1
        → Append [FOH CONTEXT] + [BOH CONTEXT] + [PREP RECIPES] to instructions

Step 3: Append language directive

Step 4: Configure tools for OpenAI session:
        Always include:
          - search_handbook
          - search_dishes
          - search_wines
          - search_cocktails
          - search_recipes
          - search_beer_liquor
        (Voice teacher can search full menu in real-time during conversation)

Step 5: Mint ephemeral key with these instructions → return to client
```

**Fallback:** If `teacher_slug` not provided → existing `routing_prompts` flow unchanged.

---

### Phase B-2 — TrainingChatPanel Voice Wiring

**Files:** `src/components/training/TrainingChatPanel.tsx`, `src/hooks/use-training-chat.ts`

**Current flow (text):**
```
Live Trainer click → setPendingMode('quiz_me') → text chat sends "Quiz me on [section]"
```

**New flow (voice):**
```
Live Trainer click → voiceHook.connect() → realtime voice session starts
                  → AI speaks greeting using food-101 teacher persona + section context
                  → user speaks → transcript entry fires → appended to chatItems
                  → chat panel shows live conversation as messages
                  → VoiceModeButton shows listening/speaking/processing state
```

**useRealtimeWebRTC call:**
```typescript
useRealtimeWebRTC({
  language,
  groupId,
  teacher_slug: session.course?.teacherSlug ?? undefined,
  section_id: session.currentSection?.id ?? undefined,
  onTranscript: (entry) => {
    appendVoiceMessage({
      role: entry.role,
      content: entry.text,
      timestamp: new Date(entry.timestamp).toISOString(),
      source: 'voice',
    });
  },
  onError: (err) => setError(err),
  onStateChange: (state) => setVoiceState(state),
})
```

---

### Phase B-3 — UI: Voice State in the Panel

**File:** `src/components/training/TrainingChatPanel.tsx`

When Live Trainer voice session is active:
- `VoiceModeButton` appears in input area (replaces text input while active)
- Shows live state: connecting → listening → processing → speaking
- Chat bubbles for voice messages display a small 🎙 indicator
- "End Session" via VoiceModeButton disconnect returns to mode card selection
- Animated waveform or state bars during speaking

---

### Phase B-4 — Conversation Persistence

**File:** `src/hooks/use-training-chat.ts`

Voice transcripts saved to `course_conversations.messages` identically to text messages.

```typescript
// Existing ConversationMessage type — add optional source field
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'text' | 'voice';  // optional, for UI icon only
}
```

Session summary, topic tracking, and DB persistence work identically for voice and text sessions. `source` field is UI-only and does not affect any business logic.

---

### Files Changed — Plan B

| File | Change |
|---|---|
| `supabase/functions/realtime-session/index.ts` | Accept `teacher_slug` + `section_id`; fetch from `ai_teachers`; apply enrichment; add product search tools |
| `src/hooks/use-realtime-webrtc.ts` | Add `teacher_slug` and `section_id` to `UseRealtimeWebRTCOptions`; pass to session request |
| `src/components/training/TrainingChatPanel.tsx` | Init voice hook; wire Live Trainer → connect(); show VoiceModeButton; transcript → chatItems |
| `src/hooks/use-training-chat.ts` | Add `appendVoiceMessage()`; add optional `source` to ConversationMessage |
| `src/types/training.ts` | Add `source?: 'text' | 'voice'` to ConversationMessage |
| No new components needed | `VoiceModeButton` already built and tested |
| No DB migrations needed | All tables exist |

---

## Implementation Order

```
Plan A-1 (eager bundle)         → highest value, backend only, no risk
Plan B-1 (realtime-session)     → backend only, standalone
Plan A-2 (tool pre-pass)        → adds search capability to text teacher
Plan B-2 (voice wiring)         → UI integration
Plan B-3 (voice UI state)       → UI polish
Plan B-4 (persistence)          → logging
```

---

---

## Audit Findings & Plan Revisions

### What the three auditors confirmed ✅

- **FK chain is real:** `foh_plate_specs.plate_spec_id` → `plate_specs.id` (nullable FK, verified)
- **JSONB structure is consistent:** `plate_specs.components` contains `prep_recipe_ref` string slugs matching `prep_recipes.slug` (verified in seed data)
- **prep_recipes.slug** is UNIQUE NOT NULL — safe for lookup
- **All 5 search RPCs exist** with correct hybrid FTS+vector signatures, all SECURITY DEFINER
- **ask function uses service_role key** — can query plate_specs, prep_recipes without RLS issues
- **section_id already received** in `handleTrainingDomain()` but currently unused
- **onTranscript callback** exists and fires in useRealtimeWebRTC
- **VoiceModeButton** is fully built and already used in Ask.tsx — minimal wiring needed
- **realtime-session** uses service-role key — can do enrichment DB queries
- **Context staleness is a non-issue** — sections are page-scoped; user doesn't navigate mid-session

---

### Critical issues found — plan revised ⚠️

#### Issue 1: Token budget (BLOCKER)
**Finding:** A real BOH bundle (ribeye → 3 prep recipes) = 1,450–2,300 tokens. Current `max_tokens: 1500` leaves only ~500 tokens for the teacher's structured JSON response (reply + suggested_replies + topics_update + should_suggest_quiz).

**Revision:** Raise `max_tokens` to **2,500** for training mode. Also add a conditional: only attempt BOH enrichment if `plate_spec_id IS NOT NULL`.

#### Issue 2: 92% of FOH items have no BOH link (DATA GAP)
**Finding:** Only 1 of 12 seeded FOH items (`16oz-bone-in-ribeye`) has a linked `plate_spec_id`. All others are NULL. Enrichment adds zero BOH/recipe value for the other 11 items until BOH specs are seeded.

**Revision:** Phase A-1 implementation is still correct — it checks `IS NOT NULL` and silently falls back. But as a parallel task, BOH plate specs should be seeded for the remaining 11 FOH items before this feature is truly useful.

#### Issue 3: Tool pre-pass is architecturally 2-pass, not 1 (DESIGN CHANGE)
**Finding:** OpenAI's `response_format: json_schema` (structured output) and `tools` cannot be used in the same call. The tool pre-pass requires:
- **Call 1** (with tools, no json_schema): let AI decide if it needs to search
- **Call 2** (with json_schema, no tools): generate structured teacher response with injected results

This adds ~1,000–1,500ms latency to every training question that triggers a search. For conversational flow this is noticeable.

**Revision:** **Defer Plan A-2 to Phase 2.** Ship Phase A-1 (eager bundle) first, validate with real servers, then add cross-menu search based on actual demand. If added, use keyword-triggering (pairing/compare keywords detected client-side) to avoid the round-trip cost on every message.

#### Issue 4: Duplicate enrichment logic (ARCHITECTURE SMELL)
**Finding:** Plan A-1 adds enrichment to `ask/index.ts`. Plan B-1 adds the same enrichment to `realtime-session/index.ts`. Two edge functions with identical DB traversal logic = double the maintenance surface.

**Revision:** Extract enrichment to a **shared Postgres function**: `fn_get_section_context(section_id UUID, language TEXT)` returning a `TEXT` bundle. Both edge functions call this single RPC. One migration, one place to update.

#### Issue 5: Voice session UX — text input clarity
**Finding:** Plan B-2 didn't define whether voice and text are exclusive. The current panel has a wave button that triggers live voice and a mic button for speech-to-text. Running both simultaneously creates confusion.

**Revision:** When a live voice session is active (`voiceHook.state !== 'disconnected'`), disable the text input and the recording mic button. Show clear state: "Voice session active". Tapping VoiceModeButton again ends the session and re-enables text.

---

### Answers to original open questions

| # | Question | Answer |
|---|---|---|
| 1 | max_tokens sufficient? | **No. Raise to 2,500.** Bundle is 1,450–2,300 tokens alone. |
| 2 | Tool pre-pass latency acceptable? | **No for always-on. Defer to Phase 2.** Use keyword trigger if added. |
| 3 | Context staleness on section change? | **Non-issue.** UX is page-scoped; no mid-session navigation. |
| 4 | Silent skip on missing slug? | **Acceptable.** Log a warning for data consistency monitoring. |
| 5 | Voice tools cross-domain? | **Yes, allow all 6 tools.** Food teacher should answer "what wine pairs with this?" |
| 6 | source field in ConversationMessage? | **Add it.** Additive, optional, backward-compatible. Useful for replay/analytics. |

---

## Revised Implementation Order

```
Phase A-0 (NEW): Seed BOH plate_specs for remaining 11 FOH items
                 → otherwise enrichment only helps the ribeye

Phase A-1: Shared DB function fn_get_section_context(section_id, language)
           → single migration, reused by both edge functions

Phase A-1a: ask/index.ts → call fn_get_section_context in handleTrainingDomain
            raise max_tokens to 2,500

Phase B-1: realtime-session/index.ts → add teacher_slug + section_id params
           call fn_get_section_context, fetch from ai_teachers
           add all 6 product search tools to training mode

Phase B-2: useRealtimeWebRTC → add teacher_slug, section_id params
Phase B-3: TrainingChatPanel → wire Live Trainer → voice connect()
           wire onTranscript → chatItems, show VoiceModeButton
           disable text input during active voice session

Phase B-4: types/training.ts → add source?: 'text' | 'voice'
           use-training-chat.ts → appendVoiceMessage(), persist to DB

Phase A-2 (DEFERRED): Tool pre-pass for cross-menu search
           Only implement if servers actually ask pairing questions
           Use keyword detection to avoid always-on latency cost
```

---

## Revised Files Changed

| File | Change | Phase |
|---|---|---|
| New migration: `fn_get_section_context` | Shared DB enrichment function | A-1 |
| `supabase/functions/ask/index.ts` | Call fn_get_section_context; raise max_tokens to 2,500 | A-1a |
| `supabase/functions/realtime-session/index.ts` | Add teacher_slug + section_id; call fn_get_section_context; fetch ai_teachers; add product tools | B-1 |
| `src/hooks/use-realtime-webrtc.ts` | Add teacher_slug + section_id to options interface | B-2 |
| `src/components/training/TrainingChatPanel.tsx` | Wire voice hook, Live Trainer → connect(), VoiceModeButton, disable text during voice | B-3 |
| `src/types/training.ts` | Add source?: 'text' \| 'voice' to ConversationMessage | B-4 |
| `src/hooks/use-training-chat.ts` | Add appendVoiceMessage(), persist voice transcripts to DB | B-4 |
| Seed migration (BOH plate_specs) | Seed remaining 11 FOH items with BOH context | A-0 |
