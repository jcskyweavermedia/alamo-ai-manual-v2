-- =============================================================================
-- MIGRATION: add_publish_trigger
-- Replaces the publish lifecycle trigger to handle:
--   1. Version bump when status transitions TO 'published' (first publish)
--   2. Version bump on re-publish when fields or instructions changed
--   3. Slug immutability after first publish (published_at IS NOT NULL)
--   4. Clear builder_state on publish
--   5. Clear ai_refinement_log on publish
--   6. Set published_at timestamp
--   7. Cap ai_refinement_log at 20 entries on any update
--
-- Phase 5 of Form Builder System.
-- =============================================================================

BEGIN;

-- Drop the old trigger first (if it exists from migration 20260225170003)
-- so we can recreate it with the correct firing condition (all UPDATEs, not
-- just UPDATE OF status — we need to catch slug changes on any update)
DROP TRIGGER IF EXISTS trg_handle_form_template_publish ON public.form_templates;

CREATE OR REPLACE FUNCTION public.handle_form_template_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ---------------------------------------------------------------------------
  -- Slug immutability: cannot change slug after first publish
  -- (submissions, bookmarks, and URL history reference the slug)
  ---------------------------------------------------------------------------
  IF OLD.published_at IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'Cannot change slug of a previously published template (current: "%" attempted: "%")',
      OLD.slug, NEW.slug;
  END IF;

  ---------------------------------------------------------------------------
  -- Transition TO 'published' (from draft or archived)
  ---------------------------------------------------------------------------
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    -- Bump version
    NEW.template_version := COALESCE(OLD.template_version, 0) + 1;
    -- Set published_at
    NEW.published_at := now();
    -- Clear builder transient state
    NEW.builder_state := NULL;
    -- Clear refinement log (conversation is no longer relevant after publish)
    NEW.ai_refinement_log := '[]'::JSONB;

  ---------------------------------------------------------------------------
  -- Re-publish: already published AND fields or instructions changed
  -- (supports the "edit published template then Publish Changes" flow)
  ---------------------------------------------------------------------------
  ELSIF NEW.status = 'published' AND OLD.status = 'published'
    AND OLD.published_at IS NOT NULL
    AND (
      NEW.fields IS DISTINCT FROM OLD.fields
      OR NEW.instructions_en IS DISTINCT FROM OLD.instructions_en
      OR NEW.instructions_es IS DISTINCT FROM OLD.instructions_es
    ) THEN
    -- Bump version (content changed while staying published)
    NEW.template_version := COALESCE(OLD.template_version, 0) + 1;
    -- Update published_at to reflect the new publish moment
    NEW.published_at := now();
    -- Clear builder transient state
    NEW.builder_state := NULL;
    -- Clear refinement log
    NEW.ai_refinement_log := '[]'::JSONB;
  END IF;

  ---------------------------------------------------------------------------
  -- Cap ai_refinement_log at 20 entries (on any update, not just publish)
  -- Keeps the most recent 20 entries by array position (FIFO).
  ---------------------------------------------------------------------------
  IF NEW.ai_refinement_log IS NOT NULL
     AND jsonb_typeof(NEW.ai_refinement_log) = 'array'
     AND jsonb_array_length(NEW.ai_refinement_log) > 20 THEN
    NEW.ai_refinement_log := (
      SELECT COALESCE(jsonb_agg(elem ORDER BY idx), '[]'::JSONB)
      FROM (
        SELECT elem, idx
        FROM jsonb_array_elements(NEW.ai_refinement_log) WITH ORDINALITY AS t(elem, idx)
        ORDER BY idx DESC
        LIMIT 20
      ) sub
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger on ALL updates (not just UPDATE OF status)
-- because we also need to catch slug changes and field/instruction changes
CREATE TRIGGER trg_handle_form_template_publish
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_form_template_publish();

-- ---------------------------------------------------------------------------
-- Trigger ordering note:
-- PostgreSQL fires BEFORE UPDATE triggers in alphabetical order by name:
--   1. trg_form_template_publish → does NOT exist (old name, not used)
--   2. trg_form_templates_search_vector → FTS update
--   3. trg_form_templates_updated_at → set_updated_at()
--   4. trg_handle_form_template_publish → THIS trigger (version bump, cleanup)
--   5. trg_validate_form_template_fields → field validation
--
-- This ordering is safe: the publish trigger runs before field validation,
-- so version is bumped and state is cleared before validation checks fields.
-- ---------------------------------------------------------------------------

COMMIT;
