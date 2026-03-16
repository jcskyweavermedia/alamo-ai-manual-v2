-- =============================================================================
-- SEED: 12 employees for Alamo Prime (diverse names, mixed tenure)
-- 1 Manager, 5 Servers, 2 Line Cooks, 1 Bartender, 1 Barback, 1 Host
--
-- Also adds 'Barback' to the position CHECK constraint and department CASE
-- since it was missing from the original schema.
-- =============================================================================

-- -------------------------------------------------------------------------
-- 1. Add 'Barback' to position CHECK and regenerate department column
-- -------------------------------------------------------------------------

-- Drop the existing CHECK constraint
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_position_check;

-- Re-add with 'Barback' included
ALTER TABLE public.employees ADD CONSTRAINT employees_position_check
  CHECK (position IN (
    'Server', 'Host', 'Busser', 'Runner', 'Bartender', 'Barback',
    'Line Cook', 'Prep Cook', 'Sous Chef', 'Dishwasher',
    'Manager', 'General Manager', 'Assistant Manager'
  ));

-- Regenerate department column to include Barback → FOH
ALTER TABLE public.employees DROP COLUMN department;
ALTER TABLE public.employees ADD COLUMN department TEXT GENERATED ALWAYS AS (
  CASE
    WHEN position IN ('Server', 'Host', 'Busser', 'Runner', 'Bartender', 'Barback') THEN 'FOH'
    WHEN position IN ('Line Cook', 'Prep Cook', 'Sous Chef', 'Dishwasher') THEN 'BOH'
    WHEN position IN ('Manager', 'General Manager', 'Assistant Manager') THEN 'Management'
  END
) STORED;

-- Re-create index on department (dropped with column)
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department);

-- -------------------------------------------------------------------------
-- 2. Seed 12 employees
-- -------------------------------------------------------------------------

DO $$
DECLARE
  v_group_id  UUID;
  v_brand_id  UUID := '00000000-0000-0000-0000-000000000100';
  v_admin_pid UUID;
BEGIN
  -- Look up Alamo Prime group
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Alamo Prime group not found';
  END IF;

  -- Look up admin profile (link manager employee to real account)
  SELECT id INTO v_admin_pid
    FROM public.profiles
   WHERE email ILIKE '%juancarlosmarchan%'
   LIMIT 1;

  -- =========================================================================
  -- Manager (linked to admin account)
  -- =========================================================================
  INSERT INTO public.employees
    (group_id, brand_id, profile_id, first_name, last_name, position, employment_status, hire_date, email)
  VALUES
    (v_group_id, v_brand_id, v_admin_pid,
     'Juan Carlos', 'Marchan', 'Manager', 'active', '2025-01-15',
     'juancarlosmarchan@skyweavermedia.com')
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Servers (5) — mixed tenure
  -- =========================================================================
  INSERT INTO public.employees
    (group_id, brand_id, first_name, last_name, position, employment_status, hire_date)
  VALUES
    -- Veteran (8+ months)
    (v_group_id, v_brand_id,
     'Priya', 'Sharma', 'Server', 'active', '2025-07-10'),
    -- Mid-tenure
    (v_group_id, v_brand_id,
     'Marcus', 'Washington', 'Server', 'active', '2025-11-03'),
    -- Newer (3 months)
    (v_group_id, v_brand_id,
     'Linh', 'Nguyen', 'Server', 'active', '2025-12-18'),
    -- Recent hire (< 30 days — triggers new-hire flag)
    (v_group_id, v_brand_id,
     'Aaliyah', 'Jackson', 'Server', 'active', CURRENT_DATE - 12),
    -- Very new (< 1 week, onboarding)
    (v_group_id, v_brand_id,
     'Tomás', 'Herrera', 'Server', 'onboarding', CURRENT_DATE - 3)
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Line Cooks (2)
  -- =========================================================================
  INSERT INTO public.employees
    (group_id, brand_id, first_name, last_name, position, employment_status, hire_date)
  VALUES
    (v_group_id, v_brand_id,
     'Kofi', 'Mensah', 'Line Cook', 'active', '2025-09-01'),
    (v_group_id, v_brand_id,
     'Mei', 'Chen', 'Line Cook', 'active', '2026-01-20')
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Bartender (1)
  -- =========================================================================
  INSERT INTO public.employees
    (group_id, brand_id, first_name, last_name, position, employment_status, hire_date)
  VALUES
    (v_group_id, v_brand_id,
     'Dmitri', 'Volkov', 'Bartender', 'active', '2025-08-15')
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Barback (1)
  -- =========================================================================
  INSERT INTO public.employees
    (group_id, brand_id, first_name, last_name, position, employment_status, hire_date)
  VALUES
    (v_group_id, v_brand_id,
     'Amara', 'Diallo', 'Barback', 'active', CURRENT_DATE - 21)
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- Host (1)
  -- =========================================================================
  INSERT INTO public.employees
    (group_id, brand_id, first_name, last_name, position, employment_status, hire_date)
  VALUES
    (v_group_id, v_brand_id,
     'Sofia', 'Reyes', 'Host', 'active', '2025-10-05')
  ON CONFLICT DO NOTHING;

END;
$$;
