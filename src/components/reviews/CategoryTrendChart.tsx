import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { CategoryTrendDataPoint } from '@/types/reviews';

interface CategoryTrendChartProps {
  title: string;
  data: CategoryTrendDataPoint[];
  restaurants: { name: string; color: string; isOwn?: boolean }[];
  isEs: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2.5 text-xs shadow-lg"
      style={{ background: '#141418', color: '#F5F5F7' }}
    >
      <p className="font-medium mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-[11px]">{entry.dataKey}</span>
          <span className="font-mono font-bold ml-auto">{(entry.value as number).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function CategoryTrendChart({
  title,
  data,
  restaurants,
  isEs,
}: CategoryTrendChartProps) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-lg font-semibold text-muted-foreground">{title}</p>
      </div>

      {/* Restaurant chips (legend) */}
      <div className="flex flex-wrap gap-2 mb-4">
        {restaurants.map((r) => (
          <span
            key={r.name}
            className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full border border-current text-xs font-medium bg-muted"
            style={{ color: r.color }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
            {r.name}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div role="img" aria-label={title} style={{ height: 'clamp(200px, 40vw, 260px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              domain={[0, 1]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => v.toFixed(1)}
              width={35}
            />
            <Tooltip content={<CustomTooltip />} />
            {restaurants.map((r) => (
              <Line
                key={r.name}
                type="monotone"
                dataKey={r.name}
                stroke={r.color}
                strokeWidth={r.isOwn ? 3 : 1.5}
                dot={false}
                activeDot={{ r: r.isOwn ? 5 : 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
