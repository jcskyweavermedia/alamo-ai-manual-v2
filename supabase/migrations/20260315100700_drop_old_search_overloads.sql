-- =============================================================================
-- MIGRATION: Drop old search function overloads (5-param versions)
-- Phase A.7c: Remove unscoped search functions
-- =============================================================================
-- The M7 migration added a 6th param (p_group_id UUID DEFAULT NULL) to all
-- search functions. PostgreSQL treats this as a NEW overload rather than a
-- replacement. The old 5-param versions (without group_id filtering) must be
-- dropped to prevent callers from accidentally bypassing group scoping.

-- Drop old 5-param product search functions
DROP FUNCTION IF EXISTS public.search_dishes(TEXT, vector, INT, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS public.search_wines(TEXT, vector, INT, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS public.search_cocktails(TEXT, vector, INT, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS public.search_recipes(TEXT, vector, INT, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS public.search_beer_liquor(TEXT, vector, INT, FLOAT, FLOAT);

-- Drop old 6-param search_manual_v2 (had no p_group_id)
DROP FUNCTION IF EXISTS public.search_manual_v2(TEXT, vector, TEXT, INT, FLOAT, FLOAT);

-- Drop old 3-param search_manual (had no p_group_id)
DROP FUNCTION IF EXISTS public.search_manual(TEXT, TEXT, INTEGER);

-- Drop old 1-param get_manual_tree (had no p_group_id)
DROP FUNCTION IF EXISTS public.get_manual_tree(TEXT);

-- Drop old 2-param get_manual_section (had no p_group_id)
DROP FUNCTION IF EXISTS public.get_manual_section(TEXT, TEXT);
