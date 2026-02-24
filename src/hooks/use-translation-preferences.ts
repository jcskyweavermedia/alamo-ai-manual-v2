/**
 * useTranslationPreferences Hook
 *
 * Persists category-based translation preferences to localStorage.
 * Default: procedure + trainingNotes ON, name + ingredients OFF.
 */

import { useState, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryPrefs {
  name: boolean;
  ingredients: boolean;
  procedure: boolean;
  trainingNotes: boolean;
}

interface TranslationPrefs {
  prep_recipes: CategoryPrefs;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const STORAGE_KEY = 'alamo-prime-translate-prefs';

const DEFAULT_PREFS: TranslationPrefs = {
  prep_recipes: {
    name: false,
    ingredients: false,
    procedure: true,
    trainingNotes: true,
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function loadPrefs(): TranslationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<TranslationPrefs>;
    return {
      prep_recipes: { ...DEFAULT_PREFS.prep_recipes, ...parsed.prep_recipes },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function persistPrefs(prefs: TranslationPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// =============================================================================
// HOOK
// =============================================================================

export function useTranslationPreferences() {
  const [prefs, setPrefsState] = useState<TranslationPrefs>(loadPrefs);

  const setCategory = useCallback(
    (table: keyof TranslationPrefs, category: keyof CategoryPrefs, value: boolean) => {
      setPrefsState((prev) => {
        const next = {
          ...prev,
          [table]: { ...prev[table], [category]: value },
        };
        persistPrefs(next);
        return next;
      });
    },
    [],
  );

  const getActiveCategories = useCallback(
    (table: keyof TranslationPrefs): Set<string> => {
      const tablePrefs = prefs[table];
      const active = new Set<string>();
      for (const [key, enabled] of Object.entries(tablePrefs)) {
        if (enabled) active.add(key);
      }
      return active;
    },
    [prefs],
  );

  return { prefs, setCategory, getActiveCategories };
}
