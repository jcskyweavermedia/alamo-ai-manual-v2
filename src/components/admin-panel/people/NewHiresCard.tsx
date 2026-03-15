// =============================================================================
// NewHiresCard -- Blue-accented card with new hire employees
// =============================================================================

import { UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import { EmployeeRow } from '@/components/admin-panel/shared/EmployeeRow';
import { ProgressBar } from '@/components/admin-panel/shared/ProgressBar';
import type { AdminEmployee } from '@/types/admin-panel';

interface NewHiresCardProps {
  employees: AdminEmployee[];
  language: 'en' | 'es';
  onEmployeeClick?: (id: string) => void;
}

export function NewHiresCard({ employees, language, onEmployeeClick }: NewHiresCardProps) {
  const t = ADMIN_STRINGS[language];
  const newHires = employees.filter((e) => e.isNewHire);

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06]',
        'border-l-[3px] border-l-blue-500',
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t.newHires}</h3>
              <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                {newHires.length} {t.people}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t.newHiresSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="pb-2">
        {newHires.map((emp) => (
          <EmployeeRow
            key={emp.id}
            name={emp.name}
            initials={emp.initials}
            avatarColor={emp.avatarColor}
            subtitle={`${emp.position} \u00B7 ${emp.courseProgress ?? ''}`}
            badge={{ text: emp.tenureLabel, variant: 'new' }}
            onClick={onEmployeeClick ? () => onEmployeeClick(emp.id) : undefined}
            rightContent={
              <div className="flex items-center gap-2 min-w-[100px]">
                <ProgressBar value={emp.overallProgress} className="flex-1" height={5} />
                <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                  {emp.overallProgress}%
                </span>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
