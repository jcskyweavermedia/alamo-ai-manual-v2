-- ============================================
-- USAGE_COUNTERS: Track AI usage per user/role
-- ============================================
CREATE TABLE public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  
  -- Period tracking
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  
  -- Count
  count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one counter per user/group/period
  UNIQUE (user_id, group_id, period_type, period_start)
);

-- Validation trigger (instead of CHECK constraint for flexibility)
CREATE OR REPLACE FUNCTION public.validate_usage_counter_period_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.period_type NOT IN ('daily', 'monthly') THEN
    RAISE EXCEPTION 'period_type must be daily or monthly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_usage_counter_period_type
  BEFORE INSERT OR UPDATE ON public.usage_counters
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_usage_counter_period_type();

-- Indexes
CREATE INDEX idx_usage_counters_user ON public.usage_counters(user_id);
CREATE INDEX idx_usage_counters_period ON public.usage_counters(period_type, period_start);
CREATE INDEX idx_usage_counters_lookup ON public.usage_counters(user_id, group_id, period_type, period_start);

-- Enable RLS
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage"
  ON public.usage_counters FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- GET_USER_USAGE: Returns daily and monthly counts with limits
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_usage(
  _user_id UUID,
  _group_id UUID
)
RETURNS TABLE (
  daily_count INTEGER,
  monthly_count INTEGER,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  can_ask BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_daily_count INTEGER := 0;
  v_monthly_count INTEGER := 0;
  v_daily_limit INTEGER;
  v_monthly_limit INTEGER;
  v_can_use_ai BOOLEAN;
BEGIN
  -- Get user's role in this group
  SELECT gm.role INTO v_role
  FROM public.group_memberships gm
  WHERE gm.user_id = _user_id AND gm.group_id = _group_id;
  
  -- If no membership, return nulls
  IF v_role IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, FALSE;
    RETURN;
  END IF;
  
  -- Get limits from role_policies
  SELECT rp.daily_ai_limit, rp.monthly_ai_limit, rp.can_use_ai
  INTO v_daily_limit, v_monthly_limit, v_can_use_ai
  FROM public.role_policies rp
  WHERE rp.group_id = _group_id AND rp.role = v_role;
  
  -- Default limits if no policy found
  v_daily_limit := COALESCE(v_daily_limit, 20);
  v_monthly_limit := COALESCE(v_monthly_limit, 500);
  v_can_use_ai := COALESCE(v_can_use_ai, true);
  
  -- If AI is disabled for this role, return can_ask = false
  IF NOT v_can_use_ai THEN
    RETURN QUERY SELECT 0, 0, v_daily_limit, v_monthly_limit, FALSE;
    RETURN;
  END IF;
  
  -- Get today's count
  SELECT COALESCE(uc.count, 0) INTO v_daily_count
  FROM public.usage_counters uc
  WHERE uc.user_id = _user_id 
    AND uc.group_id = _group_id
    AND uc.period_type = 'daily'
    AND uc.period_start = CURRENT_DATE;
  
  v_daily_count := COALESCE(v_daily_count, 0);
  
  -- Get this month's count
  SELECT COALESCE(uc.count, 0) INTO v_monthly_count
  FROM public.usage_counters uc
  WHERE uc.user_id = _user_id 
    AND uc.group_id = _group_id
    AND uc.period_type = 'monthly'
    AND uc.period_start = date_trunc('month', CURRENT_DATE)::DATE;
  
  v_monthly_count := COALESCE(v_monthly_count, 0);
  
  RETURN QUERY SELECT 
    v_daily_count,
    v_monthly_count,
    v_daily_limit,
    v_monthly_limit,
    (v_daily_count < v_daily_limit AND v_monthly_count < v_monthly_limit);
END;
$$;

-- ============================================
-- INCREMENT_USAGE: Atomically increase counters
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_usage(
  _user_id UUID,
  _group_id UUID
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
  v_role user_role;
  v_daily_limit INTEGER;
  v_monthly_limit INTEGER;
  v_new_daily INTEGER;
  v_new_monthly INTEGER;
BEGIN
  -- Get user's role and limits
  SELECT gm.role INTO v_role
  FROM public.group_memberships gm
  WHERE gm.user_id = _user_id AND gm.group_id = _group_id;
  
  SELECT rp.daily_ai_limit, rp.monthly_ai_limit 
  INTO v_daily_limit, v_monthly_limit
  FROM public.role_policies rp
  WHERE rp.group_id = _group_id AND rp.role = v_role;
  
  v_daily_limit := COALESCE(v_daily_limit, 20);
  v_monthly_limit := COALESCE(v_monthly_limit, 500);
  
  -- Upsert daily counter and get new count
  INSERT INTO public.usage_counters (user_id, group_id, period_type, period_start, count)
  VALUES (_user_id, _group_id, 'daily', CURRENT_DATE, 1)
  ON CONFLICT (user_id, group_id, period_type, period_start)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now()
  RETURNING count INTO v_new_daily;
  
  -- Upsert monthly counter and get new count
  INSERT INTO public.usage_counters (user_id, group_id, period_type, period_start, count)
  VALUES (_user_id, _group_id, 'monthly', date_trunc('month', CURRENT_DATE)::DATE, 1)
  ON CONFLICT (user_id, group_id, period_type, period_start)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now()
  RETURNING count INTO v_new_monthly;
  
  RETURN QUERY SELECT v_new_daily, v_new_monthly, v_daily_limit, v_monthly_limit;
END;
$$;