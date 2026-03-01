import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePinnedRecipes } from '@/hooks/use-pinned-recipes';
import type { Recipe, PrepRecipe, PlateSpec } from '@/types/products';

interface RecipeGridProps {
  recipes: Recipe[];
  onSelectRecipe: (slug: string) => void;
}

export function RecipeGrid({
  recipes,
  onSelectRecipe,
}: RecipeGridProps) {
  const { togglePin, isPinned, sortPinnedFirst } = usePinnedRecipes();
  const sorted = sortPinnedFirst(recipes);

  return (
    <div className="space-y-lg">
      {/* Grid — 1 col phone, 2 cols sm, 3 cols md (iPad+) */}
      {sorted.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No recipes found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sorted.map(recipe => {
            const isPrep = recipe.type === 'prep';
            const prep = isPrep ? (recipe as PrepRecipe) : null;
            const plate = !isPrep ? (recipe as PlateSpec) : null;
            const pinned = isPinned(recipe.slug);

            return (
              <button
                key={recipe.slug}
                type="button"
                onClick={() => onSelectRecipe(recipe.slug)}
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
                {/* Top row: Image tile left, Pin icon top-right */}
                <div className="flex items-start justify-between mb-4">
                  {/* Square Image Tile */}
                  <div
                    className={cn(
                      'w-[72px] h-[72px] md:w-[88px] md:h-[88px]',
                      'rounded-[14px] overflow-hidden shrink-0',
                      'shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.4),2px_4px_8px_-2px_rgba(0,0,0,0.25)]',
                      'bg-muted'
                    )}
                  >
                    {recipe.images[0] ? (
                      <img
                        src={recipe.images[0].url}
                        alt={recipe.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Bookmark — grey filled idle, orange circle when active */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={pinned ? 'Remove bookmark' : 'Bookmark recipe'}
                    onClick={e => { e.stopPropagation(); togglePin(recipe.slug); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(recipe.slug); } }}
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
                  {recipe.name}
                </h3>

                {/* Subtitle */}
                <p className="text-sm text-muted-foreground capitalize mt-0.5">
                  {isPrep ? `Prep · ${prep!.prepType}` : `Plate · ${plate!.plateType}`}
                </p>

                {/* Metadata row — anchored to bottom with emojis */}
                <div className="flex items-center gap-3 mt-auto pt-3 text-[13px] leading-none text-muted-foreground">
                  {isPrep && prep ? (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[16px] h-[16px] leading-[16px] shrink-0">📦</span>
                        <span className="tabular-nums">{prep.yieldQty} {prep.yieldUnit}</span>
                      </span>
                      <span className="text-black/10 dark:text-white/10">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[16px] h-[16px] leading-[16px] shrink-0">🕐</span>
                        <span className="tabular-nums">{prep.shelfLifeValue} {prep.shelfLifeUnit}</span>
                      </span>
                    </>
                  ) : plate ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[16px] h-[16px] leading-[16px] shrink-0">⚠️</span>
                      <span>{plate.allergens.length} allergen{plate.allergens.length !== 1 ? 's' : ''}</span>
                    </span>
                  ) : null}
                  {recipe.isFeatured && (
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
