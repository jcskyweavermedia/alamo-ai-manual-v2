import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CompanyTrendDataPoint } from '@/types/reviews';
import { formatFlavorScore } from '@/lib/flavor-utils';

interface CompanyTrendChartProps {
  title: string;
  data: CompanyTrendDataPoint[];
  locations: { name: string; color: string }[];
  isEs: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: '#141418', color: '#F5F5F7' }}
    >
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="font-mono font-bold">
          {formatFlavorScore(entry.value as number)}
        </p>
      ))}
    </div>
  );
}

export function CompanyTrendChart({
  title,
  data,
  locations,
  isEs,
}: CompanyTrendChartProps) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated">
      <p className="text-lg font-semibold mb-3 text-muted-foreground">{title}</p>
      <div role="img" aria-label={title} style={{ height: 'clamp(200px, 40vw, 240px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              iconType="circle"
              wrapperStyle={{ paddingBottom: 12 }}
              formatter={(value: string) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            {locations.map((loc) => (
              <Line
                key={loc.name}
                type="monotone"
                dataKey={loc.name}
                stroke={loc.color}
                strokeWidth={3}
                dot={{ r: 4, fill: loc.color }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
