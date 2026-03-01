-- M06: credit_costs + ai_usage_log + updated increment_usage()
-- *** HIGHEST RISK MIGRATION — modifies increment_usage() used by all AI edge functions ***
--
-- NOTE: No explicit BEGIN/COMMIT — supabase db push wraps each migration
-- in its own transaction automatically. Explicit COMMIT would terminate
-- the outer transaction prematurely and break migration tracking.

-- =============================================
-- credit_costs — Configurable per-domain/action costs
-- =============================================

CREATE TABLE public.credit_costs (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  -- NULL group_id = system-wide default; group-specific rows override

  domain          TEXT NOT NULL,
  action_type     TEXT NOT NULL DEFAULT 'default',
  credits         INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, domain, action_type)
);

-- Partial unique index for system defaults (group_id IS NULL)
CREATE UNIQUE INDEX idx_credit_costs_system_default
  ON public.credit_costs(domain, action_type)
  WHERE group_id IS NULL;

CREATE TRIGGER trg_credit_costs_updated_at
  BEFORE UPDATE ON public.credit_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit costs"
  ON public.credit_costs FOR SELECT TO authenticated
  USING (group_id IS NULL OR group_id = public.get_user_group_id());

CREATE POLICY "Admins can manage group credit costs"
  ON public.credit_costs FOR ALL TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
-- NOTE: Admins can only manage their own group's overrides, not system defaults

-- Seed system defaults
INSERT INTO public.credit_costs (group_id, domain, action_type, credits, description) VALUES
  (NULL, 'manual',     'default',     1, 'Manual AI chat question'),
  (NULL, 'dishes',     'default',     1, 'Product AI: dishes'),
  (NULL, 'wines',      'default',     1, 'Product AI: wines'),
  (NULL, 'cocktails',  'default',     1, 'Product AI: cocktails'),
  (NULL, 'recipes',    'default',     1, 'Product AI: recipes'),
  (NULL, 'beer_liquor','default',     1, 'Product AI: beer & liquor'),
  (NULL, 'training',   'default',     1, 'Training AI question'),
  (NULL, 'reviews',    'default',     1, 'Review AI chat question'),
  (NULL, 'reviews',    'weekly_brief',1, 'Review AI weekly brief'),
  (NULL, 'reviews',    'extraction',  0, 'AI review extraction (system, no user credit)'),
  (NULL, 'forms',      'default',     1, 'Form AI question');

-- =============================================
-- ai_usage_log — Per-call audit trail (append-only)
-- =============================================

CREATE TABLE public.ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  domain          TEXT NOT NULL,
  action          TEXT,
  input_mode      TEXT DEFAULT 'text' CHECK (input_mode IS NULL OR input_mode IN ('text', 'voice')),
  edge_function   TEXT,

  credits_consumed INTEGER NOT NULL DEFAULT 1,
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  model           TEXT,

  session_id      UUID,
  restaurant_id   UUID,
  metadata        JSONB DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_user_date ON public.ai_usage_log(user_id, created_at);
CREATE INDEX idx_ai_usage_log_group_domain ON public.ai_usage_log(group_id, domain, created_at);
CREATE INDEX idx_ai_usage_log_domain_action ON public.ai_usage_log(domain, action, created_at);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage log"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND group_id = public.get_user_group_id());

CREATE POLICY "Admins can view group usage log"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

-- NOTE: No INSERT/UPDATE/DELETE policies on ai_usage_log.
-- All inserts go through increment_usage() (SECURITY DEFINER) or edge functions (service role).
-- Both bypass RLS. The append-only design prevents data pollution from browser-side calls.

-- =============================================
-- Updated increment_usage() — backward compatible
-- =============================================
-- CRITICAL: DROP + CREATE required because adding parameters creates an overload,
-- not a replacement. The old 2-param signature must be removed first.

DROP FUNCTION IF EXISTS public.increment_usage(UUID, UUID);

CREATE OR REPLACE FUNCTION public.increment_usage(
  _user_id  UUID,
  _group_id UUID,
  _credits  INTEGER DEFAULT 1,
  _log      JSONB DEFAULT NULL
)
RETURNS TABLE (
  daily_count INTEGER,
  monthly_count INTEGER,
  daily_limit INTEGER,
  monthly_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily INTEGER;
  v_monthly INTEGER;
  v_daily_limit INTEGER;
  v_monthly_limit INTEGER;
BEGIN
  -- SECURITY: Prevent negative credit manipulation
  IF _credits < 0 THEN
    RAISE EXCEPTION 'Credits must be non-negative';
  END IF;

  -- SECURITY: Authenticated users can only increment their own usage.
  -- Service role (edge functions) can increment any user.
  -- System-initiated calls (e.g., analyze-review) pass _user_id = NULL.
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot increment usage for another user';
  END IF;

  -- SECURITY: Verify user is a member of the specified group
  IF _user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.group_memberships
      WHERE user_id = _user_id AND group_id = _group_id
    ) THEN
      RAISE EXCEPTION 'User is not a member of the specified group';
    END IF;
  END IF;

  -- Increment counters (skip for system-initiated calls where _user_id is NULL)
  IF _user_id IS NOT NULL THEN
    -- Increment daily counter (RETURNING preserves atomicity vs separate SELECT)
    INSERT INTO public.usage_counters (user_id, group_id, period_type, period_start, count)
    VALUES (_user_id, _group_id, 'daily', CURRENT_DATE, _credits)
    ON CONFLICT (user_id, group_id, period_type, period_start)
    DO UPDATE SET count = usage_counters.count + _credits, updated_at = now()
    RETURNING count INTO v_daily;

    -- Increment monthly counter
    INSERT INTO public.usage_counters (user_id, group_id, period_type, period_start, count)
    VALUES (_user_id, _group_id, 'monthly',
            date_trunc('month', CURRENT_DATE)::DATE, _credits)
    ON CONFLICT (user_id, group_id, period_type, period_start)
    DO UPDATE SET count = usage_counters.count + _credits, updated_at = now()
    RETURNING count INTO v_monthly;
  END IF;

  -- Log to audit trail (if _log provided)
  IF _log IS NOT NULL THEN
    INSERT INTO public.ai_usage_log (
      user_id, group_id, domain, action, input_mode, edge_function,
      credits_consumed, model, tokens_input, tokens_output,
      session_id, restaurant_id, metadata
    ) VALUES (
      _user_id, _group_id,
      _log->>'domain',
      _log->>'action',
      COALESCE(_log->>'input_mode', 'text'),
      _log->>'edge_function',
      _credits,
      _log->>'model',
      (_log->>'tokens_input')::INTEGER,
      (_log->>'tokens_output')::INTEGER,
      CASE WHEN _log->>'session_id' IS NOT NULL AND _log->>'session_id' != ''
        THEN (_log->>'session_id')::UUID ELSE NULL END,
      CASE WHEN _log->>'restaurant_id' IS NOT NULL AND _log->>'restaurant_id' != ''
        THEN (_log->>'restaurant_id')::UUID ELSE NULL END,
      COALESCE(_log->'metadata', '{}'::JSONB)
    );
  END IF;

  -- Get limits from role_policies (skip for system calls)
  IF _user_id IS NOT NULL THEN
    SELECT COALESCE(rp.daily_ai_limit, 20), COALESCE(rp.monthly_ai_limit, 500)
    INTO v_daily_limit, v_monthly_limit
    FROM public.group_memberships gm
    LEFT JOIN public.role_policies rp ON rp.group_id = gm.group_id AND rp.role = gm.role
    WHERE gm.user_id = _user_id AND gm.group_id = _group_id;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_daily, 0),
    COALESCE(v_monthly, 0),
    COALESCE(v_daily_limit, 20),
    COALESCE(v_monthly_limit, 500);
END;
$$;
