// =============================================================================
// AIFeedbackTab — AI evaluation feedback with summary banner, strengths/areas,
// individual coaching cards
// =============================================================================

import { useMemo } from 'react';
import { Sparkles, ThumbsUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TrainingEmployee, TrainingEvaluation, TrainingCourseItem } from '@/types/dashboard';
import {
  getInitials,
  getGradeLabel,
  getGradeBgColor,
  getAvatarColor,
} from './utils';

const STRINGS = {
  en: {
    aiAnalysis: 'AI Training Analysis',
    summaryLine: (count: number, avg: number | null) =>
      `Analyzed ${count} evaluation${count !== 1 ? 's' : ''}${avg != null ? ` with an average score of ${avg}` : ''}. Here are the key insights.`,
    cohortStrengths: 'Cohort Strengths',
    areasToImprove: 'Areas to Improve',
    individualCoaching: 'Individual AI Coaching',
    topPerformer: 'Top Performer',
    needsAttention: 'Needs Attention',
    noFeedback: 'No AI feedback available yet',
    noFeedbackDesc: 'AI feedback will appear here once employees complete evaluations.',
    inProgress: 'In Progress',
    awaitingEval: 'Awaiting evaluation completion',
    strengths: 'Strengths',
    improvement: 'Areas for Improvement',
  },
  es: {
    aiAnalysis: 'Análisis de Entrenamiento IA',
    summaryLine: (count: number, avg: number | null) =>
      `Se analizaron ${count} evaluación${count !== 1 ? 'es' : ''}${avg != null ? ` con un puntaje promedio de ${avg}` : ''}. Estos son los puntos clave.`,
    cohortStrengths: 'Fortalezas del Grupo',
    areasToImprove: 'Áreas a Mejorar',
    individualCoaching: 'Coaching IA Individual',
    topPerformer: 'Mejor Rendimiento',
    needsAttention: 'Necesita Atención',
    noFeedback: 'No hay retroalimentación IA disponible',
    noFeedbackDesc: 'La retroalimentación IA aparecerá aquí una vez que los empleados completen las evaluaciones.',
    inProgress: 'En Progreso',
    awaitingEval: 'Esperando finalización de evaluación',
    strengths: 'Fortalezas',
    improvement: 'Áreas de Mejora',
  },
};

interface AIFeedbackTabProps {
  course: TrainingCourseItem;
  employees: TrainingEmployee[];
  evaluations: TrainingEvaluation[];
  language: 'en' | 'es';
  isLoading: boolean;
}

export function AIFeedbackTab({
  course,
  employees,
  evaluations,
  language,
  isLoading,
}: AIFeedbackTabProps) {
  const t = STRINGS[language];

  // Aggregate cohort strengths and improvement areas
  const { cohortStrengths, cohortAreas, avgEvalScore, evalsByUser } = useMemo(() => {
    const strengthCounts = new Map<string, number>();
    const areaCounts = new Map<string, number>();
    let totalScore = 0;

    // Group evaluations by user (latest first, so first occurrence = latest)
    const byUser = new Map<string, TrainingEvaluation>();
    for (const ev of evaluations) {
      if (!byUser.has(ev.userId)) {
        byUser.set(ev.userId, ev);
      }
    }

    for (const ev of byUser.values()) {
      totalScore += ev.score;
      for (const s of ev.studentFeedback.strengths) {
        strengthCounts.set(s, (strengthCounts.get(s) ?? 0) + 1);
      }
      for (const a of ev.studentFeedback.areasForImprovement) {
        areaCounts.set(a, (areaCounts.get(a) ?? 0) + 1);
      }
    }

    // Sort by frequency, take top 4
    const sortedStrengths = [...strengthCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([s]) => s);

    const sortedAreas = [...areaCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([a]) => a);

    const avg = byUser.size > 0 ? Math.round(totalScore / byUser.size) : null;

    return {
      cohortStrengths: sortedStrengths,
      cohortAreas: sortedAreas,
      avgEvalScore: avg,
      evalsByUser: byUser,
    };
  }, [evaluations]);

  // Employees with and without evaluations
  const { withEvals, withoutEvals } = useMemo(() => {
    const withE: Array<{ employee: TrainingEmployee; evaluation: TrainingEvaluation }> = [];
    const withoutE: TrainingEmployee[] = [];

    for (const emp of employees) {
      const ev = evalsByUser.get(emp.userId);
      if (ev) {
        withE.push({ employee: emp, evaluation: ev });
      } else {
        withoutE.push(emp);
      }
    }

    // Sort by score descending
    withE.sort((a, b) => b.evaluation.score - a.evaluation.score);

    return { withEvals: withE, withoutEvals: withoutE };
  }, [employees, evalsByUser]);

  const courseTitle = language === 'es' && course.titleEs ? course.titleEs : course.titleEn;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 rounded-xl bg-muted animate-pulse" />
          <div className="h-32 rounded-xl bg-muted animate-pulse" />
        </div>
        {[1, 2].map(i => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (evaluations.length === 0 && employees.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-sm font-medium text-muted-foreground">{t.noFeedback}</p>
        <p className="text-xs text-muted-foreground mt-1">{t.noFeedbackDesc}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* AI Summary Banner */}
      <div className={cn(
        'rounded-xl p-5 relative overflow-hidden',
        'bg-gradient-to-br from-orange-500/90 via-orange-600/90 to-purple-600/90',
        'text-white',
      )}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-2 right-4">
            <Sparkles className="h-20 w-20" />
          </div>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-bold">{t.aiAnalysis}</span>
            <Badge
              variant="secondary"
              className="text-[10px] font-bold px-2 py-0 border-0 bg-white/20 text-white"
            >
              {courseTitle}
            </Badge>
          </div>
          <p className="text-sm text-white/90 leading-relaxed">
            {t.summaryLine(evalsByUser.size, avgEvalScore)}
          </p>
        </div>
      </div>

      {/* Cohort Strengths + Areas to Improve */}
      {(cohortStrengths.length > 0 || cohortAreas.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                {t.cohortStrengths}
              </span>
            </div>
            <ul className="space-y-1.5">
              {cohortStrengths.map((s, i) => (
                <li key={i} className="text-xs text-green-800 dark:text-green-300 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500" />
                  {s}
                </li>
              ))}
              {cohortStrengths.length === 0 && (
                <li className="text-xs text-muted-foreground italic">--</li>
              )}
            </ul>
          </div>

          {/* Areas to Improve */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {t.areasToImprove}
              </span>
            </div>
            <ul className="space-y-1.5">
              {cohortAreas.map((a, i) => (
                <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {a}
                </li>
              ))}
              {cohortAreas.length === 0 && (
                <li className="text-xs text-muted-foreground italic">--</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Individual Coaching Cards */}
      {(withEvals.length > 0 || withoutEvals.length > 0) && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">{t.individualCoaching}</h4>
          <div className="space-y-3">
            {/* Employees with evaluations */}
            {withEvals.map(({ employee: emp, evaluation: ev }) => {
              const name = emp.fullName || emp.email;
              const initials = getInitials(emp.fullName || emp.email);
              const avatarBg = getAvatarColor(emp.userId);
              const grade = getGradeLabel(ev.score);
              const isTopPerformer = ev.score >= 90;
              const needsAttention = ev.score < 75;

              return (
                <div
                  key={emp.enrollmentId}
                  className="rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-card p-4"
                >
                  {/* Employee header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold',
                      avatarBg,
                    )}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{name}</span>
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] font-bold px-1.5 py-0 border-0', getGradeBgColor(grade))}
                        >
                          {grade} · {ev.score}
                        </Badge>
                        {isTopPerformer && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-bold px-1.5 py-0 border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          >
                            {t.topPerformer}
                          </Badge>
                        )}
                        {needsAttention && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-bold px-1.5 py-0 border-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          >
                            {t.needsAttention}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground capitalize">{emp.role}</span>
                    </div>
                  </div>

                  {/* AI feedback bubble */}
                  <div className="ml-13 rounded-lg bg-muted/50 p-3 space-y-2">
                    {ev.studentFeedback.strengths.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 mb-1">
                          {t.strengths}
                        </p>
                        <ul className="space-y-0.5">
                          {ev.studentFeedback.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                              <span className="shrink-0 mt-1 h-1 w-1 rounded-full bg-green-500" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ev.studentFeedback.areasForImprovement.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                          {t.improvement}
                        </p>
                        <ul className="space-y-0.5">
                          {ev.studentFeedback.areasForImprovement.map((a, i) => (
                            <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                              <span className="shrink-0 mt-1 h-1 w-1 rounded-full bg-amber-500" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {ev.studentFeedback.encouragement && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        "{ev.studentFeedback.encouragement}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Employees without evaluations */}
            {withoutEvals.map(emp => {
              const name = emp.fullName || emp.email;
              const initials = getInitials(emp.fullName || emp.email);
              const avatarBg = getAvatarColor(emp.userId);

              return (
                <div
                  key={emp.enrollmentId}
                  className="rounded-xl border border-dashed border-border bg-card/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white/70 text-sm font-bold',
                      avatarBg,
                      'opacity-50',
                    )}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-muted-foreground truncate block">
                        {name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{t.awaitingEval}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-bold px-1.5 py-0 border-0 bg-muted text-muted-foreground"
                    >
                      {t.inProgress}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
