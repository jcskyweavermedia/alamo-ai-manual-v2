-- Fix source_session_id FK behavior on all product tables.
--
-- Problem: prep_recipes, plate_specs, wines, cocktails, and beer_liquor_list all
-- declare source_session_id with NO ON DELETE clause (defaults to RESTRICT/NO ACTION).
-- This means the pg_cron cleanup job that hard-deletes old ingestion_sessions rows
-- can FAIL if any product row still holds a reference to the session being deleted.
--
-- foh_plate_specs was already fixed in migration 20260304070000 (SET NULL).
-- This migration brings all remaining product tables to the same behavior.
--
-- ON DELETE SET NULL: When an ingestion_session row is hard-deleted by pg_cron,
-- the product's source_session_id is automatically nulled out instead of blocking the delete.
-- The product row itself is preserved (which is correct — published products should survive).

-- prep_recipes
ALTER TABLE public.prep_recipes
  DROP CONSTRAINT IF EXISTS prep_recipes_source_session_id_fkey;
ALTER TABLE public.prep_recipes
  ADD CONSTRAINT prep_recipes_source_session_id_fkey
    FOREIGN KEY (source_session_id)
    REFERENCES public.ingestion_sessions(id)
    ON DELETE SET NULL;

-- plate_specs
ALTER TABLE public.plate_specs
  DROP CONSTRAINT IF EXISTS plate_specs_source_session_id_fkey;
ALTER TABLE public.plate_specs
  ADD CONSTRAINT plate_specs_source_session_id_fkey
    FOREIGN KEY (source_session_id)
    REFERENCES public.ingestion_sessions(id)
    ON DELETE SET NULL;

-- wines
ALTER TABLE public.wines
  DROP CONSTRAINT IF EXISTS wines_source_session_id_fkey;
ALTER TABLE public.wines
  ADD CONSTRAINT wines_source_session_id_fkey
    FOREIGN KEY (source_session_id)
    REFERENCES public.ingestion_sessions(id)
    ON DELETE SET NULL;

-- cocktails
ALTER TABLE public.cocktails
  DROP CONSTRAINT IF EXISTS cocktails_source_session_id_fkey;
ALTER TABLE public.cocktails
  ADD CONSTRAINT cocktails_source_session_id_fkey
    FOREIGN KEY (source_session_id)
    REFERENCES public.ingestion_sessions(id)
    ON DELETE SET NULL;

-- beer_liquor_list
ALTER TABLE public.beer_liquor_list
  DROP CONSTRAINT IF EXISTS beer_liquor_list_source_session_id_fkey;
ALTER TABLE public.beer_liquor_list
  ADD CONSTRAINT beer_liquor_list_source_session_id_fkey
    FOREIGN KEY (source_session_id)
    REFERENCES public.ingestion_sessions(id)
    ON DELETE SET NULL;
