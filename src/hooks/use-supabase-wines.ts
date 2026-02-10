import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Wine } from '@/types/products';

export function useSupabaseWines() {
  const { data: wines = [], isLoading, error } = useQuery({
    queryKey: ['wines'],
    queryFn: async (): Promise<Wine[]> => {
      const { data, error } = await supabase
        .from('wines')
        .select('id, slug, name, producer, region, country, vintage, varietal, blend, style, body, tasting_notes, producer_notes, notes, image, is_top_seller')
        .eq('status', 'published')
        .order('name');

      if (error) throw error;

      return (data || []).map((row): Wine => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        producer: row.producer,
        region: row.region,
        country: row.country,
        vintage: row.vintage,
        varietal: row.varietal,
        blend: row.blend,
        style: row.style as Wine['style'],
        body: row.body as Wine['body'],
        tastingNotes: row.tasting_notes,
        producerNotes: row.producer_notes ?? '',
        notes: row.notes ?? '',
        image: row.image,
        isTopSeller: row.is_top_seller,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { wines, isLoading, error: error as Error | null };
}
