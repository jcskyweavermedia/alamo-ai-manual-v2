// =============================================================================
// QuizModeSelector — Radio cards for quiz mode + basic config (count, passing score)
// Only multiple_choice is active for MVP; others show "Coming Soon".
// =============================================================================

import { ListChecks, Mic, Bot, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import type { QuizConfig, QuizMode } from '@/types/course-builder';

const STRINGS = {
  en: {
    multiple_choice: 'Multiple Choice',
    multiple_choiceDesc: 'Standard quiz with multiple choice questions.',
    voice_response: 'Voice Response',
    voice_responseDesc: 'Answer questions using voice input.',
    interactive_ai: 'Interactive AI',
    interactive_aiDesc: 'AI-driven adaptive questioning.',
    mixed: 'Mixed',
    mixedDesc: 'Combination of all quiz modes.',
    comingSoon: 'Coming Soon',
    questionCount: 'Number of Questions',
    passingScore: 'Passing Score',
  },
  es: {
    multiple_choice: 'Opcion Multiple',
    multiple_choiceDesc: 'Cuestionario estandar con preguntas de opcion multiple.',
    voice_response: 'Respuesta por Voz',
    voice_responseDesc: 'Responde preguntas usando entrada de voz.',
    interactive_ai: 'IA Interactiva',
    interactive_aiDesc: 'Cuestionario adaptativo impulsado por IA.',
    mixed: 'Mixto',
    mixedDesc: 'Combinacion de todos los modos de cuestionario.',
    comingSoon: 'Proximamente',
    questionCount: 'Numero de Preguntas',
    passingScore: 'Puntaje de Aprobacion',
  },
};

const MODES: Array<{
  value: QuizMode;
  icon: typeof ListChecks;
  enabled: boolean;
}> = [
  { value: 'multiple_choice', icon: ListChecks, enabled: true },
  { value: 'voice_response', icon: Mic, enabled: false },
  { value: 'interactive_ai', icon: Bot, enabled: false },
  { value: 'mixed', icon: Shuffle, enabled: false },
];

interface QuizModeSelectorProps {
  quizConfig: QuizConfig;
  onChange: (config: Partial<QuizConfig>) => void;
  language?: 'en' | 'es';
}

export function QuizModeSelector({ quizConfig, onChange, language = 'en' }: QuizModeSelectorProps) {
  const t = STRINGS[language];

  return (
    <div className="space-y-5">
      {/* Mode cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = quizConfig.quiz_mode === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              disabled={!mode.enabled}
              onClick={() => mode.enabled && onChange({ quiz_mode: mode.value })}
              className={cn(
                'relative flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                !mode.enabled && 'opacity-50 cursor-not-allowed',
                isSelected
                  ? 'ring-2 ring-primary border-primary bg-primary/5'
                  : mode.enabled
                    ? 'border-border hover:border-primary/40 hover:shadow-sm'
                    : 'border-border',
              )}
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-lg shrink-0 bg-muted text-muted-foreground">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{t[mode.value]}</p>
                  {!mode.enabled && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                      {t.comingSoon}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t[`${mode.value}Desc` as keyof typeof t]}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quiz config fields (only when multiple_choice is selected) */}
      {quizConfig.quiz_mode === 'multiple_choice' && (
        <div className="space-y-4 pt-2 border-t">
          {/* Question count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t.questionCount}</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={quizConfig.question_count}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= 50) {
                    onChange({ question_count: val });
                  }
                }}
                className="h-7 w-16 text-sm text-center"
              />
            </div>
            <Slider
              value={[quizConfig.question_count]}
              onValueChange={([val]) => onChange({ question_count: val })}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          {/* Passing score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t.passingScore}</Label>
              <span className="text-sm font-medium tabular-nums">{quizConfig.passing_score}%</span>
            </div>
            <Slider
              value={[quizConfig.passing_score]}
              onValueChange={([val]) => onChange({ passing_score: val })}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
