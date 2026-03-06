// =============================================================================
// CourseBuilderCanvas — Center panel: renders section elements
// Arrow-based reorder via ElementCardWrapper (NOT drag-and-drop for reorder).
// DnD is ONLY for palette-to-canvas insert (useDroppable on canvas).
// =============================================================================

import { useDroppable } from '@dnd-kit/core';
import { LayoutTemplate, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { ElementCardWrapper } from './ElementCardWrapper';
import { ContentElementRenderer } from './ContentElementRenderer';
import { FeatureElementRenderer } from './FeatureElementRenderer';
import { MediaElementRenderer } from './MediaElementRenderer';
import { ProductViewerElementRenderer } from './ProductViewerElementRenderer';
import type { CourseElement, ProductViewerElement } from '@/types/course-builder';

const STRINGS = {
  en: {
    noSection: 'No section selected',
    noSectionSub: 'Create a section in the left panel to get started.',
    emptySection: 'This section is empty',
    emptySectionSub: 'Drag elements from the palette or click below to add one.',
    addElement: 'Add Element',
    addSection: 'Add Section',
  },
  es: {
    noSection: 'Sin seccion seleccionada',
    noSectionSub: 'Crea una seccion en el panel izquierdo para comenzar.',
    emptySection: 'Esta seccion esta vacia',
    emptySectionSub: 'Arrastra elementos desde la paleta o haz clic abajo para agregar uno.',
    addElement: 'Agregar Elemento',
    addSection: 'Agregar Seccion',
  },
};

interface CourseBuilderCanvasProps {
  language: 'en' | 'es';
}

export function CourseBuilderCanvas({ language }: CourseBuilderCanvasProps) {
  const t = STRINGS[language];
  const {
    state,
    activeSection,
    addElement,
    addSection,
  } = useCourseBuilder();

  // Make the entire canvas a drop target for palette items
  const { setNodeRef, isOver } = useDroppable({
    id: 'course-builder-canvas',
  });

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

  // Active section has no elements
  if (!activeSection || activeSection.elements.length === 0) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4',
          'rounded-xl border-2 border-dashed transition-colors',
          isOver
            ? 'border-primary/50 bg-primary/5'
            : 'border-transparent',
        )}
      >
        <LayoutTemplate className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-medium text-foreground/80">{t.emptySection}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">{t.emptySectionSub}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 text-xs"
          onClick={() => addElement('content')}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t.addElement}
        </Button>
      </div>
    );
  }

  // Render elements
  const elements = activeSection.elements;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'space-y-2 min-h-[300px] rounded-xl transition-colors py-1',
        isOver && 'ring-2 ring-primary/30 bg-primary/5',
      )}
    >
      {elements.map((element, index) => (
        <ElementCardWrapper
          key={element.key}
          element={element}
          isSelected={state.selectedElementKey === element.key}
          isFirst={index === 0}
          isLast={index === elements.length - 1}
          language={language}
        >
          <ElementRenderer element={element} language={language} />
        </ElementCardWrapper>
      ))}

      {/* Add element button at the bottom */}
      <div className="flex justify-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => addElement('content')}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t.addElement}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// ELEMENT RENDERER — dispatches to type-specific renderer
// =============================================================================

function ElementRenderer({
  element,
  language,
}: {
  element: CourseElement;
  language: 'en' | 'es';
}) {
  switch (element.type) {
    case 'content':
      return <ContentElementRenderer element={element} language={language} />;
    case 'feature':
      return <FeatureElementRenderer element={element} language={language} />;
    case 'media':
      return <MediaElementRenderer element={element} language={language} />;
    case 'product_viewer':
      return <ProductViewerElementRenderer element={element as ProductViewerElement} language={language} />;
    default:
      return null;
  }
}
