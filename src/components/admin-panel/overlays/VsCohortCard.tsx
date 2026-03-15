// =============================================================================
// VsCohortCard -- Employee vs cohort comparison with benchmark dots
// =============================================================================

import { cn } from '@/lib/utils';
import { ADMIN_STRINGS } from '../strings';

interface VsCohortCardProps {
  comparisons: { label: string; score: number; cohortAvg: number }[];
  employeeName: string;
  language: 'en' | 'es';
}

function getBarColor(score: number, cohortAvg: number): string {
  if (score >= cohortAvg) return 'bg-green-500';
  if (score >= cohortAvg - 10) return 'bg-amber-500';
  return 'bg-orange-500';
}

function getScoreColor(score: number, cohortAvg: number): string {
  if (score >= cohortAvg) return 'text-green-600 dark:text-green-400';
  return 'text-orange-600 dark:text-orange-400';
}

export function VsCohortCard({ comparisons, employeeName, language }: VsCohortCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider mb-3 text-muted-foreground">
        {employeeName} {t.vsCohortAvg}
      </div>
      <div className="space-y-3">
        {comparisons.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground">{item.label}</span>
              <span>
                <strong className={cn('tabular-nums', getScoreColor(item.score, item.cohortAvg))}>
                  {item.score}
                </strong>{' '}
                <span className="text-muted-foreground">
                  vs <span className="tabular-nums">{item.cohortAvg}</span>
                </span>
              </span>
            </div>
            <div className="flex gap-1 items-center">
              <div className="flex-1 relative">
                <div className="bg-muted rounded-full overflow-hidden" style={{ height: 5 }}>
                  <div
                    className={cn('rounded-full transition-all duration-500', getBarColor(item.score, item.cohortAvg))}
                    style={{ width: `${Math.min(100, item.score)}%`, height: '100%' }}
                  />
                </div>
                {/* Cohort benchmark dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-background bg-muted-foreground"
                  style={{ left: `${Math.min(100, item.cohortAvg)}%`, marginLeft: -5 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
