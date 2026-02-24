-- =============================================================================
-- MIGRATION: extend_chat_sessions_for_forms
-- Adds 'forms' to the CHECK constraints on chat_sessions.context_type
-- and ai_prompts.domain so the form-filling AI can create sessions
-- and store domain-specific prompts.
-- Phase 2 of Form Builder System
-- =============================================================================

BEGIN;

ALTER TABLE public.chat_sessions
  DROP CONSTRAINT chat_sessions_context_type_check;

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_context_type_check
  CHECK (context_type IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor', 'steps_of_service', 'forms'
  ));

ALTER TABLE public.ai_prompts
  DROP CONSTRAINT ai_prompts_domain_check;

ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_domain_check
  CHECK (domain IS NULL OR domain IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor', 'steps_of_service', 'forms'
  ));

COMMIT;
