-- =============================================================================
-- Backfill the session ↔ product FK links that were never written.
--
-- Root cause: state.sessionId was null at publish time (the auto-save race
-- condition that was fixed 2026-03-04). Because state.sessionId was null:
--   • product rows were inserted with source_session_id = NULL
--   • the session-update step was skipped, leaving product_id = NULL and
--     status = 'drafting' on every ingestion_sessions row.
--
-- Strategy: match by name (draft_data->>'name' = product.name).
-- Names are unique per table within this dataset, so this is safe.
--
-- Step order:
--   1. Backfill product.source_session_id  (product → session link)
--   2. Backfill session.product_id         (session → product link)
--   3. Promote matched sessions to 'published'
-- =============================================================================

-- ── 1. prep_recipes ──────────────────────────────────────────────────────────

UPDATE public.prep_recipes pr
SET source_session_id = s.id
FROM public.ingestion_sessions s
WHERE s.product_table = 'prep_recipes'
  AND s.status        = 'drafting'
  AND (s.draft_data->>'name') = pr.name
  AND pr.source_session_id IS NULL;

UPDATE public.ingestion_sessions s
SET product_id  = pr.id,
    updated_at  = now()
FROM public.prep_recipes pr
WHERE s.product_table = 'prep_recipes'
  AND s.status        = 'drafting'
  AND (s.draft_data->>'name') = pr.name
  AND s.product_id IS NULL;

UPDATE public.ingestion_sessions s
SET status      = 'published',
    updated_at  = now()
FROM public.prep_recipes pr
WHERE s.product_table = 'prep_recipes'
  AND s.status        = 'drafting'
  AND pr.source_session_id = s.id;

-- ── 2. plate_specs ───────────────────────────────────────────────────────────

UPDATE public.plate_specs ps
SET source_session_id = s.id
FROM public.ingestion_sessions s
WHERE s.product_table = 'plate_specs'
  AND s.status        = 'drafting'
  AND (s.draft_data->>'name') = ps.name
  AND ps.source_session_id IS NULL;

UPDATE public.ingestion_sessions s
SET product_id  = ps.id,
    updated_at  = now()
FROM public.plate_specs ps
WHERE s.product_table = 'plate_specs'
  AND s.status        = 'drafting'
  AND (s.draft_data->>'name') = ps.name
  AND s.product_id IS NULL;

UPDATE public.ingestion_sessions s
SET status      = 'published',
    updated_at  = now()
FROM public.plate_specs ps
WHERE s.product_table = 'plate_specs'
  AND s.status        = 'drafting'
  AND ps.source_session_id = s.id;

-- ── 3. wines ─────────────────────────────────────────────────────────────────

UPDATE public.wines w
SET source_session_id = s.id
FROM public.ingestion_sessions s
WHERE s.product_table = 'wines'
  AND s.status        = 'drafting'
  AND (s.draft_data->>'name') = w.name
  AND w.source_session_id IS NULL;

UPDATE public.ingestion_sessions s
SET product_id  = w.id,
    updated_at  = now()
FROM public.wines w
WHERE s.product_table = 'wines'
  AND s.status        = 'drafting'
  AND (s.draft_data->>'name') = w.name
  AND s.product_id IS NULL;

UPDATE public.ingestion_sessions s
SET status      = 'published',
    updated_at  = now()
FROM public.wines w
WHERE s.product_table = 'wines'
  AND s.status        = 'drafting'
  AND w.source_session_id = s.id;

-- ── 4. cocktails ─────────────────────────────────────────────────────────────

UPDATE public.cocktails c
SET source_session_id = s.id
FROM public.ingestion_sessions s
WHERE s.product_table = 'cocktails'
  AND s.status        = 'drafting'
  AND (s.draft_data->>'name') = c.name
  AND c.source_session_id IS NULL;

UPDATE public.ingestion_sessions s
SET product_id  = c.id,
    updated_at  = now()
FROM public.cocktails c
WHERE s.product_table = 'cocktails'
  AND s.status        = 'drafting'
  AND (s.draft_data->>'name') = c.name
  AND s.product_id IS NULL;

UPDATE public.ingestion_sessions s
SET status      = 'published',
    updated_at  = now()
FROM public.cocktails c
WHERE s.product_table = 'cocktails'
  AND s.status        = 'drafting'
  AND c.source_session_id = s.id;
