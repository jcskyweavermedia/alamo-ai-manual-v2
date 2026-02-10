import { useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useDishViewer } from '@/hooks/use-dish-viewer';
import { DishGrid, DishCardView } from '@/components/dishes';

const DishGuide = () => {
  const { language, setLanguage } = useLanguage();

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
  } = useDishViewer();

  const itemNav = useMemo(
    () => selectedDish ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedDish, hasPrev, hasNext, goToPrev, goToNext]
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
          <p className="text-sm text-muted-foreground">Failed to load dishes</p>
        </div>
      ) : selectedDish ? (
        <DishCardView
          dish={selectedDish}
          onBack={clearSelection}
          onSwipePrev={goToPrev}
          onSwipeNext={goToNext}
        />
      ) : (
        <DishGrid
          dishes={filteredDishes}
          searchQuery={searchQuery}
          filterMode={filterMode}
          onSelectDish={selectDish}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilterMode}
        />
      )}
    </AppShell>
  );
};

export default DishGuide;
