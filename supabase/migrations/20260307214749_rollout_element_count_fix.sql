-- =============================================================================
-- Fix rollout element count ranges to match actual example layouts.
-- Previous: 8-15 (short) and 15-20 (fuller) — too generous.
-- Corrected: 6-10 (short) and 10-14 (fuller).
-- =============================================================================

UPDATE public.ai_prompts
SET prompt_en = replace(
  replace(
    prompt_en,
    'SHORT output (2-3 sections, 8-15 elements total)',
    'SHORT output (2 sections, 6-10 elements total)'
  ),
  'MEDIUM output (3-4 sections, 15-20 elements total)',
  'MEDIUM output (3 sections, 10-14 elements total)'
)
WHERE slug = 'course-outline-rollout';
