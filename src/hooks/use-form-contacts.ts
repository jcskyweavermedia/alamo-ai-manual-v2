/**
 * useFormContacts Hook
 *
 * Fetches active contacts for the current group and provides
 * search via the search_contacts RPC function.
 * Used by the ContactLookupFieldInput component.
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { transformContactRow } from '@/lib/form-utils';
import type { Contact, ContactSearchResult } from '@/types/forms';

// =============================================================================
// ROW TRANSFORM (search results only — contacts use shared transformContactRow)
// =============================================================================

function transformSearchResult(row: Record<string, unknown>): ContactSearchResult {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    subcategory: (row.subcategory as string) ?? null,
    phone: (row.phone as string) ?? null,
    contactPerson: (row.contact_person as string) ?? null,
    address: (row.address as string) ?? null,
    isDemoData: (row.is_demo_data as boolean) ?? false,
    score: (row.score as number) ?? 0,
  };
}

// =============================================================================
// HOOK
// =============================================================================

interface UseFormContactsOptions {
  /** Restrict contacts to a specific category (e.g., from field validation.contact_category) */
  category?: string;
}

export function useFormContacts({ category }: UseFormContactsOptions = {}) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch all active contacts for the group (RLS filters by group automatically)
  // ---------------------------------------------------------------------------
  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ['form-contacts', category ?? 'all'],
    queryFn: async (): Promise<Contact[]> => {
      let query = supabase
        .from('contacts')
        .select(
          'id, group_id, category, subcategory, name, contact_person, phone, phone_alt, email, address, notes, is_priority, is_demo_data, sort_order, status, created_at, updated_at',
        )
        .eq('status', 'active')
        .order('is_priority', { ascending: false })
        .order('sort_order')
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(transformContactRow);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  // ---------------------------------------------------------------------------
  // searchContacts — calls the search_contacts RPC for FTS search
  // ---------------------------------------------------------------------------
  const searchContacts = useCallback(
    async (query: string, matchCount = 10): Promise<ContactSearchResult[]> => {
      if (!query.trim()) return [];

      setIsSearching(true);
      setSearchError(null);

      try {
        const { data, error } = await supabase.rpc('search_contacts', {
          search_query: query.trim(),
          match_count: matchCount,
          p_category: category ?? null,
        });

        if (error) throw error;

        return (data || []).map(transformSearchResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed';
        console.error('Contact search failed:', message);
        setSearchError(message);
        return [];
      } finally {
        setIsSearching(false);
      }
    },
    [category],
  );

  return {
    contacts,
    isLoading,
    error: error as Error | null,
    searchContacts,
    isSearching,
    searchError,
  };
}
