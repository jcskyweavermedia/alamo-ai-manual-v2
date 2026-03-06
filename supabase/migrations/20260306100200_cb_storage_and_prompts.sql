-- =============================================================================
-- Course Builder Phase 2: STORAGE BUCKET + AI PROMPTS
-- Creates:
--   1. course-media storage bucket (private, 50MB limit)
--   2. 4 storage RLS policies
--   3. 3 AI prompt seeds for course building
--
-- AI prompts use category='system' with domain=NULL, which is permitted
-- by the existing ai_prompts_domain_required constraint.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET: course-media
-- Private bucket for course images and videos
-- 50MB max per file, restricted to image + video mimetypes
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-media',
  'course-media',
  false,  -- Private bucket (access via signed URLs)
  52428800,  -- 50MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE RLS POLICIES (4 policies)
-- ─────────────────────────────────────────────────────────────────────────────

-- All authenticated users can view (needed for course player)
CREATE POLICY "Authenticated users can view course media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-media');

-- Managers and admins can upload course media
CREATE POLICY "Managers can upload course media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-media'
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Managers and admins can update course media (replace files)
CREATE POLICY "Managers can update course media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-media'
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- Only admins can delete course media
CREATE POLICY "Admins can delete course media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-media'
    AND public.get_user_role() = 'admin'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- AI PROMPT SEEDS (3 prompts)
-- These are system-level prompts (no domain) for the Course Builder AI pipeline
-- ON CONFLICT DO UPDATE for idempotency (safe to re-run)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, is_active)
VALUES
  (
    'course-outline-generator', 'system', NULL,
    E'You are an expert restaurant training course designer for Alamo Prime steakhouse. Given the course type, selected source material, and admin instructions, generate a structured course outline.\n\nOUTPUT FORMAT: Return a JSON array of course sections, each containing:\n- title_en, title_es\n- description_en, description_es\n- section_type: overview | lesson | quiz | summary\n- elements: array of CourseElement outlines (type, key, title, ai_instructions, sort_order, status: \"outline\")\n\nRULES:\n1. Every course starts with an \"overview\" section and ends with a \"summary\" section.\n2. Break content into digestible 5-10 minute lessons.\n3. Include feature (callout) elements for: allergen warnings, best practices, tips, key points.\n4. Include media elements where product images exist.\n5. The ai_instructions on each element should be specific enough that another AI can generate the full content from them.\n6. For bilingual content, generate both EN and ES titles.\n7. Be thorough but concise — staff are learning on mobile devices.',
    NULL,
    true
  ),
  (
    'course-element-builder', 'system', NULL,
    E'You are generating content for a single course element in a restaurant training course at Alamo Prime steakhouse.\n\nYou will receive:\n- The element type (content, feature, media)\n- The ai_instructions for this specific element\n- The source material (complete, untruncated)\n- The course context (title, type, teacher level)\n\nRULES:\n1. Use ONLY facts from the source material. Never invent menu items, prices, temperatures, or procedures.\n2. Format as rich Markdown: headers, tables, lists, bold/italic where appropriate.\n3. For bilingual output, generate both body_en and body_es.\n4. For feature elements, match the variant (tip, caution, warning, etc.) to the content.\n5. For media elements, suggest appropriate images and provide descriptive alt_text.\n6. Keep content mobile-friendly: short paragraphs, clear headers, scannable.\n7. Match the teacher_level tone: friendly, professional, strict, or expert.',
    NULL,
    true
  ),
  (
    'quiz-pool-generator', 'system', NULL,
    E'You are generating quiz questions for a restaurant training course at Alamo Prime steakhouse.\n\nYou will receive:\n- The course content (all elements from all sections)\n- The original source material\n- The quiz configuration (mode, pool_size, difficulty distribution)\n\nRULES:\n1. Generate questions ONLY from the provided content and source material.\n2. For multiple_choice: 4 options, 1 correct. Distractors should be plausible but clearly wrong.\n3. For voice: open-ended questions that test verbal articulation (\"Describe...\", \"Explain to a guest...\").\n4. For interactive_ai: role-play scenarios with clear evaluation criteria.\n5. Distribute difficulty: ~30% easy, ~50% medium, ~20% hard.\n6. Each question must reference a specific element or source section.\n7. Bilingual: provide question_en and question_es for all questions.\n8. For MC options, provide text_en and text_es.\n9. Avoid trick questions. Test practical knowledge, not trivia.',
    NULL,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  prompt_es = EXCLUDED.prompt_es,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;
