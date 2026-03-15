// =============================================================================
// RewardBankCard -- Reward usage meters
// =============================================================================

import { Gift } from 'lucide-react';
import type { RewardBankItem } from '@/types/admin-panel';
import { ADMIN_STRINGS } from '../strings';
import { ProgressBar } from '../shared/ProgressBar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RewardBankCardProps {
  rewards: RewardBankItem[];
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RewardBankCard({ rewards, language }: RewardBankCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-orange-500" />
          <h3 className="font-semibold text-sm">{t.rewardBank}</h3>
        </div>
        <button className="text-xs font-medium flex items-center gap-1 text-orange-500 hover:text-orange-600 transition-colors">
          {t.manage}
        </button>
      </div>

      {/* Reward items */}
      <div className="space-y-2.5">
        {rewards.map((reward, i) => {
          const percent = reward.total > 0 ? (reward.used / reward.total) * 100 : 0;

          return (
            <div key={i} className="p-3 rounded-xl bg-muted">
              <div className="flex items-center justify-between">
                <span className="text-sm">{reward.name}</span>
                <div className="text-right">
                  <span className="text-sm font-bold tabular-nums">
                    {reward.used} / {reward.total}
                  </span>
                  <span className="text-xs ml-1 text-muted-foreground">
                    {t.usedThisMonth}
                  </span>
                </div>
              </div>
              <ProgressBar
                value={percent}
                height={4}
                colorClass="bg-orange-500"
                className="mt-2"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
