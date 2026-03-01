-- S02: Seed 390 synthetic reviews + 368 analyses + daily rollups + 16 intelligence periods
-- This is a large seed migration for the Review Analyst & Flavor Index system.
-- All data uses deterministic patterns for verifiable test data.

DO $$
DECLARE
  v_group_id UUID;
  v_base_date DATE := '2025-12-01';
  v_reviewer_names TEXT[];
BEGIN
  -- Get group
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- Reviewer name pool (20 names, cycled via modulo)
  v_reviewer_names := ARRAY[
    'James W.', 'Sarah M.', 'Michael R.', 'Emily K.', 'David L.',
    'Jessica P.', 'Robert T.', 'Amanda C.', 'Chris B.', 'Lauren H.',
    'Matt D.', 'Ashley N.', 'Ryan G.', 'Stephanie F.', 'Kevin J.',
    'Michelle S.', 'Brian A.', 'Rachel V.', 'Daniel E.', 'Nicole O.'
  ];

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 1: Insert Reviews (4 restaurants, 390 total)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 1a. Alamo Prime Steakhouse (150 reviews)
  -- Stars: 123/17/5/3/2, FI: +75.33
  -- Platform: 50% Google / 30% OpenTable / 20% TripAdvisor
  -- Status: 148 completed, 1 pending, 1 failed
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
    CASE WHEN i > 148 THEN
      'This is a synthetic review for testing. Review #' || i || '. Had dinner here last weekend. The ribeye was cooked perfectly medium-rare and the truffle mac was rich without being heavy. Our server Maria was attentive and friendly. Only downside was the 20-minute wait for a table despite having a reservation. Would definitely come back though.'
    ELSE NULL END,
    CASE WHEN i <= 148 THEN 'completed' WHEN i <= 149 THEN 'pending' ELSE 'failed' END,
    now(), now()
  FROM generate_series(1, 150) AS i;

  -- 1b. Longhorn & Ember (100 reviews)
  -- Stars: 67/14/8/7/4, FI: +48.00
  -- Status: 90 completed, 5 pending, 5 failed
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
    CASE WHEN i > 90 THEN
      'Synthetic review for testing. Review #' || i || '. Solid steakhouse experience.'
    ELSE NULL END,
    CASE WHEN i <= 90 THEN 'completed' WHEN i <= 95 THEN 'pending' ELSE 'failed' END,
    now(), now()
  FROM generate_series(1, 100) AS i;

  -- 1c. Salt & Sear Chophouse (80 reviews)
  -- Stars: 43/14/10/8/5, FI: +25.00
  -- Status: 75 completed, 4 pending, 1 failed
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
    CASE WHEN i > 75 THEN
      'Synthetic review for testing. Review #' || i || '. Good food, hit or miss service.'
    ELSE NULL END,
    CASE WHEN i <= 75 THEN 'completed' WHEN i <= 79 THEN 'pending' ELSE 'failed' END,
    now(), now()
  FROM generate_series(1, 80) AS i;

  -- 1d. Mesquite Flame Grill (60 reviews)
  -- Stars: 22/13/10/9/6, FI: -5.00
  -- NO OpenTable (Google + TripAdvisor only)
  -- Status: 55 completed, 3 pending, 2 failed
  INSERT INTO public.restaurant_reviews (
    group_id, restaurant_id, platform, platform_review_id,
    rating, review_date, reviewer_name, language,
    review_text, analysis_status, scraped_at, created_at
  )
  SELECT
    v_group_id,
    '44444444-4444-4444-4444-444444444444',
    CASE WHEN i <= 40 THEN 'google' ELSE 'tripadvisor' END,
    'seed-mesquite-' || LPAD(i::text, 4, '0'),
    CASE WHEN i <= 22 THEN 5 WHEN i <= 35 THEN 4 WHEN i <= 45 THEN 3
         WHEN i <= 54 THEN 2 ELSE 1 END,
    v_base_date + (((i - 1) * 82) / 60) * INTERVAL '1 day'
      + (10 + (i * 7 % 12)) * INTERVAL '1 hour'
      + (i * 13 % 60) * INTERVAL '1 minute',
    v_reviewer_names[(i % 20) + 1],
    'en',
    CASE WHEN i > 55 THEN
      'Synthetic review for testing. Review #' || i || '. Disappointing experience overall.'
    ELSE NULL END,
    CASE WHEN i <= 55 THEN 'completed' WHEN i <= 58 THEN 'pending' ELSE 'failed' END,
    now(), now()
  FROM generate_series(1, 60) AS i;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 2: Update failed reviews with retry info
  -- ═══════════════════════════════════════════════════════════════════════════

  UPDATE public.restaurant_reviews
  SET
    retry_count = 3,
    last_error = 'OpenAI API error: rate_limit_exceeded (429). Retries exhausted after 3 attempts.'
  WHERE analysis_status = 'failed'
    AND group_id = v_group_id;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 3a: Insert Alamo Prime Analyses (148 completed, with staff + items)
  -- ═══════════════════════════════════════════════════════════════════════════

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
    -- overall_sentiment from star rating
    CASE WHEN rr.rating >= 4 THEN 'positive' WHEN rr.rating = 3 THEN 'neutral' ELSE 'negative' END,
    -- emotion (every 3rd 5-star is satisfied, rest delighted)
    CASE
      WHEN rr.rating = 5 THEN CASE WHEN rn % 3 = 0 THEN 'satisfied' ELSE 'delighted' END
      WHEN rr.rating = 4 THEN 'satisfied'
      WHEN rr.rating = 3 THEN 'neutral'
      WHEN rr.rating = 2 THEN 'frustrated'
      ELSE 'angry'
    END,
    -- strengths (populated for rating >= 4)
    CASE WHEN rr.rating >= 4 THEN
      ('[{"category": "Food Quality", "intensity": ' || (3 + rr.rating % 3) ||
       '}, {"category": "Service Attitude", "intensity": ' || (2 + rr.rating % 4) || '}]')::jsonb
    ELSE '[]'::jsonb END,
    -- opportunities (populated for rating <= 3)
    CASE WHEN rr.rating <= 3 THEN
      ('[{"category": "Wait Time", "intensity": ' || (4 - rr.rating + 1) ||
       '}, {"category": "Value", "intensity": ' || (3 - rr.rating + 1) || '}]')::jsonb
    ELSE '[]'::jsonb END,
    -- items_mentioned (Alamo Prime specific items, first 73 analyses)
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
    -- staff_mentioned (Alamo Prime only, first 40 analyses)
    CASE
      WHEN rn <= 14 THEN
        CASE WHEN rn = 7 THEN
          '[{"name": "Maria Garcia", "role": "server", "sentiment": "negative"}]'::jsonb
        ELSE
          '[{"name": "Maria Garcia", "role": "server", "sentiment": "positive"}]'::jsonb
        END
      WHEN rn <= 24 THEN
        CASE WHEN rn = 24 THEN
          '[{"name": "Carlos Reyes", "role": "bartender", "sentiment": "neutral"}]'::jsonb
        ELSE
          '[{"name": "Carlos Reyes", "role": "bartender", "sentiment": "positive"}]'::jsonb
        END
      WHEN rn <= 31 THEN
        CASE WHEN rn = 31 THEN
          '[{"name": "Jake Thompson", "role": "server", "sentiment": "negative"}]'::jsonb
        ELSE
          '[{"name": "Jake Thompson", "role": "server", "sentiment": "positive"}]'::jsonb
        END
      WHEN rn <= 36 THEN
        '[{"name": "Sofia Martinez", "role": "host", "sentiment": "positive"}]'::jsonb
      WHEN rn <= 40 THEN
        CASE WHEN rn = 40 THEN
          '[{"name": "David Chen", "role": "manager", "sentiment": "negative"}]'::jsonb
        ELSE
          '[{"name": "David Chen", "role": "manager", "sentiment": "positive"}]'::jsonb
        END
      ELSE '[]'::jsonb
    END,
    -- return_intent
    CASE WHEN rr.rating >= 4 THEN 'likely' WHEN rr.rating = 3 THEN 'unclear' ELSE 'unlikely' END,
    false, '[]'::jsonb,
    rr.rating, rr.review_date, now()
  FROM (
    SELECT *,
      ROW_NUMBER() OVER (ORDER BY SUBSTRING(platform_review_id FROM '[0-9]+$')::int) AS rn
    FROM public.restaurant_reviews
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
      AND analysis_status = 'completed'
  ) rr;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 3b: Insert Competitor Analyses (220 completed, no staff/items)
  -- ═══════════════════════════════════════════════════════════════════════════

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
    '[]'::jsonb,  -- competitors: no item mentions
    '[]'::jsonb,  -- competitors: no staff mentions
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
  AND rr.group_id = v_group_id;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 4: High-Severity Flags (4 total: 2 Alamo, 2 Mesquite)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Alamo Prime flag 1: health/safety (2-star completed)
  UPDATE public.review_analyses
  SET
    high_severity_flag = true,
    high_severity_details = '[{"type": "health_safety", "summary": "Guest reported finding a foreign object in their salad. Described as a small piece of plastic wrap."}]'::jsonb
  WHERE review_id = (
    SELECT id FROM public.restaurant_reviews
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
      AND rating = 2 AND analysis_status = 'completed'
    ORDER BY review_date DESC LIMIT 1
  );

  -- Alamo Prime flag 2: staff conduct (3-star completed)
  UPDATE public.review_analyses
  SET
    high_severity_flag = true,
    high_severity_details = '[{"type": "staff_conduct", "summary": "Guest reported being spoken to rudely by a staff member when asking to be reseated. Used language like ''dismissive'' and ''condescending''."}]'::jsonb
  WHERE review_id = (
    SELECT id FROM public.restaurant_reviews
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
      AND rating = 3 AND analysis_status = 'completed'
    ORDER BY review_date DESC LIMIT 1
  );

  -- Mesquite Flame flag 1: health/safety (1-star completed)
  UPDATE public.review_analyses
  SET
    high_severity_flag = true,
    high_severity_details = '[{"type": "health_safety", "summary": "Guest reported food poisoning symptoms within hours of dining. Mentioned undercooked chicken appetizer."}]'::jsonb
  WHERE review_id = (
    SELECT id FROM public.restaurant_reviews
    WHERE restaurant_id = '44444444-4444-4444-4444-444444444444'
      AND rating = 1 AND analysis_status = 'completed'
    ORDER BY review_date DESC LIMIT 1
  );

  -- Mesquite Flame flag 2: legal threat (2-star completed)
  UPDATE public.review_analyses
  SET
    high_severity_flag = true,
    high_severity_details = '[{"type": "legal_threat", "summary": "Guest mentioned contacting the health department and ''considering legal action'' after a large party reservation was not honored."}]'::jsonb
  WHERE review_id = (
    SELECT id FROM public.restaurant_reviews
    WHERE restaurant_id = '44444444-4444-4444-4444-444444444444'
      AND rating = 2 AND analysis_status = 'completed'
    ORDER BY review_date DESC LIMIT 1
  );

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 5: Daily Rollups (computed from seeded reviews)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- NOTE: flavor_index column is GENERATED ALWAYS AS STORED — must NOT appear in INSERT

  INSERT INTO public.flavor_index_daily (
    group_id, restaurant_id, date,
    total_reviews, five_star, four_star, three_star, two_star, one_star,
    avg_rating,
    food_sentiment, service_sentiment, ambience_sentiment, value_sentiment
  )
  SELECT
    v_group_id,
    rr.restaurant_id,
    rr.review_date::date,
    COUNT(*),
    COUNT(*) FILTER (WHERE rr.rating = 5),
    COUNT(*) FILTER (WHERE rr.rating = 4),
    COUNT(*) FILTER (WHERE rr.rating = 3),
    COUNT(*) FILTER (WHERE rr.rating = 2),
    COUNT(*) FILTER (WHERE rr.rating = 1),
    ROUND(AVG(rr.rating), 2),
    -- Sentiment columns: NULL for December (pre-AI-extraction), populated for Jan+Feb
    CASE WHEN rr.review_date::date >= '2026-01-01' THEN
      ROUND(0.4 + (COUNT(*) FILTER (WHERE rr.rating >= 4))::numeric
                  / NULLIF(COUNT(*), 0) * 0.5, 3)
    ELSE NULL END,
    CASE WHEN rr.review_date::date >= '2026-01-01' THEN
      ROUND(0.2 + (COUNT(*) FILTER (WHERE rr.rating >= 4))::numeric
                  / NULLIF(COUNT(*), 0) * 0.4, 3)
    ELSE NULL END,
    CASE WHEN rr.review_date::date >= '2026-01-01' THEN
      ROUND(0.3 + (COUNT(*) FILTER (WHERE rr.rating >= 4))::numeric
                  / NULLIF(COUNT(*), 0) * 0.3, 3)
    ELSE NULL END,
    CASE WHEN rr.review_date::date >= '2026-01-01' THEN
      ROUND(0.1 + (COUNT(*) FILTER (WHERE rr.rating >= 4))::numeric
                  / NULLIF(COUNT(*), 0) * 0.3, 3)
    ELSE NULL END
  FROM public.restaurant_reviews rr
  WHERE rr.group_id = v_group_id
  GROUP BY rr.restaurant_id, rr.review_date::date
  ON CONFLICT (restaurant_id, date) DO UPDATE SET
    total_reviews = EXCLUDED.total_reviews,
    five_star = EXCLUDED.five_star,
    four_star = EXCLUDED.four_star,
    three_star = EXCLUDED.three_star,
    two_star = EXCLUDED.two_star,
    one_star = EXCLUDED.one_star,
    avg_rating = EXCLUDED.avg_rating,
    food_sentiment = EXCLUDED.food_sentiment,
    service_sentiment = EXCLUDED.service_sentiment,
    ambience_sentiment = EXCLUDED.ambience_sentiment,
    value_sentiment = EXCLUDED.value_sentiment;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 6: Review Intelligence Periods (16 rows: 4 per restaurant)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- NOTE: These are hand-crafted test fixture data designed to give Phase 4a
  -- developers a realistic dashboard experience. Values tell a narrative
  -- (gradually improving trend) and may not precisely match
  -- compute_flavor_index_range() output.

  INSERT INTO public.review_intelligence (
    group_id, restaurant_id,
    period_type, period_start, period_end,
    total_reviews, avg_rating, flavor_index, flavor_index_change,
    food_sentiment, service_sentiment, ambience_sentiment, value_sentiment,
    top_positive_items, top_complaints, top_strengths, top_opportunities,
    top_staff, platform_breakdown,
    high_severity_count, return_likely_pct, return_unlikely_pct,
    emotion_distribution
  ) VALUES
  -- ─── Alamo Prime: December 2025 ─────────────────────────────────────────
  (
    v_group_id, '11111111-1111-1111-1111-111111111111',
    'month', '2025-12-01', '2025-12-31',
    57, 4.58, 68.89, NULL,
    NULL, NULL, NULL, NULL,
    '[{"item": "Bone-In Ribeye", "mentions": 8, "avg_sentiment": 0.85}]'::jsonb,
    '[{"item": "Wait Time", "mentions": 6, "avg_sentiment": -0.65}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 4.1, "count": 30}]'::jsonb,
    '[{"category": "Wait Time", "avg_intensity": 3.2, "count": 8}]'::jsonb,
    '[{"name": "Maria Garcia", "mentions": 4, "positive": 4, "negative": 0}]'::jsonb,
    '{"google": {"count": 28, "avg_rating": 4.55, "flavor_index": 68.18}, "opentable": {"count": 18, "avg_rating": 4.64, "flavor_index": 71.43}, "tripadvisor": {"count": 11, "avg_rating": 4.56, "flavor_index": 66.67}}'::jsonb,
    0, 82.00, 6.00,
    '{"delighted": 55, "satisfied": 25, "neutral": 10, "frustrated": 7, "angry": 3}'::jsonb
  ),
  -- ─── Alamo Prime: January 2026 ─────────────────────────────────────────
  (
    v_group_id, '11111111-1111-1111-1111-111111111111',
    'month', '2026-01-01', '2026-01-31',
    57, 4.66, 76.00, 7.11,
    0.820, 0.650, 0.710, 0.480,
    '[{"item": "Bone-In Ribeye", "mentions": 10, "avg_sentiment": 0.90}, {"item": "Truffle Mac & Cheese", "mentions": 5, "avg_sentiment": 0.92}]'::jsonb,
    '[{"item": "Wait Time", "mentions": 8, "avg_sentiment": -0.70}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 4.3, "count": 35}]'::jsonb,
    '[{"category": "Wait Time", "avg_intensity": 3.5, "count": 10}]'::jsonb,
    '[{"name": "Maria Garcia", "mentions": 5, "positive": 5, "negative": 0}, {"name": "Carlos Reyes", "mentions": 4, "positive": 4, "negative": 0}]'::jsonb,
    '{"google": {"count": 29, "avg_rating": 4.68, "flavor_index": 76.00}, "opentable": {"count": 17, "avg_rating": 4.67, "flavor_index": 73.33}, "tripadvisor": {"count": 11, "avg_rating": 4.60, "flavor_index": 80.00}}'::jsonb,
    1, 86.00, 4.00,
    '{"delighted": 60, "satisfied": 22, "neutral": 8, "frustrated": 7, "angry": 3}'::jsonb
  ),
  -- ─── Alamo Prime: February 2026 ────────────────────────────────────────
  (
    v_group_id, '11111111-1111-1111-1111-111111111111',
    'month', '2026-02-01', '2026-02-20',
    36, 4.71, 80.00, 4.00,
    0.850, 0.700, 0.730, 0.510,
    '[{"item": "Bone-In Ribeye", "mentions": 10, "avg_sentiment": 0.95}, {"item": "Truffle Mac & Cheese", "mentions": 6, "avg_sentiment": 0.95}, {"item": "Classic Margarita", "mentions": 5, "avg_sentiment": 0.88}]'::jsonb,
    '[{"item": "Wait Time", "mentions": 8, "avg_sentiment": -0.72}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 4.5, "count": 40}]'::jsonb,
    '[{"category": "Wait Time", "avg_intensity": 3.3, "count": 9}]'::jsonb,
    '[{"name": "Maria Garcia", "mentions": 5, "positive": 4, "negative": 1}, {"name": "Carlos Reyes", "mentions": 3, "positive": 3, "negative": 0}, {"name": "Jake Thompson", "mentions": 3, "positive": 3, "negative": 0}]'::jsonb,
    '{"google": {"count": 18, "avg_rating": 4.75, "flavor_index": 82.14}, "opentable": {"count": 10, "avg_rating": 4.69, "flavor_index": 75.00}, "tripadvisor": {"count": 8, "avg_rating": 4.64, "flavor_index": 81.82}}'::jsonb,
    1, 89.00, 3.00,
    '{"delighted": 62, "satisfied": 22, "neutral": 7, "frustrated": 6, "angry": 3}'::jsonb
  ),
  -- ─── Alamo Prime: Q4 2025 ──────────────────────────────────────────────
  (
    v_group_id, '11111111-1111-1111-1111-111111111111',
    'quarter', '2025-10-01', '2025-12-31',
    57, 4.58, 68.89, NULL,
    NULL, NULL, NULL, NULL,
    '[{"item": "Bone-In Ribeye", "mentions": 8, "avg_sentiment": 0.85}]'::jsonb,
    '[{"item": "Wait Time", "mentions": 6, "avg_sentiment": -0.65}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 4.1, "count": 30}]'::jsonb,
    '[{"category": "Wait Time", "avg_intensity": 3.2, "count": 8}]'::jsonb,
    '[{"name": "Maria Garcia", "mentions": 4, "positive": 4, "negative": 0}]'::jsonb,
    '{"google": {"count": 28, "avg_rating": 4.55, "flavor_index": 68.18}, "opentable": {"count": 18, "avg_rating": 4.64, "flavor_index": 71.43}, "tripadvisor": {"count": 11, "avg_rating": 4.56, "flavor_index": 66.67}}'::jsonb,
    0, 82.00, 6.00,
    '{"delighted": 55, "satisfied": 25, "neutral": 10, "frustrated": 7, "angry": 3}'::jsonb
  ),

  -- ─── Longhorn & Ember: December 2025 ───────────────────────────────────
  (
    v_group_id, '22222222-2222-2222-2222-222222222222',
    'month', '2025-12-01', '2025-12-31',
    38, 4.30, 45.00, NULL,
    NULL, NULL, NULL, NULL,
    '[{"item": "Prime Rib", "mentions": 5, "avg_sentiment": 0.80}]'::jsonb,
    '[{"item": "Noise Level", "mentions": 4, "avg_sentiment": -0.55}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.8, "count": 20}]'::jsonb,
    '[{"category": "Ambience", "avg_intensity": 3.0, "count": 6}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 19, "avg_rating": 4.28, "flavor_index": 44.00}, "opentable": {"count": 12, "avg_rating": 4.35, "flavor_index": 47.00}, "tripadvisor": {"count": 7, "avg_rating": 4.25, "flavor_index": 43.00}}'::jsonb,
    0, 72.00, 10.00,
    '{"delighted": 40, "satisfied": 30, "neutral": 15, "frustrated": 10, "angry": 5}'::jsonb
  ),
  -- ─── Longhorn & Ember: January 2026 ────────────────────────────────────
  (
    v_group_id, '22222222-2222-2222-2222-222222222222',
    'month', '2026-01-01', '2026-01-31',
    38, 4.33, 48.48, 3.48,
    0.720, 0.580, 0.610, 0.420,
    '[{"item": "Prime Rib", "mentions": 6, "avg_sentiment": 0.82}, {"item": "Smoked Brisket", "mentions": 4, "avg_sentiment": 0.78}]'::jsonb,
    '[{"item": "Service Speed", "mentions": 5, "avg_sentiment": -0.60}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.9, "count": 22}]'::jsonb,
    '[{"category": "Service Speed", "avg_intensity": 3.2, "count": 7}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 19, "avg_rating": 4.35, "flavor_index": 49.00}, "opentable": {"count": 12, "avg_rating": 4.30, "flavor_index": 46.00}, "tripadvisor": {"count": 7, "avg_rating": 4.33, "flavor_index": 50.00}}'::jsonb,
    0, 75.00, 8.00,
    '{"delighted": 42, "satisfied": 28, "neutral": 14, "frustrated": 11, "angry": 5}'::jsonb
  ),
  -- ─── Longhorn & Ember: February 2026 ───────────────────────────────────
  (
    v_group_id, '22222222-2222-2222-2222-222222222222',
    'month', '2026-02-01', '2026-02-20',
    24, 4.38, 52.00, 3.52,
    0.740, 0.600, 0.630, 0.440,
    '[{"item": "Prime Rib", "mentions": 4, "avg_sentiment": 0.85}, {"item": "Smoked Brisket", "mentions": 3, "avg_sentiment": 0.80}]'::jsonb,
    '[{"item": "Service Speed", "mentions": 3, "avg_sentiment": -0.58}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 4.0, "count": 14}]'::jsonb,
    '[{"category": "Service Speed", "avg_intensity": 3.0, "count": 4}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 12, "avg_rating": 4.40, "flavor_index": 53.00}, "opentable": {"count": 7, "avg_rating": 4.35, "flavor_index": 50.00}, "tripadvisor": {"count": 5, "avg_rating": 4.38, "flavor_index": 52.00}}'::jsonb,
    0, 78.00, 7.00,
    '{"delighted": 44, "satisfied": 28, "neutral": 13, "frustrated": 10, "angry": 5}'::jsonb
  ),
  -- ─── Longhorn & Ember: Q4 2025 ─────────────────────────────────────────
  (
    v_group_id, '22222222-2222-2222-2222-222222222222',
    'quarter', '2025-10-01', '2025-12-31',
    38, 4.30, 45.00, NULL,
    NULL, NULL, NULL, NULL,
    '[{"item": "Prime Rib", "mentions": 5, "avg_sentiment": 0.80}]'::jsonb,
    '[{"item": "Noise Level", "mentions": 4, "avg_sentiment": -0.55}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.8, "count": 20}]'::jsonb,
    '[{"category": "Ambience", "avg_intensity": 3.0, "count": 6}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 19, "avg_rating": 4.28, "flavor_index": 44.00}, "opentable": {"count": 12, "avg_rating": 4.35, "flavor_index": 47.00}, "tripadvisor": {"count": 7, "avg_rating": 4.25, "flavor_index": 43.00}}'::jsonb,
    0, 72.00, 10.00,
    '{"delighted": 40, "satisfied": 30, "neutral": 15, "frustrated": 10, "angry": 5}'::jsonb
  ),

  -- ─── Salt & Sear: December 2025 ────────────────────────────────────────
  (
    v_group_id, '33333333-3333-3333-3333-333333333333',
    'month', '2025-12-01', '2025-12-31',
    31, 3.98, 22.00, NULL,
    NULL, NULL, NULL, NULL,
    '[{"item": "Dry-Aged Strip", "mentions": 4, "avg_sentiment": 0.75}]'::jsonb,
    '[{"item": "Value", "mentions": 5, "avg_sentiment": -0.62}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.5, "count": 16}]'::jsonb,
    '[{"category": "Value", "avg_intensity": 3.4, "count": 8}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 16, "avg_rating": 3.95, "flavor_index": 21.00}, "opentable": {"count": 9, "avg_rating": 4.05, "flavor_index": 24.00}, "tripadvisor": {"count": 6, "avg_rating": 3.92, "flavor_index": 20.00}}'::jsonb,
    0, 60.00, 15.00,
    '{"delighted": 30, "satisfied": 25, "neutral": 20, "frustrated": 15, "angry": 10}'::jsonb
  ),
  -- ─── Salt & Sear: January 2026 ─────────────────────────────────────────
  (
    v_group_id, '33333333-3333-3333-3333-333333333333',
    'month', '2026-01-01', '2026-01-31',
    30, 4.04, 26.00, 4.00,
    0.600, 0.480, 0.520, 0.350,
    '[{"item": "Dry-Aged Strip", "mentions": 4, "avg_sentiment": 0.78}, {"item": "Lobster Tail", "mentions": 3, "avg_sentiment": 0.72}]'::jsonb,
    '[{"item": "Value", "mentions": 4, "avg_sentiment": -0.58}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.6, "count": 16}]'::jsonb,
    '[{"category": "Value", "avg_intensity": 3.3, "count": 7}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 15, "avg_rating": 4.02, "flavor_index": 25.00}, "opentable": {"count": 9, "avg_rating": 4.08, "flavor_index": 28.00}, "tripadvisor": {"count": 6, "avg_rating": 4.00, "flavor_index": 24.00}}'::jsonb,
    0, 63.00, 13.00,
    '{"delighted": 32, "satisfied": 25, "neutral": 18, "frustrated": 15, "angry": 10}'::jsonb
  ),
  -- ─── Salt & Sear: February 2026 ────────────────────────────────────────
  (
    v_group_id, '33333333-3333-3333-3333-333333333333',
    'month', '2026-02-01', '2026-02-20',
    19, 4.08, 28.00, 2.00,
    0.620, 0.500, 0.540, 0.370,
    '[{"item": "Dry-Aged Strip", "mentions": 3, "avg_sentiment": 0.80}]'::jsonb,
    '[{"item": "Value", "mentions": 3, "avg_sentiment": -0.55}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.7, "count": 10}]'::jsonb,
    '[{"category": "Value", "avg_intensity": 3.2, "count": 4}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 9, "avg_rating": 4.10, "flavor_index": 29.00}, "opentable": {"count": 6, "avg_rating": 4.08, "flavor_index": 27.00}, "tripadvisor": {"count": 4, "avg_rating": 4.05, "flavor_index": 26.00}}'::jsonb,
    0, 65.00, 12.00,
    '{"delighted": 33, "satisfied": 26, "neutral": 17, "frustrated": 14, "angry": 10}'::jsonb
  ),
  -- ─── Salt & Sear: Q4 2025 ──────────────────────────────────────────────
  (
    v_group_id, '33333333-3333-3333-3333-333333333333',
    'quarter', '2025-10-01', '2025-12-31',
    31, 3.98, 22.00, NULL,
    NULL, NULL, NULL, NULL,
    '[{"item": "Dry-Aged Strip", "mentions": 4, "avg_sentiment": 0.75}]'::jsonb,
    '[{"item": "Value", "mentions": 5, "avg_sentiment": -0.62}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.5, "count": 16}]'::jsonb,
    '[{"category": "Value", "avg_intensity": 3.4, "count": 8}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 16, "avg_rating": 3.95, "flavor_index": 21.00}, "opentable": {"count": 9, "avg_rating": 4.05, "flavor_index": 24.00}, "tripadvisor": {"count": 6, "avg_rating": 3.92, "flavor_index": 20.00}}'::jsonb,
    0, 60.00, 15.00,
    '{"delighted": 30, "satisfied": 25, "neutral": 20, "frustrated": 15, "angry": 10}'::jsonb
  ),

  -- ─── Mesquite Flame: December 2025 ─────────────────────────────────────
  (
    v_group_id, '44444444-4444-4444-4444-444444444444',
    'month', '2025-12-01', '2025-12-31',
    23, 3.50, -8.00, NULL,
    NULL, NULL, NULL, NULL,
    '[{"item": "Brisket Tacos", "mentions": 3, "avg_sentiment": 0.68}]'::jsonb,
    '[{"item": "Cleanliness", "mentions": 4, "avg_sentiment": -0.72}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.2, "count": 10}]'::jsonb,
    '[{"category": "Cleanliness", "avg_intensity": 3.8, "count": 6}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 15, "avg_rating": 3.48, "flavor_index": -9.00}, "tripadvisor": {"count": 8, "avg_rating": 3.55, "flavor_index": -6.00}}'::jsonb,
    1, 45.00, 25.00,
    '{"delighted": 20, "satisfied": 18, "neutral": 22, "frustrated": 25, "angry": 15}'::jsonb
  ),
  -- ─── Mesquite Flame: January 2026 ──────────────────────────────────────
  (
    v_group_id, '44444444-4444-4444-4444-444444444444',
    'month', '2026-01-01', '2026-01-31',
    23, 3.55, -4.35, 3.65,
    0.420, 0.340, 0.380, 0.280,
    '[{"item": "Brisket Tacos", "mentions": 3, "avg_sentiment": 0.70}]'::jsonb,
    '[{"item": "Cleanliness", "mentions": 3, "avg_sentiment": -0.68}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.3, "count": 11}]'::jsonb,
    '[{"category": "Cleanliness", "avg_intensity": 3.6, "count": 5}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 15, "avg_rating": 3.52, "flavor_index": -5.00}, "tripadvisor": {"count": 8, "avg_rating": 3.60, "flavor_index": -3.00}}'::jsonb,
    1, 48.00, 22.00,
    '{"delighted": 22, "satisfied": 18, "neutral": 20, "frustrated": 24, "angry": 16}'::jsonb
  ),
  -- ─── Mesquite Flame: February 2026 ─────────────────────────────────────
  (
    v_group_id, '44444444-4444-4444-4444-444444444444',
    'month', '2026-02-01', '2026-02-20',
    14, 3.65, -2.00, 2.35,
    0.440, 0.360, 0.400, 0.300,
    '[{"item": "Brisket Tacos", "mentions": 2, "avg_sentiment": 0.72}]'::jsonb,
    '[{"item": "Cleanliness", "mentions": 2, "avg_sentiment": -0.65}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.4, "count": 7}]'::jsonb,
    '[{"category": "Cleanliness", "avg_intensity": 3.5, "count": 3}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 10, "avg_rating": 3.62, "flavor_index": -3.00}, "tripadvisor": {"count": 4, "avg_rating": 3.70, "flavor_index": 0.00}}'::jsonb,
    0, 50.00, 20.00,
    '{"delighted": 23, "satisfied": 19, "neutral": 20, "frustrated": 23, "angry": 15}'::jsonb
  ),
  -- ─── Mesquite Flame: Q4 2025 ───────────────────────────────────────────
  (
    v_group_id, '44444444-4444-4444-4444-444444444444',
    'quarter', '2025-10-01', '2025-12-31',
    23, 3.50, -8.00, NULL,
    NULL, NULL, NULL, NULL,
    '[{"item": "Brisket Tacos", "mentions": 3, "avg_sentiment": 0.68}]'::jsonb,
    '[{"item": "Cleanliness", "mentions": 4, "avg_sentiment": -0.72}]'::jsonb,
    '[{"category": "Food Quality", "avg_intensity": 3.2, "count": 10}]'::jsonb,
    '[{"category": "Cleanliness", "avg_intensity": 3.8, "count": 6}]'::jsonb,
    '[]'::jsonb,
    '{"google": {"count": 15, "avg_rating": 3.48, "flavor_index": -9.00}, "tripadvisor": {"count": 8, "avg_rating": 3.55, "flavor_index": -6.00}}'::jsonb,
    1, 45.00, 25.00,
    '{"delighted": 20, "satisfied": 18, "neutral": 22, "frustrated": 25, "angry": 15}'::jsonb
  );

END $$;
