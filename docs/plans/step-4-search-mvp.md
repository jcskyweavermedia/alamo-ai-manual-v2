# STEP 4 — SEARCH MVP + CONTENT DATABASE
## Alamo Prime AI Restaurant Ops

**Objective:** Migrate from mock data to a Supabase-backed content system, store all manual sections (EN + ES), and implement keyword search so staff can instantly find SOPs.

> **Prerequisites:** Step 1 (Design System), Step 2 (Manual Reader), Step 3 (Auth & Roles) must be complete.  
> **References:** `docs/system-architecture.md`, `docs/supabase-structure.md`

---

## 1. OVERVIEW

### 1.1 What We're Building

A **Supabase-powered content layer** with:
- Database schema for hierarchical manual sections
- Bilingual content storage (EN + ES markdown in same row)
- Full-text search using PostgreSQL FTS
- Migration from mock data to live database
- Updated hooks to query Supabase instead of static files

### 1.2 Key Architecture Decision: Single-Row Bilingual Storage

Based on the `docs/supabase-structure.md` content structure, we'll store **both English and Spanish content in the same row**:

```
┌─────────────────────────────────────────────────────────────────┐
│ manual_sections table                                           │
├─────────────────────────────────────────────────────────────────┤
│ id: uuid                                                        │
│ parent_id: uuid (nullable - for hierarchy)                      │
│ file_path: text (e.g., "06-team-roles/06-01-host-essentials")   │
│ slug: text (e.g., "host-essentials")                           │
│ title_en: text                                                  │
│ title_es: text (nullable - fallback to EN if missing)          │
│ content_en: text (full markdown)                                │
│ content_es: text (nullable - fallback to EN if missing)        │
│ category: text (e.g., "team-roles", "operations")              │
│ tags: text[] (PostgreSQL array)                                │
│ icon: text (lucide icon name)                                  │
│ sort_order: integer                                            │
│ level: integer (0 = root, 1 = subsection)                      │
│ is_category: boolean (folder vs page)                          │
│ word_count_en: integer                                         │
│ word_count_es: integer                                         │
│ created_at: timestamptz                                        │
│ updated_at: timestamptz                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Why single-row bilingual?**
- Simpler queries (no JOINs for language)
- Atomic updates (both languages together)
- Easy fallback (if `content_es` is null, use `content_en`)
- Matches the structure in `docs/supabase-structure.md`

### 1.3 Success Criteria

- [ ] Database schema created and migrated
- [ ] All 23 sections from `docs/supabase-structure.md` inserted
- [ ] Manual reader fetches from Supabase (not mock data)
- [ ] Keyword search returns relevant results
- [ ] Search highlights matching terms
- [ ] Spanish fallback to English works
- [ ] Search respects user's language preference
- [ ] Results link to correct manual section

### 1.4 What We're NOT Building Yet

- Vector embeddings for semantic search (Step 8 - Phase 2)
- AI-powered search ranking (Step 5)
- Content editing/CMS (Step 6)
- Search analytics (future)

---

## 2. DATABASE SCHEMA

### 2.1 Manual Sections Table

```sql
-- ============================================
-- MANUAL_SECTIONS: Hierarchical content storage with bilingual support
-- ============================================
CREATE TABLE public.manual_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Hierarchy
  parent_id UUID REFERENCES public.manual_sections(id) ON DELETE CASCADE,
  
  -- Identifiers
  file_path TEXT UNIQUE NOT NULL,        -- Original file path from structure
  slug TEXT UNIQUE NOT NULL,              -- URL-friendly identifier
  
  -- Titles (bilingual)
  title_en TEXT NOT NULL,
  title_es TEXT,                          -- Nullable, fallback to EN
  
  -- Content (bilingual markdown)
  content_en TEXT,                        -- Full markdown content
  content_es TEXT,                        -- Nullable, fallback to EN
  
  -- Metadata
  category TEXT NOT NULL,                 -- Category identifier
  tags TEXT[] DEFAULT '{}',               -- PostgreSQL array for filtering
  icon TEXT,                              -- Lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,       -- 0 = root, 1 = child, etc.
  is_category BOOLEAN NOT NULL DEFAULT false,  -- true = folder, false = page
  
  -- Stats
  word_count_en INTEGER DEFAULT 0,
  word_count_es INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_manual_sections_parent ON public.manual_sections(parent_id);
CREATE INDEX idx_manual_sections_category ON public.manual_sections(category);
CREATE INDEX idx_manual_sections_sort ON public.manual_sections(sort_order);
CREATE INDEX idx_manual_sections_slug ON public.manual_sections(slug);

-- GIN index for tags array searching
CREATE INDEX idx_manual_sections_tags ON public.manual_sections USING GIN(tags);
```

### 2.2 Full-Text Search Configuration

```sql
-- ============================================
-- FULL-TEXT SEARCH INDEXES
-- ============================================

-- Add tsvector columns for efficient FTS
ALTER TABLE public.manual_sections 
ADD COLUMN search_vector_en tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title_en, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content_en, '')), 'B') ||
  setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
) STORED;

ALTER TABLE public.manual_sections 
ADD COLUMN search_vector_es tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('spanish', coalesce(title_es, title_en, '')), 'A') ||
  setweight(to_tsvector('spanish', coalesce(content_es, content_en, '')), 'B') ||
  setweight(to_tsvector('spanish', array_to_string(tags, ' ')), 'C')
) STORED;

-- GIN indexes for fast full-text search
CREATE INDEX idx_manual_sections_fts_en ON public.manual_sections USING GIN(search_vector_en);
CREATE INDEX idx_manual_sections_fts_es ON public.manual_sections USING GIN(search_vector_es);
```

### 2.3 Row Level Security

```sql
-- Enable RLS
ALTER TABLE public.manual_sections ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MANUAL_SECTIONS POLICIES
-- ============================================

-- All authenticated users can read manual sections
-- (Future: can scope by group if needed)
CREATE POLICY "Authenticated users can view manual sections"
  ON public.manual_sections FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify content (future CMS feature)
CREATE POLICY "Admins can manage manual sections"
  ON public.manual_sections FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### 2.4 Helper Functions

```sql
-- ============================================
-- SEARCH FUNCTION: Keyword search with ranking
-- ============================================
CREATE OR REPLACE FUNCTION public.search_manual(
  search_query TEXT,
  search_language TEXT DEFAULT 'en',
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  snippet TEXT,
  category TEXT,
  tags TEXT[],
  rank REAL,
  file_path TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  -- Build tsquery based on language
  IF search_language = 'es' THEN
    ts_query := plainto_tsquery('spanish', search_query);
  ELSE
    ts_query := plainto_tsquery('english', search_query);
  END IF;

  RETURN QUERY
  SELECT 
    ms.id,
    ms.slug,
    CASE WHEN search_language = 'es' AND ms.title_es IS NOT NULL 
         THEN ms.title_es 
         ELSE ms.title_en 
    END as title,
    -- Generate snippet from content
    ts_headline(
      CASE WHEN search_language = 'es' THEN 'spanish' ELSE 'english' END,
      CASE WHEN search_language = 'es' AND ms.content_es IS NOT NULL 
           THEN ms.content_es 
           ELSE ms.content_en 
      END,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ) as snippet,
    ms.category,
    ms.tags,
    ts_rank(
      CASE WHEN search_language = 'es' 
           THEN ms.search_vector_es 
           ELSE ms.search_vector_en 
      END,
      ts_query
    ) as rank,
    ms.file_path
  FROM public.manual_sections ms
  WHERE 
    -- Only search pages, not category folders
    ms.is_category = false
    AND (
      CASE WHEN search_language = 'es' 
           THEN ms.search_vector_es 
           ELSE ms.search_vector_en 
      END @@ ts_query
    )
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;

-- ============================================
-- GET SECTION TREE: Hierarchical navigation
-- ============================================
CREATE OR REPLACE FUNCTION public.get_manual_tree(language TEXT DEFAULT 'en')
RETURNS TABLE (
  id UUID,
  parent_id UUID,
  slug TEXT,
  title TEXT,
  icon TEXT,
  sort_order INTEGER,
  level INTEGER,
  is_category BOOLEAN,
  has_content BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ms.id,
    ms.parent_id,
    ms.slug,
    CASE WHEN language = 'es' AND ms.title_es IS NOT NULL 
         THEN ms.title_es 
         ELSE ms.title_en 
    END as title,
    ms.icon,
    ms.sort_order,
    ms.level,
    ms.is_category,
    (CASE WHEN language = 'es' 
          THEN ms.content_es IS NOT NULL OR ms.content_en IS NOT NULL
          ELSE ms.content_en IS NOT NULL
     END) as has_content
  FROM public.manual_sections ms
  ORDER BY ms.level, ms.sort_order;
$$;

-- ============================================
-- GET SECTION BY SLUG: Single section with content
-- ============================================
CREATE OR REPLACE FUNCTION public.get_manual_section(
  section_slug TEXT,
  language TEXT DEFAULT 'en'
)
RETURNS TABLE (
  id UUID,
  parent_id UUID,
  slug TEXT,
  file_path TEXT,
  title TEXT,
  content TEXT,
  category TEXT,
  tags TEXT[],
  icon TEXT,
  updated_at TIMESTAMPTZ,
  has_translation BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ms.id,
    ms.parent_id,
    ms.slug,
    ms.file_path,
    CASE WHEN language = 'es' AND ms.title_es IS NOT NULL 
         THEN ms.title_es 
         ELSE ms.title_en 
    END as title,
    CASE WHEN language = 'es' AND ms.content_es IS NOT NULL 
         THEN ms.content_es 
         ELSE ms.content_en 
    END as content,
    ms.category,
    ms.tags,
    ms.icon,
    ms.updated_at,
    (ms.content_es IS NOT NULL) as has_translation
  FROM public.manual_sections ms
  WHERE ms.slug = section_slug;
$$;

-- ============================================
-- UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_manual_section_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_manual_sections_timestamp
  BEFORE UPDATE ON public.manual_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_manual_section_timestamp();
```

---

## 3. CONTENT STRUCTURE

### 3.1 Mapping from `docs/supabase-structure.md`

Based on the 23 files documented in `docs/supabase-structure.md`:

| Order | File Path | Slug | Title EN | Category | Level | Is Category |
|-------|-----------|------|----------|----------|-------|-------------|
| 01 | 01-welcome-philosophy.md | welcome-philosophy | Welcome Philosophy | welcome | 0 | false |
| 02 | 02-company-overview.md | company-overview | Company Overview | company | 0 | false |
| 03 | 03-core-values.md | core-values | Core Values | values | 0 | false |
| 04 | 04-service-excellence.md | service-excellence | Service Excellence | service | 0 | false |
| 05 | 05-hours-operations.md | hours-operations | Hours of Operations | operations | 0 | false |
| 06 | 06-team-roles/ | team-roles | Team Roles | team-roles | 0 | **true** |
| 06.0 | 06-team-roles/README.md | team-roles-overview | Team Roles Overview | team-roles | 1 | false |
| 06.1 | 06-team-roles/06-01-host-essentials.md | host-essentials | Host Essentials | team-roles | 1 | false |
| 06.2 | 06-team-roles/06-02-server-standards.md | server-standards | Server Standards | team-roles | 1 | false |
| 06.3 | 06-team-roles/06-03-bus-person-procedures.md | bus-person-procedures | Bus Person Procedures | team-roles | 1 | false |
| 06.4 | 06-team-roles/06-04-management-roles.md | management-roles | Management Roles | team-roles | 1 | false |
| 07 | 07-operational-procedures/ | operational-procedures | Operational Procedures | operational-procedures | 0 | **true** |
| 07.0 | 07-operational-procedures/README.md | operational-procedures-overview | Operational Procedures Overview | operational-procedures | 1 | false |
| 07.1 | 07-operational-procedures/07-01-opening-duties.md | opening-duties | Opening Duties | operational-procedures | 1 | false |
| 07.2 | 07-operational-procedures/07-02-ongoing-operations.md | ongoing-operations | Ongoing Operations | operational-procedures | 1 | false |
| 07.3 | 07-operational-procedures/07-03-closing-protocols.md | closing-protocols | Closing Protocols | operational-procedures | 1 | false |
| 07.4 | 07-operational-procedures/07-04-environment-standards.md | environment-standards | Environment Standards | operational-procedures | 1 | false |
| 08 | 08-guest-services/ | guest-services | Guest Services | guest-services | 0 | **true** |
| 08.0 | 08-guest-services/README.md | guest-services-overview | Guest Services Overview | guest-services | 1 | false |
| 08.1 | 08-guest-services/08-01-telephone-etiquette.md | telephone-etiquette | Telephone Etiquette | guest-services | 1 | false |
| 08.2 | 08-guest-services/08-02-reservation-management.md | reservation-management | Reservation Management | guest-services | 1 | false |
| 08.3 | 08-guest-services/08-03-guest-recovery.md | guest-recovery | Guest Recovery | guest-services | 1 | false |
| 08.4 | 08-guest-services/08-04-frequently-asked.md | frequently-asked | Frequently Asked Questions | guest-services | 1 | false |
| 09 | 09-brand-standards.md | brand-standards | Brand Standards | brand | 0 | false |
| 10 | 10-appendix/ | appendix | Appendix | appendix | 0 | **true** |
| 10.0 | 10-appendix/README.md | appendix-overview | Appendix Overview | appendix | 1 | false |
| 10.1 | 10-appendix/10-01-terminology.md | terminology | Restaurant Terminology | appendix | 1 | false |
| 10.2 | 10-appendix/10-02-checklists.md | checklists | Daily Operational Checklists | appendix | 1 | false |
| 10.3 | 10-appendix/10-03-contact-info.md | contact-info | Important Contacts and Resources | appendix | 1 | false |

### 3.2 Spanish Translations

For each section, you'll need to add:
- `title_es`: Spanish title
- `content_es`: Full Spanish markdown translation

**Fallback behavior:** If `content_es` is NULL, the app displays `content_en` with a "Translation unavailable" banner.

### 3.3 Icon Mapping

| Category | Icon (Lucide) |
|----------|---------------|
| welcome | Sparkles |
| company | Building2 |
| values | Heart |
| service | Star |
| operations | Clock |
| team-roles | Users |
| operational-procedures | ClipboardList |
| guest-services | HeadphonesIcon |
| brand | Palette |
| appendix | BookOpen |

---

## 4. UPDATED HOOKS

### 4.1 useManualSections (Replace Mock Data)

```typescript
// src/hooks/use-manual-sections.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';

interface ManualSection {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  icon: string | null;
  sortOrder: number;
  level: number;
  isCategory: boolean;
  hasContent: boolean;
}

export function useManualSections() {
  const { language } = useLanguage();

  return useQuery({
    queryKey: ['manual-sections', language],
    queryFn: async (): Promise<ManualSection[]> => {
      const { data, error } = await supabase
        .rpc('get_manual_tree', { language });

      if (error) throw error;

      return data.map((row: any) => ({
        id: row.id,
        parentId: row.parent_id,
        slug: row.slug,
        title: row.title,
        icon: row.icon,
        sortOrder: row.sort_order,
        level: row.level,
        isCategory: row.is_category,
        hasContent: row.has_content,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper to build tree structure for navigation
export function buildSectionTree(sections: ManualSection[]): ManualSection[] {
  const map = new Map<string, ManualSection & { children: ManualSection[] }>();
  const roots: (ManualSection & { children: ManualSection[] })[] = [];

  // First pass: create map
  sections.forEach(section => {
    map.set(section.id, { ...section, children: [] });
  });

  // Second pass: build tree
  sections.forEach(section => {
    const node = map.get(section.id)!;
    if (section.parentId && map.has(section.parentId)) {
      map.get(section.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children by sortOrder
  const sortChildren = (nodes: (ManualSection & { children: ManualSection[] })[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach(node => sortChildren(node.children));
  };
  sortChildren(roots);

  return roots;
}
```

### 4.2 useManualDocument (Replace Mock Data)

```typescript
// src/hooks/use-manual-document.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';

interface ManualDocument {
  id: string;
  parentId: string | null;
  slug: string;
  filePath: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  icon: string | null;
  updatedAt: Date;
  hasTranslation: boolean;
}

export function useManualDocument(slug: string) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: ['manual-document', slug, language],
    queryFn: async (): Promise<ManualDocument | null> => {
      const { data, error } = await supabase
        .rpc('get_manual_section', { 
          section_slug: slug, 
          language 
        });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const row = data[0];
      return {
        id: row.id,
        parentId: row.parent_id,
        slug: row.slug,
        filePath: row.file_path,
        title: row.title,
        content: row.content || '',
        category: row.category,
        tags: row.tags || [],
        icon: row.icon,
        updatedAt: new Date(row.updated_at),
        hasTranslation: row.has_translation,
      };
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}
```

### 4.3 useManualSearch (New Hook)

```typescript
// src/hooks/use-manual-search.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  snippet: string;
  category: string;
  tags: string[];
  rank: number;
  filePath: string;
}

export function useManualSearch(query: string, enabled = true) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: ['manual-search', query, language],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!query || query.trim().length < 2) return [];

      const { data, error } = await supabase
        .rpc('search_manual', {
          search_query: query.trim(),
          search_language: language,
          result_limit: 20
        });

      if (error) throw error;

      return data.map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        snippet: row.snippet,
        category: row.category,
        tags: row.tags || [],
        rank: row.rank,
        filePath: row.file_path,
      }));
    },
    enabled: enabled && query.trim().length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}
```

---

## 5. UI COMPONENTS

### 5.1 SearchPage Update

```typescript
// src/pages/SearchPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SearchResults } from '@/components/ui/search-results';
import { useManualSearch } from '@/hooks/use-manual-search';
import { useDebounce } from '@/hooks/use-debounce';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const { data: results, isLoading } = useManualSearch(debouncedQuery);
  const navigate = useNavigate();

  const handleResultClick = (slug: string) => {
    navigate(`/manual/${slug}`);
  };

  return (
    <div className="container max-w-reading mx-auto p-lg">
      <div className="relative mb-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search the manual..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 h-12 text-body"
          autoFocus
        />
      </div>

      <SearchResults
        results={results || []}
        isLoading={isLoading}
        query={debouncedQuery}
        onResultClick={handleResultClick}
      />
    </div>
  );
}
```

### 5.2 SearchResults Component

```typescript
// src/components/ui/search-results.tsx

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchResult } from '@/hooks/use-manual-search';
import { FileText } from 'lucide-react';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onResultClick: (slug: string) => void;
}

export function SearchResults({ 
  results, 
  isLoading, 
  query, 
  onResultClick 
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-md">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (query.length < 2) {
    return (
      <div className="text-center text-muted-foreground py-2xl">
        Type at least 2 characters to search
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-2xl">
        No results found for "{query}"
      </div>
    );
  }

  return (
    <div className="space-y-md">
      <p className="text-small text-muted-foreground">
        {results.length} result{results.length !== 1 ? 's' : ''} found
      </p>
      {results.map((result) => (
        <Card
          key={result.id}
          className="p-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onResultClick(result.slug)}
        >
          <div className="flex items-start gap-md">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-xs">
                {result.title}
              </h3>
              <p 
                className="text-small text-muted-foreground line-clamp-2"
                dangerouslySetInnerHTML={{ __html: result.snippet }}
              />
              <div className="flex items-center gap-sm mt-sm">
                <Badge variant="secondary" className="text-xs">
                  {result.category}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### 5.3 TranslationBanner Component

```typescript
// src/components/manual/TranslationBanner.tsx

import { AlertTriangle } from 'lucide-react';
import { Callout } from '@/components/ui/callout';

interface TranslationBannerProps {
  language: 'en' | 'es';
}

export function TranslationBanner({ language }: TranslationBannerProps) {
  if (language !== 'es') return null;

  return (
    <Callout variant="info" className="mb-lg">
      <AlertTriangle className="h-4 w-4" />
      <span>
        Esta sección no está traducida al español. Mostrando contenido en inglés.
      </span>
    </Callout>
  );
}
```

---

## 6. IMPLEMENTATION TASKS

### Phase 1: Database Setup (Day 1)

- [ ] Create `manual_sections` table with migration
- [ ] Add FTS columns and indexes
- [ ] Create RLS policies
- [ ] Create helper functions (`search_manual`, `get_manual_tree`, `get_manual_section`)
- [ ] Test functions in SQL editor

### Phase 2: Seed Data (Day 1-2)

- [ ] Create SQL seed script with all 23 sections (EN titles + categories)
- [ ] Set up proper parent_id relationships for hierarchy
- [ ] Add placeholder content_en for each section
- [ ] Test hierarchy displays correctly

### Phase 3: Hook Migration (Day 2)

- [ ] Update `useManualSections` to query Supabase
- [ ] Update `useManualDocument` to query Supabase
- [ ] Add `buildSectionTree` helper
- [ ] Create `useManualSearch` hook
- [ ] Create `useDebounce` hook
- [ ] Test manual reader works with live data

### Phase 4: Search UI (Day 3)

- [ ] Update `SearchPage` with live search
- [ ] Create `SearchResults` component
- [ ] Add search result highlighting
- [ ] Add empty state and loading states
- [ ] Test search in both languages

### Phase 5: Translation Support (Day 3)

- [ ] Add `TranslationBanner` component
- [ ] Update `ManualContent` to show banner when fallback
- [ ] Test fallback behavior
- [ ] Add Spanish titles to seed data (manual task for user)

### Phase 6: Polish (Day 4)

- [ ] Add recent searches (localStorage)
- [ ] Add search keyboard shortcuts
- [ ] Test on mobile
- [ ] Performance optimization (query caching)
- [ ] Error handling and edge cases

---

## 7. CONTENT UPLOAD PROCESS

### 7.1 For Each Section

When the user is ready to add content, they will:

1. Go to Lovable Cloud → Run SQL
2. Run an UPDATE query for each section:

```sql
UPDATE public.manual_sections
SET 
  content_en = $CONTENT_EN$
YOUR ENGLISH MARKDOWN CONTENT HERE
$CONTENT_EN$,
  content_es = $CONTENT_ES$
YOUR SPANISH MARKDOWN CONTENT HERE
$CONTENT_ES$,
  word_count_en = 2000,  -- approximate
  word_count_es = 2100
WHERE slug = 'welcome-philosophy';
```

### 7.2 Bulk Insert Script Template

After the migration runs, the user can upload content section by section or we can provide a bulk insert script that they fill in.

---

## 8. FILE STRUCTURE

```
src/
├── hooks/
│   ├── use-manual-sections.ts    # Updated: Supabase queries
│   ├── use-manual-document.ts    # Updated: Supabase queries  
│   ├── use-manual-search.ts      # NEW: Search hook
│   └── use-debounce.ts           # NEW: Input debouncing
│
├── components/
│   ├── manual/
│   │   └── TranslationBanner.tsx # NEW: Fallback notice
│   │
│   └── ui/
│       └── search-results.tsx    # NEW: Search results display
│
├── pages/
│   └── SearchPage.tsx            # Updated: Live search
│
└── data/
    └── mock-manual.ts            # DEPRECATED: Keep for reference only
```

---

## 9. TESTING CHECKLIST

### Database
- [ ] Schema migrates without errors
- [ ] RLS policies work (authenticated can read, only admin can write)
- [ ] FTS indexes are created
- [ ] `search_manual` returns ranked results
- [ ] `get_manual_tree` returns proper hierarchy
- [ ] `get_manual_section` returns content with fallback

### UI
- [ ] Manual outline loads from Supabase
- [ ] Section navigation works
- [ ] Content displays with proper markdown rendering
- [ ] Search returns results
- [ ] Search highlights matching terms
- [ ] Language toggle affects search and content
- [ ] Translation fallback banner appears when needed

### Performance
- [ ] Initial load < 500ms
- [ ] Search results < 200ms
- [ ] No unnecessary re-fetches

---

## 10. NEXT STEPS AFTER STEP 4

With the content database and search in place, you're ready for:

- **Step 5: AI Assistant** - Use the `search_manual` function as the retrieval layer for AI grounding
- **Step 6: Admin Panel** - Add UI for content editing (UPDATE queries via admin)
- **Step 8: Semantic Search** - Add vector embeddings to `manual_sections` for hybrid search

---

*This plan ensures the manual reader transitions from mock data to a production-ready Supabase backend with bilingual support and fast keyword search.*
