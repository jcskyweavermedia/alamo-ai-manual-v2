import { MoreHorizontal, Trophy } from 'lucide-react';
import type { StaffMention } from '@/types/reviews';

interface StaffLeaderboardProps {
  title: string;
  staff: StaffMention[];
  icon?: 'more' | 'trophy';
  showViewAll?: boolean;
  viewAllLabel?: string;
  isEs: boolean;
}

function getPositiveColor(percent: number): string {
  if (percent >= 0.90) return '#F97316';
  if (percent >= 0.70) return '#FB923C';
  return '#FDBA74';
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('');
}

export function StaffLeaderboard({
  title,
  staff,
  icon = 'more',
  showViewAll = false,
  viewAllLabel,
  isEs,
}: StaffLeaderboardProps) {
  const maxMentions = staff.length > 0 ? Math.max(...staff.map((s) => s.mentions)) : 0;
  const IconComponent = icon === 'trophy' ? Trophy : MoreHorizontal;

  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-lg font-semibold text-muted-foreground">{title}</p>
        <button
          aria-label={icon === 'trophy' ? 'Trophy' : 'More options'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-1"
        >
          <IconComponent className="w-4 h-4" />
        </button>
      </div>

      {/* Staff rows */}
      <div className="space-y-4" role="list" aria-label={title}>
        {staff.map((s) => {
          const barPct = maxMentions > 0 ? (s.mentions / maxMentions) * 100 : 0;
          const posColor = getPositiveColor(s.positivePercent);
          const posPercent = Math.round(s.positivePercent * 100);

          return (
            <div key={s.name} role="listitem">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                    {getInitials(s.name)}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">{s.name}</span>
                    <span className="text-xs ml-1.5 text-muted-foreground">{s.role}</span>
                  </div>
                  {/* Positive badge */}
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `${posColor}15`,
                      color: posColor,
                    }}
                  >
                    {posPercent}%+
                  </span>
                </div>
                {/* Count */}
                <span
                  className="text-sm font-bold font-mono text-foreground"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {s.mentions}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-3 rounded-[4px] bg-muted overflow-hidden" role="progressbar" aria-valuenow={barPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} ${s.mentions} mentions`}>
                <div
                  className="h-full rounded-[4px] transition-all duration-500 ease-out"
                  style={{ width: `${barPct}%`, background: posColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional footer */}
      {showViewAll && (
        <div className="text-center mt-4 pt-3 border-t border-border">
          <button className="text-sm font-medium text-[#F97316]">
            {viewAllLabel ?? (isEs ? 'Ver Todo el Personal →' : 'View All Staff →')}
          </button>
        </div>
      )}
    </div>
  );
}
