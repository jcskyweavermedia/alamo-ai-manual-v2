-- =============================================================================
-- Course Builder Phase 2: TEARDOWN
-- Drops all 18 existing training tables + 5 dependent functions + 1 cron job
-- Cleans up orphaned AI prompt seeds (training-specific slugs only)
--
-- PRESERVED (never dropped):
--   - ai_teachers, ai_prompts (serve broader AI system)
--   - manual_sections and all product tables
--   - get_user_group_id(), get_user_role(), set_updated_at() (shared helpers)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 0: Remove cron job FIRST (references cleanup function)
-- Wrapped in DO block with exception handler because the job may not exist
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-training-data');
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available, skipping unschedule';
  WHEN OTHERS THEN
    RAISE NOTICE 'Cron job cleanup-training-data may not exist, skipping: %', SQLERRM;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Drop training-specific functions (5 functions)
-- These all reference old training tables and must go before the tables
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.sync_program_enrollment_on_course_complete() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_training_data() CASCADE;
DROP FUNCTION IF EXISTS public.expire_rollouts() CASCADE;
DROP FUNCTION IF EXISTS public.detect_content_changes(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_team_progress(UUID) CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Drop Tier 4 — Deepest leaf tables (no dependents)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.conversation_messages CASCADE;
DROP TABLE IF EXISTS public.module_test_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_attempt_answers CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Drop Tier 3 — Tables that only tier-4 depends on
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.module_test_attempts CASCADE;
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.tutor_sessions CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Drop Tier 2 — Mid-level tables
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.quiz_questions CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.section_progress CASCADE;
DROP TABLE IF EXISTS public.course_conversations CASCADE;
DROP TABLE IF EXISTS public.rollout_assignments CASCADE;
DROP TABLE IF EXISTS public.content_change_log CASCADE;
DROP TABLE IF EXISTS public.program_enrollments CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Drop Tier 1 — Tables that tier-2/3 depends on
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.rollouts CASCADE;
DROP TABLE IF EXISTS public.course_enrollments CASCADE;
DROP TABLE IF EXISTS public.course_sections CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 6: Drop Tier 0 — Root tables
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.training_programs CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 7: Clean up orphaned AI prompt seeds (training-specific slugs only)
-- Keep assessment-conductor and conversation-evaluator for future rebuild
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM public.ai_prompts
WHERE slug IN (
  'training-section-quiz-mc',
  'training-section-quiz-voice',
  'training-session-summary',
  'module-test-mc',
  'module-test-voice',
  'cert-test-mc-generator',
  'cert-test-voice-generator'
);
