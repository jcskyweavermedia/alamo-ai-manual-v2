-- =============================================================================
-- Phase 5 Migration 3: Enhanced validate_form_template_fields() trigger
-- Two-pass approach: conditions can reference ANY field (not just preceding)
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_form_template_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  field           JSONB;
  field_key       TEXT;
  field_type      TEXT;
  field_keys      TEXT[] := '{}';
  all_field_keys  TEXT[];
  order_values    INTEGER[] := '{}';
  condition_field TEXT;
  options_arr     JSONB;
  options_count   INTEGER;
  i               INTEGER;
  valid_types     TEXT[] := ARRAY[
    'text', 'textarea', 'date', 'time', 'datetime',
    'select', 'radio', 'checkbox', 'number', 'phone',
    'email', 'signature', 'image', 'file',
    'header', 'instructions', 'contact_lookup'
  ];
BEGIN
  -- Skip if fields is NULL
  IF NEW.fields IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rule 1: Max 50 fields
  IF jsonb_array_length(NEW.fields) > 50 THEN
    RAISE EXCEPTION 'Maximum 50 fields per template (got %)', jsonb_array_length(NEW.fields);
  END IF;

  -- =========================================================================
  -- PASS 1: Collect ALL field keys for condition validation
  -- =========================================================================
  all_field_keys := ARRAY(
    SELECT f->>'key'
    FROM jsonb_array_elements(NEW.fields) AS f
    WHERE f->>'key' IS NOT NULL AND f->>'key' != ''
  );

  -- =========================================================================
  -- PASS 2: Validate each field
  -- =========================================================================
  FOR i IN 0..jsonb_array_length(NEW.fields) - 1 LOOP
    field := NEW.fields->i;
    field_key := field->>'key';
    field_type := field->>'type';

    -- Rule 2: Non-empty key
    IF field_key IS NULL OR field_key = '' THEN
      RAISE EXCEPTION 'Field at index % has empty or missing "key"', i;
    END IF;

    -- Rule 3: Key format (lowercase alphanumeric, hyphens, underscores)
    IF field_key !~ '^[a-z][a-z0-9_-]*$' THEN
      RAISE EXCEPTION 'Field key "%" has invalid format (must be lowercase, start with letter, only a-z 0-9 _ -)', field_key;
    END IF;

    -- Rule 4: Non-empty, valid type
    IF field_type IS NULL OR field_type = '' THEN
      RAISE EXCEPTION 'Field "%" has empty or missing "type"', field_key;
    END IF;

    IF NOT (field_type = ANY(valid_types)) THEN
      RAISE EXCEPTION 'Field "%" has invalid type "%"', field_key, field_type;
    END IF;

    -- Rule 5: No duplicate keys
    IF field_key = ANY(field_keys) THEN
      RAISE EXCEPTION 'Duplicate field key "%"', field_key;
    END IF;
    field_keys := array_append(field_keys, field_key);

    -- Rule 6: Required options for select/radio/checkbox
    IF field_type IN ('select', 'radio', 'checkbox') THEN
      options_arr := field->'options';
      IF options_arr IS NULL OR jsonb_typeof(options_arr) != 'array' OR jsonb_array_length(options_arr) < 1 THEN
        RAISE EXCEPTION 'Field "%" (type %) must have at least 1 option', field_key, field_type;
      END IF;
      options_count := jsonb_array_length(options_arr);
      IF options_count > 50 THEN
        RAISE EXCEPTION 'Field "%" has % options (max 50)', field_key, options_count;
      END IF;
    END IF;

    -- Rule 7: Condition references valid field key (two-pass: uses all_field_keys)
    IF field->'condition' IS NOT NULL
       AND jsonb_typeof(field->'condition') = 'object'
       AND field->>'condition' != 'null' THEN
      condition_field := field->'condition'->>'field';
      IF condition_field IS NOT NULL AND condition_field != '' THEN
        -- Self-reference check
        IF condition_field = field_key THEN
          RAISE EXCEPTION 'Field "%" cannot have a condition referencing itself', field_key;
        END IF;
        -- Existence check against ALL field keys
        IF NOT (condition_field = ANY(all_field_keys)) THEN
          RAISE EXCEPTION 'Field "%" has condition referencing non-existent field "%"', field_key, condition_field;
        END IF;
      END IF;
    END IF;

    -- Rule 8: Unique order values
    IF (field->'order') IS NOT NULL AND jsonb_typeof(field->'order') = 'number' THEN
      IF (field->'order')::int = ANY(order_values) THEN
        RAISE EXCEPTION 'Duplicate order value % on field "%"', (field->'order')::int, field_key;
      END IF;
      order_values := array_append(order_values, (field->'order')::int);
    END IF;

  END LOOP;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_validate_form_template_fields'
    AND tgrelid = 'form_templates'::regclass
  ) THEN
    CREATE TRIGGER trg_validate_form_template_fields
      BEFORE INSERT OR UPDATE OF fields ON form_templates
      FOR EACH ROW
      EXECUTE FUNCTION validate_form_template_fields();
  END IF;
END;
$$;
