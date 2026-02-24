-- =============================================================================
-- MIGRATION: drop_unused_sub_recipe_links
-- Table was created in phase1_ingestion_foundation but never populated or queried.
-- The JSONB prep_recipe_ref pattern is the canonical linking mechanism.
-- Integrity is now enforced by triggers (previous migration).
-- =============================================================================

-- Drop policies first (required before DROP TABLE)
DROP POLICY IF EXISTS "Authenticated users can view sub_recipe_links" ON public.sub_recipe_links;
DROP POLICY IF EXISTS "Admins can insert sub_recipe_links" ON public.sub_recipe_links;
DROP POLICY IF EXISTS "Admins can update sub_recipe_links" ON public.sub_recipe_links;
DROP POLICY IF EXISTS "Admins can delete sub_recipe_links" ON public.sub_recipe_links;

-- Drop indexes
DROP INDEX IF EXISTS idx_sub_recipe_links_parent;
DROP INDEX IF EXISTS idx_sub_recipe_links_child;

-- Drop the table
DROP TABLE IF EXISTS public.sub_recipe_links;
