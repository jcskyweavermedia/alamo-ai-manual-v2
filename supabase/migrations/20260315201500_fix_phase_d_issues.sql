-- =============================================================================
-- MIGRATION: fix_phase_d_issues
-- Fixes 4 issues found in the Phase D devil's advocate review:
--
--   B2: course_health supersession inside loop caused each new insight to
--       supersede the previous new one from the same run. Fix: collect old IDs
--       before the loop, insert all new rows, then supersede old IDs after.
--
--   S1: resolve_training_action TOCTOU race. The initial SELECT lacked
--       FOR UPDATE, allowing concurrent calls to both read 'pending' and
--       both resolve. Fix: add FOR UPDATE to the SELECT.
--
--   S2: get_pending_actions cross-group JOIN. The employees LEFT JOIN was
--       missing AND e.group_id = p_group_id, allowing cross-group employee
--       name leakage. Fix: add the group_id condition.
--
--   S4: run_auto_enrollment v_inserted type mismatch. GET DIAGNOSTICS
--       ROW_COUNT returns INT, but v_inserted was declared BOOLEAN.
--       Fix: declare as INT, check > 0.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- B2: Fix generate_training_insights course_health supersession
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_training_insights()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group       RECORD;
  v_count       INT := 0;
  v_period_start DATE := CURRENT_DATE - 7;
  v_period_end   DATE := CURRENT_DATE;
  v_new_id      UUID;

  -- team_weekly aggregates
  v_new_enrollments INT;
  v_completions     INT;
  v_avg_score       NUMERIC;

  -- employee_alert cursors
  v_stalled   RECORD;
  v_failed    RECORD;

  -- course_health cursor + supersession fix
  v_course    RECORD;
  v_old_course_health_ids UUID[];
  v_first_course_health_id UUID;

  -- milestone cursor
  v_milestone RECORD;
BEGIN

  FOR v_group IN SELECT id FROM public.groups WHERE is_active = true
  LOOP

    -- =========================================================================
    -- 1. TEAM WEEKLY (always generated, supersedes prior team_weekly for group)
    -- =========================================================================

    -- Compute aggregates from course_enrollments scoped to this group
    SELECT
      COUNT(*) FILTER (WHERE ce.created_at >= v_period_start),
      COUNT(*) FILTER (WHERE ce.status = 'completed' AND ce.completed_at >= v_period_start),
      AVG(ce.final_score) FILTER (WHERE ce.final_score IS NOT NULL AND ce.completed_at >= v_period_start)
    INTO v_new_enrollments, v_completions, v_avg_score
    FROM public.course_enrollments ce
    WHERE ce.group_id = v_group.id;

    -- Generate new insight id
    v_new_id := extensions.gen_random_uuid();

    -- Insert new team_weekly insight FIRST (FK requires target row to exist)
    INSERT INTO public.training_insights (
      id, group_id, insight_type, severity, title, body, data,
      period_start, period_end
    ) VALUES (
      v_new_id,
      v_group.id,
      'team_weekly',
      'info',
      'Weekly Training Summary',
      NULL,
      jsonb_build_object(
        'new_enrollments', COALESCE(v_new_enrollments, 0),
        'completions',     COALESCE(v_completions, 0),
        'avg_score',       COALESCE(ROUND(v_avg_score), 0)
      ),
      v_period_start,
      v_period_end
    );

    -- NOW supersede all prior team_weekly insights for this group
    UPDATE public.training_insights
    SET superseded_by = v_new_id
    WHERE group_id = v_group.id
      AND insight_type = 'team_weekly'
      AND superseded_by IS NULL
      AND id != v_new_id;

    v_count := v_count + 1;


    -- =========================================================================
    -- 2. EMPLOYEE ALERTS - stalled employees (accumulates, no supersede)
    -- =========================================================================

    -- 2a. Stalled employees: active enrollment but no section_progress activity in 7 days
    FOR v_stalled IN
      SELECT DISTINCT
        e.id            AS employee_id,
        e.display_name  AS employee_name,
        (CURRENT_DATE - MAX(sp.updated_at)::date) AS days_inactive
      FROM public.employees e
      JOIN public.course_enrollments ce
        ON ce.user_id = e.profile_id
       AND ce.group_id = v_group.id
       AND ce.status IN ('enrolled', 'in_progress')
      LEFT JOIN public.section_progress sp
        ON sp.enrollment_id = ce.id
      WHERE e.group_id = v_group.id
        AND e.employment_status = 'active'
        AND e.profile_id IS NOT NULL
      GROUP BY e.id, e.display_name
      HAVING MAX(sp.updated_at) IS NULL
         OR MAX(sp.updated_at) < (now() - INTERVAL '7 days')
    LOOP

      v_new_id := extensions.gen_random_uuid();

      INSERT INTO public.training_insights (
        id, group_id, insight_type, severity, title, body, data,
        period_start, period_end
      ) VALUES (
        v_new_id,
        v_group.id,
        'employee_alert',
        'warning',
        'Stalled Employee: ' || v_stalled.employee_name,
        NULL,
        jsonb_build_object(
          'employee_id',   v_stalled.employee_id,
          'employee_name', v_stalled.employee_name,
          'reason',        'no_activity',
          'days_inactive', COALESCE(v_stalled.days_inactive, 7)
        ),
        v_period_start,
        v_period_end
      );

      v_count := v_count + 1;

      -- Create a nudge training_action (only if no pending nudge already exists)
      IF NOT EXISTS (
        SELECT 1 FROM public.training_actions
        WHERE group_id = v_group.id
          AND target_employee_id = v_stalled.employee_id
          AND action_type = 'nudge'
          AND status = 'pending'
      ) THEN
        INSERT INTO public.training_actions (
          id, group_id, action_type, status, source,
          target_employee_id, display_data, expires_at
        ) VALUES (
          extensions.gen_random_uuid(),
          v_group.id,
          'nudge',
          'pending',
          'system',
          v_stalled.employee_id,
          jsonb_build_object(
            'title',       'Nudge: ' || v_stalled.employee_name,
            'description', 'No training activity in 7+ days',
            'priority',    'medium',
            'actions',     jsonb_build_array('Nudge', 'Skip')
          ),
          now() + INTERVAL '14 days'
        );
      END IF;

    END LOOP;


    -- 2b. Failed quiz employees: section_progress.quiz_passed = false in last 7 days
    FOR v_failed IN
      SELECT DISTINCT
        e.id           AS employee_id,
        e.display_name AS employee_name,
        c.title_en     AS course_title,
        cs.title_en    AS section_title
      FROM public.employees e
      JOIN public.course_enrollments ce
        ON ce.user_id = e.profile_id
       AND ce.group_id = v_group.id
      JOIN public.section_progress sp
        ON sp.enrollment_id = ce.id
       AND sp.quiz_passed = false
       AND sp.updated_at >= (now() - INTERVAL '7 days')
      JOIN public.course_sections cs
        ON cs.id = sp.section_id
      JOIN public.courses c
        ON c.id = cs.course_id
      WHERE e.group_id = v_group.id
        AND e.employment_status = 'active'
        AND e.profile_id IS NOT NULL
    LOOP

      v_new_id := extensions.gen_random_uuid();

      INSERT INTO public.training_insights (
        id, group_id, insight_type, severity, title, body, data,
        period_start, period_end
      ) VALUES (
        v_new_id,
        v_group.id,
        'employee_alert',
        'warning',
        'Failed Quiz: ' || v_failed.employee_name,
        NULL,
        jsonb_build_object(
          'employee_id',   v_failed.employee_id,
          'employee_name', v_failed.employee_name,
          'reason',        'failed_quiz',
          'course_title',  v_failed.course_title,
          'section_title', v_failed.section_title
        ),
        v_period_start,
        v_period_end
      );

      v_count := v_count + 1;

    END LOOP;


    -- =========================================================================
    -- 3. COURSE HEALTH (supersedes prior course_health for this group)
    --    FIX B2: Collect old IDs before the loop, insert new rows in the loop,
    --    then supersede old rows after the loop using the first new ID.
    -- =========================================================================

    -- Snapshot existing course_health insight IDs before inserting new ones
    SELECT ARRAY_AGG(id) INTO v_old_course_health_ids
    FROM public.training_insights
    WHERE group_id = v_group.id
      AND insight_type = 'course_health'
      AND superseded_by IS NULL;

    -- Reset the first-new-id tracker for this group
    v_first_course_health_id := NULL;

    -- Collect unhealthy courses
    FOR v_course IN
      SELECT
        ev.course_id,
        c.title_en AS course_title,
        ROUND(
          (COUNT(*) FILTER (WHERE ev.passed = true)::NUMERIC
           / NULLIF(COUNT(*), 0)) * 100
        ) AS pass_rate,
        COUNT(*) AS total_evals
      FROM public.evaluations ev
      JOIN public.courses c ON c.id = ev.course_id
      WHERE ev.group_id = v_group.id
        AND ev.superseded_by IS NULL
        AND ev.course_id IS NOT NULL
      GROUP BY ev.course_id, c.title_en
      HAVING ROUND(
        (COUNT(*) FILTER (WHERE ev.passed = true)::NUMERIC
         / NULLIF(COUNT(*), 0)) * 100
      ) < 60
    LOOP

      v_new_id := extensions.gen_random_uuid();

      -- Track the first new course_health insight ID
      IF v_first_course_health_id IS NULL THEN
        v_first_course_health_id := v_new_id;
      END IF;

      -- Insert new course_health insight (NO supersede UPDATE here)
      INSERT INTO public.training_insights (
        id, group_id, insight_type, severity, title, body, data,
        period_start, period_end
      ) VALUES (
        v_new_id,
        v_group.id,
        'course_health',
        'warning',
        'Low Pass Rate: ' || v_course.course_title,
        NULL,
        jsonb_build_object(
          'course_id',   v_course.course_id,
          'course_title', v_course.course_title,
          'pass_rate',   v_course.pass_rate,
          'total_evals', v_course.total_evals
        ),
        v_period_start,
        v_period_end
      );

      v_count := v_count + 1;

    END LOOP;

    -- Supersede old course_health rows AFTER all new ones are inserted
    IF v_first_course_health_id IS NOT NULL AND v_old_course_health_ids IS NOT NULL THEN
      UPDATE public.training_insights
      SET superseded_by = v_first_course_health_id
      WHERE id = ANY(v_old_course_health_ids);
    END IF;


    -- =========================================================================
    -- 4. MILESTONES (per employee who completed a course this period, accumulates)
    -- =========================================================================

    FOR v_milestone IN
      SELECT DISTINCT
        e.id           AS employee_id,
        e.display_name AS employee_name,
        c.title_en     AS course_title,
        ce.completed_at
      FROM public.employees e
      JOIN public.course_enrollments ce
        ON ce.user_id = e.profile_id
       AND ce.group_id = v_group.id
       AND ce.status = 'completed'
       AND ce.completed_at >= v_period_start
      JOIN public.courses c
        ON c.id = ce.course_id
      WHERE e.group_id = v_group.id
        AND e.employment_status = 'active'
        AND e.profile_id IS NOT NULL
    LOOP

      v_new_id := extensions.gen_random_uuid();

      INSERT INTO public.training_insights (
        id, group_id, insight_type, severity, title, body, data,
        period_start, period_end
      ) VALUES (
        v_new_id,
        v_group.id,
        'milestone',
        'info',
        'Course Completed: ' || v_milestone.employee_name,
        NULL,
        jsonb_build_object(
          'employee_id',   v_milestone.employee_id,
          'employee_name', v_milestone.employee_name,
          'course_title',  v_milestone.course_title,
          'completed_at',  v_milestone.completed_at
        ),
        v_period_start,
        v_period_end
      );

      v_count := v_count + 1;

    END LOOP;

  END LOOP; -- end group loop

  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- S1: Fix resolve_training_action TOCTOU race (add FOR UPDATE)
-- ---------------------------------------------------------------------------

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
  -- 1. Validate resolution
  IF p_resolution NOT IN ('approved', 'skipped') THEN
    RAISE EXCEPTION 'Invalid resolution: %. Must be ''approved'' or ''skipped''.', p_resolution;
  END IF;

  -- 2. Fetch the action WITH row-level lock (prevents concurrent resolution)
  SELECT *
    INTO v_action
    FROM public.training_actions
   WHERE id = p_action_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Training action % not found.', p_action_id;
  END IF;

  IF v_action.status != 'pending' THEN
    RAISE EXCEPTION 'Training action % is not pending (current status: %).', p_action_id, v_action.status;
  END IF;

  -- 3. Security check
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id = v_action.group_id
      AND gm.role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: must be a manager or admin in the target group';
  END IF;

  -- 4. Update the action
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

  -- 5. Side effects (only when approved)
  IF p_resolution = 'approved' THEN

    -- 5a. auto_enroll actions
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

    -- 5b. nudge actions
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

  -- 6. Return result
  RETURN jsonb_build_object(
    'action_id', p_action_id,
    'status', v_new_status,
    'resolved_by', auth.uid(),
    'resolved_at', now()
  );
END;
$$;


-- ---------------------------------------------------------------------------
-- S2: Fix get_pending_actions cross-group JOIN scoping
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_pending_actions(
  p_group_id UUID
)
RETURNS TABLE (
  action_id UUID,
  action_type TEXT,
  status TEXT,
  source TEXT,
  employee_name TEXT,
  program_title TEXT,
  course_title TEXT,
  display_data JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Caller must be a manager or admin in the target group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id = p_group_id
      AND gm.role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: must be a manager or admin in the target group';
  END IF;

  RETURN QUERY
  SELECT
    ta.id AS action_id,
    ta.action_type::TEXT,
    ta.status::TEXT,
    ta.source::TEXT,
    e.display_name::TEXT AS employee_name,
    tp.title_en::TEXT AS program_title,
    c.title_en::TEXT AS course_title,
    ta.display_data,
    ta.expires_at,
    ta.created_at
  FROM public.training_actions ta
  LEFT JOIN public.employees e ON ta.target_employee_id = e.id AND e.group_id = p_group_id
  LEFT JOIN public.training_programs tp ON ta.target_program_id = tp.id
  LEFT JOIN public.courses c ON ta.target_course_id = c.id
  WHERE ta.group_id = p_group_id
    AND ta.status = 'pending'
  ORDER BY ta.created_at DESC
  LIMIT 100;
END;
$$;


-- ---------------------------------------------------------------------------
-- S4: Fix run_auto_enrollment v_inserted type mismatch (BOOLEAN -> INT)
-- ---------------------------------------------------------------------------

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
  v_inserted INT;
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

            IF v_inserted > 0 THEN
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


-- ---------------------------------------------------------------------------
-- Re-apply REVOKE on system functions (CREATE OR REPLACE resets grants)
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.run_auto_enrollment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_training_insights() FROM PUBLIC, anon, authenticated;

COMMIT;
