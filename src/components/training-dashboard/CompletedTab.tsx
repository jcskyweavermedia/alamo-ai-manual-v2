// =============================================================================
// CompletedTab — Completed employees sorted by completedAt, with incomplete section
// =============================================================================

import { useMemo } from 'react';
import { Trophy, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TrainingEmployee } from '@/types/dashboard';
import {
  getInitials,
  getGradeLabel,
  getGradeBgColor,
  getAvatarColor,
  formatShortDate,
  formatRelativeTime,
} from './utils';

const STRINGS = {
  en: {
    completed: 'Completed',
    of: 'of',
    score: 'Score',
    incomplete: 'Incomplete',
    modules: 'modules',
    lastActive: 'Last active',
    noEmployees: 'No employees enrolled yet',
    noEmployeesDesc: 'Completion data will appear here once employees are enrolled.',
    noCompleted: 'No completions yet',
    noCompletedDesc: 'Employees who complete this course will appear here.',
  },
  es: {
    completed: 'Completados',
    of: 'de',
    score: 'Calificación',
    incomplete: 'Incompletos',
    modules: 'módulos',
    lastActive: 'Última actividad',
    noEmployees: 'No hay empleados inscritos',
    noEmployeesDesc: 'Los datos de finalización aparecerán aquí una vez que los empleados se inscriban.',
    noCompleted: 'Sin finalizaciones aún',
    noCompletedDesc: 'Los empleados que completen este curso aparecerán aquí.',
  },
};

interface CompletedTabProps {
  employees: TrainingEmployee[];
  language: 'en' | 'es';
  isLoading: boolean;
}

export function CompletedTab({ employees, language, isLoading }: CompletedTabProps) {
  const t = STRINGS[language];

  const { completed, incomplete } = useMemo(() => {
    const comp = employees
      .filter(e => e.enrollmentStatus === 'completed')
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
      });

    const inc = employees
      .filter(e => e.enrollmentStatus !== 'completed')
      .sort((a, b) => {
        const aTime = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const bTime = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return bTime - aTime;
      });

    return { completed: comp, incomplete: inc };
  }, [employees]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-2 w-48 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-sm font-medium text-muted-foreground">{t.noEmployees}</p>
        <p className="text-xs text-muted-foreground mt-1">{t.noEmployeesDesc}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Completed section */}
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {t.completed} ({completed.length} {t.of} {employees.length})
      </h3>

      {completed.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-xl mb-6">
          <p className="text-sm text-muted-foreground">{t.noCompleted}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.noCompletedDesc}</p>
        </div>
      ) : (
        <div className="space-y-1 mb-6">
          {completed.map(emp => {
            const name = emp.fullName || emp.email;
            const grade = getGradeLabel(emp.finalScore);
            const isTopScorer = (emp.finalScore ?? 0) >= 90;

            return (
              <div
                key={emp.enrollmentId}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors"
              >
                {/* Icon */}
                <div className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                  isTopScorer
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-green-100 dark:bg-green-900/30',
                )}>
                  {isTopScorer ? (
                    <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] font-bold px-1.5 py-0 border-0', getGradeBgColor(grade))}
                    >
                      {grade}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t.completed} {formatShortDate(emp.completedAt)} · {t.score} {emp.finalScore}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Incomplete section */}
      {incomplete.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t.incomplete} ({incomplete.length})
          </h3>
          <div className="space-y-1">
            {incomplete.map(emp => {
              const name = emp.fullName || emp.email;

              return (
                <div
                  key={emp.enrollmentId}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors"
                >
                  {/* Clock icon */}
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate block">
                      {name}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {emp.completedSections} / {emp.totalSections} {t.modules} · {t.lastActive} {formatRelativeTime(emp.lastActiveAt, language)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
