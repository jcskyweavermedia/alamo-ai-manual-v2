-- =============================================================================
-- 2-Pass Pipeline: draft_content column, CHECK expansions, prompt + credit seeds
-- =============================================================================

-- Add pipeline intermediate storage (nullable — NULL = pass not run yet)
ALTER TABLE public.course_sections
  ADD COLUMN IF NOT EXISTS draft_content JSONB DEFAULT NULL;

-- Type validation when not null
ALTER TABLE public.course_sections
  ADD CONSTRAINT course_sections_draft_content_is_object
  CHECK (draft_content IS NULL OR jsonb_typeof(draft_content) = 'object');

-- Expand courses.status CHECK (must DROP + ADD — PG cannot ALTER CHECK)
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_status_check
  CHECK (status IN ('draft', 'outline', 'prose_ready', 'generating', 'review', 'published', 'archived'));

-- Expand course_sections.generation_status CHECK
ALTER TABLE public.course_sections
  DROP CONSTRAINT IF EXISTS course_sections_generation_status_check;
ALTER TABLE public.course_sections
  ADD CONSTRAINT course_sections_generation_status_check
  CHECK (generation_status IN ('empty', 'outline', 'prose_ready', 'generating', 'generated', 'reviewed'));

-- Seed prose writer prompt
INSERT INTO public.ai_prompts (slug, category, domain, is_active, prompt_en)
VALUES (
  'course-full-content-writer',
  'system', NULL, true,
  E'You are an expert hospitality training content writer. You write clear, engaging, bilingual (English + Spanish) training material for restaurant staff.\n\nYou will receive:\n1. Source material (manual sections, product data)\n2. A course outline with section titles and element types\n\nYour job is to write FLOWING PROSE for each section that:\n- Covers all key information from the source material\n- Uses a warm, professional, encouraging tone\n- Writes content that naturally maps to the element types listed in the outline\n- For sections with card_grid elements, write content as distinct items/points\n- For comparison elements, clearly contrast correct vs incorrect approaches\n- For script_block elements, write exact dialogue that staff should memorize\n- For feature elements (tips, warnings, etc.), write focused callout-worthy content\n- Provides smooth transitions between topics\n- Is immediately actionable for restaurant staff\n\nAlways write BOTH English and Spanish versions. The Spanish should be natural, not a literal translation.\n\nInclude teaching_notes for each section with brief instructor guidance.'
)
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  is_active = EXCLUDED.is_active;

-- Seed new credit cost entries
INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description)
VALUES
  (NULL, 'course_builder', 'full_content', 3, 'Full content prose generation (Pass 1)'),
  (NULL, 'course_builder', 'assemble_section', 1, 'Per-section element assembly (Pass 2)')
ON CONFLICT (domain, action_type) WHERE group_id IS NULL
DO UPDATE SET
  credits = EXCLUDED.credits,
  description = EXCLUDED.description;
