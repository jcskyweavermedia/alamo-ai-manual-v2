// =============================================================================
// CourseBuilderCanvas — Center panel: renders ALL sections in continuous scroll.
// IntersectionObserver tracks active section. Per-section drop targets.
// Preview mode: player renderers in DevicePreviewFrame.
// Editor mode: player renderers with PreviewElementWrapper (editorMode).
// =============================================================================

import { useEffect, useRef, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { LayoutTemplate, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { DevicePreviewFrame } from './DevicePreviewFrame';
import { PreviewElementWrapper } from './PreviewElementWrapper';
import { PlayerElementDispatcher } from '@/components/course-player/PlayerElementDispatcher';
import type { CourseSection } from '@/types/course-builder';

const STRINGS = {
  en: {
    noSection: 'No sections yet',
    noSectionSub: 'Create a section in the left panel to get started.',
    emptySection: 'This section is empty',
    emptySectionSub: 'Drag elements from the palette or click below to add one.',
    addElement: 'Add Element',
    addSection: 'Add Section',
    insertSection: 'Insert Section',
    elements: 'elements',
  },
  es: {
    noSection: 'Sin secciones',
    noSectionSub: 'Crea una seccion en el panel izquierdo para comenzar.',
    emptySection: 'Esta seccion esta vacia',
    emptySectionSub: 'Arrastra elementos desde la paleta o haz clic abajo para agregar uno.',
    addElement: 'Agregar Elemento',
    addSection: 'Agregar Seccion',
    insertSection: 'Insertar Seccion',
    elements: 'elementos',
  },
};

const statusColors: Record<string, string> = {
  empty: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  outline: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  planned: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  prose_ready: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  prose_error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  generating: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  generated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  incomplete: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  translated: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

interface CourseBuilderCanvasProps {
  language: 'en' | 'es';
}

export function CourseBuilderCanvas({ language }: CourseBuilderCanvasProps) {
  const t = STRINGS[language];
  const {
    state,
    dispatch,
    addElementToSection,
    addSection,
  } = useCourseBuilder();

  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isScrollingRef = useRef(false);

  const isPreview = state.canvasViewMode === 'preview';
  const { previewLang, previewDevice } = state;

  // --- IntersectionObserver: track which section is most visible ---
  useEffect(() => {
    if (state.sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
              bestEntry = entry;
            }
          }
        }
        if (bestEntry) {
          const sectionId = bestEntry.target.getAttribute('data-section-id');
          if (sectionId && sectionId !== state.activeSectionId) {
            dispatch({ type: 'SET_ACTIVE_SECTION', payload: sectionId });
          }
        }
      },
      {
        root: containerRef.current,
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const [, el] of sectionRefs.current) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [state.sections, state.activeSectionId, dispatch]);

  // --- Custom event listener: scroll-to-section (from SectionNavigator) ---
  useEffect(() => {
    function handleScrollTo(e: Event) {
      const sectionId = (e as CustomEvent<string>).detail;
      const el = sectionRefs.current.get(sectionId);
      if (el) {
        isScrollingRef.current = true;
        dispatch({ type: 'SET_ACTIVE_SECTION', payload: sectionId });
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => { isScrollingRef.current = false; }, 800);
      }
    }
    window.addEventListener('course-builder-scroll-to-section', handleScrollTo);
    return () => window.removeEventListener('course-builder-scroll-to-section', handleScrollTo);
  }, [dispatch]);

  const setSectionRef = useCallback((sectionId: string, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(sectionId, el);
    } else {
      sectionRefs.current.delete(sectionId);
    }
  }, []);

  // No sections exist
  if (state.sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
        <LayoutTemplate className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-medium text-foreground/80">{t.noSection}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">{t.noSectionSub}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 text-xs"
          onClick={() => addSection(language === 'es' ? 'Nueva Seccion' : 'New Section')}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t.addSection}
        </Button>
      </div>
    );
  }

  // Render all sections in continuous scroll
  // Preview mode: wrap ALL sections in a single DevicePreviewFrame for continuous scroll
  if (isPreview) {
    return (
      <div ref={containerRef} className="min-h-[300px] py-1">
        <DevicePreviewFrame device={previewDevice}>
          <div className="space-y-6">
            {state.sections.map((section, sectionIndex) => (
              <div
                key={section.id}
                ref={(el) => setSectionRef(section.id, el)}
                data-section-id={section.id}
              >
                {section.elements.map((element, index) => (
                  <PreviewElementWrapper
                    key={element.key}
                    element={element}
                    sectionId={section.id}
                    isEditing={state.previewEditingKey === element.key}
                    language={language}
                  >
                    <PlayerElementDispatcher
                      element={element}
                      language={previewLang}
                      isFirstElement={sectionIndex === 0 && index === 0}
                    />
                  </PreviewElementWrapper>
                ))}
              </div>
            ))}
          </div>
        </DevicePreviewFrame>
      </div>
    );
  }

  // Editor mode
  return (
    <div ref={containerRef} className="space-y-0 min-h-[300px] py-1">
      {state.sections.map((section, sectionIndex) => (
        <div key={section.id}>
          {/* Section divider */}
          {sectionIndex > 0 && (
            <SectionDivider
              language={language}
              onInsert={() => addSection(language === 'es' ? 'Nueva Seccion' : 'New Section')}
            />
          )}

          <SectionBlock
            section={section}
            sectionIndex={sectionIndex}
            language={language}
            previewLang={previewLang}
            previewEditingKey={state.previewEditingKey}
            isActive={state.activeSectionId === section.id}
            selectedElementKey={state.selectedElementKey}
            setSectionRef={setSectionRef}
            addElementToSection={addElementToSection}
            strings={t}
          />
        </div>
      ))}

      {/* Add section button */}
      <div className="flex justify-center pt-6 pb-4">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => addSection(language === 'es' ? 'Nueva Seccion' : 'New Section')}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t.addSection}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// SECTION DIVIDER
// =============================================================================

function SectionDivider({
  language,
  onInsert,
}: {
  language: 'en' | 'es';
  onInsert: () => void;
}) {
  const label = STRINGS[language].insertSection;
  return (
    <div className="relative flex items-center justify-center py-4 group">
      <div className="absolute inset-x-4 border-t border-dashed border-border/60" />
      <Button
        variant="ghost"
        size="sm"
        className="relative z-10 text-[10px] text-muted-foreground/50 hover:text-foreground bg-background px-2 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onInsert}
      >
        <Plus className="h-3 w-3 mr-0.5" />
        {label}
      </Button>
    </div>
  );
}

// =============================================================================
// SECTION BLOCK
// =============================================================================

interface SectionBlockProps {
  section: CourseSection;
  sectionIndex: number;
  language: 'en' | 'es';
  previewLang: 'en' | 'es';
  previewEditingKey: string | null;
  isActive: boolean;
  selectedElementKey: string | null;
  setSectionRef: (sectionId: string, el: HTMLDivElement | null) => void;
  addElementToSection: (sectionId: string, type: 'content') => void;
  strings: typeof STRINGS['en'];
}

function SectionBlock({
  section,
  sectionIndex,
  language,
  previewLang,
  previewEditingKey,
  isActive,
  selectedElementKey,
  setSectionRef,
  addElementToSection,
  strings: t,
}: SectionBlockProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `section-drop-${section.id}`,
  });

  const elements = section.elements;

  const combinedRef = useCallback((el: HTMLDivElement | null) => {
    setSectionRef(section.id, el);
    setDropRef(el);
  }, [section.id, setSectionRef, setDropRef]);

  // Builder mode
  return (
    <div
      ref={combinedRef}
      data-section-id={section.id}
      className={cn(
        'rounded-xl transition-colors py-2',
        isOver && 'ring-2 ring-primary/30 bg-primary/5',
      )}
    >
      {/* Section label + status badge */}
      <div className="flex items-center gap-2 px-2 mb-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          {language === 'es' && section.titleEs ? section.titleEs : section.titleEn}
        </span>
        <Badge
          variant="secondary"
          className={cn(
            'text-[8px] font-semibold px-1 py-0 h-[12px] border-0',
            statusColors[section.generationStatus] || statusColors.empty,
          )}
        >
          {section.generationStatus}
        </Badge>
        <span className="text-[9px] text-muted-foreground/40 tabular-nums">
          {elements.length} {t.elements}
        </span>
      </div>

      {/* Elements */}
      {elements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <LayoutTemplate className="h-8 w-8 text-muted-foreground/20 mb-2" />
          <p className="text-xs text-muted-foreground/60">{t.emptySection}</p>
          <p className="text-[10px] text-muted-foreground/40 mt-0.5 max-w-[220px]">{t.emptySectionSub}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => addElementToSection(section.id, 'content')}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t.addElement}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {elements.map((element, index) => (
            <PreviewElementWrapper
              key={element.key}
              element={element}
              sectionId={section.id}
              isEditing={previewEditingKey === element.key}
              language={language}
              editorMode={true}
              isSelected={selectedElementKey === element.key}
              isFirst={index === 0}
              isLast={index === elements.length - 1}
            >
              <PlayerElementDispatcher
                element={element}
                language={previewLang}
                isFirstElement={sectionIndex === 0 && index === 0}
              />
            </PreviewElementWrapper>
          ))}
        </div>
      )}

      {/* Add element button at bottom of section */}
      {elements.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => addElementToSection(section.id, 'content')}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t.addElement}
          </Button>
        </div>
      )}
    </div>
  );
}

