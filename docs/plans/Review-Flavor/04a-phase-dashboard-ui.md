# Plan: Phase 4a — Review & Flavor Index Dashboard (UI-First)

## Context

Phases 1-3 are complete: DB foundation (8 tables, 28 RLS policies), Apify ingestion (40+ live reviews), and rollup engine (5 migrations, pg_cron at 4AM UTC). The database has 307 `flavor_index_daily` rows and 24 `review_intelligence` rows from seed data, plus live rollups from 40 scraped reviews. **Phase 4a builds the front-end dashboard** — the first visual layer on top of this data.

**User directive:** Build the UI first with mock data, then wire to Supabase hooks later. This means all components accept props and a mock data file provides realistic static data.

**Key constraint from Devil's Advocate analysis:** The Insights tab (staff spotlight, emotion distribution, top mentions) depends entirely on `review_analyses` — which has 0 rows for real reviews (AI extraction is Phase 4b). Building this tab now would show only seed data or empty states. **Solution:** Ship with 2 tabs (Overview + Compete) now. Add Insights tab after Phase 4b delivers real analysis data.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tab structure | 2 tabs: Overview + Compete (defer Insights) | Insights tab is 100% empty without AI extraction (Phase 4b) |
| Time periods | 3 options: 30d / 90d / YTD | 7+ options is overengineered for MVP. Custom range deferred. |
| Sparkline | Weekly-bucketed bar chart, not daily line | Daily data with low volume (1-2 reviews/day) produces misleading zigzag |
| Data approach | Mock data props → wire later | Per user directive. Mock shapes match exact DB return types. |
| Route | `/admin/reviews` | Follows admin route pattern (`/admin/training`, `/admin/forms`) |
| Access | manager + admin only | Same as ManagerTrainingDashboard (via ProtectedRoute) |
| Charts | Recharts (already installed) + shadcn chart wrappers | `src/components/ui/chart.tsx` exists but never used — first usage |

---

## File Structure (18 new files + 4 modified)

### New Files

```
src/types/reviews.ts                          — Types, FLAVOR_ZONES, FLAVOR_CATEGORIES constants
src/lib/flavor-utils.ts                       — getFlavorZone(), formatFlavorScore(), formatDelta()
src/data/mock-reviews.ts                      — Static mock data matching DB shapes
src/pages/ReviewDashboard.tsx                 — Page: AppShell + Tabs + period selector + mock dispatch

src/components/reviews/FlavorHeroCard.tsx      — Hero KPI: score, zone label, delta, distribution bar
src/components/reviews/StarDistributionBar.tsx — Segmented horizontal bar (green/amber/red)
src/components/reviews/FlavorSparkline.tsx     — Recharts AreaChart (mini, no axes, 40px height)
src/components/reviews/CategoryBreakdown.tsx   — 4 progress bars (food/service/ambience/value)
src/components/reviews/SeverityAlerts.tsx      — High-severity flag alert cards
src/components/reviews/TimePeriodSelector.tsx  — Segmented pill bar (30d | 90d | YTD)
src/components/reviews/CompetitorCard.tsx      — Single competitor score card
src/components/reviews/CompetitorGrid.tsx      — Horizontal scroll (mobile) / grid (desktop)
src/components/reviews/TrendChart.tsx          — Recharts multi-line chart + toggle chips
src/components/reviews/ReviewEmptyState.tsx    — Onboarding card (no reviews yet)
src/components/reviews/ReviewSkeleton.tsx      — Loading skeleton layout
src/components/reviews/index.ts               — Barrel export
```

### Modified Files

```
src/App.tsx                                   — Add /admin/reviews route
src/components/layout/Sidebar.tsx             — Add ANALYTICS section + Insights nav item
src/components/layout/MobileTabBar.tsx        — Add Insights nav item (if applicable)
src/index.css                                 — Add --flavor-* CSS variables
```

---

## Component Hierarchy

```
ReviewDashboard (page)
├── AppShell (layout wrapper)
│   ├── Header row: h1 title + TimePeriodSelector
│   ├── Loading → ReviewSkeleton
│   ├── Error → AlertCircle + retry
│   ├── Empty → ReviewEmptyState
│   └── Tabs (defaultValue="overview")
│       ├── Tab "overview"
│       │   ├── FlavorHeroCard
│       │   │   ├── Score number (color-coded by zone)
│       │   │   ├── Zone label + delta badge
│       │   │   ├── StarDistributionBar
│       │   │   └── FlavorSparkline + total reviews count
│       │   ├── CategoryBreakdown (4 progress bars)
│       │   └── SeverityAlerts (conditional, hidden if count=0)
│       └── Tab "compete"
│           ├── CompetitorGrid
│           │   └── CompetitorCard (x N, 1-4 competitors + own)
│           └── TrendChart (multi-line + toggle chips)
```

---

## Key Component Specs

### FlavorHeroCard
- Score: `text-5xl` mobile / `text-6xl` desktop, `font-mono tabular-nums`, color = zone hex
- Zone label: below score, same color, `text-sm font-semibold`
- Delta: `Badge` with TrendingUp/TrendingDown icon, "+4.2 from last period"
- Star bar: 3-segment `h-3 rounded-full` (green/amber/red), percentage widths
- Sparkline: `AreaChart` 40px height, zone color stroke, 10% fill opacity
- Card: shadcn `<Card>` with `<CardContent>`

### CompetitorCard
- Own restaurant: `border-primary/50` accent border + "You" badge
- Score: `text-3xl`, color-coded by zone
- Mini distribution bar + review count + avg rating
- Mobile: `w-[280px] snap-start shrink-0` in horizontal scroll
- Desktop: auto-width in `md:grid md:grid-cols-2 lg:grid-cols-3`

### TrendChart
- Recharts `<LineChart>` inside `<ChartContainer>`
- Own line: `strokeWidth={3}`, competitors: `strokeWidth={1.5}`
- Y-axis: -100 to +100, reference line at 0
- Toggle chips above chart (button per competitor, colored dot + name)
- Competitor colors: `#2aa962` (own), `#6366F1`, `#EC4899`, `#8B5CF6`, `#F97316`

### TimePeriodSelector
- Follows `LanguageToggle` pill-bar pattern
- 3 pills: `30d | 90d | YTD`
- Container: `inline-flex rounded-full bg-muted p-0.5`
- Active: `bg-background text-foreground shadow-sm`
- ARIA: `role="radiogroup"`

### CategoryBreakdown
- 4 rows: Food Quality, Service, Ambience, Value
- Each: label (w-24) + progress bar (h-2, colored by value) + score label
- Color thresholds: >0.6 green, >0.3 amber, >0 red
- NULL sentiment → dashed border bar + "Coming soon" italic text
- Bilingual labels: Food Quality/Calidad de Comida, etc.

---

## Color System

### CSS Variables (add to `src/index.css` `:root`)
```css
--flavor-world-class: 160 84% 39%;      /* #10B981 */
--flavor-excellent: 142 71% 45%;         /* #22C55E */
--flavor-great: 84 81% 44%;             /* #84CC16 */
--flavor-good: 38 92% 50%;              /* #F59E0B */
--flavor-needs-improvement: 0 84% 60%;   /* #EF4444 */
--flavor-loving: 142 71% 45%;           /* green — 5-star */
--flavor-fence: 38 92% 50%;             /* amber — 4-star */
--flavor-not-feeling: 0 84% 60%;         /* red — 1-3 star */
```

### Zone → Color Mapping (TypeScript)
Already defined in `FLAVOR_ZONES` constant from `01-phase-seed-and-frontend-prep.md`. Copy directly into `src/types/reviews.ts`.

---

## Mock Data Strategy

**File:** `src/data/mock-reviews.ts`

All mock data exports match exact DB return types for seamless hook replacement later.

| Export | Shape | Source |
|--------|-------|--------|
| `MOCK_FLAVOR_SUMMARY` | `{ score, zone, avgRating, totalReviews, delta, fiveStar, fourStar, threeStar, twoStar, oneStar, sparklineData }` | Alamo Prime seed: FI=+75.33, 150 reviews |
| `MOCK_CATEGORIES` | `[{ category, label, score }]` | food=0.85, service=0.70, ambience=0.73, value=0.51 |
| `MOCK_SEVERITY_ALERTS` | `[{ id, type, summary, date, restaurantName }]` | 2 flags from seed (health_safety + staff_conduct) |
| `MOCK_COMPETITORS` | `[{ restaurantId, name, isOwn, score, delta, avgRating, totalReviews }]` | 4 restaurants: Alamo +75, Longhorn +48, Salt&Sear +25, Mesquite -5 |
| `MOCK_TREND_DATA` | `[{ date, [restaurantName]: score }]` | ~12 weekly data points Dec-Feb for each restaurant |
| `MOCK_TRACKED_RESTAURANTS` | `[{ id, name, slug, restaurant_type, parent_unit_id, status }]` | 4 active restaurants |

**Consumption:** Page imports all MOCK_* constants, passes as props. When hooks are wired later, replace `MOCK_FLAVOR_SUMMARY` with `flavorData` from `useFlavorIndex()` — zero child component changes.

---

## Routing & Navigation

### App.tsx
```tsx
<Route path="/admin/reviews" element={
  <ProtectedRoute requiredRole={['manager', 'admin']}>
    <ReviewDashboard />
  </ProtectedRoute>
} />
```

### Sidebar.tsx
- Add `ANALYTICS` section header above `/admin/reviews`
- Nav item: `{ path: '/admin/reviews', label: 'Insights', icon: 'BarChart3' }`

---

## Responsive Design

| Breakpoint | Behavior |
|-----------|----------|
| < 768px (mobile) | Score `text-5xl`, competitor cards horizontal scroll (`snap-x`), trend chart `aspect-[16/9]`, category bars stacked, abbreviated NPS labels |
| >= 768px (tablet) | Score `text-6xl`, competitor cards `grid-cols-2`, chart `aspect-[2/1]`, category bars `grid-cols-2`, full NPS labels |
| >= 1024px (desktop) | Competitor cards `grid-cols-3`, wider chart |

---

## Step 0: Visual Prototype (Pre-Implementation)

Before writing any React code, build a standalone HTML prototype (`mockups/review-dashboard.html`) that renders the complete dashboard with:

- **Tailwind CDN** + **Chart.js** for zero-dependency browser preview
- **Exact color system**: all `--flavor-*` CSS variables from the design spec
- **Both tabs**: Overview (hero card, star bar, sparkline, category breakdown, severity alerts) + Compete (competitor grid, trend chart)
- **Dark mode toggle**: Matches the app's dark theme (`--background`, `--card`, `--foreground`)
- **EN/ES language toggle**: All labels switch between English and Spanish
- **Responsive**: Correct behavior at 375px (mobile), 768px (tablet), 1024px+ (desktop)
- **Realistic mock data**: Alamo Prime FI=+75.33, Longhorn +48.00, Salt&Sear +25.00, Mesquite -5.00

**Purpose:** Align on exact visual design before investing in React component code. The prototype is disposable — it exists only for design review. Once approved, implementation follows Steps 1-6.

**Acceptance:** Open `mockups/review-dashboard.html` in browser, verify all components render correctly in both light/dark mode, both languages, and at mobile/desktop widths.

---

## Implementation Order (7 Steps)

### Step 1: Foundation
1. `src/types/reviews.ts` — all types + FLAVOR_ZONES/CATEGORIES from seed prep doc
2. `src/lib/flavor-utils.ts` — getFlavorZone(), formatFlavorScore(), formatDelta()
3. `src/index.css` — add `--flavor-*` CSS variables
4. `src/data/mock-reviews.ts` — all mock data

### Step 2: Routing & Navigation Shell
5. `src/lib/constants.ts` — add route constant
6. `src/components/layout/Sidebar.tsx` — add ANALYTICS section + nav item
7. `src/App.tsx` — add route
8. `src/pages/ReviewDashboard.tsx` — minimal page: AppShell + h1 + empty Tabs

### Step 3: Overview Tab
9. `src/components/reviews/FlavorSparkline.tsx`
10. `src/components/reviews/StarDistributionBar.tsx`
11. `src/components/reviews/FlavorHeroCard.tsx` (composes sparkline + bar)
12. `src/components/reviews/CategoryBreakdown.tsx`
13. `src/components/reviews/SeverityAlerts.tsx`
14. Wire Overview tab in ReviewDashboard.tsx

### Step 4: Compete Tab
15. `src/components/reviews/CompetitorCard.tsx`
16. `src/components/reviews/CompetitorGrid.tsx`
17. `src/components/reviews/TrendChart.tsx` (with toggle chips)
18. Wire Compete tab in ReviewDashboard.tsx

### Step 5: Period Selector + States
19. `src/components/reviews/TimePeriodSelector.tsx`
20. `src/components/reviews/ReviewSkeleton.tsx`
21. `src/components/reviews/ReviewEmptyState.tsx`
22. `src/components/reviews/index.ts` — barrel export
23. Wire period selector, loading, error, empty states

### Step 6: Bilingual Labels + Polish
24. EN/ES STRINGS objects in each component
25. Dark mode verification
26. Mobile testing at 375px
27. Accessibility: ARIA labels on bars, radiogroup on period selector

---

## Bilingual Labels (EN/ES)

| Element | EN | ES |
|---------|----|----|
| Page title | Review Insights | Perspectivas de Reseñas |
| Overview tab | Overview | Resumen |
| Compete tab | Compete | Competencia |
| Flavor Index | Flavor Index | Índice de Sabor |
| World-Class | World-Class | Clase Mundial |
| Excellent | Excellent | Excelente |
| Great | Great | Muy Bueno |
| Good | Good | Bueno |
| Needs Improvement | Needs Improvement | Necesita Mejorar |
| Loving the Flavor | Loving the Flavor | Amando el Sabor |
| On the Fence | On the Fence | Indecisos |
| Not Feeling It | Not Feeling It | Sin Sabor |
| Total Reviews | Total Reviews | Total de Reseñas |
| from last period | from last period | del periodo anterior |
| Food Quality | Food Quality | Calidad de Comida |
| Service | Service | Servicio |
| Ambience | Ambience | Ambiente |
| Value | Value | Valor |
| Coming soon | Coming soon | Próximamente |
| High Severity Alerts | High Severity Alerts | Alertas de Alta Severidad |

---

## What's Explicitly Deferred

| Item | Deferred To | Reason |
|------|-------------|--------|
| Insights tab (staff, emotions, top mentions) | After Phase 4b (AI extraction) | 0 real review_analyses rows — entire tab would be empty |
| Custom date range picker | Phase 5 | Overengineered for MVP |
| "This Week" / "This Month" / "This Quarter" periods | Phase 5 | 30d/90d/YTD covers 90% of use cases |
| Restaurant selector dropdown | Phase 8 (multi-unit) | Single-unit user sees their primary restaurant |
| Data freshness indicator | Phase 5 | Nice-to-have polish |
| Supabase hooks (real data wiring) | Phase 4a-WIRE (separate step) | User wants UI first, wire later |

---

## Verification

1. Navigate to `/admin/reviews` — page loads with Overview tab active
2. Flavor Index hero shows +75.3, "World-Class", green color, "+4.0 from last period"
3. Star distribution bar: 82% green, 11% amber, 7% red
4. Category breakdown: 4 bars with Food=0.85, Service=0.70, Ambience=0.73, Value=0.51
5. Severity alerts: 2 cards (health_safety + staff_conduct)
6. Switch to Compete tab — 4 competitor cards (Alamo +75, Longhorn +48, Salt&Sear +25, Mesquite -5)
7. Trend chart shows multi-line with toggle chips
8. Switch period selector (30d → 90d → YTD) — UI updates (cosmetic only with mock data)
9. Toggle language EN → ES — all labels switch
10. Mobile at 375px — competitor cards horizontal scroll, chart taller, labels abbreviated
11. Dark mode — all colors render correctly
12. 0 TypeScript errors

---

## Critical Reference Files

| File | Role |
|------|------|
| `src/pages/ManagerTrainingDashboard.tsx` | Primary pattern: AppShell + Tabs + loading/error/empty states |
| `src/components/ui/chart.tsx` | Recharts wrappers: ChartContainer, ChartTooltip, ChartConfig |
| `src/components/ui/language-toggle.tsx` | Pill-bar pattern for TimePeriodSelector |
| `docs/plans/Review-Flavor/01-phase-seed-and-frontend-prep.md` | TypeScript types, CSS vars, bilingual labels (sections 3-4) |
| `src/components/training/DashboardStats.tsx` | Stat card grid pattern |
| `src/components/layout/Sidebar.tsx` | Navigation: section headers + nav items |
