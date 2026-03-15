// =============================================================================
// QuizResultCard — Quiz evaluation results with score ring, feedback, actions.
//
// Adapted from old training/QuizResults. Same visual pattern:
//   - ProgressRing (score circle) at top
//   - Pass/fail badge below ring (green for passed, amber for "not yet")
//   - Competency level label
//   - Strengths section with green Check icons
//   - Areas to improve with amber ArrowRight icons
//   - Encouragement in italic muted bg box
//   - Optional course evaluation summary section
//   - Continue + Retry buttons at bottom
// =============================================================================

import { Check, ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ui/progress-ring';
import type { QuizEvaluationResult, CourseEvaluationResult } from '@/types/course-player';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    passed: 'PASSED',
    notYet: 'NOT YET',
    level: 'Level: ',
    strengths: 'Strengths',
    areasToImprove: 'Areas to improve',
    continue: 'Continue',
    retry: 'Retry quiz',
    courseEvaluation: 'Course Evaluation',
    courseScore: 'Overall score: ',
    coursePassed: 'Course passed!',
    courseNotPassed: 'Keep going!',
  },
  es: {
    passed: 'APROBADO',
    notYet: 'AUN NO',
    level: 'Nivel: ',
    strengths: 'Fortalezas',
    areasToImprove: 'Areas de mejora',
    continue: 'Continuar',
    retry: 'Reintentar quiz',
    courseEvaluation: 'Evaluacion del Curso',
    courseScore: 'Puntuacion general: ',
    coursePassed: 'Curso aprobado!',
    courseNotPassed: 'Sigue adelante!',
  },
} as const;

const COMPETENCY_LABELS: Record<string, Record<string, string>> = {
  en: {
    novice: 'Novice',
    competent: 'Competent',
    proficient: 'Proficient',
    expert: 'Expert',
  },
  es: {
    novice: 'Novato',
    competent: 'Competente',
    proficient: 'Competente Avanzado',
    expert: 'Experto',
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface QuizResultCardProps {
  result: QuizEvaluationResult;
  courseEvaluation?: CourseEvaluationResult | null;
  onRetry: () => void;
  onContinue: () => void;
  language: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuizResultCard({
  result,
  courseEvaluation,
  onRetry,
  onContinue,
  language,
}: QuizResultCardProps) {
  const lang = language === 'es' ? 'es' : 'en';
  const t = STRINGS[lang];

  const { score, passed, competencyLevel, studentFeedback } = result;

  const competencyLabel =
    COMPETENCY_LABELS[lang]?.[competencyLevel] ?? competencyLevel;

  return (
    <div className="flex flex-col items-center gap-6 py-6 animate-in fade-in duration-500">
      {/* ---- Score ring ---- */}
      <div className="flex flex-col items-center gap-2">
        <ProgressRing percent={score} size={96} strokeWidth={6} />
        <div
          className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold',
            passed
              ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
          )}
        >
          {passed ? t.passed : t.notYet}
        </div>
      </div>

      {/* ---- Competency level ---- */}
      <p className="text-sm text-muted-foreground">
        {t.level}
        <span className="font-semibold text-foreground">{competencyLabel}</span>
      </p>

      {/* ---- Strengths ---- */}
      {studentFeedback.strengths.length > 0 && (
        <div className="w-full space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t.strengths}
          </h3>
          <ul className="space-y-1.5">
            {studentFeedback.strengths.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Areas to improve ---- */}
      {studentFeedback.areasForImprovement.length > 0 && (
        <div className="w-full space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t.areasToImprove}
          </h3>
          <ul className="space-y-1.5">
            {studentFeedback.areasForImprovement.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <ArrowRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Encouragement ---- */}
      {studentFeedback.encouragement && (
        <p className="text-sm text-foreground bg-muted rounded-lg px-4 py-3 w-full italic">
          {studentFeedback.encouragement}
        </p>
      )}

      {/* ---- Course Evaluation (optional) ---- */}
      {courseEvaluation && (
        <div className="w-full border-t pt-4 mt-2 space-y-3">
          <h3 className="text-sm font-semibold text-foreground text-center">
            {t.courseEvaluation}
          </h3>

          <div className="flex flex-col items-center gap-2">
            <ProgressRing percent={courseEvaluation.score} size={72} strokeWidth={5} />
            <div
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold',
                courseEvaluation.passed
                  ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
              )}
            >
              {courseEvaluation.passed ? t.coursePassed : t.courseNotPassed}
            </div>
          </div>

          {/* Course-level strengths */}
          {courseEvaluation.studentFeedback.strengths.length > 0 && (
            <div className="space-y-1.5">
              {courseEvaluation.studentFeedback.strengths.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* Course-level encouragement */}
          {courseEvaluation.studentFeedback.encouragement && (
            <p className="text-sm text-foreground bg-muted rounded-lg px-4 py-3 w-full italic">
              {courseEvaluation.studentFeedback.encouragement}
            </p>
          )}
        </div>
      )}

      {/* ---- Action buttons ---- */}
      <div className="flex flex-col gap-2 w-full pt-2">
        <Button onClick={onContinue} className="w-full">
          <ArrowRight className="h-4 w-4 mr-2" />
          {t.continue}
        </Button>
        <Button variant="outline" onClick={onRetry} className="w-full">
          <RotateCcw className="h-4 w-4 mr-2" />
          {t.retry}
        </Button>
      </div>
    </div>
  );
}
