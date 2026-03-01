-- M02: scrape_runs — Apify run audit trail with idempotency guard

CREATE TABLE public.scrape_runs (
  id                UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  restaurant_id     UUID NOT NULL REFERENCES public.tracked_restaurants(id) ON DELETE CASCADE,

  platform          TEXT NOT NULL CHECK (platform IN ('google', 'opentable', 'tripadvisor')),
  apify_run_id      TEXT,
  apify_dataset_id  TEXT,

  status            TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received', 'processing', 'completed', 'failed')),
  reviews_fetched   INTEGER NOT NULL DEFAULT 0,
  reviews_inserted  INTEGER NOT NULL DEFAULT 0,
  reviews_duplicate INTEGER NOT NULL DEFAULT 0,
  reviews_updated   INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  last_offset       INTEGER DEFAULT 0,  -- for resumable pagination

  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,

  UNIQUE(apify_run_id, platform)  -- idempotency guard (NULLs are distinct)
);

CREATE INDEX idx_scrape_runs_restaurant ON public.scrape_runs(restaurant_id, started_at DESC);

ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scrape runs in their group"
  ON public.scrape_runs FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Admins can insert scrape runs"
  ON public.scrape_runs FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update scrape runs"
  ON public.scrape_runs FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete scrape runs"
  ON public.scrape_runs FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id()
    AND has_role(auth.uid(), 'admin'::user_role));
