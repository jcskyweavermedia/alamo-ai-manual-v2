// =============================================================================
// use-course-builder-dnd — DnD logic for Course Builder
// Handles ONLY palette-to-canvas insert. Arrow buttons handle reorder.
// This hook is used by AdminCourseBuilderPage.
// =============================================================================

import { useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { COURSE_PALETTE_DRAG_PREFIX } from '@/components/course-builder/ElementPalette';
import type { ElementType, FeatureVariant } from '@/types/course-builder';

interface UseCourseBuilderDndOptions {
  activeSectionId: string | null;
  sectionElementKeys: string[]; // keys of elements in the active section
  addElement: (type: ElementType, variant?: FeatureVariant) => void;
  addElementAtIndex: (type: ElementType, index: number, variant?: FeatureVariant) => void;
}

/**
 * Parses a palette drag ID into an element type and optional feature variant.
 * Returns null if the ID is not a palette drag.
 */
export function parsePaletteDragId(id: string): { type: ElementType; variant?: FeatureVariant } | null {
  if (!id.startsWith(COURSE_PALETTE_DRAG_PREFIX)) return null;

  const raw = id.replace(COURSE_PALETTE_DRAG_PREFIX, '');

  if (raw.startsWith('feature:')) {
    return {
      type: 'feature',
      variant: raw.replace('feature:', '') as FeatureVariant,
    };
  }

  return { type: raw as ElementType };
}

/**
 * Hook that provides a `handleDragEnd` callback for the Course Builder's DndContext.
 *
 * Handles only palette-to-canvas inserts. Canvas element reorder is handled by
 * arrow buttons (moveElementUp / moveElementDown), NOT drag-and-drop.
 */
export function useCourseBuilderDnd({
  activeSectionId,
  sectionElementKeys,
  addElement,
  addElementAtIndex,
}: UseCourseBuilderDndOptions) {
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!active || !activeSectionId) return;

      const activeId = String(active.id);

      // Only handle palette -> canvas inserts
      const parsed = parsePaletteDragId(activeId);
      if (!parsed) return;

      // No drop target or drop on canvas itself -> append to end
      if (!over) {
        addElement(parsed.type, parsed.variant);
        return;
      }

      const overId = String(over.id);

      // Drop on an existing element -> insert at that index
      const overIndex = sectionElementKeys.indexOf(overId);
      if (overIndex !== -1) {
        addElementAtIndex(parsed.type, overIndex, parsed.variant);
      } else {
        // Drop on the canvas or unknown target -> append to end
        addElement(parsed.type, parsed.variant);
      }
    },
    [activeSectionId, sectionElementKeys, addElement, addElementAtIndex],
  );

  return { handleDragEnd };
}
