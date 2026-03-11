# AI Teacher Mode System — Implementation Plan

**Date**: 2026-03-03
**Status**: REVIEW COMPLETE — Ready for implementation
**Scope**: Teach Me + Practice Questions (Phase 1), Cert Test (Phase 2), Practice Tutor Voice+MC (Phase 3)

---

## 0. Why This Plan Exists

**Root cause**: The `mode` flag (`teach_me` / `quiz_me`) is selected by the user in
`TrainingChatPanel.tsx` but is never passed to the edge function. Both modes call
`use-training-chat.ts`, which calls `POST /ask` with `domain: 'training'` and no mode field.
Inside `handleTrainingDomain` in `ask/index.ts`, the teacher's monolithic `prompt_en` blob
contains both a `TEACH ME MODE` block and a `PRACTICE QUESTIONS MODE` block — so the AI sees
both simultaneously on every single request and picks arbitrarily.

**Secondary problem**: The teacher prompts embed a shared "master framing" section that is
duplicated verbatim across all 9 teacher blobs. Editing global rules requires touching 9 rows.

**Result of this plan**: Clean 4-layer prompt assembly, mode routing to the edge function,
modular DB-stored prompts, and a future-proof architecture for Cert Test + Practice Tutor.

---

## 1. Audit Results

### 1.1 — AI Knows Her Persona ❌ (currently broken)

**Current state**: The `ai_teachers` table has 9 teachers. Each `prompt_en` blob contains:
```
[shared master_framing text ~400 words]
---
[teacher-specific persona text ~200 words]
## TEACH ME MODE
[teach mode instructions]
## PRACTICE QUESTIONS MODE
[quiz mode instructions]
```

**Problem**: The AI receives the entire blob as the system prompt — she sees herself as
"food teacher who can both teach AND quiz" simultaneously. There is no suppression, no mode
declaration, no explicit persona focus.

**Required fix**: Extract layers into separate DB rows. The AI must receive:
- One clear persona identity (Layer 2)
- One active mode instruction (Layer 3)
- Explicit `CRITICAL: DO NOT` instructions to suppress the inactive mode

### 1.2 — Format Sent to AI ❌ (currently broken)

**Current state**: `fn_get_section_context()` returns mixed-format text:
```
MANUAL CONTENT:
## Standard Procedures
Some paragraph text...

RECIPE STEPS:
[{"step": 1, "instruction": "..."}]    ← raw JSONB string
```

The content also includes raw JSONB arrays for recipe steps, `Key: Value` pairs for plate
specs, and ALL-CAPS section labels. This is inconsistent and hard for the AI to parse reliably.

**Required fix**: Flatten all content to human-readable markdown before injection:
```markdown
## Manual Section: Standard Procedures
Some paragraph text...

## Recipe: Ribeye Preparation
**Steps:**
1. Season with kosher salt...
2. Heat cast iron to 500°F...
```

### 1.3 — Prompts in the Prompt Table ❌ (currently not the case)

**Current state**:
- Teacher prompts: embedded in seed migration SQL, stored in `ai_teachers.prompt_en` blobs
- Master framing: copy-pasted into each of the 9 teacher blobs (9x duplication)
- Mode instructions: embedded in the same blobs, no separate storage
- There are NO mode-specific rows in `ai_prompts` for training modes

**Required fix**: Migrate to this storage model:
| Slug | Table | Purpose |
|---|---|---|
| `teacher-global-rules` | `ai_prompts` | Master framing — applies to ALL teachers |
| `mode-teach-me` | `ai_prompts` | Teach Me behavioral contract + format |
| `mode-practice-questions` | `ai_prompts` | Practice Questions behavioral contract |
| `mode-cert-test` | `ai_prompts` | Cert Test rules (phase 2) |
| `mode-practice-tutor` | `ai_prompts` | Practice Tutor rules (phase 3) |
| `mode-live-trainer` | `ai_prompts` | Voice trainer behavior |
| `food-101`, `wine-101`, etc. | `ai_teachers` | Teacher persona ONLY (no mode content) |

### 1.4 — Output Audit ❌ (currently unreliable)

**Current state**: The response schema is:
```json
{
  "reply": "...",
  "suggested_replies": ["...", "..."],
  "topics_update": [],
  "should_suggest_quiz": false
}
```

**Problems found**:
1. `ChatBubble.tsx` renders plain text with `whitespace-pre-wrap` — no markdown parser.
   Teacher responses with `**bold**` or `## headers` render as literal asterisks/hashes.
2. Both modes share the same response schema — quiz mode should return a `question` field,
   not just `reply`.
3. No `welcome_message` injection on session start — the AI just answers whatever the first
   message is without a mode-specific greeting.
4. Response length is unbounded — mobile UX suffers from walls of text.

**Required fixes**:
- Add minimal markdown renderer to `ChatBubble` (numbered lists + dashes only)
- Add `mode-specific` welcome message field to `ai_teacher_modes` (or `ai_prompts`)
- Extend response schema for quiz mode: add `question`, `options`, `question_type` fields
- Add response length constraint to mode prompts (mobile-first: ≤ 4 short paragraphs)

---

## 2. Architecture

### 2.1 — 4-Layer Prompt Assembly

Every AI teacher call assembles the system prompt from 4 runtime layers:

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1 — Global Rules                             │
│  ai_prompts.slug = 'teacher-global-rules'           │
│  • Experience detection heuristic                   │
│  • Tone and style (conversational, mobile-first)    │
│  • Language handling (EN/ES auto-detect)            │
│  • Response length limits                           │
│  • Safety / out-of-scope redirection                │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  LAYER 2 — Teacher Persona                          │
│  ai_teachers.slug = 'food-101' (or 'wine-101', etc.)│
│  • Domain expertise declaration                     │
│  • Teaching style and voice for THIS persona        │
│  • Personality, name, speaking manner               │
│  • Level calibration (101 = new hire)               │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  LAYER 3 — Mode Instructions                        │
│  ai_prompts.slug = 'mode-teach-me' (or quiz, etc.)  │
│  • Active mode behavioral contract                  │
│  • Response format / JSON schema                    │
│  • CRITICAL: DO NOT rules to suppress other modes   │
│  • Scoring or evaluation rules (quiz/cert)          │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  LAYER 4 — Content Context (runtime injection)      │
│  • Section content (human-readable markdown)        │
│  • Session state (topics covered, score, turn #)    │
│  • Welcome message flag (first message check)       │
│  • Language directive                               │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
             ┌──────────────────┐
             │  ASSEMBLED SYSTEM│
             │  PROMPT → OpenAI │
             └──────────────────┘
```

**Edge function assembly code pattern**:
```ts
const [globalRules, modeInstructions] = await Promise.all([
  fetchPrompt('teacher-global-rules'),   // ai_prompts table
  fetchPrompt(`mode-${mode}`),           // ai_prompts table
]);
const teacherPersona = await fetchTeacher(teacher_slug); // ai_teachers table
const contentContext = await loadSectionContent(section_id, content_source, language);

const systemPrompt = [
  `<rules>\n${globalRules}\n</rules>`,
  `<persona>\n${teacherPersona}\n</persona>`,
  `<mode>\n${modeInstructions}\n</mode>`,
  `<content>\n${contentContext}\n</content>`,
  session_state ? `<session>\n${JSON.stringify(session_state)}\n</session>` : '',
].filter(Boolean).join('\n\n');
```

### 2.2 — Mode Welcome Messages

On the **first message** of a session (when `conversation_history` is empty), the edge function
injects a mode-specific welcome into the response — the AI does not need to infer it.

| Mode | Welcome (EN) |
|---|---|
| `teach_me` | `"Hi! I'm [teacher name]. Ready to walk you through [section name]? Let's start at the beginning."` |
| `practice_questions` | `"Time to practice! I'll ask you questions about [section name]. Answer in your own words — there are no trick questions."` |
| `cert_test` | `"This is your certification assessment for [course name]. [N] questions. Take your time."` |
| `practice_tutor` | `"Let's practice together. I'll cover [food/wine/standards] and check your readiness as we go."` |

Welcome messages are stored as `welcome_en` / `welcome_es` columns on `ai_teacher_modes`
(or optionally in the `mode-*` prompt rows for simpler management).

### 2.3 — Response Schema by Mode

**Teach Me (`teach_me`)**:
```json
{
  "reply": "string — explanation text in markdown-lite format",
  "suggested_replies": ["string", "string", "string"],
  "topics_update": ["string"],
  "should_suggest_quiz": false
}
```

**Practice Questions (`quiz_me`)**:
```json
{
  "reply": "string — evaluation of previous answer + transition",
  "question": "string — the next practice question",
  "question_type": "open | scenario",
  "suggested_replies": [],
  "topics_update": ["string"],
  "readiness_hint": "keep_going | almost_there | ready_for_test"
}
```

**Cert Test (`cert_test`)** — see Phase 2.

**Practice Tutor (`practice_tutor`)** — see Phase 3.

---

## 3. Database Schema Changes

### 3.1 — `ai_teacher_modes` Table (NEW)

```sql
CREATE TABLE ai_teacher_modes (
  id            uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES ai_teachers(id) ON DELETE CASCADE,
  mode          text NOT NULL CHECK (mode IN (
                  'teach_me', 'quiz_me', 'cert_test', 'practice_tutor', 'live_trainer'
                )),
  welcome_en    text,
  welcome_es    text,
  voice         text DEFAULT 'alloy',  -- OpenAI voice name
  tools_config  jsonb DEFAULT '[]',    -- tool definitions for this mode
  sort_order    int DEFAULT 0,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(teacher_id, mode)
);

ALTER TABLE ai_teacher_modes ENABLE ROW LEVEL SECURITY;
-- SELECT: authenticated users
-- INSERT/UPDATE/DELETE: admin only
```

### 3.2 — `ai_teachers` — Clean Up Persona Column

```sql
-- Add clean persona columns (Layer 2 only — no master framing, no mode blocks)
ALTER TABLE ai_teachers
  ADD COLUMN persona_en text,
  ADD COLUMN persona_es text;

-- prompt_en/prompt_es are deprecated (keep for fallback during transition)
-- After migration is complete, drop prompt_en and prompt_es
```

### 3.3 — `ai_prompts` — Add Mode Instruction Rows

New rows to be seeded via migration:

| slug | category | description |
|---|---|---|
| `teacher-global-rules` | `system` | Master framing for all teachers |
| `mode-teach-me` | `teacher_mode` | Teach Me behavioral contract |
| `mode-practice-questions` | `teacher_mode` | Practice Questions contract |
| `mode-live-trainer` | `teacher_mode` | Voice trainer behavior |
| `mode-cert-test` | `teacher_mode` | Cert test evaluation rules (phase 2) |
| `mode-practice-tutor` | `teacher_mode` | Practice tutor voice+MC rules (phase 3) |

### 3.4 — `tutor_sessions` — Add Mode Column

```sql
ALTER TABLE tutor_sessions
  ADD COLUMN mode text DEFAULT 'practice_questions'
  CHECK (mode IN ('practice_questions', 'practice_tutor'));
```

### 3.5 — No New Session Tables

The existing session tables cover all needs:

| Table | Used By |
|---|---|
| `course_conversations` | Teach Me (text) |
| `tutor_sessions` | Practice Questions + Practice Tutor |
| `module_test_attempts` | Cert Test |
| `module_test_answers` | Cert Test per-question answers |
| `quiz_questions` | Cert Test question bank (AI-generated per attempt) |

---

## 4. Edge Function Changes

### 4.1 — `ask/index.ts` — `handleTrainingDomain`

**What changes**:
1. Accept `mode` parameter from request body
2. Fetch Layer 1 + Layer 2 + Layer 3 via `fetchPrompt()` instead of monolithic blob
3. Flatten section content via `formatContentForAI()` helper
4. Inject welcome message on first message
5. Use mode-specific JSON schema for response validation
6. Save conversation to `course_conversations` (teach_me) or `tutor_sessions` (quiz_me)

**Signature change**:
```ts
// Before
async function handleTrainingDomain(params: {
  question, domain, section_id, content_context,
  conversation_history, session_summary, topics_covered,
  topics_total, language, groupId, teacher_slug
})

// After
async function handleTrainingDomain(params: {
  question, mode,           // ← 'teach_me' | 'quiz_me' (NEW)
  domain, section_id, content_context,
  conversation_history, session_summary, topics_covered,
  topics_total, language, groupId, teacher_slug
})
```

**Prompt assembly** (replaces direct `teacher.prompt_en` usage):
```ts
const [globalRules, modePrompt] = await Promise.all([
  fetchPromptBySlug('teacher-global-rules'),
  fetchPromptBySlug(`mode-${mode === 'teach_me' ? 'teach-me' : 'practice-questions'}`),
]);

const persona = teacher.persona_en ?? teacher.prompt_en; // fallback during transition
const contentMd = formatContentForAI(section_content, language);

const systemPrompt = assembleSystemPrompt({
  globalRules, persona, modePrompt, contentMd,
  session: { topics_covered, topics_total, session_summary }
});
```

**Content flattener** — new `_shared/content-formatter.ts`:
```ts
export function formatContentForAI(raw: string, language: string): string {
  // 1. Replace raw JSONB arrays with numbered step lists
  // 2. Replace ALL-CAPS section labels with ## headers
  // 3. Convert Key: Value pairs to markdown Bold: value
  // 4. Ensure consistent UTF-8 encoding
  return formatted;
}
```

### 4.2 — `use-training-chat.ts` — Pass Mode to Edge Function

```ts
// Before
const payload = {
  question, domain: 'training', section_id, content_context, ...
};

// After
const payload = {
  question, mode,           // ← pass mode from TrainingChatPanel
  domain: 'training', section_id, content_context, ...
};
```

### 4.3 — `TrainingChatPanel.tsx` — Pass Mode to Hook

```tsx
// The mode prop already exists in the component. Wire it through:
const { sendMessage, ... } = useTrainingChat({
  ...
  mode,    // ← 'teach_me' | 'quiz_me' — already a prop, just not passed
});
```

### 4.4 — `realtime-session/index.ts` — Layer Assembly

Same 4-layer assembly as `ask/index.ts`, but for the voice session:
```ts
// Replace current monolithic teacher prompt with:
const systemPrompt = assembleSystemPrompt({
  globalRules, persona, modePrompt: liveTrainerMode,
  contentMd, session: null
});
```

### 4.5 — `ChatBubble.tsx` — Minimal Markdown Renderer

Add a lightweight renderer (no external dependency needed):
```tsx
function renderMarkdownLite(text: string): React.ReactNode {
  // Supports: numbered lists (1. ...), dash lists (- ...), **bold**, _italic_
  // Does NOT support: headers, tables, code blocks, links
  return text.split('\n').map((line, i) => {
    if (/^\d+\. /.test(line)) return <li key={i}>{line.replace(/^\d+\. /, '')}</li>;
    if (/^- /.test(line))    return <li key={i}>{line.replace(/^- /, '')}</li>;
    return <p key={i}>{parseInline(line)}</p>;
  });
}
```

---

## 5. Content Format (Markdown In, Markdown Out)

### 5.1 — Input to AI (Section Content)

All section content injected into Layer 4 must be in clean markdown:

```markdown
## [Section Name]

[Section description or intro paragraph]

### Steps
1. First step...
2. Second step...

### Key Details
- **Temperature**: 500°F
- **Cook Time**: 4 minutes per side
- **Internal Temp**: 130°F for medium-rare
```

The `formatContentForAI()` function (see 4.1) transforms raw `fn_get_section_context()` output
into this format before injection.

### 5.2 — Output from AI (Teacher Replies)

The mode prompt instructs the AI to use minimal markdown:

```
## Response Format Rules
- Use numbered lists (1. 2. 3.) for sequential steps or ordered information
- Use dashes (- item) for unordered lists
- Use **text** for terms that need emphasis (max 2 per response)
- DO NOT use headers (##), tables, code blocks, or HTML
- Keep responses to 3-4 short paragraphs maximum
- Mobile-first: each paragraph should fit on one screen scroll
```

`ChatBubble` renders this with the `renderMarkdownLite()` function above.

---

## 6. Prompt Content — What Goes in Each Row

### 6.1 — `teacher-global-rules` (ai_prompts)

```
You are an AI training assistant for a restaurant operation. You help staff
learn their roles through guided conversation.

## Experience Detection
Listen for signals in the user's messages:
- New hire: uses "I don't know", asks basic questions → use simple language
- Experienced: uses industry terms confidently → elevate vocabulary and depth
- Mid-level: some knowledge gaps → fill gaps without over-explaining

## Tone and Style
- Conversational, warm, encouraging — never condescending
- Keep answers focused and mobile-friendly (short paragraphs)
- Use the same language the user writes in (EN or ES)

## Out-of-Scope Handling
If asked about topics unrelated to restaurant operations, redirect:
"That's outside what I can help with here — let's focus on [current section]."

## Response Length
- Never exceed 4 short paragraphs in a single reply
- If content requires more, break it into a conversation
```

### 6.2 — `mode-teach-me` (ai_prompts)

```xml
<mode name="teach_me">
You are in TEACH ME mode. Your job is to explain the current section content
to the staff member in a way they can understand and retain.

## Your Behavior in This Mode
- Walk through the content systematically, one concept at a time
- Ask a follow-up question after each explanation to check understanding
- Adapt depth based on their responses (see experience detection in global rules)
- Offer to go deeper or move on based on their comfort level
- After covering all topics, offer to practice with questions

## Response Format
Return a JSON object:
{
  "reply": "Your explanation (markdown-lite)",
  "suggested_replies": ["Tell me more", "Got it, next topic", "Can you give an example?"],
  "topics_update": ["topic just covered"],
  "should_suggest_quiz": false
}
Set should_suggest_quiz to true only after all major topics are covered.

## CRITICAL: DO NOT
- Do NOT quiz or test the user in this mode
- Do NOT ask "what is the correct answer" style questions
- Do NOT evaluate their knowledge
</mode>
```

### 6.3 — `mode-practice-questions` (ai_prompts)

```xml
<mode name="practice_questions">
You are in PRACTICE QUESTIONS mode. Your job is to test the staff member's
knowledge of the current section through conversational questions.

## Your Behavior in This Mode
- Ask one clear question at a time based on the section content
- After their answer, give specific feedback: what they got right, what to add
- Gradually increase question difficulty as they demonstrate understanding
- Track which topics you've covered to ensure full section coverage
- Suggest they try the cert test when their readiness score is high

## Question Types
- Direct recall: "What temperature does the ribeye come off the grill?"
- Scenario: "A guest says their steak is overcooked — walk me through what you do"
- Open reasoning: "Why do we rest the steak before plating?"

## Response Format
Return a JSON object:
{
  "reply": "Feedback on their previous answer (markdown-lite)",
  "question": "Your next question",
  "question_type": "direct | scenario | reasoning",
  "suggested_replies": [],
  "topics_update": ["topic just tested"],
  "readiness_hint": "keep_going | almost_there | ready_for_test"
}
Set readiness_hint to "ready_for_test" only when they've answered ≥70% correctly
across all major topics.

## CRITICAL: DO NOT
- Do NOT explain or teach the content unprompted
- Do NOT give long explanations — keep feedback concise (2-3 sentences max)
- Do NOT ask multiple questions at once
- Do NOT repeat questions already asked in this session
</mode>
```

---

## 7. Phased Implementation Roadmap

### Phase 1 — Foundation: Fix Current Modes (Current Sprint)

**Goal**: Teach Me and Practice Questions work correctly and are fully decoupled.

| # | Task | File(s) | Type |
|---|---|---|---|
| 1.1 | Add `persona_en`/`persona_es` to `ai_teachers` (~~no `ai_teacher_modes` table — deferred~~) | new migration | DB |
| 1.2 | Seed `teacher-global-rules` + `mode-teach-me` + `mode-practice-questions` + `mode-live-trainer` in `ai_prompts`; deactivate orphaned `training-teacher` row | new migration | DB |
| 1.3 | Add `mode` column to `tutor_sessions` | new migration | DB |
| 1.4 | Add `mode` column to `course_conversations` | new migration | DB |
| 1.5 | Update `fn_get_section_context()` PG function: flatten JSONB assembly/components/procedure to numbered steps, remove 500-char truncation | new migration | DB |
| 1.6 | Populate `ai_teachers.persona_en` for all 9 teachers (strip master_framing + mode blocks, keep teacher-specific persona only) | data migration | DB |
| 1.7 | Create `supabase/functions/_shared/prompt-helpers.ts` with `fetchPromptBySlug()` + `assembleSystemPrompt()` + `MODE_SLUG_MAP` | **NEW** shared util | Edge Fn |
| 1.8 | Refactor `handleTrainingDomain` in `ask/index.ts`: add `mode`+`is_first_message` to `TrainingAskRequest`, update `TrainingAskResponse` with optional quiz fields, use 4-layer assembly via helpers, use `extractModeBlock()` (Strategy A), add `getTrainingResponseSchema(mode)`, update `.select()` to include `persona_en/es`, **add multi-round search tool loop** (reuse existing `SEARCH_TOOLS` + `executeSearch()`) | existing fn | Edge Fn |
| 1.9 | Refactor `realtime-session/index.ts`: import shared helpers, always use `MODE_SLUG_MAP['live_trainer']`, update `.select()` to include `persona_en/es`. **PRESERVE existing search tools** — `search_handbook` (always) + 6 product tools (training mode). Only change is `instructions` field; `tools` array and `tool_choice: 'auto'` are unchanged. | existing fn | Edge Fn |
| 1.10 | Refactor `course-tutor/index.ts` for 4-layer assembly using shared helpers | existing fn | Edge Fn |
| 1.11 | Update `use-training-chat.ts`: change `sendMessage(text, mode?)` signature, fix welcome check to `!history.some(m => m.role==='assistant')`, extend `TrainingAIResponse` interface, concatenate `reply+question` for quiz display | existing hook | React |
| 1.12 | Update `TrainingChatPanel.tsx`: change `onSendMessage` prop type to `(text, mode?) => void`, pass `selectedMode` at all `onSendMessage()` call sites; `ask_anything` maps to `'teach_me'` | existing component | React |
| 1.13 | Confirm `LearningSession.tsx` `onSendMessage={chat.sendMessage}` pass-through still works with updated signature (no change needed if param is optional) | existing component | React |
| 1.14 | Fix `renderMarkdownLite()` in `ChatBubble.tsx`: two-pass render with `<ol>`/`<ul>` wrappers, define `parseInline()` with `<strong>`/`<em>`, strip stray `**` | existing component | React |
| 1.15 | `npx tsc --noEmit` — 0 errors | — | QA |
| 1.16 | Manual test: Teach Me vs Practice Questions — verify different AI behavior | — | QA |
| 1.17 | Verify ChatBubble renders readable steps/lists (no raw JSON) | — | QA |
| 1.18 | Verify quiz mode returns `question` field and it appears in chat concatenated with `reply` | — | QA |
| 1.19 | **Guardrail test**: ask food teacher about a wine not in section content → teacher searches, returns accurate result or "not in our materials" — never fabricates | — | QA |
| 1.20 | **Guardrail test**: ask about a topic outside restaurant operations → teacher redirects, does not engage | — | QA |
| 1.21 | **Voice guardrail**: voice trainer still has all 7 search tools after refactor (check session config log) | — | QA |

### Phase 2 — Cert Test

**Goal**: Staff can take a formal mixed-format certification test.

DB tables already exist: `module_test_attempts`, `module_test_answers`, `quiz_questions` (with `course_id`).

| # | Task | Notes |
|---|---|---|
| 2.1 | Seed `mode-cert-test` prompt row | Define strict evaluation rules + question distribution |
| 2.2 | Create `course-cert-test` edge function | 3 sub-endpoints: `/start`, `/answer`, `/complete` |
| 2.3 | `/start`: generate questions via `module-test-generator` prompt, store in `quiz_questions` | Source='ai', per-domain distribution |
| 2.4 | `/answer`: evaluate one MC or voice answer, save to `module_test_answers` | Use teacher mapped from `section.content_source` |
| 2.5 | `/complete`: finalize attempt, generate competency summary, update `course_enrollments` | Triggers `sync_program_enrollment_on_course_complete()` |
| 2.6 | Multi-teacher orchestrator: map `content_source → teacher_slug` | Deterministic mapping (see §8) |
| 2.7 | Client UI: test lobby, MC card, voice card, progress bar, results screen | Reuse quiz system MC components |
| 2.8 | Wire cert test pass/fail to `course_enrollments.final_passed` | Triggers enrollment sync |

### Phase 3 — Practice with Tutor (Voice + MC)

**Goal**: Cross-domain voice tutor with interspersed MC questions and progressive difficulty.

| # | Task | Notes |
|---|---|---|
| 3.1 | Seed `mode-practice-tutor` prompt row | Coverage rules, MC insertion frequency, difficulty ramp |
| 3.2 | Add `display_mc_question` tool to `realtime-session` | Parameters: question, options[], correct_id |
| 3.3 | Client MC overlay component for voice UI | Intercept tool call, pause VAD, render 4-option card |
| 3.4 | Implement orchestrator state machine in `realtime-session` | Domain rotation, cross-teacher session state |
| 3.5 | Progressive difficulty: switch 101→201 teacher when score >80% in a domain | Track per-domain level in session state |
| 3.6 | "Pause VAD" during MC option selection | Prevent background noise from interrupting |
| 3.7 | REST endpoint `/update-tutor-state` to persist progress mid-session | Saves to `tutor_sessions` |

---

## 8. Teacher-to-Content Mapping

Used by the cert test orchestrator to assign the correct teacher per question:

| `content_source` | `ai_teachers.category` | Default slug |
|---|---|---|
| `foh_plate_specs` | `food` | `food-101` |
| `plate_specs` | `food` | `food-101` |
| `prep_recipes` | `food` | `food-101` |
| `wines` | `wine` | `wine-101` |
| `cocktails` | `beer_liquor` | `beer-liquor-101` |
| `beer_liquor_list` | `beer_liquor` | `beer-liquor-101` |
| `manual_sections` | `standards` | `standards-101` |

Level escalation (Phase 3 progressive difficulty):
- Score < 80%: use `{category}-101`
- Score ≥ 80%: use `{category}-201` (if it exists, else stay at 101)

---

## 9. Multi-Teacher Voice Architecture (Phase 3)

### 9.1 — Voice + MC Hybrid Flow

```
1. Teacher asks a question via WebRTC voice
   └── Realtime API calls display_mc_question tool
         └── Client intercepts tool call
               └── Renders MC overlay on voice UI
                     └── VAD paused (no accidental interruption)
                           └── User taps an option
                                 └── Tool result sent: "User selected B: Cabernet Sauvignon"
                                       └── VAD resumed
                                             └── Teacher responds verbally: "That's right!"
```

### 9.2 — Teacher Switching in Voice

When the orchestrator decides to switch domains, it updates the system prompt segment:
```
"You are now [Wine Coach name]. The student has been practicing food knowledge
and scored 72%. Transition to wine topics for the next 3-4 exchanges."
```

OpenAI Realtime API does not support mid-session system prompt changes natively. The
recommended approach: **reconnect with the new teacher's system prompt** when switching domains
(brief 1-2 second gap is acceptable — the UX shows "Connecting to [teacher name]...").

### 9.3 — Session State Schema (Practice Tutor)

```json
{
  "domains_coverage": {
    "food":      { "questions_asked": 3, "correct": 2, "score": 67, "level": "101" },
    "wine":      { "questions_asked": 2, "correct": 2, "score": 100, "level": "101" },
    "standards": { "questions_asked": 1, "correct": 0, "score": 0, "level": "101" }
  },
  "current_teacher_slug": "wine-101",
  "current_section_id": "uuid",
  "overall_readiness": 56,
  "question_number": 7,
  "total_questions": 15,
  "cert_test_readiness": "not_ready"
}
```

Persisted in `tutor_sessions.session_state` (JSONB column — already exists).

---

## 10. Search Tools + Guardrails

### 10.1 — Search Tools in Text Mode (Teach Me + Practice Questions)

**Decision**: Text training mode gets the same 7 search tools as voice mode.

The teacher pre-loads section content (Layer 4) as the primary source. But students ask
cross-domain questions naturally — a food teacher might get asked about wine pairing, or a
standards teacher might get asked about a specific dish. The teacher should be able to look
it up accurately rather than hallucinate or refuse.

**Tool priority order (enforced via mode prompt instruction)**:
1. Use pre-loaded section content first — it's already there, no latency
2. If the answer isn't in section content → call the appropriate search tool
3. If search returns no results → say "I don't have that in our training materials"
4. Never answer from general knowledge outside our system

**Tools available to text training teachers** (reuse existing `SEARCH_TOOLS` from `ask/index.ts`):

| Tool | When to use |
|---|---|
| `search_manual_v2` | Policies, procedures, service standards, handbook content |
| `search_steps_of_service` | Service procedures, guest interaction, table etiquette |
| `search_dishes` | Menu items, allergens, flavor profiles, upsell notes |
| `search_wines` | Wine list, varietals, regions, pairings |
| `search_cocktails` | Cocktail recipes, ingredients, styles |
| `search_recipes` | Prep recipes, plate specs, cooking procedures |
| `search_beer_liquor` | Beer, spirits, producers |

**Technical implementation** — same multi-round loop already used in search mode:
```ts
// In handleTrainingDomain — same pattern as existing search mode
const MAX_TOOL_ROUNDS = 3;

// Round 1: tools available + response_format enforced on final answer
let aiData = await openaiCall({
  messages,
  tools: SEARCH_TOOLS,
  tool_choice: 'auto',
  response_format: { type: 'json_schema', json_schema: getTrainingResponseSchema(mode) },
  max_tokens: 2500,
  temperature: 0.7,
});

for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
  if (aiData.choices[0].finish_reason !== 'tool_calls') break;

  // Execute tool calls, append results
  const toolResults = await executeTrainingToolCalls(aiData, supabase, language);
  messages.push(...toolResults);

  // Final round: no tools, json schema enforced
  const isLastRound = round === MAX_TOOL_ROUNDS - 1;
  aiData = await openaiCall({
    messages,
    ...(isLastRound ? {} : { tools: SEARCH_TOOLS, tool_choice: 'auto' }),
    response_format: { type: 'json_schema', json_schema: getTrainingResponseSchema(mode) },
    max_tokens: 2500,
    temperature: 0.7,
  });
}
```

`executeTrainingToolCalls()` reuses the existing `executeSearch()` function from `ask/index.ts`.
No new search infrastructure needed — it's all already there.

---

### 10.2 — Guardrails: Source-of-Truth Enforcement

**Goal**: The teacher NEVER invents menu items, prices, procedures, or facts.
Every answer comes from either (a) the injected section content or (b) a verified search result.

**Guardrail instructions** — add to `teacher-global-rules` (ai_prompts row):

```
## Source of Truth — CRITICAL RULES

You are a trainer for Alamo Prime. Your knowledge is LIMITED to:
  1. The section content provided in <content> tags
  2. Results returned by your search tools
  3. Nothing else

NEVER answer from general culinary knowledge, personal experience, or assumptions.
If a fact isn't in the provided content or search results:
  → Search for it using the appropriate tool first
  → If the search returns nothing: say "I don't have that in our training materials.
    Let's focus on what I do have here."

NEVER fabricate:
  - Menu items, prices, or descriptions not in search results
  - Procedures, temperatures, or times not in section content
  - Policies or standards not in the handbook
  - Wine pairings, allergen info, or ingredients not verified by search

If a student asks about something completely outside restaurant operations
(personal topics, other restaurants, general cooking):
  → "That's outside what I can help with here. Let's stay focused on [current section]."
```

**Guardrail instructions** — add to each mode prompt (`mode-teach-me`, `mode-practice-questions`):

```
## Accuracy Rules
- Only teach facts present in <content> or returned by a search tool.
- If you're not certain a fact is accurate, search before stating it.
- If you receive search results, quote them accurately. Do not paraphrase in ways that
  change meaning (e.g., don't round temperatures, don't approximate quantities).
- Never use phrases like "typically", "usually", or "generally" — those signal guessing.
  Either you know it from our data, or you search, or you say you don't have it.
```

**Response validation** — add to the JSON schema instruction:

```
Your reply field must contain ONLY information from:
  (a) the <content> block, OR
  (b) search tool results returned this session.
If you're about to state a fact not sourced from (a) or (b), stop and search first.
```

---

### 10.3 — Search Tools in Voice Mode (Preserve Existing)

Voice mode already has `search_handbook` + 6 product tools wired in `realtime-session/index.ts`
(lines 483-520). The 4-layer prompt refactor only changes `instructions`. The `tools` array
and `tool_choice: 'auto'` are **unchanged**.

Guardrail instructions apply to voice too — they live in `teacher-global-rules` which is
Layer 1 of all mode assemblies (text and voice).

---

## 11. What NOT to Build

| Item | Reason to Reject |
|---|---|
| Unified `ai_teacher_sessions` god-table | Existing tables work. Polymorphic JSONB in one table > purpose-built tables |
| Simultaneous multi-teacher voice | Realtime API = one persona per session. Serial switching is sufficient |
| Permanent pre-generated question bank | Students memorize fixed questions. Per-session AI generation is better |
| Custom LLM fine-tuning per teacher | GPT-4o-mini + good prompts is sufficient. Fine-tuning locks to model version |
| `ai_teacher_modes` table in Phase 1 | No Phase 1 consumer. Defer to Phase 2. Mode prompts live in `ai_prompts`. Teacher personas go in `ai_teachers.persona_en`. |
| Client-side welcome template | Client auto-send already works. Edge function welcome injection creates duplicate greeting. |
| `formatContentForAI()` TypeScript post-processor | Fix JSONB at PG source (`fn_get_section_context`). Don't double-process in TypeScript. |
| Search tools in text mode (removed) | ~~Originally rejected — reversed. Text teachers get the same 7 search tools as voice.~~ See §10. |

---

## 11. Verification Checklist

### Phase 1 — After Implementation

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] Open Teach Me on any section → AI greets with section-specific welcome → AI explains content without quizzing
- [ ] Open Practice Questions on same section → AI greets differently → AI asks questions, does NOT lecture
- [ ] Switch between Teach Me and Practice Questions mid-course → behavior changes immediately
- [ ] ES language setting → teacher responds in Spanish throughout
- [ ] `ChatBubble` renders `**bold**` as bold, `1. item` as numbered list
- [ ] Long responses stay ≤ 4 paragraphs
- [ ] Voice (Live Trainer) uses correct 4-layer system prompt
- [ ] `ai_prompts` table has all 4+ mode rows with proper content
- [ ] `ai_teachers.persona_en` populated for all 9 teachers (master framing removed from blobs)

### Phase 2 — After Cert Test

- [ ] Cert test generates questions distributed across all course sections
- [ ] Each question served by teacher matching `content_source` mapping
- [ ] MC answers scored immediately, voice answers transcribed then evaluated
- [ ] Passing a cert test updates `course_enrollments.final_passed`
- [ ] Program enrollment progress syncs automatically via trigger

### Phase 3 — After Practice Tutor

- [ ] Voice teacher asks MC question → UI renders option cards
- [ ] Tapping an option sends result to Realtime API tool call
- [ ] VAD paused during MC selection, resumed after tap
- [ ] Domain switch triggers teacher reconnection (brief pause acceptable)
- [ ] Session state persists across reconnections

---

## 12. Files Reference

| File | Role | Changed In Phase |
|---|---|---|
| `supabase/functions/ask/index.ts` | Primary text AI handler | 1 |
| `supabase/functions/_shared/prompt-assembler.ts` | **NEW** — `assembleSystemPrompt()` shared utility | 1 |
| `supabase/functions/realtime-session/index.ts` | Voice session prompt assembly | 1, 3 |
| `src/hooks/use-training-chat.ts` | Pass `mode` to edge function | 1 |
| `src/components/training/TrainingChatPanel.tsx` | Wire `mode` to hook | 1 |
| `src/components/training/ChatBubble.tsx` | Add markdown-lite renderer | 1 |
| `supabase/migrations/2026XXXXXXXX_ai_teacher_modes.sql` | `ai_teacher_modes` table | 1 |
| `supabase/migrations/2026XXXXXXXX_persona_columns.sql` | `persona_en/es` on `ai_teachers` | 1 |
| `supabase/migrations/2026XXXXXXXX_mode_prompts_seed.sql` | Seed mode prompt rows | 1 |
| `supabase/migrations/2026XXXXXXXX_tutor_sessions_mode.sql` | Add `mode` column | 1 |
| `supabase/functions/course-cert-test/index.ts` | NEW: cert test edge function | 2 |
| `src/components/training/CertTestUI.tsx` | NEW: cert test client UI | 2 |

---

---

## 13. Reviewer A — Critical Fixes & Verdicts

**Reviewed by**: Opus Reviewer, Prompt Architecture Audit

| Question | Verdict | Finding |
|---|---|---|
| Q1 — Persona identity | **PASS** | Clean Layer 2/3 separation. Suppression rules present. Add before/after example for persona extraction. |
| Q2 — Format correctness | **PARTIAL** | XML tags good. JSON schema good. `formatContentForAI()` too vague — fix at PG source. Mode-specific schema selection code missing. |
| Q3 — Prompts in DB | **PASS** | All prompts DB-stored. 9× duplication eliminated. Transition safe. Deprecate orphaned `training-teacher` row. |
| Q4 — Output audited | **PARTIAL** | JSON validation solid. `renderMarkdownLite()` has structural HTML bug. Quiz `question` field UI unspecified. Welcome conflicts with client auto-send. |

---

### 13A.1 — CRITICAL: `mode` Slug Mismatch

**Bug**: Client sends `mode: 'quiz_me'` but the prompt slug would be `mode-quiz-me`. The correct
slug seeded in §3.3 is `mode-practice-questions`. This is a runtime 404 on prompt fetch.

**Fix** — define explicit mapping in the edge function:
```ts
function getModeSlug(mode: 'teach_me' | 'quiz_me' | 'ask_anything'): string {
  switch (mode) {
    case 'teach_me':    return 'mode-teach-me';
    case 'quiz_me':     return 'mode-practice-questions';
    case 'ask_anything': return 'mode-teach-me'; // freeform → teach mode fallback
  }
}
```
Use `getModeSlug(mode)` when calling `fetchPromptBySlug()`. Seal the mismatch here in one place.

### 13A.2 — CRITICAL: `renderMarkdownLite()` HTML Bug

The plan's proposed renderer emits `<li>` elements directly without `<ol>` or `<ul>` wrappers —
invalid HTML that browsers will not render correctly.

**Corrected approach** — two-pass render:
```tsx
function renderMarkdownLite(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Numbered list block
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i}>{parseInline(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      nodes.push(<ol key={`ol-${i}`} className="list-decimal pl-4 space-y-1">{items}</ol>);
      continue;
    }

    // Dash list block
    if (/^- /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(<li key={i}>{parseInline(lines[i].replace(/^- /, ''))}</li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="list-disc pl-4 space-y-1">{items}</ul>);
      continue;
    }

    // Empty line → skip (natural paragraph gap via `space-y` in parent)
    if (!line.trim()) { i++; continue; }

    // Paragraph
    nodes.push(<p key={i}>{parseInline(line)}</p>);
    i++;
  }

  return <>{nodes}</>;
}

function parseInline(text: string): React.ReactNode {
  // Strip stray **bold** markers (safety net — AI ignores format rules occasionally)
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/_(.*?)_/g, '$1');
}
```

### 13A.3 — CRITICAL: `getResponseSchema(mode)` Missing

The edge function must select the correct JSON schema for the mode. **Add to `ask/index.ts`**:
```ts
function getTrainingResponseSchema(mode: 'teach_me' | 'quiz_me') {
  const base = {
    type: 'object',
    properties: {
      reply:            { type: 'string' },
      suggested_replies:{ type: 'array', items: { type: 'string' } },
      topics_update:    {
        type: 'object',
        properties: {
          covered: { type: 'array', items: { type: 'string' } },
          total:   { type: 'array', items: { type: 'string' } },
        },
        required: ['covered', 'total'], additionalProperties: false,
      },
    },
    required: ['reply', 'suggested_replies', 'topics_update'],
    additionalProperties: false,
  };

  if (mode === 'teach_me') {
    return {
      ...base,
      properties: {
        ...base.properties,
        should_suggest_quiz: { type: 'boolean' },
      },
      required: [...base.required, 'should_suggest_quiz'],
    };
  }

  // quiz_me
  return {
    ...base,
    properties: {
      ...base.properties,
      question:      { type: 'string' },
      question_type: { type: 'string', enum: ['direct', 'scenario', 'reasoning'] },
      readiness_hint:{ type: 'string', enum: ['keep_going', 'almost_there', 'ready_for_test'] },
    },
    required: [...base.required, 'question', 'question_type', 'readiness_hint'],
  };
}
```

### 13A.4 — CRITICAL: Welcome Message — Pick One Approach

**Conflict found**: `TrainingChatPanel.tsx` already auto-sends a starter message when the user
selects a mode (e.g., `"Teach me about this section"` or `"Quiz me on this section"`). The
plan's edge-function welcome template would produce a parallel greeting — two welcome messages.

**Decision: Keep the client auto-send (Option A) — simpler, already works.**

- Remove welcome template from edge function logic
- Remove `is_first_message` check from welcome injection (keep `is_first_message` for other uses)
- The AI's natural response to "Teach me about this section" IS the welcome
- Add a WELCOME instruction inside the mode prompt (not the edge function code) so the AI opens
  naturally without being told "don't wait for the student to prompt you"

**Mode prompt addition** (end of each `<mode>` row in ai_prompts):
```
FIRST TURN ONLY: When the student sends their first message to start this mode, begin with a
one-sentence greeting that names what you will teach, then start immediately. Example:
"Let's look at the Bone-In Ribeye — I'll walk you through the make, the description, and how
to sell it." [Then begin teaching.]
```

### 13A.5 — CRITICAL: Quiz Mode `question` Field Rendering

**Plan gap**: `reply` (feedback) + `question` (next question) are two separate JSON fields,
but `ChatBubble` renders one string. How are these rendered?

**Decision: Concatenate in the hook for Phase 1.**

In `use-training-chat.ts`, when the response is quiz mode, combine fields before setting chat state:
```ts
const assistantContent = data.question
  ? `${data.reply}\n\n${data.question}`
  : data.reply;
```

This keeps `ChatBubble` unchanged and delivers a natural "feedback → next question" flow.
In Phase 2, a dedicated `QuizBubble` component can separate the fields visually.

### 13A.6 — `assembleSystemPrompt()` Location

Define in: `supabase/functions/_shared/prompt-assembler.ts`

```ts
interface PromptLayers {
  globalRules:   string;
  persona:       string;
  modeInstructions: string;
  contentContext: string;
  sessionState?: object | null;
}

export function assembleSystemPrompt(layers: PromptLayers): string {
  const parts = [
    `<rules>\n${layers.globalRules}\n</rules>`,
    `<persona>\n${layers.persona}\n</persona>`,
    `<mode>\n${layers.modeInstructions}\n</mode>`,
    `<content>\n${layers.contentContext}\n</content>`,
  ];
  if (layers.sessionState) {
    parts.push(`<session>\n${JSON.stringify(layers.sessionState, null, 2)}\n</session>`);
  }
  return parts.join('\n\n');
}
```

Add to files reference in §14: `supabase/functions/_shared/prompt-assembler.ts` — NEW, Phase 1.

### 13A.7 — Simplification: Defer `ai_teacher_modes` Table

**Reviewer finding**: The `ai_teacher_modes` table (§3.1) has no Phase 1 consumer.
`welcome_en/es` belongs in the mode prompt rows. `voice`, `tools_config`, `sort_order`,
`is_active` have no current UI or Phase 1 edge function consumer.

**Decision**: **Defer to Phase 2.** Remove `ai_teacher_modes` from Phase 1 roadmap.
Phase 1 is fully achievable with:
- `ai_teachers.persona_en/es` (new columns)
- New `ai_prompts` rows for mode instructions
- No new tables

This removes 1 migration, 1 table, and 4 RLS policies from Phase 1 scope.

### 13A.8 — Deprecate Orphaned `training-teacher` Row

The `ai_prompts` slug `training-teacher` (seeded in `20260213100003`) is currently unused
by any edge function (the training flow uses `ai_teachers` directly). After Phase 1, its
content will be split across `teacher-global-rules` and `mode-teach-me`.

**Add to Phase 1 migration**: `UPDATE ai_prompts SET is_active = false WHERE slug = 'training-teacher';`

---

## 13B. Reviewer B — Implementation Completeness Audit

**Reviewed by**: Opus Reviewer, Data Flow + Edge Function Trace

### Blockers (3) — Must fix before implementation starts

#### BLOCKER B.1 — `mode` cannot reach the edge function

`TrainingChatPanel` does NOT call `useTrainingChat` directly — it is a presentation component.
The hook lives in **`LearningSession.tsx`**, which passes `chat.sendMessage` down as the
`onSendMessage` prop (`(text: string) => void`). There is no way for `TrainingChatPanel`'s
`selectedMode` state to reach the hook as currently wired.

**Fix**: Update `onSendMessage` prop type and `sendMessage` signature:

```ts
// TrainingChatPanelProps
onSendMessage: (text: string, mode?: 'teach_me' | 'quiz_me') => void;

// use-training-chat.ts
const sendMessage = useCallback(async (text: string, mode?: 'teach_me' | 'quiz_me') => {
  // ...
  body: { question: text.trim(), mode: mode ?? 'teach_me', ... }
}, [...]);

// LearningSession.tsx — pass-through is transparent (optional param)
onSendMessage={chat.sendMessage}
```

Update all `onSendMessage(text)` call sites in `TrainingChatPanel.tsx` to
`onSendMessage(text, selectedMode ?? 'teach_me')`.

#### BLOCKER B.2 — `fetchPromptBySlug()` does not exist

Zero matches across entire codebase. **Must be created** in `_shared/prompt-helpers.ts`.
Consolidate with `assembleSystemPrompt()` into one shared file:

```ts
// supabase/functions/_shared/prompt-helpers.ts
export async function fetchPromptBySlug(
  supabase: SupabaseClient,
  slug: string,
  language: 'en' | 'es' = 'en'
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_en, prompt_es')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error(`[prompt] fetchPromptBySlug failed for slug="${slug}":`, error?.message);
    return '';
  }
  return (language === 'es' && data.prompt_es) ? data.prompt_es : data.prompt_en;
}

export function assembleSystemPrompt(opts: {
  globalRules:     string;
  persona:         string;
  modePrompt:      string;
  contentMd:       string;
  session?:        { topics_covered?: string[]; topics_total?: string[]; session_summary?: string } | null;
}): string {
  return [
    `<rules>\n${opts.globalRules}\n</rules>`,
    `<persona>\n${opts.persona}\n</persona>`,
    `<mode>\n${opts.modePrompt}\n</mode>`,
    `<content>\n${opts.contentMd}\n</content>`,
    opts.session ? `<session>\n${JSON.stringify(opts.session)}\n</session>` : '',
  ].filter(Boolean).join('\n\n');
}
```

> Note: `prompt-assembler.ts` referenced in §13A.6 — consolidate into `prompt-helpers.ts` as one file.

#### BLOCKER B.3 — Welcome check `conversation_history.length === 0` is always false

The client auto-sends "Teach me about [section]" before the edge function is called.
`conversation_history` always has 1 item (the user message just sent) on the first call.
The `=== 0` check is **never true**.

**Fix** — check for absence of any assistant message instead:
```ts
const isFirstMessage = !conversationHistory.some(m => m.role === 'assistant');
```

This is true on the very first call (no AI has responded yet) and false on all subsequent calls.

---

### High Severity

#### H.1 — `TrainingAIResponse` client interface is missing quiz_me fields

Current interface (`use-training-chat.ts`) has no `question`, `question_type`, `readiness_hint`.
These will be silently dropped on the client.

**Fix**: Extend the client interface:
```ts
interface TrainingAIResponse {
  reply: string;
  suggested_replies: string[];
  topics_update: { covered: string[]; total: string[] };
  should_suggest_quiz?: boolean;    // teach_me only
  question?: string;                 // quiz_me only
  question_type?: string;            // quiz_me only
  readiness_hint?: string;           // quiz_me only
}
```
In `sendMessage`, concatenate for rendering:
```ts
const displayContent = data.question
  ? `${data.reply}\n\n${data.question}`
  : data.reply;
```

#### H.2 — Edge function `TrainingAskRequest` + `TrainingAskResponse` interfaces not updated

Edge function (`ask/index.ts:115-137`) interfaces need explicit additions:
```ts
// TrainingAskRequest — add:
mode?: 'teach_me' | 'quiz_me';
is_first_message?: boolean;

// TrainingAskResponse — add:
question?: string;
question_type?: string;
readiness_hint?: string;
```
Response schema must be mode-conditional — use `getTrainingResponseSchema(mode)` (§13A.3).

---

### Medium Severity

#### M.1 — `MODE_SLUG_MAP` — use lookup object, not inline ternary

```ts
const MODE_SLUG_MAP: Record<string, string> = {
  teach_me:           'mode-teach-me',
  quiz_me:            'mode-practice-questions',
  practice_questions: 'mode-practice-questions',   // alias
  ask_anything:       'mode-teach-me',              // fallback
  cert_test:          'mode-cert-test',
  practice_tutor:     'mode-practice-tutor',
  live_trainer:       'mode-live-trainer',
};
const modeSlug = MODE_SLUG_MAP[mode] ?? 'mode-teach-me';
```

Note: `ask_anything` maps to `teach_me` — never fetches a non-existent slug.

#### M.2 — Teacher SELECT query must include `persona_en`, `persona_es`

Both `handleTrainingDomain` (ask/index.ts line ~823) and the training branch in
`realtime-session/index.ts` select `"slug, name, prompt_en, prompt_es"`.
After adding the new columns, update to:
```ts
.select("slug, name, prompt_en, prompt_es, persona_en, persona_es")
```
Without this, `teacher.persona_en` is always `undefined` and the fallback to `prompt_en`
fires forever — defeating the migration purpose.

#### M.3 — `parseInline()` implementation

See §13A.2 for the complete implementation. Handle `**bold**` → `<strong>` and
`_italic_` → `<em>` via regex, strip stray asterisks as fallback.

#### M.4 — `realtime-session/index.ts` also needs imports

Task 1.9 in the roadmap must explicitly include:
- Import `fetchPromptBySlug` and `assembleSystemPrompt` from `_shared/prompt-helpers.ts`
- Update `.select()` to include `persona_en, persona_es`
- Always use `MODE_SLUG_MAP['live_trainer']` (no client mode param for voice)

---

### Low Severity

#### L.1 — `tutor_sessions.mode` CHECK constraint

```sql
-- Add quiz_me to include the UI value directly:
CHECK (mode IN ('quiz_me', 'practice_questions', 'practice_tutor'))
```

#### L.2 — Welcome message source (Phase 1)

Since `ai_teacher_modes` table is deferred to Phase 2, welcome messages in Phase 1
should come from the mode prompt rows in `ai_prompts` (embedded as a `FIRST TURN ONLY:`
instruction) — NOT from a separate table. This is already handled by §13A.4.

---

## 13C. Edge Function Architect — Detailed Specifications

*These are the concrete TypeScript interfaces and data flow details from the Edge Function Architect audit.*

### 13.1 — Schema Decision: `ai_teacher_modes` table vs. Columns on `ai_teachers`

Two approaches were proposed. **Choose one before implementation:**

**Option A — Separate `ai_teacher_modes` table** *(DB Schema Architect)*
- Teacher metadata (welcome, voice, tools_config) lives in a junction table
- Mode prompts live in `ai_prompts` (by slug)
- `ai_teachers` only gets `persona_en/es` columns

**Option B — Columns directly on `ai_teachers`** *(Edge Function Architect)*
- Add `teach_mode_en/es`, `quiz_mode_en/es`, `welcome_teach_en/es`, `welcome_quiz_en/es` to `ai_teachers`
- No new table needed
- Simpler for Phase 1; harder to extend to cert_test/practice_tutor modes later

**Recommendation**: **Option A** for future-proofing. The `ai_teacher_modes` table is lightweight
(one row per teacher per mode) and keeps the modes extensible without re-altering `ai_teachers`
every time a new mode is added. Use `ai_prompts` for the mode prompt content (Layer 3).

### 13.2 — Complete TypeScript Interface: `TrainingAskRequest`

```typescript
interface TrainingAskRequest {
  domain: 'training';
  question: string;             // empty string OK when is_first_message === true
  language: 'en' | 'es';
  groupId: string;
  section_id: string;
  content_context: string;
  teacher_slug?: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  session_summary?: string;
  topics_covered?: string[];
  topics_total?: string[];

  // NEW — required
  mode: 'teach_me' | 'quiz_me';
  is_first_message: boolean;    // boolean, NOT derived from history.length (history may be trimmed)
}
```

### 13.3 — Welcome Trigger Flow (Component → Hook → Edge Function)

When the user clicks "Teach Me" or "Practice Questions", the component immediately fires a
**welcome trigger call** with an empty question — the AI responds with the mode-specific greeting.

```
User clicks "Teach Me"
  └── TrainingChatPanel: setSelectedMode('teach_me')
        └── startNewSession() clears state
              └── sendMessage('', 'teach_me')   ← empty question
                    └── ask/index.ts receives:
                          mode: 'teach_me'
                          is_first_message: true
                          question: ""   ← VALID (validation relaxed for welcome triggers)
                              └── assembles system prompt WITH welcome layer
                                    └── sends synthetic user msg to OpenAI:
                                          "[Student selected teach-me mode. Begin the session.]"
                                              └── AI responds with personalized welcome
```

**Validation change in `ask/index.ts`:**
```typescript
// Relax empty-question check for first-message welcome triggers in training domain
if (domain === 'training') {
  const isWelcomeTrigger = (body as TrainingAskRequest).is_first_message;
  if (!isWelcomeTrigger && !body.question?.trim()) {
    return errorResponse("bad_request", "Question is required", 400);
  }
}
```

**Synthetic user message (NOT persisted to conversation history):**
```typescript
const userContent = request.is_first_message && !request.question?.trim()
  ? `[Student selected ${request.mode === 'teach_me' ? 'teach-me' : 'quiz-me'} mode. Begin the session.]`
  : request.question;
```

### 13.4 — `mode` Owned by Component, Not Hook

`mode` is **not** stored in the hook's state. It is passed per-call by the component.
This allows the component to switch modes mid-session (e.g., after `should_suggest_quiz === true`).

```typescript
// use-training-chat.ts — updated sendMessage signature
const sendMessage = useCallback(
  async (text: string, mode: 'teach_me' | 'quiz_me') => {
    const isFirstMessage = messages.length === 0;
    // ... invoke ask with { question: text, mode, is_first_message: isFirstMessage }
  },
  [/* deps — mode NOT in deps, it's a parameter */]
);
```

### 13.5 — Complete `TrainingAskResponse` Schema

```typescript
interface TrainingAskResponse {
  reply: string;                          // EXISTING
  suggested_replies: string[];            // EXISTING
  topics_update: {
    covered: string[];
    total: string[];
  };
  should_suggest_quiz: boolean;           // EXISTING — true only in teach_me when all topics covered

  // NEW
  mode_active: 'teach_me' | 'quiz_me';   // Echo-back for client verification
  question_asked: boolean;               // True if AI asked student a question (for UI hint)
  confidence_signal: 'low' | 'medium' | 'high';  // AI's read on student readiness
}
```

OpenAI JSON schema must be updated to require these new fields.

### 13.6 — Additional DB Change: `course_conversations.mode` Column

```sql
ALTER TABLE course_conversations
  ADD COLUMN mode text CHECK (mode IN ('teach_me', 'quiz_me'));
```

This allows the UI to resume a session in the correct mode. On session load, read
`mode` from the last `course_conversations` row for this `section_id + user_id`.

### 13.7 — Multi-Teacher Cert Test: Single Composite Prompt

For Phase 2 cert tests that span multiple content domains, the `course-assess` edge function
uses a **single OpenAI call** with all teacher personas included in the system prompt:

```
You are conducting a certification assessment across multiple domains.

## Domain: Food Menu
[food-101 persona excerpt + quiz_mode instructions]
[food section content]

## Domain: Wine
[wine-101 persona excerpt + quiz_mode instructions]
[wine section content]

## Domain: Standards
[standards-101 persona excerpt + quiz_mode instructions]
[standards section content]

Assessment rules:
- Cover all domains naturally in conversation
- Ensure at least 2-3 questions per domain
- Grade each domain independently
```

No new `course-cert-test` edge function is needed for multi-teacher. The existing
`course-assess` function is extended to load each section's teacher.

### 13.8 — Voice Mode Param: `use-realtime-webrtc.ts`

```typescript
// TrainingChatPanel.tsx
const handleLiveTrainer = (mode: SectionMode) => {
  setSelectedMode(mode);
  voiceHook.connect({ training_mode: mode }); // Forward mode to WebRTC session
};
```

```typescript
// use-realtime-webrtc.ts — connect() forwards training_mode to realtime-session edge function
connect({ training_mode?: 'teach_me' | 'quiz_me' })
```

The voice session assembles the same 4-layer prompt but always includes the welcome layer
(voice sessions always start fresh — no conversation history).

---

## 14A. Prompt Engineering Architect — Additional Specifications

*Second deep-audit from Prompt Engineering Architect after reading actual codebase.*

### 14A.1 — Mode Extraction Strategy A vs B (Revised Recommendation)

The teacher prompts in `ai_teachers` already use exact section headers:
- `TEACH ME MODE:`
- `PRACTICE QUESTIONS MODE:`

**Strategy A (Recommended for Phase 1 — NO migration needed):**
Parse the teacher prompt at assembly time using a string split on these known headers.
The edge function extracts only the active mode's block and injects it inside `<mode>` tags.
The other mode's block is discarded. No schema change, no re-seeding.

```ts
function extractModeBlock(promptText: string, mode: 'teach_me' | 'quiz_me'): string {
  const teachHeader = 'TEACH ME MODE:';
  const quizHeader  = 'PRACTICE QUESTIONS MODE:';

  if (mode === 'teach_me') {
    const start = promptText.indexOf(teachHeader);
    const end   = promptText.indexOf(quizHeader);
    if (start === -1) return promptText; // fallback: use whole prompt
    return promptText.slice(start + teachHeader.length, end > start ? end : undefined).trim();
  } else {
    const start = promptText.indexOf(quizHeader);
    if (start === -1) return promptText;
    return promptText.slice(start + quizHeader.length).trim();
  }
}
```

**Strategy B (Future — cleaner but requires migration):**
Add `teach_mode_en/es`, `quiz_mode_en/es` columns to `ai_teachers`. Useful when adding
`cert_test` and `practice_tutor` modes that don't have headers baked into existing prompts.
Implement in Phase 2 when those modes are added.

### 14A.2 — Mode Suppression — Exact Prompt Pattern

The `<mode>` block must end with an explicit suppression section:

**TEACH ME mode — suppression:**
```
CRITICAL: You are operating in TEACH ME mode ONLY.
- Do NOT quiz, test, drill, or ask the student to demonstrate knowledge unprompted.
- Do NOT ask "how would you describe this to a guest?" unless they request practice.
- If the student says "quiz me" or "test me", respond: "Great idea! Tap the Practice
  button to switch to Practice mode — I will quiz you there."
- Your job is to EXPLAIN. End with a comprehension check question, not a performance question.
```

**PRACTICE QUESTIONS mode — suppression:**
```
CRITICAL: You are operating in PRACTICE QUESTIONS mode ONLY.
- Do NOT lecture, teach, or explain unprompted.
- Only explain when: (a) student gets something wrong, (b) student explicitly asks.
- If the student says "teach me" or "explain this", give a 2-sentence explanation then
  immediately return to a question.
- Your job is to ASSESS. Ask application questions, not recitation questions.
```

### 14A.3 — `fn_get_section_context()` Must Be Updated (Migration Required)

The Postgres function currently casts JSONB fields directly to `::text`, producing unreadable
raw JSON. This is a **content quality bug** — the AI receives data like:
```
[{"group_name":"Plating","steps":[{"instruction":"Season ribeye..."}]}]
```
instead of readable steps.

**Fix**: New migration to update `fn_get_section_context()` with PL/pgSQL loops:

```sql
-- Flatten assembly_procedure JSONB to numbered steps
v_assembly_text := '';
IF v_boh.assembly_procedure IS NOT NULL THEN
  FOR v_group IN SELECT * FROM jsonb_array_elements(v_boh.assembly_procedure) LOOP
    v_assembly_text := v_assembly_text
      || E'\n  ' || COALESCE(v_group.value->>'group_name', 'Steps') || ':';
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_group.value->'steps')
                                WITH ORDINALITY LOOP
      v_assembly_text := v_assembly_text
        || E'\n    ' || v_step.ordinality || '. '
        || (v_step.value->>'instruction');
    END LOOP;
  END LOOP;
END IF;
```

Apply the same pattern to `components` (ingredient list) and `prep_recipes.procedure`.
**Also remove the `LEFT(..., 500)` truncation** — it was a legacy safety guard that actively
harms teaching by cutting off mid-step. Use 4000 chars limit at most.

This is a **required migration** for Phase 1. Without it, the AI teaches from garbled data.

### 14A.4 — Reply Format: Strip Markdown, Don't Teach It

Mode prompt instruction (add to `<mode>` block):
```
OUTPUT FORMAT: Plain text only. You may use:
  - Numbered lists (1. 2. 3.) for sequential steps
  - Dashes (- item) for unordered lists
  - Blank lines between paragraphs

Do NOT use: bold (**text**), italic (*text*), headers (## text), code blocks.
The interface renders plain text. Markdown will show as literal symbols.
```

`ChatBubble.tsx` should also strip stray `**` as a safety net (AI occasionally ignores
formatting rules). Simple regex: `text.replace(/\*\*(.*?)\*\*/g, '$1')`.

### 14A.5 — Voice Mode Prompt Constraints

Voice (`realtime-session`) has different requirements:
- **No JSON schema output** — Realtime API does not support `response_format`
- **No `suggested_replies` or `topics_update`** — text-mode-only UI features
- **Content bundle**: Apply ~3000 char limit (Realtime instruction window is smaller)
- **Shorter mode instructions** — voice is fluid; detailed phase instructions are less relevant

Voice `<mode>` block should be:
```
You are in a live voice training session. Keep responses under 30 seconds of speech
(~3-4 sentences). Be conversational — speak like a person, not a manual.

TEACH ME: Explain one concept at a time. After explaining, ask a short check question.
PRACTICE: Ask one question. Listen. Give brief feedback. Ask the next question.
```

### 14A.6 — `course-tutor` Also Needs 4-Layer Treatment

The `course-tutor/index.ts` edge function and its `practice-tutor` prompt in `ai_prompts`
also use a flat concatenation. Add to Phase 1 scope:
- Restructure `practice-tutor` prompt to extract persona vs mode vs behavioral rules
- Update `course-tutor/index.ts` to assemble using XML-tagged layers

---

## 14. Updated Files Reference (Complete)

| File | Change | Phase |
|---|---|---|
| `supabase/functions/ask/index.ts` | 4-layer assembly, `mode` + `is_first_message` params, updated response schema | 1 |
| `supabase/functions/_shared/content-formatter.ts` | **NEW** — flatten section content to markdown | 1 |
| `supabase/functions/realtime-session/index.ts` | 4-layer assembly, forward `training_mode` | 1 |
| `src/hooks/use-training-chat.ts` | Add `mode` + `is_first_message` to payload, update `sendMessage` signature | 1 |
| `src/components/training/TrainingChatPanel.tsx` | Wire `mode` to hook, fire welcome trigger on mode select | 1 |
| `src/hooks/use-realtime-webrtc.ts` | Forward `training_mode` in session request | 1 |
| `src/components/training/ChatBubble.tsx` | Add `renderMarkdownLite()` | 1 |
| `supabase/migrations/…_ai_teacher_modes.sql` | `ai_teacher_modes` table + `ai_teachers.persona_en/es` | 1 |
| `supabase/migrations/…_mode_prompts_seed.sql` | Seed 4+ mode rows in `ai_prompts` | 1 |
| `supabase/migrations/…_tutor_sessions_mode.sql` | `tutor_sessions.mode` column | 1 |
| `supabase/migrations/…_course_conversations_mode.sql` | `course_conversations.mode` column | 1 |
| `supabase/migrations/…_ai_teachers_persona_migrate.sql` | Populate `persona_en/es`, deprecate `prompt_en/es` | 1 |
| `supabase/functions/course-tutor/index.ts` | 4-layer prompt assembly, mode-specific behavior | 1 |
| `supabase/migrations/…_fn_get_section_context.sql` | Flatten JSONB assembly/components/procedure to readable text | 1 |
| `supabase/functions/course-assess/index.ts` | Extend for multi-teacher composite prompt | 2 |
| `src/components/training/CertTestUI.tsx` | **NEW** — cert test client UI | 2 |

---

*Plan authored by 4-agent design team: DB Schema Architect, Prompt Engineering Architect, Edge Function Architect, Future-proofing Architect.*
*Reviewed and synthesized: 2026-03-03*
