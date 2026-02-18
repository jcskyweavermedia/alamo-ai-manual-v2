import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SOSSection {
  id: string;
  sectionKey: string;
  parentKey: string | null;
  sortOrder: number;
  position: string;
  chapter: string | null;
  titleEn: string;
  titleEs: string | null;
  contentEn: string;
  contentEs: string | null;
}

export function useSupabaseSOS() {
  const { data: sections = [], isLoading, error } = useQuery({
    queryKey: ['sos-sections'],
    queryFn: async (): Promise<SOSSection[]> => {
      const { data, error } = await supabase
        .from('steps_of_service_sections')
        .select('id, section_key, parent_key, sort_order, position, chapter, title_en, title_es, content_en, content_es')
        .eq('status', 'published')
        .order('sort_order');

      if (error) throw error;

      return (data || []).map((row: any): SOSSection => ({
        id: row.id,
        sectionKey: row.section_key,
        parentKey: row.parent_key,
        sortOrder: row.sort_order,
        position: row.position,
        chapter: row.chapter,
        titleEn: row.title_en,
        titleEs: row.title_es,
        contentEn: row.content_en,
        contentEs: row.content_es,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { sections, isLoading, error: error as Error | null };
}
