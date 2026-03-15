-- =============================================================================
-- MIGRATION: create_auto_enroll_trigger
-- Phase D: Auto-enroll trigger on employees table
--
-- Fires AFTER UPDATE on employees when profile_id changes (IS DISTINCT FROM).
-- When profile_id transitions from NULL to non-NULL for an active/onboarding
-- employee, iterates position_training_requirements and:
--   REQUIRED  -> auto-enrolls in each published course of the program,
--                creates 'executed' training_actions (audit trail),
--                sends notifications, upserts program_enrollments.
--   OPTIONAL  -> creates 'pending' training_actions for manager approval.
--
-- Mirrors run_auto_enrollment() logic but scoped to a single employee row.
-- Idempotent: ON CONFLICT DO NOTHING on course_enrollments(user_id, course_id)
-- and program_enrollments(user_id, program_id).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_auto_enroll_on_employee_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_course RECORD;
  v_course_count INT;
  v_inserted INT;
BEGIN
  -- Only fire when profile_id changes from NULL to non-NULL
  IF OLD.profile_id IS NOT NULL OR NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only for active/onboarding employees
  IF NEW.employment_status NOT IN ('active', 'onboarding') THEN
    RETURN NEW;
  END IF;

  -- Find position training requirements for this employee
  FOR v_req IN
    SELECT ptr.*, tp.title_en AS program_title, tp.status AS program_status
    FROM public.position_training_requirements ptr
    JOIN public.training_programs tp ON tp.id = ptr.program_id
    WHERE ptr.group_id = NEW.group_id
      AND ptr.position = NEW.position
      AND tp.status = 'published'
  LOOP
    IF v_req.required THEN
      -- Auto-enroll in each published course
      FOR v_course IN
        SELECT c.id, c.title_en
        FROM public.courses c
        WHERE c.program_id = v_req.program_id AND c.status = 'published'
      LOOP
        INSERT INTO public.course_enrollments (
          id, user_id, course_id, group_id, status, expires_at, created_at
        ) VALUES (
          extensions.gen_random_uuid(),
          NEW.profile_id,
          v_course.id,
          NEW.group_id,
          'enrolled',
          COALESCE(NEW.hire_date, CURRENT_DATE) + (v_req.due_within_days * INTERVAL '1 day'),
          now()
        ) ON CONFLICT (user_id, course_id) DO NOTHING;

        -- Create executed audit action
        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        IF v_inserted > 0 THEN
          INSERT INTO public.training_actions (
            id, group_id, action_type, status, source,
            target_employee_id, target_program_id, target_course_id,
            display_data, expires_at
          ) VALUES (
            extensions.gen_random_uuid(), NEW.group_id, 'auto_enroll', 'executed', 'system',
            NEW.id, v_req.program_id, v_course.id,
            jsonb_build_object(
              'title', 'Auto-enrolled: ' || NEW.display_name,
              'description', v_course.title_en || ' (required for ' || NEW.position || ')',
              'priority', 'high',
              'actions', '[]'::jsonb
            ),
            now() + INTERVAL '14 days'
          );

          -- Notify the employee
          PERFORM public.send_notification(
            NEW.group_id, NEW.profile_id, 'assignment',
            'New Training Assignment',
            'You have been enrolled in ' || v_course.title_en,
            jsonb_build_object('course_id', v_course.id, 'program_id', v_req.program_id)
          );
        END IF;
      END LOOP;

      -- Upsert program enrollment
      SELECT COUNT(*) INTO v_course_count
      FROM public.courses WHERE program_id = v_req.program_id AND status = 'published';

      INSERT INTO public.program_enrollments (
        id, user_id, program_id, group_id, status, total_courses, completed_courses, started_at
      ) VALUES (
        extensions.gen_random_uuid(), NEW.profile_id, v_req.program_id, NEW.group_id,
        'enrolled', v_course_count, 0, now()
      ) ON CONFLICT (user_id, program_id) DO NOTHING;

    ELSE
      -- Optional: create pending training action for manager approval
      IF NOT EXISTS (
        SELECT 1 FROM public.training_actions ta
        WHERE ta.target_employee_id = NEW.id
          AND ta.target_program_id = v_req.program_id
          AND ta.status = 'pending'
          AND ta.group_id = NEW.group_id
      ) THEN
        INSERT INTO public.training_actions (
          id, group_id, action_type, status, source,
          target_employee_id, target_program_id,
          display_data, expires_at
        ) VALUES (
          extensions.gen_random_uuid(), NEW.group_id, 'auto_enroll', 'pending', 'system',
          NEW.id, v_req.program_id,
          jsonb_build_object(
            'title', 'Suggest: Enroll ' || NEW.display_name,
            'description', v_req.program_title || ' (optional for ' || NEW.position || ')',
            'priority', 'medium',
            'actions', jsonb_build_array('Approve', 'Skip')
          ),
          now() + INTERVAL '14 days'
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger definition
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_auto_enroll_on_employee_link ON public.employees;

CREATE TRIGGER trg_auto_enroll_on_employee_link
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  WHEN (OLD.profile_id IS DISTINCT FROM NEW.profile_id)
  EXECUTE FUNCTION public.trg_auto_enroll_on_employee_link();

COMMIT;
