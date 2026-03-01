import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BeerLiquorItem } from '@/types/products';

export function useSupabaseBeerLiquor() {
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['beer-liquor'],
    queryFn: async (): Promise<BeerLiquorItem[]> => {
      const { data, error } = await supabase
        .from('beer_liquor_list')
        .select('id, slug, name, category, subcategory, producer, country, description, style, notes, image, is_featured, created_at')
        .eq('status', 'published')
        .order('category')
        .order('subcategory')
        .order('name');

      if (error) throw error;

      return (data || []).map((row): BeerLiquorItem => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category as BeerLiquorItem['category'],
        subcategory: row.subcategory,
        producer: row.producer,
        country: row.country,
        description: row.description,
        style: row.style,
        notes: row.notes ?? '',
        image: row.image ?? null,
        isFeatured: row.is_featured,
        createdAt: row.created_at,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { items, isLoading, error: error as Error | null };
}
