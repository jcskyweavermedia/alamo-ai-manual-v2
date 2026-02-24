-- =============================================================================
-- Migration: Plate spec FK improvements for Phase 8
-- =============================================================================
-- 1. B-tree index on foh_plate_specs.plate_spec_id for FK lookups
-- 2. Partial unique index to enforce 1:1 (one dish guide per plate spec)
-- 3. Change ON DELETE behavior to SET NULL (orphan dish guide if plate spec deleted)
-- =============================================================================

-- 1. Index for FK lookups (edit flow, cascade checks)
CREATE INDEX IF NOT EXISTS idx_foh_plate_specs_plate_spec_id
  ON public.foh_plate_specs(plate_spec_id)
  WHERE plate_spec_id IS NOT NULL;

-- 2. Partial unique: one dish guide per plate spec
CREATE UNIQUE INDEX IF NOT EXISTS uq_foh_plate_specs_plate_spec_id
  ON public.foh_plate_specs(plate_spec_id)
  WHERE plate_spec_id IS NOT NULL;

-- 3. ON DELETE SET NULL (drop old constraint, add new)
ALTER TABLE public.foh_plate_specs
  DROP CONSTRAINT IF EXISTS foh_plate_specs_plate_spec_id_fkey,
  ADD CONSTRAINT foh_plate_specs_plate_spec_id_fkey
    FOREIGN KEY (plate_spec_id) REFERENCES public.plate_specs(id) ON DELETE SET NULL;
