-- =============================================================================
-- Clean all test form_submissions data
-- Templates remain intact; only submissions are deleted.
-- =============================================================================

BEGIN;
DELETE FROM public.form_submissions;
COMMIT;
