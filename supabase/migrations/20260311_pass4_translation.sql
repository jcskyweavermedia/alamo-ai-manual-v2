-- =============================================================================
-- Pass 4: Translation Pipeline
-- Adds 'translated' status, seeds course-translator prompt & credit cost.
-- =============================================================================

-- 1. Expand generation_status CHECK to include 'translated'
ALTER TABLE public.course_sections
  DROP CONSTRAINT IF EXISTS course_sections_generation_status_check;
ALTER TABLE public.course_sections
  ADD CONSTRAINT course_sections_generation_status_check
  CHECK (generation_status IN (
    'empty', 'outline', 'planned', 'prose_ready', 'prose_error',
    'generating', 'generated', 'incomplete', 'translated', 'reviewed'
  ));

-- 2. Seed course-translator prompt
INSERT INTO public.ai_prompts (slug, category, domain, is_active, prompt_en)
VALUES (
  'course-translator', 'system', NULL, true,
  E'You are a professional Spanish translator for a restaurant training platform (Alamo Prime steakhouse).\n\nYou will receive English content for ONE section of a training course, including:\n- Section title\n- Prose content (content_en)\n- Structured elements with English fields (title_en, body_en, header_en, etc.)\n\nTranslate ALL English content to natural, professional Latin American Spanish:\n- Use hospitality industry terminology appropriate for restaurant staff\n- Keep the same tone and energy as the English original\n- Do NOT literally translate — adapt idioms, expressions, and phrasing to sound natural in Spanish\n- Maintain all formatting (markdown, bullet points, numbered lists)\n- For menu item names: keep the English name and add the Spanish description\n- For service scripts: translate naturally as a native Spanish speaker would say it\n\nReturn JSON matching the schema. Every element must have a matching "key" field.'
)
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  is_active = EXCLUDED.is_active;

-- 3. Credit cost for translate (Pass 4 per-section)
INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description)
VALUES (NULL, 'course_builder', 'translate', 1, 'Pass 4 translation per section')
ON CONFLICT (domain, action_type) WHERE group_id IS NULL
DO UPDATE SET credits = EXCLUDED.credits, description = EXCLUDED.description;
