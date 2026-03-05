import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Search, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBeerLiquorViewer } from '@/hooks/use-beer-liquor-viewer';
import type { BeerLiquorFilterMode } from '@/hooks/use-beer-liquor-viewer';
import { BeerLiquorList, BeerLiquorCardView } from '@/components/beer-liquor';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';
import type { ProductSortMode } from '@/types/products';
import { NavbarBookmark } from '@/components/shared/NavbarBookmark';
import { usePinnedRecipes } from '@/hooks/use-pinned-recipes';
import { getCommon } from '@/lib/common-strings';
import type { Language } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

const STRINGS = {
  en: {
    heroLine1: 'Poured with',
    heroLine2: 'Character',
    subtitle: 'Draft, bottle, and spirit selections with service notes.',
    failedToLoad: 'Failed to load beer & liquor',
    beer: 'Beer',
    liquor: 'Liquor',
  },
  es: {
    heroLine1: 'Servido con',
    heroLine2: 'Caracter',
    subtitle: 'Seleccion de cervezas de barril, embotelladas y licores con notas de servicio.',
    failedToLoad: 'Error al cargar cervezas y licores',
    beer: 'Cerveza',
    liquor: 'Licor',
  },
} as const;

function getFilterOptions(language: Language): { value: BeerLiquorFilterMode; label: string }[] {
  const t = STRINGS[language];
  const c = getCommon(language);
  return [
    { value: 'all', label: c.all },
    { value: 'Beer', label: t.beer },
    { value: 'Liquor', label: t.liquor },
  ];
}

function getSortOptions(language: Language): { value: ProductSortMode; label: string }[] {
  const c = getCommon(language);
  return [
    { value: 'name', label: c.sortAZ },
    { value: 'recent', label: c.sortNew },
    { value: 'featured', label: c.featured },
  ];
}

const BeerLiquor = () => {
  const { language, setLanguage } = useLanguage();
  const t = STRINGS[language];
  const c = getCommon(language);
  const filterOptions = useMemo(() => getFilterOptions(language), [language]);
  const sortOptions = useMemo(() => getSortOptions(language), [language]);
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { togglePin, isPinned } = usePinnedRecipes();

  const {
    filteredItems,
    groupedItems,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortMode,
    setSortMode,
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

  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleClearSelection = useCallback(() => {
    setActiveAction(null);
    clearSelection();
  }, [clearSelection]);

  const itemNav = useMemo(
    () => selectedItem ? { hasPrev, hasNext, onPrev: goToPrev, onNext: goToNext } : undefined,
    [selectedItem, hasPrev, hasNext, goToPrev, goToNext]
  );

  const headerLeft = selectedItem ? (
    <button
      onClick={handleClearSelection}
      className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
      title={c.back}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  ) : undefined;

  const headerToolbar = selectedItem ? (
    <NavbarBookmark
      pinned={isPinned(selectedItem.slug)}
      onToggle={() => togglePin(selectedItem.slug)}
    />
  ) : (
    <div className="flex items-center gap-1.5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={c.search}
          className={cn(
            'h-8 w-36 sm:w-44 rounded-lg border border-input bg-background',
            'pl-8 pr-6 text-xs',
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
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* Category filter: All / Beer / Liquor */}
      <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilterMode(opt.value)}
            className={cn(
              'h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors duration-150',
              filterMode === opt.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* Sort: A-Z / New / Featured */}
      <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5">
        {sortOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSortMode(opt.value)}
            className={cn(
              'h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors duration-150',
              sortMode === opt.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const aiPanel = selectedItem && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig('beer_liquor', activeAction) ?? null}
      domain="beer_liquor"
      itemName={selectedItem.name}
      itemContext={selectedItem as unknown as Record<string, unknown>}
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
      headerToolbar={headerToolbar}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{t.failedToLoad}</p>
        </div>
      ) : selectedItem ? (
        <>
          <BeerLiquorCardView
            item={selectedItem}
            onBack={handleClearSelection}
            onPrev={goToPrev}
            onNext={goToNext}
            activeAction={activeAction}
            onActionChange={setActiveAction}
            language={language}
          />
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('beer_liquor', activeAction) ?? null : null}
              domain="beer_liquor"
              itemName={selectedItem.name}
              itemContext={selectedItem as unknown as Record<string, unknown>}
            />
          )}
        </>
      ) : (
        <>
          <div className="py-6 flex items-start justify-between">
            <div>
              <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
                {t.heroLine1}
                <br />
                <span className="font-bold">{t.heroLine2}</span> 🍺
              </p>
              <p className="text-sm text-muted-foreground mt-2">{t.subtitle}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin/ingest')}
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Manage in admin"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Mobile filter/sort chips — scrollable rows, below lg only */}
          <div className="lg:hidden -mx-4 px-4 mb-4 space-y-2">
            <div
              className="flex gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilterMode(opt.value)}
                  className={cn(
                    'flex-none h-8 px-4 rounded-full text-[12px] font-semibold whitespace-nowrap',
                    'transition-all duration-150 active:scale-[0.96]',
                    filterMode === opt.value
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div
              className="flex gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSortMode(opt.value)}
                  className={cn(
                    'flex-none h-7 px-3.5 rounded-full text-[11px] font-semibold whitespace-nowrap',
                    'transition-all duration-150 active:scale-[0.96]',
                    sortMode === opt.value
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <BeerLiquorList
            groupedItems={groupedItems}
            totalCount={filteredItems.length}
            onSelectItem={selectItem}
          />
        </>
      )}
    </AppShell>
  );
};

export default BeerLiquor;
