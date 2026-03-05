import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCocktailViewer } from '@/hooks/use-cocktail-viewer';
import type { CocktailFilterMode } from '@/hooks/use-cocktail-viewer';
import { useBarRecipes } from '@/hooks/use-supabase-bar-recipes';
import { useBarRecipeViewer } from '@/hooks/use-bar-recipe-viewer';
import { CocktailGrid, CocktailCardView } from '@/components/cocktails';
import { RecipeGrid, RecipeCardView } from '@/components/recipes';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';
import type { ProductSortMode } from '@/types/products';
import { NavbarBookmark } from '@/components/shared/NavbarBookmark';
import { usePinnedRecipes } from '@/hooks/use-pinned-recipes';
import { getCommon } from '@/lib/common-strings';
import type { Language } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

type BarTab = 'all' | 'cocktails' | 'bar-prep';

const STRINGS = {
  en: {
    cocktails: 'Cocktails',
    barPrep: 'Bar Prep',
    classic: 'Classic',
    modern: 'Modern',
    tiki: 'Tiki',
    refresher: 'Refresher',
    heroLine1Cocktails: 'Shaken with',
    heroLine2Cocktails: 'Soul',
    heroLine1BarPrep: 'House-Made Syrups,',
    heroLine2BarPrep: 'Infusions & More',
    subtitleBarPrep: 'Bar prep recipes for syrups, infusions, and house-made ingredients.',
    subtitleAll: 'Cocktails, syrups, infusions, and everything behind the bar.',
    subtitleCocktails: 'Signature and classic cocktails with build specs and garnish details.',
    sectionCocktails: 'Cocktails',
    sectionBarPrep: 'Bar Prep',
    noCocktailsFound: 'No cocktails found',
    noBarRecipesFound: 'No bar recipes found',
    failedCocktails: 'cocktails',
    failedBarRecipes: 'bar recipes',
    failedBarProgram: 'bar program',
  },
  es: {
    cocktails: 'Cocteles',
    barPrep: 'Prep de Barra',
    classic: 'Clasico',
    modern: 'Moderno',
    tiki: 'Tiki',
    refresher: 'Refrescante',
    heroLine1Cocktails: 'Preparados con',
    heroLine2Cocktails: 'Alma',
    heroLine1BarPrep: 'Jarabes Artesanales,',
    heroLine2BarPrep: 'Infusiones y Mas',
    subtitleBarPrep: 'Recetas de preparacion de barra: jarabes, infusiones e ingredientes artesanales.',
    subtitleAll: 'Cocteles, jarabes, infusiones y todo detras de la barra.',
    subtitleCocktails: 'Cocteles clasicos y de la casa con especificaciones de preparacion y decoracion.',
    sectionCocktails: 'Cocteles',
    sectionBarPrep: 'Prep de Barra',
    noCocktailsFound: 'No se encontraron cocteles',
    noBarRecipesFound: 'No se encontraron recetas de barra',
    failedCocktails: 'los cocteles',
    failedBarRecipes: 'las recetas de barra',
    failedBarProgram: 'el programa de barra',
  },
} as const;

function getTabOptions(language: Language): { value: BarTab; label: string }[] {
  const t = STRINGS[language];
  const c = getCommon(language);
  return [
    { value: 'all', label: c.all },
    { value: 'cocktails', label: t.cocktails },
    { value: 'bar-prep', label: t.barPrep },
  ];
}

function getFilterOptions(language: Language): { value: CocktailFilterMode; label: string }[] {
  const t = STRINGS[language];
  const c = getCommon(language);
  return [
    { value: 'all', label: c.all },
    { value: 'classic', label: t.classic },
    { value: 'modern', label: t.modern },
    { value: 'tiki', label: t.tiki },
    { value: 'refresher', label: t.refresher },
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

const Cocktails = () => {
  const { language, setLanguage } = useLanguage();
  const t = STRINGS[language];
  const c = getCommon(language);
  const tabOptions = useMemo(() => getTabOptions(language), [language]);
  const filterOptions = useMemo(() => getFilterOptions(language), [language]);
  const sortOptions = useMemo(() => getSortOptions(language), [language]);
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { togglePin, isPinned } = usePinnedRecipes();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read ?tab= from URL on mount, then clear it
  const tabParam = searchParams.get('tab');
  const [barTab, setBarTab] = useState<BarTab>(
    tabParam === 'bar-prep' ? 'bar-prep' : tabParam === 'cocktails' ? 'cocktails' : 'all'
  );

  useEffect(() => {
    if (tabParam) {
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAllMode = barTab === 'all';
  const isCocktailMode = barTab === 'cocktails';
  const isBarPrepMode = barTab === 'bar-prep';
  const showCocktails = isAllMode || isCocktailMode;
  const showBarPrep = isAllMode || isBarPrepMode;

  // Cocktail viewer
  const {
    filteredCocktails,
    searchQuery: cocktailSearchQuery,
    setSearchQuery: setCocktailSearchQuery,
    filterMode,
    setFilterMode,
    sortMode: cocktailSortMode,
    setSortMode: setCocktailSortMode,
    selectedCocktail,
    selectCocktail,
    clearSelection: clearCocktailSelection,
    hasPrev: cocktailHasPrev,
    hasNext: cocktailHasNext,
    goToPrev: cocktailGoToPrev,
    goToNext: cocktailGoToNext,
    isLoading: cocktailLoading,
    error: cocktailError,
  } = useCocktailViewer();

  // Bar recipe viewer
  const { recipes: barData, isLoading: barDataLoading, error: barDataError } = useBarRecipes();
  const {
    recipes: filteredBarRecipes,
    searchQuery: barSearchQuery,
    setSearchQuery: setBarSearchQuery,
    sortMode: barSortMode,
    setSortMode: setBarSortMode,
    selectedRecipe,
    selectRecipe,
    clearSelection: clearBarSelection,
    batchMultiplier,
    setBatchMultiplier,
    hasPrev: barHasPrev,
    hasNext: barHasNext,
    goPrev: barGoPrev,
    goNext: barGoNext,
  } = useBarRecipeViewer(barData);

  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Derived active-tab state
  const activeSearchQuery = isBarPrepMode ? barSearchQuery : cocktailSearchQuery;
  const setActiveSearchQuery = useCallback((q: string) => {
    if (isAllMode) { setCocktailSearchQuery(q); setBarSearchQuery(q); }
    else if (isCocktailMode) setCocktailSearchQuery(q);
    else setBarSearchQuery(q);
  }, [isAllMode, isCocktailMode, setCocktailSearchQuery, setBarSearchQuery]);
  const activeSortMode = isBarPrepMode ? barSortMode : cocktailSortMode;
  const setActiveSortMode = useCallback((mode: ProductSortMode) => {
    if (isAllMode) { setCocktailSortMode(mode); setBarSortMode(mode); }
    else if (isCocktailMode) setCocktailSortMode(mode);
    else setBarSortMode(mode);
  }, [isAllMode, isCocktailMode, setCocktailSortMode, setBarSortMode]);
  const activeLoading = showCocktails && cocktailLoading || showBarPrep && barDataLoading;
  const activeError = isCocktailMode ? cocktailError : isBarPrepMode ? barDataError : (cocktailError || barDataError);
  const hasSelection = !!selectedCocktail || !!selectedRecipe;
  // When a detail is open, detect which type is selected
  const selectedIsCocktail = !!selectedCocktail;
  const selectedIsBarPrep = !!selectedRecipe;

  const handleTabChange = useCallback((tab: BarTab) => {
    setBarTab(tab);
    setActiveAction(null);
    clearCocktailSelection();
    clearBarSelection();
  }, [clearCocktailSelection, clearBarSelection]);

  const handleClearSelection = useCallback(() => {
    setActiveAction(null);
    clearCocktailSelection();
    clearBarSelection();
  }, [clearCocktailSelection, clearBarSelection]);

  /** Navigate from a cocktail ingredient to its linked bar prep recipe */
  const handleTapPrepRecipe = useCallback((slug: string) => {
    const recipe = barData.find(r => r.slug === slug);
    if (recipe) {
      clearCocktailSelection();
      setActiveAction(null);
      selectRecipe(recipe.slug);
    }
  }, [barData, clearCocktailSelection, selectRecipe]);

  const itemNav = useMemo(() => {
    if (selectedIsCocktail) {
      return { hasPrev: cocktailHasPrev, hasNext: cocktailHasNext, onPrev: cocktailGoToPrev, onNext: cocktailGoToNext };
    }
    if (selectedIsBarPrep) {
      return { hasPrev: barHasPrev, hasNext: barHasNext, onPrev: barGoPrev, onNext: barGoNext };
    }
    return undefined;
  }, [selectedIsCocktail, selectedIsBarPrep, cocktailHasPrev, cocktailHasNext, cocktailGoToPrev, cocktailGoToNext, barHasPrev, barHasNext, barGoPrev, barGoNext]);

  // Header left: back button (detail view only)
  const headerLeft = hasSelection ? (
    <button
      onClick={handleClearSelection}
      className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
      title={c.back}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  ) : undefined;

  // Header toolbar: search + tab toggle (grid view, centered)
  const headerToolbar = !hasSelection ? (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 max-w-[200px] min-w-[120px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={activeSearchQuery}
          onChange={e => setActiveSearchQuery(e.target.value)}
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
        {activeSearchQuery && (
          <button
            type="button"
            onClick={() => setActiveSearchQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5">
        {tabOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleTabChange(opt.value)}
            className={cn(
              'min-h-[28px] px-2.5 rounded-md text-[11px] font-semibold',
              'transition-colors duration-150',
              barTab === opt.value
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
            onClick={() => setActiveSortMode(opt.value)}
            className={cn(
              'min-h-[28px] px-2.5 rounded-md text-[11px] font-semibold',
              'transition-colors duration-150',
              activeSortMode === opt.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  ) : hasSelection ? (
    <NavbarBookmark
      pinned={isPinned((selectedCocktail?.slug ?? selectedRecipe?.slug) || '')}
      onToggle={() => togglePin((selectedCocktail?.slug ?? selectedRecipe?.slug) || '')}
    />
  ) : undefined;

  // AI panel (docked, desktop) — domain follows selected item type
  const aiDomain = selectedIsCocktail ? 'cocktails' : 'recipes';
  const aiItemName = selectedIsCocktail ? selectedCocktail?.name : selectedRecipe?.name;
  const aiItemContext = selectedIsCocktail
    ? (selectedCocktail as unknown as Record<string, unknown>)
    : (selectedRecipe as unknown as Record<string, unknown>);

  const aiPanel = hasSelection && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig(aiDomain, activeAction) ?? null}
      domain={aiDomain}
      itemName={aiItemName ?? ''}
      itemContext={aiItemContext ?? {}}
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
      {activeLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activeError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <span className="text-[24px] h-[24px] leading-[24px]">⚠️</span>
          <p className="text-sm text-muted-foreground">
            {c.failedToLoad} {isCocktailMode ? t.failedCocktails : isBarPrepMode ? t.failedBarRecipes : t.failedBarProgram}
          </p>
        </div>
      ) : selectedIsCocktail ? (
        <>
          <CocktailCardView
            cocktail={selectedCocktail!}
            onBack={handleClearSelection}
            onPrev={cocktailGoToPrev}
            onNext={cocktailGoToNext}
            activeAction={activeAction}
            onActionChange={setActiveAction}
            onTapPrepRecipe={handleTapPrepRecipe}
            language={language}
          />
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('cocktails', activeAction) ?? null : null}
              domain="cocktails"
              itemName={selectedCocktail!.name}
              itemContext={selectedCocktail as unknown as Record<string, unknown>}
            />
          )}
        </>
      ) : selectedIsBarPrep ? (
        <>
          <RecipeCardView
            recipe={selectedRecipe!}
            batchMultiplier={batchMultiplier}
            onBatchChange={setBatchMultiplier}
            onBack={handleClearSelection}
            onPrev={barGoPrev}
            onNext={barGoNext}
            activeAction={activeAction}
            onActionChange={setActiveAction}
            language={language}
          />
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('recipes', activeAction) ?? null : null}
              domain="recipes"
              itemName={selectedRecipe!.name}
              itemContext={selectedRecipe as unknown as Record<string, unknown>}
            />
          )}
        </>
      ) : (
        <>
          {/* Hero text */}
          <div className="py-6 flex items-start justify-between">
            <div>
              <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
                {isBarPrepMode ? t.heroLine1BarPrep : t.heroLine1Cocktails}
                <br />
                <span className="font-bold">{isBarPrepMode ? t.heroLine2BarPrep : t.heroLine2Cocktails}</span>
                {!isBarPrepMode && ' 🍸'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {isBarPrepMode
                  ? t.subtitleBarPrep
                  : isAllMode
                    ? t.subtitleAll
                    : t.subtitleCocktails}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin/ingest')}
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Manage in admin"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mobile filter/sort chips — scrollable rows, below lg only */}
          <div className="lg:hidden -mx-4 px-4 mb-4 space-y-2">
            <div
              className="flex gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {tabOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleTabChange(opt.value)}
                  className={cn(
                    'flex-none h-8 px-4 rounded-full text-[12px] font-semibold whitespace-nowrap',
                    'transition-all duration-150 active:scale-[0.96]',
                    barTab === opt.value
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
                  onClick={() => setActiveSortMode(opt.value)}
                  className={cn(
                    'flex-none h-7 px-3.5 rounded-full text-[11px] font-semibold whitespace-nowrap',
                    'transition-all duration-150 active:scale-[0.96]',
                    activeSortMode === opt.value
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {isCocktailMode && (
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
                      'flex-none h-7 px-3.5 rounded-full text-[11px] font-semibold whitespace-nowrap',
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
            )}
          </div>

          {/* Style filter -- cocktails-only mode, desktop only */}
          {isCocktailMode && (
            <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5 w-fit mb-4">
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
          )}

          {/* Cocktails grid */}
          {showCocktails && filteredCocktails.length > 0 && (
            <>
              {isAllMode && (
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-3">{t.sectionCocktails}</p>
              )}
              <CocktailGrid
                cocktails={filteredCocktails}
                onSelectCocktail={selectCocktail}
              />
            </>
          )}

          {/* Bar prep grid */}
          {showBarPrep && filteredBarRecipes.length > 0 && (
            <div className={showCocktails && filteredCocktails.length > 0 ? 'mt-8' : ''}>
              {isAllMode && (
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-3">{t.sectionBarPrep}</p>
              )}
              <RecipeGrid
                recipes={filteredBarRecipes}
                onSelectRecipe={selectRecipe}
              />
            </div>
          )}

          {/* Empty state */}
          {showCocktails && filteredCocktails.length === 0 && showBarPrep && filteredBarRecipes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-muted-foreground">{c.noResults}</p>
            </div>
          )}
          {isCocktailMode && filteredCocktails.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-muted-foreground">{t.noCocktailsFound}</p>
            </div>
          )}
          {isBarPrepMode && filteredBarRecipes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-muted-foreground">{t.noBarRecipesFound}</p>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
};

export default Cocktails;
