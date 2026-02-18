/**
 * useCourseAssessment Hook
 *
 * Fetches assessment status for CourseDetail cards:
 * - Module test status (not_started, in_progress, passed, failed)
 * - Tutor session status (not_started, in_progress, ready)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { ModuleTestStatus, TutorStatus } from '@/types/training';

interface UseCourseAssessmentOptions {
  courseId: string | undefined;
}

export function useCourseAssessment({ courseId }: UseCourseAssessmentOptions) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['course-assessment', courseId, userId],
    queryFn: async () => {
      if (!courseId || !userId) {
        return {
          moduleTestStatus: 'not_started' as ModuleTestStatus,
          moduleTestScore: null as number | null,
          moduleTestAttempts: 0,
          tutorStatus: 'not_started' as TutorStatus,
          tutorReadinessScore: 0,
        };
      }

      // Fetch latest module test attempt
      const { data: testAttempts } = await supabase
        .from('module_test_attempts' as any)
        .select('id, status, score, passed, attempt_number')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1);

      let moduleTestStatus: ModuleTestStatus = 'not_started';
      let moduleTestScore: number | null = null;
      let moduleTestAttempts = 0;

      if (testAttempts && testAttempts.length > 0) {
        const latest = testAttempts[0];
        moduleTestAttempts = latest.attempt_number ?? 1;
        if (latest.status === 'in_progress') {
          moduleTestStatus = 'in_progress';
        } else if (latest.passed === true) {
          moduleTestStatus = 'passed';
          moduleTestScore = latest.score;
        } else if (latest.status === 'completed') {
          moduleTestStatus = 'failed';
          moduleTestScore = latest.score;
        }
      }

      // Fetch latest tutor session
      const { data: tutorSessions } = await supabase
        .from('tutor_sessions' as any)
        .select('id, readiness_score, readiness_suggested')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .order('updated_at', { ascending: false })
        .limit(1);

      let tutorStatus: TutorStatus = 'not_started';
      let tutorReadinessScore = 0;

      if (tutorSessions && tutorSessions.length > 0) {
        const latest = tutorSessions[0];
        tutorReadinessScore = latest.readiness_score ?? 0;
        if (latest.readiness_suggested) {
          tutorStatus = 'ready';
        } else {
          tutorStatus = 'in_progress';
        }
      }

      return {
        moduleTestStatus,
        moduleTestScore,
        moduleTestAttempts,
        tutorStatus,
        tutorReadinessScore,
      };
    },
    enabled: !!courseId && !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    moduleTestStatus: data?.moduleTestStatus ?? 'not_started',
    moduleTestScore: data?.moduleTestScore ?? null,
    moduleTestAttempts: data?.moduleTestAttempts ?? 0,
    tutorStatus: data?.tutorStatus ?? 'not_started',
    tutorReadinessScore: data?.tutorReadinessScore ?? 0,
    isLoading,
  };
}
