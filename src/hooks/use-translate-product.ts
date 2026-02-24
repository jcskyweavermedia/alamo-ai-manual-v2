/**
 * useTranslateProduct Hook
 *
 * Calls the /ingest edge function in "translate" mode to generate translations,
 * then upserts results into the product_translations table.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface TranslateField {
  fieldPath: string;
  sourceText: string;
}

export interface TranslationResult {
  fieldPath: string;
  translatedText: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useTranslateProduct() {
  const { user } = useAuth();
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * Call the /ingest edge function with mode: "translate" to get AI translations.
   * Returns an array of { fieldPath, translatedText } on success, or an empty
   * array on failure (toast is shown).
   */
  const translateFields = useCallback(async (
    productTable: string,
    productId: string,
    fields: TranslateField[],
    targetLang: string = 'es',
  ): Promise<TranslationResult[]> => {
    if (fields.length === 0) return [];

    setTranslating(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ingest', {
        body: {
          mode: 'translate',
          productTable,
          productId,
          targetLang,
          fields,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Translation request failed');
      }

      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      // Edge function returns { translations: TranslationResult[] }
      // Normalize keys defensively (handle both camelCase and snake_case)
      const translations: TranslationResult[] = (data?.translations ?? []).map(
        (t: Record<string, string>) => ({
          fieldPath: t.fieldPath ?? t.field_path ?? '',
          translatedText: t.translatedText ?? t.translated_text ?? '',
        }),
      );
      return translations;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to translate';
      toast.error(msg);
      return [];
    } finally {
      setTranslating(false);
    }
  }, []);

  /**
   * Upsert translated texts into the product_translations table.
   * Sets is_approved = true and approved_by = current user.
   * Returns true on success, false on failure (toast is shown).
   */
  const saveTranslations = useCallback(async (
    productTable: string,
    productId: string,
    translations: Array<{ fieldPath: string; sourceText: string; translatedText: string }>,
    targetLang: string = 'es',
  ): Promise<boolean> => {
    if (translations.length === 0) return true;

    setSaving(true);

    try {
      const rows = translations.map((t) => ({
        product_table: productTable,
        product_id: productId,
        field_path: t.fieldPath,
        source_lang: 'en',
        translated_lang: targetLang,
        source_text: t.sourceText,
        translated_text: t.translatedText,
        is_approved: true,
        approved_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase
        .from('product_translations')
        .upsert(rows, {
          onConflict: 'product_table,product_id,field_path,translated_lang',
        });

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      toast.success(
        translations.length === 1
          ? 'Translation saved'
          : `${translations.length} translations saved`,
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save translations';
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user]);

  return { translateFields, saveTranslations, translating, saving };
}
