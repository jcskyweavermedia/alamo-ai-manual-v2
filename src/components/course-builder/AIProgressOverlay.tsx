// =============================================================================
// AIProgressOverlay — Semi-transparent overlay during "Build All Content"
// Progress bar, current element title, cancel button.
// =============================================================================

import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const STRINGS = {
  en: {
    building: 'Building Course Content',
    generating: 'Generating',
    cancel: 'Cancel',
    of: 'of',
    elements: 'elements',
  },
  es: {
    building: 'Construyendo Contenido del Curso',
    generating: 'Generando',
    cancel: 'Cancelar',
    of: 'de',
    elements: 'elementos',
  },
};

interface AIProgressOverlayProps {
  isActive: boolean;
  progress: { completed: number; total: number } | null;
  currentElementTitle?: string;
  onCancel: () => void;
  language?: 'en' | 'es';
}

export function AIProgressOverlay({
  isActive,
  progress,
  currentElementTitle,
  onCancel,
  language = 'en',
}: AIProgressOverlayProps) {
  const t = STRINGS[language];

  if (!isActive) return null;

  const pct = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border bg-card p-6 shadow-xl space-y-4">
        {/* Spinner + title */}
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          <h3 className="text-base font-semibold">{t.building}</h3>
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="space-y-2">
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground text-center tabular-nums">
              {progress.completed} {t.of} {progress.total} {t.elements}
            </p>
          </div>
        )}

        {/* Current element */}
        {currentElementTitle && (
          <p className="text-sm text-muted-foreground text-center truncate">
            {t.generating}: <span className="font-medium text-foreground">{currentElementTitle}</span>
          </p>
        )}

        {/* Cancel */}
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            {t.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
