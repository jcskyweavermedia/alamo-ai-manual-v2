/**
 * useAdminCourses Hook
 *
 * Returns published courses with enrollment + employee data for the admin
 * Courses view. Performs three parallel queries (courses, enrollments, employees)
 * and assembles AdminCourse[] client-side.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGroupId } from '@/hooks/useGroupId';
import type {
  AdminCourse,
  AdminCourseEmployee,
  CourseColorTheme,
  CourseCategory,
  Department,
  EmployeePosition,
} from '@/types/admin-panel';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-orange-600',
  'bg-pink-600',
];

function getAvatarColor(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const COLOR_THEMES: CourseColorTheme[] = [
  'blue',
  'amber',
  'green',
  'purple',
  'red',
  'teal',
];

/** 14 days in milliseconds -- enrolled longer than this with zero progress = stuck */
const STUCK_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

function letterGrade(score: number | null | undefined): string | undefined {
  if (score == null) return undefined;
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Raw row shapes (snake_case, matching Supabase response)
// ---------------------------------------------------------------------------

interface CourseRow {
  id: string;
  title_en: string;
  title_es: string | null;
  icon: string | null;
  status: string;
  description_en: string | null;
  description_es: string | null;
  course_sections: { count: number }[];
}

interface EnrollmentRow {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  completed_sections: number;
  total_sections: number;
  final_score: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface EmployeeRow {
  id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  position: string;
  department: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAdminCourses() {
  const groupId = useGroupId();
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    setIsLoading(true);
    setError(null);

    Promise.all([
      // 1. Published courses with section count (scoped by group via RLS + explicit filter)
      supabase
        .from('courses')
        .select(
          'id, title_en, title_es, icon, status, description_en, description_es, course_sections(count)',
        )
        .eq('status', 'published')
        .eq('group_id', groupId),

      // 2. All enrollments for the group
      supabase
        .from('course_enrollments')
        .select(
          'id, user_id, course_id, status, completed_sections, total_sections, final_score, started_at, completed_at, created_at',
        )
        .eq('group_id', groupId),

      // 3. Active employees for the group
      supabase
        .from('employees')
        .select('id, profile_id, first_name, last_name, position, department')
        .eq('group_id', groupId)
        .in('employment_status', ['active', 'onboarding']),
    ]).then(([coursesRes, enrollRes, empRes]) => {
      if (coursesRes.error || enrollRes.error || empRes.error) {
        const msg =
          coursesRes.error?.message ||
          enrollRes.error?.message ||
          empRes.error?.message ||
          'Unknown error';
        console.error('[useAdminCourses]', msg);
        setError(msg);
        setIsLoading(false);
        return;
      }

      const coursesData = (coursesRes.data ?? []) as unknown as CourseRow[];
      const enrollments = (enrollRes.data ?? []) as unknown as EnrollmentRow[];
      const employees = (empRes.data ?? []) as unknown as EmployeeRow[];

      // Build employee lookup by profile_id
      const empByProfile = new Map<string, EmployeeRow>();
      for (const emp of employees) {
        if (emp.profile_id) {
          empByProfile.set(emp.profile_id, emp);
        }
      }

      const mapped: AdminCourse[] = coursesData.map((c, idx) => {
        const sectionCount = c.course_sections?.[0]?.count ?? 0;
        const courseEnrollments = enrollments.filter(
          (e) => e.course_id === c.id,
        );
        const completedEnrollments = courseEnrollments.filter(
          (e) => e.status === 'completed',
        );

        // Average score across completed enrollments that have a final_score
        const scores = completedEnrollments
          .map((e) => e.final_score)
          .filter((s): s is number => s != null);
        const avgScore =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : null;

        // Map enrollments to AdminCourseEmployee[]
        const enrolledEmployees: AdminCourseEmployee[] = courseEnrollments.map(
          (en) => {
            const emp = empByProfile.get(en.user_id);
            const firstName = emp?.first_name ?? '';
            const lastName = emp?.last_name ?? '';
            const initials = (
              firstName.charAt(0) + lastName.charAt(0)
            ).toUpperCase();
            const modulesCompleted = en.completed_sections ?? 0;
            const modulesTotal = en.total_sections || sectionCount;
            const progressPercent =
              modulesTotal > 0
                ? Math.round((modulesCompleted / modulesTotal) * 100)
                : 0;

            // Determine status
            let status: AdminCourseEmployee['status'] = 'not_started';
            if (en.status === 'completed') {
              status = 'completed';
            } else if (en.status === 'in_progress') {
              status = 'in_progress';
            } else if (en.status === 'enrolled') {
              // Enrolled > 14 days with zero progress = stuck
              const enrolledTooLong =
                en.created_at &&
                Date.now() - new Date(en.created_at).getTime() >
                  STUCK_THRESHOLD_MS;
              status =
                enrolledTooLong && modulesCompleted === 0
                  ? 'stuck'
                  : 'not_started';
            }

            return {
              employeeId: emp?.id ?? en.user_id,
              name: emp
                ? `${firstName} ${lastName.charAt(0)}.`.trim()
                : 'Unknown',
              initials: initials || '??',
              avatarColor: getAvatarColor(initials || '??'),
              position: (emp?.position ?? 'Server') as EmployeePosition,
              status,
              grade: letterGrade(en.final_score),
              score:
                en.final_score != null ? Number(en.final_score) : undefined,
              progressPercent,
              modulesCompleted,
              modulesTotal,
              lastActivity: en.completed_at ?? en.started_at ?? undefined,
            };
          },
        );

        // Completion percent = completed enrollments / total enrollments
        const completionPercent =
          courseEnrollments.length > 0
            ? Math.round(
                (completedEnrollments.length / courseEnrollments.length) * 100,
              )
            : 0;

        // Courses table has no category/target_department columns.
        // Default to FOH; can be refined when those columns are added.
        const department: Department = 'FOH';
        const category: CourseCategory = 'FOH';

        return {
          id: c.id,
          name: c.title_en ?? '',
          nameEs: c.title_es ?? undefined,
          icon: c.icon ?? 'GraduationCap',
          colorTheme: COLOR_THEMES[idx % COLOR_THEMES.length],
          category,
          department,
          modulesCount: sectionCount,
          enrolledCount: courseEnrollments.length,
          completedCount: completedEnrollments.length,
          avgScore:
            avgScore != null ? Math.round(avgScore * 10) / 10 : null,
          completionPercent,
          description: c.description_en ?? undefined,
          descriptionEs: c.description_es ?? undefined,
          status: c.status as 'published' | 'draft',
          enrolledEmployees,
        };
      });

      setCourses(mapped);
      setIsLoading(false);
    });
  }, [groupId]);

  return { courses, isLoading, error };
}
