// =============================================================================
// WhatsNextTimeline -- Vertical timeline with upcoming events
// =============================================================================

import { CalendarClock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimelineItem } from '@/types/admin-panel';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WhatsNextTimelineProps {
  items: TimelineItem[];
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WhatsNextTimeline({ items, language }: WhatsNextTimelineProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-orange-500" />
          <h3 className="font-semibold text-sm">{t.whatsNext}</h3>
        </div>
        <button className="text-xs font-medium flex items-center gap-1 text-orange-500 hover:text-orange-600 transition-colors">
          <Sparkles className="h-3 w-3" />
          {t.generate12MonthPlan}
        </button>
      </div>

      {/* Timeline */}
      <div className="px-5 pb-5">
        <div className="relative pl-6 space-y-4">
          {/* Vertical line */}
          <div
            className="absolute left-[11px] top-1 bottom-1 w-px bg-border"
            aria-hidden="true"
          />

          {items.map((item, idx) => (
            <div key={idx} className="relative">
              {/* Dot */}
              <div
                className={cn(
                  'absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center',
                  item.isActive ? 'bg-orange-500' : 'bg-muted',
                )}
                style={
                  item.isActive
                    ? {
                        animation: 'timeline-pulse 2s ease-in-out infinite',
                      }
                    : undefined
                }
              >
                <div
                  className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    item.isActive ? 'bg-white' : 'bg-muted-foreground',
                  )}
                />
              </div>

              {/* Label */}
              <div
                className={cn(
                  'text-xs font-bold mb-1',
                  item.isActive ? 'text-orange-500' : 'text-foreground',
                )}
              >
                {item.label}
              </div>

              {/* Bullet items */}
              {item.items.map((text, j) => (
                <div key={j} className="text-xs text-muted-foreground">
                  {text}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Pulse keyframes injected via style tag */}
      <style>{`
        @keyframes timeline-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(249, 115, 22, 0); }
        }
      `}</style>
    </div>
  );
}
