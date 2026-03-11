-- Add mode column to tutor_sessions
ALTER TABLE public.tutor_sessions
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'quiz_me'
  CHECK (mode IN ('quiz_me', 'practice_questions', 'practice_tutor'));
