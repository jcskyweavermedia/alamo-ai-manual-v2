// =============================================================================
// WizardStepLayout — Reusable step layout for wizard flows
// Step indicator, title, description, content area, footer navigation.
// =============================================================================

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';

const STRINGS = {
  en: {
    back: 'Back',
    next: 'Next',
    cancel: 'Cancel',
    buildCourse: 'Build Course',
    building: 'Building...',
    step: 'Step',
    of: 'of',
  },
  es: {
    back: 'Atras',
    next: 'Siguiente',
    cancel: 'Cancelar',
    buildCourse: 'Crear Curso',
    building: 'Creando...',
    step: 'Paso',
    of: 'de',
  },
};

interface WizardStepLayoutProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  description?: string;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  canGoNext: boolean;
  isLastStep?: boolean;
  onBuild?: () => void;
  isBuilding?: boolean;
  language?: 'en' | 'es';
  children: ReactNode;
}

export function WizardStepLayout({
  currentStep,
  totalSteps,
  title,
  description,
  onBack,
  onNext,
  onCancel,
  canGoNext,
  isLastStep = false,
  onBuild,
  isBuilding = false,
  language = 'en',
  children,
}: WizardStepLayoutProps) {
  const t = STRINGS[language];

  return (
    <div className="flex flex-col h-full min-h-0 max-h-[90dvh]">
      {/* Step indicator + header */}
      <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b">
        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2 rounded-full transition-all',
                i === currentStep
                  ? 'w-8 bg-orange-500'
                  : i < currentStep
                    ? 'w-2 bg-orange-500/50'
                    : 'w-2 bg-muted',
              )}
            />
          ))}
        </div>
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider text-center mb-1">
          {t.step} {currentStep + 1} {t.of} {totalSteps}
        </p>
        <h2 className="text-lg font-semibold text-center">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground text-center mt-1">{description}</p>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
        {children}
      </div>

      {/* Footer navigation */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-t bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isBuilding}
        >
          {t.cancel}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={currentStep === 0 || isBuilding}
          >
            {t.back}
          </Button>

          {isLastStep ? (
            <Button
              size="sm"
              onClick={onBuild}
              disabled={!canGoNext || isBuilding}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {isBuilding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {t.building}
                </>
              ) : (
                t.buildCourse
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onNext}
              disabled={!canGoNext}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {t.next}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
