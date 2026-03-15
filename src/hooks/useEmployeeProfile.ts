/**
 * useEmployeeProfile -- Returns the current user's employee position and department.
 * Queries employees WHERE profile_id = auth.uid().
 * Returns nulls if no employee record (safe fallback -- user sees all nav groups).
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface EmployeeProfile {
  employeeId: string | null;
  position: string | null;
  department: string | null;
  isLoading: boolean;
}

export function useEmployeeProfile(): EmployeeProfile {
  const { user } = useAuth();
  const [profile, setProfile] = useState<EmployeeProfile>({
    employeeId: null,
    position: null,
    department: null,
    isLoading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setProfile({ employeeId: null, position: null, department: null, isLoading: false });
      return;
    }

    // employees table may not be in generated types yet; use type assertion
    (supabase.from as any)('employees')
      .select('id, position, department')
      .eq('profile_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) {
          console.error('[useEmployeeProfile]', error.message);
        }
        setProfile({
          employeeId: data?.id ?? null,
          position: data?.position ?? null,
          department: data?.department ?? null,
          isLoading: false,
        });
      });
  }, [user?.id]);

  return profile;
}
