import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Dish } from '@/types/products';

export function useSupabaseDishes() {
  const { data: dishes = [], isLoading, error } = useQuery({
    queryKey: ['dishes'],
    queryFn: async (): Promise<Dish[]> => {
      const { data, error } = await supabase
        .from('foh_plate_specs')
        .select('id, slug, menu_name, plate_type, short_description, detailed_description, ingredients, key_ingredients, flavor_profile, allergens, allergy_notes, upsell_notes, notes, image, is_top_seller, plate_spec_id')
        .eq('status', 'published')
        .order('menu_name');

      if (error) throw error;

      return (data || []).map((row): Dish => ({
        id: row.id,
        slug: row.slug,
        menuName: row.menu_name,
        plateType: row.plate_type as Dish['plateType'],
        shortDescription: row.short_description,
        detailedDescription: row.detailed_description,
        ingredients: row.ingredients ?? [],
        keyIngredients: row.key_ingredients ?? [],
        flavorProfile: row.flavor_profile ?? [],
        allergens: (row.allergens ?? []) as Dish['allergens'],
        allergyNotes: row.allergy_notes ?? '',
        upsellNotes: row.upsell_notes ?? '',
        notes: row.notes ?? '',
        image: row.image,
        isTopSeller: row.is_top_seller,
        plateSpecId: row.plate_spec_id,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { dishes, isLoading, error: error as Error | null };
}
