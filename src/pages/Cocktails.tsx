import { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCocktailViewer } from '@/hooks/use-cocktail-viewer';
import { CocktailGrid, CocktailCardView } from '@/components/cocktails';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';

const Cocktails = () => {
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();

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

  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleClearSelection = useCallback(() => {
    setActiveAction(null);
    clearSelection();
  }, [clearSelection]);

  const itemNav = useMemo(
    () => selectedCocktail ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedCocktail, hasPrev, hasNext, goToPrev, goToNext]
  );

  const aiPanel = selectedCocktail && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig('cocktails', activeAction) ?? null}
      domain="cocktails"
      itemName={selectedCocktail.name}
      itemContext={selectedCocktail as unknown as Record<string, unknown>}
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
          <p className="text-sm text-muted-foreground">Failed to load cocktails</p>
        </div>
      ) : selectedCocktail ? (
        <>
          <CocktailCardView
            cocktail={selectedCocktail}
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
              actionConfig={activeAction ? getActionConfig('cocktails', activeAction) ?? null : null}
              domain="cocktails"
              itemName={selectedCocktail.name}
              itemContext={selectedCocktail as unknown as Record<string, unknown>}
            />
          )}
        </>
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
