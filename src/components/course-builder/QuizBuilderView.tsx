// =============================================================================
// QuizBuilderView — Container view for the Quiz tab in the course builder.
// Combines QuizConfigPanel, GenerateQuizButton, and QuestionPoolPreview.
// Fetches questions on mount, delegates generation to useQuizPool hook.
// =============================================================================

import { useEffect, useMemo, useCallback } from 'react';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { useQuizPool } from '@/hooks/use-quiz-pool';
import { QuizConfigPanel } from '@/components/course-builder/QuizConfigPanel';
import { AssessmentConfigPanel } from '@/components/course-builder/AssessmentConfigPanel';
import { GenerateQuizButton } from '@/components/course-builder/GenerateQuizButton';
import { QuestionPoolPreview } from '@/components/course-builder/QuestionPoolPreview';

// =============================================================================
// TYPES
// =============================================================================

interface QuizBuilderViewProps {
  language: 'en' | 'es';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuizBuilderView({ language }: QuizBuilderViewProps) {
  const { state } = useCourseBuilder();
  const pool = useQuizPool();
  const isEs = language === 'es';

  // Fetch questions on mount when courseId exists
  useEffect(() => {
    if (state.courseId) {
      void pool.fetchQuestions(state.courseId);
    }
    // Only re-fetch when courseId changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courseId]);

  // Determine if any sections have generated content (not just outlines)
  const hasGeneratedContent = useMemo(() => {
    return state.sections.some(section =>
      section.elements.some(el =>
        el.status === 'generated' || el.status === 'reviewed',
      ),
    );
  }, [state.sections]);

  // Callback after generation completes
  const handleGenerated = useCallback(() => {
    // Questions are already refreshed by the hook; nothing extra needed
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Quiz Configuration Panel */}
        <QuizConfigPanel language={language} />

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Assessment Configuration Panel */}
        <AssessmentConfigPanel language={language} />

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Generate Button (centered) */}
        <div className="flex flex-col items-center">
          {state.courseId ? (
            <GenerateQuizButton
              courseId={state.courseId}
              language={language}
              questionCount={pool.stats.total}
              hasExistingQuestions={pool.questions.length > 0}
              hasGeneratedContent={hasGeneratedContent}
              pool={pool}
              onGenerated={handleGenerated}
            />
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              {isEs
                ? 'Guarda el curso primero para generar preguntas'
                : 'Save the course first to generate questions'}
            </p>
          )}
        </div>

        {/* Error display */}
        {pool.error && (
          <div className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            {pool.error}
          </div>
        )}

        {/* Divider */}
        {pool.questions.length > 0 && (
          <div className="border-t border-border" />
        )}

        {/* Question Pool Preview */}
        {pool.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">
              {isEs ? 'Cargando preguntas...' : 'Loading questions...'}
            </span>
          </div>
        ) : (
          <QuestionPoolPreview
            questions={pool.questions}
            language={language}
            stats={pool.stats}
            onDeactivate={pool.deactivateQuestion}
          />
        )}
      </div>
    </div>
  );
}
