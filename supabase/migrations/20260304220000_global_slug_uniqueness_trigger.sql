-- Enforce global slug uniqueness across all six product tables.
--
-- A slug must be unique not just within its own table, but across:
--   prep_recipes, plate_specs, foh_plate_specs, wines, cocktails, beer_liquor_list
--
-- The trigger skips the check when a slug is unchanged on UPDATE (no-op path).
-- On violation it raises SQLSTATE 23505 (unique_violation) so the app can surface
-- a clear error message to the admin.

CREATE OR REPLACE FUNCTION public.enforce_global_slug_uniqueness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_table TEXT := NULL;
BEGIN
  -- Skip if slug hasn't changed (UPDATE with same slug value)
  IF TG_OP = 'UPDATE' AND NEW.slug = OLD.slug THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME != 'prep_recipes'
     AND EXISTS (SELECT 1 FROM public.prep_recipes WHERE slug = NEW.slug) THEN
    conflict_table := 'prep_recipes';

  ELSIF TG_TABLE_NAME != 'plate_specs'
     AND EXISTS (SELECT 1 FROM public.plate_specs WHERE slug = NEW.slug) THEN
    conflict_table := 'plate_specs';

  ELSIF TG_TABLE_NAME != 'foh_plate_specs'
     AND EXISTS (SELECT 1 FROM public.foh_plate_specs WHERE slug = NEW.slug) THEN
    conflict_table := 'foh_plate_specs';

  ELSIF TG_TABLE_NAME != 'wines'
     AND EXISTS (SELECT 1 FROM public.wines WHERE slug = NEW.slug) THEN
    conflict_table := 'wines';

  ELSIF TG_TABLE_NAME != 'cocktails'
     AND EXISTS (SELECT 1 FROM public.cocktails WHERE slug = NEW.slug) THEN
    conflict_table := 'cocktails';

  ELSIF TG_TABLE_NAME != 'beer_liquor_list'
     AND EXISTS (SELECT 1 FROM public.beer_liquor_list WHERE slug = NEW.slug) THEN
    conflict_table := 'beer_liquor_list';
  END IF;

  IF conflict_table IS NOT NULL THEN
    RAISE EXCEPTION 'Slug "%" already exists in table "%" — slugs must be unique across all product tables.',
      NEW.slug, conflict_table
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach to all six product tables
CREATE TRIGGER trg_global_slug_uniqueness
  BEFORE INSERT OR UPDATE OF slug ON public.prep_recipes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_global_slug_uniqueness();

CREATE TRIGGER trg_global_slug_uniqueness
  BEFORE INSERT OR UPDATE OF slug ON public.plate_specs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_global_slug_uniqueness();

CREATE TRIGGER trg_global_slug_uniqueness
  BEFORE INSERT OR UPDATE OF slug ON public.foh_plate_specs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_global_slug_uniqueness();

CREATE TRIGGER trg_global_slug_uniqueness
  BEFORE INSERT OR UPDATE OF slug ON public.wines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_global_slug_uniqueness();

CREATE TRIGGER trg_global_slug_uniqueness
  BEFORE INSERT OR UPDATE OF slug ON public.cocktails
  FOR EACH ROW EXECUTE FUNCTION public.enforce_global_slug_uniqueness();

CREATE TRIGGER trg_global_slug_uniqueness
  BEFORE INSERT OR UPDATE OF slug ON public.beer_liquor_list
  FOR EACH ROW EXECUTE FUNCTION public.enforce_global_slug_uniqueness();
