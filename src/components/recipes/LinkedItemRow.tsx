import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AllergenBadge } from './AllergenBadge';

/** Format a scaled quantity for display (trims trailing zeros) */
export function formatScaled(qty: number, multiplier: number): string {
  const val = qty * multiplier;
  return val % 1 === 0 ? String(val) : parseFloat(val.toFixed(2)).toString();
}

interface LinkedItemRowProps {
  name: string;
  quantity?: number;
  unit?: string;
  prepRecipeRef?: string;
  allergens?: string[];
  batchMultiplier?: number;
  onTapPrepRecipe?: (slug: string) => void;
}

export function LinkedItemRow({
  name,
  quantity,
  unit,
  prepRecipeRef,
  allergens,
  batchMultiplier = 1,
  onTapPrepRecipe,
}: LinkedItemRowProps) {
  const isLinked = !!prepRecipeRef;
  const Row = isLinked ? 'button' : 'div';

  const displayQty = quantity != null ? formatScaled(quantity, batchMultiplier) : null;

  return (
    <Row
      {...(isLinked ? {
        type: 'button' as const,
        'aria-label': `View sub-recipe: ${name}`,
        onClick: () => onTapPrepRecipe?.(prepRecipeRef!),
      } : {})}
      className={cn(
        'flex items-baseline gap-2 py-1 px-1 text-sm w-full text-left',
        isLinked && 'rounded-lg cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors'
      )}
    >
      {(quantity || unit) ? (
        <span className="font-mono text-xs text-muted-foreground shrink-0 w-16 text-right tabular-nums">
          {displayQty} {unit}
        </span>
      ) : (
        <span className="shrink-0 w-16" />
      )}
      <span className="flex-1 text-foreground">
        {name}
        {isLinked && (
          <FileText className="inline-block h-3.5 w-3.5 ml-1.5 -mt-0.5 text-emerald-600" aria-hidden="true" />
        )}
      </span>
      {allergens && allergens.length > 0 && (
        <span className="flex gap-1 shrink-0">
          {allergens.map(a => (
            <AllergenBadge key={a} allergen={a as any} />
          ))}
        </span>
      )}
    </Row>
  );
}
