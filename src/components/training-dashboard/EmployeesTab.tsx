// =============================================================================
// EmployeesTab — "Recent Activity" tab showing employees sorted by lastActiveAt
// =============================================================================

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TrainingEmployee } from '@/types/dashboard';
import {
  getInitials,
  getGradeLabel,
  getGradeBgColor,
  getAvatarColor,
  formatRelativeTime,
} from './utils';

const STRINGS = {
  en: {
    title: 'Recent Activity',
    subtitle: 'Employees who interacted recently',
    completedModule: 'Completed module',
    of: 'of',
    inProgress: 'In Progress',
    noEmployees: 'No employees enrolled yet',
    noEmployeesDesc: 'Employees will appear here once they enroll in this course.',
  },
  es: {
    title: 'Actividad Reciente',
    subtitle: 'Empleados que interactuaron recientemente',
    completedModule: 'Completó módulo',
    of: 'de',
    inProgress: 'En Progreso',
    noEmployees: 'No hay empleados inscritos',
    noEmployeesDesc: 'Los empleados aparecerán aquí una vez que se inscriban en este curso.',
  },
};

interface EmployeesTabProps {
  employees: TrainingEmployee[];
  language: 'en' | 'es';
  isLoading: boolean;
}

export function EmployeesTab({ employees, language, isLoading }: EmployeesTabProps) {
  const t = STRINGS[language];

  const sorted = useMemo(() => {
    return [...employees].sort((a, b) => {
      const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [employees]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-2 w-48 bg-muted rounded" />
            </div>
            <div className="h-6 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-sm font-medium text-muted-foreground">{t.noEmployees}</p>
        <p className="text-xs text-muted-foreground mt-1">{t.noEmployeesDesc}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t.subtitle}</p>
      </div>

      {/* Employee rows */}
      <div className="space-y-1">
        {sorted.map(emp => {
          const grade = getGradeLabel(emp.finalScore);
          const name = emp.fullName || emp.email;
          const initials = getInitials(emp.fullName || emp.email);
          const avatarBg = getAvatarColor(emp.userId);
          const hasScore = emp.finalScore != null;

          return (
            <div
              key={emp.enrollmentId}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors"
            >
              {/* Avatar */}
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold',
                avatarBg,
              )}>
                {initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {name}
                  </span>
                  {hasScore ? (
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] font-bold px-1.5 py-0 border-0', getGradeBgColor(grade))}
                    >
                      {grade}
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-bold px-1.5 py-0 border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    >
                      {t.inProgress}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-muted-foreground capitalize">{emp.role}</span>
                  <span className="text-black/10 dark:text-white/10">·</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t.completedModule} {emp.completedSections} {t.of} {emp.totalSections}
                  </span>
                  <span className="text-black/10 dark:text-white/10">·</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(emp.lastActiveAt, language)}
                  </span>
                </div>
              </div>

              {/* Score + progress */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {hasScore ? emp.finalScore : `${emp.progressPercent}%`}
                </span>
                <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      emp.progressPercent >= 80
                        ? 'bg-green-500'
                        : emp.progressPercent >= 50
                          ? 'bg-blue-500'
                          : 'bg-orange-500',
                    )}
                    style={{ width: `${emp.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
