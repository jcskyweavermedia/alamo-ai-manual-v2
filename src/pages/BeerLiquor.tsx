import { useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useBeerLiquorViewer } from '@/hooks/use-beer-liquor-viewer';
import { BeerLiquorList, BeerLiquorCardView } from '@/components/beer-liquor';

const BeerLiquor = () => {
  const { language, setLanguage } = useLanguage();

  const {
    filteredItems,
    groupedItems,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
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

  const itemNav = useMemo(
    () => selectedItem ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedItem, hasPrev, hasNext, goToPrev, goToNext]
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
          <p className="text-sm text-muted-foreground">Failed to load beer & liquor</p>
        </div>
      ) : selectedItem ? (
        <BeerLiquorCardView
          item={selectedItem}
          onBack={clearSelection}
          onPrev={goToPrev}
          onNext={goToNext}
        />
      ) : (
        <BeerLiquorList
          groupedItems={groupedItems}
          totalCount={filteredItems.length}
          searchQuery={searchQuery}
          filterMode={filterMode}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilterMode}
          onSelectItem={selectItem}
        />
      )}
    </AppShell>
  );
};

export default BeerLiquor;
