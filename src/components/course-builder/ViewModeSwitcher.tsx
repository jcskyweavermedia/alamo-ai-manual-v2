// =============================================================================
// ViewModeSwitcher — 4-segment toggle (Source / Editor / Preview / Card)
// Matches segmented control pattern from Recipes filter style.
// L-4: Bilingual labels. ARIA: role=tablist/tab, aria-selected.
// =============================================================================

import { Eye, Layers, FileText, IdCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasViewMode } from '@/types/course-builder';

const LABELS = {
  en: { source: 'Source', editor: 'Editor', preview: 'Preview', card: 'Card' },
  es: { source: 'Fuente', editor: 'Editor', preview: 'Vista previa', card: 'Tarjeta' },
};

interface ViewModeSwitcherProps {
  value: CanvasViewMode;
  onChange: (mode: CanvasViewMode) => void;
  language?: 'en' | 'es';
}

const modes: { key: CanvasViewMode; labelKey: keyof typeof LABELS['en']; icon: typeof Eye }[] = [
  { key: 'source', labelKey: 'source', icon: FileText },
  { key: 'editor', labelKey: 'editor', icon: Layers },
  { key: 'preview', labelKey: 'preview', icon: Eye },
  { key: 'card', labelKey: 'card', icon: IdCard },
];

export function ViewModeSwitcher({ value, onChange, language = 'en' }: ViewModeSwitcherProps) {
  const labels = LABELS[language];

  return (
    <div className="flex rounded-lg bg-muted p-0.5 shrink-0" role="tablist">
      {modes.map(({ key, labelKey, icon: Icon }) => {
        const label = labels[labelKey];
        const isSelected = value === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isSelected}
            title={label}
            onClick={() => onChange(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 h-7 text-xs font-medium transition-all',
              isSelected
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
