import { TrendingUp, BarChart3, Star } from 'lucide-react';
import type { CompanyScorecard } from '@/types/reviews';
import { formatFlavorScore, getFlavorZone } from '@/lib/flavor-utils';

interface RestaurantScorecardProps {
  card: CompanyScorecard;
  isEs: boolean;
}

export function RestaurantScorecard({ card, isEs }: RestaurantScorecardProps) {
  const hasData = card.score !== null;

  if (!hasData) {
    return (
      <div className="bg-card border-2 border-dashed border-border rounded-[16px] p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-foreground">{card.name}</p>
            <p className="text-xs text-muted-foreground">{card.location}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8">
          <BarChart3 className="w-10 h-10 mb-3 text-border" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">
            {isEs ? 'Sin Datos Aún' : 'No Data Yet'}
          </p>
          <p className="text-xs mt-1 text-muted-foreground/70">
            {isEs
              ? 'Configura el scraping de reseñas para comenzar'
              : 'Configure review scraping to get started'}
          </p>
          <button
            className="text-sm font-semibold mt-3 px-4 py-2 rounded-xl text-white bg-[#F97316] hover:bg-[#EA580C] transition-colors"
          >
            {isEs ? 'Configurar →' : 'Set Up →'}
          </button>
        </div>
      </div>
    );
  }

  const zone = getFlavorZone(card.score!);
  const zoneLabel = isEs ? zone.label.es : zone.label.en;

  return (
    <div
      className="bg-card rounded-[16px] p-6 transition-shadow hover:shadow-elevated"
      style={{ border: '2px solid #F97316' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-foreground">{card.name}</p>
          <p className="text-xs text-muted-foreground">{card.location}</p>
        </div>
        {card.isPrimary && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-[#F97316]">
            {isEs ? 'Principal' : 'Primary'}
          </span>
        )}
      </div>

      {/* Score + delta */}
      <div className="flex items-end gap-3 mb-4">
        <span
          className="text-4xl font-extrabold font-mono text-[#F97316]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatFlavorScore(card.score!)}
        </span>
        {card.delta !== null && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-1 bg-[rgba(249,115,22,0.1)] text-[#F97316]">
            <TrendingUp className="w-3 h-3" />
            {card.delta > 0 ? '+' : ''}{card.delta.toFixed(1)}
          </span>
        )}
      </div>

      {/* Zone badge */}
      <p className="text-[11px] font-bold px-2.5 py-1 rounded-full inline-block mb-3 text-white bg-[#F97316]">
        {zoneLabel}
      </p>

      {/* Footer stats */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {card.totalReviews} {isEs ? 'reseñas' : 'reviews'}
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-[#FB923C]" aria-hidden="true" />
          {card.avgRating.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
