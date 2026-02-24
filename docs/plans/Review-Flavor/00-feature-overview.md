# Review Analyst & Flavor Index — Feature Overview

> **Note:** This overview is a high-level design document. For Phase 1 implementation,
> the **authoritative source** is `01-phase-db-foundation-FINAL.md`. Key differences
> from this overview (resolved during 3 audit rounds):
> - `review_platform` ENUM replaced with TEXT + CHECK (matches codebase convention)
> - `org_hierarchy` + `org_assignments` deferred to Phase 8 (no consumer before then)
> - `rating` column uses SMALLINT (not NUMERIC) — all platforms use integer 1-5
> - 9 consolidated migrations (not 12)
> - RLS policies expanded (review_analyses has 4 policies, scrape_runs has group-level SELECT)
> - `ai_usage_log` INSERT policies removed (all inserts via SECURITY DEFINER)

## Vision

A **review intelligence system** that scrapes restaurant reviews from Google, OpenTable, and TripAdvisor via Apify, processes them through an AI extraction engine, and stores structured signals — not raw text — in a database. The system computes a proprietary **Flavor Index** score, benchmarks it against up to 4 local competitors, and powers an AI-driven analytics dashboard that gives restaurant operators actionable insights into food trends, service quality, staff performance, and competitive positioning.

Think of it as **NPS for restaurants, powered by structured review intelligence**.

---

## Core Concepts

### 1. Flavor Index — A Restaurant NPS

The Flavor Index is a **loose interpretation of the Net Promoter Score (NPS)** adapted for restaurant reviews. Like NPS, it produces a single number from **-100 to +100** that captures overall guest sentiment.

#### The Three Categories (NPS-Inspired)

Just as NPS divides respondents into Promoters, Passives, and Detractors, the Flavor Index divides reviews into three categories:

| Star Rating | NPS Equivalent | Flavor Index Category | Color | Meaning |
|-------------|---------------|----------------------|-------|---------|
| **5 stars** | Promoters (9-10) | **Loving the Flavor** | `#22C55E` (green) | Guests who had an outstanding experience and will actively recommend |
| **4 stars** | Passives (7-8) | **On the Fence** | `#F59E0B` (amber) | Satisfied but not enthusiastic — won't hurt you, won't promote you |
| **1-3 stars** | Detractors (0-6) | **Not Feeling It** | `#EF4444` (red) | Guests who had a negative experience and may discourage others |

#### The Formula

```
% Loving the Flavor = (count of 5-star reviews / total reviews) × 100
% Not Feeling It     = (count of 1-3 star reviews / total reviews) × 100

Flavor Index = % Loving the Flavor − % Not Feeling It
```

Same structure as NPS: `Score = % Promoters − % Detractors`. Passives ("On the Fence") are counted in the total but excluded from the formula — they dilute both sides equally.

#### Score Ranges (NPS-Aligned)

| Score Range | Rating | Color Zone | Restaurant Meaning |
|-------------|--------|------------|-------------------|
| **+71 to +100** | World-Class | `#10B981` (emerald) | Almost every guest is loving the flavor — rare and exceptional |
| **+51 to +70** | Excellent | `#22C55E` (green) | Strong loyalty, guests are actively recommending you |
| **+31 to +50** | Great | `#84CC16` (lime) | Solid performance, competitive position, room to push higher |
| **0 to +30** | Good | `#F59E0B` (amber) | Decent but too many guests are on the fence or not feeling it |
| **-100 to -1** | Needs Improvement | `#EF4444` (red) | More unhappy guests than happy ones — urgent attention needed |

These thresholds mirror standard NPS ranges, making Flavor Index scores directly comparable to NPS benchmarks.

#### Bilingual Labels

| Element | EN | ES |
|---------|----|----|
| Score title | Flavor Index | Índice de Sabor |
| Promoters | Loving the Flavor | Amando el Sabor |
| Passives | On the Fence | Indecisos |
| Detractors | Not Feeling It | Sin Sabor |
| World-Class | World-Class | Clase Mundial |
| Excellent | Excellent | Excelente |
| Great | Great | Muy Bueno |
| Good | Good | Bueno |
| Needs Improvement | Needs Improvement | Necesita Mejorar |

**Key insight:** The Flavor Index only requires star ratings — no AI extraction needed for the headline KPI. This means we can have a working dashboard before the AI extraction engine is built.

### 2. Review Intelligence Extraction

Reviews are NOT stored as raw text long-term. Each review is processed through an AI extraction engine (see `review-scrape-overview.md`) that outputs structured JSON containing:

- **Overall sentiment** and **emotion** classification
- **Strengths** and **opportunities** by category (Food Quality, Service, Ambience, Value, etc.) with intensity scores
- **Menu items mentioned** with sentiment, type, and cuisine classification
- **Staff members mentioned** with role and sentiment
- **Return intent** (likely / unlikely / unclear)
- **High-severity flags** with details (health/safety, legal threats, discrimination)

Review text is stored temporarily during processing (in a `review_text` column), then NULLed out after successful extraction. A 90-day TTL provides a safety window for re-extraction if the prompt is improved.

### 3. Competitive Benchmarking

Each restaurant unit can track up to **4 local competitors** (enforced by DB trigger). The system scrapes competitor reviews from the same platforms, runs the same AI extraction, and computes their Flavor Index. This enables side-by-side comparison across every metric.

### 4. Multi-Unit Hierarchy

The system supports a **Company -> Region -> Unit** hierarchy:

| Role | What They See |
|------|---------------|
| **GM / Unit Manager** | Their restaurant + up to 4 competitors |
| **Regional Director** | All units in their region + regional averages + competitor data |
| **VP / Corporate** | Company-wide metrics, region comparisons, top/bottom performers |

---

## System Architecture

```
+-----------------------------------------------------------------+
|                        APIFY PLATFORM                           |
|                                                                 |
|  +--------------+  +--------------+  +--------------+          |
|  | Google Maps  |  |  OpenTable   |  | TripAdvisor  |          |
|  | Reviews Actor|  | Reviews Actor|  | Reviews Actor|          |
|  +------+-------+  +------+-------+  +------+-------+          |
|         +------------------+------------------+                 |
|                            |                                    |
|              Webhook on ACTOR.RUN.SUCCEEDED                     |
|              (authenticated via shared secret)                  |
+-----------------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------------+
|                    SUPABASE EDGE FUNCTIONS                      |
|                                                                 |
|  +---------------------+     +---------------------+           |
|  |  ingest-reviews     |     |  analyze-review     |           |
|  |  (webhook receiver) |     |  (scheduled batch    |           |
|  |  Auth: shared secret|     |   AI extraction per  |           |
|  |  Logs to scrape_runs|     |   review via OpenAI) |           |
|  |  Idempotent via     |     |  Structured outputs  |           |
|  |  apify_run_id       |     |  NULLs review_text   |           |
|  +---------------------+     +----------+-----------+           |
|                                          |                      |
|  +---------------------+     +----------v-----------+           |
|  |  /ask (domain:      |     |  compute-rollups     |           |
|  |   "reviews")        |     |  (daily aggregation   |           |
|  |  AI chat over       |     |   + Flavor Index)     |           |
|  |  review data        |     |  Atomic upserts       |           |
|  +---------------------+     +-----------------------+           |
+-----------------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------------+
|                    SUPABASE POSTGRESQL                          |
|                                                                 |
|  +------------------+  +------------------+                    |
|  | scrape_runs      |  | restaurant_      |                    |
|  | (ingestion audit)|  | reviews          |                    |
|  +------------------+  | (with transient  |                    |
|                        |  review_text)     |                    |
|  +------------------+  +------------------+                    |
|  | review_analyses  |  | flavor_index_    |                    |
|  | (AI-extracted    |  | daily (rollups)  |                    |
|  |  structured JSON)|  +------------------+                    |
|  +------------------+                                          |
|                        +------------------+                    |
|  +------------------+  | review_          |                    |
|  | tracked_         |  | intelligence     |                    |
|  | restaurants      |  | (period sums)    |                    |
|  | (own + comps)    |  +------------------+                    |
|  +------------------+                                          |
|                        +------------------+                    |
|  +------------------+  | org_assignments  |                    |
|  | org_hierarchy    |  | (user -> node)   |                    |
|  +------------------+  +------------------+                    |
|                                                                 |
|  +------------------+  +------------------+                    |
|  | credit_costs     |  | ai_usage_log     |                    |
|  | (cost config)    |  | (audit trail)    |                    |
|  +------------------+  +------------------+                    |
+-----------------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------------+
|                    REACT FRONTEND                               |
|                                                                 |
|  +-------------+  +-------------+  +-------------+             |
|  | Dashboard   |  | Compete     |  | AI Review   |             |
|  | (Tabbed:    |  | (competitor |  | Chat        |             |
|  |  Overview,  |  |  benchmark, |  | (natural    |             |
|  |  Insights)  |  |  trends)    |  |  language)  |             |
|  +-------------+  +-------------+  +-------------+             |
|                                                                 |
|  +-------------+  +-------------+                               |
|  | Admin:      |  | Admin:      |                               |
|  | Manage Units|  | Corporate   |                               |
|  | & Comps     |  | Overview    |                               |
|  +-------------+  +-------------+                               |
+-----------------------------------------------------------------+
```

---

## Data Pipeline

### Step 1 — Scrape Reviews (Apify)

Use existing Apify marketplace actors (not custom-built) for each platform:

| Platform | Recommended Actor | Cost | Data Returned |
|----------|------------------|------|---------------|
| **Google Maps** | `compass/google-maps-reviews-scraper` | ~$0.55 / 1K reviews | Star rating, text, date, reviewer name, photos, owner response, language, helpful votes |
| **OpenTable** | `memo23/opentable-reviews-cheerio` | ~$0.30 / 1K reviews | Overall rating, **sub-ratings** (food, service, ambience, value), text, reviewer, dining date |
| **TripAdvisor** | `maxcopell/tripadvisor-reviews` or `thewolves/tripadvisor-reviews-scraper` | ~$0.50 / 1K reviews | Rating, title, text, date, reviewer, travel date, helpful votes, owner response, photos |

**Scheduling:** Apify's built-in cron scheduler runs **daily** (e.g., every day at 2 AM). On `ACTOR.RUN.SUCCEEDED`, a webhook POSTs to a Supabase Edge Function (`ingest-reviews`) which fetches the dataset and normalizes/inserts into the DB.

**Incremental scraping:** To control costs, each daily run is configured to fetch only reviews from the last 3 days (overlap ensures no gaps). The `ON CONFLICT (platform, platform_review_id) DO UPDATE` pattern deduplicates automatically. This means daily runs process far fewer reviews than a full historical scrape.

**Webhook authentication:** The `ingest-reviews` edge function validates an `X-Apify-Webhook-Secret` header (stored as a Supabase secret) to prevent unauthorized POSTs.

**Cost estimates (daily incremental scraping):**

| Scenario | New Reviews/Day | Apify Cost/Month | AI Extraction Cost/Month | Total/Month |
|----------|----------------|-----------------|------------------------|-------------|
| 1 restaurant + 4 competitors, 3 platforms, daily | ~5-15 | ~$3.50 | ~$2.00 | ~$5.50 |
| 5 own restaurants + 20 competitors, 3 platforms, daily | ~25-75 | ~$17.50 | ~$10.00 | ~$27.50 |
| 20 own restaurants + 80 competitors, 3 platforms, daily | ~100-300 | ~$70.00 | ~$40.00 | ~$110.00 |

Apify free plan provides $5/month in credits — sufficient for the smallest scenario. Daily incremental scraping costs ~30% more than weekly full scrapes, but catches new reviews within 24 hours instead of up to 7 days.

### Step 2 — Normalize, Deduplicate & Store

All reviews are normalized into a common schema regardless of platform:

| Normalized Field | Google | OpenTable | TripAdvisor |
|------------------|--------|-----------|-------------|
| `rating` | `stars` (1-5) | overall (1-5) | `rating` (1-5) |
| `review_text` | `text` | review text | review text |
| `review_title` | N/A | N/A | title |
| `reviewer_name` | `reviewerName` | nickname | username |
| `review_date` | `publishedAt` | review date | published date |
| `visit_date` | N/A | dining date | travel date |
| `food_rating` | N/A | food score | N/A |
| `service_rating` | N/A | service score | N/A |
| `ambience_rating` | N/A | ambience score | N/A |
| `value_rating` | N/A | value score | N/A |
| `owner_response` | `responseFromOwnerText` | N/A | owner response |
| `helpful_votes` | `likesCount` | N/A | helpful votes |

**Deduplication:** `UNIQUE(platform, platform_review_id)` prevents re-importing the same review. On conflict, metadata is updated via `ON CONFLICT DO UPDATE` and `analysis_status` is reset to `pending` if the rating changed (handles edited reviews).

**Idempotency:** Each Apify run is recorded in `scrape_runs` with its `apify_run_id`. If the same run ID arrives twice, the duplicate is skipped. Partial failures are resumable via paginated dataset processing with last-offset tracking.

### Step 3 — AI Extraction (Decoupled)

Extraction runs as a **scheduled batch process**, decoupled from ingestion:

1. `ingest-reviews` inserts reviews with `analysis_status = 'pending'` and `review_text` populated.
2. `analyze-review` runs **daily** (after ingestion completes, e.g., 3 AM), picks up `WHERE analysis_status = 'pending' AND retry_count < 3`.
3. Each review is sent to OpenAI gpt-4o-mini using structured outputs (`response_format: { type: "json_schema" }`) to guarantee valid JSON matching the extraction schema.
4. On success: structured JSON stored in `review_analyses`, `review_text` set to NULL, `analysis_status = 'completed'`.
5. On failure: `retry_count` incremented, `last_error` recorded, `analysis_status = 'failed'`. After 3 failures, review stays in `failed` for admin review.

**Text lifecycle:** Review text exists in the DB only between ingestion and successful extraction. A cleanup job NULLs `review_text` for all `completed` reviews older than 90 days (safety window for re-extraction with improved prompts).

### Step 4 — Aggregate & Compute

Rollup tables are recomputed **daily** via **atomic upserts** (not read-modify-write triggers) to avoid race conditions:

```sql
INSERT INTO flavor_index_daily (restaurant_id, date, total_reviews, five_star, ...)
VALUES (...)
ON CONFLICT (restaurant_id, date) DO UPDATE SET
  total_reviews = EXCLUDED.total_reviews,
  five_star = EXCLUDED.five_star, ...
```

The `compute-rollups` edge function:
1. Recomputes `flavor_index_daily` rows from `restaurant_reviews` star ratings (idempotent).
2. Recomputes `review_intelligence` period summaries from `review_analyses` data.
3. Runs **daily** after extraction completes (e.g., 4 AM), or on demand.

---

## Database Schema

### Enum Types

```sql
CREATE TYPE public.review_platform AS ENUM ('google', 'opentable', 'tripadvisor');
```

### Core Tables

#### `tracked_restaurants` — Own units + competitors

```sql
CREATE TABLE public.tracked_restaurants (
  id                UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Identity
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  restaurant_type   TEXT NOT NULL CHECK (restaurant_type IN ('own', 'competitor')),

  -- Platform identifiers (for Apify actors)
  google_place_id   TEXT,
  google_place_url  TEXT,
  opentable_url     TEXT,
  tripadvisor_url   TEXT,

  -- Location
  address           TEXT,
  city              TEXT,
  state             TEXT,
  zip               TEXT,
  latitude          NUMERIC(10,7),
  longitude         NUMERIC(10,7),

  -- Competitor linking (NULL for own restaurants)
  parent_unit_id    UUID REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Config
  scrape_enabled    BOOLEAN NOT NULL DEFAULT true,
  scrape_frequency  TEXT NOT NULL DEFAULT 'daily'
                    CHECK (scrape_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  last_scraped_at   TIMESTAMPTZ,

  -- Status
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'archived')),

  -- Audit
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

-- Indexes
CREATE INDEX idx_tracked_restaurants_group ON public.tracked_restaurants(group_id, status);
CREATE INDEX idx_tracked_restaurants_parent ON public.tracked_restaurants(parent_unit_id)
  WHERE parent_unit_id IS NOT NULL;

-- Max 4 competitors per own restaurant (DB-enforced)
CREATE OR REPLACE FUNCTION public.enforce_max_competitors()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.restaurant_type = 'competitor' AND NEW.parent_unit_id IS NOT NULL THEN
    IF (SELECT count(*) FROM public.tracked_restaurants
        WHERE parent_unit_id = NEW.parent_unit_id
          AND restaurant_type = 'competitor'
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) >= 4 THEN
      RAISE EXCEPTION 'Maximum 4 competitors per restaurant unit';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_max_competitors
  BEFORE INSERT OR UPDATE ON public.tracked_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_competitors();

-- updated_at trigger
CREATE TRIGGER trg_tracked_restaurants_updated_at
  BEFORE UPDATE ON public.tracked_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.tracked_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view restaurants in their group"
  ON public.tracked_restaurants FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert restaurants"
  ON public.tracked_restaurants FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update restaurants"
  ON public.tracked_restaurants FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete restaurants"
  ON public.tracked_restaurants FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

#### `scrape_runs` — Ingestion audit trail

```sql
CREATE TABLE public.scrape_runs (
  id                UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  platform          public.review_platform NOT NULL,
  apify_run_id      TEXT,
  apify_dataset_id  TEXT,

  status            TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received', 'processing', 'completed', 'failed')),
  reviews_fetched   INTEGER DEFAULT 0,
  reviews_inserted  INTEGER DEFAULT 0,
  reviews_duplicate INTEGER DEFAULT 0,
  reviews_updated   INTEGER DEFAULT 0,
  error_message     TEXT,
  last_offset       INTEGER DEFAULT 0,  -- for resumable pagination

  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,

  UNIQUE(apify_run_id, platform)  -- idempotency guard
);

ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view scrape runs"
  ON public.scrape_runs FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

#### `restaurant_reviews` — Normalized reviews with transient text

```sql
CREATE TABLE public.restaurant_reviews (
  id                  UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id       UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Source
  platform            public.review_platform NOT NULL,
  platform_review_id  TEXT NOT NULL,

  -- Core review data
  rating              NUMERIC(2,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
  review_date         TIMESTAMPTZ NOT NULL,
  visit_date          DATE,
  reviewer_name       TEXT,
  language            TEXT DEFAULT 'en',

  -- Transient text (NULLed after AI extraction; 90-day TTL for re-extraction)
  review_text         TEXT,
  review_title        TEXT,

  -- Sub-ratings (OpenTable native; others NULL)
  food_rating         NUMERIC(2,1) CHECK (food_rating IS NULL OR (food_rating >= 1.0 AND food_rating <= 5.0)),
  service_rating      NUMERIC(2,1) CHECK (service_rating IS NULL OR (service_rating >= 1.0 AND service_rating <= 5.0)),
  ambience_rating     NUMERIC(2,1) CHECK (ambience_rating IS NULL OR (ambience_rating >= 1.0 AND ambience_rating <= 5.0)),
  value_rating        NUMERIC(2,1) CHECK (value_rating IS NULL OR (value_rating >= 1.0 AND value_rating <= 5.0)),

  -- Owner response
  owner_response_text TEXT,
  owner_response_date TIMESTAMPTZ,

  -- Metadata
  helpful_votes       INTEGER DEFAULT 0,
  review_url          TEXT,

  -- Processing status
  analysis_status     TEXT NOT NULL DEFAULT 'pending'
                      CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  analyzed_at         TIMESTAMPTZ,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_error          TEXT,

  -- System
  scraped_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(platform, platform_review_id)
);

-- Indexes
CREATE INDEX idx_restaurant_reviews_restaurant_date
  ON public.restaurant_reviews(restaurant_id, review_date);
CREATE INDEX idx_restaurant_reviews_group
  ON public.restaurant_reviews(group_id);
CREATE INDEX idx_restaurant_reviews_pending
  ON public.restaurant_reviews(analysis_status)
  WHERE analysis_status IN ('pending', 'processing');

-- Triggers
CREATE TRIGGER trg_restaurant_reviews_updated_at
  BEFORE UPDATE ON public.restaurant_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews in their group"
  ON public.restaurant_reviews FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Service role can insert reviews"
  ON public.restaurant_reviews FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Service role can update reviews"
  ON public.restaurant_reviews FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

#### `review_analyses` — AI-extracted structured intelligence

```sql
CREATE TABLE public.review_analyses (
  id                UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  review_id         UUID NOT NULL REFERENCES public.restaurant_reviews(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Extracted by AI (field mapping: extraction "score" -> rating, "date" -> review_date)
  overall_sentiment TEXT NOT NULL CHECK (overall_sentiment IN ('positive', 'neutral', 'negative')),
  emotion           TEXT NOT NULL CHECK (emotion IN ('delighted', 'satisfied', 'frustrated', 'angry', 'neutral')),

  strengths         JSONB NOT NULL DEFAULT '[]',
  -- [{ "category": "Food Quality", "intensity": 4 }, ...]

  opportunities     JSONB NOT NULL DEFAULT '[]',
  -- [{ "category": "Service Speed", "intensity": 3 }, ...]

  items_mentioned   JSONB NOT NULL DEFAULT '[]',
  -- [{ "name": "Ribeye", "item_type": "food", "course_type": "entree",
  --    "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": 5 }, ...]

  staff_mentioned   JSONB NOT NULL DEFAULT '[]',
  -- [{ "name": "Maria", "role": "server", "sentiment": "positive" }, ...]

  return_intent     TEXT CHECK (return_intent IN ('likely', 'unlikely', 'unclear')),
  high_severity_flag BOOLEAN NOT NULL DEFAULT false,
  high_severity_details JSONB DEFAULT '[]',
  -- [{ "type": "health_safety", "summary": "Reported food poisoning symptoms" }]

  -- Denormalized for aggregation (set once at insertion, not updated)
  rating            NUMERIC(2,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
  review_date       TIMESTAMPTZ NOT NULL,

  -- Embedding for semantic search (deferred to Phase 9)
  embedding         vector(1536),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(review_id)
);

-- Indexes
CREATE INDEX idx_review_analyses_restaurant_date
  ON public.review_analyses(restaurant_id, review_date);
CREATE INDEX idx_review_analyses_group
  ON public.review_analyses(group_id);
CREATE INDEX idx_review_analyses_items
  ON public.review_analyses USING gin(items_mentioned);
CREATE INDEX idx_review_analyses_staff
  ON public.review_analyses USING gin(staff_mentioned);

-- RLS
ALTER TABLE public.review_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses in their group"
  ON public.review_analyses FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Service role can insert analyses"
  ON public.review_analyses FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

#### `flavor_index_daily` — Pre-computed daily rollups

```sql
CREATE TABLE public.flavor_index_daily (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,
  date            DATE NOT NULL,

  -- NPS-style star distribution (must sum correctly)
  total_reviews   INTEGER NOT NULL DEFAULT 0,
  five_star       INTEGER NOT NULL DEFAULT 0,  -- "Loving the Flavor" (Promoters)
  four_star       INTEGER NOT NULL DEFAULT 0,  -- "On the Fence" (Passives)
  three_star      INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)
  two_star        INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)
  one_star        INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)

  -- Consistency guard
  CHECK (five_star + four_star + three_star + two_star + one_star = total_reviews),

  -- Auto-computed Flavor Index: % Loving the Flavor − % Not Feeling It (-100 to +100)
  flavor_index    NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_reviews > 0
      THEN ((five_star::numeric / total_reviews) * 100)
           - (((one_star + two_star + three_star)::numeric / total_reviews) * 100)
      ELSE 0
    END
  ) STORED,

  -- Average rating
  avg_rating      NUMERIC(3,2),

  -- Category sentiment averages (-1.0 to 1.0, populated after AI extraction)
  food_sentiment      NUMERIC(4,3),
  service_sentiment   NUMERIC(4,3),
  ambience_sentiment  NUMERIC(4,3),
  value_sentiment     NUMERIC(4,3),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(restaurant_id, date)
);

-- The UNIQUE constraint on (restaurant_id, date) already provides the primary
-- query index. All wider time windows (weekly, monthly, quarterly, YTD, trailing 90d)
-- are computed on-the-fly via SQL aggregation from this table.

CREATE INDEX idx_flavor_daily_group ON public.flavor_index_daily(group_id);

CREATE TRIGGER trg_flavor_daily_updated_at
  BEFORE UPDATE ON public.flavor_index_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTE: This table is populated via idempotent upsert from compute-rollups,
-- NOT via per-row triggers on review_analyses (avoids race conditions).

-- RLS
ALTER TABLE public.flavor_index_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rollups in their group"
  ON public.flavor_index_daily FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());
```

#### `review_intelligence` — Period summaries for AI queries

```sql
CREATE TABLE public.review_intelligence (
  id                  UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id       UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Period definition
  period_type         TEXT NOT NULL CHECK (period_type IN ('week', 'month', 'quarter')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  CHECK (period_end > period_start),

  -- Aggregate scores
  total_reviews       INTEGER NOT NULL DEFAULT 0,
  avg_rating          NUMERIC(3,2),
  flavor_index        NUMERIC(5,2),
  flavor_index_change NUMERIC(5,2),  -- vs. previous same-length period

  -- Category sentiment scores (-1.0 to 1.0)
  food_sentiment      NUMERIC(4,3),
  service_sentiment   NUMERIC(4,3),
  ambience_sentiment  NUMERIC(4,3),
  value_sentiment     NUMERIC(4,3),

  -- Top mentions (JSONB for flexibility)
  top_positive_items  JSONB DEFAULT '[]',
  -- [{ "item": "Ribeye", "mentions": 12, "avg_sentiment": 0.85 }]

  top_complaints  JSONB DEFAULT '[]',
  -- [{ "item": "wait time", "mentions": 8, "avg_sentiment": -0.72 }]

  top_strengths       JSONB DEFAULT '[]',
  -- [{ "category": "Food Quality", "avg_intensity": 4.2, "count": 45 }]

  top_opportunities   JSONB DEFAULT '[]',
  -- [{ "category": "Service Speed", "avg_intensity": 3.1, "count": 18 }]

  top_staff           JSONB DEFAULT '[]',
  -- [{ "name": "Maria", "mentions": 8, "positive": 7, "negative": 1 }]

  -- Platform breakdown
  platform_breakdown  JSONB DEFAULT '{}',
  -- { "google": { "count": 45, "avg_rating": 4.2, "flavor_index": 55 },
  --   "opentable": { "count": 30, "avg_rating": 4.5, "flavor_index": 68 },
  --   "tripadvisor": { "count": 12, "avg_rating": 3.8, "flavor_index": 22 } }

  -- Flags
  high_severity_count INTEGER DEFAULT 0,
  return_likely_pct   NUMERIC(5,2),
  return_unlikely_pct NUMERIC(5,2),

  -- Emotion distribution
  emotion_distribution JSONB DEFAULT '{}',
  -- { "delighted": 25, "satisfied": 40, "frustrated": 8, "angry": 2, "neutral": 25 }

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(restaurant_id, period_type, period_start)
);

-- NOTE: Embedding column deferred to Phase 10 — review_intelligence rows are
-- looked up by restaurant_id + period, not by semantic search. Embeddings on
-- review_analyses (per-review) are more useful and are also deferred to Phase 9.

CREATE INDEX idx_review_intelligence_group ON public.review_intelligence(group_id);

CREATE TRIGGER trg_review_intelligence_updated_at
  BEFORE UPDATE ON public.review_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.review_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view intelligence in their group"
  ON public.review_intelligence FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());
```

### Organizational Hierarchy (for multi-unit / corporate views)

```sql
CREATE TABLE public.org_hierarchy (
  id            UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.org_hierarchy(id) ON DELETE SET NULL,
  node_type     TEXT NOT NULL CHECK (node_type IN ('company', 'region', 'unit')),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,

  -- Link to tracked_restaurant for unit nodes
  restaurant_id UUID REFERENCES public.tracked_restaurants(id) ON DELETE SET NULL,

  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

CREATE INDEX idx_org_hierarchy_parent ON public.org_hierarchy(parent_id);
CREATE INDEX idx_org_hierarchy_type ON public.org_hierarchy(group_id, node_type);

CREATE TRIGGER trg_org_hierarchy_updated_at
  BEFORE UPDATE ON public.org_hierarchy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- User-to-hierarchy assignments (links users to their scope)
CREATE TABLE public.org_assignments (
  id            UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_node_id   UUID NOT NULL REFERENCES public.org_hierarchy(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('gm', 'regional_director', 'vp', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, org_node_id)
);

CREATE INDEX idx_org_assignments_user ON public.org_assignments(user_id);

-- RLS (deferred to Phase 8 for hierarchy-based scoping)
ALTER TABLE public.org_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org hierarchy in their group"
  ON public.org_hierarchy FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can manage org hierarchy"
  ON public.org_hierarchy FOR ALL TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own org assignments"
  ON public.org_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage org assignments"
  ON public.org_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

**Example hierarchy:**
```
Alamo Prime (company)
  +-- Texas Region (region)
  |   +-- Austin Downtown (unit) -> tracked_restaurants.id
  |   +-- Austin North (unit) -> tracked_restaurants.id
  |   +-- San Antonio (unit) -> tracked_restaurants.id
  +-- Florida Region (region)
      +-- Miami Beach (unit) -> tracked_restaurants.id
      +-- Orlando (unit) -> tracked_restaurants.id
```

### Helper Functions

```sql
-- Compute Flavor Index for any time range (from daily rollups)
CREATE OR REPLACE FUNCTION public.compute_flavor_index_range(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_reviews BIGINT,
  five_star BIGINT,
  four_star BIGINT,
  low_star BIGINT,
  flavor_index NUMERIC(5,2),
  avg_rating NUMERIC(3,2)
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    SUM(fid.total_reviews),
    SUM(fid.five_star),
    SUM(fid.four_star),
    SUM(fid.one_star + fid.two_star + fid.three_star),
    CASE WHEN SUM(fid.total_reviews) > 0
      THEN ROUND(
        (SUM(fid.five_star)::numeric / SUM(fid.total_reviews)) * 100
        - (SUM(fid.one_star + fid.two_star + fid.three_star)::numeric / SUM(fid.total_reviews)) * 100
      , 2)
      ELSE 0
    END,
    ROUND(AVG(fid.avg_rating), 2)
  FROM public.flavor_index_daily fid
  WHERE fid.restaurant_id = p_restaurant_id
    AND fid.date >= p_start_date
    AND fid.date <= p_end_date;
$$;

-- Get competitor IDs for a given unit
CREATE OR REPLACE FUNCTION public.get_competitor_ids(p_unit_id UUID)
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ARRAY_AGG(id)
  FROM public.tracked_restaurants
  WHERE parent_unit_id = p_unit_id
    AND restaurant_type = 'competitor'
    AND status = 'active';
$$;

-- Aggregate staff mentions for arbitrary date ranges
CREATE OR REPLACE FUNCTION public.aggregate_staff_mentions(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT
      staff->>'name' AS name,
      staff->>'role' AS role,
      COUNT(*) AS mentions,
      COUNT(*) FILTER (WHERE staff->>'sentiment' = 'positive') AS positive,
      COUNT(*) FILTER (WHERE staff->>'sentiment' = 'negative') AS negative
    FROM public.review_analyses ra,
         jsonb_array_elements(ra.staff_mentioned) AS staff
    WHERE ra.restaurant_id = p_restaurant_id
      AND ra.review_date >= p_start_date
      AND ra.review_date <= p_end_date
    GROUP BY staff->>'name', staff->>'role'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;
$$;

-- Aggregate item mentions for arbitrary date ranges
CREATE OR REPLACE FUNCTION public.aggregate_item_mentions(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  FROM (
    SELECT
      item->>'name' AS name,
      item->>'item_type' AS item_type,
      item->>'course_type' AS course_type,
      COUNT(*) AS mentions,
      COUNT(*) FILTER (WHERE item->>'sentiment' = 'positive') AS positive,
      COUNT(*) FILTER (WHERE item->>'sentiment' = 'negative') AS negative,
      ROUND(AVG((item->>'intensity')::numeric), 1) AS avg_intensity
    FROM public.review_analyses ra,
         jsonb_array_elements(ra.items_mentioned) AS item
    WHERE ra.restaurant_id = p_restaurant_id
      AND ra.review_date >= p_start_date
      AND ra.review_date <= p_end_date
    GROUP BY item->>'name', item->>'item_type', item->>'course_type'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;
$$;
```

### Credit Consumption Pipeline (Unified AI Usage Tracking)

The app already has a working rate-limiting system (`usage_counters` + `role_policies` + `get_user_usage()` / `increment_usage()` RPC functions). The review AI module — and all future AI modules — must integrate into this system while adding **per-call audit logging** and **variable credit costs**.

#### Design Principles

1. **Extend, don't replace** — the existing `usage_counters` table remains the source of truth for "can the user ask?" checks
2. **Every AI call is logged** — a new `ai_usage_log` table records every call with domain, action, cost, and token counts
3. **Variable costs** — a `credit_costs` config table maps (domain, action_type) → credit cost, so voice calls or heavy extractions can cost more than a simple text question
4. **Module-agnostic** — the pipeline works for manual AI, product AI, review AI, form AI, and any future module
5. **Backward-compatible** — existing modules that call `increment_usage(_user_id, _group_id)` continue to work (default cost = 1 credit)

#### New Tables

```sql
-- Credit cost configuration (admin-managed)
CREATE TABLE public.credit_costs (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  -- NULL group_id = system-wide default; group-specific rows override

  domain          TEXT NOT NULL,
  -- 'manual', 'dishes', 'wines', 'cocktails', 'recipes', 'beer_liquor',
  -- 'training', 'reviews', 'forms', etc.

  action_type     TEXT NOT NULL DEFAULT 'default',
  -- 'default', 'search', 'action', 'voice', 'extraction', 'weekly_brief', etc.

  credits         INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, domain, action_type)
);

CREATE TRIGGER trg_credit_costs_updated_at
  BEFORE UPDATE ON public.credit_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit costs"
  ON public.credit_costs FOR SELECT TO authenticated
  USING (group_id IS NULL OR group_id = public.get_user_group_id());

CREATE POLICY "Admins can manage credit costs"
  ON public.credit_costs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Default seed data
INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description) VALUES
  (NULL, 'manual',    'default',    1, 'Manual AI chat question'),
  (NULL, 'dishes',    'default',    1, 'Product AI: dishes'),
  (NULL, 'wines',     'default',    1, 'Product AI: wines'),
  (NULL, 'cocktails', 'default',    1, 'Product AI: cocktails'),
  (NULL, 'recipes',   'default',    1, 'Product AI: recipes'),
  (NULL, 'beer_liquor','default',   1, 'Product AI: beer & liquor'),
  (NULL, 'training',  'default',    1, 'Training AI question'),
  (NULL, 'reviews',   'default',    1, 'Review AI chat question'),
  (NULL, 'reviews',   'weekly_brief', 1, 'Review AI weekly brief'),
  (NULL, 'reviews',   'extraction', 0, 'AI review extraction (system, no user credit)'),
  (NULL, 'forms',     'default',    1, 'Form AI question');
```

```sql
-- Per-call audit log (append-only, no updates)
CREATE TABLE public.ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- What was called
  domain          TEXT NOT NULL,
  action          TEXT,               -- 'search', 'action:practicePitch', 'weekly_brief', etc.
  input_mode      TEXT DEFAULT 'text', -- 'text' | 'voice'
  edge_function   TEXT,               -- 'ask', 'ask-product', 'analyze-review', etc.

  -- Cost
  credits_consumed INTEGER NOT NULL DEFAULT 1,

  -- Token tracking (populated when available)
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  model           TEXT,               -- 'gpt-4o-mini', 'text-embedding-3-small', etc.

  -- Context
  session_id      UUID,               -- FK to chat_sessions if applicable
  restaurant_id   UUID,               -- For review AI: which restaurant was queried
  metadata        JSONB DEFAULT '{}', -- Extensible: tool_calls_count, latency_ms, etc.

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX idx_ai_usage_log_user_date
  ON public.ai_usage_log(user_id, created_at);
CREATE INDEX idx_ai_usage_log_group_domain
  ON public.ai_usage_log(group_id, domain, created_at);
CREATE INDEX idx_ai_usage_log_domain_action
  ON public.ai_usage_log(domain, action, created_at);

-- RLS
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage log"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view group usage log"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

-- Service role inserts (edge functions use service role key)
CREATE POLICY "Service can insert usage log"
  ON public.ai_usage_log FOR INSERT TO authenticated
  WITH CHECK (true);
```

#### Modified `increment_usage` Function

The existing `increment_usage` is extended with an optional `_credits` parameter (default 1) and an optional `_log` JSONB parameter for audit logging:

```sql
-- Updated function signature (backward compatible)
CREATE OR REPLACE FUNCTION public.increment_usage(
  _user_id  UUID,
  _group_id UUID,
  _credits  INTEGER DEFAULT 1,
  _log      JSONB DEFAULT NULL
  -- _log: { "domain", "action", "input_mode", "edge_function", "model",
  --         "tokens_input", "tokens_output", "session_id", "restaurant_id", "metadata" }
)
RETURNS TABLE (daily_count INTEGER, monthly_count INTEGER, daily_limit INTEGER, monthly_limit INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment daily counter
  INSERT INTO public.usage_counters (id, user_id, group_id, period_type, period_start, count)
  VALUES (extensions.gen_random_uuid(), _user_id, _group_id, 'daily', CURRENT_DATE, _credits)
  ON CONFLICT (user_id, group_id, period_type, period_start)
  DO UPDATE SET count = usage_counters.count + _credits, updated_at = now();

  -- Increment monthly counter
  INSERT INTO public.usage_counters (id, user_id, group_id, period_type, period_start, count)
  VALUES (extensions.gen_random_uuid(), _user_id, _group_id, 'monthly',
          date_trunc('month', CURRENT_DATE)::DATE, _credits)
  ON CONFLICT (user_id, group_id, period_type, period_start)
  DO UPDATE SET count = usage_counters.count + _credits, updated_at = now();

  -- Log to audit trail (if _log provided)
  IF _log IS NOT NULL THEN
    INSERT INTO public.ai_usage_log (
      user_id, group_id, domain, action, input_mode, edge_function,
      credits_consumed, model, tokens_input, tokens_output,
      session_id, restaurant_id, metadata
    ) VALUES (
      _user_id, _group_id,
      _log->>'domain', _log->>'action', COALESCE(_log->>'input_mode', 'text'),
      _log->>'edge_function', _credits, _log->>'model',
      (_log->>'tokens_input')::INTEGER, (_log->>'tokens_output')::INTEGER,
      (_log->>'session_id')::UUID, (_log->>'restaurant_id')::UUID,
      COALESCE(_log->'metadata', '{}'::JSONB)
    );
  END IF;

  -- Return new counts + limits (must match 4-column return type)
  RETURN QUERY
  SELECT
    (SELECT uc.count FROM public.usage_counters uc
     WHERE uc.user_id = _user_id AND uc.group_id = _group_id
       AND uc.period_type = 'daily' AND uc.period_start = CURRENT_DATE),
    (SELECT uc.count FROM public.usage_counters uc
     WHERE uc.user_id = _user_id AND uc.group_id = _group_id
       AND uc.period_type = 'monthly'
       AND uc.period_start = date_trunc('month', CURRENT_DATE)::DATE),
    COALESCE((SELECT rp.daily_ai_limit FROM public.group_memberships gm
     LEFT JOIN public.role_policies rp ON rp.group_id = gm.group_id AND rp.role = gm.role
     WHERE gm.user_id = _user_id AND gm.group_id = _group_id), 20),
    COALESCE((SELECT rp.monthly_ai_limit FROM public.group_memberships gm
     LEFT JOIN public.role_policies rp ON rp.group_id = gm.group_id AND rp.role = gm.role
     WHERE gm.user_id = _user_id AND gm.group_id = _group_id), 500);
END;
$$;
```

#### Shared Edge Function Helper

```typescript
// supabase/functions/_shared/credit-pipeline.ts

import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

interface CreditLog {
  domain: string;
  action?: string;
  input_mode?: "text" | "voice";
  edge_function: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  session_id?: string;
  restaurant_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Look up the credit cost for a domain + action_type.
 * Falls back: group-specific → system default → 1 credit.
 */
export async function getCreditCost(
  supabase: SupabaseClient,
  groupId: string,
  domain: string,
  actionType: string = "default",
): Promise<number> {
  // Try group-specific first, then system default
  const { data } = await supabase
    .from("credit_costs")
    .select("credits")
    .or(`group_id.eq.${groupId},group_id.is.null`)
    .eq("domain", domain)
    .eq("action_type", actionType)
    .eq("is_active", true)
    .order("group_id", { ascending: false, nullsFirst: false })
    .limit(1);

  return data?.[0]?.credits ?? 1;
}

/**
 * Increment usage with audit logging. Drop-in replacement for bare increment_usage.
 */
export async function trackAndIncrement(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  credits: number,
  log: CreditLog,
): Promise<{ daily_count: number; monthly_count: number }> {
  const { data, error } = await supabase.rpc("increment_usage", {
    _user_id: userId,
    _group_id: groupId,
    _credits: credits,
    _log: log,
  });

  if (error) throw error;
  return data?.[0] ?? { daily_count: 0, monthly_count: 0 };
}
```

#### Integration Flow (All Modules)

```
User asks AI question
  ↓
Edge function extracts: user_id, group_id, domain, action
  ↓
checkUsage(supabase, userId, groupId)     ← existing, unchanged
  ↓ can_ask = true
getCreditCost(supabase, groupId, domain, action)  ← NEW
  ↓ returns: e.g., 1 credit
Process AI request (OpenAI call)
  ↓
trackAndIncrement(supabase, userId, groupId, credits, {
  domain: "reviews",
  action: "weekly_brief",
  edge_function: "ask",
  model: "gpt-4o-mini",
  tokens_input: 1200,
  tokens_output: 450,
  session_id: "...",
  restaurant_id: "..."
})
  ↓
Returns response + updated usage counts to frontend
```

**System-initiated AI calls** (e.g., `analyze-review` extraction) use `credits: 0` and `user_id: NULL` — they're logged for audit/analytics but don't consume user credits.

#### Analytics Queries Enabled by `ai_usage_log`

```sql
-- Credits consumed per domain this month
SELECT domain, SUM(credits_consumed) AS total_credits
FROM ai_usage_log
WHERE group_id = $1 AND created_at >= date_trunc('month', now())
GROUP BY domain ORDER BY total_credits DESC;

-- Most active users
SELECT user_id, COUNT(*) AS calls, SUM(credits_consumed) AS credits
FROM ai_usage_log
WHERE group_id = $1 AND created_at >= date_trunc('month', now())
GROUP BY user_id ORDER BY credits DESC;

-- Token usage by model (for cost forecasting)
SELECT model, SUM(tokens_input) AS total_input, SUM(tokens_output) AS total_output
FROM ai_usage_log
WHERE group_id = $1 AND created_at >= date_trunc('month', now())
GROUP BY model;

-- Review AI specific: which restaurants generate most AI queries
SELECT restaurant_id, COUNT(*) AS queries
FROM ai_usage_log
WHERE domain = 'reviews' AND created_at >= date_trunc('month', now())
GROUP BY restaurant_id ORDER BY queries DESC;
```

---

## Dashboard Design

### Tabbed Mobile-First Layout

The dashboard is split into **tabs** (using the existing `Tabs` component from `@radix-ui/react-tabs` via `src/components/ui/tabs.tsx`) — the same pattern used in `ManagerTrainingDashboard.tsx`. This avoids a single long scroll and keeps sections focused.

**Navigation:** The "Insights" link appears in the sidebar under a new **ANALYTICS** section header, visible only to **managers and admins** (via `RoleGate`). Route: `/reviews`.

```
+---------------------------------------------+
|  Review Insights            [30d|90d|YTD] v |
+---------------------------------------------+
|  [Overview]  [Compete]  [Insights]          |
+---------------------------------------------+

=== Tab 1: Overview ===

  +-------------------------------------+
  |  YOUR FLAVOR INDEX                  |
  |                                     |
  |         +62                         |
  |     ^ +4.3 vs last quarter         |
  |                                     |
  |  ~~~~~~~~~ sparkline ~~~~~~~~~~~~   |
  |                                     |
  |  [==green:Loving==|amber:Fence|red:Not]|
  |  Loving 68%  On the Fence 20%  Not 12%|
  |  Total: 342 reviews (trailing 90d) |
  +-------------------------------------+

  --- Category Breakdown ---

  Food Quality    [==========--]  82%
  Service         [========----]  58%
  Ambience        [=========---]  65%
  Value           [======------]  45%
  (uses existing Progress component)

  --- Alerts ---
  [!] 2 high-severity flags this month
  [View Details ->]

=== Tab 2: Compete ===

  --- Competitor Cards ---
  (horizontal scroll, adapts to 1-4 competitors)

  [You +62 ^] [Rival A +48 v] [Rival B +55 ^] [Rival C +31 -]

  --- Trend ---
  (Line chart: "You" bold by default; tap chip to
   toggle individual competitor lines on/off)

  +-------------------------------------+
  |  _____ You (bold)                   |
  |  [Rival A] [Rival B] [Rival C]     |
  |                                     |
  |  Jan  Feb  Mar  Apr  May  Jun       |
  +-------------------------------------+

=== Tab 3: Insights ===

  --- Top Mentions ---

  Trending Positive
  1. Ribeye Steak        +4.8 (28 mentions)
  2. Margarita           +4.5 (15 mentions)
  3. Truffle Mac         +4.3 (12 mentions)

  Needs Attention
  1. Wait Time           -3.2 (22 mentions)
  2. Noise Level         -2.8 (9 mentions)

  --- Staff Spotlight ---
  Maria (Server)      12 mentions, 92% positive
  Carlos (Bartender)   8 mentions, 88% positive

  --- Emotion Distribution ---
  Delighted 25% | Satisfied 40% | Neutral 25% | Frustrated 8% | Angry 2%
```

### Time Period Selector

A **segmented pill bar** (3 primary options) with a "More" overflow:

**Primary (always visible):** `30d` | `90d` | `YTD`

**Overflow (behind "More" icon):** This Week | This Month | This Quarter | Custom Range

Custom Range opens a bottom sheet (`vaul` Drawer) with dual `Calendar` pickers (both already installed).

All periods compute from `flavor_index_daily` via SQL aggregation — the daily rollup is the only physical storage.

### States

| State | What's Shown |
|-------|-------------|
| **Loading** | `Skeleton` cards for each section (existing component) |
| **Error** | `AlertCircle` with retry button (existing pattern from `ManagerTrainingDashboard`) |
| **Empty (no reviews)** | Onboarding card: "Welcome to Flavor Index" with setup steps (connect profiles, add competitors, wait for first scrape) |
| **Empty (no competitors)** | Dashboard works for own restaurant; Compete tab shows "Add competitors to benchmark" CTA |

### Corporate / Multi-Unit View

Route structure:
- `/reviews` — unit-level dashboard (default for GM)
- `/reviews/corporate` — corporate overview (VP/Corporate)
- `/reviews/region/:regionSlug` — regional rollup
- `/reviews/unit/:unitSlug` — specific unit (from corporate drill-down)

Breadcrumbs for back-navigation (reuse existing `ManualBreadcrumb` pattern):
`Corporate > Texas Region > Austin Downtown`

Corporate view uses a **ranked leaderboard list** (not multi-line chart — too many lines are unreadable on any screen). Tap a row to drill down to unit-level dashboard.

### Visualization Library

**Recharts only** (already installed at `recharts@^2.15.4`) via the existing `ChartContainer`, `ChartTooltip`, and `ChartLegend` shadcn/ui wrappers in `src/components/ui/chart.tsx`.

**No Tremor.** Sparklines are built with a minimal Recharts `<LineChart>` (hidden axes/grids, fixed 40px height). Category bars use the existing `Progress` component. KPI delta badges use the existing `Badge` component with `TrendingUp`/`TrendingDown` Lucide icons.

### Bilingual Support

All dashboard labels, section headers, time period names, empty states, and AI chat prompts need EN/ES variants. Every new component accepts `language: 'en' | 'es'` (matching the existing `useLanguage()` pattern).

---

## AI-Powered Review Intelligence

### Integration: New `domain: "reviews"` in the existing `/ask` function

Rather than a separate `/ask-reviews` edge function, review intelligence is added as a new **domain** in the existing `/ask` function — consistent with how `manual`, `dishes`, `wines`, `cocktails`, `recipes`, `beer_liquor`, and `training` are already handled. This reuses auth, usage limits, session management, and CORS.

**Credit tracking:** Every review AI call flows through the unified credit consumption pipeline. The `/ask` function calls `getCreditCost(supabase, groupId, 'reviews', action)` to determine the cost, then `trackAndIncrement()` to deduct credits and log the call to `ai_usage_log` with domain, action, token counts, and restaurant_id. This enables per-module usage analytics and cost forecasting.

New prompts added to `ai_prompts` table:
- `domain-reviews` — analytical persona and statistical grounding rules
- `tool-map-reviews` — when to use which review tool

### Tool Definitions (6 tools)

All tools accept **`time_range`** and **`restaurant_id`** parameters:

```jsonc
{
  "time_range": {
    "type": "trailing_days" | "month" | "quarter" | "ytd" | "custom",
    "value": "90" | "2026-02" | "2026-Q4" | "" | "2026-01-01:2026-03-31"
  },
  "restaurant_id": "uuid"  // optional; defaults to user's primary unit
}
```

| Tool | What It Queries | Example Question |
|------|----------------|-----------------|
| `get_flavor_index` | `flavor_index_daily` rollup + `emotion_distribution` | "What's our Flavor Index for Q4?" |
| `compare_competitors` | Rollups for unit + competitors, with optional `focus` param (`overall`, `category`, `items`, `staff`) | "How do we compare?" / "What are competitors doing better?" |
| `get_category_trends` | `review_intelligence` summaries + fallback to `review_analyses` aggregation for arbitrary date ranges. Optional `include_trend: boolean` | "Is our service improving?" / "What are our strengths?" |
| `get_top_items` | `aggregate_item_mentions()` PG function | "What dishes are trending?" |
| `get_staff_performance` | `aggregate_staff_mentions()` PG function | "Who's the most mentioned server?" |
| `get_alerts` | High-severity flags from `review_analyses` | "Any urgent issues?" |

**Routing logic for time ranges:** Tools first check `review_intelligence` for exact period matches (fast). For arbitrary date ranges (trailing-N-days, custom), they fall back to the `aggregate_*` PostgreSQL functions that query `review_analyses` directly.

**Tool round cap:** Max 2 rounds (vs. 3 for product AI). First round gathers data, second gathers comparative data if needed. Reduces latency to 2-4 seconds.

**Parallel tool calls:** When the AI calls multiple tools in one round (e.g., `get_flavor_index` + `compare_competitors`), execute with `Promise.all()` instead of sequentially.

### Role-Aware Data Scoping

The system prompt includes the user's hierarchy role and scope:

> "The user is a [GM] responsible for [Austin Downtown]. They can see their own restaurant and its competitors."

Tools automatically filter data to the user's scope:
- **GM:** `restaurant_id` = their unit + `get_competitor_ids(unit_id)`
- **Regional Director:** all units WHERE `org_hierarchy.path` is under their region node
- **VP:** all units company-wide

For Phase 1-7 (before org_hierarchy is fully wired), the system uses the existing `get_user_group_id()` scoping.

### System Prompt Design

The review AI needs a fundamentally different prompt posture than product AI:

```
ROLE: "You are a review analytics advisor for restaurant operators."

DATA GROUNDING: "Your answers must be based entirely on the data returned
by your tools. Cite specific numbers. Never invent statistics."

ANALYTICAL FRAMING: "When identifying patterns, use language like
'the data suggests' or 'correlates with' rather than 'this caused'.
Distinguish between strong signals (high mention count) and weak signals."

ACTIONABILITY: "End every insight with a concrete action the operator can take."

CONTEXT: Include user's role (GM/Regional/VP) and which restaurant(s) they manage.

LANGUAGE: Same bilingual pattern as existing functions.
```

### Citation Format

Review AI citations reference the data source:
```jsonc
{
  "type": "flavor_index" | "category" | "items" | "staff" | "alert",
  "restaurant_id": "uuid",
  "restaurant_name": "Alamo Prime - Austin Downtown",
  "period": "2026-Q4",
  "value": "+62"
}
```

### Action Mode: Weekly Brief

A pre-built action (like `practicePitch` in product AI) that requires no user input:

> **Quick Action:** "What should I focus on this week?"
>
> Fetches the latest `review_intelligence` week row + `flavor_index_daily` for trailing 7 days and generates a formatted brief with the top 3 insights and recommended actions.

### Example AI Conversations

**Trend Analysis:**
> **User:** "Give me the latest trend on the Flavor Index. Are we trending up in the last quarter?"
>
> **AI:** "Your Flavor Index is currently +62, up from +57.7 last quarter — a +4.3 point improvement. You've been on a steady upward trend for 3 consecutive months. Compared to your competitors: Rival A dropped from +52 to +48 (-4 points), Rival B improved from +50 to +55 (+5 points), and Rival C stayed flat at +31. You're leading your competitive set by 7+ points."

**Menu Intelligence:**
> **User:** "What are the dishes trending in my area? Any proteins or cooking styles standing out?"
>
> **AI:** "Across your area (your restaurant + competitors), the most mentioned items in the last 6 months are: 1) Ribeye Steak (68 mentions, 92% positive) — the dominant protein. 2) Grilled Octopus is rising fast — 23 mentions this quarter vs. 8 last quarter, especially at Rival B. 3) Smoked brisket-style preparations are trending across 3 of 4 competitors. Your Truffle Mac & Cheese is your sleeper hit — 12 mentions, all positive, but it's not on your promoted items list."

**Staff Performance:**
> **User:** "Who's the most mentioned server in the last 2 months?"
>
> **AI:** "Maria has been mentioned in 12 reviews in the last 2 months — all positive. Guests highlight her warmth, wine knowledge, and attentiveness. Carlos (bartender) is second with 8 mentions (88% positive). No staff received negative mentions this period."

**Strategic Insights:**
> **User:** "What are my strengths and opportunities? What about competitors?"
>
> **AI:** "**Your Strengths:** Food Quality (avg intensity 4.2/5, mentioned in 78% of positive reviews), Presentation (3.8/5), and specific dishes (Ribeye, Truffle Mac). **Your Opportunities:** Wait Time (mentioned in 35% of negative reviews, up from 22% last quarter), and Value perception (weakest category at 45% positive). **Competitor A Strengths:** Service Speed and Ambience. **Competitor A Opportunities:** Food consistency — their quality variance is 2x yours."

### Questions Designed for Each Role

| Role | High-Value Questions |
|------|---------------------|
| **GM** | What should I focus on this week? Who needs coaching? What's my worst day of the week? |
| **Regional Director** | Which units need attention? What are best practices from top performers? Regional trends? |
| **VP / Corporate** | Company trajectory vs. industry? Which regions are improving/declining? ROI of operational changes? |
| **Owner** | Competitive positioning, market trends, staff ROI, menu engineering opportunities |

---

## Phases (Implementation Order — MVP-First)

### Phase 0 — Apify Validation Spike
> ~0.5 session. Research/validation only.

**Goal:** Validate that the three Apify actors return expected data formats, run within free tier budget, and produce consistent output before committing to the full build.

**Deliverables:**
1. Create Apify free account
2. Run each of the 3 recommended actors once against a real restaurant
3. Verify data format matches the normalization table above
4. Document any field mapping surprises or actor limitations
5. Estimate actual cost per run for the target scenario

**Verification:** All 3 actors return parseable review data with star ratings, text, dates, and reviewer info.

---

### Phase 1 — Database Foundation + Test Data
> ~2 sessions. No frontend, no edge functions.

**Goal:** All core tables, indexes, RLS policies, constraints, triggers, helper functions, and synthetic test data for development.

**Deliverables:**
1. Migration: `review_platform` enum type
2. Migration: `tracked_restaurants` table + RLS + indexes + max-4-competitors trigger
3. Migration: `scrape_runs` table + RLS
4. Migration: `restaurant_reviews` table + RLS + indexes (includes `review_text`, `review_title`, `retry_count`, `last_error`)
5. Migration: `review_analyses` table + RLS + indexes (includes `high_severity_details`)
6. Migration: `flavor_index_daily` table + GENERATED ALWAYS AS + CHECK constraint + RLS
7. Migration: `review_intelligence` table + `platform_breakdown` + RLS
8. Migration: `org_hierarchy` + `org_assignments` tables + RLS (lightweight, for Phase 8)
9. **Migration: Credit consumption pipeline** — `credit_costs` table + `ai_usage_log` table + RLS + indexes + seed data. Updated `increment_usage()` function with `_credits` and `_log` parameters (backward compatible).
10. Helper functions: `compute_flavor_index_range()`, `get_competitor_ids()`, `aggregate_staff_mentions()`, `aggregate_item_mentions()`
11. Seed: Alamo Prime as `own` restaurant with platform URLs
12. **Seed: Synthetic test reviews** — 100+ reviews across 3 platforms, 2 restaurants (own + 1 competitor), 3 months of dates, varied star distributions, sentiments, staff/item mentions. Enables all subsequent phases to be developed and tested independently of Apify.
13. **Shared helper: `_shared/credit-pipeline.ts`** — `getCreditCost()` and `trackAndIncrement()` functions for all edge functions

**Verification:**
- All tables created with RLS enabled and policies applied
- `SELECT * FROM tracked_restaurants` returns seeded Alamo Prime
- Inserting a 5th competitor for the same unit raises exception
- `SELECT * FROM restaurant_reviews` returns synthetic test reviews
- `compute_flavor_index_range()` returns expected values against test data
- `aggregate_staff_mentions()` / `aggregate_item_mentions()` return correct aggregations
- Star-count CHECK constraint prevents inconsistent rollup rows
- `increment_usage(user_id, group_id)` still works with 1-credit default (backward compatible)
- `increment_usage(user_id, group_id, 2, '{"domain":"reviews"}'::jsonb)` logs to `ai_usage_log`
- `credit_costs` table returns correct costs per domain/action_type

**Files created:**
```
supabase/migrations/
  YYYYMMDD_create_review_platform_enum.sql
  YYYYMMDD_create_tracked_restaurants.sql
  YYYYMMDD_create_scrape_runs.sql
  YYYYMMDD_create_restaurant_reviews.sql
  YYYYMMDD_create_review_analyses.sql
  YYYYMMDD_create_flavor_index_daily.sql
  YYYYMMDD_create_review_intelligence.sql
  YYYYMMDD_create_org_hierarchy.sql
  YYYYMMDD_create_credit_pipeline.sql
  YYYYMMDD_create_review_helper_functions.sql
  YYYYMMDD_seed_tracked_restaurants.sql
  YYYYMMDD_seed_synthetic_reviews.sql
supabase/functions/_shared/credit-pipeline.ts
```

---

### Phase 2 — Apify Integration + Historical Backfill
> ~2 sessions. Edge function + Apify configuration. No admin UI (seed data via migration).

**Goal:** Reviews are automatically scraped from 3 platforms on a **daily** schedule and stored normalized in the database. Historical reviews are backfilled for a meaningful baseline.

**Deliverables:**
1. Apify account setup + actor configuration for all 3 platforms
2. **Daily** schedule creation (cron) for each actor — configured for incremental scraping (last 3 days per run)
3. Edge function: `ingest-reviews` — webhook receiver
   - Auth: validates `X-Apify-Webhook-Secret` header (new auth pattern for webhooks)
   - Records run in `scrape_runs` with idempotency check on `apify_run_id`
   - Fetches Apify dataset in paginated batches (resumable on failure)
   - Normalizes and inserts into `restaurant_reviews` with `review_text` populated
   - Uses `ON CONFLICT (platform, platform_review_id) DO UPDATE` for edited reviews (resets `analysis_status` if rating changed)
   - Returns 200 immediately after recording run; processes async
4. **Historical backfill:** Configure initial Apify runs to fetch ALL historical reviews (not just recent). This provides a meaningful Flavor Index baseline from day one.
5. Verification: reviews flowing into DB from all 3 platforms, `scrape_runs` shows completed status

**Files created:**
```
supabase/functions/ingest-reviews/index.ts
```

---

### Phase 3 — Flavor Index Computation & Rollups
> ~1 session. Database functions + edge function. Can run in parallel with Phase 2.

**Goal:** Daily rollup tables are automatically maintained via idempotent upserts. Flavor Index is computable for any time window.

**Deliverables:**
1. Edge function: `compute-rollups` — recomputes `flavor_index_daily` from `restaurant_reviews` star ratings via idempotent `INSERT ... ON CONFLICT DO UPDATE` (not read-modify-write triggers)
2. `compute-rollups` also rebuilds `review_intelligence` period summaries from `review_analyses` when available (gracefully handles missing analyses)
3. Scheduled invocation: **daily** after ingestion + extraction completes (e.g., 4 AM via Supabase cron or Apify schedule chaining)
4. Verification: Insert 100 test reviews with known star distribution. Verify `compute_flavor_index_range()` returns expected value. Verify weekly/monthly/quarterly aggregations match hand-calculated values.

**Files created:**
```
supabase/functions/compute-rollups/index.ts
```

---

### Phase 4a — Minimal Dashboard: KPI + Competitors
> ~2 sessions. Frontend only (reads from DB).

**Goal:** Working Flavor Index dashboard with the headline KPI and competitor comparison — the MVP demo.

**Deliverables:**
1. Dashboard page at `/reviews` with tabbed layout (`Overview` | `Compete` | `Insights`)
2. **Overview tab:** Hero KPI card (Flavor Index score, sparkline, delta badge, star distribution as segmented bar)
3. **Overview tab:** Category breakdown using `Progress` component (food, service, ambience, value) — shows "Coming soon" if no AI extraction data yet
4. **Compete tab:** Competitor cards in horizontal scroll (adapts to 1-4 competitors)
5. **Compete tab:** Trend line chart — "You" bold by default, competitor toggle chips
6. Time period selector: segmented pill bar (`30d` | `90d` | `YTD`) + "More" overflow
7. Data hooks: `useFlavorIndex()`, `useCompetitorComparison()`
8. Loading states (Skeleton), error states (AlertCircle + retry), empty state (onboarding card)
9. Bilingual labels (EN/ES via `useLanguage()`)
10. Navigation: add "Insights" to sidebar under ANALYTICS section header, manager/admin only via `RoleGate`
11. Routes: `/reviews` in `App.tsx`, protected (authenticated + manager/admin)

**Verification:**
- Dashboard renders with test data from Phase 1
- Flavor Index matches expected calculation
- Competitor cards show correct scores
- Time period switching works
- Empty state shows onboarding when no reviews exist
- Mobile-responsive: works on 375px viewport

**Files created:**
```
src/pages/ReviewDashboard.tsx
src/hooks/use-flavor-index.ts
src/hooks/use-competitor-comparison.ts
src/components/reviews/FlavorIndexHero.tsx
src/components/reviews/CompetitorCard.tsx
src/components/reviews/CompetitorGrid.tsx
src/components/reviews/TrendLineChart.tsx
src/components/reviews/CategoryBreakdown.tsx
src/components/reviews/TimePeriodSelector.tsx
src/components/reviews/Sparkline.tsx
src/components/reviews/ReviewOnboarding.tsx
```

---

### Phase 4b — AI Review Extraction Engine
> ~2 sessions. Edge function + background processing.

**Goal:** Every incoming review is processed through the AI extraction engine and structured intelligence is stored.

**Deliverables:**
1. Edge function: `analyze-review` — processes pending reviews through OpenAI gpt-4o-mini
   - Uses OpenAI structured outputs (`response_format: { type: "json_schema" }`) for guaranteed valid JSON
   - Selects `WHERE analysis_status = 'pending' AND retry_count < 3` ordered by `created_at`
   - Processes in batches with 100ms delay between API calls (same pattern as `embed-products`)
   - On success: inserts into `review_analyses`, sets `analysis_status = 'completed'`, NULLs `review_text`
   - On failure: increments `retry_count`, records `last_error`, sets `analysis_status = 'failed'`
   - **Credit pipeline:** Logs each extraction to `ai_usage_log` with `domain: 'reviews'`, `action: 'extraction'`, `credits: 0` (system-initiated, no user credit consumed), `user_id: NULL`
2. AI extraction prompt: defined, versioned, tested against 20+ sample reviews from all 3 platforms. Handles multilingual input natively (extraction in English regardless of review language).
3. Prompt stored in `ai_prompts` table for iteration without redeployment
4. Scheduled invocation: runs after `ingest-reviews`, or on a 15-minute schedule to pick up pending reviews
5. Text cleanup: reviews with `analysis_status = 'completed'` and `analyzed_at > 90 days ago` have `review_text` set to NULL
6. Verification: 100% of test reviews have corresponding `review_analyses` records. Extraction accuracy > 90% on a 20-review test set.

**Files created:**
```
supabase/functions/analyze-review/index.ts
```

---

### Phase 5 — Full Dashboard: Charts, Mentions, Staff, Alerts
> ~2 sessions. Frontend only.

**Goal:** Complete the Insights tab with top mentions, staff spotlight, alerts, and emotion distribution — powered by AI extraction data.

**Deliverables:**
1. **Insights tab:** Top positive/negative mentions list
2. **Insights tab:** Staff spotlight section
3. **Insights tab:** Emotion distribution (segmented bar or donut)
4. **Overview tab:** High-severity alert badge with expandable detail list
5. **Overview tab:** Category breakdown now shows real sentiment data (from `review_intelligence` or `review_analyses`)
6. Data hooks: `useTopMentions()`, `useStaffPerformance()`, `useAlerts()`, `useCategoryBreakdown()`
7. Verification: all sections render correctly with extracted intelligence data

**Files created:**
```
src/hooks/use-top-mentions.ts
src/hooks/use-staff-performance.ts
src/hooks/use-alerts.ts
src/hooks/use-category-breakdown.ts
src/components/reviews/TopMentionsList.tsx
src/components/reviews/StaffSpotlight.tsx
src/components/reviews/AlertBanner.tsx
src/components/reviews/EmotionDistribution.tsx
```

---

### Phase 6 — Admin: Manage Units & Competitors
> ~1.5 sessions. Admin frontend. Can run in parallel with Phase 5.

**Goal:** Admin can add/edit/remove tracked restaurants and competitors, configure scraping, and view ingestion status.

**Deliverables:**
1. Admin page: `/admin/reviews/restaurants` — list of tracked restaurants
2. Add/edit restaurant: name, platform URLs, scrape frequency
3. Add competitors (max 4 per own restaurant): name, platform URLs
4. Scraping status dashboard: last scraped, review count, errors (from `scrape_runs`)
5. Manual scrape trigger button
6. Remove/archive restaurants
7. Pipeline health indicators: extraction queue depth, failed reviews count

**Files created:**
```
src/pages/AdminReviewRestaurants.tsx
src/components/reviews/admin/RestaurantForm.tsx
src/components/reviews/admin/CompetitorForm.tsx
src/components/reviews/admin/ScrapeStatusCard.tsx
src/hooks/use-tracked-restaurants.ts
src/hooks/use-scrape-runs.ts
```

---

### Phase 7 — AI Review Chat
> ~2 sessions. Edge function enhancement + frontend integration.

**Goal:** Users can ask natural-language questions about their review data and get AI-powered insights.

**Deliverables:**
1. Add `domain: "reviews"` to the existing `/ask` edge function with 6 tool definitions
2. DB-driven prompts: `domain-reviews` (analytical persona), `tool-map-reviews` (routing logic)
3. Role-aware data scoping: system prompt includes user's hierarchy role and scope
4. Tool implementations with `time_range` + `restaurant_id` params, `review_intelligence` fast-path + `review_analyses` fallback
5. **Credit pipeline integration:** Replace bare `increment_usage()` call with `trackAndIncrement()` from `_shared/credit-pipeline.ts`. Each review AI question is logged to `ai_usage_log` with `domain: 'reviews'`, action type, restaurant_id, token counts, and session_id. Credit cost looked up from `credit_costs` table.
6. Frontend: AI chat panel on the dashboard (clone `DockedProductAIPanel` / `ProductAIDrawer` pattern)
7. Pre-built quick questions: "What should I focus on this week?", "Compare to competitors", "What dishes are trending?"
8. `weekly_brief` action mode (no user input needed)
9. Max 2 tool rounds, parallel tool execution via `Promise.all()`
10. Verification: all 4 example conversations from this doc produce accurate, grounded responses. Test 5-8 specific questions with expected behaviors. Verify `ai_usage_log` records appear for each AI call.

**Files modified:**
```
supabase/functions/ask/index.ts  (add reviews domain + 6 tools + credit pipeline)
supabase/functions/_shared/usage.ts  (import credit-pipeline helpers)
```

**Files created:**
```
src/hooks/use-ask-reviews.ts
src/components/reviews/DockedReviewAIPanel.tsx
src/components/reviews/ReviewAIDrawer.tsx
src/components/reviews/ReviewQuickActions.tsx
```

---

### Phase 8 — Corporate / Multi-Unit Views
> ~3 sessions. Frontend + RLS enhancements.

**Goal:** Regional Directors and VPs can see aggregated views across multiple units.

**Deliverables:**
1. Org hierarchy setup UI (admin)
2. Regional view (`/reviews/region/:slug`): all units in a region with ranked leaderboard + sparklines
3. Corporate view (`/reviews/corporate`): company-wide metrics, region comparison, top/bottom performers
4. Role-based RLS: create `get_user_org_scope()` function that traverses `org_hierarchy` + `org_assignments` to determine visibility
5. Drill-down: click a unit in corporate view -> breadcrumb navigation to `/reviews/unit/:slug`
6. Cross-unit comparison: small-multiples sparklines per unit (not one chart with 20 lines)

**Files created:**
```
src/pages/ReviewCorporate.tsx
src/pages/ReviewRegion.tsx
src/components/reviews/UnitLeaderboard.tsx
src/components/reviews/RegionComparison.tsx
src/components/reviews/SmallMultiples.tsx
src/hooks/use-org-hierarchy.ts
supabase/migrations/YYYYMMDD_create_org_scope_functions.sql
```

---

### Phase 9 — Main AI Chat Integration
> ~1 session. Edge function + frontend.

**Goal:** "How's our Flavor Index?" works from the main `/ask` chat, not just the dashboard.

**Deliverables:**
1. Add `search_review_intelligence` tool to the main `/ask` tool set (alongside `search_manual`, `search_dishes`, etc.)
2. Intent detection: AI recognizes review-related questions and routes to review tools
3. Response includes link to dashboard for visual detail
4. Verification: "How's our Flavor Index?" from main chat returns accurate score

---

### Phase 10 — Polish & Advanced Features
> ~2-3 sessions. Cross-cutting enhancements.

**Goal:** Production-quality polish, advanced analytics, security audit.

**Deliverables:**
1. **Cuisine trend detection:** Aggregate `items_mentioned.cuisine_type` across all tracked restaurants
2. **Day-of-week analysis:** Correlate review sentiment with day of visit
3. **Review velocity tracking:** Are we getting more or fewer reviews over time?
4. **Automated insights:** Weekly email/notification digest with top 3 insights
5. **Export:** PDF/CSV export of dashboard data
6. **Embedding-powered search:** Add embeddings to `review_analyses` for "Show me reviews similar to [this complaint]"
7. **Security audit:** Webhook endpoint hardening, RLS verification, PII handling review, no exposed service keys
8. **Pipeline monitoring:** Admin widget showing scrape health, extraction queue, stale data alerts

---

## Dependency Graph

```
Phase 0 (Apify Spike)
  |
Phase 1 (DB Foundation + Test Data)
  |
  +---> Phase 2 (Apify + Backfill)     Phase 3 (Rollups)
  |         |                              |
  |         +------> Phase 4b (AI Extraction)
  |                        |
  +---> Phase 4a (Minimal Dashboard -- MVP)
  |         |
  |         +---> Phase 5 (Full Dashboard) <--> Phase 6 (Admin) [parallel]
  |                   |
  |              Phase 7 (AI Chat)
  |                   |
  |              Phase 8 (Corporate)
  |                   |
  |              Phase 9 (Main AI Chat Integration)
  |                   |
  |              Phase 10 (Polish)
```

**MVP path (fastest to working demo, ~7.5 sessions):**
Phase 0 -> Phase 1 -> Phase 2 + Phase 3 (parallel) -> Phase 4a

**Key insight:** The Flavor Index only needs star ratings. Phase 4a (Minimal Dashboard) works without AI extraction (Phase 4b). This gets a working demo 4+ phases before the extraction engine is built.

---

## Technical Patterns (Reuse from Existing Codebase)

| Pattern | Existing Implementation | Reuse For |
|---------|------------------------|-----------|
| Tabbed page layout | `ManagerTrainingDashboard.tsx` (Overview/By Server/Rollouts tabs) | Dashboard tabs (Overview/Compete/Insights) |
| Card + KPI layout | shadcn/ui cards + Tailwind | KPI hero card, competitor cards |
| Progress bars | `src/components/ui/progress.tsx` | Category breakdown bars |
| Badge + trend icons | `src/components/ui/badge.tsx` + Lucide `TrendingUp`/`TrendingDown` | Delta indicators |
| Recharts + shadcn wrapper | `src/components/ui/chart.tsx` (`ChartContainer`, `ChartTooltip`) | Line charts, sparklines |
| Docked AI panel | `DockedProductAIPanel.tsx` + `ProductAIDrawer.tsx` | Review AI chat panel |
| Data hooks + React Query | `useSupabaseDishes()`, etc. | `useFlavorIndex()`, etc. |
| AI domain in `/ask` | `domain: "dishes"`, `domain: "wines"`, etc. | `domain: "reviews"` |
| Edge function auth | `/ask-product` auth pattern | `analyze-review`, `compute-rollups` |
| Webhook auth (new) | N/A — new pattern | `ingest-reviews` (shared secret) |
| RLS role checks | `has_role()`, `get_user_group_id()` | Review data access control |
| Group-scoped multi-tenancy | `group_id` FK pattern on all tables | All review tables |
| Trigger-based timestamps | `set_updated_at()` | All review tables |
| Usage counters | `usage_counters` table + `get_user_usage()` / `increment_usage()` | AI review chat rate limiting |
| Credit consumption pipeline (new) | `credit_costs` + `ai_usage_log` + `_shared/credit-pipeline.ts` | Per-call audit logging, variable credit costs, cross-module analytics |
| Role-gated navigation | `RoleGate` component | Manager/admin-only dashboard access |
| Skeleton loading | `src/components/ui/skeleton.tsx` | Dashboard loading states |
| Bottom sheet | `vaul` Drawer (already installed) | Custom date range picker |
| Calendar picker | `react-day-picker` via `src/components/ui/calendar.tsx` | Custom date range |
| Breadcrumbs | `ManualBreadcrumb` + `src/components/ui/breadcrumb.tsx` | Corporate drill-down navigation |

---

## Apify Configuration Reference

### Recommended Actors

| Platform | Actor | Actor ID | Pricing Model |
|----------|-------|----------|---------------|
| Google Maps | Google Maps Reviews Scraper | `compass/google-maps-reviews-scraper` | ~$0.55 / 1K reviews |
| OpenTable | OpenTable Reviews (Cheerio) | `memo23/opentable-reviews-cheerio` | Compute-based (~$0.30 / 1K) |
| TripAdvisor | Tripadvisor Reviews | `maxcopell/tripadvisor-reviews` | Compute-based |

### Webhook Integration

```
Apify Actor Run Succeeds
  -> POST to https://{SUPABASE_URL}/functions/v1/ingest-reviews
  -> Header: X-Apify-Webhook-Secret: {shared_secret}
  -> Payload: { defaultDatasetId, actorId, eventType, resource: { id: runId } }
  -> Edge function:
     1. Validate shared secret
     2. Check idempotency (scrape_runs.apify_run_id)
     3. Record run in scrape_runs
     4. Fetch dataset items paginated (resume from last_offset on failure)
     5. Normalize and upsert into restaurant_reviews
     6. Update scrape_runs status
     7. Trigger analyze-review (or wait for scheduled batch)
```

---

## Open Questions

### For User Decision

1. **Review text retention window:** Current design uses a 90-day TTL (text NULLed after 90 days post-extraction). Is this sufficient for re-extraction if the prompt improves? Or should text be kept indefinitely in an encrypted column?

2. **Apify account ownership:** Should the Apify account be centralized under the platform, or per-restaurant-group? Default recommendation: centralized for v1.

3. **Competitor selection:** Manual entry of competitor URLs for MVP. Future: "search nearby restaurants" via Google Places API. Is this sequencing acceptable?

4. **Processing mode:** Default recommendation: batch processing (scheduled daily after ingestion). Real-time extraction adds complexity with minimal benefit for daily-scraped data.

5. **Access control for review data:** Default recommendation: manager/admin-only dashboard. Staff do NOT see Flavor Index or competitor data. Confirm?

6. **Historical backfill scope:** On first setup, scrape ALL historical reviews for a meaningful baseline. This may cost more on the first Apify run ($5-10 one-time). Acceptable?

7. **ToS compliance:** Scraping Google, OpenTable, and TripAdvisor reviews has Terms of Service implications. The Apify marketplace actors are maintained by third parties. Should we research official API alternatives or accept the risk?

8. **Multi-language reviews:** Restaurants in diverse markets (e.g., Miami) may receive Spanish, Portuguese, or other language reviews. The AI extraction prompt should handle multilingual input natively. Confirm this approach vs. pre-translating reviews?

9. **Empty state / onboarding:** When a new restaurant has zero reviews, the dashboard shows an onboarding flow guiding setup. Should this be a guided wizard or a simple checklist card?

---

## File Organization

```
docs/plans/Review-Flavor/
  00-feature-overview.md            <- this file
  review-scrape-overview.md         <- existing: AI extraction spec
  01-phase-db-foundation.md
  02-phase-apify-integration.md
  03-phase-rollups.md
  04a-phase-minimal-dashboard.md
  04b-phase-ai-extraction.md
  05-phase-full-dashboard.md
  06-phase-admin-restaurants.md
  07-phase-ai-review-chat.md
  08-phase-corporate-multiunit.md
  09-phase-main-chat-integration.md
  10-phase-polish-advanced.md
```

---

*This document is the living overview for the Review Analyst & Flavor Index feature. Each phase will get its own detailed plan with exact files, migrations, edge functions, and verification steps.*
