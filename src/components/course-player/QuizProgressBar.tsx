// =============================================================================
// QuizProgressBar — Row of dots showing quiz question progress.
//
// Adapted from old training/QuizProgressBar. Same visual pattern:
//   - Green dot = correct, red dot = incorrect, muted = unanswered
//   - Current dot has ring + scale highlight
//   - Counter "X/Y" at the end
// =============================================================================

import { cn } from '@/lib/utils';
import type { MCAnswerResult } from '@/types/course-player';

// =============================================================================
// TYPES
// =============================================================================

interface QuizProgressBarProps {
  current: number;
  total: number;
  answers: Map<string, MCAnswerResult>;
  questionIds: string[];
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuizProgressBar({
  current,
  total,
  answers,
  questionIds,
  className,
}: QuizProgressBarProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {Array.from({ length: total }, (_, i) => {
        const qId = questionIds[i];
        const answer = qId ? answers.get(qId) : undefined;
        const isCurrent = i === current;

        let dotColor = 'bg-muted-foreground/30'; // unanswered
        if (answer) {
          dotColor = answer.isCorrect ? 'bg-green-500' : 'bg-red-400';
        }

        return (
          <div
            key={i}
            className={cn(
              'h-2.5 w-2.5 rounded-full transition-all duration-200',
              dotColor,
              isCurrent &&
                'ring-2 ring-primary ring-offset-1 ring-offset-background scale-125',
            )}
          />
        );
      })}
      <span className="ml-2 text-xs text-muted-foreground font-medium tabular-nums">
        {current + 1}/{total}
      </span>
    </div>
  );
}
