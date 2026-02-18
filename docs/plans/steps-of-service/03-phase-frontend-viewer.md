# Phase 3: Frontend Viewer — Core

## Overview

Build the Steps of Service viewer: route, page orchestrator, data hook, viewer hook, position selector, and detail view with section sidebar. Reuses `MarkdownRenderer` and follows existing viewer patterns.

---

## Architecture Comparison

The SOS viewer is a **hybrid** between the Manual viewer (hierarchical content, markdown) and the product viewers (position selector, action buttons, AppShell).

| Aspect | Product Viewers | Manual Viewer | SOS Viewer |
|--------|----------------|---------------|------------|
| Top-level selection | N/A (single domain) | Category sidebar | Position cards (4) |
| Item list | Grid cards | Section sidebar | Section sidebar |
| Detail view | Card view (structured fields) | Markdown content | Markdown content |
| Search/filter | Client-side text + style filter | N/A | N/A (browse only for now) |
| AI buttons | Flat row (per product) | N/A | Grouped dropdowns (Phase 4) |
| Data hook | `useSupabaseWines()` → react-query | Custom Supabase query | `useSupabaseSOS()` → react-query |
| Viewer hook | `useWineViewer()` | N/A (manual page handles state) | `useSOSViewer()` |

---

## Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/pages/StepsOfService.tsx` | Page | Orchestrator component |
| `src/hooks/use-supabase-sos.ts` | Hook | Data fetching (react-query) |
| `src/hooks/use-sos-viewer.ts` | Hook | Viewer state management |
| `src/components/steps-of-service/SOSPositionSelector.tsx` | Component | 4 position cards |
| `src/components/steps-of-service/SOSDetailView.tsx` | Component | Section sidebar + markdown content |
| `src/components/steps-of-service/index.ts` | Barrel | Re-exports |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add route: `/steps-of-service` → `StepsOfService` |
| `src/lib/constants.ts` | Add to `ROUTES`, `STAFF_NAV_ITEMS`, `ADMIN_NAV_ITEMS` |

---

## 1. Route & Navigation

### `src/lib/constants.ts`

```typescript
// Add to ROUTES
STEPS_OF_SERVICE: '/steps-of-service',

// Add to STAFF_NAV_ITEMS (between 'Beer & Liquor' and 'Ask AI')
{ path: '/steps-of-service', label: 'Steps of Service', icon: 'ClipboardList' },

// Add to ADMIN_NAV_ITEMS (same position)
{ path: '/steps-of-service', label: 'Steps of Service', icon: 'ClipboardList' },
```

### `src/App.tsx`

```typescript
import StepsOfService from './pages/StepsOfService';

// Add route (between beer-liquor and ask)
<Route path="/steps-of-service" element={
  <ProtectedRoute>
    <StepsOfService />
  </ProtectedRoute>
} />
```

---

## 2. Data Hook: `useSupabaseSOS`

Follows the `useSupabaseWines` pattern with react-query. Fetches all published sections for the user's group, ordered by `sort_order`.

### Interface

```typescript
interface SOSSection {
  id: string;
  sectionKey: string;
  parentKey: string | null;
  sortOrder: number;
  position: string;
  titleEn: string;
  titleEs: string | null;
  contentEn: string;
  contentEs: string | null;
}

interface UseSupabaseSOSReturn {
  sections: SOSSection[];
  isLoading: boolean;
  error: Error | null;
}
```

### Query

```typescript
const { data, error } = await supabase
  .from('steps_of_service_sections')
  .select('id, section_key, parent_key, sort_order, position, title_en, title_es, content_en, content_es')
  .eq('status', 'published')
  .order('sort_order');
```

### Notes

- **No group_id filter in query** — RLS handles it (but since RLS uses `USING (true)`, the hook should ideally filter by group_id). For now, with a single restaurant, we fetch all. Phase 6 can add group filtering.
- **staleTime**: 5 minutes (same as product hooks)
- **camelCase mapping**: `section_key → sectionKey`, `parent_key → parentKey`, etc.

---

## 3. Viewer Hook: `useSOSViewer`

Manages two levels of state:
1. **Position selection**: Which position is active (server, bartender, busser, barback)
2. **Section navigation**: Which section is selected within that position

### Interface

```typescript
type SOSPosition = 'server' | 'bartender' | 'busser' | 'barback';

interface UseSOSViewerReturn {
  // Data
  sections: SOSSection[];       // All sections for selected position
  topLevelSections: SOSSection[]; // Sections with parentKey = null (for sidebar)
  childSections: (parentKey: string) => SOSSection[]; // Get children

  // Position state
  selectedPosition: SOSPosition | null;
  selectPosition: (position: SOSPosition) => void;
  clearPosition: () => void;
  availablePositions: SOSPosition[]; // Positions that have content

  // Section state
  selectedSection: SOSSection | undefined;
  selectSection: (sectionKey: string) => void;
  hasPrev: boolean;
  hasNext: boolean;
  goToPrev: () => void;
  goToNext: () => void;

  // Loading
  isLoading: boolean;
  error: Error | null;
}
```

### Behavior

1. On mount: `selectedPosition = null` → show position selector
2. User picks position → `selectedPosition = 'server'` → show detail view, auto-select first section
3. User navigates sections via sidebar or prev/next
4. User clicks back → `selectedPosition = null` → show position selector

### Position availability

```typescript
const availablePositions = useMemo(() => {
  const positions = new Set(allSections.map(s => s.position));
  return (['server', 'bartender', 'busser', 'barback'] as const)
    .filter(p => positions.has(p));
}, [allSections]);
```

Only positions with content are shown. Currently only `server` has content, so only 1 card is active. Others show as disabled/coming-soon.

---

## 4. Position Selector: `SOSPositionSelector`

Displays 4 position cards in a grid. Similar to how users choose a product domain, but themed for service positions.

### Design

```
┌──────────────┐  ┌──────────────┐
│   👨‍🍳 Server   │  │  🍸 Bartender │
│  29 sections  │  │  Coming Soon  │
│               │  │   (disabled)  │
└──────────────┘  └──────────────┘
┌──────────────┐  ┌──────────────┐
│   🧹 Busser   │  │  📦 Barback  │
│  Coming Soon  │  │  Coming Soon  │
│   (disabled)  │  │   (disabled)  │
└──────────────┘  └──────────────┘
```

### Props

```typescript
interface SOSPositionSelectorProps {
  availablePositions: SOSPosition[];
  sectionCounts: Record<SOSPosition, number>;
  onSelectPosition: (position: SOSPosition) => void;
}
```

### Position Config

```typescript
const POSITION_CONFIG: Record<SOSPosition, {
  label: string;
  labelEs: string;
  icon: string; // Lucide icon name
  description: string;
}> = {
  server: { label: 'Server', labelEs: 'Mesero', icon: 'UtensilsCrossed', description: 'Front-of-house service steps' },
  bartender: { label: 'Bartender', labelEs: 'Bartender', icon: 'Wine', description: 'Bar service procedures' },
  busser: { label: 'Busser', labelEs: 'Busser', icon: 'Brush', description: 'Table maintenance and support' },
  barback: { label: 'Barback', labelEs: 'Barback', icon: 'PackageOpen', description: 'Bar support and stocking' },
};
```

### Card States

- **Available**: clickable, shows section count, full opacity
- **Coming Soon**: not clickable, shows "Coming Soon" badge, `opacity-50`, `cursor-not-allowed`

---

## 5. Detail View: `SOSDetailView`

Two-panel layout: section sidebar (left) + markdown content (right).

### Layout

```
Mobile:
┌────────────────────────────┐
│ ← Back   Server Steps      │
├────────────────────────────┤
│ Section sidebar (collapsed) │  ← hamburger/dropdown on mobile
├────────────────────────────┤
│                            │
│  Markdown content          │
│  (MarkdownRenderer)        │
│                            │
└────────────────────────────┘

Desktop (md+):
┌──────────────┬─────────────────────────────┐
│ ← Back       │                             │
│              │  Markdown content            │
│ Section      │  (MarkdownRenderer)          │
│ Sidebar      │                             │
│              │                             │
│ > Welcome    │                             │
│   Primary... │                             │
│   Prime...   │                             │
│ > First App  │                             │
│   - Intro    │                             │
│   - Beverage │                             │
│   - Water    │                             │
│   - Appetiz  │                             │
│   ...        │                             │
└──────────────┴─────────────────────────────┘
```

### Props

```typescript
interface SOSDetailViewProps {
  position: SOSPosition;
  sections: SOSSection[];
  topLevelSections: SOSSection[];
  childSections: (parentKey: string) => SOSSection[];
  selectedSection: SOSSection | undefined;
  onSelectSection: (sectionKey: string) => void;
  onBack: () => void;
  language: 'en' | 'es';
}
```

### Section Sidebar

- Shows top-level sections as a vertical list
- Sections with children show as expandable (auto-expanded when active)
- Active section is highlighted
- On mobile: sidebar collapses to a dropdown selector at the top

### Content Area

Uses `MarkdownRenderer` to render the selected section's content:

```tsx
<MarkdownRenderer
  content={language === 'es' && section.contentEs ? section.contentEs : section.contentEn}
/>
```

### Navigation

- **Back button**: Returns to position selector
- **Prev/Next**: Navigates through sections in sort_order (flat, not tree — includes children inline)
- **Sidebar click**: Direct jump to any section

---

## 6. Page Orchestrator: `StepsOfServicePage`

Follows the `Wines` page pattern with AppShell.

### State Flow

```
isLoading? → Loader spinner
error?     → Error message
no position selected? → SOSPositionSelector
position selected?    → SOSDetailView
```

### AI Integration (Phase 4 placeholder)

Phase 3 does NOT include AI buttons. The detail view will have a placeholder area where AI buttons will be added in Phase 4. For now, the view is browse-only.

```typescript
const StepsOfService = () => {
  const { language, setLanguage } = useLanguage();
  const viewer = useSOSViewer();

  return (
    <AppShell language={language} onLanguageChange={setLanguage} showSearch={false}>
      {viewer.isLoading ? (
        <Loader />
      ) : viewer.error ? (
        <ErrorState />
      ) : viewer.selectedPosition ? (
        <SOSDetailView
          position={viewer.selectedPosition}
          sections={viewer.sections}
          topLevelSections={viewer.topLevelSections}
          childSections={viewer.childSections}
          selectedSection={viewer.selectedSection}
          onSelectSection={viewer.selectSection}
          onBack={viewer.clearPosition}
          language={language}
        />
      ) : (
        <SOSPositionSelector
          availablePositions={viewer.availablePositions}
          sectionCounts={viewer.sectionCounts}
          onSelectPosition={viewer.selectPosition}
        />
      )}
    </AppShell>
  );
};
```

---

## Mobile Considerations

| Feature | Desktop (md+) | Mobile |
|---------|--------------|--------|
| Section sidebar | Always visible (left panel) | Dropdown selector at top |
| Content width | Constrained by sidebar | Full width |
| Back button | Top-left of sidebar | Top-left header |
| Swipe navigation | N/A | Swipe left/right for prev/next section |

### Swipe Navigation

Reuse existing `useSwipeNavigation` hook:

```typescript
const { ref: swipeRef } = useSwipeNavigation({
  onSwipeLeft: goToNext,
  onSwipeRight: goToPrev,
  enabled: true,
});
```

---

## Verification Checklist

After implementation:

- [ ] Route: `/steps-of-service` loads the page
- [ ] Navigation: Entry appears in side nav (between Beer & Liquor and Ask AI)
- [ ] Position selector: Shows 4 cards, only Server is active
- [ ] Position selector: Clicking Server shows detail view
- [ ] Detail view: Section sidebar shows all 29 sections
- [ ] Detail view: First section auto-selected on position pick
- [ ] Detail view: Section sidebar highlights active section
- [ ] Detail view: Child sections indented under parent (`first-approach`)
- [ ] Detail view: Markdown renders correctly (headings, lists, callouts, tables, dialogue)
- [ ] Detail view: Back button returns to position selector
- [ ] Detail view: Prev/Next navigation works
- [ ] Mobile: Sidebar collapses to dropdown
- [ ] Mobile: Swipe navigation works
- [ ] Loading state: Spinner shows while data loads
- [ ] Error state: Error message if Supabase query fails
- [ ] TypeScript: `npx tsc --noEmit` passes (0 errors)

---

## Dependencies

- **Requires**: Phase 1 (table) + Phase 2 (data to display)
- **Reuses**: `MarkdownRenderer`, `AppShell`, `useSwipeNavigation`, `useLanguage`, `useIsMobile`
- **Blocks**: Phase 4 (AI buttons need the detail view)
