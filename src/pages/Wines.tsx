import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWineViewer } from '@/hooks/use-wine-viewer';
import type { WineFilterMode } from '@/hooks/use-wine-viewer';
import type { ProductSortMode } from '@/types/products';
import { WineGrid, WineCardView } from '@/components/wines';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';
import { NavbarBookmark } from '@/components/shared/NavbarBookmark';
import { usePinnedRecipes } from '@/hooks/use-pinned-recipes';
import { getCommon } from '@/lib/common-strings';
import type { Language } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

const STRINGS = {
  en: {
    heroLine1: 'Sip, Savor',
    heroLine2: 'Discover',
    subtitle: 'Our curated wine list with tasting notes and pairing suggestions.',
    failedToLoadWines: 'Failed to load wines',
    red: 'Red',
    white: 'White',
    rosé: 'Rosé',
    sparkling: 'Sparkling',
  },
  es: {
    heroLine1: 'Saborea',
    heroLine2: 'Descubre',
    subtitle: 'Nuestra carta de vinos con notas de cata y sugerencias de maridaje.',
    failedToLoadWines: 'Error al cargar los vinos',
    red: 'Tinto',
    white: 'Blanco',
    rosé: 'Rosado',
    sparkling: 'Espumoso',
  },
} as const;

function getFilterOptions(language: Language): { value: WineFilterMode; label: string }[] {
  const t = STRINGS[language];
  const c = getCommon(language);
  return [
    { value: 'all', label: c.all },
    { value: 'red', label: t.red },
    { value: 'white', label: t.white },
    { value: 'rosé', label: t.rosé },
    { value: 'sparkling', label: t.sparkling },
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

const Wines = () => {
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
    filteredWines,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortMode,
    setSortMode,
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

  const headerLeft = selectedWine ? (
    <button
      onClick={handleClearSelection}
      className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
      title={c.back}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  ) : undefined;

  const headerToolbar = !selectedWine ? (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 max-w-[200px] min-w-[120px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={c.search}
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
      <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5">
        {filterOptions.map(opt => (
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
      <div className="hidden lg:flex gap-0.5 rounded-lg bg-muted p-0.5">
        {sortOptions.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSortMode(opt.value)}
            className={cn(
              'min-h-[28px] px-2.5 rounded-md text-[11px] font-semibold',
              'transition-colors duration-150',
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
  ) : selectedWine ? (
    <NavbarBookmark
      pinned={isPinned(selectedWine.slug)}
      onToggle={() => togglePin(selectedWine.slug)}
    />
  ) : undefined;

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
      headerLeft={headerLeft}
      headerToolbar={headerToolbar}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <span className="text-[24px] h-[24px] leading-[24px]">⚠️</span>
          <p className="text-sm text-muted-foreground">{t.failedToLoadWines}</p>
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
            language={language}
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
        <>
          <div className="py-6 flex items-start justify-between">
            <div>
              <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
                {t.heroLine1}
                <br />
                <span className="font-bold">{t.heroLine2}</span> 🍷
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

          <WineGrid
            wines={filteredWines}
            onSelectWine={selectWine}
          />
        </>
      )}
    </AppShell>
  );
};

export default Wines;
