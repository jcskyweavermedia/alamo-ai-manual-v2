-- =============================================================================
-- MIGRATION: create_form_submissions
-- Creates form_submissions table + updated_at trigger + indexes + RLS policies
-- (7 group-scoped policies including subject_user_id access)
-- Phase 1 of Form Builder System
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLE: form_submissions
-- ---------------------------------------------------------------------------

CREATE TABLE public.form_submissions (
  id               UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  template_id      UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE RESTRICT,
  group_id         UUID NOT NULL REFERENCES public.groups(id),
  template_version INTEGER NOT NULL DEFAULT 1,
  fields_snapshot  JSONB,
  field_values     JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','submitted','archived')),
  filled_by        UUID NOT NULL REFERENCES public.profiles(id),
  submitted_by     UUID REFERENCES public.profiles(id),
  subject_user_id  UUID REFERENCES public.profiles(id),
  submitted_at     TIMESTAMPTZ,
  attachments      JSONB DEFAULT '[]',
  ai_session_id    TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTE: Templates with submissions cannot be hard-deleted (ON DELETE RESTRICT).
-- Use status='archived' as the soft-delete mechanism instead.

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Simple indexes for FK lookups
CREATE INDEX idx_form_submissions_template_id
  ON public.form_submissions (template_id);

CREATE INDEX idx_form_submissions_group_id
  ON public.form_submissions (group_id);

CREATE INDEX idx_form_submissions_filled_by
  ON public.form_submissions (filled_by);

CREATE INDEX idx_form_submissions_status
  ON public.form_submissions (status);

-- Composite indexes for common query patterns
CREATE INDEX idx_form_submissions_template_status_created
  ON public.form_submissions (template_id, status, created_at DESC);

CREATE INDEX idx_form_submissions_group_date
  ON public.form_submissions (group_id, created_at DESC);

CREATE INDEX idx_form_submissions_user_date
  ON public.form_submissions (filled_by, created_at DESC);

-- Partial index: "View my write-ups" queries (only index non-null subject_user_id)
CREATE INDEX idx_form_submissions_subject
  ON public.form_submissions (subject_user_id)
  WHERE subject_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER (reuses shared set_updated_at from training system)
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_form_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS POLICIES (7 policies, group-scoped)
-- form_submissions has more nuanced access than template tables:
--   SELECT: users see own + about-me + managers see group
--   INSERT: group members (filled_by = auth.uid())
--   UPDATE: own + managers/admins
--   DELETE: admin only
-- ---------------------------------------------------------------------------

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view submissions they filled
CREATE POLICY "Users can view own form_submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (filled_by = auth.uid());

-- SELECT: Users can view submissions about them (e.g., their own write-ups)
CREATE POLICY "Users can view form_submissions about them"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid());

-- SELECT: Managers/admins can view all submissions in their group
CREATE POLICY "Managers can view group form_submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- INSERT: Any authenticated user in the group can create a submission
CREATE POLICY "Users can insert form_submissions"
  ON public.form_submissions FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND filled_by = auth.uid()
  );

-- UPDATE: Users can update their own submissions
CREATE POLICY "Users can update own form_submissions"
  ON public.form_submissions FOR UPDATE TO authenticated
  USING (filled_by = auth.uid())
  WITH CHECK (filled_by = auth.uid());

-- UPDATE: Managers/admins can update any submission in their group
CREATE POLICY "Managers can update group form_submissions"
  ON public.form_submissions FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- DELETE: Admin only in the same group
CREATE POLICY "Admins can delete form_submissions"
  ON public.form_submissions FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );

COMMIT;
