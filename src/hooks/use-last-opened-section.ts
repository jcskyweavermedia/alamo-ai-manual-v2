/**
 * Hook for tracking last opened section
 * 
 * Remembers where the user left off for quick resume.
 * Persists to localStorage.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'alamo-prime-last-section';

export interface UseLastOpenedSectionReturn {
  /** The last opened section ID */
  lastSectionId: string | null;
  /** Update the last opened section */
  setLastSection: (sectionId: string) => void;
  /** Clear the last opened section */
  clearLastSection: () => void;
}

/**
 * Track and persist the last opened manual section
 */
export function useLastOpenedSection(): UseLastOpenedSectionReturn {
  const [lastSectionId, setLastSectionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  // Persist to localStorage on change
  useEffect(() => {
    if (lastSectionId) {
      localStorage.setItem(STORAGE_KEY, lastSectionId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [lastSectionId]);

  const setLastSection = useCallback((sectionId: string) => {
    setLastSectionId(sectionId);
  }, []);

  const clearLastSection = useCallback(() => {
    setLastSectionId(null);
  }, []);

  return {
    lastSectionId,
    setLastSection,
    clearLastSection,
  };
}
