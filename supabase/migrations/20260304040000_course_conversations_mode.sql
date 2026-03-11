-- Add mode column to course_conversations
ALTER TABLE public.course_conversations
  ADD COLUMN IF NOT EXISTS mode text
  CHECK (mode IN ('teach_me', 'quiz_me'));
