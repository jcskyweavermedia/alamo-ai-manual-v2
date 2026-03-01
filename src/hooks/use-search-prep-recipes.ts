/**
 * useSearchPrepRecipes Hook
 *
 * Debounced search for published prep recipes by name.
 * Used by SubRecipeLinker to find recipes to link as sub-recipes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';

export interface PrepRecipeHit {
  id: string;
  slug: string;
  name: string;
  department: 'kitchen' | 'bar';
}

interface UseSearchPrepRecipesOptions {
  query: string;
  enabled: boolean;
  excludeSlug?: string;
  department?: 'kitchen' | 'bar';
}

export function useSearchPrepRecipes({
  query,
  enabled,
  excludeSlug,
  department,
}: UseSearchPrepRecipesOptions) {
  const [results, setResults] = useState<PrepRecipeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || debouncedQuery.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function search() {
      setLoading(true);
      setError(null);

      const escaped = debouncedQuery.trim().replace(/%/g, '\\%').replace(/_/g, '\\_');

      let qb = supabase
        .from('prep_recipes')
        .select('id, slug, name, department')
        .ilike('name', `%${escaped}%`)
        .eq('status', 'published')
        .limit(6);

      if (excludeSlug) {
        qb = qb.neq('slug', excludeSlug);
      }

      if (department) {
        qb = qb.eq('department', department);
      }

      const { data, error: queryError } = await qb;

      if (cancelled || !mountedRef.current) return;

      if (queryError) {
        setError('Could not search recipes. Check your connection.');
        setResults([]);
      } else {
        setResults((data as PrepRecipeHit[]) ?? []);
      }
      setLoading(false);
    }

    search();

    return () => { cancelled = true; };
  }, [debouncedQuery, enabled, excludeSlug, department]);

  const reset = useCallback(() => {
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return { results, loading, error, reset };
}
