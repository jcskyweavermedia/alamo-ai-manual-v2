/**
 * useFormTemplates Hook
 *
 * Fetches published/archived form templates for the current user's group.
 * Mirrors useSupabaseRecipes pattern: TanStack Query with 5-min stale time,
 * snake_case-to-camelCase mapping.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { transformTemplateRow } from '@/lib/form-utils';
import type { FormTemplate } from '@/types/forms';

// =============================================================================
// HOOK
// =============================================================================

export function useFormTemplates() {
  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['form-templates'],
    queryFn: async (): Promise<FormTemplate[]> => {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .in('status', ['published', 'archived'])
        .order('sort_order')
        .order('title_en');

      if (error) throw error;

      return (data || []).map(transformTemplateRow);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { templates, isLoading, error: error as Error | null };
}
