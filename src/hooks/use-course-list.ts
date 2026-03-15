/**
 * useCourseList Hook
 *
 * Returns published courses with enrollment data for the course listing page.
 * Follows useFormViewer composition pattern:
 *   - Client-side search (title EN/ES)
 *   - Splits filtered results into inProgress / notStarted / completed
 *   - Pin integration via usePinnedCourses
 *   - Cover image signed URLs via useBatchCoverImageUrls
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { usePinnedCourses } from '@/hooks/use-pinned-courses';
import { useBatchCoverImageUrls } from '@/hooks/use-batch-cover-image-urls';
import type { CourseListItem, EnrollmentStatus } from '@/types/course-player';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, before mapping)
// ---------------------------------------------------------------------------

interface CourseRow {
  id: string;
  slug: string;
  title_en: string;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
  icon: string | null;
  cover_image: string | null;
  course_type: string;
  teacher_level: string;
  estimated_minutes: number;
  status: string;
  version: number;
  program_id: string | null;
  course_sections: { count: number }[];
}

interface EnrollmentRow {
  id: string;
  course_id: string;
  status: string;
  completed_sections: number;
  total_sections: number;
  started_at: string | null;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCourseList() {
  const { user } = useAuth();
  const { togglePin, isPinned, sortPinnedFirst } = usePinnedCourses();

  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // -------------------------------------------------------------------------
  // Fetch courses + enrollments on mount / user change
  // -------------------------------------------------------------------------

  const fetchCourses = useCallback(async () => {
    if (!user?.id) {
      setCourses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch published courses (RLS handles group filtering)
      const { data: courseRows, error: courseErr } = await supabase
        .from('courses')
        .select(
          'id, slug, title_en, title_es, description_en, description_es, icon, cover_image, course_type, teacher_level, estimated_minutes, status, version, program_id, course_sections(count)',
        )
        .eq('status', 'published')
        .order('sort_order');

      if (courseErr) throw courseErr;

      // 2. Fetch user's enrollments
      const { data: enrollmentRows, error: enrollErr } = await supabase
        .from('course_enrollments')
        .select(
          'id, course_id, status, completed_sections, total_sections, started_at, completed_at',
        )
        .eq('user_id', user.id);

      if (enrollErr) throw enrollErr;

      // 3. Build enrollment lookup
      const enrollmentMap = new Map<string, EnrollmentRow>();
      for (const row of (enrollmentRows ?? []) as EnrollmentRow[]) {
        enrollmentMap.set(row.course_id, row);
      }

      // 4. Merge into CourseListItem[]
      const merged: CourseListItem[] = ((courseRows ?? []) as CourseRow[]).map(
        (c) => {
          const enrollment = enrollmentMap.get(c.id);
          const sectionCount =
            c.course_sections?.[0]?.count ?? 0;
          const totalSections = enrollment
            ? enrollment.total_sections
            : sectionCount;
          const completedSections = enrollment
            ? enrollment.completed_sections
            : 0;
          const progressPercent =
            totalSections > 0
              ? Math.round((completedSections / totalSections) * 100)
              : 0;

          return {
            id: c.id,
            slug: c.slug,
            titleEn: c.title_en,
            titleEs: c.title_es ?? '',
            descriptionEn: c.description_en ?? '',
            descriptionEs: c.description_es ?? '',
            icon: c.icon ?? '',
            courseType: c.course_type,
            teacherLevel: c.teacher_level,
            estimatedMinutes: c.estimated_minutes,
            status: c.status,
            enrollmentStatus: (enrollment?.status as EnrollmentStatus) ?? null,
            progressPercent,
            totalSections,
            completedSections,
            // Extra fields stored for cover image lookup (not in CourseListItem type
            // but accessible via the coverImagePaths derived below)
          } satisfies CourseListItem;
        },
      );

      setCourses(merged);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load courses';
      console.error('[useCourseList] Error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  // -------------------------------------------------------------------------
  // Cover image signed URLs
  // -------------------------------------------------------------------------

  // We need the raw cover_image paths. Since CourseListItem doesn't carry
  // cover_image, we keep a parallel lookup from the raw fetch. To avoid a
  // second state variable, we derive paths from a separate lightweight query.
  // However, to keep it simple (single fetch), we store an internal mapping.

  const [coverImagePaths, setCoverImagePaths] = useState<
    Map<string, string | null>
  >(new Map());

  // Re-fetch cover image paths alongside courses
  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, cover_image')
        .eq('status', 'published');

      if (data) {
        const map = new Map<string, string | null>();
        for (const row of data) {
          map.set(row.id, row.cover_image);
        }
        setCoverImagePaths(map);
      }
    })();
  }, [user?.id]);

  const allPaths = useMemo(
    () => courses.map((c) => coverImagePaths.get(c.id) ?? null),
    [courses, coverImagePaths],
  );

  const { urlMap: coverImageUrls, isLoading: coverImagesLoading } =
    useBatchCoverImageUrls(allPaths);

  // -------------------------------------------------------------------------
  // Client-side search filter
  // -------------------------------------------------------------------------

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;

    const q = searchQuery.toLowerCase().trim();
    return courses.filter(
      (c) =>
        c.titleEn.toLowerCase().includes(q) ||
        c.titleEs.toLowerCase().includes(q) ||
        c.descriptionEn.toLowerCase().includes(q) ||
        c.descriptionEs.toLowerCase().includes(q),
    );
  }, [courses, searchQuery]);

  // -------------------------------------------------------------------------
  // Category splits
  // -------------------------------------------------------------------------

  const inProgress = useMemo(
    () =>
      filteredCourses.filter((c) => c.enrollmentStatus === 'in_progress' || c.enrollmentStatus === 'enrolled'),
    [filteredCourses],
  );

  const notStarted = useMemo(
    () => filteredCourses.filter((c) => c.enrollmentStatus === null),
    [filteredCourses],
  );

  const completed = useMemo(
    () =>
      filteredCourses.filter((c) => c.enrollmentStatus === 'completed'),
    [filteredCourses],
  );

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    // Data
    courses: filteredCourses,
    allCourses: courses,
    inProgress,
    notStarted,
    completed,

    // Search
    searchQuery,
    setSearchQuery,

    // Pin
    togglePin,
    isPinned,
    sortPinnedFirst,

    // Cover images
    coverImageUrls,
    coverImagesLoading,
    coverImagePaths,

    // Loading / error
    isLoading,
    error,

    // Refresh
    refetch: fetchCourses,
  };
}
