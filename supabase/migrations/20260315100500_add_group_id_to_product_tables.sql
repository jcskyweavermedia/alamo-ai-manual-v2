-- =============================================================================
-- MIGRATION: Add group_id to 6 product tables
-- Phase A.7a: Product table scoping for multi-tenant
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Add nullable group_id column to all 6 tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prep_recipes     ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.plate_specs      ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.foh_plate_specs  ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.wines            ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.cocktails        ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.beer_liquor_list ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Backfill all existing rows to Alamo Prime group
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.prep_recipes     SET group_id = '00000000-0000-0000-0000-000000000001' WHERE group_id IS NULL;
UPDATE public.plate_specs      SET group_id = '00000000-0000-0000-0000-000000000001' WHERE group_id IS NULL;
UPDATE public.foh_plate_specs  SET group_id = '00000000-0000-0000-0000-000000000001' WHERE group_id IS NULL;
UPDATE public.wines            SET group_id = '00000000-0000-0000-0000-000000000001' WHERE group_id IS NULL;
UPDATE public.cocktails        SET group_id = '00000000-0000-0000-0000-000000000001' WHERE group_id IS NULL;
UPDATE public.beer_liquor_list SET group_id = '00000000-0000-0000-0000-000000000001' WHERE group_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Set NOT NULL
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prep_recipes     ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.plate_specs      ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.foh_plate_specs  ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.wines            ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.cocktails        ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.beer_liquor_list ALTER COLUMN group_id SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Add group_id indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_prep_recipes_group     ON public.prep_recipes(group_id);
CREATE INDEX idx_plate_specs_group      ON public.plate_specs(group_id);
CREATE INDEX idx_foh_plate_specs_group  ON public.foh_plate_specs(group_id);
CREATE INDEX idx_wines_group            ON public.wines(group_id);
CREATE INDEX idx_cocktails_group        ON public.cocktails(group_id);
CREATE INDEX idx_beer_liquor_group      ON public.beer_liquor_list(group_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Update UNIQUE constraints to be group-scoped
-- (inline UNIQUE generates auto-named constraints: <table>_slug_key)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.prep_recipes     DROP CONSTRAINT prep_recipes_slug_key;
ALTER TABLE public.prep_recipes     ADD CONSTRAINT prep_recipes_group_slug_key UNIQUE(group_id, slug);

ALTER TABLE public.plate_specs      DROP CONSTRAINT plate_specs_slug_key;
ALTER TABLE public.plate_specs      ADD CONSTRAINT plate_specs_group_slug_key UNIQUE(group_id, slug);

ALTER TABLE public.foh_plate_specs  DROP CONSTRAINT foh_plate_specs_slug_key;
ALTER TABLE public.foh_plate_specs  ADD CONSTRAINT foh_plate_specs_group_slug_key UNIQUE(group_id, slug);

ALTER TABLE public.wines            DROP CONSTRAINT wines_slug_key;
ALTER TABLE public.wines            ADD CONSTRAINT wines_group_slug_key UNIQUE(group_id, slug);

ALTER TABLE public.cocktails        DROP CONSTRAINT cocktails_slug_key;
ALTER TABLE public.cocktails        ADD CONSTRAINT cocktails_group_slug_key UNIQUE(group_id, slug);

ALTER TABLE public.beer_liquor_list DROP CONSTRAINT beer_liquor_list_slug_key;
ALTER TABLE public.beer_liquor_list ADD CONSTRAINT beer_liquor_list_group_slug_key UNIQUE(group_id, slug);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Update RLS policies to filter by group_id
-- Drop old permissive SELECT, create group-scoped versions
-- ─────────────────────────────────────────────────────────────────────────────

-- ── prep_recipes ──
DROP POLICY "Authenticated users can view prep_recipes" ON public.prep_recipes;
CREATE POLICY "Users can view prep_recipes in their group"
  ON public.prep_recipes FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

DROP POLICY "Admins can insert prep_recipes" ON public.prep_recipes;
CREATE POLICY "Admins can insert prep_recipes"
  ON public.prep_recipes FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can update prep_recipes" ON public.prep_recipes;
CREATE POLICY "Admins can update prep_recipes"
  ON public.prep_recipes FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can delete prep_recipes" ON public.prep_recipes;
CREATE POLICY "Admins can delete prep_recipes"
  ON public.prep_recipes FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

-- ── plate_specs ──
DROP POLICY "Authenticated users can view plate_specs" ON public.plate_specs;
CREATE POLICY "Users can view plate_specs in their group"
  ON public.plate_specs FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

DROP POLICY "Admins can insert plate_specs" ON public.plate_specs;
CREATE POLICY "Admins can insert plate_specs"
  ON public.plate_specs FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can update plate_specs" ON public.plate_specs;
CREATE POLICY "Admins can update plate_specs"
  ON public.plate_specs FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can delete plate_specs" ON public.plate_specs;
CREATE POLICY "Admins can delete plate_specs"
  ON public.plate_specs FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

-- ── foh_plate_specs ──
DROP POLICY "Authenticated users can view foh_plate_specs" ON public.foh_plate_specs;
CREATE POLICY "Users can view foh_plate_specs in their group"
  ON public.foh_plate_specs FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

DROP POLICY "Admins can insert foh_plate_specs" ON public.foh_plate_specs;
CREATE POLICY "Admins can insert foh_plate_specs"
  ON public.foh_plate_specs FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can update foh_plate_specs" ON public.foh_plate_specs;
CREATE POLICY "Admins can update foh_plate_specs"
  ON public.foh_plate_specs FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can delete foh_plate_specs" ON public.foh_plate_specs;
CREATE POLICY "Admins can delete foh_plate_specs"
  ON public.foh_plate_specs FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

-- ── wines ──
DROP POLICY "Authenticated users can view wines" ON public.wines;
CREATE POLICY "Users can view wines in their group"
  ON public.wines FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

DROP POLICY "Admins can insert wines" ON public.wines;
CREATE POLICY "Admins can insert wines"
  ON public.wines FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can update wines" ON public.wines;
CREATE POLICY "Admins can update wines"
  ON public.wines FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can delete wines" ON public.wines;
CREATE POLICY "Admins can delete wines"
  ON public.wines FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

-- ── cocktails ──
DROP POLICY "Authenticated users can view cocktails" ON public.cocktails;
CREATE POLICY "Users can view cocktails in their group"
  ON public.cocktails FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

DROP POLICY "Admins can insert cocktails" ON public.cocktails;
CREATE POLICY "Admins can insert cocktails"
  ON public.cocktails FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can update cocktails" ON public.cocktails;
CREATE POLICY "Admins can update cocktails"
  ON public.cocktails FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can delete cocktails" ON public.cocktails;
CREATE POLICY "Admins can delete cocktails"
  ON public.cocktails FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

-- ── beer_liquor_list ──
DROP POLICY "Authenticated users can view beer_liquor_list" ON public.beer_liquor_list;
CREATE POLICY "Users can view beer_liquor_list in their group"
  ON public.beer_liquor_list FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

DROP POLICY "Admins can insert beer_liquor_list" ON public.beer_liquor_list;
CREATE POLICY "Admins can insert beer_liquor_list"
  ON public.beer_liquor_list FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can update beer_liquor_list" ON public.beer_liquor_list;
CREATE POLICY "Admins can update beer_liquor_list"
  ON public.beer_liquor_list FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY "Admins can delete beer_liquor_list" ON public.beer_liquor_list;
CREATE POLICY "Admins can delete beer_liquor_list"
  ON public.beer_liquor_list FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND has_role(auth.uid(), 'admin'::user_role));
