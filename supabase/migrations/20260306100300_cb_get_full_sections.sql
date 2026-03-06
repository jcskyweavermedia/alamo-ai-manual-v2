-- =============================================================================
-- Course Builder Phase 2: get_full_sections() FUNCTION
-- Returns complete, untruncated section content from manual_sections
-- by an array of section IDs. This is the Course Builder's source material
-- assembly function — the AI gets everything, no chunking, no truncation.
--
-- Used by: build-course edge function (outline + content generation)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_full_sections(
  section_ids UUID[]
)
RETURNS TABLE (
  id          UUID,
  slug        TEXT,
  title_en    TEXT,
  title_es    TEXT,
  content_en  TEXT,
  content_es  TEXT,
  category    TEXT,
  tags        TEXT[],
  word_count_en INTEGER,
  word_count_es INTEGER,
  updated_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    ms.id,
    ms.slug,
    ms.title_en,
    ms.title_es,
    ms.content_en,
    ms.content_es,
    ms.category,
    ms.tags,
    ms.word_count_en,
    ms.word_count_es,
    ms.updated_at
  FROM public.manual_sections ms
  WHERE ms.id = ANY(section_ids)
    AND ms.is_category = false
  ORDER BY ms.sort_order;
$$;
