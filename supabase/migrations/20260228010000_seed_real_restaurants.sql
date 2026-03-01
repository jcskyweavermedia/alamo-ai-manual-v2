-- Phase 5b.1: Replace fake seed restaurants with real Coral Gables steakhouses.
-- Strategy: UPDATE in place (preserves deterministic UUIDs, no FK cascade risk).
-- Then DELETE stale synthetic data from dependent tables.
-- Pisco y Nazca (66666666) is untouched — it has 25 real analyzed reviews.

-- ─── Step 1: Add display_name column ────────────────────────────────────────

ALTER TABLE public.tracked_restaurants
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.tracked_restaurants.display_name IS
  'Short label for charts and rankings UI (e.g., "Fleming''s CG"). Falls back to name if NULL.';

-- ─── Step 2: Update fake restaurants to real ones ───────────────────────────

DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- ── 1. Alamo Prime Steakhouse → Fleming's Prime Steakhouse (OWN) ──────────

  UPDATE public.tracked_restaurants SET
    name            = 'Fleming''s Prime Steakhouse & Wine Bar - Coral Gables',
    display_name    = 'Fleming''s CG',
    slug            = 'flemings-coral-gables',
    google_place_id = NULL,
    google_place_url = 'https://www.google.com/maps/search/Fleming''s+Prime+Steakhouse+%26+Wine+Bar+Coral+Gables',
    opentable_url   = 'https://www.opentable.com/flemings-steakhouse-coral-gables',
    tripadvisor_url = 'https://www.tripadvisor.com/Restaurant_Review-g34152-d630151-Reviews-Fleming_s_Prime_Steakhouse_Wine_Bar-Coral_Gables_Florida.html',
    address         = '2525 Ponce de Leon Blvd',
    city            = 'Coral Gables',
    state           = 'FL',
    zip             = '33134',
    latitude        = 25.7539000,
    longitude       = -80.2597000,
    scrape_enabled  = true,
    scrape_frequency = 'daily'
  WHERE id = '11111111-1111-1111-1111-111111111111'
    AND group_id = v_group_id;

  -- ── 2. Longhorn & Ember → Ruth's Chris Steak House (COMPETITOR) ───────────

  UPDATE public.tracked_restaurants SET
    name            = 'Ruth''s Chris Steak House - Coral Gables',
    display_name    = 'Ruth''s Chris CG',
    slug            = 'ruths-chris-coral-gables',
    google_place_id = NULL,
    google_place_url = 'https://www.google.com/maps/search/Ruth''s+Chris+Steak+House+Coral+Gables',
    opentable_url   = 'https://www.opentable.com/ruths-chris-steak-house-coral-gables',
    tripadvisor_url = 'https://www.tripadvisor.com/Restaurant_Review-g34152-d465672-Reviews-Ruth_s_Chris_Steak_House-Coral_Gables_Florida.html',
    address         = '2320 Salzedo St',
    city            = 'Coral Gables',
    state           = 'FL',
    zip             = '33134',
    latitude        = 25.7523000,
    longitude       = -80.2588000,
    scrape_enabled  = true,
    scrape_frequency = 'daily'
  WHERE id = '22222222-2222-2222-2222-222222222222'
    AND group_id = v_group_id;

  -- ── 3. Salt & Sear Chophouse → Morton's The Steakhouse (COMPETITOR) ───────

  UPDATE public.tracked_restaurants SET
    name            = 'Morton''s The Steakhouse - Coral Gables',
    display_name    = 'Morton''s CG',
    slug            = 'mortons-coral-gables',
    google_place_id = NULL,
    google_place_url = 'https://www.google.com/maps?cid=16619843955183395755',
    opentable_url   = 'https://www.opentable.com/r/mortons-the-steakhouse-coral-gables',
    tripadvisor_url = 'https://www.tripadvisor.com/Restaurant_Review-g34152-d1367643-Reviews-Morton_s_The_Steakhouse-Coral_Gables_Florida.html',
    address         = '2333 Ponce de Leon Blvd',
    city            = 'Coral Gables',
    state           = 'FL',
    zip             = '33134',
    latitude        = 25.7542000,
    longitude       = -80.2601000,
    scrape_enabled  = true,
    scrape_frequency = 'daily'
  WHERE id = '33333333-3333-3333-3333-333333333333'
    AND group_id = v_group_id;

  -- ── 4. Mesquite Flame Grill → Perry's Steakhouse & Grille (COMPETITOR) ────

  UPDATE public.tracked_restaurants SET
    name            = 'Perry''s Steakhouse & Grille - Coral Gables',
    display_name    = 'Perry''s CG',
    slug            = 'perrys-coral-gables',
    google_place_id = NULL,
    google_place_url = 'https://www.google.com/maps/search/Perry''s+Steakhouse+%26+Grille+Coral+Gables',
    opentable_url   = 'https://www.opentable.com/r/perrys-steakhouse-and-grille-coral-gables',
    tripadvisor_url = 'https://www.tripadvisor.com/Restaurant_Review-g34152-d18926656-Reviews-Perry_s_Steakhouse_Grille_Coral_Gables-Coral_Gables_Florida.html',
    address         = '4251 Salzedo St, Suite 1325',
    city            = 'Coral Gables',
    state           = 'FL',
    zip             = '33146',
    latitude        = 25.7440000,
    longitude       = -80.2588000,
    scrape_enabled  = true,
    scrape_frequency = 'daily'
  WHERE id = '44444444-4444-4444-4444-444444444444'
    AND group_id = v_group_id;

  -- ── 5. Alamo Prime Westside → The Capital Grille (COMPETITOR) ─────────────
  --    Change from own → competitor, link to Fleming's as parent.

  UPDATE public.tracked_restaurants SET
    name            = 'The Capital Grille - Miami',
    display_name    = 'Capital Grille',
    slug            = 'capital-grille-miami',
    restaurant_type = 'competitor',
    parent_unit_id  = '11111111-1111-1111-1111-111111111111',
    google_place_id = NULL,
    google_place_url = 'https://www.google.com/maps?cid=4555286816474833606',
    opentable_url   = 'https://www.opentable.com/the-capital-grille-miami',
    tripadvisor_url = 'https://www.tripadvisor.com/Restaurant_Review-g34438-d431875-Reviews-The_Capital_Grille-Miami_Florida.html',
    address         = '444 Brickell Ave',
    city            = 'Miami',
    state           = 'FL',
    zip             = '33131',
    latitude        = 25.7672000,
    longitude       = -80.1896000,
    scrape_enabled  = true,
    scrape_frequency = 'daily'
  WHERE id = '55555555-5555-5555-5555-555555555555'
    AND group_id = v_group_id;

END $$;

-- ─── Step 3: Clean synthetic review data ────────────────────────────────────
-- Seed reviews have platform_review_id like 'seed-*'. Real reviews from Apify
-- have actual platform IDs. Cascade deletes review_analyses via ON DELETE CASCADE.

DELETE FROM public.restaurant_reviews
WHERE platform_review_id LIKE 'seed-%';

-- ─── Step 4: Wipe stale rollups for updated restaurants ─────────────────────
-- These were computed from synthetic data and are now invalid.
-- Real rollups will be recomputed after Apify scrapes populate real reviews.

DELETE FROM public.flavor_index_daily
WHERE restaurant_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

DELETE FROM public.review_intelligence
WHERE restaurant_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

DELETE FROM public.scrape_runs
WHERE restaurant_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

-- ─── Step 5: Set display_name for Pisco y Nazca ─────────────────────────────

UPDATE public.tracked_restaurants
SET display_name = 'Pisco y Nazca'
WHERE id = '66666666-6666-6666-6666-666666666666';
