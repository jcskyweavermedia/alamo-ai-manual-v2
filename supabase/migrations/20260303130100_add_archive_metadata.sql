-- =============================================================================
-- Add archive metadata columns to form_submissions
-- Populated only when status transitions to 'archived' via the Archive Wizard.
-- =============================================================================

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS archive_reason       TEXT,
  ADD COLUMN IF NOT EXISTS archive_manager_name TEXT,
  ADD COLUMN IF NOT EXISTS archive_signature    JSONB,
  ADD COLUMN IF NOT EXISTS archived_by          UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS archived_at          TIMESTAMPTZ;
