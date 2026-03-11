// =============================================================================
// PreviewElementWrapper — Wraps player renderers in Preview mode with:
// - Hover detection → subtle ring + floating action bar (pencil/sparkle)
// - Pencil click → inline edit mode (swaps to builder renderer)
// - Sparkle click → AI edit popover (Phase 3)
// - Mobile: tap-to-select replaces hover
// =============================================================================

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { Pencil, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { ElementRendererDispatcher } from './ElementRendererDispatcher';
import { PreviewAIPopover } from './PreviewAIPopover';
import type { CourseElement } from '@/types/course-builder';

interface PreviewElementWrapperProps {
  element: CourseElement;
  sectionId: string;
  isEditing: boolean;
  language: 'en' | 'es';
  children: ReactNode; // PlayerElementDispatcher output
}

export function PreviewElementWrapper({
  element,
  sectionId,
  isEditing,
  language,
  children,
}: PreviewElementWrapperProps) {
  const { setPreviewEditingKey } = useCourseBuilder();
  const [isTapSelected, setIsTapSelected] = useState(false);
  const [showAIPopover, setShowAIPopover] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Dismiss tap selection when clicking outside
  useEffect(() => {
    if (!isTapSelected) return;
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsTapSelected(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isTapSelected]);

  const handleTap = useCallback(() => {
    // On touch devices, tap to select (show action bar)
    if ('ontouchstart' in window) {
      setIsTapSelected(prev => !prev);
    }
  }, []);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewEditingKey(element.key);
    setIsTapSelected(false);
  }, [element.key, setPreviewEditingKey]);

  const handleDone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewEditingKey(null);
  }, [setPreviewEditingKey]);

  const handleSparkleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAIPopover(true);
    setIsTapSelected(false);
  }, []);

  // Editing mode: show builder renderer with Done button
  if (isEditing) {
    return (
      <div
        ref={wrapperRef}
        data-block-id={element.key}
        data-section-id={sectionId}
        className="relative ring-2 ring-orange-400 rounded-lg p-1"
      >
        {/* Done button */}
        <div className="absolute top-1 right-1 z-10">
          <button
            onClick={handleDone}
            className="flex items-center gap-1 rounded-md bg-orange-500 text-white px-2.5 py-1 text-xs font-medium shadow-md hover:bg-orange-600 transition-colors"
          >
            <Check className="h-3 w-3" />
            Done
          </button>
        </div>

        {/* Builder renderer (inline-editable) */}
        <ElementRendererDispatcher element={element} language={language} />
      </div>
    );
  }

  // Normal mode: player renderer with hover/tap action bar
  return (
    <div
      ref={wrapperRef}
      data-block-id={element.key}
      data-section-id={sectionId}
      className="group relative"
      onClick={handleTap}
    >
      {/* Hover ring */}
      <div
        className={cn(
          'absolute inset-0 rounded-lg pointer-events-none transition-all duration-150',
          'ring-1 ring-transparent group-hover:ring-orange-300/50',
          isTapSelected && 'ring-orange-300/50',
        )}
      />

      {/* Floating action bar */}
      <div
        className={cn(
          'absolute top-1 right-1 z-10 flex items-center gap-0.5',
          'rounded-lg bg-white/90 dark:bg-gray-900/90 shadow-md backdrop-blur-sm',
          'transition-opacity duration-150',
          // Desktop: show on hover. Mobile: show on tap-select
          'opacity-0 group-hover:opacity-100',
          isTapSelected && 'opacity-100',
        )}
      >
        <button
          onClick={handleEditClick}
          className="flex items-center justify-center h-8 w-8 sm:h-7 sm:w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <PreviewAIPopover
          element={element}
          sectionId={sectionId}
          language={language}
          open={showAIPopover}
          onOpenChange={setShowAIPopover}
        >
          <button
            onClick={handleSparkleClick}
            className="flex items-center justify-center h-8 w-8 sm:h-7 sm:w-7 rounded-md text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            title="AI Edit"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </PreviewAIPopover>
      </div>

      {/* Player renderer (read-only) */}
      {children}
    </div>
  );
}
