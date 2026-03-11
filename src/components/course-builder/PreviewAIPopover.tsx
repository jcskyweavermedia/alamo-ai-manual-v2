// =============================================================================
// PreviewAIPopover — AI edit popover for preview mode elements
// Shows element content preview, instruction input, quick action chips.
// Calls build-course-element edge function via useBuildCourse().buildElement()
// =============================================================================

import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { useBuildCourse } from '@/hooks/use-build-course';
import type { CourseElement } from '@/types/course-builder';

/** Compact markdown components for the small preview box */
const previewMdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <span>{children} </span>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-foreground/80">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em>{children}</em>,
  h1: ({ children }: { children?: React.ReactNode }) => <span className="font-semibold">{children} </span>,
  h2: ({ children }: { children?: React.ReactNode }) => <span className="font-semibold">{children} </span>,
  h3: ({ children }: { children?: React.ReactNode }) => <span className="font-semibold">{children} </span>,
  ul: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  ol: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  li: ({ children }: { children?: React.ReactNode }) => <span>• {children} </span>,
};

const QUICK_ACTIONS = [
  { label: 'Make concise', instruction: 'Make this more concise and direct. Remove filler words.' },
  { label: 'Add detail', instruction: 'Expand this with more specific details and examples.' },
  { label: 'Translate ES', instruction: 'Translate the English content to Spanish (keep English as-is, update Spanish fields).' },
  { label: 'Add pairing info', instruction: 'Add food and wine pairing information relevant to this content.' },
];

/** Extract a preview of the element's text content for each element type */
function getElementPreview(element: CourseElement): string {
  const trunc = (s: string, max = 120) => s.length > max ? s.slice(0, max) + '...' : s;

  switch (element.type) {
    case 'content':
    case 'feature':
      return element.body_en ? trunc(element.body_en) : (element.title_en || `[${element.type}]`);
    case 'media':
      return element.caption_en ? trunc(element.caption_en) : (element.alt_text_en || '[media element]');
    case 'product_viewer':
      return element.products?.map(p => p.name_en).join(', ') || '[product viewer]';
    case 'page_header':
      return [element.badge_en, element.title_en, element.tagline_en].filter(Boolean).join(' — ');
    case 'section_header':
      return [element.number_label, element.title_en, element.subtitle_en].filter(Boolean).join(' — ');
    case 'card_grid':
      return element.cards?.length
        ? `${element.cards.length} cards: ${element.cards.map(c => c.title_en).join(', ')}`
        : '[empty card grid]';
    case 'comparison':
      if (element.variant === 'miss_fix' && element.pairs?.length) {
        return `${element.pairs.length} miss/fix pairs`;
      }
      return [element.positive?.title_en, 'vs', element.negative?.title_en].filter(Boolean).join(' ');
    case 'script_block':
      return element.header_en
        ? `${element.header_en}${element.lines?.length ? ` (${element.lines.length} lines)` : ''}`
        : '[script block]';
    default:
      return `[${element.type} element]`;
  }
}

interface PreviewAIPopoverProps {
  element: CourseElement;
  sectionId: string;
  language: 'en' | 'es';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function PreviewAIPopover({
  element,
  sectionId,
  language,
  open,
  onOpenChange,
  children,
}: PreviewAIPopoverProps) {
  const { state } = useCourseBuilder();
  const { buildElement, isBuilding } = useBuildCourse();
  const [instruction, setInstruction] = useState('');

  const handleApply = async () => {
    if (!state.courseId || !instruction.trim()) return;
    const success = await buildElement(
      state.courseId,
      sectionId,
      element.key,
      instruction.trim(),
      language,
    );
    if (success) {
      setInstruction('');
      onOpenChange(false);
    }
  };

  const handleQuickAction = (quickInstruction: string) => {
    setInstruction(quickInstruction);
  };

  const preview = getElementPreview(element);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        side="bottom"
        align="end"
        sideOffset={8}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold">AI Edit</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Current content preview */}
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Current</p>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5 line-clamp-3">
              <ReactMarkdown components={previewMdComponents}>{preview}</ReactMarkdown>
            </div>
          </div>

          {/* Instruction input */}
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">How should I edit this?</p>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Make it more conversational..."
              className="min-h-[60px] text-sm resize-none"
              autoFocus
              disabled={isBuilding}
            />
          </div>

          {/* Quick action chips */}
          <div>
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1.5">Quick actions</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map(({ label, instruction: qi }) => (
                <button
                  key={label}
                  onClick={() => handleQuickAction(qi)}
                  disabled={isBuilding}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => onOpenChange(false)}
              disabled={isBuilding}
              className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isBuilding || !instruction.trim()}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 shadow-sm transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
            >
              {isBuilding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Apply
                </>
              )}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
