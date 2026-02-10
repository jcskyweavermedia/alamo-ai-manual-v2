import { cn } from '@/lib/utils';
import { ALLERGEN_CONFIG, type AllergenType } from '@/data/mock-dishes';

interface DishAllergenBadgeProps {
  allergen: AllergenType;
  className?: string;
}

export function DishAllergenBadge({ allergen, className }: DishAllergenBadgeProps) {
  const config = ALLERGEN_CONFIG[allergen];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-[11px] font-semibold',
        'bg-amber-100 text-amber-900',
        'dark:bg-amber-900/25 dark:text-amber-300',
        className
      )}
    >
      <span className="text-xs">{config.emoji}</span>
      {config.label}
    </span>
  );
}
