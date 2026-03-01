-- S01: Seed 5 tracked restaurants (2 own + 3 competitors) with deterministic UUIDs
-- All Texas-based steakhouses for the alamo-prime group

DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- 1. Alamo Prime Steakhouse (own, primary unit)
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '11111111-1111-1111-1111-111111111111',
    v_group_id,
    'Alamo Prime Steakhouse',
    'alamo-prime-austin',
    'own',
    'ChIJ_____fake_google_id_01',
    'https://www.google.com/maps/place/Alamo+Prime+Steakhouse',
    'https://www.opentable.com/r/alamo-prime-steakhouse-austin',
    'https://www.tripadvisor.com/Restaurant_Review-Alamo_Prime_Steakhouse',
    '412 Congress Ave', 'Austin', 'TX', '78701',
    30.2672000, -97.7431000,
    NULL,  -- own restaurant: no parent
    true, 'daily', 'active'
  );

  -- 2. Longhorn & Ember (competitor of Alamo Prime Austin)
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '22222222-2222-2222-2222-222222222222',
    v_group_id,
    'Longhorn & Ember',
    'longhorn-ember',
    'competitor',
    'ChIJ_____fake_google_id_02',
    'https://www.google.com/maps/place/Longhorn+Ember',
    'https://www.opentable.com/r/longhorn-ember-austin',
    'https://www.tripadvisor.com/Restaurant_Review-Longhorn_Ember',
    '815 W 6th St', 'Austin', 'TX', '78703',
    30.2715000, -97.7530000,
    '11111111-1111-1111-1111-111111111111',  -- parent = Alamo Prime Austin
    true, 'daily', 'active'
  );

  -- 3. Salt & Sear Chophouse (competitor of Alamo Prime Austin)
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '33333333-3333-3333-3333-333333333333',
    v_group_id,
    'Salt & Sear Chophouse',
    'salt-sear-chophouse',
    'competitor',
    'ChIJ_____fake_google_id_03',
    'https://www.google.com/maps/place/Salt+Sear+Chophouse',
    'https://www.opentable.com/r/salt-sear-chophouse-austin',
    'https://www.tripadvisor.com/Restaurant_Review-Salt_Sear_Chophouse',
    '301 Lavaca St', 'Austin', 'TX', '78701',
    30.2660000, -97.7450000,
    '11111111-1111-1111-1111-111111111111',
    true, 'daily', 'active'
  );

  -- 4. Mesquite Flame Grill (competitor — NO OpenTable, tests platform gap)
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '44444444-4444-4444-4444-444444444444',
    v_group_id,
    'Mesquite Flame Grill',
    'mesquite-flame-grill',
    'competitor',
    'ChIJ_____fake_google_id_04',
    'https://www.google.com/maps/place/Mesquite+Flame+Grill',
    NULL,  -- NO OpenTable
    'https://www.tripadvisor.com/Restaurant_Review-Mesquite_Flame_Grill',
    '1100 S Lamar Blvd', 'Austin', 'TX', '78704',
    30.2530000, -97.7640000,
    '11111111-1111-1111-1111-111111111111',
    true, 'daily', 'active'
  );

  -- 5. Alamo Prime - Westside (own, EMPTY STATE for onboarding testing)
  INSERT INTO public.tracked_restaurants (
    id, group_id, name, slug, restaurant_type,
    google_place_id, google_place_url, opentable_url, tripadvisor_url,
    address, city, state, zip, latitude, longitude,
    parent_unit_id, scrape_enabled, scrape_frequency, status
  ) VALUES (
    '55555555-5555-5555-5555-555555555555',
    v_group_id,
    'Alamo Prime - Westside',
    'alamo-prime-westside',
    'own',
    NULL, NULL, NULL, NULL,  -- no platform URLs configured
    '4700 W Gate Blvd', 'Austin', 'TX', '78745',
    30.2290000, -97.8010000,
    NULL,  -- own restaurant: no parent
    false, 'daily', 'active'
  );

END $$;
