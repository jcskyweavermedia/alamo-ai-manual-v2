/**
 * useFormSubmission Hook — THE CORE HOOK
 *
 * Manages the full lifecycle of a form submission:
 * creation, field editing, auto-save, validation, and submit.
 *
 * Uses useReducer for predictable state transitions.
 * Composes useFormAutosave for debounced draft persistence.
 * Composes useFormValidation for required field checks on submit.
 */

import { useReducer, useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { useFormAutosave } from '@/hooks/use-form-autosave';
import { useFormValidation } from '@/hooks/use-form-validation';
import type {
  FormTemplate,
  FormFieldDefinition,
  FormFieldValues,
  FormFieldValue,
  FormAttachment,
  FormSubmissionStatus,
} from '@/types/forms';

// =============================================================================
// REDUCER STATE & ACTIONS
// =============================================================================

interface SubmissionState {
  submissionId: string | null;
  fieldValues: FormFieldValues;
  attachments: FormAttachment[];
  status: 'idle' | 'draft' | 'completed' | 'submitted';
  templateVersion: number;
  fieldsSnapshot: FormFieldDefinition[] | null;
  notes: string;
}

type SubmissionAction =
  | { type: 'SET_ALL'; payload: Partial<SubmissionState> }
  | { type: 'SET_FIELD'; key: string; value: FormFieldValue }
  | { type: 'SET_FIELDS'; updates: Record<string, FormFieldValue> }
  | { type: 'SET_STATUS'; status: SubmissionState['status'] }
  | { type: 'SET_ATTACHMENTS'; attachments: FormAttachment[] }
  | { type: 'ADD_ATTACHMENT'; attachment: FormAttachment }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'RESET' };

const INITIAL_STATE: SubmissionState = {
  submissionId: null,
  fieldValues: {},
  attachments: [],
  status: 'idle',
  templateVersion: 1,
  fieldsSnapshot: null,
  notes: '',
};

function submissionReducer(state: SubmissionState, action: SubmissionAction): SubmissionState {
  switch (action.type) {
    case 'SET_ALL':
      return { ...state, ...action.payload };

    case 'SET_FIELD':
      return {
        ...state,
        fieldValues: { ...state.fieldValues, [action.key]: action.value },
      };

    case 'SET_FIELDS':
      return {
        ...state,
        fieldValues: { ...state.fieldValues, ...action.updates },
      };

    case 'SET_STATUS':
      return { ...state, status: action.status };

    case 'SET_ATTACHMENTS':
      return { ...state, attachments: action.attachments };

    case 'ADD_ATTACHMENT':
      return { ...state, attachments: [...state.attachments, action.attachment] };

    case 'SET_NOTES':
      return { ...state, notes: action.notes };

    case 'RESET':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

// =============================================================================
// HOOK
// =============================================================================

interface UseFormSubmissionOptions {
  template: FormTemplate | null;
  /** AI session ID to link with this submission (from useAskForm) */
  aiSessionId?: string | null;
}

export function useFormSubmission({ template, aiSessionId }: UseFormSubmissionOptions) {
  const [state, dispatch] = useReducer(submissionReducer, INITIAL_STATE);
  // Store aiSessionId in a ref so the submit callback always gets the latest
  // value without needing it in the dependency array (it changes after the
  // first AI turn, which would otherwise recreate the submit callback).
  const aiSessionIdRef = useRef<string | null | undefined>(aiSessionId);
  aiSessionIdRef.current = aiSessionId;
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { user, permissions } = useAuth();
  const queryClient = useQueryClient();
  const { validateForm } = useFormValidation();

  // Track whether we've initialized for this template
  const initializedTemplateId = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Get group_id from user permissions (needed for INSERT RLS)
  // ---------------------------------------------------------------------------
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  // ---------------------------------------------------------------------------
  // saveDraft — fire-and-forget UPDATE of field_values on the server
  // ---------------------------------------------------------------------------
  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!state.submissionId || !isDirty) return true;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('form_submissions')
        .update({
          field_values: state.fieldValues as unknown as Record<string, unknown>,
          attachments: state.attachments as unknown as Record<string, unknown>[],
          notes: state.notes || null,
        })
        .eq('id', state.submissionId);

      if (error) throw error;

      setIsDirty(false);
      return true;
    } catch (err) {
      console.error('Failed to save draft:', err);
      toast.error('Failed to save draft. Your changes are preserved locally.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [state.submissionId, state.fieldValues, state.attachments, state.notes, isDirty]);

  // ---------------------------------------------------------------------------
  // Auto-save integration (3s debounce, hash tracking)
  // ---------------------------------------------------------------------------
  const { lastSavedAt, saveState } = useFormAutosave({
    fieldValues: state.fieldValues,
    isDirty,
    saveDraft,
  });

  // ---------------------------------------------------------------------------
  // createDraft — INSERT or resume existing draft
  // ---------------------------------------------------------------------------
  const createDraft = useCallback(async (): Promise<string | null> => {
    if (!template || !user || !groupId) {
      toast.error('Unable to create form. Please sign in and try again.');
      return null;
    }

    setIsCreating(true);
    try {
      // Check for existing draft first (resume flow)
      const { data: existingDraft } = await supabase
        .from('form_submissions')
        .select('id, template_id, template_version, field_values, attachments, notes, status, created_at, updated_at')
        .eq('template_id', template.id)
        .eq('filled_by', user.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingDraft) {
        // Resume existing draft
        dispatch({
          type: 'SET_ALL',
          payload: {
            submissionId: existingDraft.id,
            fieldValues: (existingDraft.field_values as unknown as FormFieldValues) ?? {},
            attachments: (existingDraft.attachments as unknown as FormAttachment[]) ?? [],
            notes: (existingDraft.notes as string) ?? '',
            status: 'draft',
            templateVersion: existingDraft.template_version,
            fieldsSnapshot: null,
          },
        });
        initializedTemplateId.current = template.id;
        return existingDraft.id;
      }

      // Build default values for date fields that should auto-fill on creation.
      // Convention: fields with key "date_signed" or date fields whose ai_hint
      // contains "default to today" get today's date (YYYY-MM-DD).
      const defaultValues: FormFieldValues = {};
      const today = new Date().toISOString().split('T')[0];
      for (const field of template.fields) {
        if (field.type !== 'date') continue;
        const hintLower = (field.ai_hint ?? '').toLowerCase();
        if (field.key === 'date_signed' || hintLower.includes('default to today')) {
          defaultValues[field.key] = today;
        }
      }

      // Create new draft
      const { data, error } = await supabase
        .from('form_submissions')
        .insert({
          template_id: template.id,
          group_id: groupId,
          template_version: template.templateVersion,
          field_values: defaultValues as unknown as Record<string, unknown>,
          status: 'draft' as FormSubmissionStatus,
          filled_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      dispatch({
        type: 'SET_ALL',
        payload: {
          submissionId: data.id,
          fieldValues: defaultValues,
          attachments: [],
          notes: '',
          status: 'draft',
          templateVersion: template.templateVersion,
          fieldsSnapshot: null,
        },
      });
      initializedTemplateId.current = template.id;
      return data.id;
    } catch (err) {
      console.error('Failed to create draft:', err);
      toast.error('Failed to create form. Please try again.');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [template, user, groupId]);

  // ---------------------------------------------------------------------------
  // Auto-initialize when template changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (template && user && groupId && initializedTemplateId.current !== template.id) {
      createDraft();
    }
  }, [template?.id, user?.id, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // updateField — single field update
  // ---------------------------------------------------------------------------
  const updateField = useCallback((key: string, value: FormFieldValue) => {
    dispatch({ type: 'SET_FIELD', key, value });
    setIsDirty(true);
    // Clear field-level error on edit
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // updateFields — bulk field update (for AI fill in Phase 3)
  // ---------------------------------------------------------------------------
  const updateFields = useCallback((updates: Record<string, FormFieldValue>) => {
    dispatch({ type: 'SET_FIELDS', updates });
    setIsDirty(true);
    // Clear errors for all updated fields
    setErrors(prev => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(updates)) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // updateNotes
  // ---------------------------------------------------------------------------
  const updateNotes = useCallback((notes: string) => {
    dispatch({ type: 'SET_NOTES', notes });
    setIsDirty(true);
  }, []);

  // ---------------------------------------------------------------------------
  // addAttachment
  // ---------------------------------------------------------------------------
  const addAttachment = useCallback((attachment: FormAttachment) => {
    dispatch({ type: 'ADD_ATTACHMENT', attachment });
    setIsDirty(true);
  }, []);

  // ---------------------------------------------------------------------------
  // validate — check required fields (skip hidden conditional ones)
  // ---------------------------------------------------------------------------
  const validate = useCallback((): Record<string, string> => {
    if (!template) return {};

    const validationErrors = validateForm(
      template.fields,
      state.fieldValues,
      state.fieldValues, // allValues for condition evaluation
    );

    setErrors(validationErrors);
    return validationErrors;
  }, [template, state.fieldValues, validateForm]);

  // ---------------------------------------------------------------------------
  // submit — validate + save + copy fields_snapshot + update status
  // ---------------------------------------------------------------------------
  const submit = useCallback(async (): Promise<boolean> => {
    if (!state.submissionId || !template || !user) {
      toast.error('Unable to submit. Please try again.');
      return false;
    }

    // 1. Validate
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please fill in all required fields.');
      return false;
    }

    setIsSubmitting(true);
    try {
      // 2. Save current field values
      if (isDirty) {
        const saved = await saveDraft();
        if (!saved) {
          setIsSubmitting(false);
          return false;
        }
      }

      // 3. Copy fields_snapshot + update status to submitted
      const updatePayload: Record<string, unknown> = {
        status: 'submitted' as FormSubmissionStatus,
        fields_snapshot: JSON.parse(JSON.stringify(template.fields)),
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        field_values: state.fieldValues as unknown as Record<string, unknown>,
      };
      // Link AI session if one was used during form filling (read from ref for latest value)
      if (aiSessionIdRef.current) {
        updatePayload.ai_session_id = aiSessionIdRef.current;
      }

      const { error } = await supabase
        .from('form_submissions')
        .update(updatePayload)
        .eq('id', state.submissionId)
        .eq('status', 'draft'); // Guard against double-submit

      if (error) throw error;

      dispatch({ type: 'SET_STATUS', status: 'submitted' });
      setIsDirty(false);

      // 4. Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['form-submission'] });
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['my-form-submissions'] });

      return true;
    } catch (err) {
      console.error('Failed to submit form:', err);
      toast.error('Failed to submit form. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [state.submissionId, state.fieldValues, template, user, isDirty, validate, saveDraft, queryClient]);

  // ---------------------------------------------------------------------------
  // reset — clear state (e.g., after successful submission)
  // ---------------------------------------------------------------------------
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setIsDirty(false);
    setErrors({});
    initializedTemplateId.current = null;
  }, []);

  // ---------------------------------------------------------------------------
  // Stale draft detection
  // ---------------------------------------------------------------------------
  const isStaleVersion =
    template !== null &&
    state.templateVersion > 0 &&
    state.templateVersion !== template.templateVersion;

  return {
    // State
    submissionId: state.submissionId,
    fieldValues: state.fieldValues,
    attachments: state.attachments,
    notes: state.notes,
    status: state.status,
    templateVersion: state.templateVersion,
    fieldsSnapshot: state.fieldsSnapshot,

    // Derived state
    isDirty,
    isSaving,
    isSubmitting,
    isCreating,
    isStaleVersion,
    errors,

    // Auto-save state
    lastSavedAt,
    saveState,

    // Actions
    createDraft,
    updateField,
    updateFields,
    updateNotes,
    addAttachment,
    saveDraft,
    validate,
    submit,
    reset,
  };
}
