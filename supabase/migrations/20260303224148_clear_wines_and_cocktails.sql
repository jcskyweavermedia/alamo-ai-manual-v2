-- =============================================================================
-- Clear all wine and cocktail data so both lists can be rebuilt from scratch.
--
-- FK reality (confirmed from live DB):
--   wines.source_session_id      → ingestion_sessions(id)
--   cocktails.source_session_id  → ingestion_sessions(id)
--
-- Therefore wines/cocktails must be deleted BEFORE ingestion_sessions,
-- otherwise the FK constraint "wines_source_session_id_fkey" blocks the
-- session delete.
--
-- Deletion order:
--   1. product_translations  — generic product_id UUID (no FK), first
--   2. sub_recipe_links      — guarded; may not exist in production
--   3. wines                 — nullifies the FK ref to ingestion_sessions
--   4. cocktails             — same
--   5. ingestion_sessions    — safe now that wines/cocktails are gone
-- =============================================================================

-- 1. Remove translations tied to wines or cocktails
DELETE FROM public.product_translations
WHERE product_table IN ('wines', 'cocktails');

-- 2. Remove sub-recipe cross-links involving wines or cocktails (table may not exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sub_recipe_links'
  ) THEN
    DELETE FROM public.sub_recipe_links
    WHERE parent_table IN ('wines', 'cocktails')
       OR child_table  IN ('wines', 'cocktails');
  END IF;
END $$;

-- 3. Clear all wine rows (drops FK refs to ingestion_sessions)
DELETE FROM public.wines;

-- 4. Clear all cocktail rows (drops FK refs to ingestion_sessions)
DELETE FROM public.cocktails;

-- 5. Remove ingestion session records for wines and cocktails
DELETE FROM public.ingestion_sessions
WHERE product_table IN ('wines', 'cocktails');
