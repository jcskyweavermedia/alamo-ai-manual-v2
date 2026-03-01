-- M03: restaurant_reviews — Normalized reviews from all platforms, processing status tracking

CREATE TABLE public.restaurant_reviews (
  id                  UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id       UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  -- Source
  platform            TEXT NOT NULL CHECK (platform IN ('google', 'opentable', 'tripadvisor')),
  platform_review_id  TEXT NOT NULL,

  -- Core review data
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  -- SMALLINT not NUMERIC: all 3 platforms use integer 1-5 stars.
  -- If half-stars needed in future, migrate to NUMERIC(2,1).
  review_date         TIMESTAMPTZ NOT NULL,
  visit_date          DATE,
  reviewer_name       TEXT,
  language            TEXT DEFAULT 'en',

  -- Transient text (NULLed after AI extraction; 90-day TTL for re-extraction)
  review_text         TEXT,
  review_title        TEXT,

  -- Sub-ratings (OpenTable native; others NULL)
  food_rating         SMALLINT CHECK (food_rating IS NULL OR food_rating BETWEEN 1 AND 5),
  service_rating      SMALLINT CHECK (service_rating IS NULL OR service_rating BETWEEN 1 AND 5),
  ambience_rating     SMALLINT CHECK (ambience_rating IS NULL OR ambience_rating BETWEEN 1 AND 5),
  value_rating        SMALLINT CHECK (value_rating IS NULL OR value_rating BETWEEN 1 AND 5),

  -- Owner response
  owner_response_text TEXT,
  owner_response_date TIMESTAMPTZ,

  -- Metadata
  helpful_votes       INTEGER DEFAULT 0,
  review_url          TEXT,

  -- Processing status
  analysis_status     TEXT NOT NULL DEFAULT 'pending'
                      CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  analyzed_at         TIMESTAMPTZ,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_error          TEXT,

  -- Timestamps
  scraped_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- scraped_at = when Apify fetched it; created_at = when it entered our DB
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(platform, platform_review_id)
);

-- Indexes
CREATE INDEX idx_restaurant_reviews_restaurant_date
  ON public.restaurant_reviews(restaurant_id, review_date);
CREATE INDEX idx_restaurant_reviews_restaurant_rating
  ON public.restaurant_reviews(restaurant_id, rating);
CREATE INDEX idx_restaurant_reviews_group
  ON public.restaurant_reviews(group_id);
CREATE INDEX idx_restaurant_reviews_pending
  ON public.restaurant_reviews(analysis_status)
  WHERE analysis_status IN ('pending', 'processing');

CREATE TRIGGER trg_restaurant_reviews_updated_at
  BEFORE UPDATE ON public.restaurant_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews in their group"
  ON public.restaurant_reviews FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert reviews"
  ON public.restaurant_reviews FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update reviews"
  ON public.restaurant_reviews FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete reviews"
  ON public.restaurant_reviews FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
