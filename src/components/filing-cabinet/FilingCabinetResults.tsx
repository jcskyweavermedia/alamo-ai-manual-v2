import { Search, SearchX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilingCabinetResultCard } from '@/components/filing-cabinet/FilingCabinetResultCard';
import type { FilingCabinetResult } from '@/types/forms';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    initial: 'Search for submissions or select a form type',
    noResults: 'No submissions found',
    submissionsFound: 'submissions found',
    loadMore: 'Load More',
  },
  es: {
    initial: 'Busca env\u00edos o selecciona un tipo de formulario',
    noResults: 'No se encontraron env\u00edos',
    submissionsFound: 'env\u00edos encontrados',
    loadMore: 'Cargar m\u00e1s',
  },
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

interface FilingCabinetResultsProps {
  results: FilingCabinetResult[];
  totalCount: number;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  hasSearched: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  language: 'en' | 'es';
}

export function FilingCabinetResults({
  results,
  totalCount,
  isLoading,
  hasMore,
  loadMore,
  hasSearched,
  selectedId,
  onSelect,
  language,
}: FilingCabinetResultsProps) {
  const t = STRINGS[language];

  // Loading state — skeleton cards
  if (isLoading && results.length === 0) {
    return (
      <div className="px-5 py-3 flex-1 overflow-y-auto space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[72px] rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Initial state — no search yet
  if (!hasSearched) {
    return (
      <div className="px-5 py-3 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center gap-3 min-h-[200px]">
        <Search className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground max-w-[240px]">
          {t.initial}
        </p>
      </div>
    );
  }

  // No results
  if (hasSearched && results.length === 0) {
    return (
      <div className="px-5 py-3 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center gap-3 min-h-[200px]">
        <SearchX className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t.noResults}</p>
      </div>
    );
  }

  // Results list
  return (
    <div className="px-5 py-3 flex-1 overflow-y-auto">
      <div className="space-y-2">
        {results.map((result) => (
          <FilingCabinetResultCard
            key={result.id}
            result={result}
            language={language}
            isSelected={selectedId === result.id}
            onClick={() => onSelect(result.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="pt-4 pb-2 flex flex-col items-center gap-2">
        {/* Count */}
        <p className="text-xs text-muted-foreground">
          {totalCount} {t.submissionsFound}
        </p>

        {/* Load More */}
        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className={cn(
              'inline-flex items-center gap-1.5',
              'px-4 py-1.5 rounded-full',
              'text-xs font-medium',
              'bg-orange-500 text-white',
              'hover:bg-orange-600 active:scale-[0.97]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-150',
            )}
          >
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {t.loadMore}
          </button>
        )}
      </div>
    </div>
  );
}
