import { cn } from '@/lib/utils';
import { WINE_STYLE_CONFIG, type WineStyle } from '@/data/mock-wines';

interface WineStyleBadgeProps {
  style: WineStyle;
  className?: string;
}

export function WineStyleBadge({ style, className }: WineStyleBadgeProps) {
  const config = WINE_STYLE_CONFIG[style];

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
