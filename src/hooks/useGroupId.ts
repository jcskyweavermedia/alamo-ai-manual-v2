import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth';

/**
 * Shared hook to fetch the current user's group_id from group_memberships.
 * Replaces duplicated queries in AdminFormsListPage, AdminFormBuilderPage, etc.
 */
export function useGroupId(): string | null {
  const { user } = useAuth();
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[useGroupId] Failed to fetch group:', error.message);
        if (data) setGroupId(data.group_id);
      });
  }, [user?.id]);

  return groupId;
}
