// =============================================================================
// SuggestionItem -- Individual AI suggestion card within the suggestions list
// =============================================================================

import {
  Wine,
  Trophy,
  Bell,
  BookOpen,
  Users,
  Clock,
  Gift,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RoleGate } from '@/components/auth/RoleGate';
import type { AISuggestion } from '@/types/admin-panel';

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Wine,
  Trophy,
  Bell,
  BookOpen,
  Users,
  Clock,
  Gift,
  AlertTriangle,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SuggestionItemProps {
  suggestion: AISuggestion;
  language: 'en' | 'es';
  onAction?: (actionLabel: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuggestionItem({ suggestion, onAction }: SuggestionItemProps) {
  const Icon = ICON_MAP[suggestion.icon] ?? BookOpen;

  return (
    <div
      className={cn(
        'p-4 rounded-2xl border',
        suggestion.borderColor ?? 'border-black/[0.04] dark:border-white/[0.06]',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            suggestion.iconBg,
          )}
        >
          <Icon className={cn('h-4 w-4', suggestion.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-1">{suggestion.title}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {suggestion.description}
          </p>

          {/* Avatar stack */}
          {suggestion.avatarStack && suggestion.avatarStack.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex -space-x-1.5">
                {suggestion.avatarStack.map((av, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-card',
                      av.color,
                    )}
                  >
                    {av.initials}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta items */}
          {suggestion.metaItems && suggestion.metaItems.length > 0 && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {suggestion.metaItems.map((meta, i) => {
                const MetaIcon = ICON_MAP[meta.icon] ?? BookOpen;
                return (
                  <span key={i} className="flex items-center gap-1">
                    <MetaIcon className="h-3 w-3" />
                    {meta.text}
                  </span>
                );
              })}
            </div>
          )}

          {/* Action buttons — manager/admin only */}
          <RoleGate allowedRoles={['manager', 'admin']}>
            <div className="flex gap-2 mt-3">
              {suggestion.actions.map((action, i) => {
                const handleClick = () => onAction?.(action.label);
                if (action.variant === 'primary') {
                  return (
                    <button
                      key={i}
                      onClick={handleClick}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                    >
                      {action.label}
                    </button>
                  );
                }
                if (action.variant === 'secondary') {
                  return (
                    <button
                      key={i}
                      onClick={handleClick}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {action.label}
                    </button>
                  );
                }
                // ghost
                return (
                  <button
                    key={i}
                    onClick={handleClick}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          </RoleGate>
        </div>
      </div>
    </div>
  );
}
