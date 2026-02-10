import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AllergenBadge } from './AllergenBadge';
import type { RecipeIngredientGroup } from '@/types/products';

/** Format a scaled quantity for display (trims trailing zeros) */
function formatScaled(qty: number, multiplier: number): string {
  const val = qty * multiplier;
  return val % 1 === 0 ? String(val) : parseFloat(val.toFixed(2)).toString();
}

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
                'bg-primary text-primary-foreground'
              )}
            >
              {gi + 1}
            </span>
          </div>
          <ul className="space-y-0">
            {group.items.map((item, ii) => {
              const isLinked = !!item.prep_recipe_ref;
              const Row = isLinked ? 'button' : 'div';

              return (
                <li key={ii}>
                  <Row
                    {...(isLinked ? {
                      type: 'button' as const,
                      onClick: () => onTapPrepRecipe?.(item.prep_recipe_ref!),
                    } : {})}
                    className={cn(
                      'flex items-baseline gap-2 py-1 px-1 text-sm w-full text-left',
                      isLinked && 'rounded-lg cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors'
                    )}
                  >
                    {(item.quantity || item.unit) ? (
                      <span className="font-mono text-xs text-muted-foreground shrink-0 w-16 text-right tabular-nums">
                        {formatScaled(item.quantity, batchMultiplier)}{' '}{item.unit}
                      </span>
                    ) : (
                      <span className="shrink-0 w-16" />
                    )}
                    <span className="flex-1 text-foreground">
                      {item.name}
                      {isLinked && (
                        <FileText className="inline-block h-3.5 w-3.5 text-muted-foreground ml-1.5 -mt-0.5" />
                      )}
                    </span>
                    {item.allergens && item.allergens.length > 0 && (
                      <span className="flex gap-1 shrink-0">
                        {item.allergens.map(a => (
                          <AllergenBadge key={a} allergen={a} />
                        ))}
                      </span>
                    )}
                  </Row>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
