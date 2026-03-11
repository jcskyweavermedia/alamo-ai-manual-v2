// =============================================================================
// AIProgressOverlay — Dual-path: multi-phase overlay (new) vs legacy simple bar
// Shows during "Build Course" (3-pass pipeline) or "Build All Content" (legacy).
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PhaseStepIndicator } from './PhaseStepIndicator';
import { PhaseAnimation } from './PhaseAnimation';
import { RotatingTips } from './RotatingTips';
import type { MultiphaseBuildState } from '@/types/course-builder';

const STRINGS = {
  en: {
    building: 'Building Course Content',
    buildingMulti: 'Building Your Course',
    subtitle: 'Multi-step process',
    generating: 'Generating',
    cancel: 'Cancel',
    confirmTitle: 'Stop building?',
    confirmDesc: "You'll return to the course list. Any progress so far is saved.",
    confirmStop: 'Stop',
    confirmContinue: 'Continue',
    of: 'of',
    elements: 'elements',
    elapsed: 'elapsed',
    error: 'An error occurred',
  },
  es: {
    building: 'Construyendo Contenido del Curso',
    buildingMulti: 'Construyendo Tu Curso',
    subtitle: 'Proceso de múltiples pasos',
    generating: 'Generando',
    cancel: 'Cancelar',
    confirmTitle: '¿Detener la construcción?',
    confirmDesc: 'Volverás a la lista de cursos. El progreso hasta ahora está guardado.',
    confirmStop: 'Detener',
    confirmContinue: 'Continuar',
    of: 'de',
    elements: 'elementos',
    elapsed: 'transcurridos',
    error: 'Ocurrió un error',
  },
};

// --- Legacy overlay props (backward compat) ---
interface LegacyOverlayProps {
  isActive: boolean;
  progress: { completed: number; total: number } | null;
  currentElementTitle?: string;
  onCancel: () => void;
  language?: 'en' | 'es';
}

// --- Multiphase overlay props ---
interface MultiphaseOverlayProps {
  multiphaseState: MultiphaseBuildState;
  onCancel: () => void;
  language?: 'en' | 'es';
}

type AIProgressOverlayProps = LegacyOverlayProps & Partial<MultiphaseOverlayProps>;

export function AIProgressOverlay({
  isActive,
  progress,
  currentElementTitle,
  onCancel,
  language = 'en',
  multiphaseState,
}: AIProgressOverlayProps) {
  // Multi-phase path
  if (multiphaseState?.isActive) {
    return (
      <MultiphaseOverlay
        multiphaseState={multiphaseState}
        onCancel={onCancel}
        language={language}
      />
    );
  }

  // Legacy path
  if (!isActive) return null;

  return (
    <LegacyOverlay
      isActive={isActive}
      progress={progress}
      currentElementTitle={currentElementTitle}
      onCancel={onCancel}
      language={language}
    />
  );
}

// =============================================================================
// LEGACY OVERLAY (unchanged behavior)
// =============================================================================

function LegacyOverlay({ progress, currentElementTitle, onCancel, language = 'en' }: LegacyOverlayProps) {
  const t = STRINGS[language];
  const pct = progress ? Math.round((progress.completed / progress.total) * 100) : 0;
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          <h3 className="text-base font-semibold">{t.building}</h3>
        </div>

        {progress && (
          <div className="space-y-2">
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground text-center tabular-nums">
              {progress.completed} {t.of} {progress.total} {t.elements}
            </p>
          </div>
        )}

        {currentElementTitle && (
          <p className="text-sm text-muted-foreground text-center truncate">
            {t.generating}: <span className="font-medium text-foreground">{currentElementTitle}</span>
          </p>
        )}

        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            {t.cancel}
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.confirmContinue}</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.confirmStop}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// MULTIPHASE OVERLAY (3-pass pipeline)
// =============================================================================

function MultiphaseOverlay({ multiphaseState, onCancel, language = 'en' }: MultiphaseOverlayProps) {
  const t = STRINGS[language];
  const [elapsed, setElapsed] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const startRef = useRef(Date.now());

  // Elapsed timer
  useEffect(() => {
    startRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-close confirmation dialog if an error arrives (so user sees the error message)
  useEffect(() => {
    if (multiphaseState.error) setShowConfirm(false);
  }, [multiphaseState.error]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const elapsedStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const currentPhase = multiphaseState.phases.find(p => p.id === multiphaseState.currentPhaseId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border bg-card p-6 shadow-xl space-y-5">
        {/* Title */}
        <div>
          <h3 className="text-base font-semibold">{t.buildingMulti}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.subtitle} — est. {Math.ceil(multiphaseState.estimatedTotalSeconds / 60)}-{Math.ceil(multiphaseState.estimatedTotalSeconds / 60) + 1} min
          </p>
        </div>

        {/* Phase stepper */}
        <PhaseStepIndicator phases={multiphaseState.phases} />

        {/* Animation area */}
        <PhaseAnimation currentPhase={currentPhase} />

        {/* Error message */}
        {multiphaseState.error && (
          <p className="text-sm text-destructive text-center">
            {t.error}: {multiphaseState.error}
          </p>
        )}

        {/* Elapsed */}
        <p className="text-xs text-muted-foreground text-center tabular-nums">
          {elapsedStr} {t.elapsed}
        </p>

        {/* Rotating tip */}
        <RotatingTips language={language} />

        {/* Cancel */}
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShowConfirm(true)}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            {t.cancel}
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.confirmContinue}</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.confirmStop}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
