import { useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useCocktailViewer } from '@/hooks/use-cocktail-viewer';
import { CocktailGrid, CocktailCardView } from '@/components/cocktails';

const Cocktails = () => {
  const { language, setLanguage } = useLanguage();

  const {
    filteredCocktails,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    selectedCocktail,
    selectCocktail,
    clearSelection,
    hasPrev,
    hasNext,
    goToPrev,
    goToNext,
    isLoading,
    error,
  } = useCocktailViewer();

  const itemNav = useMemo(
    () => selectedCocktail ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedCocktail, hasPrev, hasNext, goToPrev, goToNext]
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
          <p className="text-sm text-muted-foreground">Failed to load cocktails</p>
        </div>
      ) : selectedCocktail ? (
        <CocktailCardView
          cocktail={selectedCocktail}
          onBack={clearSelection}
          onPrev={goToPrev}
          onNext={goToNext}
        />
      ) : (
        <CocktailGrid
          cocktails={filteredCocktails}
          searchQuery={searchQuery}
          filterMode={filterMode}
          onSelectCocktail={selectCocktail}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilterMode}
        />
      )}
    </AppShell>
  );
};

export default Cocktails;
