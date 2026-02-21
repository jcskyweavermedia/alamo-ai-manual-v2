-- Fix RLS initplan performance warning on conversation_messages
-- Replace auth.uid() with (SELECT auth.uid()) so PostgreSQL evaluates once per query, not per row
-- Also wrap get_user_role() and get_user_group_id() in SELECT subqueries

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view own conversation messages" ON conversation_messages;
DROP POLICY IF EXISTS "Managers can view group conversation messages" ON conversation_messages;
DROP POLICY IF EXISTS "Users can insert own conversation messages" ON conversation_messages;

-- 2. Recreate with (SELECT ...) pattern for InitPlan optimization
CREATE POLICY "Users can view own conversation messages" ON conversation_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quiz_attempts qa
    WHERE qa.id = conversation_messages.attempt_id
      AND qa.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Managers can view group conversation messages" ON conversation_messages
  FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN course_sections cs ON cs.id = qa.section_id
      JOIN courses c ON c.id = cs.course_id
      WHERE qa.id = conversation_messages.attempt_id
        AND c.group_id = (SELECT get_user_group_id())
    )
  );

CREATE POLICY "Users can insert own conversation messages" ON conversation_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quiz_attempts qa
    WHERE qa.id = attempt_id
      AND qa.user_id = (SELECT auth.uid())
  ));
