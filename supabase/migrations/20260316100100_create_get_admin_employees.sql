-- =============================================================================
-- MIGRATION: create get_admin_employees RPC function
-- Returns enriched employee list with training metrics for the admin dashboard.
-- Computes tenure, attention flags, course progress, grades per employee.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_employees(
  p_group_id UUID
)
RETURNS TABLE (
  id              UUID,
  first_name      TEXT,
  last_name       TEXT,
  display_name    TEXT,
  "position"      TEXT,
  department      TEXT,
  hire_date       DATE,
  phone           TEXT,
  email           TEXT,
  employment_status TEXT,
  profile_id      UUID,
  tenure_label    TEXT,
  is_new_hire     BOOLEAN,
  needs_attention BOOLEAN,
  attention_reason TEXT,
  current_course  TEXT,
  course_progress TEXT,
  overall_progress INT,
  grade           TEXT,
  avg_score       NUMERIC,
  courses_done    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ─── Security: caller must be manager or admin in the group ─────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.user_id = auth.uid()
      AND gm.group_id = p_group_id
      AND gm.role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH enrollment_agg AS (
    -- Aggregate enrollment metrics per employee (via profile_id)
    SELECT
      ce.user_id,
      -- Attention: stalled enrollment (enrolled >14 days, 0 progress)
      bool_or(
        ce.status = 'enrolled'
        AND ce.created_at < (now() - INTERVAL '14 days')
        AND ce.completed_sections = 0
      ) AS has_stalled,
      -- Attention: failed quiz
      bool_or(ce.final_passed = false) AS has_failed,
      -- Average progress across active enrollments
      AVG(
        CASE
          WHEN ce.status IN ('enrolled', 'in_progress')
          THEN ce.completed_sections * 100 / NULLIF(ce.total_sections, 0)
          ELSE NULL
        END
      )::INT AS avg_progress,
      -- Average final_score across completed enrollments
      AVG(ce.final_score) FILTER (WHERE ce.status = 'completed' AND ce.final_score IS NOT NULL) AS average_score,
      -- Courses done: completed / total
      COUNT(*) FILTER (WHERE ce.status = 'completed') AS completed_count,
      COUNT(*)                                         AS total_count
    FROM public.course_enrollments ce
    WHERE ce.group_id = p_group_id
    GROUP BY ce.user_id
  ),
  current_course_cte AS (
    -- Most recent in_progress enrollment per employee
    SELECT DISTINCT ON (ce.user_id)
      ce.user_id,
      c.title_en,
      ce.completed_sections,
      ce.total_sections
    FROM public.course_enrollments ce
    JOIN public.courses c ON c.id = ce.course_id
    WHERE ce.group_id = p_group_id
      AND ce.status = 'in_progress'
    ORDER BY ce.user_id, ce.started_at DESC
  )
  SELECT
    e.id,
    e.first_name::TEXT,
    e.last_name::TEXT,
    e.display_name::TEXT,
    e.position::TEXT,
    e.department::TEXT,
    e.hire_date,
    e.phone::TEXT,
    e.email::TEXT,
    e.employment_status::TEXT,
    e.profile_id,
    -- tenure_label
    CASE
      WHEN e.hire_date IS NULL THEN 'N/A'
      WHEN (now()::date - e.hire_date) < 56  -- <8 weeks
        THEN 'Week ' || GREATEST(((now()::date - e.hire_date) / 7) + 1, 1)::TEXT
      WHEN (now()::date - e.hire_date) < 730 -- <24 months (~2 years)
        THEN ((now()::date - e.hire_date) / 30)::TEXT || ' months'
      ELSE ((now()::date - e.hire_date) / 365)::TEXT || ' years'
    END AS tenure_label,
    -- is_new_hire
    CASE
      WHEN e.hire_date IS NULL THEN false
      ELSE (now()::date - e.hire_date) <= 30
    END AS is_new_hire,
    -- needs_attention
    COALESCE(ea.has_stalled, false) OR COALESCE(ea.has_failed, false) AS needs_attention,
    -- attention_reason (first matching reason)
    CASE
      WHEN COALESCE(ea.has_stalled, false) THEN 'Stalled'
      WHEN COALESCE(ea.has_failed, false)  THEN 'Failed Quiz'
      ELSE NULL
    END AS attention_reason,
    -- current_course
    cc.title_en::TEXT AS current_course,
    -- course_progress
    CASE
      WHEN cc.title_en IS NOT NULL
        THEN cc.completed_sections::TEXT || ' of ' || cc.total_sections::TEXT || ' modules'
      ELSE NULL
    END AS course_progress,
    -- overall_progress
    ea.avg_progress AS overall_progress,
    -- grade (letter grade from avg_score)
    CASE
      WHEN ea.average_score IS NULL THEN NULL
      WHEN ea.average_score >= 90 THEN 'A'
      WHEN ea.average_score >= 80 THEN 'B'
      WHEN ea.average_score >= 70 THEN 'C'
      WHEN ea.average_score >= 60 THEN 'D'
      ELSE 'F'
    END AS grade,
    -- avg_score
    ROUND(ea.average_score, 1) AS avg_score,
    -- courses_done
    CASE
      WHEN ea.total_count IS NOT NULL AND ea.total_count > 0
        THEN ea.completed_count::TEXT || '/' || ea.total_count::TEXT
      ELSE NULL
    END AS courses_done
  FROM public.employees e
  LEFT JOIN enrollment_agg ea ON ea.user_id = e.profile_id
  LEFT JOIN current_course_cte cc ON cc.user_id = e.profile_id
  WHERE e.group_id = p_group_id
    AND e.employment_status IN ('active', 'onboarding')
  ORDER BY
    (CASE WHEN e.hire_date IS NOT NULL AND (now()::date - e.hire_date) <= 30 THEN 0 ELSE 1 END),
    e.last_name ASC;
END;
$$;

COMMIT;
