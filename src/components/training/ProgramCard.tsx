import { Clock, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from './ProgressRing';
import type { ProgramWithProgress } from '@/types/training';

interface ProgramCardProps {
  program: ProgramWithProgress;
  language: 'en' | 'es';
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

export function ProgramCard({ program, language, onClick }: ProgramCardProps) {
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

  return (
    <Card
      className={cn(
        'overflow-hidden transition-shadow duration-200',
        isComingSoon
          ? 'opacity-75 cursor-default'
          : 'cursor-pointer hover:shadow-elevated'
      )}
      onClick={isComingSoon ? undefined : onClick}
    >
      {/* Cover image */}
      <div className="relative h-32 sm:h-36 overflow-hidden">
        {program.coverImage ? (
          <img
            src={program.coverImage}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Coming soon badge */}
        {isComingSoon && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Badge className="bg-white/90 text-black text-xs font-bold px-3 py-1 shadow-md">
              {language === 'es' ? 'PROXIMAMENTE' : 'COMING SOON'}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Category badge */}
        <Badge
          variant="secondary"
          className={cn('text-[10px] font-bold px-2 py-0 border-0', categoryStyle)}
        >
          {categoryLabel}
        </Badge>

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {!isComingSoon && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {courseLabel}
              </span>
            )}
            {timeLabel && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeLabel}
              </span>
            )}
          </div>

          {/* Progress ring (published only) */}
          {!isComingSoon && (
            <ProgressRing percent={program.progressPercent} size={36} strokeWidth={3} />
          )}
        </div>
      </div>
    </Card>
  );
}
