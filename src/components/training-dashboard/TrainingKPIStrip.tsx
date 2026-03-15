// =============================================================================
// TrainingKPIStrip — 4 KPI cards for the Admin Training Dashboard
// =============================================================================

import { Users, CheckCircle2, BarChart3, Award, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrainingKPIs } from '@/types/dashboard';

const STRINGS = {
  en: {
    totalEnrolled: 'Total Enrolled',
    completionRate: 'Completion Rate',
    avgGrade: 'Avg Grade',
    passRate: 'Pass Rate',
    thisWeek: 'this week',
    of: 'of',
    completed: 'completed',
    passed: 'passed',
    noData: 'No data',
  },
  es: {
    totalEnrolled: 'Total Inscritos',
    completionRate: 'Tasa de Finalización',
    avgGrade: 'Calificación Prom.',
    passRate: 'Tasa de Aprobación',
    thisWeek: 'esta semana',
    of: 'de',
    completed: 'completados',
    passed: 'aprobados',
    noData: 'Sin datos',
  },
};

interface TrainingKPIStripProps {
  kpis: TrainingKPIs;
  language: 'en' | 'es';
}

export function TrainingKPIStrip({ kpis, language }: TrainingKPIStripProps) {
  const t = STRINGS[language];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Total Enrolled */}
      <div className={cn(
        'bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-4',
        'flex flex-col gap-2',
      )}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t.totalEnrolled}</span>
          <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-foreground">{kpis.totalEnrolled}</span>
          {kpis.enrolledThisWeek > 0 && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400 mb-0.5">
              <TrendingUp className="h-3 w-3" />
              +{kpis.enrolledThisWeek} {t.thisWeek}
            </span>
          )}
        </div>
      </div>

      {/* Completion Rate */}
      <div className={cn(
        'bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-4',
        'flex flex-col gap-2',
      )}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t.completionRate}</span>
          <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div>
          <span className="text-2xl font-bold text-foreground">{kpis.completionRate}%</span>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${kpis.completionRate}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {kpis.totalCompleted} {t.of} {kpis.totalEnrolled} {t.completed}
          </span>
        </div>
      </div>

      {/* Avg Grade */}
      <div className={cn(
        'bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-4',
        'flex flex-col gap-2',
      )}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t.avgGrade}</span>
          <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">
            {kpis.avgGrade != null ? kpis.avgGrade : '--'}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
      </div>

      {/* Pass Rate */}
      <div className={cn(
        'bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-4',
        'flex flex-col gap-2',
      )}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t.passRate}</span>
          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <div>
          <span className="text-2xl font-bold text-foreground">
            {kpis.passRate != null ? `${kpis.passRate}%` : '--'}
          </span>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            {kpis.passedCount} {t.of} {kpis.totalEnrolled} {t.passed}
          </span>
        </div>
      </div>
    </div>
  );
}
