/**
 * useQuizSession Hook
 *
 * Manages the full quiz lifecycle:
 * - Fetches/generates quiz questions via course-quiz-generate edge function
 * - Navigates through questions
 * - Submits MC and voice answers via course-evaluate edge function
 * - Completes quiz and gets section evaluation with dual feedback
 * - Invalidates relevant caches on completion
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import type {
  QuizState,
  QuizQuestionClient,
  QuizAttemptClient,
  MCAnswerResult,
  VoiceAnswerResult,
  AnswerResult,
  QuizResults,
} from '@/types/training';

interface UseQuizSessionOptions {
  sectionId: string | undefined;
  enrollmentId: string | undefined;
  courseId: string | undefined;
  passingScore?: number;
}

export function useQuizSession({
  sectionId,
  enrollmentId,
  courseId,
  passingScore = 70,
}: UseQuizSessionOptions) {
  const { user, permissions } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const [quizState, setQuizState] = useState<QuizState>('loading');
  const [attempt, setAttempt] = useState<QuizAttemptClient | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerResult>>(new Map());
  const [results, setResults] = useState<QuizResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track time per question
  const questionStartTime = useRef<number>(Date.now());

  const currentQuestion: QuizQuestionClient | null =
    attempt?.questions[currentIndex] ?? null;

  const totalQuestions = attempt?.totalQuestions ?? 0;

  // ─── START QUIZ ─────────────────────────────────────────────────────────────

  const startQuiz = useCallback(async () => {
    if (!sectionId || !groupId) {
      setError('Missing section or group');
      return;
    }

    setQuizState('loading');
    setError(null);
    setAnswers(new Map());
    setCurrentIndex(0);
    setResults(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'course-quiz-generate',
        {
          body: {
            section_id: sectionId,
            language,
            groupId,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate quiz');
      }

      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      const quizAttempt: QuizAttemptClient = {
        attemptId: data.attempt_id,
        questions: data.questions as QuizQuestionClient[],
        totalQuestions: data.total_questions,
        passingScore: data.passing_score || passingScore,
      };

      setAttempt(quizAttempt);
      setQuizState('ready');
    } catch (err) {
      console.error('[useQuizSession] startQuiz error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start quiz');
      setQuizState('loading');
    }
  }, [sectionId, groupId, language, passingScore]);

  // ─── BEGIN (transition from ready → in_progress) ────────────────────────────

  const beginQuiz = useCallback(() => {
    setQuizState('in_progress');
    questionStartTime.current = Date.now();
  }, []);

  // ─── SUBMIT MC ANSWER ──────────────────────────────────────────────────────

  const submitMCAnswer = useCallback(
    async (questionId: string, optionId: string) => {
      if (!attempt || !groupId) return;

      const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'course-evaluate',
          {
            body: {
              action: 'grade_mc',
              attempt_id: attempt.attemptId,
              question_id: questionId,
              selected_option: optionId,
              time_spent_seconds: timeSpent,
              language,
              groupId,
            },
          }
        );

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.message || data.error);

        const result: MCAnswerResult = {
          questionId,
          type: 'mc',
          isCorrect: data.is_correct,
          correctOptionId: data.correct_option_id,
          correctOptionText: data.correct_option_text,
          explanation: data.explanation ?? null,
        };

        setAnswers((prev) => new Map(prev).set(questionId, result));
      } catch (err) {
        console.error('[useQuizSession] submitMCAnswer error:', err);
        setError(err instanceof Error ? err.message : 'Failed to grade answer');
      }
    },
    [attempt, groupId, language]
  );

  // ─── SUBMIT VOICE ANSWER ───────────────────────────────────────────────────

  const submitVoiceAnswer = useCallback(
    async (questionId: string, transcription: string) => {
      if (!attempt || !groupId) return;

      const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);

      setQuizState('grading_voice');

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'course-evaluate',
          {
            body: {
              action: 'grade_voice',
              attempt_id: attempt.attemptId,
              question_id: questionId,
              transcription,
              time_spent_seconds: timeSpent,
              language,
              groupId,
            },
          }
        );

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.message || data.error);

        const result: VoiceAnswerResult = {
          questionId,
          type: 'voice',
          voiceScore: data.voice_score,
          criteriaScores: data.criteria_scores.map(
            (c: Record<string, unknown>) => ({
              criterion: c.criterion as string,
              pointsEarned: c.points_earned as number,
              pointsPossible: c.points_possible as number,
              met: c.met as boolean,
            })
          ),
          feedback: data.feedback,
          passed: data.passed,
        };

        setAnswers((prev) => new Map(prev).set(questionId, result));
        setQuizState('in_progress');
      } catch (err) {
        console.error('[useQuizSession] submitVoiceAnswer error:', err);
        setError(err instanceof Error ? err.message : 'Failed to grade voice answer');
        setQuizState('in_progress');
      }
    },
    [attempt, groupId, language]
  );

  // ─── NAVIGATE QUESTIONS ─────────────────────────────────────────────────────

  const goToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalQuestions) {
        setCurrentIndex(index);
        questionStartTime.current = Date.now();
      }
    },
    [totalQuestions]
  );

  const nextQuestion = useCallback(() => {
    goToQuestion(currentIndex + 1);
  }, [currentIndex, goToQuestion]);

  // ─── COMPLETE QUIZ ──────────────────────────────────────────────────────────

  const completeQuiz = useCallback(async () => {
    if (!attempt || !sectionId || !groupId) return;

    setQuizState('completing');

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'course-evaluate',
        {
          body: {
            action: 'section_evaluation',
            attempt_id: attempt.attemptId,
            section_id: sectionId,
            enrollment_id: enrollmentId,
            language,
            groupId,
          },
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.message || data.error);

      const quizResults: QuizResults = {
        score: data.score,
        passed: data.passed,
        competencyLevel: data.competency_level,
        studentFeedback: {
          strengths: data.student_feedback?.strengths ?? [],
          areasForImprovement: data.student_feedback?.areas_for_improvement ?? [],
          encouragement: data.student_feedback?.encouragement ?? '',
        },
      };

      setResults(quizResults);
      setQuizState('results');

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['section-progress'] });
      queryClient.invalidateQueries({ queryKey: ['course-sections'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['program-enrollment'] });
    } catch (err) {
      console.error('[useQuizSession] completeQuiz error:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete quiz');
      setQuizState('in_progress');
    }
  }, [attempt, sectionId, enrollmentId, groupId, language, queryClient]);

  // ─── RETRY QUIZ ─────────────────────────────────────────────────────────────

  const retryQuiz = useCallback(async () => {
    setAnswers(new Map());
    setCurrentIndex(0);
    setResults(null);
    setError(null);
    await startQuiz();
  }, [startQuiz]);

  // ─── CHECK IF ALL ANSWERED ──────────────────────────────────────────────────

  const allAnswered = totalQuestions > 0 && answers.size >= totalQuestions;

  return {
    quizState,
    attempt,
    currentQuestion,
    currentIndex,
    totalQuestions,
    answers,
    results,
    error,
    allAnswered,
    startQuiz,
    beginQuiz,
    submitMCAnswer,
    submitVoiceAnswer,
    completeQuiz,
    retryQuiz,
    goToQuestion,
    nextQuestion,
  };
}
