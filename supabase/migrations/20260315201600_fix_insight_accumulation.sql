-- =============================================================================
-- MIGRATION: fix_insight_accumulation
-- Fixes employee_alert insight accumulation in generate_training_insights():
--
--   1. Adds 90-day retention cleanup for superseded insights at function start.
--   2. Adds supersession logic for employee_alert insights: before inserting
--      a new alert for a given employee, the new row is inserted first (FK
--      requires target to exist), then old non-superseded alerts for the SAME
--      employee in the same group are updated to point to the new row.
--   3. Milestones are left as-is (historical records, not superseded).
-- =============================================================================

BEGIN;

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

  -- =========================================================================
  -- 0. RETENTION CLEANUP: delete superseded insights older than 90 days
  -- =========================================================================
  DELETE FROM public.training_insights
  WHERE superseded_by IS NOT NULL
    AND created_at < CURRENT_DATE - 90;

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
    -- 2. EMPLOYEE ALERTS - stalled employees (supersedes prior alerts per employee)
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

      -- Insert new employee_alert FIRST (FK requires target row to exist)
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

      -- Supersede old employee_alert insights for the SAME employee in this group
      UPDATE public.training_insights
      SET superseded_by = v_new_id
      WHERE group_id = v_group.id
        AND insight_type = 'employee_alert'
        AND superseded_by IS NULL
        AND (data->>'employee_id') = v_stalled.employee_id::TEXT
        AND id != v_new_id;

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

      -- Insert new employee_alert FIRST (FK requires target row to exist)
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

      -- Supersede old employee_alert insights for the SAME employee in this group
      UPDATE public.training_insights
      SET superseded_by = v_new_id
      WHERE group_id = v_group.id
        AND insight_type = 'employee_alert'
        AND superseded_by IS NULL
        AND (data->>'employee_id') = v_failed.employee_id::TEXT
        AND id != v_new_id;

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
    --    Milestones are historical records and should NOT be superseded.
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

-- Re-apply REVOKE (CREATE OR REPLACE resets grants)
REVOKE EXECUTE ON FUNCTION public.generate_training_insights() FROM PUBLIC, anon, authenticated;

COMMIT;
