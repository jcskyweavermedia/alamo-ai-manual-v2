-- Rename "Demo Restaurant" group to "Alamo Prime"
UPDATE public.groups
SET name = 'Alamo Prime',
    slug = 'alamo-prime',
    description = 'Alamo Prime Steakhouse'
WHERE id = '00000000-0000-0000-0000-000000000001';
