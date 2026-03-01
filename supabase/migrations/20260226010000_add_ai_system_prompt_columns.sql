-- =============================================================================
-- Add AI system prompt columns + instructions_refined flag to form_templates
-- Sprint A1: Form Instructions Panel + AI Refinement
-- =============================================================================

ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS ai_system_prompt_en TEXT,
  ADD COLUMN IF NOT EXISTS ai_system_prompt_es TEXT,
  ADD COLUMN IF NOT EXISTS instructions_refined BOOLEAN NOT NULL DEFAULT FALSE;
