-- =============================================================================
-- MIGRATION: create_contacts
-- Creates contacts table (Who to Call) + FTS trigger (mixed simple/english
-- configs) + updated_at trigger + GIN/B-tree indexes + RLS policies
-- Phase 1 of Form Builder System
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- TABLE: contacts
-- ---------------------------------------------------------------------------

CREATE TABLE public.contacts (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES public.groups(id),
  category        TEXT NOT NULL,
  subcategory     TEXT,
  name            TEXT NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  phone_alt       TEXT,
  email           TEXT,
  address         TEXT,
  notes           TEXT,
  is_priority     BOOLEAN NOT NULL DEFAULT false,
  is_demo_data    BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector   TSVECTOR,
  -- Prevent exact duplicates within same group+category
  UNIQUE (group_id, name, category)
);

-- ---------------------------------------------------------------------------
-- INDEXES: GIN (FTS) + B-tree
-- Note: HNSW vector index deferred to Phase 7 -- 10-30 contacts don't need
-- semantic search. FTS on name/category/notes is sufficient.
-- ---------------------------------------------------------------------------

CREATE INDEX idx_contacts_search
  ON public.contacts USING gin(search_vector);

CREATE INDEX idx_contacts_group_id
  ON public.contacts (group_id);

CREATE INDEX idx_contacts_category
  ON public.contacts (category);

CREATE INDEX idx_contacts_status
  ON public.contacts (status);

CREATE INDEX idx_contacts_priority
  ON public.contacts (is_priority)
  WHERE is_priority = true;

-- ---------------------------------------------------------------------------
-- FTS TRIGGER FUNCTION
-- Auto-populates search_vector from name, category, subcategory,
-- contact_person, address, notes
-- Uses 'simple' config for proper nouns (no stemming) and 'english' for notes
-- Weighted: name/contact_person = A, category/subcategory = B, address/notes = C
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_contacts_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.contact_person, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.address, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_search_vector
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_contacts_search_vector();

-- ---------------------------------------------------------------------------
-- UPDATED_AT TRIGGER (reuses shared set_updated_at from training system)
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS POLICIES (4 policies, group-scoped)
-- ---------------------------------------------------------------------------

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user in the same group
CREATE POLICY "Users can view contacts in their group"
  ON public.contacts FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

-- INSERT: managers and admins in the same group
CREATE POLICY "Managers can insert contacts"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- UPDATE: managers and admins in the same group
CREATE POLICY "Managers can update contacts"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

-- DELETE: admin only in the same group
CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );

COMMIT;
