import { useState } from 'react';
import { Download, Maximize2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { FlavorMonthlyScore, CompetitorData } from '@/types/reviews';
import { getFlavorZoneHex, formatFlavorScore } from '@/lib/flavor-utils';

interface FlavorIndexChartProps {
  monthlyScores: FlavorMonthlyScore[];
  competitors: CompetitorData[];
  isEs: boolean;
}

const CATEGORY_CHIPS = [
  { key: 'food',     label: { en: 'Food',     es: 'Comida' },   color: '#F97316' },
  { key: 'service',  label: { en: 'Service',  es: 'Servicio' }, color: '#FB923C' },
  { key: 'ambience', label: { en: 'Ambience', es: 'Ambiente' }, color: '#FDBA74' },
  { key: 'value',    label: { en: 'Value',    es: 'Valor' },    color: '#FED7AA' },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value as number;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: '#141418', color: '#fff' }}
    >
      <p className="font-medium mb-0.5">{label}</p>
      <p className="font-mono font-bold">{formatFlavorScore(score)}</p>
    </div>
  );
}

export function FlavorIndexChart({
  monthlyScores,
  competitors,
  isEs,
}: FlavorIndexChartProps) {
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set(['food']));
  const [selectedRestaurant, setSelectedRestaurant] = useState(
    competitors.find((c) => c.isOwn)?.name ?? competitors[0]?.name ?? '',
  );

  const toggleChip = (key: string) => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-lg font-semibold text-muted-foreground">
            {isEs ? 'Índice de Sabor' : 'Flavor Index'}
          </p>
          <p className="text-xs mt-0.5 text-muted-foreground/70">
            {isEs ? 'Últimos 12 meses' : 'Last 12 months'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={isEs ? 'Descargar gráfico' : 'Download chart'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-1"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            aria-label={isEs ? 'Expandir gráfico' : 'Expand chart'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-1"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toggle chips + restaurant selector */}
      <div className="flex flex-wrap items-center gap-2 mt-3 mb-4">
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = activeChips.has(chip.key);
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => toggleChip(chip.key)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full border text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-1 ${
                isActive
                  ? 'border-current bg-muted'
                  : 'border-border'
              }`}
              style={{ color: chip.color }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: chip.color }}
              />
              {isEs ? chip.label.es : chip.label.en}
            </button>
          );
        })}
        <select
          value={selectedRestaurant}
          onChange={(e) => setSelectedRestaurant(e.target.value)}
          aria-label={isEs ? 'Seleccionar restaurante' : 'Select restaurant'}
          className="ml-auto bg-muted border border-border rounded-full px-3 py-1.5 text-xs font-medium text-foreground cursor-pointer"
        >
          {competitors.map((c) => (
            <option key={c.restaurantId} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <div role="img" aria-label={isEs ? 'Gráfico de barras del Índice de Sabor, últimos 12 meses' : 'Flavor Index bar chart, last 12 months'} style={{ height: 'clamp(180px, 35vw, 220px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyScores} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              domain={[-25, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {monthlyScores.map((entry, index) => {
                const isLast = index === monthlyScores.length - 1;
                const fill = isLast ? '#C2410C' : getFlavorZoneHex(entry.score);
                return <Cell key={entry.month} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
