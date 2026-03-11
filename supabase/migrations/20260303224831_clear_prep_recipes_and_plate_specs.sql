-- =============================================================================
-- Clear all prep recipe and BOH plate spec data for a clean rebuild.
-- Includes the "Mango Mojito Syrup" prep as well as every other row.
--
-- FK map (confirmed from live DB):
--   prep_recipes.source_session_id   → ingestion_sessions(id)  [RESTRICT]
--   plate_specs.source_session_id    → ingestion_sessions(id)  [RESTRICT]
--   foh_plate_specs.plate_spec_id    → plate_specs(id)         [ON DELETE SET NULL]
--   ingestion_messages.session_id    → ingestion_sessions(id)  [ON DELETE CASCADE]
--
-- Deletion order:
--   1. product_translations  — generic UUID, no FK, must go first
--   2. sub_recipe_links      — guarded; may not exist in production
--   3. prep_recipes          — clears source_session_id FK refs to ingestion_sessions
--   4. plate_specs           — ON DELETE SET NULL automatically nullifies
--                              foh_plate_specs.plate_spec_id (dish guides kept intact)
--   5. ingestion_sessions    — prep_recipe + plate_spec rows; ingestion_messages
--                              cascade-delete automatically
-- =============================================================================

-- 1. Remove translations for prep recipes and plate specs
DELETE FROM public.product_translations
WHERE product_table IN ('prep_recipes', 'plate_specs');

-- 2. Remove sub-recipe cross-links (guarded — table may not exist in production)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sub_recipe_links'
  ) THEN
    DELETE FROM public.sub_recipe_links
    WHERE parent_table IN ('prep_recipes', 'plate_specs')
       OR child_table  IN ('prep_recipes', 'plate_specs');
  END IF;
END $$;

-- 3. Clear all prep recipe rows (Mango Mojito Syrup + everything else).
--    The custom trigger trg_prevent_delete_referenced_prep_recipe blocks
--    deletion of recipes referenced by other rows. We disable it by name
--    (not ALL, which would hit system triggers and fail in Supabase),
--    wipe the data, then re-enable it.
ALTER TABLE public.prep_recipes DISABLE TRIGGER trg_prevent_delete_referenced_prep_recipe;
DELETE FROM public.prep_recipes;
ALTER TABLE public.prep_recipes ENABLE TRIGGER trg_prevent_delete_referenced_prep_recipe;

-- 4. Clear all BOH plate spec rows
--    (foh_plate_specs.plate_spec_id → SET NULL automatically; dish guides are preserved)
DELETE FROM public.plate_specs;

-- 5. Nullify foh_plate_specs.source_session_id that still point at the sessions
--    we are about to delete (FK is RESTRICT, so must be cleared first).
UPDATE public.foh_plate_specs
SET source_session_id = NULL
WHERE source_session_id IN (
  SELECT id FROM public.ingestion_sessions
  WHERE product_table IN ('prep_recipes', 'plate_specs')
);

-- 6. Remove ingestion session records for prep recipes and plate specs.
--    ingestion_messages cascade-delete automatically via ON DELETE CASCADE.
DELETE FROM public.ingestion_sessions
WHERE product_table IN ('prep_recipes', 'plate_specs');
