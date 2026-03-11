-- Fix FOH plate specs: replace BOH codes, equipment, and overly technical
-- ingredient names with clean, guest-facing language.
-- Affected: all 5 published dishes (2 entrees + 3 appetizers).

-- 14 oz Bone-In Ribeye
UPDATE public.foh_plate_specs
SET
  key_ingredients = ARRAY['14 oz bone-in ribeye', 'house steak seasoning', 'herb compound butter'],
  ingredients     = ARRAY['fresh herbs', 'sea salt', 'cracked black pepper', 'high-heat sear finish']
WHERE id = 'bdafcf2a-68b6-439c-8195-7bcf4883ada4';

-- 8 oz Filet Mignon — Herb Butter Finish
UPDATE public.foh_plate_specs
SET
  key_ingredients = ARRAY['center-cut filet mignon', 'house steak seasoning', 'herb compound butter'],
  ingredients     = ARRAY['8 oz USDA Prime cut', 'fresh herbs', 'sea salt', 'cracked black pepper']
WHERE id = '77e35304-9a88-4c8f-a72e-972565c610e9';

-- Classic Shrimp Cocktail
UPDATE public.foh_plate_specs
SET
  key_ingredients = ARRAY['jumbo shrimp', 'cocktail sauce', 'fresh lemon'],
  ingredients     = ARRAY['U-10 colossal shrimp', 'house cocktail sauce', 'lemon wedge', 'crushed ice']
WHERE id = '037bc67b-8e5d-46e8-bde1-86dadb307923';

-- Iceberg Wedge Salad
UPDATE public.foh_plate_specs
SET
  key_ingredients = ARRAY['iceberg lettuce wedge', 'blue cheese dressing', 'applewood-smoked bacon'],
  ingredients     = ARRAY['blue cheese crumbles', 'grape tomatoes', 'fresh cracked black pepper']
WHERE id = '5589a035-727b-4b15-bbdf-9d97728e82a1';

-- Seared Steak Bites
UPDATE public.foh_plate_specs
SET
  key_ingredients = ARRAY['beef tenderloin bites', 'house steak seasoning', 'herb compound butter'],
  ingredients     = ARRAY['seared tenderloin cubes', 'fresh herb butter finish', 'sea salt', 'cracked black pepper']
WHERE id = 'b233e4ca-30aa-4982-a3d1-1ddeb93290a5';
