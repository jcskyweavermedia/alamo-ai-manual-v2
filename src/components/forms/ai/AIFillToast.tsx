/**
 * AIFillToast
 *
 * Exports a function to show a toast notification after AI fields are applied.
 * Uses the existing sonner toast system.
 * Shows "Applied N fields" with an undo button. 8 second auto-dismiss.
 */

import { toast } from 'sonner';

const STRINGS = {
  en: {
    applied: (count: number) => `Applied ${count} field${count === 1 ? '' : 's'}`,
    undo: 'Undo',
  },
  es: {
    applied: (count: number) => `${count} campo${count === 1 ? '' : 's'} aplicado${count === 1 ? '' : 's'}`,
    undo: 'Deshacer',
  },
} as const;

export function showAIFillToast(
  count: number,
  language: 'en' | 'es',
  onUndo: () => void,
) {
  const t = STRINGS[language];

  toast.success(t.applied(count), {
    duration: 8000,
    action: {
      label: t.undo,
      onClick: onUndo,
    },
  });
}
