// =============================================================================
// useSourceMaterialSearch — Search across all product tables for wizard picker
// Uses direct ILIKE queries (not RPC) since the search functions require embeddings.
// =============================================================================

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SourceRef } from '@/types/course-builder';

export interface SourceMaterialResult {
  ref: SourceRef;
  nameEn: string;
  nameEs: string;
  category: string;
  domain: string;
}

type ProductDomain = 'dishes' | 'wines' | 'cocktails' | 'recipes' | 'beer_liquor';

const DOMAIN_CONFIG: Record<ProductDomain, {
  table: string;
  nameField: string;
  categoryField: string;
  label: string;
}> = {
  dishes: {
    table: 'foh_plate_specs',
    nameField: 'menu_name',
    categoryField: 'plate_type',
    label: 'Dishes',
  },
  wines: {
    table: 'wines',
    nameField: 'name',
    categoryField: 'style',
    label: 'Wines',
  },
  cocktails: {
    table: 'cocktails',
    nameField: 'name',
    categoryField: 'style',
    label: 'Cocktails',
  },
  recipes: {
    table: 'prep_recipes',
    nameField: 'name',
    categoryField: 'prep_type',
    label: 'Recipes',
  },
  beer_liquor: {
    table: 'beer_liquor_list',
    nameField: 'name',
    categoryField: 'category',
    label: 'Beer & Liquor',
  },
};

export const ALL_DOMAINS: ProductDomain[] = ['dishes', 'wines', 'cocktails', 'recipes', 'beer_liquor'];

export function useSourceMaterialSearch() {
  const [results, setResults] = useState<SourceMaterialResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef(0);

  const search = useCallback(async (query: string, domains?: string[]) => {
    const searchId = ++abortRef.current;
    const trimmed = query.trim();

    if (!trimmed) {
      // Load all items when query is empty
      setIsSearching(true);
      try {
        const targetDomains = (domains?.length ? domains : ALL_DOMAINS) as ProductDomain[];
        const promises = targetDomains.map(async (domain) => {
          const config = DOMAIN_CONFIG[domain];
          if (!config) return [];

          const { data, error } = await supabase
            .from(config.table)
            .select(`id, ${config.nameField}, ${config.categoryField}`)
            .eq('status', 'published')
            .order(config.nameField)
            .limit(50);

          if (error || !data) return [];

          return data.map((row: Record<string, unknown>): SourceMaterialResult => ({
            ref: {
              table: config.table,
              id: row.id as string,
              content_hash: '',
            },
            nameEn: (row[config.nameField] as string) || '',
            nameEs: (row[config.nameField] as string) || '',
            category: (row[config.categoryField] as string) || '',
            domain: config.label,
          }));
        });

        const allResults = await Promise.all(promises);
        if (searchId !== abortRef.current) return;
        setResults(allResults.flat());
      } finally {
        if (searchId === abortRef.current) setIsSearching(false);
      }
      return;
    }

    setIsSearching(true);
    try {
      const targetDomains = (domains?.length ? domains : ALL_DOMAINS) as ProductDomain[];

      const promises = targetDomains.map(async (domain) => {
        const config = DOMAIN_CONFIG[domain];
        if (!config) return [];

        const { data, error } = await supabase
          .from(config.table)
          .select(`id, ${config.nameField}, ${config.categoryField}`)
          .eq('status', 'published')
          .ilike(config.nameField, `%${trimmed}%`)
          .order(config.nameField)
          .limit(20);

        if (error || !data) return [];

        return data.map((row: Record<string, unknown>): SourceMaterialResult => ({
          ref: {
            table: config.table,
            id: row.id as string,
            content_hash: '',
          },
          nameEn: (row[config.nameField] as string) || '',
          nameEs: (row[config.nameField] as string) || '',
          category: (row[config.categoryField] as string) || '',
          domain: config.label,
        }));
      });

      const allResults = await Promise.all(promises);
      if (searchId !== abortRef.current) return;
      setResults(allResults.flat());
    } finally {
      if (searchId === abortRef.current) setIsSearching(false);
    }
  }, []);

  return { results, isSearching, search };
}
