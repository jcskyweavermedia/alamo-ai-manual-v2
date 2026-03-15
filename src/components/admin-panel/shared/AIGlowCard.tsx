// =============================================================================
// AIGlowCard -- AI insight card with orange left border and glow gradient
// =============================================================================

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIGlowCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function AIGlowCard({ title, children, className }: AIGlowCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4',
        'bg-gradient-to-br from-orange-500/[0.06] via-purple-500/[0.04] to-blue-500/[0.03]',
        'border border-orange-500/15 border-l-[3px] border-l-orange-500',
        className,
      )}
    >
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Sparkles
            className="h-4 w-4 text-orange-500"
            style={{ filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.5))' }}
          />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}
