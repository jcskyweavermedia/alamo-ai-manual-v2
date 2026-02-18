# Phase 3: Assessment — Quizzes + Evaluation

> AI-generated quizzes (MC + voice), scoring, dual feedback (student + manager).
> **Goal**: Staff can take quizzes to demonstrate knowledge; AI evaluates and produces both student-facing encouragement and manager-facing assessment.

---

## Prerequisites (Already Complete)

These exist from Phase 1 and must NOT be recreated:

| Asset | Status |
|-------|--------|
| `quiz_questions` table (with RLS + indexes) | Created, empty |
| `quiz_attempts` table (with RLS + indexes) | Created, empty |
| `quiz_attempt_answers` table (with RLS + indexes) | Created, empty |
| `evaluations` table (with RLS + indexes) | Created, empty |
| `course_sections.quiz_enabled` / `quiz_question_count` / `quiz_passing_score` columns | Created |
| `section_progress.quiz_score` / `quiz_passed` / `quiz_attempts` columns | Created |
| `VoiceConsentDialog` component | Created |
| `useVoiceRecording` hook (60s limit, Whisper transcription) | Created |
| `shouldSuggestQuiz` flag in training chat | Created (button has no onClick yet) |

---

## Agent Outputs

Three specialist agents produced research for this plan:

| Agent | Research | Key Findings |
|-------|----------|--------------|
| **DB Schema Agent** | Full SQL for all quiz/evaluation tables, ai_prompts structure, section_progress schema | All 4 quiz tables exist with proper RLS; JSONB schemas documented |
| **Frontend Architect** | Existing hooks, components, edge function call patterns, voice recording flow | useTrainingChat, useSectionProgress, useVoiceRecording patterns; shouldSuggestQuiz UI wiring point |
| **Edge Function Engineer** | ask/index.ts training handler, transcribe/index.ts, OpenAI structured output, auth/rate-limit boilerplate | Self-contained functions, json_schema strict mode, ai_prompts table loading |

---

## Step-by-Step Implementation Order

### Step 3.1 — Seed AI Prompts for Quiz System

**File**: `supabase/migrations/YYYYMMDDHHMMSS_seed_quiz_ai_prompts.sql` (NEW)

Seeds 3 new prompts into `ai_prompts`:

#### Prompt 1: `quiz-generator`
- **Category**: `system`
- **Purpose**: Generates MC + voice questions from section content
- **Input context**: Section content (text), difficulty level, question count, existing question slugs (to avoid duplicates)
- **Output schema** (OpenAI structured JSON):
```json
{
  "questions": [
    {
      "question_type": "multiple_choice",
      "question_en": "What is the ideal internal temperature for a medium-rare steak?",
      "question_es": "Cual es la temperatura interna ideal para un steak medio crudo?",
      "options": [
        { "id": "a", "text_en": "120F", "text_es": "120F", "correct": false },
        { "id": "b", "text_en": "130F", "text_es": "130F", "correct": true },
        { "id": "c", "text_en": "145F", "text_es": "145F", "correct": false },
        { "id": "d", "text_en": "160F", "text_es": "160F", "correct": false }
      ],
      "explanation_en": "Medium-rare is 130F internal...",
      "explanation_es": "Medio crudo es 130F interno...",
      "difficulty": "easy"
    },
    {
      "question_type": "voice",
      "question_en": "A guest asks you to recommend a wine for the ribeye. What would you say?",
      "question_es": "Un invitado te pide que recomiendes un vino para el ribeye. Que le dirias?",
      "rubric": [
        { "criterion": "Names a specific wine from the menu", "points": 30 },
        { "criterion": "Explains why it pairs well", "points": 30 },
        { "criterion": "Uses confident, hospitable tone", "points": 20 },
        { "criterion": "Mentions alternative option", "points": 20 }
      ],
      "difficulty": "medium"
    }
  ]
}
```
- **Prompt guidelines** (EN+ES):
  - Generate questions ONLY from provided content (never invent facts)
  - MC questions: 4 options, 1 correct, distractors based on plausible misconceptions
  - Voice questions: real-world scenarios a server would face
  - Mix difficulties (at least 1 easy, at least 1 medium)
  - For sections with products: include specific menu item details
  - Rubric points must total 100

#### Prompt 2: `quiz-voice-evaluator`
- **Category**: `system`
- **Purpose**: Evaluates a voice answer transcription against rubric criteria
- **Input context**: Question text, rubric criteria, student's transcription, content context
- **Output schema**:
```json
{
  "total_score": 75,
  "criteria_scores": [
    { "criterion": "Names a specific wine from the menu", "points_earned": 30, "points_possible": 30, "met": true },
    { "criterion": "Explains why it pairs well", "points_earned": 20, "points_possible": 30, "met": false },
    { "criterion": "Uses confident, hospitable tone", "points_earned": 15, "points_possible": 20, "met": true },
    { "criterion": "Mentions alternative option", "points_earned": 10, "points_possible": 20, "met": false }
  ],
  "feedback_en": "Great job naming the Cabernet! Your explanation could include more about tannins and body...",
  "feedback_es": "Excelente al nombrar el Cabernet! Tu explicacion podria incluir mas sobre taninos y cuerpo..."
}
```
- **Prompt guidelines**: Evaluate strictly against rubric; partial credit allowed; feedback must be specific and encouraging

#### Prompt 3: `quiz-section-evaluation`
- **Category**: `system`
- **Purpose**: Generates dual student/manager feedback after quiz completion
- **Input context**: All quiz answers + scores, section content, competency thresholds
- **Output schema**:
```json
{
  "competency_level": "competent",
  "student_feedback": {
    "strengths": ["Strong knowledge of steak cuts", "Good wine vocabulary"],
    "areas_for_improvement": ["Practice describing dry-aging to guests", "Review wine temperatures"],
    "encouragement": "You're building a solid foundation! Your steak knowledge is excellent..."
  },
  "manager_feedback": {
    "competency_gaps": ["Wine service temperature", "Pairing confidence"],
    "recommended_actions": ["Pair with senior server for 2 wine services", "Review wine temp chart"],
    "risk_level": "low"
  }
}
```

**Deploy**: `npx supabase db push`

**Verify**:
```sql
SELECT slug, category, LEFT(prompt_en, 60) FROM ai_prompts
WHERE slug IN ('quiz-generator', 'quiz-voice-evaluator', 'quiz-section-evaluation');
```

---

### Step 3.2 — Enable Quiz on Server 101 Sections

**File**: `supabase/migrations/YYYYMMDDHHMMSS_enable_section_quizzes.sql` (NEW)

```sql
-- Enable quizzes on all published sections that have content
UPDATE public.course_sections
SET quiz_enabled = true,
    quiz_question_count = 5,
    quiz_passing_score = 70
WHERE status = 'published'
  AND content_source != 'custom';
```

This enables quizzes on all existing sections with real content. `custom` sections (overview-only) are excluded.

**Verify**:
```sql
SELECT slug, quiz_enabled, quiz_question_count, quiz_passing_score
FROM course_sections WHERE quiz_enabled = true;
```

---

### Step 3.3 — Deploy `course-quiz-generate` Edge Function

**File**: `supabase/functions/course-quiz-generate/index.ts` (NEW, ~250 lines)

**Purpose**: Generates quiz questions from section content using AI, persists them to `quiz_questions` table, returns question set for immediate use.

**Request**:
```typescript
interface QuizGenerateRequest {
  section_id: string;
  language: 'en' | 'es';
  groupId: string;
  question_count?: number;    // Default: section.quiz_question_count or 5
  force_regenerate?: boolean; // If true, generate new even if questions exist
}
```

**Flow**:
1. Auth: Verify JWT, extract userId (same pattern as `ask/index.ts`)
2. Fetch section config: `quiz_question_count`, `content_source`, `content_ids`
3. Check for existing active questions: `SELECT * FROM quiz_questions WHERE section_id = ? AND is_active = true`
4. If enough active questions exist AND `force_regenerate` is false → return existing questions (shuffled)
5. Fetch content from source table using `content_ids` (same serialization as `use-learning-session.ts`)
6. Fetch `quiz-generator` prompt from `ai_prompts`
7. Call OpenAI gpt-4o-mini with structured JSON output schema
8. Parse response, insert new questions into `quiz_questions` with `source = 'ai'`
9. Return question set (WITHOUT correct answers for MC — those stay server-side)

**Response** (client-safe — no correct answers):
```typescript
interface QuizGenerateResponse {
  questions: Array<{
    id: string;
    question_type: 'multiple_choice' | 'voice';
    question: string;      // Localized (en or es)
    options?: Array<{ id: string; text: string }>;  // MC only, no `correct` field
    rubric_summary?: string; // Voice only — brief description of what's being evaluated
    difficulty: string;
  }>;
  attempt_id: string;      // Pre-created quiz_attempt row
  total_questions: number;
  passing_score: number;
}
```

**Key decisions**:
- Questions go live immediately (no manager gate, per overview 7.2)
- Correct answers NEVER sent to client (grading is server-side)
- Creates a `quiz_attempts` row with `status: 'in_progress'` before returning
- Rate limiting: uses existing `get_user_usage` / `increment_usage` RPCs
- Content serialization: reuse the same `serializeItemContext()` pattern from `ask/index.ts`

**Deploy**: `npx supabase functions deploy course-quiz-generate`

---

### Step 3.4 — Deploy `course-evaluate` Edge Function

**File**: `supabase/functions/course-evaluate/index.ts` (NEW, ~300 lines)

**Purpose**: Handles two operations: (A) grade a single voice answer, (B) generate section evaluation after quiz completion.

**Request**:
```typescript
interface EvaluateRequest {
  action: 'grade_voice' | 'section_evaluation';
  language: 'en' | 'es';
  groupId: string;

  // For grade_voice:
  attempt_id?: string;
  question_id?: string;
  transcription?: string;

  // For section_evaluation:
  section_id?: string;
  enrollment_id?: string;
}
```

#### Action A: `grade_voice`

**Flow**:
1. Auth: Verify JWT, extract userId
2. Fetch question from `quiz_questions` (includes rubric JSONB)
3. Fetch section content for grounding context
4. Fetch `quiz-voice-evaluator` prompt from `ai_prompts`
5. Call OpenAI with structured JSON (rubric scoring schema)
6. Insert into `quiz_attempt_answers`:
   - `transcription`: student's text
   - `voice_score`: AI-computed score (0-100)
   - `voice_feedback_en` / `voice_feedback_es`: AI feedback
   - `transcription_expires_at`: `NOW() + INTERVAL '90 days'`
   - `is_correct`: `voice_score >= 70` (threshold)
7. Update `quiz_questions` analytics: `times_shown += 1`, `times_correct += (passed ? 1 : 0)`
8. Return score + feedback (localized)

**Response**:
```typescript
interface GradeVoiceResponse {
  voice_score: number;
  criteria_scores: Array<{ criterion: string; points_earned: number; points_possible: number; met: boolean }>;
  feedback: string;   // Localized
  passed: boolean;
}
```

#### Action B: `section_evaluation`

**Flow**:
1. Auth: Verify JWT, extract userId
2. Fetch the latest completed `quiz_attempts` for this section + user
3. Fetch all `quiz_attempt_answers` for that attempt
4. Compute final score: `(sum of correct MC + sum of voice scores) / total possible * 100`
5. Fetch `quiz-section-evaluation` prompt from `ai_prompts`
6. Call OpenAI with structured JSON (dual feedback schema)
7. Insert into `evaluations`:
   - `eval_type`: `'quiz'`
   - `student_feedback`: AI-generated (JSONB)
   - `manager_feedback`: AI-generated (JSONB)
   - `competency_level`: derived from score thresholds
8. Update `section_progress`:
   - `quiz_score`: final score
   - `quiz_passed`: score >= passing_score
   - `quiz_attempts`: increment
   - `status`: `'completed'` if passed
   - `completed_at`: timestamp if passed
9. Update `course_enrollments.completed_sections` count
10. Invalidation note: frontend will invalidate queries on response

**Response**:
```typescript
interface SectionEvaluationResponse {
  score: number;
  passed: boolean;
  competency_level: 'novice' | 'competent' | 'proficient' | 'expert';
  student_feedback: {
    strengths: string[];
    areas_for_improvement: string[];
    encouragement: string;
  };
  // manager_feedback NOT returned to student (RLS + edge function design)
}
```

**Competency thresholds**:
- 0-59: novice
- 60-79: competent
- 80-89: proficient
- 90-100: expert

**Deploy**: `npx supabase functions deploy course-evaluate`

---

### Step 3.5 — TypeScript Types

**File**: `src/types/training.ts` (MODIFY)

Add after existing types:

```typescript
// ─── QUIZ TYPES ─────────────────────────────────────────────────

export interface QuizQuestionOption {
  id: string;
  text: string;
}

export interface QuizQuestionClient {
  id: string;
  questionType: 'multiple_choice' | 'voice';
  question: string;
  options?: QuizQuestionOption[];
  rubricSummary?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizAttemptClient {
  attemptId: string;
  questions: QuizQuestionClient[];
  totalQuestions: number;
  passingScore: number;
}

export interface MCAnswerResult {
  questionId: string;
  isCorrect: boolean;
  correctOptionId: string;
  explanation: string;
}

export interface VoiceAnswerResult {
  questionId: string;
  voiceScore: number;
  criteriaScores: Array<{
    criterion: string;
    pointsEarned: number;
    pointsPossible: number;
    met: boolean;
  }>;
  feedback: string;
  passed: boolean;
}

export type AnswerResult = MCAnswerResult | VoiceAnswerResult;

export interface QuizResults {
  score: number;
  passed: boolean;
  competencyLevel: 'novice' | 'competent' | 'proficient' | 'expert';
  studentFeedback: {
    strengths: string[];
    areasForImprovement: string[];
    encouragement: string;
  };
  answers: AnswerResult[];
}

export type QuizState = 'loading' | 'ready' | 'in_progress' | 'grading_voice' | 'completing' | 'results';
```

---

### Step 3.6 — Create `use-quiz-session` Hook

**File**: `src/hooks/use-quiz-session.ts` (NEW, ~280 lines)

**Purpose**: Manages the full quiz lifecycle — fetch questions, navigate, submit answers, compute results.

**Signature**:
```typescript
export function useQuizSession({
  sectionId,
  enrollmentId,
  courseId,
  passingScore,
}: UseQuizSessionOptions): UseQuizSessionReturn
```

**State**:
```typescript
const [quizState, setQuizState] = useState<QuizState>('loading');
const [attempt, setAttempt] = useState<QuizAttemptClient | null>(null);
const [currentIndex, setCurrentIndex] = useState(0);
const [answers, setAnswers] = useState<Map<string, AnswerResult>>(new Map());
const [results, setResults] = useState<QuizResults | null>(null);
const [error, setError] = useState<string | null>(null);
```

**Key methods**:

1. `startQuiz()`:
   - Calls `supabase.functions.invoke('course-quiz-generate', { body: { section_id, language, groupId } })`
   - Sets `attempt` with returned questions
   - Sets `quizState` to `'ready'` then `'in_progress'` after user confirms start

2. `submitMCAnswer(questionId: string, selectedOptionId: string)`:
   - Calls `supabase.functions.invoke('course-evaluate', { body: { action: 'grade_mc', attempt_id, question_id, selected_option } })`
   - Stores result in `answers` map
   - Updates `quiz_attempt_answers` via edge function response
   - Auto-advances to next question after 2s feedback display

3. `submitVoiceAnswer(questionId: string, transcription: string)`:
   - Sets `quizState` to `'grading_voice'`
   - Calls `supabase.functions.invoke('course-evaluate', { body: { action: 'grade_voice', attempt_id, question_id, transcription } })`
   - Stores result in `answers` map
   - Returns to `'in_progress'` state

4. `completeQuiz()`:
   - Sets `quizState` to `'completing'`
   - Calls `supabase.functions.invoke('course-evaluate', { body: { action: 'section_evaluation', section_id, enrollment_id } })`
   - Sets `results` with returned evaluation
   - Sets `quizState` to `'results'`
   - Invalidates: `section-progress`, `course-sections`, `courses`, `programs`, `program-enrollment`

5. `retryQuiz()`:
   - Resets all state, calls `startQuiz()` again

**Return**:
```typescript
interface UseQuizSessionReturn {
  quizState: QuizState;
  attempt: QuizAttemptClient | null;
  currentQuestion: QuizQuestionClient | null;
  currentIndex: number;
  totalQuestions: number;
  answers: Map<string, AnswerResult>;
  results: QuizResults | null;
  error: string | null;
  startQuiz: () => Promise<void>;
  submitMCAnswer: (questionId: string, optionId: string) => Promise<void>;
  submitVoiceAnswer: (questionId: string, transcription: string) => Promise<void>;
  completeQuiz: () => Promise<void>;
  retryQuiz: () => Promise<void>;
  goToQuestion: (index: number) => void;
}
```

---

### Step 3.7 — Create Quiz UI Components (4 components)

#### Component 1: `src/components/training/QuizProgressBar.tsx` (NEW, ~40 lines)

Props: `{ current: number, total: number, answers: Map<string, AnswerResult>, className?: string }`

Visual: Horizontal dots/segments showing which questions are answered, current position, and pass/fail coloring.

```
  [●] [●] [○] [◉] [○]     3 of 5
  grn  grn      cur
```

- Answered correctly: green dot
- Answered incorrectly: red dot
- Current: outlined with pulse animation
- Unanswered: gray dot

#### Component 2: `src/components/training/QuizMCQuestion.tsx` (NEW, ~120 lines)

Props:
```typescript
interface QuizMCQuestionProps {
  question: QuizQuestionClient;
  onSubmit: (optionId: string) => Promise<void>;
  result?: MCAnswerResult;
  isSubmitting: boolean;
  language: 'en' | 'es';
}
```

Visual states:
1. **Answering**: Question text + 4 option buttons (full-width, tap targets >=44px)
2. **Submitted (correct)**: Selected option turns green, correct badge, explanation fades in
3. **Submitted (incorrect)**: Selected option turns red, correct option highlighted green, explanation fades in
4. **Submitting**: Selected option shows loading spinner

Layout:
```
┌─────────────────────────────────┐
│ What temperature is medium-rare? │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ A) 120F                      │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ B) 130F              ✓      │ │  ← green after correct
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ C) 145F                      │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ D) 160F                      │ │
│ └──────────────────────────────┘ │
│                                  │
│ "Medium-rare is 130F..."         │  ← explanation (after answer)
└─────────────────────────────────┘
```

#### Component 3: `src/components/training/QuizVoiceQuestion.tsx` (NEW, ~160 lines)

Props:
```typescript
interface QuizVoiceQuestionProps {
  question: QuizQuestionClient;
  onSubmit: (transcription: string) => Promise<void>;
  result?: VoiceAnswerResult;
  isGrading: boolean;
  language: 'en' | 'es';
}
```

Uses existing `useVoiceRecording` hook and `VoiceConsentDialog`.

Visual states:
1. **Ready**: Question text + scenario description + "Hold to Record" button + text fallback option
2. **Recording**: Pulsing red mic icon + elapsed timer + "Release to Submit" / "Cancel" buttons
3. **Transcribing**: "Transcribing..." with spinner
4. **Review**: Shows transcription text + "Submit" / "Re-record" buttons
5. **Grading**: "AI is evaluating..." with spinner
6. **Graded**: Score display + rubric breakdown + feedback text

Layout (Graded state):
```
┌─────────────────────────────────┐
│ Recommend a wine for the ribeye │
│                                  │
│ Your answer:                     │
│ "I'd recommend our Cabernet..."  │
│                                  │
│ Score: 75/100                    │
│ ┌────────────────────── ✓ 30/30 │
│ │ Names a specific wine          │
│ ├────────────────────── ✗ 20/30 │
│ │ Explains why it pairs well     │
│ ├────────────────────── ✓ 15/20 │
│ │ Confident, hospitable tone     │
│ ├────────────────────── ✗ 10/20 │
│ │ Mentions alternative           │
│ └────────────────────────────── │
│                                  │
│ "Great job naming the Cabernet!" │
└─────────────────────────────────┘
```

Text fallback: If user declines voice consent or recording fails, show a textarea input instead. The transcription is just the typed text — same grading pipeline.

#### Component 4: `src/components/training/QuizResults.tsx` (NEW, ~130 lines)

Props:
```typescript
interface QuizResultsProps {
  results: QuizResults;
  passingScore: number;
  onRetry: () => void;
  onContinue: () => void;
  language: 'en' | 'es';
}
```

Visual:
```
┌─────────────────────────────────┐
│          ┌─────────┐            │
│          │  85%    │            │  ← Large ProgressRing (green if pass, red if fail)
│          │ PASSED  │            │
│          └─────────┘            │
│                                  │
│  Level: Proficient               │
│                                  │
│  Strengths:                      │
│  ✓ Strong knowledge of steaks    │
│  ✓ Good wine vocabulary          │
│                                  │
│  Areas to improve:               │
│  → Practice dry-aging description │
│  → Review wine temperatures      │
│                                  │
│  "You're building a solid..."    │
│                                  │
│  [Continue to Next Section]      │  ← if passed
│  [Retry Quiz]                    │  ← always available
└─────────────────────────────────┘
```

- Passed: green ring, "PASSED" badge, "Continue" button primary
- Failed: red ring, "NOT YET" badge (encouraging language), "Retry" button primary, "Review Content" secondary

---

### Step 3.8 — Create QuizPage

**File**: `src/pages/QuizPage.tsx` (NEW, ~180 lines)

**URL**: `/courses/:programSlug/:courseSlug/:sectionSlug/quiz`

**Orchestrates**: `useQuizSession` hook + quiz components.

**Layout**:
```
┌─────────────────────────────────┐
│ ← Section Title    Quiz 3 of 5  │  ← Header with back + progress
├─────────────────────────────────┤
│                                  │
│  QuizProgressBar                 │
│                                  │
│  [QuizMCQuestion or              │
│   QuizVoiceQuestion]             │
│                                  │
│  [Next Question →]               │  ← after answering
│                                  │
├─────────────────────────────────┤
│  OR: QuizResults (when done)     │
└─────────────────────────────────┘
```

**States**:
1. `loading`: Spinner while generating/fetching questions
2. `ready`: "Start Quiz" button with question count + passing score info
3. `in_progress`: Question display with navigation
4. `grading_voice`: Loading overlay while AI grades voice answer
5. `completing`: Loading overlay while generating evaluation
6. `results`: Full results display with QuizResults component

**Auto-save**: Every answer is saved to `quiz_attempt_answers` immediately (via edge function). If user navigates away and returns, the attempt can be resumed.

**Back button**: Navigates to `/courses/:programSlug/:courseSlug/:sectionSlug` (learning session)

---

### Step 3.9 — Wire Quiz Button in TrainingChatPanel

**File**: `src/components/training/TrainingChatPanel.tsx` (MODIFY)

**Change**: Add `onStartQuiz` prop and wire the existing "Ready for the quiz?" button.

```typescript
// Add to props interface:
onStartQuiz?: () => void;

// Replace static button (line ~207):
{shouldSuggestQuiz && onStartQuiz && (
  <div className="flex justify-center">
    <Button
      variant="outline"
      size="sm"
      className="text-green-600 border-green-300 hover:bg-green-50"
      onClick={onStartQuiz}
    >
      {language === 'es'
        ? '¿Listo para el quiz?'
        : 'Ready for the quiz?'}
    </Button>
  </div>
)}
```

---

### Step 3.10 — Add Quiz Route + Navigation

#### Modify `src/App.tsx`

Add import:
```typescript
import QuizPage from "./pages/QuizPage";
```

Add route (after learning session route):
```tsx
<Route path="/courses/:programSlug/:courseSlug/:sectionSlug/quiz" element={
  <ProtectedRoute><QuizPage /></ProtectedRoute>
} />
```

#### Modify `src/pages/LearningSession.tsx`

Add quiz navigation:
```typescript
const navigate = useNavigate();

// Pass to TrainingChatPanel:
onStartQuiz={() => navigate(
  `/courses/${session.programSlug}/${session.courseSlug}/${session.sectionSlug}/quiz`
)}
```

#### Modify `src/lib/constants.ts`

Add route constant:
```typescript
COURSES_QUIZ: '/courses/:programSlug/:courseSlug/:sectionSlug/quiz',
```

---

### Step 3.11 — Update Section Progress for Quiz Results

**File**: `src/hooks/use-section-progress.ts` (MODIFY)

Add method to update quiz fields:
```typescript
const updateQuizResult = useCallback(async (score: number, passed: boolean) => {
  if (!progress) return;

  const updates: Record<string, unknown> = {
    quiz_score: score,
    quiz_passed: passed,
    quiz_attempts: (progress.quizAttempts || 0) + 1,
  };

  if (passed) {
    updates.status = 'completed';
    updates.completed_at = new Date().toISOString();
  }

  await supabase
    .from('section_progress')
    .update(updates)
    .eq('id', progress.id);

  // Update enrollment completed_sections count
  if (passed && enrollmentId) {
    const { count } = await supabase
      .from('section_progress')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'completed');

    await supabase
      .from('course_enrollments')
      .update({ completed_sections: count ?? 0 })
      .eq('id', enrollmentId);
  }

  invalidate();
}, [progress, enrollmentId]);
```

Add `updateQuizResult` to the returned object.

---

### Step 3.12 — Add MC Answer Grading to Edge Function

**Modification to Step 3.4**: The `course-evaluate` edge function also needs a `grade_mc` action that doesn't require AI:

#### Action C: `grade_mc` (server-side, no AI call)

**Flow**:
1. Auth: Verify JWT
2. Fetch question from `quiz_questions` (includes `options` JSONB with `correct: true/false`)
3. Check if `selected_option` matches the correct option
4. Insert into `quiz_attempt_answers`:
   - `selected_option`: student's choice
   - `is_correct`: boolean
   - `time_spent_seconds`: from request
5. Update `quiz_questions` analytics: `times_shown += 1`, `times_correct += (correct ? 1 : 0)`
6. Return: `{ is_correct, correct_option_id, explanation_en, explanation_es }`

This keeps correct answers server-side only — the client never receives them until after submission.

---

### Step 3.13 — Quiz Status in Section List

**File**: `src/components/training/SectionListItem.tsx` (MODIFY)

Add visual indicators for quiz status on the course detail page:

- Section has quiz enabled but not attempted: Small quiz icon (e.g., `ClipboardCheck`) in muted color
- Section quiz attempted but not passed: Quiz icon in orange/amber
- Section quiz passed: Quiz icon in green with checkmark

Read from the existing `section.progressStatus` and the `quizPassed` / `quizScore` fields already available in `SectionProgress`.

---

## Alignment Notes

### MC Grading is Server-Side Only
Correct answers for MC questions are NEVER sent to the client. The `course-quiz-generate` response strips the `correct` field from options. Grading happens in `course-evaluate` with `action: 'grade_mc'`. This prevents cheating by inspecting network responses.

### Voice Answer Text Fallback
If a user can't record voice (no mic, declined consent, noisy environment), they type their answer in a textarea. The same `grade_voice` action evaluates it — the transcription is just the typed text. This ensures voice questions are never blocking.

### Auto-Save Per Answer
Every answer is immediately persisted via the edge function. If the user closes the browser, they can resume the attempt. The `quiz_attempts` row tracks `status: 'in_progress'` until all questions are answered.

### Rate Limiting
Quiz generation and voice grading both count toward the user's daily/monthly AI usage limits (same `increment_usage` RPC). MC grading does NOT count (no AI call).

### Transcription Expiry
Voice transcriptions get `transcription_expires_at = NOW() + 90 days` per the existing schema design. The `cleanup_expired_training_data()` function (already exists) handles deletion.

---

## File Inventory

| # | File | Lines | Type |
|---|------|-------|------|
| 1 | `supabase/migrations/YYYYMMDDHHMMSS_seed_quiz_ai_prompts.sql` | ~120 | NEW |
| 2 | `supabase/migrations/YYYYMMDDHHMMSS_enable_section_quizzes.sql` | ~10 | NEW |
| 3 | `supabase/functions/course-quiz-generate/index.ts` | ~250 | NEW |
| 4 | `supabase/functions/course-evaluate/index.ts` | ~300 | NEW |
| 5 | `src/types/training.ts` | +60 | MODIFY |
| 6 | `src/hooks/use-quiz-session.ts` | ~280 | NEW |
| 7 | `src/components/training/QuizProgressBar.tsx` | ~40 | NEW |
| 8 | `src/components/training/QuizMCQuestion.tsx` | ~120 | NEW |
| 9 | `src/components/training/QuizVoiceQuestion.tsx` | ~160 | NEW |
| 10 | `src/components/training/QuizResults.tsx` | ~130 | NEW |
| 11 | `src/pages/QuizPage.tsx` | ~180 | NEW |
| 12 | `src/components/training/TrainingChatPanel.tsx` | +5 | MODIFY |
| 13 | `src/pages/LearningSession.tsx` | +5 | MODIFY |
| 14 | `src/hooks/use-section-progress.ts` | +25 | MODIFY |
| 15 | `src/components/training/SectionListItem.tsx` | +15 | MODIFY |
| 16 | `src/App.tsx` | +3 | MODIFY |
| 17 | `src/lib/constants.ts` | +1 | MODIFY |

**Total**: 10 new files, 7 modified files, ~1,700 new lines

---

## Verification Checklist

After implementing all steps:

### Database
- [ ] 3 new AI prompts seeded (`quiz-generator`, `quiz-voice-evaluator`, `quiz-section-evaluation`)
- [ ] Sections have `quiz_enabled = true` where appropriate
- [ ] Security advisors clean: `mcp__supabase__get_advisors --type security`

### Edge Functions
- [ ] `course-quiz-generate` deployed and returns questions (no correct answers in response)
- [ ] `course-evaluate` deployed with all 3 actions: `grade_mc`, `grade_voice`, `section_evaluation`
- [ ] Rate limiting works on quiz generate and voice grade
- [ ] MC grading returns correct answer + explanation only AFTER submission
- [ ] Voice grading returns rubric scores + feedback
- [ ] Section evaluation returns dual feedback (student only, no manager feedback)
- [ ] Voice transcriptions stored with 90-day expiry

### Frontend
- [ ] `/courses/:programSlug/:courseSlug/:sectionSlug/quiz` route works
- [ ] Quiz loads questions on page load
- [ ] MC questions: tap option → immediate feedback → auto-advance
- [ ] Voice questions: record → transcribe → review → submit → AI grades → show rubric
- [ ] Voice text fallback: textarea input works when mic unavailable
- [ ] VoiceConsentDialog appears on first voice question
- [ ] QuizProgressBar updates as questions are answered
- [ ] Quiz results page shows score, competency level, strengths, areas to improve
- [ ] "Continue to Next Section" navigates correctly after passing
- [ ] "Retry Quiz" resets and generates fresh questions
- [ ] "Ready for the quiz?" button in TrainingChatPanel navigates to quiz page
- [ ] SectionListItem shows quiz status indicators (pending/attempted/passed)
- [ ] Section progress updates with quiz_score, quiz_passed, quiz_attempts
- [ ] Course enrollment completed_sections count updates when quiz passed
- [ ] All query invalidation fires correctly (section-progress, courses, programs)
- [ ] 0 TypeScript errors
