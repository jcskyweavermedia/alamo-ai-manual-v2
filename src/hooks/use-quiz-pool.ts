// =============================================================================
// useQuizPool — Manages quiz question pool for the course builder Quiz tab.
// Fetches, generates (via edge function), and deactivates quiz questions.
// Pattern: follows use-build-course.ts for edge function invocations.
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface QuizQuestionOption {
  id: string;
  text_en: string;
  text_es: string;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  course_id: string;
  section_id: string | null;
  question_en: string;
  question_es: string;
  options: QuizQuestionOption[];
  explanation_en: string;
  explanation_es: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source_element_key: string | null;
  is_active: boolean;
  auto_flagged: boolean;
  times_shown: number;
  times_correct: number;
  created_at: string;
}

export interface QuizPoolStats {
  total: number;
  easy: number;
  medium: number;
  hard: number;
  flagged: number;
}

export interface UseQuizPool {
  questions: QuizQuestion[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  stats: QuizPoolStats;
  fetchQuestions: (courseId: string) => Promise<void>;
  generatePool: (courseId: string, language: 'en' | 'es', forceRegenerate?: boolean) => Promise<boolean>;
  deactivateQuestion: (questionId: string) => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useQuizPool(): UseQuizPool {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed stats
  const stats: QuizPoolStats = useMemo(() => {
    return {
      total: questions.length,
      easy: questions.filter(q => q.difficulty === 'easy').length,
      medium: questions.filter(q => q.difficulty === 'medium').length,
      hard: questions.filter(q => q.difficulty === 'hard').length,
      flagged: questions.filter(q => q.auto_flagged).length,
    };
  }, [questions]);

  // Fetch existing active questions for a course
  const fetchQuestions = useCallback(async (courseId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .order('difficulty', { ascending: true })
        .order('created_at', { ascending: true });

      if (fetchError) throw new Error(fetchError.message);

      // Map DB rows to typed QuizQuestion
      const mapped: QuizQuestion[] = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        course_id: row.course_id as string,
        section_id: (row.section_id as string | null) ?? null,
        question_en: row.question_en as string,
        question_es: row.question_es as string,
        options: (row.options as QuizQuestionOption[]) || [],
        explanation_en: (row.explanation_en as string) || '',
        explanation_es: (row.explanation_es as string) || '',
        difficulty: (row.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        source_element_key: (row.source_element_key as string | null) ?? null,
        is_active: row.is_active as boolean,
        auto_flagged: (row.auto_flagged as boolean) || false,
        times_shown: (row.times_shown as number) || 0,
        times_correct: (row.times_correct as number) || 0,
        created_at: row.created_at as string,
      }));

      setQuestions(mapped);
    } catch (err) {
      console.error('[useQuizPool] fetchQuestions error:', err);
      const message = err instanceof Error ? err.message : 'Failed to fetch questions';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate question pool via edge function (generate_pool_only mode)
  const generatePool = useCallback(async (
    courseId: string,
    language: 'en' | 'es',
    forceRegenerate = false,
  ): Promise<boolean> => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('course-quiz-generate', {
        body: {
          course_id: courseId,
          mode: 'generate_pool_only',
          language,
          force_regenerate: forceRegenerate,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to generate questions');
      if (data?.error) throw new Error(data.error);

      // Refresh the question list from DB after generation
      await fetchQuestions(courseId);
      return true;
    } catch (err) {
      console.error('[useQuizPool] generatePool error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate questions';
      setError(message);
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [fetchQuestions]);

  // Deactivate a single question
  const deactivateQuestion = useCallback(async (questionId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('quiz_questions')
        .update({ is_active: false })
        .eq('id', questionId);

      if (updateError) throw new Error(updateError.message);

      // Remove from local state
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err) {
      console.error('[useQuizPool] deactivateQuestion error:', err);
      const message = err instanceof Error ? err.message : 'Failed to deactivate question';
      setError(message);
    }
  }, []);

  return {
    questions,
    isLoading,
    isGenerating,
    error,
    stats,
    fetchQuestions,
    generatePool,
    deactivateQuestion,
  };
}
