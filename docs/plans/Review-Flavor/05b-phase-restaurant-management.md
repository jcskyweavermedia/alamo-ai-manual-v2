# Phase 5b — Restaurant Management & Configuration

> **Status:** Ready for Implementation
> **Estimated effort:** ~3 sessions (5b.1: seed migration ~30 min, 5b.2: selector + data wiring ~1 session, 5b.3: admin CRUD ~1 session, 5b.4: AI URL discovery ~0.5 session)
> **Dependencies:** Phase 1 (DB foundation), Phase 2 (ingest-reviews), Phase 3 (rollup engine)
> **Supersedes:** Phase 6 (`06-phase-admin-manage-units.md`) — incorporates all Phase 6a scope with revised sequencing
> **Last updated:** 2026-02-27

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Expert Panel Review](#2-expert-panel-review)
3. [Resolved Decisions](#3-resolved-decisions)
4. [Implementation Phases](#4-implementation-phases)
5. [Phase 5b.1 — Seed Real Restaurants](#5-phase-5b1--seed-real-restaurants)
6. [Phase 5b.2 — Restaurant Selector + Dashboard Wiring](#6-phase-5b2--restaurant-selector--dashboard-wiring)
7. [Phase 5b.3 — Admin CRUD Settings Page](#7-phase-5b3--admin-crud-settings-page)
8. [Phase 5b.4 — AI URL Discovery (Optional)](#8-phase-5b4--ai-url-discovery-optional)
9. [Phase 8 Alignment — User Assignments](#9-phase-8-alignment--user-assignments)
10. [Verification Checklist](#10-verification-checklist)

---

## 1. Executive Summary

This plan replaces fake seed restaurants with real ones, adds a restaurant selector to the dashboard, and builds a super admin settings page for CRUD management of tracked restaurants. It was designed by a panel of four experts:

- **Technical Architect** — System design, state management, build order
- **Database Expert** — Schema changes, migration safety, FK cascades
- **UX/UI Expert** — Selector placement, mobile patterns, admin gating, empty states
- **Devil's Advocate** — Sequencing risks, scope creep, minimum viable path

**What ships (in order):**

| Sub-Phase | Deliverable | Effort |
|-----------|-------------|--------|
| **5b.1** | Migration: seed Fleming's + 4 real competitors, clean fake data | ~30 min |
| **5b.2** | Restaurant selector dropdown + wire dashboard to real data | ~1 session |
| **5b.3** | Admin CRUD settings page at `/admin/reviews/restaurants` | ~1 session |
| **5b.4** | AI URL discovery edge function + form integration (optional) | ~0.5 session |

**What is NOT in scope:**
- User-to-restaurant assignment (Phase 8: `org_hierarchy` + `org_assignments`)
- Manual scrape triggers from admin UI (Phase 6b)
- Apify task auto-creation (Phase 6b)
- Budget/credit controls for scraping (Phase 6b)

---

## 2. Expert Panel Review

### Technical Architect

**Key recommendations:**
- **Migration first, UI later.** The dashboard is blocked on real data. A migration takes 30 minutes. Building admin UI first creates a circular dependency.
- **Selector state: localStorage + hook param.** Use `localStorage` keyed by `groupId` for persistence. The `useReviewDashboard` hook receives `selectedRestaurantId` as a parameter. No URL params (operators share screenshots, not URLs). No DB preference column yet (Phase 8 territory).
- **Abstract restaurant availability.** Create `useAvailableRestaurants()` hook that today returns all own restaurants, but can later filter by `org_assignments` in Phase 8.
- **AI URL discovery via edge function** using `gpt-4o-mini` (NOT `gpt-5-mini` — avoid known compatibility issues). Returns structured JSON with confidence scores. Admin confirms before saving.

### Database Expert

**Key recommendations:**
- **UPDATE fake restaurants in place, do not DELETE.** Keep deterministic UUIDs stable (`11111111...` through `44444444...`). All FK chains (reviews, analyses, rollups, scrape_runs) stay intact. Then DELETE the synthetic seed review data separately.
- **Add `display_name` column** to `tracked_restaurants` for short chart labels (e.g., "Fleming's CG" instead of "Fleming's Prime Steakhouse & Wine Bar - Coral Gables").
- **Keep Pisco y Nazca** (`66666666...`) — it has 25 real analyzed reviews, the only end-to-end pipeline proof.
- **No user preference column yet.** localStorage is sufficient. A `primary_restaurant_id` on `group_memberships` can be added in Phase 8 when `org_assignments` lands.

### UX/UI Expert

**Key recommendations:**
- **Selector placement: left of tab pills**, above tabs on mobile. Uses shadcn `Select`. If only 1 own restaurant, render as static label (no dropdown).
- **Selector affects ALL 5 tabs.** Company tab highlights the selected restaurant.
- **Admin-only gating:** Gear icon (`Settings` from Lucide) visible only for `isAdmin`. Non-admins never see settings link. No disabled/locked UI for operators — just omit it entirely.
- **AI URL discovery inline** in the Add Restaurant dialog as an optional helper button, not a separate step. Each platform result confirmed independently.
- **Empty state for 0 restaurants:** Admins see "Add your first restaurant" CTA. Non-admins see "Your admin hasn't set up review tracking yet."
- **Refetch transition:** Opacity fade on tab content during restaurant switch, not full skeleton remount.
- **Persist selection:** `localStorage` keyed by `review-dashboard-selected-restaurant-${groupId}`.

### Devil's Advocate

**Issues raised and resolutions:**

| Issue | Severity | Resolution |
|-------|----------|------------|
| **Sequencing: CRUD before data wiring** | High | Agreed — seed migration first (5b.1), then selector + data wiring (5b.2), then admin CRUD (5b.3). No UI until data flows. |
| **AI URL discovery is over-engineering** | Medium | Downgraded to optional (5b.4). Admin can paste URLs manually. Only 5 restaurants to set up. |
| **Pisco y Nazca has real data** | Medium | Keep it. Do not delete. It's the pipeline proof. |
| **Real restaurant names + mock data = uncanny valley** | High | Show empty states ("No reviews ingested yet") for restaurants with 0 reviews, not mock data. |
| **Phase 8 overlap on user assignment** | Medium | Do not build user-restaurant assignment. All users in a group see all restaurants. Phase 8 handles scoping. |
| **gpt-5-mini fragility for new AI features** | Low | Use `gpt-4o-mini` for URL discovery (stable, no compatibility issues). Reserve `gpt-5-mini` for extraction only. |
| **Selector is a data-flow concern, not admin concern** | Medium | Agreed — selector lives in Phase 5b.2 (data wiring), not in admin CRUD. |

---

## 3. Resolved Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fake data replacement | **UPDATE in place** (keep UUIDs) | FK chains stable, no cascade risk |
| Pisco y Nazca | **Keep** | 25 real reviews = pipeline proof |
| Selector state management | **localStorage + hook param** | No global state, no DB column, shareable later |
| Selector scope | **All 5 tabs** | `primaryOwn.id` used in 12+ RPC calls |
| Admin gating | **Hide entirely for non-admins** | No disabled UI, no confusion |
| AI URL discovery | **Optional, Phase 5b.4** | Manual paste sufficient for MVP |
| AI model for URL discovery | **gpt-4o-mini** | Stable, no compatibility issues |
| User-restaurant assignment | **Deferred to Phase 8** | `org_hierarchy` + `org_assignments` handles this properly |
| `display_name` column | **Add in 5b.1 migration** | Charts need short labels |
| Build order | **Migration → Selector → Data wiring → Admin CRUD → AI discovery** | Unblock dashboard first |

---

## 4. Implementation Phases

```
Phase 5b.1 — Seed Real Restaurants (migration only, no UI)
    │
    ▼
Phase 5b.2 — Restaurant Selector + Dashboard Data Wiring
    │         (selector component + useReviewDashboard receives restaurantId)
    │         (empty states for 0-review restaurants)
    │
    ▼
    ┌── Trigger real Apify scrape for Fleming's ──┐
    │   (manual, via Apify console or curl)        │
    │   → ingest-reviews → analyze-review → rollups│
    └──────────────────────────────────────────────┘
    │
    ▼
Phase 5b.3 — Admin CRUD Settings Page
    │         (/admin/reviews/restaurants)
    │         (RestaurantForm, CompetitorForm, PipelineHealth)
    │
    ▼
Phase 5b.4 — AI URL Discovery (optional)
              (discover-restaurant-urls edge function)
              (inline helper in RestaurantForm)
```

---

## 5. Phase 5b.1 — Seed Real Restaurants

### Migration: `YYYYMMDDHHMMSS_seed_real_restaurants.sql`

**Strategy:** UPDATE the 4 fake restaurants in place (preserving UUIDs). Delete synthetic review data. Keep Pisco y Nazca untouched. Add `display_name` column.

#### 5.1.1 Add `display_name` column

```sql
ALTER TABLE public.tracked_restaurants
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.tracked_restaurants.display_name IS
  'Short label for charts and rankings UI (e.g., "Fleming''s CG"). Falls back to name if NULL.';
```

#### 5.1.2 Update fake restaurants to real ones

```sql
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- 1. Alamo Prime Steakhouse → Fleming's Prime Steakhouse (Coral Gables)
  UPDATE public.tracked_restaurants SET
    name            = 'Fleming''s Prime Steakhouse & Wine Bar - Coral Gables',
    display_name    = 'Fleming''s CG',
    slug            = 'flemings-coral-gables',
    google_place_id = '<REAL_GOOGLE_PLACE_ID>',
    google_place_url = '<REAL_GOOGLE_URL>',
    opentable_url   = '<REAL_OPENTABLE_URL>',
    tripadvisor_url = '<REAL_TRIPADVISOR_URL>',
    address         = '2525 Ponce De Leon Blvd',
    city            = 'Coral Gables',
    state           = 'FL',
    zip             = '33134',
    latitude        = 25.7506000,
    longitude       = -80.2620000,
    scrape_enabled  = true
  WHERE id = '11111111-1111-1111-1111-111111111111'
    AND group_id = v_group_id;

  -- 2. Longhorn & Ember → Competitor #1 (real restaurant)
  UPDATE public.tracked_restaurants SET
    name            = '<REAL_COMPETITOR_1_NAME>',
    display_name    = '<SHORT_NAME>',
    slug            = '<slug>',
    google_place_id = '<REAL>',
    google_place_url = '<REAL>',
    opentable_url   = '<REAL>',
    tripadvisor_url = '<REAL>',
    address         = '<REAL>',
    city            = 'Coral Gables', state = 'FL', zip = '<REAL>',
    latitude        = NULL, longitude = NULL
  WHERE id = '22222222-2222-2222-2222-222222222222'
    AND group_id = v_group_id;

  -- 3. Salt & Sear → Competitor #2
  -- (same pattern)

  -- 4. Mesquite Flame → Competitor #3
  -- (same pattern)

  -- 5. Alamo Prime Westside → Competitor #4 OR keep as second own unit
  -- Decision: UPDATE to 4th competitor, linking to Fleming's
  UPDATE public.tracked_restaurants SET
    name            = '<REAL_COMPETITOR_4_NAME>',
    display_name    = '<SHORT_NAME>',
    slug            = '<slug>',
    restaurant_type = 'competitor',
    parent_unit_id  = '11111111-1111-1111-1111-111111111111',
    google_place_id = '<REAL>',
    google_place_url = '<REAL>',
    opentable_url   = '<REAL>',
    tripadvisor_url = '<REAL>',
    address         = '<REAL>',
    city            = '<REAL>', state = 'FL', zip = '<REAL>',
    scrape_enabled  = true
  WHERE id = '55555555-5555-5555-5555-555555555555'
    AND group_id = v_group_id;

END $$;
```

**Note:** The actual restaurant names and URLs will be researched at implementation time. Fleming's Prime Steakhouse Coral Gables is confirmed from previous Apify test runs. Competitors should be real steakhouses in the Coral Gables/Miami area (e.g., STK Miami, Morton's The Steakhouse, The Capital Grille Coral Gables, Ruth's Chris Steak House).

#### 5.1.3 Clean synthetic data

```sql
-- Delete synthetic seed reviews (cascades to review_analyses via ON DELETE CASCADE)
DELETE FROM public.restaurant_reviews
WHERE platform_review_id LIKE 'seed-%';

-- Wipe stale rollups for updated restaurants
DELETE FROM public.flavor_index_daily
WHERE restaurant_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

DELETE FROM public.review_intelligence
WHERE restaurant_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

DELETE FROM public.scrape_runs
WHERE restaurant_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);
```

#### 5.1.4 Update dashboard helpers to use `display_name`

```sql
-- Update get_dashboard_competitors to return display_name
-- (Applied in Phase 5b.2 alongside other dashboard wiring changes)
```

#### Post-Migration State

| UUID | Name | Type | Parent | Status |
|------|------|------|--------|--------|
| `11111111...` | Fleming's Prime Steakhouse - Coral Gables | own | — | active |
| `22222222...` | (Real competitor #1) | competitor | Fleming's | active |
| `33333333...` | (Real competitor #2) | competitor | Fleming's | active |
| `44444444...` | (Real competitor #3) | competitor | Fleming's | active |
| `55555555...` | (Real competitor #4) | competitor | Fleming's | active |
| `66666666...` | Pisco y Nazca (Doral) | own | — | active |

**Pisco y Nazca preserved:** 25 real reviews + analyses remain intact.

---

## 6. Phase 5b.2 — Restaurant Selector + Dashboard Wiring

### 6.1 New Hook: `useSelectedRestaurant`

**File:** `src/hooks/use-selected-restaurant.ts` (~40 lines)

```typescript
// Reads from localStorage, falls back to first own restaurant.
// Returns: { selectedId, setSelectedId, availableRestaurants }

const STORAGE_KEY = (groupId: string) =>
  `review-dashboard-selected-restaurant-${groupId}`;

export function useSelectedRestaurant(
  ownRestaurants: TrackedRestaurant[],
  groupId: string | null,
) {
  // 1. Read from localStorage
  // 2. Validate it exists in ownRestaurants (may have been archived)
  // 3. Fall back to ownRestaurants[0]
  // 4. setSelectedId writes to localStorage and updates state
}
```

**Phase 8 migration path:** When `org_assignments` lands, the `ownRestaurants` input list gets filtered by user assignment. The hook itself doesn't change.

### 6.2 New Component: `RestaurantSelector`

**File:** `src/components/reviews/RestaurantSelector.tsx` (~60 lines)

```
DESKTOP:
| [v Fleming's CG ▾] [⚙] [Overview|Food|Staff|Cat|Co] [Jan-Feb] [Export] |

MOBILE:
| [v Fleming's CG ▾]                                                      |
| [ ☰ ] [ 🍽 ] [ 👥 ] [ ☐ ] [ 🏢 ]                                      |
```

**Behavior:**
- Uses shadcn `Select` component
- Shows `display_name ?? name` for each own restaurant
- If only 1 own restaurant: renders static label (no dropdown arrow)
- Gear icon (`Settings` from Lucide) next to selector, visible only for `isAdmin`
- On change: writes to localStorage, triggers React Query refetch via `selectedId` in query key

### 6.3 Dashboard Hook Changes

**File:** `src/hooks/use-review-dashboard.ts`

```typescript
// BEFORE (line 91):
const primaryOwn = ownRestaurants[0];

// AFTER:
export function useReviewDashboard(
  dateRange: { from: Date; to: Date },
  locale: string = 'en-US',
  selectedRestaurantId?: string | null,  // NEW PARAM
) {
  // ...
  const primaryOwn = selectedRestaurantId
    ? ownRestaurants.find(r => r.id === selectedRestaurantId) ?? ownRestaurants[0]
    : ownRestaurants[0];
```

Add `selectedRestaurantId` to the `queryKey` array. Everything downstream already uses `primaryOwn.id`.

### 6.4 Empty States

For restaurants with 0 reviews (no data yet):

```
┌──────────────────────────────────────────────────────────────┐
│  Flavor Index                                                │
│                                                              │
│  —— (no data yet)                                            │
│                                                              │
│  Reviews are collected automatically.                        │
│  First results typically appear within 24 hours.             │
│                                                              │
│  Platform status:                                            │
│    ✅ Google Maps — connected                                │
│    ✅ OpenTable — connected                                  │
│    ⚠️  TripAdvisor — no URL (add in settings)               │
└──────────────────────────────────────────────────────────────┘
```

For 0 restaurants configured:
- **Admins:** "No restaurants configured yet" + `[+ Add Restaurant]` button
- **Non-admins:** "Your admin hasn't set up review tracking yet."

### 6.5 Refetch Transition

When restaurant selection changes, apply opacity fade instead of full skeleton:

```tsx
<div className={cn(
  "space-y-4 transition-opacity duration-200",
  isLoading && "opacity-50 pointer-events-none"
)}>
  {/* tab content */}
</div>
```

### 6.6 File Inventory

| # | File | ~Lines | Purpose |
|---|------|--------|---------|
| 1 | `src/hooks/use-selected-restaurant.ts` | ~40 | localStorage persistence + fallback logic |
| 2 | `src/components/reviews/RestaurantSelector.tsx` | ~60 | Dropdown component |
| 3 | `src/hooks/use-review-dashboard.ts` | modify | Add `selectedRestaurantId` param |
| 4 | `src/pages/ReviewDashboard.tsx` | modify | Wire selector + empty states |

---

## 7. Phase 5b.3 — Admin CRUD Settings Page

> **Note:** This incorporates ALL scope from `06-phase-admin-manage-units.md` Phase 6a. The Phase 6 plan remains the authoritative reference for component specs, bilingual labels, and edge cases. This section summarizes and adds the resolved changes.

### 7.1 Pre-Requisite Migration

**File:** `YYYYMMDDHHMMSS_phase5b3_admin_functions.sql`

From Phase 6 plan (unchanged):
- `get_pipeline_health()` — pipeline monitoring RPC
- `get_admin_restaurant_list()` — admin list with aggregates (updated to use `COALESCE(tr.display_name, tr.name)`)
- `generate_restaurant_slug()` — auto-slug trigger
- `cascade_archive_competitors()` — archive cascade trigger
- Fix `enforce_max_competitors()` — exclude archived from count
- New index: `idx_scrape_runs_restaurant_platform`

### 7.2 Page: `/admin/reviews/restaurants`

**Admin-only route.** Non-admin users redirected to `/admin/reviews`.

Two tabs:
1. **Restaurants** — grouped list (own restaurants with nested competitors)
2. **Pipeline Health** — extraction queue + failed runs

```
DESKTOP:
┌─────────────────────────────────────────────────────────────────────┐
│ [←] Restaurant Settings                         [+ Add Restaurant] │
├─────────────────────────────────────────────────────────────────────┤
│  [Restaurants]  [Pipeline Health]                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Fleming's Prime Steakhouse - CG ──────── [Active] [⋯ Edit]    │
│  │  2525 Ponce De Leon Blvd, Coral Gables, FL                      │
│  │  ✅ Google  ✅ OpenTable  ✅ TripAdvisor  |  Reviews: 47        │
│  │                                                                  │
│  │  Competitors (4/4)                                               │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │  │ STK Miami │ │ Morton's  │ │ Capital G │ │ Ruth's Ch │      │
│  │  │ ✅✅✅   │ │ ✅✅⚪   │ │ ✅✅✅   │ │ ✅✅✅   │      │
│  │  │[Edit][Del]│ │[Edit][Del]│ │[Edit][Del]│ │[Edit][Del]│      │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘      │
│  └──────────────────────────────────────────────────────────────────│
│                                                                     │
│  ┌─ Pisco y Nazca (Doral) ──────────────────── [Active] [⋯ Edit]  │
│  │  25 reviews analyzed | Competitors (0/4)    [+ Add Competitor]   │
│  └──────────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 File Inventory (from Phase 6 plan)

**New files (9):**

| # | File Path | ~Lines | Purpose |
|---|-----------|--------|---------|
| 1 | `supabase/migrations/YYYYMMDD_phase5b3_admin_functions.sql` | ~150 | PG functions, triggers, index |
| 2 | `src/types/reviews-admin.ts` | ~80 | TypeScript interfaces |
| 3 | `src/hooks/use-tracked-restaurants.ts` | ~180 | React Query CRUD |
| 4 | `src/hooks/use-scrape-runs.ts` | ~120 | Pipeline health RPC |
| 5 | `src/pages/AdminReviewRestaurants.tsx` | ~180 | Main admin page (2 tabs) |
| 6 | `src/components/reviews/admin/RestaurantList.tsx` | ~200 | Grouped list |
| 7 | `src/components/reviews/admin/RestaurantForm.tsx` | ~220 | Add/edit dialog |
| 8 | `src/components/reviews/admin/CompetitorForm.tsx` | ~180 | Add/edit competitor dialog |
| 9 | `src/components/reviews/admin/PipelineHealthPanel.tsx` | ~120 | Queue + failures panel |

**Modified files (2):**

| # | File Path | Change |
|---|-----------|--------|
| 1 | `src/App.tsx` | Add lazy route for `/admin/reviews/restaurants` |
| 2 | `src/pages/ReviewDashboard.tsx` | Gear icon link (admin-only) |

### 7.4 Platform URL Validation

Client-side regex constants (from Phase 6 plan):

```typescript
const URL_PATTERNS = {
  google: /^https?:\/\/(www\.)?google\.com\/maps\//,
  opentable: /^https?:\/\/(www\.)?opentable\.com\//,
  tripadvisor: /^https?:\/\/(www\.)?tripadvisor\.com\/Restaurant/,
};
```

Show inline warnings, but do NOT block form submission. Some URLs have unusual formats.

### 7.5 Competitor Form — Parent Pre-Selection

When adding a competitor from within an own restaurant's card, the parent is pre-selected. Show "X of 4 max" progress indicator. Disable submit when count >= 4.

---

## 8. Phase 5b.4 — AI URL Discovery (Optional)

> **Devil's Advocate note:** This is a convenience feature, not a blocker. Admins can paste URLs manually. Recommended only after 5b.1–5b.3 are complete and working.

### 8.1 Edge Function: `discover-restaurant-urls`

**File:** `supabase/functions/discover-restaurant-urls/index.ts` (~150 lines)

**Input:**
```json
{
  "name": "Fleming's Prime Steakhouse",
  "city": "Coral Gables",
  "state": "FL"
}
```

**Output:**
```json
{
  "google_place_url": "https://www.google.com/maps/place/...",
  "opentable_url": "https://www.opentable.com/r/flemings-...",
  "tripadvisor_url": "https://www.tripadvisor.com/Restaurant_Review-...",
  "confidence": "high"
}
```

**Model:** `gpt-4o-mini` (NOT `gpt-5-mini` — avoid known compatibility issues).

**Cost:** ~$0.001 per call. Log to `ai_usage_log` with `operation_type = 'url_discovery'`.

**Important limitation:** LLMs cannot browse the web. URLs are best-effort based on training data. The `confidence` field signals this. Admin must verify before saving.

### 8.2 Form Integration

Inline "Find URLs automatically" button in `RestaurantForm.tsx`:
- Disabled until name has 3+ characters
- Shows per-platform results with restaurant name + star rating for verification
- Each platform result accepted independently via "Use this" / "Not this one"
- Non-blocking — admin can always paste URLs manually

### 8.3 File Inventory

| # | File | ~Lines | Purpose |
|---|------|--------|---------|
| 1 | `supabase/functions/discover-restaurant-urls/index.ts` | ~150 | Edge function |
| 2 | `src/components/reviews/admin/RestaurantForm.tsx` | modify | Add AI helper button |

---

## 9. Phase 8 Alignment — User Assignments

This plan is explicitly designed to NOT conflict with Phase 8's `org_hierarchy` + `org_assignments`:

| This Plan (5b) | Phase 8 | Compatibility |
|-----------------|---------|---------------|
| `useSelectedRestaurant()` reads from all own restaurants | Phase 8 filters by `org_assignments` | Hook receives filtered list — no code change |
| localStorage for selection persistence | Phase 8 may add `primary_restaurant_id` to `group_memberships` | localStorage is overridden by DB preference when available |
| Admin-only CRUD on `tracked_restaurants` | Phase 8 adds `org_hierarchy` for multi-unit scoping | CRUD page gets additional hierarchy UI in Phase 8 |
| All users see all restaurants in their group | Phase 8 scopes visibility by org node | RLS policies updated in Phase 8 migration |

**No throwaway work.** Every component built here continues to function after Phase 8.

---

## 10. Verification Checklist

### Phase 5b.1 — Migration
- [ ] `tracked_restaurants` has 6 rows: Fleming's (own) + 4 competitors + Pisco y Nazca (own)
- [ ] All 5 updated restaurants have real platform URLs
- [ ] `display_name` column exists and is populated for all 6 restaurants
- [ ] Synthetic seed reviews deleted (`platform_review_id LIKE 'seed-%'` returns 0)
- [ ] Pisco y Nazca reviews untouched (25 reviews, 25 analyses)
- [ ] Stale rollups deleted for updated restaurant IDs
- [ ] `npx supabase db push` succeeds

### Phase 5b.2 — Selector + Data Wiring
- [ ] Restaurant selector dropdown visible on dashboard
- [ ] Switching restaurant changes all 5 tabs' data
- [ ] Selection persists in localStorage across page reloads
- [ ] If only 1 own restaurant: static label, no dropdown
- [ ] Gear icon visible for admins, hidden for non-admins
- [ ] Empty state shown for restaurants with 0 reviews
- [ ] Opacity fade transition during restaurant switch
- [ ] `tsc --noEmit` → 0 errors

### Phase 5b.3 — Admin CRUD
- [ ] `/admin/reviews/restaurants` route works (admin-only)
- [ ] Non-admins redirected to `/admin/reviews`
- [ ] Restaurant list shows own restaurants with nested competitors
- [ ] Add/edit own restaurant dialog works
- [ ] Add/edit competitor dialog works (max 4 validated)
- [ ] Archive restaurant cascades to competitors
- [ ] Platform URL validation shows inline warnings
- [ ] Pipeline health tab shows queue depth + failed runs
- [ ] All text switches EN ↔ ES
- [ ] `tsc --noEmit` → 0 errors

### Phase 5b.4 — AI URL Discovery (optional)
- [ ] Edge function deployed (`discover-restaurant-urls`)
- [ ] "Find URLs" button in RestaurantForm works
- [ ] Results show per-platform confirmation with restaurant name
- [ ] Admin can accept/reject each platform independently
- [ ] Usage logged to `ai_usage_log`
- [ ] Manual URL paste still works without AI

---

## Appendix: Real Restaurant Research (for 5b.1 Migration)

The following real restaurants near Coral Gables, FL are candidates for Fleming's competitors. Final selection should be confirmed at implementation time by verifying their presence on all 3 platforms:

**Fleming's Prime Steakhouse & Wine Bar - Coral Gables**
- Address: 2525 Ponce De Leon Blvd, Coral Gables, FL 33134
- Confirmed on: Google Maps, OpenTable, TripAdvisor (from previous Apify test runs)

**Competitor candidates (steakhouses in Coral Gables / Miami area):**
1. The Capital Grille - Coral Gables (Merrick Park)
2. Morton's The Steakhouse - Coral Gables
3. STK - Miami Beach (or Midtown Miami)
4. Ruth's Chris Steak House - Coral Gables

All 4 are well-known steakhouse chains present on Google, OpenTable, and TripAdvisor. Exact URLs to be confirmed during implementation.
