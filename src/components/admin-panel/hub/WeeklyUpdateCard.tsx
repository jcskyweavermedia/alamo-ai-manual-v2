// =============================================================================
// WeeklyUpdateCard -- Clickable card that opens the weekly update overlay
// =============================================================================

import { ClipboardList, ChevronRight } from 'lucide-react';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeeklyUpdateCardProps {
  onClick: () => void;
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeeklyUpdateCard({ onClick, language }: WeeklyUpdateCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between px-5 py-4 cursor-pointer hover:shadow-sm transition-shadow"
      style={{ borderColor: 'hsl(25 95% 53% / 0.25)' }}
    >
      {/* Left: icon + text */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
        >
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-semibold text-sm">{t.weeklyManagerUpdate}</div>
          <div className="text-xs text-muted-foreground">{t.weeklyUpdateDesc}</div>
        </div>
      </div>

      {/* Right: date badge + chevron */}
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
        >
          Mar 12
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
