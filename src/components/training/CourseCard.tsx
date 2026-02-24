import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from './ProgressRing';
import type { CourseWithProgress } from '@/types/training';

// Emoji map replacing Lucide icon lookups
const COURSE_EMOJI: Record<string, { emoji: string; bg: string; darkBg: string }> = {
  Landmark:        { emoji: '🏛️', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Beef:            { emoji: '🥩', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  UtensilsCrossed: { emoji: '🍽️', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  Wine:            { emoji: '🍷', bg: 'bg-rose-100',   darkBg: 'dark:bg-rose-900/30' },
  Martini:         { emoji: '🍸', bg: 'bg-sky-100',    darkBg: 'dark:bg-sky-900/30' },
  Beer:            { emoji: '🍺', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  CakeSlice:       { emoji: '🍰', bg: 'bg-pink-100',   darkBg: 'dark:bg-pink-900/30' },
  GraduationCap:   { emoji: '🎓', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  ChefHat:         { emoji: '👨‍🍳', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  Users:           { emoji: '👥', bg: 'bg-indigo-100',  darkBg: 'dark:bg-indigo-900/30' },
  BookOpen:        { emoji: '📖', bg: 'bg-cyan-100',   darkBg: 'dark:bg-cyan-900/30' },
  ClipboardList:   { emoji: '📋', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  Utensils:        { emoji: '🍴', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  Sparkles:        { emoji: '✨', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  Star:            { emoji: '⭐', bg: 'bg-yellow-100', darkBg: 'dark:bg-yellow-900/30' },
  Shield:          { emoji: '🛡️', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Heart:           { emoji: '❤️', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  Flame:           { emoji: '🔥', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  Award:           { emoji: '🏆', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
};
const defaultEmoji = { emoji: '📚', bg: 'bg-slate-100', darkBg: 'dark:bg-slate-800' };

interface CourseCardProps {
  course: CourseWithProgress;
  language: 'en' | 'es';
  onClick: () => void;
}

const STATUS_LABELS = {
  en: {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
  },
  es: {
    not_started: 'Sin Iniciar',
    in_progress: 'En Progreso',
    completed: 'Completado',
  },
} as const;

export function CourseCard({ course, language, onClick }: CourseCardProps) {
  const emojiConfig = COURSE_EMOJI[course.icon ?? ''] ?? defaultEmoji;
  const title = language === 'es' ? course.titleEs : course.titleEn;

  const isCompleted = course.progressPercent === 100;
  const isInProgress = course.progressPercent > 0 && !isCompleted;

  const statusKey = isCompleted
    ? 'completed'
    : isInProgress
      ? 'in_progress'
      : 'not_started';

  const statusLabel = STATUS_LABELS[language][statusKey];

  const sectionLabel = language === 'es'
    ? `${course.totalSections} secciones`
    : `${course.totalSections} section${course.totalSections !== 1 ? 's' : ''}`;

  const timeLabel = course.estimatedMinutes
    ? `~${course.estimatedMinutes} min`
    : '';

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-elevated transition-shadow duration-200',
      )}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
        {/* Emoji tile */}
        <div className={cn(
          'flex items-center justify-center',
          'h-12 w-12 rounded-[12px]',
          emojiConfig.bg, emojiConfig.darkBg,
          isCompleted && 'ring-2 ring-green-500'
        )}>
          <span className="text-[26px] h-[26px] leading-[26px]">{emojiConfig.emoji}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
          {title}
        </h3>

        {/* Progress ring */}
        <ProgressRing percent={course.progressPercent} size={44} strokeWidth={3.5} />

        {/* Meta line */}
        <p className="text-xs text-muted-foreground">
          {sectionLabel}
          {timeLabel && ` \u00B7 ${timeLabel}`}
        </p>

        {/* Status badge */}
        <Badge
          variant={isCompleted ? 'default' : 'secondary'}
          className={cn(
            'text-[10px] px-2 py-0.5',
            isCompleted && 'bg-green-600 hover:bg-green-600',
            isInProgress && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-0'
          )}
        >
          {statusLabel}
        </Badge>
      </CardContent>
    </Card>
  );
}
