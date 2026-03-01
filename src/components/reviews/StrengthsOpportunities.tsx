import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { CategoryStat, StrengthItem } from '@/types/reviews';
import { getFlavorZone, formatFlavorScore } from '@/lib/flavor-utils';

interface StrengthsOpportunitiesProps {
  score: number;
  categoryStats: CategoryStat[];
  strengths: StrengthItem[];
  opportunities: StrengthItem[];
  isEs: boolean;
}

const PERIOD_OPTIONS_EN = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

const PERIOD_OPTIONS_ES = [
  { value: 'month', label: 'Este Mes' },
  { value: 'quarter', label: 'Este Trimestre' },
  { value: 'year', label: 'Este Año' },
];

export function StrengthsOpportunities({
  score,
  categoryStats,
  strengths,
  opportunities,
  isEs,
}: StrengthsOpportunitiesProps) {
  const [period, setPeriod] = useState('month');
  const zone = getFlavorZone(score);
  const periodOpts = isEs ? PERIOD_OPTIONS_ES : PERIOD_OPTIONS_EN;

  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-lg font-semibold text-muted-foreground">
          {isEs ? 'Fortalezas y Oportunidades' : 'Strengths & Opportunities'}
        </p>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label={isEs ? 'Seleccionar período' : 'Select period'}
          className="bg-muted border border-border rounded-full px-2.5 py-1 text-xs font-medium text-foreground cursor-pointer"
        >
          {periodOpts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Hero Score */}
      <div className="flex items-center gap-4 mb-5">
        <span
          className="text-4xl font-extrabold font-mono text-[#F97316]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatFlavorScore(score)}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full text-white bg-[#F97316]">
          <TrendingUp className="w-3 h-3" />
          {isEs ? zone.label.es : zone.label.en}
        </span>
      </div>

      {/* 4-stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {categoryStats.map((stat) => (
          <div key={stat.name.en}>
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: stat.color }}
              />
              <span
                className="text-lg font-bold font-mono text-foreground"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {stat.score.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isEs ? stat.name.es : stat.name.en}
            </p>
          </div>
        ))}
      </div>

      {/* Stacked distribution bar */}
      <div className="mb-1.5">
        <div className="flex h-4 rounded-[4px] overflow-hidden">
          {categoryStats.map((stat) => (
            <div
              key={stat.name.en}
              style={{ width: `${stat.percent}%`, background: stat.color }}
            />
          ))}
        </div>
      </div>
      <div className="flex text-[10px] font-medium text-muted-foreground mb-5">
        {categoryStats.map((stat) => (
          <span key={stat.name.en} style={{ width: `${stat.percent}%` }}>
            {isEs ? stat.name.es : stat.name.en} {stat.percent}%
          </span>
        ))}
      </div>

      {/* Strengths + Opportunities two-column */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
        {/* Top Strengths */}
        <div>
          <p className="text-xs font-semibold mb-3 text-muted-foreground">
            {isEs ? 'Fortalezas' : 'Top Strengths'}
          </p>
          <div className="space-y-2.5">
            {strengths.map((item) => (
              <div key={item.name.en} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: item.color }}
                />
                <span className="text-xs font-medium text-foreground">
                  {isEs ? item.name.es : item.name.en}
                </span>
                <span
                  className="text-[10px] font-mono ml-auto text-muted-foreground"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {item.score.toFixed(1)}/5
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Top Opportunities */}
        <div>
          <p className="text-xs font-semibold mb-3 text-muted-foreground">
            {isEs ? 'Oportunidades' : 'Top Opportunities'}
          </p>
          <div className="space-y-2.5">
            {opportunities.map((item) => (
              <div key={item.name.en} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: item.color }}
                />
                <span className="text-xs font-medium text-foreground">
                  {isEs ? item.name.es : item.name.en}
                </span>
                <span
                  className="text-[10px] font-mono ml-auto text-muted-foreground"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {item.score.toFixed(1)}/5
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
