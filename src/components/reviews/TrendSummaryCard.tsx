import { ArrowUpRight } from 'lucide-react';
import { formatFlavorScore } from '@/lib/flavor-utils';

interface TrendSummaryCardProps {
  delta: number;
  currentScore: number;
  previousScore: number | null;
  lowRatingPercent: number;
  lowRatingTotal: number;
  previousLowPercent: number | null;
  isEs: boolean;
}

export function TrendSummaryCard({
  delta,
  currentScore,
  previousScore,
  lowRatingPercent,
  lowRatingTotal,
  previousLowPercent,
  isEs,
}: TrendSummaryCardProps) {
  const currentWidth = ((currentScore + 100) / 200) * 100;
  const hasPrevious = previousScore !== null;
  const previousWidth = hasPrevious ? ((previousScore + 100) / 200) * 100 : 0;
  const hasPrevLow = previousLowPercent !== null;

  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated h-full">
      {/* Score Trend */}
      <div className="mb-5">
        <div className="flex items-start justify-between mb-1">
          <p className="text-lg font-semibold text-muted-foreground">
            {isEs ? 'Tendencia' : 'Score Trend'}
          </p>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex items-baseline gap-3 mt-3 mb-3">
          <span
            className="text-3xl font-bold font-mono text-[#F97316]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatFlavorScore(delta)}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {isEs ? 'ptos' : 'pts'}
          </span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[10px] mb-1 text-muted-foreground">
              <span>{isEs ? 'Actual' : 'Current'}</span>
              <span className="font-mono font-bold text-foreground">
                {formatFlavorScore(currentScore)}
              </span>
            </div>
            <div className="h-[8px] rounded-[4px] bg-muted overflow-hidden" role="progressbar" aria-valuenow={currentWidth} aria-valuemin={0} aria-valuemax={100} aria-label={`${isEs ? 'Puntuación actual' : 'Current score'} ${formatFlavorScore(currentScore)}`}>
              <div
                className="h-full rounded-[4px] transition-all duration-500 ease-out"
                style={{ width: `${currentWidth}%`, background: '#F97316' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1 text-muted-foreground">
              <span>{isEs ? 'Anterior' : 'Previous'}</span>
              <span className="font-mono text-muted-foreground">
                {hasPrevious ? formatFlavorScore(previousScore) : (isEs ? 'Sin datos' : 'No data')}
              </span>
            </div>
            <div className="h-[8px] rounded-[4px] bg-muted overflow-hidden" role="progressbar" aria-valuenow={previousWidth} aria-valuemin={0} aria-valuemax={100} aria-label={`${isEs ? 'Puntuación anterior' : 'Previous score'} ${hasPrevious ? formatFlavorScore(previousScore) : (isEs ? 'Sin datos' : 'No data')}`}>
              {hasPrevious && (
                <div
                  className="h-full rounded-[4px] transition-all duration-500 ease-out"
                  style={{
                    width: `${previousWidth}%`,
                    background: 'repeating-linear-gradient(45deg, hsl(var(--muted)) 0, hsl(var(--muted)) 2px, hsl(var(--muted-foreground) / 0.12) 2px, hsl(var(--muted-foreground) / 0.12) 4px)',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-5" />

      {/* Low Ratings */}
      <div>
        <div className="flex items-start justify-between mb-1">
          <p className="text-sm font-semibold text-muted-foreground">
            {isEs ? 'Calificaciones Bajas' : 'Low Ratings'}
          </p>
          <span className="text-[10px] text-muted-foreground/70">
            {isEs ? '1-3 estrellas' : '1-3 star'}
          </span>
        </div>
        <div className="flex items-baseline gap-3 mt-3 mb-3">
          <span
            className="text-2xl font-bold font-mono text-[#F97316]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {lowRatingPercent}%
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {lowRatingTotal} {isEs ? 'en total' : 'total'}
          </span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[10px] mb-1 text-muted-foreground">
              <span>{isEs ? 'Actual' : 'Current'}</span>
              <span className="font-mono font-bold text-foreground">
                {lowRatingPercent}%
              </span>
            </div>
            <div className="h-[8px] rounded-[4px] bg-muted overflow-hidden" role="progressbar" aria-valuenow={lowRatingPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${isEs ? 'Calificaciones bajas actuales' : 'Current low ratings'} ${lowRatingPercent}%`}>
              <div
                className="h-full rounded-[4px] transition-all duration-500 ease-out"
                style={{ width: `${lowRatingPercent}%`, background: '#FB923C' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1 text-muted-foreground">
              <span>{isEs ? 'Anterior' : 'Previous'}</span>
              <span className="font-mono text-muted-foreground">
                {hasPrevLow ? `${previousLowPercent}%` : (isEs ? 'Sin datos' : 'No data')}
              </span>
            </div>
            <div className="h-[8px] rounded-[4px] bg-muted overflow-hidden" role="progressbar" aria-valuenow={previousLowPercent ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${isEs ? 'Calificaciones bajas anteriores' : 'Previous low ratings'} ${hasPrevLow ? `${previousLowPercent}%` : (isEs ? 'Sin datos' : 'No data')}`}>
              {hasPrevLow && (
                <div
                  className="h-full rounded-[4px] transition-all duration-500 ease-out"
                  style={{
                    width: `${previousLowPercent}%`,
                    background: 'repeating-linear-gradient(45deg, hsl(var(--muted)) 0, hsl(var(--muted)) 2px, hsl(var(--muted-foreground) / 0.12) 2px, hsl(var(--muted-foreground) / 0.12) 4px)',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
