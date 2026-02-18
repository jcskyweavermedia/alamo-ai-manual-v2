-- =============================================================================
-- Phase 4: Management Functions
-- Creates 3 server-side functions for the manager training dashboard
-- =============================================================================

-- 4.2a: detect_content_changes() — Content Hash Scanner
-- Scans all content source tables with per-table CASE logic using actual column names
CREATE OR REPLACE FUNCTION detect_content_changes(p_group_id UUID)
RETURNS TABLE(
  section_id UUID,
  section_title TEXT,
  source_table TEXT,
  source_id UUID,
  old_hash TEXT,
  new_hash TEXT
) AS $$
DECLARE
  sec RECORD;
  content_id UUID;
  computed_hash TEXT;
  existing_hash TEXT;
BEGIN
  FOR sec IN
    SELECT cs.id, cs.title_en, cs.content_source, cs.content_ids
    FROM public.course_sections cs
    JOIN public.courses c ON cs.course_id = c.id
    WHERE c.group_id = p_group_id
      AND cs.status = 'published'
      AND cs.content_source != 'custom'
  LOOP
    FOREACH content_id IN ARRAY sec.content_ids
    LOOP
      computed_hash := NULL;

      -- Per-table MD5 using actual column names
      IF sec.content_source = 'manual_sections' THEN
        SELECT md5(
          COALESCE(m.title_en, '') || COALESCE(m.title_es, '') ||
          COALESCE(m.content_en, '') || COALESCE(m.content_es, '')
        ) INTO computed_hash
        FROM public.manual_sections m WHERE m.id = content_id;

      ELSIF sec.content_source = 'foh_plate_specs' THEN
        SELECT md5(
          COALESCE(f.menu_name, '') || COALESCE(f.plate_type, '') ||
          COALESCE(f.short_description, '') || COALESCE(f.detailed_description, '') ||
          COALESCE(f.allergy_notes, '') || COALESCE(f.upsell_notes, '') ||
          COALESCE(f.notes, '') || COALESCE(array_to_string(f.ingredients, ','), '') ||
          COALESCE(array_to_string(f.key_ingredients, ','), '') ||
          COALESCE(array_to_string(f.flavor_profile, ','), '')
        ) INTO computed_hash
        FROM public.foh_plate_specs f WHERE f.id = content_id;

      ELSIF sec.content_source = 'plate_specs' THEN
        SELECT md5(
          COALESCE(ps.name, '') || COALESCE(ps.plate_type, '') ||
          COALESCE(ps.menu_category, '') || COALESCE(ps.notes, '') ||
          COALESCE(ps.components::text, '') || COALESCE(ps.assembly_procedure::text, '') ||
          COALESCE(array_to_string(ps.allergens, ','), '')
        ) INTO computed_hash
        FROM public.plate_specs ps WHERE ps.id = content_id;

      ELSIF sec.content_source = 'prep_recipes' THEN
        SELECT md5(
          COALESCE(pr.name, '') || COALESCE(pr.prep_type, '') ||
          COALESCE(pr.ingredients::text, '') || COALESCE(pr.procedure::text, '') ||
          COALESCE(pr.batch_scaling::text, '') || COALESCE(pr.training_notes::text, '') ||
          COALESCE(array_to_string(pr.tags, ','), '')
        ) INTO computed_hash
        FROM public.prep_recipes pr WHERE pr.id = content_id;

      ELSIF sec.content_source = 'wines' THEN
        SELECT md5(
          COALESCE(w.name, '') || COALESCE(w.producer, '') ||
          COALESCE(w.region, '') || COALESCE(w.varietal, '') ||
          COALESCE(w.style, '') || COALESCE(w.body, '') ||
          COALESCE(w.tasting_notes, '') || COALESCE(w.producer_notes, '') ||
          COALESCE(w.notes, '')
        ) INTO computed_hash
        FROM public.wines w WHERE w.id = content_id;

      ELSIF sec.content_source = 'cocktails' THEN
        SELECT md5(
          COALESCE(ct.name, '') || COALESCE(ct.style, '') ||
          COALESCE(ct.glass, '') || COALESCE(ct.ingredients, '') ||
          COALESCE(ct.key_ingredients, '') || COALESCE(ct.tasting_notes, '') ||
          COALESCE(ct.description, '') || COALESCE(ct.notes, '') ||
          COALESCE(ct.procedure::text, '')
        ) INTO computed_hash
        FROM public.cocktails ct WHERE ct.id = content_id;

      ELSIF sec.content_source = 'beer_liquor_list' THEN
        SELECT md5(
          COALESCE(bl.name, '') || COALESCE(bl.category, '') ||
          COALESCE(bl.subcategory, '') || COALESCE(bl.producer, '') ||
          COALESCE(bl.country, '') || COALESCE(bl.description, '') ||
          COALESCE(bl.style, '') || COALESCE(bl.notes, '')
        ) INTO computed_hash
        FROM public.beer_liquor_list bl WHERE bl.id = content_id;

      END IF;

      IF computed_hash IS NULL THEN CONTINUE; END IF;

      -- Get last known hash
      SELECT cl.content_hash INTO existing_hash
      FROM public.content_change_log cl
      WHERE cl.source_table = sec.content_source
        AND cl.source_id = content_id
      ORDER BY cl.created_at DESC
      LIMIT 1;

      -- First scan: create baseline, no change reported
      IF existing_hash IS NULL THEN
        INSERT INTO public.content_change_log (source_table, source_id, content_hash)
        VALUES (sec.content_source, content_id, computed_hash);
        CONTINUE;
      END IF;

      -- Hash differs: report the change
      IF computed_hash != existing_hash THEN
        section_id := sec.id;
        section_title := sec.title_en;
        source_table := sec.content_source;
        source_id := content_id;
        old_hash := existing_hash;
        new_hash := computed_hash;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4.2b: expire_rollouts() — Auto-Expire + Overdue Marking
CREATE OR REPLACE FUNCTION expire_rollouts()
RETURNS void AS $$
BEGIN
  -- Expire rollouts past their expiry date
  UPDATE public.rollouts
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  -- Mark overdue assignments
  UPDATE public.rollout_assignments ra
  SET status = 'overdue'
  FROM public.rollouts r
  WHERE ra.rollout_id = r.id
    AND r.status IN ('active', 'expired')
    AND r.deadline IS NOT NULL
    AND r.deadline < now()
    AND ra.status IN ('assigned', 'in_progress');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4.2c: get_team_progress() — Manager RPC for Team Data
CREATE OR REPLACE FUNCTION get_team_progress(p_group_id UUID)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT,
  courses_completed INTEGER,
  courses_total INTEGER,
  overall_progress_percent NUMERIC,
  average_quiz_score NUMERIC,
  last_active_at TIMESTAMPTZ,
  failed_sections TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    gm.role::TEXT,
    COALESCE(agg.completed, 0)::INTEGER AS courses_completed,
    COALESCE(agg.total, 0)::INTEGER AS courses_total,
    CASE WHEN COALESCE(agg.total, 0) > 0
      THEN ROUND((agg.completed::NUMERIC / agg.total) * 100, 1)
      ELSE 0
    END AS overall_progress_percent,
    agg.avg_score AS average_quiz_score,
    agg.last_active AS last_active_at,
    COALESCE(failed.sections, '{}') AS failed_sections
  FROM public.profiles p
  JOIN public.group_memberships gm ON gm.user_id = p.id AND gm.group_id = p_group_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE ce.status = 'completed') AS completed,
      COUNT(*) AS total,
      ROUND(AVG(ce.final_score) FILTER (WHERE ce.final_score IS NOT NULL), 1) AS avg_score,
      MAX(ce.updated_at) AS last_active
    FROM public.course_enrollments ce
    WHERE ce.user_id = p.id AND ce.group_id = p_group_id
  ) agg ON true
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(cs.title_en) AS sections
    FROM public.section_progress sp
    JOIN public.course_sections cs ON cs.id = sp.section_id
    WHERE sp.user_id = p.id
      AND sp.quiz_passed = false
      AND sp.quiz_score IS NOT NULL
  ) failed ON true
  WHERE p.is_active = true
  ORDER BY overall_progress_percent ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
