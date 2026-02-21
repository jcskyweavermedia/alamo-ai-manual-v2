# Audit Fix Plan — Conversational Assessment

> Addresses all issues found by the 5-reviewer audit of `interactive-assessment-plan.md`.
> Organized into phases that must be completed **before and during** the assessment build.

---

## Issue Inventory

**Source audits**: UX/UI, Backend Developer, Technical Architect, Database Expert, Devil's Advocate

| # | Issue | Source | Severity | Phase |
|---|-------|--------|----------|-------|
| 1 | No `_shared/` module layer — 140+ lines duplicated across 3+ edge functions | Architect | Critical | 0 |
| 2 | `ai_prompts.domain` CHECK rejects `'training'` — INSERT will crash | Database | Critical | 1 |
| 3 | `quiz_attempts.status` CHECK rejects `'awaiting_evaluation'` — UPDATE will crash | Database | Critical | 1 |
| 4 | `preloaded_questions` sent from client — security hole + trust boundary violation | Backend, Architect | Critical | 2 |
| 5 | No structured output JSON schema defined for `course-assess` | Backend | Critical | 2 |
| 6 | No server-side validation/clamping of AI response fields | Backend | Critical | 2 |
| 7 | Race condition on JSONB transcript append | Backend, Architect | Critical | 2 |
| 8 | No voice input — restaurant staff must type 150+ words on phone | UX | Critical | 3 |
| 9 | No user-controlled exit — AI decides when to stop, user is trapped | UX | Critical | 3 |
| 10 | Keyboard occlusion destroys chat viewport on mobile | UX | Critical | 3 |
| 11 | CompetencyBar live score creates anxiety and gaming behavior | UX | Major | 3 |
| 12 | No onboarding for transition from flashcards to chat | UX | Major | 3 |
| 13 | Assessment duration unpredictable, 3-5x longer than flashcards | UX | Major | 3 |
| 14 | AssessmentResults too information-dense for mobile | UX | Major | 3 |
| 15 | No handling of slow/failed AI responses during conversation | UX | Major | 3 |
| 16 | Token budget not analyzed — context window and cost risk | Backend | Major | 2 |
| 17 | Evaluation transcript could exceed practical limits | Backend | Major | 2 |
| 18 | Usage quota check positioned after OpenAI call (should be before) | Backend | Major | 2 |
| 19 | `conversation_evaluation` schema not defined for `course-evaluate` | Backend | Major | 2 |
| 20 | No auth verification on attempt ownership for continuing conversations | Backend | Major | 2 |
| 21 | 12+ state variables need `useReducer`, not `useState` | Architect | Major | 3 |
| 22 | No server-side hard limit on conversation length | Architect | Major | 2 |
| 23 | Missing `enrollment_id` in `course-assess` DB operations | Architect | Major | 2 |
| 24 | Auth method inconsistency (`getClaims` vs `getUser`) | Architect | Major | 2 |
| 25 | No partial index for `quiz_mode` queries | Database | Major | 1 |
| 26 | `evaluations.eval_type` CHECK may need expansion | Database | Major | 1 |
| 27 | `coaching_dependency` queryability not decided | Database | Major | 1 |
| 28 | JSONB transcript append performance at scale | Database, Architect | Major | 1 |
| 29 | Unbounded transcript in JSONB — no retention policy | Database | Minor | 1 |
| 30 | Empty string first message pattern is ambiguous | Backend | Minor | 2 |
| 31 | `internal_notes` field generated but never persisted | Backend | Minor | 2 |
| 32 | `TEXT[]` should be `UUID[]` for `questions_covered` | Database | Minor | 1 |
| 33 | `competency_score` lacks range constraint, should be SMALLINT | Database | Minor | 1 |
| 34 | Counter columns lack non-negative constraints | Database | Minor | 1 |
| 35 | ALTER TABLE idempotency — separate ADD COLUMN from ADD CONSTRAINT | Database | Minor | 1 |
| 36 | No indexing for new columns | Database | Minor | 1 |
| 37 | Missing error phase in hook lifecycle | Architect | Minor | 3 |
| 38 | CompetencyBar and ReadinessBar are near-identical — extract shared component | Architect | Minor | 3 |
| 39 | AssessmentResults and QuizResultsView share ~70% layout | Architect | Minor | 3 |
| 40 | `quiz_attempt_answers` empty for conversation mode — document behavior | Architect | Minor | 2 |
| 41 | Spanish accent marks missing ("Comprension" → "Comprensión") | Architect | Minor | 3 |
| 42 | No CORS headers mentioned for new function | Backend | Minor | 2 |
| 43 | No logging strategy specified | Backend | Minor | 2 |
| 44 | No dark mode variants for new color values | UX | Minor | 3 |
| 45 | Timestamp noise on every chat bubble | UX | Minor | 3 |
| 46 | No visual distinction between "assessing" and "teaching" messages | UX | Minor | 3 |
| 47 | Topics denominator changes if AI adds questions | UX | Minor | 3 |
| 48 | No feature flag / A/B testing path | Devil's Advocate | Major | 1 |
| 49 | No fallback when OpenAI is down | Devil's Advocate | Major | 2 |
| 50 | Scoring non-determinism — different paths for identical users | Devil's Advocate | Major | 2 |
| 51 | Overlap with `course-tutor` — users may confuse the two | Devil's Advocate | Major | 3 |
| 52 | No fraud prevention / identity verification | Devil's Advocate | Minor | Future |
| 53 | AI hallucination risk during teaching moments | Devil's Advocate | Major | 2 |
| 54 | No data migration for existing `quiz_attempts` rows | Devil's Advocate | Minor | 1 |
| 55 | Offline/connectivity — each exchange needs round-trip | Devil's Advocate | Minor | 3 |
| 56 | Cost increase (3-9x) and quota impact not addressed | Devil's Advocate | Major | 2 |

---

## Phase 0: Foundation — Extract Shared Edge Function Modules

> **Do this FIRST, before writing any assessment code.**
> Pays down duplication debt and sets up clean infrastructure for `course-assess`.

### 0.1 Create `_shared/` directory

```
supabase/functions/_shared/
  ├── cors.ts           — CORS headers, jsonResponse(), errorResponse()
  ├── auth.ts           — JWT verification helper (getClaims + getUser wrappers)
  ├── supabase.ts       — createAnonClient(), createServiceClient() helpers
  ├── content.ts        — All content serializers + SOURCE_TABLE + loadSectionContent()
  ├── openai.ts         — callOpenAI() wrapper with structured output, error handling, retry
  └── usage.ts          — checkUsage(), incrementUsage() helpers
```

**Issues fixed**: #1

### 0.2 Extract from existing functions

| Module | Extracted From | Lines Saved Per Function |
|--------|---------------|------------------------|
| `cors.ts` | All 12 functions | ~12 lines |
| `auth.ts` | `course-tutor`, `course-evaluate`, `course-quiz-generate` | ~15 lines |
| `supabase.ts` | All functions that create clients | ~10 lines |
| `content.ts` | `course-tutor`, `course-quiz-generate` (richer version) | ~65 lines |
| `openai.ts` | `course-tutor`, `course-evaluate`, `course-quiz-generate` | ~25 lines |
| `usage.ts` | `course-tutor`, `course-quiz-generate` | ~10 lines |

**Import pattern** (Deno supports relative imports):
```typescript
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";
import { loadSectionContent } from "../_shared/content.ts";
```

### 0.3 Resolve serializer drift

The architect found that `course-tutor`'s `serializeDish()` is simpler than `course-quiz-generate`'s version (omits `plate_type`, `preparation_notes`, `upsell_notes`). The `_shared/content.ts` must use the **richer** serializers from `course-quiz-generate` as the canonical versions. Both functions then get the same, more complete content.

### 0.4 Refactor existing functions

After extraction, update these 3 functions to import from `_shared/`:
- `course-tutor/index.ts`
- `course-evaluate/index.ts`
- `course-quiz-generate/index.ts`

**Deploy all 3 and verify they still work before proceeding.**

### 0.5 Standardize auth method

**Issue #24**: `course-tutor` uses `getClaims()` (fast, no network), `course-evaluate` uses `getUser()` (validates token not revoked).

**Decision**: Use `getUser()` for all **write** operations (assessment, evaluation, quiz generation) and `getClaims()` for **read-only** operations (content loading). The `auth.ts` module exports both, with clear JSDoc on when to use which.

For `course-assess` specifically: use `getUser()` since it writes to `quiz_attempts` and directly affects scores.

---

## Phase 1: Database Migration ✅ COMPLETED

> **Two migration files** addressing all schema issues + 5-agent audit findings.
> Pushed to Supabase cloud on 2026-02-18.
>
> **Migrations applied:**
> - `20260218170452_conversational_assessment_phase1.sql` — main migration
> - `20260218170808_fix_conversation_messages_rls_initplan.sql` — RLS performance fix
>
> **Key changes from 5-agent audit (vs original plan):**
> - **C1**: Replaced JSONB `conversation_transcript` column with normalized `conversation_messages` child table (avoids MVCC bloat)
> - **C2**: Enabled `pg_cron` extension + scheduled daily cleanup at 2 AM UTC
> - **C3**: Cleanup function includes full existing body (not placeholder)
> - **M1**: `transcript_expires_at DEFAULT NULL` (not `now() + 90 days`) — classic rows unaffected
> - **M2**: Added `quiz_mode_changed_at` timestamp to `course_sections` for race condition tracking
> - **M3**: `ON CONFLICT` upsert includes all mutable columns (category, domain, is_active)
> - **M4**: Added partial index on `transcript_expires_at` for cleanup queries
> - **M5**: Standardized naming to `quiz_mode` everywhere (not `assessment_mode`)
> - **M7**: Lean `quiz_attempts` table — no JSONB blob, conversation data in child table
> - **RLS**: InitPlan-optimized policies using `(SELECT auth.uid())` pattern

### 1.1 Expand CHECK constraints

```sql
-- Fix #3: quiz_attempts.status now allows 'awaiting_evaluation'
-- CHECK (status IN ('in_progress', 'completed', 'abandoned', 'awaiting_evaluation'))

-- Fix #26: evaluations.eval_type — reuse 'quiz' for conversation assessments
-- (No change needed — conversation assessments use eval_type='quiz')
-- Conversation vs classic distinguished by quiz_attempts.quiz_mode, not eval_type
```

### 1.2 Add columns to `quiz_attempts` (lean — no JSONB)

New columns added:
- `quiz_mode text NOT NULL DEFAULT 'classic'` — CHECK: classic | conversation (M5)
- `questions_covered uuid[] DEFAULT '{}'` — UUID[] not TEXT[] (#32)
- `competency_score smallint DEFAULT 0` — range 0-100 (#33)
- `teaching_moments smallint DEFAULT 0` — non-negative (#34)
- `additional_questions_asked smallint DEFAULT 0` — non-negative (#34)
- `transcript_expires_at timestamptz DEFAULT NULL` — NULL for classic rows (M1)

**NOT added** (per audit C1/M7): ~~conversation_transcript JSONB~~ — replaced by child table

### 1.3 Create `conversation_messages` child table (C1)

```sql
-- Normalized child table — one row per message
-- Avoids MVCC bloat from JSONB append pattern
CREATE TABLE conversation_messages (
  id uuid PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb,           -- readiness_score, internal_notes, teaching_moment flag
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index: load messages by attempt
CREATE INDEX idx_conversation_messages_attempt ON conversation_messages(attempt_id, created_at);

-- RLS: 3 policies (SELECT own, SELECT group for managers, INSERT own)
-- All use (SELECT auth.uid()) InitPlan pattern for performance
-- No UPDATE or DELETE — messages are append-only, immutable
```

### 1.4 Add feature flag to `course_sections`

```sql
-- Fix #48 + M2: Per-section quiz mode + race condition tracking
ALTER TABLE course_sections ADD COLUMN quiz_mode text NOT NULL DEFAULT 'classic';
  -- CHECK: classic | conversation
ALTER TABLE course_sections ADD COLUMN quiz_mode_changed_at timestamptz;
  -- Set when quiz_mode changes; used to detect stranded in-progress attempts
```

### 1.5 Backfill + indexes

```sql
-- Fix #54: All existing rows explicitly set to 'classic'
UPDATE quiz_attempts SET quiz_mode = 'classic' WHERE quiz_mode IS NULL;

-- Fix #25, #36: Partial composite index for conversation access pattern
CREATE INDEX idx_quiz_attempts_conversation ON quiz_attempts(user_id, section_id, status)
  WHERE quiz_mode = 'conversation';

-- M4: Partial index for cleanup queries
CREATE INDEX idx_quiz_attempts_transcript_expires ON quiz_attempts(transcript_expires_at)
  WHERE transcript_expires_at IS NOT NULL;
```

### 1.6 Seed AI prompts

```sql
-- Fix #2: category='system', domain=NULL (satisfies all CHECK constraints)
-- M3: ON CONFLICT updates ALL mutable columns (prompt_en, prompt_es, category, domain, is_active)
-- Slugs: 'assessment-conductor', 'conversation-evaluator'
-- Full bilingual prompt text included (EN ~1100 chars, ES ~1250 chars each)
```

### 1.7 Cleanup function + pg_cron (C2, C3)

```sql
-- C2: pg_cron extension enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- C3: Full existing function body preserved + new conversation message cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_training_data() ...
  -- [EXISTING] Delete expired course_conversations
  -- [EXISTING] Redact expired voice transcriptions
  -- [EXISTING] Expire rollouts
  -- [NEW] Delete expired conversation_messages
  -- [NEW] Clear transcript_expires_at marker

-- Scheduled daily at 2 AM UTC
SELECT cron.schedule('cleanup-training-data', '0 2 * * *', ...);
```

### 1.8 Documentation comments

```sql
COMMENT ON COLUMN quiz_attempts.quiz_mode IS '...';
COMMENT ON TABLE conversation_messages IS '...';
COMMENT ON COLUMN quiz_attempts.transcript_expires_at IS '...';
COMMENT ON COLUMN course_sections.quiz_mode IS '...';
COMMENT ON COLUMN course_sections.quiz_mode_changed_at IS '...';
```

---

## Phase 2: Edge Functions — `course-assess` + `course-evaluate` Extension ✅ COMPLETED

> Built on the `_shared/` modules from Phase 0.
> Every fix in this phase relates to the server-side conversation engine.
>
> **Implementation**: Both functions built and deployed. 5-agent audit completed.
> **Audit fixes applied**:
> - C1: Fixed quiz_questions query (`is_active` not `status`, removed `sort_order`) — 3 locations
> - C2: Added UUID descriptions to schema + explicit instruction in system prompt
> - C3: Removed `in_progress` from conversation_evaluation status check
> - M1: Added error handling on all DB writes (conversation_messages + quiz_attempts)
> - M2: Increased maxTokens from 600 to 1000
> - M3: Fixed additional_questions_asked counter logic (no longer compares text to UUIDs)
> - M4: Added message length validation (4000 char max)
> - M5: Added enrollment_id ownership verification
> - M6: Aligned competency level threshold to 80 for "proficient" in fallback
> - m1: Added guard against concurrent in-progress assessments for same section
> - Also: cumulative questions_covered merging, topics_assessed stored in metadata

### 2.1 `course-assess` — Request contract (revised)

```typescript
// Fix #4: NO preloaded_questions from client. Server loads them.
// Fix #30: Use explicit action field instead of empty string
interface AssessmentRequest {
  action: 'start' | 'message';         // Fix #30: explicit, not empty string
  section_id: string;                   // Which section
  enrollment_id: string;                // Fix #23: always required
  language: 'en' | 'es';
  groupId: string;
  message?: string;                     // Only for action='message'
  attempt_id?: string;                  // Only for action='message' (continuing)
}
```

### 2.2 `course-assess` — Response contract (revised)

```typescript
interface AssessmentResponse {
  reply: string;
  topics_covered: number;               // Count, not IDs (client-safe)
  topics_total: number;                  // From preloaded question count
  teaching_moment: boolean;
  wrap_up: boolean;
  attempt_id: string;
  // NOTE: competency_score is tracked server-side only (Fix #11)
  // NOTE: questions_covered IDs are server-side only (no leak)
  // NOTE: internal_notes persisted to transcript metadata (Fix #31)
}
```

### 2.3 `course-assess` — Internal flow (revised)

```
1. CORS + OPTIONS HANDLING (from _shared/cors.ts)
   Fix #42: Uses shared CORS module

2. AUTHENTICATE
   Fix #24: Use getUser() (write operation, validates token not revoked)
   Get userId

3. CHECK USAGE QUOTA
   Fix #18: Check BEFORE OpenAI call, not after
   Call get_user_usage() RPC
   If exceeded → return 429 immediately (no wasted API call)

4. LOAD CONTEXT
   If action='start':
     a) Load or generate questions from quiz_questions table
        Fix #4: Server-side only — never accept from client
        If no questions exist, call quiz generation logic internally
     b) Create quiz_attempt with quiz_mode='conversation', enrollment_id
        Fix #23: enrollment_id always persisted
     c) Load section content via _shared/content.ts
        Fix #0.3: Uses canonical richer serializers
   If action='message':
     a) Load attempt by attempt_id
        Fix #20: Verify user_id matches authenticated user
        Fix #20: Verify status IN ('in_progress') — reject completed/abandoned
        Fix #20: Verify quiz_mode = 'conversation'
     b) Check conversation length
        Fix #22: If transcript >= 20 exchanges (40 messages), force wrap_up
        Return AI message: "We've covered a lot — let me put together your evaluation!"
     c) Load section content + preloaded questions (with correct answers)
     d) Extract conversation history (last 20 messages, not 30)
        Fix #16: Reduces token cost by ~1,300 tokens vs 30-message window

5. BUILD SYSTEM PROMPT
   Fetch assessment-conductor from ai_prompts (domain=NULL)
   Inject questions JSON (with correct answers — server-side only)
   Inject serialized content
   Fix #53: Add hallucination guardrail to prompt:
     "CRITICAL: Only reference facts from the TRAINING CONTENT above.
      Never invent menu items, temperatures, prices, or procedures.
      If unsure, ask the trainee rather than stating potentially incorrect info."
   If continuing: include conversation history

6. CALL OPENAI
   Fix #5: Use explicit assessmentResponseSchema (defined below)
   Model: gpt-4o-mini, temperature: 0.7, max_tokens: 600
   Structured output with strict: true

7. VALIDATE AI RESPONSE
   Fix #6: Post-parse validation:
   - Clamp competency_score to 0-100
   - Filter questions_covered to only IDs present in preloaded set
   - Reject wrap_up=true if fewer than 3 questions covered (minimum assessment)
   - Default booleans to false if missing
   - If parse fails entirely: return generic "Let's continue" reply, don't crash

8. PERSIST — ATOMIC TRANSCRIPT APPEND
   Fix #7: Use PostgreSQL jsonb_concat instead of load-modify-write:
     UPDATE quiz_attempts SET
       competency_score = $score,
       questions_covered = $covered_ids,
       teaching_moments = teaching_moments + (CASE WHEN $teaching THEN 1 ELSE 0 END),
       additional_questions_asked = additional_questions_asked + $additional
     WHERE id = $attempt_id AND user_id = $user_id;
   -- Insert messages into conversation_messages table (C1):
   INSERT INTO conversation_messages (attempt_id, role, content, metadata) VALUES ...
   Fix #31: Persist internal_notes in message metadata jsonb column
   If wrap_up=true: set status='awaiting_evaluation'

9. INCREMENT USAGE
   Call increment_usage() RPC (after successful AI call)

10. RETURN CLIENT-SAFE RESPONSE
    Fix #4: No correct answers, no question IDs, no internal_notes
    Only: reply, topics_covered (count), topics_total, teaching_moment, wrap_up, attempt_id

11. LOGGING
    Fix #43: Use [course-assess] prefix on all console.log/error calls
    Key log points: request received, context loaded, OpenAI called, transcript persisted, wrap-up triggered
```

### 2.4 Define `assessmentResponseSchema`

```typescript
// Fix #5: Explicit structured output schema (strict: true)
const assessmentResponseSchema = {
  type: "object" as const,
  properties: {
    reply: { type: "string" as const },
    competency_score: { type: "number" as const },
    questions_covered: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    topics_assessed: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    needs_more_evaluation: { type: "boolean" as const },
    teaching_moment: { type: "boolean" as const },
    wrap_up: { type: "boolean" as const },
    internal_notes: { type: "string" as const },
  },
  required: [
    "reply", "competency_score", "questions_covered", "topics_assessed",
    "needs_more_evaluation", "teaching_moment", "wrap_up", "internal_notes",
  ],
  additionalProperties: false,
};
```

### 2.5 Define `conversationEvalSchema`

```typescript
// Fix #19: Explicit schema for conversation_evaluation action
const conversationEvalSchema = {
  type: "object" as const,
  properties: {
    score: { type: "number" as const },
    competency_level: {
      type: "string" as const,
      enum: ["novice", "competent", "proficient", "expert"],
    },
    conversation_summary: { type: "string" as const },
    student_feedback: {
      type: "object" as const,
      properties: {
        strengths: { type: "array" as const, items: { type: "string" as const } },
        areas_for_improvement: { type: "array" as const, items: { type: "string" as const } },
        encouragement: { type: "string" as const },
      },
      required: ["strengths", "areas_for_improvement", "encouragement"],
      additionalProperties: false,
    },
    manager_feedback: {
      type: "object" as const,
      properties: {
        competency_gaps: { type: "array" as const, items: { type: "string" as const } },
        recommended_actions: { type: "array" as const, items: { type: "string" as const } },
        risk_level: { type: "string" as const, enum: ["low", "medium", "high"] },
        coaching_dependency: { type: "string" as const, enum: ["low", "medium", "high"] },
        conversation_notes: { type: "string" as const },
      },
      required: ["competency_gaps", "recommended_actions", "risk_level", "coaching_dependency", "conversation_notes"],
      additionalProperties: false,
    },
  },
  required: ["score", "competency_level", "conversation_summary", "student_feedback", "manager_feedback"],
  additionalProperties: false,
};
```

### 2.6 `course-evaluate` extension — `conversation_evaluation` action

```
Fix #17: Transcript truncation for large conversations
  If transcript > 40 messages, summarize older messages before sending to evaluator
  Keep last 20 messages verbatim, summarize earlier ones as "[Earlier: discussed X, Y, Z]"

Fix #49: Graceful degradation when OpenAI is down
  If OpenAI call fails: return score based on server-side competency_score
  (the running estimate from course-assess), with minimal feedback:
  { score: attempt.competency_score, passed: score >= 70, competency_level: derived,
    student_feedback: { strengths: ["Assessment completed"], areas_for_improvement: [],
    encouragement: "Your trainer was unable to generate detailed feedback. Score based on conversation." }}
  This matches the existing pattern in handleSectionEvaluation (lines 665-702 of course-evaluate)

Fix #50: Scoring consistency documentation
  Add to evaluation prompt: "Score the trainee's DEMONSTRATED KNOWLEDGE, not the conversation path.
  Two trainees who demonstrate the same understanding should receive the same score,
  regardless of how many questions were asked or which path the conversation took."

Evaluation max_tokens: 1500 (Fix #17: increased from default to handle richer schema)
Temperature: 0.3 (deterministic grading)
```

### 2.7 Token budget analysis

```
Fix #16: Documented token budget per exchange

SYSTEM PROMPT:
  assessment-conductor prompt text:      ~500 tokens
  Preloaded questions (5 × ~150 each):   ~750 tokens
  Section content (capped at 4000 chars): ~1,200 tokens
  Subtotal:                               ~2,450 tokens

CONVERSATION HISTORY (20-message window):
  10 user messages × ~30 tokens:          ~300 tokens
  10 AI messages × ~100 tokens:           ~1,000 tokens
  Subtotal:                               ~1,300 tokens

CURRENT USER MESSAGE:                     ~30 tokens

TOTAL INPUT per exchange:                 ~3,780 tokens
AI OUTPUT (max_tokens: 600):              ~400 tokens average

COST per exchange: ~$0.0006 (input) + ~$0.0002 (output) = ~$0.0008
COST per assessment (12 exchanges avg):   ~$0.01
COST for evaluation call:                 ~$0.002
TOTAL per assessment:                     ~$0.012

Fix #56: Quota impact
  12 exchanges + 1 evaluation = 13 API calls per assessment
  Admin quota: 100 daily / 2000 monthly
  One assessment = 13% of daily quota
  Recommendation: Consider a separate "assessment_calls" counter or increase
  daily limit for assessments. At minimum, warn user before starting:
  "This assessment uses approximately 13 of your daily AI questions."
```

---

## Phase 3: Frontend — Hook, UI Components, Mobile Fixes

> Every fix in this phase addresses UX/UI issues and frontend architecture.

### 3.1 `use-assessment-chat.ts` — Use `useReducer`

```typescript
// Fix #21: Discriminated union state machine with useReducer

type AssessmentPhase =
  | { phase: 'loading' }
  | { phase: 'generating' }
  | { phase: 'onboarding' }                // Fix #12: Show intro screen
  | { phase: 'conversing'; messages: AssessmentMessage[]; topicsCovered: number;
      topicsTotal: number; teachingMoments: number; attemptId: string }
  | { phase: 'wrapping_up'; messages: AssessmentMessage[]; topicsCovered: number;
      topicsTotal: number; attemptId: string }
  | { phase: 'evaluating'; messages: AssessmentMessage[]; attemptId: string }
  | { phase: 'results'; results: AssessmentResults }
  | { phase: 'error'; error: string; previousPhase: string }  // Fix #37

type AssessmentAction =
  | { type: 'START_GENERATING' }
  | { type: 'QUESTIONS_READY'; topicsTotal: number }
  | { type: 'BEGIN_CONVERSATION'; messages: AssessmentMessage[]; attemptId: string; topicsTotal: number }
  | { type: 'SEND_MESSAGE'; message: AssessmentMessage }
  | { type: 'RECEIVE_REPLY'; reply: AssessmentMessage; topicsCovered: number;
      teachingMoment: boolean; wrapUp: boolean }
  | { type: 'REQUEST_EVALUATION' }
  | { type: 'EVALUATION_COMPLETE'; results: AssessmentResults }
  | { type: 'ERROR'; error: string }
  | { type: 'RETRY' }
  | { type: 'USER_END_EARLY' }             // Fix #9: User-triggered wrap-up
```

Each action transition is atomic — no risk of inconsistent state.

### 3.2 Voice input integration

```
Fix #8: Mic button in AssessmentChatPanel input bar

Existing infrastructure (already built):
  - src/hooks/use-voice-recording.ts (or similar) — handles MediaRecorder
  - supabase/functions/transcribe/index.ts — Whisper transcription
  - src/components/training/VoiceConsentDialog.tsx — permission dialog

Implementation:
  Input bar layout: [🎤 Mic] [Text input...] [Send ➤]

  Mic flow:
  1. Tap mic → VoiceConsentDialog (first time only, consent persisted)
  2. Recording indicator replaces input bar: [●  Recording... 0:05] [Stop ■]
  3. On stop → show transcription loading: "Transcribing..."
  4. Transcription populates text input field
  5. User reviews and taps Send (or edits first)

  This is voice-to-text, not a separate mode. User always reviews before sending.
  Costs 1 additional API call (Whisper) per voice message.
```

### 3.3 User-controlled exit

```
Fix #9: "End Assessment" button + resume support

Header area (always visible during 'conversing' phase):
  [← Back]  Section Quiz  [...End Assessment]

"End Assessment" flow:
  1. Tap "End Assessment" (or ⋯ menu → "End Assessment")
  2. Confirmation dialog:
     "End the assessment now?
      Your trainer will evaluate based on what you've covered so far.
      You've covered {X} of {Y} topics."
     [Cancel] [End & Evaluate]
  3. On confirm: dispatch USER_END_EARLY action
  4. Send special message to course-assess: { action: 'message', message: '__WRAP_UP__' }
     Server recognizes this sentinel and forces wrap_up=true in the AI response
  5. AI's final message renders → "View My Assessment" button appears

Resume support:
  If user navigates away without ending (accidental close, phone call, etc.):
  - Attempt stays 'in_progress' in DB with full transcript
  - When user returns to quiz page for this section:
    Check for in-progress conversation attempt
    If found: "You have an assessment in progress. Resume or start over?"
    [Resume] loads transcript into state, continues conversation
    [Start Over] abandons old attempt (status='abandoned'), creates new one
```

### 3.4 Keyboard occlusion fix

```
Fix #10: Mobile viewport handling

1. Use CSS env() for safe area:
   padding-bottom: env(safe-area-inset-bottom);

2. Use visualViewport API to detect keyboard:
   useEffect(() => {
     const vv = window.visualViewport;
     if (!vv) return;
     const onResize = () => {
       // When keyboard opens, visualViewport.height shrinks
       // Adjust chat container max-height accordingly
       const keyboardHeight = window.innerHeight - vv.height;
       chatRef.current?.style.setProperty('--kb-height', `${keyboardHeight}px`);
     };
     vv.addEventListener('resize', onResize);
     return () => vv.removeEventListener('resize', onResize);
   }, []);

3. Chat container CSS:
   height: calc(100dvh - var(--header-height) - var(--progress-height) - var(--input-height) - var(--kb-height, 0px));

4. When input is focused: auto-scroll to show AI's last message above the input
   (not just on new message, but on focus)

5. Collapse TopicBar to single-line minimal state when keyboard is open:
   "Topics: 3/5" (no secondary label, no animation)
```

### 3.5 Replace CompetencyBar with TopicProgressBar

```
Fix #11: No live score display — show only forward progress

TopicProgressBar (replaces CompetencyBar):
  ┌──────────────────────────────────────────┐
  │  ● ● ● ○ ○   Topics: 3 of 5 covered    │
  └──────────────────────────────────────────┘

  - Shows filled/unfilled dots for each preloaded question topic
  - Dots only fill (never unfill) — purely forward progress
  - Fix #47: Denominator is fixed to preloaded question count
    Additional AI questions do NOT increase the dot count
  - No numeric score visible during conversation
  - Actual competency_score revealed only on results screen
  - Reuse pattern from QuizProgressBar (dots) but simpler (no red/green, just filled/empty)

Fix #38: If ReadinessBar and TopicProgressBar share structure, extract a shared
  <ProgressDots count={5} filled={3} /> primitive component
```

### 3.6 Onboarding interstitial

```
Fix #12: Brief intro screen before conversation starts

Phase: 'onboarding' (new phase between 'generating' and 'conversing')

┌─────────────────────────────────────────┐
│                                         │
│         💬  Conversation Quiz           │
│                                         │
│  Your trainer will ask you questions    │
│  about [Section Title] through a        │
│  conversation. Answer in your own       │
│  words — there are no multiple choice   │
│  options.                               │
│                                         │
│  🎤 You can type or use the mic         │
│  ⏱ Usually takes 5-8 minutes            │
│  📊 Uses ~13 AI questions               │
│                                         │
│           [Start Conversation]          │
│                                         │
└─────────────────────────────────────────┘

Fix #13: Duration estimate shown here ("5-8 minutes")
Fix #56: Quota cost shown here ("Uses ~13 AI questions")
```

### 3.7 Assessment duration management

```
Fix #13: Firm caps and progress indicators

Server-side:
  - Hard cap: 20 exchanges (Fix #22). After 20 user messages, server forces wrap_up.
  - Minimum: 3 questions must be covered before wrap_up is allowed (Fix #6 validation)
  - Additional AI questions capped at 2 beyond preloaded set

Client-side:
  - TopicProgressBar shows forward progress (dots filling in)
  - After 15 exchanges: show subtle "Almost done..." indicator
  - After 18 exchanges (approaching cap): "Wrapping up soon..."
```

### 3.8 AssessmentResults — mobile-optimized

```
Fix #14: Simplified for mobile, remove manager-only data from student view

┌─────────────────────────────────────────┐
│           Score Ring: 82%               │
│            ✓ PASSED                     │
│         Level: Proficient               │
├─────────────────────────────────────────┤
│                                         │
│  "You demonstrated strong knowledge     │  ← conversation_summary
│   of wine pairings and showed good      │
│   instincts on guest scenarios."        │
│                                         │
│  Strengths                              │
│  ✓ Confident wine pairing knowledge     │
│  ✓ Good guest interaction instincts     │
│                                         │
│  Areas to Improve                       │
│  → Review rare varietals                │
│  → Practice fault detection language    │
│                                         │
│  "Great session! You clearly know..."   │  ← encouragement
│                                         │
│  [Continue]    [Practice Again]         │
└─────────────────────────────────────────┘

Removed from student view:
  - "Coaching Summary" section (teaching moments count, additional questions)
    → Moved to manager_feedback in DB only
  - "Coaching dependency" indicator
    → Manager-only in evaluations table

Fix #39: Extend existing QuizResultsView with optional conversationSummary prop
  rather than creating a completely new component. The results screen is 70% identical.
```

### 3.9 Error and slow response handling

```
Fix #15: Contextual loading and error states

During AI response:
  - 0-3 seconds: Standard loading dots (existing ChatBubble loading pattern)
  - 3-8 seconds: "Your trainer is thinking..." / "Tu instructor está pensando..."
  - 8+ seconds: "Taking a bit longer than usual..." with subtle spinner

On error:
  - Show error message in chat area (not a toast — keeps context visible)
  - "Something went wrong. Tap to resend your last answer." [Retry]
  - User message stays visible, retry replays the last exchange
  - Dispatch ERROR action with previousPhase so we can recover

On OpenAI timeout:
  - Same retry pattern, max 2 retries then:
    "Your trainer is unavailable right now. You can try again later or end the assessment."
    [Try Again] [End & Evaluate Based on Progress]
```

### 3.10 Differentiate assessment from practice tutor

```
Fix #51: Visual distinction between assessment and practice tutor

Assessment page:
  - Header: "📋 Section Assessment" (not "Practice")
  - TopicProgressBar with dots (not ReadinessBar with percentage)
  - No session resume from previous practice sessions
  - "End Assessment" button in header

Practice Tutor page:
  - Header: "💬 Practice Tutor" (existing)
  - ReadinessBar with percentage (existing)
  - Session resume list (existing)
  - "Take Test" suggestion (existing)

The AI personalities are also different:
  - Assessment conductor: structured, covers all topics, wraps up
  - Practice tutor: open-ended, exploratory, suggests test at 75%
```

### 3.11 Minor UI fixes

```
Fix #41: Spanish accents — use proper characters:
  "Comprensión", "Preparación", "Práctica"
  (Apply across all new components; existing components are a separate cleanup)

Fix #44: Dark mode variants for TopicProgressBar:
  Filled dots: bg-primary (auto dark mode via Tailwind)
  Empty dots: bg-muted (auto dark mode)

Fix #45: Timestamps — show only on first message and then every 5 minutes,
  not on every bubble

Fix #46: Teaching moment visual cue — subtle lightbulb icon (💡) inline
  at the start of AI messages where teaching_moment=true.
  "💡 Actually, it works a bit differently..."
  Keep subtle — just the emoji prefix, no background change.
```

---

## Phase 4: Quality, Reliability & Rollout ✅ COMPLETED

> Post-build hardening. Addresses scoring, testing, and rollout concerns.
>
> **Migration applied**: `20260218201946_phase4_conversation_rollout.sql`
> **Edge functions deployed**: course-assess (temperature 0.6 + retry), course-evaluate (redeployed)
>
> **Changes applied**:
> - 4.1: Feature flag — `quiz_mode='conversation'` set on "Service Excellence" section (7 questions)
> - 4.2: Scoring consistency — conductor temperature reduced to 0.6, evaluator prompt enhanced with normalization context + ratio-based scoring + topic importance weighting
> - 4.3: Hallucination guardrails — conductor prompt enhanced: quote from training content, stay within provided sections
> - 4.4: OpenAI retry — `callOpenAIWithRetry` wrapper (2 retries, linear backoff 1s/2s) added to course-assess
> - Anti-injection: Rule #10 added to conductor prompt (ignore embedded instructions)
> - Score initialization: Rule #9 enhanced (start at 50, adjust per response)
> - Content adherence: Rule #11 added (stay within ASSESSMENT TOPICS + TRAINING CONTENT)

### 4.1 Feature flag rollout

```
Fix #48: Per-section quiz_mode flag

QuizPage.tsx routing logic:
  1. Load course_sections.quiz_mode for current section
  2. If 'conversation' → render ConversationalAssessmentPage
  3. If 'classic' → render existing QuizPage flow (unchanged)

Initial rollout:
  - Set quiz_mode='conversation' on 1-2 sections for testing
  - Leave remaining sections as 'classic'
  - After validation, expand to all sections

Rollback:
  - Single UPDATE to set quiz_mode='classic' on any section
  - No code changes needed — the classic flow is still intact
```

### 4.2 Scoring consistency measures

```
Fix #50: Reduce non-determinism

1. Evaluation prompt includes:
   "Score DEMONSTRATED KNOWLEDGE, not conversation path.
    Two trainees with same understanding = same score, regardless of questions asked."

2. Temperature 0.3 on evaluator (already in plan) — keeps grading deterministic

3. Temperature 0.6 on conductor (reduced from 0.7) — slightly less random paths
   while keeping conversation natural

4. Minimum question coverage: wrap_up rejected if <3 preloaded questions covered
   Ensures every assessment covers a minimum baseline

5. Evaluation context includes:
   - How many questions were covered (out of total)
   - How many teaching moments occurred
   - The running competency_score trajectory
   This gives the evaluator normalization data to produce consistent scores
```

### 4.3 AI hallucination guardrails

```
Fix #53: Content-grounding in prompts

Assessment-conductor prompt includes:
  "CRITICAL: Only reference facts from the TRAINING CONTENT above.
   Never invent menu items, temperatures, prices, or procedures.
   If you're unsure about a detail, ask the trainee rather than stating it.
   When teaching, quote directly from the training content."

Additionally:
  - The preloaded questions have correct answers from the verified content
  - Teaching moments should reference these verified answers, not generate new info
  - The evaluation prompt checks: "Did the AI stay within the provided content?"
```

### 4.4 OpenAI fallback behavior

```
Fix #49: Graceful degradation

course-assess:
  If OpenAI call fails → return a generic "I had a brief hiccup, could you
  repeat that?" message. Internally, do NOT persist anything for this exchange.
  The user's message stays in client state and can be retried.
  After 3 consecutive failures → surface the error to the user.

course-evaluate (conversation_evaluation):
  If OpenAI fails → use server-side competency_score as the score.
  Return minimal feedback. Match existing graceful degradation pattern.
```

---

## Implementation Order

```
Phase 0: Extract _shared/ modules, refactor 3 existing functions     → Test & deploy
Phase 1: Database migration (schema + prompts + feature flag)         → Push to Supabase
Phase 2: Edge functions (course-assess + course-evaluate extension)   → Deploy & curl test
Phase 3: Frontend (reducer hook + UI components + mobile fixes)       → Dev server test
Phase 4: Feature flag rollout on 1-2 sections                        → Live test
```

Each phase has a clear gate: **do not start the next phase until the previous one is deployed and verified**.

---

## Files Affected — Complete List

### New Files
| File | Phase | Purpose |
|------|-------|---------|
| `supabase/functions/_shared/cors.ts` | 0 | CORS headers, response helpers |
| `supabase/functions/_shared/auth.ts` | 0 | Auth verification wrappers |
| `supabase/functions/_shared/supabase.ts` | 0 | Client creation helpers |
| `supabase/functions/_shared/content.ts` | 0 | Content serializers (canonical) |
| `supabase/functions/_shared/openai.ts` | 0 | OpenAI call wrapper |
| `supabase/functions/_shared/usage.ts` | 0 | Usage check/increment helpers |
| `supabase/functions/course-assess/index.ts` | 2 | Conversational assessment AI |
| `supabase/migrations/YYYYMMDD_conversational_assessment.sql` | 1 | Schema + prompts |
| `src/hooks/use-assessment-chat.ts` | 3 | Reducer-based conversation state |
| `src/components/training/AssessmentChatPanel.tsx` | 3 | Chat UI with voice + exit |
| `src/components/training/TopicProgressBar.tsx` | 3 | Forward-only topic dots |

### Modified Files
| File | Phase | Change |
|------|-------|--------|
| `supabase/functions/course-tutor/index.ts` | 0 | Import from `_shared/` |
| `supabase/functions/course-evaluate/index.ts` | 0+2 | Import from `_shared/` + add conversation_evaluation action |
| `supabase/functions/course-quiz-generate/index.ts` | 0 | Import from `_shared/` |
| `src/pages/QuizPage.tsx` | 3 | Route between classic/conversation based on quiz_mode |
| `src/components/training/QuizResults.tsx` | 3 | Add optional conversationSummary prop |

### Untouched (confirmed)
- `ModuleTestPage.tsx`, `use-module-test.ts`, `ModuleTestResultsView.tsx`
- All product AI, SOS, manual components
- `QuizMCQuestion.tsx`, `QuizVoiceQuestion.tsx` (still used by classic mode + module tests)

---

## Success Criteria (Revised)

1. Phase 0: All 3 existing functions deploy clean with `_shared/` imports
2. Phase 1: Migration applies without errors, feature flag column exists
3. Phase 2: `course-assess` responds to curl with structured JSON, transcript persists atomically
4. Phase 3: Chat UI works on iPhone SE (375px) with keyboard open, voice input transcribes
5. Phase 3: User can end assessment early and get evaluation
6. Phase 3: User can resume an abandoned conversation
7. Phase 4: quiz_mode='conversation' on one section shows chat; other sections show flashcards
8. Phase 4: AI stays within content boundaries (no hallucinated menu items)
9. Phase 4: Evaluation produces consistent scores for similar knowledge levels
10. Phase 4: Full assessment completes in under 8 minutes on mobile
