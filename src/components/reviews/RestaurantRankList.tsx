import { useState } from 'react';
import { MoreHorizontal, TrendingUp, TrendingDown } from 'lucide-react';
import type { CompetitorData } from '@/types/reviews';
import { formatFlavorScore } from '@/lib/flavor-utils';
import { TimePillBar } from './TimePillBar';

interface RestaurantRankListProps {
  competitors: CompetitorData[];
  isEs: boolean;
}

const TIME_OPTIONS_EN = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'last-year', label: 'Last Year' },
  { value: '5yr', label: '5 Yr', hiddenOnMobile: true },
  { value: 'all', label: 'All', hiddenOnMobile: true },
];

const TIME_OPTIONS_ES = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
  { value: 'last-year', label: 'Año Pasado' },
  { value: '5yr', label: '5 Años', hiddenOnMobile: true },
  { value: 'all', label: 'Todo', hiddenOnMobile: true },
];

export function RestaurantRankList({ competitors, isEs }: RestaurantRankListProps) {
  const [timePeriod, setTimePeriod] = useState('month');
  const sorted = [...competitors].sort((a, b) => b.score - a.score);
  const maxAbsScore = sorted.length > 0 ? Math.max(...sorted.map((c) => Math.abs(c.score))) : 0;
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div
      className="border rounded-[16px] p-6 transition-shadow hover:shadow-elevated"
      style={{
        background: isDark
          ? 'linear-gradient(to right, #7C2D12, #1C1C22)'
          : 'linear-gradient(to right, #FB923C, #FFF7ED)',
        borderColor: isDark ? '#9A3412' : '#FDBA74',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-lg font-semibold" style={{ color: isDark ? '#FDBA74' : '#7C2D12' }}>
          {isEs ? 'Índice por Restaurante' : 'Flavor Index by Restaurant'}
        </p>
        <button
          aria-label={isEs ? 'Más opciones' : 'More options'}
          className="w-8 h-8 rounded-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-1"
          style={{ color: isDark ? '#FB923C' : '#9A3412' }}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Time selector */}
      <div className="mb-5">
        <TimePillBar
          options={isEs ? TIME_OPTIONS_ES : TIME_OPTIONS_EN}
          value={timePeriod}
          onChange={setTimePeriod}
          bgClassName="bg-[rgba(255,255,255,0.35)]"
        />
      </div>

      {/* Restaurant rows */}
      <div className="space-y-3" role="list" aria-label={isEs ? 'Ranking de restaurantes' : 'Restaurant ranking'}>
        {sorted.map((c) => {
          const barWidth = maxAbsScore > 0
            ? ((Math.abs(c.score) + maxAbsScore) / (maxAbsScore * 2)) * 100
            : 50;
          const isUp = (c.delta ?? 0) >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const trendColor = isUp ? (isDark ? '#FB923C' : '#9A3412') : '#C2410C';

          return (
            <div key={c.restaurantId} className="relative" style={{ height: 46 }} role="listitem">
              {/* Background bar */}
              <div
                className="absolute left-0 top-0 bottom-0 rounded-lg"
                style={{
                  width: `${barWidth}%`,
                  background: isDark ? 'rgba(251,146,60,0.15)' : 'rgba(255,247,237,0.7)',
                }}
              />
              {/* Content */}
              <div className="relative z-10 flex items-center justify-between h-full px-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-bold"
                    style={{ color: isDark ? '#FDBA74' : '#7C2D12' }}
                  >
                    {c.name}
                  </span>
                  {c.isOwn && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F97316] text-white">
                      {isEs ? 'Tú' : 'You'}
                    </span>
                  )}
                  {c.delta !== null && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold"
                      style={{ color: trendColor }}
                    >
                      <TrendIcon className="w-3 h-3" />
                      {c.delta > 0 ? '+' : ''}{c.delta.toFixed(1)}
                    </span>
                  )}
                </div>
                <span
                  className="text-sm font-extrabold font-mono"
                  style={{
                    color: isDark ? '#FDBA74' : '#7C2D12',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatFlavorScore(c.score)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.35)' }}>
        <button
          className="text-sm font-medium"
          style={{ color: isDark ? '#FB923C' : '#9A3412' }}
        >
          {isEs ? 'Ver Comparación Detallada →' : 'View Detailed Comparison →'}
        </button>
      </div>
    </div>
  );
}
