// =============================================================================
// ElementCardWrapper — Per-element wrapper with simplified chrome.
// Arrow buttons for reorder (UP/DOWN on left side), delete button.
// Inline editing elements provide their own styling — wrapper is minimal.
// AI instructions card shown below content when toggle is on.
// Media/ProductViewer keep the InlineAIPrompt sparkle button.
// =============================================================================

import { ChevronUp, ChevronDown, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineAIPrompt } from '@/components/course-builder/InlineAIPrompt';
import { AIInstructionsCard } from '@/components/course-builder/AIInstructionsCard';
import type { CourseElement } from '@/types/course-builder';

// Element types that use the new inline editing (NOT media/product_viewer)
const INLINE_EDITABLE_TYPES = new Set([
  'content', 'feature', 'page_header', 'section_header',
  'card_grid', 'comparison', 'script_block',
]);

interface ElementCardWrapperProps {
  element: CourseElement;
  sectionId: string;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  language: 'en' | 'es';
  children: React.ReactNode;
}

export function ElementCardWrapper({
  element,
  sectionId,
  isSelected,
  isFirst,
  isLast,
  language,
  children,
}: ElementCardWrapperProps) {
  const { selectElement, removeElement, moveElementUp, moveElementDown, state } = useCourseBuilder();
  const isInlineEditable = INLINE_EDITABLE_TYPES.has(element.type);

  return (
    <div
      className={cn(
        'group relative flex gap-1.5 rounded-xl transition-shadow',
        isSelected
          ? 'ring-2 ring-primary shadow-md'
          : 'hover:shadow-sm',
      )}
      onClick={(e) => {
        // Don't steal focus from inline editable fields
        if ((e.target as HTMLElement).closest('input, textarea, select, [data-inline-editable]')) return;
        selectElement(element.key);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectElement(element.key);
        }
      }}
    >
      {/* Left: Arrow buttons for reorder */}
      <div className="flex flex-col items-center justify-center gap-0.5 py-2 shrink-0">
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

      {/* Main card content */}
      <div className={cn(
        'flex-1 min-w-0 rounded-xl',
        // Only add card chrome for non-inline-editable types (media, product_viewer)
        !isInlineEditable && 'border bg-card p-3 border-black/[0.04] dark:border-white/[0.06]',
        // Inline editable types get minimal padding
        isInlineEditable && 'p-2',
      )}>
        {/* Action buttons — simplified for inline types, full for media/product_viewer */}
        {!isInlineEditable && (
          <div className="flex items-center justify-end mb-2">
            <div className={cn(
              'flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
              isSelected && '!opacity-100',
            )}>
              {element.type !== 'product_viewer' && (
                <InlineAIPrompt
                  elementKey={element.key}
                  currentInstructions={element.ai_instructions}
                  sectionId={sectionId}
                  language={language}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); }}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    aria-label="AI Generate"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                </InlineAIPrompt>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeElement(element.key); }}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Delete button for inline editable types — floating top-right */}
        {isInlineEditable && (
          <div className={cn(
            'absolute top-1 right-1 z-20 flex items-center gap-0.5',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            isSelected && '!opacity-100',
          )}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeElement(element.key); }}
              className="h-6 w-6 flex items-center justify-center rounded bg-background/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Element content (rendered by type-specific renderer) */}
        {children}

        {/* AI Instructions Card — shown for inline editable types when toggled on */}
        {isInlineEditable && state.showAiInstructions && (
          <AIInstructionsCard
            elementKey={element.key}
            aiInstructions={element.ai_instructions}
            sectionId={sectionId}
            language={language}
            isGenerating={state.aiGeneratingElementKey === element.key}
          />
        )}
      </div>
    </div>
  );
}
