-- =============================================================================
-- MIGRATION: convert_cocktail_ingredients_to_jsonb
-- Converts cocktails.ingredients from TEXT to structured JSONB
-- (RecipeIngredientGroup[]) matching prep_recipes ingredient pattern.
-- Merges linked_prep_recipes into ingredient items via prep_recipe_ref.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1a. Add new JSONB column
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cocktails
  ADD COLUMN ingredients_jsonb JSONB NOT NULL DEFAULT '[]';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1b. Migrate existing TEXT data + merge linked_prep_recipes
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
  lines TEXT[];
  items JSONB;
  line TEXT;
  linked JSONB;
  linked_entry JSONB;
  matched BOOLEAN;
  i INT;
BEGIN
  FOR r IN SELECT id, ingredients, linked_prep_recipes FROM public.cocktails LOOP
    items := '[]'::JSONB;

    -- Split TEXT ingredients on newline into individual items
    IF r.ingredients IS NOT NULL AND r.ingredients <> '' THEN
      -- Try newline split first, fall back to comma
      IF r.ingredients LIKE E'%\n%' THEN
        lines := string_to_array(r.ingredients, E'\n');
      ELSE
        lines := string_to_array(r.ingredients, ',');
      END IF;

      FOR i IN 1..array_length(lines, 1) LOOP
        line := trim(lines[i]);
        IF line <> '' THEN
          items := items || jsonb_build_object(
            'name', line,
            'quantity', 0,
            'unit', ''
          );
        END IF;
      END LOOP;
    END IF;

    -- Merge linked_prep_recipes: find matching items by name substring
    IF r.linked_prep_recipes IS NOT NULL AND jsonb_array_length(r.linked_prep_recipes) > 0 THEN
      FOR linked_entry IN SELECT * FROM jsonb_array_elements(r.linked_prep_recipes) LOOP
        matched := FALSE;

        -- Try to match by case-insensitive name substring
        FOR i IN 0..jsonb_array_length(items) - 1 LOOP
          IF lower(items->i->>'name') LIKE '%' || lower(linked_entry->>'name') || '%' THEN
            -- Set prep_recipe_ref on the matched item
            items := jsonb_set(
              items,
              ARRAY[i::TEXT],
              (items->i) || jsonb_build_object(
                'prep_recipe_ref', linked_entry->>'prep_recipe_ref'
              )
            );
            -- Update quantity/unit if linked recipe has them
            IF (linked_entry->>'quantity')::NUMERIC > 0 THEN
              items := jsonb_set(
                items,
                ARRAY[i::TEXT],
                (items->i) || jsonb_build_object(
                  'quantity', (linked_entry->>'quantity')::NUMERIC,
                  'unit', COALESCE(linked_entry->>'unit', '')
                )
              );
            END IF;
            matched := TRUE;
            EXIT;
          END IF;
        END LOOP;

        -- If no match found, append as new item
        IF NOT matched THEN
          items := items || jsonb_build_object(
            'name', linked_entry->>'name',
            'quantity', COALESCE((linked_entry->>'quantity')::NUMERIC, 0),
            'unit', COALESCE(linked_entry->>'unit', ''),
            'prep_recipe_ref', linked_entry->>'prep_recipe_ref'
          );
        END IF;
      END LOOP;
    END IF;

    -- Wrap items into a single RecipeIngredientGroup
    UPDATE public.cocktails
    SET ingredients_jsonb = jsonb_build_array(
      jsonb_build_object(
        'group_name', 'Ingredients',
        'order', 1,
        'items', items
      )
    )
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1c. Column swap
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cocktails DROP COLUMN ingredients;
ALTER TABLE public.cocktails RENAME COLUMN ingredients_jsonb TO ingredients;
ALTER TABLE public.cocktails DROP COLUMN linked_prep_recipes;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1d. Add CHECK constraint
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cocktails
  ADD CONSTRAINT cocktails_ingredients_is_array
  CHECK (jsonb_typeof(ingredients) = 'array');

-- ─────────────────────────────────────────────────────────────────────────────
-- 1e. Update search vector trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_cocktails_search_vector()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.key_ingredients, '')), 'B') ||
    -- Linked recipe names (items with prep_recipe_ref) at weight B
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(item->>'name', ' ')
       FROM jsonb_array_elements(NEW.ingredients) AS grp,
            jsonb_array_elements(grp->'items') AS item
       WHERE item->>'prep_recipe_ref' IS NOT NULL),
      ''
    )), 'B') ||
    -- All ingredient names at weight C
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(item->>'name', ' ')
       FROM jsonb_array_elements(NEW.ingredients) AS grp,
            jsonb_array_elements(grp->'items') AS item),
      ''
    )), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.tasting_notes, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1f. Recompute search_vector for existing cocktails
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.cocktails SET updated_at = now();
