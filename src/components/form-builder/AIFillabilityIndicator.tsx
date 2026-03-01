// =============================================================================
// AIFillabilityIndicator — Circular progress ring with score and issue list
// Reusable component showing AI fillability score with color coding
// =============================================================================

import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIFillabilityIndicatorProps } from '@/types/form-builder';

const STRINGS = {
  en: {
    label: 'AI Fillability',
    issues: 'Issues',
    noIssues: 'No issues found',
    showIssues: 'Show issues',
    hideIssues: 'Hide issues',
  },
  es: {
    label: 'Llenado por IA',
    issues: 'Problemas',
    noIssues: 'Sin problemas encontrados',
    showIssues: 'Mostrar problemas',
    hideIssues: 'Ocultar problemas',
  },
};

function getScoreColor(score: number): {
  stroke: string;
  text: string;
  bg: string;
  label: string;
} {
  if (score < 40) {
    return {
      stroke: '#ef4444',
      text: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-950/30',
      label: 'Low',
    };
  }
  if (score <= 70) {
    return {
      stroke: '#f59e0b',
      text: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      label: 'Medium',
    };
  }
  return {
    stroke: '#22c55e',
    text: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
    label: 'Good',
  };
}

export function AIFillabilityIndicator({
  score,
  issues,
  language,
}: AIFillabilityIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const t = STRINGS[language] || STRINGS.en;
  const colors = getScoreColor(score);

  // SVG circle math
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Circular progress ring */}
      <div className="relative w-[96px] h-[96px]">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 80 80"
          fill="none"
        >
          {/* Background circle */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/30"
          />
          {/* Progress arc */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke={colors.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Score number in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-xl font-bold tabular-nums', colors.text)}>
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            /100
          </span>
        </div>
      </div>

      {/* Label */}
      <p className="text-xs font-medium text-muted-foreground">
        {t.label}
      </p>

      {/* Issues toggle + list */}
      {issues.length > 0 && (
        <div className="w-full">
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'flex items-center gap-1.5 w-full justify-center',
              'text-xs font-medium',
              colors.text,
              'hover:opacity-80 transition-opacity',
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>
              {issues.length} {t.issues.toLowerCase()}
            </span>
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {expanded && (
            <div
              className={cn(
                'mt-2 rounded-xl p-3 space-y-1.5',
                colors.bg,
                'border border-black/[0.04] dark:border-white/[0.06]',
              )}
            >
              {issues.map((issue, i) => (
                <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">
                  {issue}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {issues.length === 0 && (
        <p className="text-[11px] text-green-600 dark:text-green-400 font-medium">
          {t.noIssues}
        </p>
      )}
    </div>
  );
}
