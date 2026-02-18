import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useModuleTest } from '@/hooks/use-module-test';
import { useCourseSections } from '@/hooks/use-course-sections';
import { useEnrollment } from '@/hooks/use-enrollment';
import { QuizProgressBar } from '@/components/training/QuizProgressBar';
import { QuizMCQuestion } from '@/components/training/QuizMCQuestion';
import { QuizVoiceQuestion } from '@/components/training/QuizVoiceQuestion';
import { ModuleTestResultsView } from '@/components/training/ModuleTestResultsView';
import type { MCAnswerResult, VoiceAnswerResult } from '@/types/training';

export default function ModuleTestPage() {
  const { programSlug, courseSlug } = useParams();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const isEs = language === 'es';

  const { course, isLoading: sectionsLoading } = useCourseSections(courseSlug);
  const { enrollment } = useEnrollment({ courseId: course?.id, autoEnroll: true });

  const test = useModuleTest({
    courseId: course?.id,
    enrollmentId: enrollment?.id,
    passingScore: course?.passingScore ?? 70,
  });

  // Auto-start test on mount
  useEffect(() => {
    if (course?.id && !test.attempt && test.testState === 'loading') {
      test.startTest();
    }
  }, [course?.id]);

  const courseTitle = course
    ? isEs && course.titleEs ? course.titleEs : course.titleEn
    : '';

  const backUrl = `/courses/${programSlug}/${courseSlug}`;

  if (sectionsLoading) {
    return (
      <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {isEs ? 'Curso no encontrado.' : 'Course not found.'}
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
              {isEs ? 'Examen de Certificacion' : 'Certification Test'}
            </h2>
            <p className="text-xs text-muted-foreground truncate">{courseTitle}</p>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-6">

            {/* Loading */}
            {test.testState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isEs ? 'Preparando examen...' : 'Preparing test...'}
                </p>
              </div>
            )}

            {/* Error */}
            {test.error && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm text-muted-foreground">{test.error}</p>
                <Button variant="outline" size="sm" onClick={test.retryTest}>
                  {isEs ? 'Reintentar' : 'Retry'}
                </Button>
              </div>
            )}

            {/* Ready */}
            {test.testState === 'ready' && test.attempt && (
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <ClipboardCheck className="h-12 w-12 text-primary/60" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">
                    {isEs ? 'Examen de Certificacion' : 'Certification Test'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {test.totalQuestions} {isEs ? 'preguntas' : 'questions'}
                    {' · '}
                    {isEs ? 'Minimo para aprobar: ' : 'Passing score: '}
                    {test.attempt.passingScore}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isEs
                      ? 'Cubre todas las secciones del curso'
                      : 'Covers all course sections'}
                  </p>
                </div>
                <Button size="lg" onClick={test.beginTest} className="px-8">
                  {isEs ? 'Comenzar examen' : 'Begin test'}
                </Button>
              </div>
            )}

            {/* In progress */}
            {(test.testState === 'in_progress' || test.testState === 'grading_voice') &&
              test.currentQuestion && (
                <div className="space-y-6">
                  <QuizProgressBar
                    current={test.currentIndex}
                    total={test.totalQuestions}
                    answers={test.answers}
                    questionIds={test.attempt?.questions.map((q) => q.id) ?? []}
                  />

                  {test.currentQuestion.question_type === 'multiple_choice' ? (
                    <QuizMCQuestion
                      question={test.currentQuestion}
                      onSubmit={(optionId) =>
                        test.submitMCAnswer(test.currentQuestion!.id, optionId)
                      }
                      result={
                        test.answers.get(test.currentQuestion.id) as
                          | MCAnswerResult
                          | undefined
                      }
                      language={language}
                    />
                  ) : (
                    <QuizVoiceQuestion
                      question={test.currentQuestion}
                      onSubmit={(transcription) =>
                        test.submitVoiceAnswer(test.currentQuestion!.id, transcription)
                      }
                      result={
                        test.answers.get(test.currentQuestion.id) as
                          | VoiceAnswerResult
                          | undefined
                      }
                      isGrading={test.testState === 'grading_voice'}
                      language={language}
                    />
                  )}

                  {/* Next / Complete */}
                  {test.answers.has(test.currentQuestion.id) && (
                    <div className="flex justify-end pt-2">
                      {test.currentIndex < test.totalQuestions - 1 ? (
                        <Button onClick={test.nextQuestion}>
                          {isEs ? 'Siguiente' : 'Next'}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      ) : test.allAnswered ? (
                        <Button onClick={test.completeTest}>
                          {isEs ? 'Terminar examen' : 'Finish test'}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

            {/* Completing */}
            {test.testState === 'completing' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isEs ? 'Generando evaluacion...' : 'Generating evaluation...'}
                </p>
              </div>
            )}

            {/* Results */}
            {test.testState === 'results' && test.results && (
              <ModuleTestResultsView
                results={test.results}
                passingScore={test.attempt?.passingScore ?? 70}
                onRetry={test.retryTest}
                onContinue={() => navigate(backUrl)}
                language={language}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
