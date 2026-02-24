import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, Search, X } from 'lucide-react';
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

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'prep', label: 'Prep' },
  { value: 'plate', label: 'Plate' },
];

const Recipes = () => {
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const slugParam = searchParams.get('slug');

  const {
    filteredRecipes,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
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

  const headerLeft = !selectedRecipe ? (
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
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load recipes</p>
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
                ? `Back to ${parentPlateRecipe.name}`
                : undefined
            }
            onTapPrepRecipe={navigateToPrepRecipe}
            onPrev={!isCrossLinked ? goToPrev : undefined}
            onNext={!isCrossLinked ? goToNext : undefined}
            activeAction={activeAction}
            onActionChange={setActiveAction}
            fohSlug={selectedRecipe.type === 'plate' ? getFohSlug(selectedRecipe.id) : null}
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
          <div className="py-6">
            <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
              Crafted with
              <br />
              <span className="font-bold">Love & Fire</span> 🔥
            </p>
            <p className="text-sm text-muted-foreground mt-2">Prep sheets and plate specs for every dish on our line.</p>
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
