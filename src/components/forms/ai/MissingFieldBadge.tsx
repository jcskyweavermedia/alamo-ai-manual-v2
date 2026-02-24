/**
 * MissingFieldBadge
 *
 * Amber dot badge shown next to fields the AI identified as still needed.
 * Tiny, non-intrusive. Bilingual label.
 */

import { cn } from '@/lib/utils';

interface MissingFieldBadgeProps {
  language: 'en' | 'es';
  className?: string;
}

export function MissingFieldBadge({ language, className }: MissingFieldBadgeProps) {
  const label = language === 'es' ? 'Pendiente' : 'Needed';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        'px-1.5 py-0.5 rounded-full',
        'bg-warning/15 dark:bg-warning/10',
        'text-[10px] font-semibold text-warning',
        className,
      )}
      aria-label={language === 'es' ? 'Campo pendiente' : 'Field needed'}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />
      {label}
    </span>
  );
}
