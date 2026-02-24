import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormTemplate } from '@/types/forms';

// =============================================================================
// ICON EMOJI MAP — maps Lucide icon name to an emoji + background color
// Matches the pattern from manual-outline.tsx and CourseCard.tsx
// =============================================================================

const ICON_EMOJI_MAP: Record<string, { emoji: string; bg: string; darkBg: string }> = {
  ClipboardList:   { emoji: '📋', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  AlertTriangle:   { emoji: '⚠️',  bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  FileWarning:     { emoji: '⚠️',  bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  ShieldAlert:     { emoji: '🛡️', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  UserX:           { emoji: '👤', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  FileText:        { emoji: '📄', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Stethoscope:     { emoji: '🩺', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  Wrench:          { emoji: '🔧', bg: 'bg-gray-100',   darkBg: 'dark:bg-gray-800' },
  CheckSquare:     { emoji: '✅',       bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-900/30' },
  Calendar:        { emoji: '📅', bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/30' },
};

const DEFAULT_ICON = { emoji: '📋', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30' };

interface FormCardProps {
  template: FormTemplate;
  language: 'en' | 'es';
  isPinned: boolean;
  onTogglePin: (slug: string) => void;
  onSelect: (slug: string) => void;
}

/**
 * Card component for a form template in the grid.
 * Design: 48x48 icon tile, title, 2-line description, pin button.
 * Matches existing card patterns (rounded-[20px], shadow-card, active:scale-[0.99]).
 */
export function FormCard({
  template,
  language,
  isPinned,
  onTogglePin,
  onSelect,
}: FormCardProps) {
  const title = language === 'es' && template.titleEs ? template.titleEs : template.titleEn;
  const description =
    language === 'es' && template.descriptionEs
      ? template.descriptionEs
      : template.descriptionEn;

  const iconConfig = ICON_EMOJI_MAP[template.icon] ?? DEFAULT_ICON;

  return (
    <button
      type="button"
      onClick={() => onSelect(template.slug)}
      className={cn(
        'group relative flex flex-col',
        'p-5',
        'bg-card rounded-[20px]',
        'border border-black/[0.04] dark:border-white/[0.06]',
        'shadow-card',
        'hover:bg-muted/20 dark:hover:bg-muted/10',
        'active:scale-[0.99]',
        'transition-all duration-150',
        'text-left'
      )}
    >
      {/* Top row: icon tile + pin button */}
      <div className="flex items-start justify-between mb-4">
        {/* Icon tile — 48x48 */}
        <div
          className={cn(
            'flex items-center justify-center shrink-0',
            'w-12 h-12 rounded-[12px]',
            iconConfig.bg,
            iconConfig.darkBg
          )}
        >
          <span className="text-[24px] h-[24px] leading-[24px]">
            {iconConfig.emoji}
          </span>
        </div>

        {/* Pin/bookmark button */}
        <span
          role="button"
          tabIndex={0}
          aria-label={isPinned ? 'Unpin form' : 'Pin form'}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(template.slug);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onTogglePin(template.slug);
            }
          }}
          className={cn(
            'flex items-center justify-center',
            'h-8 w-8 rounded-full',
            'transition-all duration-150',
            isPinned
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          )}
        >
          <Bookmark className="h-4 w-4 fill-current" />
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-2">
        {title}
      </h3>

      {/* Description — 2 lines max */}
      {description && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {description}
        </p>
      )}
    </button>
  );
}
