/**
 * useUsageLimits Hook
 * 
 * Fetches and tracks AI usage limits for the current user.
 * Uses React Query for caching and automatic refresh.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface UsageLimits {
  daily: {
    used: number;
    limit: number;
    remaining: number;
  };
  monthly: {
    used: number;
    limit: number;
    remaining: number;
  };
  canAsk: boolean;
}

interface UsageQueryResult {
  daily_count: number;
  monthly_count: number;
  daily_limit: number;
  monthly_limit: number;
  can_ask: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const QUERY_KEY = 'usage-limits';
const STALE_TIME = 30 * 1000; // 30 seconds
const REFETCH_INTERVAL = 60 * 1000; // 1 minute

// Default values when user is not authenticated or has no group
const DEFAULT_LIMITS: UsageLimits = {
  daily: { used: 0, limit: 20, remaining: 20 },
  monthly: { used: 0, limit: 500, remaining: 500 },
  canAsk: false,
};

// =============================================================================
// HOOK
// =============================================================================

export function useUsageLimits() {
  const { user, permissions } = useAuth();
  const queryClient = useQueryClient();

  // Get the first group membership (primary group)
  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const query = useQuery({
    queryKey: [QUERY_KEY, user?.id, primaryGroup?.groupId],
    queryFn: async (): Promise<UsageLimits> => {
      if (!user || !primaryGroup) {
        return DEFAULT_LIMITS;
      }

      const { data, error } = await supabase.rpc('get_user_usage', {
        _user_id: user.id,
        _group_id: primaryGroup.groupId,
      });

      if (error) {
        console.error('Failed to fetch usage limits:', error);
        throw error;
      }

      // RPC returns an array, get first row
      const usage = (data as UsageQueryResult[])?.[0];
      
      if (!usage) {
        // User not in group or no policy found
        return {
          ...DEFAULT_LIMITS,
          canAsk: false,
        };
      }

      return {
        daily: {
          used: usage.daily_count,
          limit: usage.daily_limit,
          remaining: Math.max(0, usage.daily_limit - usage.daily_count),
        },
        monthly: {
          used: usage.monthly_count,
          limit: usage.monthly_limit,
          remaining: Math.max(0, usage.monthly_limit - usage.monthly_count),
        },
        canAsk: usage.can_ask,
      };
    },
    enabled: !!user && !!primaryGroup,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    placeholderData: DEFAULT_LIMITS,
  });

  // Manually refresh usage (call after asking a question)
  const refreshUsage = useCallback(() => {
    queryClient.invalidateQueries({ 
      queryKey: [QUERY_KEY, user?.id, primaryGroup?.groupId] 
    });
  }, [queryClient, user?.id, primaryGroup?.groupId]);

  // Update usage optimistically after asking a question
  const incrementUsageOptimistically = useCallback(() => {
    queryClient.setQueryData<UsageLimits>(
      [QUERY_KEY, user?.id, primaryGroup?.groupId],
      (old) => {
        if (!old) return old;
        
        const newDailyUsed = old.daily.used + 1;
        const newMonthlyUsed = old.monthly.used + 1;
        
        return {
          daily: {
            ...old.daily,
            used: newDailyUsed,
            remaining: Math.max(0, old.daily.limit - newDailyUsed),
          },
          monthly: {
            ...old.monthly,
            used: newMonthlyUsed,
            remaining: Math.max(0, old.monthly.limit - newMonthlyUsed),
          },
          canAsk: newDailyUsed < old.daily.limit && newMonthlyUsed < old.monthly.limit,
        };
      }
    );
  }, [queryClient, user?.id, primaryGroup?.groupId]);

  // Warning thresholds
  const dailyPercentUsed = query.data 
    ? (query.data.daily.used / query.data.daily.limit) * 100 
    : 0;
  const monthlyPercentUsed = query.data
    ? (query.data.monthly.used / query.data.monthly.limit) * 100
    : 0;

  return {
    // Query state
    data: query.data ?? DEFAULT_LIMITS,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    
    // Computed values
    dailyPercentUsed,
    monthlyPercentUsed,
    isNearDailyLimit: dailyPercentUsed >= 80,
    isNearMonthlyLimit: monthlyPercentUsed >= 80,
    isAtLimit: !(query.data?.canAsk ?? true),
    
    // Actions
    refreshUsage,
    incrementUsageOptimistically,
  };
}
