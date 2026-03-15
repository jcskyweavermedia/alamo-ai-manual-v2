-- =============================================================================
-- MIGRATION: Create employees table
-- Phase A.3: Core employee registry with position/department
-- =============================================================================

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Identity
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT GENERATED ALWAYS AS (first_name || ' ' || left(last_name, 1) || '.') STORED,
  email TEXT,
  phone TEXT,
  phone_consent BOOLEAN NOT NULL DEFAULT false,
  phone_consent_at TIMESTAMPTZ,

  -- Position & Department
  position TEXT NOT NULL
    CHECK (position IN (
      'Server', 'Host', 'Busser', 'Runner', 'Bartender',
      'Line Cook', 'Prep Cook', 'Sous Chef', 'Dishwasher',
      'Manager', 'General Manager', 'Assistant Manager'
    )),
  department TEXT GENERATED ALWAYS AS (
    CASE
      WHEN position IN ('Server', 'Host', 'Busser', 'Runner', 'Bartender') THEN 'FOH'
      WHEN position IN ('Line Cook', 'Prep Cook', 'Sous Chef', 'Dishwasher') THEN 'BOH'
      WHEN position IN ('Manager', 'General Manager', 'Assistant Manager') THEN 'Management'
    END
  ) STORED,

  -- Employment
  employment_type TEXT NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'seasonal', 'contractor')),
  employment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'onboarding', 'on_leave', 'terminated')),
  hire_date DATE,
  termination_date DATE,
  pay_type TEXT NOT NULL DEFAULT 'hourly'
    CHECK (pay_type IN ('hourly', 'salary')),

  -- Notes
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_termination_after_hire CHECK (
    termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date
  ),
  CONSTRAINT chk_phone_consent_requires_phone CHECK (
    NOT phone_consent OR phone IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_employees_group ON public.employees(group_id);
CREATE INDEX idx_employees_brand ON public.employees(brand_id);
CREATE INDEX idx_employees_profile ON public.employees(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_employees_position ON public.employees(position);
CREATE INDEX idx_employees_department ON public.employees(department);
CREATE INDEX idx_employees_status ON public.employees(employment_status);
CREATE INDEX idx_employees_group_status ON public.employees(group_id, employment_status);
CREATE UNIQUE INDEX idx_employees_group_profile ON public.employees(group_id, profile_id)
  WHERE profile_id IS NOT NULL;

-- updated_at trigger
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employees in their group"
  ON public.employees FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Managers can insert employees"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update employees"
  ON public.employees FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );
