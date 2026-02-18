import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { ProgramEnrollment, ProgramEnrollmentRaw } from '@/types/training';
import { transformProgramEnrollment } from '@/types/training';

interface UseProgramEnrollmentOptions {
  programId: string | undefined;
  autoEnroll?: boolean;
}

export function useProgramEnrollment({ programId, autoEnroll = false }: UseProgramEnrollmentOptions) {
  const { user, permissions } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const [isMutating, setIsMutating] = useState(false);

  const { data: enrollment = null, isLoading, error } = useQuery({
    queryKey: ['program-enrollment', programId, userId],
    queryFn: async (): Promise<ProgramEnrollment | null> => {
      if (!programId || !userId) return null;

      const { data, error: fetchError } = await supabase
        .from('program_enrollments')
        .select('*')
        .eq('program_id', programId)
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) return null;

      return transformProgramEnrollment(data as ProgramEnrollmentRaw);
    },
    enabled: !!programId && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['program-enrollment', programId, userId] });
    queryClient.invalidateQueries({ queryKey: ['programs'] });
  }, [queryClient, programId, userId]);

  const enroll = useCallback(async () => {
    if (!programId || !userId || !groupId) return;
    setIsMutating(true);

    try {
      // Count published courses for total_courses
      const { count } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', programId)
        .eq('status', 'published');

      const { error: insertError } = await supabase
        .from('program_enrollments')
        .insert({
          user_id: userId,
          program_id: programId,
          group_id: groupId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          total_courses: count ?? 0,
        });

      if (insertError) throw insertError;
      invalidate();
    } finally {
      setIsMutating(false);
    }
  }, [programId, userId, groupId, invalidate]);

  // Auto-enroll on mount if enabled and no existing enrollment
  useEffect(() => {
    if (autoEnroll && !isLoading && !enrollment && programId && userId && groupId && !isMutating) {
      enroll();
    }
  }, [autoEnroll, isLoading, enrollment, programId, userId, groupId, isMutating, enroll]);

  return {
    enrollment,
    enroll,
    isLoading: isLoading || isMutating,
  };
}
