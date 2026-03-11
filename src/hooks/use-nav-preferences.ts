import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { type NavGroupId, getDefaultExpandedState } from '@/lib/nav-config';

const LOCAL_KEY = 'alamo-nav-prefs';

interface NavPrefs {
  sidebar_groups: Record<NavGroupId, boolean>;
  sidebar_collapsed: boolean;
  // expandedAt tracks when each group was last opened (ms). localStorage only — not synced to Supabase.
  expanded_at: Partial<Record<NavGroupId, number>>;
}

// Shape synced to Supabase (excludes expanded_at which is session-level)
type RemotePrefs = Pick<NavPrefs, 'sidebar_groups' | 'sidebar_collapsed'>;

function readLocal(): NavPrefs {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { sidebar_groups: getDefaultExpandedState(), sidebar_collapsed: true, expanded_at: {} };
    const parsed = JSON.parse(raw) as Partial<NavPrefs>;
    return {
      sidebar_groups: { ...getDefaultExpandedState(), ...(parsed.sidebar_groups ?? {}) },
      sidebar_collapsed: parsed.sidebar_collapsed ?? true,
      expanded_at: parsed.expanded_at ?? {},
    };
  } catch {
    return { sidebar_groups: getDefaultExpandedState(), sidebar_collapsed: true, expanded_at: {} };
  }
}

function writeLocal(prefs: NavPrefs) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
}

/**
 * Nav preferences hook with localStorage (instant) + Supabase (cross-device) sync.
 *
 * Tracks expansion timestamps so the sidebar can auto-collapse the oldest-open
 * group when the nav container overflows (smart responsive behavior).
 */
export function useNavPreferences() {
  const [prefs, setPrefs] = useState<NavPrefs>(() => readLocal());
  const { user, isAuthenticated } = useAuth();
  const hasMerged = useRef(false);

  // On auth: fetch Supabase ui_preferences and merge with localStorage
  useEffect(() => {
    if (!isAuthenticated || !user || hasMerged.current) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('ui_preferences')
          .eq('id', user.id)
          .single();

        if (cancelled) return;
        if (error) {
          console.warn('Failed to fetch ui_preferences from Supabase:', error.message);
          return;
        }

        const remote = data?.ui_preferences as Partial<RemotePrefs> | null;
        const local = readLocal();

        // Remote wins for cross-device sync; fall back to local if remote is empty
        const merged: NavPrefs = {
          sidebar_groups: {
            ...local.sidebar_groups,
            ...(remote?.sidebar_groups ?? {}),
          },
          sidebar_collapsed: remote?.sidebar_collapsed ?? local.sidebar_collapsed,
          expanded_at: local.expanded_at,
        };

        setPrefs(merged);
        writeLocal(merged);
        hasMerged.current = true;
      } catch (err) {
        if (!cancelled) console.warn('Nav prefs sync error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  // Fire-and-forget Supabase write (only sidebar_groups + sidebar_collapsed)
  const persistToSupabase = useCallback(
    (next: NavPrefs) => {
      if (!user) return;
      const remote: RemotePrefs = {
        sidebar_groups: next.sidebar_groups,
        sidebar_collapsed: next.sidebar_collapsed,
      };
      supabase
        .from('profiles')
        .update({ ui_preferences: remote as unknown as Record<string, unknown> })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.warn('Failed to sync nav prefs to Supabase:', error.message);
        });
    },
    [user],
  );

  const toggleGroup = useCallback(
    (id: NavGroupId) => {
      setPrefs(prev => {
        const isOpening = !prev.sidebar_groups[id];
        const next: NavPrefs = {
          ...prev,
          sidebar_groups: { ...prev.sidebar_groups, [id]: isOpening },
          // Record the timestamp only when opening, so we know the oldest-open group
          expanded_at: isOpening
            ? { ...prev.expanded_at, [id]: Date.now() }
            : prev.expanded_at,
        };
        writeLocal(next);
        persistToSupabase(next);
        return next;
      });
    },
    [persistToSupabase],
  );

  const toggleSidebarCollapsed = useCallback(() => {
    setPrefs(prev => {
      const next: NavPrefs = { ...prev, sidebar_collapsed: !prev.sidebar_collapsed };
      writeLocal(next);
      persistToSupabase(next);
      return next;
    });
  }, [persistToSupabase]);

  const isGroupExpanded = useCallback(
    (id: NavGroupId) => prefs.sidebar_groups[id] ?? false,
    [prefs.sidebar_groups],
  );

  /**
   * Returns the ID of the open group expanded longest ago (oldest timestamp),
   * optionally excluding `excludeId` (the group just expanded).
   * Returns null if no other group is open.
   */
  const getOldestOpenGroup = useCallback(
    (excludeId?: NavGroupId): NavGroupId | null => {
      const openGroups = (
        Object.entries(prefs.sidebar_groups) as [NavGroupId, boolean][]
      )
        .filter(([id, open]) => open && id !== excludeId)
        .map(([id]) => id);

      if (openGroups.length === 0) return null;

      // Sort ascending by expandedAt — oldest first
      openGroups.sort(
        (a, b) => (prefs.expanded_at[a] ?? 0) - (prefs.expanded_at[b] ?? 0),
      );

      return openGroups[0];
    },
    [prefs.sidebar_groups, prefs.expanded_at],
  );

  return {
    isGroupExpanded,
    toggleGroup,
    sidebarCollapsed: prefs.sidebar_collapsed,
    toggleSidebarCollapsed,
    getOldestOpenGroup,
  } as const;
}
