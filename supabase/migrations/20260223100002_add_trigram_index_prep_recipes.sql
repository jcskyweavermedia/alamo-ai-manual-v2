-- =============================================================================
-- MIGRATION: add_trigram_index_prep_recipes
-- Adds a pg_trgm GIN index on prep_recipes.name to accelerate ILIKE searches
-- used by the SubRecipeLinker typeahead component.
--
-- Why: The SubRecipeLinker uses `.ilike('name', '%query%')` which performs a
-- leading-wildcard search. B-tree indexes cannot serve this pattern, so
-- PostgreSQL falls back to a sequential scan. A trigram GIN index lets the
-- planner use an index scan instead, which matters as the table grows
-- from the current 4 rows toward 50-200+.
-- =============================================================================

-- 1. Enable pg_trgm in the extensions schema (safe to re-run)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- 2. Create GIN trigram index on prep_recipes.name
CREATE INDEX idx_prep_recipes_name_trgm
  ON public.prep_recipes
  USING gin (name extensions.gin_trgm_ops);
