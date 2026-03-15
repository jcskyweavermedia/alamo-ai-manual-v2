/**
 * useNotifications Hook
 *
 * Fetches in-app notifications for the current user.
 * Provides unread count, mark-as-read, and refetch capabilities.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// =============================================================================
// TYPES
// =============================================================================

export interface Notification {
  id: string;
  group_id: string;
  user_id: string;
  type: string; // 'nudge' | 'assignment' | 'reminder' | 'announcement'
  title: string;
  body: string | null;
  metadata: Record<string, any>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { permissions } = useAuth();
  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const fetchNotifications = useCallback(async () => {
    if (!primaryGroup) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('notifications')
        .select('*')
        .eq('group_id', primaryGroup.groupId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (queryError) throw queryError;

      setNotifications((data as Notification[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [primaryGroup?.groupId]);

  const markRead = useCallback(async (notificationId: string) => {
    // Optimistic update: mark as read in local state immediately
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId
          ? { ...n, read: true, read_at: new Date().toISOString() }
          : n
      )
    );

    try {
      const { error: rpcError } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (rpcError) throw rpcError;
    } catch (err: unknown) {
      // Revert optimistic update on failure
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read: false, read_at: null }
            : n
        )
      );
      const message = err instanceof Error ? err.message : 'Failed to mark notification as read';
      setError(message);
    }
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return { notifications, unreadCount, isLoading, error, markRead, refetch: fetchNotifications };
}
