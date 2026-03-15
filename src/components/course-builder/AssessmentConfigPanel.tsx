// =============================================================================
// AssessmentConfigPanel — Form panel for editing assessment configuration.
// Dispatches SET_ASSESSMENT_CONFIG to update state.assessmentConfig fields.
// Pattern: follows QuizConfigPanel.tsx (bilingual, useCourseBuilder context).
// =============================================================================

import { useCallback } from 'react';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AssessmentConfig } from '@/types/course-builder';

// =============================================================================
// TYPES
// =============================================================================

interface AssessmentConfigPanelProps {
  language: 'en' | 'es';
}

// =============================================================================
// COMPETENCY LEVEL OPTIONS
// =============================================================================

interface CompetencyOption {
  value: AssessmentConfig['passing_competency'];
  labelEn: string;
  labelEs: string;
}

const COMPETENCY_LEVELS: CompetencyOption[] = [
  { value: 'novice', labelEn: 'Novice', labelEs: 'Novato' },
  { value: 'competent', labelEn: 'Competent', labelEs: 'Competente' },
  { value: 'proficient', labelEn: 'Proficient', labelEs: 'Competente Avanzado' },
  { value: 'expert', labelEn: 'Expert', labelEs: 'Experto' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function AssessmentConfigPanel({ language }: AssessmentConfigPanelProps) {
  const { state, dispatch } = useCourseBuilder();
  const config = state.assessmentConfig;
  const isEs = language === 'es';

  const updateConfig = useCallback(
    (updates: Partial<AssessmentConfig>) => {
      dispatch({ type: 'SET_ASSESSMENT_CONFIG', payload: updates });
    },
    [dispatch],
  );

  return (
    <div className="space-y-6">
      {/* Section title */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {isEs ? 'Configuracion de Evaluacion' : 'Assessment Settings'}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isEs
            ? 'Configura los requisitos de evaluacion para completar el curso.'
            : 'Configure evaluation requirements for course completion.'}
        </p>
      </div>

      {/* Require passing evaluation */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">
          {isEs ? 'Requiere evaluacion aprobada' : 'Require passing evaluation'}
        </Label>
        <Switch
          checked={config.require_passing_evaluation}
          onCheckedChange={(checked) =>
            updateConfig({ require_passing_evaluation: checked })
          }
        />
      </div>

      {/* Passing competency level */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {isEs ? 'Nivel de competencia requerido' : 'Passing competency level'}
        </Label>
        <Select
          value={config.passing_competency}
          onValueChange={(value: AssessmentConfig['passing_competency']) =>
            updateConfig({ passing_competency: value })
          }
          disabled={!config.require_passing_evaluation}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPETENCY_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {isEs ? level.labelEs : level.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          {isEs
            ? 'El estudiante debe alcanzar este nivel para aprobar'
            : 'Student must reach this level to pass'}
        </p>
      </div>

      {/* Allow retry */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">
          {isEs ? 'Permitir reintentos' : 'Allow retry'}
        </Label>
        <Switch
          checked={config.allow_retry}
          onCheckedChange={(checked) => updateConfig({ allow_retry: checked })}
          disabled={!config.require_passing_evaluation}
        />
      </div>

      {/* Maximum retries */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="max-retries" className="text-xs font-medium">
            {isEs ? 'Reintentos maximos' : 'Maximum retries'}
          </Label>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {isEs ? 'Ilimitado' : 'Unlimited'}
            </span>
            <Switch
              checked={config.max_retries === null}
              onCheckedChange={(checked) => {
                updateConfig({ max_retries: checked ? null : 3 });
              }}
              disabled={!config.require_passing_evaluation || !config.allow_retry}
            />
          </div>
        </div>
        {config.max_retries !== null && (
          <Input
            id="max-retries"
            type="number"
            min={1}
            max={100}
            value={config.max_retries}
            onChange={(e) => {
              const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 3));
              updateConfig({ max_retries: val });
            }}
            className="h-8 text-sm w-20"
            disabled={!config.require_passing_evaluation || !config.allow_retry}
          />
        )}
      </div>
    </div>
  );
}
