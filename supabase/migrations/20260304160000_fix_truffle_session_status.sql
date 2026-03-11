-- Fix: Truffle Mashed Potatoes ingestion session stuck in 'drafting'
-- The plate_spec was successfully published (plate_specs row exists and is published),
-- but the session was never transitioned to 'published' status — causing it to appear
-- as a ghost "drafting" entry in the admin/ingest panel alongside the published recipe.
--
-- Session:   a33d934a-cc28-4c05-b035-b81001328a7c
-- Product:   158c7b83-d219-4ab0-9fd1-33c63cd5c6c0 (plate_specs, published)

UPDATE ingestion_sessions
SET status = 'published'
WHERE id = 'a33d934a-cc28-4c05-b035-b81001328a7c'
  AND product_id = '158c7b83-d219-4ab0-9fd1-33c63cd5c6c0'
  AND status = 'drafting';
