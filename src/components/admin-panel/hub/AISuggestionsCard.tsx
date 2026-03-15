// =============================================================================
// AISuggestionsCard -- Container for AI suggestion items
// =============================================================================

import { Sparkles, Inbox } from 'lucide-react';
import type { AISuggestion } from '@/types/admin-panel';
import { ADMIN_STRINGS } from '../strings';
import { SuggestionItem } from './SuggestionItem';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AISuggestionsCardProps {
  suggestions: AISuggestion[];
  language: 'en' | 'es';
  isLoading?: boolean;
  onAction?: (suggestionId: string, actionLabel: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AISuggestionsCard({ suggestions, language, isLoading, onAction }: AISuggestionsCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-orange-500">
            <Sparkles
              className="h-3.5 w-3.5 text-white"
              style={{ filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.5))' }}
            />
          </div>
          <h3 className="font-semibold text-sm">{t.aiSuggestions}</h3>
          {!isLoading && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/[0.12] text-orange-600 dark:text-orange-400">
              {suggestions.length} {t.pending}
            </span>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="px-4 pb-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 bg-muted rounded" />
                  <div className="h-3 w-3/4 bg-muted rounded" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-7 w-16 bg-muted rounded-lg" />
                    <div className="h-7 w-12 bg-muted rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && suggestions.length === 0 && (
        <div className="px-4 pb-6 flex flex-col items-center justify-center text-center py-6">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {t.noPendingSuggestions}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t.noPendingSuggestionsHint}
          </p>
        </div>
      )}

      {/* Suggestion list */}
      {!isLoading && suggestions.length > 0 && (
        <div className="px-4 pb-4 space-y-3">
          {suggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              language={language}
              onAction={(actionLabel) => onAction?.(suggestion.id, actionLabel)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
