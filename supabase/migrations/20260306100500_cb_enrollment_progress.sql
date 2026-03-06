-- =============================================================================
-- Course Builder Phase 5A: ENROLLMENT & PROGRESS TABLES
-- Creates 4 tables + auto-sync trigger for the Course Player:
--   1. course_enrollments  (student enrollment tracking)
--   2. section_progress    (per-section completion tracking)
--   3. program_enrollments (program-level enrollment roll-up)
--   4. course_conversations (persistent chat history, 90-day expiry)
--
-- All tables use:
--   - extensions.gen_random_uuid() for PKs
--   - set_updated_at() trigger (shared, NOT recreated)
--   - RLS enabled with get_user_group_id() and get_user_role()
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE 1: course_enrollments
-- Student enrollment tracking with progress counters and final assessment
-- ---------------------------------------------------------------------------

CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'in_progress', 'completed', 'expired')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Progress tracking
  total_sections INTEGER NOT NULL DEFAULT 0,
  completed_sections INTEGER NOT NULL DEFAULT 0,

  -- Final assessment
  final_score INTEGER CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 100)),
  final_passed BOOLEAN,

  -- Tracks which version of the course the student enrolled in
  course_version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_course_enrollments_user_status ON public.course_enrollments(user_id, status);
CREATE INDEX idx_course_enrollments_course_status ON public.course_enrollments(course_id, status);
CREATE INDEX idx_course_enrollments_group ON public.course_enrollments(group_id);
CREATE INDEX idx_course_enrollments_expiry ON public.course_enrollments(expires_at)
  WHERE expires_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- TABLE 2: section_progress
-- Per-section completion tracking for students
-- ---------------------------------------------------------------------------

CREATE TABLE public.section_progress (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),

  -- Element engagement (element keys the student has viewed)
  elements_viewed TEXT[] NOT NULL DEFAULT '{}',
  elements_total INTEGER NOT NULL DEFAULT 0,

  -- Quiz results (if section has a quiz)
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

CREATE INDEX idx_section_progress_user_status ON public.section_progress(user_id, status);
CREATE INDEX idx_section_progress_section ON public.section_progress(section_id);
CREATE INDEX idx_section_progress_enrollment ON public.section_progress(enrollment_id);

-- ---------------------------------------------------------------------------
-- TABLE 3: program_enrollments
-- Program-level enrollment roll-up (auto-synced from course completions)
-- ---------------------------------------------------------------------------

CREATE TABLE public.program_enrollments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'in_progress', 'completed')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Progress tracking
  total_courses INTEGER NOT NULL DEFAULT 0,
  completed_courses INTEGER NOT NULL DEFAULT 0,

  -- Overall score (weighted average of course final_scores)
  overall_score INTEGER CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, program_id)
);

CREATE INDEX idx_program_enrollments_user_status ON public.program_enrollments(user_id, status);
CREATE INDEX idx_program_enrollments_program ON public.program_enrollments(program_id);
CREATE INDEX idx_program_enrollments_group ON public.program_enrollments(group_id);

-- ---------------------------------------------------------------------------
-- TABLE 4: course_conversations
-- Persistent chat history for training sessions (90-day expiry, flagged kept indefinitely)
-- ---------------------------------------------------------------------------

CREATE TABLE public.course_conversations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,

  -- Chat messages stored as JSONB array:
  -- [{ role: 'user'|'assistant', content: string, timestamp: ISO8601 }]
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- AI-generated summary and metadata
  session_summary TEXT,
  topics_discussed TEXT[] NOT NULL DEFAULT '{}',

  -- Flagging mechanism (manager-flagged conversations kept indefinitely)
  is_flagged BOOLEAN NOT NULL DEFAULT false,
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
CREATE INDEX idx_course_conversations_course ON public.course_conversations(course_id);
CREATE INDEX idx_course_conversations_expiry ON public.course_conversations(expires_at)
  WHERE is_flagged = false;

-- ---------------------------------------------------------------------------
-- TRIGGERS: Reuse shared set_updated_at() (NOT recreated)
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_course_enrollments_updated_at
  BEFORE UPDATE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_section_progress_updated_at
  BEFORE UPDATE ON public.section_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_program_enrollments_updated_at
  BEFORE UPDATE ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_course_conversations_updated_at
  BEFORE UPDATE ON public.course_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: Enable on all 4 tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_conversations ENABLE ROW LEVEL SECURITY;

-- === course_enrollments RLS (6 policies) ====================================

-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all enrollments in their group
CREATE POLICY "Managers can view group enrollments"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Users can self-enroll in published courses within their group
CREATE POLICY "Users can self-enroll"
  ON public.course_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND group_id = public.get_user_group_id()
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_enrollments.course_id
        AND c.group_id = public.get_user_group_id()
        AND c.status = 'published'
    )
  );

-- Managers can create enrollments (for assigning courses to staff)
CREATE POLICY "Managers can create enrollments"
  ON public.course_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Users can update their own enrollments (progress tracking)
CREATE POLICY "Users can update own enrollments"
  ON public.course_enrollments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Managers can update enrollments in their group
CREATE POLICY "Managers can update group enrollments"
  ON public.course_enrollments FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- === section_progress RLS (4 policies) ======================================

-- Users can view their own progress
CREATE POLICY "Users can view own section progress"
  ON public.section_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all progress in their group (via course join)
CREATE POLICY "Managers can view group section progress"
  ON public.section_progress FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = section_progress.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Users can insert their own progress records
CREATE POLICY "Users can insert own section progress"
  ON public.section_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own progress
CREATE POLICY "Users can update own section progress"
  ON public.section_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No delete policy (preserve audit trail)

-- === program_enrollments RLS (4 policies) ===================================

-- Users can view their own program enrollments
CREATE POLICY "Users can view own program enrollments"
  ON public.program_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all program enrollments in their group
CREATE POLICY "Managers can view group program enrollments"
  ON public.program_enrollments FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Users can self-enroll in programs within their group
CREATE POLICY "Users can self-enroll in programs"
  ON public.program_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND group_id = public.get_user_group_id()
  );

-- Users can update their own program enrollments (progress tracking)
CREATE POLICY "Users can update own program enrollments"
  ON public.program_enrollments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No delete policy (preserve audit trail)

-- === course_conversations RLS (5 policies) ==================================

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
  ON public.course_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all conversations in their group
CREATE POLICY "Managers can view group conversations"
  ON public.course_conversations FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.group_memberships gm
      WHERE gm.user_id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
  ON public.course_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own conversations (append messages)
CREATE POLICY "Users can update own conversations"
  ON public.course_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Managers can update conversations to flag them
CREATE POLICY "Managers can flag conversations"
  ON public.course_conversations FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.group_memberships gm
      WHERE gm.user_id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.group_memberships gm
      WHERE gm.user_id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

-- No delete policy (managed by cleanup function)

-- ---------------------------------------------------------------------------
-- AUTO-SYNC TRIGGER: sync_program_enrollment_on_course_complete()
-- When a course enrollment's completed_sections changes, check if ALL
-- sections are complete. If the course belongs to a program, upsert
-- the program_enrollment and recalculate progress.
-- ---------------------------------------------------------------------------

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
  v_avg_score INTEGER;
  v_new_status TEXT;
BEGIN
  -- Only act when completed_sections actually changed
  IF OLD.completed_sections = NEW.completed_sections THEN
    RETURN NEW;
  END IF;

  -- Check if this course belongs to a program
  SELECT c.program_id INTO v_program_id
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  -- No program association, nothing to sync
  IF v_program_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total and completed courses in this program for this user
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE ce.status = 'completed')::INTEGER,
    COALESCE(AVG(ce.final_score) FILTER (WHERE ce.final_score IS NOT NULL), NULL)::INTEGER
  INTO v_total_courses, v_completed_courses, v_avg_score
  FROM public.courses c
  JOIN public.course_enrollments ce ON ce.course_id = c.id AND ce.user_id = NEW.user_id
  WHERE c.program_id = v_program_id;

  -- Determine program enrollment status
  IF v_completed_courses >= v_total_courses AND v_total_courses > 0 THEN
    v_new_status := 'completed';
  ELSIF v_completed_courses > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'enrolled';
  END IF;

  -- Upsert program enrollment
  INSERT INTO public.program_enrollments (
    user_id, program_id, group_id,
    status, started_at, completed_at,
    total_courses, completed_courses, overall_score
  ) VALUES (
    NEW.user_id, v_program_id, NEW.group_id,
    v_new_status,
    CASE WHEN v_new_status IN ('in_progress', 'completed') THEN COALESCE(
      (SELECT MIN(ce2.started_at) FROM public.course_enrollments ce2
       JOIN public.courses c2 ON c2.id = ce2.course_id
       WHERE ce2.user_id = NEW.user_id AND c2.program_id = v_program_id AND ce2.started_at IS NOT NULL),
      now()
    ) ELSE NULL END,
    CASE WHEN v_new_status = 'completed' THEN now() ELSE NULL END,
    v_total_courses, v_completed_courses, v_avg_score
  )
  ON CONFLICT (user_id, program_id) DO UPDATE SET
    status = EXCLUDED.status,
    started_at = COALESCE(program_enrollments.started_at, EXCLUDED.started_at),
    completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN COALESCE(EXCLUDED.completed_at, now()) ELSE NULL END,
    total_courses = EXCLUDED.total_courses,
    completed_courses = EXCLUDED.completed_courses,
    overall_score = EXCLUDED.overall_score;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_program_enrollment
  AFTER UPDATE ON public.course_enrollments
  FOR EACH ROW
  WHEN (OLD.completed_sections IS DISTINCT FROM NEW.completed_sections)
  EXECUTE FUNCTION public.sync_program_enrollment_on_course_complete();
