import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { PlateSpecDraft, FohPlateSpecDraft } from '@/types/ingestion';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** Frontend timeout — 2 minutes to match large plate specs with many components */
const TIMEOUT_MS = 120_000;

/** Max retries on transient failures (timeout, 5xx, network) */
const MAX_RETRIES = 2;

/** Delay between retries (ms) */
const RETRY_DELAY_MS = 3_000;

function isRetryable(err: unknown, status?: number): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true; // timeout
  if (status && status >= 500) return true; // server error
  if (err instanceof TypeError) return true; // network failure
  return false;
}

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
    const componentCount = draft.components?.reduce((sum, g) => sum + (g.items?.length ?? 0), 0) ?? 0;
    console.log(`[dish-guide] Starting generation for "${draft.name}" (${componentCount} components)…`);

    let lastError: string = 'Failed to generate dish guide';

    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            console.warn(`[dish-guide] Retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY_MS}ms…`);
            toast.info(`Retrying… (attempt ${attempt + 1})`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
          const startMs = Date.now();

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
              signal: controller.signal,
            },
          );

          clearTimeout(timeoutId);
          const elapsedMs = Date.now() - startMs;

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            lastError = errorData.error || `Failed: ${response.status}`;
            console.error(`[dish-guide] Attempt ${attempt + 1} failed (${response.status}, ${elapsedMs}ms): ${lastError}`);

            if (isRetryable(null, response.status) && attempt < MAX_RETRIES) continue;
            throw new Error(lastError);
          }

          const data = await response.json();
          console.log(`[dish-guide] Generation succeeded (${elapsedMs}ms, attempt ${attempt + 1})`);
          return data.dishGuide as FohPlateSpecDraft;

        } catch (err) {
          const isTimeout = err instanceof Error && err.name === 'AbortError';
          const elapsedLabel = isTimeout ? `>${TIMEOUT_MS}ms (TIMEOUT)` : 'unknown';

          if (isTimeout) {
            lastError = `Dish guide generation timed out after ${TIMEOUT_MS / 1000}s — the plate spec has ${componentCount} components which may need more processing time.`;
            console.error(`[dish-guide] TIMEOUT on attempt ${attempt + 1} (${elapsedLabel}, ${componentCount} components, plate="${draft.name}")`);
          } else {
            lastError = err instanceof Error ? err.message : 'Failed to generate dish guide';
            console.error(`[dish-guide] Attempt ${attempt + 1} failed (${elapsedLabel}):`, lastError);
          }

          if (isRetryable(err) && attempt < MAX_RETRIES) continue;

          // Final failure — report to user
          toast.error(lastError);
          return null;
        }
      }

      // Should not reach here, but safety net
      toast.error(lastError);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [session?.access_token]);

  return { generate, isGenerating };
}
