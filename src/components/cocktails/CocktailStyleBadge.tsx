import { cn } from '@/lib/utils';
import { COCKTAIL_STYLE_CONFIG, type CocktailStyle } from '@/data/mock-cocktails';

interface CocktailStyleBadgeProps {
  style: CocktailStyle;
  /** "pill" = colored pill (default), "text" = plain colored text label */
  variant?: 'pill' | 'text';
  className?: string;
}

export function CocktailStyleBadge({ style, variant = 'pill', className }: CocktailStyleBadgeProps) {
  const config = COCKTAIL_STYLE_CONFIG[style];

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
