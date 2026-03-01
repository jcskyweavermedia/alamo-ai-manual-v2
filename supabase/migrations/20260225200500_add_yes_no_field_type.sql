-- =============================================================================
-- Add 'yes_no' to valid field types in the validation trigger
-- Sprint 1: Form Builder UX Redesign
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_form_template_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  field         JSONB;
  field_key     TEXT;
  field_type    TEXT;
  field_options JSONB;
  seen_keys     TEXT[] := '{}';
  condition_field TEXT;
  i               INTEGER;
  -- SYNC: src/types/forms.ts FormFieldType, FormFieldRenderer.tsx, ask-form prompt
  valid_types     TEXT[] := ARRAY[
    'text', 'textarea', 'date', 'time', 'datetime', 'select', 'radio',
    'checkbox', 'number', 'phone', 'email', 'signature', 'image', 'file',
    'header', 'instructions', 'contact_lookup', 'yes_no'
  ];
BEGIN
  -------------------------------------------------------------------------
  -- Rule 1: Max 50 fields per template
  -------------------------------------------------------------------------
  IF jsonb_array_length(NEW.fields) > 50 THEN
    RAISE EXCEPTION 'Maximum 50 fields per template (found %)', jsonb_array_length(NEW.fields);
  END IF;

  FOR i IN 0 .. jsonb_array_length(NEW.fields) - 1 LOOP
    field := NEW.fields -> i;
    field_key := field ->> 'key';
    field_type := field ->> 'type';
    field_options := field -> 'options';

    -------------------------------------------------------------------------
    -- Rule 3a/b: Non-empty key and type
    -------------------------------------------------------------------------
    IF field_key IS NULL OR field_key = '' THEN
      RAISE EXCEPTION 'Field at index % has no key', i;
    END IF;
    IF field_type IS NULL OR field_type = '' THEN
      RAISE EXCEPTION 'Field "%" has no type', field_key;
    END IF;

    -------------------------------------------------------------------------
    -- Rule 2: Valid field type (18 types from FormFieldType union)
    -------------------------------------------------------------------------
    IF NOT (field_type = ANY(valid_types)) THEN
      RAISE EXCEPTION 'Invalid field type "%" for field "%"', field_type, field_key;
    END IF;

    -------------------------------------------------------------------------
    -- Rule 4: Key format: ^[a-z][a-z0-9_]{0,63}$
    -------------------------------------------------------------------------
    IF field_key !~ '^[a-z][a-z0-9_]{0,63}$' THEN
      RAISE EXCEPTION 'Field key "%" must start with a lowercase letter and contain only lowercase letters, digits, and underscores (max 64 chars)', field_key;
    END IF;

    -------------------------------------------------------------------------
    -- Rule 5a/b: Select/radio/checkbox must have 1-50 options
    -------------------------------------------------------------------------
    IF field_type IN ('select', 'radio', 'checkbox') THEN
      IF field_options IS NULL OR jsonb_array_length(field_options) = 0 THEN
        RAISE EXCEPTION 'Field "%" (%) must have at least one option', field_key, field_type;
      END IF;
      IF jsonb_array_length(field_options) > 50 THEN
        RAISE EXCEPTION 'Field "%" (%) has % options (max 50)', field_key, field_type, jsonb_array_length(field_options);
      END IF;
    END IF;

    -------------------------------------------------------------------------
    -- Rule 6: No duplicate keys
    -------------------------------------------------------------------------
    IF field_key = ANY(seen_keys) THEN
      RAISE EXCEPTION 'Duplicate field key "%"', field_key;
    END IF;
    seen_keys := seen_keys || field_key;

    -------------------------------------------------------------------------
    -- Rule 7: Conditions reference existing fields (forward refs OK)
    -------------------------------------------------------------------------
    condition_field := field -> 'condition' ->> 'field';
    IF condition_field IS NOT NULL AND condition_field != '' THEN
      -- Self-reference check
      IF condition_field = field_key THEN
        RAISE EXCEPTION 'Field "%" has a condition referencing itself', field_key;
      END IF;
      -- Will validate existence after the loop (allow forward refs)
    END IF;
  END LOOP;

  -- Post-loop: validate condition references
  FOR i IN 0 .. jsonb_array_length(NEW.fields) - 1 LOOP
    field := NEW.fields -> i;
    condition_field := field -> 'condition' ->> 'field';
    IF condition_field IS NOT NULL AND condition_field != '' THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.fields) AS f
        WHERE f ->> 'key' = condition_field
      ) THEN
        RAISE EXCEPTION 'Field "%" references non-existent field "%" in condition',
          field ->> 'key', condition_field;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
