// =============================================================================
// Publish Validation — Client-side validation before publishing a form template
//
// Runs before the publish API call to catch errors early and show them inline
// in the builder UI. The DB trigger (`validate_form_template_fields`) is the
// authoritative guardrail; this is a courtesy layer for better UX.
//
// Checks:
//   1. Title EN is not empty
//   2. Slug is not empty and valid format
//   3. At least 1 fillable field (not header/instructions)
//   4. All select/radio/checkbox fields have options
//   5. No duplicate field keys
//   6. All required fields have labels
//   7. Field count <= 50
//   8. All field keys match ^[a-z][a-z0-9_]{0,63}$
//   9. No self-referencing conditions
//  10. Condition references point to existing fields
//  11. Options count <= 50 per field
//
// Returns an array of human-readable error messages with severity levels.
// =============================================================================

import type { FormFieldDefinition, FormFieldType } from '@/types/forms';
import type { BuilderState, ValidationError } from '@/types/form-builder';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Field types that are display-only (non-fillable). */
const NON_FILLABLE_TYPES: Set<FormFieldType> = new Set(['header', 'instructions']);

/** Field types that require a non-empty options array. */
const OPTION_TYPES: Set<FormFieldType> = new Set(['select', 'radio', 'checkbox']);

/** Maximum fields per template (matches DB trigger). */
const MAX_FIELDS = 50;

/** Maximum options per choice field (matches DB trigger). */
const MAX_OPTIONS = 50;

/**
 * Regex for valid field keys: starts with lowercase letter, followed by
 * lowercase letters, digits, or underscores. Max 64 characters.
 */
const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Regex for valid slugs: lowercase letters, digits, and hyphens.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate a BuilderState for publishing.
 *
 * @returns An object with `valid` (boolean) and `errors` (human-readable
 *          strings). `valid` is true only when there are zero errors with
 *          severity 'error' (warnings do not block publishing).
 */
export function validateForPublish(template: BuilderState): {
  valid: boolean;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  // -------------------------------------------------------------------------
  // 1. Title EN is required
  // -------------------------------------------------------------------------
  if (!template.titleEn.trim()) {
    errors.push({
      message: 'Form title (English) is required',
      severity: 'error',
    });
  }

  // -------------------------------------------------------------------------
  // 2. Slug is required and valid
  // -------------------------------------------------------------------------
  if (!template.slug.trim()) {
    errors.push({
      message: 'Slug is required',
      severity: 'error',
    });
  } else if (!SLUG_PATTERN.test(template.slug)) {
    errors.push({
      message: 'Slug must contain only lowercase letters, digits, and hyphens',
      severity: 'error',
    });
  }

  // -------------------------------------------------------------------------
  // 3. At least 1 fillable field
  // -------------------------------------------------------------------------
  const fillableFields = template.fields.filter(
    f => !NON_FILLABLE_TYPES.has(f.type),
  );

  if (fillableFields.length === 0) {
    errors.push({
      message: 'Form must have at least one fillable field (not just headers or instructions)',
      severity: 'error',
    });
  }

  // -------------------------------------------------------------------------
  // 7. Field count <= MAX_FIELDS
  // -------------------------------------------------------------------------
  if (template.fields.length > MAX_FIELDS) {
    errors.push({
      message: `Maximum ${MAX_FIELDS} fields per template (found ${template.fields.length})`,
      severity: 'error',
    });
  }

  // -------------------------------------------------------------------------
  // Per-field checks
  // -------------------------------------------------------------------------
  const seenKeys = new Set<string>();

  for (const field of template.fields) {
    // 5. Duplicate field keys
    if (seenKeys.has(field.key)) {
      errors.push({
        fieldKey: field.key,
        message: `Duplicate field key: "${field.key}"`,
        severity: 'error',
      });
    }
    seenKeys.add(field.key);

    // 8. Field key format
    if (!field.key) {
      errors.push({
        fieldKey: field.key,
        message: `Field at order ${field.order} has no key`,
        severity: 'error',
      });
    } else if (!FIELD_KEY_PATTERN.test(field.key)) {
      errors.push({
        fieldKey: field.key,
        message: `Field key "${field.key}" must start with a lowercase letter and contain only lowercase letters, digits, and underscores (max 64 chars)`,
        severity: 'error',
      });
    }

    // 6. Required fields must have labels
    if (!NON_FILLABLE_TYPES.has(field.type) && !field.label?.trim()) {
      errors.push({
        fieldKey: field.key,
        message: `Field "${field.key}" is missing a label`,
        severity: 'error',
      });
    }

    // 4. Select/radio/checkbox must have options
    if (OPTION_TYPES.has(field.type)) {
      if (!field.options || field.options.length === 0) {
        errors.push({
          fieldKey: field.key,
          message: `Field "${field.label || field.key}" (${field.type}) must have at least one option`,
          severity: 'error',
        });
      }

      // 11. Options count limit
      if (field.options && field.options.length > MAX_OPTIONS) {
        errors.push({
          fieldKey: field.key,
          message: `Field "${field.label || field.key}" has ${field.options.length} options (max ${MAX_OPTIONS})`,
          severity: 'error',
        });
      }

      // Check for empty option strings
      if (field.options?.some(opt => !opt.trim())) {
        errors.push({
          fieldKey: field.key,
          message: `Field "${field.label || field.key}" has empty option values`,
          severity: 'warning',
        });
      }
    }

    // 9 & 10. Condition validation
    if (field.condition?.field) {
      // Self-reference
      if (field.condition.field === field.key) {
        errors.push({
          fieldKey: field.key,
          message: `Field "${field.label || field.key}" has a condition referencing itself`,
          severity: 'error',
        });
      }

      // Reference to non-existent field
      const allKeys = template.fields.map(f => f.key);
      if (!allKeys.includes(field.condition.field)) {
        errors.push({
          fieldKey: field.key,
          message: `Field "${field.label || field.key}" references non-existent field "${field.condition.field}"`,
          severity: 'error',
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Instructions: required + must be refined
  // -------------------------------------------------------------------------

  if (!template.instructionsEn.trim()) {
    errors.push({
      message: 'English instructions are required for AI form-filling',
      severity: 'error',
    });
  } else if (!template.instructionsRefined) {
    errors.push({
      message: 'Instructions must be refined with AI before publishing',
      severity: 'error',
    });
  }

  if (!template.instructionsEs.trim()) {
    errors.push({
      message: 'No Spanish instructions provided. Spanish-speaking users will see no AI guidance.',
      severity: 'warning',
    });
  }

  if (template.aiTools.length === 0) {
    errors.push({
      message: 'No AI tools enabled. The form-filling AI will rely only on user input without searching external data.',
      severity: 'warning',
    });
  }

  // -------------------------------------------------------------------------
  // Result
  // -------------------------------------------------------------------------

  const valid = errors.every(e => e.severity !== 'error');

  return { valid, errors };
}

// =============================================================================
// CONVENIENCE: Get only blocking errors (severity: 'error')
// =============================================================================

/**
 * Returns only the blocking errors (severity 'error') from validation.
 * Useful for UI that only shows errors, not warnings.
 */
export function getPublishBlockers(template: BuilderState): string[] {
  const { errors } = validateForPublish(template);
  return errors
    .filter(e => e.severity === 'error')
    .map(e => e.message);
}

// =============================================================================
// CONVENIENCE: Check if a template is publishable
// =============================================================================

/**
 * Quick check: can this template be published?
 */
export function isPublishable(template: BuilderState): boolean {
  const { valid } = validateForPublish(template);
  return valid;
}
