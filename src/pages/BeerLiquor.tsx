import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Loader2, AlertCircle, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBeerLiquorViewer } from '@/hooks/use-beer-liquor-viewer';
import type { BeerLiquorFilterMode } from '@/hooks/use-beer-liquor-viewer';
import { BeerLiquorList, BeerLiquorCardView } from '@/components/beer-liquor';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';
import type { ProductSortMode } from '@/types/products';
import { NavbarBookmark } from '@/components/shared/NavbarBookmark';
import { usePinnedRecipes } from '@/hooks/use-pinned-recipes';

const FILTER_OPTIONS: { value: BeerLiquorFilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Beer', label: 'Beer' },
  { value: 'Liquor', label: 'Liquor' },
];

const SORT_OPTIONS: { value: ProductSortMode; label: string }[] = [
  { value: 'name', label: 'A\u2013Z' },
  { value: 'recent', label: 'New' },
  { value: 'featured', label: 'Featured' },
];

const BeerLiquor = () => {
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();
  const { togglePin, isPinned } = usePinnedRecipes();

  const {
    filteredItems,
    groupedItems,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortMode,
    setSortMode,
    selectedItem,
    selectItem,
    clearSelection,
    hasPrev,
    hasNext,
    goToPrev,
    goToNext,
    isLoading,
    error,
  } = useBeerLiquorViewer();

  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleClearSelection = useCallback(() => {
    setActiveAction(null);
    clearSelection();
  }, [clearSelection]);

  const itemNav = useMemo(
    () => selectedItem ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedItem, hasPrev, hasNext, goToPrev, goToNext]
  );

  const headerLeft = selectedItem ? (
    <button
      onClick={handleClearSelection}
      className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
      title="Back"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  ) : undefined;

  const headerToolbar = selectedItem ? (
    <NavbarBookmark
      pinned={isPinned(selectedItem.slug)}
      onToggle={() => togglePin(selectedItem.slug)}
    />
  ) : undefined;

  const aiPanel = selectedItem && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig('beer_liquor', activeAction) ?? null}
      domain="beer_liquor"
      itemName={selectedItem.name}
      itemContext={selectedItem as unknown as Record<string, unknown>}
    />
  ) : undefined;

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      itemNav={itemNav}
      aiPanel={aiPanel}
      headerLeft={headerLeft}
      headerToolbar={headerToolbar}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load beer & liquor</p>
        </div>
      ) : selectedItem ? (
        <>
          <BeerLiquorCardView
            item={selectedItem}
            onBack={handleClearSelection}
            onPrev={goToPrev}
            onNext={goToNext}
            activeAction={activeAction}
            onActionChange={setActiveAction}
          />
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('beer_liquor', activeAction) ?? null : null}
              domain="beer_liquor"
              itemName={selectedItem.name}
              itemContext={selectedItem as unknown as Record<string, unknown>}
            />
          )}
        </>
      ) : (
        <>
          <div className="py-6">
            <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
              Poured with
              <br />
              <span className="font-bold">Character</span> 🍺
            </p>
            <p className="text-sm text-muted-foreground mt-2">Draft, bottle, and spirit selections with service notes.</p>
          </div>
          {/* Sticky filter/sort bar */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 py-2 border-b border-border/50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative flex-1 max-w-[200px] min-w-[120px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className={cn(
                    'h-9 w-full rounded-lg border border-input bg-background',
                    'pl-8 pr-8 text-sm',
                    'ring-offset-background transition-colors duration-150',
                    'placeholder:text-muted-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    '[&::-webkit-search-cancel-button]:hidden'
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilterMode(opt.value)}
                    className={cn(
                      'min-h-[28px] px-2.5 rounded-md text-[11px] font-semibold',
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
              <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSortMode(opt.value)}
                    className={cn(
                      'min-h-[28px] px-2.5 rounded-md text-[11px] font-semibold',
                      'transition-colors duration-150',
                      sortMode === opt.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <BeerLiquorList
            groupedItems={groupedItems}
            totalCount={filteredItems.length}
            onSelectItem={selectItem}
          />
        </>
      )}
    </AppShell>
  );
};

export default BeerLiquor;
