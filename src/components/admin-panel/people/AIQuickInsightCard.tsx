// =============================================================================
// AIQuickInsightCard -- AI insight with action buttons
// =============================================================================

import { Send, X } from 'lucide-react';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import { AIGlowCard } from '@/components/admin-panel/shared/AIGlowCard';

interface AIQuickInsightCardProps {
  language: 'en' | 'es';
}

export function AIQuickInsightCard({ language }: AIQuickInsightCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <AIGlowCard title={t.aiInsight}>
      {/* Insight text */}
      <p className="text-sm text-foreground/80 leading-relaxed mb-4">
        {t.aiInsightText}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
        >
          <Send className="h-3 w-3" />
          {t.sendReminder}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent hover:bg-muted text-xs font-medium text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          {t.dismiss}
        </button>
      </div>
    </AIGlowCard>
  );
}
