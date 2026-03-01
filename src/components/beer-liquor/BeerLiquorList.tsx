import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MENU_SECTIONS } from '@/data/mock-beer-liquor';
import type { BeerLiquorSubcategory } from '@/data/mock-beer-liquor';
import type { BeerLiquorItem } from '@/types/products';

interface BeerLiquorListProps {
  groupedItems: Record<BeerLiquorSubcategory, BeerLiquorItem[]>;
  totalCount: number;
  onSelectItem?: (slug: string) => void;
}

export function BeerLiquorList({
  groupedItems,
  totalCount,
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
                              'w-full flex items-center gap-2 min-h-[44px] py-1.5 px-1 -mx-1 rounded',
                              'text-left transition-colors duration-100',
                              'hover:bg-muted/60 active:scale-[0.99]',
                              isOpen && 'bg-muted/40'
                            )}
                          >
                            <span className="text-[13px] font-semibold text-foreground line-clamp-2 min-w-0">
                              {item.name}
                            </span>
                            {item.isFeatured && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
                                Featured
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground shrink-0">
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
