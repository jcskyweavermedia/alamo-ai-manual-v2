// =============================================================================
// Form Builder Utilities
// =============================================================================

import type { FormFieldDefinition, FormFieldType } from '@/types/forms';
import type {
  AIFillabilityResult,
  ToolRecommendation,
} from '@/types/form-builder';

// =============================================================================
// SLUG & KEY GENERATION
// =============================================================================

/**
 * Generate a slug-formatted field key from a label.
 * Deduplicates against existing keys by appending _2, _3, etc.
 */
export function generateFieldKey(label: string, existingKeys: string[]): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^[^a-z]/, 'f_')
    .slice(0, 40) || 'field';

  let key = base;
  let suffix = 2;
  while (existingKeys.includes(key)) {
    key = `${base}_${suffix++}`;
    if (suffix > 100) break;
  }
  return key;
}

/**
 * Generate a URL-safe slug from a template title.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'untitled-form';
}

// =============================================================================
// FIELD DEFAULTS
// =============================================================================

/**
 * Default field values for each field type.
 */
export function getDefaultField(
  type: FormFieldType,
  existingKeys: string[],
): FormFieldDefinition {
  const labelMap: Record<FormFieldType, string> = {
    text: 'Text Field',
    textarea: 'Text Area',
    date: 'Date',
    time: 'Time',
    datetime: 'Date & Time',
    select: 'Dropdown',
    radio: 'Radio Choice',
    checkbox: 'Checkbox',
    number: 'Number',
    phone: 'Phone',
    email: 'Email',
    signature: 'Signature',
    image: 'Photo',
    file: 'File Upload',
    header: 'Section Header',
    instructions: 'Instructions',
    contact_lookup: 'Contact Lookup',
    yes_no: 'Yes / No',
  };

  const label = labelMap[type] || 'Field';
  const key = generateFieldKey(label, existingKeys);

  const base: FormFieldDefinition = {
    key,
    label,
    type,
    order: existingKeys.length + 1,
    width: 'full',
  };

  // Type-specific defaults
  if (['select', 'radio', 'checkbox'].includes(type)) {
    base.options = ['Option 1', 'Option 2'];
  }
  if (type === 'yes_no') {
    base.options = ['Yes', 'No'];
  }
  if (!['header', 'instructions'].includes(type)) {
    base.required = false;
  }

  return base;
}

// =============================================================================
// FIELD REORDERING
// =============================================================================

/**
 * Reorder fields by moving activeKey to the position of overKey.
 * Returns a new array with order values resequenced 1..N.
 */
export function reorderFields(
  fields: FormFieldDefinition[],
  activeKey: string,
  overKey: string,
): FormFieldDefinition[] {
  const oldIndex = fields.findIndex(f => f.key === activeKey);
  const newIndex = fields.findIndex(f => f.key === overKey);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return fields;
  }

  const reordered = [...fields];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  // Reassign sequential order values
  return reordered.map((f, i) => ({ ...f, order: i + 1 }));
}

// =============================================================================
// AI FILLABILITY SCORE
// =============================================================================

/**
 * Compute an AI fillability score for a set of fields.
 *
 * Scoring rubric (per arch plan Section 4.5):
 * - Base score starts at 100
 * - Deductions for fields lacking ai_hint when the field type is ambiguous
 * - Deductions for select/radio/checkbox fields without options
 * - Deductions for missing required fields without placeholder
 * - Bonus for having instructions
 * - Bonus for having enabled AI tools
 *
 * Score range: 0 to 100
 */
export function computeAiFillabilityScore(
  fields: FormFieldDefinition[],
  instructionsEn?: string,
  aiTools?: string[],
): AIFillabilityResult {
  const issues: string[] = [];

  // Only count fillable fields (exclude header and instructions)
  const fillableFields = fields.filter(
    f => !['header', 'instructions'].includes(f.type),
  );

  if (fillableFields.length === 0) {
    return { score: 0, issues: ['No fillable fields in the form'] };
  }

  let totalDeduction = 0;

  // Per-field analysis
  const ambiguousTypes: FormFieldType[] = ['text', 'textarea', 'number', 'date', 'time', 'datetime'];

  for (const field of fillableFields) {
    // Choice fields without options are unfillable
    if (['select', 'radio', 'checkbox'].includes(field.type)) {
      if (!field.options || field.options.length === 0) {
        totalDeduction += 10;
        issues.push(`"${field.label}" (${field.type}) has no options`);
      }
    }

    // Required field without a label
    if (field.required && !field.label?.trim()) {
      totalDeduction += 5;
      issues.push(`Required field "${field.key}" has no label`);
    }
  }

  // Global checks
  if (!instructionsEn?.trim()) {
    totalDeduction += 15;
    issues.push('No English instructions for AI guidance');
  }

  if (!aiTools || aiTools.length === 0) {
    totalDeduction += 10;
    issues.push('No AI tools enabled');
  }

  // Cap at 0
  const score = Math.max(0, Math.min(100, 100 - totalDeduction));

  return { score, issues };
}

// =============================================================================
// TOOL RECOMMENDATIONS
// =============================================================================

/**
 * Generate tool recommendations based on form title and field types.
 * Only recommends tools that are not already enabled.
 * Client-side keyword matching (no API call).
 */
export function getToolRecommendations(
  title: string,
  fields: FormFieldDefinition[],
  enabledTools: string[],
): ToolRecommendation[] {
  const recs: ToolRecommendation[] = [];
  const titleLower = title.toLowerCase();

  // Recommend search_contacts if there are contact_lookup fields or contact-related keywords
  if (!enabledTools.includes('search_contacts')) {
    const hasContactField = fields.some(f => f.type === 'contact_lookup');
    const hasContactKeyword = /hospital|doctor|medical|emergency|call|contact|vendor|phone/.test(titleLower);
    if (hasContactField) {
      recs.push({
        toolId: 'search_contacts',
        reason: 'contact_lookup field detected',
      });
    } else if (hasContactKeyword) {
      recs.push({
        toolId: 'search_contacts',
        reason: 'Title suggests contact references',
      });
    }
  }

  // Recommend search_manual for policy-related forms
  if (!enabledTools.includes('search_manual')) {
    const hasPolicyKeyword = /write-up|incident|violation|policy|procedure|complaint|disciplinary|safety|hygiene|sanitation/.test(titleLower);
    if (hasPolicyKeyword) {
      recs.push({
        toolId: 'search_manual',
        reason: 'Title suggests policy or procedure references',
      });
    }
  }

  // Recommend search_products for menu/food-related forms
  if (!enabledTools.includes('search_products')) {
    const hasProductKeyword = /menu|recipe|dish|food|wine|cocktail|beverage|ingredient|special|plate|prep/.test(titleLower);
    if (hasProductKeyword) {
      recs.push({
        toolId: 'search_products',
        reason: 'Title suggests product or menu references',
      });
    }
  }

  // Recommend search_standards for quality or standards forms
  if (!enabledTools.includes('search_standards')) {
    const hasStandardsKeyword = /quality|standard|inspection|audit|checklist|dress|uniform|grooming/.test(titleLower);
    if (hasStandardsKeyword) {
      recs.push({
        toolId: 'search_standards',
        reason: 'Title suggests quality standards references',
      });
    }
  }

  // Recommend search_steps_of_service for service-related forms
  if (!enabledTools.includes('search_steps_of_service')) {
    const hasServiceKeyword = /service|greeting|table|server|host|foh|front|guest|reservation/.test(titleLower);
    if (hasServiceKeyword) {
      recs.push({
        toolId: 'search_steps_of_service',
        reason: 'Title suggests service procedure references',
      });
    }
  }

  return recs;
}

// NOTE: validateForPublish lives in publish-validation.ts (comprehensive 11-check version).
// Do NOT add a duplicate here. Import from '@/lib/form-builder/publish-validation' instead.
