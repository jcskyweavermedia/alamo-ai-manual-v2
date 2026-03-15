// =============================================================================
// LeaderboardCard -- Knowledge leaderboard with ranks
// =============================================================================

import { Trophy, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';

/** Shape of each leaderboard entry (lighter than full AdminEmployee) */
interface LeaderboardEntry {
  employeeId: string;
  name: string;
  initials: string;
  avatarColor: string;
  points: number;
}

interface LeaderboardCardProps {
  employees: LeaderboardEntry[];
  language: 'en' | 'es';
}

function getRankClasses(rank: number): { circle: string; row: string } {
  switch (rank) {
    case 1:
      return {
        circle: 'bg-orange-500 text-white',
        row: 'bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent',
      };
    case 2:
      return {
        circle: 'bg-gray-500 text-white',
        row: 'bg-gray-500/[0.04] dark:bg-gray-500/[0.06]',
      };
    case 3:
      return {
        circle: 'bg-orange-800 text-white',
        row: 'bg-orange-800/[0.04] dark:bg-orange-800/[0.06]',
      };
    default:
      return {
        circle: 'bg-muted text-muted-foreground',
        row: '',
      };
  }
}

export function LeaderboardCard({ employees, language }: LeaderboardCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">{t.knowledgeLeaderboard}</h3>
          <p className="text-xs text-muted-foreground">{t.thisMonth}</p>
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {employees.map((emp, idx) => {
          const rank = idx + 1;
          const styles = getRankClasses(rank);

          return (
            <div
              key={emp.employeeId}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                styles.row,
              )}
            >
              {/* Rank circle */}
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                  styles.circle,
                )}
              >
                {rank}
              </div>

              {/* Avatar */}
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0',
                  emp.avatarColor,
                )}
              >
                {emp.initials}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
              </div>

              {/* Points */}
              <span className="text-sm font-semibold text-foreground shrink-0">
                {emp.points.toLocaleString()} {t.pts}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <button
        type="button"
        className="flex items-center gap-1 mt-4 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
      >
        {t.viewFullLeaderboard}
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
