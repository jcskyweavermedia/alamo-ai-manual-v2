// =============================================================================
// NeedsAttentionCard -- Amber-accented card with attention-needed employees
// =============================================================================

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import { EmployeeRow } from '@/components/admin-panel/shared/EmployeeRow';
import type { AdminEmployee } from '@/types/admin-panel';

interface NeedsAttentionCardProps {
  employees: AdminEmployee[];
  language: 'en' | 'es';
  onEmployeeClick?: (id: string) => void;
}

function getAttentionBadgeVariant(
  reason?: string,
): 'danger' | 'warning' | 'default' {
  if (reason === 'Failed Quiz') return 'danger';
  if (reason === 'Overdue' || reason === 'Stalled') return 'warning';
  return 'default';
}

export function NeedsAttentionCard({ employees, language, onEmployeeClick }: NeedsAttentionCardProps) {
  const t = ADMIN_STRINGS[language];
  const attentionList = employees.filter((e) => e.needsAttention);

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06]',
        'border-l-[3px] border-l-amber-500',
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t.needsAttention}</h3>
              <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                {attentionList.length} {t.people}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="pb-2">
        {attentionList.map((emp) => {
          const reasonLabel =
            emp.attentionReason === 'Failed Quiz'
              ? t.failedQuiz
              : emp.attentionReason === 'Overdue'
                ? t.overdue
                : emp.attentionReason === 'Stalled'
                  ? t.stalled
                  : emp.attentionReason ?? '';

          return (
            <EmployeeRow
              key={emp.id}
              name={emp.name}
              initials={emp.initials}
              avatarColor={emp.avatarColor}
              subtitle={emp.attentionDetail}
              badge={{
                text: reasonLabel,
                variant: getAttentionBadgeVariant(emp.attentionReason),
              }}
              onClick={onEmployeeClick ? () => onEmployeeClick(emp.id) : undefined}
              rightContent={
                emp.avgScore != null ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {emp.avgScore}%
                  </span>
                ) : emp.courseProgress ? (
                  <span className="text-xs text-muted-foreground">{emp.courseProgress}</span>
                ) : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}
