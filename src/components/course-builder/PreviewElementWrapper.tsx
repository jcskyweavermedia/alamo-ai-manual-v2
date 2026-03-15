// =============================================================================
// PreviewElementWrapper — Wraps player renderers in Preview mode with:
// - Hover detection → subtle ring + floating action bar (pencil/sparkle)
// - Pencil click → inline edit mode (swaps to builder renderer)
// - Sparkle click → AI edit popover (Phase 3)
// - Mobile: tap-to-select replaces hover
//
// Editor-mode extensions (editorMode=true):
// - Reorder arrows (left side, same as ElementCardWrapper)
// - Delete button in floating action bar
// - Click-to-select with blue ring + sticky action bar
// =============================================================================

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { Pencil, Sparkles, Check, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
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

  // Editor-mode props (all optional)
  editorMode?: boolean;         // enables reorder/delete/select
  isSelected?: boolean;         // selection ring (blue)
  isFirst?: boolean;            // disable move-up
  isLast?: boolean;             // disable move-down
}

export function PreviewElementWrapper({
  element,
  sectionId,
  isEditing,
  language,
  children,
  editorMode = false,
  isSelected = false,
  isFirst = false,
  isLast = false,
}: PreviewElementWrapperProps) {
  const {
    setPreviewEditingKey,
    selectElement,
    removeElement,
    moveElementUp,
    moveElementDown,
  } = useCourseBuilder();
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

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (editorMode) {
      // Guard: don't steal focus from inputs/textareas/selects/[data-inline-editable]
      if ((e.target as HTMLElement).closest('input, textarea, select, [data-inline-editable]')) return;
      selectElement(element.key);
    } else {
      handleTap();
    }
  }, [editorMode, selectElement, element.key, handleTap]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    removeElement(element.key);
  }, [removeElement, element.key]);

  // ---------------------------------------------------------------------------
  // Reorder arrows column (editor mode only)
  // ---------------------------------------------------------------------------
  const arrowsColumn = editorMode ? (
    <div className="hidden sm:flex flex-col items-center justify-center gap-0.5 py-2 shrink-0">
      <button
        type="button"
        disabled={isFirst}
        onClick={(e) => {
          e.stopPropagation();
          moveElementUp(element.key);
        }}
        className={cn(
          'h-6 w-6 flex items-center justify-center rounded',
          'text-muted-foreground transition-colors',
          isFirst
            ? 'opacity-20 cursor-not-allowed'
            : 'hover:bg-muted hover:text-foreground',
        )}
        aria-label="Move up"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={isLast}
        onClick={(e) => {
          e.stopPropagation();
          moveElementDown(element.key);
        }}
        className={cn(
          'h-6 w-6 flex items-center justify-center rounded',
          'text-muted-foreground transition-colors',
          isLast
            ? 'opacity-20 cursor-not-allowed'
            : 'hover:bg-muted hover:text-foreground',
        )}
        aria-label="Move down"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // Editing mode: show builder renderer with Done button
  // ---------------------------------------------------------------------------
  if (isEditing) {
    const editingContent = (
      <div className="relative ring-2 ring-orange-400 rounded-lg p-1 flex-1 min-w-0">
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

    // In editor mode, wrap with flex row for arrows
    if (editorMode) {
      return (
        <div
          ref={wrapperRef}
          data-block-id={element.key}
          data-section-id={sectionId}
          className="flex gap-1.5"
        >
          {arrowsColumn}
          {editingContent}
        </div>
      );
    }

    // Pure preview editing — no layout change
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

  // ---------------------------------------------------------------------------
  // Normal mode — Editor mode: flex row [arrows | content] with blue ring
  // ---------------------------------------------------------------------------
  if (editorMode) {
    return (
      <div
        ref={wrapperRef}
        data-block-id={element.key}
        data-section-id={sectionId}
        className={cn(
          'group flex gap-1.5 rounded-xl transition-shadow',
          isSelected
            ? 'ring-2 ring-primary shadow-md'
            : 'hover:shadow-sm',
        )}
        onClick={handleClick}
      >
        {arrowsColumn}

        {/* Content area */}
        <div className="relative flex-1 min-w-0">
          {/* Action bar: sticky when selected, absolute on hover */}
          <div
            className={cn(
              'flex items-center gap-0.5',
              'rounded-lg bg-white/90 dark:bg-gray-900/90 shadow-md backdrop-blur-sm',
              isSelected
                ? 'sticky top-2 z-20 float-right mr-1'
                : cn(
                    'absolute top-1 right-1 z-10',
                    'transition-opacity duration-150',
                    'opacity-0 group-hover:opacity-100',
                    isTapSelected && 'opacity-100',
                  ),
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
            <button
              onClick={handleDeleteClick}
              className="flex items-center justify-center h-8 w-8 sm:h-7 sm:w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Player renderer (read-only) */}
          {children}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Normal mode — Pure preview: simple relative wrapper (original behavior)
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={wrapperRef}
      data-block-id={element.key}
      data-section-id={sectionId}
      className="group relative"
      onClick={handleClick}
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
