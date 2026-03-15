/**
 * useTrainingDashboard Hook
 *
 * Fetches ALL data needed for the Admin Training Dashboard:
 *   - Overview KPIs (computed client-side from enrollment data)
 *   - Course list with per-course stats
 *   - Course detail: employees, section scores, evaluations, grade distribution
 *
 * Follows the useCallback + useEffect with cancellation pattern from
 * use-course-enrollment.ts. Direct Supabase queries, group-scoped.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGroupId } from '@/hooks/useGroupId';
import type {
  TrainingKPIs,
  TrainingCourseItem,
  TrainingEmployee,
  SectionScoreData,
  TrainingEvaluation,
  GradeDistribution,
} from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case)
// ---------------------------------------------------------------------------

interface CourseRow {
  id: string;
  slug: string;
  title_en: string;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
  icon: string | null;
  status: string;
  course_type: string;
  course_sections: { count: number }[];
}

interface EnrollmentRow {
  id: string;
  user_id: string;
  course_id: string;
  group_id: string;
  status: string;
  final_score: number | null;
  final_passed: boolean | null;
  completed_sections: number;
  total_sections: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ProfileFromMembership {
  user_id: string;
  role: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface SectionProgressRow {
  id: string;
  user_id: string;
  section_id: string;
  enrollment_id: string;
  course_id: string;
  status: string;
  quiz_score: number | null;
  updated_at: string;
}

interface CourseSectionRow {
  id: string;
  title_en: string;
  title_es: string | null;
  sort_order: number;
}

interface EvaluationRow {
  id: string;
  user_id: string;
  eval_type: string;
  score: number;
  passed: boolean;
  competency_level: string;
  student_feedback: {
    strengths?: string[];
    areas_for_improvement?: string[];
    encouragement?: string;
  };
  created_at: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_KPIS: TrainingKPIs = {
  totalEnrolled: 0,
  totalCompleted: 0,
  completionRate: 0,
  avgGrade: null,
  passRate: null,
  enrolledThisWeek: 0,
  passedCount: 0,
};

const GRADE_BUCKETS: Omit<GradeDistribution, 'count'>[] = [
  { label: 'A', min: 90, max: 100, color: '#22c55e' },
  { label: 'B', min: 80, max: 89, color: '#3b82f6' },
  { label: 'C', min: 70, max: 79, color: '#eab308' },
  { label: 'D', min: 0, max: 69, color: '#ef4444' },
];

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

interface UseTrainingDashboardReturn {
  // Global
  kpis: TrainingKPIs;
  courses: TrainingCourseItem[];
  isLoading: boolean;
  error: string | null;

  // Selected course detail
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
  employees: TrainingEmployee[];
  sectionScores: SectionScoreData[];
  evaluations: TrainingEvaluation[];
  gradeDistribution: GradeDistribution[];
  isLoadingDetail: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTrainingDashboard(): UseTrainingDashboardReturn {
  const groupId = useGroupId();

  // Overview state
  const [kpis, setKpis] = useState<TrainingKPIs>(DEFAULT_KPIS);
  const [courses, setCourses] = useState<TrainingCourseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail state
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<TrainingEmployee[]>([]);
  const [sectionScores, setSectionScores] = useState<SectionScoreData[]>([]);
  const [evaluations, setEvaluations] = useState<TrainingEvaluation[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<GradeDistribution[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // -------------------------------------------------------------------------
  // Phase 1: loadOverview — called on mount when groupId is available
  // -------------------------------------------------------------------------

  const loadOverview = useCallback(async (gId: string, signal: { cancelled: boolean }) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch courses with section count
      const { data: coursesData, error: coursesErr } = await supabase
        .from('courses')
        .select('id, slug, title_en, title_es, description_en, description_es, icon, status, course_type, course_sections(count)')
        .eq('group_id', gId)
        .in('status', ['published', 'draft', 'outline', 'generating', 'review']);

      if (signal.cancelled) return;
      if (coursesErr) throw coursesErr;

      // 2. Fetch all enrollments in the group
      const { data: enrollmentsData, error: enrollmentsErr } = await supabase
        .from('course_enrollments')
        .select('id, user_id, course_id, group_id, status, final_score, final_passed, completed_sections, total_sections, started_at, completed_at, created_at')
        .eq('group_id', gId);

      if (signal.cancelled) return;
      if (enrollmentsErr) throw enrollmentsErr;

      const courseRows = (coursesData ?? []) as CourseRow[];
      const enrollmentRows = (enrollmentsData ?? []) as EnrollmentRow[];

      // 3. Compute KPIs from enrollments
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const totalEnrolled = enrollmentRows.length;
      const completedEnrollments = enrollmentRows.filter(e => e.status === 'completed');
      const totalCompleted = completedEnrollments.length;
      const completionRate = totalEnrolled > 0
        ? Math.round((totalCompleted / totalEnrolled) * 100)
        : 0;

      const scoredEnrollments = enrollmentRows.filter(e => e.final_score !== null);
      const avgGrade = scoredEnrollments.length > 0
        ? Math.round(scoredEnrollments.reduce((sum, e) => sum + (e.final_score ?? 0), 0) / scoredEnrollments.length)
        : null;

      const passedEnrollments = enrollmentRows.filter(e => e.final_passed === true);
      const passedCount = passedEnrollments.length;
      const passRate = scoredEnrollments.length > 0
        ? Math.round((passedCount / scoredEnrollments.length) * 100)
        : null;

      const enrolledThisWeek = enrollmentRows.filter(e => {
        const createdAt = new Date(e.created_at);
        return createdAt >= oneWeekAgo;
      }).length;

      const computedKpis: TrainingKPIs = {
        totalEnrolled,
        totalCompleted,
        completionRate,
        avgGrade,
        passRate,
        enrolledThisWeek,
        passedCount,
      };

      // 4. Compute per-course stats
      const enrollmentsByCourse = new Map<string, EnrollmentRow[]>();
      for (const e of enrollmentRows) {
        const existing = enrollmentsByCourse.get(e.course_id) ?? [];
        existing.push(e);
        enrollmentsByCourse.set(e.course_id, existing);
      }

      const computedCourses: TrainingCourseItem[] = courseRows.map(c => {
        const courseEnrollments = enrollmentsByCourse.get(c.id) ?? [];
        const enrolled = courseEnrollments.length;
        const completed = courseEnrollments.filter(e => e.status === 'completed').length;
        const scored = courseEnrollments.filter(e => e.final_score !== null);
        const avg = scored.length > 0
          ? Math.round(scored.reduce((s, e) => s + (e.final_score ?? 0), 0) / scored.length)
          : null;
        const sectionCount = c.course_sections?.[0]?.count ?? 0;

        return {
          id: c.id,
          slug: c.slug,
          titleEn: c.title_en,
          titleEs: c.title_es,
          descriptionEn: c.description_en,
          descriptionEs: c.description_es,
          icon: c.icon,
          status: c.status,
          courseType: c.course_type,
          totalSections: sectionCount,
          enrolledCount: enrolled,
          completedCount: completed,
          avgScore: avg,
          completionPercent: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
        };
      });

      if (signal.cancelled) return;

      setKpis(computedKpis);
      setCourses(computedCourses);

      // 5. Auto-select first published course if none selected
      const publishedCourses = computedCourses.filter(c => c.status === 'published');
      if (publishedCourses.length > 0) {
        setSelectedCourseId(prev => prev ?? publishedCourses[0].id);
      } else if (computedCourses.length > 0) {
        setSelectedCourseId(prev => prev ?? computedCourses[0].id);
      }
    } catch (err) {
      if (!signal.cancelled) {
        const message = err instanceof Error ? err.message : 'Failed to load training overview';
        console.error('[useTrainingDashboard] loadOverview error:', message);
        setError(message);
      }
    } finally {
      if (!signal.cancelled) setIsLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Phase 2: loadCourseDetail — called when selectedCourseId changes
  // -------------------------------------------------------------------------

  const loadCourseDetail = useCallback(async (
    courseId: string,
    gId: string,
    signal: { cancelled: boolean },
  ) => {
    setIsLoadingDetail(true);

    try {
      // Step 1: Fetch enrollments for this course
      const { data: enrollData, error: enrollErr } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('course_id', courseId)
        .eq('group_id', gId);

      if (signal.cancelled) return;
      if (enrollErr) throw enrollErr;

      const enrollmentRows = (enrollData ?? []) as EnrollmentRow[];

      if (enrollmentRows.length === 0) {
        // No enrollments — clear detail state
        setEmployees([]);
        setSectionScores([]);
        setEvaluations([]);
        setGradeDistribution(GRADE_BUCKETS.map(b => ({ ...b, count: 0 })));
        return;
      }

      const enrolledUserIds = [...new Set(enrollmentRows.map(e => e.user_id))];
      const enrollmentIds = enrollmentRows.map(e => e.id);

      // Step 2: Fetch profiles + memberships for enrolled users
      const { data: profilesData, error: profilesErr } = await supabase
        .from('group_memberships')
        .select('user_id, role, profiles!inner(id, full_name, email, avatar_url)')
        .eq('group_id', gId)
        .in('user_id', enrolledUserIds);

      if (signal.cancelled) return;
      if (profilesErr) throw profilesErr;

      const profileRows = (profilesData ?? []) as ProfileFromMembership[];
      const profileMap = new Map<string, ProfileFromMembership>();
      for (const p of profileRows) {
        profileMap.set(p.user_id, p);
      }

      // Step 3: Fetch section_progress for all enrolled users in this course
      const { data: progressData, error: progressErr } = await supabase
        .from('section_progress')
        .select('id, user_id, section_id, enrollment_id, course_id, status, quiz_score, updated_at')
        .eq('course_id', courseId)
        .in('enrollment_id', enrollmentIds);

      if (signal.cancelled) return;
      if (progressErr) throw progressErr;

      const progressRows = (progressData ?? []) as SectionProgressRow[];

      // Compute lastActiveAt per enrollment (max of section_progress.updated_at)
      const lastActiveByEnrollment = new Map<string, string>();
      for (const p of progressRows) {
        const current = lastActiveByEnrollment.get(p.enrollment_id);
        if (!current || p.updated_at > current) {
          lastActiveByEnrollment.set(p.enrollment_id, p.updated_at);
        }
      }

      // Step 4: Merge into TrainingEmployee[]
      const computedEmployees: TrainingEmployee[] = enrollmentRows.map(e => {
        const profile = profileMap.get(e.user_id);
        const totalSections = e.total_sections || 0;
        const completedSections = e.completed_sections || 0;

        return {
          userId: e.user_id,
          fullName: profile?.profiles?.full_name ?? null,
          email: profile?.profiles?.email ?? e.user_id,
          role: profile?.role ?? 'staff',
          avatarUrl: profile?.profiles?.avatar_url ?? null,
          enrollmentId: e.id,
          enrollmentStatus: e.status,
          completedSections,
          totalSections,
          finalScore: e.final_score,
          finalPassed: e.final_passed,
          startedAt: e.started_at,
          completedAt: e.completed_at,
          lastActiveAt: lastActiveByEnrollment.get(e.id) ?? null,
          progressPercent: totalSections > 0
            ? Math.round((completedSections / totalSections) * 100)
            : 0,
        };
      });

      if (signal.cancelled) return;
      setEmployees(computedEmployees);

      // Step 5: Fetch course_sections for this course
      const { data: sectionsData, error: sectionsErr } = await supabase
        .from('course_sections')
        .select('id, title_en, title_es, sort_order')
        .eq('course_id', courseId)
        .order('sort_order');

      if (signal.cancelled) return;
      if (sectionsErr) throw sectionsErr;

      const sectionRows = (sectionsData ?? []) as CourseSectionRow[];

      // Compute avg quiz_score per section from section_progress
      const scoresBySectionId = new Map<string, number[]>();
      for (const p of progressRows) {
        if (p.quiz_score !== null) {
          const existing = scoresBySectionId.get(p.section_id) ?? [];
          existing.push(p.quiz_score);
          scoresBySectionId.set(p.section_id, existing);
        }
      }

      const computedSectionScores: SectionScoreData[] = sectionRows.map(s => {
        const scores = scoresBySectionId.get(s.id) ?? [];
        const avg = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        return {
          sectionId: s.id,
          titleEn: s.title_en,
          titleEs: s.title_es,
          sortOrder: s.sort_order,
          avgScore: avg,
          totalGraded: scores.length,
        };
      });

      if (signal.cancelled) return;
      setSectionScores(computedSectionScores);

      // Step 6: Fetch evaluations (non-superseded) for this course
      const { data: evalsData, error: evalsErr } = await supabase
        .from('evaluations')
        .select('id, user_id, eval_type, score, passed, competency_level, student_feedback, created_at')
        .eq('course_id', courseId)
        .eq('group_id', gId)
        .is('superseded_by', null)
        .order('created_at', { ascending: false });

      if (signal.cancelled) return;
      if (evalsErr) throw evalsErr;

      const evalRows = (evalsData ?? []) as EvaluationRow[];

      const computedEvals: TrainingEvaluation[] = evalRows.map(ev => {
        const profile = profileMap.get(ev.user_id);
        const feedback = ev.student_feedback ?? {};
        return {
          id: ev.id,
          userId: ev.user_id,
          fullName: profile?.profiles?.full_name ?? null,
          email: profile?.profiles?.email ?? ev.user_id,
          role: profile?.role ?? 'staff',
          avatarUrl: profile?.profiles?.avatar_url ?? null,
          evalType: ev.eval_type,
          score: ev.score,
          passed: ev.passed,
          competencyLevel: ev.competency_level,
          studentFeedback: {
            strengths: feedback.strengths ?? [],
            areasForImprovement: feedback.areas_for_improvement ?? [],
            encouragement: feedback.encouragement ?? '',
          },
          createdAt: ev.created_at,
        };
      });

      if (signal.cancelled) return;
      setEvaluations(computedEvals);

      // Step 7: Compute grade distribution from employees with finalScore
      const gradeScores = computedEmployees
        .filter(e => e.finalScore !== null)
        .map(e => e.finalScore as number);

      const computedDistribution: GradeDistribution[] = GRADE_BUCKETS.map(bucket => ({
        ...bucket,
        count: gradeScores.filter(s => s >= bucket.min && s <= bucket.max).length,
      }));

      if (signal.cancelled) return;
      setGradeDistribution(computedDistribution);
    } catch (err) {
      if (!signal.cancelled) {
        const message = err instanceof Error ? err.message : 'Failed to load course detail';
        console.error('[useTrainingDashboard] loadCourseDetail error:', message);
      }
    } finally {
      if (!signal.cancelled) setIsLoadingDetail(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Effect: load overview on mount / groupId change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!groupId) return;

    const signal = { cancelled: false };
    loadOverview(groupId, signal);

    return () => {
      signal.cancelled = true;
    };
  }, [groupId, loadOverview]);

  // -------------------------------------------------------------------------
  // Effect: load course detail when selectedCourseId changes
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!selectedCourseId || !groupId) {
      setEmployees([]);
      setSectionScores([]);
      setEvaluations([]);
      setGradeDistribution(GRADE_BUCKETS.map(b => ({ ...b, count: 0 })));
      return;
    }

    const signal = { cancelled: false };
    loadCourseDetail(selectedCourseId, groupId, signal);

    return () => {
      signal.cancelled = true;
    };
  }, [selectedCourseId, groupId, loadCourseDetail]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    kpis,
    courses,
    isLoading,
    error,
    selectedCourseId,
    setSelectedCourseId,
    employees,
    sectionScores,
    evaluations,
    gradeDistribution,
    isLoadingDetail,
  };
}
