/**
 * useRollouts Hook
 *
 * CRUD for training rollouts and assignments.
 * Fetches rollouts with aggregated progress, supports create and archive.
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { transformRollout } from '@/types/dashboard';
import type { RolloutWithProgress } from '@/types/dashboard';

export function useRollouts() {
  const { user, permissions, isManager } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;
  const queryClient = useQueryClient();

  // ─── READ ─────────────────────────────────────────────────────
  const {
    data: rollouts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['rollouts', groupId],
    queryFn: async (): Promise<RolloutWithProgress[]> => {
      if (!groupId) return [];

      const [rolloutsRes, assignmentsRes] = await Promise.all([
        supabase
          .from('rollouts')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false }),
        supabase.from('rollout_assignments').select('rollout_id, status'),
      ]);

      if (rolloutsRes.error) throw new Error(rolloutsRes.error.message);

      const aMap = new Map<
        string,
        { total: number; completed: number; overdue: number }
      >();
      for (const a of assignmentsRes.data ?? []) {
        const cur = aMap.get(a.rollout_id) ?? {
          total: 0,
          completed: 0,
          overdue: 0,
        };
        cur.total++;
        if (a.status === 'completed') cur.completed++;
        if (a.status === 'overdue') cur.overdue++;
        aMap.set(a.rollout_id, cur);
      }

      return rolloutsRes.data.map((raw) => {
        const agg = aMap.get(raw.id) ?? { total: 0, completed: 0, overdue: 0 };
        return {
          ...transformRollout(raw),
          totalAssignees: agg.total,
          completedAssignees: agg.completed,
          overdueAssignees: agg.overdue,
          progressPercent:
            agg.total > 0
              ? Math.round((agg.completed / agg.total) * 100)
              : 0,
        };
      });
    },
    enabled: !!groupId && isManager,
    staleTime: 5 * 60 * 1000,
  });

  // ─── CREATE ───────────────────────────────────────────────────
  const createRollout = useCallback(
    async (data: {
      name: string;
      description?: string;
      courseIds: string[];
      sectionIds?: string[];
      deadline?: string;
      expiresAt?: string;
      assigneeIds: string[];
    }) => {
      if (!groupId || !user) throw new Error('Not authenticated');

      const { data: rollout, error: err } = await supabase
        .from('rollouts')
        .insert({
          group_id: groupId,
          name: data.name,
          description: data.description ?? null,
          course_ids: data.courseIds,
          section_ids: data.sectionIds ?? [],
          deadline: data.deadline ?? null,
          expires_at: data.expiresAt ?? null,
          status: 'active' as const,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (err) throw new Error(err.message);

      if (data.assigneeIds.length > 0) {
        const rows = data.assigneeIds.map((uid) => ({
          rollout_id: rollout.id,
          user_id: uid,
          status: 'assigned' as const,
          total_courses: data.courseIds.length,
        }));
        const { error: aErr } = await supabase
          .from('rollout_assignments')
          .insert(rows);
        if (aErr) throw new Error(aErr.message);
      }

      queryClient.invalidateQueries({ queryKey: ['rollouts', groupId] });
      queryClient.invalidateQueries({ queryKey: ['team-training'] });
      return rollout.id;
    },
    [groupId, user, queryClient]
  );

  // ─── ARCHIVE ──────────────────────────────────────────────────
  const archiveRollout = useCallback(
    async (rolloutId: string) => {
      await supabase
        .from('rollouts')
        .update({ status: 'archived' })
        .eq('id', rolloutId);
      queryClient.invalidateQueries({ queryKey: ['rollouts', groupId] });
    },
    [groupId, queryClient]
  );

  return {
    rollouts,
    activeRollouts: rollouts.filter((r) => r.status === 'active'),
    isLoading,
    error: error as Error | null,
    createRollout,
    archiveRollout,
  };
}
