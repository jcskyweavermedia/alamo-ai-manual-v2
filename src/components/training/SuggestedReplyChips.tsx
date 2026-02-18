import { cn } from '@/lib/utils';

interface SuggestedReplyChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
  disabled?: boolean;
}

export function SuggestedReplyChips({ chips, onSelect, disabled = false }: SuggestedReplyChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2 px-1', disabled && 'opacity-50 pointer-events-none')}>
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          disabled={disabled}
          className={cn(
            'inline-flex items-center rounded-full border border-border',
            'px-3 py-1.5 text-sm text-foreground bg-background hover:bg-muted',
            'transition-colors duration-150 active:scale-[0.97]',
            'disabled:opacity-50 disabled:pointer-events-none'
          )}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
