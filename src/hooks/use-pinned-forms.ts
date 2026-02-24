/**
 * usePinnedForms Hook
 *
 * Lightweight localStorage-backed hook for pinning form templates.
 * Pinned forms display first in the grid.
 *
 * Exact clone of usePinnedRecipes pattern.
 * localStorage key: 'alamo-pinned-forms'
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'alamo-pinned-forms';

function readPinned(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writePinned(slugs: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
}

/**
 * Lightweight localStorage-backed hook for pinning form templates.
 * Pinned forms display first in the grid.
 */
export function usePinnedForms() {
  const [pinned, setPinned] = useState<string[]>(readPinned);

  const togglePin = useCallback((slug: string) => {
    setPinned(prev => {
      const next = prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : [...prev, slug];
      writePinned(next);
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (slug: string) => pinned.includes(slug),
    [pinned],
  );

  /** Sort a form template array so pinned items come first (stable order otherwise). */
  const sortPinnedFirst = useCallback(
    <T extends { slug: string }>(items: T[]): T[] => {
      if (pinned.length === 0) return items;
      const set = new Set(pinned);
      return [...items].sort((a, b) => {
        const ap = set.has(a.slug) ? 0 : 1;
        const bp = set.has(b.slug) ? 0 : 1;
        return ap - bp;
      });
    },
    [pinned],
  );

  return { pinned, togglePin, isPinned, sortPinnedFirst } as const;
}
