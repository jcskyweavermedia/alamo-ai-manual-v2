-- Fix broken/wrong wine images with proper Unsplash replacements

-- Cloudy Bay Sauvignon Blanc - was 404
UPDATE wines SET image = 'https://images.unsplash.com/photo-1651665849313-91055ad02729?w=400&h=600&fit=crop'
WHERE slug = 'cloudy-bay-sauvignon-blanc-2023';

-- Veuve Clicquot - was wrong image (purple splash instead of champagne)
UPDATE wines SET image = 'https://images.unsplash.com/photo-1743184579851-5ec9972100b3?w=400&h=600&fit=crop'
WHERE slug = 'veuve-clicquot-yellow-label-brut-nv';
