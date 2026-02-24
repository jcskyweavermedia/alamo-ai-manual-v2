// =============================================================================
// Form Builder Utilities — Pure functions (no React)
// Phase 2: Form Viewer (Read + Fill)
// =============================================================================

import type {
  FormFieldDefinition,
  FormFieldType,
  FormFieldValue,
  FormFieldValues,
  FormFieldCondition,
  FormSectionGroup,
  FormTemplate,
  FormSubmission,
  FormAttachment,
  Contact,
  ImageValue,
  FileValue,
} from '@/types/forms';

// =============================================================================
// SECTION GROUPING
// =============================================================================

/**
 * Groups fields into sections based on 'header' type fields.
 * Fields before the first header go into a default "(ungrouped)" section.
 * Header fields themselves are not included in any section's fields array.
 */
export function groupFieldsIntoSections(
  fields: FormFieldDefinition[]
): FormSectionGroup[] {
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const sections: FormSectionGroup[] = [];

  let currentSection: FormSectionGroup = {
    headerKey: '__default',
    label: '',
    labelEs: undefined,
    fields: [],
  };

  for (const field of sorted) {
    if (field.type === 'header') {
      // Push previous section if it has fields
      if (currentSection.fields.length > 0) {
        sections.push(currentSection);
      }
      // Start a new section from this header
      currentSection = {
        headerKey: field.key,
        label: field.label,
        labelEs: field.label_es,
        fields: [],
      };
    } else {
      currentSection.fields.push(field);
    }
  }

  // Push the last section if it has fields
  if (currentSection.fields.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

// =============================================================================
// CONDITIONAL VISIBILITY
// =============================================================================

/**
 * Evaluate a single field condition against all current form values.
 * Returns true if the condition is met (field should be visible).
 * Returns true if condition is null/undefined (always visible).
 */
export function evaluateCondition(
  condition: FormFieldCondition | null | undefined,
  allValues: FormFieldValues
): boolean {
  if (!condition) return true;

  const currentValue = allValues[condition.field];

  switch (condition.operator) {
    case 'eq':
      return currentValue === condition.value;

    case 'neq':
      return currentValue !== condition.value;

    case 'in': {
      if (!Array.isArray(condition.value)) return false;
      // Handle both string and array current values
      if (Array.isArray(currentValue)) {
        return currentValue.some((v) =>
          (condition.value as unknown[]).includes(v)
        );
      }
      return (condition.value as unknown[]).includes(currentValue);
    }

    case 'exists':
      return (
        currentValue !== null &&
        currentValue !== undefined &&
        currentValue !== '' &&
        !(Array.isArray(currentValue) && currentValue.length === 0)
      );

    default:
      return true;
  }
}

/**
 * Check if a field should be visible based on its condition and current values.
 */
export function isFieldVisible(
  field: FormFieldDefinition,
  allValues: FormFieldValues
): boolean {
  return evaluateCondition(field.condition, allValues);
}

// =============================================================================
// BILINGUAL LABELS
// =============================================================================

/**
 * Get the display label for a field, respecting language preference.
 */
export function getFieldLabel(
  field: FormFieldDefinition,
  language: 'en' | 'es'
): string {
  if (language === 'es' && field.label_es) {
    return field.label_es;
  }
  return field.label;
}

/**
 * Get the display label for a section group, respecting language preference.
 */
export function getSectionLabel(
  section: FormSectionGroup,
  language: 'en' | 'es'
): string {
  if (language === 'es' && section.labelEs) {
    return section.labelEs;
  }
  return section.label;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Return a sensible default value for a given field type.
 * Used when initializing empty form submissions.
 */
export function getDefaultValueForType(type: FormFieldType): FormFieldValue {
  switch (type) {
    case 'text':
    case 'textarea':
    case 'date':
    case 'time':
    case 'datetime':
    case 'phone':
    case 'email':
      return '';

    case 'number':
      return null;

    case 'select':
    case 'radio':
      return '';

    case 'checkbox':
      return [] as string[];

    case 'signature':
      return null;

    case 'image':
      return [] as ImageValue[];

    case 'file':
      return [] as FileValue[];

    case 'contact_lookup':
      return null;

    // Non-fillable types
    case 'header':
    case 'instructions':
      return null;

    default:
      return null;
  }
}

// =============================================================================
// FIELD COUNTING
// =============================================================================

/** Set of field types that are non-fillable (display only) */
const NON_FILLABLE_TYPES: Set<FormFieldType> = new Set([
  'header',
  'instructions',
]);

/**
 * Count the number of fillable fields in a template (excludes headers and instructions).
 */
export function countFillableFields(fields: FormFieldDefinition[]): number {
  return fields.filter((f) => !NON_FILLABLE_TYPES.has(f.type)).length;
}

/**
 * Count the number of filled fields based on current values.
 * A field is "filled" if its value is non-empty (not null, not '', not []).
 */
export function countFilledFields(
  fields: FormFieldDefinition[],
  values: FormFieldValues
): number {
  let count = 0;

  for (const field of fields) {
    if (NON_FILLABLE_TYPES.has(field.type)) continue;

    const value = values[field.key];

    if (value === null || value === undefined) continue;
    if (value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      // SignatureValue, ContactLookupValue — check for non-empty
      const keys = Object.keys(value);
      if (keys.length === 0) continue;
    }

    count++;
  }

  return count;
}

// =============================================================================
// TRANSFORM FUNCTIONS (snake_case DB rows → camelCase frontend objects)
// =============================================================================

/**
 * Transform a raw form_templates DB row (snake_case) to a FormTemplate (camelCase).
 */
export function transformTemplateRow(row: any): FormTemplate {
  return {
    id: row.id,
    groupId: row.group_id,
    slug: row.slug,
    titleEn: row.title_en,
    titleEs: row.title_es ?? null,
    descriptionEn: row.description_en ?? null,
    descriptionEs: row.description_es ?? null,
    icon: row.icon ?? 'ClipboardList',
    headerImage: row.header_image ?? null,
    fields: (row.fields as unknown as FormFieldDefinition[]) ?? [],
    instructionsEn: row.instructions_en ?? null,
    instructionsEs: row.instructions_es ?? null,
    aiTools: (row.ai_tools as unknown as string[]) ?? [],
    status: row.status,
    sortOrder: row.sort_order ?? 0,
    templateVersion: row.template_version ?? 1,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform a raw form_submissions DB row (snake_case) to a FormSubmission (camelCase).
 */
export function transformSubmissionRow(row: any): FormSubmission {
  return {
    id: row.id,
    templateId: row.template_id,
    groupId: row.group_id,
    templateVersion: row.template_version ?? 1,
    fieldsSnapshot:
      (row.fields_snapshot as unknown as FormFieldDefinition[]) ?? null,
    fieldValues: (row.field_values as unknown as FormFieldValues) ?? {},
    status: row.status,
    filledBy: row.filled_by,
    submittedBy: row.submitted_by ?? null,
    subjectUserId: row.subject_user_id ?? null,
    submittedAt: row.submitted_at ?? null,
    attachments:
      (row.attachments as unknown as FormAttachment[]) ?? [],
    aiSessionId: row.ai_session_id ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform a raw contacts DB row (snake_case) to a Contact (camelCase).
 */
export function transformContactRow(row: any): Contact {
  return {
    id: row.id,
    groupId: row.group_id,
    category: row.category,
    subcategory: row.subcategory ?? null,
    name: row.name,
    contactPerson: row.contact_person ?? null,
    phone: row.phone ?? null,
    phoneAlt: row.phone_alt ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    notes: row.notes ?? null,
    isPriority: row.is_priority ?? false,
    isDemoData: row.is_demo_data ?? false,
    sortOrder: row.sort_order ?? 0,
    status: row.status ?? 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
