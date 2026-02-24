/**
 * Hook for searching manual content via Supabase full-text search
 * 
 * Uses the search_manual_v2 RPC function (FTS-only mode, no embedding).
 * Includes performance optimizations and robust error handling.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, type Language } from './use-language';

// =============================================================================
// TYPES
// =============================================================================

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  snippet: string;
  category: string;
  tags: string[];
  rank: number;
  filePath: string;
}

export interface UseManualSearchReturn {
  /** Search results */
  results: SearchResult[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether a search has been performed */
  hasSearched: boolean;
  /** Retry function for error recovery */
  retry: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Sanitize search query to prevent FTS issues
 * - Trim whitespace
 * - Remove special PostgreSQL FTS characters that could cause syntax errors
 * - Collapse multiple spaces
 */
function sanitizeQuery(query: string): string {
  return query
    .trim()
    // Remove characters that can break tsquery
    .replace(/[&|!:*()'"<>\\]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// CACHE CONFIGURATION
// =============================================================================

const CACHE_CONFIG = {
  // Keep successful searches fresh for 2 minutes
  staleTime: 2 * 60 * 1000,
  // Keep in cache for 10 minutes (for back navigation)
  gcTime: 10 * 60 * 1000,
  // Retry failed queries up to 2 times
  retry: 2,
  // Exponential backoff for retries
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000),
} as const;

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Search manual content
 * 
 * @param query - Search query string
 * @param language - Language to search in (optional, uses context if not provided)
 * @param enabled - Whether to enable the query (default: true)
 */
export function useManualSearch(
  query: string,
  language?: Language,
  enabled = true
): UseManualSearchReturn {
  const { language: contextLanguage } = useLanguage();
  const effectiveLanguage = language ?? contextLanguage;
  
  // Sanitize query for safe FTS execution
  const sanitizedQuery = sanitizeQuery(query);
  const shouldSearch = enabled && sanitizedQuery.length >= 2;

  const { data, isLoading, error, isFetched, refetch } = useQuery({
    queryKey: ['manual-search', sanitizedQuery, effectiveLanguage],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!sanitizedQuery || sanitizedQuery.length < 2) return [];

      const { data, error } = await supabase
        .rpc('search_manual_v2', {
          search_query: sanitizedQuery,
          search_language: effectiveLanguage,
          result_limit: 20
        });

      if (error) {
        // Log for debugging but throw user-friendly error
        console.error('[Search Error]', error.message, { query: sanitizedQuery });
        throw new Error(
          effectiveLanguage === 'es'
            ? 'Error al buscar. Por favor intenta de nuevo.'
            : 'Search failed. Please try again.'
        );
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.name,
        snippet: row.snippet || '',
        category: row.category,
        tags: row.tags || [],
        rank: row.combined_score,
        filePath: row.file_path,
      }));
    },
    enabled: shouldSearch,
    staleTime: CACHE_CONFIG.staleTime,
    gcTime: CACHE_CONFIG.gcTime,
    retry: CACHE_CONFIG.retry,
    retryDelay: CACHE_CONFIG.retryDelay,
    // Don't refetch on window focus for search queries
    refetchOnWindowFocus: false,
  });

  return {
    results: data ?? [],
    isLoading: shouldSearch && isLoading,
    error: error as Error | null,
    hasSearched: isFetched && shouldSearch,
    retry: refetch,
  };
}
