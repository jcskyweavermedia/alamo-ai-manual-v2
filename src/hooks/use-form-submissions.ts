/**
 * useFormSubmissions Hook
 *
 * Admin/manager list hook for viewing submissions for a given template.
 * TanStack Query with pagination (offset-based, 20 per page).
 * Optional status filter.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { transformSubmissionRow } from '@/lib/form-utils';
import type {
  FormSubmission,
  FormSubmissionStatus,
} from '@/types/forms';

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_SIZE = 20;

// =============================================================================
// HOOK
// =============================================================================

export type SubmissionStatusFilter = 'all' | FormSubmissionStatus;

interface UseFormSubmissionsOptions {
  templateId: string | null;
  initialStatusFilter?: SubmissionStatusFilter;
}

export function useFormSubmissions({
  templateId,
  initialStatusFilter = 'all',
}: UseFormSubmissionsOptions) {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatusFilter>(initialStatusFilter);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['form-submissions', templateId, statusFilter, page],
    queryFn: async (): Promise<{ submissions: FormSubmission[]; totalCount: number }> => {
      let query = supabase
        .from('form_submissions')
        .select(
          'id, template_id, group_id, template_version, fields_snapshot, field_values, status, filled_by, submitted_by, subject_user_id, submitted_at, attachments, ai_session_id, notes, created_at, updated_at',
          { count: 'exact' },
        )
        .eq('template_id', templateId!);

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Order by most recent first + paginate
      query = query
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data: rows, error, count } = await query;

      if (error) throw error;

      return {
        submissions: (rows || []).map(transformSubmissionRow),
        totalCount: count ?? 0,
      };
    },
    enabled: !!templateId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  const totalPages = Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE);

  return {
    submissions: data?.submissions ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
    error: error as Error | null,
    page,
    setPage,
    totalPages,
    pageSize: PAGE_SIZE,
    statusFilter,
    setStatusFilter,
  };
}
