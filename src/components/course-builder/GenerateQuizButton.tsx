// =============================================================================
// GenerateQuizButton — Primary action button for generating quiz question pool.
// Shows "Generate" or "Regenerate" depending on existing questions.
// Includes confirmation dialog for regeneration.
// =============================================================================

import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import type { UseQuizPool } from '@/hooks/use-quiz-pool';

// =============================================================================
// TYPES
// =============================================================================

interface GenerateQuizButtonProps {
  courseId: string;
  language: 'en' | 'es';
  questionCount: number;
  hasExistingQuestions: boolean;
  hasGeneratedContent: boolean;
  pool: UseQuizPool;
  onGenerated: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function GenerateQuizButton({
  courseId,
  language,
  questionCount,
  hasExistingQuestions,
  hasGeneratedContent,
  pool,
  onGenerated,
}: GenerateQuizButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isEs = language === 'es';

  const handleGenerate = async (forceRegenerate: boolean) => {
    const success = await pool.generatePool(courseId, language, forceRegenerate);
    if (success) {
      onGenerated();
    }
  };

  const handleClick = () => {
    if (hasExistingQuestions) {
      setShowConfirm(true);
    } else {
      void handleGenerate(false);
    }
  };

  const handleConfirmRegenerate = () => {
    setShowConfirm(false);
    void handleGenerate(true);
  };

  // Determine button label and icon
  const isRegenerate = hasExistingQuestions;
  const label = isRegenerate
    ? (isEs ? 'Regenerar preguntas' : 'Regenerate Questions')
    : (isEs ? 'Generar preguntas' : 'Generate Questions');
  const Icon = isRegenerate ? RefreshCw : Sparkles;

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={pool.isGenerating || !hasGeneratedContent}
        className="gap-2"
        size="sm"
      >
        {pool.isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEs ? 'Generando...' : 'Generating...'}
          </>
        ) : (
          <>
            <Icon className="h-4 w-4" />
            {label}
          </>
        )}
      </Button>

      {!hasGeneratedContent && !pool.isGenerating && (
        <p className="text-[11px] text-muted-foreground text-center mt-1">
          {isEs
            ? 'Las secciones necesitan contenido generado primero'
            : 'Sections need generated content first'}
        </p>
      )}

      {/* Regeneration confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEs ? 'Regenerar preguntas?' : 'Regenerate questions?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isEs
                ? `Esto desactivara las ${questionCount} preguntas existentes y generara un nuevo banco de preguntas. Los intentos anteriores de los estudiantes no se veran afectados.`
                : `This will deactivate the existing ${questionCount} questions and generate a new question pool. Previous student attempts will not be affected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {isEs ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRegenerate}>
              {isEs ? 'Regenerar' : 'Regenerate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
