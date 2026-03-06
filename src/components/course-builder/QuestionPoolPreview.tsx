// =============================================================================
// QuestionPoolPreview — Expandable card list showing quiz question pool.
// Displays stats bar, difficulty badges, and expandable question cards with
// options (correct highlighted), explanation, and deactivate action.
// =============================================================================

import { useState, useCallback } from 'react';
import {
  CheckCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Trash2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { QuizQuestion, QuizPoolStats } from '@/hooks/use-quiz-pool';

// =============================================================================
// TYPES
// =============================================================================

interface QuestionPoolPreviewProps {
  questions: QuizQuestion[];
  language: 'en' | 'es';
  stats: QuizPoolStats;
  onDeactivate: (questionId: string) => void;
}

// =============================================================================
// DIFFICULTY CONFIG
// =============================================================================

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const DIFFICULTY_LABELS: Record<string, { en: string; es: string }> = {
  easy: { en: 'Easy', es: 'Fácil' },
  medium: { en: 'Medium', es: 'Medio' },
  hard: { en: 'Hard', es: 'Difícil' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function QuestionPoolPreview({
  questions,
  language,
  stats,
  onDeactivate,
}: QuestionPoolPreviewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const isEs = language === 'es';

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Empty state
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <HelpCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          {isEs ? 'No se han generado preguntas aun' : 'No questions generated yet'}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {isEs
            ? 'Usa el boton de arriba para generar el banco de preguntas'
            : 'Use the button above to generate the question pool'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-foreground">
          {stats.total} {isEs ? 'preguntas' : 'questions'}
        </span>
        <span className="text-muted-foreground">--</span>
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', DIFFICULTY_COLORS.easy)}>
          {stats.easy} {isEs ? DIFFICULTY_LABELS.easy.es : DIFFICULTY_LABELS.easy.en}
        </Badge>
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', DIFFICULTY_COLORS.medium)}>
          {stats.medium} {isEs ? DIFFICULTY_LABELS.medium.es : DIFFICULTY_LABELS.medium.en}
        </Badge>
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', DIFFICULTY_COLORS.hard)}>
          {stats.hard} {isEs ? DIFFICULTY_LABELS.hard.es : DIFFICULTY_LABELS.hard.en}
        </Badge>
        {stats.flagged > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 mr-0.5" />
            {stats.flagged} {isEs ? 'marcadas' : 'flagged'}
          </Badge>
        )}
      </div>

      {/* Question cards */}
      <div className="space-y-1.5">
        {questions.map((question) => {
          const isExpanded = expandedIds.has(question.id);
          const questionText = isEs
            ? (question.question_es || question.question_en)
            : question.question_en;
          const explanationText = isEs
            ? (question.explanation_es || question.explanation_en)
            : question.explanation_en;

          return (
            <div
              key={question.id}
              className={cn(
                'rounded-lg border transition-colors duration-150',
                isExpanded
                  ? 'border-border bg-background'
                  : 'border-transparent bg-muted/30 hover:bg-muted/50',
              )}
            >
              {/* Collapsed row */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                onClick={() => toggleExpanded(question.id)}
              >
                {/* Expand chevron */}
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}

                {/* Difficulty badge */}
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0',
                    DIFFICULTY_COLORS[question.difficulty] || DIFFICULTY_COLORS.medium,
                  )}
                >
                  {isEs
                    ? DIFFICULTY_LABELS[question.difficulty]?.es
                    : DIFFICULTY_LABELS[question.difficulty]?.en}
                </span>

                {/* Flagged indicator */}
                {question.auto_flagged && (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}

                {/* Question text (truncated) */}
                <span className="text-sm text-foreground truncate flex-1">
                  {questionText}
                </span>

                {/* Deactivate button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeactivate(question.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/50 mx-3">
                  {/* Full question text */}
                  <p className="text-sm text-foreground leading-relaxed">
                    {questionText}
                  </p>

                  {/* Options */}
                  <div className="space-y-1.5">
                    {(question.options || []).map((opt) => {
                      const optionText = isEs
                        ? (opt.text_es || opt.text_en)
                        : opt.text_en;
                      const isCorrect = opt.correct;

                      return (
                        <div
                          key={opt.id}
                          className={cn(
                            'flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm',
                            isCorrect
                              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                              : 'bg-muted/30 text-foreground',
                          )}
                        >
                          {isCorrect ? (
                            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                          ) : (
                            <Circle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                          )}
                          <span>{optionText}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {explanationText && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-2">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-0.5">
                        {isEs ? 'Explicacion' : 'Explanation'}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                        {explanationText}
                      </p>
                    </div>
                  )}

                  {/* Source element key */}
                  {question.source_element_key && (
                    <p className="text-[11px] text-muted-foreground">
                      {isEs ? 'Fuente' : 'Source'}: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{question.source_element_key}</code>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
