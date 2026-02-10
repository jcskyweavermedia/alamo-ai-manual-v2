import { Search, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MENU_SECTIONS } from '@/data/mock-beer-liquor';
import type { BeerLiquorSubcategory } from '@/data/mock-beer-liquor';
import type { BeerLiquorItem } from '@/types/products';
import type { BeerLiquorFilterMode } from '@/hooks/use-beer-liquor-viewer';

interface BeerLiquorListProps {
  groupedItems: Record<BeerLiquorSubcategory, BeerLiquorItem[]>;
  totalCount: number;
  searchQuery: string;
  filterMode: BeerLiquorFilterMode;
  onSearchChange: (query: string) => void;
  onFilterChange: (mode: BeerLiquorFilterMode) => void;
  onSelectItem?: (slug: string) => void;
}

const FILTER_OPTIONS: { value: BeerLiquorFilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Beer', label: 'Beer' },
  { value: 'Liquor', label: 'Liquor' },
];

export function BeerLiquorList({
  groupedItems,
  totalCount,
  searchQuery,
  filterMode,
  onSearchChange,
  onFilterChange,
  onSelectItem,
}: BeerLiquorListProps) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Build visible sections: only categories/subcategories that have items after filtering
  const visibleSections = MENU_SECTIONS
    .map(section => ({
      ...section,
      subcategories: section.subcategories.filter(sub => groupedItems[sub]?.length > 0),
    }))
    .filter(section => section.subcategories.length > 0);

  const toggle = (slug: string) =>
    setExpandedSlug(prev => (prev === slug ? null : slug));

  return (
    <div className="space-y-4">
      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search beer & liquor..."
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

      {/* Menu list */}
      {totalCount === 0 ? (
        <p className="text-center text-muted-foreground py-12">No items found.</p>
      ) : (
        <div className="columns-1 md:columns-2 gap-x-8">
          {visibleSections.map(section => (
            <div key={section.category} className="break-inside-avoid-column mb-6">
              {/* ── Category header (BEER / LIQUOR) ── */}
              <h2 className="text-sm font-bold uppercase tracking-widest text-foreground border-b-2 border-foreground/20 pb-1.5 mb-3">
                {section.category}
              </h2>

              {section.subcategories.map(subcategory => (
                <div key={subcategory} className="break-inside-avoid mb-4">
                  {/* Subcategory header */}
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pb-0.5 mb-0.5">
                    {subcategory}
                  </h3>

                  {/* Items */}
                  <div>
                    {groupedItems[subcategory].map(item => {
                      const isOpen = expandedSlug === item.slug;
                      return (
                        <div key={item.slug}>
                          <button
                            type="button"
                            onClick={() => onSelectItem ? onSelectItem(item.slug) : toggle(item.slug)}
                            className={cn(
                              'w-full flex items-center gap-2 min-h-[40px] py-1.5 px-1 -mx-1 rounded',
                              'text-left transition-colors duration-100',
                              'hover:bg-muted/60 active:scale-[0.99]',
                              isOpen && 'bg-muted/40'
                            )}
                          >
                            <span className="text-[13px] font-semibold text-foreground truncate">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate shrink-0">
                              {item.producer}
                            </span>
                            <span className="flex-1" />
                            <span className="text-[11px] text-muted-foreground/60 shrink-0 hidden sm:inline">
                              {item.country}
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200',
                                isOpen && 'rotate-180'
                              )}
                            />
                          </button>

                          {/* Expanded detail — CSS grid-rows for smooth height animation */}
                          <div
                            className={cn(
                              'grid transition-[grid-template-rows,opacity] duration-250 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
                              isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                            )}
                          >
                            <div className="overflow-hidden">
                              <div className="pl-1 pr-1 pb-2 pt-1 space-y-2">
                                <p className="text-[11px] italic text-muted-foreground">
                                  {item.style}
                                </p>
                                <p className="text-[13px] text-foreground/85 leading-relaxed">
                                  {item.description}
                                </p>
                                {item.notes && (
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                      Service Notes
                                    </span>
                                    <p className="text-[13px] text-foreground/75 leading-relaxed mt-0.5">
                                      {item.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
