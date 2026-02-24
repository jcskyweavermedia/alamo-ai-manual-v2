import { cn } from '@/lib/utils';
import { LinkedItemRow } from './LinkedItemRow';
import type { RecipeIngredientGroup } from '@/types/products';

interface IngredientsColumnProps {
  groups: RecipeIngredientGroup[];
  batchMultiplier: number;
  onTapPrepRecipe?: (slug: string) => void;
  className?: string;
}

export function IngredientsColumn({ groups, batchMultiplier, onTapPrepRecipe, className }: IngredientsColumnProps) {
  return (
    <div className={cn('space-y-md', className)}>
      <h2 className="text-section-title text-foreground">Ingredients</h2>

      {groups.map((group, gi) => (
        <div key={gi}>
          {/* Numbered group header matching procedure step numbers */}
          <div className="flex items-center gap-2 mb-xs">
            <span
              className={cn(
                'flex items-center justify-center shrink-0',
                'w-6 h-6 rounded-full',
                'text-[11px] font-bold',
                'bg-slate-400 text-white dark:bg-slate-500'
              )}
            >
              {gi + 1}
            </span>
          </div>
          <ul className="space-y-0">
            {group.items.map((item, ii) => (
              <li key={ii}>
                <LinkedItemRow
                  name={item.name}
                  quantity={item.quantity}
                  unit={item.unit}
                  prepRecipeRef={item.prep_recipe_ref}
                  allergens={item.allergens}
                  batchMultiplier={batchMultiplier}
                  onTapPrepRecipe={onTapPrepRecipe}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
