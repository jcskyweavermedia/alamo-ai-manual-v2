-- =============================================================================
-- MIGRATION: fix_session_proliferation
-- Enforces 1 active ingestion session per product at the DB level.
-- 1a. Adds 'deleted' to status CHECK constraint
-- 1b. Cleans up duplicate sessions (keep most recent, abandon rest)
-- 1c. Creates unique partial indexes (1 active session per product)
-- 1d. Creates lookup indexes for findSessionForProduct queries
-- 1e. Backfills source_session_id on product tables
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1a. Fix status CHECK constraint — add 'deleted' status
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ingestion_sessions
  DROP CONSTRAINT ingestion_sessions_status_check;

ALTER TABLE public.ingestion_sessions
  ADD CONSTRAINT ingestion_sessions_status_check
  CHECK (status IN ('drafting','review','publishing','published','failed','abandoned','deleted'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 1b. Clean up existing duplicate sessions BEFORE creating unique indexes
-- For each product_id, keep only the most recently updated active session;
-- mark the rest as 'abandoned'.
-- ─────────────────────────────────────────────────────────────────────────────

-- Abandon duplicate product_id sessions (keep newest active per product_id+table)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY product_table, product_id
           ORDER BY updated_at DESC
         ) AS rn
  FROM public.ingestion_sessions
  WHERE product_id IS NOT NULL
    AND status NOT IN ('abandoned','deleted','failed')
)
UPDATE public.ingestion_sessions
SET status = 'abandoned', updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Abandon duplicate editing_product_id sessions (keep newest active per editing_product_id+table)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY product_table, editing_product_id
           ORDER BY updated_at DESC
         ) AS rn
  FROM public.ingestion_sessions
  WHERE editing_product_id IS NOT NULL
    AND status NOT IN ('abandoned','deleted','failed')
)
UPDATE public.ingestion_sessions
SET status = 'abandoned', updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1c. Unique partial indexes — enforce 1 active session per product
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX idx_ingestion_sessions_unique_product
  ON public.ingestion_sessions (product_table, product_id)
  WHERE product_id IS NOT NULL AND status NOT IN ('abandoned','deleted','failed');

CREATE UNIQUE INDEX idx_ingestion_sessions_unique_editing
  ON public.ingestion_sessions (product_table, editing_product_id)
  WHERE editing_product_id IS NOT NULL AND status NOT IN ('abandoned','deleted','failed');

-- ─────────────────────────────────────────────────────────────────────────────
-- 1d. Lookup indexes for findSessionForProduct queries
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_ingestion_sessions_product_lookup
  ON public.ingestion_sessions (product_id, product_table, status);

CREATE INDEX idx_ingestion_sessions_editing_lookup
  ON public.ingestion_sessions (editing_product_id, product_table, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1e. Backfill source_session_id on product tables
-- For each product with a published session, link the product back to it
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.prep_recipes r
SET source_session_id = s.id
FROM public.ingestion_sessions s
WHERE s.product_id = r.id
  AND s.status = 'published'
  AND r.source_session_id IS NULL;

UPDATE public.wines w
SET source_session_id = s.id
FROM public.ingestion_sessions s
WHERE s.product_id = w.id
  AND s.status = 'published'
  AND w.source_session_id IS NULL;

UPDATE public.cocktails c
SET source_session_id = s.id
FROM public.ingestion_sessions s
WHERE s.product_id = c.id
  AND s.status = 'published'
  AND c.source_session_id IS NULL;
