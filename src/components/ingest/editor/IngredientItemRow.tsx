import { ChevronUp, ChevronDown, X, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { SubRecipeLinker } from './SubRecipeLinker';
import type { RecipeIngredient } from '@/types/products';

const UNITS = ['oz', 'lb', 'g', 'kg', 'cups', 'cup', 'tbsp', 'tsp', 'qt', 'gal', 'L', 'ml', 'ea', 'cloves', 'bunch', 'to taste', ''];

interface IngredientItemRowProps {
  item: RecipeIngredient;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  currentRecipeSlug?: string;
  onUpdate: (item: RecipeIngredient) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function IngredientItemRow({
  item,
  index,
  isFirst,
  isLast,
  currentRecipeSlug,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: IngredientItemRowProps) {
  const isLinked = !!item.prep_recipe_ref;

  const handleLink = (slug: string, name: string) => {
    const currentName = item.name.trim();
    if (currentName && currentName !== name) {
      const confirmed = window.confirm(
        `Replace "${currentName}" with sub-recipe "${name}"?`
      );
      if (!confirmed) return;
    }
    onUpdate({
      ...item,
      name,
      prep_recipe_ref: slug,
      prep_note: item.prep_note || (currentName && currentName !== name ? currentName : undefined),
    });
  };

  const handleUnlink = () => {
    onUpdate({ ...item, prep_recipe_ref: undefined });
  };

  return (
    <div className={cn(
      'flex items-center gap-1.5 py-1 group',
      'min-h-[44px]'
    )}>
      {/* Reorder arrows */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          disabled={isFirst}
          onClick={onMoveUp}
          aria-label="Move ingredient up"
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
          aria-label="Move ingredient down"
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

      {/* Quantity */}
      <Input
        type="number"
        min={0}
        step="any"
        value={item.quantity || ''}
        onChange={(e) => onUpdate({ ...item, quantity: parseFloat(e.target.value) || 0 })}
        placeholder="Qty"
        className="w-16 text-xs"
      />

      {/* Unit */}
      <Select
        value={item.unit}
        onValueChange={(u) => onUpdate({ ...item, unit: u })}
      >
        <SelectTrigger className="w-20 text-xs">
          <SelectValue placeholder="Unit" />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u || '__empty'} value={u || ' '}>
              {u || '(none)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Name — non-editable display when linked, regular input when not */}
      {isLinked ? (
        <div className={cn(
          'flex items-center gap-1.5 flex-1 px-3 py-2 rounded-md text-xs',
          'border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30',
          'text-emerald-800 dark:text-emerald-200'
        )}>
          <Link2 className="h-3 w-3 text-emerald-600 shrink-0" />
          <span className="truncate font-medium">{item.name}</span>
        </div>
      ) : (
        <Input
          value={item.name}
          onChange={(e) => onUpdate({ ...item, name: e.target.value })}
          placeholder="Ingredient name"
          className="flex-1 text-xs"
        />
      )}

      {/* Sub-recipe linker */}
      <SubRecipeLinker
        currentRef={item.prep_recipe_ref}
        currentRefName={isLinked ? item.name : undefined}
        excludeSlug={currentRecipeSlug}
        onLink={handleLink}
        onUnlink={handleUnlink}
      />

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Remove ingredient"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
