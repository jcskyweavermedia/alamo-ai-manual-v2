-- Replace placeholder picsum images with real Unsplash food photography

-- Prep Recipes
UPDATE prep_recipes SET images = '["https://images.unsplash.com/photo-1733176552053-949b0b045a49?w=800&h=600&fit=crop&q=80"]'::jsonb
WHERE slug = 'chimichurri';

UPDATE prep_recipes SET images = '["https://images.unsplash.com/photo-1708773703160-26986855e311?w=800&h=600&fit=crop&q=80"]'::jsonb
WHERE slug = 'creamed-spinach';

UPDATE prep_recipes SET images = '["https://images.unsplash.com/photo-1736826311329-3fba6767bc46?w=800&h=600&fit=crop&q=80"]'::jsonb
WHERE slug = 'herb-compound-butter';

UPDATE prep_recipes SET images = '["https://images.unsplash.com/photo-1726514730465-1cc25083bba2?w=800&h=600&fit=crop&q=80"]'::jsonb
WHERE slug = 'red-wine-demi-glace';

-- Plate Specs
UPDATE plate_specs SET images = '["https://images.unsplash.com/photo-1654879259483-af42804bd2bb?w=800&h=600&fit=crop&q=80"]'::jsonb
WHERE slug = 'bone-in-ribeye';

UPDATE plate_specs SET images = '["https://images.unsplash.com/photo-1732763897987-ce7e63a94d7c?w=800&h=600&fit=crop&q=80"]'::jsonb
WHERE slug = 'skirt-steak-chimichurri';

UPDATE plate_specs SET images = '["https://images.unsplash.com/photo-1746211108786-ca20c8f80ecd?w=800&h=600&fit=crop&q=80"]'::jsonb
WHERE slug = 'steakhouse-wedge-salad';
