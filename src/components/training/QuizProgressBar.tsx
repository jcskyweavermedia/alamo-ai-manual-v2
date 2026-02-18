import { cn } from '@/lib/utils';
import type { AnswerResult } from '@/types/training';

interface QuizProgressBarProps {
  current: number;
  total: number;
  answers: Map<string, AnswerResult>;
  questionIds: string[];
  className?: string;
}

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
          const correct =
            answer.type === 'mc' ? answer.isCorrect : answer.passed;
          dotColor = correct ? 'bg-green-500' : 'bg-red-400';
        }

        return (
          <div
            key={i}
            className={cn(
              'h-2.5 w-2.5 rounded-full transition-all duration-200',
              dotColor,
              isCurrent && 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-125'
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
