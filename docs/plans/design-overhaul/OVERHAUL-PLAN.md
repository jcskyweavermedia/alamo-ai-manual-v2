# Design Overhaul Plan — Alamo Prime AI Manual

## Executive Summary

Section-by-section redesign to align the app with the new visual language defined in
`design-overview.md` and the reference mockup images. The goal is a **warm, clean, modern
food-app aesthetic** — soft grey backgrounds, elevated white cards, square image tiles with
depth, metadata rows with colored icons, and emoji accents for friendliness.

**Strategy:** Foundation first, then page-by-page. Each phase is a self-contained deliverable
that can be reviewed and tested before moving to the next. Nothing ships broken.

---

## Reference Materials

| File | Purpose |
|------|---------|
| `docs/design-specs.md` | Original design system (tokens, typography, spacing, colors) |
| `docs/plans/design-overhaul/design-overview.md` | Component-level UI spec (cards, tiles, table rows, navbar, stat cards) |
| `docs/plans/design-overhaul/Screenshot *.png` | 5 reference mockup screenshots |
| `docs/plans/design-overhaul/original-*.webp` | Full-page reference mockup |

---

## Design Delta: Current vs. Target

| Aspect | Current | Target |
|--------|---------|--------|
| Page background | `#F7F7FA` (very light) | `#F3F4F6` (Tailwind gray-100, slightly warmer grey) |
| Card elevation | `shadow-card` (0 1px 3px) | White-on-grey contrast + ultra-soft shadow (0 1px 2px 0.04) |
| Card borders | Varies, some dark mode only | Consistent `1px solid #E5E7EB` (gray-200) all cards |
| Card radius | 16px (`rounded-card`) | Keep 16px for cards, bump feature cards to 20px |
| Image tiles | `aspect-[4/3]` fills card width | **Square tiles** (80px) with own shadow, sitting on card |
| Metadata | Badges (allergen pills) | **Icon-led metadata row** (clock + time, level bars + text, flame + cal) |
| Recipe list view | Grid only | Add **table/list view** option (40px thumbnails, horizontal rows) |
| Typography | Design tokens exist | Add **two-line title** pattern (light weight line 1 + bold line 2) |
| Emoji accents | Not used | Emoji in section headers, stat cards, feature cards |
| Stat cards | Not present | Small metric tiles (large number + label + emoji) |
| Search bar | Standard input | **Pill-shaped** (rounded-full, grey fill, no visible border) |
| Navbar height | 56px (h-14) | 72px with more breathing room |
| Hover states | `shadow-elevated` | Very subtle grey tint (`#F9FAFB`) instead of heavy shadow |
| Action buttons | Various | Orange circle CTAs where applicable |

---

## Phase Overview

```
Phase 0 ─── Foundation (Global tokens, card system, shared primitives)
Phase 1 ─── Recipes Page (/recipes)
Phase 2 ─── Product Pages (/dish-guide, /wines, /cocktails, /beer-liquor)
Phase 3 ─── Navigation & Layout (AppShell, Header, Sidebar, MobileTabBar)
Phase 4 ─── Manual & Search (/manual, /search)
Phase 5 ─── Training & Courses (/courses/*)
Phase 6 ─── Landing & Auth (/, /sign-in, /join)
Phase 7 ─── Polish & Dark Mode Audit
```

Each phase builds on the previous. Phases 1-2 share the most code (product viewers all
follow the same pattern), so doing Recipes first establishes the template for the rest.

---

## Phase 0: Foundation (Global Design Tokens & Shared Primitives)

**Goal:** Update the design token layer so all subsequent phases inherit the new visual
language automatically. No page-level changes — just the system underneath.

### 0.1 — Update CSS Variables (`src/index.css`)

| Token | Current | New |
|-------|---------|-----|
| `--background` | `#F7F7FA` | `#F3F4F6` (gray-100) |
| `--card` | `#FFFFFF` | `#FFFFFF` (keep) |
| `--border` | `#E6E6EB` | `#E5E7EB` (gray-200, slightly warmer) |
| `--muted` | varies | `#F9FAFB` (gray-50, for hover tints) |

### 0.2 — Update Tailwind Config (`tailwind.config.ts`)

- Add `rounded-feature: 20px` for large feature cards
- Add `shadow-tile: 0 6px 16px rgba(0,0,0,0.08)` for image tiles
- Add `shadow-card-new: 0 1px 2px rgba(0,0,0,0.04)` as default card shadow
- Verify 8pt grid spacing is intact

### 0.3 — Create Shared Primitives (Only As Needed)

Only create shared components when they'll be reused across multiple pages.
For Phase 1, everything is built directly in `RecipeGrid.tsx` — we extract into
shared components later (Phase 2+) only if the pattern repeats.

Potential shared components (created when needed, not upfront):

| Component | Created In | Purpose |
|-----------|-----------|---------|
| `ImageTile` | Phase 2 (if reused) | Square image with own shadow + radius |
| `PillSearch` | Phase 3 (navigation) | Pill-shaped search input |
| `StatCard` | Phase 6 (landing) | Large number + label + icon tile |
| `FeatureCard` | Phase 6 (landing) | Icon circle + title + description |

### 0.4 — Files Changed

```
src/index.css         — token updates (background, border warmth)
tailwind.config.ts    — shadow-tile utility
```

**Risk:** Low. Token changes are subtle (grey shift). No new components yet.
**Test:** Run dev server, verify no visual regression on existing pages.

---

## Phase 1: Recipes Page (`/recipes`)

**Goal:** Redesign the **grid cards** to match the mockup aesthetic (square image tile,
metadata row with colored Lucide icons). The **detail view (RecipeCardView)** is already
functional — just a light color/token refresh, no structural changes.

### 1.1 — Recipe Grid Cards (✅ Implemented)

**Layout — horizontal card matching the mockup:**

```
┌──────────────────────────────────────┐
│  ┌──────────┐                  [📌] │
│  │  Square  │  Chicken Katsu Salad.  │   ← Wider card, horizontal layout
│  │  Image   │  Prep · Sauce          │   ← Image tile LEFT, content RIGHT
│  │  Tile    │                        │   ← Pin icon top-right corner
│  └──────────┘  📦 4 cups · 🕐 3 days │   ← Colored Lucide icons
│                                      │
└──────────────────────────────────────┘
```

**Implementation details:**

- **Card surface:** White bg, `border-radius: 20px`, ultra-subtle border
  (`border-black/[0.04]`), `shadow-card`. Hover: `bg-muted/20` tint.
- **Grid:** Wider cards — `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`
- **Square image tile:** LEFT-aligned (not centered), `72px` mobile / `88px` desktop,
  `border-radius: 14px`, `shadow-tile` (`0 8px 24px rgba(0,0,0,0.12)`)
- **Content:** Right of image. Title (16px semibold), subtitle (14px muted), metadata row
- **Metadata row:** Only for prep recipes — `Package` (indigo) + yield, `Clock` (orange) + shelf life.
  Plate specs show title + subtitle only (no metadata row).
- **Pin icon:** Top-right corner, `Pin` from lucide-react.
  - Pinned: orange-500 filled circle with white icon
  - Unpinned: transparent, faint grey icon, hover reveals
  - Click stops propagation (doesn't open the recipe)
  - Pinned recipes sort to top of grid
- **Pin storage:** `usePinnedRecipes` hook, localStorage-backed

**Files:**
```
src/hooks/use-pinned-recipes.ts         — NEW: localStorage pin hook
src/components/recipes/RecipeGrid.tsx   — card layout rework + pin integration
```

### 1.2 — Recipe Detail View (✅ Light Refresh)

**No structural changes.** Color tweaks only:

- **Meta row icons:** `Package` → `text-indigo-500`, `Clock` → `text-orange-500` (with dark variants)
- **Procedure headers:** Softened from `bg-muted/50` to `bg-muted/30`
- Everything else unchanged (layout, batch selector, AI buttons, allergens, lightbox)

**Files:**
```
src/components/recipes/RecipeCardView.tsx   — icon color classes
src/components/recipes/ProcedureColumn.tsx  — one class change
```

### 1.3 — Token Updates (✅ Done)

- `--shadow-tile` increased to `0 8px 24px rgba(0,0,0,0.12)` (light) / `0.45` (dark)
- `shadow-tile` added to Tailwind boxShadow config

### Phase 1 Checkpoint
- [x] Grid cards match mockup (wider, horizontal, left-aligned tile, subtle border)
- [x] Prep recipes show: Package icon (indigo) + yield, Clock icon (orange) + shelf life
- [x] Plate specs show: title + subtitle only (clean)
- [x] Pin icon top-right, pinned items sort to top
- [x] Detail view colors updated but layout/structure unchanged
- [ ] All recipe functionality preserved (batch, allergens, linking, AI, swipe)
- [ ] Mobile responsive (test at 375px, 768px, 1024px)
- [ ] No TypeScript errors
- [ ] Dark mode still functional

---

## Phase 2: Product Pages (`/dish-guide`, `/wines`, `/cocktails`, `/beer-liquor`)

**Goal:** Apply the same patterns established in Phase 1 to all other product viewers.
Since they share the same architecture, this is mostly applying the template.

### 2.1 — Dish Guide

- Grid: Same card redesign (ImageTile + metadata row)
- Metadata row items: prep time, category, allergen count
- Detail: Same two-column refinement
- Top-seller badge: Keep but restyle to match (small gold pill)

**Files:** `DishGrid.tsx`, `DishCardView.tsx`, `DishCategoryBadge.tsx`, `DishAllergenBadge.tsx`

### 2.2 — Wines

- Grid: Wine-specific card (bottle ImageTile with portrait aspect)
- Metadata: vintage, region, body indicator
- Detail: Keep bottle image left / info right layout, refine spacing
- Body indicator: Restyle dots to match new system

**Files:** `WineGrid.tsx`, `WineCardView.tsx`, `WineStyleBadge.tsx`, `BodyIndicator.tsx`

### 2.3 — Cocktails

- Grid: Same pattern (cocktail ImageTile)
- Metadata: glass type, style, spirit
- Detail: Same refinement

**Files:** `CocktailGrid.tsx`, `CocktailCardView.tsx`, `CocktailStyleBadge.tsx`

### 2.4 — Beer & Liquor

- List: Refine the magazine-style layout with new card system
- Row items: Match `TableRow` component where appropriate
- Detail: Same refinement

**Files:** `BeerLiquorList.tsx`, `BeerLiquorCardView.tsx`, `BeerLiquorSubcategoryBadge.tsx`

### Phase 2 Checkpoint
- [ ] All 4 product pages match recipes design language
- [ ] Grid/list views consistent across sections
- [ ] Detail views consistent but domain-appropriate
- [ ] All product-specific features preserved (body indicator, allergens, etc.)
- [ ] Mobile responsive on all pages

---

## Phase 3: Navigation & Layout

**Goal:** Update the app shell to match the navbar and sidebar specs from the mockups.

### 3.1 — Header / Navbar

**Current:** h-14 (56px), standard search input, icon buttons, language toggle.

**Target:**
- Height: `h-18` (72px) for more breathing room
- Search bar: `PillSearch` (rounded-full, grey-100 fill, no visible border)
- Icon buttons: 20-22px, stroke 1.5-2px, grey-500
- Avatar: 36px circle with subtle shadow
- Language toggle: Restyle as small pill
- Overall: More whitespace, calmer feel

**Files:** `src/components/layout/Header.tsx`

### 3.2 — Sidebar

**Current:** Collapsible (w-16 / w-60), section headers (BOH, FOH, LEARN).

**Target:**
- Keep collapse/expand behavior
- Softer active state (light accent tint instead of heavy highlight)
- Section headers: smaller, grey, uppercase
- Icons: Match 20px stroke style
- Hover: subtle grey tint (not shadow)

**Files:** `src/components/layout/Sidebar.tsx`

### 3.3 — Mobile Tab Bar

**Current:** Fixed bottom, 72px, icon + label items.

**Target:**
- Keep structure but refine icon styling
- Active state: subtle accent color (not heavy fill)
- Match icon stroke weight to new system

**Files:** `src/components/layout/MobileTabBar.tsx`

### 3.4 — AppShell & ContentArea

- Verify grey background (`#F3F4F6`) is applied at the page level
- Content max-width and padding: verify matches 8pt grid
- Page transitions: keep existing animations

**Files:** `src/components/layout/AppShell.tsx`, `src/components/layout/ContentArea.tsx`

### Phase 3 Checkpoint
- [ ] Navbar feels spacious at 72px
- [ ] Pill search looks clean
- [ ] Sidebar active states are subtle
- [ ] Mobile tab bar matches
- [ ] No layout shifts or broken responsive behavior

---

## Phase 4: Manual & Search

**Goal:** Refine the manual reading experience and search page to match the new design.

### 4.1 — Manual Page

- Outline sidebar: softer active states, match new sidebar style
- Breadcrumb: lighter styling
- Content area: keep `max-w-reading`, verify typography matches spec
- In-page TOC: softer highlight for active section
- Callouts (Critical, Tip, Checklist): keep but soften slightly
- AI panel: already updated in Phase 1

**Files:** Manual-related components in `src/components/manual/`

### 4.2 — Search Page

- Search input: `PillSearch` component
- Results: use new card system
- Section result cards: ImageTile (or icon) + title + excerpt

**Files:** `src/pages/SearchPage.tsx`

### Phase 4 Checkpoint
- [ ] Manual reading experience feels cleaner
- [ ] Search results match new card language
- [ ] Callouts preserved but refined

---

## Phase 5: Training & Courses

**Goal:** Update training pages to match new design.

### 5.1 — Training Home

- Program cards: Apply new card system + ImageTile
- Grid: Match responsive grid from product pages
- Section header: Two-line title treatment

**Files:** `src/pages/TrainingHome.tsx`, `src/components/training/ProgramCard.tsx`

### 5.2 — Course Detail & Learning Session

- Course cards: New card styling
- Content panels: Softer borders, consistent spacing
- Quiz/assessment UI: Match new button and card styles

**Files:** Training components in `src/components/training/`

### Phase 5 Checkpoint
- [ ] Training home matches new grid language
- [ ] Course pages feel consistent with product pages
- [ ] All training functionality preserved

---

## Phase 6: Landing & Auth Pages

**Goal:** Update the landing page and authentication pages.

### 6.1 — Landing Page

- Hero: Two-line title treatment
- Feature cards: Use `FeatureCard` component (emoji circle + title + desc)
- Stat cards: Use `StatCard` component if applicable
- Overall: Match the full-page mockup reference

**Files:** `src/pages/Index.tsx`

### 6.2 — Sign In / Join

- Card-centered layout
- Match new card styling and button treatment
- Softer, friendlier feel

**Files:** `src/pages/SignIn.tsx`, `src/pages/JoinGroup.tsx`

### Phase 6 Checkpoint
- [ ] Landing page showcases the new design language
- [ ] Auth pages feel cohesive

---

## Phase 7: Polish & Dark Mode Audit

**Goal:** Final pass across all pages.

### 7.1 — Dark Mode

- Verify all new components have proper dark mode tokens
- Grey background → dark canvas transition
- Card borders: match dark mode spec from `design-specs.md`
- Image tiles: adjust shadow opacity for dark backgrounds

### 7.2 — Accessibility Audit

- All touch targets still >= 44px
- Color contrast ratios pass WCAG AA
- Focus states visible on all interactive elements
- Screen reader labels intact

### 7.3 — Animation & Microinteraction Polish

- Hover states consistent (subtle grey tint, not heavy shadow)
- Button press feedback (scale 0.98)
- Page transitions smooth
- Loading states match new design (skeleton loaders if needed)

### 7.4 — Cross-Browser / Device Testing

- Chrome, Safari, Firefox
- iPhone SE (375px), iPhone 14 (390px), iPad (768px), Desktop (1280px+)
- Verify no overflow, no cut-off text, no broken grids

### Phase 7 Checkpoint
- [ ] Dark mode polished across all pages
- [ ] Accessibility passes
- [ ] Animations feel smooth
- [ ] Tested on key devices/browsers

---

## Recommended Execution Order

```
Session 1:  Phase 0 (Foundation)        → ~30 min
Session 2:  Phase 1 (Recipes)           → ~60 min (largest phase, sets template)
Session 3:  Phase 2 (Product pages)     → ~45 min (applying template x4)
Session 4:  Phase 3 (Navigation)        → ~30 min
Session 5:  Phase 4 (Manual & Search)   → ~30 min
Session 6:  Phase 5 (Training)          → ~30 min
Session 7:  Phase 6 (Landing & Auth)    → ~20 min
Session 8:  Phase 7 (Polish & Dark)     → ~30 min
```

Each session ends with a commit so we always have a safe rollback point.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | No hook/data changes — purely visual. Test after each phase. |
| Dark mode regression | Phase 7 dedicated to dark mode audit. Interim: acceptable if slightly off. |
| Mobile layout breaks | Test at 375px after every phase. Product viewers are already responsive. |
| Scope creep | Each phase has a clear file list and checkpoint. No "while we're at it" changes. |
| Lost work | Git commit after each phase. Branch if preferred. |

---

## Git Strategy

```bash
# Option A: Single branch, commit per phase
git checkout -b design-overhaul
# ... work on Phase 0 ...
git commit -m "Phase 0: Foundation tokens and shared primitives"
# ... work on Phase 1 ...
git commit -m "Phase 1: Recipes page redesign"
# etc.
git checkout main && git merge design-overhaul

# Option B: Work on main, commit per phase (simpler for solo dev)
git commit -m "design: Phase 0 - foundation tokens and shared primitives"
git commit -m "design: Phase 1 - recipes page redesign"
# etc.
```

---

## Ready to Start

**Phase 0 + Phase 1** can be done in the first session. Phase 0 lays the groundwork
(tokens + shared components), then Phase 1 applies them to `/recipes` as the first
visible result.

After Phase 1, we review together to make sure the direction is right before
rolling it out to the rest of the app.
