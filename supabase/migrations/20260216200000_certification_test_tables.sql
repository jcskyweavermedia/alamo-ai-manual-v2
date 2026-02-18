-- ============================================================================
-- Migration: Certification Test & Practice Tutor Tables
-- Creates module_test_attempts, module_test_answers, tutor_sessions
-- Adds quiz_questions.course_id, course_enrollments.module_test_attempts
-- Updates evaluations eval_type CHECK constraint
-- ============================================================================

-- ============================================================================
-- 1. module_test_attempts
-- ============================================================================

CREATE TABLE public.module_test_attempts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  course_id uuid NOT NULL REFERENCES public.courses(id),
  enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id),
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','abandoned')),
  total_questions integer NOT NULL DEFAULT 0,
  score integer CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  passed boolean,
  section_scores jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_test_user_course ON public.module_test_attempts(user_id, course_id);

CREATE TRIGGER set_module_test_attempts_updated_at
  BEFORE UPDATE ON public.module_test_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.module_test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_test_attempts_select_own"
  ON public.module_test_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "module_test_attempts_insert_own"
  ON public.module_test_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "module_test_attempts_update_own"
  ON public.module_test_attempts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "module_test_attempts_service_role"
  ON public.module_test_attempts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 2. module_test_answers
-- ============================================================================

CREATE TABLE public.module_test_answers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.module_test_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id),
  section_id uuid NOT NULL REFERENCES public.course_sections(id),
  selected_option text,
  is_correct boolean,
  transcription text,
  voice_score integer CHECK (voice_score IS NULL OR (voice_score >= 0 AND voice_score <= 100)),
  voice_feedback_en text,
  voice_feedback_es text,
  transcription_expires_at timestamptz,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_test_answers_attempt ON public.module_test_answers(attempt_id);

-- RLS
ALTER TABLE public.module_test_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_test_answers_select_own"
  ON public.module_test_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.module_test_attempts a
      WHERE a.id = attempt_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "module_test_answers_insert_own"
  ON public.module_test_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.module_test_attempts a
      WHERE a.id = attempt_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "module_test_answers_update_own"
  ON public.module_test_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.module_test_attempts a
      WHERE a.id = attempt_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "module_test_answers_service_role"
  ON public.module_test_answers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 3. tutor_sessions
-- ============================================================================

CREATE TABLE public.tutor_sessions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  course_id uuid NOT NULL REFERENCES public.courses(id),
  enrollment_id uuid REFERENCES public.course_enrollments(id),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions_asked integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  readiness_score integer DEFAULT 0,
  readiness_suggested boolean NOT NULL DEFAULT false,
  topics_covered text[] DEFAULT '{}'::text[],
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_sessions_user_course ON public.tutor_sessions(user_id, course_id);

CREATE TRIGGER set_tutor_sessions_updated_at
  BEFORE UPDATE ON public.tutor_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor_sessions_select_own"
  ON public.tutor_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tutor_sessions_insert_own"
  ON public.tutor_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tutor_sessions_update_own"
  ON public.tutor_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "tutor_sessions_service_role"
  ON public.tutor_sessions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 4. Column additions
-- ============================================================================

-- quiz_questions: add course_id for module-test-level questions
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_course ON public.quiz_questions(course_id) WHERE course_id IS NOT NULL;

-- course_enrollments: track module test attempt count
ALTER TABLE public.course_enrollments ADD COLUMN IF NOT EXISTS module_test_attempts integer NOT NULL DEFAULT 0;

-- evaluations: update eval_type CHECK constraint to add 'module_test'
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_eval_type_check;
ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_eval_type_check
  CHECK (eval_type IN ('session', 'quiz', 'course_final', 'module_test'));
