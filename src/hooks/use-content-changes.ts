/**
 * useContentChanges Hook
 *
 * Detects content changes in source tables by calling detect_content_changes RPC.
 * Provides acknowledge action to dismiss changes.
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { ContentChangeWithContext } from '@/types/dashboard';

export function useContentChanges() {
  const { permissions, isManager } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;
  const queryClient = useQueryClient();

  const {
    data: changes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['content-changes', groupId],
    queryFn: async (): Promise<ContentChangeWithContext[]> => {
      if (!groupId) return [];

      const { data, error: rpcError } = await supabase.rpc(
        'detect_content_changes',
        { p_group_id: groupId }
      );

      if (rpcError) throw new Error(rpcError.message);

      // Enrich each change with affected student count
      return Promise.all(
        (data ?? []).map(
          async (row: Record<string, unknown>) => {
            const { count } = await supabase
              .from('section_progress')
              .select('id', { count: 'exact', head: true })
              .eq('section_id', row.section_id as string)
              .eq('status', 'completed');

            return {
              sectionId: row.section_id as string,
              sectionTitle: row.section_title as string,
              sourceTable: row.source_table as string,
              sourceId: row.source_id as string,
              oldHash: row.old_hash as string,
              newHash: row.new_hash as string,
              affectedStudents: count ?? 0,
            };
          }
        )
      );
    },
    enabled: !!groupId && isManager,
    staleTime: 10 * 60 * 1000,
  });

  const acknowledge = useCallback(
    async (sourceTable: string, sourceId: string, newHash: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from('content_change_log').insert({
        source_table: sourceTable,
        source_id: sourceId,
        content_hash: newHash,
        acknowledged_by: user?.id,
        acknowledged_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({
        queryKey: ['content-changes', groupId],
      });
    },
    [groupId, queryClient]
  );

  return {
    changes,
    unacknowledgedCount: changes.length,
    isLoading,
    error: error as Error | null,
    acknowledge,
  };
}
