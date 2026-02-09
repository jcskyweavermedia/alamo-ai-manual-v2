/**
 * Hook for managing recent searches
 * 
 * Persists recent search queries to localStorage for quick access.
 * Limits to last N unique searches.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'alamo-prime-recent-searches';
const MAX_RECENT_SEARCHES = 5;

export interface UseRecentSearchesReturn {
  /** Array of recent search queries */
  recentSearches: string[];
  /** Add a search query to recent searches */
  addRecentSearch: (query: string) => void;
  /** Remove a specific search from history */
  removeRecentSearch: (query: string) => void;
  /** Clear all recent searches */
  clearRecentSearches: () => void;
}

/**
 * Manage recent search queries with localStorage persistence
 */
export function useRecentSearches(): UseRecentSearchesReturn {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentSearches));
    } catch {
      // Ignore storage errors
    }
  }, [recentSearches]);

  const addRecentSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    setRecentSearches((prev) => {
      // Remove if already exists (will re-add at front)
      const filtered = prev.filter(
        (s) => s.toLowerCase() !== trimmed.toLowerCase()
      );
      // Add to front, limit to max
      return [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) =>
      prev.filter((s) => s.toLowerCase() !== query.toLowerCase())
    );
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
  }, []);

  return {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };
}
