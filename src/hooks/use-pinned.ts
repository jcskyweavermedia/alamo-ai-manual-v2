import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';

type PinCategory = 'recipes' | 'courses' | 'forms';

const STORAGE_KEYS: Record<PinCategory, string> = {
  recipes: 'alamo-pinned-recipes',
  courses: 'alamo-pinned-courses',
  forms: 'alamo-pinned-forms',
};

function readLocal(category: PinCategory): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[category]);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(category: PinCategory, slugs: string[]) {
  localStorage.setItem(STORAGE_KEYS[category], JSON.stringify(slugs));
}

/**
 * Generic bookmark hook with localStorage + Supabase sync.
 *
 * - Unauthenticated: pure localStorage (identical to previous behavior)
 * - Authenticated: optimistic localStorage writes + async Supabase sync.
 *   On first auth, union-merges localStorage and Supabase so no bookmarks are lost.
 */
export function usePinned(category: PinCategory) {
  const [pinned, setPinned] = useState<string[]>(() => readLocal(category));
  const { user, isAuthenticated } = useAuth();
  const hasMerged = useRef(false);

  // On auth, fetch Supabase bookmarks and union-merge with localStorage
  useEffect(() => {
    if (!isAuthenticated || !user || hasMerged.current) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('bookmarks')
          .eq('id', user.id)
          .single();

        if (cancelled) return;
        if (error) {
          console.warn('Failed to fetch bookmarks from Supabase:', error.message);
          return;
        }

        const remote: string[] =
          data?.bookmarks && typeof data.bookmarks === 'object' && !Array.isArray(data.bookmarks)
            ? (Array.isArray((data.bookmarks as Record<string, unknown>)[category])
                ? (data.bookmarks as Record<string, string[]>)[category]
                : [])
            : [];

        const local = readLocal(category);
        const merged = Array.from(new Set([...local, ...remote]));

        setPinned(merged);
        writeLocal(category, merged);
        hasMerged.current = true;

        // Push merged result back to Supabase if there were local-only items
        if (merged.length !== remote.length || !merged.every(s => remote.includes(s))) {
          const bookmarks = {
            ...((data?.bookmarks as Record<string, unknown>) ?? {}),
            [category]: merged,
          };
          await supabase.from('profiles').update({ bookmarks }).eq('id', user.id);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Bookmark sync error:', err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, user, category]);

  const togglePin = useCallback(
    (slug: string) => {
      setPinned(prev => {
        const next = prev.includes(slug)
          ? prev.filter(s => s !== slug)
          : [...prev, slug];

        // Optimistic localStorage write
        writeLocal(category, next);

        // Async Supabase sync (fire-and-forget)
        if (user) {
          supabase
            .from('profiles')
            .select('bookmarks')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
              const bookmarks = {
                ...((data?.bookmarks as Record<string, unknown>) ?? {}),
                [category]: next,
              };
              return supabase.from('profiles').update({ bookmarks }).eq('id', user.id);
            })
            .then(({ error }) => {
              if (error) console.warn('Failed to sync bookmark to Supabase:', error.message);
            });
        }

        return next;
      });
    },
    [category, user],
  );

  const isPinned = useCallback(
    (slug: string) => pinned.includes(slug),
    [pinned],
  );

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
