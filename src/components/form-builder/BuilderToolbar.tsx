// =============================================================================
// BuilderToolbar — Mobile-only frosted-glass floating toolbar
//
// Renders at the bottom of the screen on mobile (< 1024px) with:
// - "Add Field" button (primary action)
// - "Publish" or "Save Draft" button
//
// Positioning: fixed bottom, above MobileTabBar (bottom-[72px])
// Glass effect: bg-muted/90 backdrop-blur-md
// Only visible on mobile via CSS (hidden on lg+)
// =============================================================================

import { useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilder } from '@/contexts/BuilderContext';
import { Button } from '@/components/ui/button';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    addField: 'Add Field',
    publish: 'Publish',
    publishChanges: 'Publish Changes',
    saveDraft: 'Save Draft',
    saving: 'Saving...',
  },
  es: {
    addField: 'Agregar Campo',
    publish: 'Publicar',
    publishChanges: 'Publicar Cambios',
    saveDraft: 'Guardar',
    saving: 'Guardando...',
  },
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

interface BuilderToolbarProps {
  language: 'en' | 'es';
  onAddField: () => void;
}

export function BuilderToolbar({ language, onAddField }: BuilderToolbarProps) {
  const { state, dispatch, saveDraft } = useBuilder();
  const t = STRINGS[language];

  const handlePublish = useCallback(() => {
    // Publish is handled by parent page logic in a later sprint;
    // for now, dispatch status change
    dispatch({ type: 'SET_STATUS', payload: 'published' });
  }, [dispatch]);

  const handleSaveOrPublish = useCallback(() => {
    if (state.status === 'draft') {
      handlePublish();
    } else if (state.hasUnpublishedChanges) {
      handlePublish();
    } else {
      void saveDraft();
    }
  }, [state.status, state.hasUnpublishedChanges, handlePublish, saveDraft]);

  // Determine the right-side button label and action
  const rightButtonLabel = (() => {
    if (state.isSaving) return t.saving;
    if (state.status === 'draft') return t.publish;
    if (state.hasUnpublishedChanges) return t.publishChanges;
    return t.saveDraft;
  })();

  const isRightDisabled = state.isSaving;

  return (
    <div
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
        'flex items-center gap-3 px-4 py-3',
        // Safe area padding for notch devices
        'pb-[max(12px,env(safe-area-inset-bottom))]',
      )}
    >
      {/* ---- ADD FIELD BUTTON ---- */}
      <Button
        variant="outline"
        onClick={onAddField}
        className={cn(
          'flex-1 h-11 gap-2',
          'rounded-[12px]',
          'font-semibold text-sm',
        )}
      >
        <Plus className="h-4 w-4" />
        {t.addField}
      </Button>

      {/* ---- PUBLISH / SAVE BUTTON ---- */}
      <Button
        onClick={handleSaveOrPublish}
        disabled={isRightDisabled}
        className={cn(
          'flex-1 h-11',
          'rounded-[12px]',
          'font-semibold text-sm',
          state.hasUnpublishedChanges && 'bg-orange-500 hover:bg-orange-600',
        )}
      >
        {state.isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
        {rightButtonLabel}
      </Button>
    </div>
  );
}
