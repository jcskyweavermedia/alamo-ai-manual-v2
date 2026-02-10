import { cn } from '@/lib/utils';
import { type Allergen, ALLERGEN_CONFIG } from '@/data/mock-recipes';

interface AllergenBadgeProps {
  allergen: Allergen;
  className?: string;
}

export function AllergenBadge({ allergen, className }: AllergenBadgeProps) {
  const config = ALLERGEN_CONFIG[allergen];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5',
        'text-[11px] font-semibold leading-tight',
        config.color,
        config.darkColor,
        className
      )}
    >
      {config.label}
    </span>
  );
}
