-- Fix remaining foh_plate_specs slug collision missed by migration 20260304210000.
-- new-york-cheesecake was ingested after the bulk fix ran, so it never received the -foh suffix.

UPDATE public.foh_plate_specs
SET slug = 'new-york-cheesecake-foh'
WHERE slug = 'new-york-cheesecake';
