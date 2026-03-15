// =============================================================================
// HeroBanner -- Reusable orange gradient hero banner
// =============================================================================

import { cn } from '@/lib/utils';

interface HeroBannerProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  stats: { value: string | number; label: string; highlighted?: boolean }[];
  className?: string;
}

export function HeroBanner({ icon: Icon, title, subtitle, stats, className }: HeroBannerProps) {
  return (
    <div
      className={cn(
        'bg-gradient-to-br from-orange-500 to-orange-600 rounded-[14px] p-6 text-white relative overflow-hidden',
        className,
      )}
    >
      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10">
        {/* Icon + text */}
        <div className="flex items-start gap-4 mb-5">
          <div className="h-[44px] w-[44px] rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">{title}</h2>
            <p className="text-sm text-white/70 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 flex-wrap">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={cn(
                'rounded-xl px-5 py-3 min-w-[80px] text-center',
                stat.highlighted
                  ? 'bg-white/15 border border-white/15'
                  : 'bg-white/10',
              )}
            >
              <div className="text-xl font-bold leading-tight">{stat.value}</div>
              <div className="text-[11px] text-white/70 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
