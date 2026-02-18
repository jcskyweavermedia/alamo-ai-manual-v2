import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import type {
  CourseWithProgress,
  CourseRaw,
  CourseEnrollmentRaw,
  SectionProgressRaw,
  CourseSectionRaw,
  EnrollmentStatus,
} from '@/types/training';

export function useCourses(programId?: string) {
  const { user, permissions } = useAuth();
  const { language } = useLanguage();

  const userId = user?.id ?? null;
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const { data: courses = [], isLoading, error } = useQuery({
    queryKey: ['courses', groupId, userId, programId],
    queryFn: async (): Promise<CourseWithProgress[]> => {
      if (!groupId || !userId) return [];

      // 1. Fetch published courses for this group
      let query = supabase
        .from('courses')
        .select('*')
        .eq('group_id', groupId)
        .in('status', ['published', 'archived'])
        .order('sort_order');

      if (programId) {
        query = query.eq('program_id', programId);
      }

      const { data: rawCourses, error: coursesError } = await query;

      if (coursesError) throw coursesError;
      if (!rawCourses || rawCourses.length === 0) return [];

      const courseIds = rawCourses.map((c: CourseRaw) => c.id);

      // 2. Fetch sections for these courses (for total counts)
      const { data: rawSections, error: sectionsError } = await supabase
        .from('course_sections')
        .select('id, course_id')
        .in('course_id', courseIds)
        .eq('status', 'published');

      if (sectionsError) throw sectionsError;

      // 3. Fetch enrollments for this user + these courses
      const { data: rawEnrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', userId)
        .in('course_id', courseIds);

      if (enrollError) throw enrollError;

      // 4. Fetch section progress for this user + these courses
      const { data: rawProgress, error: progressError } = await supabase
        .from('section_progress')
        .select('*')
        .eq('user_id', userId)
        .in('course_id', courseIds);

      if (progressError) throw progressError;

      // Build lookup maps
      const sectionCountMap = new Map<string, number>();
      for (const s of (rawSections ?? []) as Pick<CourseSectionRaw, 'id' | 'course_id'>[]) {
        sectionCountMap.set(s.course_id, (sectionCountMap.get(s.course_id) ?? 0) + 1);
      }

      const enrollmentMap = new Map<string, EnrollmentStatus>();
      for (const e of (rawEnrollments ?? []) as CourseEnrollmentRaw[]) {
        enrollmentMap.set(e.course_id, e.status);
      }

      const completedMap = new Map<string, number>();
      for (const p of (rawProgress ?? []) as SectionProgressRaw[]) {
        if (p.status === 'completed') {
          completedMap.set(p.course_id, (completedMap.get(p.course_id) ?? 0) + 1);
        }
      }

      // Transform
      return rawCourses.map((raw: CourseRaw): CourseWithProgress => {
        const totalSections = sectionCountMap.get(raw.id) ?? 0;
        const completedSections = completedMap.get(raw.id) ?? 0;
        const progressPercent = totalSections > 0
          ? Math.round((completedSections / totalSections) * 100)
          : 0;

        return {
          id: raw.id,
          groupId: raw.group_id,
          programId: raw.program_id,
          slug: raw.slug,
          titleEn: raw.title_en,
          titleEs: raw.title_es,
          descriptionEn: raw.description_en,
          descriptionEs: raw.description_es,
          icon: raw.icon,
          sortOrder: raw.sort_order,
          estimatedMinutes: raw.estimated_minutes,
          passingScore: raw.passing_score,
          status: raw.status,
          createdAt: raw.created_at,
          updatedAt: raw.updated_at,
          totalSections,
          completedSections,
          progressPercent,
          enrollmentStatus: enrollmentMap.get(raw.id) ?? null,
        };
      });
    },
    enabled: !!groupId && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return { courses, isLoading, error: error as Error | null, language };
}
