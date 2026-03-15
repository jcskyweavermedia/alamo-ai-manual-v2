// =============================================================================
// ActiveContestCard -- Purple gradient contest mini-card
// =============================================================================

import { Zap, Gift, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import { ProgressBar } from '@/components/admin-panel/shared/ProgressBar';
import type { AdminContest } from '@/types/admin-panel';

interface ActiveContestCardProps {
  contest: AdminContest;
  language: 'en' | 'es';
}

export function ActiveContestCard({ contest, language }: ActiveContestCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div
      className={cn(
        'rounded-2xl p-4',
        'bg-gradient-to-br from-purple-100 via-blue-100 to-purple-50',
        'dark:from-purple-950/30 dark:via-blue-950/30 dark:to-purple-950/20',
        'border border-purple-300/50 dark:border-purple-800/50',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
          {t.activeContest}
        </span>
      </div>

      {/* Contest name */}
      <h4 className="text-sm font-bold text-foreground mb-2">{contest.name}</h4>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {contest.dateRange}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {contest.participants} {t.participants}
        </span>
      </div>

      {/* Prize */}
      <div className="flex items-center gap-1.5 mb-3">
        <Gift className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-medium text-foreground">
          {t.prize}: {contest.prize}
        </span>
      </div>

      {/* Progress */}
      <ProgressBar value={contest.progressPercent} height={5} colorClass="bg-purple-500" />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-muted-foreground">
          {contest.progressPercent}% {t.complete}
        </span>
        <span className="text-[11px] font-medium text-purple-700 dark:text-purple-400">
          {contest.daysLeft} {t.daysLeft}
        </span>
      </div>
    </div>
  );
}
