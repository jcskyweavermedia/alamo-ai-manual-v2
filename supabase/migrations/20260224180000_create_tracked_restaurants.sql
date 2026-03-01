-- M01: tracked_restaurants — Restaurant identity, platform IDs, competitor linking, scrape config
-- Platform type: TEXT + CHECK (not ENUM — matches codebase convention)

CREATE TABLE public.tracked_restaurants (
  id                UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Identity
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  restaurant_type   TEXT NOT NULL CHECK (restaurant_type IN ('own', 'competitor')),

  -- Platform identifiers (for Apify actors)
  google_place_id   TEXT,
  google_place_url  TEXT,
  opentable_url     TEXT,
  tripadvisor_url   TEXT,

  -- Location
  address           TEXT,
  city              TEXT,
  state             TEXT,
  zip               TEXT,
  latitude          NUMERIC(10,7),
  longitude         NUMERIC(10,7),

  -- Competitor linking (NULL for own restaurants)
  parent_unit_id    UUID REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Business rules (DB-enforced)
  CONSTRAINT chk_competitor_has_parent
    CHECK (restaurant_type != 'competitor' OR parent_unit_id IS NOT NULL),
  CONSTRAINT chk_own_no_parent
    CHECK (restaurant_type != 'own' OR parent_unit_id IS NULL),

  -- Config
  scrape_enabled    BOOLEAN NOT NULL DEFAULT true,
  scrape_frequency  TEXT NOT NULL DEFAULT 'daily'
                    CHECK (scrape_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  last_scraped_at   TIMESTAMPTZ,

  -- Status
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'archived')),

  -- Audit
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

-- Indexes
CREATE INDEX idx_tracked_restaurants_group ON public.tracked_restaurants(group_id, status);
CREATE INDEX idx_tracked_restaurants_parent ON public.tracked_restaurants(parent_unit_id)
  WHERE parent_unit_id IS NOT NULL;

-- Max 4 competitors per own restaurant (DB-enforced)
CREATE OR REPLACE FUNCTION public.enforce_max_competitors()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.restaurant_type = 'competitor' AND NEW.parent_unit_id IS NOT NULL THEN
    IF (SELECT count(*) FROM public.tracked_restaurants
        WHERE parent_unit_id = NEW.parent_unit_id
          AND restaurant_type = 'competitor'
          AND id != NEW.id) >= 4 THEN
      RAISE EXCEPTION 'Maximum 4 competitors per restaurant unit';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_max_competitors
  BEFORE INSERT OR UPDATE ON public.tracked_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_competitors();

-- updated_at trigger (reuses existing shared function)
CREATE TRIGGER trg_tracked_restaurants_updated_at
  BEFORE UPDATE ON public.tracked_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.tracked_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view restaurants in their group"
  ON public.tracked_restaurants FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert restaurants"
  ON public.tracked_restaurants FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update restaurants"
  ON public.tracked_restaurants FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete restaurants"
  ON public.tracked_restaurants FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
