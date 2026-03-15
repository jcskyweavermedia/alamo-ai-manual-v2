// =============================================================================
// ProgressBar -- Reusable progress bar with track + fill
// =============================================================================

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  height?: number; // px, default 6
  colorClass?: string; // Tailwind bg class, auto-selected if not provided
  trackClass?: string;
  className?: string;
}

function getAutoColor(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 50) return 'bg-blue-500';
  return 'bg-orange-500';
}

export function ProgressBar({
  value,
  height = 6,
  colorClass,
  trackClass,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const fill = colorClass ?? getAutoColor(clamped);

  return (
    <div
      className={cn('bg-muted rounded-full overflow-hidden', trackClass, className)}
      style={{ height }}
    >
      <div
        className={cn('rounded-full transition-all duration-500', fill)}
        style={{ width: `${clamped}%`, height: '100%' }}
      />
    </div>
  );
}
