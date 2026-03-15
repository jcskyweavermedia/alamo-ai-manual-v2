-- =============================================================================
-- Assessment Framework Phase 1A: EVALUATIONS TABLE
-- The universal grading entity. Every assessment milestone produces one row.
-- Quiz scores, voice demos, AI conversations are inputs (signals).
-- The evaluation IS the grade.
--
-- Uses:
--   - extensions.gen_random_uuid() for PK
--   - set_updated_at() trigger (shared, NOT recreated)
--   - RLS enabled with get_user_group_id() and get_user_role()
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: evaluations
-- ---------------------------------------------------------------------------

CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),

  -- ── WHO / WHERE ───────────────────────────────────────────────────────────
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE SET NULL,
  course_id     UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  section_id    UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  group_id      UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Future-proofing: nullable, no FK (units table does not exist yet)
  unit_id       UUID,

  -- ── TYPE / SOURCE ─────────────────────────────────────────────────────────
  eval_type     TEXT NOT NULL
    CHECK (eval_type IN ('section', 'course', 'program', 'observation')),

  eval_source   TEXT NOT NULL
    CHECK (eval_source IN (
      'mc_quiz', 'voice', 'conversation', 'composite',
      'tutor', 'manager', 'rollup'
    )),

  -- ── UNIVERSAL OUTPUT (always present) ─────────────────────────────────────
  score             INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  passed            BOOLEAN NOT NULL,
  competency_level  TEXT NOT NULL
    CHECK (competency_level IN ('novice', 'competent', 'proficient', 'expert')),

  student_feedback  JSONB NOT NULL,
  -- Expected shape: { strengths: string[], areas_for_improvement: string[], encouragement: string }

  manager_feedback  JSONB NOT NULL,
  -- Expected shape: { competency_gaps: string[], recommended_actions: string[], risk_level: "low"|"medium"|"high" }

  -- ── RAW SIGNALS (varies by assessment type) ───────────────────────────────
  signals           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Shape depends on eval_source. See Universal Assessment Framework.md for schemas.

  -- ── METADATA ──────────────────────────────────────────────────────────────
  ai_model          TEXT,              -- which model generated this evaluation (NULL for deterministic)
  evaluated_by      UUID,              -- NULL = AI-generated, UUID = human evaluator
  superseded_by     UUID,              -- self-referencing; set when a retry creates a newer evaluation
  manager_notes     TEXT,              -- free-text from manager after review

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── CROSS-COLUMN CONSTRAINTS ──────────────────────────────────────────────
  CONSTRAINT chk_course_eval_has_course CHECK (eval_type != 'course' OR course_id IS NOT NULL),
  CONSTRAINT chk_section_eval_has_section CHECK (eval_type != 'section' OR section_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Current (non-superseded) evaluation for a user+section — the most common query
-- NOT unique: the AFTER INSERT trigger handles superseding the old row.
-- A brief window exists where two non-superseded rows coexist (between INSERT
-- and trigger execution), which would cause a UNIQUE constraint violation.
CREATE INDEX idx_evaluations_user_section_current
  ON public.evaluations(user_id, section_id)
  WHERE superseded_by IS NULL AND eval_type = 'section';

-- Current evaluation for a user+course
CREATE INDEX idx_evaluations_user_course_current
  ON public.evaluations(user_id, course_id)
  WHERE superseded_by IS NULL AND eval_type = 'course';

-- All evaluations for an enrollment (student progress view)
CREATE INDEX idx_evaluations_enrollment
  ON public.evaluations(enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- Group-scoped evaluations by type (dashboard queries: grades tab, KPIs)
CREATE INDEX idx_evaluations_group_type
  ON public.evaluations(group_id, eval_type, created_at DESC);

-- Course-scoped evaluations by type (course detail view in dashboard)
CREATE INDEX idx_evaluations_course_type
  ON public.evaluations(course_id, eval_type, created_at DESC)
  WHERE course_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------------------------------------

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- 1. Users can view their own evaluations
CREATE POLICY "Users can view own evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Managers can view all evaluations in their group
CREATE POLICY "Managers can view group evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- 3. Users can insert their own evaluations (edge function uses service role,
--    but this policy allows future client-side inserts if needed)
CREATE POLICY "Users can insert own evaluations"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Managers can insert evaluations for users in their group
--    (manager observations, manual evaluations)
CREATE POLICY "Managers can insert group evaluations"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- 5. Managers can update evaluations in their group
--    (add manager_notes, set superseded_by)
CREATE POLICY "Managers can update group evaluations"
  ON public.evaluations FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- No DELETE policy — evaluations are an audit trail. Superseded, never deleted.

-- ---------------------------------------------------------------------------
-- TRIGGER: updated_at
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
