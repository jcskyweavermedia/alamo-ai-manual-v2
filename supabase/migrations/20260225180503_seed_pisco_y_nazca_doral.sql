-- Seed Pisco y Nazca Ceviche Gastrobar (Doral) for ingestion pipeline testing
-- Real restaurant with real platform URLs for Apify actor integration

DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '66666666-6666-6666-6666-666666666666',
    v_group_id,
    'Pisco y Nazca Ceviche Gastrobar - Doral',
    'pisco-y-nazca-doral',
    'own',
    'ChIJK3vOQMW02YgRtMKCHL4MjCo',
    'https://www.google.com/maps/place/Pisco+y+Nazca+Ceviche+Gastrobar/@25.7946028,-80.3574889',
    'https://www.opentable.com/r/pisco-y-nazca-ceviche-gastrobar-doral',
    'https://www.tripadvisor.com/Restaurant_Review-g680222-d10531346-Reviews-Pisco_y_Nazca_Ceviche_Gastrobar-Doral_Florida.html',
    '8551 NW 53rd St', 'Doral', 'FL', '33166',
    25.7946028, -80.3574889,
    NULL,  -- own restaurant: no parent
    true, 'daily', 'active'
  )
  ON CONFLICT (id) DO NOTHING;

END $$;
