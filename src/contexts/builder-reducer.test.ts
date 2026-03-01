import { describe, it, expect } from 'vitest';
import { builderReducer, createInitialState } from './BuilderContext';
import type { BuilderState, BuilderAction } from '@/types/form-builder';
import type { FormFieldDefinition } from '@/types/forms';

// =============================================================================
// HELPERS
// =============================================================================

function makeState(overrides: Partial<BuilderState> = {}): BuilderState {
  return { ...createInitialState(), ...overrides };
}

function makeField(
  overrides: Partial<FormFieldDefinition> & { key: string; type: FormFieldDefinition['type'] },
): FormFieldDefinition {
  return { label: overrides.key, order: 1, width: 'full', ...overrides };
}

function act(state: BuilderState, action: BuilderAction): BuilderState {
  return builderReducer(state, action);
}

// =============================================================================
// HYDRATE & RESET
// =============================================================================

describe('HYDRATE', () => {
  it('merges payload onto initial state', () => {
    const result = act(createInitialState(), {
      type: 'HYDRATE',
      payload: { titleEn: 'My Form', slug: 'my-form' },
    });
    expect(result.titleEn).toBe('My Form');
    expect(result.slug).toBe('my-form');
    // defaults still present
    expect(result.icon).toBe('📋');
  });

  it('preserves UI state when flag set', () => {
    const state = makeState({
      selectedFieldKey: 'field_1',
      activeTab: 'ai',
      rightPanelMode: 'field-properties',
      previewMode: 'desktop' as BuilderState['previewMode'],
    });
    const result = act(state, {
      type: 'HYDRATE',
      payload: { titleEn: 'New' },
      preserveUIState: true,
    });
    expect(result.titleEn).toBe('New');
    expect(result.selectedFieldKey).toBe('field_1');
    expect(result.activeTab).toBe('ai');
    expect(result.rightPanelMode).toBe('field-properties');
  });

  it('does NOT preserve UI state when flag absent', () => {
    const state = makeState({ selectedFieldKey: 'field_1', activeTab: 'ai' });
    const result = act(state, {
      type: 'HYDRATE',
      payload: { titleEn: 'New' },
    });
    expect(result.selectedFieldKey).toBeNull();
    expect(result.activeTab).toBe('fields');
  });
});

describe('RESET', () => {
  it('returns clean initial state', () => {
    const dirty = makeState({ titleEn: 'Dirty', isDirty: true, slug: 'dirty' });
    const result = act(dirty, { type: 'RESET' });
    expect(result.titleEn).toBe('');
    expect(result.isDirty).toBe(false);
    expect(result.slug).toBe('');
  });
});

// =============================================================================
// METADATA ACTIONS
// =============================================================================

describe('Metadata actions', () => {
  it('SET_TITLE_EN sets title and marks dirty', () => {
    const result = act(createInitialState(), { type: 'SET_TITLE_EN', payload: 'Hello' });
    expect(result.titleEn).toBe('Hello');
    expect(result.isDirty).toBe(true);
    expect(result.saveStatus).toBe('unsaved');
  });

  it('SET_TITLE_ES sets Spanish title', () => {
    const result = act(createInitialState(), { type: 'SET_TITLE_ES', payload: 'Hola' });
    expect(result.titleEs).toBe('Hola');
    expect(result.isDirty).toBe(true);
  });

  it('SET_DESCRIPTION_EN', () => {
    const result = act(createInitialState(), { type: 'SET_DESCRIPTION_EN', payload: 'Desc' });
    expect(result.descriptionEn).toBe('Desc');
    expect(result.isDirty).toBe(true);
  });

  it('SET_DESCRIPTION_ES', () => {
    const result = act(createInitialState(), { type: 'SET_DESCRIPTION_ES', payload: 'Desc ES' });
    expect(result.descriptionEs).toBe('Desc ES');
    expect(result.isDirty).toBe(true);
  });

  it('SET_SLUG', () => {
    const result = act(createInitialState(), { type: 'SET_SLUG', payload: 'my-form' });
    expect(result.slug).toBe('my-form');
    expect(result.isDirty).toBe(true);
  });

  it('SET_ICON', () => {
    const result = act(createInitialState(), { type: 'SET_ICON', payload: 'Star' });
    expect(result.icon).toBe('Star');
    expect(result.isDirty).toBe(true);
  });

  it('SET_STATUS does NOT mark dirty', () => {
    const result = act(createInitialState(), { type: 'SET_STATUS', payload: 'published' });
    expect(result.status).toBe('published');
    expect(result.isDirty).toBe(false);
  });
});

// =============================================================================
// UI NAVIGATION ACTIONS
// =============================================================================

describe('UI Navigation', () => {
  it('SET_ACTIVE_TAB', () => {
    const result = act(createInitialState(), { type: 'SET_ACTIVE_TAB', payload: 'ai' });
    expect(result.activeTab).toBe('ai');
  });

  it('SET_RIGHT_PANEL_MODE', () => {
    const result = act(createInitialState(), {
      type: 'SET_RIGHT_PANEL_MODE',
      payload: 'field-properties',
    });
    expect(result.rightPanelMode).toBe('field-properties');
  });

  it('SET_SELECTED_FIELD selects without changing panel mode', () => {
    const result = act(createInitialState(), { type: 'SET_SELECTED_FIELD', payload: 'name' });
    expect(result.selectedFieldKey).toBe('name');
    expect(result.rightPanelMode).toBe('preview'); // unchanged — gear icon sets mode separately
  });

  it('SET_SELECTED_FIELD null clears selection', () => {
    const state = makeState({ selectedFieldKey: 'name', rightPanelMode: 'field-properties' });
    const result = act(state, { type: 'SET_SELECTED_FIELD', payload: null });
    expect(result.selectedFieldKey).toBeNull();
    expect(result.rightPanelMode).toBe('field-properties'); // unchanged — panel mode is independent
  });

  it('SET_PREVIEW_MODE', () => {
    const result = act(createInitialState(), { type: 'SET_PREVIEW_MODE', payload: 'desktop' });
    expect(result.previewMode).toBe('desktop');
  });

  it('SET_CREATION_MODE', () => {
    const result = act(createInitialState(), { type: 'SET_CREATION_MODE', payload: 'ai' });
    expect(result.creationMode).toBe('ai');
  });
});

// =============================================================================
// FIELD OPERATIONS (undoable)
// =============================================================================

describe('ADD_FIELD', () => {
  it('adds field without auto-selecting it', () => {
    const field = makeField({ key: 'name', type: 'text', label: 'Name' });
    const result = act(createInitialState(), {
      type: 'ADD_FIELD',
      payload: { field },
    });
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].key).toBe('name');
    expect(result.selectedFieldKey).toBeNull();
    expect(result.isDirty).toBe(true);
  });

  it('pushes undo snapshot', () => {
    const state = makeState({
      fields: [makeField({ key: 'existing', type: 'text' })],
    });
    const result = act(state, {
      type: 'ADD_FIELD',
      payload: { field: makeField({ key: 'new', type: 'text' }) },
    });
    expect(result.past).toHaveLength(1);
    expect(result.future).toHaveLength(0);
  });
});

describe('UPDATE_FIELD', () => {
  it('updates matching field by key', () => {
    const state = makeState({
      fields: [makeField({ key: 'name', type: 'text', label: 'Name' })],
    });
    const result = act(state, {
      type: 'UPDATE_FIELD',
      payload: { key: 'name', updates: { label: 'Full Name', required: true } },
    });
    expect(result.fields[0].label).toBe('Full Name');
    expect(result.fields[0].required).toBe(true);
    expect(result.fields[0].type).toBe('text'); // unchanged
    expect(result.isDirty).toBe(true);
  });

  it('does not modify other fields', () => {
    const state = makeState({
      fields: [
        makeField({ key: 'a', type: 'text', label: 'A' }),
        makeField({ key: 'b', type: 'text', label: 'B' }),
      ],
    });
    const result = act(state, {
      type: 'UPDATE_FIELD',
      payload: { key: 'a', updates: { label: 'A2' } },
    });
    expect(result.fields[1].label).toBe('B');
  });
});

describe('REMOVE_FIELD', () => {
  it('removes field by key', () => {
    const state = makeState({
      fields: [
        makeField({ key: 'a', type: 'text' }),
        makeField({ key: 'b', type: 'text' }),
      ],
    });
    const result = act(state, { type: 'REMOVE_FIELD', payload: { key: 'a' } });
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].key).toBe('b');
  });

  it('deselects if removed field was selected', () => {
    const state = makeState({
      fields: [makeField({ key: 'a', type: 'text' })],
      selectedFieldKey: 'a',
      rightPanelMode: 'field-properties',
    });
    const result = act(state, { type: 'REMOVE_FIELD', payload: { key: 'a' } });
    expect(result.selectedFieldKey).toBeNull();
    // rightPanelMode stays as-is — the page component handles visibility
    expect(result.rightPanelMode).toBe('field-properties');
  });

  it('keeps selection if different field removed', () => {
    const state = makeState({
      fields: [
        makeField({ key: 'a', type: 'text' }),
        makeField({ key: 'b', type: 'text' }),
      ],
      selectedFieldKey: 'b',
      rightPanelMode: 'field-properties',
    });
    const result = act(state, { type: 'REMOVE_FIELD', payload: { key: 'a' } });
    expect(result.selectedFieldKey).toBe('b');
    expect(result.rightPanelMode).toBe('field-properties');
  });
});

describe('REORDER_FIELDS', () => {
  it('replaces fields array and reassigns order', () => {
    const fields = [
      makeField({ key: 'a', type: 'text', order: 1 }),
      makeField({ key: 'b', type: 'text', order: 2 }),
      makeField({ key: 'c', type: 'text', order: 3 }),
    ];
    const reordered = [fields[2], fields[0], fields[1]];
    const result = act(makeState({ fields }), {
      type: 'REORDER_FIELDS',
      payload: reordered,
    });
    expect(result.fields.map(f => f.key)).toEqual(['c', 'a', 'b']);
    expect(result.fields.map(f => f.order)).toEqual([1, 2, 3]);
    expect(result.isDirty).toBe(true);
  });
});

// =============================================================================
// INSTRUCTIONS (undoable)
// =============================================================================

describe('Instructions', () => {
  it('SET_INSTRUCTIONS_EN pushes undo', () => {
    const state = makeState({ instructionsEn: 'old' });
    const result = act(state, { type: 'SET_INSTRUCTIONS_EN', payload: 'new' });
    expect(result.instructionsEn).toBe('new');
    expect(result.past).toHaveLength(1);
    expect(result.isDirty).toBe(true);
  });

  it('SET_INSTRUCTIONS_ES pushes undo', () => {
    const state = makeState({ instructionsEs: 'viejo' });
    const result = act(state, { type: 'SET_INSTRUCTIONS_ES', payload: 'nuevo' });
    expect(result.instructionsEs).toBe('nuevo');
    expect(result.past).toHaveLength(1);
  });

  it('SET_INSTRUCTION_LANGUAGE does NOT push undo or mark dirty', () => {
    const result = act(createInitialState(), { type: 'SET_INSTRUCTION_LANGUAGE', payload: 'es' });
    expect(result.instructionLanguage).toBe('es');
    expect(result.past).toHaveLength(0);
    expect(result.isDirty).toBe(false);
  });
});

// =============================================================================
// AI TOOLS
// =============================================================================

describe('AI Tools', () => {
  it('SET_AI_TOOLS replaces array', () => {
    const result = act(createInitialState(), {
      type: 'SET_AI_TOOLS',
      payload: ['search_manual', 'search_contacts'],
    });
    expect(result.aiTools).toEqual(['search_manual', 'search_contacts']);
    expect(result.isDirty).toBe(true);
  });

  it('TOGGLE_TOOL adds tool if not present', () => {
    const state = makeState({ aiTools: ['search_manual'] });
    const result = act(state, { type: 'TOGGLE_TOOL', payload: 'search_contacts' });
    expect(result.aiTools).toContain('search_contacts');
    expect(result.aiTools).toContain('search_manual');
  });

  it('TOGGLE_TOOL removes tool if present', () => {
    const state = makeState({ aiTools: ['search_manual', 'search_contacts'] });
    const result = act(state, { type: 'TOGGLE_TOOL', payload: 'search_manual' });
    expect(result.aiTools).not.toContain('search_manual');
    expect(result.aiTools).toContain('search_contacts');
  });
});

// =============================================================================
// SAVE LIFECYCLE
// =============================================================================

describe('Save Lifecycle', () => {
  it('SAVE_START sets isSaving and saving status', () => {
    const result = act(createInitialState(), { type: 'SAVE_START' });
    expect(result.isSaving).toBe(true);
    expect(result.saveStatus).toBe('saving');
  });

  it('SAVE_SUCCESS clears dirty, sets saved, records updatedAt', () => {
    const state = makeState({ isSaving: true, isDirty: true, saveStatus: 'saving' });
    const result = act(state, {
      type: 'SAVE_SUCCESS',
      payload: { updatedAt: '2026-02-25T12:00:00Z' },
    });
    expect(result.isSaving).toBe(false);
    expect(result.isDirty).toBe(false);
    expect(result.saveStatus).toBe('saved');
    expect(result.serverUpdatedAt).toBe('2026-02-25T12:00:00Z');
  });

  it('SAVE_SUCCESS sets hasUnpublishedChanges when published', () => {
    const state = makeState({ isSaving: true, status: 'published', hasUnpublishedChanges: false });
    const result = act(state, {
      type: 'SAVE_SUCCESS',
      payload: { updatedAt: '2026-02-25T12:00:00Z' },
    });
    expect(result.hasUnpublishedChanges).toBe(true);
  });

  it('SAVE_ERROR resets saving state', () => {
    const state = makeState({ isSaving: true, saveStatus: 'saving' });
    const result = act(state, {
      type: 'SAVE_ERROR',
      payload: { error: 'Network error' },
    });
    expect(result.isSaving).toBe(false);
    expect(result.saveStatus).toBe('error');
  });

});

// =============================================================================
// PUBLISH
// =============================================================================

describe('PUBLISH_CHANGES', () => {
  it('sets published status and clears unpublished flag', () => {
    const state = makeState({ status: 'draft', hasUnpublishedChanges: true });
    const result = act(state, {
      type: 'PUBLISH_CHANGES',
      payload: { templateVersion: 2, publishedAt: '2026-02-25T12:00:00Z' },
    });
    expect(result.status).toBe('published');
    expect(result.templateVersion).toBe(2);
    expect(result.publishedAt).toBe('2026-02-25T12:00:00Z');
    expect(result.hasUnpublishedChanges).toBe(false);
  });
});

// =============================================================================
// AI GENERATE
// =============================================================================

describe('AI Generate', () => {
  it('AI_GENERATE_START sets flag', () => {
    const result = act(createInitialState(), { type: 'AI_GENERATE_START' });
    expect(result.aiGenerating).toBe(true);
  });

  it('AI_GENERATE_SUCCESS merges payload and pushes undo', () => {
    const field = makeField({ key: 'name', type: 'text', label: 'Name' });
    const state = makeState({ aiGenerating: true });
    const result = act(state, {
      type: 'AI_GENERATE_SUCCESS',
      payload: { fields: [field], instructionsEn: 'AI instructions' },
    });
    expect(result.aiGenerating).toBe(false);
    expect(result.fields).toHaveLength(1);
    expect(result.instructionsEn).toBe('AI instructions');
    expect(result.isDirty).toBe(true);
    expect(result.past).toHaveLength(1);
  });

  it('AI_GENERATE_ERROR clears flag', () => {
    const state = makeState({ aiGenerating: true });
    const result = act(state, { type: 'AI_GENERATE_ERROR' });
    expect(result.aiGenerating).toBe(false);
  });
});

// =============================================================================
// AI REFINEMENT
// =============================================================================

describe('AI Refinement', () => {
  it('ADD_REFINEMENT_MESSAGE appends to history', () => {
    const msg = { role: 'user' as const, content: 'Make it shorter' };
    const result = act(createInitialState(), { type: 'ADD_REFINEMENT_MESSAGE', payload: msg });
    expect(result.refinementHistory).toHaveLength(1);
    expect(result.refinementHistory[0].content).toBe('Make it shorter');
  });

  it('CLEAR_REFINEMENT_HISTORY empties array', () => {
    const state = makeState({
      refinementHistory: [{ role: 'user' as const, content: 'test' }],
    });
    const result = act(state, { type: 'CLEAR_REFINEMENT_HISTORY' });
    expect(result.refinementHistory).toHaveLength(0);
  });

  it('ACCEPT_REFINED_INSTRUCTIONS updates EN and pushes undo', () => {
    const state = makeState({ instructionsEn: 'old' });
    const result = act(state, {
      type: 'ACCEPT_REFINED_INSTRUCTIONS',
      payload: { language: 'en', instructions: 'refined' },
    });
    expect(result.instructionsEn).toBe('refined');
    expect(result.instructionsEs).toBe(''); // unchanged
    expect(result.past).toHaveLength(1);
    expect(result.isDirty).toBe(true);
  });

  it('ACCEPT_REFINED_INSTRUCTIONS updates ES', () => {
    const state = makeState({ instructionsEs: 'viejo' });
    const result = act(state, {
      type: 'ACCEPT_REFINED_INSTRUCTIONS',
      payload: { language: 'es', instructions: 'refinado' },
    });
    expect(result.instructionsEs).toBe('refinado');
    expect(result.instructionsEn).toBe(''); // unchanged
  });
});

// =============================================================================
// UNDO / REDO
// =============================================================================

describe('Undo/Redo', () => {
  it('UNDO restores previous snapshot', () => {
    const state = makeState({ fields: [] });
    // Add a field (pushes undo)
    const afterAdd = act(state, {
      type: 'ADD_FIELD',
      payload: { field: makeField({ key: 'name', type: 'text' }) },
    });
    expect(afterAdd.fields).toHaveLength(1);
    expect(afterAdd.past).toHaveLength(1);

    // Undo it
    const afterUndo = act(afterAdd, { type: 'UNDO' });
    expect(afterUndo.fields).toHaveLength(0);
    expect(afterUndo.past).toHaveLength(0);
    expect(afterUndo.future).toHaveLength(1);
  });

  it('REDO restores next snapshot', () => {
    const state = makeState({ fields: [] });
    const afterAdd = act(state, {
      type: 'ADD_FIELD',
      payload: { field: makeField({ key: 'name', type: 'text' }) },
    });
    const afterUndo = act(afterAdd, { type: 'UNDO' });
    const afterRedo = act(afterUndo, { type: 'REDO' });

    expect(afterRedo.fields).toHaveLength(1);
    expect(afterRedo.fields[0].key).toBe('name');
    expect(afterRedo.past).toHaveLength(1);
    expect(afterRedo.future).toHaveLength(0);
  });

  it('UNDO with empty past returns same state', () => {
    const state = makeState({ past: [] });
    const result = act(state, { type: 'UNDO' });
    expect(result).toBe(state);
  });

  it('REDO with empty future returns same state', () => {
    const state = makeState({ future: [] });
    const result = act(state, { type: 'REDO' });
    expect(result).toBe(state);
  });

  it('undo restores instructions alongside fields', () => {
    const state = makeState({ instructionsEn: 'old' });
    const afterChange = act(state, { type: 'SET_INSTRUCTIONS_EN', payload: 'new' });
    const afterUndo = act(afterChange, { type: 'UNDO' });
    expect(afterUndo.instructionsEn).toBe('old');
  });

  it('undo stack respects maxHistory', () => {
    let state = makeState({ maxHistory: 3 });
    // Push 5 undoable actions
    for (let i = 0; i < 5; i++) {
      state = act(state, {
        type: 'ADD_FIELD',
        payload: { field: makeField({ key: `f${i}`, type: 'text' }) },
      });
    }
    // Stack capped at 3
    expect(state.past.length).toBeLessThanOrEqual(3);
  });

  it('undoable action clears future (no branching)', () => {
    const state = makeState({ fields: [] });
    const s1 = act(state, {
      type: 'ADD_FIELD',
      payload: { field: makeField({ key: 'a', type: 'text' }) },
    });
    const s2 = act(s1, {
      type: 'ADD_FIELD',
      payload: { field: makeField({ key: 'b', type: 'text' }) },
    });
    const afterUndo = act(s2, { type: 'UNDO' });
    expect(afterUndo.future).toHaveLength(1);

    // New action clears future
    const afterNewAction = act(afterUndo, {
      type: 'ADD_FIELD',
      payload: { field: makeField({ key: 'c', type: 'text' }) },
    });
    expect(afterNewAction.future).toHaveLength(0);
  });
});

// =============================================================================
// DEFAULT (unknown action)
// =============================================================================

describe('default case', () => {
  it('returns state unchanged for unknown action', () => {
    const state = createInitialState();
    // @ts-expect-error testing unknown action type
    const result = act(state, { type: 'UNKNOWN_ACTION' });
    expect(result).toBe(state);
  });
});
