import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizQuestionClient, MCAnswerResult } from '@/types/training';

interface QuizMCQuestionProps {
  question: QuizQuestionClient;
  onSubmit: (optionId: string) => Promise<void>;
  result?: MCAnswerResult;
  language: 'en' | 'es';
}

export function QuizMCQuestion({
  question,
  onSubmit,
  result,
  language,
}: QuizMCQuestionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <p className="text-base font-medium text-foreground leading-relaxed">
        {question.question}
      </p>

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
                !isAnswered && !isSubmitting &&
                  'hover:bg-muted active:scale-[0.99] cursor-pointer border-border',
                !isAnswered && isSelected && isSubmitting &&
                  'border-primary bg-primary/5',
                showAsCorrect &&
                  'border-green-500 bg-green-50 dark:bg-green-950/30',
                showAsWrong &&
                  'border-red-400 bg-red-50 dark:bg-red-950/30',
                isAnswered && !showAsCorrect && !showAsWrong &&
                  'opacity-50 border-border',
                (isAnswered || isSubmitting) && 'cursor-default'
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

      {isAnswered && (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300',
            result?.isCorrect
              ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
          )}
        >
          <p className="font-medium mb-1">
            {result?.isCorrect
              ? language === 'es' ? 'Correcto!' : 'Correct!'
              : language === 'es' ? 'Incorrecto' : 'Incorrect'}
          </p>
          <p>
            {language === 'es' ? 'Respuesta correcta: ' : 'Correct answer: '}
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
