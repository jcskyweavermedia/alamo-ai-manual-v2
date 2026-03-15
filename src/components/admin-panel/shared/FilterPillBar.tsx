// =============================================================================
// FilterPillBar -- Pill-shaped segmented filter control
// =============================================================================

import { cn } from '@/lib/utils';

interface FilterPillBarProps {
  options: string[];
  activeOption: string;
  onSelect: (option: string) => void;
  className?: string;
}

export function FilterPillBar({
  options,
  activeOption,
  onSelect,
  className,
}: FilterPillBarProps) {
  return (
    <div className={cn('inline-flex bg-muted rounded-full p-0.5 gap-0.5', className)}>
      {options.map((option) => {
        const isActive = option === activeOption;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={cn(
              'px-3.5 py-1 rounded-full text-xs cursor-pointer transition-all',
              isActive
                ? 'bg-background shadow-sm font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
