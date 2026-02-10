import { cn } from '@/lib/utils';
import { BEER_LIQUOR_SUBCATEGORY_CONFIG, type BeerLiquorSubcategory } from '@/data/mock-beer-liquor';

interface BeerLiquorSubcategoryBadgeProps {
  subcategory: BeerLiquorSubcategory;
  className?: string;
}

export function BeerLiquorSubcategoryBadge({ subcategory, className }: BeerLiquorSubcategoryBadgeProps) {
  const config = BEER_LIQUOR_SUBCATEGORY_CONFIG[subcategory];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5',
        'text-[11px] font-bold uppercase tracking-wide',
        config.light,
        config.dark,
        className
      )}
    >
      {config.label}
    </span>
  );
}
