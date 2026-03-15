-- =============================================================================
-- MIGRATION: Drop stale search_recipes overload with filter_department
-- The 20260225 migration added filter_department TEXT as a 6th param.
-- The M7 migration (20260315100600) created a NEW overload with p_group_id UUID
-- instead of replacing the old one. M8 tried to drop (TEXT, vector, INT, FLOAT, FLOAT)
-- but the old signature was actually (TEXT, vector, INT, FLOAT, FLOAT, TEXT).
-- =============================================================================

DROP FUNCTION IF EXISTS public.search_recipes(TEXT, vector, INT, FLOAT, FLOAT, TEXT);
