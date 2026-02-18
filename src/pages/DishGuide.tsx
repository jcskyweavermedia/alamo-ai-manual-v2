import { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDishViewer } from '@/hooks/use-dish-viewer';
import { DishGrid, DishCardView } from '@/components/dishes';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';

const DishGuide = () => {
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();

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

  // AI action state (lifted from CardView)
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Clear action when deselecting a dish
  const handleClearSelection = useCallback(() => {
    setActiveAction(null);
    clearSelection();
  }, [clearSelection]);

  const itemNav = useMemo(
    () => selectedDish ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedDish, hasPrev, hasNext, goToPrev, goToNext]
  );

  // Desktop docked AI panel (only when a dish is selected and action is active)
  const aiPanel = selectedDish && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig('dishes', activeAction) ?? null}
      domain="dishes"
      itemName={selectedDish.menuName}
      itemContext={selectedDish as unknown as Record<string, unknown>}
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
          <p className="text-sm text-muted-foreground">Failed to load dishes</p>
        </div>
      ) : selectedDish ? (
        <>
          <DishCardView
            dish={selectedDish}
            onBack={handleClearSelection}
            onSwipePrev={goToPrev}
            onSwipeNext={goToNext}
            activeAction={activeAction}
            onActionChange={setActiveAction}
          />
          {/* Mobile: bottom drawer */}
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('dishes', activeAction) ?? null : null}
              domain="dishes"
              itemName={selectedDish.menuName}
              itemContext={selectedDish as unknown as Record<string, unknown>}
            />
          )}
        </>
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
