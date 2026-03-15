-- =============================================================================
-- Assessment Framework Phase 1C: EVALUATION ROLLUP TRIGGER
--
-- 4 parts:
--   1. sync_evaluation_scores() — new function
--   2. trg_sync_evaluation_scores — new trigger on evaluations
--   3. Patch trg_sync_program_enrollment WHEN clause on course_enrollments
--   4. Replace sync_program_enrollment_on_course_complete() — remove stale guard
--
-- When an evaluation is inserted:
--   1. Auto-supersede any previous evaluation for the same (user, scope)
--   2. If eval_type='section': cache score to section_progress.quiz_score
--   3. If eval_type='course': write to course_enrollments.final_score
--
-- This is the SINGLE SOURCE OF TRUTH for score propagation.
-- Edge functions must NOT write to section_progress or course_enrollments
-- score fields directly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: sync_evaluation_scores() function
-- ---------------------------------------------------------------------------

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
      -- NOTE: This UPDATE triggers trg_sync_program_enrollment
      -- (patched below to also fire on final_score changes).
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- PART 2: Trigger on evaluations table
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_sync_evaluation_scores ON public.evaluations;

CREATE TRIGGER trg_sync_evaluation_scores
  AFTER INSERT ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_evaluation_scores();

-- ---------------------------------------------------------------------------
-- PART 3: Patch existing program enrollment trigger WHEN clause
-- ---------------------------------------------------------------------------

-- The existing trigger ONLY fires when completed_sections changes.
-- It must ALSO fire when final_score changes so the program enrollment
-- picks up the score written by the evaluation rollup.

DROP TRIGGER IF EXISTS trg_sync_program_enrollment ON public.course_enrollments;

CREATE TRIGGER trg_sync_program_enrollment
  AFTER UPDATE ON public.course_enrollments
  FOR EACH ROW
  WHEN (
    OLD.completed_sections IS DISTINCT FROM NEW.completed_sections
    OR OLD.final_score IS DISTINCT FROM NEW.final_score
  )
  EXECUTE FUNCTION public.sync_program_enrollment_on_course_complete();

-- ---------------------------------------------------------------------------
-- PART 4: Replace sync_program_enrollment_on_course_complete()
-- ---------------------------------------------------------------------------

-- The existing function has an early-exit guard:
--   IF OLD.completed_sections = NEW.completed_sections THEN RETURN NEW; END IF;
-- This blocks execution when only final_score changes. Remove it.
-- The WHEN clause on the trigger already filters for relevant changes.

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
