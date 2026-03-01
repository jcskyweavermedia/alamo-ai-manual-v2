# Phase 6 — Admin: Manage Units & Competitors

> **Status:** Ready for Implementation
> **Estimated effort:** ~2 sessions (split as 6a: ~1 session + 6b: ~1 session)
> **Dependencies:** Phase 1 (DB foundation), Phase 2 (ingest-reviews)
> **Sequencing note:** Phase 5 (dashboard data wiring) should ideally start first so the admin can verify their configuration changes in a real dashboard. Phase 6a (CRUD) can run in parallel; Phase 6b (Apify triggers) should follow Phase 5.
> **Last updated:** 2026-02-26

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope Split: Phase 6a vs 6b](#2-scope-split)
3. [Pre-Requisite Migrations](#3-pre-requisite-migrations)
4. [File Inventory](#4-file-inventory)
5. [TypeScript Types](#5-typescript-types)
6. [Data Hooks](#6-data-hooks)
7. [Page Structure](#7-page-structure)
8. [Component Breakdown](#8-component-breakdown)
9. [Routing & Navigation](#9-routing--navigation)
10. [Bilingual Labels](#10-bilingual-labels)
11. [Edge Cases & Data Integrity](#11-edge-cases--data-integrity)
12. [Implementation Order](#12-implementation-order)
13. [Verification](#13-verification)
14. [Deferred to Phase 6b](#14-deferred-to-phase-6b)
15. [Devil's Advocate — Resolved Decisions](#15-devils-advocate--resolved-decisions)

---

## 1. Executive Summary

Phase 6 gives admins full CRUD control over tracked restaurants and competitors, plus visibility into scraping health and pipeline status. It creates a new lazy-loaded admin page at `/admin/reviews/restaurants` alongside the existing `/admin/reviews` analytics dashboard.

**What Phase 6a ships (~1 session):**
- 1 migration (4 PG functions + 2 triggers + 1 index + 1 trigger fix)
- 2 data hooks (`use-tracked-restaurants.ts`, `use-scrape-runs.ts`)
- 1 page (`AdminReviewRestaurants.tsx`) with 2 tabs
- 5 components (RestaurantList, RestaurantForm, CompetitorForm, ScrapeStatusCard, PipelineHealthPanel)
- 1 type file (`reviews-admin.ts`)
- Routing + navigation updates

**Deferred to Phase 6b (~1 session):**
- Manual scrape trigger (requires new `trigger-scrape` edge function + Apify API)
- Apify task auto-creation for newly added restaurants
- `scrape_frequency` propagation to Apify cron schedules

---

## 2. Scope Split

### Phase 6a — CRUD Admin + Pipeline Monitoring (THIS PLAN)

| # | Deliverable | Complexity |
|---|-------------|------------|
| 1 | Admin page: `/admin/reviews/restaurants` | Medium |
| 2 | Add/edit own restaurant dialog | Medium |
| 3 | Add/edit competitor dialog (max 4 validation) | Medium |
| 4 | Restaurant list (grouped by own, nested competitors) | Medium |
| 5 | Scrape status indicators (read-only, latest per platform) | Low |
| 6 | Pipeline health panel (queue depth, failed reviews) | Low |
| 7 | Archive/unarchive restaurants with cascade | Low |
| 8 | Client-side URL validation for platform URLs | Low |
| 9 | DB migrations (functions, triggers, index) | Medium |

### Phase 6b — Apify Integration (DEFERRED)

| # | Deliverable | Why Deferred |
|---|-------------|--------------|
| 1 | `trigger-scrape` edge function | New edge function (~250 LOC), Apify API integration |
| 2 | ManualScrapeButton component | Requires trigger-scrape function |
| 3 | Apify task auto-creation on restaurant add | Apify API integration, actor input mapping per platform |
| 4 | `scrape_frequency` sync to Apify cron | Requires Apify API, currently decorative |
| 5 | Budget controls for scrape triggers | Rate limiting, credit tracking |

---

## 3. Pre-Requisite Migrations

### Migration: `YYYYMMDDHHMMSS_phase6_admin_functions.sql`

This migration creates 4 PG functions, 2 triggers, 1 index, and fixes the existing `enforce_max_competitors()` trigger.

#### 3.1 `get_pipeline_health()` — Pipeline monitoring dashboard

Replaces 4+ frontend queries with a single RPC call. Returns one row per active restaurant with review counts by analysis_status, latest scrape info, and active platforms.

```sql
CREATE OR REPLACE FUNCTION public.get_pipeline_health()
RETURNS TABLE (
  restaurant_id      UUID,
  restaurant_name    TEXT,
  restaurant_type    TEXT,
  status             TEXT,
  total_reviews      BIGINT,
  pending_count      BIGINT,
  processing_count   BIGINT,
  failed_count       BIGINT,
  completed_count    BIGINT,
  oldest_pending_at  TIMESTAMPTZ,
  last_scraped_at    TIMESTAMPTZ,
  last_scrape_status TEXT,
  last_scrape_platform TEXT,
  active_platforms   TEXT[]
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH review_stats AS (
    SELECT
      rr.restaurant_id,
      COUNT(*)                                                    AS total_reviews,
      COUNT(*) FILTER (WHERE rr.analysis_status = 'pending')      AS pending_count,
      COUNT(*) FILTER (WHERE rr.analysis_status = 'processing')   AS processing_count,
      COUNT(*) FILTER (WHERE rr.analysis_status = 'failed')       AS failed_count,
      COUNT(*) FILTER (WHERE rr.analysis_status = 'completed')    AS completed_count,
      MIN(rr.created_at) FILTER (WHERE rr.analysis_status = 'pending') AS oldest_pending_at
    FROM public.restaurant_reviews rr
    WHERE rr.group_id = public.get_user_group_id()
    GROUP BY rr.restaurant_id
  ),
  latest_scrape AS (
    SELECT DISTINCT ON (sr.restaurant_id)
      sr.restaurant_id,
      sr.status     AS last_scrape_status,
      sr.platform   AS last_scrape_platform
    FROM public.scrape_runs sr
    WHERE sr.group_id = public.get_user_group_id()
    ORDER BY sr.restaurant_id, sr.started_at DESC
  ),
  platform_list AS (
    SELECT
      sr.restaurant_id,
      ARRAY_AGG(DISTINCT sr.platform ORDER BY sr.platform) AS active_platforms
    FROM public.scrape_runs sr
    WHERE sr.group_id = public.get_user_group_id()
      AND sr.status = 'completed'
    GROUP BY sr.restaurant_id
  )
  SELECT
    tr.id                    AS restaurant_id,
    tr.name                  AS restaurant_name,
    tr.restaurant_type,
    tr.status,
    COALESCE(rs.total_reviews, 0),
    COALESCE(rs.pending_count, 0),
    COALESCE(rs.processing_count, 0),
    COALESCE(rs.failed_count, 0),
    COALESCE(rs.completed_count, 0),
    rs.oldest_pending_at,
    tr.last_scraped_at,
    ls.last_scrape_status,
    ls.last_scrape_platform,
    COALESCE(pl.active_platforms, '{}')
  FROM public.tracked_restaurants tr
  LEFT JOIN review_stats rs ON rs.restaurant_id = tr.id
  LEFT JOIN latest_scrape ls ON ls.restaurant_id = tr.id
  LEFT JOIN platform_list pl ON pl.restaurant_id = tr.id
  WHERE tr.group_id = public.get_user_group_id()
    AND tr.status != 'archived'
  ORDER BY tr.restaurant_type, tr.name;
$$;
```

#### 3.2 `get_admin_restaurant_list()` — Admin list with aggregates

Single RPC replaces N+1 frontend queries. Returns restaurants with competitor_count, review_count, and latest_flavor_index pre-computed.

```sql
CREATE OR REPLACE FUNCTION public.get_admin_restaurant_list(
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  slug                TEXT,
  restaurant_type     TEXT,
  status              TEXT,
  parent_unit_id      UUID,
  parent_name         TEXT,
  competitor_count    BIGINT,
  review_count        BIGINT,
  scrape_enabled      BOOLEAN,
  scrape_frequency    TEXT,
  last_scraped_at     TIMESTAMPTZ,
  google_place_id     TEXT,
  google_place_url    TEXT,
  opentable_url       TEXT,
  tripadvisor_url     TEXT,
  latest_flavor_index NUMERIC(5,2),
  created_at          TIMESTAMPTZ
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tr.id, tr.name, tr.slug, tr.restaurant_type, tr.status,
    tr.parent_unit_id,
    parent.name AS parent_name,
    (SELECT COUNT(*) FROM public.tracked_restaurants comp
     WHERE comp.parent_unit_id = tr.id
       AND comp.restaurant_type = 'competitor'
       AND comp.status != 'archived')::bigint AS competitor_count,
    (SELECT COUNT(*) FROM public.restaurant_reviews rr
     WHERE rr.restaurant_id = tr.id)::bigint AS review_count,
    tr.scrape_enabled, tr.scrape_frequency, tr.last_scraped_at,
    tr.google_place_id, tr.google_place_url, tr.opentable_url, tr.tripadvisor_url,
    (SELECT fid.flavor_index FROM public.flavor_index_daily fid
     WHERE fid.restaurant_id = tr.id
     ORDER BY fid.date DESC LIMIT 1) AS latest_flavor_index,
    tr.created_at
  FROM public.tracked_restaurants tr
  LEFT JOIN public.tracked_restaurants parent ON parent.id = tr.parent_unit_id
  WHERE tr.group_id = public.get_user_group_id()
    AND (p_include_archived OR tr.status != 'archived')
  ORDER BY
    CASE tr.restaurant_type WHEN 'own' THEN 0 ELSE 1 END,
    CASE tr.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
    tr.name;
$$;
```

#### 3.3 `generate_restaurant_slug()` — Auto-slug trigger

PG-level slug generation prevents race conditions between concurrent admin sessions. Appends `-2`, `-3`, etc. for collisions. Only fires when slug is NULL/empty.

```sql
CREATE OR REPLACE FUNCTION public.generate_restaurant_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base_slug TEXT;
  v_slug TEXT;
  v_suffix INTEGER := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    RETURN NEW;
  END IF;

  v_base_slug := lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'),
      '-+', '-', 'g')
  );
  v_base_slug := trim(BOTH '-' FROM v_base_slug);

  IF length(v_base_slug) > 60 THEN
    v_base_slug := left(v_base_slug, 60);
    v_base_slug := trim(BOTH '-' FROM v_base_slug);
  END IF;

  IF v_base_slug = '' OR v_base_slug IS NULL THEN
    v_base_slug := 'restaurant';
  END IF;

  v_slug := v_base_slug;
  WHILE EXISTS (
    SELECT 1 FROM public.tracked_restaurants
    WHERE group_id = NEW.group_id AND slug = v_slug AND id IS DISTINCT FROM NEW.id
  ) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  NEW.slug := v_slug;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_restaurant_slug
  BEFORE INSERT OR UPDATE OF name ON public.tracked_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.generate_restaurant_slug();
```

#### 3.4 `cascade_archive_competitors()` — Archive cascade trigger

When an own restaurant is archived, auto-archive all its competitors (and disable scraping). Restoring an own restaurant also restores its competitors.

```sql
CREATE OR REPLACE FUNCTION public.cascade_archive_competitors()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'archived'
     AND OLD.status != 'archived'
     AND NEW.restaurant_type = 'own' THEN
    UPDATE public.tracked_restaurants
    SET status = 'archived', scrape_enabled = false
    WHERE parent_unit_id = NEW.id
      AND restaurant_type = 'competitor'
      AND status != 'archived';
  END IF;

  IF OLD.status = 'archived'
     AND NEW.status = 'active'
     AND NEW.restaurant_type = 'own' THEN
    UPDATE public.tracked_restaurants
    SET status = 'active'
    WHERE parent_unit_id = NEW.id
      AND restaurant_type = 'competitor'
      AND status = 'archived';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_archive_competitors
  AFTER UPDATE OF status ON public.tracked_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.cascade_archive_competitors();
```

#### 3.5 Fix `enforce_max_competitors()` — Exclude archived from count

Currently archived competitors count against the 4-competitor limit. This fix lets admins archive a competitor and add a replacement.

```sql
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
          AND status != 'archived'
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) >= 4 THEN
      RAISE EXCEPTION 'Maximum 4 competitors per restaurant unit';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

#### 3.6 New index for scrape run platform filtering

```sql
CREATE INDEX IF NOT EXISTS idx_scrape_runs_restaurant_platform
  ON public.scrape_runs(restaurant_id, platform, started_at DESC);
```

---

## 4. File Inventory

### New Files (9)

| # | File Path | ~Lines | Purpose |
|---|-----------|--------|---------|
| 1 | `supabase/migrations/YYYYMMDD_phase6_admin_functions.sql` | ~150 | PG functions, triggers, index |
| 2 | `src/types/reviews-admin.ts` | ~80 | TypeScript interfaces for admin CRUD |
| 3 | `src/hooks/use-tracked-restaurants.ts` | ~180 | React Query CRUD for tracked_restaurants |
| 4 | `src/hooks/use-scrape-runs.ts` | ~120 | Read-only scrape_runs + pipeline health via RPC |
| 5 | `src/pages/AdminReviewRestaurants.tsx` | ~180 | Main admin page (lazy-loaded, 2 tabs) |
| 6 | `src/components/reviews/admin/RestaurantList.tsx` | ~200 | Grouped restaurant list with nested competitors |
| 7 | `src/components/reviews/admin/RestaurantForm.tsx` | ~220 | Add/edit dialog for own restaurants |
| 8 | `src/components/reviews/admin/CompetitorForm.tsx` | ~180 | Add/edit dialog for competitors |
| 9 | `src/components/reviews/admin/PipelineHealthPanel.tsx` | ~120 | Extraction queue + failed runs panel |

### Modified Files (3)

| # | File Path | Change |
|---|-----------|--------|
| 1 | `src/App.tsx` | Add lazy import + route for `/admin/reviews/restaurants` |
| 2 | `src/pages/ReviewDashboard.tsx` | Add "Manage" button in header → navigates to admin page |
| 3 | `src/components/reviews/admin/ScrapeStatusCard.tsx` | New inline component for per-restaurant scrape health |

---

## 5. TypeScript Types

### File: `src/types/reviews-admin.ts`

```typescript
import type {
  RestaurantType,
  RestaurantStatus,
  ScrapingFrequency,
  ReviewPlatform,
  ScrapeRunStatus,
} from './reviews';

// ─── Admin Restaurant List RPC Return ────────────────────────────────────────

/** Row shape from get_admin_restaurant_list() RPC */
export interface AdminRestaurantRow {
  id: string;
  name: string;
  slug: string;
  restaurant_type: RestaurantType;
  status: RestaurantStatus;
  parent_unit_id: string | null;
  parent_name: string | null;
  competitor_count: number;
  review_count: number;
  scrape_enabled: boolean;
  scrape_frequency: ScrapingFrequency;
  last_scraped_at: string | null;
  google_place_id: string | null;
  google_place_url: string | null;
  opentable_url: string | null;
  tripadvisor_url: string | null;
  latest_flavor_index: number | null;
  created_at: string;
}

/** Own restaurant with nested competitors for the list view */
export interface OwnRestaurantWithCompetitors {
  restaurant: AdminRestaurantRow;
  competitors: AdminRestaurantRow[];
}

/** Form data for creating/editing a restaurant */
export interface RestaurantFormData {
  name: string;
  google_place_id: string;
  google_place_url: string;
  opentable_url: string;
  tripadvisor_url: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  scrape_enabled: boolean;
  scrape_frequency: ScrapingFrequency;
  status: RestaurantStatus;
}

/** Form data for creating/editing a competitor */
export interface CompetitorFormData {
  name: string;
  parent_unit_id: string;
  google_place_id: string;
  google_place_url: string;
  opentable_url: string;
  tripadvisor_url: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  scrape_enabled: boolean;
  scrape_frequency: ScrapingFrequency;
}

// ─── Pipeline Health RPC Return ──────────────────────────────────────────────

/** Row shape from get_pipeline_health() RPC */
export interface PipelineHealthRow {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_type: RestaurantType;
  status: RestaurantStatus;
  total_reviews: number;
  pending_count: number;
  processing_count: number;
  failed_count: number;
  completed_count: number;
  oldest_pending_at: string | null;
  last_scraped_at: string | null;
  last_scrape_status: ScrapeRunStatus | null;
  last_scrape_platform: ReviewPlatform | null;
  active_platforms: ReviewPlatform[];
}

/** Aggregated pipeline health totals */
export interface PipelineHealthTotals {
  totalReviews: number;
  pendingReviews: number;
  processingReviews: number;
  failedReviews: number;
  completedReviews: number;
}

// ─── Scrape Runs ─────────────────────────────────────────────────────────────

/** Row shape from scrape_runs table */
export interface ScrapeRunRow {
  id: string;
  group_id: string;
  restaurant_id: string;
  platform: ReviewPlatform;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  status: ScrapeRunStatus;
  reviews_fetched: number;
  reviews_inserted: number;
  reviews_duplicate: number;
  reviews_updated: number;
  error_message: string | null;
  last_offset: number | null;
  started_at: string;
  completed_at: string | null;
}
```

---

## 6. Data Hooks

### 6.1 `use-tracked-restaurants.ts`

**File:** `src/hooks/use-tracked-restaurants.ts`

**Query key:** `['admin-restaurants', groupId]`

**Main query:** Calls `supabase.rpc('get_admin_restaurant_list')` — returns flat list, frontend groups into `OwnRestaurantWithCompetitors[]`.

**Transform logic:**
1. Filter rows where `restaurant_type === 'own'` → section headers
2. For each own restaurant, find competitors where `parent_unit_id === own.id`
3. Sort competitors by name

**Mutations (all invalidate `['admin-restaurants']`):**

| Mutation | DB Call | Notes |
|----------|---------|-------|
| `createRestaurant(data)` | `.from('tracked_restaurants').insert({...}).select().single()` | Sets `restaurant_type: 'own'`, slug: null (trigger generates) |
| `updateRestaurant(id, data)` | `.from('tracked_restaurants').update({...}).eq('id', id)` | |
| `archiveRestaurant(id)` | `.update({ status: 'archived', scrape_enabled: false }).eq('id', id)` | Cascade handled by PG trigger |
| `unarchiveRestaurant(id)` | `.update({ status: 'active' }).eq('id', id)` | Cascade restore by PG trigger |
| `createCompetitor(data)` | `.insert({...}).select().single()` | Sets `restaurant_type: 'competitor'`, slug: null |
| `updateCompetitor(id, data)` | `.update({...}).eq('id', id)` | |
| `deleteCompetitor(id)` | `.delete().eq('id', id)` | Hard delete for competitors |
| `toggleScrapeEnabled(id, enabled)` | `.update({ scrape_enabled: enabled }).eq('id', id)` | Quick toggle |

**Error handling for create:**
- Error code `23505` + message contains `slug` → "A restaurant with this name already exists"
- Error message contains `Maximum 4 competitors` → "Maximum 4 competitors reached. Archive or remove one first."

**Cache config:** `staleTime: 2 * 60_000`, `gcTime: 5 * 60_000`, `retry: 2`

### 6.2 `use-scrape-runs.ts`

**File:** `src/hooks/use-scrape-runs.ts`

Two query hooks:

**Query 1 — Pipeline Health:** `['pipeline-health', groupId]`
```typescript
const { data } = await supabase.rpc('get_pipeline_health');
// Transform: compute totals by summing across all restaurants
```
- `refetchInterval: 30_000` (auto-refresh every 30s on pipeline tab)
- `staleTime: 60_000`

**Query 2 — Recent Failed Runs:** `['failed-scrape-runs', groupId]`
```typescript
const { data } = await supabase
  .from('scrape_runs')
  .select('*')
  .eq('status', 'failed')
  .gte('started_at', sevenDaysAgo)
  .order('started_at', { ascending: false })
  .limit(10);
```

**Return shape:**
```typescript
{
  pipelineRows: PipelineHealthRow[],      // per-restaurant health
  totals: PipelineHealthTotals,            // aggregated sums
  failedRuns: ScrapeRunRow[],              // recent failures
  isLoading: boolean,
  error: Error | null,
}
```

---

## 7. Page Structure

### File: `src/pages/AdminReviewRestaurants.tsx`

```
┌─────────────────────────────────────────────────────────────────────┐
│ [←] Manage Restaurants / Gestionar Restaurantes    [+ Add Restaurant] │
├─────────────────────────────────────────────────────────────────────┤
│  [Restaurants]  [Pipeline Health]                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Alamo Prime Steakhouse ─────────────── [Active] [⋯ Edit/Archive]│
│  │ 412 Congress Ave, Austin, TX                                     │
│  │ 🟢 Google  🟢 OpenTable  ⚪ TripAdvisor  |  Last: 2h ago       │
│  │ Flavor Index: +75.3  |  Reviews: 28                              │
│  │                                                                  │
│  │ Competitors (3/4)                              [+ Add Competitor] │
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ │ Capital Grille  │ │ Perry's         │ │ Eddie V's       │    │
│  │ │ 🟢G 🟢OT ⚪TA  │ │ 🟢G ⚪OT 🟢TA │ │ 🟢G 🟢OT ⚪TA  │    │
│  │ │ [Edit] [Delete] │ │ [Edit] [Delete] │ │ [Edit] [Delete] │    │
│  │ └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│  └──────────────────────────────────────────────────────────────────│
│                                                                     │
│  ┌─ Alamo Prime Westside ──────────────── [Paused] [⋯ Edit/Archive]│
│  │ No platform URLs configured                                      │
│  │ Competitors (0/4)                              [+ Add Competitor] │
│  └──────────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘
```

**Key patterns:**
- Uses `AppShell` with `isAdmin={true}`, `constrainContentWidth={false}`
- shadcn `Tabs` for Restaurants | Pipeline Health
- Back button navigates to `/admin/reviews`
- "Add Restaurant" in header (desktop) + FAB (mobile)
- Dialogs for forms (shadcn `Dialog`)

---

## 8. Component Breakdown

### 8.1 RestaurantList

**File:** `src/components/reviews/admin/RestaurantList.tsx`

**Props:**
```typescript
interface RestaurantListProps {
  restaurants: OwnRestaurantWithCompetitors[];
  pipelineRows: PipelineHealthRow[];
  isEs: boolean;
  onEditRestaurant: (row: AdminRestaurantRow) => void;
  onArchiveRestaurant: (id: string) => void;
  onAddCompetitor: (parentId: string) => void;
  onEditCompetitor: (row: AdminRestaurantRow) => void;
  onDeleteCompetitor: (id: string) => void;
  onToggleScrape: (id: string, enabled: boolean) => void;
}
```

**Layout:** Own restaurants as full-width `Card` components. Each card has:
- Header: name + status badge (green/yellow/gray) + 3-dot dropdown (Edit, Archive)
- Address line (if set)
- Inline scrape status: platform dots (filled = URL configured, green = recently scraped successfully)
- Flavor Index badge + review count (from `latest_flavor_index` and `review_count`)
- Competitors section: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` with "X/4" count badge
- "Add Competitor" button (disabled with tooltip when count >= 4)
- Empty state: "No restaurants configured" + add button

### 8.2 RestaurantForm

**File:** `src/components/reviews/admin/RestaurantForm.tsx`

**Purpose:** shadcn `Dialog` for creating/editing own restaurants.

**Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | `Input` | Yes | Non-empty, max 100 chars |
| Google Maps URL | `Input` | No | Must match `^https?://(www\.)?google\.com/maps/` |
| Google Place ID | `Input` | No | Alphanumeric, optional helper text |
| OpenTable URL | `Input` | No | Must match `^https?://(www\.)?opentable\.com/` |
| TripAdvisor URL | `Input` | No | Must match `^https?://(www\.)?tripadvisor\.com/Restaurant` |
| Address | `Input` | No | Free text |
| City / State / ZIP | `Input` row | No | State: 2 chars, ZIP: 5 digits |
| Scrape Enabled | `Switch` | — | Default: true |
| Scrape Frequency | `Select` | — | daily/weekly/biweekly/monthly |
| Status | `Select` | — | active/paused (archive is a separate action) |

**URL validation regex constants:**
```typescript
const URL_PATTERNS = {
  google: /^https?:\/\/(www\.)?google\.com\/maps\//,
  opentable: /^https?:\/\/(www\.)?opentable\.com\//,
  tripadvisor: /^https?:\/\/(www\.)?tripadvisor\.com\/Restaurant/,
};
```

**Note:** Slug is auto-generated by the PG trigger — NOT a form field.

### 8.3 CompetitorForm

**File:** `src/components/reviews/admin/CompetitorForm.tsx`

Same as RestaurantForm minus Status field. `parentUnitId` is passed as a prop (pre-selected). Shows "Parent: Alamo Prime Steakhouse" as read-only label at top.

**Max 4 guard:** If `currentCompetitorCount >= 4` and creating (not editing), show destructive banner: "Maximum 4 competitors reached" and disable submit.

### 8.4 ScrapeStatusCard

**File:** `src/components/reviews/admin/ScrapeStatusCard.tsx` (inline, ~60 lines)

Rendered inside each restaurant card. Shows 3 platform chips with status dots.

```
🟢 Google (15)  |  🟢 OpenTable (8)  |  ⚪ TripAdvisor (No URL)
Last scraped: 2h ago  |  Success: 12/13 runs (92%)
```

Platform dot colors:
- Green: URL configured + last scrape succeeded
- Yellow: URL configured + last scrape failed
- Gray: No URL configured

### 8.5 PipelineHealthPanel

**File:** `src/components/reviews/admin/PipelineHealthPanel.tsx`

Three stat cards + progress bar + failed runs table.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Pending     │  │  Processing  │  │  Failed      │
│  0           │  │  0           │  │  0           │
│  reviews     │  │  reviews     │  │  reviews     │
└─────────────┘  └─────────────┘  └─────────────┘

Total Extracted: 40 / 40 reviews (100%)
[████████████████████████████████████████████]

Recent Failed Scrape Runs
┌──────────────────────────────────────────────────┐
│ (empty state: "No recent failures — all healthy") │
└──────────────────────────────────────────────────┘
```

Stat card colors:
- Pending > 0: `text-orange-500`
- Processing > 0: `text-blue-500`
- Failed > 0: `text-destructive`
- All zero: green "All Systems Healthy" state

---

## 9. Routing & Navigation

### Route in `App.tsx`

```tsx
// Lazy import
const AdminReviewRestaurants = React.lazy(
  () => import("./pages/AdminReviewRestaurants")
);

// Route — place BEFORE /admin/reviews for specificity
<Route path="/admin/reviews/restaurants" element={
  <ProtectedRoute requiredRole={['manager', 'admin']}>
    <Suspense fallback={...}>
      <AdminReviewRestaurants />
    </Suspense>
  </ProtectedRoute>
} />
```

### Navigation from Dashboard

Add a "Manage" button in `ReviewDashboard.tsx` header (next to Export):

```tsx
<Button variant="outline" size="sm"
  onClick={() => navigate('/admin/reviews/restaurants')}>
  <Settings className="h-4 w-4 mr-1.5" />
  <span className="hidden sm:inline">{isEs ? 'Gestionar' : 'Manage'}</span>
</Button>
```

**No sidebar changes needed.** `/admin/reviews` remains the sidebar entry point; the Manage button provides the drill-down.

### Back navigation

`AdminReviewRestaurants.tsx` has a back button → `/admin/reviews`.

---

## 10. Bilingual Labels

All strings defined as inline `STRINGS` object (matching `AdminFormsListPage.tsx` pattern):

**Key sections:**
- Page: title, back, tab labels
- List: addRestaurant, addCompetitor, competitors, maxCompetitors, noRestaurants
- Card: edit, archive, delete, active/paused/archived, scrapeEnabled/Disabled, lastScraped, neverScraped
- Platforms: google, opentable, tripadvisor, noUrl
- Form: addTitle, editTitle, restaurantName, platformUrls, location fields, scrapingConfig, frequency options, cancel/save
- Pipeline: pending/processing/failed/reviews, totalExtracted, recentFailedRuns, allHealthy
- Toasts: created/updated/archived/deleted confirmation messages

---

## 11. Edge Cases & Data Integrity

### Resolved (handled by migrations):

| Case | Resolution |
|------|-----------|
| Archiving parent orphans competitors | `cascade_archive_competitors()` trigger auto-archives children |
| Unarchiving parent leaves competitors archived | Trigger also auto-restores children |
| Archived competitors count against max 4 | Fixed `enforce_max_competitors()` excludes `status = 'archived'` |
| Slug collision on insert | `generate_restaurant_slug()` trigger appends `-2`, `-3`, etc. |
| Race condition on slug generation | PG trigger runs inside the INSERT transaction — atomic |

### Handled in frontend:

| Case | Resolution |
|------|-----------|
| Max 4 competitors reached | Disable "Add Competitor" button + tooltip |
| Invalid platform URLs | Client-side regex validation + error messages |
| Duplicate slug (23505 error) | Caught and shown as user-friendly message |
| Archive confirmation | Confirmation dialog with impact warning |
| Empty state (0 restaurants) | Illustrated empty state + "Add first restaurant" CTA |
| Delete competitor confirmation | "Are you sure?" dialog |

### Deferred decisions:

| Case | Decision | Rationale |
|------|----------|-----------|
| Rollup includes archived restaurants | **Keep as-is** | Historical data remains valid; admin can filter in dashboard |
| `scrape_enabled` + `status` interaction | `status='archived'` always sets `scrape_enabled=false` | Cascade trigger handles this |
| Pending reviews when restaurant archived | **Let them complete** | Already-ingested data is valuable |

---

## 12. Implementation Order

```
Batch 1 — Database (sequential):
  1. Migration: phase6_admin_functions.sql
  2. npx supabase db push
  3. Verify with 10 test queries

Batch 2 — Types + Hooks (sequential):
  4. src/types/reviews-admin.ts
  5. src/hooks/use-tracked-restaurants.ts
  6. src/hooks/use-scrape-runs.ts

Batch 3 — Components (parallel):
  7. src/components/reviews/admin/ScrapeStatusCard.tsx
  8. src/components/reviews/admin/PipelineHealthPanel.tsx
  9. src/components/reviews/admin/RestaurantForm.tsx
  10. src/components/reviews/admin/CompetitorForm.tsx

Batch 4 — List + Page (sequential):
  11. src/components/reviews/admin/RestaurantList.tsx
  12. src/pages/AdminReviewRestaurants.tsx

Batch 5 — Wiring (parallel):
  13. src/App.tsx (add route)
  14. src/pages/ReviewDashboard.tsx (add Manage button)

Batch 6 — Verify + Audit:
  15. tsc --noEmit → 0 errors
  16. Manual test: navigate to /admin/reviews/restaurants
  17. Test CRUD: add restaurant, add competitor, edit, archive, toggle scrape
  18. Test pipeline health tab
  19. 3-agent audit team
```

---

## 13. Verification

### Migration verification (10 queries):

1. All 4 new functions exist in `pg_proc`
2. `trg_generate_restaurant_slug` trigger attached
3. `trg_cascade_archive_competitors` trigger attached
4. `idx_scrape_runs_restaurant_platform` index exists
5. Slug auto-generation: INSERT with NULL slug → slug generated from name
6. Slug collision: INSERT duplicate name → appends `-2`
7. `get_pipeline_health()` returns rows for active restaurants
8. `get_admin_restaurant_list()` returns rows with competitor_count, review_count
9. Archive cascade: archiving parent archives competitors
10. Max-4 fix: archive a competitor, insert 5th → succeeds

### Frontend verification:

1. Navigate to `/admin/reviews` → click "Manage" → `/admin/reviews/restaurants`
2. Restaurants tab: 2 own restaurants displayed with nested competitors
3. Pipeline Health tab: stat cards show 0 pending, 0 failed (all extracted)
4. Add own restaurant: form validates, saves, appears in list
5. Add competitor: max 4 validated, form works, appears nested under parent
6. Edit restaurant: pre-populated form, saves changes
7. Archive restaurant: confirmation dialog, competitor cascade works
8. Toggle scrape enabled: switch works, persists
9. Platform dots: green for configured + successful, gray for no URL
10. All text switches EN ↔ ES
11. `tsc --noEmit` → 0 errors

---

## 14. Deferred to Phase 6b

### `trigger-scrape` Edge Function

A new edge function (~250 LOC) that:
- Accepts `{ restaurant_id, platform }` from an authenticated admin
- Looks up the restaurant's platform URL from `tracked_restaurants`
- Maps platform to the correct Apify actor ID:
  - `google` → `compass/google-maps-reviews-scraper`
  - `opentable` → `memo23/opentable-reviews-cheerio`
  - `tripadvisor` → `maxcopell/tripadvisor-reviews`
- Calls Apify API (`POST /v2/actor-tasks/{taskId}/runs`) with the correct input + webhook configuration
- Inserts a `scrape_runs` row with status `received`
- Returns `{ runId }` to the frontend
- Includes rate limiting (max 3 triggers per restaurant per hour)

### ManualScrapeButton Component

A dropdown button that calls `trigger-scrape` and shows a loading spinner while the scrape runs. Disabled for platforms without URLs.

### Apify Task Auto-Creation

When admin adds a new restaurant with platform URLs, auto-create corresponding Apify tasks via the Apify API. Requires mapping restaurant + platform → actor input schema.

---

## 15. Devil's Advocate — Resolved Decisions

Issues raised by the Devil's Advocate review and how they were resolved:

| Issue | Resolution |
|-------|-----------|
| "Phase 5 should come first" | Agreed — Phase 5 (data wiring) should start first. Phase 6a can run in parallel once Phase 5 is underway. Updated sequencing note. |
| "Manual scrape trigger is an iceberg" | Agreed — moved to Phase 6b. Phase 6a is CRUD-only. |
| "Platform URL validation missing" | Added client-side regex patterns for all 3 platforms in RestaurantForm. |
| "enforce_max_competitors counts archived" | Fixed in migration — excluded `status = 'archived'` from count. |
| "Archiving parent orphans competitors" | Added `cascade_archive_competitors()` trigger. |
| "scrape_frequency is decorative" | Acknowledged. Displayed in form but documented as manual-only. Sync deferred to Phase 6b. |
| "No Apify task creation on restaurant add" | Deferred to Phase 6b. Phase 6a just stores URLs. |
| "Effort underestimated" | Re-estimated: Phase 6a ~1 session, Phase 6b ~1 session, total ~2 sessions. |
| "Rollup includes archived restaurants" | Kept as-is — archived data remains valid for historical analysis. The admin page filters archived from the list view. |
| "URL injection risk" | Added URL regex validation. URLs rendered in admin UI only (admin-trusted context). |
| "Pisco y Nazca test restaurant" | Shows as a separate own restaurant in the admin list. Admin can archive it if not needed. |
