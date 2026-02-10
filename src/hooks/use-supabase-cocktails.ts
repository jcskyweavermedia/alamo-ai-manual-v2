import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Cocktail, CocktailProcedureStep } from '@/types/products';

export function useSupabaseCocktails() {
  const { data: cocktails = [], isLoading, error } = useQuery({
    queryKey: ['cocktails'],
    queryFn: async (): Promise<Cocktail[]> => {
      const { data, error } = await supabase
        .from('cocktails')
        .select('id, slug, name, style, glass, ingredients, key_ingredients, procedure, tasting_notes, description, notes, image, is_top_seller')
        .eq('status', 'published')
        .order('name');

      if (error) throw error;

      return (data || []).map((row): Cocktail => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        style: row.style as Cocktail['style'],
        glass: row.glass,
        ingredients: row.ingredients,
        keyIngredients: row.key_ingredients,
        procedure: (row.procedure as unknown as CocktailProcedureStep[]) ?? [],
        tastingNotes: row.tasting_notes,
        description: row.description,
        notes: row.notes ?? '',
        image: row.image,
        isTopSeller: row.is_top_seller,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { cocktails, isLoading, error: error as Error | null };
}
