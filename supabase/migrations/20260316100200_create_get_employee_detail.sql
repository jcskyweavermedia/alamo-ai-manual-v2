-- =============================================================================
-- MIGRATION: create_get_employee_detail
-- Creates get_employee_detail(p_employee_id UUID) RPC function.
-- Returns a single employee row with a nested courses JSONB array.
-- Each course contains enrollment stats plus a modules sub-array built
-- from section_progress + course_sections.
--
-- Authorization: caller must be manager or admin in the employee's group.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_employee_detail(p_employee_id UUID)
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
  courses         JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id      UUID;
  v_profile_id    UUID;
  v_courses_jsonb JSONB;
  rec_enrollment  RECORD;
  v_modules       JSONB;
  v_grade         TEXT;
  v_progress_pct  INT;
  v_course_list   JSONB := '[]'::JSONB;
BEGIN
  -- -----------------------------------------------------------------------
  -- 1. Look up the employee and their group
  -- -----------------------------------------------------------------------
  SELECT e.group_id, e.profile_id
    INTO v_group_id, v_profile_id
    FROM public.employees e
   WHERE e.id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  -- -----------------------------------------------------------------------
  -- 2. Authorization: caller must be manager or admin in the same group
  -- -----------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
      FROM public.group_memberships
     WHERE user_id  = auth.uid()
       AND group_id = v_group_id
       AND role IN ('manager', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- -----------------------------------------------------------------------
  -- 3. Build the courses JSONB array (only if employee has a linked profile)
  -- -----------------------------------------------------------------------
  IF v_profile_id IS NOT NULL THEN
    FOR rec_enrollment IN
      SELECT
        ce.id           AS enrollment_id,
        ce.course_id,
        c.title_en      AS course_name,
        c.icon          AS course_icon,
        ce.status,
        ce.final_score,
        ce.completed_sections,
        ce.total_sections,
        ce.completed_at,
        ce.started_at
      FROM public.course_enrollments ce
      JOIN public.courses c ON c.id = ce.course_id
      WHERE ce.user_id = v_profile_id
      ORDER BY
        CASE ce.status
          WHEN 'in_progress' THEN 0
          WHEN 'enrolled'    THEN 1
          WHEN 'completed'   THEN 2
          WHEN 'expired'     THEN 3
        END,
        ce.started_at DESC NULLS LAST
    LOOP
      -- 3a. Build modules sub-array for this enrollment
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',            sp.section_id,
            'name',          cs.title_en,
            'status',        sp.status,
            'score',         sp.quiz_score,
            'attempts',      sp.quiz_attempts,
            'completedDate', sp.completed_at::DATE
          )
          ORDER BY cs.sort_order
        ),
        '[]'::JSONB
      )
      INTO v_modules
      FROM public.section_progress sp
      JOIN public.course_sections cs ON cs.id = sp.section_id
      WHERE sp.enrollment_id = rec_enrollment.enrollment_id;

      -- 3b. Compute grade from final_score
      IF rec_enrollment.final_score IS NOT NULL THEN
        v_grade := CASE
          WHEN rec_enrollment.final_score >= 90 THEN 'A'
          WHEN rec_enrollment.final_score >= 80 THEN 'B'
          WHEN rec_enrollment.final_score >= 70 THEN 'C'
          WHEN rec_enrollment.final_score >= 60 THEN 'D'
          ELSE 'F'
        END;
      ELSE
        v_grade := NULL;
      END IF;

      -- 3c. Compute progress percent
      v_progress_pct := (rec_enrollment.completed_sections * 100)
                        / NULLIF(rec_enrollment.total_sections, 0);

      -- 3d. Append this course object to the array
      v_course_list := v_course_list || jsonb_build_object(
        'courseId',         rec_enrollment.course_id,
        'courseName',      rec_enrollment.course_name,
        'courseIcon',       rec_enrollment.course_icon,
        'status',          rec_enrollment.status,
        'score',           rec_enrollment.final_score,
        'grade',           v_grade,
        'progressPercent', v_progress_pct,
        'modulesCompleted', rec_enrollment.completed_sections,
        'modulesTotal',    rec_enrollment.total_sections,
        'completedDate',   rec_enrollment.completed_at::DATE,
        'modules',         v_modules
      );
    END LOOP;
  END IF;

  v_courses_jsonb := v_course_list;

  -- -----------------------------------------------------------------------
  -- 4. Return the employee row with the assembled courses array
  -- -----------------------------------------------------------------------
  RETURN QUERY
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
    v_courses_jsonb
  FROM public.employees e
  WHERE e.id = p_employee_id;
END;
$$;
