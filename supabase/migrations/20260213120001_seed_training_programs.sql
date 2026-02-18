-- =============================================================================
-- MIGRATION: seed_training_programs
-- Seeds 6 training programs (1 published + 5 coming_soon) and links
-- existing 7 courses to the "Server 101" program.
-- =============================================================================

DO $$
DECLARE
  v_group_id UUID;
  v_program_id UUID;
BEGIN
  -- Get Alamo Prime group
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Group alamo-prime not found';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 1. Server 101 (published — has 7 existing courses)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.training_programs (
    group_id, slug, title_en, title_es, description_en, description_es,
    cover_image, category, icon, sort_order, estimated_minutes, passing_score, status
  ) VALUES (
    v_group_id,
    'server-101',
    'Server 101',
    'Mesero 101',
    'Complete foundation training for new servers. Covers culture, menu knowledge, wine & cocktail basics, and guest interaction skills.',
    'Capacitación fundamental completa para nuevos meseros. Cubre cultura, conocimiento del menú, vinos y cócteles básicos, y habilidades de atención al cliente.',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    'fundamentals',
    'GraduationCap',
    1,
    140,
    70,
    'published'
  ) RETURNING id INTO v_program_id;

  -- Link all 7 existing courses to Server 101
  UPDATE public.courses
  SET program_id = v_program_id
  WHERE group_id = v_group_id
    AND slug IN (
      'culture-standards',
      'entrees-steaks',
      'appetizers-sides',
      'wine-program',
      'cocktails-bar',
      'beer-liquor',
      'desserts-after-dinner'
    );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 2. Bartender 101 (coming_soon)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.training_programs (
    group_id, slug, title_en, title_es, description_en, description_es,
    cover_image, category, icon, sort_order, estimated_minutes, status
  ) VALUES (
    v_group_id,
    'bartender-101',
    'Bartender 101',
    'Barman 101',
    'Essential bartending skills from classic cocktails to speed service and bar management.',
    'Habilidades esenciales de coctelería desde cócteles clásicos hasta servicio rápido y gestión de barra.',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80',
    'fundamentals',
    'Martini',
    2,
    120,
    'coming_soon'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 3. Busser 101 (coming_soon)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.training_programs (
    group_id, slug, title_en, title_es, description_en, description_es,
    cover_image, category, icon, sort_order, estimated_minutes, status
  ) VALUES (
    v_group_id,
    'busser-101',
    'Busser 101',
    'Garrotero 101',
    'Master table turns, resetting, and supporting the service team for smooth dining operations.',
    'Domina la rotación de mesas, la preparación y el apoyo al equipo de servicio para una operación fluida.',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
    'fundamentals',
    'Users',
    3,
    60,
    'coming_soon'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 4. Wine 201 (coming_soon, advanced)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.training_programs (
    group_id, slug, title_en, title_es, description_en, description_es,
    cover_image, category, icon, sort_order, estimated_minutes, status
  ) VALUES (
    v_group_id,
    'wine-201',
    'Wine 201',
    'Vinos 201',
    'Deep dive into wine regions, tasting techniques, food pairings, and tableside wine service.',
    'Profundización en regiones vinícolas, técnicas de cata, maridaje y servicio de vinos en mesa.',
    'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80',
    'advanced',
    'Wine',
    4,
    90,
    'coming_soon'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 5. Food 201 (coming_soon, advanced)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.training_programs (
    group_id, slug, title_en, title_es, description_en, description_es,
    cover_image, category, icon, sort_order, estimated_minutes, status
  ) VALUES (
    v_group_id,
    'food-201',
    'Food 201',
    'Gastronomía 201',
    'Advanced menu mastery — seasonal specials, allergen deep-dives, and chef-level plating knowledge.',
    'Dominio avanzado del menú — especiales de temporada, alergenos a profundidad y conocimiento de emplatado.',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    'advanced',
    'ChefHat',
    5,
    100,
    'coming_soon'
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- 6. Barback 101 (coming_soon)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO public.training_programs (
    group_id, slug, title_en, title_es, description_en, description_es,
    cover_image, category, icon, sort_order, estimated_minutes, status
  ) VALUES (
    v_group_id,
    'barback-101',
    'Barback 101',
    'Ayudante de Barra 101',
    'Stocking, prep, glassware, and bar support essentials to keep the bar running smoothly.',
    'Abastecimiento, preparación, cristalería y apoyo esencial para mantener la barra funcionando.',
    'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=800&q=80',
    'fundamentals',
    'Beer',
    6,
    50,
    'coming_soon'
  );

END $$;
