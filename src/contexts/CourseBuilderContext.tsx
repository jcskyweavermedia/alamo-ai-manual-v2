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
import { toast } from 'sonner';
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
  AssessmentConfig,
  CanvasViewMode,
  PreviewDevice,
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
    coverImage: null,
    courseType: 'blank',
    status: 'draft',
    version: 1,
    publishedAt: null,

    teacherLevel: 'developing',
    teacherId: null,

    quizConfig: getDefaultQuizConfig(),

    assessmentConfig: {
      require_passing_evaluation: true,
      passing_competency: 'competent',
      allow_retry: true,
      max_retries: null,
    } as AssessmentConfig,

    sections: [],
    activeSectionId: null,
    selectedElementKey: null,

    activeTab: 'elements',
    rightPanelMode: 'ai-chat',
    showAiInstructions: true,

    canvasViewMode: 'preview',
    previewDevice: 'desktop',
    previewLang: 'en',
    previewEditingKey: null,

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

    multiphaseState: {
      isActive: false,
      phases: [],
      currentPhaseId: null,
      estimatedTotalSeconds: 0,
    },

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
      elements: structuredClone(s.elements),
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

/** Find the section containing an element by its key */
function findSectionByKey(sections: CourseSection[], elementKey: string): CourseSection | null {
  return sections.find(s => s.elements.some(e => e.key === elementKey)) ?? null;
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
    case 'SET_COVER_IMAGE':
      return { ...state, coverImage: action.payload, isDirty: true, saveStatus: 'unsaved' as const };
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
    case 'SET_ASSESSMENT_CONFIG':
      return {
        ...state,
        assessmentConfig: { ...state.assessmentConfig, ...action.payload },
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

    case 'SET_SHOW_AI_INSTRUCTIONS':
      return { ...state, showAiInstructions: action.payload };

    case 'SET_CANVAS_VIEW_MODE':
      return {
        ...state,
        canvasViewMode: action.payload,
        previewEditingKey: null,
        selectedElementKey: null,
        rightPanelMode: 'ai-chat',
      };
    case 'SET_PREVIEW_DEVICE':
      return { ...state, previewDevice: action.payload };
    case 'SET_PREVIEW_LANG':
      return { ...state, previewLang: action.payload };
    case 'SET_PREVIEW_EDITING_KEY':
      return { ...state, previewEditingKey: action.payload };

    case 'UPDATE_ELEMENT_SILENT':
      return {
        ...state,
        isDirty: true,
        saveStatus: 'unsaved',
        sections: state.sections.map(s =>
          s.id === action.payload.sectionId
            ? { ...s, elements: s.elements.map(e => e.key === action.payload.key ? ({ ...e, ...action.payload.updates } as CourseElement) : e) }
            : s
        ),
      };
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
      // Push undo for single-element AI edits (skip during bulk "Build All" to avoid flooding history)
      const s2 = state.aiProgress ? state : pushUndo(state);
      return {
        ...s2,
        sections: updateSectionElements(
          s2.sections,
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

    // --- Multiphase Pipeline ---
    case 'AI_MULTIPHASE_START':
      return {
        ...state,
        aiGenerating: true,
        multiphaseState: {
          isActive: true,
          phases: action.payload.phases,
          currentPhaseId: null,
          estimatedTotalSeconds: action.payload.estimatedSeconds,
        },
      };
    case 'AI_PHASE_START':
      return {
        ...state,
        multiphaseState: {
          ...state.multiphaseState,
          currentPhaseId: action.payload.phaseId,
          phases: state.multiphaseState.phases.map(p =>
            p.id === action.payload.phaseId
              ? { ...p, status: 'active', startedAt: Date.now() }
              : p,
          ),
        },
      };
    case 'AI_PHASE_PROGRESS':
      return {
        ...state,
        multiphaseState: {
          ...state.multiphaseState,
          phases: state.multiphaseState.phases.map(p =>
            p.id === action.payload.phaseId
              ? { ...p, progress: { completed: action.payload.completed, total: action.payload.total } }
              : p,
          ),
        },
      };
    case 'AI_PHASE_COMPLETE':
      return {
        ...state,
        multiphaseState: {
          ...state.multiphaseState,
          phases: state.multiphaseState.phases.map(p =>
            p.id === action.payload.phaseId
              ? { ...p, status: 'complete', completedAt: Date.now() }
              : p,
          ),
        },
      };
    case 'AI_PHASE_ERROR':
      return {
        ...state,
        aiGenerating: false,
        multiphaseState: {
          ...state.multiphaseState,
          error: action.payload.error,
          phases: state.multiphaseState.phases.map(p =>
            p.id === action.payload.phaseId
              ? { ...p, status: 'error' }
              : p,
          ),
        },
      };
    case 'AI_MULTIPHASE_COMPLETE':
      return {
        ...state,
        aiGenerating: false,
        multiphaseState: {
          ...state.multiphaseState,
          isActive: false,
          currentPhaseId: null,
        },
      };
    case 'AI_MULTIPHASE_CANCEL':
      return {
        ...state,
        aiGenerating: false,
        aiGeneratingElementKey: null,
        aiProgress: null,
        multiphaseState: {
          ...state.multiphaseState,
          isActive: false,
          currentPhaseId: null,
        },
      };
    case 'AI_UPDATE_ESTIMATE':
      return {
        ...state,
        multiphaseState: {
          ...state.multiphaseState,
          estimatedTotalSeconds: action.payload.estimatedSeconds,
        },
      };
    case 'AI_HYDRATE_SECTIONS': {
      // Merge/upsert: update existing sections by ID, append new ones
      const merged = [...state.sections];
      for (const incoming of action.payload.sections) {
        const idx = merged.findIndex(s => s.id === incoming.id);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], ...incoming } as CourseSection;
        } else if (incoming.id) {
          // New section from Pass 1 — append with sensible defaults
          merged.push({
            id: incoming.id,
            courseId: state.courseId || '',
            groupId: state.groupId || '',
            slug: '',
            titleEn: '',
            titleEs: '',
            elements: [],
            sourceRefs: [],
            generationStatus: 'empty',
            sortOrder: merged.length,
            estimatedMinutes: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...incoming,
          } as CourseSection);
        }
      }
      return {
        ...state,
        sections: merged,
        // Set activeSectionId if it was null (first hydration)
        activeSectionId: state.activeSectionId || merged[0]?.id || null,
        isDirty: true,
        saveStatus: 'unsaved',
      };
    }

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

  // Ref-based guard against concurrent translations
  const translatingRef = useRef(false);

  // Auto-save: 3s debounce when dirty (suppressed during build pipeline AND translation)
  useEffect(() => {
    if (state.isDirty && !state.isSaving && state.courseId && state.saveStatus !== 'error' && !state.multiphaseState.isActive && !state.aiGenerating) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveDraftInternal();
      }, 3000);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isDirty, state.isSaving, state.courseId, state.sections, state.titleEn, state.titleEs, state.aiGenerating]);

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+S (save), Escape (deselect)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (state.multiphaseState.isActive) return;
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
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courseId, state.isSaving, state.multiphaseState.isActive]);

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
        cover_image: state.coverImage,
        course_type: state.courseType,
        teacher_level: state.teacherLevel,
        teacher_id: state.teacherId,
        quiz_config: state.quizConfig as unknown as Record<string, unknown>,
        assessment_config: state.assessmentConfig as unknown as Record<string, unknown>,
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

        // Sync ref immediately so subsequent saves use the fresh timestamp
        serverUpdatedAtRef.current = updatedAt;
      }

      // Save sections (upsert each section's elements)
      for (let i = 0; i < state.sections.length; i++) {
        const section = state.sections[i];
        const sectionPayload: Record<string, unknown> = {
          id: section.id,
          course_id: state.courseId,
          group_id: state.groupId,
          slug: section.slug || `section-${section.sortOrder ?? i}`,
          title_en: section.titleEn,
          title_es: section.titleEs || null,
          elements: section.elements as unknown as Record<string, unknown>[],
          source_refs: section.sourceRefs as unknown as Record<string, unknown>[],
          generation_status: section.generationStatus,
          sort_order: section.sortOrder,
          estimated_minutes: section.estimatedMinutes,
        };
        await supabase
          .from('course_sections')
          .upsert(sectionPayload)
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

  // Publish handler — DB trigger (auto_set_published_at) handles version bump + published_at
  const publish = useCallback(async () => {
    if (!state.courseId) return;
    // Save first
    try {
      await saveDraftInternal();
    } catch (err) {
      console.error('[CourseBuilderContext] Save before publish failed:', err);
      toast.error('Save failed — publish aborted');
      return;
    }
    // Set status to published — trigger auto-bumps version + published_at
    const { data, error } = await supabase
      .from('courses')
      .update({ status: 'published' as string })
      .eq('id', state.courseId)
      .select('version, published_at')
      .single();
    if (error) {
      console.error('[CourseBuilderContext] Publish error:', error);
      toast.error(error.message || 'Publish failed');
      return;
    }
    dispatch({ type: 'PUBLISH', payload: { version: data.version, publishedAt: data.published_at } });
    toast.success('Course published');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courseId, state.version]);

  // Translate course — on-demand, per-section, non-fatal
  const translateCourse = useCallback(async (
    onProgress?: (completed: number, total: number) => void,
  ): Promise<{ translated: number; failed: number; total: number }> => {
    if (!state.courseId || translatingRef.current) return { translated: 0, failed: 0, total: 0 };
    translatingRef.current = true;

    // Set aiGenerating to suppress auto-save and block concurrent operations
    dispatch({ type: 'AI_BUILD_ALL_START', payload: { total: 0 } });

    try {
      // Save draft first to ensure DB is up-to-date
      await saveDraftInternal();

      // Find sections that need translation (only 'generated' — edge fn requires this status)
      const translatable = state.sections.filter(
        s => s.generationStatus === 'generated',
      );
      const total = translatable.length;
      if (total === 0) return { translated: 0, failed: 0, total: 0 };

      let translated = 0;
      let failed = 0;

      for (let i = 0; i < translatable.length; i++) {
        const section = translatable[i];

        try {
          const { data, error: fnError } = await supabase.functions.invoke('build-course', {
            body: {
              step: 'translate',
              course_id: state.courseId,
              section_id: section.id,
              translate_page_header: section.sortOrder === 0,
            },
          });

          if (fnError) {
            const errorDetail = data?.error || data?.message || fnError.message || 'Translation failed';
            console.warn(`[translateCourse] section ${section.id} failed:`, errorDetail);
            failed++;
          } else if (data?.error) {
            console.warn(`[translateCourse] section ${section.id} error:`, data.error);
            failed++;
          } else {
            // Validate response — require both title and elements
            const hasTitle = data?.title_es && typeof data.title_es === 'string';
            const hasElements = data?.elements && Array.isArray(data.elements);
            if (hasTitle && hasElements) {
              dispatch({
                type: 'AI_HYDRATE_SECTIONS',
                payload: {
                  sections: [{
                    id: section.id,
                    titleEs: data.title_es,
                    elements: data.elements as CourseElement[],
                    generationStatus: 'translated' as const,
                  }],
                },
              });
              translated++;
            } else {
              console.warn(`[translateCourse] section ${section.id} incomplete response`);
              failed++;
            }
          }
        } catch (err) {
          console.warn(`[translateCourse] section ${section.id} exception:`, err);
          failed++;
        }

        onProgress?.(i + 1, total);
      }

      // Save translated state to DB immediately
      await saveDraftInternal();

      return { translated, failed, total };
    } finally {
      translatingRef.current = false;
      dispatch({ type: 'AI_BUILD_ALL_COMPLETE' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courseId, state.sections]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const toggleAiInstructions = useCallback(() => {
    dispatch({ type: 'SET_SHOW_AI_INSTRUCTIONS', payload: !state.showAiInstructions });
  }, [state.showAiInstructions]);

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
    const section = findSectionByKey(state.sections, key);
    if (!section) return;
    dispatch({ type: 'REMOVE_ELEMENT', payload: { sectionId: section.id, key } });
  }, [state.sections]);

  const updateElement = useCallback((key: string, updates: Partial<CourseElement>) => {
    const section = findSectionByKey(state.sections, key);
    if (!section) return;
    dispatch({ type: 'UPDATE_ELEMENT', payload: { sectionId: section.id, key, updates } });
  }, [state.sections]);

  const updateElementSilent = useCallback((key: string, updates: Partial<CourseElement>) => {
    const section = findSectionByKey(state.sections, key);
    if (!section) return;
    dispatch({ type: 'UPDATE_ELEMENT_SILENT', payload: { sectionId: section.id, key, updates } });
  }, [state.sections]);

  // Arrow-based reordering (NOT drag-and-drop for reorder)
  const moveElementUp = useCallback((key: string) => {
    const section = findSectionByKey(state.sections, key);
    if (!section) return;
    const idx = section.elements.findIndex(e => e.key === key);
    if (idx <= 0) return;
    const newElements = [...section.elements];
    [newElements[idx - 1], newElements[idx]] = [newElements[idx], newElements[idx - 1]];
    dispatch({ type: 'REORDER_ELEMENTS', payload: { sectionId: section.id, elements: newElements } });
  }, [state.sections]);

  const moveElementDown = useCallback((key: string) => {
    const section = findSectionByKey(state.sections, key);
    if (!section) return;
    const idx = section.elements.findIndex(e => e.key === key);
    if (idx === -1 || idx >= section.elements.length - 1) return;
    const newElements = [...section.elements];
    [newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]];
    dispatch({ type: 'REORDER_ELEMENTS', payload: { sectionId: section.id, elements: newElements } });
  }, [state.sections]);

  // Per-section convenience functions (for continuous scroll canvas)
  const addElementToSection = useCallback((sectionId: string, type: ElementType, variant?: FeatureVariant) => {
    const section = state.sections.find(s => s.id === sectionId);
    if (!section) return;
    const existingKeys = section.elements.map(e => e.key);
    const element = getDefaultElement(type, variant, existingKeys);
    dispatch({ type: 'ADD_ELEMENT', payload: { sectionId, element } });
  }, [state.sections]);

  const addElementAtIndexInSection = useCallback((sectionId: string, type: ElementType, index: number, variant?: FeatureVariant) => {
    const section = state.sections.find(s => s.id === sectionId);
    if (!section) return;
    const existingKeys = section.elements.map(e => e.key);
    const element = getDefaultElement(type, variant, existingKeys);
    dispatch({ type: 'ADD_ELEMENT_AT_INDEX', payload: { sectionId, element, index } });
  }, [state.sections]);

  const setCoverImage = useCallback((url: string | null) => {
    dispatch({ type: 'SET_COVER_IMAGE', payload: url });
  }, []);

  const setCanvasViewMode = useCallback((mode: CanvasViewMode) => {
    dispatch({ type: 'SET_CANVAS_VIEW_MODE', payload: mode });
  }, []);

  const setPreviewDevice = useCallback((device: PreviewDevice) => {
    dispatch({ type: 'SET_PREVIEW_DEVICE', payload: device });
  }, []);

  const setPreviewLang = useCallback((lang: 'en' | 'es') => {
    dispatch({ type: 'SET_PREVIEW_LANG', payload: lang });
  }, []);

  const setPreviewEditingKey = useCallback((key: string | null) => {
    dispatch({ type: 'SET_PREVIEW_EDITING_KEY', payload: key });
  }, []);

  const findSectionByElementKeyFn = useCallback((key: string) => {
    return findSectionByKey(state.sections, key);
  }, [state.sections]);

  const selectElement = useCallback((key: string | null) => {
    dispatch({ type: 'SET_SELECTED_ELEMENT', payload: key });
    // Don't auto-switch right panel — inline editing handles fields on canvas
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
    addElementToSection,
    addElementAtIndexInSection,
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
    translateCourse,
    undo,
    redo,
    toggleAiInstructions,
    updateElementSilent,
    setCoverImage,
    setCanvasViewMode,
    setPreviewDevice,
    setPreviewLang,
    setPreviewEditingKey,
    findSectionByElementKey: findSectionByElementKeyFn,
  }), [state, activeSection, elementCount, addElement, addElementAtIndex,
       addElementToSection, addElementAtIndexInSection,
       removeElement, updateElement, moveElementUp, moveElementDown, selectElement,
       addSection, removeSection, setActiveSection, setTitleEn, saveDraft, publish, translateCourse, undo, redo,
       toggleAiInstructions, updateElementSilent, setCoverImage, setCanvasViewMode, setPreviewDevice, setPreviewLang, setPreviewEditingKey, findSectionByElementKeyFn]);

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
