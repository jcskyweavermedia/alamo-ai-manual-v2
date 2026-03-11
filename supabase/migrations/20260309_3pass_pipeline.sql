-- =============================================================================
-- 3-Pass Course Builder Pipeline
-- Adds page_header_data column, expands generation_status, seeds prompts & costs.
-- =============================================================================

-- 1. Add page_header_data to courses (with type constraint)
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS page_header_data JSONB DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_page_header_data_is_object'
  ) THEN
    ALTER TABLE public.courses
    ADD CONSTRAINT courses_page_header_data_is_object
    CHECK (page_header_data IS NULL OR jsonb_typeof(page_header_data) = 'object');
  END IF;
END
$$;

-- 2. Expand generation_status CHECK to include new statuses
ALTER TABLE public.course_sections
  DROP CONSTRAINT IF EXISTS course_sections_generation_status_check;
ALTER TABLE public.course_sections
  ADD CONSTRAINT course_sections_generation_status_check
  CHECK (generation_status IN (
    'empty', 'outline', 'planned', 'prose_ready', 'prose_error',
    'generating', 'generated', 'incomplete', 'reviewed'
  ));

-- 3. New prompt: course-structure-planner (Pass 1)
INSERT INTO public.ai_prompts (slug, category, domain, is_active, prompt_en)
VALUES (
  'course-structure-planner', 'system', NULL, true,
  E'You are a course structure planner for a restaurant training platform.\n\nGiven source material (manual sections, product data), design a course structure:\n1. Create a compelling page_header (hero block) with badge, title (use | for light|bold split), tagline, and icon.\n2. Divide the material into logical sections (3-8 sections typically).\n3. Write a 2-3 sentence brief for each section describing what it should cover and the angle to take.\n4. Provide source_hints: which source documents (by table:id) are most relevant to each section.\n\nKeep titles concise and engaging. Briefs should be specific enough to guide a content writer but not prescriptive about wording.\n\nReturn JSON matching the schema.'
)
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  is_active = EXCLUDED.is_active;

-- 4. New prompt: course-content-writer (Pass 2 — per-section)
INSERT INTO public.ai_prompts (slug, category, domain, is_active, prompt_en)
VALUES (
  'course-content-writer', 'system', NULL, true,
  E'You are an expert hospitality training content writer for a restaurant training platform.\n\nYou will receive:\n- A WRITING BRIEF describing what this section should cover\n- SOURCE MATERIAL with factual content to draw from (DO NOT hallucinate — only use facts from the source material)\n- Optionally, RELATED CONTEXT with supplementary data (wine pairings, steps of service, similar dishes)\n\nWrite complete bilingual training content for this ONE section:\n- content_en: Flowing, engaging prose in English. Professional but approachable tone.\n- content_es: Complete Spanish translation (not machine-translated — natural Spanish).\n- teaching_notes: Brief instructor guidance (key points to emphasize, common mistakes, demo suggestions).\n\nThe restaurant follows a structured Steps of Service flow. When writing about how to present, serve, or upsell menu items, reference the appropriate service step. Managers commonly refer to these as "Step 1" (greeting), "Step 2" (beverage/appetizer), etc. If steps of service data is provided in the RELATED CONTEXT, weave it naturally into the training content.\n\nFocus on practical, actionable training content. Include specific details from the source material.\n\nReturn JSON matching the schema.'
)
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  is_active = EXCLUDED.is_active;

-- 5. Credit cost for structure_plan (Pass 1)
INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description)
VALUES (NULL, 'course_builder', 'structure_plan', 1, 'Pass 1 structure planning (1 lightweight call)')
ON CONFLICT (domain, action_type) WHERE group_id IS NULL
DO UPDATE SET credits = EXCLUDED.credits, description = EXCLUDED.description;

-- 6. Credit cost for content_write (Pass 2 per-section)
INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description)
VALUES (NULL, 'course_builder', 'content_write', 1, 'Pass 2 content writing per section')
ON CONFLICT (domain, action_type) WHERE group_id IS NULL
DO UPDATE SET credits = EXCLUDED.credits, description = EXCLUDED.description;
