-- =============================================================================
-- Full re-seed: restaurant_reviews + review_analyses for 4 seeded restaurants.
-- Original seed data (390 reviews + 368 analyses) was lost during testing.
-- Uses ON CONFLICT to preserve any existing real data.
-- Re-runs rollups at the end to recompute all aggregations.
-- =============================================================================

-- ─── STEP 1: Re-seed restaurant_reviews ─────────────────────────────────────

DO $$
DECLARE
  v_group_id UUID;
  v_base_date DATE := '2025-12-01';
  v_reviewer_names TEXT[];
  v_count INTEGER;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';
  IF v_group_id IS NULL THEN RAISE EXCEPTION 'Group alamo-prime not found'; END IF;

  v_reviewer_names := ARRAY[
    'James W.', 'Sarah M.', 'Michael R.', 'Emily K.', 'David L.',
    'Jessica P.', 'Robert T.', 'Amanda C.', 'Chris B.', 'Lauren H.',
    'Matt D.', 'Ashley N.', 'Ryan G.', 'Stephanie F.', 'Kevin J.',
    'Michelle S.', 'Brian A.', 'Rachel V.', 'Daniel E.', 'Nicole O.'
  ];

  -- 1a. Alamo Prime Steakhouse (150 reviews)
  INSERT INTO public.restaurant_reviews (
    group_id, restaurant_id, platform, platform_review_id,
    rating, review_date, reviewer_name, language,
    review_text, analysis_status, scraped_at, created_at
  )
  SELECT
    v_group_id,
    '11111111-1111-1111-1111-111111111111',
    CASE WHEN i <= 75 THEN 'google' WHEN i <= 120 THEN 'opentable' ELSE 'tripadvisor' END,
    'seed-alamo-' || LPAD(i::text, 4, '0'),
    CASE WHEN i <= 123 THEN 5 WHEN i <= 140 THEN 4 WHEN i <= 145 THEN 3
         WHEN i <= 148 THEN 2 ELSE 1 END,
    v_base_date + (((i - 1) * 82) / 150) * INTERVAL '1 day'
      + (10 + (i * 7 % 12)) * INTERVAL '1 hour'
      + (i * 13 % 60) * INTERVAL '1 minute',
    v_reviewer_names[(i % 20) + 1],
    'en',
    NULL,
    CASE WHEN i <= 148 THEN 'completed' WHEN i <= 149 THEN 'pending' ELSE 'failed' END,
    now(), now()
  FROM generate_series(1, 150) AS i
  ON CONFLICT (platform, platform_review_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Alamo Prime reviews inserted: %', v_count;

  -- 1b. Longhorn & Ember (100 reviews)
  INSERT INTO public.restaurant_reviews (
    group_id, restaurant_id, platform, platform_review_id,
    rating, review_date, reviewer_name, language,
    review_text, analysis_status, scraped_at, created_at
  )
  SELECT
    v_group_id,
    '22222222-2222-2222-2222-222222222222',
    CASE WHEN i <= 50 THEN 'google' WHEN i <= 80 THEN 'opentable' ELSE 'tripadvisor' END,
    'seed-longhorn-' || LPAD(i::text, 4, '0'),
    CASE WHEN i <= 67 THEN 5 WHEN i <= 81 THEN 4 WHEN i <= 89 THEN 3
         WHEN i <= 96 THEN 2 ELSE 1 END,
    v_base_date + (((i - 1) * 82) / 100) * INTERVAL '1 day'
      + (10 + (i * 7 % 12)) * INTERVAL '1 hour'
      + (i * 13 % 60) * INTERVAL '1 minute',
    v_reviewer_names[(i % 20) + 1],
    'en',
    NULL,
    CASE WHEN i <= 90 THEN 'completed' WHEN i <= 95 THEN 'pending' ELSE 'failed' END,
    now(), now()
  FROM generate_series(1, 100) AS i
  ON CONFLICT (platform, platform_review_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Longhorn reviews inserted: %', v_count;

  -- 1c. Salt & Sear Chophouse (80 reviews)
  INSERT INTO public.restaurant_reviews (
    group_id, restaurant_id, platform, platform_review_id,
    rating, review_date, reviewer_name, language,
    review_text, analysis_status, scraped_at, created_at
  )
  SELECT
    v_group_id,
    '33333333-3333-3333-3333-333333333333',
    CASE WHEN i <= 40 THEN 'google' WHEN i <= 64 THEN 'opentable' ELSE 'tripadvisor' END,
    'seed-saltsear-' || LPAD(i::text, 4, '0'),
    CASE WHEN i <= 43 THEN 5 WHEN i <= 57 THEN 4 WHEN i <= 67 THEN 3
         WHEN i <= 75 THEN 2 ELSE 1 END,
    v_base_date + (((i - 1) * 82) / 80) * INTERVAL '1 day'
      + (10 + (i * 7 % 12)) * INTERVAL '1 hour'
      + (i * 13 % 60) * INTERVAL '1 minute',
    v_reviewer_names[(i % 20) + 1],
    'en',
    NULL,
    CASE WHEN i <= 75 THEN 'completed' WHEN i <= 79 THEN 'pending' ELSE 'failed' END,
    now(), now()
  FROM generate_series(1, 80) AS i
  ON CONFLICT (platform, platform_review_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Salt & Sear reviews inserted: %', v_count;

  -- 1d. Mesquite Flame Grill (60 reviews)
  INSERT INTO public.restaurant_reviews (
    group_id, restaurant_id, platform, platform_review_id,
    rating, review_date, reviewer_name, language,
    review_text, analysis_status, scraped_at, created_at
  )
  SELECT
    v_group_id,
    '44444444-4444-4444-4444-444444444444',
    CASE WHEN i <= 30 THEN 'google' WHEN i <= 48 THEN 'opentable' ELSE 'tripadvisor' END,
    'seed-mesquite-' || LPAD(i::text, 4, '0'),
    CASE WHEN i <= 25 THEN 5 WHEN i <= 35 THEN 4 WHEN i <= 45 THEN 3
         WHEN i <= 55 THEN 2 ELSE 1 END,
    v_base_date + (((i - 1) * 82) / 60) * INTERVAL '1 day'
      + (10 + (i * 7 % 12)) * INTERVAL '1 hour'
      + (i * 13 % 60) * INTERVAL '1 minute',
    v_reviewer_names[(i % 20) + 1],
    'en',
    NULL,
    CASE WHEN i <= 55 THEN 'completed' WHEN i <= 58 THEN 'pending' ELSE 'failed' END,
    now(), now()
  FROM generate_series(1, 60) AS i
  ON CONFLICT (platform, platform_review_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Mesquite reviews inserted: %', v_count;

  -- Mark failed reviews
  UPDATE public.restaurant_reviews
  SET retry_count = 3,
      last_error = 'OpenAI API error: rate_limit_exceeded (429). Retries exhausted after 3 attempts.'
  WHERE analysis_status = 'failed'
    AND group_id = v_group_id
    AND platform_review_id LIKE 'seed-%';

  SELECT COUNT(*) INTO v_count FROM public.restaurant_reviews WHERE group_id = v_group_id;
  RAISE NOTICE 'Total restaurant_reviews: %', v_count;
END;
$$;

-- ─── STEP 2: Re-seed review_analyses ─────────────────────────────────────────

DO $$
DECLARE
  v_group_id UUID;
  v_count INTEGER;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

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
    v_group_id, rr.id, rr.restaurant_id,
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
        ELSE ('[{"name": "Bone-In Ribeye", "item_type": "food", "course_type": "entree", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (4 + (rn % 2)) || '}]')::jsonb END
      WHEN rn <= 43 THEN
        CASE WHEN rn = 43 THEN
          '[{"name": "Truffle Mac & Cheese", "item_type": "food", "course_type": "side", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE ('[{"name": "Truffle Mac & Cheese", "item_type": "food", "course_type": "side", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (3 + (rn % 3)) || '}]')::jsonb END
      WHEN rn <= 55 THEN
        CASE WHEN rn IN (50, 55) THEN
          '[{"name": "Classic Margarita", "item_type": "cocktail", "course_type": "drink", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE ('[{"name": "Classic Margarita", "item_type": "cocktail", "course_type": "drink", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (3 + (rn % 2)) || '}]')::jsonb END
      WHEN rn <= 65 THEN
        CASE WHEN rn IN (60, 65) THEN
          '[{"name": "Grilled Caesar Salad", "item_type": "food", "course_type": "appetizer", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE ('[{"name": "Grilled Caesar Salad", "item_type": "food", "course_type": "appetizer", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (3 + (rn % 2)) || '}]')::jsonb END
      WHEN rn <= 73 THEN
        CASE WHEN rn = 73 THEN
          '[{"name": "Creme Brulee", "item_type": "food", "course_type": "dessert", "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
        ELSE ('[{"name": "Creme Brulee", "item_type": "food", "course_type": "dessert", "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": ' || (3 + (rn % 2)) || '}]')::jsonb END
      ELSE '[]'::jsonb
    END,
    CASE
      WHEN rn <= 14 THEN CASE WHEN rn = 7 THEN '[{"name": "Maria Garcia", "role": "server", "sentiment": "negative"}]'::jsonb
        ELSE '[{"name": "Maria Garcia", "role": "server", "sentiment": "positive"}]'::jsonb END
      WHEN rn <= 24 THEN CASE WHEN rn = 24 THEN '[{"name": "Carlos Reyes", "role": "bartender", "sentiment": "neutral"}]'::jsonb
        ELSE '[{"name": "Carlos Reyes", "role": "bartender", "sentiment": "positive"}]'::jsonb END
      WHEN rn <= 31 THEN CASE WHEN rn = 31 THEN '[{"name": "Jake Thompson", "role": "server", "sentiment": "negative"}]'::jsonb
        ELSE '[{"name": "Jake Thompson", "role": "server", "sentiment": "positive"}]'::jsonb END
      WHEN rn <= 36 THEN '[{"name": "Sofia Martinez", "role": "host", "sentiment": "positive"}]'::jsonb
      WHEN rn <= 40 THEN CASE WHEN rn = 40 THEN '[{"name": "David Chen", "role": "manager", "sentiment": "negative"}]'::jsonb
        ELSE '[{"name": "David Chen", "role": "manager", "sentiment": "positive"}]'::jsonb END
      ELSE '[]'::jsonb
    END,
    CASE WHEN rr.rating >= 4 THEN 'likely' WHEN rr.rating = 3 THEN 'unclear' ELSE 'unlikely' END,
    false, '[]'::jsonb,
    rr.rating, rr.review_date, now()
  FROM (
    SELECT *, ROW_NUMBER() OVER (ORDER BY SUBSTRING(platform_review_id FROM '[0-9]+$')::int) AS rn
    FROM public.restaurant_reviews
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
      AND analysis_status = 'completed'
  ) rr
  ON CONFLICT (review_id) DO UPDATE SET
    strengths = EXCLUDED.strengths, opportunities = EXCLUDED.opportunities,
    items_mentioned = EXCLUDED.items_mentioned, staff_mentioned = EXCLUDED.staff_mentioned,
    overall_sentiment = EXCLUDED.overall_sentiment, emotion = EXCLUDED.emotion;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Alamo Prime analyses upserted: %', v_count;

  -- Competitor Analyses (220 completed)
  INSERT INTO public.review_analyses (
    group_id, review_id, restaurant_id,
    overall_sentiment, emotion,
    strengths, opportunities,
    items_mentioned, staff_mentioned,
    return_intent, high_severity_flag, high_severity_details,
    rating, review_date, created_at
  )
  SELECT
    v_group_id, rr.id, rr.restaurant_id,
    CASE WHEN rr.rating >= 4 THEN 'positive' WHEN rr.rating = 3 THEN 'neutral' ELSE 'negative' END,
    CASE
      WHEN rr.rating = 5 THEN CASE WHEN ROW_NUMBER() OVER (PARTITION BY rr.restaurant_id ORDER BY rr.review_date) % 3 = 0
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
    '[]'::jsonb, '[]'::jsonb,
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
    strengths = EXCLUDED.strengths, opportunities = EXCLUDED.opportunities,
    items_mentioned = EXCLUDED.items_mentioned, staff_mentioned = EXCLUDED.staff_mentioned,
    overall_sentiment = EXCLUDED.overall_sentiment, emotion = EXCLUDED.emotion;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Competitor analyses upserted: %', v_count;

  -- High-Severity Flags
  UPDATE public.review_analyses SET high_severity_flag = true,
    high_severity_details = '[{"type": "health_safety", "summary": "Guest reported finding a foreign object in their salad."}]'::jsonb
  WHERE review_id = (SELECT id FROM public.restaurant_reviews WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' AND rating = 2 AND analysis_status = 'completed' ORDER BY review_date DESC LIMIT 1);

  UPDATE public.review_analyses SET high_severity_flag = true,
    high_severity_details = '[{"type": "staff_conduct", "summary": "Guest reported being spoken to rudely by a staff member."}]'::jsonb
  WHERE review_id = (SELECT id FROM public.restaurant_reviews WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' AND rating = 3 AND analysis_status = 'completed' ORDER BY review_date DESC LIMIT 1);

  UPDATE public.review_analyses SET high_severity_flag = true,
    high_severity_details = '[{"type": "health_safety", "summary": "Guest described food poisoning symptoms after dining."}]'::jsonb
  WHERE review_id = (SELECT id FROM public.restaurant_reviews WHERE restaurant_id = '44444444-4444-4444-4444-444444444444' AND rating = 1 AND analysis_status = 'completed' ORDER BY review_date DESC LIMIT 1);

  UPDATE public.review_analyses SET high_severity_flag = true,
    high_severity_details = '[{"type": "pest_sighting", "summary": "Guest reported seeing a cockroach near the bar area."}]'::jsonb
  WHERE review_id = (SELECT id FROM public.restaurant_reviews WHERE restaurant_id = '44444444-4444-4444-4444-444444444444' AND rating = 2 AND analysis_status = 'completed' ORDER BY review_date DESC LIMIT 1);

  SELECT COUNT(*) INTO v_count FROM public.review_analyses;
  RAISE NOTICE 'Total review_analyses: %', v_count;
  SELECT COUNT(*) INTO v_count FROM public.review_analyses WHERE high_severity_flag = true;
  RAISE NOTICE 'High severity flags: %', v_count;
END;
$$;

-- ─── STEP 3: Re-run rollups ────────────────────────────────────────────────

DO $$
DECLARE
  v_date DATE;
  v_count INTEGER;
BEGIN
  RAISE NOTICE 'Re-running daily rollups...';
  FOR v_date IN SELECT generate_series('2025-12-01'::date, CURRENT_DATE - 1, '1 day')::date
  LOOP
    PERFORM public.rollup_daily_flavor_index(v_date);
  END LOOP;
  SELECT COUNT(*) INTO v_count FROM public.flavor_index_daily;
  RAISE NOTICE 'flavor_index_daily: % rows', v_count;

  RAISE NOTICE 'Re-running intelligence rollups...';
  FOR v_date IN SELECT generate_series('2025-12-01'::date, CURRENT_DATE - 1, '7 days')::date
  LOOP
    PERFORM public.rollup_review_intelligence(v_date);
  END LOOP;
  PERFORM public.rollup_review_intelligence(CURRENT_DATE - 1);
  SELECT COUNT(*) INTO v_count FROM public.review_intelligence;
  RAISE NOTICE 'review_intelligence: % rows', v_count;

  RAISE NOTICE 'Full reseed + rollup complete.';
END;
$$;
