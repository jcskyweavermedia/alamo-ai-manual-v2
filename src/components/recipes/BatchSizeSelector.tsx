import { cn } from '@/lib/utils';
import { BATCH_OPTIONS } from '@/hooks/use-recipe-viewer';

interface BatchSizeSelectorProps {
  value: number;
  onChange: (multiplier: number) => void;
  className?: string;
}

export function BatchSizeSelector({ value, onChange, className }: BatchSizeSelectorProps) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg bg-muted p-1', className)}>
      {BATCH_OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'min-h-[36px] min-w-[44px] px-2.5 rounded-md',
            'text-xs font-semibold',
            'transition-colors duration-150',
            'active:scale-[0.97]',
            value === opt
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background'
          )}
        >
          {opt}x
        </button>
      ))}
    </div>
  );
}
