/**
 * FollowUpBubble
 *
 * AI follow-up question bubble. Left-aligned with sparkle icon.
 * Subtle background color to distinguish from extraction cards.
 */

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowUpBubbleProps {
  question: string;
  className?: string;
}

export function FollowUpBubble({ question, className }: FollowUpBubbleProps) {
  return (
    <div className={cn('flex items-start gap-2 max-w-[90%]', className)}>
      <div
        className={cn(
          'flex items-center justify-center shrink-0',
          'w-7 h-7 rounded-full',
          'bg-primary/10 dark:bg-primary/15',
        )}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div
        className={cn(
          'px-3 py-2 rounded-2xl rounded-tl-sm',
          'bg-muted/60 dark:bg-muted/40',
          'text-sm text-foreground leading-relaxed',
        )}
      >
        {question}
      </div>
    </div>
  );
}
