// =============================================================================
// ViewModeSwitcher — 3-segment toggle (Source / Editor / Preview)
// Matches segmented control pattern from Recipes filter style
// =============================================================================

import { Eye, Layers, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasViewMode } from '@/types/course-builder';

interface ViewModeSwitcherProps {
  value: CanvasViewMode;
  onChange: (mode: CanvasViewMode) => void;
}

const modes: { key: CanvasViewMode; label: string; icon: typeof Eye }[] = [
  { key: 'source', label: 'Source', icon: FileText },
  { key: 'editor', label: 'Editor', icon: Layers },
  { key: 'preview', label: 'Preview', icon: Eye },
];

export function ViewModeSwitcher({ value, onChange }: ViewModeSwitcherProps) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5 shrink-0">
      {modes.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 h-7 text-xs font-medium transition-all',
            value === key
              ? 'bg-background text-foreground shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
