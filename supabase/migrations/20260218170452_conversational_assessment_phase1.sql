-- =============================================================================
-- Phase 1: Conversational Assessment — Database Migration
-- =============================================================================
-- Addresses original issues: #2, #3, #25, #26, #29, #32-36, #40, #48, #54
-- Audit findings incorporated: C1, C2, C3, M1-M5, M7, M8
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable pg_cron for scheduled cleanup (Audit C2)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ---------------------------------------------------------------------------
-- 2. Expand quiz_attempts.status CHECK to allow 'awaiting_evaluation' (#3)
-- ---------------------------------------------------------------------------
ALTER TABLE quiz_attempts DROP CONSTRAINT quiz_attempts_status_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_status_check
  CHECK (status IN ('in_progress', 'completed', 'abandoned', 'awaiting_evaluation'));

-- ---------------------------------------------------------------------------
-- 3. Add columns to quiz_attempts — lean table, NO JSONB transcript (C1/M7)
--    Each ADD COLUMN separated from ADD CONSTRAINT for idempotency (#35)
-- ---------------------------------------------------------------------------

-- quiz_mode — standardized name (M5), replaces plan's "assessment_mode"
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS quiz_mode text NOT NULL DEFAULT 'classic';
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_quiz_mode_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_quiz_mode_check
  CHECK (quiz_mode IN ('classic', 'conversation'));

-- questions_covered as UUID[] not TEXT[] (#32)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS questions_covered uuid[] DEFAULT '{}';

-- competency_score — SMALLINT + range check (#33)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS competency_score smallint DEFAULT 0;
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_competency_score_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_competency_score_check
  CHECK (competency_score >= 0 AND competency_score <= 100);

-- Counter columns with non-negative checks (#34)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS teaching_moments smallint DEFAULT 0;
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_teaching_moments_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_teaching_moments_check
  CHECK (teaching_moments >= 0);

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS additional_questions_asked smallint DEFAULT 0;
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_additional_questions_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_additional_questions_check
  CHECK (additional_questions_asked >= 0);

-- Transcript retention — DEFAULT NULL so classic rows are unaffected (M1)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS transcript_expires_at timestamptz DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 4. Create conversation_messages child table (C1 — replaces JSONB column)
--    One row per message — avoids MVCC bloat from JSONB append pattern
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_messages_role_check
    CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_attempt
  ON conversation_messages(attempt_id, created_at);

-- RLS
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversation messages" ON conversation_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quiz_attempts qa
    WHERE qa.id = conversation_messages.attempt_id AND qa.user_id = auth.uid()
  ));

CREATE POLICY "Managers can view group conversation messages" ON conversation_messages
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN course_sections cs ON cs.id = qa.section_id
      JOIN courses c ON c.id = cs.course_id
      WHERE qa.id = conversation_messages.attempt_id
        AND c.group_id = get_user_group_id()
    )
  );

CREATE POLICY "Users can insert own conversation messages" ON conversation_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quiz_attempts qa
    WHERE qa.id = attempt_id AND qa.user_id = auth.uid()
  ));

-- No UPDATE or DELETE policies — messages are append-only, immutable

-- ---------------------------------------------------------------------------
-- 5. Feature flag on course_sections (#48) + race condition tracking (M2)
-- ---------------------------------------------------------------------------
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS quiz_mode text NOT NULL DEFAULT 'classic';
ALTER TABLE course_sections DROP CONSTRAINT IF EXISTS course_sections_quiz_mode_check;
ALTER TABLE course_sections ADD CONSTRAINT course_sections_quiz_mode_check
  CHECK (quiz_mode IN ('classic', 'conversation'));

ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS quiz_mode_changed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 6. Backfill existing rows (#54)
-- ---------------------------------------------------------------------------
UPDATE quiz_attempts SET quiz_mode = 'classic' WHERE quiz_mode IS NULL;

-- ---------------------------------------------------------------------------
-- 7. Indexes (#25, #36, M4)
-- ---------------------------------------------------------------------------

-- Primary access pattern: find user's active conversation assessment
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_conversation
  ON quiz_attempts(user_id, section_id, status)
  WHERE quiz_mode = 'conversation';

-- Cleanup query: find expired transcripts
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_transcript_expires
  ON quiz_attempts(transcript_expires_at)
  WHERE transcript_expires_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 8. Seed AI prompts (#2) — category='system', domain=NULL satisfies all CHECKs
--    ON CONFLICT updates all mutable columns (M3)
-- ---------------------------------------------------------------------------
INSERT INTO ai_prompts (slug, category, domain, prompt_en, prompt_es, is_active)
VALUES
  (
    'assessment-conductor', 'system', NULL,
    E'You are a friendly but thorough restaurant training assessor for Alamo Prime steakhouse. Your job is to evaluate a trainee''s knowledge through natural conversation.\n\nRULES:\n1. Ask ONE question at a time, conversationally. Never list multiple questions.\n2. Cover all provided ASSESSMENT TOPICS systematically.\n3. If the trainee gives a wrong or incomplete answer, gently teach the correct information (teaching moment), then move on to the next topic.\n4. Track which topics have been adequately covered based on their responses.\n5. After covering all topics (or hitting the exchange limit), set wrap_up=true.\n6. CRITICAL: Only reference facts from the TRAINING CONTENT provided. Never invent menu items, temperatures, prices, or procedures. If unsure, ask the trainee rather than stating potentially incorrect info.\n7. Be encouraging but honest. Acknowledge good answers specifically.\n8. Keep responses concise — this is mobile-first, 2-3 sentences max per reply.\n9. Score competency_score as a running estimate (0-100) of demonstrated knowledge so far.\n\nLANGUAGE: Respond in the same language as the trainee''s messages.',
    E'Eres un evaluador de capacitaci\u00f3n amigable pero riguroso para el restaurante Alamo Prime steakhouse. Tu trabajo es evaluar el conocimiento del aprendiz a trav\u00e9s de una conversaci\u00f3n natural.\n\nREGLAS:\n1. Haz UNA pregunta a la vez, de forma conversacional. Nunca listes m\u00faltiples preguntas.\n2. Cubre todos los TEMAS DE EVALUACI\u00d3N proporcionados de manera sistem\u00e1tica.\n3. Si el aprendiz da una respuesta incorrecta o incompleta, ense\u00f1a gentilmente la informaci\u00f3n correcta (momento de ense\u00f1anza), luego contin\u00faa al siguiente tema.\n4. Registra qu\u00e9 temas han sido cubiertos adecuadamente seg\u00fan sus respuestas.\n5. Despu\u00e9s de cubrir todos los temas (o alcanzar el l\u00edmite de intercambios), establece wrap_up=true.\n6. CR\u00cdTICO: Solo referencia datos del CONTENIDO DE CAPACITACI\u00d3N proporcionado. Nunca inventes platillos, temperaturas, precios o procedimientos. Si no est\u00e1s seguro, pregunta al aprendiz.\n7. S\u00e9 alentador pero honesto. Reconoce las buenas respuestas espec\u00edficamente.\n8. Mant\u00e9n las respuestas concisas — esto es m\u00f3vil primero, m\u00e1ximo 2-3 oraciones por respuesta.\n9. Califica competency_score como una estimaci\u00f3n continua (0-100) del conocimiento demostrado hasta ahora.\n\nIDIOMA: Responde en el mismo idioma que los mensajes del aprendiz.',
    true
  ),
  (
    'conversation-evaluator', 'system', NULL,
    E'You are evaluating a restaurant training conversation between an AI assessor and a trainee at Alamo Prime steakhouse. Review the full conversation transcript and provide a comprehensive evaluation.\n\nSCORING GUIDELINES:\n- Score the trainee''s DEMONSTRATED KNOWLEDGE, not the conversation path.\n- Two trainees who demonstrate the same understanding should receive the same score, regardless of how many questions were asked or which path the conversation took.\n- 90-100: Expert \u2014 deep understanding, can explain nuances and edge cases\n- 75-89: Proficient \u2014 solid knowledge, minor gaps only\n- 60-74: Competent \u2014 basic understanding, some significant gaps\n- 0-59: Novice \u2014 fundamental gaps, needs more training\n\nCOMPETENCY LEVELS:\n- expert: Exceptional knowledge, could train others\n- proficient: Meets all requirements confidently\n- competent: Meets minimum requirements with gaps\n- novice: Below minimum requirements\n\nBe fair, constructive, and specific in feedback. Reference actual moments from the conversation when possible. Separate student-facing feedback (encouraging, actionable) from manager-facing feedback (objective, risk-focused).',
    E'Est\u00e1s evaluando una conversaci\u00f3n de capacitaci\u00f3n entre un evaluador de IA y un aprendiz en el restaurante Alamo Prime steakhouse. Revisa la transcripci\u00f3n completa de la conversaci\u00f3n y proporciona una evaluaci\u00f3n integral.\n\nGU\u00cdAS DE PUNTUACI\u00d3N:\n- Califica el CONOCIMIENTO DEMOSTRADO del aprendiz, no el camino de la conversaci\u00f3n.\n- Dos aprendices que demuestran el mismo entendimiento deben recibir la misma puntuaci\u00f3n, sin importar cu\u00e1ntas preguntas se hicieron o qu\u00e9 camino tom\u00f3 la conversaci\u00f3n.\n- 90-100: Experto \u2014 comprensi\u00f3n profunda, puede explicar matices y casos especiales\n- 75-89: Competente avanzado \u2014 conocimiento s\u00f3lido, solo brechas menores\n- 60-74: Competente \u2014 comprensi\u00f3n b\u00e1sica, algunas brechas significativas\n- 0-59: Novato \u2014 brechas fundamentales, necesita m\u00e1s capacitaci\u00f3n\n\nNIVELES DE COMPETENCIA:\n- expert: Conocimiento excepcional, podr\u00eda capacitar a otros\n- proficient: Cumple todos los requisitos con confianza\n- competent: Cumple los requisitos m\u00ednimos con brechas\n- novice: Por debajo de los requisitos m\u00ednimos\n\nS\u00e9 justo, constructivo y espec\u00edfico en la retroalimentaci\u00f3n. Haz referencia a momentos reales de la conversaci\u00f3n cuando sea posible. Separa la retroalimentaci\u00f3n para el estudiante (alentadora, accionable) de la retroalimentaci\u00f3n para el gerente (objetiva, enfocada en riesgo).',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  prompt_es = EXCLUDED.prompt_es,
  category = EXCLUDED.category,
  domain = EXCLUDED.domain,
  is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 9. Extend cleanup function — FULL existing body preserved (C3)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_training_data()
RETURNS void AS $$
BEGIN
  -- [EXISTING] Delete expired conversations (only non-flagged ones)
  DELETE FROM public.course_conversations
  WHERE expires_at < now() AND is_flagged = false;

  -- [EXISTING] Redact expired voice transcriptions (privacy compliance)
  UPDATE public.quiz_attempt_answers
  SET transcription = NULL
  WHERE transcription_expires_at IS NOT NULL
    AND transcription_expires_at < now()
    AND transcription IS NOT NULL;

  -- [EXISTING] Expire rollouts past their expiry date and mark overdue assignments
  PERFORM public.expire_rollouts();

  -- [NEW] Delete expired conversation messages
  DELETE FROM public.conversation_messages
  WHERE attempt_id IN (
    SELECT id FROM public.quiz_attempts
    WHERE transcript_expires_at IS NOT NULL
      AND transcript_expires_at < now()
  );

  -- [NEW] Clear expiry marker after cleanup
  UPDATE public.quiz_attempts
  SET transcript_expires_at = NULL
  WHERE transcript_expires_at IS NOT NULL
    AND transcript_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- 10. Schedule cleanup via pg_cron — daily at 2 AM UTC (C2)
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'cleanup-training-data',
  '0 2 * * *',
  'SELECT public.cleanup_expired_training_data()'
);

-- ---------------------------------------------------------------------------
-- 11. Documentation comments (#40)
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN quiz_attempts.quiz_mode IS
  'classic = flashcard quiz (answers in quiz_attempt_answers), conversation = AI chat (messages in conversation_messages table, zero rows in quiz_attempt_answers)';

COMMENT ON TABLE conversation_messages IS
  'Normalized child table for conversational assessment transcripts. One row per message. Replaces JSONB approach for better MVCC performance and partial reads.';

COMMENT ON COLUMN quiz_attempts.transcript_expires_at IS
  'NULL for classic attempts. Set to now() + 90 days when creating conversation attempts. After expiry, conversation_messages rows are deleted by cleanup_expired_training_data().';

COMMENT ON COLUMN course_sections.quiz_mode IS
  'Feature flag: classic = flashcard quiz, conversation = AI chat assessment.';

COMMENT ON COLUMN course_sections.quiz_mode_changed_at IS
  'Tracks last quiz_mode change. Used to detect stranded in-progress conversation attempts after a mode switch.';
