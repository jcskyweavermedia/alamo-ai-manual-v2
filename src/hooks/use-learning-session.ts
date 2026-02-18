import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { useCourseSections } from '@/hooks/use-course-sections';
import { useEnrollment } from '@/hooks/use-enrollment';
import { useSectionProgress } from '@/hooks/use-section-progress';
import type { ContentSource } from '@/types/training';
import type {
  Dish,
  Wine,
  Cocktail,
  BeerLiquorItem,
  PrepRecipe,
  PlateSpec,
  Recipe,
} from '@/types/products';

// =============================================================================
// CONTENT ITEM UNION
// =============================================================================

type ContentItem = Dish | Wine | Cocktail | BeerLiquorItem | Recipe;

// =============================================================================
// RAW → CAMELCASE TRANSFORMS
// =============================================================================

function transformDishRaw(raw: any): Dish {
  return {
    id: raw.id,
    slug: raw.slug,
    menuName: raw.menu_name,
    plateType: raw.plate_type,
    shortDescription: raw.short_description ?? '',
    detailedDescription: raw.detailed_description ?? '',
    ingredients: raw.ingredients ?? [],
    keyIngredients: raw.key_ingredients ?? [],
    flavorProfile: raw.flavor_profile ?? [],
    allergens: raw.allergens ?? [],
    allergyNotes: raw.allergy_notes ?? '',
    upsellNotes: raw.upsell_notes ?? '',
    notes: raw.notes ?? '',
    image: raw.image ?? null,
    isTopSeller: raw.is_top_seller ?? false,
    plateSpecId: raw.plate_spec_id ?? null,
  };
}

function transformWineRaw(raw: any): Wine {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    producer: raw.producer ?? '',
    region: raw.region ?? '',
    country: raw.country ?? '',
    vintage: raw.vintage ?? null,
    varietal: raw.varietal ?? '',
    blend: raw.blend ?? false,
    style: raw.style,
    body: raw.body,
    tastingNotes: raw.tasting_notes ?? '',
    producerNotes: raw.producer_notes ?? '',
    notes: raw.notes ?? '',
    image: raw.image ?? null,
    isTopSeller: raw.is_top_seller ?? false,
  };
}

function transformCocktailRaw(raw: any): Cocktail {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    style: raw.style,
    glass: raw.glass ?? '',
    ingredients: raw.ingredients ?? '',
    keyIngredients: raw.key_ingredients ?? '',
    procedure: raw.procedure ?? [],
    tastingNotes: raw.tasting_notes ?? '',
    description: raw.description ?? '',
    notes: raw.notes ?? '',
    image: raw.image ?? null,
    isTopSeller: raw.is_top_seller ?? false,
  };
}

function transformBeerLiquorRaw(raw: any): BeerLiquorItem {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    category: raw.category,
    subcategory: raw.subcategory ?? '',
    producer: raw.producer ?? '',
    country: raw.country ?? '',
    description: raw.description ?? '',
    style: raw.style ?? '',
    notes: raw.notes ?? '',
  };
}

function transformPrepRecipeRaw(raw: any): PrepRecipe {
  return {
    id: raw.id,
    slug: raw.slug,
    type: 'prep',
    name: raw.name,
    prepType: raw.prep_type ?? '',
    tags: raw.tags ?? [],
    yieldQty: raw.yield_qty ?? 0,
    yieldUnit: raw.yield_unit ?? '',
    shelfLifeValue: raw.shelf_life_value ?? 0,
    shelfLifeUnit: raw.shelf_life_unit ?? '',
    ingredients: raw.ingredients ?? [],
    procedure: raw.procedure ?? [],
    batchScaling: raw.batch_scaling ?? {},
    trainingNotes: raw.training_notes ?? {},
    images: raw.images ?? [],
  };
}

function transformPlateSpecRaw(raw: any): PlateSpec {
  return {
    id: raw.id,
    slug: raw.slug,
    type: 'plate',
    name: raw.name,
    plateType: raw.plate_type ?? '',
    menuCategory: raw.menu_category ?? '',
    tags: raw.tags ?? [],
    allergens: raw.allergens ?? [],
    components: raw.components ?? [],
    assemblyProcedure: raw.assembly_procedure ?? [],
    notes: raw.notes ?? '',
    images: raw.images ?? [],
  };
}

// =============================================================================
// SERIALIZERS FOR AI CONTEXT
// =============================================================================

function serializeDish(d: Dish): string {
  return `${d.menuName}: ${d.shortDescription} | Key ingredients: ${d.keyIngredients.join(', ')} | Allergens: ${d.allergens.join(', ') || 'none'} | Upsell: ${d.upsellNotes}`;
}

function serializeWine(w: Wine): string {
  return `${w.name} (${w.producer}): ${w.region}, ${w.country} | ${w.varietal}${w.blend ? ' blend' : ''} | ${w.style}, ${w.body} body | Tasting: ${w.tastingNotes}`;
}

function serializeCocktail(c: Cocktail): string {
  return `${c.name}: ${c.style} | Glass: ${c.glass} | Ingredients: ${c.ingredients} | Tasting: ${c.tastingNotes}`;
}

function serializeBeerLiquor(b: BeerLiquorItem): string {
  return `${b.name}: ${b.category} - ${b.subcategory} | ${b.producer}, ${b.country} | ${b.style} | ${b.description}`;
}

function serializeRecipe(r: Recipe): string {
  if (r.type === 'prep') {
    return `${r.name}: ${r.prepType} | Yield: ${r.yieldQty} ${r.yieldUnit} | Shelf life: ${r.shelfLifeValue} ${r.shelfLifeUnit}`;
  }
  return `${r.name}: ${r.plateType} | Category: ${r.menuCategory} | Allergens: ${r.allergens.join(', ') || 'none'}`;
}

// =============================================================================
// SOURCE CONFIG
// =============================================================================

const SOURCE_CONFIG: Record<
  string,
  {
    table: string;
    transform: (raw: any) => ContentItem;
    serialize: (item: any) => string;
  }
> = {
  foh_plate_specs: { table: 'foh_plate_specs', transform: transformDishRaw, serialize: serializeDish },
  wines: { table: 'wines', transform: transformWineRaw, serialize: serializeWine },
  cocktails: { table: 'cocktails', transform: transformCocktailRaw, serialize: serializeCocktail },
  beer_liquor_list: { table: 'beer_liquor_list', transform: transformBeerLiquorRaw, serialize: serializeBeerLiquor },
  prep_recipes: { table: 'prep_recipes', transform: transformPrepRecipeRaw, serialize: serializeRecipe },
  plate_specs: { table: 'plate_specs', transform: transformPlateSpecRaw, serialize: serializeRecipe },
};

// =============================================================================
// HOOK
// =============================================================================

export function useLearningSession() {
  const { programSlug, courseSlug, sectionSlug } = useParams<{
    programSlug: string;
    courseSlug: string;
    sectionSlug: string;
  }>();
  const { language } = useLanguage();

  const {
    course,
    sections,
    isLoading: sectionsLoading,
    error: sectionsError,
  } = useCourseSections(courseSlug);

  // Find current section by slug
  const currentSection = useMemo(() => {
    if (!sectionSlug || sections.length === 0) return null;
    return sections.find((s) => s.slug === sectionSlug) ?? null;
  }, [sectionSlug, sections]);

  const currentIndex = useMemo(() => {
    if (!currentSection) return -1;
    return sections.findIndex((s) => s.id === currentSection.id);
  }, [currentSection, sections]);

  const prevSection = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const nextSection =
    currentIndex >= 0 && currentIndex < sections.length - 1
      ? sections[currentIndex + 1]
      : null;

  // Auto-enroll
  const { enrollment } = useEnrollment({
    courseId: course?.id,
    autoEnroll: true,
  });

  // Section progress
  const { progress, startSection, updateTopics, markComplete } =
    useSectionProgress({
      sectionId: currentSection?.id,
      courseId: course?.id,
      enrollmentId: enrollment?.id,
    });

  // Item index for multi-item sections
  const [itemIndex, setItemIndex] = useState(0);

  // Reset item index when section changes
  useEffect(() => {
    setItemIndex(0);
  }, [currentSection?.id]);

  // Fetch content items (unified for all source types)
  const contentSource = currentSection?.contentSource;
  const contentIds = currentSection?.contentIds ?? [];

  const { data: contentItems = [], isLoading: contentLoading } = useQuery({
    queryKey: ['learning-content', contentSource, contentIds],
    queryFn: async (): Promise<any[]> => {
      if (!contentSource || contentIds.length === 0) return [];
      if (contentSource === 'custom') return [];

      // Manual sections: fetch markdown content
      if (contentSource === 'manual_sections') {
        const { data, error } = await supabase
          .from('manual_sections')
          .select('id, content_en, content_es, title_en, title_es')
          .in('id', contentIds);

        if (error) throw error;
        // Preserve content_ids order
        const map = new Map((data ?? []).map((d) => [d.id, d]));
        return contentIds.map((id) => map.get(id)).filter(Boolean);
      }

      // Product sources
      const config = SOURCE_CONFIG[contentSource];
      if (!config) return [];

      const { data, error } = await supabase
        .from(config.table as any)
        .select('*')
        .in('id', contentIds);

      if (error) throw error;
      if (!data) return [];

      const itemMap = new Map(data.map((d: any) => [d.id, d]));
      return contentIds
        .map((id) => itemMap.get(id))
        .filter(Boolean)
        .map((raw) => config.transform(raw));
    },
    enabled:
      !!contentSource &&
      contentIds.length > 0 &&
      contentSource !== 'custom',
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const currentItem = contentItems[itemIndex] ?? null;
  const totalItems = contentItems.length;

  // Serialize all content for AI context
  const contentContext = useMemo(() => {
    if (!contentSource) return '';

    if (contentSource === 'manual_sections') {
      return contentItems
        .map((item: any) => {
          const content =
            language === 'es' && item.content_es
              ? item.content_es
              : item.content_en;
          return (content ?? '').slice(0, 3000);
        })
        .join('\n\n---\n\n');
    }

    if (contentSource === 'custom') {
      const desc =
        language === 'es' && currentSection?.descriptionEs
          ? currentSection.descriptionEs
          : currentSection?.descriptionEn;
      return desc ?? '';
    }

    const config = SOURCE_CONFIG[contentSource];
    if (!config || contentItems.length === 0) return '';

    return contentItems.map((item) => config.serialize(item)).join('\n');
  }, [contentSource, contentItems, currentSection, language]);

  // Auto-start section on first visit
  useEffect(() => {
    if (currentSection && enrollment && !progress) {
      startSection();
    }
    // Only run when IDs change, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.id, enrollment?.id]);

  return {
    course,
    sections,
    currentSection,
    currentIndex,
    prevSection,
    nextSection,
    enrollment,
    progress,
    updateTopics,
    markComplete,
    contentItems,
    currentItem,
    itemIndex,
    setItemIndex,
    totalItems,
    contentContext,
    isLoading: sectionsLoading || contentLoading,
    error: sectionsError,
    language,
    programSlug,
    courseSlug,
    sectionSlug,
  };
}
