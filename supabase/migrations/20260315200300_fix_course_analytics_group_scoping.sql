-- =============================================================================
-- MIGRATION: fix_course_analytics_group_scoping
-- Fixes cross-group data leakage in get_course_training_analytics:
-- the problem_sections subquery was not scoped to p_group_id.
-- Phase C security fix.
-- =============================================================================

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

    COUNT(ce.id)::INT            AS enrolled_count,
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
