-- =============================================================================
-- Wizard Depth Selector: AI prompt + credit cost seeds
-- Seeds:
--   1. course-depth-preview prompt in ai_prompts (system category, no domain)
--   2. depth_preview credit cost in credit_costs (course_builder domain, free)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- AI PROMPT: course-depth-preview
-- Used by the Wizard Depth Selector to generate three depth tiers (quick,
-- standard, deep) given menu items or training material.
-- Model + temperature stored in tools_config JSONB for edge function lookup.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.ai_prompts (slug, category, domain, is_active, prompt_en, tools_config)
VALUES (
  'course-depth-preview',
  'system',
  NULL,
  true,
  E'You are a course architect for a restaurant training platform (Alamo Prime steakhouse).\n\nGiven menu items or training material, describe three depth tiers for a training course. Be specific to the actual items provided — reference real dish names, ingredients, and techniques from the source material.\n\nThe three tiers are:\n\n1. **quick** (1-3 sections): A fast briefing covering key highlights only.\n2. **standard** (3-6 sections): A well-rounded staff training course.\n3. **deep** (5-9 sections): A comprehensive deep-dive with advanced topics.\n\nFor each tier, provide:\n- A one-sentence summary describing what staff will learn at that depth.\n- A list of section topic labels (short labels, not full sentences).\n\nKeep summaries concise (one sentence each). Keep topic labels short (2-5 words each).\n\nReturn JSON matching the requested schema.',
  '{"model": "claude-sonnet-4-5-20250514", "temperature": 0.4}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- CREDIT COST: depth_preview (free preview — lightweight call)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description)
VALUES (
  NULL,
  'course_builder',
  'depth_preview',
  0,
  'Depth Preview (free)'
)
ON CONFLICT (domain, action_type) WHERE group_id IS NULL
DO NOTHING;
