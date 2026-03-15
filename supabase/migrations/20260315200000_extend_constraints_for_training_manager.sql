-- =============================================================================
-- MIGRATION: extend_constraints_for_training_manager
-- Adds 'training' and 'training_manager' to chat_sessions.context_type CHECK,
-- and 'training_manager' to ai_prompts.domain CHECK.
--
-- Note: 'training' was missing from chat_sessions_context_type_check despite
-- being used in the edge function — fixed here alongside the new domain.
-- Phase C of Training System (AI Training Tools)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. chat_sessions: add 'training' + 'training_manager' to context_type
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_sessions
  DROP CONSTRAINT chat_sessions_context_type_check;

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_context_type_check
  CHECK (context_type IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor',
    'steps_of_service', 'forms', 'training', 'training_manager'
  ));

-- ---------------------------------------------------------------------------
-- 2. ai_prompts: add 'training_manager' to domain CHECK
-- ---------------------------------------------------------------------------

ALTER TABLE public.ai_prompts
  DROP CONSTRAINT ai_prompts_domain_check;

ALTER TABLE public.ai_prompts
  ADD CONSTRAINT ai_prompts_domain_check
  CHECK (domain IS NULL OR domain IN (
    'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor',
    'steps_of_service', 'forms', 'training_manager'
  ));

COMMIT;
