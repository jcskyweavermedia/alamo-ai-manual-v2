import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePinnedRecipes } from '@/hooks/use-pinned-recipes';
import type { Dish, DishCategory } from '@/types/products';

export type DishFilterMode = 'all' | DishCategory;

interface DishGridProps {
  dishes: Dish[];
  onSelectDish: (slug: string) => void;
}

export function DishGrid({
  dishes,
  onSelectDish,
}: DishGridProps) {
  const { togglePin, isPinned, sortPinnedFirst } = usePinnedRecipes();
  const sorted = sortPinnedFirst(dishes);

  return (
    <div className="space-y-lg">
      {/* Grid */}
      {sorted.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No dishes found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sorted.map(dish => {
            const pinned = isPinned(dish.slug);
            return (
              <button
                key={dish.slug}
                type="button"
                onClick={() => onSelectDish(dish.slug)}
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
                  <div className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-[14px] overflow-hidden shrink-0 shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.4),2px_4px_8px_-2px_rgba(0,0,0,0.25)] bg-muted">
                    <img
                      src={dish.image}
                      alt={dish.menuName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1" />
                  {/* Bookmark */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={pinned ? 'Remove bookmark' : 'Bookmark dish'}
                    onClick={e => { e.stopPropagation(); togglePin(dish.slug); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(dish.slug); } }}
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
                  {dish.menuName}
                </h3>

                {/* Subtitle — plain text, same style as /recipes */}
                <p className="text-sm text-muted-foreground capitalize mt-0.5">
                  {dish.plateType}
                </p>

                {/* Metadata row — anchored to bottom */}
                <div className="flex items-center gap-3 mt-auto pt-3 text-[13px] leading-none text-muted-foreground">
                  {dish.allergens.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[16px] h-[16px] leading-[16px] shrink-0">⚠️</span>
                      <span>{dish.allergens.length} allergen{dish.allergens.length > 1 ? 's' : ''}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[16px] h-[16px] leading-[16px] shrink-0">✅</span>
                      <span>No allergens</span>
                    </span>
                  )}
                  {dish.isTopSeller && (
                    <>
                      <span className="text-black/10 dark:text-white/10">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[16px] h-[16px] leading-[16px] shrink-0">⭐</span>
                        <span>Top Seller</span>
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
