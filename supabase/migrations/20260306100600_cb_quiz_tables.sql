-- =============================================================================
-- Course Builder Phase 5A: QUIZ TABLES
-- Creates 4 tables + auto-flag trigger + stats function for the Quiz Engine:
--   5. quiz_questions       (question bank: MC, voice, interactive AI)
--   6. quiz_attempts        (quiz session tracking)
--   7. quiz_attempt_answers (individual answer records, append-only)
--   8. conversation_messages (interactive AI quiz chat log, append-only)
--
-- All tables use:
--   - extensions.gen_random_uuid() for PKs
--   - set_updated_at() trigger where applicable (shared, NOT recreated)
--   - RLS enabled with get_user_group_id() and get_user_role()
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE 5: quiz_questions
-- Question bank for quizzes (multiple choice, voice, interactive AI)
-- ---------------------------------------------------------------------------

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  question_type TEXT NOT NULL
    CHECK (question_type IN ('multiple_choice', 'voice', 'interactive_ai')),

  -- Question text (bilingual)
  question_en TEXT NOT NULL,
  question_es TEXT,

  -- Explanation shown after answering (bilingual)
  explanation_en TEXT,
  explanation_es TEXT,

  -- For multiple choice: [{id, text_en, text_es, correct}]
  options JSONB,

  -- For voice: rubric criteria [{criterion, points, description}]
  rubric JSONB,

  -- For interactive AI: scenario description (bilingual)
  scenario_en TEXT,
  scenario_es TEXT,
  -- Evaluation criteria for AI grading [{criterion, weight, description}]
  evaluation_criteria JSONB,

  difficulty TEXT NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- Traceability: which element generated this question
  source_element_key TEXT,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status flags
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,

  -- Analytics for auto-flagging low-quality questions
  times_shown INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  auto_flagged BOOLEAN NOT NULL DEFAULT false,

  -- Origin: AI-generated or manually created
  source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'manual')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active questions per course (most common query path)
CREATE INDEX idx_quiz_questions_course_active ON public.quiz_questions(course_id, is_active)
  WHERE is_active = true;
-- Active questions per section
CREATE INDEX idx_quiz_questions_section_active ON public.quiz_questions(section_id, is_active)
  WHERE is_active = true;
-- Auto-flagged questions (manager review queue)
CREATE INDEX idx_quiz_questions_auto_flagged ON public.quiz_questions(auto_flagged)
  WHERE auto_flagged = true;

-- ---------------------------------------------------------------------------
-- TABLE 6: quiz_attempts
-- Quiz session tracking with competency scoring
-- ---------------------------------------------------------------------------

CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,

  attempt_number INTEGER NOT NULL,

  quiz_mode TEXT NOT NULL DEFAULT 'multiple_choice'
    CHECK (quiz_mode IN ('multiple_choice', 'voice', 'interactive_ai', 'mixed')),

  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned', 'awaiting_evaluation')),

  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  passed BOOLEAN,

  -- Competency score (rolling average across attempts)
  competency_score SMALLINT NOT NULL DEFAULT 0
    CHECK (competency_score >= 0 AND competency_score <= 100),

  -- Interactive AI tracking
  questions_covered UUID[] NOT NULL DEFAULT '{}',
  teaching_moments SMALLINT NOT NULL DEFAULT 0,
  additional_questions_asked SMALLINT NOT NULL DEFAULT 0,

  -- Transcript expiry for voice/interactive modes
  transcript_expires_at TIMESTAMPTZ,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one attempt per (user, course, section, attempt_number)
-- section_id can be NULL (course-level quiz), so we need two constraints
CREATE UNIQUE INDEX idx_quiz_attempts_unique_with_section
  ON public.quiz_attempts(user_id, course_id, section_id, attempt_number)
  WHERE section_id IS NOT NULL;
CREATE UNIQUE INDEX idx_quiz_attempts_unique_without_section
  ON public.quiz_attempts(user_id, course_id, attempt_number)
  WHERE section_id IS NULL;

CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_enrollment ON public.quiz_attempts(enrollment_id);
CREATE INDEX idx_quiz_attempts_course_status ON public.quiz_attempts(course_id, status);

-- ---------------------------------------------------------------------------
-- TABLE 7: quiz_attempt_answers
-- Individual answer records for quiz attempts (APPEND-ONLY, no updated_at)
-- ---------------------------------------------------------------------------

CREATE TABLE public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,

  -- For multiple choice
  selected_option TEXT,
  is_correct BOOLEAN,

  -- For voice questions
  transcription TEXT,
  voice_score INTEGER CHECK (voice_score IS NULL OR (voice_score >= 0 AND voice_score <= 100)),
  voice_feedback_en TEXT,
  voice_feedback_es TEXT,
  transcription_expires_at TIMESTAMPTZ,

  -- Time tracking
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NOTE: No updated_at — this table is append-only (immutable answers)
);

CREATE INDEX idx_quiz_attempt_answers_attempt ON public.quiz_attempt_answers(attempt_id);
CREATE INDEX idx_quiz_attempt_answers_question ON public.quiz_attempt_answers(question_id);
CREATE INDEX idx_quiz_attempt_answers_transcription_expiry
  ON public.quiz_attempt_answers(transcription_expires_at)
  WHERE transcription_expires_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- TABLE 8: conversation_messages
-- Interactive AI quiz chat log (APPEND-ONLY, no updated_at)
-- ---------------------------------------------------------------------------

CREATE TABLE public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,

  role TEXT NOT NULL
    CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NOTE: No updated_at — append-only log
);

CREATE INDEX idx_conversation_messages_attempt_created
  ON public.conversation_messages(attempt_id, created_at);

-- ---------------------------------------------------------------------------
-- TRIGGERS: Reuse shared set_updated_at() where applicable
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_quiz_questions_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quiz_attempts_updated_at
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NOTE: No updated_at trigger on quiz_attempt_answers or conversation_messages (append-only)

-- ---------------------------------------------------------------------------
-- RLS: Enable on all 4 tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- === quiz_questions RLS (5 policies) ========================================

-- Users can view active questions for courses in their group
CREATE POLICY "Users can view active quiz questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (
    is_active = true
    AND group_id = public.get_user_group_id()
  );

-- Managers can view ALL questions (including inactive, archived, flagged)
CREATE POLICY "Managers can view all quiz questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Managers can insert questions
CREATE POLICY "Managers can insert quiz questions"
  ON public.quiz_questions FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Managers can update questions
CREATE POLICY "Managers can update quiz questions"
  ON public.quiz_questions FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Admins can delete questions
CREATE POLICY "Admins can delete quiz questions"
  ON public.quiz_questions FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );

-- === quiz_attempts RLS (4 policies) =========================================

-- Users can view their own attempts
CREATE POLICY "Users can view own quiz attempts"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Managers can view all attempts in their group (via course)
CREATE POLICY "Managers can view group quiz attempts"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = quiz_attempts.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Users can insert their own attempts
CREATE POLICY "Users can insert own quiz attempts"
  ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own attempts (complete, abandon)
CREATE POLICY "Users can update own quiz attempts"
  ON public.quiz_attempts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No delete policy (preserve audit trail)

-- === quiz_attempt_answers RLS (3 policies, NO UPDATE — immutable) ===========

-- Users can view their own answers (via attempt ownership)
CREATE POLICY "Users can view own quiz answers"
  ON public.quiz_attempt_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

-- Managers can view all answers in their group
CREATE POLICY "Managers can view group quiz answers"
  ON public.quiz_attempt_answers FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.courses c ON c.id = qa.course_id
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Users can insert their own answers (via attempt ownership)
CREATE POLICY "Users can insert own quiz answers"
  ON public.quiz_attempt_answers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

-- NOTE: No UPDATE or DELETE policies — quiz_attempt_answers is append-only

-- === conversation_messages RLS (3 policies, NO UPDATE — append-only) ========

-- Users can view messages from their own attempts
CREATE POLICY "Users can view own conversation messages"
  ON public.conversation_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = conversation_messages.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

-- Managers can view all messages in their group
CREATE POLICY "Managers can view group conversation messages"
  ON public.conversation_messages FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.courses c ON c.id = qa.course_id
      WHERE qa.id = conversation_messages.attempt_id
        AND c.group_id = public.get_user_group_id()
    )
  );

-- Users can insert messages for their own attempts
CREATE POLICY "Users can insert own conversation messages"
  ON public.conversation_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = conversation_messages.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

-- NOTE: No UPDATE or DELETE policies — conversation_messages is append-only

-- ---------------------------------------------------------------------------
-- AUTO-FLAG TRIGGER: auto_flag_quiz_questions()
-- Flags questions with >70% miss rate after 10+ shows as potentially low-quality
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_flag_quiz_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only evaluate after sufficient sample size (10+ shows)
  IF NEW.times_shown >= 10 THEN
    -- Flag if miss rate exceeds 70% (i.e., correct rate < 30%)
    IF (NEW.times_correct::NUMERIC / NEW.times_shown::NUMERIC) < 0.30 THEN
      NEW.auto_flagged := true;
    ELSE
      -- Un-flag if rate recovers above threshold
      NEW.auto_flagged := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_flag_quiz_questions
  BEFORE UPDATE OF times_shown, times_correct ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_flag_quiz_questions();

-- ---------------------------------------------------------------------------
-- FUNCTION: increment_quiz_question_stats()
-- Increments times_shown and optionally times_correct for a question.
-- Called by edge functions after a quiz answer is graded.
-- SECURITY DEFINER so it can update quiz_questions regardless of RLS.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_quiz_question_stats(
  p_question_id UUID,
  p_was_correct BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quiz_questions
  SET
    times_shown = times_shown + 1,
    times_correct = times_correct + CASE WHEN p_was_correct THEN 1 ELSE 0 END
  WHERE id = p_question_id;
END;
$$;
