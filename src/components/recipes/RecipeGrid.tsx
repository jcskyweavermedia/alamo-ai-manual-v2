import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AllergenBadge } from './AllergenBadge';
import type { Recipe } from '@/types/products';
import type { FilterMode } from '@/hooks/use-recipe-viewer';

interface RecipeGridProps {
  recipes: Recipe[];
  searchQuery: string;
  filterMode: FilterMode;
  onSelectRecipe: (slug: string) => void;
  onSearchChange: (query: string) => void;
  onFilterChange: (mode: FilterMode) => void;
}

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'prep', label: 'Prep' },
  { value: 'plate', label: 'Plate' },
];

export function RecipeGrid({
  recipes,
  searchQuery,
  filterMode,
  onSelectRecipe,
  onSearchChange,
  onFilterChange,
}: RecipeGridProps) {
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
            placeholder="Search recipes..."
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
                'min-h-[36px] px-4 rounded-md text-xs font-semibold',
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
      {recipes.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No recipes found.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {recipes.map(recipe => (
            <button
              key={recipe.slug}
              type="button"
              onClick={() => onSelectRecipe(recipe.slug)}
              className={cn(
                'group flex flex-col rounded-card overflow-hidden',
                'bg-card text-left',
                'shadow-card dark:border dark:border-border/50',
                'hover:shadow-elevated active:scale-[0.98]',
                'transition-all duration-150'
              )}
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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

              {/* Info */}
              <div className="p-3 space-y-1">
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    recipe.type === 'prep'
                      ? 'text-primary dark:text-primary'
                      : 'text-amber-700 dark:text-amber-400'
                  )}
                >
                  {recipe.type === 'prep' ? 'Prep Recipe' : 'Plate Spec'}
                </span>
                <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                  {recipe.name}
                </h3>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {recipe.type === 'prep' ? recipe.prepType : recipe.plateType}
                </p>
                {recipe.type === 'plate' && recipe.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1 -ml-0.5">
                    {recipe.allergens.map(a => (
                      <AllergenBadge key={a} allergen={a as any} />
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
