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