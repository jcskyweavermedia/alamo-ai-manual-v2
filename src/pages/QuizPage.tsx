import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useQuizSession } from '@/hooks/use-quiz-session';
import { useLearningSession } from '@/hooks/use-learning-session';
import { QuizProgressBar } from '@/components/training/QuizProgressBar';
import { QuizMCQuestion } from '@/components/training/QuizMCQuestion';
import { QuizVoiceQuestion } from '@/components/training/QuizVoiceQuestion';
import { QuizResultsView } from '@/components/training/QuizResults';
import type { MCAnswerResult, VoiceAnswerResult } from '@/types/training';

export default function QuizPage() {
  const { programSlug, courseSlug, sectionSlug } = useParams();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const session = useLearningSession();
  const isEs = language === 'es';

  const quiz = useQuizSession({
    sectionId: session.currentSection?.id,
    enrollmentId: session.enrollment?.id,
    courseId: session.course?.id,
    passingScore: session.currentSection?.quizPassingScore ?? 70,
  });

  // Auto-start quiz on mount
  useEffect(() => {
    if (session.currentSection?.id && !quiz.attempt && quiz.quizState === 'loading') {
      quiz.startQuiz();
    }
  }, [session.currentSection?.id]);

  const sectionTitle = session.currentSection
    ? isEs && session.currentSection.titleEs
      ? session.currentSection.titleEs
      : session.currentSection.titleEn
    : '';

  const backUrl = `/courses/${programSlug}/${courseSlug}/${sectionSlug}`;

  // Loading state (session)
  if (session.isLoading) {
    return (
      <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (session.error || !session.currentSection) {
    return (
      <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {isEs ? 'Seccion no encontrada.' : 'Section not found.'}
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate(backUrl)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isEs ? 'Volver' : 'Go back'}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => navigate(backUrl)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">
              {isEs ? 'Preguntas de Practica' : 'Practice Questions'}: {sectionTitle}
            </h2>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-6">

            {/* Loading questions */}
            {quiz.quizState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isEs ? 'Preparando quiz...' : 'Preparing quiz...'}
                </p>
              </div>
            )}

            {/* Error */}
            {quiz.error && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm text-muted-foreground">{quiz.error}</p>
                <Button variant="outline" size="sm" onClick={quiz.retryQuiz}>
                  {isEs ? 'Reintentar' : 'Retry'}
                </Button>
              </div>
            )}

            {/* Ready state — show start button */}
            {quiz.quizState === 'ready' && quiz.attempt && (
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <ClipboardCheck className="h-12 w-12 text-primary/60" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">
                    {isEs ? 'Preguntas de practica listas' : 'Practice questions ready'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {quiz.totalQuestions} {isEs ? 'preguntas' : 'questions'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isEs
                      ? 'Te ayudan a prepararte para el Examen de Certificacion'
                      : 'These help you prepare for the Certification Test'}
                  </p>
                </div>
                <Button size="lg" onClick={quiz.beginQuiz} className="px-8">
                  {isEs ? 'Comenzar practica' : 'Start practice'}
                </Button>
              </div>
            )}

            {/* In progress — show current question */}
            {(quiz.quizState === 'in_progress' || quiz.quizState === 'grading_voice') &&
              quiz.currentQuestion && (
                <div className="space-y-6">
                  <QuizProgressBar
                    current={quiz.currentIndex}
                    total={quiz.totalQuestions}
                    answers={quiz.answers}
                    questionIds={quiz.attempt?.questions.map((q) => q.id) ?? []}
                  />

                  {quiz.currentQuestion.question_type === 'multiple_choice' ? (
                    <QuizMCQuestion
                      question={quiz.currentQuestion}
                      onSubmit={(optionId) =>
                        quiz.submitMCAnswer(quiz.currentQuestion!.id, optionId)
                      }
                      result={
                        quiz.answers.get(quiz.currentQuestion.id) as
                          | MCAnswerResult
                          | undefined
                      }
                      language={language}
                    />
                  ) : (
                    <QuizVoiceQuestion
                      question={quiz.currentQuestion}
                      onSubmit={(transcription) =>
                        quiz.submitVoiceAnswer(
                          quiz.currentQuestion!.id,
                          transcription
                        )
                      }
                      result={
                        quiz.answers.get(quiz.currentQuestion.id) as
                          | VoiceAnswerResult
                          | undefined
                      }
                      isGrading={quiz.quizState === 'grading_voice'}
                      language={language}
                    />
                  )}

                  {/* Next / Complete buttons */}
                  {quiz.answers.has(quiz.currentQuestion.id) && (
                    <div className="flex justify-end pt-2">
                      {quiz.currentIndex < quiz.totalQuestions - 1 ? (
                        <Button onClick={quiz.nextQuestion}>
                          {isEs ? 'Siguiente' : 'Next'}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      ) : quiz.allAnswered ? (
                        <Button onClick={quiz.completeQuiz}>
                          {isEs ? 'Terminar quiz' : 'Finish quiz'}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

            {/* Completing */}
            {quiz.quizState === 'completing' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isEs ? 'Generando evaluacion...' : 'Generating evaluation...'}
                </p>
              </div>
            )}

            {/* Results */}
            {quiz.quizState === 'results' && quiz.results && (
              <QuizResultsView
                results={quiz.results}
                passingScore={quiz.attempt?.passingScore ?? 70}
                onRetry={quiz.retryQuiz}
                onContinue={() => {
                  if (session.nextSection) {
                    navigate(
                      `/courses/${programSlug}/${courseSlug}/${session.nextSection.slug}`
                    );
                  } else {
                    navigate(`/courses/${programSlug}/${courseSlug}`);
                  }
                }}
                language={language}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
