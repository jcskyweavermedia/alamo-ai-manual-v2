-- M05: flavor_index_daily + review_intelligence — Pre-computed rollups and period summaries

-- =============================================
-- flavor_index_daily — Pre-computed daily rollups
-- =============================================

CREATE TABLE public.flavor_index_daily (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,
  date            DATE NOT NULL,

  -- NPS-style star distribution
  total_reviews   INTEGER NOT NULL DEFAULT 0,
  five_star       INTEGER NOT NULL DEFAULT 0,  -- "Loving the Flavor" (Promoters)
  four_star       INTEGER NOT NULL DEFAULT 0,  -- "On the Fence" (Passives)
  three_star      INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)
  two_star        INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)
  one_star        INTEGER NOT NULL DEFAULT 0,  -- "Not Feeling It" (Detractors)

  -- Consistency guards
  CHECK (five_star + four_star + three_star + two_star + one_star = total_reviews),
  CONSTRAINT chk_counts_non_negative
    CHECK (five_star >= 0 AND four_star >= 0 AND three_star >= 0
           AND two_star >= 0 AND one_star >= 0 AND total_reviews >= 0),

  -- Auto-computed Flavor Index: % Loving the Flavor - % Not Feeling It (-100 to +100)
  -- If the formula changes, migration path: DROP COLUMN + ADD COLUMN with new GENERATED expression
  flavor_index    NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_reviews > 0
      THEN ROUND(
        ((five_star::numeric / total_reviews) * 100)
        - (((one_star + two_star + three_star)::numeric / total_reviews) * 100)
      , 2)
      ELSE 0
    END
  ) STORED,

  -- Average rating
  avg_rating      NUMERIC(3,2),

  -- Category sentiment averages (-1.0 to +1.0, populated after AI extraction)
  -- NULL means "no AI extraction data yet" (frontend shows "Coming soon")
  food_sentiment      NUMERIC(4,3) CHECK (food_sentiment IS NULL OR food_sentiment BETWEEN -1.0 AND 1.0),
  service_sentiment   NUMERIC(4,3) CHECK (service_sentiment IS NULL OR service_sentiment BETWEEN -1.0 AND 1.0),
  ambience_sentiment  NUMERIC(4,3) CHECK (ambience_sentiment IS NULL OR ambience_sentiment BETWEEN -1.0 AND 1.0),
  value_sentiment     NUMERIC(4,3) CHECK (value_sentiment IS NULL OR value_sentiment BETWEEN -1.0 AND 1.0),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(restaurant_id, date)
);

CREATE INDEX idx_flavor_daily_group ON public.flavor_index_daily(group_id);

CREATE TRIGGER trg_flavor_daily_updated_at
  BEFORE UPDATE ON public.flavor_index_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.flavor_index_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rollups in their group"
  ON public.flavor_index_daily FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert rollups"
  ON public.flavor_index_daily FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update rollups"
  ON public.flavor_index_daily FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete rollups"
  ON public.flavor_index_daily FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

-- =============================================
-- review_intelligence — Period summaries for AI queries
-- =============================================

CREATE TABLE public.review_intelligence (
  id                  UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id       UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  period_type         TEXT NOT NULL CHECK (period_type IN ('week', 'month', 'quarter')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  CHECK (period_end > period_start),

  total_reviews       INTEGER NOT NULL DEFAULT 0,
  avg_rating          NUMERIC(3,2),
  flavor_index        NUMERIC(5,2),
  flavor_index_change NUMERIC(5,2),

  -- Category sentiments
  food_sentiment      NUMERIC(4,3) CHECK (food_sentiment IS NULL OR food_sentiment BETWEEN -1.0 AND 1.0),
  service_sentiment   NUMERIC(4,3) CHECK (service_sentiment IS NULL OR service_sentiment BETWEEN -1.0 AND 1.0),
  ambience_sentiment  NUMERIC(4,3) CHECK (ambience_sentiment IS NULL OR ambience_sentiment BETWEEN -1.0 AND 1.0),
  value_sentiment     NUMERIC(4,3) CHECK (value_sentiment IS NULL OR value_sentiment BETWEEN -1.0 AND 1.0),

  -- Top mentions (JSONB)
  top_positive_items  JSONB NOT NULL DEFAULT '[]',
  -- [{ "item": "Ribeye", "mentions": 12, "avg_sentiment": 0.85 }]

  top_complaints      JSONB NOT NULL DEFAULT '[]',
  -- [{ "item": "wait time", "mentions": 8, "avg_sentiment": -0.72 }]
  -- Renamed from "top_negative_items" — contains both negative items AND complaint categories

  top_strengths       JSONB NOT NULL DEFAULT '[]',
  top_opportunities   JSONB NOT NULL DEFAULT '[]',
  top_staff           JSONB NOT NULL DEFAULT '[]',

  -- Platform breakdown
  platform_breakdown  JSONB NOT NULL DEFAULT '{}',

  -- Flags
  high_severity_count INTEGER DEFAULT 0,
  return_likely_pct   NUMERIC(5,2),
  return_unlikely_pct NUMERIC(5,2),

  -- Emotion distribution
  emotion_distribution JSONB NOT NULL DEFAULT '{}',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(restaurant_id, period_type, period_start)
);

CREATE INDEX idx_review_intelligence_group ON public.review_intelligence(group_id);
CREATE INDEX idx_review_intelligence_lookup
  ON public.review_intelligence(restaurant_id, period_type, period_start DESC);

CREATE TRIGGER trg_review_intelligence_updated_at
  BEFORE UPDATE ON public.review_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.review_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view intelligence in their group"
  ON public.review_intelligence FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert intelligence"
  ON public.review_intelligence FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update intelligence"
  ON public.review_intelligence FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete intelligence"
  ON public.review_intelligence FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
