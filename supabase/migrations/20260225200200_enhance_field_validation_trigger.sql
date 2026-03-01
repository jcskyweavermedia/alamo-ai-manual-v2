-- =============================================================================
-- MIGRATION: enhance_field_validation_trigger
-- Replaces the field validation trigger with comprehensive 7-rule checks:
--   1. Max 50 fields per template
--   2. Valid field types (17 types matching FormFieldType union)
--   3. Every field must have non-empty key and type
--   4. Key format: lowercase alphanumeric + underscores only (max 64 chars)
--   5. Select/radio/checkbox must have non-empty options array, max 50 options
--   6. No duplicate keys
--   7. Condition references must point to ANY existing field key (two-pass)
--
-- Phase 5 of Form Builder System.
--
-- SYNC: src/types/forms.ts FormFieldType, FormFieldRenderer.tsx, ask-form prompt
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_form_template_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  all_field_keys  TEXT[];
  field_keys      TEXT[] := '{}';
  order_values    INTEGER[] := '{}';
  field_key       TEXT;
  field_type      TEXT;
  order_val       INTEGER;
  field_record    JSONB;
  condition_field TEXT;
  i               INTEGER;
  -- SYNC: src/types/forms.ts FormFieldType, FormFieldRenderer.tsx, ask-form prompt
  valid_types     TEXT[] := ARRAY[
    'text', 'textarea', 'date', 'time', 'datetime', 'select', 'radio',
    'checkbox', 'number', 'phone', 'email', 'signature', 'image', 'file',
    'header', 'instructions', 'contact_lookup'
  ];
BEGIN
  -- Empty array is valid (new/blank template)
  IF NEW.fields IS NULL OR NEW.fields = '[]'::JSONB OR jsonb_array_length(NEW.fields) = 0 THEN
    RETURN NEW;
  END IF;

  ---------------------------------------------------------------------------
  -- Rule 1: Maximum 50 fields per template
  ---------------------------------------------------------------------------
  IF jsonb_array_length(NEW.fields) > 50 THEN
    RAISE EXCEPTION 'Template cannot have more than 50 fields (found %)',
      jsonb_array_length(NEW.fields);
  END IF;

  ---------------------------------------------------------------------------
  -- Pass 1: Collect ALL field keys upfront (enables forward-reference
  --         condition validation — any field can reference any other field,
  --         supporting drag-and-drop reordering without breaking conditions)
  ---------------------------------------------------------------------------
  all_field_keys := ARRAY(
    SELECT f->>'key'
    FROM jsonb_array_elements(NEW.fields) AS f
    WHERE f->>'key' IS NOT NULL AND f->>'key' != ''
  );

  ---------------------------------------------------------------------------
  -- Pass 2: Validate each field against all rules
  ---------------------------------------------------------------------------
  FOR i IN 0..jsonb_array_length(NEW.fields) - 1 LOOP
    field_record := NEW.fields->i;

    -------------------------------------------------------------------------
    -- Rule 3a: Every field must have a non-empty 'key'
    -------------------------------------------------------------------------
    field_key := field_record->>'key';
    IF field_key IS NULL OR field_key = '' THEN
      RAISE EXCEPTION 'Every field must have a non-empty "key" property';
    END IF;

    -------------------------------------------------------------------------
    -- Rule 4: Key format — lowercase alphanumeric + underscores only,
    --         starting with a letter, max 64 chars
    -------------------------------------------------------------------------
    IF field_key !~ '^[a-z][a-z0-9_]{0,63}$' THEN
      RAISE EXCEPTION 'Field key "%" must be lowercase alphanumeric with underscores, starting with a letter (max 64 chars)',
        field_key;
    END IF;

    -------------------------------------------------------------------------
    -- Rule 6: No duplicate keys
    -------------------------------------------------------------------------
    IF field_key = ANY(field_keys) THEN
      RAISE EXCEPTION 'Duplicate field key "%" in fields array', field_key;
    END IF;
    field_keys := array_append(field_keys, field_key);

    -------------------------------------------------------------------------
    -- Rule 3b: Every field must have a non-empty 'type'
    -------------------------------------------------------------------------
    field_type := field_record->>'type';
    IF field_type IS NULL OR field_type = '' THEN
      RAISE EXCEPTION 'Every field must have a non-empty "type" property';
    END IF;

    -------------------------------------------------------------------------
    -- Rule 2: Valid field type (17 types from FormFieldType union)
    -------------------------------------------------------------------------
    IF NOT (field_type = ANY(valid_types)) THEN
      RAISE EXCEPTION 'Invalid field type "%" for field "%"', field_type, field_key;
    END IF;

    -------------------------------------------------------------------------
    -- Rule 5a: Select/radio/checkbox MUST have a non-empty options array
    -------------------------------------------------------------------------
    IF field_type IN ('select', 'radio', 'checkbox') THEN
      IF field_record->'options' IS NULL
         OR jsonb_typeof(field_record->'options') <> 'array'
         OR jsonb_array_length(field_record->'options') = 0 THEN
        RAISE EXCEPTION 'Field "%" (type %) must have a non-empty "options" array',
          field_key, field_type;
      END IF;

      -----------------------------------------------------------------------
      -- Rule 5b: Maximum 50 options per select/radio/checkbox field
      -----------------------------------------------------------------------
      IF jsonb_array_length(field_record->'options') > 50 THEN
        RAISE EXCEPTION 'Field "%" has too many options (% > 50)',
          field_key, jsonb_array_length(field_record->'options');
      END IF;
    END IF;

    -------------------------------------------------------------------------
    -- Rule 7: Condition references must point to an existing field key
    --         (two-pass: validated against ALL keys collected in Pass 1)
    --         Self-references are also rejected.
    -------------------------------------------------------------------------
    IF field_record->'condition' IS NOT NULL
       AND jsonb_typeof(field_record->'condition') = 'object'
       AND field_record->'condition'->>'field' IS NOT NULL THEN
      condition_field := field_record->'condition'->>'field';

      IF condition_field != '' THEN
        -- Self-reference check
        IF condition_field = field_key THEN
          RAISE EXCEPTION 'Field "%" cannot have a condition referencing itself',
            field_key;
        END IF;

        -- Existence check against ALL field keys (forward references OK)
        IF NOT (condition_field = ANY(all_field_keys)) THEN
          RAISE EXCEPTION 'Field "%" has condition referencing non-existent field "%"',
            field_key, condition_field;
        END IF;
      END IF;
    END IF;

    -------------------------------------------------------------------------
    -- Order validation: must be present and unique (integer values)
    -------------------------------------------------------------------------
    IF field_record->'order' IS NULL THEN
      RAISE EXCEPTION 'Field "%" must have an "order" property', field_key;
    END IF;

    BEGIN
      order_val := (field_record->>'order')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Field "%" has non-integer order value "%"',
        field_key, field_record->>'order';
    END;

    IF order_val = ANY(order_values) THEN
      RAISE EXCEPTION 'Duplicate order value % for field "%"', order_val, field_key;
    END IF;
    order_values := array_append(order_values, order_val);

  END LOOP;

  RETURN NEW;
END;
$$;

-- No need to re-create the trigger — CREATE OR REPLACE on the function updates
-- the existing trg_validate_form_template_fields trigger automatically.
-- The trigger was created in migration 20260223200000_create_form_templates.sql:
--   BEFORE INSERT OR UPDATE OF fields ON public.form_templates

COMMIT;
