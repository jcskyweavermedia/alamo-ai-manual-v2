-- =============================================================================
-- MIGRATION: enhance_search_contacts
-- Adds email and notes columns to the search_contacts return type so the
-- AI form-filling assistant can surface richer contact information.
-- Phase 2 of Form Builder System
-- =============================================================================

BEGIN;

-- Must DROP first because CREATE OR REPLACE cannot change return type
DROP FUNCTION IF EXISTS public.search_contacts(TEXT, INT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.search_contacts(
  search_query      TEXT,
  match_count       INT DEFAULT 5,
  p_group_id        UUID DEFAULT NULL,
  p_category        TEXT DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  category        TEXT,
  subcategory     TEXT,
  phone           TEXT,
  contact_person  TEXT,
  address         TEXT,
  email           TEXT,
  notes           TEXT,
  is_demo_data    BOOLEAN,
  score           FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('simple', search_query);

  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.category,
    ct.subcategory,
    ct.phone,
    ct.contact_person,
    ct.address,
    ct.email,
    ct.notes,
    ct.is_demo_data,
    ts_rank(ct.search_vector, ts_query)::FLOAT AS score
  FROM public.contacts ct
  WHERE ct.search_vector @@ ts_query
    AND ct.status = 'active'
    AND (p_group_id IS NULL OR ct.group_id = p_group_id)
    AND (p_category IS NULL OR ct.category = p_category)
  ORDER BY
    ct.is_priority DESC,
    score DESC
  LIMIT match_count;
END;
$$;

COMMIT;
