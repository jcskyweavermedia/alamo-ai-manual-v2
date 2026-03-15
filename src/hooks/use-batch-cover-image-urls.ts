import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SIGNED_URL_EXPIRY = 3600; // 1 hour
const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes

/**
 * Batch-converts multiple course-media storage paths to signed URLs.
 * Single Supabase call for all paths. Auto-refreshes before expiry.
 */
export function useBatchCoverImageUrls(storagePaths: (string | null)[]): {
  urlMap: Map<string, string>;
  isLoading: boolean;
} {
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);

  // Filter to only non-null paths that aren't already full URLs
  const rawValidPaths = storagePaths.filter((p): p is string => !!p && !p.startsWith('http'));

  // Stable key for dependency tracking
  const pathsKey = rawValidPaths.slice().sort().join('|');

  // Memoize so validPaths reference is stable across renders with the same paths
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const validPaths = useMemo(() => rawValidPaths, [pathsKey]);

  const fetchUrls = useCallback(async (paths: string[]) => {
    if (paths.length === 0) {
      setUrlMap(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('course-media')
        .createSignedUrls(paths, SIGNED_URL_EXPIRY);

      if (error) {
        console.warn('[useBatchCoverImageUrls] Failed:', error.message);
        setUrlMap(new Map());
        failCountRef.current++;
        if (failCountRef.current >= 2 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (data) {
        failCountRef.current = 0;
        const map = new Map<string, string>();
        for (const item of data) {
          if (item.signedUrl && item.path) {
            map.set(item.path, item.signedUrl);
          }
        }
        setUrlMap(map);
      }
    } catch (err) {
      console.warn('[useBatchCoverImageUrls] Error:', err);
      failCountRef.current++;
      if (failCountRef.current >= 2 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (validPaths.length === 0) {
      setUrlMap(new Map());
      return;
    }

    failCountRef.current = 0;
    void fetchUrls(validPaths);

    // Refresh before expiry
    intervalRef.current = setInterval(() => {
      void fetchUrls(validPaths);
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey, fetchUrls]);

  return { urlMap, isLoading };
}
