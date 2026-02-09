# Step 6b: Docked AI Panel + Fixed Sidebar Layout

> **Goal**: Replace the overlay Sheet on desktop with a docked side panel that pushes content, AND fix the sidebar scrolling issue so all side columns remain fixed while only the main content scrolls.

---

## Problem Statement

### Issue 1: Modal Overlay Blocks Content
Current implementation uses a modal Sheet with dark overlay on desktop. This blocks the manual content, preventing users from referencing it while asking AI questions—a core study/reference use case.

### Issue 2: Sidebars Scroll Out of View
The Contents (left) and In-Page TOC (right) columns use `sticky top-20` inside `ContentArea`, but `ContentArea` has `overflow-y-auto` making IT the scroll container. Sticky positioning fails because the sticky element's parent is the scroll container itself.

**Current Broken Structure:**
```
AppShell
├── Sidebar (app nav) — OK, outside scroll
└── ContentArea (overflow-y-auto) ← SCROLL CONTAINER
    └── Manual.tsx flex container
        ├── aside.sticky ← FAILS (inside scroll container)
        ├── main content
        └── aside.sticky ← FAILS (inside scroll container)
```

---

## Design Decision

| Viewport | Current | New |
|----------|---------|-----|
| **Desktop (≥1024px)** | Right Sheet with overlay; sidebars scroll away | Docked panel; fixed sidebars with independent scroll |
| **Mobile/Tablet (<1024px)** | Bottom Drawer | Bottom Drawer (no change) |

---

## Visual Spec

### Desktop: 4-Column Layout (Panel Open)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Header                                                              [EN] [ES]  │
├────────┬───────────┬─────────────────────────────┬──────────┬──────────────────┤
│        │           │                             │          │                  │
│ App    │ Contents  │  Main Content               │ On This  │ ✨ Ask about:    │
│ Side   │ (fixed)   │  (ONLY THIS SCROLLS)        │ Page     │    Temperature   │
│ bar    │           │                             │ (fixed)  │ ────────────────│
│        │ ↕ own     │  ↕ primary scroll           │          │ [Usage meter]   │
│ Manual │   scroll  │                             │ ↕ own    │ ────────────────│
│ Search │           │  Long content here...       │   scroll │ [Input] [Send]  │
│ Ask AI │           │                             │          │ ────────────────│
│        │           │                             │ - H2     │                 │
│        │ - Welcome │  ...continues scrolling...  │ - H3     │ [Answer/Empty]  │
│        │ - Safety  │                             │ - H2     │                 │
│        │ - Equip   │                             │          │          [Close]│
├────────┴───────────┴─────────────────────────────┴──────────┴──────────────────┤
│ Mobile Tab Bar (hidden on desktop)                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Desktop: Panel Closed
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Header                                                              [EN] [ES]  │
├────────┬───────────┬───────────────────────────────────────────────┬───────────┤
│        │           │                                               │           │
│ App    │ Contents  │  Main Content                                 │ On This   │
│ Side   │ (fixed)   │  (SCROLLS INDEPENDENTLY)                      │ Page      │
│ bar    │           │                                               │ (fixed)   │
│        │           │                                               │           │
│        │           │                                               │           │
│        │           │                                               │           │
├────────┴───────────┴───────────────────────────────────────────────┴───────────┤
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile: Bottom Drawer (Unchanged)
```
┌─────────────────────┐
│ Header              │
├─────────────────────┤
│                     │
│  Manual Content     │
│  (scrolls normally) │
│                     │
├─────────────────────┤
│ ═══════════════════ │  ← Drag handle
│ ✨ Ask about: Temp  │
│ ─────────────────── │
│ [Input] [Send]      │
│ ─────────────────── │
│ [Content]           │
│                     │
└─────────────────────┘
```

---

## Technical Approach

### Solution: Restructure Scroll Containers

The key insight: each column needs to be its own scroll container, positioned relative to the viewport (not the scrolling content area).

**Target Structure:**
```
AppShell (flex, min-h-screen)
├── App Sidebar (shrink-0) — existing, no change
└── Main area (flex-1, flex-col, min-w-0)
    ├── Header (shrink-0, sticky top-0) — existing, no change
    └── ContentArea (flex-1, overflow-hidden) ← KEY: overflow hidden
        └── Manual.tsx (flex, h-full)
            ├── Contents aside (w-56, h-full, overflow-y-auto, py-lg)
            ├── Main content (flex-1, h-full, overflow-y-auto, py-lg) ← PRIMARY SCROLL
            ├── In-Page TOC aside (w-44, h-full, overflow-y-auto, py-lg)
            └── AI Panel (w-80, h-full, overflow-y-auto) [when open]
```

**Changes Required:**
1. `ContentArea.tsx`: Add `overflow` prop, default 'auto', Manual passes 'hidden'
2. `ContentArea.tsx`: When `overflow="hidden"`, remove `pb-24` (handled by child)
3. `Manual.tsx`: Set `h-full` on flex container, each column gets own `overflow-y-auto`
4. `Manual.tsx`: Add `pb-24 md:pb-6` to main content scroll area (for mobile tab bar)
5. Remove `sticky` positioning (not needed when columns are fixed height)
6. Use `ScrollArea` component for sidebar scrolling (or native overflow-y-auto)

**Critical: IntersectionObserver Fix**
The `InPageTOC` component uses IntersectionObserver with `root: null` (viewport). When main content becomes its own scroll container, this breaks.

**Solution**: Pass a `scrollContainerRef` to InPageTOC:
```tsx
// Manual.tsx
const mainContentRef = useRef<HTMLDivElement>(null);

<main ref={mainContentRef} className="flex-1 overflow-y-auto ...">
  ...
</main>

<InPageTOC markdown={markdown} scrollContainerRef={mainContentRef} />
```

```tsx
// InPageTOC.tsx - update observer
const observer = new IntersectionObserver(
  (entries) => { ... },
  {
    root: scrollContainerRef?.current ?? null,  // Use scroll container
    rootMargin: '-80px 0px -70% 0px',
    threshold: 0,
  }
);
```

---

## Component Architecture

### Current Flow
```
Manual.tsx
  └── AskAboutSheet (responsive wrapper)
        ├── Sheet (desktop) ← overlays with dark background
        └── Drawer (mobile)
              └── AskAboutContent
```

### New Flow
```
Manual.tsx
  ├── ManualSidebar (Contents column, fixed, own scroll)
  ├── ManualMainContent (primary scroll area)
  ├── ManualTOCSidebar (In-Page TOC column, fixed, own scroll)
  ├── DockedAIPanel (desktop, fixed, own scroll)
  └── AskAboutSheet (mobile only - drawer)
        └── AskAboutContent
```

---

## Detailed Implementation

### Phase 1: Layout Infrastructure (1 prompt)

**1. Update ContentArea.tsx**
```tsx
interface ContentAreaProps {
  // ... existing props
  /** Control overflow behavior */
  overflow?: 'auto' | 'hidden' | 'visible';
}

export function ContentArea({
  overflow = 'auto',
  ...
}: ContentAreaProps) {
  return (
    <main
      className={cn(
        "flex-1",
        overflow === 'auto' && "overflow-y-auto",
        overflow === 'hidden' && "overflow-hidden",
        overflow === 'visible' && "overflow-visible",
        // ... existing classes
      )}
    >
      {/* ... */}
    </main>
  );
}
```

**2. Create ManualLayout.tsx** (optional refactor)
Extract the 4-column layout logic from Manual.tsx for cleaner code.

### Phase 2: Fixed Sidebars with Independent Scroll (1 prompt)

**Update Manual.tsx structure:**
```tsx
<ContentArea 
  constrainWidth={false} 
  overflow="hidden"  // Delegate scroll to children
  className="h-full"
>
  <div className="flex h-full gap-lg xl:gap-xl w-full">
    {/* Left: Contents - fixed height, independent scroll */}
    <aside className="hidden lg:flex flex-col w-56 shrink-0 h-full py-lg">
      <SectionTitle className="shrink-0 px-1 mb-md">
        {language === 'es' ? 'Contenido' : 'Contents'}
      </SectionTitle>
      <ScrollArea className="flex-1">
        <ManualOutline ... />
      </ScrollArea>
    </aside>

    {/* Center: Main content - PRIMARY scroll */}
    <main className="flex-1 min-w-0 overflow-y-auto h-full py-lg space-y-lg">
      <ManualBreadcrumb />
      <ManualHeader />
      <TranslationBanner />
      <ManualContent showTOC={false} />  {/* TOC moved out */}
    </main>

    {/* Right: In-Page TOC - fixed height, independent scroll */}
    <aside className="hidden xl:flex flex-col w-44 shrink-0 h-full py-lg">
      <ScrollArea className="flex-1">
        <InPageTOC markdown={markdown} />
      </ScrollArea>
    </aside>

    {/* AI Panel - fixed, independent scroll (when open) */}
    {isDesktop && askSheetOpen && (
      <DockedAIPanel ... />
    )}
  </div>
</ContentArea>
```

### Phase 3: Create DockedAIPanel (1 prompt)

**File: `src/components/manual/DockedAIPanel.tsx`**
```tsx
interface DockedAIPanelProps {
  sectionId: string;
  sectionTitle: string;
  language: 'en' | 'es';
  onClose: () => void;
  onNavigateToSection: (slug: string) => void;
}

export function DockedAIPanel({
  sectionId,
  sectionTitle,
  language,
  onClose,
  onNavigateToSection,
}: DockedAIPanelProps) {
  const displayTitle = sectionTitle.length > 25 
    ? sectionTitle.slice(0, 25) + '...' 
    : sectionTitle;

  const labels = {
    title: language === 'es' ? 'Preguntar sobre:' : 'Ask about:',
    close: language === 'es' ? 'Cerrar' : 'Close',
  };

  // Handle navigation (close isn't needed since panel stays open)
  const handleNavigate = (slug: string) => {
    onNavigateToSection(slug);
  };

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <aside 
      className={cn(
        "w-80 xl:w-96 shrink-0 h-full",
        "flex flex-col",
        "border-l border-border bg-background",
        "animate-in slide-in-from-right duration-200"
      )}
      role="complementary"
      aria-label={labels.title}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-sm min-w-0">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <span className="text-base font-semibold truncate">
            {labels.title} {displayTitle}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{labels.close}</span>
        </Button>
      </div>
      
      {/* Content - scrollable */}
      <AskAboutContent
        sectionId={sectionId}
        sectionTitle={sectionTitle}
        language={language}
        onNavigateToSection={handleNavigate}
        className="flex-1 min-h-0"
      />
    </aside>
  );
}
```

### Phase 4: Simplify AskAboutSheet (1 prompt)

Remove desktop Sheet logic—now only handles mobile drawer:

```tsx
export function AskAboutSheet(props) {
  // Remove isDesktop check - this component only renders on mobile
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] flex flex-col">
        {/* ... existing drawer content ... */}
      </DrawerContent>
    </Drawer>
  );
}
```

### Phase 5: Polish (1 prompt)

1. Add slide-in/out animation using `animate-in/animate-out` classes
2. Focus management: move focus to input when panel opens
3. Test all viewports
4. Verify dark mode
5. Handle edge cases (404 section, etc.)

---

## File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `src/components/layout/ContentArea.tsx` | UPDATE | Add `overflow` prop; conditionally apply padding |
| `src/pages/Manual.tsx` | UPDATE | Restructure to 4-column fixed layout with independent scroll; add mainContentRef |
| `src/components/manual/ManualContent.tsx` | UPDATE | Remove In-Page TOC (moved to Manual.tsx) |
| `src/components/manual/InPageTOC.tsx` | UPDATE | Add `scrollContainerRef` prop for IntersectionObserver root |
| `src/components/manual/DockedAIPanel.tsx` | CREATE | New desktop-only docked panel |
| `src/components/manual/AskAboutSheet.tsx` | UPDATE | Remove Sheet logic, keep only Drawer |
| `src/components/manual/index.ts` | UPDATE | Export DockedAIPanel |

---

## Success Criteria

### Layout & Scrolling
- [ ] Contents sidebar stays visible while scrolling main content
- [ ] In-Page TOC stays visible while scrolling main content  
- [ ] Each column scrolls independently when its content overflows
- [ ] Main content is the primary scroll area
- [ ] No "sticky" jank or jumping

### AI Panel (Desktop)
- [ ] Opens as docked panel (no overlay, no darkening)
- [ ] Manual content remains fully visible and readable
- [ ] Panel has its own scroll for long conversations
- [ ] Close button (X) works
- [ ] Escape key closes panel

### AI Panel (Mobile)
- [ ] Opens as bottom drawer (existing behavior, unchanged)
- [ ] Drawer has proper drag handle

### Responsive Breakpoints
- [ ] Desktop (≥1024px): 4-column layout (contents, main, toc, ai)
- [ ] Large tablet (768-1023px): 2-column + drawer
- [ ] Mobile (<768px): Single column + drawer

### Design
- [ ] Matches existing design system (borders, spacing, colors)
- [ ] Dark mode fully supported
- [ ] Smooth open/close animation

---

## Implementation Order

| Phase | Focus | Prompts |
|-------|-------|---------|
| 1 | Layout Infrastructure (ContentArea overflow prop) | 1 |
| 2 | Fixed Sidebars (Manual.tsx restructure) | 1 |
| 3 | Docked AI Panel (new component) | 1 |
| 4 | Simplify AskAboutSheet (mobile only) | 1 |
| 5 | Polish (animation, focus, testing) | 1 |

**Total: 5 prompts**

---

## Edge Cases

| Case | Handling |
|------|----------|
| Very long section title | Truncate with ellipsis (25 chars in panel header) |
| Contents sidebar overflow | ScrollArea handles internal scrolling |
| In-Page TOC overflow | ScrollArea handles internal scrolling |
| Narrow desktop (1024-1280px) | AI panel w-80 (320px), content shrinks |
| Wide desktop (>1536px) | AI panel w-96 (384px), generous spacing |
| Panel open + navigate to new section | Keep panel open, update context |
| Panel open + 404 section | Close panel when section not found |
| Keyboard navigation | Tab through sidebar → main → toc → panel |

---

## Technical Gotchas & Mitigations

### 1. IntersectionObserver Root Context
**Issue**: InPageTOC uses `IntersectionObserver` with `root: null` (viewport). When main content becomes its own scroll container, scroll spy breaks.

**Mitigation**: 
- Add `scrollContainerRef` prop to InPageTOC
- Pass `root: scrollContainerRef.current` to observer
- Re-initialize observer when ref changes

### 2. scrollIntoView Behavior
**Issue**: `element.scrollIntoView()` scrolls the nearest scrollable ancestor. Should still work but needs verification.

**Mitigation**: Test thoroughly; if issues arise, use `scrollContainerRef.current.scrollTo()` with calculated offset.

### 3. Mobile Tab Bar Padding
**Issue**: ContentArea currently has `pb-24 md:pb-6` for mobile tab bar. When `overflow="hidden"`, this padding is ignored (content doesn't scroll).

**Mitigation**: 
- When `overflow="hidden"`, don't apply the padding in ContentArea
- Apply `pb-24 md:pb-6` to the scrolling main content div in Manual.tsx

### 4. Height Chain Integrity
**Issue**: For `h-full` to work, every ancestor must have explicit height or be a flex child.

**Mitigation**: 
- AppShell: `min-h-screen flex` ✓
- Main area: `flex-1 flex flex-col` ✓
- ContentArea: `flex-1` (gets remaining height) ✓
- Manual container: `h-full` (fills ContentArea) ✓

### 5. Header Sticky Behavior
**Issue**: Header uses `sticky top-0`. This should still work since it's outside the modified overflow area.

**Mitigation**: Verify header stays fixed during scroll testing.

---

## Future Enhancements (Out of Scope)

- Resizable panel (drag to resize)
- Collapsible sidebars on medium screens
- Pin/unpin panel position
- Remember panel open state in localStorage
- Remember panel open state in localStorage
