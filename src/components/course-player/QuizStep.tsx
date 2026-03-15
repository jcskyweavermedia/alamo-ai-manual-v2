// =============================================================================
// QuizStep — Container component for inline quiz within the Course Player.
//
// Renders the complete quiz flow after section content:
//   idle     → "Start Quiz" button with ClipboardCheck icon
//   loading  → Loader2 spinner + "Preparing quiz..." text
//   ready    → Question count + "Start" button (attempt loaded)
//   answering → QuizProgressBar + QuizQuestionCard + Next/Finish buttons
//   grading  → Loader2 spinner + "Generating evaluation..."
//   results  → QuizResultCard with score, feedback, retry/continue
//
// Notifies parent of pass/fail via onQuizStateChange callback.
// =============================================================================

import { useEffect, useCallback } from 'react';
import { ClipboardCheck, Loader2, AlertCircle, ChevronRight, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useQuizPlayer } from '@/hooks/use-quiz-player';
import { QuizProgressBar } from './QuizProgressBar';
import { QuizQuestionCard } from './QuizQuestionCard';
import { QuizResultCard } from './QuizResultCard';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    startQuiz: 'Start Quiz',
    preparingQuiz: 'Preparing quiz...',
    questionsReady: (n: number) => `${n} question${n === 1 ? '' : 's'} ready`,
    begin: 'Begin',
    next: 'Next',
    finish: 'Finish Quiz',
    generatingEvaluation: 'Generating evaluation...',
    errorTitle: 'Something went wrong',
    retry: 'Retry',
    sectionQuiz: 'Section Quiz',
  },
  es: {
    startQuiz: 'Iniciar Quiz',
    preparingQuiz: 'Preparando quiz...',
    questionsReady: (n: number) => `${n} pregunta${n === 1 ? '' : 's'} lista${n === 1 ? '' : 's'}`,
    begin: 'Comenzar',
    next: 'Siguiente',
    finish: 'Finalizar Quiz',
    generatingEvaluation: 'Generando evaluacion...',
    errorTitle: 'Algo salio mal',
    retry: 'Reintentar',
    sectionQuiz: 'Quiz de Seccion',
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface QuizStepProps {
  sectionId: string;
  courseId: string;
  enrollmentId: string;
  language: string;
  onQuizStateChange?: (passed: boolean | null) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuizStep({
  sectionId,
  courseId,
  enrollmentId,
  language,
  onQuizStateChange,
}: QuizStepProps) {
  const lang = language === 'es' ? 'es' : 'en';
  const t = STRINGS[lang];

  const {
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
    startQuiz,
    beginQuiz,
    submitAnswer,
    nextQuestion,
    completeQuiz,
    retryQuiz,
  } = useQuizPlayer({
    sectionId,
    enrollmentId,
    courseId,
    language,
  });

  // ---- Derive question IDs for progress bar ----
  const questionIds = attempt?.questions.map((q) => q.id) ?? [];

  // ---- Notify parent of pass/fail ----
  useEffect(() => {
    if (quizState === 'results' && evaluationResult) {
      onQuizStateChange?.(evaluationResult.passed);
    }
  }, [quizState, evaluationResult, onQuizStateChange]);

  // ---- Has the current question been answered? ----
  const currentAnswered = currentQuestion
    ? answers.has(currentQuestion.id)
    : false;

  const isLastQuestion = currentIndex >= totalQuestions - 1;

  // ---- Handle Next / Finish ----
  const handleAdvance = useCallback(() => {
    if (isLastQuestion && allAnswered) {
      void completeQuiz();
    } else {
      nextQuestion();
    }
  }, [isLastQuestion, allAnswered, completeQuiz, nextQuestion]);

  // ---- Handle retry (also reset parent state) ----
  const handleRetry = useCallback(async () => {
    onQuizStateChange?.(null);
    await retryQuiz();
  }, [retryQuiz, onQuizStateChange]);

  // ---- Handle continue: scroll toolbar into view so user can advance ----
  const handleContinue = useCallback(() => {
    // Scroll the bottom toolbar into view so user can click Next
    const toolbar = document.querySelector('[data-player-toolbar]');
    toolbar?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  // ===========================================================================
  // RENDER: IDLE — Start Quiz button
  // ===========================================================================

  if (quizState === 'idle') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-4">
        <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center">
          <ClipboardCheck className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <p className="text-sm font-medium text-foreground">{t.sectionQuiz}</p>
        <Button onClick={() => void startQuiz()} variant="outline" size="sm">
          <ClipboardCheck className="h-4 w-4 mr-2" />
          {t.startQuiz}
        </Button>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: LOADING — Spinner
  // ===========================================================================

  if (quizState === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm text-muted-foreground">{t.preparingQuiz}</p>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: READY — Question count + Begin button
  // ===========================================================================

  if (quizState === 'ready') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-4">
        <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center">
          <ClipboardCheck className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <p className="text-sm font-medium text-foreground">{t.sectionQuiz}</p>
        <p className="text-xs text-muted-foreground">
          {t.questionsReady(totalQuestions)}
        </p>
        <Button onClick={beginQuiz} size="sm">
          {t.begin}
        </Button>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: ERROR STATE — only shown for fatal errors (not during answering)
  // ===========================================================================

  if (error && quizState !== 'answering') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm font-medium text-foreground">{t.errorTitle}</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {error}
        </p>
        <Button onClick={() => void startQuiz()} variant="outline" size="sm">
          {t.retry}
        </Button>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: ANSWERING — Progress bar + question card + navigation
  // ===========================================================================

  if (quizState === 'answering') {
    return (
      <div className="space-y-4 py-6 px-4">
        {/* Inline error banner (non-fatal, during answering) */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 animate-in fade-in duration-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Progress dots */}
        <QuizProgressBar
          current={currentIndex}
          total={totalQuestions}
          answers={answers}
          questionIds={questionIds}
        />

        {/* Question card */}
        {currentQuestion && (
          <QuizQuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            onSubmit={(optionId) => submitAnswer(currentQuestion.id, optionId)}
            result={answers.get(currentQuestion.id)}
            language={language}
          />
        )}

        {/* Next / Finish button (only shown after answering current question) */}
        {currentAnswered && (
          <div className="flex justify-end pt-2 animate-in fade-in duration-200">
            <Button
              size="sm"
              onClick={handleAdvance}
              className={cn(
                'gap-1',
                isLastQuestion && allAnswered &&
                  'bg-green-600 hover:bg-green-700 text-white',
              )}
            >
              {isLastQuestion && allAnswered ? (
                <>
                  <Flag className="h-4 w-4" />
                  {t.finish}
                </>
              ) : (
                <>
                  {t.next}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // RENDER: GRADING — Evaluation spinner
  // ===========================================================================

  if (quizState === 'grading') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm text-muted-foreground">
          {t.generatingEvaluation}
        </p>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: RESULTS — Evaluation result card
  // ===========================================================================

  if (quizState === 'results' && evaluationResult) {
    return (
      <div className="py-6 px-4">
        <QuizResultCard
          result={evaluationResult}
          courseEvaluation={courseEvaluation}
          onRetry={handleRetry}
          onContinue={handleContinue}
          language={language}
        />
      </div>
    );
  }

  // Fallback (should not reach here)
  return null;
}
