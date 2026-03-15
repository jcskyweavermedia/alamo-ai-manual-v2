// =============================================================================
// useQuizPlayer — Student-facing quiz session hook for the Course Player.
//
// MC-only (no voice for MVP). Drives quiz lifecycle:
//   idle → loading → ready → answering → grading → results
//
// Edge functions:
//   - course-quiz-generate (mode: section_quiz)  → generates attempt + questions
//   - course-evaluate (action: grade_mc)          → grades one MC answer
//   - course-evaluate (action: section_evaluation) → final evaluation + optional course eval
//
// Pattern: follows use-course-enrollment.ts / use-ask-ai.ts for edge function calls.
// =============================================================================

import { useState, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type {
  QuizPlayerState,
  QuizQuestionClient,
  QuizAttemptClient,
  MCAnswerResult,
  QuizEvaluationResult,
  CourseEvaluationResult,
} from '@/types/course-player';

// =============================================================================
// OPTIONS
// =============================================================================

interface UseQuizPlayerOptions {
  sectionId: string | undefined;
  enrollmentId: string | undefined;
  courseId: string | undefined;
  language: string;
}

// =============================================================================
// RETURN TYPE
// =============================================================================

interface UseQuizPlayerReturn {
  // State
  quizState: QuizPlayerState;
  attempt: QuizAttemptClient | null;
  currentQuestion: QuizQuestionClient | null;
  currentIndex: number;
  totalQuestions: number;
  answers: Map<string, MCAnswerResult>;
  evaluationResult: QuizEvaluationResult | null;
  courseEvaluation: CourseEvaluationResult | null;
  error: string | null;
  allAnswered: boolean;

  // Actions
  startQuiz: () => Promise<void>;
  beginQuiz: () => void;
  submitAnswer: (questionId: string, optionId: string) => Promise<void>;
  nextQuestion: () => void;
  completeQuiz: () => Promise<void>;
  retryQuiz: () => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useQuizPlayer(options: UseQuizPlayerOptions): UseQuizPlayerReturn {
  const { sectionId, enrollmentId, courseId, language } = options;

  const { permissions } = useAuth();
  const queryClient = useQueryClient();

  // Primary group for edge function calls
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [quizState, setQuizState] = useState<QuizPlayerState>('idle');
  const [attempt, setAttempt] = useState<QuizAttemptClient | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, MCAnswerResult>>(new Map());
  const [evaluationResult, setEvaluationResult] = useState<QuizEvaluationResult | null>(null);
  const [courseEvaluation, setCourseEvaluation] = useState<CourseEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track time spent per question (ref so it doesn't trigger re-renders)
  const questionStartTimeRef = useRef<number>(0);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const totalQuestions = attempt?.totalQuestions ?? 0;

  const currentQuestion: QuizQuestionClient | null = useMemo(() => {
    if (!attempt || currentIndex < 0 || currentIndex >= attempt.questions.length) {
      return null;
    }
    return attempt.questions[currentIndex];
  }, [attempt, currentIndex]);

  const allAnswered = useMemo(() => {
    if (!attempt) return false;
    return answers.size >= attempt.totalQuestions;
  }, [attempt, answers.size]);

  // ---------------------------------------------------------------------------
  // resetState: clear all quiz state for a fresh attempt
  // ---------------------------------------------------------------------------

  const resetState = useCallback(() => {
    setAttempt(null);
    setCurrentIndex(0);
    setAnswers(new Map());
    setEvaluationResult(null);
    setCourseEvaluation(null);
    setError(null);
    questionStartTimeRef.current = 0;
  }, []);

  // ---------------------------------------------------------------------------
  // startQuiz: call course-quiz-generate to create an attempt
  // ---------------------------------------------------------------------------

  const startQuiz = useCallback(async () => {
    if (!sectionId || !groupId) {
      setError('Missing section or group information');
      return;
    }
    // Prevent double-fire if already loading
    if (quizState === 'loading') return;

    setQuizState('loading');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('course-quiz-generate', {
        body: {
          section_id: sectionId,
          mode: 'section_quiz',
          language,
          groupId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate quiz');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Map edge function response → client types
      const questions: QuizQuestionClient[] = (data.questions || []).map(
        (q: Record<string, unknown>) => ({
          id: q.id as string,
          question: q.question as string,
          options: (q.options as Array<{ id: string; text: string }>) || [],
          difficulty: (q.difficulty as QuizQuestionClient['difficulty']) || 'medium',
          questionType: 'multiple_choice' as const,
        }),
      );

      const clientAttempt: QuizAttemptClient = {
        attemptId: data.attempt_id as string,
        questions,
        totalQuestions: (data.total_questions as number) || questions.length,
        passingScore: (data.passing_score as number) || 70,
      };

      setAttempt(clientAttempt);
      setCurrentIndex(0);
      setAnswers(new Map());
      setEvaluationResult(null);
      setCourseEvaluation(null);
      setQuizState('ready');
    } catch (err) {
      console.error('[useQuizPlayer] startQuiz error:', err);
      const message = err instanceof Error ? err.message : 'Failed to start quiz';
      setError(message);
      setQuizState('idle');
    }
  }, [sectionId, groupId, language]);

  // ---------------------------------------------------------------------------
  // beginQuiz: transition from ready → answering (user clicks "Start")
  // ---------------------------------------------------------------------------

  const beginQuiz = useCallback(() => {
    if (quizState !== 'ready') return;
    setQuizState('answering');
    questionStartTimeRef.current = Date.now();
  }, [quizState]);

  // ---------------------------------------------------------------------------
  // submitAnswer: grade a single MC answer via course-evaluate
  // ---------------------------------------------------------------------------

  const submitAnswer = useCallback(async (questionId: string, optionId: string) => {
    if (!attempt || !groupId) return;

    setQuizState('grading');
    setError(null);

    // Calculate time spent on this question (in seconds)
    const now = Date.now();
    const timeSpentSeconds = questionStartTimeRef.current > 0
      ? Math.round((now - questionStartTimeRef.current) / 1000)
      : 0;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('course-evaluate', {
        body: {
          action: 'grade_mc',
          attempt_id: attempt.attemptId,
          question_id: questionId,
          selected_option: optionId,
          time_spent_seconds: timeSpentSeconds,
          language,
          groupId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to grade answer');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Map response to MCAnswerResult
      const result: MCAnswerResult = {
        questionId,
        isCorrect: data.is_correct as boolean,
        correctOptionId: data.correct_option_id as string,
        correctOptionText: data.correct_option_text as string,
        explanation: (data.explanation as string) || null,
      };

      // Add to answers map
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, result);
        return next;
      });

      setQuizState('answering');
    } catch (err) {
      console.error('[useQuizPlayer] submitAnswer error:', err);
      const message = err instanceof Error ? err.message : 'Failed to submit answer';
      setError(message);
      setQuizState('answering');
    }
  }, [attempt, groupId, language]);

  // ---------------------------------------------------------------------------
  // nextQuestion: advance to the next question
  // ---------------------------------------------------------------------------

  const nextQuestion = useCallback(() => {
    if (!attempt) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < attempt.questions.length) {
      setCurrentIndex(nextIndex);
      // Reset timer for the new question
      questionStartTimeRef.current = Date.now();
    }
  }, [attempt, currentIndex]);

  // ---------------------------------------------------------------------------
  // completeQuiz: call course-evaluate with section_evaluation action
  // ---------------------------------------------------------------------------

  const completeQuiz = useCallback(async () => {
    if (!attempt || !sectionId || !enrollmentId || !groupId) {
      setError('Missing required data to complete quiz');
      return;
    }

    setQuizState('loading');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('course-evaluate', {
        body: {
          action: 'section_evaluation',
          attempt_id: attempt.attemptId,
          section_id: sectionId,
          enrollment_id: enrollmentId,
          language,
          groupId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to complete quiz evaluation');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Map section evaluation result
      const evalResult: QuizEvaluationResult = {
        score: data.score as number,
        passed: data.passed as boolean,
        competencyLevel: data.competency_level as string,
        studentFeedback: {
          strengths: (data.student_feedback?.strengths as string[]) || [],
          areasForImprovement: (data.student_feedback?.areas_for_improvement as string[]) || [],
          encouragement: (data.student_feedback?.encouragement as string) || '',
        },
      };

      setEvaluationResult(evalResult);

      // Server may include course-level evaluation when all sections are done
      if (data.course_evaluation) {
        const courseEval: CourseEvaluationResult = {
          score: data.course_evaluation.score as number,
          passed: data.course_evaluation.passed as boolean,
          competencyLevel: data.course_evaluation.competency_level as string,
          studentFeedback: {
            strengths: (data.course_evaluation.student_feedback?.strengths as string[]) || [],
            areasForImprovement:
              (data.course_evaluation.student_feedback?.areas_for_improvement as string[]) || [],
            encouragement:
              (data.course_evaluation.student_feedback?.encouragement as string) || '',
          },
        };
        setCourseEvaluation(courseEval);
      }

      // Invalidate react-query caches so the player UI reflects new progress
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['section-progress'] }),
        queryClient.invalidateQueries({ queryKey: ['course-enrollment'] }),
        queryClient.invalidateQueries({ queryKey: ['courses'] }),
        queryClient.invalidateQueries({ queryKey: ['programs'] }),
        queryClient.invalidateQueries({ queryKey: ['program-enrollment'] }),
      ]);

      setQuizState('results');
    } catch (err) {
      console.error('[useQuizPlayer] completeQuiz error:', err);
      const message = err instanceof Error ? err.message : 'Failed to complete quiz';
      setError(message);
      setQuizState('answering');
    }
  }, [attempt, sectionId, enrollmentId, groupId, language, queryClient]);

  // ---------------------------------------------------------------------------
  // retryQuiz: reset state and start a new attempt
  // ---------------------------------------------------------------------------

  const retryQuiz = useCallback(async () => {
    resetState();
    await startQuiz();
  }, [resetState, startQuiz]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    quizState,
    attempt,
    currentQuestion,
    currentIndex,
    totalQuestions,
    answers,
    evaluationResult,
    courseEvaluation,
    error,
    allAnswered,

    // Actions
    startQuiz,
    beginQuiz,
    submitAnswer,
    nextQuestion,
    completeQuiz,
    retryQuiz,
  };
}
