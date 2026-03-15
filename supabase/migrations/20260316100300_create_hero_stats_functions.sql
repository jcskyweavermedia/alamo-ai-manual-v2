-- =============================================================================
-- MIGRATION: Create hero stats RPC functions
-- 3 SECURITY DEFINER functions for dashboard hero stat cards:
--   1. get_people_hero_stats  — People page (total, new hires, attention, trained)
--   2. get_hub_hero_stats     — Hub page (staff, courses, pending actions)
--   3. get_courses_hero_stats — Courses page (total, completion rate, avg grade)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FUNCTION 1: get_people_hero_stats(p_group_id UUID)
-- Returns aggregate employee metrics for the People dashboard hero cards.
--
-- Columns:
--   total_employees  — active + onboarding employees in group
--   new_hires        — hired within last 30 days
--   needs_attention  — stalled enrollment (enrolled >14d, 0 progress) OR failed final
--   fully_trained    — all enrollments completed (must have at least 1)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_people_hero_stats(p_group_id UUID)
RETURNS TABLE (
  total_employees INT,
  new_hires INT,
  needs_attention INT,
  fully_trained INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: caller must be manager or admin in the target group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE user_id = auth.uid() AND group_id = p_group_id AND role IN ('manager','admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH active_employees AS (
    SELECT e.id, e.profile_id, e.hire_date
    FROM public.employees e
    WHERE e.group_id = p_group_id
      AND e.employment_status IN ('active', 'onboarding')
  ),
  -- Employees with at least one stalled or failed enrollment
  attention_employees AS (
    SELECT DISTINCT ae.id
    FROM active_employees ae
    JOIN public.course_enrollments ce
      ON ce.user_id = ae.profile_id AND ce.group_id = p_group_id
    WHERE ae.profile_id IS NOT NULL
      AND (
        -- Stalled: status='enrolled', created >14 days ago, 0 completed sections
        (ce.status = 'enrolled'
         AND ce.created_at < CURRENT_TIMESTAMP - INTERVAL '14 days'
         AND ce.completed_sections = 0)
        OR
        -- Failed final assessment
        (ce.final_passed = false)
      )
  ),
  -- Employees where ALL enrollments are completed (and they have >= 1)
  trained_employees AS (
    SELECT ae.id
    FROM active_employees ae
    WHERE ae.profile_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.course_enrollments ce
        WHERE ce.user_id = ae.profile_id AND ce.group_id = p_group_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.course_enrollments ce
        WHERE ce.user_id = ae.profile_id AND ce.group_id = p_group_id
          AND ce.status <> 'completed'
      )
  )
  SELECT
    (SELECT COUNT(*)::INT FROM active_employees),
    (SELECT COUNT(*)::INT FROM active_employees WHERE hire_date >= CURRENT_DATE - 30),
    (SELECT COUNT(*)::INT FROM attention_employees),
    (SELECT COUNT(*)::INT FROM trained_employees);
END;
$$;


-- ---------------------------------------------------------------------------
-- FUNCTION 2: get_hub_hero_stats(p_group_id UUID)
-- Returns aggregate metrics for the Training Hub dashboard hero cards.
--
-- Columns:
--   staff_managed   — active + onboarding employees in group
--   active_courses  — published courses in group
--   pending_actions — pending training_actions in group
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_hub_hero_stats(p_group_id UUID)
RETURNS TABLE (
  staff_managed INT,
  active_courses INT,
  pending_actions INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: caller must be manager or admin in the target group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE user_id = auth.uid() AND group_id = p_group_id AND role IN ('manager','admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT
     FROM public.employees
     WHERE group_id = p_group_id
       AND employment_status IN ('active', 'onboarding')),

    (SELECT COUNT(*)::INT
     FROM public.courses
     WHERE group_id = p_group_id
       AND status = 'published'),

    (SELECT COUNT(*)::INT
     FROM public.training_actions
     WHERE group_id = p_group_id
       AND status = 'pending');
END;
$$;


-- ---------------------------------------------------------------------------
-- FUNCTION 3: get_courses_hero_stats(p_group_id UUID)
-- Returns aggregate course metrics for the Courses dashboard hero cards.
--
-- Columns:
--   total_courses    — published courses in group
--   completion_rate  — percentage of completed enrollments (0 if none)
--   avg_grade        — average final_score of completed enrollments (NULL if none)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_courses_hero_stats(p_group_id UUID)
RETURNS TABLE (
  total_courses INT,
  completion_rate INT,
  avg_grade INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_enrollments INT;
  v_completed_enrollments INT;
BEGIN
  -- Authorization: caller must be manager or admin in the target group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE user_id = auth.uid() AND group_id = p_group_id AND role IN ('manager','admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Count total and completed enrollments in one pass
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE ce.status = 'completed')::INT
  INTO v_total_enrollments, v_completed_enrollments
  FROM public.course_enrollments ce
  WHERE ce.group_id = p_group_id;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT
     FROM public.courses
     WHERE group_id = p_group_id
       AND status = 'published'),

    COALESCE(
      ROUND(v_completed_enrollments * 100.0 / NULLIF(v_total_enrollments, 0))::INT,
      0
    ),

    (SELECT ROUND(AVG(ce.final_score))::INT
     FROM public.course_enrollments ce
     WHERE ce.group_id = p_group_id
       AND ce.status = 'completed'
       AND ce.final_score IS NOT NULL);
END;
$$;
