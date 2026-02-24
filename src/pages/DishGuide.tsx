import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDishViewer } from '@/hooks/use-dish-viewer';
import type { DishFilterMode } from '@/components/dishes/DishGrid';
import { useCrossNavLookup } from '@/hooks/use-cross-nav-lookup';
import { DishGrid, DishCardView } from '@/components/dishes';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';

const FILTER_OPTIONS: { value: DishFilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'entree', label: 'Entree' },
  { value: 'side', label: 'Side' },
  { value: 'dessert', label: 'Dessert' },
];

const DishGuide = () => {
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const slugParam = searchParams.get('slug');

  const {
    filteredDishes,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    selectedDish,
    selectDish,
    clearSelection,
    hasPrev,
    hasNext,
    goToPrev,
    goToNext,
    isLoading,
    error,
  } = useDishViewer(slugParam);

  const { getBohSlug } = useCrossNavLookup();

  // Clear ?slug= param after mount so browser back works correctly
  useEffect(() => {
    if (slugParam) setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // AI action state (lifted from CardView)
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Clear action when deselecting a dish
  const handleClearSelection = useCallback(() => {
    setActiveAction(null);
    clearSelection();
  }, [clearSelection]);

  const itemNav = useMemo(
    () => selectedDish ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedDish, hasPrev, hasNext, goToPrev, goToNext]
  );

  const headerLeft = !selectedDish ? (
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
    </div>
  ) : undefined;

  // Desktop docked AI panel (only when a dish is selected and action is active)
  const aiPanel = selectedDish && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig('dishes', activeAction) ?? null}
      domain="dishes"
      itemName={selectedDish.menuName}
      itemContext={selectedDish as unknown as Record<string, unknown>}
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
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <span className="text-[24px] h-[24px] leading-[24px]">⚠️</span>
          <p className="text-sm text-muted-foreground">Failed to load dishes</p>
        </div>
      ) : selectedDish ? (
        <>
          <DishCardView
            dish={selectedDish}
            onBack={handleClearSelection}
            onSwipePrev={goToPrev}
            onSwipeNext={goToNext}
            activeAction={activeAction}
            onActionChange={setActiveAction}
            bohSlug={getBohSlug(selectedDish.plateSpecId)}
          />
          {/* Mobile: bottom drawer */}
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('dishes', activeAction) ?? null : null}
              domain="dishes"
              itemName={selectedDish.menuName}
              itemContext={selectedDish as unknown as Record<string, unknown>}
            />
          )}
        </>
      ) : (
        <>
          <div className="py-6">
            <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
              Every Plate
              <br />
              <span className="font-bold">Tells a Story</span> 🍽️
            </p>
            <p className="text-sm text-muted-foreground mt-2">Plating guides, allergens, and service notes for the full menu.</p>
          </div>
          <DishGrid
            dishes={filteredDishes}
            onSelectDish={selectDish}
          />
        </>
      )}
    </AppShell>
  );
};

export default DishGuide;
