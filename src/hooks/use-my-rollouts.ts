/**
 * useMyRollouts Hook
 *
 * Fetches the current user's active rollout assignments.
 * Used to show deadline banners on the TrainingHome page.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface MyRolloutAssignment {
  id: string;
  status: string;
  rollout_id: string;
  rollouts: {
    name: string;
    deadline: string | null;
  } | null;
}

export function useMyRollouts() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data: assignments = [] } = useQuery({
    queryKey: ['my-rollouts', userId],
    queryFn: async (): Promise<MyRolloutAssignment[]> => {
      if (!userId) return [];
      const { data } = await supabase
        .from('rollout_assignments')
        .select('id, status, rollout_id, rollouts(name, deadline)')
        .eq('user_id', userId)
        .in('status', ['assigned', 'in_progress']);
      return (data ?? []) as unknown as MyRolloutAssignment[];
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });

  return { assignments };
}
