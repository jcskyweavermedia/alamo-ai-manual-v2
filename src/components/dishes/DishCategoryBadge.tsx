import { cn } from '@/lib/utils';
import { DISH_CATEGORY_CONFIG, type DishCategory } from '@/data/mock-dishes';

interface DishCategoryBadgeProps {
  category: DishCategory;
  /** "pill" = colored pill (default), "text" = plain colored text label */
  variant?: 'pill' | 'text';
  className?: string;
}

export function DishCategoryBadge({ category, variant = 'pill', className }: DishCategoryBadgeProps) {
  const config = DISH_CATEGORY_CONFIG[category];

  if (variant === 'text') {
    return (
      <span
        className={cn(
          'text-[10px] font-bold uppercase tracking-wider',
          config.textColor,
          className
        )}
      >
        {config.label}
      </span>
    );
  }

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
