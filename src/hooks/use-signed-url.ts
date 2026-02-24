/**
 * useSignedUrl Hook
 *
 * Generates a signed URL for a file in the private 'form-attachments' bucket.
 * Uses TanStack Query with 50-min stale time (refreshes before the 60-min expiry).
 *
 * Pass `null` to disable the query (e.g., when no path is available yet).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// CONSTANTS
// =============================================================================

const BUCKET = 'form-attachments';
const SIGNED_URL_EXPIRY = 3600; // 60 minutes in seconds
const STALE_TIME = 50 * 60 * 1000; // 50 minutes — refresh before expiry

// =============================================================================
// HOOK
// =============================================================================

export function useSignedUrl(path: string | null) {
  const { data: url = null, isLoading, error } = useQuery({
    queryKey: ['signed-url', path],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path!, SIGNED_URL_EXPIRY);

      if (error) throw error;

      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: STALE_TIME,
    gcTime: 60 * 60 * 1000, // 60 minutes
    retry: 2,
  });

  return { url, isLoading, error: error as Error | null };
}
