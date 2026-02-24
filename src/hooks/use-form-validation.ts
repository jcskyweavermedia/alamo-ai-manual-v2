/**
 * useFormValidation Hook
 *
 * Client-side required field validation. Runs on submit only (not on blur).
 * Skips hidden conditional fields whose conditions evaluate to false.
 * Type-specific validation: date ISO, number NaN, signature non-empty, etc.
 */

import { useCallback } from 'react';
import { evaluateCondition } from '@/lib/form-utils';
import type {
  FormFieldDefinition,
  FormFieldValues,
  FormFieldValue,
  FormFieldCondition,
  SignatureValue,
  ContactLookupValue,
  ImageValue,
  FileValue,
} from '@/types/forms';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a value is "empty" for the purposes of required validation.
 */
function isFieldEmpty(value: FormFieldValue, type: string): boolean {
  if (value === null || value === undefined) return true;

  switch (type) {
    case 'text':
    case 'textarea':
    case 'phone':
    case 'email':
    case 'date':
    case 'time':
    case 'datetime':
      return typeof value === 'string' && value.trim() === '';

    case 'number':
      return value === '' || value === null || (typeof value === 'number' && isNaN(value));

    case 'select':
    case 'radio':
      return typeof value === 'string' && value.trim() === '';

    case 'checkbox':
      return Array.isArray(value) && value.length === 0;

    case 'signature': {
      if (!value) return true;
      const sig = value as SignatureValue;
      return !sig.url || sig.url.trim() === '';
    }

    case 'image': {
      if (!value) return true;
      const images = value as ImageValue[];
      return !Array.isArray(images) || images.length === 0;
    }

    case 'file': {
      if (!value) return true;
      const files = value as FileValue[];
      return !Array.isArray(files) || files.length === 0;
    }

    case 'contact_lookup': {
      if (!value) return true;
      const contact = value as ContactLookupValue;
      return !contact.contact_id || contact.contact_id.trim() === '';
    }

    default:
      return !value;
  }
}

/**
 * Type-specific format validation (beyond empty check).
 * Returns an error message or null if valid.
 */
function validateFieldFormat(
  value: FormFieldValue,
  field: FormFieldDefinition,
): string | null {
  if (value === null || value === undefined) return null;

  switch (field.type) {
    case 'email': {
      const email = value as string;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return 'Please enter a valid email address';
      }
      break;
    }

    case 'number': {
      const num = typeof value === 'string' ? Number(value) : value;
      if (typeof num === 'number' && isNaN(num)) {
        return 'Please enter a valid number';
      }
      if (typeof num === 'number' && field.validation?.min !== undefined && num < field.validation.min) {
        return `Minimum value is ${field.validation.min}`;
      }
      if (typeof num === 'number' && field.validation?.max !== undefined && num > field.validation.max) {
        return `Maximum value is ${field.validation.max}`;
      }
      break;
    }

    case 'phone': {
      const phone = value as string;
      if (phone && field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(phone)) {
          return 'Please enter a valid phone number';
        }
      }
      break;
    }

    case 'text':
    case 'textarea': {
      const text = value as string;
      if (text && field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(text)) {
          return 'Invalid format';
        }
      }
      break;
    }

    default:
      break;
  }

  return null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useFormValidation() {
  /**
   * Validate all fields in a form.
   *
   * @param fields - The field definitions from the template
   * @param values - The current field values
   * @param allValues - All field values (used for condition evaluation)
   * @returns A map of fieldKey -> error message (empty map = valid)
   */
  const validateForm = useCallback(
    (
      fields: FormFieldDefinition[],
      values: FormFieldValues,
      allValues: FormFieldValues,
    ): Record<string, string> => {
      const errors: Record<string, string> = {};

      for (const field of fields) {
        // Skip non-input fields (header, instructions)
        if (field.type === 'header' || field.type === 'instructions') {
          continue;
        }

        // Skip hidden conditional fields
        if (field.condition) {
          const isVisible = evaluateCondition(field.condition, allValues);
          if (!isVisible) continue;
        }

        const value = values[field.key] ?? null;

        // Required check
        if (field.required && isFieldEmpty(value, field.type)) {
          errors[field.key] = `${field.label} is required`;
          continue; // Skip format validation if empty
        }

        // Type-specific format validation (only if field has a value)
        if (!isFieldEmpty(value, field.type)) {
          const formatError = validateFieldFormat(value, field);
          if (formatError) {
            errors[field.key] = formatError;
          }
        }
      }

      return errors;
    },
    [],
  );

  /**
   * Validate a single field.
   */
  const validateField = useCallback(
    (
      field: FormFieldDefinition,
      value: FormFieldValue,
      allValues: FormFieldValues,
    ): string | null => {
      // Skip non-input fields
      if (field.type === 'header' || field.type === 'instructions') {
        return null;
      }

      // Skip hidden conditional fields
      if (field.condition) {
        const isVisible = evaluateCondition(field.condition, allValues);
        if (!isVisible) return null;
      }

      // Required check
      if (field.required && isFieldEmpty(value, field.type)) {
        return `${field.label} is required`;
      }

      // Format validation
      if (!isFieldEmpty(value, field.type)) {
        return validateFieldFormat(value, field);
      }

      return null;
    },
    [],
  );

  return { validateForm, validateField };
}
