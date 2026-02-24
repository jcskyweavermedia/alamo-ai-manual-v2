-- =============================================================================
-- MIGRATION: sub_recipe_integrity_triggers
-- Prevents deletion or slug renaming of prep_recipes that are referenced
-- as sub-recipes in other prep_recipes or plate_specs JSONB columns.
-- =============================================================================

-- 1. Prevent DELETE of a prep recipe that is referenced elsewhere
CREATE OR REPLACE FUNCTION public.prevent_delete_if_referenced_as_sub_recipe()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ref_count INT := 0;
  cnt INT;
BEGIN
  -- Scan prep_recipes.ingredients for prep_recipe_ref = OLD.slug
  SELECT COUNT(*) INTO cnt
  FROM prep_recipes pr,
       jsonb_array_elements(pr.ingredients) AS grp,
       jsonb_array_elements(grp -> 'items') AS item
  WHERE item ->> 'prep_recipe_ref' = OLD.slug
    AND pr.id != OLD.id;
  ref_count := ref_count + cnt;

  -- Scan plate_specs.components for prep_recipe_ref = OLD.slug
  SELECT COUNT(*) INTO cnt
  FROM plate_specs ps,
       jsonb_array_elements(ps.components) AS grp,
       jsonb_array_elements(grp -> 'items') AS item
  WHERE item ->> 'prep_recipe_ref' = OLD.slug;
  ref_count := ref_count + cnt;

  IF ref_count > 0 THEN
    RAISE EXCEPTION
      'Cannot delete prep recipe "%" — referenced as sub-recipe by % item(s). Remove references first.',
      OLD.slug, ref_count;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_delete_referenced_prep_recipe
  BEFORE DELETE ON prep_recipes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_if_referenced_as_sub_recipe();

-- 2. Prevent slug changes on prep recipes that are referenced elsewhere
CREATE OR REPLACE FUNCTION public.prevent_slug_change_if_sub_recipe_referenced()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ref_count INT := 0;
  cnt INT;
BEGIN
  -- Only check if slug actually changed
  IF OLD.slug = NEW.slug THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM prep_recipes pr,
       jsonb_array_elements(pr.ingredients) AS grp,
       jsonb_array_elements(grp -> 'items') AS item
  WHERE item ->> 'prep_recipe_ref' = OLD.slug
    AND pr.id != OLD.id;
  ref_count := ref_count + cnt;

  SELECT COUNT(*) INTO cnt
  FROM plate_specs ps,
       jsonb_array_elements(ps.components) AS grp,
       jsonb_array_elements(grp -> 'items') AS item
  WHERE item ->> 'prep_recipe_ref' = OLD.slug;
  ref_count := ref_count + cnt;

  IF ref_count > 0 THEN
    RAISE EXCEPTION
      'Cannot change slug from "%" to "%" — referenced as sub-recipe by % item(s). Update references first.',
      OLD.slug, NEW.slug, ref_count;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_slug_rename_referenced_prep_recipe
  BEFORE UPDATE ON prep_recipes
  FOR EACH ROW
  EXECUTE FUNCTION prevent_slug_change_if_sub_recipe_referenced();
