-- Fix mango mojito syrup: was saved with department='kitchen' due to edge function default bug
UPDATE prep_recipes
SET department = 'bar'
WHERE name ILIKE '%mango mojito%'
  AND department = 'kitchen';
