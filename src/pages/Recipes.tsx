import { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRecipeViewer } from '@/hooks/use-recipe-viewer';
import { RecipeGrid, RecipeCardView } from '@/components/recipes';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';

const Recipes = () => {
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();

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
  } = useRecipeViewer();

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
        <RecipeGrid
          recipes={filteredRecipes}
          searchQuery={searchQuery}
          filterMode={filterMode}
          onSelectRecipe={selectRecipe}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilterMode}
        />
      )}
    </AppShell>
  );
};

export default Recipes;
