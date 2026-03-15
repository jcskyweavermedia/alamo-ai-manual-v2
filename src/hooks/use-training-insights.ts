/**
 * useTrainingInsights Hook
 *
 * Fetches current (non-superseded) training insights for the manager's group.
 * Auto-loads on mount and exposes a refetch function.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingInsight {
  id: string;
  group_id: string;
  insight_type: string;  // 'team_weekly' | 'employee_alert' | 'course_health' | 'milestone'
  severity: string;      // 'info' | 'warning' | 'critical'
  title: string;
  body: string | null;
  data: Record<string, any>;
  period_start: string;
  period_end: string;
  created_at: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useTrainingInsights() {
  const [insights, setInsights] = useState<TrainingInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { permissions } = useAuth();
  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const fetchInsights = useCallback(async () => {
    if (!primaryGroup) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .rpc('get_recent_insights', { p_group_id: primaryGroup.groupId });

      if (queryError) throw queryError;

      setInsights((data as TrainingInsight[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load training insights';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [primaryGroup?.groupId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return { insights, isLoading, error, refetch: fetchInsights };
}
