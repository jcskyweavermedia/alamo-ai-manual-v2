-- =============================================================================
-- Re-seed review_analyses for the 4 seeded restaurants.
-- Original 368 analyses were lost during Phase 4b testing.
-- Uses ON CONFLICT to preserve any existing real extractions.
-- Then re-runs rollups to recompute review_intelligence with analysis data.
-- =============================================================================

-- Step 1: Re-seed analyses
DO $$
DECLARE
  v_group_id UUID;
  v_count INTEGER;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- Alamo Prime Analyses (148 completed, with staff + items)
  INSERT INTO public.review_analyses (
    group_id, review_id, restaurant_id,
    overall_sentiment, emotion,
    strengths, opportunities,
    items_mentioned, staff_mentioned,
    return_intent, high_severity_flag, high_severity_details,
    rating, review_date, created_at
  )
  SELECT
    v_group_id,
    rr.id,
    rr.restaurant_id,
    CASE WHEN rr.rating >= 4 THEN 'positive' WHEN rr.rating = 3 THEN 'neutral' ELSE 'negative' END,
    CASE
      WHEN rr.rating = 5 THEN CASE WHEN rn % 3 = 0 THEN 'satisfied' ELSE 'delighted' END
      WHEN rr.rating = 4 THEN 'satisfied'
      WHEN rr.rating = 3 THEN 'neutral'
      WHEN rr.rating = 2 THEN 'frustrated'
      ELSE 'angry'
    END,
    CASE WHEN rr.rating >= 4 THEN
      ('[{"category": "Food Quality", "intensity": ' || (3 + rr.rating % 3) ||
       '}, {"category": "Service Attitude", "intensity": ' || (2 + rr.rating % 4) || '}]')::jsonb
    ELSE '[]'::jsonb END,
    CASE WHEN rr.rating <= 3 THEN
      ('[{"category": "Wait Time", "intensity": ' || (4 - rr.rating + 1) ||
       '}, {"category": "Value", "intensity": ' || (3 - rr.rating + 1) || '}]')::jsonb
    ELSE '[]'::jsonb END,
    CASE
      WHEN rn <= 28 THEN
        CASE WHEN rn IN (14, 28) THEN
          '[{"name": "Bone-In Ribeye", "item_type": "food", "course_type": "entree", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE
          ('[{"name": "Bone-In Ribeye", "item_type": "food", "course_type": "entree", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (4 + (rn % 2)) || '}]')::jsonb
        END
      WHEN rn <= 43 THEN
        CASE WHEN rn = 43 THEN
          '[{"name": "Truffle Mac & Cheese", "item_type": "food", "course_type": "side", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE
          ('[{"name": "Truffle Mac & Cheese", "item_type": "food", "course_type": "side", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (3 + (rn % 3)) || '}]')::jsonb
        END
      WHEN rn <= 55 THEN
        CASE WHEN rn IN (50, 55) THEN
          '[{"name": "Classic Margarita", "item_type": "cocktail", "course_type": "drink", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE
          ('[{"name": "Classic Margarita", "item_type": "cocktail", "course_type": "drink", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (3 + (rn % 2)) || '}]')::jsonb
        END
      WHEN rn <= 65 THEN
        CASE WHEN rn IN (60, 65) THEN
          '[{"name": "Grilled Caesar Salad", "item_type": "food", "course_type": "appetizer", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE
          ('[{"name": "Grilled Caesar Salad", "item_type": "food", "course_type": "appetizer", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (3 + (rn % 2)) || '}]')::jsonb
        END
      WHEN rn <= 73 THEN
        CASE WHEN rn = 73 THEN
          '[{"name": "Creme Brulee", "item_type": "food", "course_type": "dessert", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE
          ('[{"name": "Creme Brulee", "item_type": "food", "course_type": "dessert", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (3 + (rn % 2)) || '}]')::jsonb
        END
      ELSE '[]'::jsonb
    END,
    CASE
      WHEN rn <= 14 THEN
        CASE WHEN rn = 7 THEN '[{"name": "Maria Garcia", "role": "server", "sentiment": "negative"}]'::jsonb
        ELSE '[{"name": "Maria Garcia", "role": "server", "sentiment": "positive"}]'::jsonb END
      WHEN rn <= 24 THEN
        CASE WHEN rn = 24 THEN '[{"name": "Carlos Reyes", "role": "bartender", "sentiment": "neutral"}]'::jsonb
        ELSE '[{"name": "Carlos Reyes", "role": "bartender", "sentiment": "positive"}]'::jsonb END
      WHEN rn <= 31 THEN
        CASE WHEN rn = 31 THEN '[{"name": "Jake Thompson", "role": "server", "sentiment": "negative"}]'::jsonb
        ELSE '[{"name": "Jake Thompson", "role": "server", "sentiment": "positive"}]'::jsonb END
      WHEN rn <= 36 THEN '[{"name": "Sofia Martinez", "role": "host", "sentiment": "positive"}]'::jsonb
      WHEN rn <= 40 THEN
        CASE WHEN rn = 40 THEN '[{"name": "David Chen", "role": "manager", "sentiment": "negative"}]'::jsonb
        ELSE '[{"name": "David Chen", "role": "manager", "sentiment": "positive"}]'::jsonb END
      ELSE '[]'::jsonb
    END,
    CASE WHEN rr.rating >= 4 THEN 'likely' WHEN rr.rating = 3 THEN 'unclear' ELSE 'unlikely' END,
    false, '[]'::jsonb,
    rr.rating, rr.review_date, now()
  FROM (
    SELECT *,
      ROW_NUMBER() OVER (ORDER BY SUBSTRING(platform_review_id FROM '[0-9]+$')::int) AS rn
    FROM public.restaurant_reviews
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
      AND analysis_status = 'completed'
  ) rr
  ON CONFLICT (review_id) DO UPDATE SET
    strengths = EXCLUDED.strengths,
    opportunities = EXCLUDED.opportunities,
    items_mentioned = EXCLUDED.items_mentioned,
    staff_mentioned = EXCLUDED.staff_mentioned,
    overall_sentiment = EXCLUDED.overall_sentiment,
    emotion = EXCLUDED.emotion,
    return_intent = EXCLUDED.return_intent;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Alamo Prime analyses upserted: %', v_count;

  -- Competitor Analyses (220 completed, no staff/items)
  INSERT INTO public.review_analyses (
    group_id, review_id, restaurant_id,
    overall_sentiment, emotion,
    strengths, opportunities,
    items_mentioned, staff_mentioned,
    return_intent, high_severity_flag, high_severity_details,
    rating, review_date, created_at
  )
  SELECT
    v_group_id,
    rr.id,
    rr.restaurant_id,
    CASE WHEN rr.rating >= 4 THEN 'positive' WHEN rr.rating = 3 THEN 'neutral' ELSE 'negative' END,
    CASE
      WHEN rr.rating = 5 THEN
        CASE WHEN ROW_NUMBER() OVER (PARTITION BY rr.restaurant_id ORDER BY rr.review_date) % 3 = 0
          THEN 'satisfied' ELSE 'delighted' END
      WHEN rr.rating = 4 THEN 'satisfied'
      WHEN rr.rating = 3 THEN 'neutral'
      WHEN rr.rating = 2 THEN 'frustrated'
      ELSE 'angry'
    END,
    CASE WHEN rr.rating >= 4 THEN
      ('[{"category": "Food Quality", "intensity": ' || (3 + rr.rating % 3) ||
       '}, {"category": "Service Attitude", "intensity": ' || (2 + rr.rating % 4) || '}]')::jsonb
    ELSE '[]'::jsonb END,
    CASE WHEN rr.rating <= 3 THEN
      ('[{"category": "Wait Time", "intensity": ' || (4 - rr.rating + 1) ||
       '}, {"category": "Value", "intensity": ' || (3 - rr.rating + 1) || '}]')::jsonb
    ELSE '[]'::jsonb END,
    '[]'::jsonb,
    '[]'::jsonb,
    CASE WHEN rr.rating >= 4 THEN 'likely' WHEN rr.rating = 3 THEN 'unclear' ELSE 'unlikely' END,
    false, '[]'::jsonb,
    rr.rating, rr.review_date, now()
  FROM public.restaurant_reviews rr
  WHERE rr.restaurant_id IN (
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
  )
  AND rr.analysis_status = 'completed'
  AND rr.group_id = v_group_id
  ON CONFLICT (review_id) DO UPDATE SET
    strengths = EXCLUDED.strengths,
    opportunities = EXCLUDED.opportunities,
    items_mentioned = EXCLUDED.items_mentioned,
    staff_mentioned = EXCLUDED.staff_mentioned,
    overall_sentiment = EXCLUDED.overall_sentiment,
    emotion = EXCLUDED.emotion,
    return_intent = EXCLUDED.return_intent;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Competitor analyses upserted: %', v_count;

  -- High-Severity Flags
  UPDATE public.review_analyses
  SET high_severity_flag = true,
      high_severity_details = '[{"type": "health_safety", "summary": "Guest reported finding a foreign object in their salad."}]'::jsonb
  WHERE review_id = (
    SELECT id FROM public.restaurant_reviews
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
      AND rating = 2 AND analysis_status = 'completed'
    ORDER BY review_date DESC LIMIT 1
  );

  UPDATE public.review_analyses
  SET high_severity_flag = true,
      high_severity_details = '[{"type": "staff_conduct", "summary": "Guest reported being spoken to rudely by a staff member."}]'::jsonb
  WHERE review_id = (
    SELECT id FROM public.restaurant_reviews
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
      AND rating = 3 AND analysis_status = 'completed'
    ORDER BY review_date DESC LIMIT 1
  );

  UPDATE public.review_analyses
  SET high_severity_flag = true,
      high_severity_details = '[{"type": "health_safety", "summary": "Guest described food poisoning symptoms after dining."}]'::jsonb
  WHERE review_id = (
    SELECT id FROM public.restaurant_reviews
    WHERE restaurant_id = '44444444-4444-4444-4444-444444444444'
      AND rating = 1 AND analysis_status = 'completed'
    ORDER BY review_date DESC LIMIT 1
  );

  UPDATE public.review_analyses
  SET high_severity_flag = true,
      high_severity_details = '[{"type": "pest_sighting", "summary": "Guest reported seeing a cockroach near the bar area."}]'::jsonb
  WHERE review_id = (
    SELECT id FROM public.restaurant_reviews
    WHERE restaurant_id = '44444444-4444-4444-4444-444444444444'
      AND rating = 2 AND analysis_status = 'completed'
    ORDER BY review_date DESC LIMIT 1
  );

  SELECT COUNT(*) INTO v_count FROM public.review_analyses;
  RAISE NOTICE 'Total review_analyses after reseed: %', v_count;
END;
$$;

-- Step 2: Re-run rollups with the restored analysis data
DO $$
DECLARE
  v_date DATE;
  v_count INTEGER;
BEGIN
  RAISE NOTICE 'Re-running daily flavor index rollups...';
  FOR v_date IN
    SELECT generate_series('2025-12-01'::date, CURRENT_DATE - 1, '1 day')::date
  LOOP
    PERFORM public.rollup_daily_flavor_index(v_date);
  END LOOP;

  SELECT COUNT(*) INTO v_count FROM public.flavor_index_daily;
  RAISE NOTICE 'flavor_index_daily: % rows', v_count;

  RAISE NOTICE 'Re-running review intelligence rollups...';
  FOR v_date IN
    SELECT generate_series('2025-12-01'::date, CURRENT_DATE - 1, '7 days')::date
  LOOP
    PERFORM public.rollup_review_intelligence(v_date);
  END LOOP;
  PERFORM public.rollup_review_intelligence(CURRENT_DATE - 1);

  SELECT COUNT(*) INTO v_count FROM public.review_intelligence;
  RAISE NOTICE 'review_intelligence: % rows', v_count;

  RAISE NOTICE 'Reseed + rollup complete.';
END;
$$;
