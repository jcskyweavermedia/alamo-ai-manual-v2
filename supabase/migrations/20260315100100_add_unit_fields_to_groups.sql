-- =============================================================================
-- MIGRATION: Add unit-specific fields to groups table
-- Phase A.2: Groups effectively become units under brands
-- =============================================================================

-- Add unit-specific metadata columns
ALTER TABLE public.groups
  ADD COLUMN address TEXT,
  ADD COLUMN phone TEXT,
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN unit_type TEXT NOT NULL DEFAULT 'restaurant'
    CHECK (unit_type IN ('restaurant', 'bar', 'catering', 'ghost_kitchen', 'test'));

-- Backfill the existing Alamo Prime group
UPDATE public.groups
SET timezone = 'America/New_York',
    unit_type = 'restaurant'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Add FK from evaluations.unit_id to groups.id
-- (column exists nullable with no FK since evaluations rebuild on March 13)
ALTER TABLE public.evaluations
  ADD CONSTRAINT fk_evaluations_unit
    FOREIGN KEY (unit_id) REFERENCES public.groups(id) ON DELETE SET NULL;
