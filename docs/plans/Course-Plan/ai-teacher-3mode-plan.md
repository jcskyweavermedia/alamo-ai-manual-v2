# 3-Mode AI Teacher — Implementation Plan

## Context

The current "Practice with Tutor" page is a basic text chat with a readiness score bar. We're revamping it into a 3-mode AI Teacher where **Quiz Me**, **Teach Me**, and **Ask Anything** appear as action cards inside the existing chat interface — not a separate screen. The user can tap a card to start a mode or just type/talk freely (defaults to Ask Anything). Voice works via the existing mic button and WebRTC pipeline. This is for a demo this week.

---

## Phase 1: DB Migration + AI Prompts

**Single migration file, zero new tables.**

### File: `supabase/migrations/YYYYMMDD_ai_teacher_3mode.sql`

ALTER existing tables:

| Table | Change | Purpose |
|---|---|---|
| `tutor_sessions` | ADD `mode text DEFAULT 'tutor'` + CHECK `('tutor','quiz_me','teach_me','ask_anything')` | Discriminate session modes |
| `tutor_sessions` | ADD `topic_mastery jsonb DEFAULT '[]'` | Track per-concept taught/checked/mastered |
| `quiz_attempt_answers` | ADD `confidence smallint` + CHECK `(1-5)` | Student self-rated certainty |
| `tutor_sessions` | ADD INDEX `idx_tutor_sessions_mode` on `(user_id, course_id, mode)` | Fast session lookup |

Seed 3 AI prompts in `ai_prompts`:
- `teacher-quiz-me` — Quiz master: generate MCQs, give feedback, adapt difficulty, track confidence
- `teacher-teach-me` — Structured teacher: teach concepts one at a time, comprehension checks, track mastery
- `teacher-ask-anything` — Training assistant: answer questions grounded in course content + search tools, say "not in our materials" when unsure

### Deploy
```bash
npx supabase db push --include-all
```

---

## Phase 2: UI Shell — Mode Cards + Unified Chat

**Goal:** Replace the current TutorChatPanel with mode cards inside the chat area + VoiceChatInput at bottom. No new functionality yet — just the UI skeleton.

### Modify: `src/components/training/TutorChatPanel.tsx`

**Current:** Basic Input + Send button at bottom, empty state with GraduationCap icon.

**New:**
- Replace bottom `<Input>` + `<Button>` with `<VoiceChatInput>` (already exists, has mic + voice mode + send)
- Replace empty state with 3 mode cards (horizontal row or stacked on narrow screens)
- Keep ReadinessBar at top (unchanged)
- Keep session resume cards (unchanged)
- Keep ChatBubble rendering (unchanged)
- Keep LoadingDots (unchanged)

**Mode cards design (inside messages area, scroll with content):**
```
┌──────────────────────────────────────┐
│  [Brain icon]  Quiz Me               │
│  Test your knowledge with quick      │
│  questions                           │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  [BookOpen icon]  Teach Me           │
│  Walk through key concepts           │
│  step by step                        │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  [MessageCircle icon]  Ask Anything  │
│  Got a specific question?            │
│  Just ask                            │
└──────────────────────────────────────┘
```

Cards are shadcn `Card` with `CardContent`, clickable with hover state. Each has:
- Lucide icon (Brain, BookOpen, MessageCircleQuestion)
- Title (en/es)
- 1-line description (en/es)
- `onClick` → sets active mode + triggers mode start

### New: `src/components/training/TutorModeCard.tsx`

Small presentational component for the mode cards:
```
Props: { icon: LucideIcon, title: string, description: string, onClick: () => void }
```
Reuse shadcn Card + CardContent. Primary/10 icon background (same pattern as AssessmentCard).

### Modify: `src/hooks/use-practice-tutor.ts`

Add state:
- `activeMode: 'quiz_me' | 'teach_me' | 'ask_anything' | null` (null = no mode selected yet)
- `setActiveMode(mode)` — called when card is tapped

Extend `sendMessage(text, mode?)` to pass mode to edge function.

### Modify: `src/pages/PracticeTutorPage.tsx`

- Pass `voiceEnabled` from `permissions.voiceEnabled` to TutorChatPanel
- Pass voice mode handler (for Phase 6 when we wire WebRTC)
- Update header title based on active mode: "Quiz Me" / "Teach Me" / "Ask Anything" (or generic "AI Teacher" before mode selected)

### New props for TutorChatPanel:
```typescript
interface TutorChatPanelProps {
  // ... existing props ...
  activeMode: 'quiz_me' | 'teach_me' | 'ask_anything' | null;
  onSelectMode: (mode: 'quiz_me' | 'teach_me' | 'ask_anything') => void;
  voiceEnabled?: boolean;
  onVoiceMode?: () => void;
  // Quiz Me specific
  currentQuestion?: QuizQuestionClient | null;
  questionResult?: MCAnswerResult | null;
  onAnswerQuestion?: (optionId: string) => Promise<void>;
  onConfidenceRate?: (rating: number) => void;
}
```

---

## Phase 3: Ask Anything (Text Mode)

**Goal:** The simplest mode — closest to current behavior. Free-form Q&A. Add search tools to prevent hallucination.

### Modify: `supabase/functions/course-tutor/index.ts`

1. Accept `mode` parameter in request body (default: `'ask_anything'` for backwards compat)
2. Load mode-specific prompt from `ai_prompts`:
   - `mode === 'ask_anything'` → slug `teacher-ask-anything`
   - `mode === 'teach_me'` → slug `teacher-teach-me`
   - `mode === 'quiz_me'` → slug `teacher-quiz-me`
   - fallback to existing `practice-tutor` slug
3. **Add OpenAI function calling** for Ask Anything mode:
   - Define tools: `search_handbook`, `search_dishes`, `search_wines`, `search_cocktails`, `search_recipes`, `search_beer_liquor`
   - When AI calls a tool, execute the Supabase RPC (same pattern as realtime-search)
   - Feed results back to OpenAI as tool response
   - This is the anti-hallucination layer
4. Persist `mode` to `tutor_sessions.mode` column

### Reuse from `supabase/functions/realtime-search/index.ts`:
- The tool execution logic (RPC calls to search_manual_v2, search_dishes, etc.)
- Extract into a shared helper or duplicate the RPC call pattern

### Frontend behavior:
- User types freely → `sendMessage(text)` → course-tutor with `mode: 'ask_anything'`
- OR user taps "Ask Anything" card → sets mode → same flow
- Typing without selecting a card defaults to ask_anything mode
- Messages render as ChatBubbles (existing)

### Deploy:
```bash
npx supabase functions deploy course-tutor --no-verify-jwt
```

---

## Phase 4: Teach Me (Text Mode)

**Goal:** AI-led teaching. AI speaks first when mode is selected. Comprehension checks inline.

### Modify: `supabase/functions/course-tutor/index.ts`

For `mode === 'teach_me'`:
1. Use `teacher-teach-me` prompt (Socratic, structured, one concept at a time)
2. On first message (no session history), AI should introduce itself and start teaching the first concept — the user's initial message can be empty/trigger ("start" or card tap sends a system message)
3. Structured output adds `topic_mastery` array:
```json
{
  "reply": "Let's start with wine service temperature...",
  "readiness_score": 15,
  "suggest_test": false,
  "topics_covered": ["wine_temps"],
  "topic_mastery": [
    { "topic": "wine_temps", "status": "teaching" }
  ]
}
```
4. Search tools available (same as Ask Anything) for when student asks tangential questions during teaching

### Frontend behavior:
- User taps "Teach Me" card → `sendMessage('__teach_me_start__', 'teach_me')` (special trigger)
- Edge function detects trigger, skips adding it to visible history, starts teaching
- AI response appears as first message
- Student responds → AI checks comprehension → continues or re-explains
- ChatBubbles render normally (AI messages may be slightly longer in teach mode)

---

## Phase 5: Quiz Me (Text Mode)

**Goal:** MCQ generation + inline quiz cards in chat flow. This is the most complex mode.

### Architecture Decision: Use `course-quiz-generate` for question generation

The existing `course-quiz-generate` edge function already:
- Generates MCQs from course content with structured output
- Stores them in `quiz_questions` table
- Has `toClientQuestion()` that strips correct answers
- Supports difficulty levels
- Auto-reuses existing questions

### New: `src/hooks/use-quiz-me.ts`

Manages Quiz Me mode state:
```typescript
interface UseQuizMeOptions {
  courseId: string | undefined;
  enrollmentId: string | undefined;
}

// Returns:
{
  currentQuestion: QuizQuestionClient | null;
  questionResult: MCAnswerResult | null;
  questionsAnswered: number;
  correctCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  isLoadingQuestion: boolean;
  confidenceRating: number | null;

  startQuiz: () => Promise<void>;       // Fetch first question
  submitAnswer: (optionId: string) => Promise<void>;  // Submit + get result
  setConfidence: (rating: number) => void;
  nextQuestion: () => Promise<void>;     // Fetch next question
}
```

**Flow:**
1. `startQuiz()` → calls `course-quiz-generate` with `{ course_id, mode: 'single_question', difficulty: 'easy' }`
2. Returns 1 question (client-safe, no correct answer exposed)
3. User sees MCQ card in chat area (rendered inline, not as a ChatBubble)
4. User selects answer → `submitAnswer(optionId)` → calls edge function to validate
5. Result rendered: correct/incorrect + explanation (reuse QuizMCQuestion component)
6. Confidence rating appears (1-5 scale, simple button row)
7. `nextQuestion()` → fetches next question, adjusting difficulty based on streak

### Modify: `supabase/functions/course-quiz-generate/index.ts`

Add a `single_question` mode:
- Returns 1 question at a time (vs current batch of 5)
- Accepts `difficulty` parameter for adaptive selection
- Accepts `exclude_ids` to avoid repeating questions in same session
- Reuses existing question bank when available, generates new if needed

### New: `src/components/training/QuizMeCard.tsx`

Wrapper that renders MCQ inline in the chat flow:
- Wraps existing `QuizMCQuestion` component
- Adds confidence rating row (5 circle buttons: 1-5) shown AFTER answer selection, BEFORE reveal
- Adds "Next Question" button after result is shown
- Styled to look like a chat message from the AI (same max-width, left-aligned)

### Modify: `src/components/training/TutorChatPanel.tsx`

When `activeMode === 'quiz_me'`:
- Chat messages area renders a mix of ChatBubbles + QuizMeCards
- Quiz questions appear inline (AI "asks" via the MCQ card)
- AI feedback text appears as ChatBubble after quiz result
- "Next Question" triggers next round

### Modify: `src/hooks/use-practice-tutor.ts`

Integrate quiz state:
- When mode is quiz_me, readiness score updates based on correct/incorrect answers
- Track questions_asked + correct_answers for session persistence

---

## Phase 6: Voice Mode (All Modes)

**Goal:** Wire the existing WebRTC pipeline to course tutoring.

### Modify: `supabase/functions/realtime-session/index.ts`

Add `course` domain handling:
```typescript
case 'course': {
  // Load course content via loadSectionContent()
  const courseId = itemContext?.courseId;
  const sections = await supabase.from('course_sections')...
  const content = await loadSectionContent(supabase, sections, language);

  // Load mode-specific prompt
  const promptSlug = action === 'quizMe' ? 'teacher-quiz-me'
    : action === 'teachMe' ? 'teacher-teach-me'
    : 'teacher-ask-anything';

  // Build system prompt with course content injected
  systemPrompt = `${promptText}\n\nCourse Content:\n${content}`;

  // Tools: all 7 search functions (same as product mode)
  tools = [search_handbook, search_dishes, search_wines, ...];
}
```

### Modify: `src/data/ai-action-config.ts`

Add COURSE_AI_ACTIONS:
```typescript
export const COURSE_AI_ACTIONS = {
  quizMe: { key: 'quizMe', mode: 'conversation', autoTrigger: false, icon: Brain, label: 'Quiz Me', labelEs: 'Evalúame' },
  teachMe: { key: 'teachMe', mode: 'conversation', autoTrigger: true, icon: BookOpen, label: 'Teach Me', labelEs: 'Enséñame' },
  askAnything: { key: 'askAnything', mode: 'conversation', autoTrigger: false, icon: MessageCircleQuestion, label: 'Ask Anything', labelEs: 'Pregunta Libre' },
};
```

### Modify: `src/pages/PracticeTutorPage.tsx`

Add `useRealtimeWebRTC` hook:
```typescript
const voiceHook = useRealtimeWebRTC({
  language,
  groupId,
  domain: 'course',
  action: activeMode === 'quiz_me' ? 'quizMe'
    : activeMode === 'teach_me' ? 'teachMe'
    : 'askAnything',
  itemContext: { courseId: course?.id, enrollmentId: enrollment?.id },
});
```

Voice mode activation:
- User taps orange AudioWaveform button (in VoiceChatInput) → `onVoiceMode` fires
- Calls `voiceHook.connect()` → WebRTC session starts
- TutorChatPanel shows VoiceTranscript + VoiceModeButton (same as AskAboutContent pattern)
- On disconnect → transcript entries added to messages array

### Modify: `src/components/training/TutorChatPanel.tsx`

Add voice mode rendering:
- When voice is active, show VoiceModeButton (animated states) + VoiceTranscript
- Hide text input area during active voice (or show both — follow AskAboutContent pattern)

---

## Phase 7: Polish & Integration

1. **Session resume per mode** — When resuming, filter existing sessions by mode
2. **Readiness score** — Quiz Me contributes most (correct/incorrect), Teach Me contributes from comprehension checks, Ask Anything contributes minimally
3. **AssessmentCard on CourseDetail** — Update status to reflect active mode and combined readiness
4. **Deploy all edge functions:**
```bash
npx supabase functions deploy course-tutor --no-verify-jwt
npx supabase functions deploy course-quiz-generate --no-verify-jwt
npx supabase functions deploy realtime-session --no-verify-jwt
```

---

## Files Summary

### New Files (3)
| File | Purpose |
|---|---|
| `supabase/migrations/YYYYMMDD_ai_teacher_3mode.sql` | Schema ALTERs + prompt seeds |
| `src/components/training/TutorModeCard.tsx` | Presentational mode card component |
| `src/components/training/QuizMeCard.tsx` | MCQ inline card with confidence rating |

### Modified Files (8)
| File | Changes |
|---|---|
| `src/components/training/TutorChatPanel.tsx` | Replace Input with VoiceChatInput, add mode cards, quiz rendering, voice mode |
| `src/hooks/use-practice-tutor.ts` | Add activeMode state, mode param to sendMessage, quiz integration |
| `src/pages/PracticeTutorPage.tsx` | Wire voice hook, pass voice/mode props down |
| `supabase/functions/course-tutor/index.ts` | Mode-aware prompts, search tool calling, topic_mastery |
| `supabase/functions/course-quiz-generate/index.ts` | Add single_question mode |
| `supabase/functions/realtime-session/index.ts` | Add `course` domain |
| `src/data/ai-action-config.ts` | Add COURSE_AI_ACTIONS |
| `src/types/training.ts` | Add mode types, extend TutorMessage |

### Reused (Unchanged)
| File | Used For |
|---|---|
| `src/components/ui/voice-chat-input.tsx` | Input component (replaces basic Input+Button) |
| `src/components/training/ChatBubble.tsx` | Message rendering |
| `src/components/training/QuizMCQuestion.tsx` | MCQ answer UI (wrapped by QuizMeCard) |
| `src/hooks/use-realtime-webrtc.ts` | WebRTC voice connection |
| `supabase/functions/_shared/content.ts` | Content serialization |
| `supabase/functions/realtime-search/index.ts` | Voice mode tool calls (unchanged) |

---

## Verification

### Phase 1 (DB)
- Run `npx supabase db push --include-all`
- Verify via SQL: `SELECT * FROM ai_prompts WHERE slug LIKE 'teacher-%'` (3 rows)
- Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'tutor_sessions' AND column_name = 'mode'`

### Phase 2 (UI)
- `npm run dev` → navigate to any course → "Practice with Tutor"
- See 3 mode cards in chat area
- VoiceChatInput visible at bottom with mic + orange waveform button
- Tapping a card sets mode (visible in header subtitle)

### Phase 3 (Ask Anything)
- Type a question without selecting mode → sends as ask_anything
- AI responds with grounded answer (check edge function logs for tool calls)
- Test hallucination boundary: ask about something NOT in course content → AI says "not covered"

### Phase 4 (Teach Me)
- Tap "Teach Me" card → AI starts teaching immediately (first message from AI)
- AI asks comprehension check → answer → AI evaluates → continues

### Phase 5 (Quiz Me)
- Tap "Quiz Me" card → MCQ card appears inline
- Select answer → feedback appears → "Next Question" button
- Readiness score updates after each question

### Phase 6 (Voice)
- Tap orange AudioWaveform button → WebRTC connects
- Voice conversation works in all 3 modes
- Check Supabase Dashboard → Edge Functions → realtime-session logs for `domain: 'course'`

### End-to-End
- Complete a full session in each mode
- Verify tutor_sessions rows have correct `mode` values
- Verify readiness score reflects across all modes
- CourseDetail assessment card shows updated progress
