import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapGeneratedTemplate } from '@/lib/form-builder/template-mapper';
import type { BuilderState, GenerateResponse } from '@/types/form-builder';

export function useGenerateTemplate() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (params: {
    description: string;
    language?: 'en' | 'es';
    groupId: string;
    existingTemplateContext?: string;
  }): Promise<Partial<BuilderState> | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'generate-form-template',
        {
          body: {
            description: params.description,
            language: params.language,
            groupId: params.groupId,
            existingTemplateContext: params.existingTemplateContext,
          },
        },
      );

      if (invokeError) throw invokeError;

      // Edge function returns { draft: {...}, confidence, ... } — unwrap draft
      const draft = data?.draft;
      if (!draft) throw new Error('Invalid response: missing draft');

      return mapGeneratedTemplate(draft as GenerateResponse);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating, error };
}
