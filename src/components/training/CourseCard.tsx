import {
  BookOpen,
  ChefHat,
  GraduationCap,
  ClipboardList,
  Utensils,
  Wine,
  Martini,
  Beer,
  Sparkles,
  Star,
  Shield,
  Users,
  Heart,
  Flame,
  Award,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from './ProgressRing';
import type { CourseWithProgress } from '@/types/training';

// Lookup map for Lucide icons by name
const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  ChefHat,
  GraduationCap,
  ClipboardList,
  Utensils,
  Wine,
  Martini,
  Beer,
  Sparkles,
  Star,
  Shield,
  Users,
  Heart,
  Flame,
  Award,
};

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
  const Icon = ICON_MAP[course.icon] ?? GraduationCap;
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
        isCompleted && 'border-2 border-green-500'
      )}
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
        {/* Icon */}
        <div className={cn(
          'flex items-center justify-center h-12 w-12 rounded-full',
          isCompleted
            ? 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400'
            : 'bg-primary/10 text-primary'
        )}>
          <Icon className="h-6 w-6" />
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
