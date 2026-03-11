// =============================================================================
// PhaseStepIndicator — Vertical N-phase stepper with status icons
// Supports 2 phases now, extensible to N later.
// =============================================================================

import { Check, PenLine, Puzzle, Loader2, AlertCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BuildPhase } from '@/types/course-builder';

const PHASE_ICONS: Record<string, React.ElementType> = {
  structure: FileText,
  content: PenLine,
  assembly: Puzzle,
  layout: Puzzle,
};

interface PhaseStepIndicatorProps {
  phases: BuildPhase[];
}

export function PhaseStepIndicator({ phases }: PhaseStepIndicatorProps) {
  return (
    <div className="flex flex-col gap-1">
      {phases.map((phase, i) => {
        const Icon = PHASE_ICONS[phase.id] || PenLine;
        const isLast = i === phases.length - 1;

        return (
          <div key={phase.id} className="flex items-start gap-3">
            {/* Status icon */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0',
                  phase.status === 'complete' && 'bg-primary border-primary text-primary-foreground',
                  phase.status === 'active' && 'border-primary text-primary animate-pulse',
                  phase.status === 'waiting' && 'border-border text-muted-foreground',
                  phase.status === 'error' && 'border-destructive text-destructive',
                )}
              >
                {phase.status === 'complete' && <Check className="h-3.5 w-3.5" />}
                {phase.status === 'active' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {phase.status === 'waiting' && <Icon className="h-3.5 w-3.5" />}
                {phase.status === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 h-6 mt-1',
                    phase.status === 'complete' ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>

            {/* Label + progress */}
            <div className="pt-1">
              <p
                className={cn(
                  'text-sm font-medium leading-tight',
                  phase.status === 'active' && 'text-foreground',
                  phase.status === 'complete' && 'text-muted-foreground',
                  phase.status === 'waiting' && 'text-muted-foreground',
                  phase.status === 'error' && 'text-destructive',
                )}
              >
                {phase.label}
              </p>
              {phase.status === 'active' && phase.progress && (
                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  {phase.progress.completed} / {phase.progress.total}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
