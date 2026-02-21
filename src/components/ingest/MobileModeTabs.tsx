import { cn } from '@/lib/utils';
import type { MobileMode } from '@/types/ingestion';

const MODE_OPTIONS: { value: MobileMode; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'preview', label: 'Preview' },
  { value: 'edit', label: 'Edit' },
];

interface MobileModeTabsProps {
  activeMode: MobileMode;
  onModeChange: (mode: MobileMode) => void;
  className?: string;
}

export function MobileModeTabs({ activeMode, onModeChange, className }: MobileModeTabsProps) {
  return (
    <div className={cn('flex gap-1 rounded-lg bg-muted p-1', className)}>
      {MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onModeChange(opt.value)}
          className={cn(
            'flex-1 min-h-[36px] px-3 rounded-md text-xs font-semibold',
            'transition-colors duration-150',
            activeMode === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
