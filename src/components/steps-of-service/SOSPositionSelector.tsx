import { useState } from 'react';
import { UtensilsCrossed, Wine, Brush, PackageOpen, GlassWater, ChefHat, Bookmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from '@/components/training/ProgressRing';
import type { SOSPosition } from '@/hooks/use-sos-scroll-viewer';
import { SOS_COURSES, type SOSCourse } from '@/constants/sos-courses';
import { cn } from '@/lib/utils';

interface SOSPositionSelectorProps {
  onSelectPosition: (position: SOSPosition) => void;
  language: 'en' | 'es';
  isPinned: (slug: string) => boolean;
  onTogglePin: (slug: string) => void;
  sortPinnedFirst: <T extends { slug: string }>(items: T[]) => T[];
}

/** Fallback icon per course slug (shown if image fails to load) */
const FALLBACK_ICONS: Record<string, typeof UtensilsCrossed> = {
  'server-101': UtensilsCrossed,
  'bartender-101': GlassWater,
  'busser-101': Brush,
  'barback-101': PackageOpen,
  'wine-201': Wine,
  'food-201': ChefHat,
};

const LEVEL_STYLES: Record<string, string> = {
  '101': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  '201': 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
};

const LEVEL_LABELS: Record<string, Record<string, string>> = {
  en: { '101': 'FUNDAMENTALS', '201': 'ADVANCED' },
  es: { '101': 'FUNDAMENTOS', '201': 'AVANZADO' },
};

function CourseCard({
  course,
  language,
  pinned,
  onSelect,
  onTogglePin,
}: {
  course: SOSCourse;
  language: 'en' | 'es';
  pinned: boolean;
  onSelect: (position: SOSPosition) => void;
  onTogglePin: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isEs = language === 'es';
  const label = isEs ? course.labelEs : course.labelEn;
  const description = isEs ? course.descriptionEs : course.descriptionEn;
  const FallbackIcon = FALLBACK_ICONS[course.slug] ?? UtensilsCrossed;

  const levelStyle = LEVEL_STYLES[course.level] ?? LEVEL_STYLES['101'];
  const levelLabel = LEVEL_LABELS[language]?.[course.level] ?? course.level;

  return (
    <button
      type="button"
      disabled={!course.isAvailable}
      onClick={() => course.isAvailable && course.position && onSelect(course.position)}
      className={cn(
        'group relative flex flex-col',
        'p-5',
        'bg-card rounded-[20px]',
        'border border-black/[0.04] dark:border-white/[0.06]',
        'shadow-card',
        'transition-all duration-150',
        'text-left',
        course.isAvailable
          ? 'cursor-pointer hover:bg-muted/20 dark:hover:bg-muted/10 active:scale-[0.99]'
          : 'opacity-75 cursor-default'
      )}
    >
      {/* Cover image */}
      <div className="relative w-full aspect-[16/9] rounded-[14px] overflow-hidden mb-3 shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.15),2px_4px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.4),2px_4px_8px_-2px_rgba(0,0,0,0.25)]">
        {!imgError ? (
          <img
            src={course.imagePath}
            alt={label}
            loading="lazy"
            onError={() => setImgError(true)}
            className={cn(
              'w-full h-full object-cover transition-transform duration-300',
              course.isAvailable && 'group-hover:scale-105'
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
            <FallbackIcon className="h-10 w-10 text-muted-foreground/60" />
          </div>
        )}

        {/* Coming soon overlay */}
        {!course.isAvailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge className="bg-white/90 text-black text-xs font-bold px-3 py-1 shadow-md">
              {isEs ? 'PRÓXIMAMENTE' : 'COMING SOON'}
            </Badge>
          </div>
        )}
      </div>

      {/* Level badge + bookmark row */}
      <div className="flex items-start gap-2 w-full">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Badge
            variant="secondary"
            className={cn('text-[10px] font-bold px-2 py-0 border-0', levelStyle)}
          >
            {levelLabel}
          </Badge>

          {/* Title */}
          <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-1">
            {label}
          </h3>
        </div>

        {/* Bookmark */}
        <span
          role="button"
          tabIndex={0}
          aria-label={pinned ? 'Remove bookmark' : 'Bookmark manual'}
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
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-3">
          {description}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-auto pt-3 text-[13px] leading-none text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[14px] h-[14px] leading-[14px] shrink-0">📖</span>
          <span>{course.chapters} {isEs ? (course.chapters === 1 ? 'capítulo' : 'capítulos') : (course.chapters === 1 ? 'chapter' : 'chapters')}</span>
        </span>
        <div className="ml-auto">
          <ProgressRing percent={0} size={36} strokeWidth={3} />
        </div>
      </div>
    </button>
  );
}

export function SOSPositionSelector({
  onSelectPosition,
  language,
  isPinned,
  onTogglePin,
  sortPinnedFirst,
}: SOSPositionSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {sortPinnedFirst(SOS_COURSES).map((course) => (
        <CourseCard
          key={course.slug}
          course={course}
          language={language}
          pinned={isPinned(course.slug)}
          onSelect={onSelectPosition}
          onTogglePin={() => onTogglePin(course.slug)}
        />
      ))}
    </div>
  );
}
