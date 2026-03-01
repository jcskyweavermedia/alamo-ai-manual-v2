import { MapPin, Building2 } from 'lucide-react';
import type { CompetitorData, CompanyLocation } from '@/types/reviews';
import { formatFlavorScore } from '@/lib/flavor-utils';

interface RankingsCardProps {
  competitors: CompetitorData[];
  companyLocations: CompanyLocation[];
  isEs: boolean;
}

export function RankingsCard({ competitors, companyLocations, isEs }: RankingsCardProps) {
  const sorted = [...competitors].sort((a, b) => b.score - a.score);
  const ownRank = sorted.findIndex((c) => c.isOwn) + 1;

  const locsSorted = [...companyLocations].sort((a, b) => (b.score ?? -999) - (a.score ?? -999));
  const ownLocRank = 1; // First location is own

  return (
    <div className="bg-card border border-border rounded-[16px] p-6 transition-shadow hover:shadow-elevated h-full">
      {/* Local Ranking */}
      <div className="mb-5">
        <div className="flex items-start justify-between mb-1">
          <p className="text-lg font-semibold text-muted-foreground">
            {isEs ? 'Ranking Local' : 'Local Ranking'}
          </p>
          <MapPin className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex items-baseline gap-2 mt-3 mb-4">
          <span
            className="text-3xl font-bold font-mono text-[#F97316]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            #{ownRank}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            / {sorted.length}
          </span>
        </div>
        <div className="space-y-1.5" role="list" aria-label={isEs ? 'Ranking local' : 'Local ranking'}>
          {sorted.map((c, i) => (
            <div
              key={c.restaurantId}
              className={`flex items-center justify-between py-1.5 px-3 ${
                c.isOwn ? 'rounded-lg bg-[rgba(249,115,22,0.08)]' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] ${c.isOwn ? 'font-bold text-[#F97316]' : 'text-muted-foreground'}`}
                >
                  {i + 1}.
                </span>
                <span
                  className={`text-[11px] ${c.isOwn ? 'font-bold text-foreground' : 'text-foreground'}`}
                >
                  {c.name}
                </span>
              </div>
              <span
                className={`text-[11px] font-mono ${
                  c.isOwn ? 'font-bold text-[#F97316]' : 'text-muted-foreground'
                }`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatFlavorScore(c.score)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-5" />

      {/* Company Ranking */}
      <div>
        <div className="flex items-start justify-between mb-1">
          <p className="text-lg font-semibold text-muted-foreground">
            {isEs ? 'Ranking Compañía' : 'Company Ranking'}
          </p>
          <Building2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex items-baseline gap-2 mt-3 mb-4">
          <span
            className="text-2xl font-bold font-mono text-[#F97316]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            #{ownLocRank}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            / {locsSorted.length}
          </span>
        </div>
        <div className="space-y-1.5" role="list" aria-label={isEs ? 'Ranking de compañía' : 'Company ranking'}>
          {locsSorted.map((loc, i) => {
            const isFirst = i === 0;
            return (
              <div
                key={loc.name}
                className={`flex items-center justify-between py-1.5 px-3 ${
                  isFirst ? 'rounded-lg bg-[rgba(249,115,22,0.08)]' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] ${isFirst ? 'font-bold text-[#F97316]' : 'text-muted-foreground'}`}
                  >
                    {i + 1}.
                  </span>
                  <span
                    className={`text-[11px] ${isFirst ? 'font-bold text-foreground' : 'text-foreground'}`}
                  >
                    {loc.name}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-mono ${
                    isFirst ? 'font-bold text-[#F97316]' : 'text-muted-foreground'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {loc.score !== null ? formatFlavorScore(loc.score) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
