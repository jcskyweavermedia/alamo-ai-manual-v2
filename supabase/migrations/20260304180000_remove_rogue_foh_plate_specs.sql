-- Remove 6 rogue foh_plate_specs entries that have no BOH plate_spec link.
--
-- Root cause: Migration 20260304070000_fix_plate_spec_fk_and_orphans.sql
--   1. Deleted all foh_plate_specs rows where plate_spec_id IS NULL AND source_session_id IS NULL
--      (those rows had AI-generated images uploaded to product-assets storage)
--   2. Re-seeded 6 new foh_plate_specs rows for these same dishes, but WITHOUT setting
--      plate_spec_id, leaving them permanently unlinked from any BOH recipe.
--
-- None of these 6 dishes have a corresponding plate_specs (BOH kitchen recipe) entry.
-- They are visible on /dish-guide with broken images and no BOH data to link to.
--
-- After removal: 6 properly linked foh_plate_specs rows will remain (14oz Ribeye,
-- 8oz Filet Mignon, Classic Shrimp Cocktail, Iceberg Wedge Salad, Seared Steak Bites,
-- Truffle Mashed Potatoes).

DELETE FROM public.foh_plate_specs
WHERE id IN (
  '11100001-0000-4000-8000-000000000001',  -- 12 oz New York Strip (entree)
  '11100002-0000-4000-8000-000000000001',  -- 20 oz Bone-In Cowboy Cut (entree)
  '11100003-0000-4000-8000-000000000001',  -- 6 oz Petite Filet (entree)
  '11100004-0000-4000-8000-000000000001',  -- Creamed Spinach (side)
  'e595c67b-d3ac-4514-b21a-dc2769ce8a40', -- Chocolate Lava Cake (dessert)
  'de01aa31-89e1-4c60-82c5-30ef623b6f5c'  -- Pecan Pie (dessert)
);
