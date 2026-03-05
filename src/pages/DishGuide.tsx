import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, X } from 'lucide-react';
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
import type { ProductSortMode } from '@/types/products';
import { NavbarBookmark } from '@/components/shared/NavbarBookmark';
import { usePinnedRecipes } from '@/hooks/use-pinned-recipes';
import { getCommon } from '@/lib/common-strings';
import type { Language } from '@/hooks/use-language';

const STRINGS = {
  en: {
    heroLine1: 'Every Plate',
    heroLine2: 'Tells a Story',
    subtitle: 'Plating guides, allergens, and service notes for the full menu.',
    failedToLoadDishes: 'Failed to load dishes',
    appetizer: 'Appetizer',
    entree: 'Entree',
    side: 'Side',
    dessert: 'Dessert',
  },
  es: {
    heroLine1: 'Cada Plato',
    heroLine2: 'Cuenta una Historia',
    subtitle: 'Guías de emplatado, alérgenos y notas de servicio para todo el menú.',
    failedToLoadDishes: 'Error al cargar los platos',
    appetizer: 'Aperitivo',
    entree: 'Entrada',
    side: 'Acompañamiento',
    dessert: 'Postre',
  },
} as const;

function getFilterOptions(language: Language): { value: DishFilterMode; label: string }[] {
  const t = STRINGS[language];
  const c = getCommon(language);
  return [
    { value: 'all', label: c.all },
    { value: 'appetizer', label: t.appetizer },
    { value: 'entree', label: t.entree },
    { value: 'side', label: t.side },
    { value: 'dessert', label: t.dessert },
  ];
}

function getSortOptions(language: Language): { value: ProductSortMode; label: string }[] {
  const c = getCommon(language);
  return [
    { value: 'name', label: c.sortAZ },
    { value: 'recent', label: c.sortNew },
    { value: 'featured', label: c.featured },
  ];
}

const DishGuide = () => {
  const { language, setLanguage } = useLanguage();
  const t = STRINGS[language];
  const c = getCommon(language);
  const filterOptions = useMemo(() => getFilterOptions(language), [language]);
  const sortOptions = useMemo(() => getSortOptions(language), [language]);
  const isMobile = useIsMobile();
  const { togglePin, isPinned } = usePinnedRecipes();
  const [searchParams, setSearchParams] = useSearchParams();
  const slugParam = searchParams.get('slug');

  const {
    filteredDishes,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortMode,
    setSortMode,
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

  const headerLeft = selectedDish ? (
    <button
      onClick={handleClearSelection}
      className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
      title={c.back}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  ) : undefined;

  const headerToolbar = !selectedDish ? (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 max-w-[200px] min-w-[120px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={c.search}
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
      <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5">
        {filterOptions.map(opt => (
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
      <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5">
        {sortOptions.map(opt => (
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
  ) : selectedDish ? (
    <NavbarBookmark
      pinned={isPinned(selectedDish.slug)}
      onToggle={() => togglePin(selectedDish.slug)}
    />
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
      headerToolbar={headerToolbar}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <span className="text-[24px] h-[24px] leading-[24px]">⚠️</span>
          <p className="text-sm text-muted-foreground">{t.failedToLoadDishes}</p>
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
            language={language}
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
              {t.heroLine1}
              <br />
              <span className="font-bold">{t.heroLine2}</span> 🍽️
            </p>
            <p className="text-sm text-muted-foreground mt-2">{t.subtitle}</p>
          </div>
          {/* Mobile filter/sort chips — scrollable rows, below lg only */}
          <div className="lg:hidden -mx-4 px-4 mb-4 space-y-2">
            <div
              className="flex gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilterMode(opt.value)}
                  className={cn(
                    'flex-none h-8 px-4 rounded-full text-[12px] font-semibold whitespace-nowrap',
                    'transition-all duration-150 active:scale-[0.96]',
                    filterMode === opt.value
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div
              className="flex gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSortMode(opt.value)}
                  className={cn(
                    'flex-none h-7 px-3.5 rounded-full text-[11px] font-semibold whitespace-nowrap',
                    'transition-all duration-150 active:scale-[0.96]',
                    sortMode === opt.value
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
