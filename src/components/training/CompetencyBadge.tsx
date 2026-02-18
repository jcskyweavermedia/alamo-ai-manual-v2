import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CompetencyBadgeProps {
  level: 'novice' | 'competent' | 'proficient' | 'expert' | null;
  size?: 'sm' | 'md';
  language: 'en' | 'es';
}

const LEVEL_CONFIG = {
  novice: {
    en: 'Novice',
    es: 'Principiante',
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900',
  },
  competent: {
    en: 'Competent',
    es: 'Competente',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  },
  proficient: {
    en: 'Proficient',
    es: 'Proficiente',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-900',
  },
  expert: {
    en: 'Expert',
    es: 'Experto',
    className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-900',
  },
} as const;

export function CompetencyBadge({ level, size = 'sm', language }: CompetencyBadgeProps) {
  if (!level) {
    return (
      <Badge variant="outline" className={cn('font-normal', size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs')}>
        N/A
      </Badge>
    );
  }

  const config = LEVEL_CONFIG[level];

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium border',
        config.className,
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs'
      )}
    >
      {config[language]}
    </Badge>
  );
}
