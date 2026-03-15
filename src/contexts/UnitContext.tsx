// UnitContext — Multi-unit context provider
// Fetches ALL group memberships (not just LIMIT 1) and allows switching.
// The activeGroupId is stored in React state only — no Supabase GUC calls.

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface GroupMembership {
  groupId: string;
  groupName: string;
  role: string;
  createdAt: string;
}

interface UnitContextValue {
  activeGroupId: string | null;
  allMemberships: GroupMembership[];
  switchUnit: (groupId: string) => void;
  isLoading: boolean;
}

const UnitContext = createContext<UnitContextValue | null>(null);

export function UnitProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [allMemberships, setAllMemberships] = useState<GroupMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setActiveGroupId(null);
      setAllMemberships([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    supabase
      .from('group_memberships')
      .select('group_id, role, created_at, groups(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[UnitContext] Failed to fetch memberships:', error.message);
          setIsLoading(false);
          return;
        }
        if (data && data.length > 0) {
          const memberships: GroupMembership[] = data.map((m: any) => ({
            groupId: m.group_id,
            groupName: (m.groups as any)?.name ?? 'Unknown',
            role: m.role,
            createdAt: m.created_at,
          }));
          setAllMemberships(memberships);
          setActiveGroupId(memberships[0].groupId);
        }
        setIsLoading(false);
      });
  }, [user?.id]);

  const switchUnit = useCallback((groupId: string) => {
    const membership = allMemberships.find(m => m.groupId === groupId);
    if (membership) {
      setActiveGroupId(groupId);
    }
  }, [allMemberships]);

  return (
    <UnitContext.Provider value={{ activeGroupId, allMemberships, switchUnit, isLoading }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnitContext(): UnitContextValue {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error('useUnitContext must be used within UnitProvider');
  return ctx;
}
