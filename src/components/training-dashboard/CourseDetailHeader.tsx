// =============================================================================
// CourseDetailHeader — Course info card with icon, title, mini stats, progress
// =============================================================================

import { Users, CheckCircle2, BarChart3, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { COURSE_EMOJI, defaultEmoji } from '@/constants/course-emoji';
import type { TrainingCourseItem, TrainingEmployee } from '@/types/dashboard';

const STRINGS = {
  en: {
    enrolled: 'Enrolled',
    completed: 'Completed',
    avgScore: 'Avg Score',
    modules: 'Modules',
    completion: 'Completion',
    noDescription: 'No description available.',
  },
  es: {
    enrolled: 'Inscritos',
    completed: 'Completados',
    avgScore: 'Prom. Calificación',
    modules: 'Módulos',
    completion: 'Finalización',
    noDescription: 'Sin descripción disponible.',
  },
};

interface CourseDetailHeaderProps {
  course: TrainingCourseItem;
  employees: TrainingEmployee[];
  language: 'en' | 'es';
}

export function CourseDetailHeader({ course, employees, language }: CourseDetailHeaderProps) {
  const t = STRINGS[language];
  const emojiConfig = COURSE_EMOJI[course.icon ?? ''] ?? defaultEmoji;
  const title = language === 'es' && course.titleEs ? course.titleEs : course.titleEn;
  const description = language === 'es' && course.descriptionEs
    ? course.descriptionEs
    : course.descriptionEn;

  const completedEmployees = employees.filter(e => e.enrollmentStatus === 'completed').length;

  const stats = [
    {
      label: t.enrolled,
      value: course.enrolledCount,
      icon: Users,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: t.completed,
      value: completedEmployees,
      icon: CheckCircle2,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      label: t.avgScore,
      value: course.avgScore != null ? course.avgScore : '--',
      icon: BarChart3,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      label: t.modules,
      value: course.totalSections,
      icon: BookOpen,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5">
      {/* Header row */}
      <div className="flex items-start gap-4">
        <div className={cn(
          'h-14 w-14 rounded-xl flex items-center justify-center shrink-0',
          emojiConfig.bg,
          emojiConfig.darkBg,
        )}>
          <span className="text-2xl leading-none">{emojiConfig.emoji}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-foreground leading-tight">{title}</h2>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] font-bold px-2 py-0 border-0',
                course.status === 'published'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {course.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {description || t.noDescription}
          </p>
        </div>
      </div>

      {/* Mini stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-2.5">
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.iconBg)}>
                <Icon className={cn('h-4 w-4', stat.iconColor)} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-none">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t.completion}</span>
          <span className="text-xs font-bold text-foreground">{course.completionPercent}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              course.completionPercent >= 80
                ? 'bg-green-500'
                : course.completionPercent >= 50
                  ? 'bg-blue-500'
                  : 'bg-orange-500',
            )}
            style={{ width: `${course.completionPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
