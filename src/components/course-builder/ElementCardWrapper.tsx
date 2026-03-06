// =============================================================================
// ElementCardWrapper — Per-element wrapper with controls
// Arrow buttons for reorder (UP/DOWN on left side), AI button, edit, delete,
// status badge. CRITICAL: arrow-based reordering, NOT drag-and-drop.
// =============================================================================

import { ChevronUp, ChevronDown, Sparkles, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineAIPrompt } from '@/components/course-builder/InlineAIPrompt';
import type { CourseElement, ElementStatus } from '@/types/course-builder';

const statusBadgeStyles: Record<ElementStatus, string> = {
  outline: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  generated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

interface ElementCardWrapperProps {
  element: CourseElement;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  language: 'en' | 'es';
  children: React.ReactNode;
}

export function ElementCardWrapper({
  element,
  isSelected,
  isFirst,
  isLast,
  language,
  children,
}: ElementCardWrapperProps) {
  const { selectElement, removeElement, moveElementUp, moveElementDown, state } = useCourseBuilder();
  const sectionId = state.activeSectionId || '';

  return (
    <div
      className={cn(
        'group relative flex gap-1.5 rounded-xl transition-shadow',
        isSelected
          ? 'ring-2 ring-primary shadow-md'
          : 'hover:shadow-sm',
      )}
      onClick={() => selectElement(element.key)}
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
        'flex-1 min-w-0 rounded-xl border bg-card p-3',
        'border-black/[0.04] dark:border-white/[0.06]',
      )}>
        {/* Top row: type label + status badge + action buttons */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
              {element.type === 'product_viewer' ? 'PRODUCT' : element.type}{element.type === 'feature' && 'variant' in element ? ` / ${element.variant}` : ''}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                'text-[9px] font-semibold px-1.5 py-0 h-[16px] border-0',
                statusBadgeStyles[element.status],
              )}
            >
              {element.status}
            </Badge>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
              onClick={(e) => { e.stopPropagation(); selectElement(element.key); }}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
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

        {/* Element content (rendered by type-specific renderer) */}
        {children}
      </div>
    </div>
  );
}
