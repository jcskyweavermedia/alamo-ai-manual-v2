-- Delete rogue cocktails and wines that have no images and are not fully built out.
-- These entries were seeded without linked ingestion sessions and have null images.

-- Cocktails: Mai Tai, Paloma
DELETE FROM public.cocktails
WHERE id IN (
  'e8e60426-a5b9-4e52-aacc-578f984a57a6',  -- Mai Tai
  '218a3ccc-d7ac-4be5-8a77-320bf41e2bec'   -- Paloma
);

-- Wines: Château Margaux 2018, Erath Pinot Noir
DELETE FROM public.wines
WHERE id IN (
  '76caab11-af5a-4694-8045-e27fce4792b7',  -- Château Margaux 2018
  '9149cc7b-2f81-47a8-8d79-4344ad294f32'   -- Erath Pinot Noir
);
