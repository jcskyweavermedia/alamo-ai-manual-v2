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
  ContactLookupValue,
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
    case 'yes_no':
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
    icon: row.icon ?? '📋',
    iconColor: row.icon_color ?? 'blue',
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
    publishedAt: row.published_at ?? null,
    builderState: row.builder_state ?? null,
    aiRefinementLog: (row.ai_refinement_log as unknown as Array<{ role: string; content: string; timestamp: string }>) ?? [],
    aiSystemPromptEn: row.ai_system_prompt_en ?? null,
    aiSystemPromptEs: row.ai_system_prompt_es ?? null,
    instructionsRefined: row.instructions_refined ?? false,
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
// =============================================================================
// MAIN FIELD EXTRACTION (Filing Cabinet cards)
// =============================================================================

/**
 * Extract the first fillable field's label + value from a submission.
 * Used to show a prominent name/title on Filing Cabinet result cards.
 */
export function extractMainField(
  fields: FormFieldDefinition[],
  values: FormFieldValues,
  language: 'en' | 'es',
): { label: string; value: string } | null {
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const first = sorted.find((f) => !NON_FILLABLE_TYPES.has(f.type));
  if (!first) return null;

  const raw = values[first.key];
  if (raw === null || raw === undefined || raw === '') return null;

  const label = getFieldLabel(first, language);
  let value: string;

  if (typeof raw === 'string') {
    value = raw;
  } else if (typeof raw === 'number') {
    value = String(raw);
  } else if (typeof raw === 'boolean') {
    value = raw ? (language === 'es' ? 'Sí' : 'Yes') : 'No';
  } else if (Array.isArray(raw)) {
    // string[] (checkbox) or ImageValue[]/FileValue[] — show joined or count
    if (raw.length === 0) return null;
    if (typeof raw[0] === 'string') {
      value = (raw as string[]).join(', ');
    } else {
      value = `${raw.length} ${raw.length === 1 ? 'item' : 'items'}`;
    }
  } else if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    // ContactLookupValue
    value = (raw as ContactLookupValue).name;
  } else {
    return null;
  }

  return { label, value };
}

// =============================================================================
// EMAIL BUILDER (Filing Cabinet viewer)
// =============================================================================

/** Field types whose values are binary / non-textual */
const SKIP_EMAIL_TYPES: Set<FormFieldType> = new Set([
  'signature',
  'image',
  'file',
  'header',
  'instructions',
]);

/**
 * Build a mailto: URL with form data pre-populated.
 */
export function buildFormEmail(
  templateTitle: string,
  fields: FormFieldDefinition[],
  values: FormFieldValues,
  metadata: {
    filledByName: string | null;
    subjectName: string | null;
    submittedAt: string | null;
    createdAt: string;
  },
  language: 'en' | 'es',
): string {
  // --- Subject line ---
  const mainField = extractMainField(fields, values, language);
  const datePart = new Date(metadata.submittedAt ?? metadata.createdAt)
    .toLocaleDateString(language === 'es' ? 'es' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  const subjectParts = [templateTitle];
  if (mainField) subjectParts.push(mainField.value);
  subjectParts.push(datePart);
  const subject = subjectParts.join(' — ');

  // --- Body ---
  const lines: string[] = [];
  lines.push(templateTitle);
  lines.push('='.repeat(templateTitle.length));
  lines.push('');

  if (metadata.filledByName) {
    lines.push(`${language === 'es' ? 'Enviado por' : 'Submitted by'}: ${metadata.filledByName}`);
  }
  if (metadata.subjectName) {
    lines.push(`${language === 'es' ? 'Sujeto' : 'Subject'}: ${metadata.subjectName}`);
  }
  lines.push(`${language === 'es' ? 'Fecha' : 'Date'}: ${datePart}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const sorted = [...fields].sort((a, b) => a.order - b.order);
  for (const field of sorted) {
    if (SKIP_EMAIL_TYPES.has(field.type)) continue;

    const label = getFieldLabel(field, language);
    const raw = values[field.key];

    let display: string;
    if (raw === null || raw === undefined || raw === '') {
      display = '—';
    } else if (typeof raw === 'string') {
      display = raw;
    } else if (typeof raw === 'number') {
      display = String(raw);
    } else if (typeof raw === 'boolean') {
      display = raw ? (language === 'es' ? 'Sí' : 'Yes') : 'No';
    } else if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
      display = (raw as string[]).join(', ');
    } else if (typeof raw === 'object' && raw !== null && 'name' in raw) {
      display = (raw as ContactLookupValue).name;
    } else {
      continue;
    }

    lines.push(`${label}: ${display}`);
  }

  const body = lines.join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// =============================================================================
// TRANSFORM FUNCTIONS (continued)
// =============================================================================

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
