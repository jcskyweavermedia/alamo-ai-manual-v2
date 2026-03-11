-- =============================================================================
-- Fix number_label format guidance in pass2 and rollout prompts.
-- Format: "1 — Theme" (code stamps the number, AI provides the theme via title).
-- =============================================================================

-- Pass 2: update section_header description
UPDATE public.ai_prompts
SET prompt_en = replace(
  prompt_en,
  'Required fields: number_label (e.g. "1"), title_en',
  'Required fields: number_label (code auto-stamps this from the title — AI does not need to set it), title_en'
)
WHERE slug = 'course-pass2-layout-architect';

-- Rollout outline: update number_label guidance
UPDATE public.ai_prompts
SET prompt_en = replace(
  prompt_en,
  'section_header number_label: just the number — "1", "2", "3" (no leading zeros, no theme text)',
  'section_header number_label: code auto-stamps this as "N — Theme" from the title. AI does not need to set it.'
)
WHERE slug = 'course-outline-rollout';
