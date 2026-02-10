import { useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useWineViewer } from '@/hooks/use-wine-viewer';
import { WineGrid, WineCardView } from '@/components/wines';

const Wines = () => {
  const { language, setLanguage } = useLanguage();

  const {
    filteredWines,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    selectedWine,
    selectWine,
    clearSelection,
    hasPrev,
    hasNext,
    goToPrev,
    goToNext,
    isLoading,
    error,
  } = useWineViewer();

  const itemNav = useMemo(
    () => selectedWine ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedWine, hasPrev, hasNext, goToPrev, goToNext]
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
          <p className="text-sm text-muted-foreground">Failed to load wines</p>
        </div>
      ) : selectedWine ? (
        <WineCardView
          wine={selectedWine}
          onBack={clearSelection}
          onPrev={goToPrev}
          onNext={goToNext}
        />
      ) : (
        <WineGrid
          wines={filteredWines}
          searchQuery={searchQuery}
          filterMode={filterMode}
          onSelectWine={selectWine}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilterMode}
        />
      )}
    </AppShell>
  );
};

export default Wines;
