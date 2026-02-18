/**
 * useTeamTraining Hook
 *
 * Fetches team-wide training data for the manager dashboard:
 * - Team member progress via get_team_progress RPC
 * - Course completion stats
 * - Dashboard summary with overdue count
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type {
  TeamMemberProgress,
  TeamMemberStatus,
  CourseStats,
  DashboardSummary,
} from '@/types/dashboard';

export function useTeamTraining() {
  const { user, permissions, isManager } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['team-training', groupId],
    queryFn: async () => {
      if (!groupId) return { members: [], courseStats: [], summary: null };

      const [teamRes, coursesRes, enrollmentsRes, overdueRes] = await Promise.all([
        supabase.rpc('get_team_progress', { p_group_id: groupId }),
        supabase
          .from('courses')
          .select('id, title_en')
          .eq('group_id', groupId)
          .eq('status', 'published'),
        supabase
          .from('course_enrollments')
          .select('course_id, status, final_score')
          .eq('group_id', groupId),
        supabase
          .from('rollout_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'overdue'),
      ]);

      if (teamRes.error) throw new Error(teamRes.error.message);

      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      // Transform team members with computed status
      const members: TeamMemberProgress[] = (teamRes.data ?? []).map(
        (m: Record<string, unknown>) => {
          let status: TeamMemberStatus = 'on_track';
          if (
            !m.last_active_at ||
            (m.last_active_at as string) < sevenDaysAgo
          )
            status = 'inactive';
          else if (
            Number(m.overall_progress_percent) < 50 &&
            (m.courses_total as number) > 0
          )
            status = 'behind';

          return {
            userId: m.user_id as string,
            fullName: m.full_name as string | null,
            email: m.email as string,
            avatarUrl: m.avatar_url as string | null,
            role: m.role as 'staff' | 'manager' | 'admin',
            coursesCompleted: m.courses_completed as number,
            coursesTotal: m.courses_total as number,
            overallProgressPercent: Number(m.overall_progress_percent),
            averageQuizScore: m.average_quiz_score
              ? Number(m.average_quiz_score)
              : null,
            competencyLevel: null,
            lastActiveAt: m.last_active_at as string | null,
            failedSections: (m.failed_sections as string[]) ?? [],
            status,
          };
        }
      );

      // Aggregate course stats
      const courseStats: CourseStats[] = (coursesRes.data ?? []).map(
        (c: { id: string; title_en: string }) => {
          const ce = (enrollmentsRes.data ?? []).filter(
            (e: { course_id: string }) => e.course_id === c.id
          );
          const done = ce.filter(
            (e: { status: string }) => e.status === 'completed'
          ).length;
          const scores = ce
            .filter(
              (e: { final_score: number | null }) => e.final_score != null
            )
            .map((e: { final_score: number | null }) => e.final_score!);
          return {
            courseId: c.id,
            courseTitle: c.title_en,
            enrolledCount: ce.length,
            completedCount: done,
            averageScore:
              scores.length > 0
                ? Math.round(
                    scores.reduce((a: number, b: number) => a + b, 0) /
                      scores.length
                  )
                : null,
            completionPercent:
              ce.length > 0 ? Math.round((done / ce.length) * 100) : 0,
          };
        }
      );

      const activeCount = members.filter(
        (m) => m.status !== 'inactive'
      ).length;
      const summary: DashboardSummary = {
        totalStaff: members.length,
        activeStaff: activeCount,
        teamAverage:
          members.length > 0
            ? Math.round(
                members.reduce((s, m) => s + m.overallProgressPercent, 0) /
                  members.length
              )
            : 0,
        coursesPublished: coursesRes.data?.length ?? 0,
        overdueTasks: overdueRes.count ?? 0,
      };

      return { members, courseStats, summary };
    },
    enabled: !!groupId && isManager,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    members: data?.members ?? [],
    courseStats: data?.courseStats ?? [],
    summary: data?.summary ?? null,
    isLoading,
    error: error as Error | null,
  };
}
