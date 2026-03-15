-- =============================================================================
-- MIGRATION: create_training_manager_query_functions
-- Creates 5 PG query functions for the AI Training Manager dashboard:
--   1. get_team_training_summary     - Team roster with training stats
--   2. get_employee_training_detail  - Single employee course detail
--   3. get_course_training_analytics - Course-level analytics + problem sections
--   4. get_training_alerts           - Overdue / stalled / failed / deadline alerts
--   5. get_program_completion_summary - Program-level progress per employee
--
-- CRITICAL JOIN PATH:
--   employees.profile_id (nullable FK -> profiles.id) -> course_enrollments.user_id
--   Must use LEFT JOINs; employees with NULL profile_id appear with 0 counts.
--
-- All functions use: LANGUAGE plpgsql, SECURITY DEFINER, SET search_path = public
-- Does NOT conflict with existing get_team_progress() in 20260306100700.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- FUNCTION 1: get_team_training_summary
-- Returns the team roster with aggregated training statistics.
-- Employees with NULL profile_id appear with 0 courses, NULL avg_score.
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
-- Returns course-level detail for a single employee (by ID or fuzzy name).
-- If both params are NULL, returns empty set.
-- match_count uses a window function so the caller knows how many employees
-- matched a name search.
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
  LEFT JOIN public.courses c
    ON ce.course_id = c.id
  LEFT JOIN LATERAL (
    SELECT ev_inner.score, ev_inner.competency_level
    FROM public.evaluations ev_inner
    WHERE ev_inner.user_id = e.profile_id
      AND ev_inner.course_id = c.id
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
-- Returns aggregate analytics for a single course: enrollment counts,
-- pass rate, average completion time, and the 5 worst-performing sections.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_course_training_analytics(
  p_group_id UUID,
  p_course_id UUID
)
RETURNS TABLE (
  course_id UUID,
  course_title TEXT,
  enrolled_count INT,
  in_progress_count INT,
  completed_count INT,
  avg_score INT,
  pass_rate NUMERIC,
  avg_completion_days NUMERIC,
  problem_sections JSONB
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
    c.id AS course_id,
    c.title_en::TEXT AS course_title,

    -- Enrollment counts by status
    COALESCE(COUNT(ce.id) FILTER (WHERE ce.status = 'enrolled'), 0)::INT AS enrolled_count,
    COALESCE(COUNT(ce.id) FILTER (WHERE ce.status = 'in_progress'), 0)::INT AS in_progress_count,
    COALESCE(COUNT(ce.id) FILTER (WHERE ce.status = 'completed'), 0)::INT AS completed_count,

    -- Average score (only where final_score exists)
    (AVG(ce.final_score) FILTER (WHERE ce.final_score IS NOT NULL))::INT AS avg_score,

    -- Pass rate: passed / graded * 100
    CASE
      WHEN COUNT(ce.id) FILTER (WHERE ce.final_score IS NOT NULL) > 0
        THEN ROUND(
          (COUNT(ce.id) FILTER (WHERE ce.final_passed = true)::NUMERIC
           / COUNT(ce.id) FILTER (WHERE ce.final_score IS NOT NULL)::NUMERIC) * 100,
          1
        )
      ELSE NULL
    END AS pass_rate,

    -- Average days to completion
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (ce.completed_at - ce.started_at)) / 86400
      ) FILTER (WHERE ce.completed_at IS NOT NULL),
      1
    ) AS avg_completion_days,

    -- Problem sections: bottom 5 by avg quiz score
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
-- FUNCTION 4: get_training_alerts
-- Returns a UNION ALL of 4 alert types:
--   1. overdue     (high)   - enrollment expired, not completed
--   2. stalled     (medium) - in_progress with no activity for 7+ days
--   3. failed      (high)   - final_passed = false
--   4. deadline_approaching (medium) - expires within 3 days, not completed
--
-- All scoped to p_group_id.  Joins employees via profiles to get
-- display_name and position.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_training_alerts(
  p_group_id UUID
)
RETURNS TABLE (
  alert_type TEXT,
  severity TEXT,
  employee_id UUID,
  display_name TEXT,
  "position" TEXT,
  course_id UUID,
  course_title TEXT,
  detail TEXT,
  due_date DATE
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

  -- 1. OVERDUE: enrollment expired and not completed
  SELECT
    'overdue'::TEXT AS alert_type,
    'high'::TEXT AS severity,
    e.id AS employee_id,
    e.display_name::TEXT,
    e.position::TEXT,
    ce.course_id,
    c.title_en::TEXT AS course_title,
    ('Overdue by ' || EXTRACT(DAY FROM (now() - ce.expires_at))::INT || ' days')::TEXT AS detail,
    ce.expires_at::DATE AS due_date
  FROM public.course_enrollments ce
  JOIN public.profiles p ON p.id = ce.user_id
  JOIN public.employees e ON e.profile_id = p.id AND e.group_id = p_group_id
  JOIN public.courses c ON c.id = ce.course_id
  WHERE ce.group_id = p_group_id
    AND ce.expires_at < now()
    AND ce.status != 'completed'

  UNION ALL

  -- 2. STALLED: in_progress with no activity for 7+ days
  SELECT
    'stalled'::TEXT AS alert_type,
    'medium'::TEXT AS severity,
    e.id AS employee_id,
    e.display_name::TEXT,
    e.position::TEXT,
    ce.course_id,
    c.title_en::TEXT AS course_title,
    ('No activity for ' || EXTRACT(DAY FROM (now() - ce.updated_at))::INT || ' days')::TEXT AS detail,
    NULL::DATE AS due_date
  FROM public.course_enrollments ce
  JOIN public.profiles p ON p.id = ce.user_id
  JOIN public.employees e ON e.profile_id = p.id AND e.group_id = p_group_id
  JOIN public.courses c ON c.id = ce.course_id
  WHERE ce.group_id = p_group_id
    AND ce.status = 'in_progress'
    AND ce.updated_at < now() - INTERVAL '7 days'

  UNION ALL

  -- 3. FAILED: final_passed = false with a score recorded
  SELECT
    'failed'::TEXT AS alert_type,
    'high'::TEXT AS severity,
    e.id AS employee_id,
    e.display_name::TEXT,
    e.position::TEXT,
    ce.course_id,
    c.title_en::TEXT AS course_title,
    ('Failed with score ' || ce.final_score)::TEXT AS detail,
    NULL::DATE AS due_date
  FROM public.course_enrollments ce
  JOIN public.profiles p ON p.id = ce.user_id
  JOIN public.employees e ON e.profile_id = p.id AND e.group_id = p_group_id
  JOIN public.courses c ON c.id = ce.course_id
  WHERE ce.group_id = p_group_id
    AND ce.final_passed = false
    AND ce.final_score IS NOT NULL

  UNION ALL

  -- 4. DEADLINE APPROACHING: expires within 3 days, not completed
  SELECT
    'deadline_approaching'::TEXT AS alert_type,
    'medium'::TEXT AS severity,
    e.id AS employee_id,
    e.display_name::TEXT,
    e.position::TEXT,
    ce.course_id,
    c.title_en::TEXT AS course_title,
    ('Due in ' || EXTRACT(DAY FROM (ce.expires_at - now()))::INT || ' days')::TEXT AS detail,
    ce.expires_at::DATE AS due_date
  FROM public.course_enrollments ce
  JOIN public.profiles p ON p.id = ce.user_id
  JOIN public.employees e ON e.profile_id = p.id AND e.group_id = p_group_id
  JOIN public.courses c ON c.id = ce.course_id
  WHERE ce.group_id = p_group_id
    AND ce.expires_at > now()
    AND ce.expires_at < now() + INTERVAL '3 days'
    AND ce.status != 'completed';
END;
$$;


-- ---------------------------------------------------------------------------
-- FUNCTION 5: get_program_completion_summary
-- Returns employee-level program progress. LEFT JOINs so employees without
-- program enrollments still appear. Optionally filtered to one program.
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
    AND (p_program_id IS NULL OR pe.program_id = p_program_id)
  LEFT JOIN public.training_programs tp
    ON pe.program_id = tp.id
  WHERE e.group_id = p_group_id
  ORDER BY e.display_name, tp.title_en;
END;
$$;
