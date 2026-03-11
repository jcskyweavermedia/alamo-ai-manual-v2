/**
 * useFilingCabinet Hook
 *
 * Queries real form_submissions from Supabase with template + profile joins.
 * Client-side filtering by template, status, and text search.
 * Manages search state, filters, pagination, and template list.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFormTemplates } from '@/hooks/use-form-templates';
import { extractMainField } from '@/lib/form-utils';
import type { FilingCabinetResult, FormFieldDefinition, FormFieldValues } from '@/types/forms';

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_SIZE = 20;

// =============================================================================
// HOOK
// =============================================================================

export function useFilingCabinet() {
  // Search state
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Manual filters
  const [templateFilter, setTemplateFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('recent');

  // Selected submission (for inline viewer)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Pagination
  const [offset, setOffset] = useState(0);

  // Template list for filter chips
  const { templates: allTemplates } = useFormTemplates();
  const templates = useMemo(
    () =>
      allTemplates
        .filter((t) => t.status === 'published')
        .map((t) => ({
          id: t.id,
          slug: t.slug,
          titleEn: t.titleEn,
          titleEs: t.titleEs ?? t.titleEn,
          icon: t.icon,
          iconColor: t.iconColor,
        })),
    [allTemplates],
  );

  // ---------------------------------------------------------------------------
  // Debounce search query by 500ms
  // ---------------------------------------------------------------------------

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ---------------------------------------------------------------------------
  // Fetch all submissions from Supabase (TanStack Query)
  // ---------------------------------------------------------------------------

  const {
    data: allResults = [],
    isLoading: isFetching,
    error: fetchError,
  } = useQuery({
    queryKey: ['filing-cabinet-submissions'],
    queryFn: async (): Promise<FilingCabinetResult[]> => {
      const { data, error } = await supabase
        .from('form_submissions')
        .select(
          `
          id, template_id, status, filled_by, subject_user_id,
          submitted_at, created_at, updated_at,
          field_values, fields_snapshot,
          form_templates(slug, title_en, title_es, icon, icon_color, fields),
          filler:profiles!filled_by(full_name),
          subject:profiles!subject_user_id(full_name)
          `,
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => {
        // Use fields_snapshot (submitted forms) or template fields (drafts)
        const fields = (row.fields_snapshot ?? row.form_templates?.fields ?? []) as FormFieldDefinition[];
        const values = (row.field_values ?? {}) as FormFieldValues;
        const main = extractMainField(fields, values, 'en');

        return {
          id: row.id,
          templateId: row.template_id,
          templateSlug: row.form_templates?.slug ?? '',
          templateTitleEn: row.form_templates?.title_en ?? '',
          templateTitleEs: row.form_templates?.title_es ?? '',
          templateIcon: row.form_templates?.icon ?? null,
          templateIconColor: row.form_templates?.icon_color ?? null,
          status: row.status,
          filledById: row.filled_by,
          filledByName: row.filler?.full_name ?? null,
          subjectUserId: row.subject_user_id ?? null,
          subjectName: row.subject?.full_name ?? null,
          mainFieldLabel: main?.label ?? null,
          mainFieldValue: main?.value ?? null,
          submittedAt: row.submitted_at ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  // ---------------------------------------------------------------------------
  // Client-side filtering + search
  // ---------------------------------------------------------------------------

  const filteredResults = useMemo(() => {
    let results = [...allResults];

    // Sort by newest first (submitted_at if available, else created_at)
    results.sort(
      (a, b) =>
        new Date(b.submittedAt ?? b.createdAt).getTime() -
        new Date(a.submittedAt ?? a.createdAt).getTime(),
    );

    // Apply template filter
    if (templateFilter) {
      results = results.filter((r) => r.templateSlug === templateFilter);
    }

    // Apply status filter ('recent' and 'all' show everything)
    if (statusFilter !== 'recent' && statusFilter !== 'all') {
      results = results.filter((r) => r.status === statusFilter);
    }

    // Apply search query — every word must match at least one field
    if (debouncedQuery.trim()) {
      const words = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean);
      results = results.filter((r) => {
        const haystack = [
          r.templateTitleEn,
          r.templateTitleEs,
          r.filledByName,
          r.subjectName,
          r.mainFieldValue,
          r.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((word) => haystack.includes(word));
      });
    }

    return results;
  }, [allResults, templateFilter, statusFilter, debouncedQuery]);

  // Paginate the filtered results
  const searchResults = filteredResults.slice(0, offset + PAGE_SIZE);
  const totalCount = filteredResults.length;
  const hasMore = searchResults.length < totalCount;
  const hasSearched = allResults.length > 0 || !isFetching;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const loadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  // When setting manual filters, clear search query (modes are exclusive)
  const handleTemplateFilter = useCallback((slug: string | null) => {
    setTemplateFilter(slug);
    setQuery('');
    setDebouncedQuery('');
    setOffset(0);
  }, []);

  const handleStatusFilter = useCallback((status: string) => {
    setStatusFilter(status);
    setOffset(0);
  }, []);

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q);
    // Clear manual filters when user types (search mode takes over)
    setTemplateFilter(null);
    setStatusFilter('recent');
    setOffset(0);
  }, []);

  // Reset everything (for when sheet closes)
  const reset = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setTemplateFilter(null);
    setStatusFilter('recent');
    setSelectedId(null);
    setOffset(0);
  }, []);

  return {
    // Search
    query,
    setQuery: handleSetQuery,
    searchResults,
    parsedFilters: null,

    // Manual filters
    templateFilter,
    setTemplateFilter: handleTemplateFilter,
    statusFilter,
    setStatusFilter: handleStatusFilter,

    // Selected submission (inline viewer)
    selectedId,
    setSelectedId,

    // State
    totalCount,
    isLoading: isFetching,
    error: fetchError ? (fetchError as Error).message : null,
    hasSearched,

    // Pagination
    hasMore,
    loadMore,

    // Templates list (for filter chips)
    templates,

    // Reset (call when sheet closes)
    reset,
  };
}
