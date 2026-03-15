// =============================================================================
// GradesTab — Grade analytics with distribution bars, module scores, table
// =============================================================================

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
  TrainingEmployee,
  SectionScoreData,
  GradeDistribution,
} from '@/types/dashboard';
import { getGradeLabel, getGradeBgColor, getInitials, getAvatarColor } from './utils';

const STRINGS = {
  en: {
    gradeBreakdown: 'Grade Breakdown',
    graded: 'graded',
    avgScore: 'Avg score',
    avgScoreByModule: 'Avg Score by Module',
    gradeTable: 'Grade Details',
    employee: 'Employee',
    role: 'Role',
    score: 'Score',
    grade: 'Grade',
    status: 'Status',
    completed: 'Completed',
    inProgress: 'In Progress',
    notGraded: 'Not Graded',
    noGrades: 'No grades available yet',
    noGradesDesc: 'Grades will appear here once employees complete quizzes.',
    noModules: 'No module scores yet',
  },
  es: {
    gradeBreakdown: 'Distribución de Calificaciones',
    graded: 'calificados',
    avgScore: 'Prom. calificación',
    avgScoreByModule: 'Prom. por Módulo',
    gradeTable: 'Detalle de Calificaciones',
    employee: 'Empleado',
    role: 'Rol',
    score: 'Calificación',
    grade: 'Nota',
    status: 'Estado',
    completed: 'Completado',
    inProgress: 'En Progreso',
    notGraded: 'Sin calificar',
    noGrades: 'No hay calificaciones disponibles',
    noGradesDesc: 'Las calificaciones aparecerán aquí una vez que los empleados completen los cuestionarios.',
    noModules: 'Sin calificaciones de módulos aún',
  },
};

// Grade bucket CSS colors for the horizontal bars
const GRADE_BAR_COLORS: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-blue-500',
  C: 'bg-yellow-500',
  D: 'bg-red-500',
};

const GRADE_DOT_COLORS: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-blue-500',
  C: 'bg-yellow-500',
  D: 'bg-red-500',
};

interface GradesTabProps {
  employees: TrainingEmployee[];
  sectionScores: SectionScoreData[];
  gradeDistribution: GradeDistribution[];
  language: 'en' | 'es';
  isLoading: boolean;
}

export function GradesTab({
  employees,
  sectionScores,
  gradeDistribution,
  language,
  isLoading,
}: GradesTabProps) {
  const t = STRINGS[language];

  const { gradedCount, avgScore } = useMemo(() => {
    const scored = employees.filter(e => e.finalScore != null);
    const avg = scored.length > 0
      ? Math.round(scored.reduce((sum, e) => sum + (e.finalScore ?? 0), 0) / scored.length)
      : 0;
    return { gradedCount: scored.length, avgScore: avg };
  }, [employees]);

  const maxDistCount = useMemo(
    () => Math.max(...gradeDistribution.map(d => d.count), 1),
    [gradeDistribution],
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-4 w-40 bg-muted rounded mb-2" />
            <div className="h-6 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-sm font-medium text-muted-foreground">{t.noGrades}</p>
        <p className="text-xs text-muted-foreground mt-1">{t.noGradesDesc}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t.gradeBreakdown}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {gradedCount} {t.graded} · {t.avgScore} {avgScore}
        </p>
      </div>

      {/* Two-column grid: distribution + module scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Grade distribution — horizontal bars */}
        <div className="bg-muted/30 rounded-xl p-4 border border-black/[0.04] dark:border-white/[0.06]">
          <div className="space-y-3">
            {gradeDistribution.map(bucket => (
              <div key={bucket.label} className="flex items-center gap-3">
                {/* Label + dot */}
                <div className="flex items-center gap-2 w-14 shrink-0">
                  <div className={cn('h-3 w-3 rounded-full', GRADE_DOT_COLORS[bucket.label] ?? 'bg-muted')} />
                  <span className="text-sm font-bold text-foreground">{bucket.label}</span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-6 rounded bg-muted overflow-hidden relative">
                  <div
                    className={cn(
                      'h-full rounded transition-all duration-500',
                      GRADE_BAR_COLORS[bucket.label] ?? 'bg-muted-foreground',
                    )}
                    style={{
                      width: `${maxDistCount > 0 ? (bucket.count / maxDistCount) * 100 : 0}%`,
                      minWidth: bucket.count > 0 ? '24px' : '0',
                    }}
                  />
                </div>

                {/* Count */}
                <span className="text-sm font-semibold text-foreground tabular-nums w-8 text-right">
                  {bucket.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Avg Score by Module */}
        <div className="bg-muted/30 rounded-xl p-4 border border-black/[0.04] dark:border-white/[0.06]">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t.avgScoreByModule}
          </h4>
          {sectionScores.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.noModules}</p>
          ) : (
            <div className="space-y-2.5">
              {sectionScores.map(sec => {
                const title = language === 'es' && sec.titleEs ? sec.titleEs : sec.titleEn;
                const score = sec.avgScore ?? 0;
                return (
                  <div key={sec.sectionId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground font-medium truncate pr-2">
                        {title}
                      </span>
                      <span className="text-xs font-bold text-foreground tabular-nums shrink-0">
                        {sec.avgScore != null ? sec.avgScore : '--'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          score >= 90
                            ? 'bg-green-500'
                            : score >= 80
                              ? 'bg-blue-500'
                              : score >= 70
                                ? 'bg-yellow-500'
                                : 'bg-red-500',
                        )}
                        style={{ width: sec.avgScore != null ? `${sec.avgScore}%` : '0%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grade table */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">{t.gradeTable}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground">{t.employee}</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground hidden sm:table-cell">{t.role}</th>
                <th className="text-right py-2 pr-4 text-xs font-semibold text-muted-foreground">{t.score}</th>
                <th className="text-center py-2 pr-4 text-xs font-semibold text-muted-foreground">{t.grade}</th>
                <th className="text-right py-2 text-xs font-semibold text-muted-foreground">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const name = emp.fullName || emp.email;
                const grade = getGradeLabel(emp.finalScore);
                const initials = getInitials(emp.fullName || emp.email);
                const avatarBg = getAvatarColor(emp.userId);
                const hasScore = emp.finalScore != null;
                const isComplete = emp.enrollmentStatus === 'completed';

                return (
                  <tr key={emp.enrollmentId} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold',
                          avatarBg,
                        )}>
                          {initials}
                        </div>
                        <span className="font-medium text-foreground truncate">{name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground capitalize hidden sm:table-cell">
                      {emp.role}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-bold tabular-nums">
                      {hasScore ? emp.finalScore : '--'}
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      {hasScore ? (
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] font-bold px-1.5 py-0 border-0', getGradeBgColor(grade))}
                        >
                          {grade}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-0 border-0',
                          isComplete
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        )}
                      >
                        {isComplete ? t.completed : hasScore ? t.completed : t.inProgress}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
