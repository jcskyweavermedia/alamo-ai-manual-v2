import { cn } from '@/lib/utils';
import type { MobileMode } from '@/types/ingestion';

const ALL_MODE_OPTIONS: { value: MobileMode; label: string }[] = [
  { value: 'list',    label: 'List' },
  { value: 'chat',    label: 'Chat' },
  { value: 'preview', label: 'Preview' },
  { value: 'edit',    label: 'Edit' },
];

interface MobileModeTabsProps {
  activeMode: MobileMode;
  onModeChange: (mode: MobileMode) => void;
  /** Restrict which tabs appear. Defaults to ['chat','preview','edit']. */
  modes?: MobileMode[];
  className?: string;
}

export function MobileModeTabs({ activeMode, onModeChange, modes, className }: MobileModeTabsProps) {
  const defaultModes: MobileMode[] = ['chat', 'preview', 'edit'];
  const activeModes = modes ?? defaultModes;
  const options = ALL_MODE_OPTIONS.filter((o) => activeModes.includes(o.value));

  return (
    <div className={cn('flex gap-1 rounded-xl p-1', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onModeChange(opt.value)}
          className={cn(
            'flex-1 min-h-[36px] px-3 rounded-lg text-xs font-semibold',
            'transition-colors duration-150',
            activeMode === opt.value
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
