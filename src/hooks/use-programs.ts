import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import type {
  ProgramWithProgress,
  TrainingProgramRaw,
  ProgramEnrollmentRaw,
  CourseRaw,
  CourseEnrollmentRaw,
  ProgramEnrollmentStatus,
} from '@/types/training';

export function usePrograms() {
  const { user, permissions } = useAuth();
  const { language } = useLanguage();

  const userId = user?.id ?? null;
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const { data: programs = [], isLoading, error } = useQuery({
    queryKey: ['programs', groupId, userId],
    queryFn: async (): Promise<ProgramWithProgress[]> => {
      if (!groupId || !userId) return [];

      // 1. Fetch published + coming_soon programs for this group
      const { data: rawPrograms, error: programsError } = await supabase
        .from('training_programs')
        .select('*')
        .eq('group_id', groupId)
        .in('status', ['published', 'coming_soon'])
        .order('sort_order');

      if (programsError) throw programsError;
      if (!rawPrograms || rawPrograms.length === 0) return [];

      const programIds = rawPrograms.map((p: TrainingProgramRaw) => p.id);

      // 2. Fetch published courses linked to these programs
      const { data: rawCourses, error: coursesError } = await supabase
        .from('courses')
        .select('id, program_id')
        .in('program_id', programIds)
        .eq('status', 'published');

      if (coursesError) throw coursesError;

      // 3. Fetch program enrollments for this user
      const { data: rawEnrollments, error: enrollError } = await supabase
        .from('program_enrollments')
        .select('*')
        .eq('user_id', userId)
        .in('program_id', programIds);

      if (enrollError) throw enrollError;

      // 4. Fetch course enrollments for courses in these programs
      const courseIds = (rawCourses ?? []).map((c: Pick<CourseRaw, 'id' | 'program_id'>) => c.id);
      let completedCourseMap = new Map<string, number>();

      if (courseIds.length > 0) {
        const { data: rawCourseEnrollments, error: ceError } = await supabase
          .from('course_enrollments')
          .select('*')
          .eq('user_id', userId)
          .in('course_id', courseIds);

        if (ceError) throw ceError;

        // Count completed courses per program
        const courseProgMap = new Map<string, string>();
        for (const c of (rawCourses ?? []) as Pick<CourseRaw, 'id' | 'program_id'>[]) {
          if (c.program_id) courseProgMap.set(c.id, c.program_id);
        }

        for (const ce of (rawCourseEnrollments ?? []) as CourseEnrollmentRaw[]) {
          if (ce.completed_sections >= ce.total_sections && ce.total_sections > 0) {
            const progId = courseProgMap.get(ce.course_id);
            if (progId) {
              completedCourseMap.set(progId, (completedCourseMap.get(progId) ?? 0) + 1);
            }
          }
        }
      }

      // Build lookup maps
      const courseCountMap = new Map<string, number>();
      for (const c of (rawCourses ?? []) as Pick<CourseRaw, 'id' | 'program_id'>[]) {
        if (c.program_id) {
          courseCountMap.set(c.program_id, (courseCountMap.get(c.program_id) ?? 0) + 1);
        }
      }

      const enrollmentMap = new Map<string, ProgramEnrollmentStatus>();
      for (const e of (rawEnrollments ?? []) as ProgramEnrollmentRaw[]) {
        enrollmentMap.set(e.program_id, e.status);
      }

      // Transform
      return rawPrograms.map((raw: TrainingProgramRaw): ProgramWithProgress => {
        const isComingSoon = raw.status === 'coming_soon';
        const totalCourses = isComingSoon ? 0 : (courseCountMap.get(raw.id) ?? 0);
        const completedCourses = isComingSoon ? 0 : (completedCourseMap.get(raw.id) ?? 0);
        const progressPercent = totalCourses > 0
          ? Math.round((completedCourses / totalCourses) * 100)
          : 0;

        return {
          id: raw.id,
          groupId: raw.group_id,
          slug: raw.slug,
          titleEn: raw.title_en,
          titleEs: raw.title_es,
          descriptionEn: raw.description_en,
          descriptionEs: raw.description_es,
          coverImage: raw.cover_image,
          category: raw.category,
          icon: raw.icon,
          sortOrder: raw.sort_order,
          estimatedMinutes: raw.estimated_minutes,
          passingScore: raw.passing_score,
          status: raw.status,
          createdAt: raw.created_at,
          updatedAt: raw.updated_at,
          totalCourses,
          completedCourses,
          progressPercent,
          enrollmentStatus: isComingSoon ? null : (enrollmentMap.get(raw.id) ?? null),
        };
      });
    },
    enabled: !!groupId && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { programs, isLoading, error: error as Error | null, language };
}
