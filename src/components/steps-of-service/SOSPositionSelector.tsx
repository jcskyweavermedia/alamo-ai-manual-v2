import { useState } from 'react';
import { UtensilsCrossed, Wine, Brush, PackageOpen, GlassWater, ChefHat } from 'lucide-react';
import type { SOSPosition } from '@/hooks/use-sos-scroll-viewer';
import { SOS_COURSES, type SOSCourse } from '@/constants/sos-courses';
import { cn } from '@/lib/utils';

interface SOSPositionSelectorProps {
  onSelectPosition: (position: SOSPosition) => void;
  language: 'en' | 'es';
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

function CourseCard({
  course,
  language,
  onSelect,
}: {
  course: SOSCourse;
  language: 'en' | 'es';
  onSelect: (position: SOSPosition) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isEs = language === 'es';
  const label = isEs ? course.labelEs : course.labelEn;
  const description = isEs ? course.descriptionEs : course.descriptionEn;
  const FallbackIcon = FALLBACK_ICONS[course.slug] ?? UtensilsCrossed;
  const is201 = course.level === '201';

  return (
    <button
      type="button"
      disabled={!course.isAvailable}
      onClick={() => course.isAvailable && course.position && onSelect(course.position)}
      className={cn(
        'group flex flex-col rounded-card overflow-hidden',
        'bg-card text-left',
        'shadow-card dark:border dark:border-border/50',
        'transition-all duration-150',
        course.isAvailable
          ? 'cursor-pointer hover:shadow-elevated active:scale-[0.98]'
          : 'cursor-not-allowed'
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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
          /* Gradient placeholder with icon fallback */
          <div
            className={cn(
              'w-full h-full flex items-center justify-center',
              'bg-gradient-to-br from-muted to-muted-foreground/20'
            )}
          >
            <FallbackIcon className="h-10 w-10 text-muted-foreground/60" />
          </div>
        )}

        {/* Coming Soon badge */}
        {!course.isAvailable && (
          <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-rose-500/90 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm dark:bg-rose-600/80">
            {isEs ? 'Próximamente' : 'Coming Soon'}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-wider',
            is201
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-primary dark:text-primary'
          )}
        >
          {is201
            ? (isEs ? 'Avanzado' : 'Advanced')
            : (isEs ? 'Fundamentos' : 'Fundamentals')}
        </span>
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
          {label}
        </h3>
        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {description}
        </p>
      </div>
    </button>
  );
}

export function SOSPositionSelector({
  onSelectPosition,
  language,
}: SOSPositionSelectorProps) {
  const isEs = language === 'es';

  return (
    <div className="flex flex-col items-center px-4 py-8 sm:py-12">
      <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-center">
        {isEs ? 'Manuales FOH' : 'FOH Manuals'}
      </h1>
      <p className="text-sm text-muted-foreground mb-8 text-center">
        {isEs ? 'Guías de servicio por posición' : 'Service guides by position'}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 w-full max-w-2xl">
        {SOS_COURSES.map((course) => (
          <CourseCard
            key={course.slug}
            course={course}
            language={language}
            onSelect={onSelectPosition}
          />
        ))}
      </div>
    </div>
  );
}
