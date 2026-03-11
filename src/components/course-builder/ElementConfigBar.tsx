// =============================================================================
// ElementConfigBar — Floating config bar for element-specific controls
// (variant dropdown, column picker, lead toggle, etc.)
// Visible on hover (desktop) and when selected (mobile).
// =============================================================================

import { cn } from '@/lib/utils';

interface ElementConfigBarProps {
  children: React.ReactNode;
  isSelected?: boolean;
}

export function ElementConfigBar({ children, isSelected = false }: ElementConfigBarProps) {
  return (
    <div
      className={cn(
        'absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg',
        'bg-background/80 backdrop-blur-sm border border-border/50',
        'opacity-0 group-hover/config:opacity-100 transition-opacity',
        isSelected && '!opacity-100',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
