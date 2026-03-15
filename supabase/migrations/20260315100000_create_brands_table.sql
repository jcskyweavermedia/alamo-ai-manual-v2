-- =============================================================================
-- MIGRATION: Create brands table + brand_id FK on groups
-- Phase A.1: Multi-unit brand hierarchy
-- =============================================================================

-- 1. Create brands table
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  description TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_brands_slug ON public.brands(slug);
CREATE INDEX idx_brands_active ON public.brands(is_active) WHERE is_active = true;

-- 3. updated_at trigger (reuse existing shared function)
CREATE TRIGGER trg_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Add brand_id to groups (nullable initially for safe rollout)
ALTER TABLE public.groups
  ADD COLUMN brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX idx_groups_brand ON public.groups(brand_id) WHERE brand_id IS NOT NULL;

-- 5. Seed Alamo Prime brand with deterministic UUID
INSERT INTO public.brands (id, name, slug, description)
VALUES (
  '00000000-0000-0000-0000-000000000100',
  'Alamo Prime',
  'alamo-prime',
  'Alamo Prime Steakhouse brand'
);

-- 6. Link existing group to brand
UPDATE public.groups
SET brand_id = '00000000-0000-0000-0000-000000000100'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 7. Make brand_id NOT NULL after backfill
ALTER TABLE public.groups
  ALTER COLUMN brand_id SET NOT NULL;

-- 8. RLS policies (created after brand_id exists on groups)
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view brands via group membership"
  ON public.brands FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      JOIN public.group_memberships gm ON gm.group_id = g.id
      WHERE g.brand_id = brands.id
        AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert brands"
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admins can update brands"
  ON public.brands FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admins can delete brands"
  ON public.brands FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');
