import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { PlateSpecDraft, FohPlateSpecDraft } from '@/types/ingestion';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useGenerateDishGuide() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { session } = useAuth();

  const generate = useCallback(async (
    draft: PlateSpecDraft,
    sessionId: string | null,
  ): Promise<FohPlateSpecDraft | null> => {
    if (!session?.access_token) {
      toast.error('Please sign in');
      return null;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/ingest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            mode: 'generate-dish-guide',
            sessionId,
            plateSpec: draft,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed: ${response.status}`);
      }

      const data = await response.json();
      return data.dishGuide as FohPlateSpecDraft;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate dish guide';
      toast.error(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [session?.access_token]);

  return { generate, isGenerating };
}
