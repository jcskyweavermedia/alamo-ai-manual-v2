-- Depth Signal Propagation: Make course-content-writer prompt depth-agnostic.
-- Replace the hardcoded "flowing, engaging prose" instruction with depth-aware guidance
-- so the user message's DEPTH CONSTRAINTS take precedence.

UPDATE public.ai_prompts
SET prompt_en = replace(
  prompt_en,
  'Write complete bilingual training content for this ONE section:
- content_en: Flowing, engaging prose in English. Professional but approachable tone.
- content_es: Complete Spanish translation (not machine-translated — natural Spanish).
- teaching_notes: Brief instructor guidance (key points to emphasize, common mistakes, demo suggestions).',
  'Write complete training content for this ONE section, following the DEPTH CONSTRAINTS provided in the user message:
- content_en: Training content in English. Adjust length, format, and density per the depth tier. Professional but approachable tone.
- teaching_notes: Brief instructor guidance (key points to emphasize, common mistakes, demo suggestions).'
)
WHERE slug = 'course-content-writer';
