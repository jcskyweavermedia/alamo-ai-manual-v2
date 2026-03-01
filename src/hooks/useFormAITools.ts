import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FormAITool } from '@/types/form-builder';

// Map snake_case DB row to camelCase FormAITool
// deno-lint-ignore no-explicit-any
function mapRow(row: any): FormAITool {
  return {
    id: row.id,
    labelEn: row.label_en,
    labelEs: row.label_es,
    descriptionEn: row.description_en,
    descriptionEs: row.description_es,
    searchFunction: row.search_function ?? null,
    icon: row.icon ?? null,
    status: row.status,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  };
}

export function useFormAITools() {
  const [tools, setTools] = useState<FormAITool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('form_ai_tools')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setTools((data ?? []).map(mapRow));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch AI tools'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return { tools, loading, error, refetch: fetchTools };
}
