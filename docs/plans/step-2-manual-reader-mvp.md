# STEP 2 — MANUAL READER MVP
## Alamo Prime AI Restaurant Ops

**Objective:** Build the core manual reading experience so the app is immediately useful for staff without AI. Staff can browse, read, and bookmark SOPs in English and Spanish.

> **Prerequisites:** Step 1 (Design System + App Shell) must be complete.
> **References:** `docs/system-architecture.md`, `docs/design-specs.md`

---

## 1. OVERVIEW

### 1.1 What We're Building

A **Markdown-based operations manual reader** optimized for:
- Fast navigation to any SOP
- Calm, book-like reading experience
- Language switching (EN/ES)
- Bookmarking favorite sections
- "Ask AI about this" shortcut (UI only in Step 2; functionality in Step 5)

### 1.2 Success Criteria

- [ ] Staff can browse manual hierarchy (Category → Section → Page)
- [ ] Markdown content renders beautifully with proper typography
- [ ] Language toggle works and persists
- [ ] Sections can be bookmarked (localStorage initially)
- [ ] Works flawlessly on mobile, tablet, and desktop
- [ ] Page loads feel instant (<200ms perceived)

### 1.3 What We're NOT Building Yet

- Backend/Supabase integration (Step 3)
- Full-text search (Step 4)
- AI assistant functionality (Step 5)
- Content management/admin editing (Step 6)

---

## 2. DATA MODEL (MOCK DATA FOR NOW)

Until Supabase is connected (Step 3), we'll use static mock data that mirrors the future database schema.

### 2.1 Future Database Schema (Reference)

```sql
-- manual_sections: Hierarchical structure
CREATE TABLE manual_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES manual_sections(id),
  slug TEXT UNIQUE NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  icon TEXT,                          -- lucide icon name
  sort_order INTEGER DEFAULT 0,
  is_category BOOLEAN DEFAULT false,  -- true = folder, false = page
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- manual_documents: Markdown content per section/language
CREATE TABLE manual_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES manual_sections(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('en', 'es')),
  markdown TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(section_id, language)
);
```

### 2.2 Mock Data Structure

```typescript
// src/data/mock-manual.ts

export interface ManualSection {
  id: string;
  parentId: string | null;
  slug: string;
  titleEn: string;
  titleEs: string;
  icon?: string;
  sortOrder: number;
  isCategory: boolean;
}

export interface ManualDocument {
  id: string;
  sectionId: string;
  language: 'en' | 'es';
  markdown: string;
  version: number;
  updatedAt: string;
}

// Example categories
const mockSections: ManualSection[] = [
  // Categories (folders)
  { id: '1', parentId: null, slug: 'food-safety', titleEn: 'Food Safety', titleEs: 'Seguridad Alimentaria', icon: 'ShieldCheck', sortOrder: 1, isCategory: true },
  { id: '2', parentId: null, slug: 'equipment', titleEn: 'Equipment Operation', titleEs: 'Operación de Equipos', icon: 'Settings', sortOrder: 2, isCategory: true },
  { id: '3', parentId: null, slug: 'customer-service', titleEn: 'Customer Service', titleEs: 'Servicio al Cliente', icon: 'Users', sortOrder: 3, isCategory: true },
  
  // Sections under Food Safety
  { id: '1-1', parentId: '1', slug: 'temperature-monitoring', titleEn: 'Temperature Monitoring', titleEs: 'Monitoreo de Temperatura', sortOrder: 1, isCategory: false },
  { id: '1-2', parentId: '1', slug: 'hand-washing', titleEn: 'Hand Washing Protocol', titleEs: 'Protocolo de Lavado de Manos', sortOrder: 2, isCategory: false },
  { id: '1-3', parentId: '1', slug: 'cross-contamination', titleEn: 'Cross-Contamination Prevention', titleEs: 'Prevención de Contaminación Cruzada', sortOrder: 3, isCategory: false },
  
  // ... more sections
];
```

### 2.3 Sample Markdown Content

Create rich sample content that exercises all formatting:

```markdown
# Temperature Monitoring

All hot foods must be held at **140°F (60°C)** or above. Cold foods must be held at **40°F (4°C)** or below.

> **⚠️ Critical**: Temperature checks should be performed every 2 hours during service.

## Checking Temperatures

1. Use a calibrated thermometer
2. Insert probe into the thickest part of the food
3. Wait for reading to stabilize (15-20 seconds)
4. Record temperature on monitoring sheet

### Hot Holding

| Food Type | Minimum Temp | Check Frequency |
|-----------|-------------|-----------------|
| Soups     | 140°F       | Every 2 hours   |
| Proteins  | 140°F       | Every 2 hours   |
| Sauces    | 140°F       | Every 2 hours   |

### Cold Holding

- Salads: 40°F or below
- Dairy: 40°F or below
- Cut produce: 40°F or below

## Corrective Actions

If food is found in the "danger zone" (41-139°F):

1. **Less than 2 hours**: Reheat to 165°F or cool to 40°F
2. **More than 2 hours**: Discard immediately

---

*Last updated: January 2024*
```

---

## 3. COMPONENT ARCHITECTURE

### 3.1 Component Tree

```
ManualPage
├── AppShell (from Step 1)
│   ├── Sidebar (desktop/tablet)
│   │   └── ManualOutline
│   └── ContentArea
│       ├── ManualBreadcrumb
│       ├── ManualHeader
│       │   ├── SectionTitle
│       │   ├── LanguageToggle
│       │   ├── BookmarkButton
│       │   └── AskAIButton (placeholder)
│       ├── ManualContent
│       │   └── MarkdownRenderer
│       │       ├── Heading
│       │       ├── Paragraph
│       │       ├── List
│       │       ├── Table
│       │       ├── Blockquote → Callout
│       │       ├── Code
│       │       └── Divider
│       ├── InPageTOC (tablet/desktop, for long pages)
│       └── MobileOutlineSheet (mobile, triggered by button)
```

### 3.2 File Structure

```
src/
├── components/
│   ├── manual/
│   │   ├── ManualOutline.tsx         # Hierarchical navigation tree
│   │   ├── ManualBreadcrumb.tsx      # Category > Section path
│   │   ├── ManualHeader.tsx          # Title + actions (lang, bookmark, AI)
│   │   ├── ManualContent.tsx         # Content wrapper
│   │   ├── MarkdownRenderer.tsx      # Markdown → React components
│   │   ├── InPageTOC.tsx             # Floating table of contents
│   │   ├── MobileOutlineSheet.tsx    # Bottom sheet for mobile nav
│   │   ├── BookmarkButton.tsx        # Toggle bookmark state
│   │   └── AskAboutButton.tsx        # "Ask AI about this" (placeholder)
│   │
│   └── ui/
│       └── (existing from Step 1)
│
├── data/
│   ├── mock-manual.ts                # Mock sections + documents
│   └── mock-content/                 # Markdown files
│       ├── temperature-monitoring.en.md
│       ├── temperature-monitoring.es.md
│       └── ...
│
├── hooks/
│   ├── use-manual-sections.ts        # Fetch/filter sections
│   ├── use-manual-document.ts        # Fetch document by section+language
│   ├── use-bookmarks.ts              # localStorage bookmarks
│   └── use-reading-progress.ts       # Track last read position (optional)
│
├── pages/
│   ├── Manual.tsx                    # Main manual page
│   └── ManualSection.tsx             # Individual section view
│
└── lib/
    ├── markdown.ts                   # Markdown parsing utilities
    └── manual-utils.ts               # Tree traversal, breadcrumb helpers
```

---

## 4. DETAILED COMPONENT SPECIFICATIONS

### 4.1 ManualOutline

**Purpose:** Hierarchical navigation tree for browsing manual sections.

**Props:**
```typescript
interface ManualOutlineProps {
  sections: ManualSection[];
  activeSectionId?: string;
  language: 'en' | 'es';
  onSectionClick: (sectionId: string) => void;
  collapsed?: boolean;  // For sidebar collapse state
}
```

**Behavior:**
- Categories (isCategory=true) are expandable/collapsible
- Pages (isCategory=false) navigate to content
- Active section highlighted with primary accent
- Expand state persists in session
- Icons displayed for categories

**Design per spec:**
- Touch targets: 44px min height
- Indent: 16px per level
- Active state: `bg-primary/10 text-primary`
- Hover state: `bg-muted`

### 4.2 ManualBreadcrumb

**Purpose:** Show current location in hierarchy for easy back navigation.

**Props:**
```typescript
interface ManualBreadcrumbProps {
  sections: ManualSection[];  // Ancestors from root to current
  language: 'en' | 'es';
  onNavigate: (sectionId: string) => void;
}
```

**Design:**
```
Food Safety  /  Temperature Monitoring
   [link]           [current]
```

- Separator: `/` or `›`
- Current item: `text-foreground font-medium`
- Ancestors: `text-muted-foreground hover:text-foreground`
- Truncate middle items on mobile if too long

### 4.3 ManualHeader

**Purpose:** Section title with actions.

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ Temperature Monitoring            [🔖] [EN|ES]   │
│ Last updated: January 2024        [Ask AI ✨]    │
└──────────────────────────────────────────────────┘
```

**Components:**
- `SectionTitle` (H1) - from Step 1 typography
- `MetaText` - Last updated date
- `BookmarkButton` - Toggle filled/outline state
- `LanguageToggle` - EN/ES (from Step 1)
- `AskAboutButton` - Primary button, disabled in Step 2

### 4.4 MarkdownRenderer

**Purpose:** Transform Markdown AST into styled React components.

**Library:** Use `react-markdown` with `remark-gfm` for GitHub Flavored Markdown.

**Component Mapping:**

| Markdown | Component | Notes |
|----------|-----------|-------|
| `# H1` | `PageTitle` | Only one per document |
| `## H2` | `SectionTitle` | Section breaks |
| `### H3` | `Subsection` | Collapsible on long pages |
| `p` | `BodyText` | 15px, line-height 1.6 |
| `ul/ol` | Custom list | Proper spacing, bullet styling |
| `table` | `Table` | Horizontal scroll on mobile |
| `> blockquote` | `Callout` | Parse for Critical/Tip/Info |
| `code` | Inline/Block | Monospace, syntax highlight |
| `---` | `Separator` | Subtle horizontal rule |
| `**bold**` | `<strong>` | font-semibold |
| `*italic*` | `<em>` | font-italic |

**Callout Detection:**
```markdown
> **⚠️ Critical**: This is a critical callout

> **💡 Tip**: This is a tip callout

> **ℹ️ Note**: This is an info callout
```

Parse first line for emoji + keyword to determine callout variant.

**Code for MarkdownRenderer:**
```typescript
// src/components/manual/MarkdownRenderer.tsx

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PageTitle, SectionTitle, Subsection, BodyText } from '@/components/ui/typography';
import { Callout } from '@/components/ui/callout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

const components = {
  h1: ({ children }) => <PageTitle className="mb-lg">{children}</PageTitle>,
  h2: ({ children }) => <SectionTitle className="mt-2xl mb-md">{children}</SectionTitle>,
  h3: ({ children }) => <Subsection className="mt-xl mb-sm">{children}</Subsection>,
  p: ({ children }) => <BodyText className="mb-md">{children}</BodyText>,
  blockquote: ({ children }) => <Callout className="my-lg">{children}</Callout>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-lg">
      <Table>{children}</Table>
    </div>
  ),
  // ... more mappings
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
```

### 4.5 InPageTOC (Table of Contents)

**Purpose:** Quick navigation within long pages (tablet/desktop).

**Behavior:**
- Extract H2/H3 headings from Markdown
- Sticky position on right side (desktop) or top (tablet)
- Highlight current section based on scroll position
- Click to smooth scroll to heading

**Design:**
```
On This Page
────────────
• Checking Temperatures  ← active
• Hot Holding
• Cold Holding
• Corrective Actions
```

- Only show if page has 3+ headings
- Collapsible on tablet
- Hidden on mobile (use MobileOutlineSheet instead)

### 4.6 MobileOutlineSheet

**Purpose:** Bottom sheet for navigation on mobile.

**Trigger:** Floating button or header action.

**Content:**
- Full ManualOutline component
- "Bookmarks" tab option
- Close button (X) or swipe down

**Animation:**
- Slide up: 280ms (per design spec)
- Backdrop blur + dimming

### 4.7 BookmarkButton

**Purpose:** Toggle bookmark state for current section.

**Props:**
```typescript
interface BookmarkButtonProps {
  sectionId: string;
  isBookmarked: boolean;
  onToggle: () => void;
}
```

**States:**
- Not bookmarked: outline bookmark icon
- Bookmarked: filled bookmark icon + subtle animation
- Hover: scale(1.05)

### 4.8 AskAboutButton

**Purpose:** Placeholder for "Ask AI about this section" (Step 5).

**Props:**
```typescript
interface AskAboutButtonProps {
  sectionId: string;
  sectionTitle: string;
  disabled?: boolean;  // true in Step 2
}
```

**UI:**
- Button with sparkle icon
- Text: "Ask AI" or "Preguntar IA"
- Disabled state with tooltip: "Coming soon"

---

## 5. HOOKS SPECIFICATION

### 5.1 useManualSections

```typescript
// src/hooks/use-manual-sections.ts

interface UseManualSectionsReturn {
  sections: ManualSection[];
  categories: ManualSection[];  // Top-level only
  getSectionById: (id: string) => ManualSection | undefined;
  getChildren: (parentId: string) => ManualSection[];
  getAncestors: (id: string) => ManualSection[];  // For breadcrumbs
  isLoading: boolean;
  error: Error | null;
}

export function useManualSections(): UseManualSectionsReturn {
  // For Step 2: Return mock data
  // For Step 3: Replace with Supabase query
}
```

### 5.2 useManualDocument

```typescript
// src/hooks/use-manual-document.ts

interface UseManualDocumentReturn {
  document: ManualDocument | null;
  markdown: string;
  updatedAt: Date | null;
  isLoading: boolean;
  error: Error | null;
}

export function useManualDocument(
  sectionId: string,
  language: 'en' | 'es'
): UseManualDocumentReturn {
  // For Step 2: Return mock Markdown content
  // For Step 3: Replace with Supabase query
}
```

### 5.3 useBookmarks

```typescript
// src/hooks/use-bookmarks.ts

interface UseBookmarksReturn {
  bookmarks: string[];  // Array of section IDs
  isBookmarked: (sectionId: string) => boolean;
  toggleBookmark: (sectionId: string) => void;
  clearBookmarks: () => void;
}

export function useBookmarks(): UseBookmarksReturn {
  // localStorage for now
  // Step 3: Sync with Supabase user_preferences
}
```

### 5.4 useReadingProgress (Optional)

```typescript
// src/hooks/use-reading-progress.ts

interface UseReadingProgressReturn {
  lastRead: { sectionId: string; scrollPosition: number } | null;
  saveProgress: (sectionId: string, scrollPosition: number) => void;
  clearProgress: () => void;
}
```

---

## 6. ROUTING

### 6.1 Route Structure

```typescript
// Update src/App.tsx

<Route path="/manual" element={<Manual />} />
<Route path="/manual/:categorySlug" element={<Manual />} />
<Route path="/manual/:categorySlug/:sectionSlug" element={<Manual />} />
```

### 6.2 URL Examples

```
/manual                              → Manual home (category list)
/manual/food-safety                  → Food Safety category
/manual/food-safety/temperature      → Temperature Monitoring page
```

### 6.3 Navigation Behavior

- Click category → Expand in outline, show category overview
- Click section → Load Markdown content
- Back button → Navigate up hierarchy
- Language change → Reload content in new language (same URL)

---

## 7. RESPONSIVE BEHAVIOR

### 7.1 Mobile (< 768px)

```
┌─────────────────────────────┐
│ Header [≡] [EN|ES]          │
├─────────────────────────────┤
│ Breadcrumb: Food Safety > ..│
├─────────────────────────────┤
│ Temperature Monitoring      │
│ [🔖] [Ask AI ✨]            │
│ Last updated: Jan 2024      │
├─────────────────────────────┤
│                             │
│  Markdown content...        │
│  (full width, 16px padding) │
│                             │
├─────────────────────────────┤
│ [📖] [🔍] [✨] [👤]         │  ← Tab bar
└─────────────────────────────┘
     ↑ Floating [≡] button for outline sheet
```

- No persistent sidebar
- Outline accessed via floating button → sheet
- In-page TOC hidden
- Tables scroll horizontally

### 7.2 Tablet (768px - 1024px)

```
┌──────────────┬──────────────────────────────┐
│ Sidebar      │ Header [Search] [EN|ES]      │
│              ├──────────────────────────────┤
│ Categories   │ Breadcrumb                   │
│ ├─ Food...   │                              │
│ │  ├─ Temp   │ Temperature Monitoring       │
│ │  └─ Hand   │ [🔖] [Ask AI ✨]             │
│ ├─ Equip...  │                              │
│              │ Markdown content...          │
│              │ (max-width: 760px)           │
│              │                              │
│              │ [On This Page]  ← collapsed  │
└──────────────┴──────────────────────────────┘
```

- Collapsible sidebar (toggle button)
- In-page TOC collapsible at top
- Content constrained to reading width

### 7.3 Desktop (> 1024px)

```
┌──────────────┬────────────────────────────────────────┬──────────────┐
│ Sidebar      │ Header [Search] [EN|ES]                │ In-Page TOC  │
│              ├────────────────────────────────────────┤              │
│ Categories   │ Breadcrumb                             │ On This Page │
│ ├─ Food...   │                                        │ ──────────── │
│ │  ├─ Temp ← │ Temperature Monitoring                 │ • Checking   │
│ │  └─ Hand   │ [🔖] [Ask AI ✨]                       │ • Hot Hold   │
│ ├─ Equip...  │                                        │ • Cold Hold  │
│              │ Markdown content...                    │ • Corrective │
│              │ (max-width: 760px, centered)           │              │
│              │                                        │              │
└──────────────┴────────────────────────────────────────┴──────────────┘
```

- Persistent sidebar
- Sticky in-page TOC on right
- Content centered with max reading width

---

## 8. IMPLEMENTATION PHASES

### Phase 1: Data Layer (Day 1)

- [ ] Create `src/data/mock-manual.ts` with section hierarchy
- [ ] Create `src/data/mock-content/` with 5-10 sample Markdown files
- [ ] Implement `useManualSections` hook (mock data)
- [ ] Implement `useManualDocument` hook (mock data)
- [ ] Implement `useBookmarks` hook (localStorage)
- [ ] Create `src/lib/manual-utils.ts` (tree helpers)

**Sample content to create:**
1. Food Safety → Temperature Monitoring
2. Food Safety → Hand Washing Protocol
3. Food Safety → Cross-Contamination Prevention
4. Equipment → Grill Operation
5. Equipment → Fryer Maintenance
6. Customer Service → Complaint Handling

### Phase 2: Markdown Rendering (Day 2)

- [ ] Install `react-markdown` and `remark-gfm`
- [ ] Create `MarkdownRenderer.tsx` with component mapping
- [ ] Style headings using Step 1 typography
- [ ] Style paragraphs, lists, tables
- [ ] Implement `Callout` parsing (Critical/Tip/Note)
- [ ] Handle code blocks with syntax highlighting
- [ ] Ensure tables scroll horizontally on mobile
- [ ] Test with all sample content

### Phase 3: Navigation Components (Day 3)

- [ ] Create `ManualOutline.tsx`
  - [ ] Expand/collapse categories
  - [ ] Active state highlighting
  - [ ] Icon rendering
  - [ ] Indent levels
- [ ] Create `ManualBreadcrumb.tsx`
  - [ ] Ancestor links
  - [ ] Mobile truncation
- [ ] Create `InPageTOC.tsx`
  - [ ] Extract headings from Markdown
  - [ ] Scroll spy for active heading
  - [ ] Smooth scroll on click
- [ ] Create `MobileOutlineSheet.tsx`
  - [ ] Bottom sheet animation (280ms)
  - [ ] Include ManualOutline
  - [ ] Bookmarks tab

### Phase 4: Page Integration (Day 4)

- [ ] Update `Manual.tsx` to use new components
- [ ] Create `ManualHeader.tsx` with all actions
- [ ] Create `ManualContent.tsx` wrapper
- [ ] Create `BookmarkButton.tsx`
- [ ] Create `AskAboutButton.tsx` (disabled placeholder)
- [ ] Wire up routing for nested paths
- [ ] Implement language switching (reload content)
- [ ] Test responsive layouts

### Phase 5: Polish & Edge Cases (Day 5)

- [ ] Handle missing translations gracefully
  - Show English with "Translation coming soon" banner
- [ ] Handle 404 sections
- [ ] Add loading skeletons for content
- [ ] Test keyboard navigation in outline
- [ ] Verify 44px touch targets
- [ ] Test dark mode rendering
- [ ] Performance: Memoize heavy components
- [ ] Add print styles (optional)
- [ ] Accessibility audit
  - [ ] Heading hierarchy (single H1)
  - [ ] Skip links
  - [ ] Focus management in sheets

---

## 9. DEPENDENCIES

### New Packages Required

```bash
# Markdown rendering
bun add react-markdown remark-gfm

# Optional: Syntax highlighting for code blocks
bun add rehype-highlight
```

### Using Existing Packages

- `react-router-dom` - Already installed (routing)
- `lucide-react` - Already installed (icons)
- `vaul` - Already installed (can use for sheets)
- `class-variance-authority` - Already installed (variants)

---

## 10. TESTING CHECKLIST

### Functional Tests

- [ ] Can browse all categories and sections
- [ ] Markdown renders correctly for all element types
- [ ] Language toggle switches content
- [ ] Bookmarks persist across sessions
- [ ] Breadcrumbs navigate correctly
- [ ] In-page TOC highlights on scroll
- [ ] Mobile sheet opens/closes smoothly

### Responsive Tests

- [ ] Mobile (375px): Full-width content, sheet navigation
- [ ] Tablet (768px): Collapsible sidebar, TOC
- [ ] Desktop (1280px): Three-column layout

### Accessibility Tests

- [ ] Screen reader announces page structure
- [ ] Keyboard navigation works in outline
- [ ] Focus trapped in mobile sheet
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets 44px minimum

### Performance Tests

- [ ] Initial load < 1s
- [ ] Navigation feels instant (<200ms)
- [ ] No layout shift on content load
- [ ] Smooth scrolling in long pages

---

## 11. GAPS IDENTIFIED & ADDRESSED

### 11.1 From system-architecture.md

| Requirement | Status | Notes |
|-------------|--------|-------|
| Section tree | ✅ Covered | ManualOutline component |
| Markdown viewer | ✅ Covered | MarkdownRenderer component |
| In-page TOC | ✅ Covered | InPageTOC component |
| Bookmark / Quick actions | ✅ Covered | BookmarkButton component |
| "Ask AI about this" shortcut | ✅ Covered | AskAboutButton (disabled placeholder) |
| **Related sections** | ⚠️ ADDED | Need RelatedSections component |

### 11.2 From design-specs.md

| Requirement | Status | Notes |
|-------------|--------|-------|
| Calm, book-like, highly readable | ✅ Covered | Typography + max-width constraints |
| UI chrome gets out of the way | ✅ Covered | Minimal header during reading |
| Smooth continuous scroll | ✅ Covered | Native scroll behavior |
| Sticky page title (tablet/desktop) | ⚠️ ADDED | Need StickyHeader component |
| Table of contents, collapsible on mobile | ✅ Covered | InPageTOC + MobileOutlineSheet |
| H3 subsections collapsible by default | ⚠️ DEFERRED | Listed in Future Enhancements |
| Callouts (Critical/Tip/Checklist) | ✅ Covered | Callout component with variants |
| **Focus Mode** | ⚠️ DEFERRED | Listed in Future Enhancements |
| Last opened section memory | ⚠️ ADDED | useLastOpenedSection hook |

### 11.3 From App-overview.md

| Requirement | Status | Notes |
|-------------|--------|-------|
| Fast, reliable answers under pressure | ✅ Covered | <200ms navigation target |
| Premium reading experience | ✅ Covered | Typography + spacing |
| EN/ES bilingual | ✅ Covered | Language toggle + content switching |
| Optimized for mobile/iPad | ✅ Covered | Responsive layouts |
| Desktop support | ✅ Covered | Three-column layout |
| **Missing translation indicator** | ⚠️ ADDED | Need TranslationBanner component |

---

## 12. ADDITIONAL COMPONENTS NEEDED

Based on gaps identified:

### 12.1 RelatedSections

**Purpose:** Show related SOPs at the bottom of each page.

**Props:**
```typescript
interface RelatedSectionsProps {
  currentSectionId: string;
  language: 'en' | 'es';
  maxItems?: number;  // default 3
}
```

**Logic:**
- For MVP: Show sibling sections (same parent)
- Future: Use semantic similarity

**Location:** Bottom of ManualContent, before footer

### 12.2 StickyHeader (Tablet/Desktop)

**Purpose:** Keep page title visible when scrolling long content.

**Behavior:**
- Appears after scrolling past main title
- Shows: Section title + Bookmark + Ask AI buttons
- Subtle shadow/blur for depth
- 56px height

### 12.3 TranslationBanner

**Purpose:** Indicate when viewing fallback English content.

**Props:**
```typescript
interface TranslationBannerProps {
  targetLanguage: 'es';  // Only shows when ES requested but EN shown
  sectionTitle: string;
}
```

**UI:**
```
┌────────────────────────────────────────────────┐
│ ℹ️ Spanish translation coming soon.            │
│    Showing English version.                    │
└────────────────────────────────────────────────┘
```

### 12.4 useLastOpenedSection Hook

**Purpose:** Remember last opened section for "Continue reading" UX.

```typescript
interface UseLastOpenedSectionReturn {
  lastSection: { id: string; slug: string; title: string } | null;
  saveLastOpened: (sectionId: string) => void;
  clearLastOpened: () => void;
}
```

**Storage:** localStorage (synced to Supabase in Step 3)

---

## 13. UPDATED FILE STRUCTURE

```
src/
├── components/
│   ├── manual/
│   │   ├── ManualOutline.tsx         # Hierarchical navigation tree
│   │   ├── ManualBreadcrumb.tsx      # Category > Section path
│   │   ├── ManualHeader.tsx          # Title + actions (lang, bookmark, AI)
│   │   ├── ManualContent.tsx         # Content wrapper
│   │   ├── MarkdownRenderer.tsx      # Markdown → React components
│   │   ├── InPageTOC.tsx             # Floating table of contents
│   │   ├── MobileOutlineSheet.tsx    # Bottom sheet for mobile nav
│   │   ├── BookmarkButton.tsx        # Toggle bookmark state
│   │   ├── AskAboutButton.tsx        # "Ask AI about this" (placeholder)
│   │   ├── RelatedSections.tsx       # ⭐ NEW: Related SOPs
│   │   ├── StickyHeader.tsx          # ⭐ NEW: Sticky title on scroll
│   │   └── TranslationBanner.tsx     # ⭐ NEW: Missing translation notice
│   │
│   └── ui/
│       └── (existing from Step 1)
│
├── hooks/
│   ├── use-manual-sections.ts        # Fetch/filter sections
│   ├── use-manual-document.ts        # Fetch document by section+language
│   ├── use-bookmarks.ts              # localStorage bookmarks
│   ├── use-reading-progress.ts       # Track scroll position (optional)
│   └── use-last-opened-section.ts    # ⭐ NEW: Remember last section
```

---

## 14. UPDATED IMPLEMENTATION PHASES

### Phase 1: Data Layer (Day 1)
*(unchanged)*

### Phase 2: Markdown Rendering (Day 2)
*(unchanged)*

### Phase 3: Navigation Components (Day 3)
- [ ] Create `ManualOutline.tsx`
- [ ] Create `ManualBreadcrumb.tsx`
- [ ] Create `InPageTOC.tsx`
- [ ] Create `MobileOutlineSheet.tsx`
- [ ] Create `StickyHeader.tsx` ⭐ NEW

### Phase 4: Page Integration (Day 4)
- [ ] Update `Manual.tsx` to use new components
- [ ] Create `ManualHeader.tsx`
- [ ] Create `ManualContent.tsx`
- [ ] Create `BookmarkButton.tsx`
- [ ] Create `AskAboutButton.tsx`
- [ ] Create `RelatedSections.tsx` ⭐ NEW
- [ ] Create `TranslationBanner.tsx` ⭐ NEW
- [ ] Wire up routing
- [ ] Implement `useLastOpenedSection` hook ⭐ NEW

### Phase 5: Polish & Edge Cases (Day 5)
*(unchanged)*

---

## 15. FUTURE ENHANCEMENTS (POST-MVP)

These features are out of scope for Step 2 but documented for future phases:

1. **Focus Mode** (design spec feature)
   - Increase font size
   - Hide extra chrome
   - Keep "Ask about this" available

2. **Collapsible H3 Sections**
   - Long pages with many H3s
   - State persists in session

3. **Reading Progress**
   - Save scroll position per section
   - "Continue reading" on return

4. **Print Styles**
   - Clean print layout
   - Hide navigation chrome
   - Page breaks at sections

5. **Offline Support**
   - Service worker caching
   - "Downloaded for offline" indicator

6. **Checklist Blocks**
   - Interactive checkboxes in SOPs
   - Progress tracking per user

---

## 16. ACCEPTANCE CRITERIA

Step 2 is complete when:

1. ✅ Staff can navigate the full manual hierarchy
2. ✅ All Markdown content renders beautifully
3. ✅ Language switching works (EN ↔ ES)
4. ✅ Missing translations show English with banner
5. ✅ Bookmarking sections works (persists locally)
6. ✅ Related sections shown at page bottom
7. ✅ Sticky header appears on scroll (tablet/desktop)
8. ✅ Layout is responsive across all breakpoints
9. ✅ Dark mode works correctly
10. ✅ "Ask AI" button is visible but disabled
11. ✅ Last opened section remembered
12. ✅ No console errors or warnings
13. ✅ Accessibility audit passes
14. ✅ Ready for backend integration (Step 3)

---

## 17. ESTIMATED TIMELINE

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1 | 1 day | Data layer + mock content |
| Phase 2 | 1 day | Markdown rendering |
| Phase 3 | 1 day | Navigation components + StickyHeader |
| Phase 4 | 1 day | Page integration + new components |
| Phase 5 | 1 day | Polish + testing |

**Total: 5 days**

---

## 18. AUDIT TRAIL

### Documents Cross-Referenced

| Document | Key Requirements Extracted |
|----------|---------------------------|
| `docs/system-architecture.md` | Manual Reader module specs, database schema |
| `docs/design-specs.md` | Reading experience, callouts, focus mode |
| `docs/App-overview.md` | Bilingual support, premium reading, target users |

### Gaps Found & Addressed

| Gap | Source | Resolution |
|-----|--------|------------|
| Related sections | system-architecture.md | Added RelatedSections component |
| Sticky page title | design-specs.md | Added StickyHeader component |
| Missing translation handling | App-overview.md | Added TranslationBanner component |
| Last opened section | design-specs.md | Added useLastOpenedSection hook |
| Collapsible H3 sections | design-specs.md | Deferred to Future Enhancements |
| Focus Mode | design-specs.md | Deferred to Future Enhancements |
| Checklist blocks | design-specs.md | Deferred to Future Enhancements |

---

## 19. NOTES FOR AI ASSISTANT

When implementing Step 2:

1. **Start with Phase 1** - The data layer must exist before components
2. **Use mock data** - Don't try to connect Supabase yet
3. **Follow design spec** - All styling from `docs/design-specs.md`
4. **Reuse Step 1 components** - Typography, Card, Button, etc.
5. **Test incrementally** - Each phase should be testable
6. **Mobile first** - Build mobile layout, then enhance for larger screens
7. **Include new components** - RelatedSections, StickyHeader, TranslationBanner
8. **Remember last section** - Implement useLastOpenedSection for UX continuity

---

*Document version: 1.1*
*Last updated: February 2026*
*Audited against: system-architecture.md, design-specs.md, App-overview.md*
