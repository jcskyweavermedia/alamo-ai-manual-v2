import { useState, useMemo, useCallback } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCocktailViewer } from '@/hooks/use-cocktail-viewer';
import type { CocktailFilterMode } from '@/hooks/use-cocktail-viewer';
import { CocktailGrid, CocktailCardView } from '@/components/cocktails';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';

const FILTER_OPTIONS: { value: CocktailFilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'tiki', label: 'Tiki' },
  { value: 'refresher', label: 'Refresher' },
];

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

  const headerLeft = !selectedCocktail ? (
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
      headerLeft={headerLeft}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <span className="text-[24px] h-[24px] leading-[24px]">⚠️</span>
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
        <>
          <div className="py-6">
            <p className="text-2xl sm:text-3xl text-foreground leading-tight">
              Shaken with
              <br />
              <span className="font-bold">Soul</span> 🍸
            </p>
            <p className="text-sm text-muted-foreground mt-2">Signature and classic cocktails with build specs and garnish details.</p>
          </div>
          <CocktailGrid
            cocktails={filteredCocktails}
            onSelectCocktail={selectCocktail}
          />
        </>
      )}
    </AppShell>
  );
};

export default Cocktails;
