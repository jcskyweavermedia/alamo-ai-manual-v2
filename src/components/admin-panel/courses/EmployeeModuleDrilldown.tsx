// =============================================================================
// EmployeeModuleDrilldown -- Module drill-down panel for a selected employee
// =============================================================================

import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/admin-panel/shared/ProgressBar';
import { AIGlowCard } from '@/components/admin-panel/shared/AIGlowCard';
import { ModuleRow } from '@/components/admin-panel/courses/ModuleRow';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import type { AdminCourseEmployee, AdminModuleResult } from '@/types/admin-panel';

interface EmployeeModuleDrilldownProps {
  employee: AdminCourseEmployee;
  modules: AdminModuleResult[];
  aiInsight?: string;
  language: 'en' | 'es';
}

export function EmployeeModuleDrilldown({
  employee,
  modules,
  aiInsight,
  language,
}: EmployeeModuleDrilldownProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5">
      {/* Employee header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Large avatar */}
        <div
          className={cn(
            'rounded-full flex items-center justify-center text-white font-bold shrink-0',
            employee.avatarColor,
          )}
          style={{ width: 48, height: 48, fontSize: 16 }}
        >
          {employee.initials}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-foreground truncate">
              {employee.name}
            </h3>
            <span className="text-xs text-muted-foreground">
              {employee.position}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {employee.modulesCompleted} {t.of} {employee.modulesTotal} {t.modules}
          </p>
        </div>

        {/* Score / completion */}
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold tabular-nums text-orange-500">
            {employee.progressPercent}%
          </div>
          <div className="text-xs text-muted-foreground">{t.complete}</div>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar
        value={employee.progressPercent}
        height={6}
        colorClass="bg-orange-500"
        className="mb-4"
      />

      {/* Module list */}
      <div className="space-y-2">
        {modules.map((mod) => (
          <ModuleRow key={mod.id} module={mod} language={language} />
        ))}
      </div>

      {/* AI insight card */}
      {aiInsight && (
        <AIGlowCard title={t.aiInsight} className="mt-4">
          <p className="text-sm text-muted-foreground">{aiInsight}</p>
        </AIGlowCard>
      )}
    </div>
  );
}
