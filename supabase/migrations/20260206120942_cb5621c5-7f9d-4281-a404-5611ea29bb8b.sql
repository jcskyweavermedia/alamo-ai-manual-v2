-- ============================================
-- FIX SEARCH FUNCTION: ts_headline needs regconfig type
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
  ts_config regconfig;
BEGIN
  -- Set config based on language
  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
    ts_query := plainto_tsquery('spanish', search_query);
  ELSE
    ts_config := 'english'::regconfig;
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
    -- Generate snippet from content (using proper regconfig type)
    ts_headline(
      ts_config,
      COALESCE(
        CASE WHEN search_language = 'es' AND ms.content_es IS NOT NULL 
             THEN ms.content_es 
             ELSE ms.content_en 
        END,
        ''
      ),
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