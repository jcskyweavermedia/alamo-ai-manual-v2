// =============================================================================
// Template Mapper — snake_case (edge function) → camelCase (BuilderState)
// =============================================================================

import type { FormFieldDefinition } from '@/types/forms';
import type { BuilderState, GenerateResponse } from '@/types/form-builder';

/**
 * Maps AI-generated template (snake_case from edge function) to BuilderState shape.
 * Note: field array items stay snake_case since FormFieldDefinition uses snake_case.
 */
export function mapGeneratedTemplate(raw: GenerateResponse): Partial<BuilderState> {
  return {
    titleEn: raw.title_en,
    titleEs: raw.title_es,
    descriptionEn: raw.description_en,
    descriptionEs: raw.description_es,
    icon: raw.icon,
    iconColor: raw.icon_color ?? 'blue',
    instructionsEn: raw.instructions_en,
    instructionsEs: raw.instructions_es,
    aiTools: raw.ai_tools ?? [],
    fields: sanitizeGeneratedFields(raw.fields),
    instructionsRefined: true,
  };
}

/**
 * Reusable field sanitization for AI-generated fields.
 * Ensures DB trigger compliance:
 * - Deduplicate keys (also against existingKeys if provided)
 * - Ensure select/radio/checkbox have options
 * - Resequence order values
 * - Validate key format
 * - Default width to 'full'
 *
 * @param rawFields — Array of raw field objects (from edge function or chat)
 * @param existingKeys — Optional set of keys already in the form (for dedup)
 */
export function sanitizeFields(
  rawFields: Array<{
    key: string;
    label: string;
    label_es?: string;
    type: string;
    required?: boolean;
    placeholder?: string | null;
    section?: string | null;
    section_es?: string | null;
    hint?: string | null;
    hint_es?: string | null;
    ai_hint?: string | null;
    options?: string[] | null;
    order?: number;
    width?: 'full' | 'half';
  }>,
  existingKeys?: Set<string>,
): FormFieldDefinition[] {
  const seenKeys = new Set<string>(existingKeys || []);

  const VALID_FIELD_TYPES = new Set([
    'text', 'textarea', 'date', 'time', 'datetime',
    'select', 'radio', 'checkbox', 'number', 'phone',
    'email', 'signature', 'image', 'file', 'header',
    'instructions', 'contact_lookup', 'yes_no',
  ]);

  return rawFields
    .filter((f) => {
      // Skip fields with invalid types
      if (f.type && !VALID_FIELD_TYPES.has(f.type)) {
        console.warn(`[sanitizeFields] Dropping field with invalid type: ${f.type}`);
        return false;
      }
      // Skip fields whose key already exists (dedup against existing form fields)
      if (existingKeys) {
        const slugified = (f.key || '')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/^[^a-z]/, 'f_');
        if (existingKeys.has(slugified)) return false;
      }
      return true;
    })
    .map((f, i) => {
      // Slugify key
      let key = (f.key || `field_${i + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^[^a-z]/, 'f_');

      // Deduplicate
      const baseKey = key;
      let suffix = 2;
      while (seenKeys.has(key)) {
        key = `${baseKey}_${suffix++}`;
      }
      seenKeys.add(key);

      // Ensure options for choice fields
      const fieldType = f.type as FormFieldDefinition['type'];
      const needsOptions = ['select', 'radio', 'checkbox'].includes(f.type);
      const options = needsOptions && (!f.options || f.options.length === 0)
        ? ['Option 1']
        : f.options ?? undefined;

      const field: FormFieldDefinition = {
        key,
        label: f.label,
        label_es: f.label_es || undefined,
        type: fieldType,
        required: f.required ?? false,
        placeholder: f.placeholder || undefined,
        section: f.section || undefined,
        section_es: f.section_es || undefined,
        hint: f.hint || undefined,
        hint_es: f.hint_es || undefined,
        ai_hint: f.ai_hint || undefined,
        options,
        order: i + 1,
        width: f.width || 'full',
      };

      return field;
    });
}

/**
 * Clean AI-generated fields to ensure DB trigger compliance.
 * Delegates to sanitizeFields for the actual logic.
 */
function sanitizeGeneratedFields(
  rawFields: GenerateResponse['fields'],
): FormFieldDefinition[] {
  return sanitizeFields(rawFields);
}
