-- Delete Classic Shrimp Cocktail from all tables
-- Removes both the admin/ingest record and the /recipes (foh) record
--
-- Records being removed:
--   plate_specs:         5a29a911-f317-418c-87bb-29c62f94e67f  (slug: classic-shrimp-cocktail-2)
--   foh_plate_specs:     7c6776fd-cd8f-4424-88b8-84572613a3b2  (slug: classic-shrimp-cocktail)
--   ingestion_sessions:  6d30fada-3b4d-436d-9c44-e540e992e7bb  (status: drafting)
--   ingestion_sessions:  f60bbefa-b852-4ff6-9403-da528a3fb9e7  (status: abandoned, orphan)

-- 1. Remove FOH record first (FK → plate_specs)
DELETE FROM foh_plate_specs
WHERE id = '7c6776fd-cd8f-4424-88b8-84572613a3b2';

-- 2. Remove BOH plate spec (FK → ingestion_sessions via source_session_id)
DELETE FROM plate_specs
WHERE id = '5a29a911-f317-418c-87bb-29c62f94e67f';

-- 3. Remove both ingestion sessions (no remaining FK references)
DELETE FROM ingestion_sessions
WHERE id IN (
  '6d30fada-3b4d-436d-9c44-e540e992e7bb',
  'f60bbefa-b852-4ff6-9403-da528a3fb9e7'
);
