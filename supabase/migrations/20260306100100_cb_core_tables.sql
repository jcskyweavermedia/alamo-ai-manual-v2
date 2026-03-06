-- =============================================================================
-- Course Builder Phase 2: CORE TABLES
-- Creates 3 foundational tables for the Course Builder:
--   1. training_programs (rebuilt)
--   2. courses (rebuilt with element-based architecture)
--   3. course_sections (rebuilt with JSONB elements array)
--
-- All tables use:
--   - extensions.gen_random_uuid() for PKs
--   - group_id FK to public.groups(id)
--   - set_updated_at() trigger (shared, NOT recreated)
--   - RLS enabled with get_user_group_id() and get_user_role()
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: training_programs (rebuilt)
-- Program groupings for courses (e.g., "Server Fundamentals", "BOH Certification")
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.training_programs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT,
  description_es TEXT,

  cover_image TEXT,            -- URL for program card
  category TEXT NOT NULL DEFAULT 'fundamentals'
    CHECK (category IN ('fundamentals', 'advanced', 'specialty', 'onboarding', 'certification')),
  icon TEXT,                   -- Lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('published', 'draft', 'archived', 'coming_soon')),

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

CREATE INDEX idx_training_programs_group_status ON public.training_programs(group_id, status);
CREATE INDEX idx_training_programs_sort ON public.training_programs(group_id, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: courses (rebuilt with element-based architecture)
-- Course definitions with wizard config, quiz config, and teacher settings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.training_programs(id) ON DELETE SET NULL,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT,
  description_es TEXT,

  -- Builder metadata: which wizard created this course
  course_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (course_type IN (
      'menu_rollout', 'sop_review', 'steps_of_service',
      'line_cook', 'custom', 'blank'
    )),
  wizard_config JSONB,         -- Saved wizard inputs for rebuilds

  -- Teacher configuration
  teacher_level TEXT NOT NULL DEFAULT 'professional'
    CHECK (teacher_level IN ('friendly', 'professional', 'strict', 'expert')),
  teacher_id UUID REFERENCES public.ai_teachers(id) ON DELETE SET NULL,

  -- Quiz configuration (course-level defaults)
  quiz_config JSONB NOT NULL DEFAULT '{
    "quiz_mode": "multiple_choice",
    "question_count": 10,
    "question_pool_size": 30,
    "passing_score": 70,
    "max_attempts": null,
    "cooldown_minutes": 0,
    "shuffle_questions": true,
    "shuffle_options": true,
    "show_feedback_immediately": true
  }'::jsonb,

  -- Display
  icon TEXT,
  cover_image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,

  -- Status (expanded for builder workflow)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'outline', 'generating', 'review', 'published', 'archived')),

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

CREATE INDEX idx_courses_group_status ON public.courses(group_id, status);
CREATE INDEX idx_courses_sort ON public.courses(group_id, sort_order);
CREATE INDEX idx_courses_program ON public.courses(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX idx_courses_type ON public.courses(course_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: course_sections (rebuilt with JSONB elements array)
-- Each section (lesson) stores content as a JSONB array of elements.
-- Elements are typed objects: content, feature (6 variants), media
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.course_sections (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT DEFAULT '',
  description_es TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 5,

  -- The element array (the core of the Course Builder)
  -- Array of CourseElement objects: content, feature, media
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- CHECK: elements must be a JSON array
  CONSTRAINT course_sections_elements_is_array
    CHECK (jsonb_typeof(elements) = 'array'),

  -- Source material references (which DB records were used to generate this section)
  -- Array of {table: string, id: string, content_hash: string}
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section type
  section_type TEXT NOT NULL DEFAULT 'lesson'
    CHECK (section_type IN ('overview', 'lesson', 'quiz', 'summary')),

  -- Generation status (tracks AI build progress)
  generation_status TEXT NOT NULL DEFAULT 'empty'
    CHECK (generation_status IN ('empty', 'outline', 'generating', 'generated', 'reviewed')),

  -- AI instructions (builder-level instructions for this section)
  ai_instructions TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(course_id, slug)
);

CREATE INDEX idx_course_sections_course ON public.course_sections(course_id, sort_order);
CREATE INDEX idx_course_sections_group ON public.course_sections(group_id);
-- GIN index on elements for JSONB queries (e.g., finding elements by key)
CREATE INDEX idx_course_sections_elements ON public.course_sections USING GIN(elements);
-- GIN index on source_refs for change detection queries
CREATE INDEX idx_course_sections_source_refs ON public.course_sections USING GIN(source_refs);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS: Reuse shared set_updated_at() (NOT recreated)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_training_programs_updated_at
  BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_course_sections_updated_at
  BEFORE UPDATE ON public.course_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: Enable on all 3 tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;

-- ─── training_programs RLS (5 policies) ────────────────────────────────────

-- Staff see published + coming_soon programs in their group
CREATE POLICY "Users can view programs in their group"
  ON public.training_programs FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id() AND status IN ('published', 'coming_soon'));

-- Managers/admins see ALL programs (including drafts) in their group
CREATE POLICY "Managers can view all programs in their group"
  ON public.training_programs FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can insert programs"
  ON public.training_programs FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update programs"
  ON public.training_programs FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Admins can delete programs"
  ON public.training_programs FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() = 'admin');

-- ─── courses RLS (5 policies) ──────────────────────────────────────────────

-- Staff see published + archived courses in their group
CREATE POLICY "Users can view published courses"
  ON public.courses FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id() AND status IN ('published', 'archived'));

-- Managers/admins see ALL courses (including draft, outline, generating, review)
CREATE POLICY "Managers can view all courses"
  ON public.courses FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can insert courses"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update courses"
  ON public.courses FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Admins can delete courses"
  ON public.courses FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() = 'admin');

-- ─── course_sections RLS (5 policies) ──────────────────────────────────────

-- Staff see sections of published/archived courses via parent course status
CREATE POLICY "Users can view published course sections"
  ON public.course_sections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
        AND c.status IN ('published', 'archived')
    )
  );

-- Managers/admins see ALL sections via parent course group membership
CREATE POLICY "Managers can view all course sections"
  ON public.course_sections FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Managers can insert course sections"
  ON public.course_sections FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Managers can update course sections"
  ON public.course_sections FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Admins can delete course sections"
  ON public.course_sections FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );
