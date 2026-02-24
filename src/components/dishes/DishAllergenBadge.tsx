import { cn } from '@/lib/utils';
import { ALLERGEN_CONFIG, type AllergenType } from '@/data/mock-dishes';

interface DishAllergenBadgeProps {
  allergen: AllergenType;
  className?: string;
}

const FALLBACK_CONFIG = { label: '', emoji: '\u26A0\uFE0F', color: 'bg-gray-500 text-white', darkColor: 'dark:bg-gray-600' };

export function DishAllergenBadge({ allergen, className }: DishAllergenBadgeProps) {
  const config = ALLERGEN_CONFIG[allergen] ?? FALLBACK_CONFIG;
  const label = config.label || allergen;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-[11px] font-semibold capitalize',
        config.color,
        config.darkColor,
        className
      )}
    >
      <span className="text-[14px] h-[14px] leading-[14px] shrink-0">{config.emoji}</span>
      {label}
    </span>
  );
}
