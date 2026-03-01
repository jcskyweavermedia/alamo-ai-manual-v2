-- Add updated_at trigger + version auto-increment on beer_liquor_list
-- The table already has updated_at and version columns; this adds the triggers.

-- 1. updated_at trigger (reuses shared set_updated_at from training system)
CREATE TRIGGER trg_beer_liquor_list_updated_at
  BEFORE UPDATE ON public.beer_liquor_list
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Version auto-increment on UPDATE
CREATE OR REPLACE FUNCTION public.increment_beer_liquor_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_beer_liquor_list_version
  BEFORE UPDATE ON public.beer_liquor_list
  FOR EACH ROW EXECUTE FUNCTION public.increment_beer_liquor_version();
