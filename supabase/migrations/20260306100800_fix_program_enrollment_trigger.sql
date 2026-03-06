-- =============================================================================
-- Fix sync_program_enrollment_on_course_complete()
--
-- Issues fixed:
-- 1. v_total_courses counted only enrolled courses, not all program courses
--    → premature program completion if user hadn't enrolled in all courses
-- 2. section_progress INSERT policy lacked enrollment scoping
-- 3. course_conversations INSERT policy lacked group scoping
-- 4. increment_quiz_question_stats was callable by any authenticated user
-- =============================================================================

-- ─── Fix 1: Program enrollment trigger ─────────────────────────────────────────
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

  -- Count completed enrollments for this user in this program
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

-- ─── Fix 2: Tighten section_progress INSERT policy ─────────────────────────────
DROP POLICY IF EXISTS "Users can insert own section progress" ON public.section_progress;
CREATE POLICY "Users can insert own section progress"
  ON public.section_progress FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.id = section_progress.enrollment_id
        AND ce.user_id = auth.uid()
    )
  );

-- ─── Fix 3: Tighten course_conversations INSERT policy ─────────────────────────
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.course_conversations;
CREATE POLICY "Users can insert own conversations"
  ON public.course_conversations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      course_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_conversations.course_id
          AND c.group_id = public.get_user_group_id()
      )
    )
  );

-- ─── Fix 4: Restrict increment_quiz_question_stats to service_role ─────────────
REVOKE EXECUTE ON FUNCTION public.increment_quiz_question_stats(UUID, BOOLEAN) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_quiz_question_stats(UUID, BOOLEAN) FROM anon;
