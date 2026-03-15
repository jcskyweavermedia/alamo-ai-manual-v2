-- =============================================================================
-- Auto-set published_at + bump version when course status -> 'published'
-- Ensures publish consistency regardless of which UI path triggers the update.
-- The trigger is idempotent: if the caller already set version or published_at,
-- the trigger detects this and does not double-bump.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_set_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when transitioning INTO 'published'
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') THEN
    -- Set published_at if the caller didn't already provide a new value
    IF NEW.published_at IS NULL OR NEW.published_at = OLD.published_at THEN
      NEW.published_at := now();
    END IF;
    -- Bump version if the caller didn't already bump it
    IF NEW.version = OLD.version THEN
      NEW.version := OLD.version + 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fires only when status actually changes (WHEN guard = zero overhead on normal saves)
CREATE TRIGGER trg_courses_auto_publish
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.auto_set_published_at();
