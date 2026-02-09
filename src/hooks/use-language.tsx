import { useState, useEffect, useCallback } from 'react';

export type Language = 'en' | 'es';

const STORAGE_KEY = 'alamo-prime-language';

/**
 * Hook for persistent language preference
 * Stores in localStorage, syncs across tabs
 */
export function useLanguage(defaultLanguage: Language = 'en') {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'es') {
        return stored;
      }
    }
    return defaultLanguage;
  });

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  // Listen for changes from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'en' || e.newValue === 'es')) {
        setLanguageState(e.newValue);
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  return { language, setLanguage };
}
