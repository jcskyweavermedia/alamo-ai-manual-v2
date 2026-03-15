/**
 * useEvaluationsDashboard Hook
 *
 * Fetches evaluations data for the manager dashboard.
 * Supports filtering by course and eval type, with auto-loading on mount.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// =============================================================================
// TYPES
// =============================================================================

export interface EvaluationRow {
  id: string;
  user_full_name: string;
  course_title: string;
  section_title: string | null;
  eval_type: string;
  eval_source: string;
  score: number;
  passed: boolean;
  competency_level: string;
  student_feedback: {
    strengths?: string[];
    areas_for_improvement?: string[];
    encouragement?: string;
  } | null;
  manager_feedback: {
    competency_gaps?: string[];
    recommended_actions?: string[];
    risk_level?: string;
  } | null;
  created_at: string;
}

interface UseEvaluationsDashboardOptions {
  courseId?: string;
  evalType?: string;
  limit?: number;
}

// =============================================================================
// HOOK
// =============================================================================

export function useEvaluationsDashboard(options?: UseEvaluationsDashboardOptions) {
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { permissions } = useAuth();
  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const fetchEvaluations = useCallback(async () => {
    if (!primaryGroup) return;
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('evaluations')
        .select(`
          id, score, passed, competency_level, eval_type, eval_source,
          student_feedback, manager_feedback, created_at,
          profiles!evaluations_user_id_fkey(full_name),
          courses!evaluations_course_id_fkey(title_en),
          course_sections!evaluations_section_id_fkey(title_en)
        `)
        .eq('group_id', primaryGroup.groupId)
        .is('superseded_by', null)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 20);

      if (options?.courseId) query = query.eq('course_id', options.courseId);
      if (options?.evalType) query = query.eq('eval_type', options.evalType);

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: EvaluationRow[] = (data || []).map((row: any) => ({
        id: row.id,
        user_full_name: row.profiles?.full_name || 'Unknown',
        course_title: row.courses?.title_en || 'Unknown Course',
        section_title: row.course_sections?.title_en || null,
        eval_type: row.eval_type,
        eval_source: row.eval_source,
        score: row.score,
        passed: row.passed,
        competency_level: row.competency_level,
        student_feedback: row.student_feedback,
        manager_feedback: row.manager_feedback,
        created_at: row.created_at,
      }));

      setEvaluations(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load evaluations';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [primaryGroup?.groupId, options?.courseId, options?.evalType, options?.limit]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  return { evaluations, isLoading, error, refetch: fetchEvaluations };
}
