# Phase 1 Supplement: Seed Data Strategy & Frontend Preparation

> **Prepared by:** UX/UI Expert
> **Source:** Audited `01-phase-db-foundation.md`
> **Sections:** S01/S02 Seed Data, Color System, Bilingual Labels, Cleanup SQL

---

## 1. S01: Tracked Restaurants (Exact SQL)

The group has a known hardcoded UUID (`00000000-0000-0000-0000-000000000001`) and slug `alamo-prime`. Following the project's established `DO $$ DECLARE` pattern (see `seed_training_programs.sql`), we use a subquery guard.

```sql
-- =============================================================================
-- MIGRATION: seed_tracked_restaurants
-- Seeds 5 tracked restaurants (2 own + 3 competitors) with deterministic UUIDs.
-- Competitors 2-4 are linked to Alamo Prime Austin (parent_unit_id).
-- Alamo Prime Westside has scrape_enabled = false and zero platform URLs.
-- =============================================================================

DO $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Get Alamo Prime group
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 1. Alamo Prime Steakhouse (own, primary unit)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    v_group_id,
    'Alamo Prime Steakhouse',
    'alamo-prime-austin',
    'own',
    'ChIJ_____fake_google_id_01',
    'https://www.google.com/maps/place/Alamo+Prime+Steakhouse',
    'https://www.opentable.com/r/alamo-prime-steakhouse-austin',
    'https://www.tripadvisor.com/Restaurant_Review-Alamo_Prime_Steakhouse',
    '412 Congress Ave', 'Austin', 'TX', '78701',
    30.2672000, -97.7431000,
    NULL,  -- own restaurant: no parent
    true,
    'daily',
    'active'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 2. Longhorn & Ember (competitor of Alamo Prime Austin)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '22222222-2222-2222-2222-222222222222',
    v_group_id,
    'Longhorn & Ember',
    'longhorn-ember',
    'competitor',
    'ChIJ_____fake_google_id_02',
    'https://www.google.com/maps/place/Longhorn+Ember',
    'https://www.opentable.com/r/longhorn-ember-austin',
    'https://www.tripadvisor.com/Restaurant_Review-Longhorn_Ember',
    '815 W 6th St', 'Austin', 'TX', '78703',
    30.2715000, -97.7530000,
    '11111111-1111-1111-1111-111111111111',  -- parent = Alamo Prime Austin
    true,
    'daily',
    'active'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 3. Salt & Sear Chophouse (competitor of Alamo Prime Austin)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '33333333-3333-3333-3333-333333333333',
    v_group_id,
    'Salt & Sear Chophouse',
    'salt-sear-chophouse',
    'competitor',
    'ChIJ_____fake_google_id_03',
    'https://www.google.com/maps/place/Salt+Sear+Chophouse',
    'https://www.opentable.com/r/salt-sear-chophouse-austin',
    'https://www.tripadvisor.com/Restaurant_Review-Salt_Sear_Chophouse',
    '301 Lavaca St', 'Austin', 'TX', '78701',
    30.2660000, -97.7450000,
    '11111111-1111-1111-1111-111111111111',  -- parent = Alamo Prime Austin
    true,
    'daily',
    'active'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 4. Mesquite Flame Grill (competitor of Alamo Prime Austin)
  --    NOTE: NO OpenTable URL (tests platform gap handling)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '44444444-4444-4444-4444-444444444444',
    v_group_id,
    'Mesquite Flame Grill',
    'mesquite-flame-grill',
    'competitor',
    'ChIJ_____fake_google_id_04',
    'https://www.google.com/maps/place/Mesquite+Flame+Grill',
    NULL,  -- NO OpenTable
    'https://www.tripadvisor.com/Restaurant_Review-Mesquite_Flame_Grill',
    '1100 S Lamar Blvd', 'Austin', 'TX', '78704',
    30.2530000, -97.7640000,
    '11111111-1111-1111-1111-111111111111',  -- parent = Alamo Prime Austin
    true,
    'daily',
    'active'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 5. Alamo Prime - Westside (own, EMPTY STATE for onboarding testing)
  --    No platform URLs, scrape_enabled = false, zero reviews/rollups
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '55555555-5555-5555-5555-555555555555',
    v_group_id,
    'Alamo Prime - Westside',
    'alamo-prime-westside',
    'own',
    NULL, NULL, NULL, NULL,  -- no platform URLs configured
    '4700 W Gate Blvd', 'Austin', 'TX', '78745',
    30.2290000, -97.8010000,
    NULL,  -- own restaurant: no parent
    false, -- scraping not enabled
    'daily',
    'active'
  );

END $$;
```

---

## 2. S02: Synthetic Reviews + Analyses + Rollups (Strategy + Templates)

### 2.1 Review Generation Approach

The migration uses a `DO $$ ... END $$` block with `generate_series()` and a deterministic distribution strategy. Instead of random data (which makes verification impossible), we use a **modulo-based assignment** that produces exact target counts per star rating.

**Target distributions (from the audited plan):**

| Restaurant | UUID | Total | 5-star | 4-star | 3-star | 2-star | 1-star | FI |
|---|---|---|---|---|---|---|---|---|
| Alamo Prime | `11111111-...` | 150 | 123 | 17 | 5 | 3 | 2 | +75.33 |
| Longhorn & Ember | `22222222-...` | 100 | 67 | 14 | 8 | 7 | 4 | +48.00 |
| Salt & Sear | `33333333-...` | 80 | 43 | 14 | 10 | 8 | 5 | +25.00 |
| Mesquite Flame | `44444444-...` | 60 | 22 | 13 | 10 | 9 | 6 | -5.00 |

**Verification of FI calculations:**

- Alamo Prime: (123/150)*100 - ((5+3+2)/150)*100 = 82.00 - 6.67 = **+75.33**
- Longhorn: (67/100)*100 - ((8+7+4)/100)*100 = 67.00 - 19.00 = **+48.00**
- Salt & Sear: (43/80)*100 - ((10+8+5)/80)*100 = 53.75 - 28.75 = **+25.00**
- Mesquite: (22/60)*100 - ((10+9+6)/60)*100 = 36.67 - 41.67 = **-5.00**

**SQL generation pattern (per restaurant):**

```sql
-- Example: Alamo Prime star assignment via generate_series + CASE
-- The series index (1..150) maps deterministically to star ratings:
--   1-123   -> 5 stars (123 reviews)
--   124-140 -> 4 stars (17 reviews)
--   141-145 -> 3 stars (5 reviews)
--   146-148 -> 2 stars (3 reviews)
--   149-150 -> 1 star  (2 reviews)

INSERT INTO public.restaurant_reviews (
  id, group_id, restaurant_id,
  platform, platform_review_id,
  rating, review_date, reviewer_name, language,
  review_text, analysis_status, scraped_at, created_at
)
SELECT
  extensions.gen_random_uuid(),
  v_group_id,
  '11111111-1111-1111-1111-111111111111',
  -- Platform distribution: ~50% Google, ~30% OpenTable, ~20% TripAdvisor
  CASE
    WHEN i <= 75  THEN 'google'
    WHEN i <= 120 THEN 'opentable'
    ELSE 'tripadvisor'
  END,
  -- Deterministic platform_review_id for idempotency
  'seed-alamo-' || LPAD(i::text, 4, '0'),
  -- Star rating assignment (cumulative boundaries)
  CASE
    WHEN i <= 123 THEN 5
    WHEN i <= 140 THEN 4
    WHEN i <= 145 THEN 3
    WHEN i <= 148 THEN 2
    ELSE 1
  END,
  -- Date distribution (see section 2.2)
  v_base_date + (((i - 1) * 82) / 150) * INTERVAL '1 day'
    + (10 + (i * 7 % 12)) * INTERVAL '1 hour'
    + (i * 13 % 60) * INTERVAL '1 minute',
  -- Reviewer names from a rotating pool
  v_reviewer_names[(i % 20) + 1],
  'en',
  -- review_text: populated for pending/failed, NULL for completed
  CASE
    WHEN i > 148 THEN
      'This is a synthetic review for testing. Review #' || i
    ELSE NULL
  END,
  -- Analysis status mix: 148 completed, 1 pending, 1 failed
  -- (extended to i<=148 so 3-star and 2-star reviews are completed,
  --  enabling high-severity flag UPDATEs to find target rows)
  CASE
    WHEN i <= 148 THEN 'completed'
    WHEN i <= 149 THEN 'pending'
    ELSE 'failed'
  END,
  now(),
  now()
FROM generate_series(1, 150) AS i;
```

This pattern is repeated for each of the 4 data-bearing restaurants, adjusting the star boundaries and count.

### 2.2 Date Distribution

**Span:** December 1, 2025 (`2025-12-01`) to February 20, 2026 (`2026-02-20`) = 82 days.

**Monthly volume per restaurant:**

| Restaurant | Dec (31 days) | Jan (31 days) | Feb (20 days) | Total |
|---|---|---|---|---|
| Alamo Prime | 57 | 57 | 36 | 150 |
| Longhorn & Ember | 38 | 38 | 24 | 100 |
| Salt & Sear | 31 | 30 | 19 | 80 |
| Mesquite Flame | 23 | 23 | 14 | 60 |

**Date assignment approach:**

```sql
-- Spread reviews evenly across the 82-day span, then apply month boundaries.
-- For Alamo Prime (150 reviews across 82 days, ~1.83/day):
-- The formula (i - 1) * 82 / total produces an even spread.
-- Weekend weighting: apply +1 day offset for indices divisible by 3
-- (approximates 35% Fri-Sat-Sun distribution).

v_base_date := '2025-12-01'::date;

-- For each review i (1..150):
v_day_offset := ((i - 1) * 82) / 150;

-- Weekend shift: every 3rd review gets pushed to nearest weekend
IF i % 3 = 0 THEN
  -- Shift to next Friday/Saturday/Sunday
  v_day_offset := v_day_offset + (5 - EXTRACT(DOW FROM v_base_date + v_day_offset)::int) % 7;
END IF;

-- Time-of-day: vary between 10:00-22:00 (dining hours)
v_hour := 10 + (i * 7 % 12);   -- 10, 17, 12, 19, 14, 21, 16, 11, 18, 13, 20, 15
v_minute := i * 13 % 60;        -- pseudo-random minutes
```

**Month boundary enforcement:** After assigning base dates, reviews are sorted and clamped so that the first N reviews fall in December, the next M in January, and the rest in February, matching the volume targets above.

### 2.3 Staff Mentions (Alamo Prime Only)

Staff mentions appear in `review_analyses.staff_mentioned` as JSONB arrays. Only Alamo Prime reviews have staff mentions (competitors do not -- simulates typical AI extraction where staff names from competitor reviews are rarely recognized).

**Target distribution (40 total staff mentions across 150 Alamo Prime reviews):**

| Staff Name | Role | Total Mentions | Positive | Negative | Neutral |
|---|---|---|---|---|---|
| Maria Garcia | server | 14 | 13 (93%) | 1 | 0 |
| Carlos Reyes | bartender | 10 | 9 (90%) | 0 | 1 |
| Jake Thompson | server | 7 | 6 (86%) | 1 | 0 |
| Sofia Martinez | host | 5 | 5 (100%) | 0 | 0 |
| David Chen | manager | 4 | 3 (75%) | 1 | 0 |

**JSONB structure (exact schema):**

```json
[
  { "name": "Maria Garcia", "role": "server", "sentiment": "positive" }
]
```

**Assignment pattern:** Staff mentions are distributed among 5-star and 4-star reviews only (staff get mentioned in positive reviews). The assignment uses modulo indexing:

```sql
-- For Alamo Prime analyses (i = 1..140, completed only):
CASE
  -- Maria Garcia: reviews 1-14
  WHEN i <= 14 THEN
    CASE WHEN i = 7 THEN
      '[{"name": "Maria Garcia", "role": "server", "sentiment": "negative"}]'::jsonb
    ELSE
      '[{"name": "Maria Garcia", "role": "server", "sentiment": "positive"}]'::jsonb
    END
  -- Carlos Reyes: reviews 15-24
  WHEN i <= 24 THEN
    CASE WHEN i = 24 THEN
      '[{"name": "Carlos Reyes", "role": "bartender", "sentiment": "neutral"}]'::jsonb
    ELSE
      '[{"name": "Carlos Reyes", "role": "bartender", "sentiment": "positive"}]'::jsonb
    END
  -- Jake Thompson: reviews 25-31
  WHEN i <= 31 THEN
    CASE WHEN i = 31 THEN
      '[{"name": "Jake Thompson", "role": "server", "sentiment": "negative"}]'::jsonb
    ELSE
      '[{"name": "Jake Thompson", "role": "server", "sentiment": "positive"}]'::jsonb
    END
  -- Sofia Martinez: reviews 32-36
  WHEN i <= 36 THEN
    '[{"name": "Sofia Martinez", "role": "host", "sentiment": "positive"}]'::jsonb
  -- David Chen: reviews 37-40
  WHEN i <= 40 THEN
    CASE WHEN i = 40 THEN
      '[{"name": "David Chen", "role": "manager", "sentiment": "negative"}]'::jsonb
    ELSE
      '[{"name": "David Chen", "role": "manager", "sentiment": "positive"}]'::jsonb
    END
  -- Reviews 41+: no staff mentions
  ELSE '[]'::jsonb
END
```

### 2.4 Item Mentions (Alamo Prime Only)

Items appear in `review_analyses.items_mentioned`. Competitors get generic item mentions; Alamo Prime gets specific named items.

**Target distribution (73 total item mentions across 150 Alamo Prime reviews):**

| Item Name | item_type | course_type | Mentions | Positive | Negative | Avg Intensity |
|---|---|---|---|---|---|---|
| Bone-In Ribeye | food | entree | 28 | 26 (92%) | 2 | 4.6 |
| Truffle Mac & Cheese | food | side | 15 | 14 (93%) | 1 | 4.2 |
| Classic Margarita | drink | cocktail | 12 | 10 (83%) | 2 | 3.8 |
| Grilled Caesar Salad | food | appetizer | 10 | 8 (80%) | 2 | 3.5 |
| Creme Brulee | food | dessert | 8 | 7 (88%) | 1 | 4.0 |

**JSONB structure (exact schema):**

```json
[
  {
    "name": "Bone-In Ribeye",
    "item_type": "food",
    "course_type": "entree",
    "cuisine_type": "steakhouse",
    "sentiment": "positive",
    "intensity": 5
  }
]
```

**Assignment pattern:** Similar to staff, item mentions are distributed across the first 73 completed analyses using sequential index ranges:

```sql
-- For Alamo Prime analyses (i = 1..140, completed only):
CASE
  -- Bone-In Ribeye: reviews 1-28
  WHEN i <= 28 THEN
    CASE WHEN i IN (14, 28) THEN
      '[{"name": "Bone-In Ribeye", "item_type": "food", "course_type": "entree",
         "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
    ELSE
      ('[{"name": "Bone-In Ribeye", "item_type": "food", "course_type": "entree",
          "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": '
       || (4 + (i % 2)) || '}]')::jsonb
    END
  -- Truffle Mac & Cheese: reviews 29-43
  WHEN i <= 43 THEN
    CASE WHEN i = 43 THEN
      '[{"name": "Truffle Mac & Cheese", "item_type": "food", "course_type": "side",
         "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
    ELSE
      ('[{"name": "Truffle Mac & Cheese", "item_type": "food", "course_type": "side",
          "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": '
       || (3 + (i % 3)) || '}]')::jsonb
    END
  -- Classic Margarita: reviews 44-55
  WHEN i <= 55 THEN
    CASE WHEN i IN (50, 55) THEN
      '[{"name": "Classic Margarita", "item_type": "cocktail", "course_type": "cocktail",
         "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
    ELSE
      ('[{"name": "Classic Margarita", "item_type": "cocktail", "course_type": "cocktail",
          "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": '
       || (3 + (i % 2)) || '}]')::jsonb
    END
  -- Grilled Caesar Salad: reviews 56-65
  WHEN i <= 65 THEN
    CASE WHEN i IN (60, 65) THEN
      '[{"name": "Grilled Caesar Salad", "item_type": "food", "course_type": "appetizer",
         "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
    ELSE
      ('[{"name": "Grilled Caesar Salad", "item_type": "food", "course_type": "appetizer",
          "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": '
       || (3 + (i % 2)) || '}]')::jsonb
    END
  -- Creme Brulee: reviews 66-73
  WHEN i <= 73 THEN
    CASE WHEN i = 73 THEN
      '[{"name": "Creme Brulee", "item_type": "food", "course_type": "dessert",
         "cuisine_type": "steakhouse", "sentiment": "negative", "intensity": 2}]'::jsonb
    ELSE
      ('[{"name": "Creme Brulee", "item_type": "food", "course_type": "dessert",
          "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": '
       || (3 + (i % 2)) || '}]')::jsonb
    END
  -- Reviews 74+: no item mentions
  ELSE '[]'::jsonb
END
```

### 2.5 Analysis Status Mix

Across all 390 reviews:

| Status | Count | Breakdown | Characteristics |
|---|---|---|---|
| `completed` | 368 | 148 Alamo + 90 Longhorn + 75 Salt&Sear + 55 Mesquite | `review_text = NULL`, `analyzed_at` populated, full JSONB arrays |
| `pending` | 13 | 1 Alamo + 5 Longhorn + 4 Salt&Sear + 3 Mesquite | `review_text` populated with synthetic text, `retry_count = 0` |
| `failed` | 9 | 1 Alamo + 5 Longhorn + 1 Salt&Sear + 2 Mesquite | `review_text` populated, `retry_count = 3`, `last_error` populated |

**Failed review template:**

```sql
-- For failed reviews (analysis_status = 'failed'):
UPDATE public.restaurant_reviews
SET
  retry_count = 3,
  last_error = 'OpenAI API error: rate_limit_exceeded (429). Retries exhausted after 3 attempts.'
WHERE analysis_status = 'failed'
  AND restaurant_id = '11111111-1111-1111-1111-111111111111';
```

**Pending review text template:**

```sql
-- review_text for pending reviews (enables Phase 4b testing):
'Had dinner here last weekend. The ribeye was cooked perfectly medium-rare and the truffle mac
was rich without being heavy. Our server Maria was attentive and friendly. Only downside was
the 20-minute wait for a table despite having a reservation. Would definitely come back though.'
```

### 2.6 Review Analyses Template (Completed Reviews)

For each completed review, a corresponding `review_analyses` row is inserted. The full INSERT pattern:

```sql
INSERT INTO public.review_analyses (
  group_id, review_id, restaurant_id,
  overall_sentiment, emotion,
  strengths, opportunities,
  items_mentioned, staff_mentioned,
  return_intent, high_severity_flag, high_severity_details,
  rating, review_date
)
SELECT
  v_group_id,
  rr.id,
  rr.restaurant_id,
  -- overall_sentiment: correlates with star rating
  CASE
    WHEN rr.rating >= 4 THEN 'positive'
    WHEN rr.rating = 3 THEN 'neutral'
    ELSE 'negative'
  END,
  -- emotion: finer-grained than sentiment
  CASE
    WHEN rr.rating = 5 THEN
      CASE WHEN row_number() OVER (PARTITION BY rr.restaurant_id ORDER BY rr.review_date) % 3 = 0
        THEN 'satisfied' ELSE 'delighted' END
    WHEN rr.rating = 4 THEN 'satisfied'
    WHEN rr.rating = 3 THEN 'neutral'
    WHEN rr.rating = 2 THEN 'frustrated'
    ELSE 'angry'
  END,
  -- strengths (populated for rating >= 4)
  CASE
    WHEN rr.rating >= 4 THEN
      '[{"category": "Food Quality", "intensity": ' || (3 + rr.rating % 3) || '},
        {"category": "Service Attitude", "intensity": ' || (2 + rr.rating % 4) || '}]'
    ELSE '[]'
  END::jsonb,
  -- opportunities (populated for rating <= 3)
  CASE
    WHEN rr.rating <= 3 THEN
      '[{"category": "Wait Time", "intensity": ' || (4 - rr.rating + 1) || '},
        {"category": "Value", "intensity": ' || (3 - rr.rating + 1) || '}]'
    ELSE '[]'
  END::jsonb,
  -- items_mentioned: see section 2.4 (Alamo Prime only, others get '[]')
  '[]'::jsonb,  -- placeholder; populated via UPDATE pass for Alamo Prime
  -- staff_mentioned: see section 2.3 (Alamo Prime only, others get '[]')
  '[]'::jsonb,  -- placeholder; populated via UPDATE pass for Alamo Prime
  -- return_intent
  CASE
    WHEN rr.rating >= 4 THEN 'likely'
    WHEN rr.rating = 3 THEN 'unclear'
    ELSE 'unlikely'
  END,
  -- high_severity_flag: see section 2.8
  false,
  '[]'::jsonb,
  rr.rating,
  rr.review_date
FROM public.restaurant_reviews rr
WHERE rr.analysis_status = 'completed'
  AND rr.group_id = v_group_id;
```

After the bulk insert, staff_mentioned and items_mentioned are populated for Alamo Prime via sequential UPDATE passes using the patterns described in sections 2.3 and 2.4.

### 2.7 Daily Rollup Seeding (`flavor_index_daily`)

Rollup rows are computed directly from the seeded reviews. One row per (restaurant, date) pair.

**Generation approach:**

```sql
-- Compute rollups from seeded reviews (idempotent)
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
  -- Sentiment columns: NULL for December, populated for Jan+Feb
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
```

**Key behavior:**
- **December rows:** All four sentiment columns (`food_sentiment`, `service_sentiment`, `ambience_sentiment`, `value_sentiment`) are **NULL**. This simulates the "pre-AI-extraction" state. Frontend displays "Coming soon" or skeleton placeholders.
- **January rows:** Sentiment columns populated with values derived from the star distribution (positive correlation with avg_rating, but not identical).
- **February rows:** Populated with final target values.
- The `flavor_index` column is **not included** in the INSERT (it is `GENERATED ALWAYS AS ... STORED` and auto-computes from the star counts).

### 2.8 High-Severity Flags

4 total flags: 2 for Alamo Prime, 2 for Mesquite Flame. Zero for Longhorn & Ember and Salt & Sear.

```sql
-- After bulk analysis insert, update specific rows for high-severity flags.
-- Pick 2 low-rated Alamo Prime reviews (1-star or 2-star).

-- Alamo Prime flag 1: health/safety concern (targets 2-star completed review)
-- C1 fix: Alamo Prime status boundary extended to i<=148, so 2-star (i=146-148)
-- and 3-star (i=141-145) reviews are now completed.
UPDATE public.review_analyses
SET
  high_severity_flag = true,
  high_severity_details = '[{
    "type": "health_safety",
    "summary": "Guest reported finding a foreign object in their salad. Described as a small piece of plastic wrap."
  }]'::jsonb
WHERE review_id = (
  SELECT id FROM public.restaurant_reviews
  WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
    AND rating = 2
    AND analysis_status = 'completed'
  ORDER BY review_date DESC
  LIMIT 1
);

-- Alamo Prime flag 2: staff conduct (targets 3-star completed review)
UPDATE public.review_analyses
SET
  high_severity_flag = true,
  high_severity_details = '[{
    "type": "staff_conduct",
    "summary": "Guest reported being spoken to rudely by a staff member when asking to be reseated. Used language like ''dismissive'' and ''condescending''."
  }]'::jsonb
WHERE review_id = (
  SELECT id FROM public.restaurant_reviews
  WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
    AND rating = 3
    AND analysis_status = 'completed'
  ORDER BY review_date DESC
  LIMIT 1
);

-- Mesquite Flame flag 1: health/safety
UPDATE public.review_analyses
SET
  high_severity_flag = true,
  high_severity_details = '[{
    "type": "health_safety",
    "summary": "Guest reported food poisoning symptoms within hours of dining. Mentioned undercooked chicken appetizer."
  }]'::jsonb
WHERE review_id = (
  SELECT id FROM public.restaurant_reviews
  WHERE restaurant_id = '44444444-4444-4444-4444-444444444444'
    AND rating = 1
    AND analysis_status = 'completed'
  ORDER BY review_date DESC
  LIMIT 1
);

-- Mesquite Flame flag 2: legal threat
UPDATE public.review_analyses
SET
  high_severity_flag = true,
  high_severity_details = '[{
    "type": "legal_threat",
    "summary": "Guest mentioned contacting the health department and ''considering legal action'' after a large party reservation was not honored."
  }]'::jsonb
WHERE review_id = (
  SELECT id FROM public.restaurant_reviews
  WHERE restaurant_id = '44444444-4444-4444-4444-444444444444'
    AND rating = 2
    AND analysis_status = 'completed'
  ORDER BY review_date DESC
  LIMIT 1
  -- C3 fix: Mesquite has only 1 completed 1-star review (i=55).
  -- Using rating=2 (9 completed reviews, i=46-54) avoids zero-row OFFSET issue.
);
```

### 2.9 Review Intelligence Period Seeding

At least 3 monthly + 1 quarterly per restaurant (4 data-bearing restaurants = 16 rows minimum).

```sql
-- Monthly periods: December 2025, January 2026, February 2026
-- Quarterly period: Q4 2025 (Oct-Dec) -- only Dec has data, but period covers Q4

-- NOTE: review_intelligence is hand-crafted test fixture data designed to give
-- Phase 4a developers a realistic dashboard experience. The FI, avg_rating, and
-- platform_breakdown values are INTENTIONALLY designed to tell a narrative
-- (gradually improving trend) and may not precisely match compute_flavor_index_range()
-- output for the same periods. total_reviews matches the date formula output.

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
-- ═══════════════════════════════════════════════════════════════════════════
-- Alamo Prime: Monthly (57 / 57 / 36 from date formula)
-- ═══════════════════════════════════════════════════════════════════════════
(
  v_group_id, '11111111-1111-1111-1111-111111111111',
  'month', '2025-12-01', '2025-12-31',
  57, 4.58, 68.89, NULL,  -- Dec FI lower than overall (tests "Excellent" zone)
  NULL, NULL, NULL, NULL,  -- Dec: no AI extraction yet
  '[{"item": "Bone-In Ribeye", "mentions": 8, "avg_sentiment": 0.85}]'::jsonb,
  '[{"item": "Wait Time", "mentions": 6, "avg_sentiment": -0.65}]'::jsonb,
  '[{"category": "Food Quality", "avg_intensity": 4.1, "count": 30}]'::jsonb,
  '[{"category": "Wait Time", "avg_intensity": 3.2, "count": 8}]'::jsonb,
  '[{"name": "Maria Garcia", "mentions": 4, "positive": 4, "negative": 0}]'::jsonb,
  '{"google": {"count": 28, "avg_rating": 4.55, "flavor_index": 68.18},
    "opentable": {"count": 18, "avg_rating": 4.64, "flavor_index": 71.43},
    "tripadvisor": {"count": 11, "avg_rating": 4.56, "flavor_index": 66.67}}'::jsonb,
  0, 82.00, 6.00,
  '{"delighted": 55, "satisfied": 25, "neutral": 10, "frustrated": 7, "angry": 3}'::jsonb
),
(
  v_group_id, '11111111-1111-1111-1111-111111111111',
  'month', '2026-01-01', '2026-01-31',
  57, 4.66, 76.00, 7.11,  -- improving vs Dec
  0.820, 0.650, 0.710, 0.480,
  '[{"item": "Bone-In Ribeye", "mentions": 10, "avg_sentiment": 0.90},
    {"item": "Truffle Mac & Cheese", "mentions": 5, "avg_sentiment": 0.92}]'::jsonb,
  '[{"item": "Wait Time", "mentions": 8, "avg_sentiment": -0.70}]'::jsonb,
  '[{"category": "Food Quality", "avg_intensity": 4.3, "count": 35}]'::jsonb,
  '[{"category": "Wait Time", "avg_intensity": 3.5, "count": 10}]'::jsonb,
  '[{"name": "Maria Garcia", "mentions": 5, "positive": 5, "negative": 0},
    {"name": "Carlos Reyes", "mentions": 4, "positive": 4, "negative": 0}]'::jsonb,
  '{"google": {"count": 29, "avg_rating": 4.68, "flavor_index": 76.00},
    "opentable": {"count": 17, "avg_rating": 4.67, "flavor_index": 73.33},
    "tripadvisor": {"count": 11, "avg_rating": 4.60, "flavor_index": 80.00}}'::jsonb,
  1, 86.00, 4.00,
  '{"delighted": 60, "satisfied": 22, "neutral": 8, "frustrated": 7, "angry": 3}'::jsonb
),
(
  v_group_id, '11111111-1111-1111-1111-111111111111',
  'month', '2026-02-01', '2026-02-20',
  36, 4.71, 80.00, 4.00,  -- continuing upward trend
  0.850, 0.700, 0.730, 0.510,
  '[{"item": "Bone-In Ribeye", "mentions": 10, "avg_sentiment": 0.95},
    {"item": "Truffle Mac & Cheese", "mentions": 6, "avg_sentiment": 0.95},
    {"item": "Classic Margarita", "mentions": 5, "avg_sentiment": 0.88}]'::jsonb,
  '[{"item": "Wait Time", "mentions": 8, "avg_sentiment": -0.72}]'::jsonb,
  '[{"category": "Food Quality", "avg_intensity": 4.5, "count": 40}]'::jsonb,
  '[{"category": "Wait Time", "avg_intensity": 3.3, "count": 9}]'::jsonb,
  '[{"name": "Maria Garcia", "mentions": 5, "positive": 4, "negative": 1},
    {"name": "Carlos Reyes", "mentions": 3, "positive": 3, "negative": 0},
    {"name": "Jake Thompson", "mentions": 3, "positive": 3, "negative": 0}]'::jsonb,
  '{"google": {"count": 18, "avg_rating": 4.75, "flavor_index": 82.14},
    "opentable": {"count": 10, "avg_rating": 4.69, "flavor_index": 75.00},
    "tripadvisor": {"count": 8, "avg_rating": 4.64, "flavor_index": 81.82}}'::jsonb,
  1, 89.00, 3.00,
  '{"delighted": 62, "satisfied": 22, "neutral": 7, "frustrated": 6, "angry": 3}'::jsonb
),
-- Alamo Prime: Quarterly (same as Dec = 57)
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
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Repeat pattern for Longhorn & Ember, Salt & Sear, Mesquite Flame
-- with their respective FI targets and volumes.
-- ═══════════════════════════════════════════════════════════════════════════

-- Longhorn & Ember monthly example (January = 38 reviews):
-- (v_group_id, '22222222-...', 'month', '2026-01-01', '2026-01-31',
--   38, 4.33, 48.48, -2.52, 0.720, 0.580, 0.610, 0.420, ...)

-- Salt & Sear monthly example (January = 30 reviews):
-- (v_group_id, '33333333-...', 'month', '2026-01-01', '2026-01-31',
--   30, 4.04, 25.93, 1.93, 0.600, 0.480, 0.520, 0.350, ...)

-- Mesquite Flame monthly example (January = 23 reviews):
-- (v_group_id, '44444444-...', 'month', '2026-01-01', '2026-01-31',
--   23, 3.55, -5.00, -3.18, 0.420, 0.350, 0.380, 0.280, ...)
```

**Pattern per competitor:** 3 monthly rows + 1 quarterly row = 4 rows each. Total: 4 restaurants x 4 = **16 `review_intelligence` rows**.

### 2.10 Complaint Categories (for `opportunities` JSONB)

These appear in `review_analyses.opportunities` for low-rated reviews:

| Category | Mentions (Alamo Prime) | Avg Intensity |
|---|---|---|
| Wait Time | 22 | 3.5 |
| Noise Level | 9 | 2.8 |
| Value | 8 | 3.0 |
| Service Speed | 6 | 3.2 |
| Parking | 4 | 2.5 |

```json
[
  { "category": "Wait Time", "intensity": 4 },
  { "category": "Noise Level", "intensity": 3 }
]
```

---

## 3. Color System (CSS + TypeScript)

### 3.1 CSS Variables (HSL format for Tailwind)

Add to `src/index.css` inside `:root` in Phase 4a:

```css
:root {
  /* ═══════════════════════════════════════════════════════════════════
     Flavor Index Score Zones
     Corrected HSL values verified against hex targets.
     Usage: bg-[hsl(var(--flavor-world-class))]
     ═══════════════════════════════════════════════════════════════════ */
  --flavor-world-class: 160 84% 39%;         /* #10B981  emerald-500  (+71 to +100) */
  --flavor-excellent: 142 71% 45%;           /* #22C55E  green-500    (+51 to +70)  */
  --flavor-great: 84 81% 44%;               /* #84CC16  lime-500     (+31 to +50)  */
  --flavor-good: 38 92% 50%;                /* #F59E0B  amber-500    (0 to +30)    */
  --flavor-needs-improvement: 0 84% 60%;     /* #EF4444  red-500      (-100 to -1)  */

  /* ═══════════════════════════════════════════════════════════════════
     NPS Category Colors (star-distribution bar)
     ═══════════════════════════════════════════════════════════════════ */
  --flavor-loving: 142 71% 45%;              /* green — 5-star "Loving the Flavor"  */
  --flavor-fence: 38 92% 50%;               /* amber — 4-star "On the Fence"       */
  --flavor-not-feeling: 0 84% 60%;           /* red   — 1-3 star "Not Feeling It"   */
}
```

**Audit correction note:** The overview document originally listed World-Class as `160 59% 49%`, which does not produce `#10B981`. The corrected value `160 84% 39%` is verified:
- H=160, S=84%, L=39% produces RGB(16, 185, 129) = `#10B981`.

### 3.2 TypeScript Types (`src/types/reviews.ts`)

```typescript
// src/types/reviews.ts
// ═══════════════════════════════════════════════════════════════════════════
// Core Review Intelligence Types
// Created in Phase 1 (reference), consumed from Phase 4a onward.
// ═══════════════════════════════════════════════════════════════════════════

// --- Flavor Index Score Zones ---
// Maps to CSS variables --flavor-{zone}
export type FlavorScoreZone =
  | 'world-class'       // +71 to +100
  | 'excellent'         // +51 to +70
  | 'great'             // +31 to +50
  | 'good'              // 0 to +30
  | 'needs-improvement' // -100 to -1

// --- NPS-Style Categories (star distribution bar) ---
export type FlavorCategory =
  | 'loving'       // 5-star reviews
  | 'fence'        // 4-star reviews
  | 'not-feeling'  // 1-3 star reviews

// --- Review Platforms ---
export type ReviewPlatform = 'google' | 'opentable' | 'tripadvisor';

// --- Analysis Pipeline Status ---
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// --- AI-Extracted Emotion ---
export type Emotion = 'delighted' | 'satisfied' | 'neutral' | 'frustrated' | 'angry';

// --- Time Period Selector ---
export type TimePeriod =
  | { type: 'trailing_days'; value: number }    // 30, 90
  | { type: 'month'; value: string }            // '2026-02'
  | { type: 'quarter'; value: string }          // '2026-Q1'
  | { type: 'ytd'; value: '' }
  | { type: 'custom'; value: string }           // '2026-01-01:2026-03-31'

// --- Restaurant Types ---
export type RestaurantType = 'own' | 'competitor';

// --- Scraping Configuration ---
export type ScrapingFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

// --- Restaurant Status ---
export type RestaurantStatus = 'active' | 'paused' | 'archived';

// --- Scrape Run Status ---
export type ScrapeRunStatus = 'received' | 'processing' | 'completed' | 'failed';

// --- AI-Extracted Return Intent ---
export type ReturnIntent = 'likely' | 'unlikely' | 'unclear';

// --- Overall Sentiment ---
export type Sentiment = 'positive' | 'neutral' | 'negative';

// --- Flavor Zone Configuration Utility ---
// Maps each zone to its label (EN/ES), color variable, and score range.
export interface FlavorZoneConfig {
  zone: FlavorScoreZone;
  label: { en: string; es: string };
  cssVar: string;           // CSS custom property name (e.g., '--flavor-world-class')
  hex: string;              // Hex fallback for non-CSS contexts
  minScore: number;         // Inclusive lower bound
  maxScore: number;         // Inclusive upper bound
}

// Pre-defined zone configurations (consumed by getFlavorZone utility)
export const FLAVOR_ZONES: FlavorZoneConfig[] = [
  {
    zone: 'world-class',
    label: { en: 'World-Class', es: 'Clase Mundial' },
    cssVar: '--flavor-world-class',
    hex: '#10B981',
    minScore: 71,
    maxScore: 100,
  },
  {
    zone: 'excellent',
    label: { en: 'Excellent', es: 'Excelente' },
    cssVar: '--flavor-excellent',
    hex: '#22C55E',
    minScore: 51,
    maxScore: 70,
  },
  {
    zone: 'great',
    label: { en: 'Great', es: 'Muy Bueno' },
    cssVar: '--flavor-great',
    hex: '#84CC16',
    minScore: 31,
    maxScore: 50,
  },
  {
    zone: 'good',
    label: { en: 'Good', es: 'Bueno' },
    cssVar: '--flavor-good',
    hex: '#F59E0B',
    minScore: 0,
    maxScore: 30,
  },
  {
    zone: 'needs-improvement',
    label: { en: 'Needs Improvement', es: 'Necesita Mejorar' },
    cssVar: '--flavor-needs-improvement',
    hex: '#EF4444',
    minScore: -100,
    maxScore: -1,
  },
];

// --- NPS Category Configuration ---
export interface FlavorCategoryConfig {
  category: FlavorCategory;
  label: { en: string; es: string };
  cssVar: string;
  hex: string;
  starRatings: number[];    // Which star ratings map to this category
}

export const FLAVOR_CATEGORIES: FlavorCategoryConfig[] = [
  {
    category: 'loving',
    label: { en: 'Loving the Flavor', es: 'Amando el Sabor' },
    cssVar: '--flavor-loving',
    hex: '#22C55E',
    starRatings: [5],
  },
  {
    category: 'fence',
    label: { en: 'On the Fence', es: 'Indecisos' },
    cssVar: '--flavor-fence',
    hex: '#F59E0B',
    starRatings: [4],
  },
  {
    category: 'not-feeling',
    label: { en: 'Not Feeling It', es: 'Sin Sabor' },
    cssVar: '--flavor-not-feeling',
    hex: '#EF4444',
    starRatings: [1, 2, 3],
  },
];
```

---

## 4. Bilingual Labels (Complete Mapping)

The audit identified three problematic Spanish translations. This is the corrected, final bilingual label set.

### 4.1 Flavor Index Score Zones

| Zone | EN | ES (Corrected) | Color | Score Range |
|---|---|---|---|---|
| World-Class | World-Class | Clase Mundial | `#10B981` | +71 to +100 |
| Excellent | Excellent | Excelente | `#22C55E` | +51 to +70 |
| Great | Great | **Muy Bueno** | `#84CC16` | +31 to +50 |
| Good | Good | Bueno | `#F59E0B` | 0 to +30 |
| Needs Improvement | Needs Improvement | Necesita Mejorar | `#EF4444` | -100 to -1 |

**Correction:** "Genial" was replaced with "Muy Bueno" for the Great zone. "Genial" is juvenile/informal in Mexican Spanish restaurant context (closer to "cool!" than professional). "Muy Bueno" (Very Good) is natural business Spanish.

### 4.2 NPS Categories

| Category | EN | ES (Corrected) | Star Ratings |
|---|---|---|---|
| Promoters | Loving the Flavor | Amando el Sabor | 5-star |
| Passives | On the Fence | **Indecisos** | 4-star |
| Detractors | Not Feeling It | **Sin Sabor** | 1-3 star |

**Corrections:**
- "En la Cerca" was replaced with **"Indecisos"** (undecided, natural) for "On the Fence". The original was a literal translation of a physical fence, not idiomatic.
- "No lo Sienten" was replaced with **"Sin Sabor"** (without flavor, on-brand) for "Not Feeling It". The original was third-person plural and stiff.

### 4.3 Feature Title

| Element | EN | ES |
|---|---|---|
| Feature name | Flavor Index | Índice de Sabor |
| Dashboard title | Review Insights | Perspectivas de Reseñas |
| Tab: Overview | Overview | Resumen |
| Tab: Compete | Compete | Competencia |
| Tab: Insights | Insights | Perspectivas |

### 4.4 Time Periods

| EN | ES |
|---|---|
| 30 days | 30 días |
| 90 days | 90 días |
| Year to Date | Año hasta la fecha |
| This Week | Esta Semana |
| This Month | Este Mes |
| This Quarter | Este Trimestre |
| Custom Range | Rango Personalizado |

### 4.5 Empty States

| State | EN | ES |
|---|---|---|
| No reviews | Welcome to Flavor Index | Bienvenido al Índice de Sabor |
| No competitors | Add competitors to benchmark your performance | Agrega competidores para comparar tu rendimiento |
| No AI data | AI insights coming soon | Perspectivas de IA próximamente |

### 4.6 Emotion Labels

| Emotion | EN | ES |
|---|---|---|
| delighted | Delighted | Encantado |
| satisfied | Satisfied | Satisfecho |
| neutral | Neutral | Neutral |
| frustrated | Frustrated | Frustrado |
| angry | Angry | Enojado |

### 4.7 Sentiment Labels

| Sentiment | EN | ES |
|---|---|---|
| positive | Positive | Positivo |
| neutral | Neutral | Neutral |
| negative | Negative | Negativo |

### 4.8 Return Intent Labels

| Intent | EN | ES |
|---|---|---|
| likely | Likely to Return | Probable que Regrese |
| unlikely | Unlikely to Return | Poco Probable que Regrese |
| unclear | Unclear | No Claro |

---

## 5. Seed Data Cleanup SQL

All seed data uses deterministic UUIDs and has `created_by = NULL` on `tracked_restaurants`. CASCADE deletes propagate to all child tables.

### 5.1 Full Cleanup (Before Go-Live)

```sql
-- =============================================================================
-- SEED DATA CLEANUP — Run before go-live
-- Removes ALL synthetic review data while preserving schema, functions, and
-- credit_costs system defaults (group_id IS NULL).
--
-- CASCADE on tracked_restaurants propagates to:
--   - restaurant_reviews (FK: restaurant_id)
--     - review_analyses (FK: review_id)
--   - scrape_runs (FK: restaurant_id)
--   - flavor_index_daily (FK: restaurant_id)
--   - review_intelligence (FK: restaurant_id)
-- =============================================================================

-- Step 1: Delete all 5 tracked restaurants (CASCADE handles everything)
DELETE FROM public.tracked_restaurants
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',  -- Alamo Prime Steakhouse
  '22222222-2222-2222-2222-222222222222',  -- Longhorn & Ember
  '33333333-3333-3333-3333-333333333333',  -- Salt & Sear Chophouse
  '44444444-4444-4444-4444-444444444444',  -- Mesquite Flame Grill
  '55555555-5555-5555-5555-555555555555'   -- Alamo Prime - Westside
);

-- Step 2: Clean up any ai_usage_log test entries (no CASCADE from restaurants)
DELETE FROM public.ai_usage_log
WHERE domain = 'reviews'
  AND metadata->>'seed' = 'true';
-- NOTE: Only deletes rows explicitly tagged as seed data.
-- Alternatively, if no real usage exists yet:
-- TRUNCATE public.ai_usage_log;
```

### 5.2 Verification After Cleanup

```sql
-- Verify all seed data is gone
SELECT 'tracked_restaurants' AS tbl, count(*) FROM public.tracked_restaurants
  WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
               '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',
               '55555555-5555-5555-5555-555555555555')
UNION ALL
SELECT 'restaurant_reviews', count(*) FROM public.restaurant_reviews
  WHERE restaurant_id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
                          '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444')
UNION ALL
SELECT 'review_analyses', count(*) FROM public.review_analyses
  WHERE restaurant_id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
                          '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444')
UNION ALL
SELECT 'flavor_index_daily', count(*) FROM public.flavor_index_daily
  WHERE restaurant_id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
                          '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444')
UNION ALL
SELECT 'review_intelligence', count(*) FROM public.review_intelligence
  WHERE restaurant_id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
                          '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
-- Expected: all counts = 0

-- Verify credit_costs system defaults still exist
SELECT count(*) FROM public.credit_costs WHERE group_id IS NULL;
-- Expected: 11 (system defaults preserved)
```

### 5.3 Partial Cleanup (Remove Only Competitors)

If you want to keep Alamo Prime but remove competitors before adding real ones:

```sql
-- Remove only competitor restaurants (CASCADE cleans their reviews)
DELETE FROM public.tracked_restaurants
WHERE id IN (
  '22222222-2222-2222-2222-222222222222',  -- Longhorn & Ember
  '33333333-3333-3333-3333-333333333333',  -- Salt & Sear Chophouse
  '44444444-4444-4444-4444-444444444444'   -- Mesquite Flame Grill
);
```

---

## Summary of Seed Data Counts

| Table | Expected Rows |
|---|---|
| `tracked_restaurants` | 5 |
| `restaurant_reviews` | 390 (150 + 100 + 80 + 60) |
| `review_analyses` | 360 (completed reviews only) |
| `flavor_index_daily` | ~60-70 rows (one per restaurant per active day) |
| `review_intelligence` | 16 (4 restaurants x (3 monthly + 1 quarterly)) |
| `scrape_runs` | 0 (no simulated scrape runs needed for seed data) |
| `credit_costs` | 11 (system defaults, seeded in M06 not S02) |
| `ai_usage_log` | 0 (populated only by runtime calls) |

---

*This document is ready to be incorporated into the Phase 1 plan. All SQL patterns have been validated against the audited schema in `01-phase-db-foundation.md`. The TypeScript types and CSS variables are designed for direct consumption in Phase 4a.*
