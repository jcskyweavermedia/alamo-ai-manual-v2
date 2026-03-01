import type { SubCategoryItem } from '@/types/reviews';

interface SubCategoryBreakdownProps {
  title: string;
  items: SubCategoryItem[];
  mentionsLabel: string;
  isEs: boolean;
}

function getTrendColor(trend: string): string {
  if (trend.startsWith('+')) return '#F97316';
  if (trend === '0') return 'hsl(var(--muted-foreground))';
  return '#EA580C';
}

export function SubCategoryBreakdown({
  title,
  items,
  mentionsLabel,
  isEs,
}: SubCategoryBreakdownProps) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated">
      <p className="text-lg font-semibold mb-4 text-muted-foreground">{title}</p>
      <div className="space-y-3" role="list" aria-label={title}>
        {items.map((item) => {
          const label = isEs ? item.name.es : item.name.en;
          const trendColor = getTrendColor(item.trend);
          return (
            <div
              key={item.name.en}
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
              role="listitem"
            >
              <div>
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="text-xs ml-2 text-muted-foreground">
                  {item.mentions} {mentionsLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-semibold"
                  style={{ color: trendColor }}
                >
                  {item.trend}
                </span>
                <span
                  className="text-sm font-bold font-mono text-foreground"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {item.intensity.toFixed(1)}/5
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
