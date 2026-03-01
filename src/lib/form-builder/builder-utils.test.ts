import { describe, it, expect } from 'vitest';
import {
  generateFieldKey,
  generateSlug,
  getDefaultField,
  reorderFields,
  computeAiFillabilityScore,
  getToolRecommendations,
} from './builder-utils';
import type { FormFieldDefinition, FormFieldType } from '@/types/forms';

// =============================================================================
// HELPERS
// =============================================================================

function makeField(overrides: Partial<FormFieldDefinition> & { key: string; type: FormFieldType }): FormFieldDefinition {
  return {
    label: overrides.key,
    order: 1,
    width: 'full',
    ...overrides,
  };
}

// =============================================================================
// generateFieldKey
// =============================================================================

describe('generateFieldKey', () => {
  it('converts label to snake_case key', () => {
    expect(generateFieldKey('Employee Name', [])).toBe('employee_name');
  });

  it('strips special characters', () => {
    expect(generateFieldKey('What happened?!', [])).toBe('what_happened');
  });

  it('deduplicates against existing keys', () => {
    const existing = ['employee_name'];
    expect(generateFieldKey('Employee Name', existing)).toBe('employee_name_2');
  });

  it('deduplicates multiple collisions', () => {
    const existing = ['employee_name', 'employee_name_2', 'employee_name_3'];
    expect(generateFieldKey('Employee Name', existing)).toBe('employee_name_4');
  });

  it('handles empty label', () => {
    expect(generateFieldKey('', [])).toBe('field');
  });

  it('prepends f_ when label starts with non-letter', () => {
    expect(generateFieldKey('123 Field', []).startsWith('f_')).toBe(true);
  });

  it('truncates to 40 characters', () => {
    const longLabel = 'a'.repeat(100);
    expect(generateFieldKey(longLabel, []).length).toBeLessThanOrEqual(40);
  });
});

// =============================================================================
// generateSlug
// =============================================================================

describe('generateSlug', () => {
  it('converts title to URL-safe slug', () => {
    expect(generateSlug('Employee Write-Up')).toBe('employee-write-up');
  });

  it('strips special characters', () => {
    expect(generateSlug('Injury Report (2024)')).toBe('injury-report-2024');
  });

  it('collapses multiple hyphens', () => {
    expect(generateSlug('foo---bar')).toBe('foo-bar');
  });

  it('trims leading/trailing hyphens', () => {
    expect(generateSlug('-hello world-')).toBe('hello-world');
  });

  it('returns "untitled-form" for empty input', () => {
    expect(generateSlug('')).toBe('untitled-form');
    expect(generateSlug('   ')).toBe('untitled-form');
  });

  it('truncates to 60 characters', () => {
    const longTitle = 'a '.repeat(50);
    expect(generateSlug(longTitle).length).toBeLessThanOrEqual(60);
  });
});

// =============================================================================
// getDefaultField
// =============================================================================

describe('getDefaultField', () => {
  it('returns a field with correct type', () => {
    const field = getDefaultField('text', []);
    expect(field.type).toBe('text');
    expect(field.key).toBe('text_field');
    expect(field.label).toBe('Text Field');
    expect(field.order).toBe(1);
    expect(field.width).toBe('full');
  });

  it('sets required=false for fillable types', () => {
    const field = getDefaultField('email', []);
    expect(field.required).toBe(false);
  });

  it('does NOT set required for header', () => {
    const field = getDefaultField('header', []);
    expect(field.required).toBeUndefined();
  });

  it('does NOT set required for instructions', () => {
    const field = getDefaultField('instructions', []);
    expect(field.required).toBeUndefined();
  });

  it('provides default options for select', () => {
    const field = getDefaultField('select', []);
    expect(field.options).toEqual(['Option 1', 'Option 2']);
  });

  it('provides default options for radio', () => {
    const field = getDefaultField('radio', []);
    expect(field.options).toEqual(['Option 1', 'Option 2']);
  });

  it('provides default options for checkbox', () => {
    const field = getDefaultField('checkbox', []);
    expect(field.options).toEqual(['Option 1', 'Option 2']);
  });

  it('does NOT provide options for text', () => {
    const field = getDefaultField('text', []);
    expect(field.options).toBeUndefined();
  });

  it('deduplicates key against existing keys', () => {
    const field = getDefaultField('text', ['text_field']);
    expect(field.key).toBe('text_field_2');
  });

  it('sets order based on existing keys count', () => {
    const field = getDefaultField('text', ['a', 'b', 'c']);
    expect(field.order).toBe(4);
  });

  const allTypes: FormFieldType[] = [
    'text', 'textarea', 'date', 'time', 'datetime',
    'select', 'radio', 'checkbox', 'number', 'phone',
    'email', 'signature', 'image', 'file', 'header',
    'instructions', 'contact_lookup',
  ];

  it.each(allTypes)('produces valid field for type "%s"', (type) => {
    const field = getDefaultField(type, []);
    expect(field.key).toBeTruthy();
    expect(field.label).toBeTruthy();
    expect(field.type).toBe(type);
    expect(field.order).toBe(1);
  });
});

// =============================================================================
// reorderFields
// =============================================================================

describe('reorderFields', () => {
  const fields: FormFieldDefinition[] = [
    makeField({ key: 'a', type: 'text', order: 1 }),
    makeField({ key: 'b', type: 'text', order: 2 }),
    makeField({ key: 'c', type: 'text', order: 3 }),
  ];

  it('moves field forward', () => {
    const result = reorderFields(fields, 'a', 'c');
    expect(result.map(f => f.key)).toEqual(['b', 'c', 'a']);
    expect(result.map(f => f.order)).toEqual([1, 2, 3]);
  });

  it('moves field backward', () => {
    const result = reorderFields(fields, 'c', 'a');
    expect(result.map(f => f.key)).toEqual(['c', 'a', 'b']);
    expect(result.map(f => f.order)).toEqual([1, 2, 3]);
  });

  it('returns same array when keys are equal', () => {
    const result = reorderFields(fields, 'a', 'a');
    expect(result).toBe(fields);
  });

  it('returns same array when active key not found', () => {
    const result = reorderFields(fields, 'nonexistent', 'a');
    expect(result).toBe(fields);
  });

  it('returns same array when over key not found', () => {
    const result = reorderFields(fields, 'a', 'nonexistent');
    expect(result).toBe(fields);
  });

  it('reassigns sequential order values', () => {
    const result = reorderFields(fields, 'c', 'b');
    for (let i = 0; i < result.length; i++) {
      expect(result[i].order).toBe(i + 1);
    }
  });
});

// =============================================================================
// computeAiFillabilityScore
// =============================================================================

describe('computeAiFillabilityScore', () => {
  it('returns 0 for empty fields', () => {
    const result = computeAiFillabilityScore([], 'instructions', ['tool1']);
    expect(result.score).toBe(0);
    expect(result.issues).toContain('No fillable fields in the form');
  });

  it('ignores header and instructions fields', () => {
    const fields = [
      makeField({ key: 'h', type: 'header' }),
      makeField({ key: 'i', type: 'instructions' }),
    ];
    const result = computeAiFillabilityScore(fields, 'instructions', ['tool1']);
    expect(result.score).toBe(0);
  });

  it('returns high score for well-configured form', () => {
    const fields = [
      makeField({ key: 'name', type: 'text' }),
      makeField({ key: 'dept', type: 'select', options: ['FOH', 'BOH'] }),
    ];
    const result = computeAiFillabilityScore(fields, 'Fill this form carefully.', ['search_contacts']);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('deducts for missing instructions', () => {
    const fields = [
      makeField({ key: 'name', type: 'text' }),
    ];
    const withInstructions = computeAiFillabilityScore(fields, 'Yes', ['tool1']);
    const withoutInstructions = computeAiFillabilityScore(fields, '', ['tool1']);
    expect(withoutInstructions.score).toBeLessThan(withInstructions.score);
  });

  it('deducts for missing AI tools', () => {
    const fields = [
      makeField({ key: 'name', type: 'text' }),
    ];
    const withTools = computeAiFillabilityScore(fields, 'Yes', ['tool1']);
    const withoutTools = computeAiFillabilityScore(fields, 'Yes', []);
    expect(withoutTools.score).toBeLessThan(withTools.score);
  });

  it('does not deduct for fields without ai_hint', () => {
    const fields = [
      makeField({ key: 'name', type: 'text' }),
    ];
    const result = computeAiFillabilityScore(fields, 'Yes', ['tool1']);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('deducts for choice fields without options', () => {
    const fields = [
      makeField({ key: 'dept', type: 'select' }), // no options
    ];
    const result = computeAiFillabilityScore(fields, 'Yes', ['tool1']);
    expect(result.issues.some(i => i.includes('has no options'))).toBe(true);
  });

  it('score is capped between 0 and 100', () => {
    // Many bad fields to drive score below 0
    const fields = Array.from({ length: 20 }, (_, i) =>
      makeField({ key: `f${i}`, type: 'text', required: true }),
    );
    const result = computeAiFillabilityScore(fields, '', []);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// getToolRecommendations
// =============================================================================

describe('getToolRecommendations', () => {
  it('recommends search_contacts for contact_lookup fields', () => {
    const fields = [makeField({ key: 'doc', type: 'contact_lookup' })];
    const recs = getToolRecommendations('Form', fields, []);
    expect(recs.some(r => r.toolId === 'search_contacts')).toBe(true);
  });

  it('recommends search_contacts for emergency keyword', () => {
    const recs = getToolRecommendations('Emergency Report', [], []);
    expect(recs.some(r => r.toolId === 'search_contacts')).toBe(true);
  });

  it('recommends search_manual for policy keywords', () => {
    const recs = getToolRecommendations('Employee Write-Up', [], []);
    expect(recs.some(r => r.toolId === 'search_manual')).toBe(true);
  });

  it('recommends search_products for menu keywords', () => {
    const recs = getToolRecommendations('Menu Special Form', [], []);
    expect(recs.some(r => r.toolId === 'search_products')).toBe(true);
  });

  it('recommends search_standards for inspection keywords', () => {
    const recs = getToolRecommendations('Quality Inspection', [], []);
    expect(recs.some(r => r.toolId === 'search_standards')).toBe(true);
  });

  it('recommends search_steps_of_service for service keywords', () => {
    const recs = getToolRecommendations('Server Greeting', [], []);
    expect(recs.some(r => r.toolId === 'search_steps_of_service')).toBe(true);
  });

  it('does NOT recommend already-enabled tools', () => {
    const recs = getToolRecommendations('Emergency Report', [], ['search_contacts']);
    expect(recs.some(r => r.toolId === 'search_contacts')).toBe(false);
  });

  it('returns empty for non-matching title', () => {
    const recs = getToolRecommendations('Generic Form', [], []);
    expect(recs).toHaveLength(0);
  });
});
