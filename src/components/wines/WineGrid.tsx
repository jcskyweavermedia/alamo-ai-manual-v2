import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePinnedRecipes } from '@/hooks/use-pinned-recipes';
import type { Wine } from '@/types/products';

interface WineGridProps {
  wines: Wine[];
  onSelectWine: (slug: string) => void;
}

export function WineGrid({
  wines,
  onSelectWine,
}: WineGridProps) {
  const { togglePin, isPinned, sortPinnedFirst } = usePinnedRecipes();
  const sorted = sortPinnedFirst(wines);

  return (
    <div className="space-y-lg">
      {/* Grid */}
      {sorted.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No wines found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sorted.map(wine => {
            const pinned = isPinned(wine.slug);
            return (
              <button
                key={wine.slug}
                type="button"
                onClick={() => onSelectWine(wine.slug)}
                className={cn(
                  'group relative flex flex-col',
                  'p-5',
                  'bg-card rounded-[20px]',
                  'border border-black/[0.04] dark:border-white/[0.06]',
                  'shadow-card',
                  'hover:bg-muted/20 dark:hover:bg-muted/10',
                  'active:scale-[0.99]',
                  'transition-all duration-150',
                  'text-left'
                )}
              >
                {/* Image tile + bookmark */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-[56px] h-[72px] md:w-[68px] md:h-[88px] rounded-[14px] overflow-hidden shrink-0 shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.4),2px_4px_8px_-2px_rgba(0,0,0,0.25)] bg-muted">
                    <img
                      src={wine.image ?? ''}
                      alt={wine.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1" />
                  {/* Bookmark */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={pinned ? 'Remove bookmark' : 'Bookmark wine'}
                    onClick={e => { e.stopPropagation(); togglePin(wine.slug); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(wine.slug); } }}
                    className={cn(
                      'flex items-center justify-center',
                      'h-8 w-8 rounded-full',
                      'transition-all duration-150',
                      pinned
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                    )}
                  >
                    <Bookmark className="h-4 w-4 fill-current" />
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-2">
                  {wine.name}
                </h3>

                {/* Subtitle — plain text style */}
                <p className="text-sm text-muted-foreground capitalize mt-0.5">
                  {wine.style}
                </p>

                {/* Metadata row — anchored to bottom */}
                <div className="flex items-center gap-3 mt-auto pt-3 text-[13px] leading-none text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[16px] h-[16px] leading-[16px] shrink-0">🍷</span>
                    <span className="capitalize">{wine.body} body</span>
                  </span>
                  {wine.isTopSeller && (
                    <>
                      <span className="text-black/10 dark:text-white/10">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[16px] h-[16px] leading-[16px] shrink-0">⭐</span>
                        <span>Top Seller</span>
                      </span>
                    </>
                  )}
                  {wine.isFeatured && (
                    <>
                      <span className="text-black/10 dark:text-white/10">·</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                        Featured
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
