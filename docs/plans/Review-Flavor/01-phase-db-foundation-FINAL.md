# Phase 1 — Database Foundation + Test Data (Final Implementation Plan)

> **Status:** Ready for Implementation
> **Estimated effort:** ~2 sessions
> **Dependencies:** None (first phase)
> **Prepared by:** DB Expert, Technical Architect, Backend Developer, UX/UI Expert
> **Audit rounds:** 2 (DB + Architecture + Security/RLS + UX/UI)
> **Last updated:** 2026-02-24

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope & Key Decisions](#2-scope--key-decisions)
3. [Migration Plan](#3-migration-plan)
4. [Per-Migration SQL](#4-per-migration-sql) (M01–M07)
5. [Seed Data](#5-seed-data) (S01–S02)
6. [Edge Function Helper](#6-edge-function-helper) (`credit-pipeline.ts`)
7. [Integration Guide](#7-integration-guide)
8. [Color System & TypeScript Types](#8-color-system--typescript-types)
9. [Bilingual Labels](#9-bilingual-labels)
10. [Phase Dependencies](#10-phase-dependencies)
11. [Risk Assessment](#11-risk-assessment)
12. [Verification Plan](#12-verification-plan) (17 queries)
13. [Seed Data Cleanup](#13-seed-data-cleanup)
14. [Files Created](#14-files-created)

---

## 1. Executive Summary

Phase 1 establishes the complete database foundation for the Review Analyst & Flavor Index system: 7 core tables (tracked restaurants, scrape runs, restaurant reviews, review analyses, daily rollups, period intelligence), a credit consumption pipeline (cost configuration + audit logging + upgraded `increment_usage()`), 4 helper functions for Flavor Index computation, competitor lookup, and JSONB aggregation, plus a shared edge function helper for credit tracking. Seed data provides 5 tracked restaurants (2 own, 3 competitors) and 390 synthetic reviews (368 with completed analyses), daily rollups, and intelligence periods — giving every downstream phase a testable dataset from day one. This phase produces zero frontend code; it is purely schema, functions, seed data, and one TypeScript helper.

**What Phase 1 enables for future phases:** Every subsequent phase — from Apify ingestion (Phase 2) through the AI chat interface (Phase 7) — depends on at least one table or function created here. The credit pipeline is backward-compatible with all existing AI edge functions while enabling per-action cost tracking for the review extraction engine. The seed data covers 4 of 5 Flavor Index color zones and includes empty-state, pending-analysis, and high-severity test cases that Phase 4a/4b developers can build against immediately.

### Key Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| M06 `increment_usage()` DROP+CREATE breaks existing AI functions | **HIGH** | Transaction-wrapped; 4-column return type preserved; new params have defaults; pre-flight signature check |
| Migration fails partway through 9 files | MEDIUM | Each migration runs in its own transaction; no cross-file dependencies after creation order |
| Seed data persists to production | MEDIUM | Deterministic UUIDs (`11111111-...`) make cleanup a single cascading DELETE |
| GENERATED ALWAYS AS locks the Flavor Index formula | LOW | Documented DROP+ADD migration path; formula is NPS-standard and unlikely to change |

---

## 2. Scope & Key Decisions

### What's IN Phase 1

- 7 core tables with RLS, indexes, triggers, and constraints:
  - `tracked_restaurants` — restaurant identity, platform IDs, competitor linking, scrape config
  - `scrape_runs` — Apify run audit trail with idempotency guard
  - `restaurant_reviews` — normalized reviews from all platforms, processing status tracking
  - `review_analyses` — AI-extracted structured signals (sentiment, staff, items, severity)
  - `flavor_index_daily` — pre-computed daily star-distribution rollups with GENERATED flavor_index
  - `review_intelligence` — period summaries (week/month/quarter) for AI chat context
  - `credit_costs` — configurable per-domain/action credit costs with group overrides
  - `ai_usage_log` — append-only per-call audit trail
- Updated `increment_usage()` function (backward-compatible, adds credit amount + audit logging params)
- 4 helper functions: `compute_flavor_index_range()`, `get_competitor_ids()`, `aggregate_staff_mentions()`, `aggregate_item_mentions()`
- Shared edge function helper: `_shared/credit-pipeline.ts`
- Seed: 5 tracked restaurants (2 own + 3 competitors; 1 own has zero data for empty-state testing)
- Seed: 390 synthetic reviews + 368 completed analyses + daily rollups + intelligence periods

### What's DEFERRED (and why)

| Item | Deferred To | Reason |
|------|------------|--------|
| `org_hierarchy` + `org_assignments` | Phase 8 | No consumer before Phase 8. Schema will evolve once real hierarchy queries are tested. Empty tables with untestable RLS add zero value. |
| `review_platform` ENUM type | Removed | Replaced with TEXT + CHECK to match codebase pattern (all existing tables use TEXT + CHECK, never enums). Trivially extensible for Yelp/Facebook. |
| Semantic embeddings on `review_analyses` | Phase 9 | Column exists (`embedding vector(1536)`) but is not populated. No consumer until AI semantic search phase. |
| Frontend types, CSS variables, components | Phase 4a | Phase 1 is schema-only. TypeScript types and color system documented here for Phase 4a alignment. |

### Architecture Decisions

**1. TEXT + CHECK instead of ENUM for platform.**
The entire codebase uses `TEXT NOT NULL CHECK (col IN ('a', 'b', 'c'))` — never `CREATE TYPE ... AS ENUM`. Enums require `ALTER TYPE ADD VALUE` to extend (can't be transactional pre-PG14, confusing for devs). TEXT + CHECK matches project conventions and is trivially extensible.

**2. GENERATED ALWAYS AS ... STORED for `flavor_index`.**
PostgreSQL 15 supports it correctly. The formula is mathematically simple (NPS-standard) and unlikely to change fundamentally. It guarantees consistency at the storage level. If the formula does change, the migration path is: `ALTER TABLE DROP COLUMN; ALTER TABLE ADD COLUMN ... GENERATED ALWAYS AS (new_formula) STORED;`.

**3. Credit pipeline IN Phase 1, not deferred.**
Phase 4b (AI extraction) needs `ai_usage_log` from day one to track system-initiated extractions. The `credit_costs` table + updated `increment_usage()` are backward-compatible (default 1 credit, NULL log = no audit row). Blast radius is mitigated by: (a) wrapping in a transaction, (b) preserving the 4-column return type, (c) using DROP + CREATE (not CREATE OR REPLACE).

**4. 7 consolidated migrations (down from 12).**
The product tables phase used a single migration for 6 tables + 24 RLS policies. We consolidate related tables (e.g., `flavor_index_daily` + `review_intelligence` in M05) but keep the credit pipeline separate (different concern, highest-risk migration).

**5. `has_role()` pattern for RLS, not `get_user_role()`.**
The codebase has two patterns: older tables use `has_role(auth.uid(), 'admin'::user_role)`, newer tables use `get_user_role() IN (...)`. Review tables use `has_role()` because write operations are intentionally **admin-only** — review data is more sensitive than training content (competitive intelligence, staff performance signals). Managers may view but should not insert/modify review intelligence directly.

**6. Migration naming convention.**
Full `YYYYMMDDHHMMSS` timestamps (not date-only), matching the form-builder Phase 1 pattern. Sequential 1-minute intervals starting at `20260224180000`.

---

## 3. Migration Plan

### 3.1 Migration Order

All migrations use the `YYYYMMDDHHMMSS` naming convention. Starting timestamp: `20260224180000` (today, 18:00:00), with 1-minute intervals.

#### Schema Migrations (M01–M07)

| # | Filename | Tables / Objects | Depends On |
|---|----------|-----------------|------------|
| M01 | `20260224180000_create_tracked_restaurants.sql` | `tracked_restaurants` + `enforce_max_competitors()` trigger + `set_updated_at()` trigger + 4 RLS policies + 2 indexes | `groups`, `profiles` (existing) |
| M02 | `20260224180100_create_scrape_runs.sql` | `scrape_runs` + 4 RLS policies + 1 index | M01 (`tracked_restaurants`) |
| M03 | `20260224180200_create_restaurant_reviews.sql` | `restaurant_reviews` + `set_updated_at()` trigger + 4 RLS policies + 4 indexes | M01 (`tracked_restaurants`) |
| M04 | `20260224180300_create_review_analyses.sql` | `review_analyses` + 4 RLS policies + 5 indexes (incl. GIN on JSONB) | M01, M03 (`tracked_restaurants`, `restaurant_reviews`) |
| M05 | `20260224180400_create_flavor_index_daily.sql` | `flavor_index_daily` (with GENERATED `flavor_index`) + `review_intelligence` + `set_updated_at()` triggers + 8 RLS policies + 3 indexes | M01 (`tracked_restaurants`) |
| M06 | `20260224180500_create_credit_pipeline.sql` | `credit_costs` + `ai_usage_log` + updated `increment_usage()` + 11 seed cost rows + 4 RLS policies + 4 indexes | `groups`, `profiles`, `usage_counters` (existing) |
| M07 | `20260224180600_create_review_helper_functions.sql` | `compute_flavor_index_range()` + `get_competitor_ids()` + `aggregate_staff_mentions()` + `aggregate_item_mentions()` | M01, M04, M05 |

#### Seed Migrations (S01–S02)

| # | Filename | Data |
|---|----------|------|
| S01 | `20260224180700_seed_tracked_restaurants.sql` | 5 restaurants with deterministic UUIDs (4 data-bearing + 1 empty for onboarding) |
| S02 | `20260224180800_seed_synthetic_reviews.sql` | 390 reviews + 368 analyses + daily rollups + intelligence periods |

**Total: 9 migrations** (7 schema + 2 seed). No circular dependencies. All FKs follow creation order.

### 3.2 Pre-Flight Checklist

Run these queries before executing `npx supabase db push`:

```sql
-- 1. Verify current increment_usage signature (will be DROP + CREATE'd in M06)
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = 'increment_usage' AND pronamespace = 'public'::regnamespace;
-- Expected: proname='increment_usage', args='_user_id uuid, _group_id uuid'

-- 2. Verify existing tables we depend on
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('groups', 'profiles', 'group_memberships', 'usage_counters', 'role_policies');
-- Expected: all 5 rows returned

-- 3. Verify set_updated_at() function exists (reused by multiple triggers)
SELECT proname FROM pg_proc
WHERE proname = 'set_updated_at' AND pronamespace = 'public'::regnamespace;
-- Expected: 1 row

-- 4. Verify pgvector extension (needed for review_analyses.embedding column)
SELECT extname FROM pg_extension WHERE extname = 'vector';
-- Expected: 1 row

-- 5. Confirm latest migration number (should be 20260224150149 or higher)
SELECT MAX(version) FROM supabase_migrations.schema_migrations;
-- Expected: 20260224150149 (injury_report_instructions) or later
```

---

## 4. Per-Migration SQL

### M01: `20260224180000_create_tracked_restaurants.sql`

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

### M02: `20260224180100_create_scrape_runs.sql`

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

CREATE POLICY "Users can view scrape runs in their group"
  ON public.scrape_runs FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

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

### M03: `20260224180200_create_restaurant_reviews.sql`

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

### M04: `20260224180300_create_review_analyses.sql`

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

CREATE POLICY "Admins can update analyses"
  ON public.review_analyses FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete analyses"
  ON public.review_analyses FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
```

### M05: `20260224180400_create_flavor_index_daily.sql`

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

  -- Auto-computed Flavor Index: % Loving the Flavor - % Not Feeling It (-100 to +100)
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
  food_sentiment      NUMERIC(4,3) CHECK (food_sentiment IS NULL OR food_sentiment BETWEEN -1.0 AND 1.0),
  service_sentiment   NUMERIC(4,3) CHECK (service_sentiment IS NULL OR service_sentiment BETWEEN -1.0 AND 1.0),
  ambience_sentiment  NUMERIC(4,3) CHECK (ambience_sentiment IS NULL OR ambience_sentiment BETWEEN -1.0 AND 1.0),
  value_sentiment     NUMERIC(4,3) CHECK (value_sentiment IS NULL OR value_sentiment BETWEEN -1.0 AND 1.0),

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
  food_sentiment      NUMERIC(4,3) CHECK (food_sentiment IS NULL OR food_sentiment BETWEEN -1.0 AND 1.0),
  service_sentiment   NUMERIC(4,3) CHECK (service_sentiment IS NULL OR service_sentiment BETWEEN -1.0 AND 1.0),
  ambience_sentiment  NUMERIC(4,3) CHECK (ambience_sentiment IS NULL OR ambience_sentiment BETWEEN -1.0 AND 1.0),
  value_sentiment     NUMERIC(4,3) CHECK (value_sentiment IS NULL OR value_sentiment BETWEEN -1.0 AND 1.0),

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

### M06: `20260224180500_create_credit_pipeline.sql`

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
  -- SECURITY: Prevent negative credit manipulation
  IF _credits < 0 THEN
    RAISE EXCEPTION 'Credits must be non-negative';
  END IF;

  -- SECURITY: Authenticated users can only increment their own usage.
  -- Service role (edge functions) can increment any user.
  -- System-initiated calls (e.g., analyze-review) pass _user_id = NULL.
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot increment usage for another user';
  END IF;

  -- SECURITY: Verify user is a member of the specified group
  IF _user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE user_id = _user_id AND group_id = _group_id
    ) THEN
      RAISE EXCEPTION 'User is not a member of the specified group';
    END IF;
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
- `supabase db push` wraps each migration in its own transaction — no explicit `BEGIN/COMMIT` needed
- `DROP FUNCTION IF EXISTS` with exact old signature before `CREATE`
- Returns same 4-column type as the old function
- New params have defaults (`_credits = 1`, `_log = NULL`) — existing 2-arg callers get identical behavior
- **Negative credits guard:** `IF _credits < 0 THEN RAISE EXCEPTION` prevents counter reduction attacks
- **Auth guard:** prevents authenticated users from incrementing others' usage; service role bypasses (auth.uid() = NULL)
- **Group membership validation:** verifies `_user_id` belongs to `_group_id` before incrementing counters
- **NULL _user_id guard:** system-initiated calls skip `usage_counters` INSERT and only log to `ai_usage_log`
- Uses `RETURNING count INTO` for atomic count capture
- UUID casts guarded with `CASE WHEN ... != ''` to prevent empty-string crashes
- `ai_usage_log` has NO client-side INSERT policy — all inserts go through SECURITY DEFINER or service role

### M07: `20260224180600_create_review_helper_functions.sql`

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
-- Moved from Phase 7 to Phase 1: Phase 5 (Full Dashboard) needs this
-- for useStaffPerformance() hook. Uses ::date cast for correct TIMESTAMPTZ boundary comparisons.
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
-- Moved from Phase 7 to Phase 1: Phase 5 (Full Dashboard) needs this
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

---

## 5. Seed Data

### 5.1 S01: Tracked Restaurants (`20260224180700_seed_tracked_restaurants.sql`)

5 restaurants (2 own + 3 competitors), all Texas-based steakhouses with deterministic UUIDs:

| # | Type | Name | Slug | UUID | Platforms |
|---|------|------|------|------|-----------|
| 1 | `own` | Alamo Prime Steakhouse | `alamo-prime-austin` | `11111111-...-111111111111` | Google, OpenTable, TripAdvisor |
| 2 | `competitor` | Longhorn & Ember | `longhorn-ember` | `22222222-...-222222222222` | Google, OpenTable, TripAdvisor |
| 3 | `competitor` | Salt & Sear Chophouse | `salt-sear-chophouse` | `33333333-...-333333333333` | Google, OpenTable, TripAdvisor |
| 4 | `competitor` | Mesquite Flame Grill | `mesquite-flame-grill` | `44444444-...-444444444444` | Google, TripAdvisor (NO OpenTable) |
| 5 | `own` | Alamo Prime - Westside | `alamo-prime-westside` | `55555555-...-555555555555` | None (empty state) |

```sql
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- 1. Alamo Prime Steakhouse (own, primary unit)
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
    true, 'daily', 'active'
  );

  -- 2. Longhorn & Ember (competitor of Alamo Prime Austin)
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
    true, 'daily', 'active'
  );

  -- 3. Salt & Sear Chophouse (competitor of Alamo Prime Austin)
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
    '11111111-1111-1111-1111-111111111111',
    true, 'daily', 'active'
  );

  -- 4. Mesquite Flame Grill (competitor — NO OpenTable, tests platform gap)
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
    '11111111-1111-1111-1111-111111111111',
    true, 'daily', 'active'
  );

  -- 5. Alamo Prime - Westside (own, EMPTY STATE for onboarding testing)
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
    false, 'daily', 'active'
  );

END $$;
```

### 5.2 Engineered Star Distributions

Each restaurant produces a specific Flavor Index testing a distinct visual state:

| Restaurant | Reviews | 5-star | 4-star | 3-star | 2-star | 1-star | FI | Zone | Color |
|-----------|---------|--------|--------|--------|--------|--------|--------|------|-------|
| Alamo Prime | 150 | 123 (82.0%) | 17 (11.3%) | 5 (3.3%) | 3 (2.0%) | 2 (1.3%) | **+75.33** | World-Class | `#10B981` |
| Longhorn & Ember | 100 | 67 (67.0%) | 14 (14.0%) | 8 (8.0%) | 7 (7.0%) | 4 (4.0%) | **+48.00** | Great | `#84CC16` |
| Salt & Sear | 80 | 43 (53.8%) | 14 (17.5%) | 10 (12.5%) | 8 (10.0%) | 5 (6.3%) | **+25.00** | Good | `#F59E0B` |
| Mesquite Flame | 60 | 22 (36.7%) | 13 (21.7%) | 10 (16.7%) | 9 (15.0%) | 6 (10.0%) | **-5.00** | Needs Improvement | `#EF4444` |
| Alamo Westside | 0 | — | — | — | — | — | — | Empty (onboarding) | — |

**FI verification math:**
- Alamo Prime: (123/150)*100 - ((5+3+2)/150)*100 = 82.00 - 6.67 = **+75.33**
- Longhorn: (67/100)*100 - ((8+7+4)/100)*100 = 67.00 - 19.00 = **+48.00**
- Salt & Sear: (43/80)*100 - ((10+8+5)/80)*100 = 53.75 - 28.75 = **+25.00**
- Mesquite: (22/60)*100 - ((10+9+6)/60)*100 = 36.67 - 41.67 = **-5.00**

**Total: 390 reviews.** Covers 4 of 5 color zones. The "Excellent" zone (+51 to +70) is testable via Alamo Prime's December-only data subset.

### 5.3 S02: Synthetic Reviews (`20260224180800_seed_synthetic_reviews.sql`)

S02 is a large `DO $$ ... END $$` block with `generate_series()` and deterministic distribution. Sections below describe the generation patterns.

#### Date Distribution

**Span:** December 1, 2025 to February 20, 2026 (82 days).

| Restaurant | Dec (31 days) | Jan (31 days) | Feb (20 days) | Total |
|---|---|---|---|---|
| Alamo Prime | 57 | 57 | 36 | 150 |
| Longhorn & Ember | 38 | 38 | 24 | 100 |
| Salt & Sear | 31 | 30 | 19 | 80 |
| Mesquite Flame | 23 | 23 | 14 | 60 |

> **Note:** Distribution is determined by integer division: `day = floor((i-1) * 82 / N)`. Reviews are roughly evenly spread across the 82-day window, with a slight front-weighting due to truncation. These exact counts were verified against the formula output.

```sql
-- Star rating assignment via generate_series + CASE (Alamo Prime example):
-- Series index 1..150 maps deterministically:
--   1-123   -> 5 stars (123 reviews)
--   124-140 -> 4 stars (17 reviews)
--   141-145 -> 3 stars (5 reviews)
--   146-148 -> 2 stars (3 reviews)
--   149-150 -> 1 star  (2 reviews)

INSERT INTO public.restaurant_reviews (
  id, group_id, restaurant_id, platform, platform_review_id,
  rating, review_date, reviewer_name, language,
  review_text, analysis_status, scraped_at, created_at
)
SELECT
  extensions.gen_random_uuid(),
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
    'This is a synthetic review for testing. Review #' || i
  ELSE NULL END,
  CASE WHEN i <= 148 THEN 'completed' WHEN i <= 149 THEN 'pending' ELSE 'failed' END,
  now(), now()
FROM generate_series(1, 150) AS i;
```

This pattern is repeated for each of the 4 data-bearing restaurants, adjusting star boundaries and count.

#### Analysis Status Mix

| Status | Count | Breakdown | Characteristics |
|---|---|---|---|
| `completed` | 368 | 148 Alamo + 90 Longhorn + 75 Salt&Sear + 55 Mesquite | `review_text = NULL`, `analyzed_at` populated, full JSONB arrays |
| `pending` | 13 | 1 Alamo + 5 Longhorn + 4 Salt&Sear + 3 Mesquite | `review_text` populated, `retry_count = 0` |
| `failed` | 9 | 1 Alamo + 5 Longhorn + 1 Salt&Sear + 2 Mesquite | `review_text` populated, `retry_count = 3`, `last_error` populated |

#### Staff Mentions (Alamo Prime Only)

| Staff Name | Role | Total Mentions | Positive | Negative |
|---|---|---|---|---|
| Maria Garcia | server | 14 | 13 (93%) | 1 |
| Carlos Reyes | bartender | 10 | 9 (90%) | 0 |
| Jake Thompson | server | 7 | 6 (86%) | 1 |
| Sofia Martinez | host | 5 | 5 (100%) | 0 |
| David Chen | manager | 4 | 3 (75%) | 1 |

JSONB structure: `[{ "name": "Maria Garcia", "role": "server", "sentiment": "positive" }]`

Staff mentions are assigned via sequential index ranges in the first 40 completed analyses (reviews 1-14 = Maria, 15-24 = Carlos, etc.).

#### Item Mentions (Alamo Prime Only)

| Item Name | item_type | course_type | Mentions | Positive | Avg Intensity |
|---|---|---|---|---|---|
| Bone-In Ribeye | food | entree | 28 | 26 (92%) | 4.6 |
| Truffle Mac & Cheese | food | side | 15 | 14 (93%) | 4.2 |
| Classic Margarita | drink | cocktail | 12 | 10 (83%) | 3.8 |
| Grilled Caesar Salad | food | appetizer | 10 | 8 (80%) | 3.5 |
| Creme Brulee | food | dessert | 8 | 7 (88%) | 4.0 |

JSONB structure:
```json
[{
  "name": "Bone-In Ribeye", "item_type": "food", "course_type": "entree",
  "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": 5
}]
```

Item mentions are assigned via sequential index ranges in the first 73 completed analyses.

#### High-Severity Flags

4 total: 2 for Alamo Prime, 2 for Mesquite Flame. Zero for Longhorn & Ember and Salt & Sear (tests empty alert state).

| Restaurant | Flag # | Type | Target Review | Summary |
|---|---|---|---|---|
| Alamo Prime | 1 | `health_safety` | **2-star**, completed (i=148) | Foreign object (plastic wrap) found in salad |
| Alamo Prime | 2 | `staff_conduct` | **3-star**, completed (i=145) | Staff member spoken to rudely, "dismissive" and "condescending" |
| Mesquite Flame | 1 | `health_safety` | 1-star, completed (i=55) | Food poisoning symptoms, undercooked chicken |
| Mesquite Flame | 2 | `legal_threat` | **2-star**, completed (i=54) | Health department contact, "considering legal action" |

> **C1/C3 fix:** Alamo Prime analysis_status boundary extended to i<=148 (was i<=140) so that 3-star and 2-star reviews are `completed`. Flag 1 targets `rating = 2` (last completed 2-star), flag 2 targets `rating = 3` (last completed 3-star). Mesquite flag 2 targets `rating = 2` (not `rating = 1 OFFSET 1`).

#### Daily Rollups (`flavor_index_daily`)

One row per (restaurant, date) pair, computed from seeded reviews:

```sql
INSERT INTO public.flavor_index_daily (
  group_id, restaurant_id, date,
  total_reviews, five_star, four_star, three_star, two_star, one_star,
  avg_rating, food_sentiment, service_sentiment, ambience_sentiment, value_sentiment
)
SELECT
  v_group_id, rr.restaurant_id, rr.review_date::date,
  COUNT(*),
  COUNT(*) FILTER (WHERE rr.rating = 5),
  COUNT(*) FILTER (WHERE rr.rating = 4),
  COUNT(*) FILTER (WHERE rr.rating = 3),
  COUNT(*) FILTER (WHERE rr.rating = 2),
  COUNT(*) FILTER (WHERE rr.rating = 1),
  ROUND(AVG(rr.rating), 2),
  -- December rows: sentiment = NULL (pre-AI-extraction state)
  -- January/February: populated from star distribution
  CASE WHEN rr.review_date::date >= '2026-01-01' THEN
    ROUND(0.4 + (COUNT(*) FILTER (WHERE rr.rating >= 4))::numeric
                / NULLIF(COUNT(*), 0) * 0.5, 3)
  ELSE NULL END,
  -- (same pattern for service_sentiment, ambience_sentiment, value_sentiment)
  ...
FROM public.restaurant_reviews rr
WHERE rr.group_id = v_group_id
GROUP BY rr.restaurant_id, rr.review_date::date
ON CONFLICT (restaurant_id, date) DO UPDATE SET ...;
```

**Key behavior:**
- December rows have NULL sentiment columns (frontend shows "Coming soon" skeleton)
- January/February rows have populated sentiment values
- `flavor_index` column is NOT included in INSERT (GENERATED ALWAYS AS ... STORED)

#### Review Intelligence Periods

4 rows per restaurant (3 monthly + 1 quarterly) = **16 rows total**.

Monthly periods: December 2025, January 2026, February 2026
Quarterly period: Q4 2025 (Oct-Dec)

Each row includes: total_reviews, avg_rating, flavor_index, flavor_index_change, sentiment columns, top_positive_items, top_complaints, top_strengths, top_opportunities, top_staff, platform_breakdown, high_severity_count, return percentages, emotion_distribution.

See `01-phase-seed-and-frontend-prep.md` for complete INSERT SQL with all JSONB values.

### 5.4 Seed Data Counts Summary

| Table | Expected Rows |
|---|---|
| `tracked_restaurants` | 5 |
| `restaurant_reviews` | 390 (150 + 100 + 80 + 60) |
| `review_analyses` | 368 (completed reviews only) |
| `flavor_index_daily` | ~60-70 rows (one per restaurant per active day) |
| `review_intelligence` | 16 (4 restaurants x 4 periods) |
| `scrape_runs` | 0 (no simulated scrape runs) |
| `credit_costs` | 11 (system defaults, seeded in M06) |
| `ai_usage_log` | 0 (populated only by runtime calls) |

---

## 6. Edge Function Helper

### `supabase/functions/_shared/credit-pipeline.ts`

```typescript
/**
 * Credit pipeline helpers for AI usage tracking and audit logging.
 *
 * Phase 1: Created alongside credit_costs + ai_usage_log tables.
 * Phase 7+: Edge functions migrate from bare .rpc("increment_usage") to
 *           trackAndIncrement() for per-call audit logging.
 *
 * IMPORTANT: All functions swallow errors — usage tracking must NEVER
 * block the AI response. Errors are logged to console.error for
 * edge function log inspection.
 */

import type { SupabaseClient } from "./supabase.ts";

// ============================================================================
// Interfaces
// ============================================================================

export interface CreditLog {
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

export interface UsageResult {
  daily_count: number;
  monthly_count: number;
  daily_limit: number;
  monthly_limit: number;
}

// Safe fallback when usage tracking fails — matches role_policies defaults
const FALLBACK_USAGE: UsageResult = {
  daily_count: 0,
  monthly_count: 0,
  daily_limit: 20,
  monthly_limit: 500,
};

// ============================================================================
// getCreditCost
// ============================================================================

/**
 * Look up the credit cost for a domain + action_type.
 * Resolution order: group-specific override -> system default -> 1 credit.
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
    return 1; // safe fallback
  }
}

// ============================================================================
// trackAndIncrement
// ============================================================================

/**
 * Increment usage counters with audit logging.
 * Drop-in enhancement for bare `supabase.rpc("increment_usage", { _user_id, _group_id })`.
 *
 * @param supabase - Service-role client (edge functions always use service role)
 * @param userId  - Authenticated user's UUID, or null for system-initiated calls
 * @param groupId - Group UUID
 * @param credits - Number of credits to consume (from getCreditCost)
 * @param log     - Audit payload written to ai_usage_log
 */
export async function trackAndIncrement(
  supabase: SupabaseClient,
  userId: string | null,
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
      console.error("[credit-pipeline] increment_usage RPC error:", error.message);
      return { ...FALLBACK_USAGE };
    }

    return data?.[0] ?? { ...FALLBACK_USAGE };
  } catch (err) {
    console.error("[credit-pipeline] trackAndIncrement unexpected error:", err);
    return { ...FALLBACK_USAGE };
  }
}
```

**Design notes:**
- Imports from local `./supabase.ts` (not JSR — matches codebase convention)
- Uses `try/catch` (not `.catch()`) per known `PostgrestFilterBuilder` limitation
- `trackAndIncrement` swallows errors — usage tracking must never block the AI response
- Existing edge functions continue calling `increment_usage` via RPC with 2 args unchanged

---

## 7. Integration Guide

### Three Edge Function Auth Patterns

Phase 1 creates the `credit-pipeline.ts` helper but does NOT modify any existing edge functions. When future phases integrate, they follow one of three patterns:

#### Pattern 1: User-Authenticated (JWT) — Existing Functions

Used by: `ask`, `ask-product`, `transcribe` (existing), `ask` with domain "reviews" (Phase 7)

```typescript
// In existing edge functions — NO CHANGES needed in Phase 1.
// Current pattern (continues to work with 2-arg call):
const { data: usage } = await supabase.rpc("increment_usage", {
  _user_id: user.id,
  _group_id: groupId,
});

// Future migration (opt-in, Phase 7+):
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";
const credits = await getCreditCost(supabase, groupId, "reviews", "default");
const usage = await trackAndIncrement(supabase, user.id, groupId, credits, {
  domain: "reviews",
  action: "chat",
  edge_function: "ask",
  model: "gpt-4o-mini",
  tokens_input: response.usage?.prompt_tokens,
  tokens_output: response.usage?.completion_tokens,
});
```

#### Pattern 2: Service-Role (Cron/Background) — analyze-review

Used by: `analyze-review` (Phase 4b), `compute-rollups` (Phase 3)

```typescript
// System-initiated: no user_id, extraction costs 0 credits
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";
const credits = await getCreditCost(supabase, groupId, "reviews", "extraction"); // returns 0
const usage = await trackAndIncrement(supabase, null, groupId, credits, {
  domain: "reviews",
  action: "extraction",
  edge_function: "analyze-review",
  model: "gpt-4o-mini",
  restaurant_id: restaurantId,
});
// userId=null: skips usage_counters, only logs to ai_usage_log
```

#### Pattern 3: Webhook (X-Apify-Webhook-Secret) — ingest-reviews

Used by: `ingest-reviews` (Phase 2)

```typescript
// Webhook: no user, no credits — only audit logging
import { trackAndIncrement } from "../_shared/credit-pipeline.ts";
await trackAndIncrement(supabase, null, groupId, 0, {
  domain: "reviews",
  action: "ingestion",
  edge_function: "ingest-reviews",
  metadata: { apify_run_id: runId, reviews_inserted: count },
});
```

### Phase 1 vs Future Phase Responsibilities

| What | Phase 1 (Now) | Phase 7+ (Future) |
|------|---------------|-------------------|
| `credit_costs` table + seed data | Created | Consumed by `getCreditCost()` |
| `ai_usage_log` table | Created | Receives audit rows via `trackAndIncrement()` |
| `increment_usage()` PG function | Updated (4 params, backward-compatible) | Called via `trackAndIncrement()` |
| `credit-pipeline.ts` helper | Created (opt-in) | Imported by edge functions |
| Existing edge functions | **Unchanged** (2-arg calls continue working) | Migrated to `trackAndIncrement()` |

---

## 8. Color System & TypeScript Types

### 8.1 CSS Variables (add to `src/index.css` in Phase 4a)

```css
:root {
  /* Flavor Index Score Zones */
  --flavor-world-class: 160 84% 39%;         /* #10B981  emerald-500  (+71 to +100) */
  --flavor-excellent: 142 71% 45%;           /* #22C55E  green-500    (+51 to +70)  */
  --flavor-great: 84 81% 44%;               /* #84CC16  lime-500     (+31 to +50)  */
  --flavor-good: 38 92% 50%;                /* #F59E0B  amber-500    (0 to +30)    */
  --flavor-needs-improvement: 0 84% 60%;     /* #EF4444  red-500      (-100 to -1)  */

  /* NPS Category Colors (star-distribution bar) */
  --flavor-loving: 142 71% 45%;              /* green — 5-star "Loving the Flavor"  */
  --flavor-fence: 38 92% 50%;               /* amber — 4-star "On the Fence"       */
  --flavor-not-feeling: 0 84% 60%;           /* red   — 1-3 star "Not Feeling It"   */
}
```

**Audit note:** World-Class was corrected from `160 59% 49%` to `160 84% 39%` (verified: H=160, S=84%, L=39% = RGB(16,185,129) = `#10B981`).

> **Dark mode (Phase 4a):** The existing `src/index.css` uses `.dark` class overrides for all color variables. Phase 4a must add corresponding `.dark { --flavor-*: ... }` overrides with appropriate dark-mode values (lower saturation, adjusted lightness). Test in both themes before shipping.

### 8.2 TypeScript Types (create `src/types/reviews.ts` in Phase 4a)

```typescript
// --- Flavor Index Score Zones ---
export type FlavorScoreZone =
  | 'world-class'       // +71 to +100
  | 'excellent'         // +51 to +70
  | 'great'             // +31 to +50
  | 'good'              // 0 to +30
  | 'needs-improvement' // -100 to -1

// --- NPS-Style Categories ---
export type FlavorCategory = 'loving' | 'fence' | 'not-feeling';

// --- Review Platforms ---
export type ReviewPlatform = 'google' | 'opentable' | 'tripadvisor';

// --- Analysis Pipeline Status ---
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// --- AI-Extracted Emotion ---
export type Emotion = 'delighted' | 'satisfied' | 'neutral' | 'frustrated' | 'angry';

// --- Time Period Selector ---
export type TimePeriod =
  | { type: 'trailing_days'; value: number }
  | { type: 'month'; value: string }
  | { type: 'quarter'; value: string }
  | { type: 'ytd'; value: '' }
  | { type: 'custom'; value: string }

// --- Other Enumerations ---
export type RestaurantType = 'own' | 'competitor';
export type ScrapingFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type RestaurantStatus = 'active' | 'paused' | 'archived';
export type ScrapeRunStatus = 'received' | 'processing' | 'completed' | 'failed';
export type ReturnIntent = 'likely' | 'unlikely' | 'unclear';
export type Sentiment = 'positive' | 'neutral' | 'negative';

// --- Intelligence Period Types ---
export type IntelligencePeriodType = 'week' | 'month' | 'quarter';

// --- High Severity Types ---
export type HighSeverityType = 'health_safety' | 'staff_conduct' | 'legal_threat';
// Phase 4b may extend with: 'discrimination' | 'regulatory_violation' | 'harassment'

// --- JSONB Shape Interfaces ---
export interface StaffMention {
  name: string;
  role: 'server' | 'bartender' | 'host' | 'manager' | 'chef' | 'unknown';
  sentiment: Sentiment;
}

export interface ItemMention {
  name: string;
  item_type: 'food' | 'cocktail' | 'wine' | 'beer' | 'beverage';
  // Note: 'dessert' is a course_type, not an item_type. Use item_type: 'food' + course_type: 'dessert'.
  course_type: 'appetizer' | 'entree' | 'dessert' | 'drink' | 'side' | 'unknown';
  cuisine_type: 'mexican' | 'italian' | 'steakhouse' | 'seafood' | 'latin' | 'american' | 'asian' | 'other' | 'unknown';
  sentiment: Sentiment;
  intensity: 1 | 2 | 3 | 4 | 5;
}

export interface StrengthOpportunity {
  category: 'Food Quality' | 'Service Attitude' | 'Service Speed' | 'Presentation'
    | 'Ambience' | 'Cleanliness' | 'Value' | 'Wait Time' | 'Reservation Experience'
    | 'Management' | 'Other';
  intensity: 1 | 2 | 3 | 4 | 5;
}

export interface HighSeverityDetail {
  type: HighSeverityType;
  summary: string;
}

export interface PlatformBreakdown {
  google?: { count: number; avg_rating: number; flavor_index?: number };
  opentable?: { count: number; avg_rating: number; flavor_index?: number };
  tripadvisor?: { count: number; avg_rating: number; flavor_index?: number };
}

export interface EmotionDistribution {
  delighted?: number;
  satisfied?: number;
  neutral?: number;
  frustrated?: number;
  angry?: number;
}

// --- Flavor Zone Configuration ---
export interface FlavorZoneConfig {
  zone: FlavorScoreZone;
  label: { en: string; es: string };
  cssVar: string;
  hex: string;
  minScore: number;
  maxScore: number;
}

export const FLAVOR_ZONES: FlavorZoneConfig[] = [
  { zone: 'world-class',       label: { en: 'World-Class', es: 'Clase Mundial' },
    cssVar: '--flavor-world-class', hex: '#10B981', minScore: 71, maxScore: 100 },
  { zone: 'excellent',         label: { en: 'Excellent', es: 'Excelente' },
    cssVar: '--flavor-excellent', hex: '#22C55E', minScore: 51, maxScore: 70 },
  { zone: 'great',             label: { en: 'Great', es: 'Muy Bueno' },
    cssVar: '--flavor-great', hex: '#84CC16', minScore: 31, maxScore: 50 },
  { zone: 'good',              label: { en: 'Good', es: 'Bueno' },
    cssVar: '--flavor-good', hex: '#F59E0B', minScore: 0, maxScore: 30 },
  { zone: 'needs-improvement', label: { en: 'Needs Improvement', es: 'Necesita Mejorar' },
    cssVar: '--flavor-needs-improvement', hex: '#EF4444', minScore: -100, maxScore: -1 },
];

// --- NPS Category Configuration ---
export interface FlavorCategoryConfig {
  category: FlavorCategory;
  label: { en: string; es: string };
  cssVar: string;
  hex: string;
  starRatings: number[];
}

export const FLAVOR_CATEGORIES: FlavorCategoryConfig[] = [
  { category: 'loving',      label: { en: 'Loving the Flavor', es: 'Amando el Sabor' },
    cssVar: '--flavor-loving', hex: '#22C55E', starRatings: [5] },
  { category: 'fence',       label: { en: 'On the Fence', es: 'Indecisos' },
    cssVar: '--flavor-fence', hex: '#F59E0B', starRatings: [4] },
  { category: 'not-feeling', label: { en: 'Not Feeling It', es: 'Sin Sabor' },
    cssVar: '--flavor-not-feeling', hex: '#EF4444', starRatings: [1, 2, 3] },
];
```

---

## 9. Bilingual Labels

### 9.1 Flavor Index Score Zones

| Zone | EN | ES | Color | Score Range |
|---|---|---|---|---|
| World-Class | World-Class | Clase Mundial | `#10B981` | +71 to +100 |
| Excellent | Excellent | Excelente | `#22C55E` | +51 to +70 |
| Great | Great | **Muy Bueno** | `#84CC16` | +31 to +50 |
| Good | Good | Bueno | `#F59E0B` | 0 to +30 |
| Needs Improvement | Needs Improvement | Necesita Mejorar | `#EF4444` | -100 to -1 |

### 9.2 NPS Categories

| Category | EN | ES | Star Ratings |
|---|---|---|---|
| Promoters | Loving the Flavor | Amando el Sabor | 5-star |
| Passives | On the Fence | **Indecisos** | 4-star |
| Detractors | Not Feeling It | **Sin Sabor** | 1-3 star |

**Spanish corrections applied:**
- "Genial" -> **"Muy Bueno"** (juvenile/informal -> natural business Spanish)
- "En la Cerca" -> **"Indecisos"** (literal fence translation -> idiomatic "undecided")
- "No lo Sienten" -> **"Sin Sabor"** (stiff third-person -> on-brand "without flavor")

### 9.3 UI Labels

| Element | EN | ES |
|---|---|---|
| Feature name | Flavor Index | Índice de Sabor |
| Dashboard title | Review Insights | Perspectivas de Reseñas |
| Tab: Overview | Overview | Resumen |
| Tab: Compete | Compete | Competencia |
| Tab: Insights | Insights | Perspectivas |

### 9.4 Time Periods

| EN | ES |
|---|---|
| 30 days | 30 días |
| 90 days | 90 días |
| Year to Date | Año hasta la fecha |
| This Week | Esta Semana |
| This Month | Este Mes |
| This Quarter | Este Trimestre |
| Custom Range | Rango Personalizado |

### 9.5 Empty States

| State | EN | ES |
|---|---|---|
| No reviews | Welcome to Flavor Index | Bienvenido al Índice de Sabor |
| No competitors | Add competitors to benchmark your performance | Agrega competidores para comparar tu rendimiento |
| No AI data | AI insights coming soon | Perspectivas de IA próximamente |

### 9.6 Emotion Labels

| Emotion | EN | ES |
|---|---|---|
| delighted | Delighted | Encantado |
| satisfied | Satisfied | Satisfecho |
| neutral | Neutral | Neutral |
| frustrated | Frustrated | Frustrado |
| angry | Angry | Enojado |

### 9.7 Sentiment & Return Intent

| Sentiment | EN | ES |
|---|---|---|
| positive | Positive | Positivo |
| neutral | Neutral | Neutral |
| negative | Negative | Negativo |

| Intent | EN | ES |
|---|---|---|
| likely | Likely to Return | Probable que Regrese |
| unlikely | Unlikely to Return | Poco Probable que Regrese |
| unclear | Unclear | No Claro |

---

## 10. Phase Dependencies

What each future phase gets from Phase 1:

| Future Phase | What Phase 1 Provides |
|-------------|----------------------|
| **Phase 2 — Apify Ingestion** | `tracked_restaurants` with platform URLs (`google_place_id`, `opentable_url`, `tripadvisor_url`), `scrape_runs` for audit/idempotency, `restaurant_reviews` for normalized storage |
| **Phase 3 — Rollup Computation** | `flavor_index_daily` + `review_intelligence` tables ready to receive computed data, `compute_flavor_index_range()` for arbitrary date-range Flavor Index queries |
| **Phase 4a — Flavor Index Dashboard** | 390 reviews of seed data with known Flavor Index scores across 4 color zones, sparkline-ready daily rollups, competitor data for benchmarking, empty-state restaurant for onboarding UX |
| **Phase 4b — AI Extraction Engine** | `review_analyses` table with JSONB schema for structured signals, 12 pending reviews for testing the extraction pipeline, `credit_costs` with `extraction` cost = 0 credits |
| **Phase 5 — Full Dashboard** | Pre-seeded `review_analyses` with staff/items/emotions/severity data, `aggregate_staff_mentions()` and `aggregate_item_mentions()` functions ready for `useStaffPerformance()` / `useTopMentions()` hooks |
| **Phase 7 — AI Chat Interface** | Credit pipeline (`credit_costs` + `ai_usage_log` + `increment_usage()`) for usage tracking, `get_competitor_ids()` for scope queries, `review_intelligence` periods for chat context |
| **Phase 8 — Corporate / Multi-Unit** | `tracked_restaurants.parent_unit_id` hierarchy already in place; `org_hierarchy` + `org_assignments` tables created in Phase 8 when needed |
| **Phase 9 — Semantic Search** | `review_analyses.embedding` column (vector(1536)) exists but is unpopulated; ready for embedding generation |

---

## 11. Risk Assessment

### Risk Table

| # | Risk | Severity | Description | Mitigation |
|---|------|----------|-------------|------------|
| R1 | `increment_usage()` DROP+CREATE | **HIGH** | Existing AI edge functions (`ask`, `ask-product`, `transcribe`, etc.) call `increment_usage(_user_id, _group_id)` via RPC. DROP+CREATE momentarily removes the function. | `supabase db push` wraps M06 in a transaction — if any statement fails, nothing changes. New function preserves exact 4-column return type. New params `_credits` and `_log` have defaults so existing 2-arg calls work identically. Pre-flight query verifies current signature before push. |
| R2 | Migration fails mid-sequence | **MEDIUM** | If migration 5 of 9 fails, earlier migrations have already committed. | Each migration runs in its own transaction. No cross-migration runtime dependencies after creation order. Failed migration can be fixed and re-pushed without rolling back earlier ones. |
| R3 | Seed data leaks to production | **MEDIUM** | Synthetic reviews/restaurants could appear in a production environment. | Deterministic UUIDs (`11111111-...` through `55555555-...`) make identification and cleanup trivial. Documented in go-live checklist. |
| R4 | GENERATED column locks formula | **LOW** | `flavor_index` is GENERATED ALWAYS AS STORED. Changing the formula requires a column rebuild. | Migration path documented: `ALTER TABLE DROP COLUMN; ALTER TABLE ADD COLUMN ... GENERATED ALWAYS AS (new_formula) STORED;`. Formula is NPS-standard and unlikely to change. |
| R5 | SMALLINT rating if half-stars needed | **LOW** | `rating SMALLINT CHECK (BETWEEN 1 AND 5)` cannot store half-star values. | All 3 current platforms use integer 1-5 stars. If half-stars needed: `ALTER COLUMN rating TYPE NUMERIC(2,1)`. One-line migration. |
| R6 | Synthetic data format mismatch | **LOW** | Seed data may not match real Apify output format. | Seed data matches the normalized schema (post-ingestion), not raw Apify format. The `ingest-reviews` function (Phase 2) handles raw-to-normalized transformation. Phase 0 spike validates Apify output shape. |

### Rollback Strategy for M06 (Credit Pipeline)

M06 is the highest-risk migration because it modifies `increment_usage()`, a function called by all existing AI edge functions.

**If M06 fails during `supabase db push`:**
1. `supabase db push` wraps each migration in its own transaction. If any statement in M06 fails, the entire migration is rolled back — `increment_usage()` retains its original signature.
2. Fix the SQL, re-push. Migrations M01-M05 (already committed) are unaffected.

**If M06 succeeds but `increment_usage()` has a runtime bug post-deployment:**
1. All existing callers pass 2 args. The new function accepts these identically due to `_credits DEFAULT 1` and `_log DEFAULT NULL`.
2. If the bug is in the new `_log` INSERT path: push a hotfix migration that removes the `_log` INSERT block.
3. If the bug is in the counter increment path: push a fixup migration restoring the exact old function body with the 4-param signature.

**If seed data is wrong:**
1. `DELETE FROM tracked_restaurants WHERE id IN ('11111111-...', '22222222-...', '33333333-...', '44444444-...', '55555555-...')` — CASCADE propagates to all child rows.
2. Fix seed SQL and re-push.

---

## 12. Verification Plan

Run all queries after all 9 migrations complete. Expected values are based on the exact seed data distributions.

### V01: Schema Verification

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('tracked_restaurants', 'scrape_runs', 'restaurant_reviews',
    'review_analyses', 'flavor_index_daily', 'review_intelligence',
    'credit_costs', 'ai_usage_log');
-- Expected: all 8 rows returned
```

### V02: Restaurant Counts

```sql
SELECT restaurant_type, count(*) FROM tracked_restaurants
  WHERE group_id = (SELECT id FROM groups WHERE slug = 'alamo-prime')
  GROUP BY restaurant_type ORDER BY restaurant_type;
-- Expected: competitor = 3, own = 2
```

### V03: Max-4-Competitors Trigger

```sql
-- Insert a 4th competitor (should succeed)
INSERT INTO tracked_restaurants (group_id, name, slug, restaurant_type, parent_unit_id)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'Test Comp 4', 'test-comp-4', 'competitor', '11111111-1111-1111-1111-111111111111');
-- Expected: INSERT 0 1

-- Attempt to add a 5th competitor (should fail)
INSERT INTO tracked_restaurants (group_id, name, slug, restaurant_type, parent_unit_id)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'Test Comp 5', 'test-comp-5', 'competitor', '11111111-1111-1111-1111-111111111111');
-- Expected: ERROR "Maximum 4 competitors per restaurant unit"

-- Cleanup
DELETE FROM tracked_restaurants WHERE slug = 'test-comp-4';
```

### V04: CHECK Constraint Enforcement

```sql
-- Competitor without parent (should fail)
INSERT INTO tracked_restaurants (group_id, name, slug, restaurant_type, parent_unit_id)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'Orphan', 'orphan', 'competitor', NULL);
-- Expected: ERROR violates check constraint "chk_competitor_has_parent"

-- Own restaurant with parent (should fail)
INSERT INTO tracked_restaurants (group_id, name, slug, restaurant_type, parent_unit_id)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  'Bad Own', 'bad-own', 'own', '11111111-1111-1111-1111-111111111111');
-- Expected: ERROR violates check constraint "chk_own_no_parent"
```

### V05: Review Counts by Restaurant

```sql
SELECT tr.name, count(rr.id) AS review_count
FROM restaurant_reviews rr
  JOIN tracked_restaurants tr ON tr.id = rr.restaurant_id
GROUP BY tr.name ORDER BY review_count DESC;
-- Expected:
--   Alamo Prime Steakhouse = 150
--   Longhorn & Ember       = 100
--   Salt & Sear Chophouse  =  80
--   Mesquite Flame Grill   =  60

SELECT count(*) FROM restaurant_reviews;
-- Expected: 390
```

### V06: Star Distribution per Restaurant

```sql
SELECT tr.name,
  count(*) AS total,
  count(*) FILTER (WHERE rr.rating = 5) AS five_star,
  count(*) FILTER (WHERE rr.rating = 4) AS four_star,
  count(*) FILTER (WHERE rr.rating = 3) AS three_star,
  count(*) FILTER (WHERE rr.rating = 2) AS two_star,
  count(*) FILTER (WHERE rr.rating = 1) AS one_star
FROM restaurant_reviews rr
  JOIN tracked_restaurants tr ON tr.id = rr.restaurant_id
GROUP BY tr.name ORDER BY total DESC;
-- Expected:
--   Alamo Prime Steakhouse:  150, 123/17/5/3/2
--   Longhorn & Ember:        100, 67/14/8/7/4
--   Salt & Sear Chophouse:    80, 43/14/10/8/5
--   Mesquite Flame Grill:     60, 22/13/10/9/6
```

### V07: Flavor Index Scores via Helper Function

```sql
SELECT tr.name, (compute_flavor_index_range(tr.id, '2025-12-01', '2026-02-28')).*
FROM tracked_restaurants tr
WHERE tr.status = 'active' AND tr.slug != 'alamo-prime-westside'
ORDER BY tr.name;
-- Expected:
--   Alamo Prime:   total=150, five=123, four=17, low=10,  fi=+75.33, avg=4.71
--   Longhorn:      total=100, five=67,  four=14, low=19,  fi=+48.00, avg=4.33
--   Mesquite:      total=60,  five=22,  four=13, low=25,  fi=-5.00,  avg=3.60
--   Salt & Sear:   total=80,  five=43,  four=14, low=23,  fi=+25.00, avg=4.03
```

### V08: GENERATED Column Consistency

```sql
SELECT date, total_reviews, five_star,
  one_star + two_star + three_star AS low_star,
  flavor_index,
  ROUND(((five_star::numeric / total_reviews) * 100)
    - (((one_star + two_star + three_star)::numeric / total_reviews) * 100), 2) AS manual_fi
FROM flavor_index_daily
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
  AND total_reviews > 0
ORDER BY date DESC LIMIT 5;
-- Expected: flavor_index = manual_fi for every row
```

### V09: Star-Count CHECK Constraint

```sql
INSERT INTO flavor_index_daily (group_id, restaurant_id, date,
  total_reviews, five_star, four_star, three_star, two_star, one_star, avg_rating)
VALUES ((SELECT id FROM groups WHERE slug = 'alamo-prime'),
  '11111111-1111-1111-1111-111111111111', '2099-12-31',
  10, 5, 5, 5, 0, 0, 4.00);
-- Expected: ERROR (5+5+5+0+0 = 15, but total_reviews = 10)
```

### V10: Credit Pipeline — Backward Compatibility (2-arg call)

```sql
SELECT * FROM increment_usage(
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM groups WHERE slug = 'alamo-prime')
);
-- Expected: returns 4 columns (daily_count, monthly_count, daily_limit, monthly_limit)

SELECT count(*) FROM ai_usage_log;
-- Expected: 0 (no audit rows from 2-arg calls)
```

### V11: Credit Pipeline — With Audit Logging (4-arg call)

```sql
SELECT * FROM increment_usage(
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM groups WHERE slug = 'alamo-prime'),
  1,
  '{"domain": "reviews", "action": "test", "edge_function": "verification-test"}'::jsonb
);
-- Expected: returns (daily_count, monthly_count, daily_limit, monthly_limit)

SELECT domain, action, credits_consumed, edge_function
FROM ai_usage_log ORDER BY created_at DESC LIMIT 1;
-- Expected: domain='reviews', action='test', credits_consumed=1, edge_function='verification-test'

-- Cleanup
DELETE FROM ai_usage_log WHERE action = 'test';
```

### V12: Credit Costs System Defaults

```sql
SELECT domain, action_type, credits FROM credit_costs
WHERE group_id IS NULL ORDER BY domain, action_type;
-- Expected: 11 rows (beer_liquor/default/1, cocktails/default/1, dishes/default/1,
--   forms/default/1, manual/default/1, recipes/default/1, reviews/default/1,
--   reviews/extraction/0, reviews/weekly_brief/1, training/default/1, wines/default/1)
```

### V13: Analysis Status Mix

```sql
SELECT analysis_status, count(*),
  count(*) FILTER (WHERE review_text IS NOT NULL) AS has_text
FROM restaurant_reviews
GROUP BY analysis_status ORDER BY analysis_status;
-- Expected:
--   completed = 368, has_text = 0   (text NULLed after extraction)
--   failed    =   9, has_text =  9  (text retained for re-extraction)
--   pending   =  13, has_text = 13  (text retained, awaiting extraction)
```

### V14: Staff Mentions (Alamo Prime)

```sql
SELECT staff->>'name' AS name, count(*) AS mentions
FROM review_analyses,
     jsonb_array_elements(staff_mentioned) AS staff
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY staff->>'name' ORDER BY mentions DESC LIMIT 5;
-- Expected:
--   Maria Garcia   = 14
--   Carlos Reyes   = 10
--   Jake Thompson  =  7
--   Sofia Martinez =  5
--   David Chen     =  4
```

### V15: High-Severity Flags

```sql
SELECT tr.name, count(*) AS severity_flags
FROM review_analyses ra
  JOIN tracked_restaurants tr ON tr.id = ra.restaurant_id
WHERE ra.high_severity_flag = true
GROUP BY tr.name ORDER BY tr.name;
-- Expected:
--   Alamo Prime Steakhouse = 2
--   Mesquite Flame Grill   = 2
```

### V16: Empty-State Restaurant

```sql
SELECT tr.name,
  (SELECT count(*) FROM restaurant_reviews rr WHERE rr.restaurant_id = tr.id) AS reviews,
  (SELECT count(*) FROM flavor_index_daily fid WHERE fid.restaurant_id = tr.id) AS rollups,
  (SELECT count(*) FROM review_analyses ra WHERE ra.restaurant_id = tr.id) AS analyses
FROM tracked_restaurants tr
WHERE tr.slug = 'alamo-prime-westside';
-- Expected: reviews=0, rollups=0, analyses=0
```

### V17: RLS Policy Count

```sql
SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tracked_restaurants', 'scrape_runs', 'restaurant_reviews',
    'review_analyses', 'flavor_index_daily', 'review_intelligence',
    'credit_costs', 'ai_usage_log')
GROUP BY tablename ORDER BY tablename;
-- Expected:
--   ai_usage_log          = 2  (user SELECT + admin SELECT)
--   credit_costs          = 2  (public SELECT + admin ALL)
--   flavor_index_daily    = 4  (SELECT, INSERT, UPDATE, DELETE)
--   restaurant_reviews    = 4
--   review_analyses       = 4  (SELECT, INSERT, UPDATE, DELETE)
--   review_intelligence   = 4
--   scrape_runs           = 4  (group SELECT, admin INSERT/UPDATE/DELETE)
--   tracked_restaurants   = 4
```

---

## 13. Seed Data Cleanup

All seed data uses deterministic UUIDs. CASCADE deletes propagate to all child tables.

### 13.1 Full Cleanup (Before Go-Live)

```sql
-- Removes ALL synthetic review data while preserving schema, functions, and
-- credit_costs system defaults (group_id IS NULL).
-- CASCADE on tracked_restaurants propagates to:
--   restaurant_reviews -> review_analyses
--   scrape_runs, flavor_index_daily, review_intelligence

DELETE FROM public.tracked_restaurants
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',  -- Alamo Prime Steakhouse
  '22222222-2222-2222-2222-222222222222',  -- Longhorn & Ember
  '33333333-3333-3333-3333-333333333333',  -- Salt & Sear Chophouse
  '44444444-4444-4444-4444-444444444444',  -- Mesquite Flame Grill
  '55555555-5555-5555-5555-555555555555'   -- Alamo Prime - Westside
);

-- Clean up any ai_usage_log test entries (no CASCADE from restaurants)
DELETE FROM public.ai_usage_log
WHERE domain = 'reviews' AND metadata->>'seed' = 'true';
```

### 13.2 Verification After Cleanup

```sql
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

SELECT count(*) FROM public.credit_costs WHERE group_id IS NULL;
-- Expected: 11 (system defaults preserved)
```

### 13.3 Partial Cleanup (Remove Only Competitors)

```sql
DELETE FROM public.tracked_restaurants
WHERE id IN (
  '22222222-2222-2222-2222-222222222222',  -- Longhorn & Ember
  '33333333-3333-3333-3333-333333333333',  -- Salt & Sear Chophouse
  '44444444-4444-4444-4444-444444444444'   -- Mesquite Flame Grill
);
```

---

## 14. Files Created

This phase creates exactly 10 files:

```
supabase/migrations/
  20260224180000_create_tracked_restaurants.sql          -- M01
  20260224180100_create_scrape_runs.sql                  -- M02
  20260224180200_create_restaurant_reviews.sql           -- M03
  20260224180300_create_review_analyses.sql              -- M04
  20260224180400_create_flavor_index_daily.sql           -- M05 (includes review_intelligence)
  20260224180500_create_credit_pipeline.sql              -- M06 (HIGHEST RISK — review carefully)
  20260224180600_create_review_helper_functions.sql      -- M07 (includes aggregate functions)
  20260224180700_seed_tracked_restaurants.sql             -- S01 (5 restaurants)
  20260224180800_seed_synthetic_reviews.sql               -- S02 (390 reviews + analyses + rollups)

supabase/functions/_shared/
  credit-pipeline.ts                                     -- Shared helper for edge functions
```

**Notes:**
- No frontend files are created in Phase 1
- No edge functions are created or modified (only the shared helper)
- `credit-pipeline.ts` **already exists on disk** (created in a previous session) — verify it matches the plan's version before pushing
- `credit-pipeline.ts` is opt-in — existing edge functions continue working without changes
- **Existing `_shared/usage.ts`** exports `checkUsage()` and `incrementUsage()` which overlap with `credit-pipeline.ts`. The old file continues working (existing edge functions import it). Future phases should migrate to `credit-pipeline.ts` and deprecate `usage.ts`. Do NOT delete `usage.ts` until all edge functions have been migrated.
- Migration filenames use sequential 1-minute intervals from `20260224180000` to avoid collisions with today's earlier migrations (latest existing: `20260224150149`)

---

## Supplementary Reference Files

The following supplementary files contain detailed SQL templates for S02 seed generation:

- **`01-phase-seed-and-frontend-prep.md`** — Complete S01 INSERT SQL, S02 generation patterns (staff mentions, item mentions, daily rollups, review intelligence periods), review_analyses INSERT templates, high-severity flag UPDATEs, complaint category distribution

These supplementary files provide copy-paste-ready SQL patterns for the developer implementing S02.

---

*This plan synthesizes work from 4 specialist agents (DB Expert, Technical Architect, Backend Developer, UX/UI Expert) across 3 audit rounds. Round 2 fixes: C1 (Spanish accents), C2 (date distribution math), C3 (Mesquite flag 2 targeting), C6+C7 (missing TypeScript types), I1-I9 (RLS, CHECK constraints, auth guards, integration guide, docs). Round 3 fixes: Alamo Prime analysis_status boundary (i<=140→i<=148), severity flag targets (rating=2/3 instead of 1), ItemMention.item_type ("drink"→"cocktail", removed "dessert"), PlatformBreakdown.flavor_index added, HighSeverityType extensibility note, Q4 platform_breakdown consistency, Overview authoritativeness note. Status counts: 368 completed, 13 pending, 9 failed. The highest-risk item is M06 (credit pipeline) — review that migration with extra care before pushing.*
