/**
 * useModuleTest Hook
 *
 * Manages the Certification Test lifecycle:
 * - Generates questions via course-quiz-generate (mode=module_test)
 * - Grades MC/voice via course-evaluate (attempt_type=module_test)
 * - Completes test via course-evaluate (module_test_evaluation)
 * - Returns per-section breakdown in results
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import type {
  ModuleTestState,
  QuizQuestionClient,
  ModuleTestAttemptClient,
  MCAnswerResult,
  VoiceAnswerResult,
  AnswerResult,
  ModuleTestResults,
  SectionScore,
} from '@/types/training';

interface UseModuleTestOptions {
  courseId: string | undefined;
  enrollmentId: string | undefined;
  passingScore?: number;
}

export function useModuleTest({
  courseId,
  enrollmentId,
  passingScore = 70,
}: UseModuleTestOptions) {
  const { user, permissions } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const [testState, setTestState] = useState<ModuleTestState>('loading');
  const [attempt, setAttempt] = useState<ModuleTestAttemptClient | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AnswerResult>>(new Map());
  const [results, setResults] = useState<ModuleTestResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const questionStartTime = useRef<number>(Date.now());

  const currentQuestion: QuizQuestionClient | null =
    attempt?.questions[currentIndex] ?? null;
  const totalQuestions = attempt?.totalQuestions ?? 0;

  const startTest = useCallback(async () => {
    if (!courseId || !groupId) {
      setError('Missing course or group');
      return;
    }

    setTestState('loading');
    setError(null);
    setAnswers(new Map());
    setCurrentIndex(0);
    setResults(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'course-quiz-generate',
        {
          body: {
            mode: 'module_test',
            course_id: courseId,
            language,
            groupId,
          },
        }
      );

      if (fnError) throw new Error(fnError.message || 'Failed to generate test');
      if (data?.error) throw new Error(data.message || data.error);

      const testAttempt: ModuleTestAttemptClient = {
        attemptId: data.attempt_id,
        questions: data.questions as QuizQuestionClient[],
        totalQuestions: data.total_questions,
        passingScore: data.passing_score || passingScore,
        sectionMap: data.section_map || {},
      };

      setAttempt(testAttempt);
      setTestState('ready');
    } catch (err) {
      console.error('[useModuleTest] startTest error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start test');
      setTestState('loading');
    }
  }, [courseId, groupId, language, passingScore]);

  const beginTest = useCallback(() => {
    setTestState('in_progress');
    questionStartTime.current = Date.now();
  }, []);

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
              attempt_type: 'module_test',
              language,
              groupId,
            },
          }
        );

        if (fnError) {
          const ctx = (fnError as any).context;
          const detail = ctx?.message || ctx?.error || fnError.message;
          throw new Error(detail);
        }
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
        console.error('[useModuleTest] submitMCAnswer error:', err);
        setError(err instanceof Error ? err.message : 'Failed to grade answer');
      }
    },
    [attempt, groupId, language]
  );

  const submitVoiceAnswer = useCallback(
    async (questionId: string, transcription: string) => {
      if (!attempt || !groupId) return;

      const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
      setTestState('grading_voice');

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
              attempt_type: 'module_test',
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
        setTestState('in_progress');
      } catch (err) {
        console.error('[useModuleTest] submitVoiceAnswer error:', err);
        setError(err instanceof Error ? err.message : 'Failed to grade voice answer');
        setTestState('in_progress');
      }
    },
    [attempt, groupId, language]
  );

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

  const completeTest = useCallback(async () => {
    if (!attempt || !courseId || !groupId) return;

    setTestState('completing');

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'course-evaluate',
        {
          body: {
            action: 'module_test_evaluation',
            attempt_id: attempt.attemptId,
            course_id: courseId,
            enrollment_id: enrollmentId,
            language,
            groupId,
          },
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.message || data.error);

      const sectionScores: SectionScore[] = (data.section_scores || []).map(
        (s: Record<string, unknown>) => ({
          sectionId: s.section_id as string,
          sectionTitle: s.section_title as string,
          score: s.score as number,
          questionsCount: s.questions_count as number,
        })
      );

      const testResults: ModuleTestResults = {
        score: data.score,
        passed: data.passed,
        sectionScores,
        competencyLevel: data.competency_level,
        studentFeedback: {
          strengths: data.student_feedback?.strengths ?? [],
          areasForImprovement: data.student_feedback?.areas_for_improvement ?? [],
          encouragement: data.student_feedback?.encouragement ?? '',
        },
      };

      setResults(testResults);
      setTestState('results');

      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['course-assessment'] });
      queryClient.invalidateQueries({ queryKey: ['program-enrollment'] });
    } catch (err) {
      console.error('[useModuleTest] completeTest error:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete test');
      setTestState('in_progress');
    }
  }, [attempt, courseId, enrollmentId, groupId, language, queryClient]);

  const retryTest = useCallback(async () => {
    setAnswers(new Map());
    setCurrentIndex(0);
    setResults(null);
    setError(null);
    await startTest();
  }, [startTest]);

  const allAnswered = totalQuestions > 0 && answers.size >= totalQuestions;

  return {
    testState,
    attempt,
    currentQuestion,
    currentIndex,
    totalQuestions,
    answers,
    results,
    error,
    allAnswered,
    startTest,
    beginTest,
    submitMCAnswer,
    submitVoiceAnswer,
    completeTest,
    retryTest,
    goToQuestion,
    nextQuestion,
  };
}
