import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IngredientGroupCard } from './IngredientGroupCard';
import type { RecipeIngredientGroup, RecipeIngredient } from '@/types/products';

interface IngredientsEditorProps {
  groups: RecipeIngredientGroup[];
  currentRecipeSlug?: string;
  onAddGroup: (name?: string) => void;
  onRemoveGroup: (index: number) => void;
  onRenameGroup: (index: number, name: string) => void;
  onMoveGroupUp: (index: number) => void;
  onMoveGroupDown: (index: number) => void;
  onAddIngredient: (groupIndex: number) => void;
  onUpdateIngredient: (groupIndex: number, itemIndex: number, item: RecipeIngredient) => void;
  onRemoveIngredient: (groupIndex: number, itemIndex: number) => void;
  onMoveIngredientUp: (groupIndex: number, itemIndex: number) => void;
  onMoveIngredientDown: (groupIndex: number, itemIndex: number) => void;
}

export function IngredientsEditor({
  groups,
  currentRecipeSlug,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onMoveGroupUp,
  onMoveGroupDown,
  onAddIngredient,
  onUpdateIngredient,
  onRemoveIngredient,
  onMoveIngredientUp,
  onMoveIngredientDown,
}: IngredientsEditorProps) {
  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No ingredient groups yet. Add one to get started.
        </p>
      )}

      {groups.map((group, gi) => (
        <IngredientGroupCard
          key={group._key || gi}
          group={group}
          groupIndex={gi}
          isFirst={gi === 0}
          isLast={gi === groups.length - 1}
          currentRecipeSlug={currentRecipeSlug}
          onRename={(name) => onRenameGroup(gi, name)}
          onRemoveGroup={() => onRemoveGroup(gi)}
          onMoveGroupUp={() => onMoveGroupUp(gi)}
          onMoveGroupDown={() => onMoveGroupDown(gi)}
          onAddIngredient={() => onAddIngredient(gi)}
          onUpdateIngredient={(ii, item) => onUpdateIngredient(gi, ii, item)}
          onRemoveIngredient={(ii) => onRemoveIngredient(gi, ii)}
          onMoveIngredientUp={(ii) => onMoveIngredientUp(gi, ii)}
          onMoveIngredientDown={(ii) => onMoveIngredientDown(gi, ii)}
        />
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onAddGroup()}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Ingredient Group
      </Button>
    </div>
  );
}
