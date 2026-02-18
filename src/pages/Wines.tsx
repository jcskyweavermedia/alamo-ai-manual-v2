import { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWineViewer } from '@/hooks/use-wine-viewer';
import { WineGrid, WineCardView } from '@/components/wines';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';

const Wines = () => {
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();

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

  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleClearSelection = useCallback(() => {
    setActiveAction(null);
    clearSelection();
  }, [clearSelection]);

  const itemNav = useMemo(
    () => selectedWine ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedWine, hasPrev, hasNext, goToPrev, goToNext]
  );

  const aiPanel = selectedWine && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig('wines', activeAction) ?? null}
      domain="wines"
      itemName={selectedWine.name}
      itemContext={selectedWine as unknown as Record<string, unknown>}
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
          <p className="text-sm text-muted-foreground">Failed to load wines</p>
        </div>
      ) : selectedWine ? (
        <>
          <WineCardView
            wine={selectedWine}
            onBack={handleClearSelection}
            onPrev={goToPrev}
            onNext={goToNext}
            activeAction={activeAction}
            onActionChange={setActiveAction}
          />
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('wines', activeAction) ?? null : null}
              domain="wines"
              itemName={selectedWine.name}
              itemContext={selectedWine as unknown as Record<string, unknown>}
            />
          )}
        </>
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
