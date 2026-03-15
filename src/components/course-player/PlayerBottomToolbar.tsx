// =============================================================================
// PlayerBottomToolbar — Fixed bottom toolbar for course section navigation.
//
// Mobile-only (lg:hidden), positioned above MobileTabBar (bottom-[72px]).
// Frosted glass effect matching BuilderToolbar pattern.
//
// Left:   Previous section button
// Center: "Section X of Y" indicator
// Right:  Next section button OR "Complete Course" on last section
// =============================================================================

import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    previous: 'Previous',
    next: 'Next',
    completeCourse: 'Complete Course',
    sectionOf: (current: number, total: number) =>
      `Section ${current} of ${total}`,
    completeQuiz: 'Complete quiz to continue',
  },
  es: {
    previous: 'Anterior',
    next: 'Siguiente',
    completeCourse: 'Completar Curso',
    sectionOf: (current: number, total: number) =>
      `Secci\u00f3n ${current} de ${total}`,
    completeQuiz: 'Completa el quiz para continuar',
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface PlayerBottomToolbarProps {
  activeSectionIndex: number;
  totalSections: number;
  onPrev: () => void;
  onNext: () => void;
  onComplete: () => void;
  isLastSection: boolean;
  language: 'en' | 'es';
  quizRequired?: boolean;
  quizPassed?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PlayerBottomToolbar({
  activeSectionIndex,
  totalSections,
  onPrev,
  onNext,
  onComplete,
  isLastSection,
  language,
  quizRequired,
  quizPassed,
}: PlayerBottomToolbarProps) {
  const t = STRINGS[language];
  const isFirst = activeSectionIndex === 0;

  // When quiz is required but not yet passed, disable forward navigation
  const quizBlocking = quizRequired === true && quizPassed !== true;

  return (
    <div
      data-player-toolbar
      className={cn(
        // Only visible on mobile (hidden on lg+)
        'lg:hidden',
        // Fixed bottom positioning, above MobileTabBar
        'fixed bottom-[72px] left-0 right-0 z-20',
        // Frosted glass effect
        'bg-muted/90 backdrop-blur-md',
        // Shadow for visual separation
        'shadow-[0_-2px_16px_rgba(0,0,0,0.1)]',
        // Border top
        'border-t border-black/[0.04] dark:border-white/[0.06]',
        // Layout
        'flex items-center justify-between px-4 py-3',
        // Safe area padding for notch devices
        'pb-[max(12px,env(safe-area-inset-bottom))]',
      )}
    >
      {/* ---- PREVIOUS BUTTON ---- */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onPrev}
        disabled={isFirst}
        className="gap-1 text-sm font-medium"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.previous}
      </Button>

      {/* ---- CENTER INDICATOR ---- */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t.sectionOf(activeSectionIndex + 1, totalSections)}
        </span>
        {quizBlocking && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            {t.completeQuiz}
          </span>
        )}
      </div>

      {/* ---- NEXT / COMPLETE BUTTON ---- */}
      {isLastSection ? (
        <Button
          size="sm"
          onClick={onComplete}
          disabled={quizBlocking}
          className={cn(
            'gap-1 text-sm font-medium',
            quizBlocking
              ? 'opacity-50'
              : 'bg-green-600 hover:bg-green-700 text-white',
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          {t.completeCourse}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={quizBlocking}
          className={cn(
            'gap-1 text-sm font-medium',
            quizBlocking && 'opacity-50',
          )}
        >
          {t.next}
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
