-- Add clean persona columns to ai_teachers
-- persona_en/es contains ONLY the teacher identity text (no mode blocks, no master framing)
-- prompt_en/prompt_es are preserved as fallback during transition

ALTER TABLE public.ai_teachers
  ADD COLUMN IF NOT EXISTS persona_en text,
  ADD COLUMN IF NOT EXISTS persona_es text;
