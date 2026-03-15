-- =============================================================================
-- Assessment Framework Phase 1B: ASSESSMENT CONFIG + ASSESSED SECTION IDS
--
-- Two ALTER TABLE statements:
-- 1. courses.assessment_config — evaluation gating (separate from quiz_config)
-- 2. course_enrollments.assessed_section_ids — snapshot at enrollment time
--
-- quiz_config.passing_score = immediate quiz feedback threshold (UX only)
-- assessment_config.passing_competency = actual grade for progression decisions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ASSESSMENT CONFIG on courses
-- ---------------------------------------------------------------------------

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS assessment_config JSONB NOT NULL DEFAULT '{
  "require_passing_evaluation": true,
  "passing_competency": "competent",
  "allow_retry": true,
  "max_retries": null
}'::jsonb;

-- NOTE: For informational courses (no quiz, just reading content), set:
--   assessment_config = { "require_passing_evaluation": false, ... }
-- This allows completion without an evaluation gate.

-- ---------------------------------------------------------------------------
-- ASSESSED SECTION IDS on course_enrollments
-- ---------------------------------------------------------------------------

-- Stores section IDs with active quiz questions at enrollment time.
-- Freezes the assessment scope: adding sections after enrollment doesn't
-- change completion criteria for in-flight students.
-- NULL = legacy enrollment, edge function falls back to querying current quiz_questions.

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS assessed_section_ids UUID[];

COMMENT ON COLUMN public.course_enrollments.assessed_section_ids IS
  'Section IDs with active quiz questions at enrollment time. NULL = legacy, query current quiz_questions as fallback.';
