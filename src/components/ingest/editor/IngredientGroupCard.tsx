import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IngredientItemRow } from './IngredientItemRow';
import type { RecipeIngredientGroup, RecipeIngredient } from '@/types/products';

interface IngredientGroupCardProps {
  group: RecipeIngredientGroup;
  groupIndex: number;
  isFirst: boolean;
  isLast: boolean;
  currentRecipeSlug?: string;
  department?: 'kitchen' | 'bar';
  onRename: (name: string) => void;
  onRemoveGroup: () => void;
  onMoveGroupUp: () => void;
  onMoveGroupDown: () => void;
  onAddIngredient: () => void;
  onUpdateIngredient: (itemIndex: number, item: RecipeIngredient) => void;
  onRemoveIngredient: (itemIndex: number) => void;
  onMoveIngredientUp: (itemIndex: number) => void;
  onMoveIngredientDown: (itemIndex: number) => void;
}

export function IngredientGroupCard({
  group,
  groupIndex,
  isFirst,
  isLast,
  currentRecipeSlug,
  department,
  onRename,
  onRemoveGroup,
  onMoveGroupUp,
  onMoveGroupDown,
  onAddIngredient,
  onUpdateIngredient,
  onRemoveIngredient,
  onMoveIngredientUp,
  onMoveIngredientDown,
}: IngredientGroupCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/40">
        {/* Group number */}
        <span className={cn(
          'flex items-center justify-center shrink-0',
          'w-6 h-6 rounded-full text-[11px] font-bold',
          'bg-orange-500 text-white'
        )}>
          {groupIndex + 1}
        </span>

        {/* Editable group name */}
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

        {/* Reorder + delete */}
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

      {/* Ingredient rows */}
      <div className="px-3 py-2">
        {group.items.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No ingredients yet
          </p>
        )}

        {group.items.map((item, ii) => (
          <IngredientItemRow
            key={item._key || ii}
            item={item}
            index={ii}
            isFirst={ii === 0}
            isLast={ii === group.items.length - 1}
            currentRecipeSlug={currentRecipeSlug}
            department={department}
            onUpdate={(updated) => onUpdateIngredient(ii, updated)}
            onRemove={() => onRemoveIngredient(ii)}
            onMoveUp={() => onMoveIngredientUp(ii)}
            onMoveDown={() => onMoveIngredientDown(ii)}
          />
        ))}

        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-xs text-muted-foreground"
          onClick={onAddIngredient}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Ingredient
        </Button>
      </div>
    </div>
  );
}
