// =============================================================================
// QuizQuestionCard — Single MC question with option buttons and feedback.
//
// Adapted from old training/QuizMCQuestion. Same visual pattern:
//   - Full-width button rows with border per option
//   - On answer: correct = green border + bg-green-50 + Check icon
//                incorrect = red border + bg-red-50 + X icon
//   - Feedback banner below: green for correct, amber for incorrect
//   - Shows correct answer text + explanation
//   - Disabled state after answering
//   - Loading spinner on selected option while grading
// =============================================================================

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizQuestionClient, MCAnswerResult } from '@/types/course-player';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    correct: 'Correct!',
    incorrect: 'Incorrect',
    correctAnswer: 'Correct answer: ',
  },
  es: {
    correct: 'Correcto!',
    incorrect: 'Incorrecto',
    correctAnswer: 'Respuesta correcta: ',
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface QuizQuestionCardProps {
  question: QuizQuestionClient;
  onSubmit: (optionId: string) => Promise<void>;
  result?: MCAnswerResult;
  language: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuizQuestionCard({
  question,
  onSubmit,
  result,
  language,
}: QuizQuestionCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lang = language === 'es' ? 'es' : 'en';
  const t = STRINGS[lang];

  const isAnswered = !!result;

  const handleSelect = async (optionId: string) => {
    if (isAnswered || isSubmitting) return;
    setSelectedId(optionId);
    setIsSubmitting(true);
    try {
      await onSubmit(optionId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ---- Question text ---- */}
      <p className="text-base font-medium text-foreground leading-relaxed">
        {question.question}
      </p>

      {/* ---- Option buttons ---- */}
      <div className="space-y-2">
        {question.options?.map((option) => {
          const isSelected = selectedId === option.id;
          const isCorrectOption = result?.correctOptionId === option.id;
          const showAsCorrect = isAnswered && isCorrectOption;
          const showAsWrong = isAnswered && isSelected && !result?.isCorrect;

          return (
            <button
              key={option.id}
              type="button"
              disabled={isAnswered || isSubmitting}
              onClick={() => handleSelect(option.id)}
              className={cn(
                'flex items-center gap-3 w-full min-h-[48px] px-4 py-3 rounded-lg border text-left transition-all duration-200',
                // Default interactive state
                !isAnswered &&
                  !isSubmitting &&
                  'hover:bg-muted active:scale-[0.99] cursor-pointer border-border',
                // Selected + submitting (waiting for grade)
                !isAnswered &&
                  isSelected &&
                  isSubmitting &&
                  'border-primary bg-primary/5',
                // Correct answer highlight
                showAsCorrect &&
                  'border-green-500 bg-green-50 dark:bg-green-950/30',
                // Incorrect answer highlight
                showAsWrong &&
                  'border-red-400 bg-red-50 dark:bg-red-950/30',
                // Dimmed unrelated options after answering
                isAnswered &&
                  !showAsCorrect &&
                  !showAsWrong &&
                  'opacity-50 border-border',
                // Disabled cursor
                (isAnswered || isSubmitting) && 'cursor-default',
              )}
            >
              <span className="flex-1 text-sm">{option.text}</span>
              {isSubmitting && isSelected && (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              )}
              {showAsCorrect && (
                <Check className="h-4 w-4 text-green-600 shrink-0" />
              )}
              {showAsWrong && (
                <X className="h-4 w-4 text-red-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* ---- Feedback banner ---- */}
      {isAnswered && (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300',
            result?.isCorrect
              ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
          )}
        >
          <p className="font-medium mb-1">
            {result?.isCorrect ? t.correct : t.incorrect}
          </p>
          <p>
            {t.correctAnswer}
            {result?.correctOptionText}
          </p>
          {result?.explanation && (
            <p className="mt-1 text-xs opacity-80">{result.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
