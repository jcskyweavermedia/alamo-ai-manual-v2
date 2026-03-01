-- M04: review_analyses — AI-extracted structured signals (sentiment, staff, items, severity)

CREATE TABLE public.review_analyses (
  id                UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  review_id         UUID NOT NULL REFERENCES public.restaurant_reviews(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Extracted by AI
  overall_sentiment TEXT NOT NULL CHECK (overall_sentiment IN ('positive', 'neutral', 'negative')),
  emotion           TEXT NOT NULL CHECK (emotion IN ('delighted', 'satisfied', 'frustrated', 'angry', 'neutral')),

  strengths         JSONB NOT NULL DEFAULT '[]',
  -- [{ "category": "Food Quality", "intensity": 4 }, ...]
  -- Valid categories: Food Quality, Service Attitude, Service Speed, Presentation,
  --   Ambience, Cleanliness, Value, Wait Time, Reservation Experience, Management, Other
  -- intensity: 1 (mild mention) to 5 (emphatic/detailed)

  opportunities     JSONB NOT NULL DEFAULT '[]',
  -- [{ "category": "Wait Time", "intensity": 3 }, ...]

  items_mentioned   JSONB NOT NULL DEFAULT '[]',
  -- [{ "name": "Ribeye", "item_type": "food", "course_type": "entree",
  --    "cuisine_type": "steakhouse", "sentiment": "positive", "intensity": 5 }]

  staff_mentioned   JSONB NOT NULL DEFAULT '[]',
  -- [{ "name": "Maria", "role": "server", "sentiment": "positive" }]

  return_intent     TEXT CHECK (return_intent IS NULL OR return_intent IN ('likely', 'unlikely', 'unclear')),
  -- NULL allowed: not all reviews express return intent
  high_severity_flag BOOLEAN NOT NULL DEFAULT false,
  high_severity_details JSONB NOT NULL DEFAULT '[]',
  -- [{ "type": "health_safety", "summary": "Reported food poisoning symptoms" }]

  -- Denormalized for aggregation (set once at insertion, not updated)
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_date       TIMESTAMPTZ NOT NULL,

  -- Embedding for semantic search (deferred to Phase 9)
  embedding         vector(1536),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(review_id)
);

-- Indexes
CREATE INDEX idx_review_analyses_restaurant_date
  ON public.review_analyses(restaurant_id, review_date);
CREATE INDEX idx_review_analyses_group
  ON public.review_analyses(group_id);
CREATE INDEX idx_review_analyses_items
  ON public.review_analyses USING gin(items_mentioned);
CREATE INDEX idx_review_analyses_staff
  ON public.review_analyses USING gin(staff_mentioned);
CREATE INDEX idx_review_analyses_severity
  ON public.review_analyses(restaurant_id, review_date)
  WHERE high_severity_flag = true;

-- RLS
ALTER TABLE public.review_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analyses in their group"
  ON public.review_analyses FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Service can insert analyses"
  ON public.review_analyses FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update analyses"
  ON public.review_analyses FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete analyses"
  ON public.review_analyses FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
