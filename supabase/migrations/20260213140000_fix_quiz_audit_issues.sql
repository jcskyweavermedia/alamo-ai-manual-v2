-- Fix Phase 3 audit issues
-- 1. UNIQUE constraint on quiz_attempt_answers to prevent duplicate answers
-- 2. Add explanation columns to quiz_questions for AI-generated explanations

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Prevent duplicate answers for the same question within an attempt
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_attempt_answers
  ADD CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Store AI-generated explanations for quiz review
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS explanation_en TEXT,
  ADD COLUMN IF NOT EXISTS explanation_es TEXT;
