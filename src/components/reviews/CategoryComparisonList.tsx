import type { CategoryCompetitor } from '@/types/reviews';

interface CategoryComparisonListProps {
  title: string;
  competitors: CategoryCompetitor[];
  isEs: boolean;
}

export function CategoryComparisonList({
  title,
  competitors,
  isEs,
}: CategoryComparisonListProps) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated">
      <p className="text-lg font-semibold mb-4 text-muted-foreground">{title}</p>
      <div className="space-y-4" role="list" aria-label={title}>
        {competitors.map((c) => {
          const pct = Math.round(c.score * 100);
          return (
            <div key={c.name} role="listitem">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: c.color }}
                  />
                  <span className="text-sm font-semibold text-foreground">{c.name}</span>
                  {c.isOwn && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-[#F97316]">
                      {isEs ? 'Tú' : 'You'}
                    </span>
                  )}
                </div>
                <span
                  className="text-sm font-bold font-mono"
                  style={{ color: c.color, fontVariantNumeric: 'tabular-nums' }}
                >
                  {c.score.toFixed(2)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-3 rounded-[4px] bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} ${c.score.toFixed(2)}`}>
                <div
                  className="h-full rounded-[4px] transition-all duration-500 ease-out"
                  style={{ width: `${pct}%`, background: c.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
