import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ChevronUp, ChevronDown, X } from 'lucide-react';
import type { CocktailProcedureStep } from '@/types/products';

interface CocktailProcedureEditorProps {
  steps: CocktailProcedureStep[];
  onChange: (steps: CocktailProcedureStep[]) => void;
}

/** Auto-renumber steps sequentially starting at 1 */
function renumber(steps: CocktailProcedureStep[]): CocktailProcedureStep[] {
  return steps.map((s, i) => ({ ...s, step: i + 1 }));
}

export function CocktailProcedureEditor({ steps, onChange }: CocktailProcedureEditorProps) {
  const handleAdd = () => {
    onChange([...steps, { step: steps.length + 1, instruction: '' }]);
  };

  const handleRemove = (index: number) => {
    onChange(renumber(steps.filter((_, i) => i !== index)));
  };

  const handleUpdate = (index: number, instruction: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], instruction };
    onChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...steps];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(renumber(updated));
  };

  const handleMoveDown = (index: number) => {
    if (index >= steps.length - 1) return;
    const updated = [...steps];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(renumber(updated));
  };

  return (
    <div className="space-y-3 pt-2">
      {steps.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No steps yet. Add your first step below.
        </p>
      )}

      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-2">
          {/* Step number */}
          <span className="flex-shrink-0 w-6 h-9 flex items-center justify-center text-xs font-medium text-muted-foreground">
            {step.step}.
          </span>

          {/* Instruction input */}
          <Input
            value={step.instruction}
            onChange={(e) => handleUpdate(index, e.target.value)}
            placeholder={`Step ${step.step} instruction...`}
            className="flex-1"
          />

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              title="Move up"
              aria-label="Move step up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleMoveDown(index)}
              disabled={index >= steps.length - 1}
              title="Move down"
              aria-label="Move step down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => handleRemove(index)}
              title="Remove step"
              aria-label="Remove step"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
        <Plus className="h-4 w-4 mr-1.5" />
        Add Step
      </Button>
    </div>
  );
}
