-- =============================================================================
-- Backfill ingestion_sessions that are stuck in 'drafting' or 'review' even
-- though their product row was successfully published.
--
-- Root cause: the publish flow inserts/updates the product row and sets
-- source_session_id on it, but the final step — updating the session row to
-- status='published' with product_id — sometimes failed or was skipped
-- (e.g. sessionId was null at publish time, network error, race condition).
--
-- Strategy: for each product table, find product rows whose source_session_id
-- points to a session still in 'drafting' or 'review', then update those
-- sessions to status='published' and fill in product_id.
-- =============================================================================

-- prep_recipes
UPDATE public.ingestion_sessions s
SET
  status      = 'published',
  product_id  = pr.id,
  updated_at  = now()
FROM public.prep_recipes pr
WHERE s.product_table = 'prep_recipes'
  AND s.status IN ('drafting', 'review')
  AND pr.source_session_id = s.id;

-- plate_specs
UPDATE public.ingestion_sessions s
SET
  status      = 'published',
  product_id  = ps.id,
  updated_at  = now()
FROM public.plate_specs ps
WHERE s.product_table = 'plate_specs'
  AND s.status IN ('drafting', 'review')
  AND ps.source_session_id = s.id;

-- wines
UPDATE public.ingestion_sessions s
SET
  status      = 'published',
  product_id  = w.id,
  updated_at  = now()
FROM public.wines w
WHERE s.product_table = 'wines'
  AND s.status IN ('drafting', 'review')
  AND w.source_session_id = s.id;

-- cocktails
UPDATE public.ingestion_sessions s
SET
  status      = 'published',
  product_id  = c.id,
  updated_at  = now()
FROM public.cocktails c
WHERE s.product_table = 'cocktails'
  AND s.status IN ('drafting', 'review')
  AND c.source_session_id = s.id;

-- foh_plate_specs (dish guides — session product_table is 'plate_specs',
-- not 'foh_plate_specs', so this table has no direct session; skip it)

-- beer_liquor_list rows do not have individual sessions (managed via the
-- hub card), so no backfill needed there either.
