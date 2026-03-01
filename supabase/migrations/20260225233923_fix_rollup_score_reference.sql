-- Fix: rollup_daily_flavor_index referenced cat.score instead of raw.score
-- Also adds: expanded category mapping (Wait Time, Presentation, etc.),
-- group_id in ON CONFLICT UPDATE, analysis_status documentation comment.

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
  -- ── Star-count rollup from restaurant_reviews ──────────────────────────
  -- For every restaurant with reviews on the target date, upsert a
  -- flavor_index_daily row with star distribution and avg_rating.
  -- Category sentiments are layered on top via LEFT JOIN to review_analyses.
  --
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
        +(s.elem->>'intensity')::numeric / 5.0 AS score
      FROM jsonb_array_elements(ra.strengths) AS s(elem)
      UNION ALL
      SELECT
        o.elem->>'category' AS category,
        -(o.elem->>'intensity')::numeric / 5.0 AS score
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
