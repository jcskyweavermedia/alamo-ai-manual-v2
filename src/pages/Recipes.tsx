import { useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useRecipeViewer } from '@/hooks/use-recipe-viewer';
import { RecipeGrid, RecipeCardView } from '@/components/recipes';

const Recipes = () => {
  const { language, setLanguage } = useLanguage();

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

  // Only show header nav when viewing a recipe AND not cross-linked into a prep recipe
  const itemNav = useMemo(
    () => (selectedRecipe && !isCrossLinked) ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedRecipe, isCrossLinked, hasPrev, hasNext, goToPrev, goToNext]
  );

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      itemNav={itemNav}
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
        <RecipeCardView
          recipe={selectedRecipe}
          batchMultiplier={batchMultiplier}
          onBatchChange={setBatchMultiplier}
          onBack={navigateBack}
          backLabel={
            isCrossLinked && parentPlateRecipe
              ? `Back to ${parentPlateRecipe.name}`
              : undefined
          }
          onTapPrepRecipe={navigateToPrepRecipe}
          onPrev={!isCrossLinked ? goToPrev : undefined}
          onNext={!isCrossLinked ? goToNext : undefined}
        />
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
