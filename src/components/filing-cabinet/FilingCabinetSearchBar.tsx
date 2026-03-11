import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: { placeholder: 'Search submissions...' },
  es: { placeholder: 'Buscar envíos...' },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface FilingCabinetSearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  isLoading: boolean;
  language: 'en' | 'es';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FilingCabinetSearchBar({
  query,
  setQuery,
  isLoading,
  language,
}: FilingCabinetSearchBarProps) {
  const t = STRINGS[language];

  return (
    <div className="relative">
      {/* Left icon — Search or Loader */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        ) : (
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.placeholder}
        className={cn(
          'h-9 w-full rounded-lg',
          'border border-input bg-background',
          'pl-9 pr-9 text-xs',
          'placeholder:text-muted-foreground/60',
          'focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50',
          'transition-colors',
        )}
      />

      {/* Clear button */}
      {query.length > 0 && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'flex items-center justify-center',
            'h-4 w-4 rounded-full',
            'text-muted-foreground hover:text-foreground',
            'transition-colors',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
