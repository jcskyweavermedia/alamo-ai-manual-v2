import { cn } from '@/lib/utils';
import { WINE_STYLE_CONFIG, type WineStyle } from '@/data/mock-wines';

interface WineStyleBadgeProps {
  style: WineStyle;
  /** "pill" = colored pill (default), "text" = plain colored text label */
  variant?: 'pill' | 'text';
  className?: string;
}

export function WineStyleBadge({ style, variant = 'pill', className }: WineStyleBadgeProps) {
  const config = WINE_STYLE_CONFIG[style];

  if (variant === 'text') {
    return (
      <span
        className={cn(
          'text-[10px] font-bold uppercase tracking-wider capitalize',
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
        'text-[11px] font-bold uppercase tracking-wide capitalize',
        config.color,
        config.darkColor,
        className
      )}
    >
      {config.label}
    </span>
  );
}
