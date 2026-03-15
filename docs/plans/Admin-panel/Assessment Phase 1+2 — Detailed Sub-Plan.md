# Assessment Phase 1+2 -- Detailed Sub-Plan

Detailed implementation spec for Phases 1 (Database Foundation) and 2 (Edge Function) of the Universal Assessment Framework. Contains exact SQL, exact TypeScript diffs, and verification queries.

Parent: `docs/plans/Admin-panel/Assessment Framework -- Implementation Plan.md`
Design: `docs/plans/Admin-panel/Universal Assessment Framework.md`

---

## Audit Fixes Incorporated

These corrections from the framework audit are baked into every section below:

| # | Fix | Where Applied |
|---|-----|---------------|
| 1 | Trigger cascade: `sync_program_enrollment` WHEN clause must fire on BOTH `completed_sections` AND `final_score` changes | Migration C |
| 2 | Eliminate double-write: edge function stops writing to `section_progress` directly; the evaluation rollup trigger is the single source of truth for `quiz_score`/`quiz_passed` | Migration C + Edge Function 2A |
| 3 | MC-only evaluations skip AI: compute deterministic score, use template feedback, no credit charge | Edge Function 2A |
| 4 | AI failure recovery: course-level evaluation inserts minimal record with deterministic score on AI failure | Edge Function 2B |
| 5 | Add nullable `unit_id` to evaluations (no FK -- units table does not exist yet) | Migration A |
| 6 | Course evaluation auto-triggered SERVER-SIDE in `handleSectionEvaluation` when last assessed section is evaluated. Students NEVER call `course_final`. | Edge Function 2A |
| 7 | Define "sections needing assessment": only sections with >= 1 active `quiz_questions` row require evaluations | Edge Function 2B |
| 8 | Add `assessed_section_ids UUID[]` to `course_enrollments` — snapshot at enrollment time. Prevents adding sections from changing completion criteria. | Migration B |
| 9 | Server-side `groupId` validation: query `profiles.group_id` for auth user instead of trusting client-provided value | Edge Function 2A, 2B |

---

## Migration A: `evaluations` table

**File**: `supabase/migrations/20260316100000_create_evaluations_table.sql`

### CREATE TABLE

```sql
-- =============================================================================
-- Assessment Framework Phase 1A: EVALUATIONS TABLE
-- The universal grading entity. Every assessment milestone produces one row.
-- Quiz scores, voice demos, AI conversations are inputs (signals).
-- The evaluation IS the grade.
--
-- Uses:
--   - extensions.gen_random_uuid() for PK
--   - set_updated_at() trigger (shared, NOT recreated)
--   - RLS enabled with get_user_group_id() and get_user_role()
-- =============================================================================

CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),

  -- ── WHO / WHERE ───────────────────────────────────────────────────────────
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE SET NULL,
  course_id     UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  section_id    UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Future-proofing: nullable, no FK (units table does not exist yet)
  unit_id       UUID,

  -- ── TYPE / SOURCE ─────────────────────────────────────────────────────────
  eval_type     TEXT NOT NULL
    CHECK (eval_type IN ('section', 'course', 'program', 'observation')),

  eval_source   TEXT NOT NULL
    CHECK (eval_source IN (
      'mc_quiz', 'voice', 'conversation', 'composite',
      'tutor', 'manager', 'rollup'
    )),

  -- ── UNIVERSAL OUTPUT (always present) ─────────────────────────────────────
  score             INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  passed            BOOLEAN NOT NULL,
  competency_level  TEXT NOT NULL
    CHECK (competency_level IN ('novice', 'competent', 'proficient', 'expert')),

  student_feedback  JSONB NOT NULL,
  -- Expected shape: { strengths: string[], areas_for_improvement: string[], encouragement: string }

  manager_feedback  JSONB NOT NULL,
  -- Expected shape: { competency_gaps: string[], recommended_actions: string[], risk_level: "low"|"medium"|"high" }

  -- ── RAW SIGNALS (varies by assessment type) ───────────────────────────────
  signals           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Shape depends on eval_source. See Universal Assessment Framework.md for schemas.

  -- ── METADATA ──────────────────────────────────────────────────────────────
  ai_model          TEXT,              -- which model generated this evaluation (NULL for deterministic)
  evaluated_by      UUID,              -- NULL = AI-generated, UUID = human evaluator (FK to profiles intentionally omitted for flexibility)
  superseded_by     UUID,              -- FK to evaluations (self-referencing) — set when a retry creates a newer evaluation
  manager_notes     TEXT,              -- free-text from manager after review

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes

```sql
-- Current (non-superseded) evaluation for a user+section — the most common query
CREATE INDEX idx_evaluations_user_section_current
  ON public.evaluations(user_id, section_id)
  WHERE superseded_by IS NULL AND eval_type = 'section';

-- Current evaluation for a user+course
CREATE INDEX idx_evaluations_user_course_current
  ON public.evaluations(user_id, course_id)
  WHERE superseded_by IS NULL AND eval_type = 'course';

-- All evaluations for an enrollment (student progress view)
CREATE INDEX idx_evaluations_enrollment
  ON public.evaluations(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- Group-scoped evaluations by type (dashboard queries: grades tab, KPIs)
CREATE INDEX idx_evaluations_group_type
  ON public.evaluations(group_id, eval_type, created_at DESC);

-- Course-scoped evaluations by type (course detail view in dashboard)
CREATE INDEX idx_evaluations_course_type
  ON public.evaluations(course_id, eval_type, created_at DESC)
  WHERE course_id IS NOT NULL;
```

### RLS Policies (5 policies)

```sql
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- 1. Users can view their own evaluations
CREATE POLICY "Users can view own evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Managers can view all evaluations in their group
CREATE POLICY "Managers can view group evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- 3. Users can insert their own evaluations (edge function uses service role,
--    but this policy allows future client-side inserts if needed)
CREATE POLICY "Users can insert own evaluations"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Managers can insert evaluations for users in their group
--    (manager observations, manual evaluations)
CREATE POLICY "Managers can insert group evaluations"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- 5. Managers can update evaluations in their group
--    (add manager_notes, set superseded_by)
CREATE POLICY "Managers can update group evaluations"
  ON public.evaluations FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- No DELETE policy — evaluations are an audit trail. Superseded, never deleted.
```

### Trigger

```sql
CREATE TRIGGER trg_evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## Migration B: `assessment_config` column + `assessed_section_ids`

**File**: `supabase/migrations/20260316100100_add_assessment_config.sql`

### ALTER TABLE — courses

```sql
-- =============================================================================
-- Assessment Framework Phase 1B: ASSESSMENT CONFIG ON COURSES
-- Separate from quiz_config — different concern.
-- quiz_config: quiz mechanics (shuffle, question count, cooldown).
-- assessment_config: evaluation gating (require passing, competency threshold).
--
-- NOTE: quiz_config.passing_score controls the deterministic quiz score threshold.
-- assessment_config.passing_competency controls the AI evaluation competency gate.
-- A student can "pass the quiz" (score >= passing_score) but still receive a
-- "novice" competency if the evaluation synthesizer determines the demonstrated
-- knowledge is shallow. The assessment_config gate is the real completion gate.
-- =============================================================================

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS assessment_config JSONB NOT NULL DEFAULT '{
  "require_passing_evaluation": true,
  "passing_competency": "competent",
  "allow_retry": true,
  "max_retries": null
}'::jsonb;

-- NOTE: For informational courses (no quiz, just reading content), set:
--   assessment_config = { "require_passing_evaluation": false, ... }
-- This allows completion without an evaluation gate.
```

### ALTER TABLE — course_enrollments

```sql
-- =============================================================================
-- ASSESSED SECTION IDS — Snapshot at enrollment time
--
-- Stores the section IDs that have active quiz questions when the student enrolls.
-- This freezes the assessment scope: if a manager adds new sections or quiz questions
-- after enrollment, the in-flight student's completion criteria do not change.
--
-- NULL means legacy enrollment (created before this column existed).
-- Edge function falls back to querying current quiz_questions when NULL.
-- =============================================================================

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS assessed_section_ids UUID[];

-- Comment for clarity
COMMENT ON COLUMN public.course_enrollments.assessed_section_ids IS
  'Section IDs with active quiz questions at enrollment time. NULL = legacy, query current quiz_questions as fallback.';
```

No indexes needed -- `assessment_config` is read per-course, `assessed_section_ids` is read per-enrollment.

---

## Migration C: Evaluation rollup trigger

**File**: `supabase/migrations/20260316100200_evaluation_rollup_trigger.sql`

This migration creates one function and one trigger, then patches the existing program enrollment trigger's WHEN clause.

### Function: `sync_evaluation_scores()`

```sql
-- =============================================================================
-- Assessment Framework Phase 1C: EVALUATION ROLLUP TRIGGER
--
-- When an evaluation is inserted:
--   1. Auto-supersede any previous evaluation for the same (user, scope)
--   2. If eval_type='section': cache score to section_progress.quiz_score
--   3. If eval_type='course': write to course_enrollments.final_score
--
-- This is the SINGLE SOURCE OF TRUTH for score propagation.
-- Edge functions must NOT write to section_progress or course_enrollments
-- score fields directly.
--
-- SECURITY DEFINER: bypasses RLS to update tables the user might not have
-- UPDATE access to (e.g., section_progress updated by another user's manager eval).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_evaluation_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_eval_id UUID;
  v_enrollment_id UUID;
BEGIN
  -- ── STEP 1: Auto-supersede previous evaluation ────────────────────────────
  -- Find the most recent non-superseded evaluation for the same scope
  -- (same user + same section/course, depending on eval_type)

  IF NEW.eval_type = 'section' AND NEW.section_id IS NOT NULL THEN
    SELECT id INTO v_prev_eval_id
    FROM public.evaluations
    WHERE user_id = NEW.user_id
      AND section_id = NEW.section_id
      AND eval_type = 'section'
      AND superseded_by IS NULL
      AND id != NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

  ELSIF NEW.eval_type = 'course' AND NEW.course_id IS NOT NULL THEN
    SELECT id INTO v_prev_eval_id
    FROM public.evaluations
    WHERE user_id = NEW.user_id
      AND course_id = NEW.course_id
      AND eval_type = 'course'
      AND superseded_by IS NULL
      AND id != NEW.id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_prev_eval_id IS NOT NULL THEN
    UPDATE public.evaluations
    SET superseded_by = NEW.id
    WHERE id = v_prev_eval_id;
  END IF;

  -- ── STEP 2: Propagate scores to cached columns ───────────────────────────

  IF NEW.eval_type = 'section' AND NEW.section_id IS NOT NULL THEN
    -- Cache evaluation score into section_progress
    -- This is the ONLY writer to quiz_score/quiz_passed going forward.
    UPDATE public.section_progress
    SET
      quiz_score = NEW.score,
      quiz_passed = NEW.passed
    WHERE user_id = NEW.user_id
      AND section_id = NEW.section_id;

  ELSIF NEW.eval_type = 'course' AND NEW.course_id IS NOT NULL THEN
    -- Resolve enrollment_id: prefer the value on the evaluation, fall back to lookup
    v_enrollment_id := NEW.enrollment_id;
    IF v_enrollment_id IS NULL THEN
      SELECT id INTO v_enrollment_id
      FROM public.course_enrollments
      WHERE user_id = NEW.user_id
        AND course_id = NEW.course_id
      LIMIT 1;
    END IF;

    IF v_enrollment_id IS NOT NULL THEN
      UPDATE public.course_enrollments
      SET
        final_score = NEW.score,
        final_passed = NEW.passed
      WHERE id = v_enrollment_id;
      -- NOTE: This UPDATE triggers the existing sync_program_enrollment trigger
      -- (once its WHEN clause is patched below to also fire on final_score changes).
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

### Trigger binding

```sql
CREATE TRIGGER trg_sync_evaluation_scores
  AFTER INSERT ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_evaluation_scores();
```

### Patch: `sync_program_enrollment` WHEN clause

The existing trigger on `course_enrollments` only fires when `completed_sections` changes. It must ALSO fire when `final_score` changes so the program enrollment picks up the score.

```sql
-- Drop and re-create the trigger with expanded WHEN clause.
-- The function itself (sync_program_enrollment_on_course_complete) already reads
-- final_score — it just never fires because the WHEN clause doesn't include it.

DROP TRIGGER IF EXISTS trg_sync_program_enrollment ON public.course_enrollments;

CREATE TRIGGER trg_sync_program_enrollment
  AFTER UPDATE ON public.course_enrollments
  FOR EACH ROW
  WHEN (
    OLD.completed_sections IS DISTINCT FROM NEW.completed_sections
    OR OLD.final_score IS DISTINCT FROM NEW.final_score
  )
  EXECUTE FUNCTION public.sync_program_enrollment_on_course_complete();
```

**Why this works**: The existing function body already has `AVG(ce.final_score)` in its query. The only problem was that the trigger never fired when `final_score` changed (it was always NULL before). Now it fires on either change, and the AVG picks up the real scores.

The function body also has `IF OLD.completed_sections = NEW.completed_sections THEN RETURN NEW; END IF;` as an early exit. This must be removed because the function now also needs to run when `final_score` changes. We replace the function:

```sql
-- Replace the function body to remove the stale early-exit guard.
-- The WHEN clause on the trigger already filters for relevant changes,
-- so the function does not need its own guard.

CREATE OR REPLACE FUNCTION public.sync_program_enrollment_on_course_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_id UUID;
  v_total_courses INTEGER;
  v_completed_courses INTEGER;
  v_avg_score INTEGER;
  v_new_status TEXT;
BEGIN
  -- Check if this course belongs to a program
  SELECT c.program_id INTO v_program_id
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  -- No program association, nothing to sync
  IF v_program_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total published courses in this program (not just enrolled ones)
  SELECT COUNT(*)::INTEGER INTO v_total_courses
  FROM public.courses c
  WHERE c.program_id = v_program_id
    AND c.status = 'published';

  -- Count completed enrollments + average final_score for this user in this program
  SELECT
    COUNT(*) FILTER (WHERE ce.status = 'completed')::INTEGER,
    COALESCE(AVG(ce.final_score) FILTER (WHERE ce.final_score IS NOT NULL), NULL)::INTEGER
  INTO v_completed_courses, v_avg_score
  FROM public.courses c
  JOIN public.course_enrollments ce ON ce.course_id = c.id AND ce.user_id = NEW.user_id
  WHERE c.program_id = v_program_id;

  -- Determine program enrollment status
  IF v_completed_courses >= v_total_courses AND v_total_courses > 0 THEN
    v_new_status := 'completed';
  ELSIF v_completed_courses > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'enrolled';
  END IF;

  -- Upsert program enrollment
  INSERT INTO public.program_enrollments (
    user_id, program_id, group_id,
    status, started_at, completed_at,
    total_courses, completed_courses, overall_score
  ) VALUES (
    NEW.user_id, v_program_id, NEW.group_id,
    v_new_status,
    CASE WHEN v_new_status IN ('in_progress', 'completed') THEN COALESCE(
      (SELECT MIN(ce2.started_at) FROM public.course_enrollments ce2
       JOIN public.courses c2 ON c2.id = ce2.course_id
       WHERE ce2.user_id = NEW.user_id AND c2.program_id = v_program_id AND ce2.started_at IS NOT NULL),
      now()
    ) ELSE NULL END,
    CASE WHEN v_new_status = 'completed' THEN now() ELSE NULL END,
    v_total_courses, v_completed_courses, v_avg_score
  )
  ON CONFLICT (user_id, program_id) DO UPDATE SET
    status = EXCLUDED.status,
    started_at = COALESCE(program_enrollments.started_at, EXCLUDED.started_at),
    completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN COALESCE(EXCLUDED.completed_at, now()) ELSE NULL END,
    total_courses = EXCLUDED.total_courses,
    completed_courses = EXCLUDED.completed_courses,
    overall_score = EXCLUDED.overall_score;

  RETURN NEW;
END;
$$;
```

---

## Migration D: AI prompt + credit cost

**File**: `supabase/migrations/20260316100300_seed_evaluation_synthesizer_prompt.sql`

### Evaluation Synthesizer prompt (for multi-signal and course-level evals)

This prompt is ONLY called when:
- A section has multiple signal types (e.g., MC + voice), OR
- A course-level evaluation is being generated from section evaluations

MC-only section evaluations use template feedback and skip AI entirely.

```sql
-- =============================================================================
-- Assessment Framework Phase 1D: EVALUATION SYNTHESIZER PROMPT + CREDIT COSTS
--
-- evaluation-synthesizer: universal AI prompt for multi-signal evaluations.
-- MC-only evaluations use deterministic scoring + template feedback (no AI call).
-- =============================================================================

INSERT INTO public.ai_prompts (
  slug, category, domain, prompt_en, prompt_es, voice, is_active
)
VALUES (
  'evaluation-synthesizer',
  'system',
  NULL,
  E'You are an expert training evaluator for a restaurant operations platform.\n\nYou receive ASSESSMENT SIGNALS -- raw data from various assessment types (quizzes, voice demonstrations, AI conversations, engagement metrics, section evaluations, etc.). Not all signal types will be present for every evaluation. Use whatever signals are available.\n\nFrom these signals, produce a JSON object with exactly these fields:\n\n1. score (integer, 0-100): A holistic competency score.\n   - Weight signals by their reliability: a 10-question quiz is more reliable than a 3-question one.\n   - Voice and conversation signals carry more weight than pure MC when both are present.\n   - Engagement-only signals should produce conservative scores (50-70 range).\n   - For course-level rollups, weight section scores by section importance (assessed sections count more than informational ones).\n\n2. competency_level (string): Based on the score:\n   - \"novice\" if score < 60\n   - \"competent\" if score >= 60 and < 80\n   - \"proficient\" if score >= 80 and < 90\n   - \"expert\" if score >= 90\n\n3. student_feedback (object):\n   - strengths (array of 2-4 strings): Specific things the student demonstrated well. Reference actual content from the signals (e.g., \"You showed strong understanding of dry-aging temperatures\" not just \"Good quiz performance\").\n   - areas_for_improvement (array of 1-3 strings): Specific, actionable areas. Frame as growth opportunities, never as failures.\n   - encouragement (string): 1-2 sentences of warm, genuine, forward-looking encouragement. Use \"you\" language.\n\n4. manager_feedback (object):\n   - competency_gaps (array of strings): Specific knowledge or skill gaps identified from the signals. Be precise -- reference what was missed.\n   - recommended_actions (array of 1-3 strings): Concrete next steps the manager can take. Examples: \"Pair with experienced server for 2 wine services\", \"Re-study Section 3 on allergen protocols\", \"Schedule a follow-up voice assessment in 1 week\".\n   - risk_level (string): \"low\" (minor gaps, will improve with practice), \"medium\" (needs targeted coaching before unsupervised floor work), \"high\" (significant gaps, not ready for guest interaction in this area).\n\nRULES:\n- Never invent knowledge gaps not evidenced by the signals.\n- Student feedback must never contradict manager feedback -- frame the same information positively for the student and objectively for the manager.\n- If only engagement signals exist (no quiz/voice/conversation), be conservative with scores and explicit that assessment was limited.\n- Include the assessment type context in feedback (don''t just say \"you answered 8/10\" -- say \"you demonstrated strong knowledge of wine regions and service temperatures\").\n- For course-level evaluations with composite signals, synthesize across all sections -- identify patterns, not just averages.',

  E'Eres un evaluador experto de capacitacion para una plataforma de operaciones de restaurante.\n\nRecibes SENALES DE EVALUACION -- datos crudos de varios tipos de evaluacion (quizzes, demostraciones de voz, conversaciones con IA, metricas de participacion, evaluaciones de secciones, etc.). No todos los tipos de senales estaran presentes en cada evaluacion. Usa las senales que esten disponibles.\n\nA partir de estas senales, produce un objeto JSON con exactamente estos campos:\n\n1. score (entero, 0-100): Puntuacion holistica de competencia.\n   - Pondera las senales por su confiabilidad: un quiz de 10 preguntas es mas confiable que uno de 3.\n   - Las senales de voz y conversacion tienen mas peso que las de opcion multiple cuando ambas estan presentes.\n   - Senales solo de participacion deben producir puntuaciones conservadoras (rango 50-70).\n   - Para evaluaciones a nivel de curso, pondera las puntuaciones de seccion por importancia (secciones evaluadas cuentan mas que las informativas).\n\n2. competency_level (string): Basado en la puntuacion:\n   - \"novice\" si score < 60\n   - \"competent\" si score >= 60 y < 80\n   - \"proficient\" si score >= 80 y < 90\n   - \"expert\" si score >= 90\n\n3. student_feedback (objeto):\n   - strengths (array de 2-4 strings): Cosas especificas que el estudiante demostro bien. Referencia contenido real de las senales.\n   - areas_for_improvement (array de 1-3 strings): Areas especificas y accionables. Enmarca como oportunidades de crecimiento.\n   - encouragement (string): 1-2 oraciones de aliento genuino y orientado al futuro. Usa lenguaje de \"tu\".\n\n4. manager_feedback (objeto):\n   - competency_gaps (array de strings): Brechas de conocimiento o habilidad identificadas. Se preciso.\n   - recommended_actions (array de 1-3 strings): Proximos pasos concretos para el gerente.\n   - risk_level (string): \"low\", \"medium\", o \"high\".\n\nREGLAS:\n- Nunca inventes brechas de conocimiento no evidenciadas por las senales.\n- La retroalimentacion del estudiante nunca debe contradecir la del gerente.\n- Si solo hay senales de participacion, se conservador con las puntuaciones.\n- Para evaluaciones a nivel de curso, sintetiza entre todas las secciones -- identifica patrones, no solo promedios.',

  NULL,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  prompt_es = EXCLUDED.prompt_es,
  voice = EXCLUDED.voice,
  updated_at = now();
```

### Credit cost entries

```sql
-- ─── Evaluation credit costs ─────────────────────────────────────────────────
-- section_evaluation_mc: 0 credits (deterministic, no AI call)
-- section_evaluation_ai: 1 credit (multi-signal, uses evaluation-synthesizer)
-- course_evaluation:     1 credit (course-level rollup, uses evaluation-synthesizer)

INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description) VALUES
  (NULL, 'course_player', 'section_evaluation_mc', 0, 'Section evaluation (MC-only, deterministic, no AI)'),
  (NULL, 'course_player', 'section_evaluation_ai', 1, 'Section evaluation (multi-signal, AI synthesizer)'),
  (NULL, 'course_player', 'course_evaluation',     1, 'Course-level evaluation (AI synthesizer)')
ON CONFLICT (domain, action_type) WHERE group_id IS NULL
DO UPDATE SET
  credits = EXCLUDED.credits,
  description = EXCLUDED.description;
```

### MC template feedback structure

This is the feedback structure used for MC-only evaluations WITHOUT calling AI. Defined here for reference; the actual templates are hardcoded in the edge function (see Edge Function section below).

```
MC-Only Template Feedback Logic (edge function, not DB):

competency_level:
  score >= 90 → "expert"
  score >= 80 → "proficient"
  score >= 60 → "competent"
  score < 60  → "novice"

student_feedback:
  strengths:
    - If score >= 90: ["Excellent performance — you demonstrated mastery of this material"]
    - If score >= 70: ["Solid understanding of the core concepts in this section"]
    - If score < 70:  ["You showed familiarity with some key concepts"]
    - + "You answered {correct}/{total} questions correctly"
  areas_for_improvement:
    - If score < 100 AND missed questions exist:
      ["Review the topics where you missed questions, particularly: {missed_topic_list}"]
    - If score == 100: [] (empty)
  encouragement:
    - If passed: "Great work completing this assessment! Keep building on this foundation."
    - If not passed: "Don't be discouraged — review the material and try again. Each attempt helps reinforce your learning."

manager_feedback:
  competency_gaps:
    - List of missed question topics (extracted from question text/explanation)
    - If score == 100: [] (empty)
  recommended_actions:
    - If score < 60: ["Recommend re-studying this section before retaking the quiz"]
    - If score 60-79: ["Minor gaps — self-study should be sufficient"]
    - If score >= 80: ["On track — no immediate action needed"]
  risk_level:
    - score < 60: "high"
    - score 60-79: "medium"
    - score >= 80: "low"
```

---

## Migration C (continued): Full trigger cascade diagram

```
Student completes quiz
  │
  ├─► grade_mc (per question, no evaluation)
  │
  └─► section_evaluation (after all questions answered)
        │
        ├─► [MC-only] Deterministic score + template feedback
        │     │
        │     └─► INSERT evaluations (eval_type='section', eval_source='mc_quiz')
        │           │
        │           └─► TRIGGER: sync_evaluation_scores()
        │                 ├─► Supersede previous eval for same (user, section)
        │                 └─► UPDATE section_progress SET quiz_score, quiz_passed
        │
        ├─► [Multi-signal] Call evaluation-synthesizer AI
        │     │
        │     └─► INSERT evaluations (eval_type='section', eval_source='composite')
        │           │
        │           └─► (same trigger cascade as above)
        │
        └─► maybeAutoGenerateCourseEvaluation() checks if ALL assessed sections done
              │
              ├─► [Not all done] Return section result only
              │
              └─► [All done] Auto-generate course evaluation (server-side):

Edge function auto-triggers course evaluation (or manager clicks "Regenerate")
  │
  └─► generateCourseEvaluation (shared helper, also used by course_final)
        │
        ├─► Fetch all section evaluations
        ├─► Build composite signals
        ├─► Call evaluation-synthesizer AI
        │     │
        │     ├─► [Success] INSERT evaluations (eval_type='course', eval_source='rollup')
        │     │     │
        │     │     └─► TRIGGER: sync_evaluation_scores()
        │     │           ├─► Supersede previous course eval
        │     │           └─► UPDATE course_enrollments SET final_score, final_passed
        │     │                 │
        │     │                 └─► TRIGGER: sync_program_enrollment (WHEN clause now includes final_score)
        │     │                       └─► UPSERT program_enrollments SET overall_score = AVG(final_scores)
        │     │
        │     └─► [AI Failure] INSERT evaluations with deterministic avg + template feedback
        │           │
        │           └─► (same trigger cascade)
        │
        └─► Return evaluation to caller
```

---

## Edge Function Changes: `course-evaluate/index.ts`

### Overview of modifications

| Area | Current Behavior | New Behavior |
|------|-----------------|--------------|
| `handleSectionEvaluation` lines 372-393 | Writes directly to `section_progress.quiz_score/quiz_passed` | **REMOVE** direct write. Trigger handles it. |
| `handleSectionEvaluation` lines 396-410 | Returns template when usage exceeded | Unchanged (still returns template on usage limit) |
| `handleSectionEvaluation` lines 412-516 | Calls `quiz-section-evaluation` AI prompt, does NOT persist to evaluations | **REPLACE**: MC-only path uses deterministic scoring + template feedback + INSERT evaluation (no AI). Multi-signal path calls `evaluation-synthesizer` + INSERT evaluation. |
| `handleCourseFinal` lines 552-661 | Fetches section progress, calls AI, returns result, does NOT persist | **REPLACE**: Fetch section evaluations (not progress), build composite signals, call `evaluation-synthesizer`, INSERT evaluation. AI failure fallback inserts deterministic record. |

### 2A: `handleSectionEvaluation` -- Detailed changes

**REMOVE** the direct section_progress write block (lines 372-393):

```typescript
// ── REMOVE THIS ENTIRE BLOCK ────────────────────────────────────────────
// The evaluation rollup trigger is now the single source of truth.
// After INSERT into evaluations, the trigger updates section_progress.
//
// BEFORE (lines 372-393):
//   if (enrollment_id) {
//     const { data: progress } = await supabase
//       .from("section_progress")
//       .select("id, quiz_attempts")
//       ...
//     if (progress) {
//       await supabase.from("section_progress").update({
//         quiz_score: finalScore,
//         quiz_passed: passed,
//         quiz_attempts: (progress.quiz_attempts || 0) + 1,
//       }).eq("id", progress.id);
//     }
//   }
//
// AFTER: Removed entirely. The trigger handles quiz_score/quiz_passed.
// quiz_attempts is still incremented here (it's not evaluation data):
```

**KEEP** quiz_attempts increment (but isolate it from score writes):

```typescript
  // Increment quiz_attempts counter (this is attempt tracking, not scoring)
  if (enrollment_id) {
    const { data: progress } = await supabase
      .from("section_progress")
      .select("id, quiz_attempts")
      .eq("user_id", userId)
      .eq("section_id", section_id)
      .maybeSingle();

    if (progress) {
      await supabase
        .from("section_progress")
        .update({ quiz_attempts: (progress.quiz_attempts || 0) + 1 })
        .eq("id", progress.id);
    }
  }
```

**ADD** server-side `groupId` validation at top of handler (Audit Fix #9/15):

```typescript
  // ── SERVER-SIDE groupId VALIDATION ─────────────────────────────────────
  // Never trust client-provided groupId. Query the user's actual group.
  const { data: profile } = await supabase
    .from("profiles")
    .select("group_id")
    .eq("id", userId)
    .single();

  if (!profile?.group_id) {
    return errorResponse("forbidden", "User has no group membership", 403);
  }
  const validatedGroupId = profile.group_id as string;
  // Use validatedGroupId for ALL data writes below. Ignore client-provided groupId.
```

**REPLACE** the AI call + evaluation logic with MC-only deterministic path:

```typescript
  // ── Determine if this section has ONLY MC signals ─────────────────────
  // (For MVP, all sections are MC-only. Multi-signal support comes in Phase 7+.)
  const isMCOnly = true; // Future: check if section has voice/conversation questions too

  if (isMCOnly) {
    // ── MC-ONLY PATH: Deterministic score + template feedback ─────────
    // No AI call. No credit charge. Evaluation still persisted.

    const templateFeedback = buildMCTemplateFeedback(
      finalScore, passed, answers, language
    );

    // Build MC signal
    const mcSignal = {
      mc: {
        score: finalScore,
        questions_total: answers.length,
        questions_correct: answers.filter((a: Record<string, unknown>) => a.is_correct).length,
        difficulty_breakdown: countByDifficulty(answers),
        attempt_id: attempt_id as string,
        attempt_number: (attempt as Record<string, unknown>).attempt_number ?? 1,
      },
    };

    // INSERT evaluation — the trigger handles section_progress + superseding
    // NOTE: Uses validatedGroupId (server-side), NOT client-provided groupId
    const { error: evalError } = await supabase.from("evaluations").insert({
      user_id: userId,
      enrollment_id: (enrollment_id as string) || null,
      course_id: section?.course_id || null,
      section_id: section_id as string,
      group_id: validatedGroupId,
      eval_type: "section",
      eval_source: "mc_quiz",
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      student_feedback: templateFeedback.student_feedback,
      manager_feedback: templateFeedback.manager_feedback,
      signals: mcSignal,
      ai_model: null,  // No AI used
    });

    if (evalError) {
      console.error("[evaluate:section] Evaluation insert error:", evalError.message);
      // Non-fatal: return the result even if persistence fails
    }

    // Track credit usage: 0 credits for MC-only (still log the action)
    await trackAndIncrement(supabase, userId, validatedGroupId, 0, {
      domain: "course_player",
      action: "section_evaluation_mc",
      edge_function: "course-evaluate",
      model: null,
    });

    console.log(`[evaluate:section] MC-only | Score: ${finalScore}% | Level: ${competencyLevel}`);

    // ── AUTO-TRIGGER COURSE EVALUATION (server-side) ──────────────────
    // Check if ALL assessed sections now have evaluations.
    // If yes, auto-generate course evaluation in this same request.
    // This only adds latency on the LAST section quiz.
    let courseEvaluation = null;
    if (enrollment_id && section?.course_id) {
      courseEvaluation = await maybeAutoGenerateCourseEvaluation(
        supabase, userId, validatedGroupId,
        section.course_id as string,
        enrollment_id as string,
        language
      );
    }

    // Return student feedback only (manager feedback stays server-side)
    const response: Record<string, unknown> = {
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      student_feedback: templateFeedback.student_feedback,
    };
    if (courseEvaluation) {
      response.course_evaluation = {
        score: courseEvaluation.score,
        passed: courseEvaluation.passed,
        competency_level: courseEvaluation.competency_level,
        student_feedback: courseEvaluation.student_feedback,
      };
    }
    return jsonResponse(response);

  } else {
    // ── MULTI-SIGNAL PATH (future: Phase 7+) ─────────────────────────
    // Collect all signals, call evaluation-synthesizer, persist evaluation.
    // This path is not yet reachable but is structured for future use.

    // Check usage before AI call
    const usage = await checkUsage(supabase, userId, groupId);
    if (!usage?.can_ask) {
      // Fall back to deterministic evaluation
      const templateFeedback = buildMCTemplateFeedback(
        finalScore, passed, answers, language
      );
      // INSERT with template feedback (same as MC-only)
      await supabase.from("evaluations").insert({
        user_id: userId,
        enrollment_id: (enrollment_id as string) || null,
        course_id: section?.course_id || null,
        section_id: section_id as string,
        group_id: groupId,
        eval_type: "section",
        eval_source: "mc_quiz",
        score: finalScore,
        passed,
        competency_level: competencyLevel,
        student_feedback: templateFeedback.student_feedback,
        manager_feedback: templateFeedback.manager_feedback,
        signals: { mc: { score: finalScore } },
        ai_model: null,
      });
      return jsonResponse({
        score: finalScore,
        passed,
        competency_level: competencyLevel,
        student_feedback: templateFeedback.student_feedback,
      });
    }

    // Fetch evaluation-synthesizer prompt
    const { data: promptData } = await supabase
      .from("ai_prompts")
      .select("prompt_en, prompt_es")
      .eq("slug", "evaluation-synthesizer")
      .eq("is_active", true)
      .single();

    // ... build signals, call AI, INSERT evaluation, return result
    // (Full implementation deferred to Phase 7 when multi-signal is needed)

    return errorResponse("not_implemented", "Multi-signal evaluation not yet available", 501);
  }
```

**New helper functions** (add above `handleGradeMC`):

```typescript
// =============================================================================
// TEMPLATE FEEDBACK BUILDER (MC-only, no AI)
// =============================================================================

interface TemplateFeedback {
  student_feedback: {
    strengths: string[];
    areas_for_improvement: string[];
    encouragement: string;
  };
  manager_feedback: {
    competency_gaps: string[];
    recommended_actions: string[];
    risk_level: string;
  };
}

function buildMCTemplateFeedback(
  score: number,
  passed: boolean,
  answers: Record<string, unknown>[],
  language: string,
): TemplateFeedback {
  const isEs = language === "es";
  const total = answers.length;
  const correct = answers.filter((a) => a.is_correct).length;

  // Extract missed question topics from question text
  const missedTopics: string[] = [];
  for (const a of answers) {
    if (!a.is_correct) {
      const q = a.quiz_questions as Record<string, unknown> | null;
      if (q) {
        const text = (isEs && q.question_es ? q.question_es : q.question_en) as string;
        // Take first 60 chars of the question as a topic hint
        if (text) missedTopics.push(text.substring(0, 60).trim());
      }
    }
  }

  // ── Student feedback ──────────────────────────────────────────────────
  const strengths: string[] = [];
  if (score >= 90) {
    strengths.push(
      isEs
        ? "Excelente desempeno -- demostraste dominio de este material"
        : "Excellent performance -- you demonstrated mastery of this material"
    );
  } else if (score >= 70) {
    strengths.push(
      isEs
        ? "Buena comprension de los conceptos principales de esta seccion"
        : "Solid understanding of the core concepts in this section"
    );
  } else {
    strengths.push(
      isEs
        ? "Mostraste familiaridad con algunos conceptos clave"
        : "You showed familiarity with some key concepts"
    );
  }
  strengths.push(
    isEs
      ? `Respondiste ${correct}/${total} preguntas correctamente`
      : `You answered ${correct}/${total} questions correctly`
  );

  const areasForImprovement: string[] = [];
  if (score < 100 && missedTopics.length > 0) {
    const topicList = missedTopics.slice(0, 3).join("; ");
    areasForImprovement.push(
      isEs
        ? `Revisa los temas donde fallaste, particularmente: ${topicList}`
        : `Review the topics where you missed questions, particularly: ${topicList}`
    );
  }

  const encouragement = passed
    ? (isEs
        ? "Buen trabajo completando esta evaluacion! Sigue construyendo sobre esta base."
        : "Great work completing this assessment! Keep building on this foundation.")
    : (isEs
        ? "No te desanimes -- repasa el material e intentalo de nuevo. Cada intento refuerza tu aprendizaje."
        : "Don't be discouraged -- review the material and try again. Each attempt helps reinforce your learning.");

  // ── Manager feedback ──────────────────────────────────────────────────
  const competencyGaps = missedTopics.length > 0
    ? missedTopics.slice(0, 5)
    : [];

  const recommendedActions: string[] = [];
  if (score < 60) {
    recommendedActions.push(
      isEs
        ? "Recomendar re-estudiar esta seccion antes de repetir el quiz"
        : "Recommend re-studying this section before retaking the quiz"
    );
  } else if (score < 80) {
    recommendedActions.push(
      isEs
        ? "Brechas menores -- el auto-estudio deberia ser suficiente"
        : "Minor gaps -- self-study should be sufficient"
    );
  } else {
    recommendedActions.push(
      isEs
        ? "En buen camino -- no se necesita accion inmediata"
        : "On track -- no immediate action needed"
    );
  }

  const riskLevel = score < 60 ? "high" : score < 80 ? "medium" : "low";

  return {
    student_feedback: { strengths, areas_for_improvement: areasForImprovement, encouragement },
    manager_feedback: { competency_gaps: competencyGaps, recommended_actions: recommendedActions, risk_level: riskLevel },
  };
}

// =============================================================================
// DIFFICULTY COUNTER (for MC signal)
// =============================================================================

function countByDifficulty(
  answers: Record<string, unknown>[],
): Record<string, number> {
  const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  for (const a of answers) {
    const q = a.quiz_questions as Record<string, unknown> | null;
    if (q) {
      const diff = (q.difficulty as string) || "medium";
      counts[diff] = (counts[diff] || 0) + 1;
    }
  }
  return counts;
}
```

### 2A-continued: `maybeAutoGenerateCourseEvaluation` helper

This function is called at the end of `handleSectionEvaluation`. It checks if all assessed sections now have evaluations, and if so, generates the course evaluation automatically. Returns `null` if not all sections are evaluated yet.

```typescript
async function maybeAutoGenerateCourseEvaluation(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,  // Already validated server-side
  courseId: string,
  enrollmentId: string,
  language: string,
): Promise<CourseEvalResult | null> {
  const isEs = language === "es";

  // 1. Get assessed_section_ids from enrollment (snapshot)
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("assessed_section_ids")
    .eq("id", enrollmentId)
    .single();

  let assessedSectionIds: string[];

  if (enrollment?.assessed_section_ids && enrollment.assessed_section_ids.length > 0) {
    // Use snapshot
    assessedSectionIds = enrollment.assessed_section_ids as string[];
  } else {
    // Legacy enrollment: fall back to current quiz_questions
    const { data: sections } = await supabase
      .from("course_sections")
      .select("id")
      .eq("course_id", courseId);

    if (!sections || sections.length === 0) return null;

    const sectionIds = sections.map((s: Record<string, unknown>) => s.id as string);
    const { data: questionsPerSection } = await supabase
      .from("quiz_questions")
      .select("section_id")
      .in("section_id", sectionIds)
      .eq("is_active", true);

    assessedSectionIds = [
      ...new Set((questionsPerSection || []).map((q: Record<string, unknown>) => q.section_id as string))
    ];
  }

  if (assessedSectionIds.length === 0) return null; // No assessed sections

  // 2. Fetch current evaluations for all assessed sections
  const { data: sectionEvals } = await supabase
    .from("evaluations")
    .select("section_id, score, passed, competency_level, eval_source")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("eval_type", "section")
    .is("superseded_by", null);

  const evaluatedSectionIds = new Set(
    (sectionEvals || []).map((e: Record<string, unknown>) => e.section_id as string)
  );

  // 3. Check: do ALL assessed sections have evaluations?
  const allAssessed = assessedSectionIds.every((id) => evaluatedSectionIds.has(id));
  if (!allAssessed) return null; // Not all sections done yet

  console.log(`[evaluate:section] All ${assessedSectionIds.length} assessed sections evaluated. Auto-generating course evaluation.`);

  // 4. Build composite signals + generate course evaluation
  //    (reuses the same logic as handleCourseFinal but without the role check)
  return await generateCourseEvaluation(
    supabase, userId, groupId, courseId, enrollmentId,
    sectionEvals as Record<string, unknown>[],
    assessedSectionIds.length,
    language
  );
}
```

The `generateCourseEvaluation` helper is shared between `maybeAutoGenerateCourseEvaluation` (student flow, auto-triggered) and `handleCourseFinal` (manager flow, manual). This avoids duplicating the AI call + evaluation INSERT logic.

### 2B: `handleCourseFinal` -- Detailed changes

**Manager-only action.** NOT called by students. Used for re-evaluation / regeneration.

Replace the entire function body. Key differences from current:

1. Fetches section **evaluations** (not section_progress)
2. Uses `assessed_section_ids` from enrollment (Audit Fix #8), falls back to quiz_questions if NULL
3. Builds composite signals from evaluation scores
4. Calls `evaluation-synthesizer` (not `quiz-section-evaluation`)
5. Persists evaluation to `evaluations` table
6. On AI failure: inserts deterministic evaluation with average score
7. Validates `groupId` server-side (Audit Fix #9)

```typescript
async function handleCourseFinal(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  body: Record<string, unknown>,
  language: string,
) {
  const { target_user_id, course_id, enrollment_id } = body;

  if (!target_user_id || !course_id) {
    return errorResponse("bad_request", "target_user_id and course_id are required", 400);
  }

  // 1. Server-side groupId validation (Audit Fix #9)
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("group_id")
    .eq("id", userId)
    .single();

  if (!callerProfile?.group_id) {
    return errorResponse("forbidden", "Caller has no group membership", 403);
  }
  const validatedGroupId = callerProfile.group_id as string;

  // 2. Verify caller is manager or admin
  const { data: membership } = await supabase
    .from("group_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("group_id", validatedGroupId)
    .single();

  const callerRole = membership?.role as string | null;
  if (!callerRole || (callerRole !== "manager" && callerRole !== "admin")) {
    return errorResponse("forbidden", "Only managers and admins can generate course evaluations", 403);
  }

  // 3. Get assessed_section_ids from enrollment (Audit Fix #8)
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("assessed_section_ids")
    .eq("id", enrollment_id as string)
    .single();

  let assessedSectionIds: string[];

  if (enrollment?.assessed_section_ids && (enrollment.assessed_section_ids as string[]).length > 0) {
    assessedSectionIds = enrollment.assessed_section_ids as string[];
  } else {
    // Legacy enrollment: fall back to current quiz_questions
    const { data: allSections } = await supabase
      .from("course_sections")
      .select("id")
      .eq("course_id", course_id as string);

    if (!allSections || allSections.length === 0) {
      return errorResponse("not_found", "No sections found for this course", 404);
    }

    const sectionIds = allSections.map((s: Record<string, unknown>) => s.id as string);
    const { data: questionsPerSection } = await supabase
      .from("quiz_questions")
      .select("section_id")
      .in("section_id", sectionIds)
      .eq("is_active", true);

    assessedSectionIds = [
      ...new Set((questionsPerSection || []).map((q: Record<string, unknown>) => q.section_id as string))
    ];
  }

  const sectionsWithQuiz = new Set(assessedSectionIds);

  // Fetch section details for feedback context
  const { data: allSections } = await supabase
    .from("course_sections")
    .select("id, title_en, title_es, sort_order")
    .eq("course_id", course_id as string)
    .order("sort_order");

  if (!allSections || allSections.length === 0) {
    return errorResponse("not_found", "No sections found for this course", 404);
  }

  // 3. Fetch current (non-superseded) section evaluations for target user
  const { data: sectionEvals } = await supabase
    .from("evaluations")
    .select("*")
    .eq("user_id", target_user_id as string)
    .eq("course_id", course_id as string)
    .eq("eval_type", "section")
    .is("superseded_by", null);

  const evalsMap = new Map<string, Record<string, unknown>>();
  for (const ev of (sectionEvals || [])) {
    evalsMap.set(ev.section_id as string, ev);
  }

  // Check: all assessed sections must have evaluations
  const missingSections: string[] = [];
  for (const sectionId of sectionsWithQuiz) {
    if (!evalsMap.has(sectionId)) {
      const sec = allSections.find((s: Record<string, unknown>) => s.id === sectionId);
      missingSections.push(
        (language === "es" && (sec as Record<string, unknown>)?.title_es)
          ? (sec as Record<string, unknown>).title_es as string
          : (sec as Record<string, unknown>)?.title_en as string || sectionId
      );
    }
  }

  if (missingSections.length > 0) {
    return errorResponse(
      "incomplete",
      `Missing evaluations for sections: ${missingSections.join(", ")}`,
      400
    );
  }

  // 4. Build composite signals
  const isEs = language === "es";
  const sectionEvalSignals = Array.from(evalsMap.values()).map((ev) => ({
    section_id: ev.section_id as string,
    score: ev.score as number,
    competency: ev.competency_level as string,
    source: ev.eval_source as string,
    passed: ev.passed as boolean,
  }));

  const compositeSignals = {
    section_evaluations: sectionEvalSignals,
    sections_completed: sectionEvalSignals.length,
    sections_total: sectionsWithQuiz.size,
  };

  // Calculate deterministic average (used as fallback and for quick reference)
  const avgScore = sectionEvalSignals.length > 0
    ? Math.round(
        sectionEvalSignals.reduce((sum, e) => sum + e.score, 0) / sectionEvalSignals.length
      )
    : 0;

  const allPassed = sectionEvalSignals.every((e) => e.passed);

  let deterministicLevel: string;
  if (avgScore >= 90) deterministicLevel = "expert";
  else if (avgScore >= 80) deterministicLevel = "proficient";
  else if (avgScore >= 60) deterministicLevel = "competent";
  else deterministicLevel = "novice";

  // 5. Check usage before AI call
  const usage = await checkUsage(supabase, userId, groupId);
  if (!usage?.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429);
  }

  // 6. Fetch evaluation-synthesizer prompt
  const { data: promptData } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", "evaluation-synthesizer")
    .eq("is_active", true)
    .single();

  const systemPrompt = promptData
    ? (isEs && promptData.prompt_es ? promptData.prompt_es : promptData.prompt_en)
    : "You are an expert training evaluator for a restaurant. Generate a comprehensive evaluation based on the student's section evaluation scores.";

  // 7. Build AI context
  const evalContext = sectionEvalSignals
    .map((e) => {
      const sec = allSections.find((s: Record<string, unknown>) => s.id === e.section_id);
      const title = isEs && (sec as Record<string, unknown>)?.title_es
        ? (sec as Record<string, unknown>).title_es as string
        : (sec as Record<string, unknown>)?.title_en as string || "Unknown";
      return `Section: ${title}\n  Score: ${e.score}%\n  Competency: ${e.competency}\n  Source: ${e.source}\n  Passed: ${e.passed}`;
    })
    .join("\n\n");

  const userPrompt = `COURSE-LEVEL EVALUATION (composite of all section evaluations)

Section Evaluations:
${evalContext}

Average Score: ${avgScore}%
All Sections Passed: ${allPassed ? "Yes" : "No"}
Sections Evaluated: ${sectionEvalSignals.length}/${sectionsWithQuiz.size}

Generate the course-level evaluation with score, competency_level, student_feedback, and manager_feedback.`;

  // 8. Call AI (with failure recovery)
  console.log("[evaluate:course_final] Calling evaluation-synthesizer AI...");

  let evalResult: SectionEvalResult;
  let aiModel: string | null = "gpt-5.2";

  try {
    evalResult = await callOpenAI<SectionEvalResult>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      schema: sectionEvalSchema,
      schemaName: "course_evaluation",
      maxTokens: 1200,
      model: "gpt-5.2",
    });
  } catch (err) {
    // ── AI FAILURE RECOVERY ──────────────────────────────────────────────
    // Insert a minimal evaluation with deterministic score + template feedback.
    // Log the failure. Do NOT block the manager's workflow.
    console.error("[evaluate:course_final] AI error:", err instanceof Error ? err.message : err);

    aiModel = null; // Mark as non-AI
    evalResult = {
      competency_level: deterministicLevel,
      student_feedback: {
        strengths: [
          isEs
            ? `Completaste todas las evaluaciones de seccion con un promedio de ${avgScore}%`
            : `You completed all section evaluations with an average score of ${avgScore}%`,
        ],
        areas_for_improvement: avgScore < 80
          ? [isEs
              ? "Revisa las secciones donde obtuviste puntuaciones mas bajas"
              : "Review sections where you scored lower"]
          : [],
        encouragement: isEs
          ? "Buen trabajo completando el curso!"
          : "Great work completing the course!",
      },
      manager_feedback: {
        competency_gaps: sectionEvalSignals
          .filter((e) => e.score < 70)
          .map((e) => {
            const sec = allSections.find((s: Record<string, unknown>) => s.id === e.section_id);
            return `${(sec as Record<string, unknown>)?.title_en || e.section_id}: ${e.score}%`;
          }),
        recommended_actions: avgScore < 60
          ? ["Schedule targeted review sessions for weak sections"]
          : avgScore < 80
            ? ["Monitor progress on lower-scoring sections"]
            : ["Student is on track -- no immediate action needed"],
        risk_level: avgScore < 60 ? "high" : avgScore < 80 ? "medium" : "low",
      },
    };

    console.warn("[evaluate:course_final] Using deterministic fallback evaluation");
  }

  // 9. Determine final score from AI result
  const courseScore = evalResult.competency_level === "expert" ? Math.max(avgScore, 90)
    : evalResult.competency_level === "proficient" ? Math.max(avgScore, 80)
    : evalResult.competency_level === "competent" ? Math.max(avgScore, 60)
    : avgScore;

  // Use passing_competency from assessment_config to determine passed status
  const { data: course } = await supabase
    .from("courses")
    .select("assessment_config")
    .eq("id", course_id as string)
    .single();

  const assessmentConfig = (course?.assessment_config || {}) as Record<string, unknown>;
  const passingCompetency = (assessmentConfig.passing_competency as string) || "competent";
  const competencyOrder = ["novice", "competent", "proficient", "expert"];
  const coursePassed = competencyOrder.indexOf(evalResult.competency_level)
    >= competencyOrder.indexOf(passingCompetency);

  // 10. INSERT evaluation (uses validatedGroupId, not client-provided)
  const { error: evalError } = await supabase.from("evaluations").insert({
    user_id: target_user_id as string,
    enrollment_id: (enrollment_id as string) || null,
    course_id: course_id as string,
    section_id: null,
    group_id: validatedGroupId,
    eval_type: "course",
    eval_source: "rollup",
    score: courseScore,
    passed: coursePassed,
    competency_level: evalResult.competency_level,
    student_feedback: evalResult.student_feedback,
    manager_feedback: evalResult.manager_feedback,
    signals: compositeSignals,
    ai_model: aiModel,
    evaluated_by: userId, // Manager triggered this
  });

  if (evalError) {
    console.error("[evaluate:course_final] Evaluation insert error:", evalError.message);
    // Non-fatal: return the result even if persistence fails
  }

  // 11. Track credit usage (1 credit for course evaluation)
  await trackAndIncrement(supabase, userId, groupId, 1, {
    domain: "course_player",
    action: "course_evaluation",
    edge_function: "course-evaluate",
    model: aiModel || "deterministic",
  });

  console.log(`[evaluate:course_final] Score: ${courseScore}% | Level: ${evalResult.competency_level} | AI: ${aiModel ? "yes" : "fallback"}`);

  // 12. Return both feedbacks (caller is manager)
  return jsonResponse({
    score: courseScore,
    passed: coursePassed,
    competency_level: evalResult.competency_level,
    student_feedback: evalResult.student_feedback,
    manager_feedback: evalResult.manager_feedback,
    ai_generated: aiModel !== null,
  });
}
```

### 2C: Updated `sectionEvalSchema`

The existing schema is fine for the AI response format. It does NOT include `score` or `passed` because those are computed deterministically (MC-only) or by the AI + validated against competency rules. The schema only captures what the AI decides:

```typescript
// No change needed to sectionEvalSchema — it already matches the required shape:
// { competency_level, student_feedback: { strengths, areas_for_improvement, encouragement },
//   manager_feedback: { competency_gaps, recommended_actions, risk_level } }
```

### 2D: What NOT to change

- `handleGradeMC` -- **No changes**. Still grades individual MC questions server-side. 0 credits.
- The `grade_voice`, `module_test_evaluation`, `conversation_evaluation` stubs -- **No changes**. Still return 501.
- The main handler `Deno.serve(...)` -- **No changes** to routing.

---

## Verification Steps

### After Migration A (evaluations table)

```sql
-- V1: Table exists with correct columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'evaluations'
ORDER BY ordinal_position;
-- Expected: 20 columns (id, user_id, enrollment_id, course_id, section_id,
--   group_id, unit_id, eval_type, eval_source, score, passed, competency_level,
--   student_feedback, manager_feedback, signals, ai_model, evaluated_by,
--   superseded_by, manager_notes, created_at, updated_at)

-- V2: RLS enabled
SELECT relrowsecurity FROM pg_class WHERE relname = 'evaluations';
-- Expected: true

-- V3: Policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'evaluations';
-- Expected: 5 policies (2 SELECT, 2 INSERT, 1 UPDATE)

-- V4: Indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'evaluations';
-- Expected: 5 indexes + PK
```

### After Migration B (assessment_config + assessed_section_ids)

```sql
-- V5: assessment_config column exists with default
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'courses' AND column_name = 'assessment_config';
-- Expected: assessment_config with JSON default

-- V6: Default value is correct
SELECT assessment_config FROM courses LIMIT 1;
-- Expected: {"require_passing_evaluation": true, "passing_competency": "competent", "allow_retry": true, "max_retries": null}

-- V6b: assessed_section_ids column exists on course_enrollments
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'course_enrollments' AND column_name = 'assessed_section_ids';
-- Expected: assessed_section_ids, ARRAY, YES (nullable for legacy enrollments)
```

### After Migration C (rollup trigger)

```sql
-- V7: Trigger function exists
SELECT proname FROM pg_proc WHERE proname = 'sync_evaluation_scores';
-- Expected: 1 row

-- V8: Trigger bound to evaluations
SELECT tgname, tgtype FROM pg_trigger WHERE tgrelid = 'evaluations'::regclass;
-- Expected: trg_sync_evaluation_scores (AFTER INSERT) + trg_evaluations_updated_at (BEFORE UPDATE)

-- V9: Program enrollment trigger WHEN clause updated
SELECT pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgname = 'trg_sync_program_enrollment';
-- Expected: WHEN clause contains both completed_sections AND final_score

-- V10: Test the cascade — insert a section evaluation, verify section_progress updated
-- (Requires test data: a user, enrollment, section_progress row)
INSERT INTO evaluations (user_id, enrollment_id, course_id, section_id, group_id,
  eval_type, eval_source, score, passed, competency_level,
  student_feedback, manager_feedback, signals)
VALUES (
  '<test_user_id>', '<test_enrollment_id>', '<test_course_id>', '<test_section_id>', '<test_group_id>',
  'section', 'mc_quiz', 85, true, 'proficient',
  '{"strengths":["test"],"areas_for_improvement":[],"encouragement":"test"}'::jsonb,
  '{"competency_gaps":[],"recommended_actions":[],"risk_level":"low"}'::jsonb,
  '{"mc":{"score":85}}'::jsonb
);

-- Then verify:
SELECT quiz_score, quiz_passed FROM section_progress
WHERE user_id = '<test_user_id>' AND section_id = '<test_section_id>';
-- Expected: quiz_score=85, quiz_passed=true
```

### After Migration D (prompt + credit costs)

```sql
-- V11: Evaluation synthesizer prompt exists
SELECT slug, category, is_active,
  LEFT(prompt_en, 50) AS prompt_preview
FROM ai_prompts WHERE slug = 'evaluation-synthesizer';
-- Expected: 1 row, is_active=true

-- V12: Credit cost entries exist
SELECT domain, action_type, credits FROM credit_costs
WHERE action_type IN ('section_evaluation_mc', 'section_evaluation_ai', 'course_evaluation')
  AND group_id IS NULL;
-- Expected: 3 rows (0, 1, 1 credits)
```

### After Edge Function Deploy (Phase 2)

```bash
# V13: Deploy the function
npx supabase functions deploy course-evaluate --no-verify-jwt

# V14: Test MC grading (unchanged, sanity check)
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/course-evaluate \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "grade_mc",
    "groupId": "<group_id>",
    "attempt_id": "<attempt_id>",
    "question_id": "<question_id>",
    "selected_option": "a"
  }'
# Expected: 200 with is_correct, correct_option_id, explanation

# V15: Test section evaluation (MC-only path)
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/course-evaluate \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "section_evaluation",
    "groupId": "<group_id>",
    "attempt_id": "<completed_attempt_id>",
    "section_id": "<section_id>",
    "enrollment_id": "<enrollment_id>"
  }'
# Expected: 200 with score, passed, competency_level, student_feedback
# AND: evaluations table has a new row with eval_type='section', ai_model=null
# AND: section_progress.quiz_score matches the evaluation score

# V16: Test course evaluation AUTO-TRIGGER
# Complete the LAST section quiz for a course where all other sections are already evaluated.
# The section_evaluation response should include a `course_evaluation` field.
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/course-evaluate \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "section_evaluation",
    "groupId": "<group_id>",
    "attempt_id": "<last_section_completed_attempt_id>",
    "section_id": "<last_section_id>",
    "enrollment_id": "<enrollment_id>"
  }'
# Expected: 200 with score, passed, competency_level, student_feedback
# AND: response includes `course_evaluation` field (auto-generated)
# AND: evaluations table has TWO new rows: eval_type='section' + eval_type='course'
# AND: course_enrollments.final_score matches the course evaluation score
# AND: program_enrollments.overall_score updated (if course is in a program)

# V17: Test course_final as MANAGER (re-evaluation)
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/course-evaluate \
  -H "Authorization: Bearer <manager_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "course_final",
    "groupId": "<group_id>",
    "target_user_id": "<student_user_id>",
    "course_id": "<course_id>",
    "enrollment_id": "<enrollment_id>"
  }'
# Expected: 200 with score, passed, competency_level, student_feedback, manager_feedback
# AND: previous course evaluation superseded
```

### Expected data after a full quiz completion flow

```
1. Student answers 10 MC questions via grade_mc:
   → quiz_attempt_answers: 10 rows
   → quiz_questions: times_shown/times_correct incremented

2. Student triggers section_evaluation:
   → quiz_attempts: status='completed', score=80, passed=true
   → evaluations: 1 new row
       eval_type='section', eval_source='mc_quiz'
       score=80, passed=true, competency_level='proficient'
       ai_model=NULL (MC-only, deterministic)
       signals = { mc: { score: 80, questions_total: 10, questions_correct: 8, ... } }
       student_feedback = { strengths: [...], areas_for_improvement: [...], encouragement: "..." }
       manager_feedback = { competency_gaps: [...], recommended_actions: [...], risk_level: "low" }
   → section_progress: quiz_score=80, quiz_passed=true (written by trigger, NOT edge function)
   → credit charge: 0 (MC-only)

3. Last section evaluation auto-triggers course evaluation (server-side):
   → Edge function detects all 7/7 assessed sections have evaluations
   → Calls generateCourseEvaluation() automatically
   → evaluations: 1 new row
       eval_type='course', eval_source='rollup'
       score=82, competency_level='proficient'
       ai_model='gpt-5.2'
       signals = { section_evaluations: [...], sections_completed: 7, sections_total: 7 }
       evaluated_by = NULL (auto-generated, not manager-triggered)
   → course_enrollments: final_score=82, final_passed=true (written by trigger)
   → program_enrollments: overall_score=82 (written by cascading trigger)
   → credit charge: 1
   → Student receives BOTH section eval + course eval in the response

4. (Optional) Manager manually triggers course_final for re-evaluation:
   → Same flow as #3, but evaluated_by = <manager_user_id>
   → Previous course evaluation superseded
```

---

## Migration File Names (final)

```
supabase/migrations/20260316100000_create_evaluations_table.sql     — Migration A
supabase/migrations/20260316100100_add_assessment_config.sql         — Migration B
supabase/migrations/20260316100200_evaluation_rollup_trigger.sql     — Migration C
supabase/migrations/20260316100300_seed_evaluation_synthesizer_prompt.sql — Migration D
```

## Edge Function Files Modified

```
supabase/functions/course-evaluate/index.ts   — Phase 2 (all 2A/2B/2C/2D changes)
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Trigger creates infinite loop (evaluation INSERT triggers section_progress UPDATE which triggers... ) | `sync_evaluation_scores` writes to `section_progress` and `course_enrollments`. Neither of those tables has a trigger that writes back to `evaluations`. No loop. |
| Supersede logic races with concurrent retries | The supersede query uses `ORDER BY created_at DESC LIMIT 1` and only sets `superseded_by` on the single most recent predecessor. If two evaluations insert simultaneously, both supersede the same old one. The newer one (by `created_at`) is the canonical "current" because dashboard queries use `WHERE superseded_by IS NULL ORDER BY created_at DESC LIMIT 1`. |
| AI failure on course evaluation leaves no grade | AI failure recovery path inserts a deterministic evaluation with average score + template feedback. Manager can retry later to get AI-enriched feedback. |
| `unit_id` column with no FK | Intentional. The column is nullable with no foreign key because the units table does not exist yet. When the multi-unit architecture is built, a migration will add the FK constraint. This avoids blocking the assessment framework on multi-unit work. |
| Template feedback quality for MC-only | Templates are functional but generic. When a section has only 3 questions, the feedback is thin. This is acceptable -- these sections are simple assessments. Rich AI feedback is reserved for multi-signal evaluations where the cost is justified. |
