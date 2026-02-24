/**
 * useProductTranslations Hook
 *
 * Fetches existing translations for a specific product from the
 * product_translations table and exposes them as a Map keyed by field_path.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface TranslationRow {
  id: string;
  fieldPath: string;
  sourceText: string;
  translatedText: string;
  isApproved: boolean;
  updatedAt: string;
}

// =============================================================================
// STALENESS CHECK
// =============================================================================

/**
 * Returns true if the translation's recorded source text no longer matches
 * the current English text, meaning the translation is stale and should
 * be re-generated.
 */
export function isTranslationStale(
  translation: TranslationRow,
  currentEnglishText: string,
): boolean {
  return translation.sourceText !== currentEnglishText;
}

// =============================================================================
// HOOK
// =============================================================================

export function useProductTranslations(
  productTable: string | null,
  productId: string | null,
) {
  const [translations, setTranslations] = useState<Map<string, TranslationRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranslations = useCallback(async () => {
    if (!productTable || !productId) {
      setTranslations(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('product_translations')
        .select('id, field_path, source_text, translated_text, is_approved, updated_at')
        .eq('product_table', productTable)
        .eq('product_id', productId);

      if (queryError) {
        throw new Error(queryError.message);
      }

      const map = new Map<string, TranslationRow>();
      if (data) {
        for (const row of data) {
          map.set(row.field_path, {
            id: row.id,
            fieldPath: row.field_path,
            sourceText: row.source_text,
            translatedText: row.translated_text,
            isApproved: row.is_approved,
            updatedAt: row.updated_at,
          });
        }
      }

      setTranslations(map);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load translations';
      setError(msg);
      setTranslations(new Map());
    } finally {
      setLoading(false);
    }
  }, [productTable, productId]);

  // Fetch on mount and when productTable/productId change
  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  return {
    translations,
    loading,
    error,
    refetch: fetchTranslations,
  };
}
