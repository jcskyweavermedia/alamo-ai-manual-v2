-- =============================================================================
-- MIGRATION: create_training_system_phase1
-- Creates 12 training system tables + helper functions + RLS + indexes + triggers
-- Training System Phase 1
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS (for RLS policies)
-- ─────────────────────────────────────────────────────────────────────────────

-- Get the group_id for the current authenticated user
-- Used by RLS policies that need group-scoped access
CREATE OR REPLACE FUNCTION public.get_user_group_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.group_id
  FROM public.group_memberships gm
  WHERE gm.user_id = auth.uid()
  LIMIT 1;
$$;

-- Get the role for the current authenticated user
-- Used by RLS policies that need role-based access control
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.role::text
  FROM public.group_memberships gm
  WHERE gm.user_id = auth.uid()
  LIMIT 1;
$$;

-- Reusable updated_at trigger function (with search_path set for security)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: courses
-- Course definitions (e.g., "Wine Service 101", "Plate Specifications")
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT,
  description_es TEXT,

  icon TEXT, -- Lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,

  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  passing_score INTEGER NOT NULL DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),

  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

CREATE INDEX idx_courses_group_status ON public.courses(group_id, status) WHERE status = 'published';
CREATE INDEX idx_courses_sort ON public.courses(group_id, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: course_sections
-- Sections within a course, linked to content sources
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.course_sections (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT NOT NULL DEFAULT '',
  description_es TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),

  -- Content source configuration
  content_source TEXT NOT NULL CHECK (content_source IN (
    'manual_sections',
    'foh_plate_specs',
    'plate_specs',
    'prep_recipes',
    'wines',
    'cocktails',
    'beer_liquor_list',
    'custom'
  )),
  content_ids UUID[] NOT NULL DEFAULT '{}', -- Array of IDs from the source table
  content_filter JSONB, -- Optional filter criteria (e.g., {"status": "published", "tags": ["vegetarian"]})

  section_type TEXT NOT NULL DEFAULT 'learn' CHECK (section_type IN ('learn', 'practice', 'quiz', 'overview')),

  -- AI configuration for this section
  ai_prompt_en TEXT,
  ai_prompt_es TEXT,

  -- Quiz settings
  quiz_enabled BOOLEAN NOT NULL DEFAULT false,
  quiz_question_count INTEGER DEFAULT 5,
  quiz_passing_score INTEGER DEFAULT 80 CHECK (quiz_passing_score IS NULL OR (quiz_passing_score >= 0 AND quiz_passing_score <= 100)),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(course_id, slug)
);

CREATE INDEX idx_course_sections_course ON public.course_sections(course_id, sort_order);
CREATE INDEX idx_course_sections_source ON public.course_sections(content_source);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: course_enrollments
-- Student enrollment tracking
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'expired')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Optional deadline

  -- Progress tracking
  total_sections INTEGER NOT NULL DEFAULT 0,
  completed_sections INTEGER NOT NULL DEFAULT 0,

  -- Final assessment
  final_score INTEGER CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 100)),
  final_passed BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_course_enrollments_user ON public.course_enrollments(user_id, status);
CREATE INDEX idx_course_enrollments_course ON public.course_enrollments(course_id, status);
CREATE INDEX idx_course_enrollments_expiry ON public.course_enrollments(expires_at) WHERE expires_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: section_progress
-- Per-section completion tracking for students
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.section_progress (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),

  -- Content engagement
  topics_covered INTEGER NOT NULL DEFAULT 0,
  topics_total INTEGER NOT NULL DEFAULT 0,

  -- Quiz results (if applicable)
  quiz_score INTEGER CHECK (quiz_score IS NULL OR (quiz_score >= 0 AND quiz_score <= 100)),
  quiz_passed BOOLEAN,
  quiz_attempts INTEGER NOT NULL DEFAULT 0,

  -- Time tracking
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,

  -- Content versioning (detect if content changed since completion)
  content_hash_at_completion TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, section_id)
);

CREATE INDEX idx_section_progress_user ON public.section_progress(user_id, status);
CREATE INDEX idx_section_progress_section ON public.section_progress(section_id);
CREATE INDEX idx_section_progress_enrollment ON public.section_progress(enrollment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 5: course_conversations
-- Persistent chat history for training sessions (90-day expiry, flagged kept indefinitely)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.course_conversations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE SET NULL,

  -- Chat messages stored as JSONB array: [{ role: 'user'|'assistant', content: string, timestamp: ISO8601 }]
  messages JSONB NOT NULL DEFAULT '[]',

  -- AI-generated summary and metadata
  session_summary TEXT,
  topics_discussed TEXT[] DEFAULT '{}',

  -- Flagging mechanism
  is_flagged BOOLEAN NOT NULL DEFAULT false, -- Manager-flagged conversations kept indefinitely
  flagged_by UUID REFERENCES public.profiles(id),
  flagged_at TIMESTAMPTZ,
  flagged_reason TEXT,

  -- Auto-expiry (90 days unless flagged)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_conversations_user ON public.course_conversations(user_id);
CREATE INDEX idx_course_conversations_section ON public.course_conversations(section_id);
CREATE INDEX idx_course_conversations_expiry ON public.course_conversations(expires_at) WHERE is_flagged = false;
CREATE INDEX idx_course_conversations_flagged ON public.course_conversations(is_flagged, flagged_by) WHERE is_flagged = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 6: quiz_questions
-- Question bank for quizzes (multiple choice + voice response)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,

  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'voice')),

  question_en TEXT NOT NULL,
  question_es TEXT,

  -- For multiple choice questions
  options JSONB, -- Array of {id: string, text: string, correct: boolean}

  -- For voice questions
  rubric JSONB, -- Array of {criterion: string, points: number, description: string}

  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),

  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),

  -- Analytics for auto-flagging low-quality questions
  times_shown INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_questions_section ON public.quiz_questions(section_id, is_active) WHERE is_active = true;
CREATE INDEX idx_quiz_questions_type ON public.quiz_questions(question_type);
CREATE INDEX idx_quiz_questions_analytics ON public.quiz_questions(times_shown, times_correct) WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 7: quiz_attempts
-- Quiz session tracking
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,

  attempt_number INTEGER NOT NULL,

  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  passed BOOLEAN,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, section_id, attempt_number)
);

CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_section ON public.quiz_attempts(section_id, status);
CREATE INDEX idx_quiz_attempts_enrollment ON public.quiz_attempts(enrollment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 8: quiz_attempt_answers
-- Individual answer records for quiz attempts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,

  -- For multiple choice
  selected_option TEXT, -- Option ID from question.options
  is_correct BOOLEAN,

  -- For voice questions
  transcription TEXT, -- Expires after 90 days
  voice_score INTEGER CHECK (voice_score IS NULL OR (voice_score >= 0 AND voice_score <= 100)),
  voice_feedback_en TEXT, -- AI-generated feedback
  voice_feedback_es TEXT,
  transcription_expires_at TIMESTAMPTZ, -- 90 days from creation

  time_spent_seconds INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_attempt_answers_attempt ON public.quiz_attempt_answers(attempt_id);
CREATE INDEX idx_quiz_attempt_answers_question ON public.quiz_attempt_answers(question_id);
CREATE INDEX idx_quiz_attempt_answers_transcription_expiry ON public.quiz_attempt_answers(transcription_expires_at) WHERE transcription_expires_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 9: evaluations
-- AI evaluation snapshots (dual JSON: student-facing + manager-only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,

  eval_type TEXT NOT NULL CHECK (eval_type IN ('session', 'quiz', 'course_final')),

  -- Dual feedback structure
  student_feedback JSONB NOT NULL, -- Visible to student: {strengths: [], areas_for_improvement: [], encouragement: string}
  manager_feedback JSONB NOT NULL, -- Manager-only: {competency_gaps: [], recommended_actions: [], risk_level: string}

  manager_notes TEXT, -- Private notes from manager (RLS hides from students)

  competency_level TEXT CHECK (competency_level IN ('novice', 'competent', 'proficient', 'expert')),

  evaluated_by UUID REFERENCES public.profiles(id), -- NULL if AI-generated

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_user ON public.evaluations(user_id, eval_type);
CREATE INDEX idx_evaluations_enrollment ON public.evaluations(enrollment_id);
CREATE INDEX idx_evaluations_section ON public.evaluations(section_id);
CREATE INDEX idx_evaluations_type ON public.evaluations(eval_type, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 10: rollouts
-- Training package definitions (courses + sections + deadlines)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.rollouts (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Content scope
  course_ids UUID[] NOT NULL DEFAULT '{}', -- Courses included in this rollout
  section_ids UUID[] NOT NULL DEFAULT '{}', -- Optional: specific sections (if empty, all sections from courses)

  -- Timing
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ, -- Optional completion deadline
  expires_at TIMESTAMPTZ, -- Rollout becomes inactive after this date

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'expired', 'archived')),

  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rollouts_group ON public.rollouts(group_id, status);
CREATE INDEX idx_rollouts_status ON public.rollouts(status, starts_at);
CREATE INDEX idx_rollouts_deadline ON public.rollouts(deadline) WHERE deadline IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 11: rollout_assignments
-- Per-user rollout assignment (links users to rollouts)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.rollout_assignments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  rollout_id UUID NOT NULL REFERENCES public.rollouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Progress summary
  total_courses INTEGER NOT NULL DEFAULT 0,
  completed_courses INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(rollout_id, user_id)
);

CREATE INDEX idx_rollout_assignments_rollout ON public.rollout_assignments(rollout_id, status);
CREATE INDEX idx_rollout_assignments_user ON public.rollout_assignments(user_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 12: content_change_log
-- MD5 hash tracking for content versioning (detect when content changes)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.content_change_log (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),

  source_table TEXT NOT NULL CHECK (source_table IN (
    'manual_sections',
    'foh_plate_specs',
    'plate_specs',
    'prep_recipes',
    'wines',
    'cocktails',
    'beer_liquor_list',
    'course_sections'
  )),
  source_id UUID NOT NULL,

  content_hash TEXT NOT NULL, -- MD5 hash of current content
  previous_hash TEXT, -- Previous hash (for change detection)

  -- Optional acknowledgment by managers
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(source_table, source_id, content_hash)
);

CREATE INDEX idx_content_change_log_source ON public.content_change_log(source_table, source_id, created_at DESC);
CREATE INDEX idx_content_change_log_unacknowledged ON public.content_change_log(acknowledged_by) WHERE acknowledged_by IS NULL;

-- =============================================================================
-- UPDATED_AT TRIGGERS (apply set_updated_at function to all tables)
-- =============================================================================

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_course_sections_updated_at
  BEFORE UPDATE ON public.course_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_course_enrollments_updated_at
  BEFORE UPDATE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_section_progress_updated_at
  BEFORE UPDATE ON public.section_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_course_conversations_updated_at
  BEFORE UPDATE ON public.course_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quiz_questions_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quiz_attempts_updated_at
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rollouts_updated_at
  BEFORE UPDATE ON public.rollouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rollout_assignments_updated_at
  BEFORE UPDATE ON public.rollout_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_change_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES: COURSES
-- =============================================================================

-- All authenticated users can view active courses in their group
CREATE POLICY "Users can view courses in their group"
  ON public.courses FOR SELECT
  TO authenticated
  USING (group_id = public.get_user_group_id() AND status IN ('published', 'archived'));

-- Managers can insert courses in their group
CREATE POLICY "Managers can insert courses"
  ON public.courses FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id() AND
    public.get_user_role() IN ('manager', 'admin')
  );

-- Managers can update courses in their group
CREATE POLICY "Managers can update courses"
  ON public.courses FOR UPDATE
  TO authenticated
  USING (
    group_id = public.get_user_group_id() AND
    public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id() AND
    public.get_user_role() IN ('manager', 'admin')
  );

-- Admins can delete courses in their group
CREATE POLICY "Admins can delete courses"
  ON public.courses FOR DELETE
  TO authenticated
  USING (
    group_id = public.get_user_group_id() AND
    public.get_user_role() = 'admin'
  );

-- =============================================================================
-- RLS POLICIES: COURSE_SECTIONS
-- =============================================================================

-- All authenticated users can view sections for courses in their group
CREATE POLICY "Users can view course sections"
  ON public.course_sections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Managers can insert sections
CREATE POLICY "Managers can insert sections"
  ON public.course_sections FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Managers can update sections
CREATE POLICY "Managers can update sections"
  ON public.course_sections FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Admins can delete sections
CREATE POLICY "Admins can delete sections"
  ON public.course_sections FOR DELETE
  TO authenticated
  USING (
    public.get_user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- =============================================================================
-- RLS POLICIES: COURSE_ENROLLMENTS
-- =============================================================================

-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments"
  ON public.course_enrollments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all enrollments in their group
CREATE POLICY "Managers can view group enrollments"
  ON public.course_enrollments FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_enrollments.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Managers can create enrollments (for assigning courses)
CREATE POLICY "Managers can create enrollments"
  ON public.course_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_enrollments.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Users can self-enroll in published courses within their group
CREATE POLICY "Users can self-enroll"
  ON public.course_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    group_id = public.get_user_group_id() AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_enrollments.course_id
        AND c.group_id = public.get_user_group_id()
        AND c.status = 'published'
    )
  );

-- Users can update their own enrollments (progress tracking)
CREATE POLICY "Users can update own enrollments"
  ON public.course_enrollments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Managers can update enrollments in their group
CREATE POLICY "Managers can update enrollments"
  ON public.course_enrollments FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_enrollments.course_id
        AND c.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_enrollments.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- No one can delete enrollments (audit trail must be preserved)
-- Admins can do this via service role if absolutely necessary

-- =============================================================================
-- RLS POLICIES: SECTION_PROGRESS
-- =============================================================================

-- Users can view their own progress
CREATE POLICY "Users can view own progress"
  ON public.section_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all progress in their group
CREATE POLICY "Managers can view group progress"
  ON public.section_progress FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.course_sections cs
      JOIN public.courses c ON c.id = cs.course_id
      WHERE cs.id = section_progress.section_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Users can insert their own progress records
CREATE POLICY "Users can insert own progress"
  ON public.section_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
  ON public.section_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No delete policy (preserve audit trail)

-- =============================================================================
-- RLS POLICIES: COURSE_CONVERSATIONS
-- Special: Users can only see their own, managers can see all in group
-- =============================================================================

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
  ON public.course_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all conversations in their group
CREATE POLICY "Managers can view group conversations"
  ON public.course_conversations FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
  ON public.course_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON public.course_conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Managers can update conversations to flag them
CREATE POLICY "Managers can flag conversations"
  ON public.course_conversations FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

-- No delete policy (managed by cleanup function)

-- =============================================================================
-- RLS POLICIES: QUIZ_QUESTIONS
-- =============================================================================

-- All authenticated users can view active questions for sections they have access to
CREATE POLICY "Users can view quiz questions"
  ON public.quiz_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM public.course_sections cs
      JOIN public.courses c ON c.id = cs.course_id
      WHERE cs.id = quiz_questions.section_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Managers can insert questions
CREATE POLICY "Managers can insert questions"
  ON public.quiz_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.course_sections cs
      JOIN public.courses c ON c.id = cs.course_id
      WHERE cs.id = quiz_questions.section_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Managers can update questions
CREATE POLICY "Managers can update questions"
  ON public.quiz_questions FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.course_sections cs
      JOIN public.courses c ON c.id = cs.course_id
      WHERE cs.id = quiz_questions.section_id
        AND c.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.course_sections cs
      JOIN public.courses c ON c.id = cs.course_id
      WHERE cs.id = quiz_questions.section_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Admins can delete questions
CREATE POLICY "Admins can delete questions"
  ON public.quiz_questions FOR DELETE
  TO authenticated
  USING (
    public.get_user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM public.course_sections cs
      JOIN public.courses c ON c.id = cs.course_id
      WHERE cs.id = quiz_questions.section_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- =============================================================================
-- RLS POLICIES: QUIZ_ATTEMPTS
-- =============================================================================

-- Users can view their own attempts
CREATE POLICY "Users can view own attempts"
  ON public.quiz_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all attempts in their group
CREATE POLICY "Managers can view group attempts"
  ON public.quiz_attempts FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.course_sections cs
      JOIN public.courses c ON c.id = cs.course_id
      WHERE cs.id = quiz_attempts.section_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Users can insert their own attempts
CREATE POLICY "Users can insert own attempts"
  ON public.quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own attempts
CREATE POLICY "Users can update own attempts"
  ON public.quiz_attempts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No delete policy (preserve audit trail)

-- =============================================================================
-- RLS POLICIES: QUIZ_ATTEMPT_ANSWERS
-- =============================================================================

-- Users can view their own answers
CREATE POLICY "Users can view own answers"
  ON public.quiz_attempt_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

-- Managers can view all answers in their group
CREATE POLICY "Managers can view group answers"
  ON public.quiz_attempt_answers FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.course_sections cs ON cs.id = qa.section_id
      JOIN public.courses c ON c.id = cs.course_id
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Users can insert their own answers
CREATE POLICY "Users can insert own answers"
  ON public.quiz_attempt_answers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

-- Users can update their own answers (e.g., during an active attempt)
CREATE POLICY "Users can update own answers"
  ON public.quiz_attempt_answers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

-- No delete policy (preserve audit trail)

-- =============================================================================
-- RLS POLICIES: EVALUATIONS
-- Special: Students can see their own evaluations BUT manager_notes is hidden
-- (Use a VIEW or edge function to filter manager_notes for students)
-- =============================================================================

-- Users can view their own evaluations (but manager_notes should be filtered client-side or via view)
CREATE POLICY "Users can view own evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all evaluations in their group
CREATE POLICY "Managers can view group evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = evaluations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

-- Edge functions can insert evaluations (via service role)
-- Managers can also insert evaluations
CREATE POLICY "Managers can insert evaluations"
  ON public.evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = evaluations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

-- Managers can update evaluations (e.g., to add manager_notes)
CREATE POLICY "Managers can update evaluations"
  ON public.evaluations FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = evaluations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = evaluations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

-- Admins can delete evaluations
CREATE POLICY "Admins can delete evaluations"
  ON public.evaluations FOR DELETE
  TO authenticated
  USING (
    public.get_user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = evaluations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

-- =============================================================================
-- RLS POLICIES: ROLLOUTS
-- =============================================================================

-- All authenticated users can view rollouts in their group
CREATE POLICY "Users can view rollouts in their group"
  ON public.rollouts FOR SELECT
  TO authenticated
  USING (group_id = public.get_user_group_id());

-- Managers can insert rollouts
CREATE POLICY "Managers can insert rollouts"
  ON public.rollouts FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id() AND
    public.get_user_role() IN ('manager', 'admin')
  );

-- Managers can update rollouts
CREATE POLICY "Managers can update rollouts"
  ON public.rollouts FOR UPDATE
  TO authenticated
  USING (
    group_id = public.get_user_group_id() AND
    public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id() AND
    public.get_user_role() IN ('manager', 'admin')
  );

-- Admins can delete rollouts
CREATE POLICY "Admins can delete rollouts"
  ON public.rollouts FOR DELETE
  TO authenticated
  USING (
    group_id = public.get_user_group_id() AND
    public.get_user_role() = 'admin'
  );

-- =============================================================================
-- RLS POLICIES: ROLLOUT_ASSIGNMENTS
-- =============================================================================

-- Users can view their own assignments
CREATE POLICY "Users can view own assignments"
  ON public.rollout_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all assignments in their group
CREATE POLICY "Managers can view group assignments"
  ON public.rollout_assignments FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  );

-- Managers can insert assignments
CREATE POLICY "Managers can insert assignments"
  ON public.rollout_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  );

-- Users can update their own assignments (progress)
CREATE POLICY "Users can update own assignments"
  ON public.rollout_assignments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Managers can update assignments in their group
CREATE POLICY "Managers can update assignments"
  ON public.rollout_assignments FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin') AND
    EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  );

-- Admins can delete assignments
CREATE POLICY "Admins can delete assignments"
  ON public.rollout_assignments FOR DELETE
  TO authenticated
  USING (
    public.get_user_role() = 'admin' AND
    EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  );

-- =============================================================================
-- RLS POLICIES: CONTENT_CHANGE_LOG
-- =============================================================================

-- All authenticated users can view change logs (transparency about content updates)
CREATE POLICY "Users can view content change logs"
  ON public.content_change_log FOR SELECT
  TO authenticated
  USING (true);

-- Edge functions can insert change logs (via service role, or managers manually)
CREATE POLICY "Managers can insert change logs"
  ON public.content_change_log FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('manager', 'admin'));

-- Managers can update logs (to acknowledge changes)
CREATE POLICY "Managers can update change logs"
  ON public.content_change_log FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (public.get_user_role() IN ('manager', 'admin'));

-- No delete policy (audit trail)

-- =============================================================================
-- CLEANUP FUNCTION
-- Called by cron job to auto-expire conversations and transcriptions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_training_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete expired conversations (only non-flagged ones)
  DELETE FROM public.course_conversations
  WHERE expires_at < now() AND is_flagged = false;

  -- Redact expired voice transcriptions (privacy compliance)
  UPDATE public.quiz_attempt_answers
  SET transcription = NULL
  WHERE transcription_expires_at IS NOT NULL
    AND transcription_expires_at < now()
    AND transcription IS NOT NULL;
END;
$$;

-- =============================================================================
-- COMMENT: How to call cleanup function
-- =============================================================================

-- Run this via pg_cron extension (installed separately):
-- SELECT cron.schedule('cleanup-training-data', '0 2 * * *', 'SELECT public.cleanup_expired_training_data()');
-- (Runs daily at 2 AM)
