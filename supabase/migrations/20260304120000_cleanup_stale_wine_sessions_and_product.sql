-- =============================================================================
-- Clean up stale wine sessions and the seeded 14 Hands Hot to Trot product
-- so the user can re-ingest it and verify the duplicate-prevention fixes.
--
-- Deletes:
--   1. "Untitled" wine drafting session (no product linked)
--   2. "14 Hands Hot to Trot" wine drafting session (no product linked)
--   3. "14 Hands Hot to Trot" wine product row (seeded, source_session_id = NULL)
-- =============================================================================

-- 1. Remove both stale wine drafting sessions
DELETE FROM public.ingestion_sessions
WHERE id IN (
  '976d6549-318b-43b3-ba19-a9e07a36f6a9',  -- Untitled wine session
  '1e14123b-4043-4726-92f2-d830723d3b31'   -- 14 Hands Hot to Trot wine session
);

-- 2. Remove the seeded "14 Hands Hot to Trot" wine product
--    (source_session_id was NULL — it was never linked to a session)
DELETE FROM public.wines
WHERE id = 'd55170a3-582b-489e-a2e7-e583595e16b3';
