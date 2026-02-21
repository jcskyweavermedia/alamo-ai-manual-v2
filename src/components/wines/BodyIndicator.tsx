import { cn } from '@/lib/utils';
import type { WineBody } from '@/types/products';

interface BodyIndicatorProps {
  body: WineBody;
}

export function BodyIndicator({ body }: BodyIndicatorProps) {
  const filled = body === 'light' ? 1 : body === 'medium' ? 2 : 3;
  const label = body.charAt(0).toUpperCase() + body.slice(1);

  return (
    <span className="inline-flex items-center gap-1.5">
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className={cn(
            'inline-block w-2 h-2 rounded-full',
            i <= filled ? 'bg-foreground' : 'bg-border'
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}
