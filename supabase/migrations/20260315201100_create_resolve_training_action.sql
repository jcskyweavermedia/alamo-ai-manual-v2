-- =============================================================================
-- MIGRATION: create_resolve_training_action
-- Phase D: Manager resolution of pending training actions (approve / skip)
--
-- Allows managers to approve or skip pending training actions.
-- On approval of auto_enroll actions: enrolls employee in courses, sends notification.
-- On approval of nudge actions: sends nudge notification.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_training_action(
  p_action_id UUID,
  p_resolution TEXT,        -- 'approved' or 'skipped'
  p_note TEXT DEFAULT NULL   -- optional manager note
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action RECORD;
  v_new_status TEXT;
  v_profile_id UUID;
  v_course RECORD;
  v_course_count INT;
BEGIN
  -- ─── 1. Validate resolution ───────────────────────────────────────────────
  IF p_resolution NOT IN ('approved', 'skipped') THEN
    RAISE EXCEPTION 'Invalid resolution: %. Must be ''approved'' or ''skipped''.', p_resolution;
  END IF;

  -- ─── 2. Fetch the action ──────────────────────────────────────────────────
  SELECT *
    INTO v_action
    FROM public.training_actions
   WHERE id = p_action_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Training action % not found.', p_action_id;
  END IF;

  IF v_action.status != 'pending' THEN
    RAISE EXCEPTION 'Training action % is not pending (current status: %).', p_action_id, v_action.status;
  END IF;

  -- ─── 3. Security check ────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id = v_action.group_id
      AND gm.role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: must be a manager or admin in the target group';
  END IF;

  -- ─── 4. Update the action ─────────────────────────────────────────────────
  IF p_resolution = 'approved' THEN
    v_new_status := 'executed';
  ELSE
    v_new_status := 'skipped';
  END IF;

  UPDATE public.training_actions
     SET status          = v_new_status,
         resolved_by     = auth.uid(),
         resolved_at     = now(),
         resolution_note = p_note
   WHERE id = p_action_id;

  -- ─── 5. Side effects (only when approved) ─────────────────────────────────
  IF p_resolution = 'approved' THEN

    -- ── 5a. auto_enroll actions ─────────────────────────────────────────────
    IF v_action.action_type = 'auto_enroll' THEN

      -- Look up the employee's profile_id
      SELECT e.profile_id
        INTO v_profile_id
        FROM public.employees e
       WHERE e.id = v_action.target_employee_id;

      IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Employee % has no linked profile.', v_action.target_employee_id;
      END IF;

      IF v_action.target_course_id IS NOT NULL THEN
        -- Enroll in a specific course
        INSERT INTO public.course_enrollments (id, user_id, course_id, group_id, status, created_at)
        VALUES (
          extensions.gen_random_uuid(),
          v_profile_id,
          v_action.target_course_id,
          v_action.group_id,
          'enrolled',
          now()
        )
        ON CONFLICT (user_id, course_id) DO NOTHING;

        -- Notify
        PERFORM public.send_notification(
          v_action.group_id,
          v_profile_id,
          'assignment',
          'New Training Assignment',
          'You have been enrolled in ' || COALESCE(
            (SELECT c.title_en FROM public.courses c WHERE c.id = v_action.target_course_id),
            'a course'
          ),
          jsonb_build_object('action_id', p_action_id)
        );

      ELSIF v_action.target_program_id IS NOT NULL THEN
        -- Enroll in ALL published courses of the program
        FOR v_course IN
          SELECT c.id, c.title_en
            FROM public.courses c
           WHERE c.program_id = v_action.target_program_id
             AND c.status = 'published'
        LOOP
          INSERT INTO public.course_enrollments (id, user_id, course_id, group_id, status, created_at)
          VALUES (
            extensions.gen_random_uuid(),
            v_profile_id,
            v_course.id,
            v_action.group_id,
            'enrolled',
            now()
          )
          ON CONFLICT (user_id, course_id) DO NOTHING;
        END LOOP;

        -- Upsert program enrollment
        SELECT COUNT(*) INTO v_course_count
          FROM public.courses c
         WHERE c.program_id = v_action.target_program_id
           AND c.status = 'published';

        INSERT INTO public.program_enrollments (
          id, user_id, program_id, group_id, status, total_courses, completed_courses, started_at
        ) VALUES (
          extensions.gen_random_uuid(),
          v_profile_id,
          v_action.target_program_id,
          v_action.group_id,
          'enrolled',
          v_course_count,
          0,
          now()
        )
        ON CONFLICT (user_id, program_id) DO NOTHING;

        -- Notify
        PERFORM public.send_notification(
          v_action.group_id,
          v_profile_id,
          'assignment',
          'New Training Assignment',
          'You have been enrolled in ' || COALESCE(
            (SELECT tp.title_en FROM public.training_programs tp WHERE tp.id = v_action.target_program_id),
            'a training program'
          ),
          jsonb_build_object('action_id', p_action_id)
        );
      END IF;

    -- ── 5b. nudge actions ───────────────────────────────────────────────────
    ELSIF v_action.action_type = 'nudge' THEN

      -- Look up the employee's profile_id
      SELECT e.profile_id
        INTO v_profile_id
        FROM public.employees e
       WHERE e.id = v_action.target_employee_id;

      IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Employee % has no linked profile.', v_action.target_employee_id;
      END IF;

      PERFORM public.send_notification(
        v_action.group_id,
        v_profile_id,
        'nudge',
        COALESCE(v_action.display_data->>'title', 'Training Reminder'),
        COALESCE(v_action.display_data->>'description', 'Please continue your training.'),
        jsonb_build_object('action_id', p_action_id)
      );
    END IF;

  END IF; -- end approved branch

  -- ─── 6. Return result ─────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'action_id', p_action_id,
    'status', v_new_status,
    'resolved_by', auth.uid(),
    'resolved_at', now()
  );
END;
$$;

COMMIT;
