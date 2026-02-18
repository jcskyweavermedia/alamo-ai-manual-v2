import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { SectionProgress, SectionProgressRaw } from '@/types/training';
import { transformSectionProgress } from '@/types/training';

interface UseSectionProgressOptions {
  sectionId: string | undefined;
  courseId: string | undefined;
  enrollmentId: string | undefined;
}

export function useSectionProgress({ sectionId, courseId, enrollmentId }: UseSectionProgressOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const [isMutating, setIsMutating] = useState(false);

  const { data: progress = null, isLoading, error } = useQuery({
    queryKey: ['section-progress', sectionId, userId],
    queryFn: async (): Promise<SectionProgress | null> => {
      if (!sectionId || !userId || !courseId) return null;

      const { data, error: fetchError } = await supabase
        .from('section_progress')
        .select('*')
        .eq('section_id', sectionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) return null;

      return transformSectionProgress(data as SectionProgressRaw);
    },
    enabled: !!sectionId && !!userId && !!courseId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['section-progress', sectionId, userId] });
    queryClient.invalidateQueries({ queryKey: ['course-sections'] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    queryClient.invalidateQueries({ queryKey: ['programs'] });
    queryClient.invalidateQueries({ queryKey: ['program-enrollment'] });
    queryClient.invalidateQueries({ queryKey: ['course-assessment'] });
  }, [queryClient, sectionId, userId]);

  const startSection = useCallback(async () => {
    if (!sectionId || !userId || !courseId || !enrollmentId) return;
    setIsMutating(true);

    try {
      if (progress) {
        if (progress.status === 'not_started') {
          const { error: updateError } = await supabase
            .from('section_progress')
            .update({
              status: 'in_progress',
              started_at: new Date().toISOString(),
            })
            .eq('id', progress.id);

          if (updateError) throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('section_progress')
          .insert({
            user_id: userId,
            section_id: sectionId,
            enrollment_id: enrollmentId,
            course_id: courseId,
            status: 'in_progress',
            started_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
      }

      invalidate();
    } finally {
      setIsMutating(false);
    }
  }, [sectionId, userId, courseId, enrollmentId, progress, invalidate]);

  const updateTopics = useCallback(async (covered: number, total: number) => {
    if (!progress) return;
    setIsMutating(true);

    try {
      const { error: updateError } = await supabase
        .from('section_progress')
        .update({
          topics_covered: covered,
          topics_total: total,
          status: 'in_progress',
        })
        .eq('id', progress.id);

      if (updateError) throw updateError;
      invalidate();
    } finally {
      setIsMutating(false);
    }
  }, [progress, invalidate]);

  const markComplete = useCallback(async () => {
    if (!progress || !enrollmentId) return;
    setIsMutating(true);

    try {
      const { error: updateError } = await supabase
        .from('section_progress')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', progress.id);

      if (updateError) throw updateError;

      // Update enrollment completed_sections count
      const { count } = await supabase
        .from('section_progress')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'completed');

      await supabase
        .from('course_enrollments')
        .update({ completed_sections: count ?? 0 })
        .eq('id', enrollmentId);

      invalidate();
    } finally {
      setIsMutating(false);
    }
  }, [progress, enrollmentId, invalidate]);

  return {
    progress,
    startSection,
    updateTopics,
    markComplete,
    isLoading: isLoading || isMutating,
  };
}
