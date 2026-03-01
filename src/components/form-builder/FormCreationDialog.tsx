// =============================================================================
// FormCreationDialog — Choose between blank form and AI Builder
// Simplified: two cards only, no inline AI generation step.
// AI generation now happens in the AIBuilderPanel chat tab.
// =============================================================================

import { FileText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    title: 'Create New Form',
    description: 'Start from scratch or let AI build your form.',
    blankTitle: 'Blank Form',
    blankDesc: 'Start from scratch with an empty canvas.',
    aiTitle: 'Build with AI',
    aiDesc: 'Chat with AI to build your form step by step.',
  },
  es: {
    title: 'Crear Nuevo Formulario',
    description: 'Empieza desde cero o deja que la IA construya tu formulario.',
    blankTitle: 'Formulario en Blanco',
    blankDesc: 'Empieza desde cero con un lienzo vacio.',
    aiTitle: 'Construir con IA',
    aiDesc: 'Chatea con la IA para construir tu formulario paso a paso.',
  },
} as const;

// =============================================================================
// PROPS
// =============================================================================

export interface FormCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: 'en' | 'es';
  onBlank: () => void;
  onAIBuilder: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FormCreationDialog({
  open,
  onOpenChange,
  language,
  onBlank,
  onAIBuilder,
}: FormCreationDialogProps) {
  const t = STRINGS[language];

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBlank = () => {
    handleClose();
    onBlank();
  };

  const handleAIBuilder = () => {
    handleClose();
    onAIBuilder();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Blank Form */}
          <button
            type="button"
            onClick={handleBlank}
            className={cn(
              'flex flex-col items-center gap-3 p-5 rounded-xl border-2',
              'border-transparent hover:border-primary/30',
              'bg-muted/50 hover:bg-muted transition-colors',
              'text-center cursor-pointer',
            )}
          >
            <div className="h-11 w-11 rounded-xl bg-background flex items-center justify-center shadow-sm">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t.blankTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.blankDesc}</p>
            </div>
          </button>

          {/* Build with AI */}
          <button
            type="button"
            onClick={handleAIBuilder}
            className={cn(
              'flex flex-col items-center gap-3 p-5 rounded-xl border-2',
              'border-transparent hover:border-primary/30',
              'bg-primary/5 hover:bg-primary/10 transition-colors',
              'text-center cursor-pointer',
            )}
          >
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t.aiTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.aiDesc}</p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
