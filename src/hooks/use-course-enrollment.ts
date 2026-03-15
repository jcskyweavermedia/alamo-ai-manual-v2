/**
 * useCourseEnrollment Hook
 *
 * Manages enrollment lifecycle for a single course:
 *   - Auto-enrollment via upsert (onConflict: user_id, course_id)
 *   - Section progress tracking (per-section completion)
 *   - Course completion flow
 *
 * Uses useEffect for data fetching and useCallback for mutations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useGroupId } from '@/hooks/useGroupId';
import type { CourseEnrollment, SectionProgress } from '@/types/course-player';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, before mapping)
// ---------------------------------------------------------------------------

interface EnrollmentRow {
  id: string;
  user_id: string;
  course_id: string;
  group_id: string;
  status: string;
  course_version: number;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  total_sections: number;
  completed_sections: number;
  final_score: number | null;
  final_passed: boolean | null;
  created_at: string;
  updated_at: string;
}

interface SectionProgressRow {
  id: string;
  user_id: string;
  section_id: string;
  enrollment_id: string;
  course_id: string;
  status: string;
  elements_viewed: string[];
  elements_total: number;
  quiz_score: number | null;
  quiz_passed: boolean | null;
  quiz_attempts: number;
  time_spent_seconds: number;
  content_hash_at_completion: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapEnrollment(row: EnrollmentRow): CourseEnrollment {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    groupId: row.group_id,
    status: row.status as CourseEnrollment['status'],
    courseVersion: row.course_version,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    totalSections: row.total_sections,
    completedSections: row.completed_sections,
    finalScore: row.final_score,
    finalPassed: row.final_passed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSectionProgress(row: SectionProgressRow): SectionProgress {
  return {
    id: row.id,
    userId: row.user_id,
    sectionId: row.section_id,
    enrollmentId: row.enrollment_id,
    courseId: row.course_id,
    status: row.status as SectionProgress['status'],
    elementsViewed: row.elements_viewed ?? [],
    elementsTotal: row.elements_total,
    quizScore: row.quiz_score,
    quizPassed: row.quiz_passed,
    quizAttempts: row.quiz_attempts,
    timeSpentSeconds: row.time_spent_seconds,
    contentHashAtCompletion: row.content_hash_at_completion,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCourseEnrollment(
  courseId: string | null,
  totalSections: number,
  courseVersion: number,
) {
  const { user } = useAuth();
  const groupId = useGroupId();

  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [sectionProgressMap, setSectionProgressMap] = useState<
    Map<string, SectionProgress>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Prevent double-enrollment calls in strict mode
  const enrollingRef = useRef(false);

  // -------------------------------------------------------------------------
  // Fetch section progress for a given enrollment
  // -------------------------------------------------------------------------

  const fetchSectionProgress = useCallback(
    async (enrollmentId: string) => {
      const { data, error } = await supabase
        .from('section_progress')
        .select('*')
        .eq('enrollment_id', enrollmentId);

      if (error) {
        console.error(
          '[useCourseEnrollment] Failed to fetch section progress:',
          error.message,
        );
        return;
      }

      const map = new Map<string, SectionProgress>();
      for (const row of (data ?? []) as SectionProgressRow[]) {
        const mapped = mapSectionProgress(row);
        map.set(mapped.sectionId, mapped);
      }
      setSectionProgressMap(map);
    },
    [],
  );

  // -------------------------------------------------------------------------
  // ensureEnrollment: auto-enroll or fetch existing enrollment
  // -------------------------------------------------------------------------

  const ensureEnrollment = useCallback(async () => {
    if (!user?.id || !courseId || !groupId) return;
    if (enrollingRef.current) return;

    enrollingRef.current = true;
    setIsLoading(true);

    try {
      // Upsert: insert if not exists, otherwise return existing
      const { data, error } = await supabase
        .from('course_enrollments')
        .upsert(
          {
            user_id: user.id,
            course_id: courseId,
            group_id: groupId,
            status: 'enrolled',
            total_sections: totalSections,
            course_version: courseVersion,
          },
          { onConflict: 'user_id,course_id', ignoreDuplicates: true },
        )
        .select('*')
        .single();

      if (error) {
        // If ignoreDuplicates returns no row, fetch separately
        if (error.code === 'PGRST116') {
          const { data: existing, error: fetchErr } = await supabase
            .from('course_enrollments')
            .select('*')
            .eq('user_id', user.id)
            .eq('course_id', courseId)
            .single();

          if (fetchErr) throw fetchErr;
          if (existing) {
            const mapped = mapEnrollment(existing as EnrollmentRow);
            setEnrollment(mapped);
            await fetchSectionProgress(mapped.id);
          }
        } else {
          throw error;
        }
      } else if (data) {
        const mapped = mapEnrollment(data as EnrollmentRow);
        setEnrollment(mapped);
        await fetchSectionProgress(mapped.id);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to enroll';
      console.error('[useCourseEnrollment] ensureEnrollment error:', message);
    } finally {
      setIsLoading(false);
      enrollingRef.current = false;
    }
  }, [user?.id, courseId, groupId, totalSections, courseVersion, fetchSectionProgress]);

  // -------------------------------------------------------------------------
  // markSectionComplete: update section_progress + course_enrollments counters
  // -------------------------------------------------------------------------

  const markSectionComplete = useCallback(
    async (sectionId: string, enrollmentId: string) => {
      if (!user?.id || !courseId) return;

      try {
        // 1. Upsert section_progress to 'completed'
        const { data: progressRow, error: progressErr } = await supabase
          .from('section_progress')
          .upsert(
            {
              user_id: user.id,
              section_id: sectionId,
              enrollment_id: enrollmentId,
              course_id: courseId,
              status: 'completed',
              completed_at: new Date().toISOString(),
              started_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,section_id' },
          )
          .select('*')
          .single();

        if (progressErr) throw progressErr;

        // 2. Update local section progress map
        if (progressRow) {
          const mapped = mapSectionProgress(progressRow as SectionProgressRow);
          setSectionProgressMap((prev) => {
            const next = new Map(prev);
            next.set(mapped.sectionId, mapped);
            return next;
          });
        }

        // 3. Count completed sections and update enrollment
        const completedCount = await getCompletedSectionCount(enrollmentId);

        const newStatus =
          completedCount >= totalSections ? 'completed' : 'in_progress';

        const { data: updatedEnrollment, error: enrollErr } = await supabase
          .from('course_enrollments')
          .update({
            completed_sections: completedCount,
            status: newStatus,
            started_at:
              enrollment?.startedAt ?? new Date().toISOString(),
            ...(newStatus === 'completed'
              ? { completed_at: new Date().toISOString() }
              : {}),
          })
          .eq('id', enrollmentId)
          .select('*')
          .single();

        if (enrollErr) throw enrollErr;

        if (updatedEnrollment) {
          setEnrollment(mapEnrollment(updatedEnrollment as EnrollmentRow));
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to mark section complete';
        console.error(
          '[useCourseEnrollment] markSectionComplete error:',
          message,
        );
      }
    },
    [user?.id, courseId, totalSections, enrollment?.startedAt],
  );

  // -------------------------------------------------------------------------
  // completeCourse: force-complete the enrollment
  // -------------------------------------------------------------------------

  const completeCourse = useCallback(async () => {
    if (!enrollment || !courseId) return;

    try {
      // Guard: check if course requires passing evaluation before completion
      const { data: course, error: courseErr } = await supabase
        .from('courses')
        .select('assessment_config')
        .eq('id', courseId)
        .single();

      if (courseErr) {
        console.error(
          '[useCourseEnrollment] Failed to fetch assessment_config:',
          courseErr.message,
        );
        // Fall through — don't block completion if we can't read config
      }

      const assessmentConfig = course?.assessment_config as
        | { require_passing_evaluation?: boolean }
        | null;

      if (assessmentConfig?.require_passing_evaluation) {
        // Refresh enrollment to get latest final_passed from DB
        const { data: freshEnrollment, error: enrollErr } = await supabase
          .from('course_enrollments')
          .select('final_passed')
          .eq('id', enrollment.id)
          .single();

        if (enrollErr) {
          console.error(
            '[useCourseEnrollment] Failed to check final_passed:',
            enrollErr.message,
          );
          return;
        }

        if (!freshEnrollment?.final_passed) {
          console.warn(
            '[useCourseEnrollment] Cannot complete course — requires passing evaluation but final_passed is not true.',
          );
          return;
        }
      }

      const { data, error } = await supabase
        .from('course_enrollments')
        .update({
          status: 'completed',
          completed_sections: enrollment.totalSections,
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id)
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setEnrollment(mapEnrollment(data as EnrollmentRow));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to complete course';
      console.error('[useCourseEnrollment] completeCourse error:', message);
    }
  }, [enrollment, courseId]);

  // -------------------------------------------------------------------------
  // Helper: count completed sections from DB
  // -------------------------------------------------------------------------

  async function getCompletedSectionCount(
    enrollmentId: string,
  ): Promise<number> {
    const { count, error } = await supabase
      .from('section_progress')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'completed');

    if (error) {
      console.error(
        '[useCourseEnrollment] count completed sections error:',
        error.message,
      );
      return 0;
    }

    return count ?? 0;
  }

  // -------------------------------------------------------------------------
  // Auto-fetch enrollment when courseId changes (passive, no upsert)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!user?.id || !courseId) {
      setEnrollment(null);
      setSectionProgressMap(new Map());
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('course_enrollments')
          .select('*')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (data) {
          const mapped = mapEnrollment(data as EnrollmentRow);
          setEnrollment(mapped);
          await fetchSectionProgress(mapped.id);
        } else {
          setEnrollment(null);
          setSectionProgressMap(new Map());
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            '[useCourseEnrollment] fetch error:',
            err instanceof Error ? err.message : err,
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, courseId, fetchSectionProgress]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    enrollment,
    sectionProgressMap,
    isLoading,
    ensureEnrollment,
    markSectionComplete,
    completeCourse,
  };
}
