// =============================================================================
// EmployeeOverlayHeader -- Sticky top bar + employee info section
// =============================================================================

import { ArrowLeft, X, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminEmployee } from '@/types/admin-panel';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmployeeOverlayHeaderProps {
  employee: AdminEmployee;
  backLabel: string;
  onClose: () => void;
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeeOverlayHeader({
  employee,
  backLabel,
  onClose,
  language,
}: EmployeeOverlayHeaderProps) {
  const t = ADMIN_STRINGS[language];

  const statCards = [
    { value: employee.avgScore ?? '--', label: t.avgScore },
    { value: employee.grade ?? '--', label: t.grade },
    { value: employee.coursesDone ?? '--', label: t.coursesDone },
    { value: employee.learnSpeed ?? '--', label: t.learnSpeedLabel },
  ];

  return (
    <>
      {/* ----- Sticky top bar ----- */}
      <div className="sticky top-0 z-50 bg-card border-b">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: back button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-orange-500 hover:bg-orange-600 active:scale-[0.96] transition-all flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-muted-foreground">
              {t.backTo} {backLabel}
            </span>
          </div>

          {/* Center: avatar + name + role */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold',
                employee.avatarColor,
              )}
            >
              {employee.initials}
            </div>
            <div>
              <span className="font-semibold text-sm">{employee.name}</span>
              <span className="text-xs ml-2 text-muted-foreground">
                {employee.position} \u00b7 {employee.tenureLabel}
              </span>
            </div>
          </div>

          {/* Right: close X */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ----- Employee info section ----- */}
      <div className="max-w-screen-xl mx-auto px-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-start gap-5 mb-6">
          {/* Left: large avatar + name + badges */}
          <div className="flex items-start gap-4 flex-1">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0',
                employee.avatarColor,
              )}
            >
              {employee.initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{employee.name}</h1>
              <div className="text-sm mt-0.5 text-muted-foreground">
                {employee.position} \u00b7 {language === 'es' ? 'Contratado' : 'Hired'} {employee.hireDate} \u00b7 {employee.tenureLabel}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {employee.isNewHire && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {t.newHires}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  {language === 'es' ? 'Nivel' : 'Tier'}: {employee.tenureLabel}
                </span>
                {employee.leaderboardRank != null && employee.leaderboardPoints != null && (
                  <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100/70 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    <Trophy className="h-3 w-3" />
                    #{employee.leaderboardRank} \u00b7{' '}
                    <span className="tabular-nums">{employee.leaderboardPoints}</span> {t.pts}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: 4 orange stat cards */}
          <div className="grid grid-cols-4 gap-3">
            {statCards.map(({ value, label }) => (
              <div
                key={label}
                className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl px-4 py-3 text-center"
              >
                <div className="text-xl font-bold text-white tabular-nums">{value}</div>
                <div className="text-xs text-white/70">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
