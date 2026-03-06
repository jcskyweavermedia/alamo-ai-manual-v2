-- =============================================================================
-- Course Builder Phase 2: CREDIT COST SEEDS
-- Inserts 11 credit cost entries into the existing credit_costs table
-- for course_builder and course_player domains.
--
-- Uses ON CONFLICT for idempotency (safe to re-run).
-- System defaults use group_id = NULL, which is matched by the partial
-- unique index idx_credit_costs_system_default(domain, action_type)
-- WHERE group_id IS NULL.
-- =============================================================================

-- ─── Course Builder domain (7 entries) ─────────────────────────────────────

INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description) VALUES
  -- Outline generation: one AI call, ~4K output tokens
  (NULL, 'course_builder', 'outline',          2, 'Course outline generation (one AI call)'),
  -- Per-section content generation
  (NULL, 'course_builder', 'content_section',  1, 'Content generation per section'),
  -- Single element regeneration (per-element AI button)
  (NULL, 'course_builder', 'content_element',  1, 'Single element regeneration'),
  -- AI chat panel edit (free-text instruction)
  (NULL, 'course_builder', 'chat_edit',        1, 'AI chat panel edit'),
  -- Quiz pool generation (generates ~15 MC questions per call)
  (NULL, 'course_builder', 'quiz_pool',        3, 'Quiz question pool generation'),
  -- DALL-E image generation for educational illustrations
  (NULL, 'course_builder', 'image',            2, 'AI image generation (DALL-E)'),
  -- System-initiated rebuild (e.g., stale content detection) — free
  (NULL, 'course_builder', 'rebuild',          0, 'System-initiated content rebuild (free)')
ON CONFLICT (domain, action_type) WHERE group_id IS NULL
DO UPDATE SET
  credits = EXCLUDED.credits,
  description = EXCLUDED.description;

-- ─── Course Player domain (4 entries) ──────────────────────────────────────

INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description) VALUES
  -- AI teacher chat during section learning
  (NULL, 'course_player', 'tutor',             1, 'AI teacher chat question'),
  -- MC quiz grading is server-side, no AI needed
  (NULL, 'course_player', 'quiz_mc',           0, 'Multiple choice quiz (server-side, no AI)'),
  -- Voice quiz evaluation (Whisper transcription + AI grading)
  (NULL, 'course_player', 'quiz_voice',        1, 'Voice quiz evaluation'),
  -- Interactive AI quiz via realtime API (expensive)
  (NULL, 'course_player', 'quiz_interactive',  5, 'Interactive AI quiz session (realtime API)')
ON CONFLICT (domain, action_type) WHERE group_id IS NULL
DO UPDATE SET
  credits = EXCLUDED.credits,
  description = EXCLUDED.description;
