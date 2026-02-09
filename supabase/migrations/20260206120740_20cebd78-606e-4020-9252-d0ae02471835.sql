-- ============================================
-- MANUAL_SECTIONS: Hierarchical content storage with bilingual support
-- ============================================
CREATE TABLE public.manual_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Hierarchy
  parent_id UUID REFERENCES public.manual_sections(id) ON DELETE CASCADE,
  
  -- Identifiers
  file_path TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  
  -- Titles (bilingual)
  title_en TEXT NOT NULL,
  title_es TEXT,
  
  -- Content (bilingual markdown)
  content_en TEXT,
  content_es TEXT,
  
  -- Metadata
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  is_category BOOLEAN NOT NULL DEFAULT false,
  
  -- Stats
  word_count_en INTEGER DEFAULT 0,
  word_count_es INTEGER DEFAULT 0,
  
  -- Full-text search vectors (populated by trigger)
  search_vector_en tsvector,
  search_vector_es tsvector,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_manual_sections_parent ON public.manual_sections(parent_id);
CREATE INDEX idx_manual_sections_category ON public.manual_sections(category);
CREATE INDEX idx_manual_sections_sort ON public.manual_sections(sort_order);
CREATE INDEX idx_manual_sections_slug ON public.manual_sections(slug);
CREATE INDEX idx_manual_sections_tags ON public.manual_sections USING GIN(tags);

-- ============================================
-- GIN INDEXES FOR FAST FULL-TEXT SEARCH
-- ============================================
CREATE INDEX idx_manual_sections_fts_en ON public.manual_sections USING GIN(search_vector_en);
CREATE INDEX idx_manual_sections_fts_es ON public.manual_sections USING GIN(search_vector_es);

-- ============================================
-- TRIGGER FUNCTION: Update search vectors on insert/update
-- ============================================
CREATE OR REPLACE FUNCTION public.update_manual_section_search_vectors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Build English search vector
  NEW.search_vector_en := 
    setweight(to_tsvector('english', coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content_en, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'C');
  
  -- Build Spanish search vector (with fallback to English)
  NEW.search_vector_es := 
    setweight(to_tsvector('spanish', coalesce(NEW.title_es, NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.content_es, NEW.content_en, '')), 'B') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  
  -- Update timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- ============================================
-- TRIGGER: Run on insert and update
-- ============================================
CREATE TRIGGER manual_sections_search_vectors_trigger
  BEFORE INSERT OR UPDATE ON public.manual_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_manual_section_search_vectors();