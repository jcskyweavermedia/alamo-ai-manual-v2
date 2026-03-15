# Training Dashboard — Final Vision

Source of truth: `mockups/training-dashboard-v2.html` + Juan's original overview.

---

## What This Is

A **course-centric training command center** for restaurant managers. Not an LMS. Not HR software. A tool that answers one question per course: **"Where are my people at?"**

The manager selects a course on the left, and the right side explodes into everything they need to know — who's enrolled, who finished, who's struggling, what the AI thinks, and what to do about it.

---

## Page Structure

The dashboard is a single admin page at `/admin/training` with this layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP NAV: Training Hub · Alamo Prime | Export | Dark | Avatar   │
├─────────────────────────────────────────────────────────────────┤
│  KPI STRIP: 4 stat cards across the top                         │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  LEFT PANEL  │  RIGHT PANEL                                     │
│  (340px)     │  (flex)                                          │
│              │                                                  │
│  Course List │  Course Header Card                              │
│              │  ────────────────────                            │
│  [Search]    │  Tabbed Detail View                              │
│  [Sort pills]│  ┌──────┬──────┬──────┬──────┬──────┐           │
│              │  │Employ│Enroll│Compl │Grade │AI    │           │
│  Featured    │  │ees   │ed    │eted  │s     │Feed  │           │
│  Banner      │  └──────┴──────┴──────┴──────┴──────┘           │
│              │                                                  │
│  Course 1 ●  │  [Active tab content]                            │
│  Course 2    │                                                  │
│  Course 3    │                                                  │
│  Course 4    │                                                  │
│  Course 5    │                                                  │
│  ...         │                                                  │
│              │                                                  │
├──────────────┴──────────────────────────────────────────────────┤
│                                              [FAB: AI Coach] ●  │
└─────────────────────────────────────────────────────────────────┘
```

On mobile (`< lg`), left panel stacks on top of right panel.

---

## 1. Top Navigation Bar

Sticky header. Contains:

- **Left**: Brand icon (graduation-cap, orange bg) + "Training Hub" + "Alamo Prime" subtitle
- **Center** (md+): Breadcrumb — `Admin > Training Dashboard`
- **Right**: Export button (sm+), dark mode toggle, user avatar (initials)

---

## 2. KPI Strip

4 stat cards in a `grid-cols-2 md:grid-cols-4` grid. These are **global** stats across all courses — they do NOT change when you select a course.

| Card | Value | Detail |
|------|-------|--------|
| **Total Enrolled** | `47` | `+8 this week` (green trending-up) |
| **Completion Rate** | `72%` | Progress bar + `34 of 47 completed` |
| **Avg Grade** | `84 / 100` | `+3 pts vs last month` (green trending-up) |
| **Pass Rate** | `91%` | `31 of 34 passed` (green check) |

Each card: icon in muted bg circle (top-right), big number, supporting detail below.

---

## 3. Left Panel — Course List (340px)

### Search + Filter
- Search input with magnifying glass icon, placeholder "Search courses..."
- Filter button (sliders-horizontal icon) to the right

### Sort Pills
Label "Sort:" followed by pill buttons: **Recent** (default active) | **A-Z** | **Completion** | **Dept**

Active pill = ink bg + canvas text. Inactive = muted-fg, hover = ink text.

### Featured Banner
A special gradient card (brand-orange, 135deg) that sits above the course list. Used for time-sensitive or priority training.

The example shows:
- **"Featured"** badge (star icon, white/20 bg)
- **Title**: "Mother's Day Special"
- **Subtitle**: "Service excellence for May 11"
- **Completion**: `68%` (large, top-right) with white progress bar
- **Footer**: `23 / 34 employees` | `Due May 9`
- Subtle circle pattern overlay (SVG bg, white 5% opacity)

This is clickable — selects it like any course card.

### Course Cards (scrollable)
Scrollable list with `max-height: calc(100vh - 360px)`. Each card shows:

- **Icon** (9x9 rounded-xl, pastel bg + colored icon — unique per course)
- **Title** (semibold, truncated)
- **Status badge**: `Active` (green), `Coming Soon` (yellow), `Draft` (gray)
- **Department tag**: `FOH`, `BOH`, `Bar`, `FOH + BOH`, `All Staff`
- **Module count**: e.g. "7 modules"
- **Progress bar** (color matches icon)
- **Enrollment count**: e.g. "18 / 22 enrolled"
- **Completion %** (right-aligned, bold)

**Selected state**: orange border + `0 0 0 3px` brand shadow ring.

The 7 courses in the mockup:

| Course | Icon | Dept | Modules | Status | Color |
|--------|------|------|---------|--------|-------|
| Server 101 | utensils | FOH | 7 | Active | Blue (214) |
| Saute 101 | flame | BOH | 5 | Active | Green (142) |
| Wine Fundamentals | wine | FOH | 4 | Active | Purple (270) |
| Knife Skills Basics | chef-hat | BOH | 3 | Coming Soon | Red (0) |
| Cocktail Essentials | beer | Bar | 6 | Draft | Amber (38) |
| Steak Temps & Cuts | beef | FOH + BOH | 4 | Active | Orange (16) |
| Allergen Awareness | shield-alert | All Staff | 2 | Active | Teal (195) |

---

## 4. Right Panel — Course Detail

Changes entirely when a course is selected in the left panel.

### Course Header Card
Top card with:

- **Large icon** (12x12 rounded-2xl)
- **Title** (xl bold) + status badge + department badge
- **Description** (one line, muted)
- **Action buttons** (top-right): `Edit` (outline) | `Enroll` (brand solid, user-plus icon)
- **4 mini stats** below a border-t divider, centered in a 4-col grid:
  - Enrolled: `22`
  - Completed: `18`
  - Avg Score: `87`
  - Modules: `7`
- **Overall completion bar** (8px track, brand fill, label + %)

### Tabbed Detail View

5 tabs inside a card with no padding. Tab bar sits at top with bottom border. Active tab = ink bg + canvas text (filled), inactive = muted-fg (text only).

Tabs (left to right):
1. **Employees** (users icon)
2. **Enrolled** (bookmark icon)
3. **Completed** (check-circle-2 icon)
4. **Grades** (bar-chart-2 icon)
5. **AI Feedback** (sparkles icon)

---

### Tab 1: Employees (Default)

**Purpose**: Recent activity feed — who touched this course lately.

Header: "Recent Activity" + subtitle + role filter dropdown (All Roles / Server / Host / Manager).

Each employee row:
- **Avatar** (32px circle, colored bg, initials)
- **Name** (semibold) + **grade badge** (A/B/C/D colored pill) + optional **alert badge** ("Needs Review" in amber)
- **Detail line**: `Role · Progress description · Time ago`
- **Score** (right, bold number) + **mini progress bar** (64px wide, 4px height)

The 6 employees shown:

| Name | Role | Status | Score | Grade | Flag |
|------|------|--------|-------|-------|------|
| Alejandra Morales | Server | Completed 7/7, 2h ago | 96 | A | — |
| Carlos Reyes | Server | Completed 6/7, 5h ago | 83 | B | — |
| Laura Torres | Host | Completed 7/7, Yesterday | 91 | A | — |
| Jose Vargas | Server | Stuck on module 5, 2 days ago | 71 | C | "Needs Review" |
| Maria Garcia | Server | Completed 7/7, 3 days ago | 85 | B | — |
| Diana Perez | Host | On module 4/7, 4 days ago | — | In Progress | — |

- Employees with no final score show `—` in muted color
- In-progress employees get gray progress bars
- Bottom: "View all 22 employees" full-width outline button

---

### Tab 2: Enrolled

**Purpose**: Full roster grouped by role.

Header: "All Enrolled (22)" + subtitle + orange "Enroll More" button.

Grouped into sections with uppercase divider headers:
- **Servers - 14** (horizontal rule)
- **Hosts - 5**
- **Managers - 3**

Each person shown in a compact `grid-cols-1 sm:grid-cols-2` layout:
- Muted bg pill with avatar + name + enrollment date
- Status icon (right-aligned):
  - Green check-circle-2 = completed
  - Orange loader = in progress
  - Amber alert-circle = needs attention

---

### Tab 3: Completed

**Purpose**: Completion timeline + who finished, who hasn't.

Header: "Completed (18 of 22)" + subtitle.

**Completions Over Time chart** (Chart.js bar chart):
- Muted bg container with "COMPLETIONS OVER TIME" label
- X-axis: dates (Feb 18 through Mar 4)
- Y-axis: count (0-8)
- Orange bars with 4px border-radius
- Data: [2, 3, 4, 5, 8, 2, 2]

**Completed list** (sorted by completion date, most recent first):
- Top performers get green border + green bg + trophy icon
- Regular completions get default border + check-circle icon
- Each row: icon + avatar + name + completion date + score + grade badge

**Incomplete section** below a divider ("Incomplete - 4 employees"):
- Amber bg for overdue employees (clock icon in amber)
- Muted bg for normal in-progress (clock icon in muted)
- Each row shows: modules progress (`5 / 7 modules`) + last active time
- **"Nudge" button** on each incomplete employee (amber for urgent, muted for normal)

---

### Tab 4: Grades

**Purpose**: Grade analytics and performance breakdown.

Header: "Grade Breakdown" + "18 graded - Avg score 87".

**Two chart cards** side by side (`grid-cols-1 md:grid-cols-2`):

**Left: Grade Distribution** (doughnut chart)
- Chart.js doughnut, 65% cutout
- Colors: A=#16a34a (green), B=#3b82f6 (blue), C=#ca8a04 (yellow), D=#dc2626 (red)
- Legend beside chart:
  - A (90-100): 8 students
  - B (80-89): 6 students
  - C (70-79): 3 students
  - D (<70): 1 student

**Right: Avg Score by Module** (horizontal bar list)
- 7 progress bars, one per module
- Each shows module name + score + colored bar
- Green bars for scores >= 88, blue for 84-87, amber for <= 79
- Module scores: Greeting (92), Menu Knowledge (88), Order Taking (84), Upselling (79), Handling Issues (72), Closing & Farewell (90), Final Exam (87)

**Grade table** below:
- Columns: Employee | Role | Score | Grade | Status
- Sortable by score (implied)
- Grade shown as colored pill (A/B/C/D)
- Status: "Passed" (green), "Review" (amber), "In Progress" (muted)
- In-progress employees show `—` for score and "IP" badge

---

### Tab 5: AI Feedback

**Purpose**: AI-generated coaching analysis per course. The core differentiator.

**AI Summary Banner** (gradient bg: brand-orange 8% to purple 6%, brand border):
- Sparkles icon in brand-orange square
- "AI Training Analysis" title + course name badge
- Narrative paragraph with bold highlights:
  > "Overall cohort performance is **strong at 87 avg** with 82% completion. The team excels in guest greeting and menu knowledge. The biggest opportunity is **upselling confidence** — Module 4 scores average 79, indicating staff may benefit from role-play practice sessions. Consider scheduling a 30-min upselling workshop before the Mother's Day rush."

**Cohort Strengths / Areas to Improve** (2-column grid):
- **Strengths** (green card): thumbs-up icon, green border/bg, check items
  - Strong guest greeting scores (avg 92)
  - Excellent menu knowledge retention
  - High engagement — avg 2.4 attempts per quiz
- **Areas to Improve** (amber card): target icon, amber border/bg, arrow-right items
  - Upselling confidence (avg 79)
  - Complaint handling (avg 72)
  - 4 employees still in progress

**Individual AI Coaching Notes** — per-employee cards:

Each card has:
- Large avatar (40px)
- Name + grade pill + optional status badge ("Top Performer", "Needs Attention", "In Progress")
- **AI bubble** (chat-style, rounded corners with tail on bottom-left):
  - `AI:` prefix in brand orange
  - Narrative coaching note specific to that employee

**4 employee coaching cards shown:**

1. **Alejandra Morales** (A - 96, "Top Performer" blue badge)
   - Normal card, muted bubble
   - AI recommends mentoring peers + fast-tracking to sommelier course

2. **Jose Vargas** (C - 71, "Needs Attention" amber badge)
   - Card with amber border (visually flagged)
   - Amber-tinted AI bubble
   - AI identifies specific weak modules (4 & 5), retry count, recommends 1-on-1
   - **Action buttons**: "Schedule 1-on-1" (brand solid) | "Send Resource" (outline)

3. **Carlos Reyes** (B - 83, no extra badge)
   - Normal card, muted bubble
   - AI notes score improvement across retries, predicts completion date

4. **Diana Perez** (In Progress - 4/7, dashed border card)
   - Dashed border (visually distinct from graded cards)
   - AI notes promising early scores, predicts completion, says "check back after Module 5"

**AI Ask Bar** (bottom of tab):
- Rounded input with sparkles icon + text input + "Ask" button
- Placeholder: `Ask AI about this course... e.g. "Who needs extra help before Mother's Day?"`

---

## 5. FAB Button

Fixed position, bottom-right (24px offset). Brand-orange circle, 56px, sparkles icon.

- Hover: scales up 1.08x
- Click: switches to AI Feedback tab and focuses the ask input
- Shadow: `0 8px 24px -4px rgb(0 0 0/0.2)`

---

## 6. Design System Specs

### Colors (CSS custom properties)

**Light mode:**
| Token | HSL | Usage |
|-------|-----|-------|
| `--canvas` | 240 10% 98% | Page background |
| `--surface` | 0 0% 100% | Card backgrounds |
| `--border-color` | 240 6% 90% | Borders |
| `--muted` | 240 5% 96% | Subtle backgrounds |
| `--muted-fg` | 240 4% 38% | Secondary text |
| `--brand` | 25 95% 53% | Orange accent |
| `--brand-hover` | 21 90% 48% | Darker orange |
| `--ink` | 240 10% 7% | Primary text |

**Dark mode:**
| Token | HSL |
|-------|-----|
| `--canvas` | 240 10% 4% |
| `--surface` | 240 10% 8% |
| `--border-color` | 240 5% 18% |
| `--muted` | 240 5% 15% |
| `--muted-fg` | 240 5% 72% |
| `--ink` | 240 5% 96% |

### Grade Colors
| Grade | Light bg | Light text | Dark bg | Dark text |
|-------|----------|------------|---------|-----------|
| A | #dcfce7 | #166534 | #14532d | #86efac |
| B | #dbeafe | #1e40af | #1e3a5f | #93c5fd |
| C | #fef9c3 | #854d0e | #451a03 | #fde68a |
| D | #fee2e2 | #991b1b | #450a0a | #fca5a5 |

### Status Badge Colors
| Status | Light bg | Light text |
|--------|----------|------------|
| Active | #dcfce7 | #166534 |
| Draft | #f1f5f9 | #475569 |
| Coming Soon | #fef9c3 | #854d0e |
| Featured | brand 12% | brand-hover |

### Typography
- Font stack: `-apple-system, BlinkMacSystemFont, SF Pro Text, Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
- Anti-aliased, feature settings: cv02, cv03, cv04, cv11

### Component Tokens
- Card radius: 16px
- Pill radius: 9999px
- Progress bar radius: 4px (track = 6px height, bar inside)
- Avatar: 32px (standard), 40px (large)
- Card shadow on hover: `0 4px 12px -2px rgb(0 0 0/0.08)`

---

## 7. Interactions

| Action | Behavior |
|--------|----------|
| Click course card | Orange ring selection, right panel updates |
| Click featured banner | Same as course card |
| Click sort pill | Toggle active state, re-sort list |
| Click tab | Switch tab content, re-init Lucide icons |
| Click "View all N employees" | Expand full list (future) |
| Click "Nudge" | Send notification to employee (future) |
| Click "Schedule 1-on-1" | Open scheduling flow (future) |
| Click "Send Resource" | Send learning material (future) |
| Click "Enroll" / "Enroll More" | Open enrollment dialog (future) |
| Click "Edit" | Navigate to course builder |
| Click "Export" | Download report (future) |
| Click FAB | Switch to AI Feedback tab, focus ask input |
| Click dark mode toggle | Toggle `.dark` class on `<html>` |
| Type in AI ask bar + click "Ask" | Send question to AI (future) |

---

## 8. What the Mockup Does NOT Cover (From Original Overview — Future Layers)

These ideas from the original vision are **not in the v2 mockup** but remain part of the broader product direction:

1. **People Tab** — A separate top-level view (alongside Courses) that shows all employees grouped by urgency: New Hires, Needs Attention, Top Performers. People-first instead of course-first. The mockup only covers the course-first view.

2. **AI-Driven Auto-Assignment** — AI tracks employee tenure and auto-assigns courses based on progression tiers (0-1mo basics, 1-6mo intermediate, 6-12mo advanced, 12mo+ expert). Managers do nothing.

3. **AI-Run Contests & Incentives** — AI creates and manages training competitions automatically ("Wine Knowledge Challenge — 5 No Sidework Passes"). Managers only approve or adjust.

4. **Knowledge Leaderboard** — Gamified points system visible to all staff (servers, hosts, bussers, runners) encouraging learning during downtime.

5. **Real Restaurant Rewards** — No sidework passes, free dinners, better section choice, schedule pick priority, station choice Saturday. AI distributes them based on performance.

6. **Frictionless Onboarding** — Manager gives a link. Employee downloads app and self-enrolls. System auto-detects new hires and tracks everything. No HR workflow.

These are the layers that turn the dashboard from a monitoring tool into the full **Restaurant Knowledge OS** vision: "Duolingo + AI Manager for Restaurants."

---

## Summary

The v2 mockup is a **fully designed, production-ready admin dashboard** for course-level training management. It gives managers instant visibility into every course — who's enrolled, who finished, who's struggling, what the grades look like, and what the AI recommends doing about it. The AI Feedback tab is the killer feature: per-employee coaching notes with actionable buttons, cohort-level analysis, and a natural language ask bar.

The next step is building this as a React page at `/admin/training`.
