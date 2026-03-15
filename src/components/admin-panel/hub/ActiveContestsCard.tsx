// =============================================================================
// ActiveContestsCard -- Contest list with "Create Contest" button
// =============================================================================

import { Zap, Plus, Gift, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminContest } from '@/types/admin-panel';
import { ADMIN_STRINGS } from '../strings';
import { ProgressBar } from '../shared/ProgressBar';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Icon map for prize icons
// ---------------------------------------------------------------------------

const PRIZE_ICON_MAP: Record<string, LucideIcon> = {
  Gift,
  Calendar,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActiveContestsCardProps {
  contests: AdminContest[];
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActiveContestsCard({ contests, language }: ActiveContestsCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-purple-500" />
          <h3 className="font-semibold text-sm">{t.activeContests}</h3>
        </div>
        <button className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-orange-500 hover:bg-orange-600 transition-colors flex items-center gap-1">
          <Plus className="h-3 w-3" />
          {t.createContest}
        </button>
      </div>

      {/* Contest items */}
      <div className="px-4 pb-4 space-y-3">
        {contests.map((contest) => {
          const PrizeIcon = contest.prizeIcon
            ? PRIZE_ICON_MAP[contest.prizeIcon] ?? Gift
            : Gift;

          return (
            <div
              key={contest.id}
              className={cn(
                'rounded-2xl p-4',
                'bg-gradient-to-br from-purple-500/[0.06] via-purple-500/[0.03] to-transparent',
                'border border-purple-200/50 dark:border-purple-500/20',
              )}
            >
              {/* Title row */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-sm">{contest.name}</div>
                  <div className="text-xs mt-0.5 text-muted-foreground">
                    {contest.dateRange} · {contest.participants} {t.participants}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium">
                  {t.live}
                </span>
              </div>

              {/* Prize */}
              <div className="flex items-center gap-2 mb-3">
                <PrizeIcon className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-medium">
                  {t.prize}: {contest.prize}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1">
                  <ProgressBar
                    value={contest.progressPercent}
                    height={5}
                    colorClass="bg-purple-500"
                  />
                </div>
                <span className="text-xs font-medium tabular-nums">
                  {contest.progressPercent}%
                </span>
              </div>

              {/* Leader + days left */}
              <div className="text-xs text-muted-foreground">
                {contest.leader && (
                  <>
                    {t.leading}:{' '}
                    <strong className="text-foreground">{contest.leader}</strong>
                    {contest.leaderScore != null && (
                      <> ({contest.leaderScore} {t.pts})</>
                    )}
                    {' · '}
                  </>
                )}
                {contest.daysLeft} {t.daysLeft}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
