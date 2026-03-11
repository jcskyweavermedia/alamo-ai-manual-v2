-- ===========================================================================
-- MIGRATION: fn_get_section_context
-- Shared enrichment function: returns a formatted markdown context bundle
-- for a given course_sections row, keyed by content_source type.
-- Used by: ask and realtime-session edge functions (training mode)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.fn_get_section_context(
  _section_id UUID,
  _language   TEXT DEFAULT 'en'
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_content_source TEXT;
  v_content_ids    UUID[];
  v_bundle         TEXT := '';
  v_item_bundle    TEXT := '';
  v_sep            TEXT := E'\n\n---\n\n';
  v_foh  RECORD;  v_boh  RECORD;  v_prep RECORD;
  v_wine RECORD;  v_cocktail RECORD;
  v_beer RECORD;  v_manual RECORD;
  v_components JSONB;  v_prep_refs TEXT[];
BEGIN
  SELECT content_source, content_ids INTO v_content_source, v_content_ids
  FROM   public.course_sections WHERE  id = _section_id;
  IF NOT FOUND OR v_content_ids IS NULL OR cardinality(v_content_ids) = 0 THEN
    RETURN '';
  END IF;

  -- foh_plate_specs
  IF v_content_source = 'foh_plate_specs' THEN
    FOR v_foh IN
      SELECT f.id, f.menu_name, f.plate_type, f.short_description,
             f.detailed_description, f.ingredients, f.key_ingredients,
             f.flavor_profile, f.allergens, f.upsell_notes, f.plate_spec_id
      FROM   public.foh_plate_specs f WHERE f.id = ANY(v_content_ids)
      ORDER  BY array_position(v_content_ids, f.id)
    LOOP
      v_item_bundle := '';
      v_item_bundle := v_item_bundle ||
        '## What the Guest Sees (FOH)' || E'\n' ||
        'Name: '            || COALESCE(v_foh.menu_name, '')         || E'\n' ||
        'Type: '            || COALESCE(v_foh.plate_type, '')        || E'\n' ||
        'Description: '     || COALESCE(v_foh.short_description, '') || E'\n' ||
        COALESCE(v_foh.detailed_description, '')                      || E'\n' ||
        'Ingredients: '     || COALESCE(array_to_string(v_foh.ingredients,     ', '), '') || E'\n' ||
        'Key Ingredients: ' || COALESCE(array_to_string(v_foh.key_ingredients, ', '), '') || E'\n' ||
        'Flavor Profile: '  || COALESCE(array_to_string(v_foh.flavor_profile,  ', '), '') || E'\n' ||
        'Allergens: '       || COALESCE(array_to_string(v_foh.allergens,        ', '), '') || E'\n' ||
        'Upsell: '          || COALESCE(v_foh.upsell_notes, '');
      IF v_foh.plate_spec_id IS NOT NULL THEN
        SELECT ps.components, ps.assembly_procedure, ps.notes INTO v_boh
        FROM   public.plate_specs ps WHERE  ps.id = v_foh.plate_spec_id;
        IF FOUND THEN
          v_components := v_boh.components;
          v_item_bundle := v_item_bundle || E'\n\n' ||
            '## How the Kitchen Makes It (BOH)' || E'\n' ||
            'Assembly:' || E'\n' ||
            LEFT(COALESCE(v_boh.assembly_procedure::text, ''), 500) || E'\n' ||
            'Components:' || E'\n' ||
            LEFT(COALESCE(v_boh.components::text, ''), 500)         || E'\n' ||
            'Notes: ' || COALESCE(v_boh.notes, '');
          SELECT ARRAY(
            SELECT DISTINCT elem->>'prep_recipe_ref'
            FROM   jsonb_array_elements(v_components) AS grp,
                   jsonb_array_elements(grp->'items') AS elem
            WHERE  elem->>'type' = 'prep_recipe'
              AND  elem->>'prep_recipe_ref' IS NOT NULL
          ) INTO v_prep_refs;
          IF v_prep_refs IS NOT NULL AND cardinality(v_prep_refs) > 0 THEN
            v_item_bundle := v_item_bundle || E'\n\n' || '## Prep Recipes';
            FOR v_prep IN
              SELECT pr.name, pr.prep_type, pr.yield_qty, pr.yield_unit,
                     pr.shelf_life_value, pr.shelf_life_unit,
                     pr.ingredients, pr.procedure, pr.training_notes
              FROM   public.prep_recipes pr WHERE pr.slug = ANY(v_prep_refs)
              ORDER  BY pr.name
            LOOP
              v_item_bundle := v_item_bundle || E'\n' ||
                '### ' || COALESCE(v_prep.name, '') ||
                ' (' || COALESCE(v_prep.prep_type, '') || ')' || E'\n' ||
                'Yield: ' || COALESCE(v_prep.yield_qty::text, '') || ' ' || COALESCE(v_prep.yield_unit, '') || E'\n' ||
                'Shelf Life: ' || COALESCE(v_prep.shelf_life_value::text,'') || ' ' || COALESCE(v_prep.shelf_life_unit,'') || E'\n' ||
                'Ingredients: '    || LEFT(COALESCE(v_prep.ingredients::text,    ''), 500) || E'\n' ||
                'Procedure: '      || LEFT(COALESCE(v_prep.procedure::text,      ''), 500) || E'\n' ||
                'Training Notes: ' || LEFT(COALESCE(v_prep.training_notes::text, ''), 300);
            END LOOP;
          END IF; -- prep refs
        END IF; -- FOUND boh
      END IF; -- plate_spec_id
      IF v_bundle = '' THEN v_bundle := v_item_bundle;
      ELSE v_bundle := v_bundle || v_sep || v_item_bundle; END IF;
    END LOOP;

  -- wines
  ELSIF v_content_source = 'wines' THEN
    FOR v_wine IN
      SELECT w.name, w.producer, w.varietal, w.style, w.body,
             w.region, w.country, w.vintage, w.tasting_notes, w.producer_notes, w.notes
      FROM   public.wines w WHERE w.id = ANY(v_content_ids)
      ORDER  BY array_position(v_content_ids, w.id)
    LOOP
      v_item_bundle :=
        '## ' || COALESCE(v_wine.name, '')                                    || E'\n' ||
        'Producer: '      || COALESCE(v_wine.producer, '')                    || E'\n' ||
        'Varietal: '      || COALESCE(v_wine.varietal, '')                    || E'\n' ||
        'Style: '         || COALESCE(v_wine.style, '') || ' | Body: ' || COALESCE(v_wine.body, '') || E'\n' ||
        'Region: '        || COALESCE(v_wine.region, '') || ', ' || COALESCE(v_wine.country, '') || E'\n' ||
        'Vintage: '       || COALESCE(v_wine.vintage, '')                     || E'\n' ||
        'Tasting Notes: ' || COALESCE(v_wine.tasting_notes, '')               || E'\n' ||
        'Producer Notes: '|| COALESCE(v_wine.producer_notes, '')              || E'\n' ||
        'Notes: '         || COALESCE(v_wine.notes, '');
      IF v_bundle = '' THEN v_bundle := v_item_bundle;
      ELSE v_bundle := v_bundle || v_sep || v_item_bundle; END IF;
    END LOOP;

  -- cocktails
  ELSIF v_content_source = 'cocktails' THEN
    FOR v_cocktail IN
      SELECT c.name, c.style, c.glass, c.description, c.ingredients,
             c.key_ingredients, c.procedure, c.tasting_notes, c.notes
      FROM   public.cocktails c WHERE c.id = ANY(v_content_ids)
      ORDER  BY array_position(v_content_ids, c.id)
    LOOP
      v_item_bundle :=
        '## ' || COALESCE(v_cocktail.name, '')                                       || E'\n' ||
        'Style: ' || COALESCE(v_cocktail.style, '') || ' | Glass: ' || COALESCE(v_cocktail.glass, '') || E'\n' ||
        COALESCE(v_cocktail.description, '')                                          || E'\n' ||
        'Ingredients: '     || LEFT(COALESCE(v_cocktail.ingredients::text,  ''), 500) || E'\n' ||
        'Key Ingredients: ' || COALESCE(v_cocktail.key_ingredients, '')               || E'\n' ||
        'Procedure: '       || LEFT(COALESCE(v_cocktail.procedure::text,    ''), 500) || E'\n' ||
        'Tasting Notes: '   || COALESCE(v_cocktail.tasting_notes, '')                 || E'\n' ||
        'Notes: '           || COALESCE(v_cocktail.notes, '');
      IF v_bundle = '' THEN v_bundle := v_item_bundle;
      ELSE v_bundle := v_bundle || v_sep || v_item_bundle; END IF;
    END LOOP;

  -- beer_liquor_list
  ELSIF v_content_source = 'beer_liquor_list' THEN
    FOR v_beer IN
      SELECT b.name, b.category, b.subcategory, b.producer,
             b.country, b.style, b.description, b.notes
      FROM   public.beer_liquor_list b WHERE b.id = ANY(v_content_ids)
      ORDER  BY array_position(v_content_ids, b.id)
    LOOP
      v_item_bundle :=
        '## ' || COALESCE(v_beer.name, '')                                     || E'\n' ||
        'Category: ' || COALESCE(v_beer.category, '') || ' | Subcategory: ' || COALESCE(v_beer.subcategory, '') || E'\n' ||
        'Producer: ' || COALESCE(v_beer.producer, '') || ' | Country: ' || COALESCE(v_beer.country, '') || E'\n' ||
        'Style: '    || COALESCE(v_beer.style, '')                             || E'\n' ||
        COALESCE(v_beer.description, '')                                        || E'\n' ||
        'Notes: '    || COALESCE(v_beer.notes, '');
      IF v_bundle = '' THEN v_bundle := v_item_bundle;
      ELSE v_bundle := v_bundle || v_sep || v_item_bundle; END IF;
    END LOOP;

  -- manual_sections
  ELSIF v_content_source = 'manual_sections' THEN
    FOR v_manual IN
      SELECT m.title_en, m.title_es, m.content_en, m.content_es
      FROM   public.manual_sections m WHERE m.id = ANY(v_content_ids)
      ORDER  BY array_position(v_content_ids, m.id)
    LOOP
      IF _language = 'es' THEN
        v_item_bundle :=
          '## ' || COALESCE(v_manual.title_es, v_manual.title_en, '') || E'\n' ||
          COALESCE(v_manual.content_es, v_manual.content_en, '');
      ELSE
        v_item_bundle :=
          '## ' || COALESCE(v_manual.title_en, '') || E'\n' ||
          COALESCE(v_manual.content_en, '');
      END IF;
      IF v_bundle = '' THEN v_bundle := v_item_bundle;
      ELSE v_bundle := v_bundle || v_sep || v_item_bundle; END IF;
    END LOOP;

  -- custom / unknown
  ELSE
    RETURN '';
  END IF;

  RETURN v_bundle;
END;
$$;

-- Grant execute to authenticated users (SECURITY DEFINER runs with owner privileges)
GRANT EXECUTE ON FUNCTION public.fn_get_section_context(UUID, TEXT) TO authenticated;
