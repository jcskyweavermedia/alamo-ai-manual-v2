-- =============================================================================
-- Phase 5 Migration 1: Add builder columns to form_templates
-- =============================================================================

ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS builder_state   JSONB        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_refinement_log JSONB      DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ  DEFAULT NULL;

COMMENT ON COLUMN form_templates.builder_state IS 'Persisted builder UI state (collapsed sections, selected field, etc.)';
COMMENT ON COLUMN form_templates.ai_refinement_log IS 'Array of AI refinement conversation turns';
COMMENT ON COLUMN form_templates.published_at IS 'Timestamp of most recent publish action';
