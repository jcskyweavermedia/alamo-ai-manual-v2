import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Search, X, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useFormViewer } from '@/hooks/use-form-viewer';
import { FormCard } from '@/components/forms/FormCard';
import { FormsGridSkeleton } from '@/components/forms/FormsGridSkeleton';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    heroLine1: 'Fill Out',
    heroLine2: 'Forms',
    tagline: 'Find and fill out operational forms.',
    searchPlaceholder: 'Search forms...',
    pinnedLabel: 'PINNED',
    allFormsLabel: 'ALL FORMS',
    emptyTitle: 'No forms found',
    emptySubtitle: 'Try a different search term.',
    clearSearch: 'Clear Search',
    loadError: 'Failed to load forms',
    noForms: 'No forms available yet.',
  },
  es: {
    heroLine1: 'Llena',
    heroLine2: 'Formularios',
    tagline: 'Encuentra y llena formularios operativos.',
    searchPlaceholder: 'Buscar formularios...',
    pinnedLabel: 'FIJADOS',
    allFormsLabel: 'TODOS LOS FORMULARIOS',
    emptyTitle: 'No se encontraron formularios',
    emptySubtitle: 'Intenta con otro termino de busqueda.',
    clearSearch: 'Limpiar busqueda',
    loadError: 'Error al cargar formularios',
    noForms: 'Aun no hay formularios disponibles.',
  },
} as const;

// =============================================================================
// FORMS PAGE COMPONENT
// =============================================================================

const Forms = () => {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const t = STRINGS[language];

  const {
    pinnedTemplates,
    unpinnedTemplates,
    searchQuery,
    setSearchQuery,
    togglePin,
    isPinned,
    isLoading,
    error,
  } = useFormViewer();

  const handleSelect = useCallback(
    (slug: string) => {
      navigate(`/forms/${slug}`);
    },
    [navigate],
  );

  const hasResults = pinnedTemplates.length > 0 || unpinnedTemplates.length > 0;
  const hasPinned = pinnedTemplates.length > 0;

  // ---------------------------------------------------------------------------
  // Header left: search input (matches Recipes.tsx pattern)
  // ---------------------------------------------------------------------------

  const headerToolbar = (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 max-w-[240px] min-w-[120px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className={cn(
            'h-9 w-full rounded-lg border border-input bg-background',
            'pl-8 pr-8 text-sm',
            'ring-offset-background transition-colors duration-150',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            '[&::-webkit-search-cancel-button]:hidden',
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
    </div>
  );

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      headerToolbar={headerToolbar}
    >
      {isLoading ? (
        <div className="py-6">
          <FormsGridSkeleton />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{t.loadError}</p>
        </div>
      ) : !hasResults && !searchQuery ? (
        /* No forms at all (not searching) */
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex items-center justify-center h-14 w-14 rounded-[14px] bg-blue-100 dark:bg-blue-900/30">
            <span className="text-[32px] h-[32px] leading-[32px]">{'\uD83D\uDCCB'}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t.noForms}</p>
        </div>
      ) : (
        <>
          {/* Hero text */}
          <div className="py-6">
            <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
              {t.heroLine1}
              <br />
              <span className="font-bold">{t.heroLine2}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {t.tagline}
            </p>
          </div>

          {/* Search with no results */}
          {!hasResults && searchQuery ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <SearchX className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-base font-medium text-foreground">{t.emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{t.emptySubtitle}</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {t.clearSearch}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pinned section */}
              {hasPinned && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    {t.pinnedLabel}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pinnedTemplates.map((template) => (
                      <FormCard
                        key={template.slug}
                        template={template}
                        language={language}
                        isPinned={true}
                        onTogglePin={togglePin}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Forms section */}
              {unpinnedTemplates.length > 0 && (
                <div className="space-y-3">
                  {hasPinned && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                      {t.allFormsLabel}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {unpinnedTemplates.map((template) => (
                      <FormCard
                        key={template.slug}
                        template={template}
                        language={language}
                        isPinned={isPinned(template.slug)}
                        onTogglePin={togglePin}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
};

export default Forms;
