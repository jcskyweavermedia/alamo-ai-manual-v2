// =============================================================================
// QuizModeSelector — Radio cards for quiz mode + basic config (count, passing score)
// Only multiple_choice is active for MVP; others show "Coming Soon".
// =============================================================================

import { cn } from '@/lib/utils';
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
    multiple_choice: 'Opción Múltiple',
    multiple_choiceDesc: 'Cuestionario estándar con preguntas de opción múltiple.',
    voice_response: 'Respuesta por Voz',
    voice_responseDesc: 'Responde preguntas usando entrada de voz.',
    interactive_ai: 'IA Interactiva',
    interactive_aiDesc: 'Cuestionario adaptativo impulsado por IA.',
    mixed: 'Mixto',
    mixedDesc: 'Combinación de todos los modos de cuestionario.',
    comingSoon: 'Próximamente',
    questionCount: 'Número de Preguntas',
    passingScore: 'Puntaje de Aprobación',
  },
};

const MODES: Array<{
  value: QuizMode;
  emoji: string;
  enabled: boolean;
}> = [
  { value: 'multiple_choice', emoji: '✅', enabled: true },
  { value: 'voice_response', emoji: '🎙️', enabled: false },
  { value: 'interactive_ai', emoji: '🤖', enabled: false },
  { value: 'mixed', emoji: '🔀', enabled: false },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={language === 'es' ? 'Modo de evaluación' : 'Assessment mode'}>
        {MODES.map((mode) => {
          const isSelected = quizConfig.quiz_mode === mode.value;
          return (
            <div
              key={mode.value}
              role="radio"
              aria-checked={isSelected}
              tabIndex={mode.enabled ? 0 : -1}
              onClick={() => mode.enabled && onChange({ quiz_mode: mode.value })}
              onKeyDown={(e) => { if (mode.enabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onChange({ quiz_mode: mode.value }); } }}
              className={cn(
                'bg-card rounded-[20px] border shadow-sm p-5 text-left transition-all cursor-pointer',
                !mode.enabled && 'opacity-50 cursor-not-allowed',
                isSelected
                  ? 'ring-2 ring-orange-500 border-orange-200'
                  : mode.enabled
                    ? 'border-black/[0.04] dark:border-white/[0.06] hover:shadow-md'
                    : 'border-black/[0.04] dark:border-white/[0.06]',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" role="img">{mode.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{t[mode.value]}</span>
                    {!mode.enabled && (
                      <span className="text-[9px] font-semibold bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        {t.comingSoon}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-0.5 leading-[1.4]">
                    {t[`${mode.value}Desc` as keyof typeof t]}
                  </p>
                </div>
              </div>
            </div>
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
