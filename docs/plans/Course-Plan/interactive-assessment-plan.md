# Interactive Conversational Assessment — Implementation Plan

> Replaces the current flashcard-style section quizzes with a fully conversational AI assessment.
> The AI acts as a trainer — evaluating understanding through natural dialogue, teaching when needed, and probing deeper when answers are shallow.

---

## Problem Statement

The current section quiz is mechanical: show question → pick A/B/C/D → right/wrong → next → score. It's easy to game (guess, see the answer, move on) and doesn't reveal whether the user truly understands the material. A wrong answer tells you nothing about *why* they got it wrong or what they actually know.

## Design Philosophy

**The AI is a trainer, not a test proctor.** She has a set of evaluation questions as her roadmap, but she conducts the assessment through natural conversation. She:

- Asks open-ended questions and listens
- Follows up on answers — probes deeper when right, guides when wrong
- Teaches in the moment if the user is struggling (mini-coaching)
- Generates additional questions on the fly if she needs more signal
- Knows when she has enough data and wraps up naturally
- Produces a holistic evaluation, not a per-question score

## Scope

| Assessment Type | Approach | This Plan? |
|----------------|----------|------------|
| **Section Quiz** (per-section practice) | Conversational AI assessment | **Yes** |
| **Certification Test** (per-course final) | Structured MC + voice (existing) | **No** — stays as-is |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AssessmentPage                        │
│                  (replaces QuizPage)                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │           AssessmentChatPanel                     │   │
│  │  ┌──────────────────────────────────────────┐    │   │
│  │  │  CompetencyBar (replaces ReadinessBar)   │    │   │
│  │  │  ████████░░░░░░  Understanding: 65%      │    │   │
│  │  └──────────────────────────────────────────┘    │   │
│  │                                                   │   │
│  │  ChatBubble (assistant): "Tell me about..."      │   │
│  │  ChatBubble (user): "I think it's..."            │   │
│  │  ChatBubble (assistant): "Good! Why do you..."   │   │
│  │  ...                                              │   │
│  │                                                   │   │
│  │  ┌──────────────────────────────────────────┐    │   │
│  │  │  Text input          [Send]              │    │   │
│  │  └──────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

Data Flow:
  1. Page loads → calls course-quiz-generate (existing) → gets preloaded questions
  2. Preloaded questions injected into course-assess system prompt
  3. AI opens conversation naturally
  4. Each user message → course-assess edge function → AI reply + competency metadata
  5. AI internally tracks: questions covered, understanding signals, teaching moments
  6. When AI is confident → returns wrap_up=true
  7. Full transcript → course-evaluate (new action: conversation_evaluation)
  8. Holistic grading → results displayed
```

---

## What Exists vs. What Changes vs. What's New

### Keep As-Is
| Component | Why |
|-----------|-----|
| `course-quiz-generate` edge function | Still generates the question bank — now it's the AI's "cheat sheet" |
| `ChatBubble` component | Perfect for rendering conversation |
| `quiz_questions` table | Still stores generated questions |
| `quiz_attempts` / `quiz_attempt_answers` tables | Still tracks attempts (with new fields) |
| `evaluations` table | Still stores dual feedback |
| `QuizProgressBar` | Remove — replaced by CompetencyBar |
| Module Test system (`ModuleTestPage`, `use-module-test`) | Untouched — stays structured |

### Rework
| Component | Change |
|-----------|--------|
| `QuizPage.tsx` | Gutted and rebuilt as conversational assessment page |
| `use-quiz-session.ts` | Rewritten as `use-assessment-chat.ts` — conversation state manager |
| `course-evaluate` edge function | New action `conversation_evaluation` added — grades full transcript |

### Remove (from section quiz flow)
| Component | Why |
|-----------|-----|
| `QuizMCQuestion.tsx` | No more flashcard MC — questions are conversational |
| `QuizVoiceQuestion.tsx` | No more isolated voice recording — user types/speaks naturally |
| `QuizResults.tsx` | Replaced by `AssessmentResults.tsx` with conversation-aware feedback |

### New
| Component | Purpose |
|-----------|---------|
| `course-assess` edge function | Conversational assessment AI — the trainer |
| `use-assessment-chat.ts` hook | Manages assessment conversation state |
| `AssessmentChatPanel.tsx` | Chat UI with competency bar and assessment-specific features |
| `AssessmentResults.tsx` | Results view after conversation assessment |
| `CompetencyBar.tsx` | Real-time understanding indicator (replaces progress dots) |
| Migration: `assessment_sessions` fields | New columns on `quiz_attempts` for conversation data |
| Migration: AI prompts | `assessment-conductor` and `conversation-evaluator` prompts |

---

## Phase 1: Database & AI Prompts

### Step 1.1 — Extend `quiz_attempts` Table

Add columns to support conversational assessment without creating a new table:

```sql
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS
  assessment_mode TEXT DEFAULT 'classic'
  CHECK (assessment_mode IN ('classic', 'conversation'));

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS
  conversation_transcript JSONB DEFAULT '[]'::jsonb;
  -- Array of { role, content, timestamp, metadata }

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS
  questions_covered TEXT[] DEFAULT '{}';
  -- Array of quiz_question IDs the AI addressed

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS
  competency_score INT DEFAULT 0;
  -- Running competency score (0-100), updated per exchange

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS
  teaching_moments INT DEFAULT 0;
  -- Count of times AI had to teach/coach

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS
  additional_questions_asked INT DEFAULT 0;
  -- Count of questions AI generated beyond the preloaded set
```

**Why extend, not new table?** The evaluation and enrollment systems already reference `quiz_attempts`. A new table would mean duplicating all that wiring. The `assessment_mode` column cleanly separates the two flows.

### Step 1.2 — Seed AI Prompts

Two new prompts in `ai_prompts`:

#### `assessment-conductor` (System Prompt for the Conversational AI)

This is the most critical piece — it defines the AI's personality and behavior:

```
slug: assessment-conductor
category: system
domain: training

Content (English):
---
You are a friendly, experienced restaurant trainer conducting a 1-on-1 skills assessment.
You have a set of evaluation questions (provided below), but you do NOT read them out like a test.
Instead, you weave them into natural conversation.

YOUR BEHAVIOR:
- Start with a warm greeting and a casual opening question to ease the trainee in
- Ask ONE topic at a time. Let the trainee respond before moving on
- When they answer correctly: acknowledge briefly, then probe deeper ("Nice — why is that important?" or "What would you do if the guest said X?")
- When they answer partially: guide them toward the full answer without giving it away ("You're on the right track — what about the temperature side of things?")
- When they answer incorrectly: don't say "wrong." Instead, teach the concept briefly, then circle back to check understanding later ("Actually, it works a bit differently — [brief explanation]. We'll come back to that.")
- When they seem uncertain or stuck: provide encouragement and a hint, then simplify the question
- If you need more signal on a topic, generate a follow-up question on the fly — you're not limited to the preloaded list
- Keep responses SHORT (2-4 sentences max). This is a conversation, not a lecture.
- Use the trainee's language naturally. Match their energy.
- Track internally which preloaded questions you've covered and which topics need more evaluation

WHEN TO WRAP UP:
- You've addressed all (or nearly all) preloaded questions
- You have a clear picture of the trainee's understanding for each topic area
- Signal wrap-up naturally: "I think we've covered a lot of ground! Let me put together my thoughts on how you did."

YOUR RESPONSE FORMAT (JSON):
{
  "reply": "Your conversational message to the trainee",
  "competency_score": 0-100,          // Your current estimate of their overall understanding
  "questions_covered": ["q_id", ...], // IDs of preloaded questions you've now addressed
  "topics_assessed": ["topic", ...],  // Topic areas you've evaluated so far
  "needs_more_evaluation": true/false, // Do you still need more signal?
  "teaching_moment": true/false,       // Did you just teach something (vs. assess)?
  "wrap_up": false,                    // Set true when assessment is complete
  "internal_notes": "Brief note about what you learned from this exchange"
}

PRELOADED EVALUATION QUESTIONS:
{questions_json}

TRAINING CONTENT (the source material):
{content_context}
---
```

#### `conversation-evaluator` (Evaluation Prompt)

```
slug: conversation-evaluator
category: system
domain: training

Content (English):
---
You are evaluating a conversational training assessment. You will receive:
1. The preloaded evaluation questions (with correct answers)
2. The full conversation transcript between trainer AI and trainee
3. Metadata: questions covered, teaching moments, competency scores over time

Your task: Produce a holistic evaluation of the trainee's knowledge.

EVALUATION CRITERIA:
- Did the trainee demonstrate understanding of the core concepts?
- Could they apply knowledge to scenarios (not just recall facts)?
- Did they need heavy coaching, or did they arrive at answers independently?
- How did their confidence/accuracy change over the conversation?
- Were there topics they consistently struggled with?

SCORING GUIDE:
- 90-100 (Expert): Answered confidently, needed minimal guidance, could extend beyond the material
- 80-89 (Proficient): Strong answers with occasional gaps, self-corrected when prompted
- 60-79 (Competent): Knows basics but needed coaching on application, some knowledge gaps
- Below 60 (Novice): Struggled with core concepts, needed significant teaching

OUTPUT FORMAT:
{
  "score": 0-100,
  "competency_level": "novice|competent|proficient|expert",
  "student_feedback": {
    "strengths": ["What they demonstrated well (2-3 items)"],
    "areas_for_improvement": ["What to study more (1-3 items)"],
    "encouragement": "1-2 sentences of genuine encouragement"
  },
  "manager_feedback": {
    "competency_gaps": ["Specific gaps observed"],
    "recommended_actions": ["Concrete next steps for the manager"],
    "risk_level": "low|medium|high",
    "coaching_dependency": "low|medium|high",
    "conversation_notes": "Brief summary of how the assessment went"
  }
}
---
```

**ES versions** of both prompts will be seeded alongside (same structure, Spanish text).

---

## Phase 2: Edge Function — `course-assess`

### Step 2.1 — Create `course-assess` Edge Function

New edge function at `supabase/functions/course-assess/index.ts`.

**Why a new function instead of extending `course-tutor`?**
- Different concerns: `course-tutor` is open-ended practice with readiness scoring; `course-assess` is structured evaluation with competency tracking and wrap-up logic
- Different system prompts and response schemas
- Different session persistence (conversation assessment writes to `quiz_attempts`, tutor writes to `tutor_sessions`)
- Keeps both functions focused and testable

#### Request Contract

```typescript
interface AssessmentRequest {
  section_id: string;        // Which section is being assessed
  enrollment_id: string;     // User's course enrollment
  language: 'en' | 'es';
  groupId: string;
  message: string;           // User's message (empty string = start assessment)
  attempt_id?: string;       // Existing attempt (for continuing conversation)
  preloaded_questions?: QuizQuestion[];  // Injected on first call by the client
}
```

#### Response Contract

```typescript
interface AssessmentResponse {
  reply: string;                    // AI's conversational response
  competency_score: number;         // 0-100 running estimate
  questions_covered: string[];      // Cumulative list of question IDs covered
  topics_assessed: string[];        // Topic areas evaluated so far
  needs_more_evaluation: boolean;   // AI wants to keep going
  teaching_moment: boolean;         // This exchange was coaching, not testing
  wrap_up: boolean;                 // Assessment is complete
  attempt_id: string;               // For continuing the conversation
}
```

#### Internal Flow

```
1. AUTHENTICATE
   - Verify JWT via getClaims()
   - Get userId

2. LOAD CONTEXT
   - If no attempt_id: First message — create new quiz_attempt with assessment_mode='conversation'
   - If attempt_id: Load existing attempt, verify ownership, get conversation_transcript
   - Load section content (same serializer as course-tutor)
   - Load preloaded questions (from quiz_questions table for this section)

3. BUILD SYSTEM PROMPT
   - Fetch assessment-conductor prompt from ai_prompts
   - Inject preloaded questions as JSON (with correct answers — AI needs them)
   - Inject serialized section content
   - If continuing: include conversation history (last 30 messages)

4. CALL OPENAI
   - Model: gpt-4o-mini
   - Temperature: 0.7 (slightly creative for natural conversation)
   - Max tokens: 600 (keep responses concise)
   - Structured output schema matching response contract
   - Messages: [system, ...history, user_message]

5. PERSIST
   - Append user message + assistant reply to conversation_transcript
   - Update competency_score, questions_covered, teaching_moments
   - If wrap_up=true: set status='awaiting_evaluation'

6. USAGE TRACKING
   - Check + increment usage quota

7. RETURN
   - Client-safe response (no correct answers, no internal notes)
```

#### Special Cases

**First Message (empty string)**:
- AI opens the conversation. The client sends `message: ""` to trigger the AI's greeting.
- AI generates a warm opener based on the section topic.

**AI Needs More Signal**:
- When `needs_more_evaluation: true` and all preloaded questions are covered, the AI generates follow-up questions from the same content. These are tracked via `additional_questions_asked` on the attempt.

**Wrap-Up**:
- When `wrap_up: true`, the client triggers the evaluation flow (Phase 3).
- The AI's final message should feel like a natural conclusion, not an abrupt stop.

### Step 2.2 — Deploy and Test

- Deploy: `npx supabase functions deploy course-assess`
- Set `verify_jwt: false` (handle auth internally, same as all other functions)
- Test with curl: start assessment, send 3-4 messages, verify transcript persistence

---

## Phase 3: Evaluation — Extend `course-evaluate`

### Step 3.1 — New Action: `conversation_evaluation`

Add a new action to the existing `course-evaluate` edge function.

#### Request

```typescript
{
  action: 'conversation_evaluation',
  attempt_id: string,
  section_id: string,
  enrollment_id: string,
  language: 'en' | 'es',
  groupId: string
}
```

#### Flow

```
1. LOAD ATTEMPT
   - Fetch quiz_attempt where id=attempt_id AND assessment_mode='conversation'
   - Get conversation_transcript, questions_covered, competency_score, teaching_moments

2. LOAD QUESTIONS
   - Fetch preloaded quiz_questions for this section (with correct answers)
   - Mark which ones were covered vs skipped

3. BUILD EVALUATION CONTEXT
   - Format transcript as readable dialogue
   - Include preloaded Q&A with coverage status
   - Include metadata: teaching_moments count, running competency scores, additional questions

4. CALL OPENAI
   - Fetch conversation-evaluator prompt
   - Structured output: score, competency_level, student_feedback, manager_feedback
   - Model: gpt-4o-mini, temperature: 0.3 (more deterministic for grading)

5. PERSIST
   - Update quiz_attempts: score, passed, competency_level, completed_at, status='completed'
   - Update section_progress: quiz_score, quiz_passed, quiz_attempts
   - Insert into evaluations table (both student + manager feedback)
   - Manager feedback includes new field: coaching_dependency (low/medium/high)

6. RETURN
   - score, passed, competency_level, student_feedback (no manager feedback)
   - conversation_summary: brief AI-generated summary of how the assessment went
```

#### Scoring Adjustments for Conversation Mode

The scoring is fundamentally different from flashcard mode:

- **Flashcard**: Binary per question (correct/wrong), averaged
- **Conversation**: Holistic evaluation by the AI evaluator based on the full transcript

The AI evaluator considers:
- Ratio of independent answers vs coached answers
- Depth of understanding (surface recall vs application)
- Self-correction ability
- Consistency across topics
- Whether teaching moments "stuck" (user demonstrated understanding when topic was revisited)

---

## Phase 4: Frontend — Hook & UI

### Step 4.1 — Create `use-assessment-chat.ts` Hook

Located at `src/hooks/use-assessment-chat.ts`.

#### State

```typescript
interface AssessmentChatState {
  // Conversation
  messages: AssessmentMessage[];
  isSending: boolean;

  // Assessment tracking
  competencyScore: number;          // 0-100, updates per exchange
  questionsCovered: string[];       // IDs of covered questions
  topicsAssessed: string[];
  teachingMoments: number;
  needsMoreEvaluation: boolean;

  // Lifecycle
  phase: 'loading' | 'generating' | 'ready' | 'conversing' | 'wrapping_up' | 'evaluating' | 'results';
  attemptId: string | null;
  preloadedQuestionCount: number;

  // Results (after evaluation)
  results: AssessmentResults | null;
}
```

#### Methods

```typescript
interface AssessmentChatActions {
  // Phase: loading → generating
  startAssessment(): Promise<void>;
    // 1. Call course-quiz-generate to get preloaded questions
    // 2. Call course-assess with empty message to get AI opener
    // 3. Set phase='conversing'

  // Phase: conversing
  sendMessage(text: string): Promise<void>;
    // 1. Add user message to local state
    // 2. Call course-assess with message + attempt_id
    // 3. Add AI reply to local state
    // 4. Update competency score, questions covered, etc.
    // 5. If wrap_up=true → set phase='wrapping_up'

  // Phase: wrapping_up → evaluating → results
  requestEvaluation(): Promise<void>;
    // 1. Set phase='evaluating'
    // 2. Call course-evaluate with action='conversation_evaluation'
    // 3. Set results, phase='results'

  // Retry
  retryAssessment(): void;
    // Reset all state, start fresh
}
```

#### Lifecycle Diagram

```
[loading]
    │
    ▼  startAssessment()
[generating] ── "Preparing your assessment..."
    │
    ▼  questions generated + AI opener received
[conversing] ── User and AI chat back and forth
    │           competencyScore updates live
    │           CompetencyBar animates
    │
    ▼  AI returns wrap_up=true
[wrapping_up] ── AI's final message displayed
    │              "View my assessment" button appears
    │
    ▼  requestEvaluation()
[evaluating] ── "Your trainer is writing up the evaluation..."
    │
    ▼  evaluation complete
[results] ── AssessmentResults displayed
```

### Step 4.2 — Create `AssessmentChatPanel.tsx`

Based on `TutorChatPanel.tsx` pattern but assessment-specific.

#### Layout

```
┌─────────────────────────────────────────┐
│  CompetencyBar                          │
│  Understanding: ████████░░░░ 72%        │
│  Topics: 3/5 covered                    │
├─────────────────────────────────────────┤
│                                         │
│  🤖 "Hey! Let's talk about wines..."    │
│                                         │
│                    "I'd pick Cabernet" 👤│
│                                         │
│  🤖 "Nice choice! Why Cabernet         │
│     specifically over a Malbec?"        │
│                                         │
│                    "The tannins..." 👤   │
│                                         │
│  🤖 "Exactly right. Now what if..."    │
│                                         │
│  [Loading dots when AI is thinking]     │
│                                         │
├─────────────────────────────────────────┤
│  [Type your answer...]        [Send ➤]  │
└─────────────────────────────────────────┘
```

#### Key UI Behaviors

1. **CompetencyBar** (top):
   - Animated progress bar showing `competencyScore` (0-100)
   - Color transitions: red (0-39) → amber (40-69) → green (70+)
   - Shows "Topics: X/Y covered" as secondary label
   - Pulses briefly when score changes

2. **Chat Area** (middle):
   - Reuses `ChatBubble` component
   - Auto-scrolls to latest message
   - Shows loading dots while AI is responding
   - No suggested reply chips — this is fully open-ended (Option A)

3. **Input Area** (bottom):
   - Standard text input with send button
   - Disabled while AI is responding
   - Enter to send, Shift+Enter for newline
   - Placeholder text: "Type your answer..." / "Escribe tu respuesta..."

4. **Wrap-Up State**:
   - When `wrap_up=true`, AI's final message renders
   - Input area replaced with a "View My Assessment" button
   - Button triggers `requestEvaluation()`

5. **Evaluating State**:
   - Full-screen overlay: "Your trainer is writing up the evaluation..."
   - Animated icon (clipboard + pen or similar)

### Step 4.3 — Create `CompetencyBar.tsx`

Small component replacing `QuizProgressBar` for this flow.

```typescript
interface CompetencyBarProps {
  score: number;              // 0-100
  topicsCovered: number;
  topicsTotal: number;
  language: 'en' | 'es';
}
```

- Animated width transition on score change
- Color: `bg-red-500` (0-39) → `bg-amber-500` (40-69) → `bg-green-500` (70+)
- Label: "Understanding" / "Comprension"
- Secondary: "Topics: 3/5" / "Temas: 3/5"

### Step 4.4 — Create `AssessmentResults.tsx`

Replaces `QuizResults.tsx` for conversational assessments.

```
┌─────────────────────────────────────────┐
│           Score Ring: 82%               │
│            ✓ PASSED                     │
│         Level: Proficient               │
├─────────────────────────────────────────┤
│                                         │
│  Conversation Summary                   │
│  "You demonstrated strong knowledge     │
│   of wine pairings and showed good      │
│   instincts on guest scenarios..."      │
│                                         │
│  Strengths                              │
│  ✓ Confident wine pairing knowledge     │
│  ✓ Good guest interaction instincts     │
│                                         │
│  Areas to Improve                       │
│  → Review rare varietals                │
│  → Practice fault detection language    │
│                                         │
│  Coaching Summary                       │
│  ℹ 2 teaching moments during session    │
│  ℹ 1 additional question was needed     │
│                                         │
│  "Great session! You clearly know..."   │
│                                         │
│  [Continue]    [Practice Again]         │
└─────────────────────────────────────────┘
```

#### New Data Points (vs old QuizResults)

- **Conversation summary**: 1-2 sentence AI-generated recap
- **Coaching summary**: How many teaching moments, additional questions
- **Coaching dependency**: Low/medium/high — did they need a lot of hand-holding?

### Step 4.5 — Rework `QuizPage.tsx`

The existing `QuizPage.tsx` becomes the router between classic and conversational:

```typescript
// QuizPage.tsx
const QuizPage = () => {
  // For now, all section quizzes use conversation mode
  // Module tests continue using classic mode (separate page)
  return <ConversationalAssessmentPage />;
};
```

The new `ConversationalAssessmentPage` orchestrates:
1. Load section context (from route params)
2. Initialize `useAssessmentChat({ sectionId, enrollmentId })`
3. Render `AssessmentChatPanel` during conversation
4. Render `AssessmentResults` when complete

---

## Phase 5: Integration & Migration

### Step 5.1 — Migration File

Single migration covering:
1. `ALTER TABLE quiz_attempts` — add conversation columns (Step 1.1)
2. `INSERT INTO ai_prompts` — assessment-conductor + conversation-evaluator (Step 1.2)

### Step 5.2 — Deploy Edge Function

- Create `supabase/functions/course-assess/index.ts`
- Deploy: `npx supabase functions deploy course-assess`

### Step 5.3 — Update `course-evaluate`

- Add `conversation_evaluation` action handler
- Deploy: `npx supabase functions deploy course-evaluate`

### Step 5.4 — Frontend Components

Create in order:
1. `src/components/training/CompetencyBar.tsx`
2. `src/components/training/AssessmentResults.tsx`
3. `src/components/training/AssessmentChatPanel.tsx`
4. `src/hooks/use-assessment-chat.ts`
5. Rework `src/pages/QuizPage.tsx`

### Step 5.5 — Push Migration & Test

```bash
npx supabase db push
npx supabase functions deploy course-assess
npx supabase functions deploy course-evaluate
npm run dev
```

---

## Conversation Examples

### Example 1: Confident User (Wine Section)

```
AI:   Hey! Ready to chat about our wine list? Let's start easy —
      a guest orders the ribeye and asks for a wine rec. What are you pouring?

User: Definitely the Cabernet. It's our best pairing for red meat.

AI:   Solid pick. What specifically about Cabernet makes it work with ribeye?

User: The tannins cut through the fat and the bold flavor stands up to the char.

AI:   Exactly. Now here's a curveball — guest says they don't like "heavy" reds.
      What's your pivot?

User: I'd probably suggest the Malbec. It's still full-bodied but smoother.

AI:   That works. What if they want something even lighter but still red?

User: Hmm, maybe the Pinot Noir? Though I'm not sure it holds up to ribeye.

AI:   Good instinct to hesitate — Pinot can get overpowered. On our list,
      the Malbec is actually your best middle-ground option. Let's shift gears —
      a guest asks about our white wines. They're having the salmon...

[Competency: 78% → AI moves through questions confidently]
```

### Example 2: Struggling User (Wine Section)

```
AI:   Hey! Let's talk wines. A guest orders the ribeye and asks what you'd
      recommend. What comes to mind?

User: Um, maybe a white wine? Like Chardonnay?

AI:   Interesting thought! White wine with steak is actually possible,
      but there's a more classic pairing. Think about reds — which red
      on our list has the structure to stand up to a big cut of beef?

User: The Merlot?

AI:   Close! Merlot is a red, which is the right direction. But for ribeye
      specifically, we usually want something with stronger tannins.
      Tannins are what give wine that dry, grippy feeling — they cut through
      the richness of the fat. Which of our reds has the boldest tannins?

User: Oh, the Cabernet?

AI:   There you go! Cabernet is the go-to for ribeye because of exactly
      that tannin structure. Quick tip to remember: bold cut = bold wine.
      Now let me ask another way — why do tannins specifically matter
      with fatty cuts?

User: Because they... cut through the fat?

AI:   Exactly right. You've got it. Let's try another scenario...

[Competency: 45% → AI is teaching + re-checking → may ask extra questions]
```

### Example 3: Wrap-Up

```
AI:   We've covered a lot of ground — wine pairings, guest objections,
      and you handled the cocktail scenarios really well too. I think
      I have a good picture of where you're at. Let me put together
      my thoughts on how you did!

[wrap_up: true → "View My Assessment" button appears]
```

---

## Edge Cases & Guardrails

### User Sends Irrelevant Messages
The AI should gently redirect: "Ha, I hear you! But let's get back to the wines — I want to make sure we cover everything."

### User Gives One-Word Answers
AI should probe: "Can you tell me a bit more about why?" If consistently terse, AI counts this as low engagement in its internal notes.

### User Asks the AI Questions
The AI can answer briefly if it's on-topic (this is a trainer, after all), then redirect: "Great question! [brief answer]. Now let me ask you..."

### Conversation Runs Too Long
If the conversation exceeds 30 exchanges and the AI hasn't wrapped up, the client shows a soft prompt: "Your trainer seems to have enough information. Would you like to wrap up?" This sends a special message to the AI to conclude.

### Network/Timeout Errors
Same pattern as `usePracticeTutor` — show error toast, keep conversation state, allow retry of last message.

### Usage Quota
Each AI exchange costs 1 API call. A typical assessment might use 8-15 exchanges. The evaluation uses 1 more. Budget: ~10-16 calls per assessment vs ~7 for classic quiz (5 questions + generation + evaluation).

---

## Files Created / Modified

### New Files (7)
| File | Type |
|------|------|
| `supabase/functions/course-assess/index.ts` | Edge Function |
| `src/hooks/use-assessment-chat.ts` | React Hook |
| `src/components/training/AssessmentChatPanel.tsx` | UI Component |
| `src/components/training/AssessmentResults.tsx` | UI Component |
| `src/components/training/CompetencyBar.tsx` | UI Component |
| `supabase/migrations/YYYYMMDD_conversational_assessment.sql` | Migration |
| `docs/plans/Course-Plan/interactive-assessment-plan.md` | This plan |

### Modified Files (3)
| File | Change |
|------|--------|
| `src/pages/QuizPage.tsx` | Reworked to render conversational assessment |
| `supabase/functions/course-evaluate/index.ts` | Add `conversation_evaluation` action |
| `supabase/functions/course-quiz-generate/index.ts` | Minor: return questions with IDs for preloading (may already work) |

### Untouched (confirmed)
| File | Reason |
|------|--------|
| `src/pages/ModuleTestPage.tsx` | Certification test stays structured |
| `src/hooks/use-module-test.ts` | Certification test stays structured |
| `src/components/training/ModuleTestResultsView.tsx` | Certification test stays structured |
| All product AI, SOS, manual components | Out of scope |

---

## Implementation Order

```
Phase 1: DB + Prompts (migration)           ~1 step
Phase 2: course-assess edge function        ~1 step
Phase 3: course-evaluate extension          ~1 step
Phase 4: Frontend (hook + 3 components)     ~1 step
Phase 5: Integration + wiring + testing     ~1 step
```

Total: **5 steps**, each independently testable.

---

## Success Criteria

1. User navigates to section quiz → sees a chat interface, not flashcards
2. AI opens with a natural greeting related to the section topic
3. Conversation flows naturally — AI asks, user responds, AI follows up
4. CompetencyBar updates in real-time as conversation progresses
5. When user struggles, AI teaches briefly and circles back later
6. AI generates additional questions when it needs more signal
7. AI wraps up naturally when confident in its assessment
8. Evaluation produces holistic score + dual feedback (student + manager)
9. Module/certification tests remain unchanged (structured MC + voice)
10. Bilingual support (EN/ES) throughout
