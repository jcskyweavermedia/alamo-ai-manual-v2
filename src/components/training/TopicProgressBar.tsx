import { cn } from '@/lib/utils';

export interface TopicProgressBarProps {
  covered: number;
  total: number;
  language: 'en' | 'es';
  compact?: boolean;
  className?: string;
}

export function TopicProgressBar({
  covered,
  total,
  language,
  compact = false,
  className,
}: TopicProgressBarProps) {
  if (total === 0) return null;

  const isEs = language === 'es';
  const label = isEs
    ? `Temas: ${covered} de ${total}`
    : `Topics: ${covered} of ${total}`;

  if (compact) {
    return (
      <div className={cn('flex items-center px-4 py-2', className)}>
        <span className="text-xs text-muted-foreground font-medium tabular-nums whitespace-nowrap">
          {isEs ? `Temas: ${covered}/${total}` : `Topics: ${covered}/${total}`}
        </span>
      </div>
    );
  }

  const showDots = total <= 12;
  const dotCount = showDots ? total : 12;

  return (
    <div className={cn('flex items-center gap-3 px-4 py-2', className)}>
      {showDots && (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: dotCount }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-colors duration-300',
                i < covered ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      )}
      <span className="text-xs text-muted-foreground font-medium tabular-nums whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
