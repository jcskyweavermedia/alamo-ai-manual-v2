import { Check, ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/training/ProgressRing';
import type { ModuleTestResults, SectionScore } from '@/types/training';

interface ModuleTestResultsViewProps {
  results: ModuleTestResults;
  passingScore: number;
  onRetry: () => void;
  onContinue: () => void;
  language: 'en' | 'es';
}

const COMPETENCY_LABELS = {
  en: { novice: 'Novice', competent: 'Competent', proficient: 'Proficient', expert: 'Expert' },
  es: { novice: 'Novato', competent: 'Competente', proficient: 'Competente Avanzado', expert: 'Experto' },
} as const;

function SectionScoreBar({ section, language }: { section: SectionScore; language: 'en' | 'es' }) {
  const barColor = section.score >= 80
    ? 'bg-green-500'
    : section.score >= 60
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-foreground font-medium truncate">{section.sectionTitle}</span>
        <span className="text-muted-foreground shrink-0 ml-2">
          {section.score}% ({section.questionsCount} {language === 'es' ? 'preg.' : 'q.'})
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${section.score}%` }}
        />
      </div>
    </div>
  );
}

export function ModuleTestResultsView({
  results,
  passingScore,
  onRetry,
  onContinue,
  language,
}: ModuleTestResultsViewProps) {
  const isEs = language === 'es';
  const { score, passed, competencyLevel, studentFeedback, sectionScores } = results;
  const competencyLabel = COMPETENCY_LABELS[language][competencyLevel];

  return (
    <div className="flex flex-col items-center gap-6 py-6 animate-in fade-in duration-500">
      {/* Score ring */}
      <div className="flex flex-col items-center gap-2">
        <ProgressRing percent={score} size={96} strokeWidth={6} />
        <div
          className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold',
            passed
              ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
          )}
        >
          {passed
            ? isEs ? 'APROBADO' : 'PASSED'
            : isEs ? 'AUN NO' : 'NOT YET'}
        </div>
      </div>

      {/* Competency level */}
      <p className="text-sm text-muted-foreground">
        {isEs ? 'Nivel: ' : 'Level: '}
        <span className="font-semibold text-foreground">{competencyLabel}</span>
      </p>

      {/* Per-section breakdown */}
      {sectionScores.length > 0 && (
        <div className="w-full space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {isEs ? 'Desglose por seccion' : 'Section breakdown'}
          </h3>
          <div className="space-y-2.5">
            {sectionScores.map((section) => (
              <SectionScoreBar key={section.sectionId} section={section} language={language} />
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {studentFeedback.strengths.length > 0 && (
        <div className="w-full space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {isEs ? 'Fortalezas' : 'Strengths'}
          </h3>
          <ul className="space-y-1.5">
            {studentFeedback.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas to improve */}
      {studentFeedback.areasForImprovement.length > 0 && (
        <div className="w-full space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {isEs ? 'Areas de mejora' : 'Areas to improve'}
          </h3>
          <ul className="space-y-1.5">
            {studentFeedback.areasForImprovement.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ArrowRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Encouragement */}
      {studentFeedback.encouragement && (
        <p className="text-sm text-foreground bg-muted rounded-lg px-4 py-3 w-full italic">
          {studentFeedback.encouragement}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 w-full pt-2">
        {passed && (
          <Button onClick={onContinue} className="w-full">
            <ArrowRight className="h-4 w-4 mr-2" />
            {isEs ? 'Continuar' : 'Continue'}
          </Button>
        )}
        <Button
          variant={passed ? 'outline' : 'default'}
          onClick={onRetry}
          className="w-full"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {isEs ? 'Reintentar examen' : 'Retry test'}
        </Button>
      </div>
    </div>
  );
}
