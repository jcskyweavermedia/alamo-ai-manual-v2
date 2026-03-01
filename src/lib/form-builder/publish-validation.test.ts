import { describe, it, expect } from 'vitest';
import {
  validateForPublish,
  getPublishBlockers,
  isPublishable,
} from './publish-validation';
import type { BuilderState } from '@/types/form-builder';
import type { FormFieldDefinition } from '@/types/forms';

// =============================================================================
// HELPERS
// =============================================================================

function makeState(overrides: Partial<BuilderState> = {}): BuilderState {
  return {
    templateId: 'test-id',
    slug: 'test-form',
    titleEn: 'Test Form',
    titleEs: '',
    descriptionEn: '',
    descriptionEs: '',
    icon: '📋',
    status: 'draft',
    templateVersion: 1,
    publishedAt: null,
    fields: [
      {
        key: 'name',
        label: 'Name',
        type: 'text',
        order: 1,
        width: 'full',
        required: true,
      },
    ],
    selectedFieldKey: null,
    activeTab: 'fields',
    rightPanelMode: 'preview',
    instructionsEn: 'Fill this form.',
    instructionsEs: 'Llena este formulario.',
    instructionLanguage: 'en',
    aiTools: ['search_manual'],
    isDirty: false,
    saveStatus: 'saved',
    isSaving: false,
    serverUpdatedAt: null,
    hasUnpublishedChanges: false,
    past: [],
    future: [],
    maxHistory: 30,
    previewMode: 'mobile',
    refinementHistory: [],
    aiSystemPromptEn: '',
    aiSystemPromptEs: '',
    instructionsRefined: true,
    creationMode: null,
    aiGenerating: false,
    ...overrides,
  };
}

function makeField(
  overrides: Partial<FormFieldDefinition> & { key: string; type: FormFieldDefinition['type'] },
): FormFieldDefinition {
  return {
    label: overrides.key,
    order: 1,
    width: 'full',
    ...overrides,
  };
}

// =============================================================================
// validateForPublish
// =============================================================================

describe('validateForPublish', () => {
  it('returns valid=true for a well-formed state', () => {
    const result = validateForPublish(makeState());
    expect(result.valid).toBe(true);
    expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  // -- Check 1: Title EN required -------------------------------------------

  it('blocks publish when titleEn is empty', () => {
    const result = validateForPublish(makeState({ titleEn: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.severity === 'error' && e.message.includes('title'))).toBe(true);
  });

  it('blocks publish when titleEn is whitespace', () => {
    const result = validateForPublish(makeState({ titleEn: '   ' }));
    expect(result.valid).toBe(false);
  });

  // -- Check 2: Slug required and valid format --------------------------------

  it('blocks publish when slug is empty', () => {
    const result = validateForPublish(makeState({ slug: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.severity === 'error' && e.message.includes('Slug'))).toBe(true);
  });

  it('blocks publish when slug has invalid format', () => {
    const result = validateForPublish(makeState({ slug: 'UPPERCASE-slug' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('lowercase'))).toBe(true);
  });

  it('accepts valid slug', () => {
    const result = validateForPublish(makeState({ slug: 'my-form-123' }));
    const slugErrors = result.errors.filter(e => e.message.includes('Slug') || e.message.includes('slug'));
    expect(slugErrors.filter(e => e.severity === 'error')).toHaveLength(0);
  });

  // -- Check 3: At least 1 fillable field ------------------------------------

  it('blocks publish with no fields', () => {
    const result = validateForPublish(makeState({ fields: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('fillable field'))).toBe(true);
  });

  it('blocks publish with only header/instructions fields', () => {
    const result = validateForPublish(
      makeState({
        fields: [
          makeField({ key: 'h', type: 'header' }),
          makeField({ key: 'i', type: 'instructions' }),
        ],
      }),
    );
    expect(result.valid).toBe(false);
  });

  // -- Check 4: Select/radio/checkbox must have options ----------------------

  it('blocks publish when select field has no options', () => {
    const result = validateForPublish(
      makeState({
        fields: [makeField({ key: 'dept', type: 'select', label: 'Department' })],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('option'))).toBe(true);
  });

  it('allows select field with options', () => {
    const result = validateForPublish(
      makeState({
        fields: [
          makeField({ key: 'dept', type: 'select', label: 'Department', options: ['FOH', 'BOH'] }),
        ],
      }),
    );
    const optionErrors = result.errors.filter(e => e.severity === 'error' && e.message.includes('option'));
    expect(optionErrors).toHaveLength(0);
  });

  // -- Check 5: No duplicate field keys --------------------------------------

  it('blocks publish with duplicate keys', () => {
    const result = validateForPublish(
      makeState({
        fields: [
          makeField({ key: 'name', type: 'text', label: 'Name', order: 1 }),
          makeField({ key: 'name', type: 'text', label: 'Name 2', order: 2 }),
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
  });

  // -- Check 7: Max 50 fields -----------------------------------------------

  it('blocks publish with > 50 fields', () => {
    const fields = Array.from({ length: 51 }, (_, i) =>
      makeField({ key: `field_${i}`, type: 'text', label: `Field ${i}`, order: i + 1 }),
    );
    const result = validateForPublish(makeState({ fields }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('50'))).toBe(true);
  });

  // -- Check 8: Field key format ---------------------------------------------

  it('blocks publish with invalid key format', () => {
    const result = validateForPublish(
      makeState({
        fields: [makeField({ key: '123bad', type: 'text', label: 'Bad Key' })],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('lowercase letter'))).toBe(true);
  });

  it('allows valid key format', () => {
    const result = validateForPublish(
      makeState({
        fields: [makeField({ key: 'good_key_123', type: 'text', label: 'Good' })],
      }),
    );
    const keyErrors = result.errors.filter(e => e.severity === 'error' && e.message.includes('key'));
    expect(keyErrors).toHaveLength(0);
  });

  // -- Check 9: Self-referencing condition -----------------------------------

  it('blocks publish with self-referencing condition', () => {
    const result = validateForPublish(
      makeState({
        fields: [
          makeField({
            key: 'name',
            type: 'text',
            label: 'Name',
            condition: { field: 'name', operator: 'eq', value: 'test' },
          }),
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('referencing itself'))).toBe(true);
  });

  // -- Check 10: Condition references non-existent field --------------------

  it('blocks publish with condition referencing non-existent field', () => {
    const result = validateForPublish(
      makeState({
        fields: [
          makeField({
            key: 'name',
            type: 'text',
            label: 'Name',
            condition: { field: 'nonexistent', operator: 'eq', value: 'test' },
          }),
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('non-existent'))).toBe(true);
  });

  it('allows valid condition referencing existing field', () => {
    const result = validateForPublish(
      makeState({
        fields: [
          makeField({ key: 'type', type: 'select', label: 'Type', options: ['A', 'B'], order: 1 }),
          makeField({
            key: 'name',
            type: 'text',
            label: 'Name',
            order: 2,
            condition: { field: 'type', operator: 'eq', value: 'A' },
          }),
        ],
      }),
    );
    const conditionErrors = result.errors.filter(
      e => e.severity === 'error' && (e.message.includes('referencing') || e.message.includes('non-existent')),
    );
    expect(conditionErrors).toHaveLength(0);
  });

  // -- Check 11: Options count <= 50 ----------------------------------------

  it('blocks publish when field has > 50 options', () => {
    const options = Array.from({ length: 51 }, (_, i) => `Option ${i + 1}`);
    const result = validateForPublish(
      makeState({
        fields: [makeField({ key: 'big', type: 'select', label: 'Big', options })],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('50'))).toBe(true);
  });

  // -- Warnings (don't block publish) ----------------------------------------

  it('blocks publish when instructionsEn is missing', () => {
    const result = validateForPublish(makeState({ instructionsEn: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.severity === 'error' && e.message.includes('instructions'))).toBe(true);
  });

  it('blocks publish when instructions are not refined', () => {
    const result = validateForPublish(makeState({ instructionsRefined: false }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.severity === 'error' && e.message.includes('refined'))).toBe(true);
  });

  it('warns but does NOT block when instructionsEs is missing', () => {
    const result = validateForPublish(makeState({ instructionsEs: '' }));
    expect(result.valid).toBe(true);
    expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('Spanish'))).toBe(true);
  });

  it('warns but does NOT block when aiTools is empty', () => {
    const result = validateForPublish(makeState({ aiTools: [] }));
    expect(result.valid).toBe(true);
    expect(result.errors.some(e => e.severity === 'warning' && e.message.includes('AI tools'))).toBe(true);
  });
});

// =============================================================================
// getPublishBlockers
// =============================================================================

describe('getPublishBlockers', () => {
  it('returns empty array for valid state', () => {
    expect(getPublishBlockers(makeState())).toHaveLength(0);
  });

  it('returns only error messages (not warnings)', () => {
    const blockers = getPublishBlockers(makeState({ titleEn: '' }));
    expect(blockers.length).toBeGreaterThan(0);
    // Make sure the warning about instructions is NOT in blockers
    expect(blockers.every(b => !b.includes('warning'))).toBe(true);
  });
});

// =============================================================================
// isPublishable
// =============================================================================

describe('isPublishable', () => {
  it('returns true for valid state', () => {
    expect(isPublishable(makeState())).toBe(true);
  });

  it('returns false for invalid state', () => {
    expect(isPublishable(makeState({ titleEn: '' }))).toBe(false);
  });

  it('returns true even with warnings (e.g., no AI tools)', () => {
    expect(isPublishable(makeState({ aiTools: [] }))).toBe(true);
  });

  it('returns false when instructions are empty', () => {
    expect(isPublishable(makeState({ instructionsEn: '' }))).toBe(false);
  });

  it('returns false when instructions not refined', () => {
    expect(isPublishable(makeState({ instructionsRefined: false }))).toBe(false);
  });
});
