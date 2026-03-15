// =============================================================================
// CourseDetailPanel -- Right panel showing selected course details
// =============================================================================

import { useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/admin-panel/shared/ProgressBar';
import { EmployeeRoster } from '@/components/admin-panel/courses/EmployeeRoster';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import type { AdminCourse, CourseColorTheme } from '@/types/admin-panel';

interface CourseDetailPanelProps {
  course: AdminCourse;
  language: 'en' | 'es';
  onEmployeeClick?: (employeeId: string) => void;
}

// ---------------------------------------------------------------------------
// Color theme maps (icon backgrounds / colors)
// ---------------------------------------------------------------------------

const ICON_BG: Record<CourseColorTheme, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/40',
  amber: 'bg-amber-100 dark:bg-amber-900/40',
  green: 'bg-green-100 dark:bg-green-900/40',
  purple: 'bg-purple-100 dark:bg-purple-900/40',
  red: 'bg-red-100 dark:bg-red-900/40',
  teal: 'bg-teal-100 dark:bg-teal-900/40',
};

const ICON_COLOR: Record<CourseColorTheme, string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
  green: 'text-green-600 dark:text-green-400',
  purple: 'text-purple-600 dark:text-purple-400',
  red: 'text-red-600 dark:text-red-400',
  teal: 'text-teal-600 dark:text-teal-400',
};

const DEPT_BADGE: Record<string, string> = {
  FOH: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  BOH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Management: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const CATEGORY_BADGE: Record<string, string> = {
  'New Hire': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FOH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  BOH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

function resolveIcon(name: string): LucideIcons.LucideIcon {
  const icon = (LucideIcons as Record<string, unknown>)[name];
  if (typeof icon === 'function') return icon as LucideIcons.LucideIcon;
  return LucideIcons.BookOpen;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CourseDetailPanel({
  course,
  language,
  onEmployeeClick,
}: CourseDetailPanelProps) {
  const t = ADMIN_STRINGS[language];
  const Icon = resolveIcon(course.icon);
  const theme = course.colorTheme;

  const displayName = language === 'es' && course.nameEs ? course.nameEs : course.name;
  const displayDesc =
    language === 'es' && course.descriptionEs
      ? course.descriptionEs
      : course.description;

  const inProgressCount = useMemo(
    () =>
      course.enrolledEmployees.filter(
        (e) => e.status === 'in_progress' || e.status === 'stuck' || e.status === 'overdue',
      ).length,
    [course.enrolledEmployees],
  );

  const stats = [
    { value: course.enrolledCount, label: t.enrolled },
    { value: course.completedCount, label: t.completed },
    { value: course.avgScore ?? '--', label: t.avgScore },
    { value: inProgressCount, label: t.inProgress },
  ];

  return (
    <div className="space-y-4">
      {/* Course header card */}
      <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5">
        <div className="flex items-center gap-4 mb-4">
          {/* Large icon */}
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
              ICON_BG[theme],
            )}
          >
            <Icon className={cn('h-6 w-6', ICON_COLOR[theme])} />
          </div>

          {/* Title + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                  CATEGORY_BADGE[course.category] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {course.category}
              </span>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                  DEPT_BADGE[course.department] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {course.department}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {course.modulesCount} {t.modules}
              {displayDesc && ` \u00b7 ${displayDesc}`}
            </p>
          </div>
        </div>

        {/* 4-stat grid */}
        <div className="grid grid-cols-4 gap-3 pt-3 border-t border-border">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-lg font-bold tabular-nums text-orange-500">
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Completion progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">{t.completion}</span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {course.completionPercent}%
            </span>
          </div>
          <ProgressBar value={course.completionPercent} height={6} colorClass="bg-orange-500" />
        </div>
      </div>

      {/* Employee roster */}
      <EmployeeRoster
        employees={course.enrolledEmployees}
        language={language}
        onEmployeeClick={onEmployeeClick}
      />
    </div>
  );
}
