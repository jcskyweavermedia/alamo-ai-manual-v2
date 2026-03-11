import { cn } from '@/lib/utils';
import { resolveIcon } from '@/lib/form-builder/icon-utils';
import type { FilingCabinetResult } from '@/types/forms';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: { untitled: 'Untitled' },
  es: { untitled: 'Sin título' },
} as const;

// =============================================================================
// STATUS BADGE CONFIG
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  submitted:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  archived:
    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  draft:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

// =============================================================================
// RELATIVE TIME FORMATTER
// =============================================================================

function formatRelativeTime(dateString: string, language: 'en' | 'es'): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return language === 'es' ? 'Ahora' : 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface FilingCabinetResultCardProps {
  result: FilingCabinetResult;
  language: 'en' | 'es';
  isSelected?: boolean;
  onClick: () => void;
}

export function FilingCabinetResultCard({
  result,
  language,
  isSelected,
  onClick,
}: FilingCabinetResultCardProps) {
  const t = STRINGS[language];
  const title =
    language === 'es' && result.templateTitleEs
      ? result.templateTitleEs
      : result.templateTitleEn;
  const iconConfig = resolveIcon(
    result.templateIcon ?? 'FileText',
    result.templateIconColor,
  );
  const relativeTime = formatRelativeTime(
    result.submittedAt ?? result.createdAt,
    language,
  );
  const statusLabel =
    result.status.charAt(0).toUpperCase() + result.status.slice(1);

  const primaryText = result.mainFieldValue ?? t.untitled;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'flex items-center gap-3',
        'rounded-xl border p-3',
        'hover:bg-muted/50 active:scale-[0.99]',
        'transition-all cursor-pointer',
        isSelected
          ? 'border-orange-500 bg-orange-500/5'
          : 'border-border/50',
      )}
    >
      {/* Icon tile — 32x32 */}
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          iconConfig.bg,
          iconConfig.darkBg,
        )}
      >
        <span className="text-[16px] h-[16px] leading-[16px]">
          {iconConfig.emoji}
        </span>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Main field value (prominent) */}
        <p className="text-sm font-semibold text-foreground truncate">
          {primaryText}
        </p>

        {/* Line 2: Form title (smaller, muted) */}
        <p className="text-xs text-muted-foreground truncate">
          {title}
        </p>

        {/* Line 3: Filler name + relative time */}
        <p className="text-xs text-muted-foreground/70 truncate">
          {result.filledByName ?? '—'} · {relativeTime}
        </p>
      </div>

      {/* Status badge — right side, vertically centered */}
      <span
        className={cn(
          'shrink-0',
          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
          STATUS_COLORS[result.status] ?? STATUS_COLORS.draft,
        )}
      >
        {statusLabel}
      </span>
    </div>
  );
}
