import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  PrepRecipe,
  PlateSpec,
  Recipe,
  RecipeIngredientGroup,
  RecipeProcedureGroup,
  PlateComponentGroup,
  RecipeImage,
  BatchScaling,
  TrainingNotes,
} from '@/types/products';

export function useSupabaseRecipes() {
  const { data: recipes = [], isLoading, error } = useQuery({
    queryKey: ['recipes'],
    queryFn: async (): Promise<Recipe[]> => {
      const [prepResult, plateResult] = await Promise.all([
        supabase
          .from('prep_recipes')
          .select('id, slug, name, prep_type, tags, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, ingredients, procedure, batch_scaling, training_notes, images')
          .eq('status', 'published')
          .order('name'),
        supabase
          .from('plate_specs')
          .select('id, slug, name, plate_type, menu_category, tags, allergens, components, assembly_procedure, notes, images')
          .eq('status', 'published')
          .order('name'),
      ]);

      if (prepResult.error) throw prepResult.error;
      if (plateResult.error) throw plateResult.error;

      const prepRecipes: PrepRecipe[] = (prepResult.data || []).map((row) => ({
        id: row.id,
        slug: row.slug,
        type: 'prep' as const,
        name: row.name,
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
        images: ((row.images ?? []) as unknown as (string | RecipeImage)[]).map(
          (img) => (typeof img === 'string' ? { url: img } : img)
        ),
      }));

      const plateSpecs: PlateSpec[] = (plateResult.data || []).map((row) => ({
        id: row.id,
        slug: row.slug,
        type: 'plate' as const,
        name: row.name,
        plateType: row.plate_type,
        menuCategory: row.menu_category,
        tags: row.tags ?? [],
        allergens: row.allergens ?? [],
        components: (row.components as unknown as PlateComponentGroup[]) ?? [],
        assemblyProcedure: (row.assembly_procedure as unknown as RecipeProcedureGroup[]) ?? [],
        notes: row.notes ?? '',
        images: ((row.images ?? []) as unknown as (string | RecipeImage)[]).map(
          (img) => (typeof img === 'string' ? { url: img } : img)
        ),
      }));

      return [...prepRecipes, ...plateSpecs];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { recipes, isLoading, error: error as Error | null };
}
