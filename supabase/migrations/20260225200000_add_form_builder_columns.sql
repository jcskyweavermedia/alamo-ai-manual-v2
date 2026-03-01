-- =============================================================================
-- MIGRATION: add_form_builder_columns
-- Adds builder_state, ai_refinement_log, and published_at columns to
-- form_templates for the Form Builder Admin (Phase 5).
--
-- NOTE: This is an idempotent re-run-safe migration. The columns may already
-- exist from migration 20260225170000, but we add the missing CHECK constraint
-- and backfill published_at for existing published templates.
-- =============================================================================

BEGIN;

-- Builder auto-save state (nullable, cleared on publish)
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS builder_state JSONB;

-- AI instruction refinement conversation log (must be a JSON array)
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS ai_refinement_log JSONB DEFAULT '[]';

-- Add CHECK constraint if it doesn't exist yet
-- (the previous migration omitted this constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ai_refinement_log_is_array'
      AND conrelid = 'public.form_templates'::regclass
  ) THEN
    ALTER TABLE public.form_templates
      ADD CONSTRAINT chk_ai_refinement_log_is_array
      CHECK (jsonb_typeof(ai_refinement_log) = 'array');
  END IF;
END;
$$;

-- Timestamp of last publish (used for slug immutability check)
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Backfill published_at for existing published templates
UPDATE public.form_templates
SET published_at = updated_at
WHERE status = 'published' AND published_at IS NULL;

COMMIT;
