import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Callout } from '@/components/ui/callout';
import type { RecipeProcedureGroup } from '@/types/products';

interface ProcedureColumnProps {
  groups: RecipeProcedureGroup[];
  sectionLabel?: string;
  notes?: { variant: 'tip' | 'info'; title: string; text: string }[];
  className?: string;
}

const STEP_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function ProcedureColumn({ groups, sectionLabel, notes, className }: ProcedureColumnProps) {
  return (
    <div className={cn('space-y-md', className)}>
      <h2 className="text-section-title text-foreground">{sectionLabel ?? 'Procedure'}</h2>

      {groups.map((group, gi) => (
        <div
          key={gi}
          className={cn(
            'rounded-card border border-border/60 overflow-hidden',
            'bg-card dark:bg-card'
          )}
        >
          {/* Group header — number only */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/50 border-b border-border/40">
            <span
              className={cn(
                'flex items-center justify-center shrink-0',
                'w-7 h-7 rounded-full',
                'text-xs font-bold',
                'bg-primary text-primary-foreground'
              )}
            >
              {gi + 1}
            </span>
          </div>

          {/* Lettered sub-steps */}
          <div className="px-3 py-2 space-y-0">
            {group.steps.map((step, si) => (
              <div
                key={si}
                className={cn(
                  'flex gap-2.5 py-1.5',
                  step.critical && 'bg-destructive/[0.06] -mx-3 px-3 border-l-[3px] border-destructive'
                )}
              >
                <span
                  className={cn(
                    'shrink-0 w-5 text-xs font-semibold pt-0.5 text-right',
                    step.critical ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {STEP_LETTERS[si]}.
                </span>

                <span className="flex-1 text-sm text-foreground leading-relaxed">
                  {step.critical && (
                    <AlertTriangle className="inline-block h-3.5 w-3.5 text-destructive mr-1 -mt-0.5" />
                  )}
                  {step.instruction}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {notes && notes.map((note, i) => (
        <Callout key={i} variant={note.variant} title={note.title}>
          {note.text}
        </Callout>
      ))}
    </div>
  );
}
