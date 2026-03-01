// =============================================================================
// BuilderContext — Form Builder Admin state management
// Pattern: useReducer + Context (matches IngestDraftContext)
// =============================================================================

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FormFieldDefinition, FormFieldType } from '@/types/forms';
import type {
  BuilderState,
  BuilderAction,
  BuilderSnapshot,
  BuilderContextValue,
  BuilderChatMessage,
  FormBuilderChatUpdates,
} from '@/types/form-builder';
import { getDefaultField, generateSlug } from '@/lib/form-builder/builder-utils';
import { sanitizeFields } from '@/lib/form-builder/template-mapper';

// =============================================================================
// INITIAL STATE
// =============================================================================

export function createInitialState(): BuilderState {
  return {
    templateId: null,
    slug: '',
    titleEn: '',
    titleEs: '',
    descriptionEn: '',
    descriptionEs: '',
    icon: '📋',
    iconColor: 'blue',
    status: 'draft',
    templateVersion: 1,
    publishedAt: null,

    fields: [],
    selectedFieldKey: null,

    activeTab: 'fields',
    rightPanelMode: 'preview',

    instructionsEn: '',
    instructionsEs: '',
    instructionLanguage: 'en',

    aiTools: [],

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
    instructionsRefined: false,
    creationMode: null,
    aiGenerating: false,

    builderChatMessages: [],
    builderChatLoading: false,
  };
}

const initialState = createInitialState();

// =============================================================================
// UNDO HELPERS
// =============================================================================

function takeSnapshot(state: BuilderState): BuilderSnapshot {
  return {
    fields: state.fields.map(f => ({ ...f })),
    instructionsEn: state.instructionsEn,
    instructionsEs: state.instructionsEs,
    aiSystemPromptEn: state.aiSystemPromptEn,
    aiSystemPromptEs: state.aiSystemPromptEs,
    titleEn: state.titleEn,
    titleEs: state.titleEs,
    descriptionEn: state.descriptionEn,
    descriptionEs: state.descriptionEs,
    icon: state.icon,
    iconColor: state.iconColor,
    slug: state.slug,
    aiTools: [...state.aiTools],
  };
}

function pushUndo(state: BuilderState): BuilderState {
  const snapshot = takeSnapshot(state);
  const past = [...state.past, snapshot].slice(-state.maxHistory);
  return { ...state, past, future: [] };
}

// =============================================================================
// REDUCER
// =============================================================================

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    // --- Hydrate ---
    case 'HYDRATE': {
      const base = { ...initialState, ...action.payload };
      if (action.preserveUIState) {
        return {
          ...base,
          selectedFieldKey: state.selectedFieldKey,
          activeTab: state.activeTab,
          rightPanelMode: state.rightPanelMode,
          previewMode: state.previewMode,
          builderChatMessages: state.builderChatMessages,
          builderChatLoading: state.builderChatLoading,
        };
      }
      return base;
    }
    case 'RESET':
      return createInitialState();

    // --- Metadata ---
    case 'SET_TITLE_EN':
      return { ...state, titleEn: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_TITLE_ES':
      return { ...state, titleEs: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_DESCRIPTION_EN':
      return { ...state, descriptionEn: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_DESCRIPTION_ES':
      return { ...state, descriptionEs: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_SLUG':
      return { ...state, slug: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_ICON':
      return { ...state, icon: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_ICON_COLOR': {
      const s = pushUndo(state);
      return { ...s, iconColor: action.payload, isDirty: true, saveStatus: 'unsaved' };
    }
    case 'SET_STATUS':
      return { ...state, status: action.payload };

    // --- UI Navigation ---
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_RIGHT_PANEL_MODE':
      return { ...state, rightPanelMode: action.payload };
    case 'SET_SELECTED_FIELD':
      return {
        ...state,
        selectedFieldKey: action.payload,
      };
    case 'SET_PREVIEW_MODE':
      return { ...state, previewMode: action.payload };
    case 'SET_CREATION_MODE':
      return { ...state, creationMode: action.payload };

    // --- Field Operations (undoable) ---
    case 'ADD_FIELD': {
      const s = pushUndo(state);
      return {
        ...s,
        fields: [...s.fields, action.payload.field],
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'ADD_FIELD_AT_INDEX': {
      const s = pushUndo(state);
      const newFields = [...s.fields];
      const insertIdx = Math.max(0, Math.min(action.payload.index, newFields.length));
      newFields.splice(insertIdx, 0, action.payload.field);
      // Resequence order values
      const resequenced = newFields.map((f, i) => ({ ...f, order: i + 1 }));
      return {
        ...s,
        fields: resequenced,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'UPDATE_FIELD': {
      const s = pushUndo(state);
      return {
        ...s,
        fields: s.fields.map(f =>
          f.key === action.payload.key ? { ...f, ...action.payload.updates } : f,
        ),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'REMOVE_FIELD': {
      const s = pushUndo(state);
      return {
        ...s,
        fields: s.fields.filter(f => f.key !== action.payload.key),
        selectedFieldKey: s.selectedFieldKey === action.payload.key ? null : s.selectedFieldKey,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'REORDER_FIELDS': {
      const s = pushUndo(state);
      return {
        ...s,
        fields: action.payload.map((f, i) => ({ ...f, order: i + 1 })),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }

    // --- Instructions (undoable) ---
    case 'SET_INSTRUCTIONS_EN': {
      const s = pushUndo(state);
      return { ...s, instructionsEn: action.payload, instructionsRefined: false, isDirty: true, saveStatus: 'unsaved' };
    }
    case 'SET_INSTRUCTIONS_ES': {
      const s = pushUndo(state);
      return { ...s, instructionsEs: action.payload, isDirty: true, saveStatus: 'unsaved' };
    }
    case 'SET_INSTRUCTION_LANGUAGE':
      return { ...state, instructionLanguage: action.payload };

    // --- AI Tools ---
    case 'SET_AI_TOOLS':
      return { ...state, aiTools: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'TOGGLE_TOOL': {
      const toolId = action.payload;
      const aiTools = state.aiTools.includes(toolId)
        ? state.aiTools.filter(t => t !== toolId)
        : [...state.aiTools, toolId];
      return { ...state, aiTools, isDirty: true, saveStatus: 'unsaved' };
    }

    // --- Save Lifecycle ---
    case 'SAVE_START':
      return { ...state, isSaving: true, saveStatus: 'saving' };
    case 'SAVE_SUCCESS': {
      const unpublished = state.status === 'published' ? true : state.hasUnpublishedChanges;
      return {
        ...state,
        isSaving: false,
        isDirty: false,
        saveStatus: 'saved',
        serverUpdatedAt: action.payload.updatedAt,
        hasUnpublishedChanges: unpublished,
      };
    }
    case 'SAVE_ERROR':
      return { ...state, isSaving: false, saveStatus: 'error' };

    // --- Publish ---
    case 'PUBLISH_CHANGES':
      return {
        ...state,
        status: 'published',
        templateVersion: action.payload.templateVersion,
        publishedAt: action.payload.publishedAt,
        hasUnpublishedChanges: false,
      };

    // --- AI Generate ---
    case 'AI_GENERATE_START':
      return { ...state, aiGenerating: true };
    case 'AI_GENERATE_SUCCESS': {
      const s = pushUndo(state);
      return {
        ...s,
        ...action.payload,
        aiGenerating: false,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'AI_GENERATE_ERROR':
      return { ...state, aiGenerating: false };

    // --- AI Builder Chat ---
    case 'BUILDER_CHAT_ADD_MESSAGE':
      return {
        ...state,
        builderChatMessages: [...state.builderChatMessages, action.payload],
      };

    case 'BUILDER_CHAT_SET_LOADING':
      return { ...state, builderChatLoading: action.payload };

    case 'BUILDER_CHAT_CLEAR':
      return { ...state, builderChatMessages: [] };

    case 'APPLY_CHAT_FORM_UPDATES': {
      const s = pushUndo(state);
      const p = action.payload;

      // 1. Metadata updates (only if non-null/undefined)
      const meta: Partial<BuilderState> = {};
      if (p.titleEn != null) meta.titleEn = p.titleEn;
      if (p.titleEs != null) meta.titleEs = p.titleEs;
      if (p.descriptionEn != null) meta.descriptionEn = p.descriptionEn;
      if (p.descriptionEs != null) meta.descriptionEs = p.descriptionEs;
      if (p.icon != null) meta.icon = p.icon;
      if (p.iconColor != null) meta.iconColor = p.iconColor;
      if (p.instructionsEn != null) meta.instructionsEn = p.instructionsEn;
      if (p.instructionsEs != null) meta.instructionsEs = p.instructionsEs;
      if (p.aiTools != null) meta.aiTools = p.aiTools;

      // 2. Slug auto-update (same pattern as ACCEPT_REFINEMENT_RESULT)
      if (p.titleEn) {
        const isSlugLocked = s.status === 'published' || !!s.publishedAt;
        const slugWasAuto = !s.slug || s.slug === generateSlug(s.titleEn);
        if (!isSlugLocked && slugWasAuto) {
          meta.slug = generateSlug(p.titleEn);
        }
      }

      // 3. Field operations: remove -> add -> modify -> reorder
      let fields = [...s.fields];

      // Remove
      if (p.fieldsToRemove?.length) {
        const removeSet = new Set(p.fieldsToRemove);
        fields = fields.filter(f => !removeSet.has(f.key));
      }

      // Add (with dedup against existing keys)
      if (p.fieldsToAdd?.length) {
        const existingKeys = new Set(fields.map(f => f.key));
        const sanitized = sanitizeFields(p.fieldsToAdd, existingKeys);
        const startOrder = fields.length + 1;
        sanitized.forEach((f, i) => { f.order = startOrder + i; });
        fields = [...fields, ...sanitized];
      }

      // Modify (skip keys that were just removed)
      if (p.fieldsToModify?.length) {
        const removeSet = new Set(p.fieldsToRemove || []);
        fields = fields.map(f => {
          const mod = p.fieldsToModify!.find(m => m.key === f.key && !removeSet.has(m.key));
          return mod ? { ...f, ...mod.updates } : f;
        });
      }

      // Reorder (only if valid permutation of current keys)
      if (p.reorderedFieldKeys?.length) {
        const currentKeys = new Set(fields.map(f => f.key));
        const reorderKeys = new Set(p.reorderedFieldKeys);
        const isValid = currentKeys.size === reorderKeys.size &&
          [...currentKeys].every(k => reorderKeys.has(k));
        if (isValid) {
          const keyToField = new Map(fields.map(f => [f.key, f]));
          fields = p.reorderedFieldKeys
            .filter(k => keyToField.has(k))
            .map((k, i) => ({ ...keyToField.get(k)!, order: i + 1 }));
        }
      }

      return {
        ...s,
        ...meta,
        fields,
        isDirty: true,
        saveStatus: 'unsaved' as const,
        instructionsRefined: p.instructionsEn != null ? true : s.instructionsRefined,
      };
    }

    // --- AI Refinement ---
    case 'ADD_REFINEMENT_MESSAGE':
      return {
        ...state,
        refinementHistory: [...state.refinementHistory, action.payload],
      };
    case 'CLEAR_REFINEMENT_HISTORY':
      return { ...state, refinementHistory: [] };
    case 'ACCEPT_REFINED_INSTRUCTIONS': {
      const s = pushUndo(state);
      const key = action.payload.language === 'en' ? 'instructionsEn' : 'instructionsEs';
      return {
        ...s,
        [key]: action.payload.instructions,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'ACCEPT_REFINEMENT_RESULT': {
      const s = pushUndo(state);
      // Auto-slug: only update if slug was tracking the old title (same logic as setTitleEn helper)
      const isSlugLocked = s.status === 'published' || !!s.publishedAt;
      const slugWasAutoGenerated = !s.slug || s.slug === generateSlug(s.titleEn);
      const shouldUpdateSlug = action.payload.titleEn && !isSlugLocked && slugWasAutoGenerated;
      // Apply field label corrections (only for keys that exist)
      const correctedFields = action.payload.fieldCorrections?.length
        ? s.fields.map(f => {
            const fix = action.payload.fieldCorrections!.find(c => c.key === f.key);
            return fix ? { ...f, label: fix.label, label_es: fix.label_es || f.label_es } : f;
          })
        : undefined;
      return {
        ...s,
        // Instructions
        instructionsEn: action.payload.instructionsEn,
        instructionsEs: action.payload.instructionsEs,
        aiTools: action.payload.aiTools,
        aiSystemPromptEn: action.payload.aiSystemPromptEn,
        // Settings fields (optional — only apply if AI provided them)
        ...(action.payload.titleEn != null ? { titleEn: action.payload.titleEn } : {}),
        ...(action.payload.titleEs != null ? { titleEs: action.payload.titleEs } : {}),
        ...(action.payload.descriptionEn != null ? { descriptionEn: action.payload.descriptionEn } : {}),
        ...(action.payload.descriptionEs != null ? { descriptionEs: action.payload.descriptionEs } : {}),
        ...(action.payload.icon != null ? { icon: action.payload.icon } : {}),
        ...(action.payload.iconColor != null ? { iconColor: action.payload.iconColor } : {}),
        // Field label corrections
        ...(correctedFields ? { fields: correctedFields } : {}),
        // Auto-slug from new title (only if slug was auto-derived from old title)
        ...(shouldUpdateSlug ? { slug: generateSlug(action.payload.titleEn!) } : {}),
        instructionsRefined: true,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }

    // --- AI System Prompt ---
    case 'SET_AI_SYSTEM_PROMPT_EN':
      return { ...state, aiSystemPromptEn: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_AI_SYSTEM_PROMPT_ES':
      return { ...state, aiSystemPromptEs: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_INSTRUCTIONS_REFINED':
      return { ...state, instructionsRefined: action.payload };

    // --- Undo/Redo ---
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const currentSnapshot = takeSnapshot(state);
      return {
        ...state,
        fields: previous.fields,
        instructionsEn: previous.instructionsEn,
        instructionsEs: previous.instructionsEs,
        aiSystemPromptEn: previous.aiSystemPromptEn,
        aiSystemPromptEs: previous.aiSystemPromptEs,
        titleEn: previous.titleEn,
        titleEs: previous.titleEs,
        descriptionEn: previous.descriptionEn,
        descriptionEs: previous.descriptionEs,
        icon: previous.icon,
        iconColor: previous.iconColor,
        slug: previous.slug,
        aiTools: previous.aiTools,
        past: state.past.slice(0, -1),
        future: [currentSnapshot, ...state.future],
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const currentSnapshot = takeSnapshot(state);
      return {
        ...state,
        fields: next.fields,
        instructionsEn: next.instructionsEn,
        instructionsEs: next.instructionsEs,
        aiSystemPromptEn: next.aiSystemPromptEn,
        aiSystemPromptEs: next.aiSystemPromptEs,
        titleEn: next.titleEn,
        titleEs: next.titleEs,
        descriptionEn: next.descriptionEn,
        descriptionEs: next.descriptionEs,
        icon: next.icon,
        iconColor: next.iconColor,
        slug: next.slug,
        aiTools: next.aiTools,
        past: [...state.past, currentSnapshot],
        future: state.future.slice(1),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }

    default:
      return state;
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(builderReducer, initialState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref to serverUpdatedAt so saveDraftInternal always reads the latest value
  // (avoids stale closure when auto-save timer or Ctrl+S captures an old render scope)
  const serverUpdatedAtRef = useRef(state.serverUpdatedAt);
  useEffect(() => { serverUpdatedAtRef.current = state.serverUpdatedAt; }, [state.serverUpdatedAt]);

  // Ref-based guard against concurrent saves (immune to stale closures, unlike state.isSaving)
  const savingRef = useRef(false);

  // Auto-save: 3s debounce when dirty
  useEffect(() => {
    if (state.isDirty && !state.isSaving && state.templateId && state.saveStatus !== 'error') {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveDraftInternal();
      }, 3000);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isDirty, state.isSaving, state.templateId, state.fields, state.instructionsEn, state.instructionsEs, state.aiSystemPromptEn]);

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+S (save)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void saveDraftInternal();
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'SET_SELECTED_FIELD', payload: null });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.templateId, state.isSaving]);

  // Internal save function (used by both auto-save and manual save)
  // Uses optimistic concurrency with retry: first attempt uses updated_at guard,
  // on timestamp mismatch (false-positive conflict) retries once without the guard.
  async function saveDraftInternal() {
    // Use ref-based guard (immune to stale closures from auto-save timer / Ctrl+S)
    if (!state.templateId || savingRef.current) return;
    savingRef.current = true;
    dispatch({ type: 'SAVE_START' });

    try {
      const updatePayload = {
        title_en: state.titleEn,
        title_es: state.titleEs || null,
        description_en: state.descriptionEn || null,
        description_es: state.descriptionEs || null,
        slug: state.slug,
        icon: state.icon,
        icon_color: state.iconColor,
        fields: state.fields as unknown as Record<string, unknown>[],
        instructions_en: state.instructionsEn || null,
        instructions_es: state.instructionsEs || null,
        ai_tools: state.aiTools,
        ai_system_prompt_en: state.aiSystemPromptEn || null,
        ai_system_prompt_es: state.aiSystemPromptEs || null,
        instructions_refined: state.instructionsRefined,
        builder_state: {
          selectedFieldKey: state.selectedFieldKey,
          activeTab: state.activeTab,
          previewMode: state.previewMode,
        },
      };

      // First attempt: with optimistic concurrency guard
      let query = supabase
        .from('form_templates')
        .update(updatePayload)
        .eq('id', state.templateId);

      const currentServerUpdatedAt = serverUpdatedAtRef.current;
      if (currentServerUpdatedAt) {
        query = query.eq('updated_at', currentServerUpdatedAt);
      }

      const { data, error } = await query
        .select('updated_at')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Success on first try
        serverUpdatedAtRef.current = data.updated_at;
        dispatch({ type: 'SAVE_SUCCESS', payload: { updatedAt: data.updated_at } });
        return;
      }

      // Conflict: timestamp mismatch — retry once without concurrency guard.
      // This is a single-user form builder so a false-positive from timestamp
      // precision / formatting differences is far more likely than a real conflict.
      console.info('[BuilderContext] Timestamp mismatch, retrying save without concurrency guard');
      const retry = await supabase
        .from('form_templates')
        .update(updatePayload)
        .eq('id', state.templateId)
        .select('updated_at')
        .maybeSingle();

      if (retry.error) throw retry.error;
      if (!retry.data) throw new Error('Template not found');

      serverUpdatedAtRef.current = retry.data.updated_at;
      dispatch({ type: 'SAVE_SUCCESS', payload: { updatedAt: retry.data.updated_at } });
    } catch (err) {
      console.error('[BuilderContext] Save error:', err);
      dispatch({
        type: 'SAVE_ERROR',
        payload: { error: err instanceof Error ? err.message : 'Save failed' },
      });
    } finally {
      savingRef.current = false;
    }
  }

  const saveDraft = useCallback(async () => {
    await saveDraftInternal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.templateId, state.isSaving, state.titleEn, state.titleEs, state.descriptionEn,
      state.descriptionEs, state.slug, state.icon, state.iconColor, state.fields, state.instructionsEn,
      state.instructionsEs, state.aiTools, state.aiSystemPromptEn, state.aiSystemPromptEs,
      state.instructionsRefined, state.selectedFieldKey, state.activeTab, state.previewMode]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  // Convenience actions
  const addField = useCallback((type: FormFieldType) => {
    const existingKeys = state.fields.map(f => f.key);
    const field = getDefaultField(type, existingKeys);
    dispatch({ type: 'ADD_FIELD', payload: { field } });
  }, [state.fields]);

  const addFieldAtIndex = useCallback((type: FormFieldType, index: number) => {
    const existingKeys = state.fields.map(f => f.key);
    const field = getDefaultField(type, existingKeys);
    dispatch({ type: 'ADD_FIELD_AT_INDEX', payload: { field, index } });
  }, [state.fields]);

  const removeField = useCallback((key: string) => {
    dispatch({ type: 'REMOVE_FIELD', payload: { key } });
  }, []);

  const updateField = useCallback((key: string, updates: Partial<FormFieldDefinition>) => {
    dispatch({ type: 'UPDATE_FIELD', payload: { key, updates } });
  }, []);

  const moveField = useCallback((activeKey: string, overKey: string) => {
    const oldIndex = state.fields.findIndex(f => f.key === activeKey);
    const newIndex = state.fields.findIndex(f => f.key === overKey);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...state.fields];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    dispatch({ type: 'REORDER_FIELDS', payload: reordered });
  }, [state.fields]);

  const selectField = useCallback((key: string | null) => {
    dispatch({ type: 'SET_SELECTED_FIELD', payload: key });
  }, []);

  const toggleTool = useCallback((toolId: string) => {
    dispatch({ type: 'TOGGLE_TOOL', payload: toolId });
  }, []);

  // Set title EN with auto-slug generation (DRY: used by BuilderTopBar + SettingsTab)
  const setTitleEn = useCallback((value: string) => {
    dispatch({ type: 'SET_TITLE_EN', payload: value });
    const isSlugLocked = state.status === 'published' || !!state.publishedAt;
    if (!isSlugLocked && (!state.slug || state.slug === generateSlug(state.titleEn))) {
      dispatch({ type: 'SET_SLUG', payload: generateSlug(value) });
    }
  }, [state.status, state.publishedAt, state.slug, state.titleEn]);

  // Derived values
  const fillableFieldCount = useMemo(() => {
    return state.fields.filter(f => !['header', 'instructions'].includes(f.type)).length;
  }, [state.fields]);

  const value: BuilderContextValue = useMemo(() => ({
    state,
    dispatch,
    saveDraft,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    fillableFieldCount,
    addField,
    addFieldAtIndex,
    removeField,
    updateField,
    moveField,
    selectField,
    toggleTool,
    setTitleEn,
  }), [state, saveDraft, undo, redo, fillableFieldCount, addField, addFieldAtIndex,
       removeField, updateField, moveField, selectField, toggleTool, setTitleEn]);

  return (
    <BuilderContext.Provider value={value}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder(): BuilderContextValue {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error('useBuilder must be used within a BuilderProvider');
  }
  return context;
}
