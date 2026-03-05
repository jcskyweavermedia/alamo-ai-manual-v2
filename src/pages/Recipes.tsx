import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Search, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRecipeViewer } from '@/hooks/use-recipe-viewer';
import type { FilterMode } from '@/hooks/use-recipe-viewer';
import { useCrossNavLookup } from '@/hooks/use-cross-nav-lookup';
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

const STRINGS = {
  en: {
    heroLine1: 'Crafted with',
    heroLine2: 'Love & Fire',
    subtitle: 'Prep sheets and plate specs for every dish on our line.',
    failedToLoadRecipes: 'Failed to load recipes',
    prep: 'Prep',
    plates: 'Plate Specs',
    apps: 'Apps',
    entrees: 'Entrees',
    sides: 'Sides',
    desserts: 'Desserts',
    backTo: 'Back to',
  },
  es: {
    heroLine1: 'Elaborado con',
    heroLine2: 'Amor y Fuego',
    subtitle: 'Hojas de preparacion y especificaciones de emplatado para cada plato de nuestra linea.',
    failedToLoadRecipes: 'Error al cargar las recetas',
    prep: 'Preparacion',
    plates: 'Espec. de Platos',
    apps: 'Aperitivos',
    entrees: 'Entradas',
    sides: 'Guarniciones',
    desserts: 'Postres',
    backTo: 'Volver a',
  },
} as const;

function getFilterOptions(language: Language): { value: FilterMode; label: string }[] {
  const t = STRINGS[language];
  const c = getCommon(language);
  return [
    { value: 'all', label: c.all },
    { value: 'prep', label: t.prep },
    { value: 'plates', label: t.plates },
    { value: 'apps', label: t.apps },
    { value: 'entrees', label: t.entrees },
    { value: 'sides', label: t.sides },
    { value: 'desserts', label: t.desserts },
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

const Recipes = () => {
  const { language, setLanguage } = useLanguage();
  const t = STRINGS[language];
  const c = getCommon(language);
  const filterOptions = useMemo(() => getFilterOptions(language), [language]);
  const sortOptions = useMemo(() => getSortOptions(language), [language]);
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { togglePin, isPinned } = usePinnedRecipes();
  const [searchParams, setSearchParams] = useSearchParams();
  const slugParam = searchParams.get('slug');

  const {
    filteredRecipes,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortMode,
    setSortMode,
    selectedRecipe,
    selectRecipe,
    clearSelection,
    batchMultiplier,
    setBatchMultiplier,
    hasPrev,
    hasNext,
    goToPrev,
    goToNext,
    isCrossLinked,
    parentPlateRecipe,
    navigateToPrepRecipe,
    navigateBack,
    isLoading,
    error,
  } = useRecipeViewer(slugParam);

  const { getFohSlug } = useCrossNavLookup();

  // Clear ?slug= param after mount so browser back works correctly
  useEffect(() => {
    if (slugParam) setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleNavigateBack = useCallback(() => {
    setActiveAction(null);
    navigateBack();
  }, [navigateBack]);

  // Only show header nav when viewing a recipe AND not cross-linked into a prep recipe
  const itemNav = useMemo(
    () => (selectedRecipe && !isCrossLinked) ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedRecipe, isCrossLinked, hasPrev, hasNext, goToPrev, goToNext]
  );

  const headerLeft = selectedRecipe ? (
    <button
      onClick={handleNavigateBack}
      className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
      title={c.back}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  ) : undefined;

  const headerToolbar = !selectedRecipe ? (
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
      {/* Filter pills — lg+ */}
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
      {/* Sort pills — lg+ */}
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
  ) : selectedRecipe ? (
    <NavbarBookmark
      pinned={isPinned(selectedRecipe.slug)}
      onToggle={() => togglePin(selectedRecipe.slug)}
    />
  ) : undefined;

  const aiPanel = selectedRecipe && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig('recipes', activeAction) ?? null}
      domain="recipes"
      itemName={selectedRecipe.name}
      itemContext={selectedRecipe as unknown as Record<string, unknown>}
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
          <p className="text-sm text-muted-foreground">{t.failedToLoadRecipes}</p>
        </div>
      ) : selectedRecipe ? (
        <>
          <RecipeCardView
            recipe={selectedRecipe}
            batchMultiplier={batchMultiplier}
            onBatchChange={setBatchMultiplier}
            onBack={handleNavigateBack}
            backLabel={
              isCrossLinked && parentPlateRecipe
                ? `${t.backTo} ${parentPlateRecipe.name}`
                : undefined
            }
            onTapPrepRecipe={navigateToPrepRecipe}
            onPrev={!isCrossLinked ? goToPrev : undefined}
            onNext={!isCrossLinked ? goToNext : undefined}
            activeAction={activeAction}
            onActionChange={setActiveAction}
            fohSlug={selectedRecipe.type === 'plate' ? getFohSlug(selectedRecipe.id) : null}
            language={language}
          />
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('recipes', activeAction) ?? null : null}
              domain="recipes"
              itemName={selectedRecipe.name}
              itemContext={selectedRecipe as unknown as Record<string, unknown>}
            />
          )}
        </>
      ) : (
        <>
          <div className="py-6 flex items-start justify-between">
            <div>
              <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
                {t.heroLine1}
                <br />
                <span className="font-bold">{t.heroLine2}</span> 🔥
              </p>
              <p className="text-sm text-muted-foreground mt-2">{t.subtitle}</p>
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
            {/* Filter chips */}
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
            {/* Sort chips */}
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

          <RecipeGrid
            recipes={filteredRecipes}
            onSelectRecipe={selectRecipe}
          />
        </>
      )}
    </AppShell>
  );
};

export default Recipes;
