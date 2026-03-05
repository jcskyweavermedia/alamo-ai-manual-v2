-- Fix all cross-table slug collisions before the global uniqueness trigger is installed.
--
-- Current collisions (all between plate_specs and foh_plate_specs — same dish, BOH vs FOH view):
--   14-oz-bone-in-ribeye, 8-oz-filet-mignon-herb-butter-finish, classic-shrimp-cocktail,
--   creamed-spinach, iceberg-wedge-salad-2, seared-steak-bites, truffle-mashed-potatoes
--
-- Convention: foh_plate_specs gets the "-foh" suffix. The plate_specs (BOH kitchen) slug stays
-- canonical. The link between the two tables is via plate_spec_id (UUID FK), not slug, so
-- renaming foh_plate_specs slugs does not break the BOH/FOH relationship.
--
-- Note: any bookmarks (pinned items) stored under the old FOH slugs will stop matching
-- after this migration. In production this should be paired with a bookmark slug migration.

UPDATE public.foh_plate_specs
SET slug = slug || '-foh'
WHERE slug IN (
  '14-oz-bone-in-ribeye',
  '8-oz-filet-mignon-herb-butter-finish',
  'classic-shrimp-cocktail',
  'creamed-spinach',
  'iceberg-wedge-salad-2',
  'seared-steak-bites',
  'truffle-mashed-potatoes'
);

-- Also fix any prep_recipes / plate_specs collision on creamed-spinach if both exist.
-- Prep recipe gets the "-prep" suffix to keep plate_spec slug canonical.
UPDATE public.prep_recipes
SET slug = 'creamed-spinach-prep'
WHERE slug = 'creamed-spinach'
  AND EXISTS (SELECT 1 FROM public.plate_specs WHERE slug = 'creamed-spinach');
