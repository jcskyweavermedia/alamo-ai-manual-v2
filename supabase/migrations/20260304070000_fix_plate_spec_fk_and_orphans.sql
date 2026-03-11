-- =============================================================================
-- Fix plate_spec ↔ foh_plate_specs relationship integrity.
--
-- Changes:
--   1. foh_plate_specs.plate_spec_id FK  → ON DELETE CASCADE
--      (deleting a BOH plate spec now automatically deletes the FOH dish guide)
--   2. foh_plate_specs.source_session_id FK → ON DELETE SET NULL
--      (was NO ACTION / RESTRICT — blocked deleting sessions while dish guides
--       still referenced them, causing foreign-key errors at discard time)
--   3. Delete orphaned seed foh_plate_specs rows where plate_spec_id IS NULL
--      and source_session_id IS NULL (these were seeded before the ingest
--      system existed and have no parent plate_spec to link back to)
--   4. Mark any ingestion_sessions rows with product_table = 'foh_plate_specs'
--      as 'deleted' — these were created by the broken DishCardView edit flow
--      (it navigated to foh_plate_specs instead of plate_specs) and are garbage
-- =============================================================================

-- 1. Change plate_spec_id FK from ON DELETE SET NULL → ON DELETE CASCADE
ALTER TABLE public.foh_plate_specs
  DROP CONSTRAINT IF EXISTS foh_plate_specs_plate_spec_id_fkey,
  ADD CONSTRAINT foh_plate_specs_plate_spec_id_fkey
    FOREIGN KEY (plate_spec_id)
    REFERENCES public.plate_specs(id)
    ON DELETE CASCADE;

-- 2. Change source_session_id FK from NO ACTION → ON DELETE SET NULL
--    First drop the implicit constraint added by the ADD COLUMN ... REFERENCES form
ALTER TABLE public.foh_plate_specs
  DROP CONSTRAINT IF EXISTS foh_plate_specs_source_session_id_fkey,
  ADD CONSTRAINT foh_plate_specs_source_session_id_fkey
    FOREIGN KEY (source_session_id)
    REFERENCES public.ingestion_sessions(id)
    ON DELETE SET NULL;

-- 3. Delete orphaned seed dish-guide rows that have no plate_spec parent and
--    were never created via the ingest system (source_session_id IS NULL).
--    These are stale seed entries that have been superseded by ingested rows.
DELETE FROM public.foh_plate_specs
WHERE plate_spec_id IS NULL
  AND source_session_id IS NULL;

-- 4. Mark garbage sessions (created by broken foh_plate_specs edit flow)
UPDATE public.ingestion_sessions
SET status = 'deleted', updated_at = now()
WHERE product_table = 'foh_plate_specs';
