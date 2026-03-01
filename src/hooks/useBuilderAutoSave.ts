// =============================================================================
// useBuilderAutoSave Hook — Serial Save Queue + Optimistic Concurrency
//
// R20 (auto-save race conditions) mitigation:
//   1. Serial queue: never fire a new save while one is in-flight
//   2. Queue the latest state, flush after in-flight completes
//   3. 3-second debounce on state changes
//   4. Optimistic concurrency via updated_at check
//   5. Exponential backoff on transient errors (3s, 6s, 12s, max 3 retries)
//   6. Conflict detection with user-facing warning
//
// Integration:
//   Accepts templateId + state from BuilderContext.
//   Returns { saveStatus, lastSavedAt, forceSave, conflictDetected }.
//   Dispatches SAVE_START / SAVE_SUCCESS / SAVE_ERROR to the builder reducer.
// =============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { BuilderState, BuilderAction, SaveStatus } from '@/types/form-builder';
import type { UpdateResult } from '@/hooks/useFormBuilder';

// =============================================================================
// TYPES
// =============================================================================

interface UseBuilderAutoSaveOptions {
  /** Current template ID (null = new unsaved template, skip auto-save). */
  templateId: string | null;
  /** Full builder state — used to extract saveable fields. */
  state: BuilderState;
  /** The builder dispatch function for save lifecycle actions. */
  dispatch: React.Dispatch<BuilderAction>;
  /** The updateTemplate function from useFormBuilder. */
  updateTemplate: (
    templateId: string,
    updates: Record<string, unknown>,
    expectedUpdatedAt: string | null,
  ) => Promise<UpdateResult>;
  /** Debounce delay in milliseconds (default: 3000). */
  debounceMs?: number;
  /** Whether auto-save is enabled (default: true). Disable during drag. */
  enabled?: boolean;
}

export interface UseBuilderAutoSaveReturn {
  /** Current save status for UI display. */
  saveStatus: SaveStatus;
  /** Timestamp of the last successful save. */
  lastSavedAt: Date | null;
  /** Force an immediate save, bypassing debounce. */
  forceSave: () => Promise<void>;
  /** Whether a concurrency conflict was detected. */
  conflictDetected: boolean;
  /** Reset the conflict flag (e.g., after the user reloads). */
  clearConflict: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_DEBOUNCE_MS = 3000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 3000;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract the saveable payload from BuilderState.
 * Only includes DB-persisted template fields (not UI state).
 */
function buildSavePayload(state: BuilderState): Record<string, unknown> {
  return {
    titleEn: state.titleEn,
    titleEs: state.titleEs || undefined,
    descriptionEn: state.descriptionEn || undefined,
    descriptionEs: state.descriptionEs || undefined,
    slug: state.slug,
    icon: state.icon,
    fields: state.fields,
    instructionsEn: state.instructionsEn || undefined,
    instructionsEs: state.instructionsEs || undefined,
    aiTools: state.aiTools,
  };
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// HOOK
// =============================================================================

export function useBuilderAutoSave({
  templateId,
  state,
  dispatch,
  updateTemplate,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  enabled = true,
}: UseBuilderAutoSaveOptions): UseBuilderAutoSaveReturn {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [conflictDetected, setConflictDetected] = useState(false);

  // --- Refs for serial queue management ---

  /** Whether a save is currently in-flight. */
  const isInFlightRef = useRef(false);

  /** The queued state to save after the current in-flight save completes. */
  const queuedStateRef = useRef<BuilderState | null>(null);

  /** The debounce timer handle. */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Whether the component is still mounted. */
  const isMountedRef = useRef(true);

  /** The latest serverUpdatedAt from the BuilderState. */
  const serverUpdatedAtRef = useRef<string | null>(state.serverUpdatedAt);

  // Keep the ref in sync with state
  useEffect(() => {
    serverUpdatedAtRef.current = state.serverUpdatedAt;
  }, [state.serverUpdatedAt]);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // CORE SAVE (serial queue + retry + conflict detection)
  // ---------------------------------------------------------------------------

  const performSave = useCallback(
    async (stateToSave: BuilderState): Promise<void> => {
      if (!templateId) return;
      if (isInFlightRef.current) {
        // A save is already in-flight — queue this state for later
        queuedStateRef.current = stateToSave;
        return;
      }

      isInFlightRef.current = true;
      dispatch({ type: 'SAVE_START' });
      if (isMountedRef.current) setSaveStatus('saving');

      const payload = buildSavePayload(stateToSave);
      let retryCount = 0;
      let lastError: Error | null = null;

      while (retryCount <= MAX_RETRIES) {
        try {
          const result = await updateTemplate(
            templateId,
            payload,
            serverUpdatedAtRef.current,
          );

          if (result.conflict) {
            // Concurrency conflict: another user saved since we loaded
            if (isMountedRef.current) {
              setConflictDetected(true);
              setSaveStatus('error');
              toast.error(
                'This template was modified by another user. Please reload to see the latest version.',
                { duration: 8000 },
              );
            }
            dispatch({ type: 'SAVE_ERROR', payload: { error: 'Concurrency conflict' } });
            break;
          }

          if (result.success && result.serverUpdatedAt) {
            // Success: update the tracked serverUpdatedAt
            serverUpdatedAtRef.current = result.serverUpdatedAt;
            dispatch({
              type: 'SAVE_SUCCESS',
              payload: { updatedAt: result.serverUpdatedAt },
            });
            if (isMountedRef.current) {
              setLastSavedAt(new Date());
              setSaveStatus('saved');
            }
            break;
          }

          // Unexpected: not conflict, not success — treat as error
          throw new Error('Update returned unexpected result');
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          retryCount++;

          if (retryCount > MAX_RETRIES) {
            // Exhausted retries
            console.error('[useBuilderAutoSave] Save failed after retries:', lastError);
            dispatch({ type: 'SAVE_ERROR', payload: { error: lastError.message } });
            if (isMountedRef.current) {
              setSaveStatus('error');
              toast.error('Save failed. Your changes may not be saved.', {
                duration: 5000,
              });
            }
            break;
          }

          // Exponential backoff: 3s, 6s, 12s
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
          console.warn(
            `[useBuilderAutoSave] Save failed, retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`,
            lastError,
          );
          if (isMountedRef.current) {
            toast.warning(`Save failed. Retrying...`, { duration: delay });
          }
          await sleep(delay);
        }
      }

      isInFlightRef.current = false;

      // Drain the queue: if another state was queued while we were saving, flush it
      if (queuedStateRef.current) {
        const nextState = queuedStateRef.current;
        queuedStateRef.current = null;
        // Use void to fire the next save without awaiting in the queue drain
        void performSave(nextState);
      }
    },
    [templateId, dispatch, updateTemplate],
  );

  // ---------------------------------------------------------------------------
  // DEBOUNCED AUTO-SAVE EFFECT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Skip auto-save if disabled, no template, not dirty, or already saving
    if (!enabled || !templateId || !state.isDirty || state.isSaving || conflictDetected) {
      return;
    }

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Start debounce timer
    debounceTimerRef.current = setTimeout(() => {
      void performSave(state);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // We intentionally track specific state slices that represent data changes,
    // not the entire state object, to avoid re-triggering on UI-only changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    templateId,
    state.isDirty,
    state.isSaving,
    state.fields,
    state.titleEn,
    state.titleEs,
    state.descriptionEn,
    state.descriptionEs,
    state.slug,
    state.icon,
    state.instructionsEn,
    state.instructionsEs,
    state.aiTools,
    conflictDetected,
    debounceMs,
    performSave,
  ]);

  // ---------------------------------------------------------------------------
  // FLUSH ON UNMOUNT — save immediately if dirty
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Note: We do NOT flush on unmount because the save function depends on
      // updateTemplate which may no longer be valid after unmount. The
      // BuilderContext's own unmount handler can handle this if needed.
    };
  }, []);

  // ---------------------------------------------------------------------------
  // FORCE SAVE — immediate save bypassing debounce
  // ---------------------------------------------------------------------------

  const forceSave = useCallback(async (): Promise<void> => {
    if (!templateId || !state.isDirty || conflictDetected) return;

    // Cancel any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    await performSave(state);
  }, [templateId, state, conflictDetected, performSave]);

  // ---------------------------------------------------------------------------
  // CLEAR CONFLICT
  // ---------------------------------------------------------------------------

  const clearConflict = useCallback(() => {
    setConflictDetected(false);
  }, []);

  // ---------------------------------------------------------------------------
  // TRACK SAVE STATUS FROM BUILDER STATE
  // ---------------------------------------------------------------------------

  // Sync local saveStatus with the BuilderState saveStatus for consistency
  useEffect(() => {
    if (state.saveStatus === 'unsaved' && saveStatus === 'saved') {
      setSaveStatus('unsaved');
    }
  }, [state.saveStatus, saveStatus]);

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    saveStatus,
    lastSavedAt,
    forceSave,
    conflictDetected,
    clearConflict,
  };
}
