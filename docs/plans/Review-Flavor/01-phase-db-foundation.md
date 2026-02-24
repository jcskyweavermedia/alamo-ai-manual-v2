# Phase 1 — Database Foundation + Test Data

> **Status:** Planning
> **Estimated effort:** ~2 sessions
> **Dependencies:** None (first phase after Phase 0 Apify Spike)
> **Reviewed by:** DB Expert, Technical Architect, UX/UI Expert, Devil's Advocate

---

## 1. Scope & Key Decisions

### What's IN Phase 1
- 7 core review tables with RLS, indexes, triggers, and constraints
- Credit consumption pipeline tables (`credit_costs`, `ai_usage_log`) + updated `increment_usage()`
- 4 helper functions (`compute_flavor_index_range`, `get_competitor_ids`, `aggregate_staff_mentions`, `aggregate_item_mentions`)
- Shared edge function helper (`_shared/credit-pipeline.ts`)
- Seed: 5 tracked restaurants (2 own + 3 competitors; 1 own has zero data for empty-state testing)
- Seed: 390 synthetic reviews + analyses + daily rollups

### What's DEFERRED (and why)
| Item | Deferred To | Reason |
|------|------------|--------|
| `org_hierarchy` + `org_assignments` | Phase 8 | No consumer before Phase 8. Schema will evolve once real hierarchy queries are tested. Empty tables with untestable RLS add zero value. |
| `aggregate_staff_mentions()` | ~~Phase 7~~ → **Phase 1** | Moved back: Phase 5 (Full Dashboard) needs these for `useStaffPerformance()` / `useTopMentions()` hooks. Seed data provides 360 analyses with testable JSONB arrays. |
| `aggregate_item_mentions()` | ~~Phase 7~~ → **Phase 1** | Same as above. |
| `review_platform` ENUM type | Removed | Replaced with `TEXT + CHECK` to match codebase pattern (all existing tables use TEXT + CHECK, never enums). Easier to extend when adding Yelp/Facebook. |

### Architecture Decisions

**1. TEXT + CHECK instead of ENUM for platform.**
The entire codebase uses `TEXT NOT NULL CHECK (col IN ('a', 'b', 'c'))` — never `CREATE TYPE ... AS ENUM`. Enums require `ALTER TYPE ADD VALUE` to extend (can't be transactional pre-PG14, confusing for devs). TEXT + CHECK matches project conventions and is trivially extensible.

**2. `GENERATED ALWAYS AS ... STORED` for `flavor_index`.**
Kept because: (a) PostgreSQL 15 supports it correctly, (b) the formula is mathematically simple and unlikely to change fundamentally, (c) it guarantees consistency at the storage level. If the formula does change, the migration path is: `ALTER TABLE DROP COLUMN; ALTER TABLE ADD COLUMN ... GENERATED ALWAYS AS (new_formula) STORED;` — documented below.

**3. Credit pipeline IN Phase 1, not deferred.**
Phase 4b (AI extraction) needs `ai_usage_log` from day one to track system-initiated extractions. The `credit_costs` table + updated `increment_usage()` are backward-compatible (default 1 credit, NULL log = no audit row). Blast radius is mitigated by: (a) wrapping in a transaction, (b) preserving the 4-column return type, (c) using DROP + CREATE (not CREATE OR REPLACE).

**4. 7 consolidated migrations (down from 12).**
The product tables phase used a single migration for 6 tables + 24 RLS policies. We consolidate related tables but keep the credit pipeline separate (different concern, highest-risk migration).

**5. `has_role()` pattern for RLS, not `get_user_role()`.**
The codebase has two patterns: older tables (product tables) use `has_role(auth.uid(), 'admin'::user_role)`, newer tables (form builder, training) use `get_user_role() IN (...)`. Review tables use `has_role()` because write operations are intentionally **admin-only** — review data is more sensitive than training content (competitive intelligence, staff performance signals). Managers may view but should not insert/modify review intelligence directly. This is explicitly documented to prevent pattern confusion.

**6. Migration naming convention.**
Use full `YYYYMMDDHHMMSS` timestamps (not `YYYYMMDD` date-only), matching the form-builder Phase 1 pattern (e.g., `20260225180001_create_tracked_restaurants.sql`).

---

## 2. Migration Plan

### 2.1 Migration Order

| # | File | Tables/Objects | Depends On |
|---|------|---------------|------------|
| M01 | `YYYYMMDDHHMMSS_create_tracked_restaurants.sql` | `tracked_restaurants` + `enforce_max_competitors()` trigger + RLS + indexes | `groups`, `profiles` (existing) |
| M02 | `YYYYMMDDHHMMSS_create_scrape_runs.sql` | `scrape_runs` + RLS | M01 (`tracked_restaurants`) |
| M03 | `YYYYMMDDHHMMSS_create_restaurant_reviews.sql` | `restaurant_reviews` + RLS + indexes | M01 (`tracked_restaurants`) |
| M04 | `YYYYMMDDHHMMSS_create_review_analyses.sql` | `review_analyses` + RLS + indexes | M01, M03 (`tracked_restaurants`, `restaurant_reviews`) |
| M05 | `YYYYMMDDHHMMSS_create_flavor_index_daily.sql` | `flavor_index_daily` + `review_intelligence` + RLS + indexes | M01 (`tracked_restaurants`) |
| M06 | `YYYYMMDDHHMMSS_create_credit_pipeline.sql` | `credit_costs` + `ai_usage_log` + RLS + indexes + updated `increment_usage()` + seed costs | `groups`, `profiles`, `usage_counters` (existing) |
| M07 | `YYYYMMDDHHMMSS_create_review_helper_functions.sql` | `compute_flavor_index_range()` + `get_competitor_ids()` + `aggregate_staff_mentions()` + `aggregate_item_mentions()` | M01, M04, M05 |

Seed migrations (run after schema):

| # | File | Data |
|---|------|------|
| S01 | `YYYYMMDDHHMMSS_seed_tracked_restaurants.sql` | 5 restaurants with deterministic UUIDs (4 data-bearing + 1 empty for onboarding) |
| S02 | `YYYYMMDDHHMMSS_seed_synthetic_reviews.sql` | 390 reviews + 390 analyses + daily rollups + intelligence periods |

**Total: 9 migrations.** No circular dependencies. All FKs follow creation order.

### 2.2 Pre-Flight Checklist

Before running `npx supabase db push`:

```sql
-- Verify current increment_usage signature (will be DROP + CREATE'd in M06)
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'increment_usage' AND pronamespace = 'public'::regnamespace;
-- Expected: '_user_id uuid, _group_id uuid'

-- Verify existing tables we depend on
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('groups', 'profiles', 'group_memberships', 'usage_counters', 'role_policies');
-- Expected: all 5 exist
```

---

## 3. Per-Migration Details

### M01: `create_tracked_restaurants.sql`

```sql
-- Platform type (TEXT + CHECK, not ENUM — matches codebase convention)
-- Platform values used as column-level CHECK on restaurant_reviews.platform

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

  -- Business rules (DB-enforced)
  CONSTRAINT chk_competitor_has_parent
    CHECK (restaurant_type != 'competitor' OR parent_unit_id IS NOT NULL),
  CONSTRAINT chk_own_no_parent
    CHECK (restaurant_type != 'own' OR parent_unit_id IS NULL),

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
          AND id != NEW.id) >= 4 THEN
      RAISE EXCEPTION 'Maximum 4 competitors per restaurant unit';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_max_competitors
  BEFORE INSERT OR UPDATE ON public.tracked_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_competitors();

-- updated_at trigger (reuses existing shared function)
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

**Changes from overview DDL:**
- Added `chk_competitor_has_parent` and `chk_own_no_parent` CHECK constraints (prevents orphaned competitors and self-linked own restaurants)
- Changed `scrape_frequency` default from `'weekly'` to `'daily'`
- Removed COALESCE workaround in trigger (unnecessary — `NEW.id` always has a value)
- No enum type — `platform` is TEXT + CHECK on `restaurant_reviews`

### M02: `create_scrape_runs.sql`

```sql
CREATE TABLE public.scrape_runs (
  id                UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  platform          TEXT NOT NULL CHECK (platform IN ('google', 'opentable', 'tripadvisor')),
  apify_run_id      TEXT,
  apify_dataset_id  TEXT,

  status            TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received', 'processing', 'completed', 'failed')),
  reviews_fetched   INTEGER NOT NULL DEFAULT 0,
  reviews_inserted  INTEGER NOT NULL DEFAULT 0,
  reviews_duplicate INTEGER NOT NULL DEFAULT 0,
  reviews_updated   INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  last_offset       INTEGER DEFAULT 0,  -- for resumable pagination

  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,

  UNIQUE(apify_run_id, platform)  -- idempotency guard (NULLs are distinct)
);

CREATE INDEX idx_scrape_runs_restaurant ON public.scrape_runs(restaurant_id, started_at DESC);

ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view scrape runs"
  ON public.scrape_runs FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can insert scrape runs"
  ON public.scrape_runs FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update scrape runs"
  ON public.scrape_runs FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete scrape runs"
  ON public.scrape_runs FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

**Changes:** Added NOT NULL to count columns. Added INSERT/UPDATE/DELETE RLS policies. Added `idx_scrape_runs_restaurant` index.

### M03: `create_restaurant_reviews.sql`

```sql
CREATE TABLE public.restaurant_reviews (
  id                  UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id       UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Source
  platform            TEXT NOT NULL CHECK (platform IN ('google', 'opentable', 'tripadvisor')),
  platform_review_id  TEXT NOT NULL,

  -- Core review data
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  -- SMALLINT not NUMERIC: all 3 platforms use integer 1-5 stars.
  -- If half-stars needed in future, migrate to NUMERIC(2,1).
  review_date         TIMESTAMPTZ NOT NULL,
  visit_date          DATE,
  reviewer_name       TEXT,
  language            TEXT DEFAULT 'en',

  -- Transient text (NULLed after AI extraction; 90-day TTL for re-extraction)
  review_text         TEXT,
  review_title        TEXT,

  -- Sub-ratings (OpenTable native; others NULL)
  food_rating         SMALLINT CHECK (food_rating IS NULL OR food_rating BETWEEN 1 AND 5),
  service_rating      SMALLINT CHECK (service_rating IS NULL OR service_rating BETWEEN 1 AND 5),
  ambience_rating     SMALLINT CHECK (ambience_rating IS NULL OR ambience_rating BETWEEN 1 AND 5),
  value_rating        SMALLINT CHECK (value_rating IS NULL OR value_rating BETWEEN 1 AND 5),

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

  -- Timestamps
  scraped_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- scraped_at = when Apify fetched it; created_at = when it entered our DB
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(platform, platform_review_id)
);

-- Indexes
CREATE INDEX idx_restaurant_reviews_restaurant_date
  ON public.restaurant_reviews(restaurant_id, review_date);
CREATE INDEX idx_restaurant_reviews_restaurant_rating
  ON public.restaurant_reviews(restaurant_id, rating);
CREATE INDEX idx_restaurant_reviews_group
  ON public.restaurant_reviews(group_id);
CREATE INDEX idx_restaurant_reviews_pending
  ON public.restaurant_reviews(analysis_status)
  WHERE analysis_status IN ('pending', 'processing');

CREATE TRIGGER trg_restaurant_reviews_updated_at
  BEFORE UPDATE ON public.restaurant_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews in their group"
  ON public.restaurant_reviews FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert reviews"
  ON public.restaurant_reviews FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update reviews"
  ON public.restaurant_reviews FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete reviews"
  ON public.restaurant_reviews FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

**Changes from overview:**
- `rating` changed from `NUMERIC(2,1)` to `SMALLINT` — all 3 platforms use integer 1-5 stars. Documented migration path if half-stars are ever needed.
- Sub-ratings also changed to `SMALLINT`.
- Added `idx_restaurant_reviews_restaurant_rating` for star-distribution GROUP BY in rollup computation.
- Added inline comments clarifying `scraped_at` vs `created_at`.

### M04: `create_review_analyses.sql`

```sql
CREATE TABLE public.review_analyses (
  id                UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  review_id         UUID NOT NULL REFERENCES public.restaurant_reviews(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Extracted by AI
  overall_sentiment TEXT NOT NULL CHECK (overall_sentiment IN ('positive', 'neutral', 'negative')),
  emotion           TEXT NOT NULL CHECK (emotion IN ('delighted', 'satisfied', 'frustrated', 'angry', 'neutral')),

  strengths         JSONB NOT NULL DEFAULT '[]',
  -- [{ "category": "Food Quality", "intensity": 4 }, ...]
  -- Valid categories: Food Quality, Service Attitude, Service Speed, Presentation,
  --   Ambience, Cleanliness, Value, Wait Time, Reservation Experience, Management, Other
  -- intensity: 1 (mild mention) to 5 (emphatic/detailed)

  opportunities     JSONB NOT NULL DEFAULT '[]',
  -- [{ "category": "Wait Time", "intensity": 3 }, ...]

  items_mentioned   JSONB NOT NULL DEFAULT '[]',
  -- [{ "name": "Ribeye", "item_type": "food", "course_type": "entree",
  --    "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": 5 }]

  staff_mentioned   JSONB NOT NULL DEFAULT '[]',
  -- [{ "name": "Maria", "role": "server", "sentiment": "positive" }]

  return_intent     TEXT CHECK (return_intent IS NULL OR return_intent IN ('likely', 'unlikely', 'unclear')),
  -- NULL allowed: not all reviews express return intent
  high_severity_flag BOOLEAN NOT NULL DEFAULT false,
  high_severity_details JSONB NOT NULL DEFAULT '[]',
  -- [{ "type": "health_safety", "summary": "Reported food poisoning symptoms" }]

  -- Denormalized for aggregation (set once at insertion, not updated)
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
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
CREATE INDEX idx_review_analyses_severity
  ON public.review_analyses(restaurant_id, review_date)
  WHERE high_severity_flag = true;

-- RLS
ALTER TABLE public.review_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses in their group"
  ON public.review_analyses FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Service can insert analyses"
  ON public.review_analyses FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete analyses"
  ON public.review_analyses FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

**Changes from overview:**
- Fixed `return_intent` CHECK to allow NULL (`CHECK (return_intent IS NULL OR ...)`)
- Added `NOT NULL DEFAULT '[]'` to `high_severity_details` (prevents NULL-vs-empty ambiguity)
- Added partial index `idx_review_analyses_severity` for `get_alerts` AI tool
- `rating` changed to `SMALLINT` (matches `restaurant_reviews`)

### M05: `create_flavor_index_daily.sql`

Contains both `flavor_index_daily` and `review_intelligence` tables.

```sql
-- =============================================
-- flavor_index_daily — Pre-computed daily rollups
-- =============================================

CREATE TABLE public.flavor_index_daily (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,
  date            DATE NOT NULL,

  -- NPS-style star distribution
  total_reviews   INTEGER NOT NULL DEFAULT 0,
  five_star       INTEGER NOT NULL DEFAULT 0,  -- "Loving the Flavor" (Promoters)
  four_star       INTEGER NOT NULL DEFAULT 0,  -- "On the Fence" (Passives)
  three_star      INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)
  two_star        INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)
  one_star        INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)

  -- Consistency guards
  CHECK (five_star + four_star + three_star + two_star + one_star = total_reviews),
  CONSTRAINT chk_counts_non_negative
    CHECK (five_star >= 0 AND four_star >= 0 AND three_star >= 0
           AND two_star >= 0 AND one_star >= 0 AND total_reviews >= 0),

  -- Auto-computed Flavor Index: % Loving the Flavor − % Not Feeling It (-100 to +100)
  -- If the formula changes, migration path: DROP COLUMN + ADD COLUMN with new GENERATED expression
  flavor_index    NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_reviews > 0
      THEN ROUND(
        ((five_star::numeric / total_reviews) * 100)
        - (((one_star + two_star + three_star)::numeric / total_reviews) * 100)
      , 2)
      ELSE 0
    END
  ) STORED,

  -- Average rating
  avg_rating      NUMERIC(3,2),

  -- Category sentiment averages (-1.0 to +1.0, populated after AI extraction)
  -- NULL means "no AI extraction data yet" (frontend shows "Coming soon")
  food_sentiment      NUMERIC(4,3),
  service_sentiment   NUMERIC(4,3),
  ambience_sentiment  NUMERIC(4,3),
  value_sentiment     NUMERIC(4,3),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(restaurant_id, date)
);

CREATE INDEX idx_flavor_daily_group ON public.flavor_index_daily(group_id);

CREATE TRIGGER trg_flavor_daily_updated_at
  BEFORE UPDATE ON public.flavor_index_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.flavor_index_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rollups in their group"
  ON public.flavor_index_daily FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert rollups"
  ON public.flavor_index_daily FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update rollups"
  ON public.flavor_index_daily FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete rollups"
  ON public.flavor_index_daily FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

-- =============================================
-- review_intelligence — Period summaries for AI queries
-- =============================================

CREATE TABLE public.review_intelligence (
  id                  UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id       UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  period_type         TEXT NOT NULL CHECK (period_type IN ('week', 'month', 'quarter')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  CHECK (period_end > period_start),

  total_reviews       INTEGER NOT NULL DEFAULT 0,
  avg_rating          NUMERIC(3,2),
  flavor_index        NUMERIC(5,2),
  flavor_index_change NUMERIC(5,2),

  -- Category sentiments
  food_sentiment      NUMERIC(4,3),
  service_sentiment   NUMERIC(4,3),
  ambience_sentiment  NUMERIC(4,3),
  value_sentiment     NUMERIC(4,3),

  -- Top mentions (JSONB)
  top_positive_items  JSONB NOT NULL DEFAULT '[]',
  -- [{ "item": "Ribeye", "mentions": 12, "avg_sentiment": 0.85 }]

  top_complaints      JSONB NOT NULL DEFAULT '[]',
  -- [{ "item": "wait time", "mentions": 8, "avg_sentiment": -0.72 }]
  -- Renamed from "top_negative_items" — contains both negative items AND complaint categories

  top_strengths       JSONB NOT NULL DEFAULT '[]',
  top_opportunities   JSONB NOT NULL DEFAULT '[]',
  top_staff           JSONB NOT NULL DEFAULT '[]',

  -- Platform breakdown
  platform_breakdown  JSONB NOT NULL DEFAULT '{}',

  -- Flags
  high_severity_count INTEGER DEFAULT 0,
  return_likely_pct   NUMERIC(5,2),
  return_unlikely_pct NUMERIC(5,2),

  -- Emotion distribution
  emotion_distribution JSONB NOT NULL DEFAULT '{}',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(restaurant_id, period_type, period_start)
);

CREATE INDEX idx_review_intelligence_group ON public.review_intelligence(group_id);
CREATE INDEX idx_review_intelligence_lookup
  ON public.review_intelligence(restaurant_id, period_type, period_start DESC);

CREATE TRIGGER trg_review_intelligence_updated_at
  BEFORE UPDATE ON public.review_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.review_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view intelligence in their group"
  ON public.review_intelligence FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert intelligence"
  ON public.review_intelligence FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update intelligence"
  ON public.review_intelligence FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete intelligence"
  ON public.review_intelligence FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

**Changes from overview:**
- Added `chk_counts_non_negative` constraint (prevents negative star counts)
- Added `ROUND(..., 2)` to GENERATED expression
- Renamed `top_negative_items` → `top_complaints` (contains categories + items, not just items)
- Added NOT NULL DEFAULT to all JSONB columns (prevents NULL-vs-empty ambiguity)
- Added `idx_review_intelligence_lookup` with DESC ordering for "get latest period" queries
- Added INSERT/UPDATE RLS policies (overview only had SELECT)

### M06: `create_credit_pipeline.sql`

**This is the highest-risk migration.** It modifies `increment_usage()` which is called by all existing AI edge functions.

```sql
-- NOTE: No explicit BEGIN/COMMIT — supabase db push wraps each migration
-- in its own transaction automatically. Explicit COMMIT would terminate
-- the outer transaction prematurely and break migration tracking.

-- =============================================
-- credit_costs — Configurable per-domain/action costs
-- =============================================

CREATE TABLE public.credit_costs (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  -- NULL group_id = system-wide default; group-specific rows override

  domain          TEXT NOT NULL,
  action_type     TEXT NOT NULL DEFAULT 'default',
  credits         INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, domain, action_type)
);

-- Partial unique index for system defaults (group_id IS NULL)
CREATE UNIQUE INDEX idx_credit_costs_system_default
  ON public.credit_costs(domain, action_type)
  WHERE group_id IS NULL;

CREATE TRIGGER trg_credit_costs_updated_at
  BEFORE UPDATE ON public.credit_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit costs"
  ON public.credit_costs FOR SELECT TO authenticated
  USING (group_id IS NULL OR group_id = public.get_user_group_id());

CREATE POLICY "Admins can manage group credit costs"
  ON public.credit_costs FOR ALL TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
-- NOTE: Admins can only manage their own group's overrides, not system defaults

-- Seed system defaults
INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description) VALUES
  (NULL, 'manual',     'default',     1, 'Manual AI chat question'),
  (NULL, 'dishes',     'default',     1, 'Product AI: dishes'),
  (NULL, 'wines',      'default',     1, 'Product AI: wines'),
  (NULL, 'cocktails',  'default',     1, 'Product AI: cocktails'),
  (NULL, 'recipes',    'default',     1, 'Product AI: recipes'),
  (NULL, 'beer_liquor','default',     1, 'Product AI: beer & liquor'),
  (NULL, 'training',   'default',     1, 'Training AI question'),
  (NULL, 'reviews',    'default',     1, 'Review AI chat question'),
  (NULL, 'reviews',    'weekly_brief',1, 'Review AI weekly brief'),
  (NULL, 'reviews',    'extraction',  0, 'AI review extraction (system, no user credit)'),
  (NULL, 'forms',      'default',     1, 'Form AI question');

-- =============================================
-- ai_usage_log — Per-call audit trail (append-only)
-- =============================================

CREATE TABLE public.ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  domain          TEXT NOT NULL,
  action          TEXT,
  input_mode      TEXT DEFAULT 'text' CHECK (input_mode IS NULL OR input_mode IN ('text', 'voice')),
  edge_function   TEXT,

  credits_consumed INTEGER NOT NULL DEFAULT 1,
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  model           TEXT,

  session_id      UUID,
  restaurant_id   UUID,
  metadata        JSONB DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_user_date ON public.ai_usage_log(user_id, created_at);
CREATE INDEX idx_ai_usage_log_group_domain ON public.ai_usage_log(group_id, domain, created_at);
CREATE INDEX idx_ai_usage_log_domain_action ON public.ai_usage_log(domain, action, created_at);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage log"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND group_id = public.get_user_group_id());

CREATE POLICY "Admins can view group usage log"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

-- NOTE: No INSERT/UPDATE/DELETE policies on ai_usage_log.
-- All inserts go through increment_usage() (SECURITY DEFINER) or edge functions (service role).
-- Both bypass RLS. The append-only design prevents data pollution from browser-side calls.

-- =============================================
-- Updated increment_usage() — backward compatible
-- =============================================
-- CRITICAL: DROP + CREATE required because adding parameters creates an overload,
-- not a replacement. The old 2-param signature must be removed first.

DROP FUNCTION IF EXISTS public.increment_usage(UUID, UUID);

CREATE OR REPLACE FUNCTION public.increment_usage(
  _user_id  UUID,
  _group_id UUID,
  _credits  INTEGER DEFAULT 1,
  _log      JSONB DEFAULT NULL
)
RETURNS TABLE (
  daily_count INTEGER,
  monthly_count INTEGER,
  daily_limit INTEGER,
  monthly_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily INTEGER;
  v_monthly INTEGER;
  v_daily_limit INTEGER;
  v_monthly_limit INTEGER;
BEGIN
  -- SECURITY: Authenticated users can only increment their own usage.
  -- Service role (edge functions) can increment any user.
  -- System-initiated calls (e.g., analyze-review) pass _user_id = NULL.
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot increment usage for another user';
  END IF;

  -- Increment counters (skip for system-initiated calls where _user_id is NULL)
  IF _user_id IS NOT NULL THEN
    -- Increment daily counter (RETURNING preserves atomicity vs separate SELECT)
    INSERT INTO public.usage_counters (user_id, group_id, period_type, period_start, count)
    VALUES (_user_id, _group_id, 'daily', CURRENT_DATE, _credits)
    ON CONFLICT (user_id, group_id, period_type, period_start)
    DO UPDATE SET count = usage_counters.count + _credits, updated_at = now()
    RETURNING count INTO v_daily;

    -- Increment monthly counter
    INSERT INTO public.usage_counters (user_id, group_id, period_type, period_start, count)
    VALUES (_user_id, _group_id, 'monthly',
            date_trunc('month', CURRENT_DATE)::DATE, _credits)
    ON CONFLICT (user_id, group_id, period_type, period_start)
    DO UPDATE SET count = usage_counters.count + _credits, updated_at = now()
    RETURNING count INTO v_monthly;
  END IF;

  -- Log to audit trail (if _log provided)
  IF _log IS NOT NULL THEN
    INSERT INTO public.ai_usage_log (
      user_id, group_id, domain, action, input_mode, edge_function,
      credits_consumed, model, tokens_input, tokens_output,
      session_id, restaurant_id, metadata
    ) VALUES (
      _user_id, _group_id,
      _log->>'domain',
      _log->>'action',
      COALESCE(_log->>'input_mode', 'text'),
      _log->>'edge_function',
      _credits,
      _log->>'model',
      (_log->>'tokens_input')::INTEGER,
      (_log->>'tokens_output')::INTEGER,
      CASE WHEN _log->>'session_id' IS NOT NULL AND _log->>'session_id' != ''
        THEN (_log->>'session_id')::UUID ELSE NULL END,
      CASE WHEN _log->>'restaurant_id' IS NOT NULL AND _log->>'restaurant_id' != ''
        THEN (_log->>'restaurant_id')::UUID ELSE NULL END,
      COALESCE(_log->'metadata', '{}'::JSONB)
    );
  END IF;

  -- Get limits from role_policies (skip for system calls)
  IF _user_id IS NOT NULL THEN
    SELECT COALESCE(rp.daily_ai_limit, 20), COALESCE(rp.monthly_ai_limit, 500)
    INTO v_daily_limit, v_monthly_limit
    FROM public.group_memberships gm
    LEFT JOIN public.role_policies rp ON rp.group_id = gm.group_id AND rp.role = gm.role
    WHERE gm.user_id = _user_id AND gm.group_id = _group_id;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_daily, 0),
    COALESCE(v_monthly, 0),
    COALESCE(v_daily_limit, 20),
    COALESCE(v_monthly_limit, 500);
END;
$$;
```

**Critical safety measures:**
- `supabase db push` wraps each migration in its own transaction — no explicit `BEGIN/COMMIT` needed (would conflict)
- `DROP FUNCTION IF EXISTS` with exact old signature before `CREATE`
- Returns same 4-column type (`daily_count, monthly_count, daily_limit, monthly_limit`) as the old function
- New params have defaults (`_credits = 1`, `_log = NULL`) — existing callers pass 2 args and get identical behavior
- **Auth guard:** `auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid()` prevents authenticated users from incrementing others' usage. Service role (edge functions) bypasses this check since `auth.uid()` is NULL.
- **NULL _user_id guard:** System-initiated calls (e.g., `analyze-review` with `user_id = NULL`) skip the `usage_counters` INSERT (which requires NOT NULL user_id) and only log to `ai_usage_log`
- Uses `RETURNING count INTO` (matching existing function) for atomic count capture
- UUID casts guarded with `CASE WHEN ... != ''` to prevent empty-string crashes
- `ai_usage_log` has NO client-side INSERT policy — all inserts go through this SECURITY DEFINER function or service role

### M07: `create_review_helper_functions.sql`

```sql
-- Compute Flavor Index for any time range (from daily rollups)
-- NOTE: No SECURITY DEFINER — runs as the calling user, so RLS on
-- flavor_index_daily enforces group_id scoping automatically.
-- Edge functions use service role (bypasses RLS anyway).
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
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(fid.total_reviews), 0),
    COALESCE(SUM(fid.five_star), 0),
    COALESCE(SUM(fid.four_star), 0),
    COALESCE(SUM(fid.one_star + fid.two_star + fid.three_star), 0),
    CASE WHEN SUM(fid.total_reviews) > 0
      THEN ROUND(
        (SUM(fid.five_star)::numeric / SUM(fid.total_reviews)) * 100
        - (SUM(fid.one_star + fid.two_star + fid.three_star)::numeric / SUM(fid.total_reviews)) * 100
      , 2)
      ELSE 0
    END,
    -- Weighted average (not average-of-averages)
    CASE WHEN SUM(fid.total_reviews) > 0
      THEN ROUND(
        (SUM(fid.one_star * 1.0 + fid.two_star * 2.0 + fid.three_star * 3.0
           + fid.four_star * 4.0 + fid.five_star * 5.0)
         / SUM(fid.total_reviews))
      , 2)
      ELSE NULL
    END
  FROM public.flavor_index_daily fid
  WHERE fid.restaurant_id = p_restaurant_id
    AND fid.date >= p_start_date
    AND fid.date <= p_end_date;
$$;

-- Get competitor IDs for a given unit
-- NOTE: No SECURITY DEFINER — RLS on tracked_restaurants handles group scoping.
CREATE OR REPLACE FUNCTION public.get_competitor_ids(p_unit_id UUID)
RETURNS UUID[]
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(id), '{}')
  FROM public.tracked_restaurants
  WHERE parent_unit_id = p_unit_id
    AND restaurant_type = 'competitor'
    AND status = 'active';
$$;

-- Aggregate staff mentions for arbitrary date ranges
-- Moved from Phase 7 → Phase 1: Phase 5 (Full Dashboard) needs this
-- for useStaffPerformance() hook. Seed data has 360 analyses with
-- populated staff_mentioned JSONB arrays.
CREATE OR REPLACE FUNCTION public.aggregate_staff_mentions(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public
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
      AND ra.review_date::date >= p_start_date
      AND ra.review_date::date <= p_end_date
    GROUP BY staff->>'name', staff->>'role'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;
$$;

-- Aggregate item mentions for arbitrary date ranges
-- Moved from Phase 7 → Phase 1: Phase 5 (Full Dashboard) needs this
-- for useTopMentions() hook.
CREATE OR REPLACE FUNCTION public.aggregate_item_mentions(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public
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
      AND ra.review_date::date >= p_start_date
      AND ra.review_date::date <= p_end_date
    GROUP BY item->>'name', item->>'item_type', item->>'course_type'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;
$$;
```

**Changes from overview:**
- `avg_rating` uses **weighted average** (star × count / total), not average-of-averages
- Added `COALESCE` wrappers to prevent NULL returns when no data exists
- `get_competitor_ids` returns `'{}'` instead of NULL when no competitors exist
- `avg_rating` returns NULL (not 0.00) when no reviews — a rating of 0.00 is misleading
- **Removed `SECURITY DEFINER`** from `compute_flavor_index_range()` and `get_competitor_ids()` — RLS on the underlying tables handles group scoping. SECURITY DEFINER would allow cross-group data access via browser-side RPC calls. Edge functions use service role (bypasses RLS) so they're unaffected.
- **Added `aggregate_staff_mentions()` and `aggregate_item_mentions()`** — moved from Phase 7 to Phase 1. Uses `ra.review_date::date` cast for correct DATE boundary comparisons (TIMESTAMPTZ `<=` DATE would miss end-of-day reviews).
- Aggregate functions also omit `SECURITY DEFINER` — RLS on `review_analyses` handles scoping.

---

## 4. Seed Data Strategy

### 4.1 Tracked Restaurants

5 restaurants (2 own + 3 competitors), all Texas-based steakhouses:

| Type | Name | Slug | Deterministic UUID | Platforms |
|------|------|------|--------------------|-----------|
| `own` | Alamo Prime Steakhouse | `alamo-prime-austin` | `11111111-...-111111111111` | Google, OpenTable, TripAdvisor |
| `competitor` | Longhorn & Ember | `longhorn-ember` | `22222222-...-222222222222` | Google, OpenTable, TripAdvisor |
| `competitor` | Salt & Sear Chophouse | `salt-sear-chophouse` | `33333333-...-333333333333` | Google, OpenTable, TripAdvisor |
| `competitor` | Mesquite Flame Grill | `mesquite-flame-grill` | `44444444-...-444444444444` | Google, TripAdvisor (NO OpenTable) |
| `own` | Alamo Prime - Westside | `alamo-prime-westside` | `55555555-...-555555555555` | — (scrape not yet configured) |

Deterministic UUIDs enable FK references in subsequent seed data.

**Alamo Prime - Westside** has `scrape_enabled = false`, zero reviews, zero rollups, and zero analyses. It exists solely to test the **onboarding/empty state** in Phase 4a (the "Welcome to Flavor Index" card with setup steps).

### 4.2 Engineered Star Distributions

Each restaurant produces a specific Flavor Index testing a distinct visual state:

| Restaurant | Reviews | 5★ | 4★ | 3★ | 2★ | 1★ | FI | Zone | Color |
|-----------|---------|-----|-----|-----|-----|-----|--------|------|-------|
| Alamo Prime | 150 | 123 (82.0%) | 17 (11.3%) | 5 (3.3%) | 3 (2.0%) | 2 (1.3%) | **+75.33** | World-Class | `#10B981` |
| Longhorn & Ember | 100 | 67 (67.0%) | 14 (14.0%) | 8 (8.0%) | 7 (7.0%) | 4 (4.0%) | **+48.00** | Great | `#84CC16` |
| Salt & Sear | 80 | 43 (53.8%) | 14 (17.5%) | 10 (12.5%) | 8 (10.0%) | 5 (6.3%) | **+25.00** | Good | `#F59E0B` |
| Mesquite Flame | 60 | 22 (36.7%) | 13 (21.7%) | 10 (16.7%) | 9 (15.0%) | 6 (10.0%) | **-5.00** | Needs Improvement | `#EF4444` |
| Alamo Westside | 0 | — | — | — | — | — | — | Empty (onboarding) | — |

**Total: 390 reviews across 4 data-bearing restaurants.** Now covers **4 of 5 color zones** (World-Class, Great, Good, Needs Improvement). The "Excellent" zone (+51 to +70) can be tested via Alamo Prime's December-only data subset (lower FI before Jan-Feb upswing). Alamo Prime - Westside has zero data for onboarding/empty state testing.

### 4.3 Date Distribution

- **Span:** December 1, 2025 → February 20, 2026 (82 days)
- **Alamo Prime volume trend:** Dec=45, Jan=50, Feb=55 (upward → positive delta badge). December subset has a lower FI (~+60, Excellent zone) enabling "Excellent" color zone testing via single-month queries.
- **Longhorn & Ember:** Dec=35, Jan=33, Feb=32 (slight decline → negative delta)
- **Salt & Sear:** Dec=25, Jan=27, Feb=28 (stable)
- **Mesquite Flame:** Dec=22, Jan=20, Feb=18 (declining)
- **Weekend weighting:** 35% Fri-Sat-Sun, 65% Mon-Thu
- **Timestamps:** Vary between 10:00-22:00 (realistic dining hours)

### 4.4 Staff & Item Mentions

**Staff (Alamo Prime):** Maria Garcia (server, 14 mentions, 93% pos), Carlos Reyes (bartender, 10, 90%), Jake Thompson (server, 7, 86%), Sofia Martinez (host, 5, 100%), David Chen (manager, 4, 75%).

**Menu items (Alamo Prime):** Bone-In Ribeye (28 mentions, 92% pos), Truffle Mac & Cheese (15, 93%), Classic Margarita (12, 83%), Grilled Caesar Salad (10, 80%), Creme Brulee (8, 88%).

**Complaint categories:** Wait Time (22 neg), Noise Level (9), Value/Price (8), Service Speed (6), Parking (4).

### 4.5 Analysis Status Mix

- 360 reviews: `analysis_status = 'completed'`, `review_text = NULL`
- 20 reviews: `analysis_status = 'pending'`, `review_text` populated (for Phase 4b testing)
- 10 reviews: `analysis_status = 'failed'`, `retry_count = 3`, `last_error` populated

### 4.6 Daily Rollup Sentiment Strategy

- **December `flavor_index_daily` rows:** sentiment columns (`food_sentiment`, etc.) = **NULL** — simulates "AI extraction not yet available"
- **January rows:** populated with values trending toward targets
- **February rows:** populated with final target values
- This enables frontend developers to test the "partially populated" state

### 4.7 High-Severity Flags

4 total: 2 for Alamo Prime (matches wireframe "2 flags this month"), 2 for Mesquite Flame. Zero for Longhorn & Ember and Salt & Sear (tests empty alert state).

### 4.8 Seed Data Cleanup

Seed data is distinguishable by deterministic UUIDs (`11111111-...`, `22222222-...`, etc.) and by `created_by = NULL` on tracked_restaurants. Before go-live, run:
```sql
DELETE FROM tracked_restaurants WHERE id IN ('11111111-...', '22222222-...', '33333333-...', '44444444-...', '55555555-...');
-- CASCADE will clean up all child reviews, analyses, rollups
```

---

## 5. `_shared/credit-pipeline.ts`

```typescript
// supabase/functions/_shared/credit-pipeline.ts

import type { SupabaseClient } from "./supabase.ts";

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
  try {
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
  } catch (err) {
    console.error("[credit-pipeline] getCreditCost error:", err);
    return 1; // safe fallback — usage tracking should never block AI response
  }
}

interface UsageResult {
  daily_count: number;
  monthly_count: number;
  daily_limit: number;
  monthly_limit: number;
}

/**
 * Increment usage with audit logging. Drop-in enhancement for bare increment_usage.
 * Returns all 4 fields (counts + limits) to match the PG function's return type.
 * Swallows errors — usage tracking should never block the AI response.
 */
export async function trackAndIncrement(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  credits: number,
  log: CreditLog,
): Promise<UsageResult> {
  try {
    const { data, error } = await supabase.rpc("increment_usage", {
      _user_id: userId,
      _group_id: groupId,
      _credits: credits,
      _log: log,
    });

    if (error) {
      console.error("[credit-pipeline] increment_usage error:", error.message);
      return { daily_count: 0, monthly_count: 0, daily_limit: 20, monthly_limit: 500 };
    }
    return data?.[0] ?? { daily_count: 0, monthly_count: 0, daily_limit: 20, monthly_limit: 500 };
  } catch (err) {
    console.error("[credit-pipeline] unexpected error:", err);
    return { daily_count: 0, monthly_count: 0, daily_limit: 20, monthly_limit: 500 };
  }
}
```

**Design notes:**
- Imports from local `./supabase.ts` (not JSR — matches codebase convention)
- Uses `try/catch` (not `.catch()`) per known `PostgrestFilterBuilder` limitation
- `trackAndIncrement` swallows errors and returns zero counts — usage tracking is post-response and must never block the AI answer
- Existing edge functions continue calling `increment_usage` via RPC with 2 args — no changes needed until they opt in to audit logging

---

## 6. Bilingual Label Updates

The UX review identified three problematic Spanish translations in the overview:

| EN | Current ES | Issue | Fixed ES |
|----|-----------|-------|----------|
| On the Fence | En la Cerca | Literal translation of physical fence, not idiomatic | **Indecisos** (undecided, natural) |
| Not Feeling It | No lo Sienten | Third-person plural, stiff | **Sin Sabor** (without flavor, on-brand) |
| Great | Genial | Juvenile/informal in Mexican Spanish restaurant context; closer to "cool!" than professional | **Muy Bueno** (Very Good — natural business Spanish) |

**Action:** Update `00-feature-overview.md` bilingual labels table with these corrections.

---

## 7. Color System (for Phase 4a alignment)

### CSS Variables

Add to `src/index.css` in Phase 4a:

```css
:root {
  --flavor-world-class: 160 84% 39%;      /* #10B981 emerald-500 (CORRECTED from 160 59% 49%) */
  --flavor-excellent: 142 71% 45%;         /* #22C55E green-500 */
  --flavor-great: 84 81% 44%;             /* #84CC16 lime-500 */
  --flavor-good: 38 92% 50%;              /* #F59E0B amber-500 */
  --flavor-needs-improvement: 0 84% 60%;   /* #EF4444 red-500 */
  --flavor-loving: 142 71% 45%;           /* NPS category: green */
  --flavor-fence: 38 92% 50%;             /* NPS category: amber */
  --flavor-not-feeling: 0 84% 60%;        /* NPS category: red */
}
```

### TypeScript Types (created in Phase 4a)

```typescript
// src/types/reviews.ts
export type FlavorScoreZone = 'world-class' | 'excellent' | 'great' | 'good' | 'needs-improvement';
export type FlavorCategory = 'loving' | 'fence' | 'not-feeling';
export type ReviewPlatform = 'google' | 'opentable' | 'tripadvisor';
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type Emotion = 'delighted' | 'satisfied' | 'neutral' | 'frustrated' | 'angry';
```

---

## 8. Verification Plan

Run after all migrations complete. Expected values are based on the exact seed data.

### V01: Schema verification
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('tracked_restaurants', 'scrape_runs', 'restaurant_reviews',
    'review_analyses', 'flavor_index_daily', 'review_intelligence',
    'credit_costs', 'ai_usage_log');
-- Expected: all 8 exist
```

### V02: Restaurant count
```sql
SELECT restaurant_type, count(*) FROM tracked_restaurants
  WHERE group_id = (SELECT id FROM groups WHERE slug = 'alamo-prime')
  GROUP BY restaurant_type;
-- Expected: own=2, competitor=3
```

### V03: Max-4-competitors trigger
```sql
-- Attempt to add a 4th competitor (should succeed)
INSERT INTO tracked_restaurants (group_id, name, slug, restaurant_type, parent_unit_id)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'Test Comp 4', 'test-comp-4', 'competitor', '11111111-1111-1111-1111-111111111111');
-- Should succeed (now 4 competitors)

-- Attempt to add a 5th (should fail)
INSERT INTO tracked_restaurants (group_id, name, slug, restaurant_type, parent_unit_id)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'Test Comp 5', 'test-comp-5', 'competitor', '11111111-1111-1111-1111-111111111111');
-- Expected: ERROR "Maximum 4 competitors per restaurant unit"

-- Cleanup
DELETE FROM tracked_restaurants WHERE slug = 'test-comp-4';
```

### V04: CHECK constraints
```sql
-- Competitor without parent (should fail)
INSERT INTO tracked_restaurants (group_id, name, slug, restaurant_type, parent_unit_id)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'Orphan', 'orphan', 'competitor', NULL);
-- Expected: ERROR violating chk_competitor_has_parent

-- Own with parent (should fail)
INSERT INTO tracked_restaurants (group_id, name, slug, restaurant_type, parent_unit_id)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'Bad Own', 'bad-own', 'own', '11111111-1111-1111-1111-111111111111');
-- Expected: ERROR violating chk_own_no_parent
```

### V05: Review counts
```sql
SELECT tr.name, count(rr.id) FROM restaurant_reviews rr
  JOIN tracked_restaurants tr ON tr.id = rr.restaurant_id
  GROUP BY tr.name ORDER BY count DESC;
-- Expected: Alamo Prime=150, Longhorn & Ember=100, Salt & Sear=80, Mesquite Flame=60
```

### V06: Flavor Index scores
```sql
SELECT tr.name,
  (compute_flavor_index_range(tr.id, '2025-12-01', '2026-02-28')).*
FROM tracked_restaurants tr WHERE tr.restaurant_type = 'own'
  AND tr.slug != 'alamo-prime-westside'  -- exclude empty-state restaurant
UNION ALL
SELECT tr.name,
  (compute_flavor_index_range(tr.id, '2025-12-01', '2026-02-28')).*
FROM tracked_restaurants tr WHERE tr.restaurant_type = 'competitor'
ORDER BY 1;
-- Expected: Alamo Prime = +75.33 (World-Class), Longhorn = +48.00 (Great),
--           Mesquite = -5.00 (Needs Improvement), Salt & Sear = +25.00 (Good)
```

### V07: GENERATED column
```sql
SELECT date, total_reviews, five_star, one_star + two_star + three_star AS low_star, flavor_index
FROM flavor_index_daily
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY date DESC LIMIT 5;
-- Verify flavor_index = (five_star/total * 100) - (low_star/total * 100)
```

### V08: Star-count CHECK
```sql
INSERT INTO flavor_index_daily (group_id, restaurant_id, date,
  total_reviews, five_star, four_star, three_star, two_star, one_star, avg_rating)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  '11111111-1111-1111-1111-111111111111', '2099-12-31',
  10, 5, 5, 5, 0, 0, 4.00);
-- Expected: ERROR (5+5+5+0+0 = 15, but total_reviews = 10)
```

### V09: Credit pipeline backward compatibility
```sql
-- Existing 2-arg call pattern (should work identically to before)
SELECT * FROM increment_usage(
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM groups WHERE slug = 'alamo-prime')
);
-- Expected: returns (daily_count, monthly_count, daily_limit, monthly_limit)
-- ai_usage_log should NOT have a new row (no _log passed)
```

### V10: Credit pipeline with audit logging
```sql
SELECT * FROM increment_usage(
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM groups WHERE slug = 'alamo-prime'),
  1,
  '{"domain": "reviews", "action": "test", "edge_function": "test"}'::jsonb
);
-- Expected: returns (daily_count, monthly_count, daily_limit, monthly_limit)

SELECT domain, action, credits_consumed FROM ai_usage_log ORDER BY created_at DESC LIMIT 1;
-- Expected: domain='reviews', action='test', credits_consumed=1
```

### V11: Staff mentions (Alamo Prime)
```sql
SELECT staff->>'name' AS name, count(*)
FROM review_analyses,
     jsonb_array_elements(staff_mentioned) AS staff
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY staff->>'name' ORDER BY count DESC LIMIT 5;
-- Expected: Maria Garcia=14, Carlos Reyes=10, Jake Thompson=7, Sofia Martinez=5, David Chen=4
```

### V12: High-severity flags
```sql
SELECT tr.name, count(*) FROM review_analyses ra
  JOIN tracked_restaurants tr ON tr.id = ra.restaurant_id
  WHERE ra.high_severity_flag = true GROUP BY tr.name;
-- Expected: Alamo Prime=2, Mesquite Flame=2
```

---

## 9. Risk Assessment

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | `increment_usage()` DROP+CREATE breaks existing AI | **HIGH** | `supabase db push` wraps each migration in a transaction; preserves 4-column return; defaults match old behavior; pre-flight signature check; auth guard prevents misuse |
| R2 | Migration fails partway through 9 files | MEDIUM | Each migration is independent (no cross-migration dependencies after creation). Failed migration can be fixed with a subsequent migration. `supabase db push` runs each file in its own transaction. |
| R3 | Seed data persists to production | MEDIUM | Deterministic UUIDs make cleanup trivial (`DELETE FROM tracked_restaurants WHERE id IN (...)`). Document cleanup step in go-live checklist. |
| R4 | `GENERATED ALWAYS AS` locks formula | LOW | Documented migration path (DROP + ADD column). Formula is simple and NPS-standard. Unlikely to change fundamentally. |
| R5 | `NUMERIC(2,1)` → `SMALLINT` change for ratings | LOW | All 3 platforms use integer stars. If half-stars needed: `ALTER COLUMN rating TYPE NUMERIC(2,1)`. |
| R6 | 390 synthetic reviews don't match Apify output | LOW | Phase 0 validates Apify format. Seed data matches the normalization schema, not raw Apify format. The `ingest-reviews` function (Phase 2) handles normalization. |

### Rollback Strategy

**If M06 (credit pipeline) fails:**
1. `supabase db push` wraps each migration in a transaction — if any statement fails, nothing changes
2. If the new `increment_usage()` has a runtime bug post-deployment: push a fixup migration restoring the old 2-param signature

**If seed data is wrong:**
1. `DELETE FROM tracked_restaurants WHERE id IN ('11111111-...', ...)` cascades to all child data
2. Fix seed SQL and re-push

---

## 10. Files Created

```
supabase/migrations/
  YYYYMMDDHHMMSS_create_tracked_restaurants.sql
  YYYYMMDDHHMMSS_create_scrape_runs.sql
  YYYYMMDDHHMMSS_create_restaurant_reviews.sql
  YYYYMMDDHHMMSS_create_review_analyses.sql
  YYYYMMDDHHMMSS_create_flavor_index_daily.sql     (includes review_intelligence)
  YYYYMMDDHHMMSS_create_credit_pipeline.sql         (HIGHEST RISK — review carefully)
  YYYYMMDDHHMMSS_create_review_helper_functions.sql (includes aggregate functions)
  YYYYMMDDHHMMSS_seed_tracked_restaurants.sql       (5 restaurants: 4 data + 1 empty)
  YYYYMMDDHHMMSS_seed_synthetic_reviews.sql

supabase/functions/_shared/credit-pipeline.ts
```

---

## 11. What This Enables

| Future Phase | What Phase 1 Provides |
|-------------|----------------------|
| Phase 2 (Apify) | `tracked_restaurants` with platform URLs, `scrape_runs` for audit, `restaurant_reviews` for normalized storage |
| Phase 3 (Rollups) | `flavor_index_daily` + `review_intelligence` tables, `compute_flavor_index_range()` function |
| Phase 4a (Dashboard) | 390 reviews of seed data with known Flavor Index scores, sparkline-ready daily rollups, competitor data |
| Phase 4b (AI Extraction) | `review_analyses` table, 20 pending reviews for testing, `credit_costs` with extraction cost = 0 |
| Phase 5 (Full Dashboard) | Pre-seeded `review_analyses` with staff/items/emotions/severity data, `aggregate_staff_mentions()` and `aggregate_item_mentions()` functions ready for hooks |
| Phase 7 (AI Chat) | Credit pipeline for usage tracking, `get_competitor_ids()` for scope queries |
| Phase 8 (Corporate) | `org_hierarchy` created in THIS phase (deferred — will be added then) |

---

*This plan synthesizes reviews from 4 expert agents (DB, Architecture, UX/UI, Devil's Advocate) and incorporates a second-round audit by DB Expert, Technical Architect, UX/UI Expert, and Security/RLS Agent. All critical and important findings from both rounds have been incorporated. The highest-risk item is M06 (credit pipeline) — review that migration with extra care before pushing.*
