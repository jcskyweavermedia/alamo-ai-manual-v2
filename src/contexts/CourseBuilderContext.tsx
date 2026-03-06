// =============================================================================
// CourseBuilderContext — Course Builder Admin state management
// Pattern: useReducer + Context (matches BuilderContext for Form Builder)
// Key difference: elements are nested inside sections[].elements[]
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
import type {
  CourseBuilderState,
  CourseBuilderAction,
  CourseBuilderSnapshot,
  CourseBuilderContextValue,
  CourseSection,
  CourseElement,
  ElementType,
  FeatureVariant,
} from '@/types/course-builder';
import {
  getDefaultElement,
  getDefaultSection,
  getDefaultQuizConfig,
  generateCourseSlug,
} from '@/lib/course-builder/builder-utils';

// =============================================================================
// INITIAL STATE
// =============================================================================

export function createInitialState(): CourseBuilderState {
  return {
    courseId: null,
    groupId: '',
    slug: '',
    titleEn: '',
    titleEs: '',
    descriptionEn: '',
    descriptionEs: '',
    icon: 'BookOpen',
    courseType: 'blank',
    status: 'draft',
    version: 1,
    publishedAt: null,

    teacherLevel: 'professional',
    teacherId: null,

    quizConfig: getDefaultQuizConfig(),

    sections: [],
    activeSectionId: null,
    selectedElementKey: null,

    activeTab: 'elements',
    rightPanelMode: 'ai-chat',

    isDirty: false,
    saveStatus: 'saved',
    isSaving: false,
    serverUpdatedAt: null,
    hasUnpublishedChanges: false,

    past: [],
    future: [],
    maxHistory: 30,

    aiGenerating: false,
    aiGeneratingElementKey: null,
    aiProgress: null,

    builderChatMessages: [],
    builderChatLoading: false,

    wizardConfig: null,
  };
}

const initialState = createInitialState();

// =============================================================================
// UNDO HELPERS
// =============================================================================

function takeSnapshot(state: CourseBuilderState): CourseBuilderSnapshot {
  return {
    sections: state.sections.map(s => ({
      ...s,
      elements: s.elements.map(e => ({ ...e })),
    })),
    titleEn: state.titleEn,
    titleEs: state.titleEs,
    descriptionEn: state.descriptionEn,
    descriptionEs: state.descriptionEs,
    icon: state.icon,
    teacherLevel: state.teacherLevel,
    quizConfig: { ...state.quizConfig },
  };
}

function pushUndo(state: CourseBuilderState): CourseBuilderState {
  const snapshot = takeSnapshot(state);
  const past = [...state.past, snapshot].slice(-state.maxHistory);
  return { ...state, past, future: [] };
}

// =============================================================================
// SECTION HELPERS
// =============================================================================

/** Update a specific section by ID, returning new sections array */
function updateSectionElements(
  sections: CourseSection[],
  sectionId: string,
  updater: (elements: CourseElement[]) => CourseElement[],
): CourseSection[] {
  return sections.map(s =>
    s.id === sectionId
      ? { ...s, elements: updater(s.elements) }
      : s,
  );
}

// =============================================================================
// REDUCER
// =============================================================================

export function courseBuilderReducer(
  state: CourseBuilderState,
  action: CourseBuilderAction,
): CourseBuilderState {
  switch (action.type) {
    // --- Hydrate / Reset ---
    case 'HYDRATE': {
      const base = { ...initialState, ...action.payload };
      if (action.preserveUIState) {
        return {
          ...base,
          activeSectionId: state.activeSectionId,
          selectedElementKey: state.selectedElementKey,
          activeTab: state.activeTab,
          rightPanelMode: state.rightPanelMode,
          builderChatMessages: state.builderChatMessages,
          builderChatLoading: state.builderChatLoading,
        };
      }
      return base;
    }
    case 'RESET':
      return createInitialState();

    // --- Course Metadata ---
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
    case 'SET_COURSE_TYPE':
      return { ...state, courseType: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_TEACHER_LEVEL':
      return { ...state, teacherLevel: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_TEACHER_PERSONA':
      return { ...state, teacherId: action.payload, isDirty: true, saveStatus: 'unsaved' };
    case 'SET_QUIZ_CONFIG':
      return {
        ...state,
        quizConfig: { ...state.quizConfig, ...action.payload },
        isDirty: true,
        saveStatus: 'unsaved',
      };

    // --- UI Navigation ---
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_RIGHT_PANEL_MODE':
      return { ...state, rightPanelMode: action.payload };
    case 'SET_ACTIVE_SECTION':
      return { ...state, activeSectionId: action.payload, selectedElementKey: null };
    case 'SET_SELECTED_ELEMENT':
      return { ...state, selectedElementKey: action.payload };

    // --- Section Operations (undoable) ---
    case 'ADD_SECTION': {
      const s = pushUndo(state);
      const newSections = [...s.sections, action.payload.section];
      return {
        ...s,
        sections: newSections,
        activeSectionId: action.payload.section.id,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'UPDATE_SECTION': {
      const s = pushUndo(state);
      return {
        ...s,
        sections: s.sections.map(sec =>
          sec.id === action.payload.id
            ? { ...sec, ...action.payload.updates }
            : sec,
        ),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'REMOVE_SECTION': {
      const s = pushUndo(state);
      const filtered = s.sections.filter(sec => sec.id !== action.payload.id);
      return {
        ...s,
        sections: filtered,
        activeSectionId:
          s.activeSectionId === action.payload.id
            ? (filtered[0]?.id ?? null)
            : s.activeSectionId,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'REORDER_SECTIONS': {
      const s = pushUndo(state);
      return {
        ...s,
        sections: action.payload.map((sec, i) => ({ ...sec, sortOrder: i })),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }

    // --- Element Operations (undoable) ---
    case 'ADD_ELEMENT': {
      const s = pushUndo(state);
      return {
        ...s,
        sections: updateSectionElements(
          s.sections,
          action.payload.sectionId,
          (els) => [...els, action.payload.element],
        ),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'ADD_ELEMENT_AT_INDEX': {
      const s = pushUndo(state);
      return {
        ...s,
        sections: updateSectionElements(
          s.sections,
          action.payload.sectionId,
          (els) => {
            const newEls = [...els];
            const idx = Math.max(0, Math.min(action.payload.index, newEls.length));
            newEls.splice(idx, 0, action.payload.element);
            return newEls.map((e, i) => ({ ...e, sort_order: i }));
          },
        ),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'UPDATE_ELEMENT': {
      const s = pushUndo(state);
      return {
        ...s,
        sections: updateSectionElements(
          s.sections,
          action.payload.sectionId,
          (els) =>
            els.map(e =>
              e.key === action.payload.key
                ? ({ ...e, ...action.payload.updates } as CourseElement)
                : e,
            ),
        ),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'REMOVE_ELEMENT': {
      const s = pushUndo(state);
      return {
        ...s,
        sections: updateSectionElements(
          s.sections,
          action.payload.sectionId,
          (els) => els.filter(e => e.key !== action.payload.key),
        ),
        selectedElementKey:
          s.selectedElementKey === action.payload.key ? null : s.selectedElementKey,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'REORDER_ELEMENTS': {
      const s = pushUndo(state);
      return {
        ...s,
        sections: updateSectionElements(
          s.sections,
          action.payload.sectionId,
          () => action.payload.elements.map((e, i) => ({ ...e, sort_order: i })),
        ),
        isDirty: true,
        saveStatus: 'unsaved',
      };
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
    case 'PUBLISH':
      return {
        ...state,
        status: 'published',
        version: action.payload.version,
        publishedAt: action.payload.publishedAt,
        hasUnpublishedChanges: false,
      };

    // --- AI Generation ---
    case 'AI_GENERATE_OUTLINE_START':
      return { ...state, aiGenerating: true };
    case 'AI_GENERATE_OUTLINE_SUCCESS': {
      const s = pushUndo(state);
      return {
        ...s,
        sections: action.payload.sections,
        activeSectionId: action.payload.sections[0]?.id ?? null,
        aiGenerating: false,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'AI_GENERATE_OUTLINE_ERROR':
      return { ...state, aiGenerating: false };

    case 'AI_BUILD_ALL_START':
      return {
        ...state,
        aiGenerating: true,
        aiGeneratingElementKey: null,
        aiProgress: { completed: 0, total: action.payload.total },
      };
    case 'AI_BUILD_ELEMENT_START':
      return { ...state, aiGeneratingElementKey: action.payload.key };
    case 'AI_BUILD_ELEMENT_SUCCESS': {
      return {
        ...state,
        sections: updateSectionElements(
          state.sections,
          action.payload.sectionId,
          (els) =>
            els.map(e =>
              e.key === action.payload.key
                ? ({ ...e, ...action.payload.updates, status: 'generated' } as CourseElement)
                : e,
            ),
        ),
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }
    case 'AI_BUILD_ELEMENT_ERROR':
      return { ...state, aiGeneratingElementKey: null };
    case 'AI_BUILD_ALL_COMPLETE':
      return {
        ...state,
        aiGenerating: false,
        aiGeneratingElementKey: null,
        aiProgress: null,
      };
    case 'AI_PROGRESS_UPDATE':
      return { ...state, aiProgress: action.payload };

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

    case 'APPLY_CHAT_COURSE_UPDATES': {
      const s = pushUndo(state);
      const p = action.payload;

      // 1. Metadata updates
      const meta: Partial<CourseBuilderState> = {};
      if (p.titleEn != null) meta.titleEn = p.titleEn;
      if (p.titleEs != null) meta.titleEs = p.titleEs;
      if (p.descriptionEn != null) meta.descriptionEn = p.descriptionEn;
      if (p.descriptionEs != null) meta.descriptionEs = p.descriptionEs;
      if (p.icon != null) meta.icon = p.icon;
      if (p.teacherLevel != null) meta.teacherLevel = p.teacherLevel;
      if (p.quizConfig != null) meta.quizConfig = { ...s.quizConfig, ...p.quizConfig };

      // Auto-slug from new title
      if (p.titleEn) {
        const isSlugLocked = s.status === 'published' || !!s.publishedAt;
        const slugWasAuto = !s.slug || s.slug === generateCourseSlug(s.titleEn);
        if (!isSlugLocked && slugWasAuto) {
          meta.slug = generateCourseSlug(p.titleEn);
        }
      }

      // 2. Element operations: remove -> add -> modify -> reorder
      let sections = s.sections.map(sec => ({
        ...sec,
        elements: [...sec.elements],
      }));

      // Remove elements
      if (p.elementsToRemove?.length) {
        for (const { sectionId, key } of p.elementsToRemove) {
          sections = sections.map(sec =>
            sec.id === sectionId
              ? { ...sec, elements: sec.elements.filter(e => e.key !== key) }
              : sec,
          );
        }
      }

      // Add elements
      if (p.elementsToAdd?.length) {
        for (const { sectionId, element } of p.elementsToAdd) {
          sections = sections.map(sec =>
            sec.id === sectionId
              ? { ...sec, elements: [...sec.elements, element] }
              : sec,
          );
        }
      }

      // Modify elements
      if (p.elementsToModify?.length) {
        for (const { sectionId, key, updates } of p.elementsToModify) {
          sections = sections.map(sec =>
            sec.id === sectionId
              ? {
                  ...sec,
                  elements: sec.elements.map(e =>
                    e.key === key ? ({ ...e, ...updates } as CourseElement) : e,
                  ),
                }
              : sec,
          );
        }
      }

      // Reorder elements
      if (p.reorderedElementKeys?.length) {
        for (const { sectionId, keys } of p.reorderedElementKeys) {
          sections = sections.map(sec => {
            if (sec.id !== sectionId) return sec;
            const keyToEl = new Map(sec.elements.map(e => [e.key, e]));
            const reordered = keys
              .filter(k => keyToEl.has(k))
              .map((k, i) => ({ ...keyToEl.get(k)!, sort_order: i }));
            return { ...sec, elements: reordered };
          });
        }
      }

      return {
        ...s,
        ...meta,
        sections,
        isDirty: true,
        saveStatus: 'unsaved' as const,
      };
    }

    // --- Wizard ---
    case 'SET_WIZARD_CONFIG':
      return { ...state, wizardConfig: action.payload };

    // --- Undo / Redo ---
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const currentSnapshot = takeSnapshot(state);
      return {
        ...state,
        sections: previous.sections,
        titleEn: previous.titleEn,
        titleEs: previous.titleEs,
        descriptionEn: previous.descriptionEn,
        descriptionEs: previous.descriptionEs,
        icon: previous.icon,
        teacherLevel: previous.teacherLevel,
        quizConfig: previous.quizConfig,
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
        sections: next.sections,
        titleEn: next.titleEn,
        titleEs: next.titleEs,
        descriptionEn: next.descriptionEn,
        descriptionEs: next.descriptionEs,
        icon: next.icon,
        teacherLevel: next.teacherLevel,
        quizConfig: next.quizConfig,
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

const CourseBuilderContext = createContext<CourseBuilderContextValue | null>(null);

export function CourseBuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(courseBuilderReducer, initialState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref to serverUpdatedAt so saveDraftInternal always reads the latest value
  const serverUpdatedAtRef = useRef(state.serverUpdatedAt);
  useEffect(() => { serverUpdatedAtRef.current = state.serverUpdatedAt; }, [state.serverUpdatedAt]);

  // Ref-based guard against concurrent saves
  const savingRef = useRef(false);

  // Auto-save: 3s debounce when dirty
  useEffect(() => {
    if (state.isDirty && !state.isSaving && state.courseId && state.saveStatus !== 'error') {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveDraftInternal();
      }, 3000);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isDirty, state.isSaving, state.courseId, state.sections, state.titleEn, state.titleEs]);

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+S (save), Escape (deselect)
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
        dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courseId, state.isSaving]);

  // Internal save function with optimistic concurrency + retry
  async function saveDraftInternal() {
    if (!state.courseId || savingRef.current) return;
    savingRef.current = true;
    dispatch({ type: 'SAVE_START' });

    try {
      // Save course metadata
      const coursePayload = {
        title_en: state.titleEn,
        title_es: state.titleEs || null,
        description_en: state.descriptionEn || null,
        description_es: state.descriptionEs || null,
        slug: state.slug,
        icon: state.icon,
        course_type: state.courseType,
        teacher_level: state.teacherLevel,
        teacher_id: state.teacherId,
        quiz_config: state.quizConfig as unknown as Record<string, unknown>,
      };

      // First attempt: with optimistic concurrency guard
      let query = supabase
        .from('courses')
        .update(coursePayload)
        .eq('id', state.courseId);

      const currentServerUpdatedAt = serverUpdatedAtRef.current;
      if (currentServerUpdatedAt) {
        query = query.eq('updated_at', currentServerUpdatedAt);
      }

      const { data, error } = await query
        .select('updated_at')
        .maybeSingle();

      if (error) throw error;

      let updatedAt: string;

      if (data) {
        updatedAt = data.updated_at;
      } else {
        // Conflict: timestamp mismatch — retry once without guard
        console.info('[CourseBuilderContext] Timestamp mismatch, retrying save without concurrency guard');
        const retry = await supabase
          .from('courses')
          .update(coursePayload)
          .eq('id', state.courseId)
          .select('updated_at')
          .maybeSingle();

        if (retry.error) throw retry.error;
        if (!retry.data) throw new Error('Course not found');
        updatedAt = retry.data.updated_at;
      }

      // Save sections (upsert each section's elements)
      for (const section of state.sections) {
        await supabase
          .from('course_sections')
          .upsert({
            id: section.id,
            course_id: state.courseId,
            group_id: state.groupId,
            slug: section.slug,
            title_en: section.titleEn,
            title_es: section.titleEs || null,
            elements: section.elements as unknown as Record<string, unknown>[],
            source_refs: section.sourceRefs as unknown as Record<string, unknown>[],
            generation_status: section.generationStatus,
            sort_order: section.sortOrder,
            estimated_minutes: section.estimatedMinutes,
          })
          .eq('id', section.id);
      }

      serverUpdatedAtRef.current = updatedAt;
      dispatch({ type: 'SAVE_SUCCESS', payload: { updatedAt } });
    } catch (err) {
      console.error('[CourseBuilderContext] Save error:', err);
      dispatch({
        type: 'SAVE_ERROR',
        payload: { error: err instanceof Error ? err.message : 'Save failed' },
      });
    } finally {
      savingRef.current = false;
    }
  }

  // Public save handler
  const saveDraft = useCallback(async () => {
    await saveDraftInternal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courseId, state.isSaving, state.titleEn, state.titleEs, state.slug,
      state.descriptionEn, state.descriptionEs, state.icon, state.courseType,
      state.teacherLevel, state.quizConfig, state.sections]);

  // Publish handler (stub — will be expanded in Phase 5)
  const publish = useCallback(async () => {
    if (!state.courseId) return;
    // Save first
    await saveDraftInternal();
    // Then update status
    const newVersion = state.version + 1;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('courses')
      .update({ status: 'published', version: newVersion, published_at: now })
      .eq('id', state.courseId);
    if (!error) {
      dispatch({ type: 'PUBLISH', payload: { version: newVersion, publishedAt: now } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courseId, state.version]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  // Convenience actions
  const addElement = useCallback((type: ElementType, variant?: FeatureVariant) => {
    if (!state.activeSectionId) return;
    const section = state.sections.find(s => s.id === state.activeSectionId);
    if (!section) return;
    const existingKeys = section.elements.map(e => e.key);
    const element = getDefaultElement(type, variant, existingKeys);
    dispatch({ type: 'ADD_ELEMENT', payload: { sectionId: state.activeSectionId, element } });
  }, [state.activeSectionId, state.sections]);

  const addElementAtIndex = useCallback((type: ElementType, index: number, variant?: FeatureVariant) => {
    if (!state.activeSectionId) return;
    const section = state.sections.find(s => s.id === state.activeSectionId);
    if (!section) return;
    const existingKeys = section.elements.map(e => e.key);
    const element = getDefaultElement(type, variant, existingKeys);
    dispatch({ type: 'ADD_ELEMENT_AT_INDEX', payload: { sectionId: state.activeSectionId, element, index } });
  }, [state.activeSectionId, state.sections]);

  const removeElement = useCallback((key: string) => {
    if (!state.activeSectionId) return;
    dispatch({ type: 'REMOVE_ELEMENT', payload: { sectionId: state.activeSectionId, key } });
  }, [state.activeSectionId]);

  const updateElement = useCallback((key: string, updates: Partial<CourseElement>) => {
    if (!state.activeSectionId) return;
    dispatch({ type: 'UPDATE_ELEMENT', payload: { sectionId: state.activeSectionId, key, updates } });
  }, [state.activeSectionId]);

  // Arrow-based reordering (NOT drag-and-drop for reorder)
  const moveElementUp = useCallback((key: string) => {
    if (!state.activeSectionId) return;
    const section = state.sections.find(s => s.id === state.activeSectionId);
    if (!section) return;
    const idx = section.elements.findIndex(e => e.key === key);
    if (idx <= 0) return;
    const newElements = [...section.elements];
    [newElements[idx - 1], newElements[idx]] = [newElements[idx], newElements[idx - 1]];
    dispatch({ type: 'REORDER_ELEMENTS', payload: { sectionId: state.activeSectionId, elements: newElements } });
  }, [state.activeSectionId, state.sections]);

  const moveElementDown = useCallback((key: string) => {
    if (!state.activeSectionId) return;
    const section = state.sections.find(s => s.id === state.activeSectionId);
    if (!section) return;
    const idx = section.elements.findIndex(e => e.key === key);
    if (idx === -1 || idx >= section.elements.length - 1) return;
    const newElements = [...section.elements];
    [newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]];
    dispatch({ type: 'REORDER_ELEMENTS', payload: { sectionId: state.activeSectionId, elements: newElements } });
  }, [state.activeSectionId, state.sections]);

  const selectElement = useCallback((key: string | null) => {
    dispatch({ type: 'SET_SELECTED_ELEMENT', payload: key });
    if (key) {
      dispatch({ type: 'SET_RIGHT_PANEL_MODE', payload: 'element-properties' });
    }
  }, []);

  const addSection = useCallback((title: string) => {
    const section = getDefaultSection(title);
    section.sortOrder = state.sections.length;
    dispatch({ type: 'ADD_SECTION', payload: { section } });
  }, [state.sections.length]);

  const removeSection = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_SECTION', payload: { id } });
  }, []);

  const setActiveSection = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_SECTION', payload: id });
  }, []);

  // Set title EN with auto-slug generation
  const setTitleEn = useCallback((value: string) => {
    dispatch({ type: 'SET_TITLE_EN', payload: value });
    const isSlugLocked = state.status === 'published' || !!state.publishedAt;
    if (!isSlugLocked && (!state.slug || state.slug === generateCourseSlug(state.titleEn))) {
      dispatch({ type: 'SET_SLUG', payload: generateCourseSlug(value) });
    }
  }, [state.status, state.publishedAt, state.slug, state.titleEn]);

  // Derived values
  const activeSection = useMemo(() => {
    return state.sections.find(s => s.id === state.activeSectionId) ?? null;
  }, [state.sections, state.activeSectionId]);

  const elementCount = useMemo(() => {
    return activeSection?.elements.length ?? 0;
  }, [activeSection]);

  const value: CourseBuilderContextValue = useMemo(() => ({
    state,
    dispatch,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    activeSection,
    elementCount,
    addElement,
    addElementAtIndex,
    removeElement,
    updateElement,
    moveElementUp,
    moveElementDown,
    selectElement,
    addSection,
    removeSection,
    setActiveSection,
    setTitleEn,
    saveDraft,
    publish,
    undo,
    redo,
  }), [state, activeSection, elementCount, addElement, addElementAtIndex,
       removeElement, updateElement, moveElementUp, moveElementDown, selectElement,
       addSection, removeSection, setActiveSection, setTitleEn, saveDraft, publish, undo, redo]);

  return (
    <CourseBuilderContext.Provider value={value}>
      {children}
    </CourseBuilderContext.Provider>
  );
}

export function useCourseBuilder(): CourseBuilderContextValue {
  const context = useContext(CourseBuilderContext);
  if (!context) {
    throw new Error('useCourseBuilder must be used within a CourseBuilderProvider');
  }
  return context;
}
