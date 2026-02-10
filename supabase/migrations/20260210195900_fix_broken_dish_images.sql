-- Fix broken dish images (404 URLs) with working Unsplash replacements

UPDATE foh_plate_specs SET image = 'https://images.unsplash.com/photo-1637808248215-7d885aefa1f1?w=400&h=250&fit=crop'
WHERE slug = 'crispy-brussels-sprouts';

UPDATE foh_plate_specs SET image = 'https://images.unsplash.com/photo-1614947153104-e46b2b7e36fa?w=400&h=250&fit=crop'
WHERE slug = 'creamed-spinach-dish';
