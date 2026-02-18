-- =============================================================================
-- MIGRATION: create_training_programs
-- Adds training_programs table, program_enrollments table, program_id to courses,
-- RLS policies, and auto-sync trigger for program completion.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: training_programs
-- Top-level grouping for courses (e.g. "Server 101", "Bartender 101")
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.training_programs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT,
  description_es TEXT,

  cover_image TEXT,                -- Unsplash URL for program card
  category TEXT NOT NULL DEFAULT 'fundamentals'
    CHECK (category IN ('fundamentals', 'advanced', 'specialty')),
  icon TEXT,                       -- Lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,

  estimated_minutes INTEGER NOT NULL DEFAULT 0,
  passing_score INTEGER NOT NULL DEFAULT 70
    CHECK (passing_score >= 0 AND passing_score <= 100),

  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'draft', 'archived', 'coming_soon')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

CREATE INDEX idx_training_programs_group_status
  ON public.training_programs(group_id, status);
CREATE INDEX idx_training_programs_sort
  ON public.training_programs(group_id, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: program_enrollments
-- Per-user enrollment tracking at the program level
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.program_enrollments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'in_progress', 'completed')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  total_courses INTEGER NOT NULL DEFAULT 0,
  completed_courses INTEGER NOT NULL DEFAULT 0,
  overall_score INTEGER CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, program_id)
);

CREATE INDEX idx_program_enrollments_user
  ON public.program_enrollments(user_id, status);
CREATE INDEX idx_program_enrollments_program
  ON public.program_enrollments(program_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER courses: add program_id FK
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.courses
  ADD COLUMN program_id UUID REFERENCES public.training_programs(id) ON DELETE SET NULL;

CREATE INDEX idx_courses_program
  ON public.courses(program_id) WHERE program_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS: updated_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_training_programs_updated_at
  BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_program_enrollments_updated_at
  BEFORE UPDATE ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES: training_programs
-- ─────────────────────────────────────────────────────────────────────────────

-- Users see published + coming_soon programs in their group
CREATE POLICY "Users can view programs in their group"
  ON public.training_programs FOR SELECT
  TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND status IN ('published', 'coming_soon')
  );

-- Managers can insert programs
CREATE POLICY "Managers can insert programs"
  ON public.training_programs FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Managers can update programs
CREATE POLICY "Managers can update programs"
  ON public.training_programs FOR UPDATE
  TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Admins can delete programs
CREATE POLICY "Admins can delete programs"
  ON public.training_programs FOR DELETE
  TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES: program_enrollments
-- ─────────────────────────────────────────────────────────────────────────────

-- Users see own enrollments, managers see group enrollments
CREATE POLICY "Users can view own program enrollments"
  ON public.program_enrollments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      group_id = public.get_user_group_id()
      AND public.get_user_role() IN ('manager', 'admin')
    )
  );

-- Users can self-enroll in published programs
CREATE POLICY "Users can enroll in published programs"
  ON public.program_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND group_id = public.get_user_group_id()
    AND EXISTS (
      SELECT 1 FROM public.training_programs tp
      WHERE tp.id = program_id
        AND tp.status = 'published'
        AND tp.group_id = public.get_user_group_id()
    )
  );

-- Users can update own enrollment, managers can update group enrollments
CREATE POLICY "Users can update own program enrollment"
  ON public.program_enrollments FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      group_id = public.get_user_group_id()
      AND public.get_user_role() IN ('manager', 'admin')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      group_id = public.get_user_group_id()
      AND public.get_user_role() IN ('manager', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: auto-sync program enrollment on course completion
-- When course_enrollments.completed_sections changes, check if course is done,
-- then update program_enrollments accordingly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_program_enrollment_on_course_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_id UUID;
  v_total_courses INTEGER;
  v_completed_courses INTEGER;
BEGIN
  -- Only proceed if completed_sections actually changed
  IF NEW.completed_sections IS NOT DISTINCT FROM OLD.completed_sections THEN
    RETURN NEW;
  END IF;

  -- Check if the course is now complete (all sections done)
  IF NEW.completed_sections < NEW.total_sections OR NEW.total_sections = 0 THEN
    RETURN NEW;
  END IF;

  -- Get the program_id for this course
  SELECT c.program_id INTO v_program_id
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  -- If course is not part of a program, nothing to do
  IF v_program_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total published courses in this program
  SELECT count(*) INTO v_total_courses
  FROM public.courses c
  WHERE c.program_id = v_program_id
    AND c.status = 'published';

  -- Count completed course enrollments for this user in this program
  SELECT count(*) INTO v_completed_courses
  FROM public.course_enrollments ce
  JOIN public.courses c ON c.id = ce.course_id
  WHERE ce.user_id = NEW.user_id
    AND c.program_id = v_program_id
    AND ce.completed_sections >= ce.total_sections
    AND ce.total_sections > 0;

  -- Upsert program enrollment
  INSERT INTO public.program_enrollments (user_id, program_id, group_id, status, started_at, total_courses, completed_courses)
  VALUES (
    NEW.user_id,
    v_program_id,
    NEW.group_id,
    CASE WHEN v_completed_courses >= v_total_courses THEN 'completed' ELSE 'in_progress' END,
    now(),
    v_total_courses,
    v_completed_courses
  )
  ON CONFLICT (user_id, program_id)
  DO UPDATE SET
    completed_courses = EXCLUDED.completed_courses,
    total_courses = EXCLUDED.total_courses,
    status = CASE WHEN EXCLUDED.completed_courses >= EXCLUDED.total_courses THEN 'completed' ELSE 'in_progress' END,
    completed_at = CASE WHEN EXCLUDED.completed_courses >= EXCLUDED.total_courses THEN now() ELSE NULL END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_program_on_course_update
  AFTER UPDATE ON public.course_enrollments
  FOR EACH ROW
  WHEN (NEW.completed_sections IS DISTINCT FROM OLD.completed_sections)
  EXECUTE FUNCTION public.sync_program_enrollment_on_course_complete();
