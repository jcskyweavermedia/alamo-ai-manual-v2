-- =============================================================================
-- Phase 5 Migration 4: Publish lifecycle trigger
-- Bumps version and clears transient state on publish
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_form_template_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only act when status changes TO 'published'
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') THEN
    NEW.template_version := COALESCE(OLD.template_version, 0) + 1;
    NEW.published_at := now();
    NEW.builder_state := NULL;
    NEW.ai_refinement_log := '[]'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_handle_form_template_publish'
    AND tgrelid = 'form_templates'::regclass
  ) THEN
    CREATE TRIGGER trg_handle_form_template_publish
      BEFORE UPDATE OF status ON form_templates
      FOR EACH ROW
      EXECUTE FUNCTION handle_form_template_publish();
  END IF;
END;
$$;
