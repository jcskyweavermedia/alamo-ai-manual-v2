// =============================================================================
// QuizConfigPanel — Form panel for editing quiz configuration in the builder.
// Dispatches SET_QUIZ_CONFIG to update state.quizConfig fields.
// Pattern: follows CourseBuilderTabBar.tsx (bilingual, useCourseBuilder context).
// =============================================================================

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { QuizConfig, QuizMode } from '@/types/course-builder';

// =============================================================================
// TYPES
// =============================================================================

interface QuizConfigPanelProps {
  language: 'en' | 'es';
}

// =============================================================================
// QUIZ MODE OPTIONS
// =============================================================================

interface ModeOption {
  value: QuizMode;
  labelEn: string;
  labelEs: string;
  available: boolean;
  badgeEn?: string;
  badgeEs?: string;
}

const MODES: ModeOption[] = [
  {
    value: 'multiple_choice',
    labelEn: 'Multiple Choice',
    labelEs: 'Opción Múltiple',
    available: true,
  },
  {
    value: 'voice_response',
    labelEn: 'Voice Response',
    labelEs: 'Respuesta por Voz',
    available: false,
    badgeEn: 'Coming Soon',
    badgeEs: 'Próximamente',
  },
  {
    value: 'interactive_ai',
    labelEn: 'Interactive AI',
    labelEs: 'IA Interactiva',
    available: false,
    badgeEn: 'Coming Soon',
    badgeEs: 'Próximamente',
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function QuizConfigPanel({ language }: QuizConfigPanelProps) {
  const { state, dispatch } = useCourseBuilder();
  const config = state.quizConfig;
  const isEs = language === 'es';

  const updateConfig = useCallback(
    (updates: Partial<QuizConfig>) => {
      dispatch({ type: 'SET_QUIZ_CONFIG', payload: updates });
    },
    [dispatch],
  );

  return (
    <div className="space-y-6">
      {/* Section title */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {isEs ? 'Configuración del Quiz' : 'Quiz Configuration'}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isEs
            ? 'Configura cómo se evaluarán los estudiantes.'
            : 'Configure how students will be assessed.'}
        </p>
      </div>

      {/* Quiz Mode — Radio cards */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">
          {isEs ? 'Modo del Quiz' : 'Quiz Mode'}
        </Label>
        <div className="grid gap-2">
          {MODES.map((mode) => {
            const isSelected = config.quiz_mode === mode.value;
            const label = isEs ? mode.labelEs : mode.labelEn;
            const badge = isEs ? mode.badgeEs : mode.badgeEn;

            return (
              <button
                key={mode.value}
                type="button"
                disabled={!mode.available}
                onClick={() => mode.available && updateConfig({ quiz_mode: mode.value })}
                className={cn(
                  'flex items-center justify-between',
                  'rounded-lg border px-3 py-2 text-left text-sm',
                  'transition-colors duration-150',
                  isSelected
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground',
                  mode.available
                    ? 'cursor-pointer hover:border-primary/50'
                    : 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="font-medium">{label}</span>
                {badge && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Count */}
      <div className="space-y-1.5">
        <Label htmlFor="question-count" className="text-xs font-medium">
          {isEs ? 'Preguntas por intento' : 'Questions per attempt'}
        </Label>
        <Input
          id="question-count"
          type="number"
          min={5}
          max={50}
          value={config.question_count}
          onChange={(e) => {
            const val = Math.max(5, Math.min(50, parseInt(e.target.value) || 10));
            updateConfig({ question_count: val });
          }}
          className="h-8 text-sm"
        />
      </div>

      {/* Pool Size */}
      <div className="space-y-1.5">
        <Label htmlFor="pool-size" className="text-xs font-medium">
          {isEs ? 'Banco total de preguntas' : 'Total question pool'}
        </Label>
        <Input
          id="pool-size"
          type="number"
          min={10}
          max={100}
          value={config.question_pool_size}
          onChange={(e) => {
            const val = Math.max(10, Math.min(100, parseInt(e.target.value) || 30));
            updateConfig({ question_pool_size: val });
          }}
          className="h-8 text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          {isEs
            ? 'Genera mas preguntas de las necesarias para mayor variedad'
            : 'Generate more questions than needed for variety'}
        </p>
      </div>

      {/* Passing Score */}
      <div className="space-y-1.5">
        <Label htmlFor="passing-score" className="text-xs font-medium">
          {isEs ? 'Puntuacion para aprobar' : 'Passing score'}
        </Label>
        <div className="flex items-center gap-1.5">
          <Input
            id="passing-score"
            type="number"
            min={50}
            max={100}
            value={config.passing_score}
            onChange={(e) => {
              const val = Math.max(50, Math.min(100, parseInt(e.target.value) || 70));
              updateConfig({ passing_score: val });
            }}
            className="h-8 text-sm w-20"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      {/* Max Attempts */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="max-attempts" className="text-xs font-medium">
            {isEs ? 'Intentos maximos' : 'Max attempts'}
          </Label>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {isEs ? 'Ilimitado' : 'Unlimited'}
            </span>
            <Switch
              checked={config.max_attempts === null}
              onCheckedChange={(checked) => {
                updateConfig({ max_attempts: checked ? null : 3 });
              }}
            />
          </div>
        </div>
        {config.max_attempts !== null && (
          <Input
            id="max-attempts"
            type="number"
            min={1}
            max={100}
            value={config.max_attempts}
            onChange={(e) => {
              const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 3));
              updateConfig({ max_attempts: val });
            }}
            className="h-8 text-sm w-20"
          />
        )}
      </div>

      {/* Cooldown */}
      <div className="space-y-1.5">
        <Label htmlFor="cooldown" className="text-xs font-medium">
          {isEs ? 'Tiempo de espera (minutos)' : 'Cooldown (minutes)'}
        </Label>
        <Input
          id="cooldown"
          type="number"
          min={0}
          max={1440}
          value={config.cooldown_minutes}
          onChange={(e) => {
            const val = Math.max(0, Math.min(1440, parseInt(e.target.value) || 0));
            updateConfig({ cooldown_minutes: val });
          }}
          className="h-8 text-sm w-24"
        />
        <p className="text-[11px] text-muted-foreground">
          {isEs ? '0 = sin tiempo de espera' : '0 = no cooldown'}
        </p>
      </div>

      {/* Toggle switches */}
      <div className="space-y-3 pt-1">
        {/* Shuffle Questions */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            {isEs ? 'Mezclar preguntas' : 'Shuffle questions'}
          </Label>
          <Switch
            checked={config.shuffle_questions}
            onCheckedChange={(checked) => updateConfig({ shuffle_questions: checked })}
          />
        </div>

        {/* Shuffle Options */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            {isEs ? 'Mezclar opciones' : 'Shuffle options'}
          </Label>
          <Switch
            checked={config.shuffle_options}
            onCheckedChange={(checked) => updateConfig({ shuffle_options: checked })}
          />
        </div>

        {/* Show Feedback Immediately */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            {isEs ? 'Mostrar retroalimentacion inmediata' : 'Show feedback immediately'}
          </Label>
          <Switch
            checked={config.show_feedback_immediately}
            onCheckedChange={(checked) => updateConfig({ show_feedback_immediately: checked })}
          />
        </div>
      </div>
    </div>
  );
}
