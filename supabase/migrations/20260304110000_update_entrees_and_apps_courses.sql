-- =============================================================================
-- Update "Entrees & Steaks" and "Appetizers & Sides" course sections
-- to match the new simplified steakhouse menu.
--
-- New menu:
--   Entrees: 14oz Bone-In Ribeye, 8oz Filet Mignon, 12oz NY Strip,
--            20oz Bone-In Cowboy Cut, 6oz Petite Filet
--   Apps:    Classic Shrimp Cocktail, Iceberg Wedge Salad, Seared Steak Bites
--   Sides:   Truffle Mashed Potatoes, Creamed Spinach
--
-- Items that exist in foh_plate_specs are linked directly.
-- Items that don't exist yet use content_source = 'custom'.
-- =============================================================================

DO $$
DECLARE
  v_group_id     UUID;
  v_course_id    UUID;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  -- =========================================================================
  -- COURSE 2: Entrees & Steaks — replace sections
  -- =========================================================================
  SELECT id INTO v_course_id FROM public.courses
    WHERE slug = 'entrees-steaks' AND group_id = v_group_id;

  -- Delete old section progress for these sections
  DELETE FROM public.section_progress
    WHERE section_id IN (
      SELECT id FROM public.course_sections WHERE course_id = v_course_id
    );

  -- Delete old sections
  DELETE FROM public.course_sections WHERE course_id = v_course_id;

  -- Insert new sections matching the simplified menu
  INSERT INTO public.course_sections (
    course_id, group_id, slug, title_en, title_es,
    content_source, content_ids,
    sort_order, section_type, estimated_minutes, status
  ) VALUES
    -- 1. 14oz Bone-In Ribeye (use existing 16oz FOH spec — closest match)
    (v_course_id, v_group_id, 'bone-in-ribeye', '14oz Bone-In Ribeye', 'Ribeye 14oz con Hueso',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = '16oz-bone-in-ribeye')],
     1, 'learn', 4, 'published'),

    -- 2. 8oz Filet Mignon (exact match in DB)
    (v_course_id, v_group_id, 'filet-mignon', '8oz Filet Mignon', 'Filet Mignon 8oz',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = '8oz-filet-mignon')],
     2, 'learn', 4, 'published'),

    -- 3. 12oz New York Strip (not in DB yet — custom)
    (v_course_id, v_group_id, 'ny-strip', '12oz New York Strip', 'New York Strip 12oz',
     'custom', '{}'::uuid[],
     3, 'learn', 4, 'published'),

    -- 4. 20oz Bone-In Cowboy Cut (not in DB yet — custom)
    (v_course_id, v_group_id, 'cowboy-cut', '20oz Bone-In Cowboy Cut', 'Cowboy Cut 20oz con Hueso',
     'custom', '{}'::uuid[],
     4, 'learn', 4, 'published'),

    -- 5. 6oz Petite Filet (not in DB yet — custom)
    (v_course_id, v_group_id, 'petite-filet', '6oz Petite Filet', 'Petite Filet 6oz',
     'custom', '{}'::uuid[],
     5, 'learn', 3, 'published'),

    -- 6. Steak Temperatures Guide (custom — kept from original)
    (v_course_id, v_group_id, 'steak-temp-guide', 'Steak Temperatures Guide', 'Guía de Temperaturas',
     'custom', '{}'::uuid[],
     6, 'learn', 4, 'published'),

    -- 7. Practice: Describe to Guest (custom — kept from original)
    (v_course_id, v_group_id, 'entree-practice', 'Practice: Describe to Guest', 'Práctica: Describir al Cliente',
     'custom', '{}'::uuid[],
     7, 'practice', 3, 'published');

  -- Update course estimated time (7 sections × ~4 min avg = 26, round to 25)
  UPDATE public.courses
    SET estimated_minutes = 25
    WHERE id = v_course_id;

  -- =========================================================================
  -- COURSE 3: Appetizers & Sides — replace sections
  -- =========================================================================
  SELECT id INTO v_course_id FROM public.courses
    WHERE slug = 'appetizers-sides' AND group_id = v_group_id;

  -- Delete old section progress
  DELETE FROM public.section_progress
    WHERE section_id IN (
      SELECT id FROM public.course_sections WHERE course_id = v_course_id
    );

  -- Delete old sections
  DELETE FROM public.course_sections WHERE course_id = v_course_id;

  -- Insert new sections matching the simplified menu
  INSERT INTO public.course_sections (
    course_id, group_id, slug, title_en, title_es,
    content_source, content_ids,
    sort_order, section_type, estimated_minutes, status
  ) VALUES
    -- 1. Classic Shrimp Cocktail (exact match in DB)
    (v_course_id, v_group_id, 'shrimp-cocktail', 'Classic Shrimp Cocktail', 'Cóctel de Camarones Clásico',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'jumbo-shrimp-cocktail')],
     1, 'learn', 4, 'published'),

    -- 2. Iceberg Wedge Salad (not in DB yet — custom)
    (v_course_id, v_group_id, 'wedge-salad', 'Iceberg Wedge Salad', 'Ensalada Wedge de Iceberg',
     'custom', '{}'::uuid[],
     2, 'learn', 3, 'published'),

    -- 3. Seared Steak Bites (not in DB yet — custom)
    (v_course_id, v_group_id, 'steak-bites', 'Seared Steak Bites', 'Bocados de Filete Sellados',
     'custom', '{}'::uuid[],
     3, 'learn', 3, 'published'),

    -- 4. Truffle Mashed Potatoes (not in DB yet — custom)
    (v_course_id, v_group_id, 'truffle-mashed', 'Truffle Mashed Potatoes', 'Puré de Papa con Trufa',
     'custom', '{}'::uuid[],
     4, 'learn', 3, 'published'),

    -- 5. Creamed Spinach (exact match in DB)
    (v_course_id, v_group_id, 'creamed-spinach', 'Creamed Spinach', 'Espinacas a la Crema',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'creamed-spinach-dish')],
     5, 'learn', 3, 'published'),

    -- 6. Practice: Upselling Sides (custom — kept from original)
    (v_course_id, v_group_id, 'apps-sides-practice', 'Practice: Upselling Sides', 'Práctica: Venta Sugestiva',
     'custom', '{}'::uuid[],
     6, 'practice', 3, 'published');

  -- Update course estimated time (6 sections × ~3 min avg = 19, round to 20)
  UPDATE public.courses
    SET estimated_minutes = 20
    WHERE id = v_course_id;

END $$;
