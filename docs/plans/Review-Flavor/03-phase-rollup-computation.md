# Phase 3 — Flavor Index Computation & Rollups

## Context

Phase 1 (DB Foundation) created `flavor_index_daily` and `review_intelligence` tables with GENERATED ALWAYS columns and helper functions. Phase 2 (Apify Ingestion) delivered working scrapers that ingest live reviews into `restaurant_reviews` (40+ rows across 3 platforms). **Phase 3 fills the gap: no mechanism currently populates `flavor_index_daily` or `review_intelligence` from the raw reviews.** Without rollups, the Phase 4a dashboard has no data to display.

**Design deviation from feature overview:** The overview specified an edge function (`compute-rollups`). After expert analysis, we're using **pure PG functions + pg_cron** instead. Rationale:
- Pure SQL aggregation — no external API calls, no AI, no network hops
- Zero cold-start latency, full transaction support
- pg_cron pattern already established (`cleanup_stale_ingestion_sessions` at 3 AM UTC)
- Edge functions reserved for tasks requiring external services (OpenAI, Apify)

---

## Migration 1: Rollup PG Functions

**File:** `supabase/migrations/YYYYMMDDHHMMSS_create_rollup_functions.sql`

### Function 1: `rollup_daily_flavor_index(p_target_date DATE)`

Aggregates `restaurant_reviews` star counts into `flavor_index_daily` via idempotent upsert.

**Logic:**
```sql
INSERT INTO flavor_index_daily (group_id, restaurant_id, date,
  total_reviews, five_star, four_star, three_star, two_star, one_star, avg_rating,
  food_sentiment, service_sentiment, ambience_sentiment, value_sentiment)
SELECT
  rr.group_id, rr.restaurant_id, p_target_date,
  COUNT(*),
  COUNT(*) FILTER (WHERE rr.rating = 5),
  COUNT(*) FILTER (WHERE rr.rating = 4),
  COUNT(*) FILTER (WHERE rr.rating = 3),
  COUNT(*) FILTER (WHERE rr.rating = 2),
  COUNT(*) FILTER (WHERE rr.rating = 1),
  ROUND(AVG(rr.rating), 2),
  -- Category sentiments from review_analyses (LEFT JOIN, NULL if no analyses)
  <sentiment_cte>,
  <sentiment_cte>,
  <sentiment_cte>,
  <sentiment_cte>
FROM restaurant_reviews rr
WHERE rr.review_date::date = p_target_date
GROUP BY rr.group_id, rr.restaurant_id
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
```

**Sentiment computation** (CTE within the function):
- LEFT JOIN `review_analyses` on `review_id`
- Unnest `strengths` JSONB → positive scores (+intensity/5)
- Unnest `opportunities` JSONB → negative scores (-intensity/5)
- Category mapping:
  - `Food Quality` → `food_sentiment`
  - `Service Attitude`, `Service Speed` → `service_sentiment`
  - `Ambience`, `Cleanliness` → `ambience_sentiment`
  - `Value` → `value_sentiment`
- Average per category per restaurant/day, clamped to [-1.0, +1.0]
- Returns NULL for categories with zero mentions (frontend shows "Coming soon")

**Properties:**
- `SECURITY DEFINER` — bypasses RLS to read all reviews
- `SET search_path = public`
- Default: `p_target_date = CURRENT_DATE - 1` (yesterday)
- Returns: count of rows upserted

### Function 2: `rollup_review_intelligence(p_target_date DATE)`

Recomputes `review_intelligence` period summaries (week/month/quarter) that contain `p_target_date`.

**Logic for each period type:**
1. Compute period boundaries:
   - Week: `date_trunc('week', p_target_date)` to `+ 6 days`
   - Month: `date_trunc('month', p_target_date)` to `date_trunc('month', p_target_date) + '1 month'::interval - '1 day'::interval`
   - Quarter: `date_trunc('quarter', p_target_date)` to `+ 3 months - 1 day`
2. Aggregate from `flavor_index_daily` (star counts, flavor_index, avg_rating)
3. Compute `flavor_index_change` by comparing to the previous period of the same type
4. Aggregate from `review_analyses` (only if analyses exist):
   - `top_positive_items` — reuse `aggregate_item_mentions()` filtered to positive
   - `top_complaints` — reuse `aggregate_item_mentions()` filtered to negative
   - `top_strengths` / `top_opportunities` — aggregate `strengths` and `opportunities` JSONB by category
   - `top_staff` — reuse `aggregate_staff_mentions()`
   - `platform_breakdown` — `{ "google": { count, avg_rating }, "opentable": {...}, "tripadvisor": {...} }`
   - `emotion_distribution` — `{ "delighted": 12, "satisfied": 8, "frustrated": 3, ... }`
   - `high_severity_count` — `COUNT(*) WHERE high_severity_flag = true`
   - `return_likely_pct` / `return_unlikely_pct` — from `return_intent` column
5. `INSERT ... ON CONFLICT (restaurant_id, period_type, period_start) DO UPDATE`

**Reuses existing helpers:**
- `aggregate_staff_mentions(p_restaurant_id, p_start, p_end, p_limit)` → `top_staff` *(M07)*
- `aggregate_item_mentions(p_restaurant_id, p_start, p_end, p_limit)` → `top_positive_items` / `top_complaints` *(M07)*
- `compute_flavor_index_range(p_restaurant_id, p_start, p_end)` → period flavor_index *(M07)*
- `get_competitor_ids(p_unit_id)` → not needed in rollup (used by dashboard) *(M07)*

### Function 3: `run_daily_review_rollups()`

Wrapper called by pg_cron. Returns summary for logging.

```sql
CREATE OR REPLACE FUNCTION public.run_daily_review_rollups()
RETURNS TABLE(daily_rows INT, intelligence_rows INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_daily INT; v_intel INT;
BEGIN
  SELECT rollup_daily_flavor_index(CURRENT_DATE - 1) INTO v_daily;
  SELECT rollup_review_intelligence(CURRENT_DATE - 1) INTO v_intel;
  daily_rows := v_daily; intelligence_rows := v_intel;
  RETURN NEXT;
END;
$$;
```

---

## Migration 2: pg_cron Schedule

**File:** `supabase/migrations/YYYYMMDDHHMMSS_schedule_review_rollups.sql`

Follows established pattern from `20260223130000_session_cleanup_cron.sql`:

```sql
DO $$
BEGIN
  PERFORM cron.unschedule('daily-review-rollups');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'daily-review-rollups',
  '0 4 * * *',   -- 4 AM UTC daily (after ingestion + session cleanup at 3 AM)
  'SELECT * FROM public.run_daily_review_rollups()'
);
```

**Why 4 AM UTC:** 1 hour after session cleanup (3 AM). Ingestion webhooks fire shortly after Apify runs complete. 4 AM gives ample buffer for any stragglers.

---

## Critical Files

| File | Role |
|------|------|
| `supabase/migrations/20260224180400_create_flavor_index_daily.sql` | Target table — UNIQUE(restaurant_id, date), GENERATED flavor_index |
| `supabase/migrations/20260224180300_create_review_analyses.sql` | Source for sentiments — strengths/opportunities JSONB, emotion, return_intent |
| `supabase/migrations/20260224180200_create_restaurant_reviews.sql` | Source for star counts — rating, review_date, platform |
| `supabase/migrations/20260224180600_create_review_helper_functions.sql` | Reusable: aggregate_staff_mentions, aggregate_item_mentions, compute_flavor_index_range |
| `supabase/migrations/20260223130000_session_cleanup_cron.sql` | Pattern reference for pg_cron scheduling |

---

## Known Limitations & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Timezone:** `review_date::date` casts in UTC, not restaurant local time | A review at 11 PM EST Monday → counted as Tuesday | Acceptable for MVP. All rollups consistently use UTC. Can add `timezone` column to `tracked_restaurants` later and re-run backfill. |
| **Race condition:** Review ingested after rollup runs for that date | Late review missed until next day's rollup | Rollups are idempotent — re-running catches missed reviews. Can add manual trigger from admin dashboard later. |
| **Missing analyses:** `review_analyses` may not exist for recent reviews (Phase 4b) | Sentiment columns will be NULL | Graceful degradation — star counts and flavor_index always work. Sentiment populated after AI extraction phase. |
| **Seed data overlap:** Synthetic reviews from M08 have dates that may conflict with rollup | Rollup could mix synthetic + real data | Not a problem — rollup is idempotent upsert. Once real data exists, re-running for those dates overwrites synthetic rollups. |

---

## Implementation Steps

1. **Create M01** — Rollup functions migration with all 3 functions
2. **Create M02** — pg_cron schedule migration
3. **Push migrations** — `npx supabase db push`
4. **Manual backfill** — Run `SELECT rollup_daily_flavor_index('2026-02-25'::date)` for dates with existing reviews
5. **Verify** — Check `flavor_index_daily` and `review_intelligence` tables

---

## Verification

1. **After push:** Run `SELECT rollup_daily_flavor_index(CURRENT_DATE)` manually — should populate `flavor_index_daily` rows for all restaurants with reviews on that date
2. **Check flavor_index values:** With 10 five-star TripAdvisor reviews on one date, flavor_index should be +100.00
3. **Check review_intelligence:** Run `SELECT rollup_review_intelligence(CURRENT_DATE)` — should create week/month/quarter rows
4. **Check sentiment columns:** Should be NULL (no review_analyses populated yet — that's Phase 4b)
5. **Idempotency:** Run same rollup twice — row count unchanged, values identical
6. **Empty date:** Run rollup for a date with no reviews — should produce no rows (not error)
7. **pg_cron:** Check `SELECT * FROM cron.job WHERE jobname = 'daily-review-rollups'` exists
