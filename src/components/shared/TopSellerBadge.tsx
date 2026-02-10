import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopSellerBadgeProps {
  size?: 'icon' | 'sm' | 'md';
  className?: string;
}

export function TopSellerBadge({ size = 'sm', className }: TopSellerBadgeProps) {
  if (size === 'icon') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center',
          'h-6 w-6 rounded-full',
          'bg-yellow-400/90 text-yellow-950',
          'dark:bg-yellow-500/80 dark:text-yellow-950',
          'shadow-sm',
          className
        )}
      >
        <Star className="h-3.5 w-3.5 fill-current" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide',
        'bg-yellow-400/90 text-yellow-950',
        'dark:bg-yellow-500/80 dark:text-yellow-950',
        size === 'sm' && 'px-2 py-0.5 text-[10px]',
        size === 'md' && 'px-2.5 py-0.5 text-[11px]',
        className
      )}
    >
      <Star
        className={cn(
          'fill-current',
          size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
        )}
      />
      Top Seller
    </span>
  );
}
