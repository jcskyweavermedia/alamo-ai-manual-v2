/**
 * useFormTemplate Hook
 *
 * Fetches a single form template by slug. Uses the same mapping as
 * useFormTemplates but queries with .eq('slug', slug).single().
 * Useful for the FormDetailPage where we need the full template definition.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { transformTemplateRow } from '@/lib/form-utils';
import type { FormTemplate } from '@/types/forms';

// =============================================================================
// HOOK
// =============================================================================

export function useFormTemplate(slug: string | null) {
  const {
    data: template = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['form-template', slug],
    queryFn: async (): Promise<FormTemplate> => {
      const { data, error } = await supabase
        .from('form_templates')
        .select(
          'id, group_id, slug, title_en, title_es, description_en, description_es, icon, header_image, fields, instructions_en, instructions_es, ai_tools, status, sort_order, template_version, created_by, created_at, updated_at',
        )
        .eq('slug', slug!)
        .single();

      if (error) throw error;

      return transformTemplateRow(data);
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { template, isLoading, error: error as Error | null };
}
