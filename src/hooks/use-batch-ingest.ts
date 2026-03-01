import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateSlug } from '@/types/ingestion';
import type { BeerLiquorDraft } from '@/types/ingestion';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// =============================================================================
// Types
// =============================================================================

interface BatchResult {
  sessionId: string;
  items: BeerLiquorDraft[];
  totalExtracted: number;
  duplicates: number;
  message: string;
  failedChunks?: number[];
}

/** Callback fired after each item is published (or fails) so the UI can update */
export type OnItemPublished = (
  tempId: string,
  status: 'published' | 'error',
  errorMessage?: string,
) => void;

export interface UseBatchIngestReturn {
  extractBatch: (content: string, sessionId?: string) => Promise<BatchResult | null>;
  extractFromFile: (file: File) => Promise<string | null>;
  extractBatchVision: (images: File[], textContent?: string, sessionId?: string) => Promise<BatchResult | null>;
  publishItems: (
    drafts: BeerLiquorDraft[],
    sessionId: string | null,
    onItemPublished: OnItemPublished,
  ) => Promise<{ published: number; failed: number }>;
  isExtracting: boolean;
  isPublishing: boolean;
  publishProgress: { done: number; total: number };
  error: string | null;
}

// =============================================================================
// Hook
// =============================================================================

export function useBatchIngest(): UseBatchIngestReturn {
  const queryClient = useQueryClient();
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // extractBatch — call ingest edge function with mode: 'batch-extract'
  // ---------------------------------------------------------------------------
  const extractBatch = useCallback(async (
    content: string,
    sessionId?: string,
  ): Promise<BatchResult | null> => {
    setIsExtracting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ingest', {
        body: {
          mode: 'batch-extract',
          content,
          sessionId,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.message || data.error);

      // Map raw AI items to BeerLiquorDraft objects
      const items: BeerLiquorDraft[] = (data.items || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => ({
          _tempId: crypto.randomUUID(),
          name: item.name || '',
          slug: generateSlug(item.name || ''),
          category: item.category || 'Beer',
          subcategory: item.subcategory || '',
          producer: item.producer || '',
          country: item.country || '',
          description: item.description || '',
          style: item.style || '',
          notes: item.notes || '',
          image: item.image || null,
          isFeatured: item.isFeatured ?? false,
          confidence: item.confidence ?? 0.5,
          duplicateOf: item.duplicateOf || null,
          rowStatus: item.duplicateOf ? 'duplicate_skipped' as const : 'pending' as const,
        }),
      );

      return {
        sessionId: data.sessionId,
        items,
        totalExtracted: data.totalExtracted || items.length,
        duplicates: data.duplicates || 0,
        message: data.message || '',
        failedChunks: data.failedChunks || [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Batch extraction failed';
      setError(msg);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // extractFromFile — lightweight file-to-text extraction (NO isExtracting flag)
  // This is a utility call (server-side parse), not an AI call, so it does NOT
  // block the UI. Per-file status is tracked via uploadedFiles in the component.
  // ---------------------------------------------------------------------------
  const extractFromFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('productTable', 'beer_liquor_list');
      formData.append('extractOnly', 'true');

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/ingest-file`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: ANON_KEY,
          },
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) return null;

      return data.extractedText || null;
    } catch {
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // extractBatchVision — multi-image + text combined call (THIS is the main AI call)
  // Sends multiple images + optional text to ingest-vision in one shot.
  // ---------------------------------------------------------------------------
  const extractBatchVision = useCallback(async (
    images: File[],
    textContent?: string,
    sessionId?: string,
  ): Promise<BatchResult | null> => {
    setIsExtracting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired, please sign in again');

      const formData = new FormData();
      formData.append('productTable', 'beer_liquor_list');
      if (sessionId) formData.append('sessionId', sessionId);
      if (textContent) formData.append('textContent', textContent);
      for (const img of images) {
        formData.append('file', img);
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/ingest-vision`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: ANON_KEY,
          },
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Extraction failed (${response.status})`);
      }

      // Map raw AI items to BeerLiquorDraft objects
      const items: BeerLiquorDraft[] = (data.items || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => ({
          _tempId: crypto.randomUUID(),
          name: item.name || '',
          slug: generateSlug(item.name || ''),
          category: item.category || 'Beer',
          subcategory: item.subcategory || '',
          producer: item.producer || '',
          country: item.country || '',
          description: item.description || '',
          style: item.style || '',
          notes: item.notes || '',
          image: item.image || null,
          isFeatured: item.isFeatured ?? false,
          confidence: item.confidence ?? 0.5,
          duplicateOf: item.duplicateOf || null,
          rowStatus: item.duplicateOf ? 'duplicate_skipped' as const : 'pending' as const,
        }),
      );

      return {
        sessionId: data.sessionId,
        items,
        totalExtracted: data.totalExtracted || items.length,
        duplicates: data.duplicates || 0,
        message: data.message || '',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed';
      setError(msg);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // publishItems — bulk publish, tracking progress
  // Uses a callback to notify the component of per-item status changes
  // (avoids mutating React state objects in-place)
  // ---------------------------------------------------------------------------
  const publishItems = useCallback(async (
    drafts: BeerLiquorDraft[],
    sessionId: string | null,
    onItemPublished: OnItemPublished,
  ): Promise<{ published: number; failed: number }> => {
    setIsPublishing(true);
    setError(null);
    setPublishProgress({ done: 0, total: drafts.length });

    // Hoist getUser() — single auth call for the entire batch
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setIsPublishing(false);
      return { published: 0, failed: drafts.length };
    }

    let published = 0;
    let failed = 0;

    // Pre-generate all slugs with a single bulk uniqueness check
    const candidateSlugs = drafts.map(d => generateSlug(d.name));
    const uniqueCandidates = [...new Set(candidateSlugs)];

    const { data: existingSlugsData } = await supabase
      .from('beer_liquor_list')
      .select('slug')
      .in('slug', uniqueCandidates);

    const takenSlugs = new Set(existingSlugsData?.map(r => r.slug) || []);

    // Build slug map: tempId → unique slug (handles both DB conflicts and within-batch conflicts)
    const slugMap = new Map<string, string>();
    for (const draft of drafts) {
      let slug = generateSlug(draft.name);
      let attempt = 0;
      while (takenSlugs.has(slug) || [...slugMap.values()].includes(slug)) {
        attempt++;
        slug = `${generateSlug(draft.name)}-${attempt + 1}`;
      }
      slugMap.set(draft._tempId, slug);
    }

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];

      try {
        const slug = slugMap.get(draft._tempId) || generateSlug(draft.name);

        const row = {
          slug,
          name: draft.name,
          category: draft.category,
          subcategory: draft.subcategory,
          producer: draft.producer,
          country: draft.country,
          description: draft.description,
          style: draft.style,
          notes: draft.notes,
          ...(draft.image ? { image: draft.image } : {}),
          is_featured: draft.isFeatured,
          status: 'published' as const,
          version: 1,
          source_session_id: sessionId,
          ai_ingestion_meta: {
            source_type: 'batch_ingestion',
            confidence_score: draft.confidence,
            missing_fields: [],
            last_ai_generated_at: new Date().toISOString(),
          },
          created_by: user.id,
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('beer_liquor_list')
          .insert(row)
          .select('id')
          .single();

        if (insertErr) throw new Error(insertErr.message);
        if (!inserted) throw new Error('Failed to insert — check permissions');

        // Fire-and-forget: generate embedding
        supabase.functions.invoke('embed-products', {
          body: { table: 'beer_liquor_list', rowId: inserted.id },
        }).catch(() => {});

        published++;
        onItemPublished(draft._tempId, 'published');
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : 'Insert failed';
        console.error(`publishItem error (${draft.name}):`, err);
        onItemPublished(draft._tempId, 'error', errMsg);
      }

      setPublishProgress({ done: i + 1, total: drafts.length });
    }

    // Invalidate cache so beer-liquor list picks up new rows
    queryClient.invalidateQueries({ queryKey: ['beer-liquor'] });

    setIsPublishing(false);
    return { published, failed };
  }, [queryClient]);

  return {
    extractBatch,
    extractFromFile,
    extractBatchVision,
    publishItems,
    isExtracting,
    isPublishing,
    publishProgress,
    error,
  };
}
