-- =============================================================================
-- MIGRATION: create_run_auto_enrollment
-- Phase D: Core auto-enrollment engine
--
-- Iterates position_training_requirements and:
--   REQUIRED  -> auto-enrolls employees in each published course of the program,
--                creates 'executed' training_actions (audit trail),
--                sends notifications, upserts program_enrollments.
--   OPTIONAL  -> creates 'pending' training_actions for manager approval.
--
-- Idempotent: ON CONFLICT DO NOTHING on course_enrollments(user_id, course_id)
-- and program_enrollments(user_id, program_id).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.run_auto_enrollment()
RETURNS TABLE (enrollments_created INT, actions_proposed INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollments_created INT := 0;
  v_actions_proposed INT := 0;
  v_req RECORD;
  v_emp RECORD;
  v_course RECORD;
  v_course_count INT;
  v_already_enrolled BOOLEAN;
  v_existing_action BOOLEAN;
  v_inserted BOOLEAN;
BEGIN
  -- Iterate through all position_training_requirements for published programs
  FOR v_req IN
    SELECT ptr.*, tp.title_en AS program_title, tp.status AS program_status
    FROM public.position_training_requirements ptr
    JOIN public.training_programs tp ON tp.id = ptr.program_id
    WHERE tp.status = 'published'
  LOOP
    -- Find eligible employees: active/onboarding, matching position+group, linked to a profile
    FOR v_emp IN
      SELECT e.*
      FROM public.employees e
      WHERE e.group_id = v_req.group_id
        AND e.position = v_req.position
        AND e.employment_status IN ('active', 'onboarding')
        AND e.profile_id IS NOT NULL
    LOOP
      IF v_req.required THEN
        -- =====================================================================
        -- REQUIRED: Auto-enroll in each published course of the program
        -- =====================================================================
        FOR v_course IN
          SELECT c.id, c.title_en
          FROM public.courses c
          WHERE c.program_id = v_req.program_id
            AND c.status = 'published'
        LOOP
          -- Check if already enrolled (unique constraint: user_id, course_id)
          SELECT EXISTS (
            SELECT 1 FROM public.course_enrollments ce
            WHERE ce.user_id = v_emp.profile_id
              AND ce.course_id = v_course.id
          ) INTO v_already_enrolled;

          IF NOT v_already_enrolled THEN
            -- Create course enrollment
            INSERT INTO public.course_enrollments (
              id, user_id, course_id, group_id, status, expires_at, created_at
            ) VALUES (
              extensions.gen_random_uuid(),
              v_emp.profile_id,
              v_course.id,
              v_req.group_id,
              'enrolled',
              COALESCE(v_emp.hire_date, CURRENT_DATE) + (v_req.due_within_days * INTERVAL '1 day'),
              now()
            ) ON CONFLICT (user_id, course_id) DO NOTHING;

            -- Check if the INSERT actually happened (race-condition guard)
            GET DIAGNOSTICS v_inserted = ROW_COUNT;

            IF v_inserted THEN
              -- Create executed training action (audit trail)
              INSERT INTO public.training_actions (
                id, group_id, action_type, status, source,
                target_employee_id, target_program_id, target_course_id,
                display_data, expires_at
              ) VALUES (
                extensions.gen_random_uuid(),
                v_req.group_id,
                'auto_enroll',
                'executed',
                'system',
                v_emp.id,
                v_req.program_id,
                v_course.id,
                jsonb_build_object(
                  'title', 'Auto-enrolled: ' || v_emp.display_name,
                  'description', v_course.title_en || ' (required for ' || v_req.position || ')',
                  'priority', 'high',
                  'actions', '[]'::jsonb
                ),
                now() + INTERVAL '14 days'
              );

              -- Notify the employee
              PERFORM public.send_notification(
                v_req.group_id,
                v_emp.profile_id,
                'assignment',
                'New Training Assignment',
                'You have been enrolled in ' || v_course.title_en,
                jsonb_build_object('course_id', v_course.id, 'program_id', v_req.program_id)
              );

              v_enrollments_created := v_enrollments_created + 1;
            END IF;
          END IF;
        END LOOP;

        -- Upsert program enrollment
        -- Count published courses in the program
        SELECT COUNT(*) INTO v_course_count
        FROM public.courses c
        WHERE c.program_id = v_req.program_id AND c.status = 'published';

        INSERT INTO public.program_enrollments (
          id, user_id, program_id, group_id, status, total_courses, completed_courses, started_at
        ) VALUES (
          extensions.gen_random_uuid(),
          v_emp.profile_id,
          v_req.program_id,
          v_req.group_id,
          'enrolled',
          v_course_count,
          0,
          now()
        ) ON CONFLICT (user_id, program_id) DO NOTHING;

      ELSE
        -- =====================================================================
        -- OPTIONAL: Create pending training action for manager approval
        -- =====================================================================
        -- Check if a pending action already exists for this employee+program
        SELECT EXISTS (
          SELECT 1 FROM public.training_actions ta
          WHERE ta.target_employee_id = v_emp.id
            AND ta.target_program_id = v_req.program_id
            AND ta.status = 'pending'
            AND ta.group_id = v_req.group_id
        ) INTO v_existing_action;

        IF NOT v_existing_action THEN
          INSERT INTO public.training_actions (
            id, group_id, action_type, status, source,
            target_employee_id, target_program_id,
            display_data, expires_at
          ) VALUES (
            extensions.gen_random_uuid(),
            v_req.group_id,
            'auto_enroll',
            'pending',
            'system',
            v_emp.id,
            v_req.program_id,
            jsonb_build_object(
              'title', 'Suggest: Enroll ' || v_emp.display_name,
              'description', v_req.program_title || ' (optional for ' || v_req.position || ')',
              'priority', 'medium',
              'actions', jsonb_build_array('Approve', 'Skip')
            ),
            now() + INTERVAL '14 days'
          );

          v_actions_proposed := v_actions_proposed + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_enrollments_created, v_actions_proposed;
END;
$$;

COMMIT;
