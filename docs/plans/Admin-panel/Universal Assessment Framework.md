# Universal Assessment Framework

Sub-plan for the Master Implementation Plan. Defines how ALL course assessments — regardless of type — produce a universal grade + AI feedback that plugs into the dashboard, AI manager, and progression system.

---

## The Problem

The current system has:
- MC quiz scores that stop at `section_progress.quiz_score` and never roll up
- AI feedback that's generated but never persisted (evaluations table dropped)
- `course_enrollments.final_score` that exists but is never written
- `program_enrollments.overall_score` that's always NULL
- 3 question types defined (MC, voice, conversation) but only MC works
- No way for courses with different assessment approaches to produce comparable grades
- Course completion based on section count, not demonstrated competency

The vision requires courses with **varied assessment types** — some MC-only, some voice demos, some AI conversations, some with no quiz at all. New types will come later. The system can't assume which signals exist. But it must always produce the same output: **a score and AI feedback**.

---

## Core Principle

> **The evaluation IS the grade. Quiz scores are just inputs.**

A quiz score is a signal. A voice demo score is a signal. A conversation competency score is a signal. Time spent studying is a signal. These are raw data points.

The **evaluation** is what the AI produces after synthesizing whatever signals are available. It's the actual grade — a competency level, structured feedback, and a numeric score. This is what the dashboard shows, what the AI manager queries, and what drives progression.

---

## The Universal Evaluation Record

Every assessment milestone produces one evaluation. The shape is always the same, regardless of what type of assessment generated it.

```
evaluations
├── id (UUID PK)
├── user_id (FK → profiles)
├── enrollment_id (FK → course_enrollments, nullable)
├── course_id (FK → courses, nullable)
├── section_id (FK → course_sections, nullable)
├── group_id (FK → groups)
│
├── eval_type       TEXT NOT NULL
│   'section'       — after completing a section's assessment
│   'course'        — after completing all sections (course-level rollup)
│   'program'       — after completing all courses in a program (future)
│   'observation'   — manager-entered field observation (future)
│
├── eval_source     TEXT NOT NULL
│   'mc_quiz'       — generated from MC quiz results
│   'voice'         — generated from voice demonstration
│   'conversation'  — generated from AI conversation assessment
│   'composite'     — generated from multiple signal types
│   'tutor'         — generated from practice tutor session
│   'manager'       — manually entered by a manager
│   'rollup'        — auto-generated from child evaluations
│
│── THE UNIVERSAL OUTPUT (always present) ──────────────────
│
├── score           INTEGER NOT NULL CHECK (0-100)
├── passed          BOOLEAN NOT NULL
├── competency_level TEXT NOT NULL
│   'novice' | 'competent' | 'proficient' | 'expert'
│
├── student_feedback JSONB NOT NULL
│   {
│     "strengths": ["string array"],
│     "areas_for_improvement": ["string array"],
│     "encouragement": "string"
│   }
│
├── manager_feedback JSONB NOT NULL
│   {
│     "competency_gaps": ["string array"],
│     "recommended_actions": ["string array"],
│     "risk_level": "low" | "medium" | "high"
│   }
│
│── THE RAW SIGNALS (varies by assessment type) ────────────
│
├── signals         JSONB NOT NULL
│   (see Signal Shapes below)
│
│── METADATA ───────────────────────────────────────────────
│
├── ai_model        TEXT               — which model generated this
├── evaluated_by    UUID (nullable)    — NULL = AI, UUID = human
├── superseded_by   UUID (nullable)    — FK → evaluations (points to newer eval on retry)
├── manager_notes   TEXT (nullable)    — free-text from manager after review
│
├── created_at TIMESTAMPTZ NOT NULL
├── updated_at TIMESTAMPTZ NOT NULL
```

### Why `signals` JSONB?

This is the flexibility mechanism. Different courses produce different assessment data. The evaluation AI receives whatever signals exist and synthesizes them into the universal output. The `signals` column stores the raw inputs so they can be re-evaluated later if needed.

The system never needs to know in advance what signals a course will produce. It just stores what it gets.

---

## Signal Shapes (by source)

### MC Quiz Signal
```json
{
  "mc": {
    "score": 85,
    "questions_total": 10,
    "questions_correct": 8,
    "difficulty_breakdown": { "easy": 3, "medium": 5, "hard": 2 },
    "attempt_id": "uuid",
    "attempt_number": 1
  }
}
```

### Voice Demonstration Signal
```json
{
  "voice": {
    "score": 90,
    "rubric_scores": [
      { "criterion": "Menu knowledge", "points_earned": 38, "points_possible": 40 },
      { "criterion": "Guest engagement", "points_earned": 28, "points_possible": 30 },
      { "criterion": "Upselling technique", "points_earned": 24, "points_possible": 30 }
    ],
    "attempt_id": "uuid"
  }
}
```

### AI Conversation Signal
```json
{
  "conversation": {
    "competency_score": 82,
    "topics_covered": 8,
    "topics_total": 10,
    "teaching_moments": 2,
    "additional_questions": 1,
    "attempt_id": "uuid"
  }
}
```

### Tutor Readiness Signal
```json
{
  "tutor": {
    "readiness_score": 78,
    "topics_covered": ["wine regions", "food pairing", "service sequence"],
    "questions_asked": 12,
    "correct_answers": 9,
    "suggest_test": true,
    "conversation_id": "uuid"
  }
}
```

### Engagement Signal (always available — auto-collected)
```json
{
  "engagement": {
    "time_spent_seconds": 1200,
    "elements_viewed": 12,
    "elements_total": 15,
    "completion_rate": 0.8
  }
}
```

### Manager Observation Signal (future)
```json
{
  "observation": {
    "checklist_items": [
      { "item": "Greets table within 30 seconds", "met": true },
      { "item": "Describes specials without notes", "met": false }
    ],
    "observer_id": "uuid",
    "observed_at": "timestamp"
  }
}
```

### Composite Signal (course-level rollup)
```json
{
  "section_evaluations": [
    { "section_id": "uuid", "score": 85, "competency": "proficient", "source": "mc_quiz" },
    { "section_id": "uuid", "score": 72, "competency": "competent", "source": "conversation" },
    { "section_id": "uuid", "score": 90, "competency": "expert", "source": "mc_quiz" }
  ],
  "sections_completed": 3,
  "sections_total": 3
}
```

A signal can include multiple types. An MC + voice section:
```json
{
  "mc": { "score": 75, "questions_total": 5, "questions_correct": 4 },
  "voice": { "score": 90, "rubric_scores": [...] },
  "engagement": { "time_spent_seconds": 2400 }
}
```

---

## How Evaluations Are Created

### Section-Level Evaluation

When a student completes a section's assessment (whatever type that is):

```
1. Student finishes quiz / conversation / voice demo
2. Edge function collects signals from the attempt
3. Edge function adds engagement signal (time, elements viewed)
4. Edge function packages signals into JSONB
5. Edge function calls AI with:
   - System prompt: "evaluation-synthesizer" (universal prompt)
   - User message: the signals + section content summary + course context
6. AI returns: score, competency_level, student_feedback, manager_feedback
7. Edge function writes evaluation record
8. Trigger fires: updates section_progress and course_enrollments
```

The AI prompt doesn't say "grade this MC quiz" or "grade this conversation." It says:

> "Given the following assessment signals for this training section, evaluate the student's demonstrated competency. The signals represent the assessment data collected — use whatever is available. Produce a score (0-100), competency level, and dual feedback."

This means:
- MC-only course? AI gets MC signals. Works.
- Voice-only section? AI gets voice signals. Works.
- MC + conversation? AI gets both. Weighs them. Works.
- No quiz, just content consumption? AI gets engagement signals only. Produces a minimal evaluation. Works.
- New signal type added later? AI gets it in the signals blob. Adapts. Works.

### Course-Level Evaluation

When all sections are completed (or when a manager requests it):

```
1. Gather all section evaluations for this enrollment
2. Package them as a composite signal
3. Call AI with section evaluations + course context
4. AI produces course-level evaluation
5. Write evaluation with eval_type='course', eval_source='rollup'
6. Update course_enrollments.final_score and final_passed
7. Trigger fires: updates program_enrollments
```

### Program-Level Evaluation (future)

Same pattern — roll up course evaluations into a program evaluation.

---

## How This Changes Course Completion

### Current (broken)
```
Complete all sections (count-based) → course complete
Score is never recorded
```

### New
```
Complete all sections
  + Have a passing section evaluation for each assessed section
  → Generate course-level evaluation
  → course_enrollments.final_score = evaluation.score
  → course_enrollments.final_passed = evaluation.passed
  → course complete (if passed)
```

Not every section needs an assessment. The course configuration defines which sections require evaluation:

```
courses.assessment_config JSONB:
{
  "require_passing_evaluation": true,    // false = completion is just content consumption
  "passing_competency": "competent",     // minimum competency to pass the course
  "allow_retry": true,                   // can retake assessments
  "max_retries": null                    // null = unlimited
}
```

Informational courses (no quiz, just reading) set `require_passing_evaluation: false`. The student still gets an engagement-based evaluation, but it doesn't gate completion.

---

## How This Feeds the Dashboard

### Grades Tab
```sql
-- Per-student grades for a course
SELECT e.user_id, e.score, e.competency_level, e.passed,
       e.student_feedback, e.eval_source, e.created_at
FROM evaluations e
WHERE e.course_id = $1 AND e.eval_type = 'section'
ORDER BY e.created_at DESC;

-- Grade distribution
SELECT competency_level, COUNT(*)
FROM evaluations
WHERE course_id = $1 AND eval_type = 'course'
GROUP BY competency_level;
```

### AI Feedback Tab
```sql
-- Per-student coaching notes
SELECT e.user_id, e.student_feedback, e.manager_feedback,
       e.competency_level, e.signals, e.manager_notes
FROM evaluations e
WHERE e.course_id = $1 AND e.eval_type IN ('section', 'course')
ORDER BY e.created_at DESC;

-- Cohort-level strengths/weaknesses (aggregate student_feedback)
-- The AI Feedback tab's summary banner can be generated on-demand
-- by feeding all evaluations for a course into the AI
```

### KPI Strip
```sql
-- Avg Grade: from course-level evaluations
SELECT AVG(score) FROM evaluations
WHERE group_id = $1 AND eval_type = 'course';

-- Pass Rate: from course-level evaluations
SELECT COUNT(*) FILTER (WHERE passed) * 100.0 / COUNT(*)
FROM evaluations
WHERE group_id = $1 AND eval_type = 'course';

-- Competency Distribution
SELECT competency_level, COUNT(*)
FROM evaluations
WHERE group_id = $1 AND eval_type = 'course'
GROUP BY competency_level;
```

### AI Training Manager Tools
```sql
-- "Who's struggling?" → evaluations WHERE competency_level = 'novice'
-- "How's the new hire class doing?" → evaluations JOIN employees ON hire_date
-- "Which sections are hardest?" → evaluations WHERE eval_type = 'section'
--    GROUP BY section_id ORDER BY AVG(score) ASC
```

---

## How This Handles the "Varied Courses" Problem

| Course Type | Assessment Signals | Evaluation Still Works? |
|-------------|-------------------|----------------------|
| Menu Rollout (server) | MC quiz + voice demo (describe the dish) | Yes — AI weighs both signals |
| SOP Review (line cook) | MC quiz only | Yes — AI uses MC signal alone |
| Steps of Service | AI conversation (demonstrate guest interaction) | Yes — AI uses conversation signal |
| Wine Training | MC quiz + voice (recommend a pairing) | Yes — AI weighs both |
| Safety/Compliance | MC quiz only, strict passing (90%) | Yes — assessment_config sets high threshold |
| Onboarding Overview | No quiz, just read | Yes — engagement-only evaluation, no pass gate |
| Custom (admin-built) | Whatever the admin configures | Yes — signals are flexible |
| Future: observation-based | Manager checklist from floor | Yes — observation signal type |

The key: the evaluation prompt doesn't know or care what type of course it is. It receives signals and produces a universal grade. Course type affects which signals are *collected*, not how they're *evaluated*.

---

## Superseded Evaluations (Retries)

When a student retries an assessment:

1. New assessment generates new signals
2. New evaluation is created
3. Old evaluation gets `superseded_by = new_evaluation.id`
4. Dashboard shows the latest (non-superseded) evaluation
5. History is preserved — a manager can see all attempts

```sql
-- Current evaluation for a student/section
SELECT * FROM evaluations
WHERE user_id = $1 AND section_id = $2 AND superseded_by IS NULL
ORDER BY created_at DESC LIMIT 1;

-- Full history
SELECT * FROM evaluations
WHERE user_id = $1 AND section_id = $2
ORDER BY created_at DESC;
```

---

## The Evaluation Synthesizer Prompt

One universal AI prompt for all evaluation types. Stored in `ai_prompts` as `evaluation-synthesizer`.

```
You are an expert training evaluator for a restaurant operations platform.

You receive ASSESSMENT SIGNALS — raw data from various assessment types
(quizzes, voice demonstrations, AI conversations, engagement metrics, etc.).
Not all signal types will be present for every evaluation. Use whatever
signals are available.

From these signals, produce:

1. score (0-100): A holistic competency score. Weight signals by their
   reliability — a 10-question quiz is more reliable than a 3-question one.
   Engagement-only signals should produce conservative scores (50-70 range).

2. competency_level: novice (<60), competent (60-79), proficient (80-89),
   expert (90+)

3. student_feedback:
   - strengths: 2-4 specific things the student demonstrated well
   - areas_for_improvement: 1-3 specific, actionable areas to work on
   - encouragement: 1-2 sentences of genuine growth-oriented encouragement

4. manager_feedback:
   - competency_gaps: specific knowledge or skill gaps identified
   - recommended_actions: concrete next steps (re-study section X, practice Y)
   - risk_level: low (ready for floor), medium (needs more practice), high (not ready)

RULES:
- Never invent knowledge gaps not evidenced by the signals
- If only engagement signals exist (no quiz/voice/conversation), be conservative
- Student feedback must never contradict manager feedback — frame the same
  information positively for the student and objectively for the manager
- Include the assessment type context in your feedback (don't just say
  "you answered 8/10" — say "you demonstrated strong knowledge of X and Y")
```

This prompt works for ANY signal combination because it's told to "use whatever signals are available."

---

## Migration from Current State

### What changes in existing tables

```sql
-- course_enrollments: no schema change needed
-- final_score and final_passed already exist — just need to be WRITTEN
-- The evaluation trigger will handle this

-- section_progress: no schema change needed
-- quiz_score, quiz_passed already exist
-- The evaluation trigger can update these OR they stay as-is (quick-reference cache)

-- courses: ADD assessment_config JSONB
ALTER TABLE courses ADD COLUMN assessment_config JSONB NOT NULL DEFAULT '{
  "require_passing_evaluation": true,
  "passing_competency": "competent",
  "allow_retry": true,
  "max_retries": null
}';
```

### What gets created

```sql
-- 1. evaluations table (the core of this framework)
-- 2. evaluation-synthesizer AI prompt
-- 3. Trigger: after INSERT on evaluations → update section_progress + course_enrollments
-- 4. Trigger: after course_enrollments.final_score changes → update program_enrollments
--    (this trigger already exists but currently gets NULL — now it'll get real data)
```

### What gets modified in edge functions

```
course-evaluate:
  - section_evaluation action: after AI generates feedback, INSERT into evaluations
    (uncomment the existing commented-out code + add signals JSONB)
  - course_final action: same — INSERT into evaluations with composite signals
  - grade_voice (when Phase 7 comes): same pattern

course-assess:
  - When conversation wraps up: collect signals, call evaluation-synthesizer, INSERT

course-tutor:
  - When tutor recommends test: optionally create a tutor-readiness evaluation
```

The edge function changes are minimal. The evaluation INSERT was already designed — it was just commented out waiting for the table. We're adding the `signals` column and using a universal prompt instead of separate per-type prompts.

---

## What This Enables Later (Without More Schema Changes)

- **Voice grading (Phase 7)**: Just add voice signals to the evaluation. Same table, same prompt.
- **Module/certification tests (Phase 8)**: Composite evaluation from all sections. Same table.
- **Manager observations**: New signal type in the JSONB. Same table.
- **Peer assessments**: New signal type. Same table.
- **AI-recommended retakes**: Query evaluations WHERE competency_level = 'novice'. Same data.
- **Competency progression over time**: Query evaluations for a user ordered by created_at. See growth.
- **Cross-unit benchmarking**: Query evaluations by unit_id. Compare performance.

---

## Relationship to Master Plan

This framework is a **prerequisite for Phase A** (Foundation) and specifically enables:

| Master Plan Requirement | How This Framework Enables It |
|------------------------|------------------------------|
| Req 2: Dashboard data wiring | Evaluations table IS the data source for Grades + AI Feedback tabs |
| Req 3: Training DB for AI interaction | AI tools query evaluations for progress, struggles, insights |
| Req 5: AI training manager | Evaluations drive auto-assignment, contest eligibility, insights |
| Req 4: Multi-unit | Evaluations are group-scoped, will inherit unit_id via employee |

### Updated Phase A sequence:

```
A1. brands/units architecture (multi-tenant foundation)
A2. employees table (position, hire_date, phone)
A3. evaluations table (this framework) ← NEW, CRITICAL
A4. assessment_config on courses
A5. evaluation triggers (section → course → program score rollup)
A6. evaluation-synthesizer AI prompt
A7. Uncomment evaluation INSERTs in edge functions + add signals
A8. position_training_requirements table
```

A3-A7 form a tight unit. They should be built together as the "assessment foundation" before any dashboard work begins. Without evaluations persisted, the dashboard has nothing to show.
