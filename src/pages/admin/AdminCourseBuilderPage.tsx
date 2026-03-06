// =============================================================================
// AdminCourseBuilderPage — Main course builder page
// Desktop: three-column layout (palette / canvas / right panel)
// Mobile: single column with tab switching (Canvas / Elements / AI)
// Follows the pattern of AdminFormBuilderPage with BuilderProvider
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { CourseBuilderProvider, useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { useAuth } from '@/components/auth';
import { useGroupId } from '@/hooks/useGroupId';
import { generateCourseSlug, getDefaultQuizConfig } from '@/lib/course-builder/builder-utils';
import { CourseBuilderTopBar } from '@/components/course-builder/CourseBuilderTopBar';
import { ElementPalette, COURSE_PALETTE_DRAG_PREFIX } from '@/components/course-builder/ElementPalette';
import { CourseBuilderCanvas } from '@/components/course-builder/CourseBuilderCanvas';
import { SectionNavigator } from '@/components/course-builder/SectionNavigator';
import { ElementPropertiesPanel } from '@/components/course-builder/ElementPropertiesPanel';
import { CourseAIBuilderPanel } from '@/components/course-builder/CourseAIBuilderPanel';
import { AIProgressOverlay } from '@/components/course-builder/AIProgressOverlay';
import { CourseBuilderTabBar } from '@/components/course-builder/CourseBuilderTabBar';
import { CoursePreviewPanel } from '@/components/course-builder/CoursePreviewPanel';
import { QuizBuilderView } from '@/components/course-builder/QuizBuilderView';
import { useBuildCourse } from '@/hooks/use-build-course';
import type { ElementType, FeatureVariant } from '@/types/course-builder';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    loading: 'Loading...',
    canvas: 'Canvas',
    elements: 'Elements',
    ai: 'AI',
  },
  es: {
    loading: 'Cargando...',
    canvas: 'Canvas',
    elements: 'Elementos',
    ai: 'IA',
  },
};

type MobileView = 'canvas' | 'elements' | 'ai';

// =============================================================================
// PAGE WRAPPER — provides CourseBuilderProvider
// =============================================================================

export default function AdminCourseBuilderPage() {
  return (
    <CourseBuilderProvider>
      <CourseBuilderPageContent />
    </CourseBuilderProvider>
  );
}

// =============================================================================
// PAGE CONTENT — inside CourseBuilderProvider
// =============================================================================

function CourseBuilderPageContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language = 'en', user } = useAuth();
  const lang = (language === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[lang];
  const { state, dispatch, addElement, addElementAtIndex, saveDraft } = useCourseBuilder();
  const groupId = useGroupId();
  const { generateOutline, buildAllContent, cancelBuild, isBuilding: isBuildingContent } = useBuildCourse();
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [mobileView, setMobileView] = useState<MobileView>('canvas');

  // --- Page-level DnD sensors ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // --- Page-level DnD drag end handler (palette -> canvas only) ---
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);

      // Palette -> canvas: insert new element
      if (activeId.startsWith(COURSE_PALETTE_DRAG_PREFIX)) {
        const raw = activeId.replace(COURSE_PALETTE_DRAG_PREFIX, '');
        // Format: "type" or "feature:variant"
        let elementType: ElementType;
        let variant: FeatureVariant | undefined;

        if (raw.startsWith('feature:')) {
          elementType = 'feature';
          variant = raw.replace('feature:', '') as FeatureVariant;
        } else {
          elementType = raw as ElementType;
        }

        const overId = String(over.id);
        const section = state.sections.find(s => s.id === state.activeSectionId);
        if (!section) {
          addElement(elementType, variant);
          return;
        }

        const overIndex = section.elements.findIndex(e => e.key === overId);
        if (overIndex !== -1) {
          addElementAtIndex(elementType, overIndex, variant);
        } else {
          addElement(elementType, variant);
        }
        return;
      }

      // Canvas reorder is handled by arrow buttons, NOT drag-and-drop
    },
    [state.sections, state.activeSectionId, addElement, addElementAtIndex],
  );

  // Load existing course on mount (edit mode)
  useEffect(() => {
    if (!id) return;

    async function loadCourse() {
      // Load course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();

      if (courseError || !courseData) {
        console.error('[CourseBuilder] Load error:', courseError);
        navigate('/admin/courses');
        return;
      }

      // Load sections
      const { data: sectionsData } = await supabase
        .from('course_sections')
        .select('*')
        .eq('course_id', id)
        .order('sort_order');

      const sections = (sectionsData || []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        courseId: s.course_id as string,
        groupId: (s.group_id as string) || '',
        slug: s.slug as string,
        titleEn: s.title_en as string,
        titleEs: (s.title_es as string) || '',
        elements: (s.elements as unknown[]) || [],
        sourceRefs: (s.source_refs as unknown[]) || [],
        generationStatus: (s.generation_status as string) || 'empty',
        sortOrder: (s.sort_order as number) || 0,
        estimatedMinutes: (s.estimated_minutes as number) || 0,
        createdAt: s.created_at as string,
        updatedAt: s.updated_at as string,
      }));

      dispatch({
        type: 'HYDRATE',
        payload: {
          courseId: courseData.id,
          groupId: courseData.group_id || '',
          slug: courseData.slug,
          titleEn: courseData.title_en || '',
          titleEs: courseData.title_es || '',
          descriptionEn: courseData.description_en || '',
          descriptionEs: courseData.description_es || '',
          icon: courseData.icon || 'BookOpen',
          courseType: courseData.course_type || 'blank',
          status: courseData.status || 'draft',
          version: courseData.version || 1,
          publishedAt: courseData.published_at || null,
          teacherLevel: courseData.teacher_level || 'professional',
          teacherId: courseData.teacher_id || null,
          quizConfig: (courseData.quiz_config as Record<string, unknown>) ? courseData.quiz_config : getDefaultQuizConfig(),
          sections,
          activeSectionId: sections[0]?.id ?? null,
          serverUpdatedAt: courseData.updated_at,
        },
      });
      setInitialLoading(false);
    }

    loadCourse();
  }, [id, dispatch, navigate]);

  // Create new course on mount (new mode)
  useEffect(() => {
    if (id || state.courseId) return;

    async function createCourse() {
      if (!groupId || !user?.id) return;

      const shortId = Math.random().toString(36).slice(2, 7);
      const slug = `${generateCourseSlug('untitled-course')}-${shortId}`;

      const { data, error } = await supabase
        .from('courses')
        .insert({
          group_id: groupId,
          slug,
          title_en: 'Untitled Course',
          icon: 'BookOpen',
          course_type: 'blank',
          status: 'draft',
          version: 1,
          teacher_level: 'professional',
          quiz_config: getDefaultQuizConfig() as unknown as Record<string, unknown>,
          created_by: user.id,
        })
        .select('id, slug, updated_at')
        .single();

      if (error) {
        console.error('[CourseBuilder] Create error:', error);
        return;
      }

      dispatch({
        type: 'HYDRATE',
        payload: {
          courseId: data.id,
          groupId: groupId,
          slug: data.slug,
          serverUpdatedAt: data.updated_at,
        },
        preserveUIState: true,
      });

      // Update URL without full navigation
      window.history.replaceState(null, '', `/admin/courses/${data.id}/edit`);
    }

    createCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, state.courseId, user?.id, dispatch, groupId]);

  // Manual save
  const handleManualSave = useCallback(async () => {
    await saveDraft();
  }, [saveDraft]);

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">{t.loading}</span>
        </div>
      </div>
    );
  }

  // Mobile tabs
  const mobileTabs: { key: MobileView; label: string }[] = [
    { key: 'canvas', label: t.canvas },
    { key: 'elements', label: t.elements },
    { key: 'ai', label: t.ai },
  ];

  // Right panel: element properties or AI chat stub
  const selectedElement = state.selectedElementKey && state.activeSectionId
    ? state.sections
        .find(s => s.id === state.activeSectionId)
        ?.elements.find(e => e.key === state.selectedElementKey) ?? null
    : null;

  const showPropertiesPanel = state.rightPanelMode === 'element-properties' && !!selectedElement;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <div className="h-dvh bg-background flex flex-col overflow-hidden">
        {/* Top bar */}
        <CourseBuilderTopBar
          language={lang}
          onSave={handleManualSave}
          onGenerateOutline={state.courseId ? () => void generateOutline(state.courseId!) : undefined}
          onBuildAllContent={state.courseId ? () => void buildAllContent(state.courseId!, lang) : undefined}
        />

        {/* Desktop layout: palette + canvas + right panel */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* LEFT SIDEBAR — Element Palette + Section Navigator (desktop only) */}
          <div className="hidden lg:flex lg:flex-col lg:w-56 shrink-0 border-r min-h-0">
            <div className="flex-1 overflow-y-auto">
              <ElementPalette language={lang} onClickAdd={addElement} />
              <SectionNavigator language={lang} />
            </div>
          </div>

          {/* CENTER COLUMN — Canvas / Preview / Quiz */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Desktop: Tab bar */}
            <div className="hidden lg:block border-b shrink-0">
              <CourseBuilderTabBar language={lang} />
            </div>

            {/* Mobile: segmented tab bar */}
            <div className="lg:hidden border-b shrink-0">
              <div className="flex gap-0 px-4 py-1">
                {mobileTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMobileView(tab.key)}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium text-center rounded-lg transition-colors',
                      mobileView === tab.key
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: content based on activeTab */}
            <div className="hidden lg:block flex-1 overflow-y-auto min-h-0 p-4">
              {state.activeTab === 'elements' && <CourseBuilderCanvas language={lang} />}
              {state.activeTab === 'preview' && <CoursePreviewPanel language={lang} />}
              {state.activeTab === 'quiz' && <QuizBuilderView language={lang} />}
              {state.activeTab === 'settings' && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">{lang === 'es' ? 'Configuración del curso — Próximamente' : 'Course settings — Coming soon'}</p>
                </div>
              )}
            </div>

            {/* Mobile: content based on mobileView */}
            <div className="lg:hidden flex-1 min-h-0 overflow-y-auto p-4">
              {mobileView === 'canvas' && <CourseBuilderCanvas language={lang} />}
              {mobileView === 'elements' && (
                <div className="space-y-4">
                  <ElementPalette language={lang} onClickAdd={addElement} />
                  <SectionNavigator language={lang} />
                </div>
              )}
              {mobileView === 'ai' && (
                <CourseAIBuilderPanel language={lang} />
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — Properties / AI (desktop only, hidden on quiz/preview tabs) */}
          {state.activeTab === 'elements' && (
            <div className={cn(
              'hidden lg:flex lg:flex-col',
              'lg:basis-[35%] shrink-0',
              'min-h-0',
              'bg-muted/30',
              'border-l',
            )}>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {showPropertiesPanel && selectedElement ? (
                  <ElementPropertiesPanel element={selectedElement} language={lang} />
                ) : (
                  <CourseAIBuilderPanel language={lang} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* AI Progress Overlay (shown during bulk content generation) */}
        <AIProgressOverlay
          isActive={state.aiGenerating && !!state.aiProgress}
          progress={state.aiProgress}
          currentElementTitle={
            state.aiGeneratingElementKey
              ? state.sections
                  .flatMap(s => s.elements)
                  .find(e => e.key === state.aiGeneratingElementKey)
                  ?.title_en
              : undefined
          }
          onCancel={cancelBuild}
          language={lang}
        />
      </div>
    </DndContext>
  );
}
