-- Seed Server 101 Training Courses and Sections
-- 7 courses covering all essential front-of-house training for new servers
-- Maps to existing content in manual_sections, foh_plate_specs, wines, cocktails, beer_liquor_list

DO $$
DECLARE
  v_group_id UUID;
  v_course_id UUID;
BEGIN
  -- Get the Alamo Prime group ID
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  -- =========================================================================
  -- COURSE 1: Culture & Standards
  -- =========================================================================
  INSERT INTO public.courses (group_id, slug, title_en, title_es, icon, sort_order, estimated_minutes, passing_score)
  VALUES (v_group_id, 'culture-standards', 'Culture & Standards', 'Cultura y Estándares', 'Landmark', 1, 20, 70)
  RETURNING id INTO v_course_id;

  INSERT INTO public.course_sections (course_id, group_id, slug, title_en, title_es, content_source, content_ids, sort_order, section_type, estimated_minutes)
  VALUES
    (v_course_id, v_group_id, 'welcome-philosophy', 'Welcome & Philosophy', 'Bienvenida y Filosofía',
     'manual_sections', ARRAY[(SELECT id FROM public.manual_sections WHERE slug = 'welcome-philosophy')],
     1, 'learn', 4),
    (v_course_id, v_group_id, 'core-values', 'Core Values', 'Valores Fundamentales',
     'manual_sections', ARRAY[(SELECT id FROM public.manual_sections WHERE slug = 'core-values')],
     2, 'learn', 5),
    (v_course_id, v_group_id, 'service-excellence', 'Service Excellence', 'Excelencia en el Servicio',
     'manual_sections', ARRAY[(SELECT id FROM public.manual_sections WHERE slug = 'service-excellence')],
     3, 'learn', 5),
    (v_course_id, v_group_id, 'brand-standards', 'Brand Standards', 'Estándares de Marca',
     'manual_sections', ARRAY[(SELECT id FROM public.manual_sections WHERE slug = 'brand-standards')],
     4, 'learn', 4),
    (v_course_id, v_group_id, 'culture-quiz', 'Culture Quiz', 'Cuestionario de Cultura',
     'custom', '{}'::uuid[],
     5, 'quiz', 2);

  -- =========================================================================
  -- COURSE 2: Entrees & Steaks
  -- =========================================================================
  INSERT INTO public.courses (group_id, slug, title_en, title_es, icon, sort_order, estimated_minutes, passing_score)
  VALUES (v_group_id, 'entrees-steaks', 'Entrees & Steaks', 'Platos Fuertes y Carnes', 'Beef', 2, 30, 70)
  RETURNING id INTO v_course_id;

  INSERT INTO public.course_sections (course_id, group_id, slug, title_en, title_es, content_source, content_ids, sort_order, section_type, estimated_minutes)
  VALUES
    (v_course_id, v_group_id, 'ribeye-16oz', '16oz Bone-In Ribeye', 'Ribeye 16oz con Hueso',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = '16oz-bone-in-ribeye')],
     1, 'learn', 5),
    (v_course_id, v_group_id, 'filet-mignon-8oz', '8oz Filet Mignon', 'Filet Mignon 8oz',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = '8oz-filet-mignon')],
     2, 'learn', 5),
    (v_course_id, v_group_id, 'chicken-fried-steak', 'Chicken Fried Steak', 'Bistec Empanizado',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'chicken-fried-steak')],
     3, 'learn', 4),
    (v_course_id, v_group_id, 'grilled-salmon', 'Grilled Atlantic Salmon', 'Salmón Atlántico a la Parrilla',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'grilled-atlantic-salmon')],
     4, 'learn', 4),
    (v_course_id, v_group_id, 'entree-mods-allergens', 'Mods & Allergens', 'Modificaciones y Alergias',
     'custom', '{}'::uuid[],
     5, 'learn', 5),
    (v_course_id, v_group_id, 'steak-temp-guide', 'Steak Temperatures Guide', 'Guía de Temperaturas',
     'custom', '{}'::uuid[],
     6, 'learn', 4),
    (v_course_id, v_group_id, 'entree-practice', 'Practice: Describe to Guest', 'Práctica: Describir al Cliente',
     'custom', '{}'::uuid[],
     7, 'practice', 3);

  -- =========================================================================
  -- COURSE 3: Appetizers & Sides
  -- =========================================================================
  INSERT INTO public.courses (group_id, slug, title_en, title_es, icon, sort_order, estimated_minutes, passing_score)
  VALUES (v_group_id, 'appetizers-sides', 'Appetizers & Sides', 'Aperitivos y Guarniciones', 'UtensilsCrossed', 3, 20, 70)
  RETURNING id INTO v_course_id;

  INSERT INTO public.course_sections (course_id, group_id, slug, title_en, title_es, content_source, content_ids, sort_order, section_type, estimated_minutes)
  VALUES
    (v_course_id, v_group_id, 'loaded-queso', 'Loaded Queso', 'Queso Cargado',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'loaded-queso')],
     1, 'learn', 4),
    (v_course_id, v_group_id, 'shrimp-cocktail', 'Jumbo Shrimp Cocktail', 'Cóctel de Camarón Jumbo',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'jumbo-shrimp-cocktail')],
     2, 'learn', 4),
    (v_course_id, v_group_id, 'brussels-sprouts', 'Crispy Brussels Sprouts', 'Coles de Bruselas Crujientes',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'crispy-brussels-sprouts')],
     3, 'learn', 3),
    (v_course_id, v_group_id, 'sides-overview', 'Signature Sides', 'Guarniciones Especiales',
     'foh_plate_specs', ARRAY[
       (SELECT id FROM public.foh_plate_specs WHERE slug = 'loaded-baked-potato'),
       (SELECT id FROM public.foh_plate_specs WHERE slug = 'creamed-spinach-dish'),
       (SELECT id FROM public.foh_plate_specs WHERE slug = 'mac-and-cheese')
     ],
     4, 'learn', 6),
    (v_course_id, v_group_id, 'apps-sides-practice', 'Practice: Upselling Sides', 'Práctica: Venta Sugestiva',
     'custom', '{}'::uuid[],
     5, 'practice', 3);

  -- =========================================================================
  -- COURSE 4: Wine Program
  -- =========================================================================
  INSERT INTO public.courses (group_id, slug, title_en, title_es, icon, sort_order, estimated_minutes, passing_score)
  VALUES (v_group_id, 'wine-program', 'Wine Program', 'Programa de Vinos', 'Wine', 4, 25, 70)
  RETURNING id INTO v_course_id;

  INSERT INTO public.course_sections (course_id, group_id, slug, title_en, title_es, content_source, content_ids, sort_order, section_type, estimated_minutes)
  VALUES
    (v_course_id, v_group_id, 'wine-service-basics', 'Wine Service Basics', 'Fundamentos del Servicio de Vino',
     'custom', '{}'::uuid[],
     1, 'learn', 4),
    (v_course_id, v_group_id, 'veuve-clicquot', 'Veuve Clicquot Yellow Label Brut', 'Veuve Clicquot Yellow Label Brut',
     'wines', ARRAY[(SELECT id FROM public.wines WHERE slug = 'veuve-clicquot-yellow-label-brut-nv')],
     2, 'learn', 4),
    (v_course_id, v_group_id, 'cloudy-bay', 'Cloudy Bay Sauvignon Blanc', 'Cloudy Bay Sauvignon Blanc',
     'wines', ARRAY[(SELECT id FROM public.wines WHERE slug = 'cloudy-bay-sauvignon-blanc-2023')],
     3, 'learn', 4),
    (v_course_id, v_group_id, 'whispering-angel', 'Whispering Angel Rosé', 'Whispering Angel Rosé',
     'wines', ARRAY[(SELECT id FROM public.wines WHERE slug = 'whispering-angel-rose-2023')],
     4, 'learn', 3),
    (v_course_id, v_group_id, 'erath-pinot', 'Erath Pinot Noir', 'Erath Pinot Noir',
     'wines', ARRAY[(SELECT id FROM public.wines WHERE slug = 'erath-pinot-noir-2021')],
     5, 'learn', 4),
    (v_course_id, v_group_id, 'chateau-margaux', 'Château Margaux 2018', 'Château Margaux 2018',
     'wines', ARRAY[(SELECT id FROM public.wines WHERE slug = 'chateau-margaux-2018')],
     6, 'learn', 3),
    (v_course_id, v_group_id, 'wine-pairing-practice', 'Practice: Wine Pairing Pitch', 'Práctica: Sugerencia de Maridaje',
     'custom', '{}'::uuid[],
     7, 'practice', 3);

  -- =========================================================================
  -- COURSE 5: Cocktails & Bar
  -- =========================================================================
  INSERT INTO public.courses (group_id, slug, title_en, title_es, icon, sort_order, estimated_minutes, passing_score)
  VALUES (v_group_id, 'cocktails-bar', 'Cocktails & Bar', 'Cócteles y Bar', 'Martini', 5, 20, 70)
  RETURNING id INTO v_course_id;

  INSERT INTO public.course_sections (course_id, group_id, slug, title_en, title_es, content_source, content_ids, sort_order, section_type, estimated_minutes)
  VALUES
    (v_course_id, v_group_id, 'old-fashioned', 'Old Fashioned', 'Old Fashioned',
     'cocktails', ARRAY[(SELECT id FROM public.cocktails WHERE slug = 'old-fashioned')],
     1, 'learn', 4),
    (v_course_id, v_group_id, 'espresso-martini', 'Espresso Martini', 'Espresso Martini',
     'cocktails', ARRAY[(SELECT id FROM public.cocktails WHERE slug = 'espresso-martini')],
     2, 'learn', 4),
    (v_course_id, v_group_id, 'paloma', 'Paloma', 'Paloma',
     'cocktails', ARRAY[(SELECT id FROM public.cocktails WHERE slug = 'paloma')],
     3, 'learn', 3),
    (v_course_id, v_group_id, 'penicillin', 'Penicillin', 'Penicillin',
     'cocktails', ARRAY[(SELECT id FROM public.cocktails WHERE slug = 'penicillin')],
     4, 'learn', 4),
    (v_course_id, v_group_id, 'mai-tai', 'Mai Tai', 'Mai Tai',
     'cocktails', ARRAY[(SELECT id FROM public.cocktails WHERE slug = 'mai-tai')],
     5, 'learn', 3),
    (v_course_id, v_group_id, 'cocktail-practice', 'Practice: Describe Cocktails', 'Práctica: Describir Cócteles',
     'custom', '{}'::uuid[],
     6, 'practice', 2);

  -- =========================================================================
  -- COURSE 6: Beer & Liquor
  -- =========================================================================
  INSERT INTO public.courses (group_id, slug, title_en, title_es, icon, sort_order, estimated_minutes, passing_score)
  VALUES (v_group_id, 'beer-liquor', 'Beer & Liquor', 'Cerveza y Licores', 'Beer', 6, 15, 70)
  RETURNING id INTO v_course_id;

  INSERT INTO public.course_sections (course_id, group_id, slug, title_en, title_es, content_source, content_ids, sort_order, section_type, estimated_minutes)
  VALUES
    (v_course_id, v_group_id, 'texas-beers', 'Texas & Regional Beers', 'Cervezas de Texas y Regionales',
     'beer_liquor_list', ARRAY[
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'lone-star'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'shiner-bock'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'firemans-4')
     ],
     1, 'learn', 4),
    (v_course_id, v_group_id, 'craft-beers', 'Craft & Specialty Beers', 'Cervezas Artesanales y Especiales',
     'beer_liquor_list', ARRAY[
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'modelo-especial'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'dos-equis-amber'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'blue-moon'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'guinness-draught')
     ],
     2, 'learn', 4),
    (v_course_id, v_group_id, 'premium-spirits', 'Premium Spirits Collection', 'Colección de Licores Premium',
     'beer_liquor_list', ARRAY[
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'woodford-reserve'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'bulleit-bourbon'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'patron-silver'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'casamigos-blanco'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'macallan-12'),
       (SELECT id FROM public.beer_liquor_list WHERE slug = 'hendricks')
     ],
     3, 'learn', 5),
    (v_course_id, v_group_id, 'beer-liquor-practice', 'Practice: Bar Recommendations', 'Práctica: Recomendaciones de Bar',
     'custom', '{}'::uuid[],
     4, 'practice', 2);

  -- =========================================================================
  -- COURSE 7: Desserts & After-Dinner
  -- =========================================================================
  INSERT INTO public.courses (group_id, slug, title_en, title_es, icon, sort_order, estimated_minutes, passing_score)
  VALUES (v_group_id, 'desserts-after-dinner', 'Desserts & After-Dinner', 'Postres y Sobremesa', 'CakeSlice', 7, 10, 70)
  RETURNING id INTO v_course_id;

  INSERT INTO public.course_sections (course_id, group_id, slug, title_en, title_es, content_source, content_ids, sort_order, section_type, estimated_minutes)
  VALUES
    (v_course_id, v_group_id, 'chocolate-lava-cake', 'Chocolate Lava Cake', 'Pastel de Lava de Chocolate',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'chocolate-lava-cake')],
     1, 'learn', 3),
    (v_course_id, v_group_id, 'pecan-pie', 'Pecan Pie', 'Pay de Nuez',
     'foh_plate_specs', ARRAY[(SELECT id FROM public.foh_plate_specs WHERE slug = 'pecan-pie')],
     2, 'learn', 3),
    (v_course_id, v_group_id, 'after-dinner-service', 'After-Dinner Service', 'Servicio de Sobremesa',
     'custom', '{}'::uuid[],
     3, 'learn', 4);

END $$;
