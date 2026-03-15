// =============================================================================
// ModuleRow -- Individual module result row with status-based styling
// =============================================================================

import { useState } from 'react';
import {
  Check,
  AlertTriangle,
  Play,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/admin-panel/shared/ProgressBar';
import type { AdminModuleResult } from '@/types/admin-panel';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';

interface ModuleRowProps {
  module: AdminModuleResult;
  language: 'en' | 'es';
}

// Status configuration for icons and colors
const STATUS_CONFIG = {
  completed: {
    borderClass: 'border-l-green-500',
    bgClass: 'bg-green-50 dark:bg-green-950/20',
    Icon: Check,
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
    scoreColor: 'text-green-600 dark:text-green-400',
    progressColor: 'bg-green-500',
  },
  warning: {
    borderClass: 'border-l-amber-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    Icon: AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    scoreColor: 'text-amber-600 dark:text-amber-400',
    progressColor: 'bg-amber-500',
  },
  in_progress: {
    borderClass: 'border-l-blue-500',
    bgClass: 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800',
    Icon: Play,
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    scoreColor: 'text-blue-600 dark:text-blue-400',
    progressColor: 'bg-blue-500',
  },
  locked: {
    borderClass: 'border-l-muted border-dashed',
    bgClass: 'bg-muted/50 opacity-60',
    Icon: Lock,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    scoreColor: 'text-muted-foreground',
    progressColor: 'bg-muted-foreground/30',
  },
} as const;

export function ModuleRow({ module, language }: ModuleRowProps) {
  const [expanded, setExpanded] = useState(false);
  const t = ADMIN_STRINGS[language];
  const config = STATUS_CONFIG[module.status];
  const { Icon } = config;

  const hasAttemptHistory =
    module.status === 'warning' &&
    module.attemptHistory &&
    module.attemptHistory.length > 1;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-3 p-2.5 rounded-xl border-l-[3px] transition-colors',
          config.borderClass,
          config.bgClass,
          hasAttemptHistory && 'cursor-pointer',
        )}
        onClick={hasAttemptHistory ? () => setExpanded(!expanded) : undefined}
        role={hasAttemptHistory ? 'button' : undefined}
        tabIndex={hasAttemptHistory ? 0 : undefined}
        onKeyDown={
          hasAttemptHistory
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded);
              }
            : undefined
        }
      >
        {/* Status icon */}
        <div
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
            config.iconBg,
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', config.iconColor)} />
        </div>

        {/* Module name */}
        <span
          className={cn(
            'text-sm flex-1 min-w-0 truncate',
            module.status === 'in_progress' && 'font-medium',
            module.status === 'locked' && 'text-muted-foreground',
          )}
        >
          {module.name}
        </span>

        {/* Right side: score or status label */}
        {module.status === 'completed' && module.score != null && (
          <span className={cn('text-xs font-bold tabular-nums', config.scoreColor)}>
            {module.score}
          </span>
        )}

        {module.status === 'warning' && module.score != null && (
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs font-bold tabular-nums', config.scoreColor)}>
              {module.score}
            </span>
            {hasAttemptHistory && (
              expanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
              )
            )}
          </div>
        )}

        {module.status === 'in_progress' && (
          <div className="flex items-center gap-2">
            {module.progressPercent != null && (
              <div className="flex items-center gap-1.5">
                <div className="w-14">
                  <ProgressBar
                    value={module.progressPercent}
                    height={4}
                    colorClass="bg-blue-500"
                  />
                </div>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 tabular-nums">
                  {module.progressPercent}%
                </span>
              </div>
            )}
            {module.progressPercent == null && (
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {t.inProgress}
              </span>
            )}
          </div>
        )}

        {module.status === 'locked' && (
          <span className="text-xs text-muted-foreground">
            {language === 'en' ? 'Locked' : 'Bloqueado'}
          </span>
        )}
      </div>

      {/* Expandable attempt history */}
      {expanded && hasAttemptHistory && module.attemptHistory && (
        <div className="ml-10 mt-1.5 mb-1 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/30">
          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">
            {t.attemptHistory}
          </p>
          <div className="flex items-center gap-2">
            {module.attemptHistory.map((score, i) => (
              <div
                key={i}
                className={cn(
                  'text-xs font-bold tabular-nums px-2 py-0.5 rounded-full',
                  i === module.attemptHistory!.length - 1
                    ? 'bg-amber-200/60 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {score}
              </div>
            ))}
          </div>
          {module.struggleAreas && module.struggleAreas.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              <span className="font-medium text-foreground">{t.struggleWith}:</span>{' '}
              {module.struggleAreas.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
