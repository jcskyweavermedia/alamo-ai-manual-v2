/**
 * useTrainingActions Hook
 *
 * Fetches pending training actions for the current group and provides
 * approve/skip resolution functionality. Used by the AI Hub to surface
 * actionable AI suggestions to managers.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingAction {
  id: string;
  group_id: string;
  action_type: string;
  status: string;
  source: string;
  target_employee_id: string | null;
  target_program_id: string | null;
  target_course_id: string | null;
  display_data: {
    title?: string;
    description?: string;
    priority?: string;
    actions?: string[];
  };
  expires_at: string;
  created_at: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useTrainingActions() {
  const [actions, setActions] = useState<TrainingAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { permissions } = useAuth();
  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const fetchActions = useCallback(async () => {
    if (!primaryGroup) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('training_actions')
        .select('*')
        .eq('group_id', primaryGroup.groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      setActions((data as TrainingAction[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load training actions';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [primaryGroup?.groupId]);

  const resolveAction = useCallback(
    async (actionId: string, resolution: 'approved' | 'skipped', note?: string) => {
      try {
        const { error: rpcError } = await supabase.rpc('resolve_training_action', {
          p_action_id: actionId,
          p_resolution: resolution,
          p_note: note || null,
        });

        if (rpcError) throw rpcError;

        // Refetch to update the list after successful resolution
        await fetchActions();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to resolve training action';
        setError(message);
      }
    },
    [fetchActions]
  );

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  return { actions, isLoading, error, resolveAction, refetch: fetchActions };
}
