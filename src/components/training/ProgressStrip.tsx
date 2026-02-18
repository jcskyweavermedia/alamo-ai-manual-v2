import { cn } from '@/lib/utils';

interface ProgressStripProps {
  covered: number;
  total: number;
  language?: 'en' | 'es';
  className?: string;
}

export function ProgressStrip({ covered, total, language = 'en', className }: ProgressStripProps) {
  const percent = total > 0 ? Math.round((covered / total) * 100) : 0;
  const label = language === 'es' ? `${covered}/${total} temas` : `${covered}/${total} topics`;

  return (
    <div className={cn('flex items-center gap-3 px-1', className)}>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">{label}</span>
    </div>
  );
}
