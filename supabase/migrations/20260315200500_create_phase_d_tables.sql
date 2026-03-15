-- =============================================================================
-- MIGRATION: Create Phase D tables
-- Phase D.1: training_actions, notifications, training_insights
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: training_actions
-- AI/manager-generated action suggestions (auto-enroll, nudge, contest, insight)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.training_actions (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Action classification
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'system',

  -- Target references (all nullable - depends on action_type)
  target_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  target_program_id UUID REFERENCES public.training_programs(id) ON DELETE SET NULL,
  target_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,

  -- Display payload (title, description, icon, etc.)
  display_data JSONB NOT NULL DEFAULT '{}',

  -- Resolution tracking
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,

  -- Expiry (default 14 days)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT training_actions_action_type_check
    CHECK (action_type IN ('auto_enroll', 'nudge', 'contest', 'insight')),
  CONSTRAINT training_actions_status_check
    CHECK (status IN ('pending', 'approved', 'skipped', 'executed', 'expired')),
  CONSTRAINT training_actions_source_check
    CHECK (source IN ('system', 'ai', 'manager'))
);

-- Indexes
CREATE INDEX idx_training_actions_group_status
  ON public.training_actions(group_id, status);
CREATE INDEX idx_training_actions_employee
  ON public.training_actions(target_employee_id);
CREATE INDEX idx_training_actions_pending_expiry
  ON public.training_actions(expires_at)
  WHERE status = 'pending';

-- updated_at trigger (reuses shared set_updated_at)
CREATE TRIGGER trg_training_actions_updated_at
  BEFORE UPDATE ON public.training_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.training_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view actions in their group"
  ON public.training_actions FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Managers can insert actions"
  ON public.training_actions FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update actions"
  ON public.training_actions FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Admins can delete actions"
  ON public.training_actions FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: notifications
-- Per-user notifications for nudges, assignments, reminders, announcements
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Notification content
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Read tracking
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT notifications_type_check
    CHECK (type IN ('nudge', 'assignment', 'reminder', 'announcement'))
);

-- Indexes
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id)
  WHERE read = false;
CREATE INDEX idx_notifications_group
  ON public.notifications(group_id);
CREATE INDEX idx_notifications_created
  ON public.notifications(created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No DELETE policy: notifications are not deletable by regular users


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: training_insights
-- Periodic AI-generated insights (team weekly, employee alerts, course health)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.training_insights (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  -- Insight classification
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',

  -- Content
  title TEXT NOT NULL,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}',

  -- Period range
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Supersession chain (newer insight replaces older)
  superseded_by UUID REFERENCES public.training_insights(id) ON DELETE SET NULL,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT training_insights_type_check
    CHECK (insight_type IN ('team_weekly', 'employee_alert', 'course_health', 'milestone')),
  CONSTRAINT training_insights_severity_check
    CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Indexes
CREATE INDEX idx_training_insights_group_type
  ON public.training_insights(group_id, insight_type);
CREATE INDEX idx_training_insights_current
  ON public.training_insights(id)
  WHERE superseded_by IS NULL;

-- RLS
ALTER TABLE public.training_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view insights in their group"
  ON public.training_insights FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- No INSERT/UPDATE/DELETE policies for regular users
-- Writes handled by SECURITY DEFINER functions
