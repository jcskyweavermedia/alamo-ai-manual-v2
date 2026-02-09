# STEP 1 — DESIGN SYSTEM + APP SHELL
## Alamo Prime AI Restaurant Ops

**Objective:** Implement the foundational design system and responsive app shell so every future screen is fast to build and visually consistent.

> **Reference:** All values derived from `docs/design-specs.md`

---

## 1. DESIGN TOKEN SYSTEM

### 1.1 Color Tokens (Light & Dark Mode)

Update `src/index.css` with the complete token palette:

#### Light Mode Tokens
```css
:root {
  /* Core Neutrals (from design-specs.md) */
  --background: 240 10% 98%;              /* #F7F7FA - Canvas */
  --foreground: 240 10% 7%;               /* #111114 - Primary Text */
  --card: 0 0% 100%;                      /* #FFFFFF - Surface */
  --card-foreground: 240 10% 7%;
  --popover: 0 0% 100%;                   /* #FFFFFF - Elevated Surface */
  --popover-foreground: 240 10% 7%;
  
  /* Text Hierarchy */
  --muted: 240 5% 96%;
  --muted-foreground: 240 4% 38%;         /* #5A5A66 - Secondary Text */
  --tertiary-foreground: 240 4% 55%;      /* #8A8A96 - Tertiary/Hint Text */
  
  /* Borders/Dividers */
  --border: 240 6% 90%;                   /* #E6E6EB - Hairline */
  --input: 240 6% 90%;
  
  /* Brand Accent - Indigo (recommended in spec) */
  --primary: 243 75% 59%;                 /* #4F46E5 */
  --primary-foreground: 0 0% 100%;
  --primary-hover: 243 75% 51%;           /* 8-12% darker for hover */
  --primary-subtle: 243 75% 59% / 0.12;   /* 10-14% opacity for pills/chips */
  
  /* Secondary Actions */
  --secondary: 240 5% 96%;
  --secondary-foreground: 240 10% 7%;
  
  /* Accent (alias for primary subtle fills) */
  --accent: 240 5% 96%;
  --accent-foreground: 243 75% 59%;
  
  /* Semantic Colors (from design-specs.md) */
  --destructive: 0 72% 51%;               /* #DC2626 - Error (light) */
  --destructive-foreground: 0 0% 100%;
  --success: 142 76% 36%;                 /* #16A34A */
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;                  /* #F59E0B */
  --warning-foreground: 0 0% 0%;
  --info: 243 75% 59% / 0.12;             /* Accent Subtle Fill */
  --info-foreground: 243 75% 59%;
  
  /* Focus Ring */
  --ring: 243 75% 59%;
  
  /* Radius (from design-specs.md) */
  --radius: 0.875rem;                     /* 14px - Buttons/Inputs */
  --radius-card: 1rem;                    /* 16px - Cards */
  --radius-full: 9999px;                  /* Pills/Chips */
  
  /* Shadows / Elevation (from design-specs.md) */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04);
  --shadow-elevated: 0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04);
  --shadow-floating: 0 10px 24px -4px rgb(0 0 0 / 0.12), 0 4px 8px -2px rgb(0 0 0 / 0.06);
}
```

#### Dark Mode Tokens
```css
.dark {
  /* Core Neutrals (from design-specs.md) */
  --background: 240 10% 4%;               /* #0B0B0D - Canvas */
  --foreground: 240 5% 96%;               /* #F5F5F7 - Primary Text */
  --card: 240 10% 8%;                     /* #141418 - Surface */
  --card-foreground: 240 5% 96%;
  --popover: 240 10% 11%;                 /* #1C1C22 - Elevated Surface */
  --popover-foreground: 240 5% 96%;
  
  /* Text Hierarchy */
  --muted: 240 5% 15%;
  --muted-foreground: 240 5% 72%;         /* #B7B7C2 - Secondary Text */
  --tertiary-foreground: 240 5% 57%;      /* #8D8D99 - Tertiary/Hint Text */
  
  /* Borders/Dividers */
  --border: 240 5% 18%;                   /* #2A2A33 */
  --input: 240 5% 18%;
  
  /* Brand Accent - Indigo (slightly brighter for dark) */
  --primary: 243 75% 65%;
  --primary-foreground: 0 0% 100%;
  --primary-hover: 243 75% 57%;
  --primary-subtle: 243 75% 65% / 0.14;
  
  /* Secondary Actions */
  --secondary: 240 5% 15%;
  --secondary-foreground: 240 5% 96%;
  
  /* Accent */
  --accent: 240 5% 15%;
  --accent-foreground: 243 75% 65%;
  
  /* Semantic Colors - brighter for dark (from design-specs.md) */
  --destructive: 0 84% 60%;               /* #EF4444 - Error (dark) */
  --destructive-foreground: 0 0% 100%;
  --success: 142 71% 45%;                 /* #22C55E */
  --success-foreground: 0 0% 100%;
  --warning: 43 96% 56%;                  /* #FBBF24 */
  --warning-foreground: 0 0% 0%;
  --info: 243 75% 65% / 0.14;
  --info-foreground: 243 75% 65%;
  
  --ring: 243 75% 65%;
  
  /* Shadows - rely more on contrast + borders in dark mode */
  --shadow-card: none;
  --shadow-elevated: 0 4px 12px -2px rgb(0 0 0 / 0.3);
  --shadow-floating: 0 10px 24px -4px rgb(0 0 0 / 0.4);
  
  /* Dark mode card border (spec: 1px divider at ~50% opacity) */
  --card-border: 240 5% 18% / 0.5;
}
```

### 1.2 Spacing System (8pt Grid from design-specs.md)

Add to `tailwind.config.ts`:
```ts
spacing: {
  'xs': '0.25rem',    // 4px
  'sm': '0.5rem',     // 8px
  'md': '0.75rem',    // 12px
  'lg': '1rem',       // 16px (mobile content padding)
  'xl': '1.5rem',     // 24px (tablet/desktop content padding)
  '2xl': '2rem',      // 32px
  '3xl': '2.5rem',    // 40px
  '4xl': '3rem',      // 48px
}
```

### 1.3 Typography System (from design-specs.md)

**Font Stack:**
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

**Monospace (for SOP codes/temps/timers):**
```css
font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

**Type Scale (add to tailwind.config.ts):**
```ts
fontSize: {
  'page-title': ['1.375rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.01em' }],    // 22px H1
  'section-title': ['1.125rem', { lineHeight: '1.3', fontWeight: '600' }],  // 18px H2
  'subsection': ['1rem', { lineHeight: '1.35', fontWeight: '600' }],        // 16px H3
  'body': ['0.9375rem', { lineHeight: '1.6' }],                             // 15px - comfort reading
  'body-relaxed': ['0.9375rem', { lineHeight: '1.65' }],                    // 15px - Spanish text
  'small': ['0.8125rem', { lineHeight: '1.5' }],                            // 13px meta
  'caption': ['0.875rem', { lineHeight: '1.5' }],                           // 14px
}
```

**Reading Width Constraint:**
```ts
maxWidth: {
  'reading': '47.5rem',  // 760px - max reading width for tablet/desktop
  'reading-sm': '40rem', // 640px - min comfortable reading width
}
```

---

## 2. CORE UI COMPONENTS

> All components must use design tokens only—no hardcoded colors.

### 2.1 Typography Components
- [ ] `PageTitle` - H1 (22-24px, semibold, tight tracking, line-height 1.2-1.3)
- [ ] `SectionTitle` - H2 (18-20px, semibold, line-height 1.3)
- [ ] `Subsection` - H3 (16-17px, semibold, line-height 1.35)
- [ ] `BodyText` - Body (15-16px, regular, line-height 1.5-1.65)
- [ ] `MetaText` - Caption/Meta (13-14px, muted-foreground)
- [ ] `TertiaryText` - Hint text (tertiary-foreground)

### 2.2 Button Variants (extend existing)
Per design-specs.md:
- [ ] `primary` - Accent fill, white text
- [ ] `secondary` - Subtle neutral fill
- [ ] `tertiary` - Text button (no background)
- [ ] Press state: `scale(0.98)` + opacity shift
- [ ] Disabled: clearly muted
- [ ] Min height: **44px** (touch target)
- [ ] Radius: **14px**

### 2.3 Cards (extend existing)
Per design-specs.md:
- [ ] Radius: **16px**
- [ ] Light mode: white card + `shadow-card`
- [ ] Dark mode: surface card + subtle 1px border (divider token)
- [ ] `CardElevated` variant: stronger shadow + backdrop blur for sheets/modals
- [ ] `CardFloating` variant: for mobile AI assistant

### 2.4 Input Components
- [ ] Search bar: rounded 14-16px, prominent, with clear button, shows recent searches
- [ ] Text input: 44px min height, 14px radius
- [ ] Textarea: same styling

### 2.5 List Components
Per design-specs.md:
- [ ] `ListRow` - Entire row tappable, 44px min height, title + meta + optional icon
- [ ] `ListSection` - Whitespace grouping, minimal separators
- [ ] `ListSeparator` - Hairline divider (border token)

### 2.6 Status & Feedback
Per design-specs.md:
- [ ] `StatusBadge` - Variants: Indexed (success), Pending (warning), Error (destructive)
- [ ] `LoadingSpinner` - Subtle, 120-160ms animations
- [ ] `SkeletonLoader` - For manual lists, reading pages, AI answer cards
- [ ] `EmptyState` - Friendly empty view with recovery action
- [ ] `ErrorState` - Clear error + recovery action

### 2.7 Navigation Elements
Per design-specs.md:
- [ ] `TabBarItem` - Bottom tab: icon + label, strong active state (accent)
- [ ] `SidebarItem` - Desktop/tablet: grouped sections with quick search
- [ ] `Breadcrumb` - For hierarchy navigation (tablet/desktop)

### 2.8 SOP-Specific Components
Per design-specs.md:
- [ ] `Callout` - Variants:
  - **Critical** (safety/food handling): semantic warning styling
  - **Tip** (best practice): info styling
  - **Checklist**: clean list with checkbox affordance
- [ ] `SourceChip` - Tappable source reference (fully rounded pill)
- [ ] `LanguageToggle` - EN/ES switcher, persistent, consistent across app
- [ ] `UsageMeter` - AI usage: gentle meter + "X remaining today", warn at 80%/95%

### 2.9 Additional Components (from design-specs.md)
- [ ] `ManualOutline` - Section tree for navigation
- [ ] `SearchResults` - Result cards with title, snippet, language tag
- [ ] `AIAnswerCard` - Not bubbles; answer card with source chips, expand action
- [ ] `InviteFlow` - Invite acceptance UI

---

## 3. APP SHELL STRUCTURE

### 3.1 Mobile Shell (< 768px)
Per design-specs.md: **One-handed, immediate answers**

```
┌─────────────────────────┐
│ Header                  │
│ [Logo] [Search] [Lang]  │
├─────────────────────────┤
│                         │
│                         │
│    Content Area         │
│    (scrollable)         │
│    padding: 16px        │
│                         │
├─────────────────────────┤
│ Bottom Tab Bar (44px+)  │
│ [Manual][Search][AI][⚙] │
└─────────────────────────┘
```

**Staff tabs:** Manual, Search, Ask (AI), Profile
**Admin tabs:** Manual, Search, Ask (AI), Admin

### 3.2 Tablet Shell (768px - 1024px)
Per design-specs.md: **Split view preferred, reference + training**

```
┌───────────────┬─────────────────────────┐
│ Sidebar       │ Header                  │
│ (grouped)     │ [Search] [Lang]         │
│               ├─────────────────────────┤
│ Manual        │                         │
│ Search        │    Main Content         │
│ Ask AI        │    (reading panel)      │
│ ──────        │    padding: 20-24px     │
│ Admin         │    max-width: 760px     │
│               │                         │
└───────────────┴─────────────────────────┘
```

AI assistant: right-side panel OR floating card (doesn't cover content)

### 3.3 Desktop Shell (> 1024px)
Per design-specs.md: **Knowledge base + admin**

```
┌───────────────┬─────────────────────────────────────┬───────────────┐
│ Sidebar       │ Header [Search] [Lang]              │ AI Panel      │
│ (persistent)  ├─────────────────────────────────────┤ (docked)      │
│               │                                     │               │
│ Manual        │    Main Content                     │ Sources open  │
│ Search        │    (centered, max-width: 760px)     │ in-place      │
│ Ask AI        │    padding: 24px                    │               │
│ ──────        │                                     │               │
│ Admin         │                                     │               │
└───────────────┴─────────────────────────────────────┴───────────────┘
```

---

## 4. MOTION & ANIMATION

Per design-specs.md:

| Type | Duration | Usage |
|------|----------|-------|
| Micro feedback | 120-160ms | Button press, toggle, haptic |
| Screen transitions | 200-260ms | Navigation, fade + slide |
| Sheets | 260-320ms | Slide up (mobile), centered modal (desktop) |

**Motion types:**
- Fade + slide for navigation
- Gentle scale on press states (`scale(0.98)`)
- Pulse for voice listening state only
- No decorative motion

---

## 5. IMPLEMENTATION TASKS

### Phase 1: Design Tokens (Day 1)
- [ ] Update `src/index.css` with complete color tokens (light/dark) per spec
- [ ] Add tertiary-foreground, primary-hover, primary-subtle tokens
- [ ] Add shadow tokens (card, elevated, floating)
- [ ] Add card-border token for dark mode
- [ ] Update `tailwind.config.ts`:
  - [ ] Spacing scale (8pt grid)
  - [ ] Typography scale with correct line-heights
  - [ ] Radius tokens (14px, 16px, 9999px)
  - [ ] Max-width for reading (640-760px)
  - [ ] Custom colors (success, warning, info, tertiary)
- [ ] Add font-family declarations
- [ ] Test dark mode toggle

### Phase 2: Core Components (Day 2-3)
- [ ] Create `src/components/ui/typography.tsx`
- [ ] Extend `Button` with variants + press states + 44px touch target
- [ ] Extend `Card` with elevation variants + dark mode border
- [ ] Create `src/components/ui/status-badge.tsx`
- [ ] Create `src/components/ui/skeleton-loader.tsx`
- [ ] Create `src/components/ui/empty-state.tsx`
- [ ] Create `src/components/ui/error-state.tsx`
- [ ] Create `src/components/ui/list-row.tsx`
- [ ] Create `src/components/ui/callout.tsx`

### Phase 3: Navigation Components (Day 3-4)
- [ ] Create `src/components/layout/MobileTabBar.tsx` (icon + label, 44px+)
- [ ] Create `src/components/layout/Sidebar.tsx` (grouped sections)
- [ ] Create `src/components/layout/Header.tsx` (search + language toggle)
- [ ] Create `src/components/layout/AppShell.tsx` (responsive wrapper)
- [ ] Create `src/components/ui/language-toggle.tsx` (persistent EN/ES)
- [ ] Create `src/components/ui/source-chip.tsx`
- [ ] Create `src/components/ui/usage-meter.tsx`

### Phase 4: App Shell Integration (Day 4-5)
- [ ] Implement responsive layout switching (mobile ↔ tablet ↔ desktop)
- [ ] Set up React Router structure
- [ ] Create placeholder pages:
  - [ ] Manual (with ManualOutline placeholder)
  - [ ] Search (with SearchResults placeholder)
  - [ ] Ask (with AIAnswerCard placeholder)
  - [ ] Profile
  - [ ] Admin (role-gated later)
- [ ] Add transitions: fade + slide (200-260ms)
- [ ] Implement persistent navigation state

### Phase 5: Polish & Testing (Day 5)
- [ ] Test all components in light/dark mode
- [ ] Verify touch targets (44px minimum)
- [ ] Test responsive breakpoints (768px, 1024px)
- [ ] Verify animation timings match spec
- [ ] Accessibility audit:
  - [ ] WCAG AA contrast ratios
  - [ ] Focus ring states visible
  - [ ] Screen reader friendly
- [ ] Test in simulated dim/bright conditions

---

## 6. FILE STRUCTURE

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          # Responsive wrapper
│   │   ├── MobileTabBar.tsx      # Bottom navigation (mobile)
│   │   ├── Sidebar.tsx           # Side navigation (tablet/desktop)
│   │   ├── Header.tsx            # Top bar with search + lang toggle
│   │   └── ContentArea.tsx       # Scrollable content with max-width
│   │
│   ├── ui/
│   │   ├── typography.tsx        # PageTitle/SectionTitle/Body/Meta/Tertiary
│   │   ├── button.tsx            # Extended variants + press states
│   │   ├── card.tsx              # Extended with CardElevated, CardFloating
│   │   ├── status-badge.tsx      # Indexed/Pending/Error
│   │   ├── skeleton-loader.tsx   # Loading placeholders
│   │   ├── empty-state.tsx       # Empty views
│   │   ├── error-state.tsx       # Error recovery
│   │   ├── list-row.tsx          # Tappable list item
│   │   ├── callout.tsx           # Critical/Tip/Checklist
│   │   ├── language-toggle.tsx   # EN/ES switcher
│   │   ├── source-chip.tsx       # AI citation chip
│   │   └── usage-meter.tsx       # AI usage indicator
│   │
│   └── manual/                   # (Phase 2: Manual Reader)
│       └── ManualOutline.tsx     # Section tree
│
├── hooks/
│   ├── use-mobile.tsx            # (exists)
│   ├── use-theme.tsx             # Dark mode hook
│   └── use-language.tsx          # EN/ES preference (localStorage → profile)
│
├── pages/
│   ├── Index.tsx                 # Landing/redirect
│   ├── Manual.tsx                # Manual reader (placeholder)
│   ├── Search.tsx                # Search (placeholder)
│   ├── Ask.tsx                   # AI assistant (placeholder)
│   ├── Profile.tsx               # User profile (placeholder)
│   └── Admin.tsx                 # Admin panel (placeholder, role-gated)
│
└── lib/
    └── constants.ts              # Route paths, breakpoints, animation durations
```

---

## 7. ROUTES

```tsx
const routes = [
  { path: '/', element: <Index /> },
  { path: '/manual', element: <Manual /> },
  { path: '/manual/:sectionId', element: <ManualSection /> },
  { path: '/search', element: <Search /> },
  { path: '/ask', element: <Ask /> },
  { path: '/profile', element: <Profile /> },
  { path: '/admin', element: <Admin /> },  // Role-gated later
];
```

---

## 8. SUCCESS CRITERIA

✅ **Design Tokens Complete**
- Light/dark mode with all semantic colors from spec
- Tertiary text, primary-hover, primary-subtle tokens
- Shadow tokens for 3 elevation levels
- 8pt grid spacing applied consistently
- Typography scale matches spec (line-heights, letter-spacing)
- Reading max-width: 640-760px

✅ **Core Components Ready**
- All listed components built
- Components use ONLY design tokens (no hardcoded colors)
- 44px minimum touch targets on mobile
- 14px radius buttons/inputs, 16px radius cards
- Press states with scale(0.98)

✅ **App Shell Functional**
- Responsive layout switches at 768px and 1024px
- Mobile: bottom tabs, tablet: split view, desktop: sidebar + AI panel
- Navigation works on all device sizes
- Smooth transitions (200-260ms)

✅ **Accessibility Met**
- WCAG AA contrast ratios
- Focus ring states visible (accent color)
- Screen reader friendly
- Works in dim kitchens and bright dining rooms

---

## 9. DEPENDENCIES

No new packages required. Using existing:
- `next-themes` - dark mode
- `lucide-react` - icons (line-based, rounded, 2px stroke)
- `react-router-dom` - routing
- `tailwindcss-animate` - animations

---

## 10. ICON GUIDELINES (from design-specs.md)

**Style:**
- Line-based, consistent stroke weight (2px equivalent)
- Rounded terminals, simple shapes
- Friendly but professional

**Standard icons:**
- Manual: `Book` / `BookOpen`
- SOP section: `List` / `ListChecks`
- Search: `Search`
- AI: `Sparkles` or chat bubble with sparkle
- Voice: `Mic`
- Status: `Check`, `Clock`, `AlertTriangle`, `XCircle`
- Language: `Globe` or `Languages`

Always pair icons with labels in navigation and ambiguous actions.

---

## 11. NOTES

- **Font stack**: System fonts only—no custom font loading
- **Max reading width**: 640-760px for content columns
- **Animation durations**: 120-160ms micro, 200-260ms transitions, 260-320ms sheets
- **Language**: EN/ES stored in localStorage initially, later synced to user profile
- **Dark mode cards**: Must have subtle 1px border (divider at ~50% opacity)
- **Spanish text**: Allow slightly higher line-height (1.65) to prevent cramping
