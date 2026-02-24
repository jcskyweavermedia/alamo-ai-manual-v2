import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlateComponentEditor } from './PlateComponentEditor';
import { AssemblyProcedureEditor } from './AssemblyProcedureEditor';
import { ImagesEditor } from './ImagesEditor';
import { DishGuideEditor } from './DishGuideEditor';
import { useIngestDraft } from '@/contexts/IngestDraftContext';
import type { PlateSpecDraft } from '@/types/ingestion';
import type { RecipeProcedureGroup, RecipeProcedureStep } from '@/types/products';

// =============================================================================
// Constants
// =============================================================================

const PLATE_TYPES = [
  { value: 'entree', label: 'Entree' },
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'side', label: 'Side' },
  { value: 'dessert', label: 'Dessert' },
];

const MENU_CATEGORIES = [
  { value: 'steaks', label: 'Steaks' },
  { value: 'seafood', label: 'Seafood' },
  { value: 'salads', label: 'Salads' },
  { value: 'sides', label: 'Sides' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'appetizers', label: 'Appetizers' },
];

// =============================================================================
// Chip editor for tags / allergens (same pattern as TagEditor)
// =============================================================================

interface ChipFieldProps {
  label: string;
  chips: string[];
  onChange: (chips: string[]) => void;
  placeholder?: string;
}

function ChipField({ label, chips, onChange, placeholder }: ChipFieldProps) {
  const [input, setInput] = useState('');

  const addChip = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !chips.includes(trimmed)) {
      onChange([...chips, trimmed]);
    }
    setInput('');
  };

  const removeChip = (chip: string) => {
    onChange(chips.filter((c) => c !== chip));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(input);
    }
    if (e.key === 'Backspace' && !input && chips.length > 0) {
      removeChip(chips[chips.length - 1]);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className={cn(
        'flex flex-wrap gap-1.5 p-2 min-h-[44px] rounded-md border border-input bg-background',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
      )}>
        {chips.map((chip) => (
          <span
            key={chip}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
              'text-xs font-medium bg-primary/10 text-primary'
            )}
          >
            {chip}
            <button
              type="button"
              onClick={() => removeChip(chip)}
              className="h-3.5 w-3.5 rounded-full flex items-center justify-center hover:bg-primary/20"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input && addChip(input)}
          placeholder={chips.length === 0 ? (placeholder ?? 'Type + Enter to add') : ''}
          className="flex-1 min-w-[100px] border-0 p-0 h-6 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}

// =============================================================================
// PlateSpecEditor (Master Editor)
// =============================================================================

export function PlateSpecEditor() {
  const { state, dispatch } = useIngestDraft();
  const draft = state.draft as PlateSpecDraft;

  // Assembly procedure helpers — map between the editor's callback
  // pattern and the context dispatch pattern for assembly groups
  const handleAddAssemblyGroup = (name?: string) => {
    const newGroup: RecipeProcedureGroup = {
      group_name: name || `Phase ${draft.assemblyProcedure.length + 1}`,
      order: draft.assemblyProcedure.length + 1,
      steps: [],
    };
    dispatch({ type: 'ADD_ASSEMBLY_GROUP', payload: newGroup });
  };

  const handleRemoveAssemblyGroup = (index: number) => {
    dispatch({ type: 'REMOVE_ASSEMBLY_GROUP', payload: index });
  };

  const handleRenameAssemblyGroup = (index: number, name: string) => {
    const group = { ...draft.assemblyProcedure[index], group_name: name };
    dispatch({ type: 'UPDATE_ASSEMBLY_GROUP', payload: { index, group } });
  };

  const handleMoveAssemblyGroupUp = (index: number) => {
    if (index <= 0) return;
    const groups = [...draft.assemblyProcedure];
    [groups[index - 1], groups[index]] = [groups[index], groups[index - 1]];
    dispatch({ type: 'REORDER_ASSEMBLY_GROUPS', payload: groups.map((g, i) => ({ ...g, order: i + 1 })) });
  };

  const handleMoveAssemblyGroupDown = (index: number) => {
    if (index >= draft.assemblyProcedure.length - 1) return;
    const groups = [...draft.assemblyProcedure];
    [groups[index], groups[index + 1]] = [groups[index + 1], groups[index]];
    dispatch({ type: 'REORDER_ASSEMBLY_GROUPS', payload: groups.map((g, i) => ({ ...g, order: i + 1 })) });
  };

  const handleAddAssemblyStep = (groupIndex: number) => {
    const group = draft.assemblyProcedure[groupIndex];
    const updatedGroup: RecipeProcedureGroup = {
      ...group,
      steps: [...group.steps, { step_number: group.steps.length + 1, instruction: '', critical: false }],
    };
    dispatch({ type: 'UPDATE_ASSEMBLY_GROUP', payload: { index: groupIndex, group: updatedGroup } });
  };

  const handleUpdateAssemblyStep = (groupIndex: number, stepIndex: number, step: RecipeProcedureStep) => {
    const group = draft.assemblyProcedure[groupIndex];
    const steps = [...group.steps];
    steps[stepIndex] = step;
    dispatch({ type: 'UPDATE_ASSEMBLY_GROUP', payload: { index: groupIndex, group: { ...group, steps } } });
  };

  const handleRemoveAssemblyStep = (groupIndex: number, stepIndex: number) => {
    const group = draft.assemblyProcedure[groupIndex];
    const steps = group.steps
      .filter((_, i) => i !== stepIndex)
      .map((s, i) => ({ ...s, step_number: i + 1 }));
    dispatch({ type: 'UPDATE_ASSEMBLY_GROUP', payload: { index: groupIndex, group: { ...group, steps } } });
  };

  const handleMoveAssemblyStepUp = (groupIndex: number, stepIndex: number) => {
    if (stepIndex <= 0) return;
    const group = draft.assemblyProcedure[groupIndex];
    const steps = [...group.steps];
    [steps[stepIndex - 1], steps[stepIndex]] = [steps[stepIndex], steps[stepIndex - 1]];
    const renumbered = steps.map((s, i) => ({ ...s, step_number: i + 1 }));
    dispatch({ type: 'UPDATE_ASSEMBLY_GROUP', payload: { index: groupIndex, group: { ...group, steps: renumbered } } });
  };

  const handleMoveAssemblyStepDown = (groupIndex: number, stepIndex: number) => {
    const group = draft.assemblyProcedure[groupIndex];
    if (stepIndex >= group.steps.length - 1) return;
    const steps = [...group.steps];
    [steps[stepIndex], steps[stepIndex + 1]] = [steps[stepIndex + 1], steps[stepIndex]];
    const renumbered = steps.map((s, i) => ({ ...s, step_number: i + 1 }));
    dispatch({ type: 'UPDATE_ASSEMBLY_GROUP', payload: { index: groupIndex, group: { ...group, steps: renumbered } } });
  };

  const defaultSections = ['metadata', 'components', 'assembly', 'notes', 'images'];
  if (draft.dishGuide) defaultSections.push('dish-guide');

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={defaultSections}>
        {/* Metadata */}
        <AccordionItem value="metadata">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Plate Spec Info</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="ps-name">Name</Label>
                <Input
                  id="ps-name"
                  value={draft.name}
                  onChange={(e) => dispatch({ type: 'SET_NAME', payload: e.target.value })}
                  placeholder="e.g. 14oz Prime Ribeye"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ps-plate-type">Plate Type</Label>
                  <Select
                    value={draft.plateType}
                    onValueChange={(v) => dispatch({ type: 'SET_PLATE_TYPE', payload: v })}
                  >
                    <SelectTrigger id="ps-plate-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATE_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ps-menu-category">Menu Category</Label>
                  <Select
                    value={draft.menuCategory}
                    onValueChange={(v) => dispatch({ type: 'SET_MENU_CATEGORY', payload: v })}
                  >
                    <SelectTrigger id="ps-menu-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_CATEGORIES.map((mc) => (
                        <SelectItem key={mc.value} value={mc.value}>{mc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <ChipField
                label="Tags"
                chips={draft.tags}
                onChange={(tags) => dispatch({ type: 'SET_PLATE_TAGS', payload: tags })}
                placeholder="e.g. signature, grilled..."
              />
              <ChipField
                label="Allergens"
                chips={draft.allergens}
                onChange={(allergens) => dispatch({ type: 'SET_PLATE_ALLERGENS', payload: allergens })}
                placeholder="e.g. dairy, gluten..."
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Components */}
        <AccordionItem value="components">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            Components
            {draft.components.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({draft.components.reduce((s, g) => s + g.items.length, 0)} items)
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <PlateComponentEditor
                groups={draft.components}
                onAddGroup={(group) => dispatch({ type: 'ADD_COMPONENT_GROUP', payload: group })}
                onUpdateGroup={(index, group) => dispatch({ type: 'UPDATE_COMPONENT_GROUP', payload: { index, group } })}
                onRemoveGroup={(index) => dispatch({ type: 'REMOVE_COMPONENT_GROUP', payload: index })}
                onReorderGroups={(groups) => dispatch({ type: 'REORDER_COMPONENT_GROUPS', payload: groups })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Assembly Procedure */}
        <AccordionItem value="assembly">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            Assembly / Plating
            {draft.assemblyProcedure.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({draft.assemblyProcedure.reduce((s, g) => s + g.steps.length, 0)} steps)
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <AssemblyProcedureEditor
                groups={draft.assemblyProcedure}
                onAddGroup={handleAddAssemblyGroup}
                onRemoveGroup={handleRemoveAssemblyGroup}
                onRenameGroup={handleRenameAssemblyGroup}
                onMoveGroupUp={handleMoveAssemblyGroupUp}
                onMoveGroupDown={handleMoveAssemblyGroupDown}
                onAddStep={handleAddAssemblyStep}
                onUpdateStep={handleUpdateAssemblyStep}
                onRemoveStep={handleRemoveAssemblyStep}
                onMoveStepUp={handleMoveAssemblyStepUp}
                onMoveStepDown={handleMoveAssemblyStepDown}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Notes */}
        <AccordionItem value="notes">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Notes</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pt-2">
              <Label htmlFor="ps-notes">Plating Notes</Label>
              <Textarea
                id="ps-notes"
                value={draft.notes}
                onChange={(e) => dispatch({ type: 'SET_PLATE_NOTES', payload: e.target.value })}
                placeholder="Special plating instructions, temperature notes..."
                rows={3}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Images */}
        <AccordionItem value="images">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            Images
            {draft.images.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({draft.images.length} photo{draft.images.length !== 1 ? 's' : ''})
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <ImagesEditor productTable="plate_specs" />
          </AccordionContent>
        </AccordionItem>

        {/* Dish Guide (only when generated) */}
        {draft.dishGuide && (
          <AccordionItem value="dish-guide">
            <AccordionTrigger className="text-base font-semibold tracking-tight">
              <span className="flex items-center gap-2">
                FOH Plate Spec
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5',
                  'text-[10px] font-bold uppercase tracking-wide',
                  draft.dishGuideStale
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-emerald-500/10 text-emerald-600'
                )}>
                  {draft.dishGuideStale ? 'Needs Update' : 'Ready'}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <DishGuideEditor />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
