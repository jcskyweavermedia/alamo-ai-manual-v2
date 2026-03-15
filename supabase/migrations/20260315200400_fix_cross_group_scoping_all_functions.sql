-- =============================================================================
-- MIGRATION: fix_cross_group_scoping_all_functions
-- Fixes cross-group data leakage in functions 1, 2, and 5.
-- Also fixes enrolled_count regression in function 3 (was changed from
-- FILTER(status='enrolled') to COUNT(all) in 20260315200300).
-- Also adds p_limit cap (max 100) in function 1.
-- Also adds group_id scoping to evaluations LATERAL join in function 2.
-- Phase C security hardening.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- FUNCTION 1: get_team_training_summary
-- FIX: Add ce.group_id = p_group_id to JOIN + cap p_limit at 100
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_team_training_summary(
  p_group_id UUID,
  p_department TEXT DEFAULT NULL,
  p_employment_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 25
)
RETURNS TABLE (
  employee_id UUID,
  display_name TEXT,
  "position" TEXT,
  department TEXT,
  employment_status TEXT,
  hire_date DATE,
  profile_id UUID,
  courses_enrolled INT,
  courses_completed INT,
  avg_score INT,
  latest_activity TIMESTAMPTZ
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

  -- Cap limit to prevent excessive data retrieval
  p_limit := LEAST(COALESCE(p_limit, 25), 100);

  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.display_name::TEXT,
    e.position::TEXT,
    e.department::TEXT,
    e.employment_status::TEXT,
    e.hire_date,
    e.profile_id,
    COALESCE(COUNT(ce.id), 0)::INT AS courses_enrolled,
    COALESCE(COUNT(ce.id) FILTER (WHERE ce.status = 'completed'), 0)::INT AS courses_completed,
    (AVG(ce.final_score) FILTER (WHERE ce.final_score IS NOT NULL))::INT AS avg_score,
    MAX(ce.updated_at) AS latest_activity
  FROM public.employees e
  LEFT JOIN public.course_enrollments ce
    ON e.profile_id = ce.user_id
    AND ce.group_id = p_group_id
  WHERE e.group_id = p_group_id
    AND (p_department IS NULL OR e.department ILIKE p_department)
    AND (p_employment_status IS NULL OR e.employment_status = p_employment_status)
  GROUP BY e.id, e.display_name, e.position, e.department,
           e.employment_status, e.hire_date, e.profile_id
  ORDER BY e.display_name
  LIMIT p_limit;
END;
$$;


-- ---------------------------------------------------------------------------
-- FUNCTION 2: get_employee_training_detail
-- FIX: Add ce.group_id = p_group_id to JOIN + scope evaluations LATERAL
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_employee_training_detail(
  p_group_id UUID,
  p_employee_id UUID DEFAULT NULL,
  p_employee_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  display_name TEXT,
  "position" TEXT,
  department TEXT,
  hire_date DATE,
  employment_status TEXT,
  profile_linked BOOLEAN,
  course_id UUID,
  course_title TEXT,
  enrollment_status TEXT,
  completion_pct NUMERIC,
  final_score INT,
  final_passed BOOLEAN,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latest_eval_score INT,
  latest_eval_competency TEXT,
  match_count INT
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

  -- If both params are NULL, return empty set
  IF p_employee_id IS NULL AND p_employee_name IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id AS employee_id,
    e.display_name::TEXT,
    e.position::TEXT,
    e.department::TEXT,
    e.hire_date,
    e.employment_status::TEXT,
    (e.profile_id IS NOT NULL) AS profile_linked,
    c.id AS course_id,
    c.title_en::TEXT AS course_title,
    ce.status::TEXT AS enrollment_status,
    CASE
      WHEN ce.total_sections > 0
        THEN ROUND((ce.completed_sections::NUMERIC / ce.total_sections::NUMERIC) * 100, 1)
      ELSE 0
    END AS completion_pct,
    ce.final_score,
    ce.final_passed,
    ce.started_at,
    ce.completed_at,
    ev.score AS latest_eval_score,
    ev.competency_level::TEXT AS latest_eval_competency,
    COUNT(DISTINCT e.id) OVER ()::INT AS match_count
  FROM public.employees e
  LEFT JOIN public.course_enrollments ce
    ON e.profile_id = ce.user_id
    AND ce.group_id = p_group_id
  LEFT JOIN public.courses c
    ON ce.course_id = c.id
  LEFT JOIN LATERAL (
    SELECT ev_inner.score, ev_inner.competency_level
    FROM public.evaluations ev_inner
    WHERE ev_inner.user_id = e.profile_id
      AND ev_inner.course_id = c.id
      AND ev_inner.group_id = p_group_id
      AND ev_inner.eval_type = 'course'
      AND ev_inner.superseded_by IS NULL
    ORDER BY ev_inner.created_at DESC
    LIMIT 1
  ) ev ON true
  WHERE e.group_id = p_group_id
    AND (
      (p_employee_id IS NOT NULL AND e.id = p_employee_id)
      OR
      (p_employee_name IS NOT NULL AND (
        e.first_name ILIKE '%' || p_employee_name || '%'
        OR e.last_name ILIKE '%' || p_employee_name || '%'
        OR e.display_name ILIKE '%' || p_employee_name || '%'
      ))
    )
  ORDER BY e.display_name, c.sort_order;
END;
$$;


-- ---------------------------------------------------------------------------
-- FUNCTION 3: get_course_training_analytics
-- FIX: Revert enrolled_count to use FILTER (WHERE ce.status = 'enrolled')
-- (regression from 20260315200300 fix that changed it to COUNT(all))
-- Problem_sections group-scoping from 200300 is preserved.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_course_training_analytics(
  p_group_id UUID,
  p_course_id UUID
)
RETURNS TABLE (
  course_id     UUID,
  course_title  TEXT,
  enrolled_count    INT,
  in_progress_count INT,
  completed_count   INT,
  avg_score         INT,
  pass_rate         NUMERIC,
  avg_completion_days NUMERIC,
  problem_sections  JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Access control: caller must be manager or admin in the group
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_memberships gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id = p_group_id
      AND gm.role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: manager or admin role required';
  END IF;

  RETURN QUERY
  SELECT
    c.id                         AS course_id,
    c.title_en                   AS course_title,

    COALESCE(COUNT(ce.id) FILTER (WHERE ce.status = 'enrolled'), 0)::INT AS enrolled_count,
    COUNT(ce.id) FILTER (WHERE ce.status = 'in_progress')::INT  AS in_progress_count,
    COUNT(ce.id) FILTER (WHERE ce.status = 'completed')::INT    AS completed_count,
    ROUND(AVG(ce.final_score))::INT AS avg_score,
    CASE
      WHEN COUNT(ce.id) FILTER (WHERE ce.final_passed IS NOT NULL) = 0 THEN NULL
      ELSE ROUND(
        100.0 * COUNT(ce.id) FILTER (WHERE ce.final_passed = true)
        / COUNT(ce.id) FILTER (WHERE ce.final_passed IS NOT NULL),
        1
      )
    END                          AS pass_rate,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (ce.completed_at - ce.started_at)) / 86400.0
    ) FILTER (WHERE ce.completed_at IS NOT NULL), 1) AS avg_completion_days,

    -- Problem sections: bottom 5 by avg quiz score, scoped to group
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'section_id', ps_agg.section_id,
            'title', ps_agg.section_title,
            'avg_quiz_score', ps_agg.avg_quiz_score,
            'fail_count', ps_agg.fail_count
          )
        )::JSONB,
        '[]'::JSONB
      )
      FROM (
        SELECT
          sp.section_id,
          cs.title_en AS section_title,
          ROUND(AVG(sp.quiz_score), 1) AS avg_quiz_score,
          COUNT(*) FILTER (WHERE sp.quiz_passed = false) AS fail_count
        FROM public.section_progress sp
        JOIN public.course_sections cs ON cs.id = sp.section_id
        JOIN public.course_enrollments ce_inner
          ON ce_inner.id = sp.enrollment_id
          AND ce_inner.group_id = p_group_id
        WHERE sp.course_id = p_course_id
          AND sp.quiz_score IS NOT NULL
        GROUP BY sp.section_id, cs.title_en
        ORDER BY AVG(sp.quiz_score) ASC NULLS LAST
        LIMIT 5
      ) ps_agg
    ) AS problem_sections

  FROM public.courses c
  LEFT JOIN public.course_enrollments ce
    ON ce.course_id = c.id AND ce.group_id = p_group_id
  WHERE c.id = p_course_id
  GROUP BY c.id, c.title_en;
END;
$$;


-- ---------------------------------------------------------------------------
-- FUNCTION 5: get_program_completion_summary
-- FIX: Add pe.group_id = p_group_id to JOIN
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_program_completion_summary(
  p_group_id UUID,
  p_program_id UUID DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  display_name TEXT,
  "position" TEXT,
  program_id UUID,
  program_title TEXT,
  program_status TEXT,
  total_courses INT,
  completed_courses INT,
  overall_score INT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
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
    e.id AS employee_id,
    e.display_name::TEXT,
    e.position::TEXT,
    pe.program_id,
    tp.title_en::TEXT AS program_title,
    pe.status::TEXT AS program_status,
    COALESCE(pe.total_courses, 0)::INT AS total_courses,
    COALESCE(pe.completed_courses, 0)::INT AS completed_courses,
    pe.overall_score,
    pe.started_at,
    pe.completed_at
  FROM public.employees e
  LEFT JOIN public.program_enrollments pe
    ON e.profile_id = pe.user_id
    AND pe.group_id = p_group_id
    AND (p_program_id IS NULL OR pe.program_id = p_program_id)
  LEFT JOIN public.training_programs tp
    ON pe.program_id = tp.id
  WHERE e.group_id = p_group_id
  ORDER BY e.display_name, tp.title_en;
END;
$$;
