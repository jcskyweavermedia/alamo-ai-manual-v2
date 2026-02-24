// =============================================================================
// Translatable Fields — Config + helpers for product translation system
// Phase 6: Translation System
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

export interface TranslatableFieldDef {
  fieldPath: string;         // dot notation for simple fields, bracket notation for arrays
  label: string;             // human-readable for UI display
  type: 'text' | 'array-of-text' | 'procedure-steps' | 'cocktail-steps' | 'ingredient-names';
  category?: string;         // grouping key for category-based translation (prep_recipes)
}

// =============================================================================
// FIELD DEFINITIONS
// =============================================================================

/** Map from DB product_table name to its translatable fields */
export const TRANSLATABLE_FIELDS: Record<string, TranslatableFieldDef[]> = {
  prep_recipes: [
    { fieldPath: 'name', label: 'Recipe Name', type: 'text', category: 'name' },
    { fieldPath: 'ingredients', label: 'Ingredient Names', type: 'ingredient-names', category: 'ingredients' },
    { fieldPath: 'procedure', label: 'Procedure Steps', type: 'procedure-steps', category: 'procedure' },
    { fieldPath: 'training_notes.notes', label: 'Training Notes', type: 'text', category: 'trainingNotes' },
    { fieldPath: 'training_notes.common_mistakes', label: 'Common Mistakes', type: 'array-of-text', category: 'trainingNotes' },
    { fieldPath: 'training_notes.quality_checks', label: 'Quality Checks', type: 'array-of-text', category: 'trainingNotes' },
  ],
  plate_specs: [
    { fieldPath: 'assembly_procedure', label: 'Assembly Steps', type: 'procedure-steps' },
    { fieldPath: 'notes', label: 'Plating Notes', type: 'text' },
  ],
  foh_plate_specs: [
    { fieldPath: 'short_description', label: 'Short Description', type: 'text' },
    { fieldPath: 'detailed_description', label: 'Detailed Description', type: 'text' },
    { fieldPath: 'notes', label: 'Notes', type: 'text' },
  ],
  wines: [
    { fieldPath: 'tasting_notes', label: 'Tasting Notes', type: 'text' },
    { fieldPath: 'producer_notes', label: 'Producer Notes', type: 'text' },
    { fieldPath: 'notes', label: 'Service Notes', type: 'text' },
  ],
  cocktails: [
    { fieldPath: 'procedure', label: 'Procedure Steps', type: 'cocktail-steps' },
    { fieldPath: 'tasting_notes', label: 'Tasting Notes', type: 'text' },
    { fieldPath: 'description', label: 'Description', type: 'text' },
    { fieldPath: 'notes', label: 'Notes', type: 'text' },
  ],
  beer_liquor_list: [
    { fieldPath: 'description', label: 'Description', type: 'text' },
    { fieldPath: 'notes', label: 'Notes', type: 'text' },
  ],
};

// =============================================================================
// EXTRACTION RESULT
// =============================================================================

export interface TranslatableText {
  fieldPath: string;   // with array indices, e.g. "procedure[0].steps[1].instruction"
  sourceText: string;
  label: string;
}

// =============================================================================
// HELPERS — Internal path utilities
// =============================================================================

/**
 * Resolve a simple dot-notation path (no brackets) against an object.
 * Returns undefined if any segment is missing.
 */
function resolveDotPath(obj: Record<string, unknown>, dotPath: string): unknown {
  const segments = dotPath.split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Parse a field path with bracket indices and resolve it against a data object.
 * Supports paths like "procedure[0].steps[1].instruction" and "training_notes.common_mistakes[0]".
 */
function resolveIndexedPath(obj: Record<string, unknown>, path: string): unknown {
  // Split on dots but keep bracket indices attached to their segment
  const tokens = tokenizePath(path);
  let current: unknown = obj;

  for (const token of tokens) {
    if (current == null) return undefined;

    // Check if token has array index, e.g. "procedure[0]" or "steps[1]"
    const bracketMatch = token.match(/^([^[]+)\[(\d+)\]$/);
    if (bracketMatch) {
      const key = bracketMatch[1];
      const index = parseInt(bracketMatch[2], 10);
      if (typeof current !== 'object') return undefined;
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr[index];
    } else {
      // Simple key
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[token];
    }
  }

  return current;
}

/**
 * Tokenize a path string into segments split by '.', preserving bracket notation.
 * "procedure[0].steps[1].instruction" → ["procedure[0]", "steps[1]", "instruction"]
 * "training_notes.common_mistakes[0]" → ["training_notes", "common_mistakes[0]"]
 */
function tokenizePath(path: string): string[] {
  return path.split('.');
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Extract individual translatable text segments from a product's data.
 *
 * Returns array of { fieldPath, sourceText, label } where fieldPath includes
 * array indices for structured types:
 * - procedure-steps: "procedure[0].group_name", "procedure[0].steps[0].instruction"
 * - cocktail-steps: "procedure[0].instruction"
 * - array-of-text: "training_notes.common_mistakes[0]"
 * - text: the fieldPath directly
 *
 * Skips empty strings and null/undefined values.
 */
export function extractTranslatableTexts(
  productTable: string,
  productData: Record<string, unknown>,
  categories?: Set<string>,
): TranslatableText[] {
  const allDefs = TRANSLATABLE_FIELDS[productTable];
  if (!allDefs) return [];

  // Filter by category if provided (backward compatible — no arg = all fields)
  const fieldDefs = categories
    ? allDefs.filter((d) => d.category && categories.has(d.category))
    : allDefs;

  const results: TranslatableText[] = [];

  for (const def of fieldDefs) {
    switch (def.type) {
      case 'text': {
        const value = resolveDotPath(productData, def.fieldPath);
        if (typeof value === 'string' && value.trim() !== '') {
          results.push({
            fieldPath: def.fieldPath,
            sourceText: value,
            label: def.label,
          });
        }
        break;
      }

      case 'array-of-text': {
        const arr = resolveDotPath(productData, def.fieldPath);
        if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (typeof item === 'string' && item.trim() !== '') {
              results.push({
                fieldPath: `${def.fieldPath}[${i}]`,
                sourceText: item,
                label: `${def.label} [${i + 1}]`,
              });
            }
          }
        }
        break;
      }

      case 'procedure-steps': {
        // Structure: { group_name: string; order: number; steps: { step_number, instruction, critical }[] }[]
        const groups = resolveDotPath(productData, def.fieldPath);
        if (Array.isArray(groups)) {
          for (let gi = 0; gi < groups.length; gi++) {
            const group = groups[gi] as Record<string, unknown>;
            if (!group) continue;

            // Group name
            const groupName = group.group_name;
            if (typeof groupName === 'string' && groupName.trim() !== '') {
              results.push({
                fieldPath: `${def.fieldPath}[${gi}].group_name`,
                sourceText: groupName,
                label: `${def.label} - Group ${gi + 1} Name`,
              });
            }

            // Steps within group
            const steps = group.steps;
            if (Array.isArray(steps)) {
              for (let si = 0; si < steps.length; si++) {
                const step = steps[si] as Record<string, unknown>;
                if (!step) continue;
                const instruction = step.instruction;
                if (typeof instruction === 'string' && instruction.trim() !== '') {
                  results.push({
                    fieldPath: `${def.fieldPath}[${gi}].steps[${si}].instruction`,
                    sourceText: instruction,
                    label: `${def.label} - Group ${gi + 1}, Step ${si + 1}`,
                  });
                }
              }
            }
          }
        }
        break;
      }

      case 'cocktail-steps': {
        // Structure: { step: number; instruction: string }[]
        const steps = resolveDotPath(productData, def.fieldPath);
        if (Array.isArray(steps)) {
          for (let si = 0; si < steps.length; si++) {
            const step = steps[si] as Record<string, unknown>;
            if (!step) continue;
            const instruction = step.instruction;
            if (typeof instruction === 'string' && instruction.trim() !== '') {
              results.push({
                fieldPath: `${def.fieldPath}[${si}].instruction`,
                sourceText: instruction,
                label: `${def.label} - Step ${si + 1}`,
              });
            }
          }
        }
        break;
      }

      case 'ingredient-names': {
        // Structure: { group_name, items: { name, quantity, unit, ... }[] }[]
        const groups = resolveDotPath(productData, def.fieldPath);
        if (Array.isArray(groups)) {
          for (let gi = 0; gi < groups.length; gi++) {
            const group = groups[gi] as Record<string, unknown>;
            if (!group) continue;
            const items = group.items;
            if (Array.isArray(items)) {
              for (let ii = 0; ii < items.length; ii++) {
                const item = items[ii] as Record<string, unknown>;
                if (!item) continue;
                const name = item.name;
                if (typeof name === 'string' && name.trim() !== '') {
                  results.push({
                    fieldPath: `${def.fieldPath}[${gi}].items[${ii}].name`,
                    sourceText: name,
                    label: `${def.label} - Group ${gi + 1}, Item ${ii + 1}`,
                  });
                }
              }
            }
          }
        }
        break;
      }
    }
  }

  return results;
}

/**
 * Given a product data object and a field_path with indices
 * (e.g. "procedure[0].steps[1].instruction"), return the current English text value.
 *
 * Returns null if the path cannot be resolved or the value is not a string.
 */
export function getFieldValue(
  productData: Record<string, unknown>,
  fieldPath: string,
): string | null {
  const value = resolveIndexedPath(productData, fieldPath);
  return typeof value === 'string' ? value : null;
}
