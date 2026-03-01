import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  PrepRecipe,
  RecipeIngredientGroup,
  RecipeProcedureGroup,
  RecipeImage,
  BatchScaling,
  TrainingNotes,
} from '@/types/products';

export function useBarRecipes() {
  const { data: recipes = [], isLoading, error } = useQuery({
    queryKey: ['bar-recipes'],
    queryFn: async (): Promise<PrepRecipe[]> => {
      const { data, error } = await supabase
        .from('prep_recipes')
        .select('id, slug, name, department, prep_type, tags, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, ingredients, procedure, batch_scaling, training_notes, images, is_featured, created_at')
        .eq('department', 'bar')
        .eq('status', 'published')
        .order('name');

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        slug: row.slug,
        type: 'prep' as const,
        name: row.name,
        department: row.department as 'kitchen' | 'bar',
        prepType: row.prep_type,
        tags: row.tags ?? [],
        yieldQty: Number(row.yield_qty),
        yieldUnit: row.yield_unit,
        shelfLifeValue: row.shelf_life_value,
        shelfLifeUnit: row.shelf_life_unit,
        ingredients: (row.ingredients as unknown as RecipeIngredientGroup[]) ?? [],
        procedure: (row.procedure as unknown as RecipeProcedureGroup[]) ?? [],
        batchScaling: (row.batch_scaling as unknown as BatchScaling) ?? {},
        trainingNotes: (row.training_notes as unknown as TrainingNotes) ?? {},
        isFeatured: row.is_featured,
        images: ((row.images ?? []) as unknown as (string | RecipeImage)[]).map(
          (img) => (typeof img === 'string' ? { url: img } : img)
        ),
        createdAt: row.created_at,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { recipes, isLoading, error: error as Error | null };
}
