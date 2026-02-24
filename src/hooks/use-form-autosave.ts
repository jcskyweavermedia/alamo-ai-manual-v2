/**
 * useFormAutosave Hook
 *
 * Debounced 3-second auto-save with hash tracking to skip redundant saves.
 * Flushes on unmount to prevent data loss.
 *
 * Returns { lastSavedAt, saveState } for UI indicators.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FormFieldValues } from '@/types/forms';

// =============================================================================
// TYPES
// =============================================================================

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

interface UseFormAutosaveOptions {
  /** Current field values to watch for changes */
  fieldValues: FormFieldValues;
  /** Whether the form has unsaved changes */
  isDirty: boolean;
  /** The save function to call (should handle its own error toasts) */
  saveDraft: () => Promise<boolean>;
  /** Debounce delay in milliseconds (default: 3000) */
  debounceMs?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Fast hash of field values for change detection.
 * Uses JSON.stringify — sufficient for small-medium JSONB objects.
 */
function hashValues(values: FormFieldValues): string {
  try {
    return JSON.stringify(values);
  } catch {
    return '';
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useFormAutosave({
  fieldValues,
  isDirty,
  saveDraft,
  debounceMs = 3000,
}: UseFormAutosaveOptions) {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveState, setSaveState] = useState<AutosaveState>('idle');

  // Track last saved hash to skip redundant saves
  const lastSavedHash = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Keep saveDraft ref up to date without re-triggering effects
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  // ---------------------------------------------------------------------------
  // Perform save with state tracking
  // ---------------------------------------------------------------------------
  const performSave = useCallback(async (values: FormFieldValues) => {
    const currentHash = hashValues(values);

    // Skip if nothing changed since last save
    if (currentHash === lastSavedHash.current) return;

    setSaveState('saving');

    const success = await saveDraftRef.current();

    if (!isMountedRef.current) return;

    if (success) {
      lastSavedHash.current = currentHash;
      setLastSavedAt(new Date());
      setSaveState('saved');

      // Reset to idle after 3s
      setTimeout(() => {
        if (isMountedRef.current) {
          setSaveState('idle');
        }
      }, 3000);
    } else {
      setSaveState('error');
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Debounced auto-save effect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isDirty) return;

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set new debounced timer
    timerRef.current = setTimeout(() => {
      performSave(fieldValues);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fieldValues, isDirty, debounceMs, performSave]);

  // ---------------------------------------------------------------------------
  // Flush on unmount — save immediately if dirty
  // ---------------------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Flush save if dirty (fire-and-forget — component is unmounting)
      saveDraftRef.current();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    lastSavedAt,
    saveState,
  };
}
