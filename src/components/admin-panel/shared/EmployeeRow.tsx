// =============================================================================
// EmployeeRow -- Reusable row used in People lists and Course roster
// =============================================================================

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGradeBgColor } from '@/components/training-dashboard/utils';

interface EmployeeRowProps {
  name: string;
  initials: string;
  avatarColor: string; // Tailwind bg class
  subtitle?: string;
  badge?: { text: string; variant: 'new' | 'warning' | 'danger' | 'default' | 'grade' };
  rightContent?: React.ReactNode;
  compact?: boolean; // smaller avatar + tighter spacing
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

function getBadgeClasses(variant: EmployeeRowProps['badge'] extends infer B ? B extends { variant: infer V } ? V : never : never): string {
  switch (variant) {
    case 'new':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'warning':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'danger':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'grade':
      return ''; // handled separately
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function EmployeeRow({
  name,
  initials,
  avatarColor,
  subtitle,
  badge,
  rightContent,
  compact = false,
  onClick,
  selected = false,
  className,
}: EmployeeRowProps) {
  const avatarSize = compact ? 28 : 36;
  const textSize = 'text-sm';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={cn(
        'flex items-center px-3 py-2 border-l-[3px] border-l-transparent transition-all',
        onClick && 'cursor-pointer hover:bg-muted/50 hover:border-l-orange-500',
        selected && 'bg-orange-50/50 dark:bg-orange-950/20 border-l-orange-500',
        compact ? 'gap-2.5' : 'gap-3',
        className,
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'rounded-full flex items-center justify-center text-white font-semibold shrink-0',
          avatarColor,
        )}
        style={{ width: avatarSize, height: avatarSize, fontSize: compact ? 11 : 13 }}
      >
        {initials}
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(textSize, 'font-medium text-foreground truncate')}>{name}</span>
          {badge && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap',
                badge.variant === 'grade'
                  ? getGradeBgColor(badge.text)
                  : getBadgeClasses(badge.variant),
              )}
            >
              {badge.text}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Right content */}
      {rightContent && <div className="shrink-0">{rightContent}</div>}

      {/* Chevron */}
      {onClick && (
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      )}
    </div>
  );
}
