-- =============================================================================
-- Phase 3 hardening: Security + defensive JSONB parsing for rollup functions
-- =============================================================================
-- Addresses audit findings:
--   1. REVOKE EXECUTE from PUBLIC/anon/authenticated — only postgres (pg_cron) needs these
--   2. Safe JSONB intensity parsing — NULLIF + regex guard prevents crash on malformed AI output
--   3. Input validation — reject NULL and future dates
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REVOKE EXECUTE — prevent authenticated users from triggering rollups
-- ─────────────────────────────────────────────────────────────────────────────
-- These are system functions called only by pg_cron (as postgres).
-- Without REVOKE, any authenticated user could call them via supabase.rpc(),
-- causing unnecessary computation or overwriting rollup data.

REVOKE EXECUTE ON FUNCTION public.rollup_daily_flavor_index(DATE) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollup_review_intelligence(DATE) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_daily_review_rollups() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Replace rollup_daily_flavor_index with safe JSONB intensity parsing
--    and input validation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rollup_daily_flavor_index(
  p_target_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_upserted INTEGER := 0;
BEGIN
  -- Input validation
  IF p_target_date IS NULL THEN
    RAISE EXCEPTION 'p_target_date must not be NULL';
  END IF;
  IF p_target_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'p_target_date must not be in the future (got %)', p_target_date;
  END IF;

  -- ── Star-count rollup from restaurant_reviews ──────────────────────────
  -- NOTE: Intentionally includes ALL reviews regardless of analysis_status.
  -- Star ratings are factual data — a 5-star review's rating is valid even
  -- before AI extraction runs. Sentiments are only computed from reviews
  -- that have completed AI extraction (via the review_analyses JOIN).

  WITH daily_stars AS (
    SELECT
      rr.group_id,
      rr.restaurant_id,
      COUNT(*)::integer                                          AS total_reviews,
      COUNT(*) FILTER (WHERE rr.rating = 5)::integer             AS five_star,
      COUNT(*) FILTER (WHERE rr.rating = 4)::integer             AS four_star,
      COUNT(*) FILTER (WHERE rr.rating = 3)::integer             AS three_star,
      COUNT(*) FILTER (WHERE rr.rating = 2)::integer             AS two_star,
      COUNT(*) FILTER (WHERE rr.rating = 1)::integer             AS one_star,
      ROUND(AVG(rr.rating), 2)                                   AS avg_rating
    FROM public.restaurant_reviews rr
    WHERE rr.review_date::date = p_target_date
    GROUP BY rr.group_id, rr.restaurant_id
  ),

  -- ── Category sentiments from review_analyses ───────────────────────────
  -- Score formula:
  --   strengths  →  +intensity / 5.0  (range +0.2 to +1.0)
  --   opportunities → -intensity / 5.0  (range -1.0 to -0.2)
  --
  -- NULLIF + regexp_replace guards against non-numeric intensity values
  -- from malformed AI extraction output.

  sentiment_signals AS (
    SELECT
      ra.restaurant_id,
      cat.bucket,
      AVG(raw.score)::numeric(4,3) AS sentiment
    FROM public.review_analyses ra
    INNER JOIN public.restaurant_reviews rr
      ON rr.id = ra.review_id
      AND rr.review_date::date = p_target_date
    CROSS JOIN LATERAL (
      SELECT
        s.elem->>'category' AS category,
        +NULLIF(regexp_replace(s.elem->>'intensity', '[^0-9.]', '', 'g'), '')::numeric / 5.0 AS score
      FROM jsonb_array_elements(ra.strengths) AS s(elem)
      UNION ALL
      SELECT
        o.elem->>'category' AS category,
        -NULLIF(regexp_replace(o.elem->>'intensity', '[^0-9.]', '', 'g'), '')::numeric / 5.0 AS score
      FROM jsonb_array_elements(ra.opportunities) AS o(elem)
    ) raw
    CROSS JOIN LATERAL (
      SELECT CASE raw.category
        WHEN 'Food Quality'             THEN 'food'
        WHEN 'Presentation'             THEN 'food'
        WHEN 'Service Attitude'         THEN 'service'
        WHEN 'Service Speed'            THEN 'service'
        WHEN 'Wait Time'                THEN 'service'
        WHEN 'Reservation Experience'   THEN 'service'
        WHEN 'Management'               THEN 'service'
        WHEN 'Ambience'                 THEN 'ambience'
        WHEN 'Cleanliness'              THEN 'ambience'
        WHEN 'Value'                    THEN 'value'
        ELSE NULL  -- 'Other' intentionally unmapped
      END AS bucket
    ) cat
    WHERE cat.bucket IS NOT NULL
      AND raw.score IS NOT NULL  -- skip entries where intensity was unparseable
    GROUP BY ra.restaurant_id, cat.bucket
  ),

  sentiment_pivot AS (
    SELECT
      restaurant_id,
      MAX(CASE WHEN bucket = 'food'     THEN sentiment END) AS food_sentiment,
      MAX(CASE WHEN bucket = 'service'  THEN sentiment END) AS service_sentiment,
      MAX(CASE WHEN bucket = 'ambience' THEN sentiment END) AS ambience_sentiment,
      MAX(CASE WHEN bucket = 'value'    THEN sentiment END) AS value_sentiment
    FROM sentiment_signals
    GROUP BY restaurant_id
  ),

  upserted AS (
    INSERT INTO public.flavor_index_daily (
      group_id, restaurant_id, date,
      total_reviews, five_star, four_star, three_star, two_star, one_star,
      avg_rating,
      food_sentiment, service_sentiment, ambience_sentiment, value_sentiment
    )
    SELECT
      ds.group_id,
      ds.restaurant_id,
      p_target_date,
      ds.total_reviews, ds.five_star, ds.four_star,
      ds.three_star, ds.two_star, ds.one_star,
      ds.avg_rating,
      sp.food_sentiment,
      sp.service_sentiment,
      sp.ambience_sentiment,
      sp.value_sentiment
    FROM daily_stars ds
    LEFT JOIN sentiment_pivot sp USING (restaurant_id)
    ON CONFLICT (restaurant_id, date) DO UPDATE SET
      group_id           = EXCLUDED.group_id,
      total_reviews      = EXCLUDED.total_reviews,
      five_star          = EXCLUDED.five_star,
      four_star          = EXCLUDED.four_star,
      three_star         = EXCLUDED.three_star,
      two_star           = EXCLUDED.two_star,
      one_star           = EXCLUDED.one_star,
      avg_rating         = EXCLUDED.avg_rating,
      food_sentiment     = EXCLUDED.food_sentiment,
      service_sentiment  = EXCLUDED.service_sentiment,
      ambience_sentiment = EXCLUDED.ambience_sentiment,
      value_sentiment    = EXCLUDED.value_sentiment
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO v_upserted FROM upserted;

  RETURN v_upserted;
END;
$$;

-- Re-apply REVOKE after CREATE OR REPLACE (which resets grants)
REVOKE EXECUTE ON FUNCTION public.rollup_daily_flavor_index(DATE) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Replace rollup_review_intelligence with input validation
--    and safe JSONB intensity parsing in strengths/opportunities aggregation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rollup_review_intelligence(
  p_target_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_upserted   INTEGER := 0;
  v_period     RECORD;
  v_restaurant RECORD;
  v_fi         RECORD;
  v_fi_prev    RECORD;
  v_period_start DATE;
  v_period_end   DATE;
  v_prev_start   DATE;
  v_prev_end     DATE;

  v_food_sent    NUMERIC(4,3);
  v_service_sent NUMERIC(4,3);
  v_ambience_sent NUMERIC(4,3);
  v_value_sent   NUMERIC(4,3);

  v_top_staff          JSONB;
  v_items_all          JSONB;
  v_top_positive_items JSONB;
  v_top_complaints     JSONB;
  v_top_strengths      JSONB;
  v_top_opportunities  JSONB;
  v_platform_breakdown JSONB;
  v_emotion_dist       JSONB;

  v_high_severity   INTEGER;
  v_return_likely   NUMERIC(5,2);
  v_return_unlikely NUMERIC(5,2);
  v_fi_change       NUMERIC(5,2);
BEGIN
  -- Input validation
  IF p_target_date IS NULL THEN
    RAISE EXCEPTION 'p_target_date must not be NULL';
  END IF;
  IF p_target_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'p_target_date must not be in the future (got %)', p_target_date;
  END IF;

  FOR v_period IN
    SELECT unnest(ARRAY['week', 'month', 'quarter']) AS ptype
  LOOP
    v_period_start := date_trunc(v_period.ptype, p_target_date)::date;

    IF v_period.ptype = 'week' THEN
      v_period_end := (date_trunc('week', p_target_date) + INTERVAL '6 days')::date;
      v_prev_start := (v_period_start - INTERVAL '7 days')::date;
      v_prev_end   := (v_period_start - INTERVAL '1 day')::date;
    ELSIF v_period.ptype = 'month' THEN
      v_period_end := (date_trunc('month', p_target_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
      v_prev_start := (date_trunc('month', p_target_date) - INTERVAL '1 month')::date;
      v_prev_end   := (v_period_start - INTERVAL '1 day')::date;
    ELSE -- quarter
      v_period_end := (date_trunc('quarter', p_target_date) + INTERVAL '3 months' - INTERVAL '1 day')::date;
      v_prev_start := (date_trunc('quarter', p_target_date) - INTERVAL '3 months')::date;
      v_prev_end   := (v_period_start - INTERVAL '1 day')::date;
    END IF;

    FOR v_restaurant IN
      SELECT DISTINCT fid.restaurant_id, fid.group_id
      FROM public.flavor_index_daily fid
      WHERE fid.date >= v_period_start
        AND fid.date <= v_period_end
    LOOP

      SELECT INTO v_fi *
      FROM public.compute_flavor_index_range(
        v_restaurant.restaurant_id, v_period_start, v_period_end
      );

      IF v_fi.total_reviews = 0 THEN
        CONTINUE;
      END IF;

      SELECT INTO v_fi_prev *
      FROM public.compute_flavor_index_range(
        v_restaurant.restaurant_id, v_prev_start, v_prev_end
      );

      IF v_fi_prev.total_reviews > 0 THEN
        v_fi_change := v_fi.flavor_index - v_fi_prev.flavor_index;
      ELSE
        v_fi_change := NULL;
      END IF;

      -- Weighted-average sentiments from flavor_index_daily
      SELECT
        CASE WHEN SUM(CASE WHEN fid.food_sentiment IS NOT NULL THEN fid.total_reviews ELSE 0 END) > 0
          THEN ROUND(SUM(fid.food_sentiment * fid.total_reviews)
               / SUM(CASE WHEN fid.food_sentiment IS NOT NULL THEN fid.total_reviews ELSE 0 END), 3)
          ELSE NULL END,
        CASE WHEN SUM(CASE WHEN fid.service_sentiment IS NOT NULL THEN fid.total_reviews ELSE 0 END) > 0
          THEN ROUND(SUM(fid.service_sentiment * fid.total_reviews)
               / SUM(CASE WHEN fid.service_sentiment IS NOT NULL THEN fid.total_reviews ELSE 0 END), 3)
          ELSE NULL END,
        CASE WHEN SUM(CASE WHEN fid.ambience_sentiment IS NOT NULL THEN fid.total_reviews ELSE 0 END) > 0
          THEN ROUND(SUM(fid.ambience_sentiment * fid.total_reviews)
               / SUM(CASE WHEN fid.ambience_sentiment IS NOT NULL THEN fid.total_reviews ELSE 0 END), 3)
          ELSE NULL END,
        CASE WHEN SUM(CASE WHEN fid.value_sentiment IS NOT NULL THEN fid.total_reviews ELSE 0 END) > 0
          THEN ROUND(SUM(fid.value_sentiment * fid.total_reviews)
               / SUM(CASE WHEN fid.value_sentiment IS NOT NULL THEN fid.total_reviews ELSE 0 END), 3)
          ELSE NULL END
      INTO v_food_sent, v_service_sent, v_ambience_sent, v_value_sent
      FROM public.flavor_index_daily fid
      WHERE fid.restaurant_id = v_restaurant.restaurant_id
        AND fid.date >= v_period_start
        AND fid.date <= v_period_end;

      v_top_staff := public.aggregate_staff_mentions(
        v_restaurant.restaurant_id, v_period_start, v_period_end, 10
      );

      v_items_all := public.aggregate_item_mentions(
        v_restaurant.restaurant_id, v_period_start, v_period_end, 20
      );

      SELECT COALESCE(jsonb_agg(elem ORDER BY (elem->>'mentions')::int DESC), '[]'::jsonb)
      INTO v_top_positive_items
      FROM jsonb_array_elements(v_items_all) AS elem
      WHERE (elem->>'positive')::int > (elem->>'negative')::int;

      SELECT COALESCE(jsonb_agg(elem ORDER BY (elem->>'mentions')::int DESC), '[]'::jsonb)
      INTO v_top_complaints
      FROM jsonb_array_elements(v_items_all) AS elem
      WHERE (elem->>'negative')::int > (elem->>'positive')::int;

      -- Strengths aggregation (safe intensity parsing)
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.mentions DESC), '[]'::jsonb)
      INTO v_top_strengths
      FROM (
        SELECT
          s.elem->>'category' AS category,
          COUNT(*) AS mentions,
          ROUND(AVG(NULLIF(regexp_replace(s.elem->>'intensity', '[^0-9.]', '', 'g'), '')::numeric), 1) AS avg_intensity
        FROM public.review_analyses ra,
             jsonb_array_elements(ra.strengths) AS s(elem)
        WHERE ra.restaurant_id = v_restaurant.restaurant_id
          AND ra.review_date::date >= v_period_start
          AND ra.review_date::date <= v_period_end
        GROUP BY s.elem->>'category'
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) t;

      -- Opportunities aggregation (safe intensity parsing)
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.mentions DESC), '[]'::jsonb)
      INTO v_top_opportunities
      FROM (
        SELECT
          o.elem->>'category' AS category,
          COUNT(*) AS mentions,
          ROUND(AVG(NULLIF(regexp_replace(o.elem->>'intensity', '[^0-9.]', '', 'g'), '')::numeric), 1) AS avg_intensity
        FROM public.review_analyses ra,
             jsonb_array_elements(ra.opportunities) AS o(elem)
        WHERE ra.restaurant_id = v_restaurant.restaurant_id
          AND ra.review_date::date >= v_period_start
          AND ra.review_date::date <= v_period_end
        GROUP BY o.elem->>'category'
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) t;

      SELECT COALESCE(
        jsonb_object_agg(
          t.platform,
          jsonb_build_object('count', t.cnt, 'avg_rating', t.avg_rat)
        ), '{}'::jsonb
      )
      INTO v_platform_breakdown
      FROM (
        SELECT
          rr.platform,
          COUNT(*)::integer AS cnt,
          ROUND(AVG(rr.rating), 2) AS avg_rat
        FROM public.restaurant_reviews rr
        WHERE rr.restaurant_id = v_restaurant.restaurant_id
          AND rr.review_date::date >= v_period_start
          AND rr.review_date::date <= v_period_end
        GROUP BY rr.platform
      ) t;

      SELECT COALESCE(
        jsonb_object_agg(t.emotion, t.cnt), '{}'::jsonb
      )
      INTO v_emotion_dist
      FROM (
        SELECT
          ra.emotion,
          COUNT(*)::integer AS cnt
        FROM public.review_analyses ra
        WHERE ra.restaurant_id = v_restaurant.restaurant_id
          AND ra.review_date::date >= v_period_start
          AND ra.review_date::date <= v_period_end
        GROUP BY ra.emotion
      ) t;

      SELECT COUNT(*)::integer
      INTO v_high_severity
      FROM public.review_analyses ra
      WHERE ra.restaurant_id = v_restaurant.restaurant_id
        AND ra.review_date::date >= v_period_start
        AND ra.review_date::date <= v_period_end
        AND ra.high_severity_flag = true;

      SELECT
        CASE WHEN COUNT(*) FILTER (WHERE ra.return_intent IS NOT NULL) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE ra.return_intent = 'likely')::numeric
            / COUNT(*) FILTER (WHERE ra.return_intent IS NOT NULL) * 100
          , 2)
          ELSE NULL END,
        CASE WHEN COUNT(*) FILTER (WHERE ra.return_intent IS NOT NULL) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE ra.return_intent = 'unlikely')::numeric
            / COUNT(*) FILTER (WHERE ra.return_intent IS NOT NULL) * 100
          , 2)
          ELSE NULL END
      INTO v_return_likely, v_return_unlikely
      FROM public.review_analyses ra
      WHERE ra.restaurant_id = v_restaurant.restaurant_id
        AND ra.review_date::date >= v_period_start
        AND ra.review_date::date <= v_period_end;

      INSERT INTO public.review_intelligence (
        group_id, restaurant_id,
        period_type, period_start, period_end,
        total_reviews, avg_rating, flavor_index, flavor_index_change,
        food_sentiment, service_sentiment, ambience_sentiment, value_sentiment,
        top_positive_items, top_complaints,
        top_strengths, top_opportunities, top_staff,
        platform_breakdown,
        high_severity_count,
        return_likely_pct, return_unlikely_pct,
        emotion_distribution
      )
      VALUES (
        v_restaurant.group_id, v_restaurant.restaurant_id,
        v_period.ptype, v_period_start, v_period_end,
        v_fi.total_reviews::integer, v_fi.avg_rating, v_fi.flavor_index, v_fi_change,
        v_food_sent, v_service_sent, v_ambience_sent, v_value_sent,
        v_top_positive_items, v_top_complaints,
        v_top_strengths, v_top_opportunities, v_top_staff,
        v_platform_breakdown,
        v_high_severity,
        v_return_likely, v_return_unlikely,
        v_emotion_dist
      )
      ON CONFLICT (restaurant_id, period_type, period_start) DO UPDATE SET
        period_end           = EXCLUDED.period_end,
        total_reviews        = EXCLUDED.total_reviews,
        avg_rating           = EXCLUDED.avg_rating,
        flavor_index         = EXCLUDED.flavor_index,
        flavor_index_change  = EXCLUDED.flavor_index_change,
        food_sentiment       = EXCLUDED.food_sentiment,
        service_sentiment    = EXCLUDED.service_sentiment,
        ambience_sentiment   = EXCLUDED.ambience_sentiment,
        value_sentiment      = EXCLUDED.value_sentiment,
        top_positive_items   = EXCLUDED.top_positive_items,
        top_complaints       = EXCLUDED.top_complaints,
        top_strengths        = EXCLUDED.top_strengths,
        top_opportunities    = EXCLUDED.top_opportunities,
        top_staff            = EXCLUDED.top_staff,
        platform_breakdown   = EXCLUDED.platform_breakdown,
        high_severity_count  = EXCLUDED.high_severity_count,
        return_likely_pct    = EXCLUDED.return_likely_pct,
        return_unlikely_pct  = EXCLUDED.return_unlikely_pct,
        emotion_distribution = EXCLUDED.emotion_distribution;

      v_upserted := v_upserted + 1;

    END LOOP; -- restaurants
  END LOOP; -- period types

  RETURN v_upserted;
END;
$$;

-- Re-apply REVOKE after CREATE OR REPLACE
REVOKE EXECUTE ON FUNCTION public.rollup_review_intelligence(DATE) FROM PUBLIC, anon, authenticated;
