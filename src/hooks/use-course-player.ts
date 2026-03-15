/**
 * useCoursePlayer Hook
 *
 * Main hook for the course player page. Combines:
 *   - Course data fetch (by slug)
 *   - Sections with elements (JSONB)
 *   - Enrollment lifecycle via useCourseEnrollment
 *   - Active section navigation (index-based)
 *
 * Uses useEffect for data fetching, useCallback for mutations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCourseEnrollment } from '@/hooks/use-course-enrollment';
import type { CourseEnrollment, SectionProgress } from '@/types/course-player';
import type { CourseSection, CourseElement, SourceRef } from '@/types/course-builder';

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
  course_sections: SectionRow[];
}

interface SectionRow {
  id: string;
  slug: string;
  title_en: string;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
  sort_order: number;
  estimated_minutes: number;
  elements: unknown;
  section_type: string;
  generation_status: string;
  source_refs: unknown;
  course_id: string;
  group_id: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Camel-case course shape returned to consumers
// ---------------------------------------------------------------------------

export interface PlayerCourse {
  id: string;
  slug: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  coverImage: string | null;
  courseType: string;
  teacherLevel: string;
  estimatedMinutes: number;
  status: string;
  version: number;
  programId: string | null;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapCourse(row: CourseRow): PlayerCourse {
  return {
    id: row.id,
    slug: row.slug,
    titleEn: row.title_en,
    titleEs: row.title_es ?? '',
    descriptionEn: row.description_en ?? '',
    descriptionEs: row.description_es ?? '',
    icon: row.icon ?? '',
    coverImage: row.cover_image,
    courseType: row.course_type,
    teacherLevel: row.teacher_level,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    version: row.version,
    programId: row.program_id,
  };
}

function mapSection(row: SectionRow): CourseSection {
  return {
    id: row.id,
    courseId: row.course_id,
    groupId: row.group_id,
    slug: row.slug,
    titleEn: row.title_en,
    titleEs: row.title_es ?? '',
    elements: (Array.isArray(row.elements)
      ? row.elements
      : []) as CourseElement[],
    sourceRefs: (Array.isArray(row.source_refs)
      ? row.source_refs
      : []) as SourceRef[],
    generationStatus: row.generation_status as CourseSection['generationStatus'],
    sortOrder: row.sort_order,
    estimatedMinutes: row.estimated_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCoursePlayer(slug: string) {
  const { user } = useAuth();

  const [course, setCourse] = useState<PlayerCourse | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseUnavailable, setCourseUnavailable] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  // -------------------------------------------------------------------------
  // Fetch course + sections
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!slug || !user?.id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      setCourseUnavailable(false);

      try {
        const { data, error: fetchErr } = await supabase
          .from('courses')
          .select(
            '*, course_sections(id, slug, title_en, title_es, description_en, description_es, sort_order, estimated_minutes, elements, section_type, generation_status, source_refs, course_id, group_id, created_at, updated_at)',
          )
          .eq('slug', slug)
          .eq('status', 'published')
          .single();

        if (cancelled) return;

        if (fetchErr) {
          // PGRST116 = no rows found
          if (fetchErr.code === 'PGRST116') {
            setCourseUnavailable(true);
            setCourse(null);
            setSections([]);
          } else {
            throw fetchErr;
          }
          return;
        }

        const row = data as CourseRow;
        const mappedCourse = mapCourse(row);
        setCourse(mappedCourse);

        // Sort sections client-side by sort_order
        const mappedSections = (row.course_sections ?? [])
          .map(mapSection)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setSections(mappedSections);

        // Reset active section to first
        setActiveSectionIndex(0);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load course';
          console.error('[useCoursePlayer] Error:', message);
          setError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, user?.id]);

  // -------------------------------------------------------------------------
  // Enrollment (delegates to useCourseEnrollment)
  // -------------------------------------------------------------------------

  const totalSections = sections.length;
  const courseVersion = course?.version ?? 1;

  const {
    enrollment,
    sectionProgressMap,
    isLoading: enrollmentLoading,
    ensureEnrollment,
    markSectionComplete,
    completeCourse,
  } = useCourseEnrollment(course?.id ?? null, totalSections, courseVersion);

  // Auto-enroll when course loads (only after sections are known to avoid total_sections=0)
  useEffect(() => {
    if (course && !courseUnavailable && sections.length > 0) {
      void ensureEnrollment();
    }
  }, [course, courseUnavailable, sections.length, ensureEnrollment]);

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const combinedLoading = isLoading || enrollmentLoading;

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    // Course data
    course,
    sections,

    // Enrollment & progress
    enrollment,
    sectionProgressMap,

    // Navigation
    activeSectionIndex,
    setActiveSectionIndex,

    // State
    isLoading: combinedLoading,
    error,
    courseUnavailable,

    // Mutations (from useCourseEnrollment)
    markSectionComplete,
    completeCourse,
    ensureEnrollment,
  };
}
