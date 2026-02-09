/**
 * Hook for managing bookmarked sections
 * 
 * Persists bookmarks to localStorage.
 * Will be extended to sync with Supabase in Step 3.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'alamo-prime-bookmarks';

export interface UseBookmarksReturn {
  /** Array of bookmarked section IDs */
  bookmarks: string[];
  /** Check if a section is bookmarked */
  isBookmarked: (sectionId: string) => boolean;
  /** Add a bookmark */
  addBookmark: (sectionId: string) => void;
  /** Remove a bookmark */
  removeBookmark: (sectionId: string) => void;
  /** Toggle bookmark state */
  toggleBookmark: (sectionId: string) => void;
  /** Clear all bookmarks */
  clearBookmarks: () => void;
}

/**
 * Manage bookmarked manual sections
 */
export function useBookmarks(): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.warn('Failed to save bookmarks:', e);
    }
  }, [bookmarks]);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setBookmarks(JSON.parse(e.newValue));
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isBookmarked = useCallback(
    (sectionId: string) => bookmarks.includes(sectionId),
    [bookmarks]
  );

  const addBookmark = useCallback((sectionId: string) => {
    setBookmarks((prev) => {
      if (prev.includes(sectionId)) return prev;
      return [...prev, sectionId];
    });
  }, []);

  const removeBookmark = useCallback((sectionId: string) => {
    setBookmarks((prev) => prev.filter((id) => id !== sectionId));
  }, []);

  const toggleBookmark = useCallback((sectionId: string) => {
    setBookmarks((prev) => {
      if (prev.includes(sectionId)) {
        return prev.filter((id) => id !== sectionId);
      }
      return [...prev, sectionId];
    });
  }, []);

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
  }, []);

  return {
    bookmarks,
    isBookmarked,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    clearBookmarks,
  };
}
