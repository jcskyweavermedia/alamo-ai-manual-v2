import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import type {
  Course,
  CourseRaw,
  CourseSectionRaw,
  SectionWithProgress,
  SectionProgressRaw,
  SectionProgressStatus,
} from '@/types/training';
import { transformCourseSection } from '@/types/training';

export function useCourseSections(courseSlug: string | undefined) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const userId = user?.id ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['course-sections', courseSlug, userId],
    queryFn: async (): Promise<{ course: Course; sections: SectionWithProgress[] }> => {
      if (!courseSlug || !userId) {
        throw new Error('Missing courseSlug or userId');
      }

      // 1. Fetch course by slug
      const { data: rawCourse, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('slug', courseSlug)
        .single();

      if (courseError) throw courseError;
      if (!rawCourse) throw new Error('Course not found');

      const courseRaw = rawCourse as CourseRaw;

      const course: Course = {
        id: courseRaw.id,
        groupId: courseRaw.group_id,
        programId: courseRaw.program_id,
        slug: courseRaw.slug,
        titleEn: courseRaw.title_en,
        titleEs: courseRaw.title_es,
        descriptionEn: courseRaw.description_en,
        descriptionEs: courseRaw.description_es,
        icon: courseRaw.icon,
        sortOrder: courseRaw.sort_order,
        estimatedMinutes: courseRaw.estimated_minutes,
        passingScore: courseRaw.passing_score,
        status: courseRaw.status,
        createdAt: courseRaw.created_at,
        updatedAt: courseRaw.updated_at,
      };

      // 2. Fetch sections for this course
      const { data: rawSections, error: sectionsError } = await supabase
        .from('course_sections')
        .select('*')
        .eq('course_id', course.id)
        .eq('status', 'published')
        .order('sort_order');

      if (sectionsError) throw sectionsError;

      const sectionIds = (rawSections ?? []).map((s: CourseSectionRaw) => s.id);

      // 3. Fetch progress for this user + these sections
      const progressMap = new Map<string, SectionProgressRaw>();

      if (sectionIds.length > 0) {
        const { data: rawProgress, error: progressError } = await supabase
          .from('section_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('course_id', course.id)
          .in('section_id', sectionIds);

        if (progressError) throw progressError;

        for (const p of (rawProgress ?? []) as SectionProgressRaw[]) {
          progressMap.set(p.section_id, p);
        }
      }

      // 4. Transform sections with progress
      const sections: SectionWithProgress[] = (rawSections ?? []).map(
        (raw: CourseSectionRaw): SectionWithProgress => {
          const base = transformCourseSection(raw);
          const progress = progressMap.get(raw.id);

          return {
            ...base,
            progressStatus: (progress?.status as SectionProgressStatus) ?? 'not_started',
            topicsCovered: progress?.topics_covered ?? 0,
            topicsTotal: progress?.topics_total ?? 0,
            quizScore: progress?.quiz_score ?? null,
            quizPassed: progress?.quiz_passed ?? null,
          };
        }
      );

      return { course, sections };
    },
    enabled: !!courseSlug && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return {
    course: data?.course ?? null,
    sections: data?.sections ?? [],
    isLoading,
    error: error as Error | null,
    language,
  };
}
