import { cn } from '@/lib/utils';
import { COCKTAIL_STYLE_CONFIG, type CocktailStyle } from '@/data/mock-cocktails';

interface CocktailStyleBadgeProps {
  style: CocktailStyle;
  className?: string;
}

export function CocktailStyleBadge({ style, className }: CocktailStyleBadgeProps) {
  const config = COCKTAIL_STYLE_CONFIG[style];

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
