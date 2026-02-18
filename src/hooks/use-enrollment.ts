import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { CourseEnrollment, CourseEnrollmentRaw } from '@/types/training';
import { transformEnrollment } from '@/types/training';

interface UseEnrollmentOptions {
  courseId: string | undefined;
  autoEnroll?: boolean;
}

export function useEnrollment({ courseId, autoEnroll = false }: UseEnrollmentOptions) {
  const { user, permissions } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const [isMutating, setIsMutating] = useState(false);

  const { data: enrollment = null, isLoading, error } = useQuery({
    queryKey: ['enrollment', courseId, userId],
    queryFn: async (): Promise<CourseEnrollment | null> => {
      if (!courseId || !userId) return null;

      const { data, error: fetchError } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) return null;

      return transformEnrollment(data as CourseEnrollmentRaw);
    },
    enabled: !!courseId && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['enrollment', courseId, userId] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
  }, [queryClient, courseId, userId]);

  const enroll = useCallback(async (targetCourseId?: string) => {
    const cId = targetCourseId ?? courseId;
    if (!cId || !userId || !groupId) return;
    setIsMutating(true);

    try {
      // Count sections for total_sections
      const { count } = await supabase
        .from('course_sections')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', cId)
        .eq('status', 'published');

      const { error: insertError } = await supabase
        .from('course_enrollments')
        .insert({
          user_id: userId,
          course_id: cId,
          group_id: groupId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          total_sections: count ?? 0,
        });

      if (insertError) throw insertError;
      invalidate();
    } finally {
      setIsMutating(false);
    }
  }, [courseId, userId, groupId, invalidate]);

  const startCourse = useCallback(async () => {
    if (!enrollment) return;
    setIsMutating(true);

    try {
      const { error: updateError } = await supabase
        .from('course_enrollments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id);

      if (updateError) throw updateError;
      invalidate();
    } finally {
      setIsMutating(false);
    }
  }, [enrollment, invalidate]);

  // Auto-enroll on mount if enabled and no existing enrollment
  useEffect(() => {
    if (autoEnroll && !isLoading && !enrollment && courseId && userId && groupId && !isMutating) {
      enroll();
    }
  }, [autoEnroll, isLoading, enrollment, courseId, userId, groupId, isMutating, enroll]);

  return {
    enrollment,
    enroll,
    startCourse,
    isLoading: isLoading || isMutating,
  };
}
