-- =============================================================================
-- MIGRATION: Create position_training_requirements table
-- Phase A.4: Position-to-program requirement mapping
-- =============================================================================

CREATE TABLE public.position_training_requirements (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Position (same CHECK values as employees.position)
  position TEXT NOT NULL
    CHECK (position IN (
      'Server', 'Host', 'Busser', 'Runner', 'Bartender',
      'Line Cook', 'Prep Cook', 'Sous Chef', 'Dishwasher',
      'Manager', 'General Manager', 'Assistant Manager'
    )),

  -- Training program link
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,

  -- Requirement config
  required BOOLEAN NOT NULL DEFAULT true,
  due_within_days INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One requirement per position+program per group
  UNIQUE(group_id, position, program_id)
);

-- Indexes
CREATE INDEX idx_ptr_group_position ON public.position_training_requirements(group_id, position);
CREATE INDEX idx_ptr_program ON public.position_training_requirements(program_id);

-- updated_at trigger
CREATE TRIGGER trg_ptr_updated_at
  BEFORE UPDATE ON public.position_training_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.position_training_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view requirements in their group"
  ON public.position_training_requirements FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Managers can insert requirements"
  ON public.position_training_requirements FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update requirements"
  ON public.position_training_requirements FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Admins can delete requirements"
  ON public.position_training_requirements FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );
