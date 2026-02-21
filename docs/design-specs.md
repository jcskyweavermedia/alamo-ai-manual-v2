# DESIGN SPECIFICATION DOCUMENT — Alamo Ai Manual (Restaurant Operations Manual + AI)

## DESIGN PRINCIPLES

**North Star:** *Instant clarity under pressure.* Staff should access SOPs and get grounded answers in seconds, with minimal taps and minimal reading.

1. **Clarity over cleverness**
   Simple hierarchy, predictable layouts, obvious actions.
2. **Calm, low-noise UI**
   Neutral surfaces, restrained color, consistent spacing rhythm.
3. **Progressive disclosure**
   Default answers are concise; details expand on demand.
4. **Confidence through grounding**
   AI always points to source sections; uncertainty is communicated plainly.
5. **Mobile-first practicality**
   Big touch targets, one-handed ergonomics, high readability in busy environments.
6. **Bilingual by design (EN/ES)**
   Language choice is persistent and consistent across manual/search/AI.
7. **System-native familiarity**
   Behavior and patterns feel “iOS-like”: sheets, tabs, search, back navigation, microfeedback.

---

## VISUAL DESIGN LANGUAGE

### Color system (Light & Dark Mode)

**Philosophy:** Neutral-first with a single calm accent; semantic colors for status; avoid “marketing” colors inside the product.

Use a token-based palette (names below are design tokens; exact hex values can be finalized during implementation, but keep these ranges).

#### Core neutrals (recommended)

**Light mode**

* **Background / Canvas:** `#F7F7FA` (soft off-white)
* **Surface / Cards:** `#FFFFFF`
* **Elevated Surface (sheets/modals):** `#FFFFFF` with subtle shadow
* **Hairline / Dividers:** `#E6E6EB`
* **Primary Text:** `#111114`
* **Secondary Text:** `#5A5A66`
* **Tertiary/Hint Text:** `#8A8A96`

**Dark mode**

* **Background / Canvas:** `#0B0B0D` (near-black, not pure)
* **Surface / Cards:** `#141418`
* **Elevated Surface (sheets/modals):** `#1C1C22`
* **Hairline / Dividers:** `#2A2A33`
* **Primary Text:** `#F5F5F7`
* **Secondary Text:** `#B7B7C2`
* **Tertiary/Hint Text:** `#8D8D99`

#### Accent color (single brand accent)

Choose one accent and use it consistently for primary actions and selection states. Recommended Apple-like accents:

* **Indigo (recommended):** `#4F46E5` (calm, premium)
* Alternate options (only pick one):

  * **Blue:** `#0A84FF` (more “system”)
  * **Teal:** `#14B8A6` (calm, modern)

Accent tokens:

* **Accent / Primary:** (chosen)
* **Accent Hover/Pressed:** 8–12% darker
* **Accent Subtle Fill:** Accent at 10–14% opacity for pills/chips

#### Semantic colors (status)

Use system-like, restrained semantics. Avoid neon saturation; ensure contrast.

* **Green (standard):** `#2AA962` — use as the go-to green across the app (controls, badges, success states)
* **Success:** `#16A34A` (light), `#22C55E` (dark)
* **Warning:** `#F59E0B` (light), `#FBBF24` (dark)
* **Error:** `#DC2626` (light), `#EF4444` (dark)
* **Info:** use Accent Subtle Fill + Accent text/icon

#### Color usage rules

* Neutral surfaces dominate (80–90% of UI).
* Accent appears only for:

  * primary button
  * active tab / active nav item
  * key links (“Open source section”)
  * focus ring states
* Semantic colors used only for:

  * content status (Indexed / Pending / Error)
  * usage limit warnings
  * critical callouts in manual (rare)

---

### Typography system (Fonts, sizes, hierarchy)

**Primary font:** **SF Pro** (or system font stack; iOS-native feel).
**Fallback stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

**Monospace (for SOP codes / temps / timers if needed):** `SF Mono` (fallback to ui-monospace)

#### Type scale (recommended)

* **Page Title (H1):** 22–24px, semibold, tight tracking
* **Section Title (H2):** 18–20px, semibold
* **Subsection (H3):** 16–17px, semibold
* **Body:** 15–16px, regular
* **Small/Meta:** 13–14px, regular

#### Readability rules

* Line height:

  * Titles: 1.2–1.3
  * Body: 1.5–1.65 (comfort reading)
* Max reading width on tablet/desktop: **640–760px** per column
* Avoid long all-caps; use sentence case.
* Spanish copy must not be visually cramped—keep slightly higher line height if needed.

---

### Spacing & layout rhythm

* **8pt grid** for all spacing.
* Common spacing tokens:

  * xs: 4
  * sm: 8
  * md: 12
  * lg: 16
  * xl: 24
  * 2xl: 32
* Default content padding:

  * Mobile: 16px
  * Tablet/Desktop: 20–24px
* Touch targets:

  * Minimum height: **44px**
  * Minimum icon button: **40px** with 44px hit area

---

### Rounded elements

* **Cards:** 16px radius
* **Buttons:** 14px radius
* **Inputs/search bars:** 14–16px radius
* **Chips/pills:** 999px (fully rounded)

---

### Shadows and depth (elevation)

Use minimal, soft shadows. In dark mode, rely more on contrast than shadow.

* **Elevation 1 (cards):** subtle shadow in light; in dark use slightly lighter surface instead
* **Elevation 2 (sheets/modals):** stronger shadow + backdrop blur
* **Elevation 3 (floating assistant on mobile):** shadow + subtle border

Add a soft border (1px) on cards in dark mode to define separation: Divider token at ~50% opacity.

---

### Icon style

* Line-based, consistent stroke weight (2px equivalent).
* Rounded terminals, simple shapes, friendly but professional.
* Prefer familiar metaphors:

  * Manual: book
  * SOP section: list/bullets
  * Search: magnifier
  * AI: sparkle or chat bubble with sparkle
  * Voice: mic
  * Status: check, clock, warning triangle, x-circle
* Pair icons with labels in navigation and in ambiguous actions.

---

### Animation & motion

* Short, subtle, purposeful.
* Standard durations:

  * Micro feedback: 120–160ms
  * Screen transitions: 200–260ms
  * Sheets: 260–320ms
* Motion types:

  * Fade + slide for navigation
  * Gentle scale on press states
  * Pulse for listening state only
* No decorative motion.

---

## MOBILE-FIRST EXPERIENCE

### Phone (iPhone)

**Goal:** One-handed, immediate answers.

* Bottom tab navigation
* Search and AI always within one action
* Reading pages optimized for scan:

  * short sections
  * collapsible subsections
  * clear callouts for “Critical” steps

### Tablet (iPad)

**Goal:** Reference + training.

* Split view preferred:

  * left: manual outline / search results
  * right: reading panel
* AI assistant appears as:

  * right-side panel OR floating card that doesn’t cover content
* Better for onboarding and shift prep.

### Desktop

**Goal:** Knowledge base + admin.

* Persistent sidebar for manual structure and admin tools.
* Controlled reading width, centered column.
* AI docked on the right, sources open in-place.

---

## NAVIGATION MODEL

### Primary navigation (role-aware)

**Staff**

* Manual
* Search
* Ask (AI)
* Profile

**Admin**

* Manual
* Search
* Ask (AI)
* Admin (Content + Invites + Usage)

### Manual navigation

* Hierarchy mirrors Markdown structure:

  * Category → Section → Page
* “Jump back” behavior is consistent:

  * Mobile: back stack
  * Tablet/Desktop: breadcrumbs + sidebar selection

### Search behavior

* Single search entry point (global).
* Results grouped:

  1. Best Matches (hybrid retrieval ranking)
  2. Exact Hits (keyword)
  3. Related SOPs
* Result card displays:

  * Title
  * 1–2 line snippet
  * Language (EN/ES)
  * “Open section”

### AI assistant access

* Dedicated AI tab (always)
* Contextual “Ask about this” inside manual reading pages
* Optional floating quick-access (mobile) if it does not clutter

---

## MANUAL READING EXPERIENCE

### Overall feel

* Calm, book-like, highly readable.
* UI chrome gets out of the way once reading starts.

### Scrolling and structure

* Smooth continuous scroll per page.
* Sticky page title optional (tablet/desktop) for orientation.
* Table of contents for long pages, collapsible on mobile.

### Collapsible sections

* H3 subsections collapsible by default when long.
* State persists while user remains in the page/session.

### Callouts

Use structured callouts sparingly:

* **Critical** (safety/food handling/closing cash): semantic warning styling
* **Tip** (best practice): info styling
* **Checklist** blocks: clean list with checkbox affordance (optional future feature)

### Focus Mode

* Toggle in reading header:

  * increases font size slightly
  * hides extra chrome
  * keeps “Ask about this” available

---

## AI ASSISTANT EXPERIENCE

### Interaction modes

* **Voice input** and **text input** are equal citizens.
* Voice is one-tap with clear states.

### Voice UX

States:

1. Idle (mic icon)
2. Listening (pulse + “Listening…”)
3. Processing ( “Searching manual…” )
4. Responding (text appears; optional voice playback)

* Live transcription visible and editable before sending.
* Tap-to-stop always available.

### Default answer format (concise)

* **Direct answer (1–2 sentences)**
* **Steps (2–5 bullets) if procedural**
* **Source chips** (tap to open manual sections)
* **Confidence behavior:**

  * If manual coverage is weak: say so and show closest sources.
  * If question is off-topic: refuse and redirect.

### Expanded answer

* “Expand answer” reveals:

  * more detail
  * edge cases
  * related SOP links
* Expansion remains attached to the same answer card (no “new thread” feel).

### AI safety messaging

* Short, calm statements:

  * “Answers come from your manual.”
  * “I can only help with restaurant operations here.”
* Usage limits:

  * show a gentle meter and “X remaining today”
  * warn at thresholds (e.g., 80%, 95%)
  * clear CTA: “Request more access” (admins) or “Try again tomorrow”

### Loading states

* Stage-based:

  * “Searching manual…”
  * “Selecting best sections…”
  * “Writing answer…”
* Avoid long blank waits; show skeleton answer card with source placeholders.

### Conversation UX

* Keep threads short, task-based.
* “New question” resets.
* Language toggle in assistant header:

  * “English / Español”
  * persists across sessions.

---

## ICONOGRAPHY SYSTEM

### Style rules

* Outline icons, rounded, consistent stroke.
* Use the same family across the app.
* Avoid filled icons except for active states if needed.

### When icons are used

* Navigation
* Content types (checklist, policy, recipe, opening/closing)
* Status (Indexed/Pending/Error)
* Actions (search, mic, expand, share, copy link)

### Tone

* Minimal, calm, professional, friendly.

---

## COMPONENT DESIGN GUIDELINES

### Cards

* Default container for:

  * search results
  * manual section previews
  * AI answers
* Light mode: white card + soft shadow
* Dark mode: surface card + subtle border (divider token)

### Buttons

* Primary: accent fill, white text (light mode) / near-white text (dark)
* Secondary: subtle neutral fill
* Tertiary: text button
* Press states: subtle scale (0.98) + opacity shift

### Lists

* Use whitespace grouping; separators minimal.
* Each row: title + meta + optional icon.
* Entire row tappable on mobile.

### Section headers

* Clear spacing above/below.
* Optional anchor icon for share/copy link (admin or desktop use).

### Search bars

* Prominent, rounded, with “clear” control.
* Shows recent searches and suggested queries.

### AI chat interface

* Answer cards, not noisy bubbles.
* Source chips at bottom of each answer.
* Expand action is always visible when applicable.

### Navigation elements

* Bottom tabs: icon + label, strong active state.
* Tablet/Desktop: sidebar with grouped sections and quick search.

---

## MICROINTERACTIONS

### Button feedback

* Press animation + haptic (mobile) on key actions.
* Disabled states are clearly muted.

### Transitions

* Screen: slide/fade
* Sheets: slide up (mobile) / centered modal (desktop)

### Voice listening

* Mic pulse + waveform optional.
* Strong visual clarity; never ambiguous.

### AI thinking

* Subtle dots + text label (“Searching manual…”)

### Content loading

* Skeleton loaders for:

  * manual lists
  * reading pages
  * AI answer card

---

## ACCESSIBILITY AND CLARITY

* Contrast meets WCAG AA for text and UI elements.
* Default body text size at least 15–16px.
* Large touch targets (44px min).
* Clear error states and recovery actions.
* Avoid tiny, low-contrast metadata; ensure readability in dim kitchens and bright dining rooms.
* Voice features must be usable in loud environments:

  * clear start/stop state
  * easy transcription edit
  * resilient UX if speech recognition fails

---

## LOVABLE IMPLEMENTATION NOTES (No code)

* Build a **token-driven design system** inside Lovable:

  * Color tokens for light/dark
  * Typography styles (H1/H2/H3/Body/Meta)
  * Spacing scale (8pt grid)
  * Radius + elevation levels
* Create reusable modules:

  * ManualOutline, ReadingPage, SearchResults, AIAnswerCard, SourceChips, LanguageToggle, UsageMeter, StatusBadge, InviteFlow
* Enforce consistent states across components:

  * loading / empty / error / success
  * indexed / pending / needs processing
* Prioritize perceived performance:

  * skeletons, progressive rendering, immediate feedback for taps
* Ensure bilingual content is first-class:

  * language tags visible where needed
  * consistent toggles
  * “missing translation” status for admin

This spec defines the visual and interaction system strongly enough to implement consistently in Lovable while leaving room to finalize brand accent selection and content structure details during build.
