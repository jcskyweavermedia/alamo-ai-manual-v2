import { ChevronUp, ChevronDown, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RecipeProcedureStep } from '@/types/products';

interface ProcedureStepRowProps {
  step: RecipeProcedureStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (step: RecipeProcedureStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function ProcedureStepRow({
  step,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ProcedureStepRowProps) {
  return (
    <div className={cn(
      'flex gap-1.5 py-1.5 group',
      step.critical && 'bg-destructive/[0.06] -mx-3 px-3 border-l-[3px] border-destructive'
    )}>
      {/* Reorder arrows */}
      <div className="flex items-center gap-0.5 shrink-0 pt-1">
        <button
          type="button"
          disabled={isFirst}
          onClick={onMoveUp}
          className={cn(
            'flex items-center justify-center h-6 w-6 rounded-full transition-colors',
            isFirst
              ? 'text-muted-foreground/30 cursor-not-allowed'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={onMoveDown}
          className={cn(
            'flex items-center justify-center h-6 w-6 rounded-full transition-colors',
            isLast
              ? 'text-muted-foreground/30 cursor-not-allowed'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Step number */}
      <span className="text-xs font-semibold text-muted-foreground pt-2 w-5 text-right shrink-0">
        {index + 1}.
      </span>

      {/* Instruction */}
      <Textarea
        value={step.instruction}
        onChange={(e) => onUpdate({ ...step, instruction: e.target.value })}
        placeholder="Step instruction..."
        className="flex-1 min-h-[44px] text-xs resize-none"
        rows={1}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
      />

      {/* Critical toggle */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7 shrink-0',
          step.critical ? 'text-destructive' : 'text-muted-foreground/40 hover:text-destructive/60'
        )}
        onClick={() => onUpdate({ ...step, critical: !step.critical })}
        title={step.critical ? 'Mark as normal' : 'Mark as critical'}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
