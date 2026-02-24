import { useState, useRef, useEffect } from 'react';
import { Bookmark, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from './ProgressRing';
import type { ProgramWithProgress } from '@/types/training';

interface ProgramCardProps {
  program: ProgramWithProgress;
  language: 'en' | 'es';
  pinned?: boolean;
  onTogglePin?: () => void;
  onClick: () => void;
}

const CATEGORY_STYLES: Record<string, string> = {
  fundamentals: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  advanced: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  specialty: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: { fundamentals: 'FUNDAMENTALS', advanced: 'ADVANCED', specialty: 'SPECIALTY' },
  es: { fundamentals: 'FUNDAMENTOS', advanced: 'AVANZADO', specialty: 'ESPECIALIDAD' },
};

export function ProgramCard({ program, language, pinned = false, onTogglePin, onClick }: ProgramCardProps) {
  const isComingSoon = program.status === 'coming_soon';
  const title = language === 'es' && program.titleEs ? program.titleEs : program.titleEn;
  const description = language === 'es' && program.descriptionEs
    ? program.descriptionEs
    : program.descriptionEn;

  const categoryStyle = CATEGORY_STYLES[program.category] ?? CATEGORY_STYLES.fundamentals;
  const categoryLabel = CATEGORY_LABELS[language]?.[program.category] ?? program.category.toUpperCase();

  const courseLabel = language === 'es'
    ? `${program.totalCourses} curso${program.totalCourses !== 1 ? 's' : ''}`
    : `${program.totalCourses} course${program.totalCourses !== 1 ? 's' : ''}`;

  const timeLabel = program.estimatedMinutes > 0
    ? `~${program.estimatedMinutes} min`
    : '';

  // Expand/collapse for description overflow
  const [expanded, setExpanded] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = descRef.current;
    if (el) setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [description]);

  return (
    <button
      type="button"
      onClick={isComingSoon ? undefined : onClick}
      className={cn(
        'group relative flex flex-col',
        'p-5',
        'bg-card rounded-[20px]',
        'border border-black/[0.04] dark:border-white/[0.06]',
        'shadow-card',
        'transition-all duration-150',
        'text-left',
        isComingSoon
          ? 'opacity-75 cursor-default'
          : 'cursor-pointer hover:bg-muted/20 dark:hover:bg-muted/10 active:scale-[0.99]'
      )}
    >
      {/* Cover image tile */}
      <div className="relative w-full aspect-[16/9] rounded-[14px] overflow-hidden mb-3 shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.15),2px_4px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.4),2px_4px_8px_-2px_rgba(0,0,0,0.25)]">
        {program.coverImage ? (
          <img
            src={program.coverImage}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}

        {/* Coming soon overlay */}
        {isComingSoon && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge className="bg-white/90 text-black text-xs font-bold px-3 py-1 shadow-md">
              {language === 'es' ? 'PROXIMAMENTE' : 'COMING SOON'}
            </Badge>
          </div>
        )}
      </div>

      {/* Category badge + bookmark row */}
      <div className="flex items-start gap-2 w-full">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Badge
            variant="secondary"
            className={cn('text-[10px] font-bold px-2 py-0 border-0', categoryStyle)}
          >
            {categoryLabel}
          </Badge>

          {/* Title */}
          <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-1">
            {title}
          </h3>
        </div>

        {/* Bookmark — aligned with badge top */}
        {onTogglePin && (
          <span
            role="button"
            tabIndex={0}
            aria-label={pinned ? 'Remove bookmark' : 'Bookmark program'}
            onClick={e => { e.stopPropagation(); onTogglePin(); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onTogglePin(); } }}
            className={cn(
              'flex items-center justify-center shrink-0',
              'h-8 w-8 rounded-full',
              'transition-all duration-150',
              pinned
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            )}
          >
            <Bookmark className="h-4 w-4 fill-current" />
          </span>
        )}
      </div>

      {/* Description with expand/collapse */}
      {description && (
        <div className="mt-1.5">
          <p
            ref={descRef}
            className={cn(
              'text-xs text-muted-foreground leading-relaxed',
              !expanded && 'line-clamp-3'
            )}
          >
            {description}
          </p>
          {isOverflowing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              className="flex items-center gap-0.5 mt-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              <ChevronDown className={cn(
                'h-3 w-3 transition-transform duration-200',
                expanded && 'rotate-180'
              )} />
              {expanded
                ? (language === 'es' ? 'menos' : 'less')
                : (language === 'es' ? 'más' : 'more')}
            </button>
          )}
        </div>
      )}

      {/* Meta row — anchored to bottom */}
      <div className="flex items-center gap-3 mt-auto pt-3 text-[13px] leading-none text-muted-foreground">
        {!isComingSoon && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[14px] h-[14px] leading-[14px] shrink-0">📖</span>
            <span>{courseLabel}</span>
          </span>
        )}
        {timeLabel && (
          <>
            {!isComingSoon && <span className="text-black/10 dark:text-white/10">·</span>}
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[14px] h-[14px] leading-[14px] shrink-0">🕐</span>
              <span>{timeLabel}</span>
            </span>
          </>
        )}

        {/* Progress ring (published only) */}
        {!isComingSoon && (
          <div className="ml-auto">
            <ProgressRing percent={program.progressPercent} size={36} strokeWidth={3} />
          </div>
        )}
      </div>
    </button>
  );
}
