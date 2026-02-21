import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProcedureGroupCard } from './ProcedureGroupCard';
import type { RecipeProcedureGroup, RecipeProcedureStep } from '@/types/products';

interface ProcedureEditorProps {
  groups: RecipeProcedureGroup[];
  onAddGroup: (name?: string) => void;
  onRemoveGroup: (index: number) => void;
  onRenameGroup: (index: number, name: string) => void;
  onMoveGroupUp: (index: number) => void;
  onMoveGroupDown: (index: number) => void;
  onAddStep: (groupIndex: number) => void;
  onUpdateStep: (groupIndex: number, stepIndex: number, step: RecipeProcedureStep) => void;
  onRemoveStep: (groupIndex: number, stepIndex: number) => void;
  onMoveStepUp: (groupIndex: number, stepIndex: number) => void;
  onMoveStepDown: (groupIndex: number, stepIndex: number) => void;
}

export function ProcedureEditor({
  groups,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onMoveGroupUp,
  onMoveGroupDown,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStepUp,
  onMoveStepDown,
}: ProcedureEditorProps) {
  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No procedure groups yet. Add one to get started.
        </p>
      )}

      {groups.map((group, gi) => (
        <ProcedureGroupCard
          key={gi}
          group={group}
          groupIndex={gi}
          isFirst={gi === 0}
          isLast={gi === groups.length - 1}
          onRename={(name) => onRenameGroup(gi, name)}
          onRemoveGroup={() => onRemoveGroup(gi)}
          onMoveGroupUp={() => onMoveGroupUp(gi)}
          onMoveGroupDown={() => onMoveGroupDown(gi)}
          onAddStep={() => onAddStep(gi)}
          onUpdateStep={(si, step) => onUpdateStep(gi, si, step)}
          onRemoveStep={(si) => onRemoveStep(gi, si)}
          onMoveStepUp={(si) => onMoveStepUp(gi, si)}
          onMoveStepDown={(si) => onMoveStepDown(gi, si)}
        />
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onAddGroup()}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Procedure Phase
      </Button>
    </div>
  );
}
