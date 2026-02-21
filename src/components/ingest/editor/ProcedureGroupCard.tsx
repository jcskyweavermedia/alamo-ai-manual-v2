import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProcedureStepRow } from './ProcedureStepRow';
import type { RecipeProcedureGroup, RecipeProcedureStep } from '@/types/products';

interface ProcedureGroupCardProps {
  group: RecipeProcedureGroup;
  groupIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onRemoveGroup: () => void;
  onMoveGroupUp: () => void;
  onMoveGroupDown: () => void;
  onAddStep: () => void;
  onUpdateStep: (stepIndex: number, step: RecipeProcedureStep) => void;
  onRemoveStep: (stepIndex: number) => void;
  onMoveStepUp: (stepIndex: number) => void;
  onMoveStepDown: (stepIndex: number) => void;
}

export function ProcedureGroupCard({
  group,
  groupIndex,
  isFirst,
  isLast,
  onRename,
  onRemoveGroup,
  onMoveGroupUp,
  onMoveGroupDown,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStepUp,
  onMoveStepDown,
}: ProcedureGroupCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/40">
        <span className={cn(
          'flex items-center justify-center shrink-0',
          'w-6 h-6 rounded-full text-[11px] font-bold',
          'bg-orange-500 text-white'
        )}>
          {groupIndex + 1}
        </span>

        {isEditingName ? (
          <Input
            value={group.group_name}
            onChange={(e) => onRename(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            autoFocus
            className="h-7 text-xs font-semibold flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            className="text-xs font-semibold text-foreground flex-1 text-left hover:underline"
          >
            {group.group_name}
          </button>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            disabled={isFirst}
            onClick={onMoveGroupUp}
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-full transition-colors',
              isFirst
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-background hover:text-foreground'
            )}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={onMoveGroupDown}
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-full transition-colors',
              isLast
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-background hover:text-foreground'
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemoveGroup}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Steps */}
      <div className="px-3 py-2">
        {group.steps.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No steps yet
          </p>
        )}

        {group.steps.map((step, si) => (
          <ProcedureStepRow
            key={si}
            step={step}
            index={si}
            isFirst={si === 0}
            isLast={si === group.steps.length - 1}
            onUpdate={(updated) => onUpdateStep(si, updated)}
            onRemove={() => onRemoveStep(si)}
            onMoveUp={() => onMoveStepUp(si)}
            onMoveDown={() => onMoveStepDown(si)}
          />
        ))}

        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-xs text-muted-foreground"
          onClick={onAddStep}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Step
        </Button>
      </div>
    </div>
  );
}
