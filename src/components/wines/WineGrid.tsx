import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WineStyleBadge } from './WineStyleBadge';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import type { Wine } from '@/types/products';
import type { WineFilterMode } from '@/hooks/use-wine-viewer';

interface WineGridProps {
  wines: Wine[];
  searchQuery: string;
  filterMode: WineFilterMode;
  onSelectWine: (slug: string) => void;
  onSearchChange: (query: string) => void;
  onFilterChange: (mode: WineFilterMode) => void;
}

const FILTER_OPTIONS: { value: WineFilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'rosé', label: 'Rosé' },
  { value: 'sparkling', label: 'Sparkling' },
];

export function WineGrid({
  wines,
  searchQuery,
  filterMode,
  onSelectWine,
  onSearchChange,
  onFilterChange,
}: WineGridProps) {
  return (
    <div className="space-y-lg">
      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search wines..."
            className={cn(
              'flex h-11 w-full rounded-lg border border-input bg-background',
              'pl-10 pr-10 py-2 text-body',
              'ring-offset-background transition-colors duration-150',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              '[&::-webkit-search-cancel-button]:hidden'
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className={cn(
                'min-h-[36px] px-3 rounded-md text-xs font-semibold',
                'transition-colors duration-150',
                filterMode === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {wines.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No wines found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {wines.map(wine => (
            <button
              key={wine.slug}
              type="button"
              onClick={() => onSelectWine(wine.slug)}
              className={cn(
                'group flex flex-col rounded-card overflow-hidden',
                'bg-card text-left',
                'shadow-card dark:border dark:border-border/50',
                'hover:shadow-elevated active:scale-[0.98]',
                'transition-all duration-150'
              )}
            >
              {/* Thumbnail — portrait for bottles */}
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <img
                  src={wine.image}
                  alt={wine.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {/* Style badge overlay */}
                <span className="absolute top-2 left-2">
                  <WineStyleBadge style={wine.style} />
                </span>
                {wine.isTopSeller && (
                  <span className="absolute top-2 right-2">
                    <TopSellerBadge size="sm" />
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-1">
                <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                  {wine.name}
                </h3>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {wine.producer}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {wine.region}, {wine.country}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
