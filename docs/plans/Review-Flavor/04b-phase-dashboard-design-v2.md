# Phase 4b — Review & Flavor Index Dashboard (Design V2)

> **Inspired by:** PulseAI Analytics Overview (NexUX Lab / Imran Hossen, Dribbble)
> **Adapted to:** Alamo Prime design system (Alamo Green, SF Pro/Inter, shadcn/ui, dark mode)
> **Scope:** 5-screen dashboard with AI chatbot, export, and bilingual support

---

## Design Philosophy

The PulseAI dashboard nails a **"Warm Minimal Data"** aesthetic — generous whitespace, soft geometry (16-20px radius), flat-with-depth-hints, and a constrained 2-color data palette. We adopt this exact layout language but replace:

| PulseAI | Alamo Prime |
|---------|-------------|
| Teal/mint data color `#2DD4A8` | Alamo Green `#2aa962` (light) / `#33cc73` (dark) |
| Orange/amber accent `#F59E0B` | Keep amber for warnings; use zone colors for scores |
| Warm off-white `#FAFAF8` | Our canvas `hsl(240 10% 98%)` = `#F7F7FA` |
| Inter/Satoshi font | SF Pro / Inter / Segoe UI system stack |
| No dark mode | Full dark mode with `#0B0B0D` background |
| No i18n | EN/ES bilingual throughout |

**What stays identical to PulseAI:**
- Card border-radius (16px — matches our `--radius-card`)
- Card padding (24-32px)
- Card gap (16-20px)
- Subtle 1px borders, near-zero shadows
- Typographic hierarchy (hero numbers → card titles → labels → subtitles)
- Hatched/striped pattern for "previous period" comparison bars
- Pill-shaped toggles and selectors
- Stacked horizontal bars for distributions
- Top navigation as horizontal pill tabs
- Action icons (expand, download, menu dots) top-right of cards

---

## Screen Architecture (5 Tabs)

Top navigation follows PulseAI's pill-tab pattern — one active (dark fill), rest plain text.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🥩 ALAMO PRIME   [Overview] [Food & Drinks] [Staff] [Categories] [Company]  │
│                                                    🔍  [Jan-Feb 2026]  [⬇ Export]  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Tab | Label EN | Label ES | Icon |
|-----|----------|----------|------|
| 1 | Overview | Resumen | BarChart3 |
| 2 | Food & Drinks | Comida y Bebida | UtensilsCrossed |
| 3 | Staff Shoutouts | Reconocimientos | Users |
| 4 | Categories | Categorías | Layers |
| 5 | Company | Empresa | Building2 |

**Persistent header elements (always visible):**
- Logo/brand mark (top-left)
- Pill tab navigation
- Search icon
- Date range selector (pill with calendar icon)
- Export Report button (dark fill, download icon)
- Language toggle (EN/ES)
- Dark mode toggle (sun/moon)
- AI Chat button (floating, bottom-right)

---

## Screen 1: OVERVIEW (Main Dashboard)

This is the primary screen — maps directly to the PulseAI layout.

### Layout Grid

```
Row 1: [Card A: 3/12] [Card B: 3/12] [Card C: 6/12]
Row 2: [Card D: 6/12]                 [Card E: 6/12]
```

---

### Card A — Trend Summary (maps to PulseAI "Total Cost")

**Title:** "Score Trend" / "Tendencia de Puntaje"
**Subtitle:** "vs. last period" / "vs. periodo anterior"

```
┌──────────────────────────────────┐
│ Score Trend              [↗]     │
│ vs. last period                  │
│                                  │
│   +4.2 pts                       │
│   (large, Alamo Green)           │
│                                  │
│ Current   [████████████░░░]      │
│ Previous  [▒▒▒▒▒▒▒▒▒░░░░░]      │
│                                  │
│ ──────────────────────────────── │
│ Current Score          +75.3     │
└──────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Delta number | `text-3xl font-bold tabular-nums`, colored by direction (green positive, red negative) |
| "Current" bar | Solid fill, color = current zone color (World-Class green for +75.3) |
| "Previous" bar | Hatched pattern (`repeating-linear-gradient(45deg, ...)`) on muted base |
| Bottom row | Divider line 1px `--border`, "Current Score" label left, value right bold |
| Arrow icon | `ArrowUpRight` (Lucide), 16px, `text-muted-foreground` |

**Data source:** `compute_flavor_index_range()` for current period vs previous period. The delta is `review_intelligence.flavor_index_change`.

---

### Card B — Bad Reviews (maps to PulseAI "Avg Cost / Request")

**Title:** "Low Ratings" / "Calificaciones Bajas"
**Subtitle:** "1-3 star reviews" / "Reseñas de 1-3 estrellas"

```
┌──────────────────────────────────┐
│ Low Ratings              [↗]     │
│ 1-3 star reviews                 │
│                                  │
│   6.7%                           │
│   (large, red if >10%, amber     │
│    if 5-10%, green if <5%)       │
│                                  │
│ Current   [████░░░░░░░░░░░]      │
│ Previous  [▒▒▒▒▒░░░░░░░░░]      │
│                                  │
│ ──────────────────────────────── │
│ Total Low Ratings          10    │
└──────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Percentage | `text-3xl font-bold`, red `--flavor-not-feeling` if >10%, amber `--flavor-fence` if 5-10%, green `--flavor-loving` if <5% |
| "Current" bar | Red-tinted fill proportional to bad-review % |
| "Previous" bar | Hatched on muted red |
| Bottom row | Absolute count of 1-3 star reviews |

**Data source:** `flavor_index_daily` aggregated. Bad % = `(one_star + two_star + three_star) / total_reviews * 100`.

---

### Card C — Trailing 12-Month Flavor Index (maps to PulseAI "Total Requests" bar chart)

**Title:** "Flavor Index" / "Índice de Sabor"
**Subtitle:** "Last 12 months" / "Últimos 12 meses"

```
┌────────────────────────────────────────────────────────────────┐
│ Flavor Index        Last 12 months          [⬇] [↗]          │
│                                                                │
│ [Food ●] [Service ●] [Ambience ●] [Value ●]    [Alamo ▾]     │
│                                                                │
│  100 ─                                                         │
│   75 ─  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██       │
│   50 ─  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██       │
│   25 ─  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██       │
│    0 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│  -25 ─                                                         │
│        Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec  Jan  Feb │
│                                                                │
│  Floating tooltip: [+75.3  Feb 2026  ██ mini-breakdown]       │
└────────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Bar style | Rounded top corners (6px), ~40-50px wide, color = zone color for that month's score |
| Highlighted bar | Current month gets amber/orange accent (PulseAI style) to draw attention |
| Zero line | Dashed horizontal reference at 0 |
| Y-axis | -100 to +100 range, labels every 25 pts |
| Toggle chips | Above chart: Food/Service/Ambience/Value — switches between FI bars and category sentiment line overlays |
| Restaurant dropdown | Right-aligned above chart: "Alamo Prime ▾" — switch to any competitor to see their chart |
| Tooltip | Floating card on hover: score value + month + mini star-distribution bar |
| Download icon | Top-right, exports chart as PNG |
| Expand icon | Top-right, opens full-screen chart modal |

**Toggle behavior:**
- Default: Shows Flavor Index bars (monthly)
- Click "Food": Overlays food_sentiment as line chart (-1.0 to +1.0 on secondary Y-axis)
- Multiple toggles can be active simultaneously (multi-line overlay)
- Restaurant dropdown changes all data to that restaurant

**Data source:** `flavor_index_daily` grouped by month. Category sentiments from same table (NULL until AI extraction — show dashed line placeholder).

---

### Card D — Flavor Index by Restaurant (maps to PulseAI "Traffic by Location")

**Title:** "Flavor Index by Restaurant" / "Índice de Sabor por Restaurante"

```
┌──────────────────────────────────────────────────────┐
│ Flavor Index by Restaurant                   [•••]   │
│                                                      │
│ Time: [Month] [Quarter] [Year] [Last Year] [5 Yr] [All] │
│                                                      │
│ 🟢 Alamo Prime     [You] [+4.2 ↑]                   │
│    [██████████████████████████████████░░░░░] +75.3    │
│                                                      │
│ 🟢 Longhorn & Ember       [+2.1 ↑]                  │
│    [████████████████████████████░░░░░░░░░░░] +48.0   │
│                                                      │
│ 🟡 Salt & Sear            [-3.5 ↓]                  │
│    [███████████████████░░░░░░░░░░░░░░░░░░░] +25.0   │
│                                                      │
│ 🔴 Mesquite Flame         [-1.2 ↓]                  │
│    [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  -5.0   │
│                                                      │
│              View Detailed Comparison →               │
└──────────────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Restaurant row | Flag-style colored dot (zone color) + name + optional "You" badge (green pill) + delta badge |
| Progress bar | Full-width, 8px height, rounded ends. Fill proportional to score mapped to 0-200 range (since -100 to +100). Color = zone color |
| Score | Right-aligned, `font-semibold tabular-nums`, colored by zone |
| Delta badge | Small pill: green bg for positive, red bg for negative. Arrow icon + value |
| Time selector | Pill-bar row below title: Month / Quarter / Year / Last Year / 5 Yr / All |
| "View Detailed" | Centered link at bottom, navigates to Company tab |
| Three-dot menu | Top-right, dropdown: "Export as CSV", "Share", "Set as default view" |

**Time selector options:**

| Label EN | Label ES | Date Range |
|----------|----------|------------|
| Month | Mes | Last 30 days |
| Quarter | Trimestre | Last 90 days |
| Year | Año | YTD (Jan 1 → today) |
| Last Year | Año Anterior | Previous calendar year |
| 5 Yr | 5 Años | Last 5 calendar years |
| All | Todo | All available data |

**Data source:** `compute_flavor_index_range(restaurant_id, start, end)` for each restaurant. Delta from `review_intelligence.flavor_index_change`.

---

### Card E — Strengths & Opportunities (maps to PulseAI "System Latency")

**Title:** "Strengths & Opportunities" / "Fortalezas y Oportunidades"
**Subtitle dropdown:** "This Month ▾" / "Este Mes ▾"

```
┌──────────────────────────────────────────────────────┐
│ Strengths & Opportunities        [This Month ▾]     │
│                                                      │
│   +75.3                [↑ World-Class]               │
│   (hero score)                                       │
│                                                      │
│ ● Food 0.85   ● Service 0.70   ● Ambience 0.73   ● Value 0.51 │
│   Quality       Experience        & Clean            & Price    │
│                                                      │
│ [████████████████|██████████|██████|████]             │
│  Food 39%    Service 32%  Ambi 19%  Value 10%        │
│                                                      │
│ ──────────────────────────────────────────────────── │
│                                                      │
│ Top Strengths              Top Opportunities         │
│ 🟢 Food Quality (4.6/5)   🔴 Wait Time (3.1/5)     │
│ 🟢 Presentation (4.3/5)   🟠 Value (2.8/5)         │
│ 🟢 Ambience (4.1/5)       🟠 Reservation (2.5/5)   │
└──────────────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Hero score | `text-4xl font-extrabold tabular-nums`, zone color |
| Zone badge | Green pill "↑ World-Class" |
| 4 stat pills | Colored dot (by threshold) + value bold + category label below in gray. Layout: flex row, space-between |
| Stacked bar | Single horizontal bar divided into 4 segments proportionally (mentions distribution). Each segment colored by category. First segment `rounded-l-lg`, last `rounded-r-lg`, h-4 |
| Segment labels | Below bar: category name + percentage |
| Bottom section | Two columns: Top Strengths (green dots) and Top Opportunities (red/orange dots) with intensity scores |

**Color thresholds for category dots:**
- > 0.6: Green `#22C55E`
- > 0.3: Amber `#F59E0B`
- > 0: Orange `#F97316`
- ≤ 0: Red `#EF4444`
- NULL: Gray dashed `#9CA3AF`

**Data source:** `flavor_index_daily` sentiments (aggregated by period). Strengths/opportunities from `review_intelligence.top_strengths` and `review_intelligence.top_opportunities`. When AI extraction hasn't run yet, show "Awaiting AI analysis" placeholder with dashed borders.

---

## Screen 2: FOOD & DRINKS

**Purpose:** Top-mentioned food items, drinks, wines, cocktails — by category and by restaurant.

### Layout

```
Row 1: [Category Toggle Pills]    [Time: Month/Quarter/Year]
Row 2: [Card A: Top Items Grid — full width]
Row 3: [Card B: By Restaurant 6/12] [Card C: Trending Items 6/12]
```

### Card A — Top Mentioned Items (full width)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Top Mentioned Items                          [Food ●] [Drinks ●] [All ●] │
│                                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│ │ 🥩 Bone-In  │ │ 🧀 Truffle  │ │ 🍸 Classic  │ │ 🥗 Grilled  │   │
│ │ Ribeye      │ │ Mac&Cheese  │ │ Margarita   │ │ Caesar      │   │
│ │             │ │             │ │             │ │             │   │
│ │ 28 mentions │ │ 15 mentions │ │ 12 mentions │ │ 10 mentions │   │
│ │ 92% 👍     │ │ 93% 👍     │ │ 83% 👍     │ │ 80% 👍     │   │
│ │ Avg: 4.6/5 │ │ Avg: 4.2/5 │ │ Avg: 3.8/5 │ │ Avg: 3.5/5 │   │
│ │             │ │             │ │             │ │             │   │
│ │ [████████░] │ │ [██████░░░] │ │ [█████░░░░] │ │ [████░░░░░] │   │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│ ┌─────────────┐                                                     │
│ │ 🍮 Creme   │    + View all 23 items →                            │
│ │ Brulee     │                                                     │
│ │ 8 mentions │                                                     │
│ └─────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Item cards | Grid: `grid-cols-2 md:grid-cols-4 lg:grid-cols-5`, `gap-4` |
| Each card | `rounded-card border p-4`. Emoji/icon top, name bold, mention count, positive %, avg intensity, mini progress bar |
| Filter pills | "Food" / "Drinks" / "All" — filter by `item_type` |
| Progress bar | h-2, color by positive % (>90% green, >70% amber, else red) |

**Data source:** `aggregate_item_mentions(restaurant_id, start, end)`. Grouped by item_type (food/drink) and course_type (entree/side/appetizer/dessert/cocktail).

### Card B — By Restaurant (comparison)

Side-by-side view: Our top items vs each competitor's top items. Horizontal scroll if more than 2 visible.

```
┌──────────────────────────────────────┐
│ Item Mentions by Restaurant          │
│                                      │
│ Alamo Prime (You)    Longhorn        │
│ 1. Bone-In Ribeye 28 1. Porterhouse 22│
│ 2. Truffle Mac    15 2. Onion Soup  18│
│ 3. Margarita      12 3. Old Fash.   15│
│ ...                   ...              │
└──────────────────────────────────────┘
```

### Card C — Trending (Rising/Falling)

Items that gained or lost the most mentions vs last period. Arrow indicators, green for rising, red for falling.

**Data source:** Compare `review_intelligence` current period vs previous period `top_positive_items` / `top_complaints`.

---

## Screen 3: STAFF SHOUTOUTS

**Purpose:** Who's being mentioned in reviews, sentiment breakdown, leaderboard.

### Layout

```
Row 1: [Time Toggle: Month / Quarter / Year / All Time]
Row 2: [Card A: Top 10 This Period — 6/12] [Card B: Year Leaderboard — 6/12]
Row 3: [Card C: Staff Detail List — full width]
```

### Card A — Top 10 This Period

PulseAI "Traffic by Location" pattern — list with progress bars.

```
┌──────────────────────────────────────┐
│ Top 10 Staff — This Month    [•••]   │
│                                      │
│ 👤 Maria Garcia  (server) [93%+]     │
│    [████████████████████████░░] 14    │
│                                      │
│ 👤 Carlos Reyes (bartender) [90%+]   │
│    [██████████████████░░░░░░░░] 10   │
│                                      │
│ 👤 Jake Thompson (server) [86%+]     │
│    [████████████████░░░░░░░░░░]  7   │
│                                      │
│ 👤 Sofia Martinez (host) [100%+]     │
│    [██████████████░░░░░░░░░░░░]  5   │
│                                      │
│ 👤 David Chen (manager) [75%+]       │
│    [████████████░░░░░░░░░░░░░░]  4   │
│                                      │
│              View All Staff →         │
└──────────────────────────────────────┘
```

| Element | Spec |
|---------|------|
| Staff row | Avatar placeholder (user icon) + name bold + role in gray + positive-% badge |
| Progress bar | 8px height, full-width. Color: green if >80% positive, amber if >50%, red if <50% |
| Count | Right-aligned, `font-semibold tabular-nums` |

### Card B — Year Leaderboard

Same format but aggregated across the full year. Shows cumulative mentions.

### Card C — Staff Detail (expandable)

Full table: Name, Role, Total Mentions, Positive %, Negative %, Trend (vs last period). Clickable rows expand to show sample review excerpts.

**Data source:** `aggregate_staff_mentions(restaurant_id, start, end)`. For leaderboard: use `review_intelligence.top_staff` from the year period.

---

## Screen 4: CATEGORIES (Analytics Deep-Dive)

**Purpose:** Detailed view of Food Quality, Service, Ambience, Value — with competitor comparison and time trends.

### Layout

```
Row 1: [Category Selector: Food | Service | Ambience | Value]  [Time Toggle]
Row 2: [Card A: Score Over Time chart — full width]
Row 3: [Card B: Our Score vs Competitors — full width]
Row 4: [Card C: Sub-Categories 6/12] [Card D: Related Flags 6/12]
```

### Card A — Category Score Over Time (full-width chart)

Multi-line chart showing the selected category's sentiment over time for ALL restaurants.

```
┌──────────────────────────────────────────────────────────────┐
│ Food Quality — Score Over Time                              │
│                                                              │
│ [Alamo ●] [Longhorn ●] [Salt&Sear ●] [Mesquite ●]         │
│                                                              │
│ +1.0 ─                                                       │
│ +0.5 ─  ────────────── Alamo (thick green)                  │
│    0 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─            │
│ -0.5 ─            ────── Mesquite (thin purple)              │
│ -1.0 ─                                                       │
│        Dec    Jan    Feb    Mar    Apr    May                 │
└──────────────────────────────────────────────────────────────┘
```

- Y-axis: -1.0 to +1.0 (sentiment range)
- Toggle chips above: show/hide each restaurant's line
- Our line: `strokeWidth: 3`, competitors: `strokeWidth: 1.5`
- Colors: Alamo `#2aa962`, Longhorn `#6366F1`, Salt&Sear `#EC4899`, Mesquite `#8B5CF6`

### Card B — Competitor Comparison (horizontal bars)

Same "Traffic by Location" pattern — our restaurant + all competitors with their category score:

```
┌──────────────────────────────────────────────────────┐
│ Food Quality — Competitor Comparison                  │
│                                                      │
│ 🟢 Alamo Prime     [You]                             │
│    [██████████████████████████████████░░░░░] 0.85    │
│                                                      │
│ 🟢 Longhorn & Ember                                  │
│    [██████████████████████████████░░░░░░░░░] 0.78    │
│                                                      │
│ 🟡 Salt & Sear                                       │
│    [██████████████████████░░░░░░░░░░░░░░░░] 0.55    │
│                                                      │
│ 🔴 Mesquite Flame                                    │
│    [████████████████░░░░░░░░░░░░░░░░░░░░░░] 0.32    │
└──────────────────────────────────────────────────────┘
```

### Card C — Sub-Categories

Breakdown of the selected category into its AI-extracted sub-categories:
- **Food Quality** → Food Quality + Presentation
- **Service** → Service Attitude + Service Speed + Wait Time + Reservation Experience + Management
- **Ambience** → Ambience + Cleanliness
- **Value** → Value

Each sub-category shows: name, avg intensity (1-5), mention count, trend arrow.

### Card D — Related Severity Flags

High-severity alerts that relate to the selected category. E.g., for "Service" → show staff_conduct flags. For "Food" → show health_safety flags.

**Data source:** Category sentiments from `flavor_index_daily`. Sub-categories from `review_intelligence.top_strengths` and `top_opportunities`. Flags from `review_analyses` where `high_severity_flag = true`.

---

## Screen 5: COMPANY (Multi-Restaurant Overview)

**Purpose:** Compare OUR restaurants against each other (for multi-unit operators). Toggle Flavor Index and category scores.

### Layout

```
Row 1: [Metric Selector: Flavor Index | Food | Service | Ambience | Value]  [Time Toggle]
Row 2: [Card A: Restaurant Scorecards — full width grid]
Row 3: [Card B: Trend Comparison Chart — full width]
```

### Card A — Restaurant Scorecards

Grid of cards (one per own restaurant), PulseAI card style:

```
┌─────────────┐  ┌─────────────┐
│ Alamo Prime │  │ Alamo Prime │
│ Austin      │  │ Westside    │
│             │  │             │
│  +75.3      │  │   --        │
│ World-Class │  │ No Data Yet │
│ ▲ +4.2      │  │             │
│             │  │ [Set Up →]  │
│ 150 reviews │  │             │
│ ★ 4.71      │  │             │
└─────────────┘  └─────────────┘
```

Cards for restaurants with no data show an onboarding state with "Set Up" link.

### Card B — Trend Comparison

Multi-line chart comparing own restaurants over time (same as Screen 4 Card A but filtered to `restaurant_type = 'own'`).

**Data source:** `tracked_restaurants WHERE restaurant_type = 'own'` + `compute_flavor_index_range()` for each.

---

## Persistent UI Elements

### Export Report Button

Top-right header, dark fill (matches PulseAI exactly):

```
┌──────────────────┐
│ ⬇ Export Report  │
└──────────────────┘
```

| Property | Value |
|---------|-------|
| Background | `bg-foreground` (dark in light mode, light in dark mode) |
| Text | `text-background` (inverted) |
| Icon | `Download` (Lucide), 16px, left of text |
| Radius | `rounded-lg` (14px) |
| Padding | `px-4 py-2.5` |
| Min height | 44px (touch target) |
| Hover | `opacity-90` |

**Export formats:**
- PDF report (full dashboard snapshot)
- CSV data export (raw numbers for the current view/period)
- PNG chart export (individual chart cards)

The export is context-aware — it exports data for the currently selected tab, time period, and restaurant.

### AI Chat Button (Floating)

Bottom-right floating action button that invokes the review AI chatbot:

```
         ┌─────────────────────────┐
         │  💬 Ask about reviews   │  ← tooltip on hover
         └─────────────────────────┘
                    ┌────┐
                    │ ✨ │  ← floating button
                    └────┘
```

| Property | Value |
|---------|-------|
| Position | `fixed bottom-6 right-6` (above mobile tab bar if present) |
| Size | 56px circle |
| Background | `bg-primary` (Alamo Green) |
| Icon | `Sparkles` or `MessageCircle` (Lucide), 24px, white |
| Shadow | `shadow-floating` |
| Hover | Scale 1.05 + deeper shadow |
| Press | Scale 0.95 |
| Badge | Optional notification dot for unread insights |

**Behavior:**
- Click opens a slide-out panel (right side on desktop, bottom sheet on mobile)
- Pre-loaded with context: current restaurant, current time period, current tab data
- Example prompts: "What's driving our score down?", "Compare our food quality to Longhorn", "Summarize this month's reviews"
- Uses the future `ask-reviews` edge function (Phase 7 in master plan)
- For now (Phase 4a): button is visible but shows "Coming Soon" state

### Date Range Selector

Header-level date range, matches PulseAI calendar pill:

```
┌───────────────────────┐
│ 📅 Jan 08 - Feb 08   │
└───────────────────────┘
```

| Property | Value |
|---------|-------|
| Border | 1px `--border` |
| Radius | `rounded-full` |
| Padding | `px-4 py-2` |
| Icon | `Calendar` (Lucide), 16px |
| Text | `text-sm font-medium` |
| Click | Opens date range picker dropdown |

**Preset ranges** (in dropdown):
- Last 30 days / Últimos 30 días
- Last 90 days / Últimos 90 días
- Year to Date / Año actual
- Last Year / Año anterior
- Custom Range / Rango personalizado

---

## Color System (Flavor Zones → PulseAI Style)

The PulseAI design uses teal for positive and orange for attention. We map our zone colors to maintain our identity while inheriting the layout.

### Score coloring (zone-based)
| Zone | Score Range | Color | CSS Variable |
|------|------------|-------|-------------|
| World-Class | +71 to +100 | `#10B981` | `--flavor-world-class` |
| Excellent | +51 to +70 | `#22C55E` | `--flavor-excellent` |
| Great | +31 to +50 | `#84CC16` | `--flavor-great` |
| Good | 0 to +30 | `#F59E0B` | `--flavor-good` |
| Needs Improvement | -100 to -1 | `#EF4444` | `--flavor-needs-improvement` |

### Data series colors
| Series | Color | Usage |
|--------|-------|-------|
| Alamo Prime (own) | `#2aa962` | Primary data, main bars, own restaurant line |
| Competitor 1 | `#6366F1` (Indigo) | Longhorn & Ember |
| Competitor 2 | `#EC4899` (Pink) | Salt & Sear |
| Competitor 3 | `#8B5CF6` (Purple) | Mesquite Flame |
| Competitor 4 | `#F97316` (Orange) | Future competitor |
| Highlighted/Attention | `#F59E0B` (Amber) | Current month bar, alerts |
| Previous period | Hatched pattern on muted base | Comparison bars |

### Hatched pattern CSS
```css
.bar-previous {
  background: repeating-linear-gradient(
    45deg,
    hsl(var(--muted)),
    hsl(var(--muted)) 2px,
    hsl(var(--muted-foreground) / 0.15) 2px,
    hsl(var(--muted-foreground) / 0.15) 4px
  );
}
```

---

## Responsive Behavior

| Breakpoint | Layout Changes |
|-----------|----------------|
| < 640px (mobile) | All cards stack full-width. Charts `aspect-[4/3]`. Tab labels become icons only. Restaurant comparison scrolls horizontally. |
| 640-768px (sm) | Row 1: 2-col (Cards A+B side by side, Card C below). Row 2: stacked. |
| 768-1024px (md) | Row 1: 3-col as designed. Row 2: 2-col as designed. Charts `aspect-[2/1]`. |
| 1024px+ (lg) | Full layout. Max-width container `1280px`. |

Mobile bottom sheet for AI chat. Desktop uses right-panel slide-out.

---

## Data Availability Matrix (What Shows Now vs Later)

| Element | Available Now | After AI Extraction (Phase 4b) |
|---------|--------------|-------------------------------|
| Flavor Index score | YES | YES |
| Star distribution | YES | YES |
| Avg rating | YES | YES |
| Monthly trend bars | YES | YES |
| Delta vs previous | YES | YES |
| Bad review % | YES | YES |
| Competitor FI comparison | YES | YES |
| Category sentiments (food/service/etc.) | **NULL — show placeholder** | YES |
| Strengths & Opportunities | **Empty — show placeholder** | YES |
| Staff mentions | **Empty — show placeholder** | YES |
| Item mentions | **Empty — show placeholder** | YES |
| Emotion distribution | **Empty — show placeholder** | YES |
| Severity flags | **Empty — show placeholder** | YES |
| AI Chat responses | **"Coming Soon" button** | Phase 7 |

**Placeholder strategy:** Where data is unavailable, show:
- Dashed-border empty state with gray text: "Awaiting AI analysis" / "Esperando análisis de IA"
- Subtle pulsing skeleton if loading
- The card frame and title are always visible — never hide cards with no data

---

## Bilingual Labels (Complete)

### Navigation
| EN | ES |
|----|----|
| Overview | Resumen |
| Food & Drinks | Comida y Bebida |
| Staff Shoutouts | Reconocimientos |
| Categories | Categorías |
| Company | Empresa |
| Export Report | Exportar Reporte |
| Search | Buscar |

### Overview Tab
| EN | ES |
|----|----|
| Score Trend | Tendencia de Puntaje |
| vs. last period | vs. periodo anterior |
| Current Score | Puntaje Actual |
| Low Ratings | Calificaciones Bajas |
| 1-3 star reviews | Reseñas de 1-3 estrellas |
| Total Low Ratings | Total de Bajas |
| Flavor Index | Índice de Sabor |
| Last 12 months | Últimos 12 meses |
| Flavor Index by Restaurant | Índice de Sabor por Restaurante |
| Strengths & Opportunities | Fortalezas y Oportunidades |
| View Detailed Comparison | Ver Comparación Detallada |

### Time Periods
| EN | ES |
|----|----|
| Month | Mes |
| Quarter | Trimestre |
| Year | Año |
| Last Year | Año Anterior |
| 5 Yr | 5 Años |
| All | Todo |
| Last 30 days | Últimos 30 días |
| Last 90 days | Últimos 90 días |
| Year to Date | Año actual |
| Custom Range | Rango personalizado |

### Zone Labels
| EN | ES |
|----|----|
| World-Class | Clase Mundial |
| Excellent | Excelente |
| Great | Muy Bueno |
| Good | Bueno |
| Needs Improvement | Necesita Mejorar |

### Category Labels
| EN | ES |
|----|----|
| Food Quality | Calidad de Comida |
| Service | Servicio |
| Ambience | Ambiente |
| Value | Valor |
| Presentation | Presentación |
| Service Attitude | Actitud de Servicio |
| Service Speed | Velocidad de Servicio |
| Wait Time | Tiempo de Espera |
| Reservation Experience | Experiencia de Reserva |
| Management | Gerencia |
| Cleanliness | Limpieza |

### States
| EN | ES |
|----|----|
| Awaiting AI analysis | Esperando análisis de IA |
| Coming Soon | Próximamente |
| No Data Yet | Sin Datos Aún |
| Set Up | Configurar |
| Ask about reviews | Preguntar sobre reseñas |

---

## Implementation Plan

### Step 0: Build HTML Visual Prototype
Build a single `mockups/review-dashboard-v2.html` file that renders all 5 screens with:
- Tailwind CDN + Chart.js for zero-dependency preview
- Our exact color system (light + dark mode)
- Tab switching between all 5 screens
- EN/ES toggle
- All interactive elements (pills, dropdowns, toggles)
- Export button (visual only)
- AI Chat button (visual only)
- Realistic mock data
- Responsive at 375px / 768px / 1280px

### Step 1: Foundation (Types + Utils + Mock Data)
- `src/types/reviews.ts` — All TypeScript interfaces
- `src/lib/flavor-utils.ts` — Zone calculation, formatting, color mapping
- `src/data/mock-reviews.ts` — Complete mock data for all 5 screens
- `src/index.css` — Add `--flavor-*` CSS variables + hatched pattern utility

### Step 2: Shell + Navigation
- `src/pages/ReviewDashboard.tsx` — Page with 5-tab navigation
- `src/components/layout/Sidebar.tsx` — Add "Insights" nav item
- `src/App.tsx` — Add `/admin/reviews` route
- `src/components/reviews/ExportButton.tsx` — Header export button
- `src/components/reviews/AIChatButton.tsx` — Floating chat FAB
- `src/components/reviews/DateRangeSelector.tsx` — Header date picker

### Step 3: Overview Tab
- `src/components/reviews/TrendSummaryCard.tsx` — Card A
- `src/components/reviews/LowRatingsCard.tsx` — Card B
- `src/components/reviews/FlavorIndexChart.tsx` — Card C (12-month bar chart)
- `src/components/reviews/RestaurantRankList.tsx` — Card D (location-style list)
- `src/components/reviews/StrengthsOpportunities.tsx` — Card E

### Step 4: Food & Drinks Tab
- `src/components/reviews/TopItemsGrid.tsx` — Item mention cards
- `src/components/reviews/ItemsByRestaurant.tsx` — Side-by-side comparison
- `src/components/reviews/TrendingItems.tsx` — Rising/falling items

### Step 5: Staff Shoutouts Tab
- `src/components/reviews/StaffLeaderboard.tsx` — Top 10 list (reuses location pattern)
- `src/components/reviews/StaffDetailTable.tsx` — Full expandable table

### Step 6: Categories Tab
- `src/components/reviews/CategoryTrendChart.tsx` — Multi-line chart
- `src/components/reviews/CategoryComparisonList.tsx` — Competitor bars
- `src/components/reviews/SubCategoryBreakdown.tsx` — Detail list
- `src/components/reviews/SeverityFlagsList.tsx` — Related alerts

### Step 7: Company Tab
- `src/components/reviews/RestaurantScorecard.tsx` — Unit score card
- `src/components/reviews/CompanyTrendChart.tsx` — Own-restaurants comparison

### Step 8: Polish
- Bilingual labels (EN/ES STRINGS in each component)
- Dark mode verification
- Responsive testing at 375px / 768px / 1280px
- Accessibility (ARIA labels, keyboard nav, screen reader)
- Loading skeletons + error states + empty states
- Animation: bar growth, progress fill, card hover lift

---

## File Count Summary

| Category | Files | Notes |
|----------|-------|-------|
| Types / Utils | 3 | types, utils, mock data |
| Page | 1 | ReviewDashboard.tsx |
| Shell components | 4 | ExportButton, AIChatButton, DateRangeSelector, barrel |
| Overview components | 5 | TrendSummary, LowRatings, FlavorChart, RankList, Strengths |
| Food & Drinks | 3 | TopItems, ByRestaurant, Trending |
| Staff | 2 | Leaderboard, DetailTable |
| Categories | 4 | TrendChart, ComparisonList, SubCategory, Flags |
| Company | 2 | Scorecard, CompanyChart |
| Shared/States | 3 | Skeleton, EmptyState, index barrel |
| Modified | 3 | App.tsx, Sidebar.tsx, index.css |
| **Total** | **~30 files** | 27 new + 3 modified |

---

## Verification Checklist

1. All 5 tabs render and switch correctly
2. Overview: Card A shows +4.2 pts trend with current/previous hatched bars
3. Overview: Card B shows 6.7% bad reviews
4. Overview: Card C shows 12-month bar chart with highlighted current month
5. Overview: Card D shows 4 restaurants ranked by FI with progress bars + time toggle
6. Overview: Card E shows hero score + 4 category stats + stacked bar + strengths/opportunities
7. Food & Drinks: Top items grid with mention counts and positive %
8. Staff: Top 10 leaderboard with progress bars and sentiment badges
9. Categories: Multi-line chart with toggle chips per restaurant
10. Company: Own-restaurant scorecards
11. Export button visible in header (functional export deferred)
12. AI Chat button visible floating bottom-right (shows "Coming Soon")
13. Date range selector in header with preset ranges
14. EN/ES toggle switches all labels
15. Dark mode renders correctly on all screens
16. Mobile at 375px: cards stack, charts resize, tabs show icons only
17. Tablet at 768px: 2-column layouts work
18. Desktop at 1280px: full grid layout
19. NULL/empty data states show "Awaiting AI analysis" placeholders
20. 0 TypeScript errors
