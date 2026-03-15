import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SIGNED_URL_EXPIRY = 3600; // 1 hour
const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes

/**
 * Converts a course-media storage path to a fresh signed URL.
 * Auto-refreshes before expiry.
 */
export function useCoverImageUrl(storagePath: string | null): {
  url: string | null;
  isLoading: boolean;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);

  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    failCountRef.current = 0;

    async function fetchSignedUrl() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('course-media')
          .createSignedUrl(storagePath!, SIGNED_URL_EXPIRY);

        if (!cancelled && data?.signedUrl) {
          setUrl(data.signedUrl);
          failCountRef.current = 0;
        } else if (error) {
          console.warn('[useCoverImageUrl] Failed to create signed URL:', error.message);
          if (!cancelled) setUrl(null);
          failCountRef.current++;
          if (failCountRef.current >= 2 && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        console.warn('[useCoverImageUrl] Error:', err);
        if (!cancelled) setUrl(null);
        failCountRef.current++;
        if (failCountRef.current >= 2 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchSignedUrl();

    // Refresh before expiry
    intervalRef.current = setInterval(() => {
      void fetchSignedUrl();
    }, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [storagePath]);

  return { url, isLoading };
}
