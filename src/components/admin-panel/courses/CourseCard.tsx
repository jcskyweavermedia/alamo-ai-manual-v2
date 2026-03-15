// =============================================================================
// CourseCard -- Individual course card with colored left border and gradient
// =============================================================================

import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/admin-panel/shared/ProgressBar';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import type { AdminCourse, CourseColorTheme } from '@/types/admin-panel';

interface CourseCardProps {
  course: AdminCourse;
  isSelected: boolean;
  onClick: () => void;
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Color theme maps
// ---------------------------------------------------------------------------

const BORDER_COLORS: Record<CourseColorTheme, string> = {
  blue: 'border-l-blue-500',
  amber: 'border-l-amber-500',
  green: 'border-l-green-600',
  purple: 'border-l-purple-500',
  red: 'border-l-red-500',
  teal: 'border-l-teal-500',
};

const GRADIENT_BG: Record<CourseColorTheme, string> = {
  blue: 'from-blue-50/80 to-card dark:from-blue-950/20',
  amber: 'from-amber-50/80 to-card dark:from-amber-950/20',
  green: 'from-green-50/80 to-card dark:from-green-950/20',
  purple: 'from-purple-50/80 to-card dark:from-purple-950/20',
  red: 'from-red-50/80 to-card dark:from-red-950/20',
  teal: 'from-teal-50/80 to-card dark:from-teal-950/20',
};

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

const PROGRESS_COLOR: Record<CourseColorTheme, string> = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  green: 'bg-green-600',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  teal: 'bg-teal-500',
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

export function CourseCard({ course, isSelected, onClick, language }: CourseCardProps) {
  const t = ADMIN_STRINGS[language];
  const Icon = resolveIcon(course.icon);
  const theme = course.colorTheme;

  const displayName = language === 'es' && course.nameEs ? course.nameEs : course.name;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className={cn(
        'rounded-xl border border-black/[0.04] dark:border-white/[0.06] border-l-[4px] p-4 cursor-pointer transition-all',
        'bg-gradient-to-r',
        BORDER_COLORS[theme],
        GRADIENT_BG[theme],
        isSelected && 'ring-2 ring-orange-500 border-l-orange-500 bg-orange-50/30 dark:bg-orange-950/10',
        !isSelected && 'hover:shadow-sm hover:border-l-orange-400',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
            ICON_BG[theme],
          )}
        >
          <Icon className={cn('h-4 w-4', ICON_COLOR[theme])} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="font-semibold text-sm text-foreground truncate">
              {displayName}
            </span>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
                CATEGORY_BADGE[course.category] ?? 'bg-muted text-muted-foreground',
              )}
            >
              {course.category}
            </span>
          </div>

          {/* Meta */}
          <div className="text-xs text-muted-foreground mb-2">
            {course.department} &middot; {course.modulesCount} {t.modules}
          </div>

          {/* Progress bar */}
          <ProgressBar
            value={course.completionPercent}
            height={6}
            colorClass={PROGRESS_COLOR[theme]}
          />

          {/* Stats */}
          <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {course.completedCount} / {course.enrolledCount}{' '}
              {t.enrolled.toLowerCase()}
            </span>
            <span className="font-medium text-foreground tabular-nums">
              {course.completionPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
