-- Enable quizzes on all published learning sections that have real content.
-- Sections with content_source = 'custom' (quiz-only placeholder sections) are excluded.
-- Each section gets 5 questions per quiz, 70% passing score (matches course passing_score).

UPDATE public.course_sections
SET quiz_enabled = true,
    quiz_question_count = 5,
    quiz_passing_score = 70
WHERE status = 'published'
  AND content_source != 'custom'
  AND section_type = 'learn';
