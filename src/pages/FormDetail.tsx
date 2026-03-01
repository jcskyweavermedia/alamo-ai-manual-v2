import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useFormTemplate } from '@/hooks/use-form-template';
import { useFormSubmission } from '@/hooks/use-form-submission';
import { useAskForm } from '@/hooks/use-ask-form';
import { useVoiceRecording } from '@/hooks/use-voice-recording';
import { FormHeader } from '@/components/forms/FormHeader';
import { FormProgressBar } from '@/components/forms/FormProgressBar';
import { FormBody } from '@/components/forms/FormBody';
import { FormToolbar } from '@/components/forms/FormToolbar';
import { FormSkeleton } from '@/components/forms/FormSkeleton';
import { DockedFormAIPanel } from '@/components/forms/DockedFormAIPanel';
import { FormAIContent } from '@/components/forms/FormAIContent';
import { showAIFillToast } from '@/components/forms/ai/AIFillToast';
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
import type { FormFieldValue, SignatureValue, FormPrefillState } from '@/types/forms';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    loadError: 'Failed to load form',
    notFound: 'Form not found',
    backToForms: 'Back to Forms',
    submitConfirmTitle: 'Submit Form?',
    submitConfirmDescription: 'Once submitted, you will not be able to edit this form. Are you sure?',
    submitConfirmCancel: 'Cancel',
    submitConfirmSubmit: 'Submit',
    successTitle: 'Form Submitted',
    successDescription: 'Your form has been submitted successfully.',
    viewSubmission: 'View Submission',
    backToFormsBtn: 'Back to Forms',
    clearConfirmTitle: 'Clear Form?',
    clearConfirmDescription: 'This will erase all fields and AI conversation. This cannot be undone.',
    clearConfirmCancel: 'Cancel',
    clearConfirmClear: 'Clear',
  },
  es: {
    loadError: 'Error al cargar el formulario',
    notFound: 'Formulario no encontrado',
    backToForms: 'Volver a Formularios',
    submitConfirmTitle: 'Enviar Formulario?',
    submitConfirmDescription: 'Una vez enviado, no podras editar este formulario. Estas seguro?',
    submitConfirmCancel: 'Cancelar',
    submitConfirmSubmit: 'Enviar',
    successTitle: 'Formulario Enviado',
    successDescription: 'Tu formulario ha sido enviado exitosamente.',
    viewSubmission: 'Ver Envio',
    backToFormsBtn: 'Volver a Formularios',
    clearConfirmTitle: 'Limpiar Formulario?',
    clearConfirmDescription: 'Esto borrara todos los campos y la conversacion de IA. No se puede deshacer.',
    clearConfirmCancel: 'Cancelar',
    clearConfirmClear: 'Limpiar',
  },
} as const;

// =============================================================================
// DESKTOP BREAKPOINT (matches plan: >= 1024px)
// =============================================================================

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
  );

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

// =============================================================================
// FORM DETAIL PAGE
// =============================================================================

const FormDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const prefillState = location.state as FormPrefillState | null;
  const { language, setLanguage } = useLanguage();
  const t = STRINGS[language];
  const isDesktop = useIsDesktop();

  // Fetch template by slug
  const { template, isLoading: templateLoading, error: templateError } = useFormTemplate(slug ?? null);

  // ---------------------------------------------------------------------------
  // Core submission hook — draft creation, field updates, auto-save, validation, submit
  // We pass aiSessionId as null initially; it gets updated via ref below.
  // ---------------------------------------------------------------------------
  const aiSessionIdRef = useRef<string | null>(null);

  const {
    fieldValues,
    errors,
    isDirty,
    isSaving,
    isSubmitting,
    isCreating,
    lastSavedAt,
    status,
    updateField,
    updateFields,
    saveDraft,
    validate,
    submit,
    reset,
  } = useFormSubmission({ template, aiSessionId: aiSessionIdRef.current });

  // ---------------------------------------------------------------------------
  // AI form filling hook — single instance using current field values.
  // Defined after useFormSubmission so it can read fieldValues.
  // ---------------------------------------------------------------------------
  const aiWithCurrentValues = useAskForm({
    template: template ?? undefined,
    currentValues: fieldValues,
  });

  // Keep aiSessionId ref in sync so useFormSubmission.submit() picks it up
  aiSessionIdRef.current = aiWithCurrentValues.sessionId;

  // ---------------------------------------------------------------------------
  // Pre-fill from chat: auto-open AI panel and send context
  // ---------------------------------------------------------------------------
  const prefillHandledRef = useRef(false);

  useEffect(() => {
    if (
      prefillHandledRef.current ||
      !prefillState?.fromChat ||
      !prefillState.prefillContext ||
      !template
    ) {
      return;
    }

    prefillHandledRef.current = true;

    // Auto-open AI panel
    setAiPanelOpen(true);

    // Auto-send the pre-fill context after a short delay (for animation)
    const timer = setTimeout(() => {
      aiWithCurrentValues.askForm(prefillState.prefillContext);
    }, 300);

    // Clear the location state to prevent re-triggering on refresh
    window.history.replaceState({}, document.title);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillState, template]);

  // ---------------------------------------------------------------------------
  // AI panel state
  // ---------------------------------------------------------------------------
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [aiHighlightedFields, setAiHighlightedFields] = useState<Set<string>>(new Set());
  const [aiMissingFields, setAiMissingFields] = useState<Set<string>>(new Set());
  const undoSnapshotRef = useRef<Record<string, FormFieldValue> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local UI state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Check if AI tools are available for this template
  const hasAiTools = !!(template?.aiTools && template.aiTools.length > 0);

  // ---------------------------------------------------------------------------
  // Shared voice recording — lifted here so floating mic and panel mic share one instance
  // ---------------------------------------------------------------------------
  const heroRecordingRef = useRef(false);
  const inputBarTranscriptionRef = useRef<((text: string) => void) | null>(null);
  const isDesktopRef = useRef(isDesktop);
  isDesktopRef.current = isDesktop;

  const voiceRecording = useVoiceRecording({
    language,
    silenceTimeoutMs: 4000,
    maxRecordingSeconds: 120,
    onTranscription: (text) => {
      if (heroRecordingRef.current) {
        // Hero/toolbar mic: auto-send to AI and switch to chat view
        heroRecordingRef.current = false;
        if (isDesktopRef.current) {
          setAiPanelOpen(true);
        }
        setViewMode('chat');
        aiWithCurrentValues.askForm(text);
      } else {
        // Input bar mic: inject into textarea (desktop panel only)
        inputBarTranscriptionRef.current?.(text);
      }
    },
  });

  const startHeroRecording = useCallback(() => {
    heroRecordingRef.current = true;
    voiceRecording.startRecording();
  }, [voiceRecording]);

  const startInputBarRecording = useCallback(() => {
    heroRecordingRef.current = false;
    voiceRecording.startRecording();
  }, [voiceRecording]);

  const stopRecording = useCallback(() => {
    voiceRecording.stopRecording();
  }, [voiceRecording]);

  const cancelRecording = useCallback(() => {
    heroRecordingRef.current = false;
    voiceRecording.cancelRecording();
  }, [voiceRecording]);

  const registerInputBarTranscription = useCallback((cb: ((text: string) => void) | null) => {
    inputBarTranscriptionRef.current = cb;
  }, []);

  // ---------------------------------------------------------------------------
  // Handle applying AI-extracted fields
  // ---------------------------------------------------------------------------
  const handleApplyAIUpdates = useCallback(
    (updates: Record<string, FormFieldValue>) => {
      const keys = Object.keys(updates);
      if (keys.length === 0) return;

      // Store snapshot for undo
      const snapshot: Record<string, FormFieldValue> = {};
      for (const key of keys) {
        snapshot[key] = fieldValues[key] ?? null;
      }
      undoSnapshotRef.current = snapshot;

      // Apply updates via the submission hook
      updateFields(updates);

      // Set highlighted fields with 2.2s timeout clear
      setAiHighlightedFields(new Set(keys));
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setAiHighlightedFields(new Set());
        highlightTimeoutRef.current = null;
      }, 2200);

      // Set missing fields from the latest AI result
      if (aiWithCurrentValues.result?.missingFields) {
        setAiMissingFields(new Set(aiWithCurrentValues.result.missingFields));
      }

      // Scroll to first updated field (only on desktop where form is visible alongside panel)
      if (isDesktop) {
        const firstKey = keys[0];
        if (firstKey) {
          setTimeout(() => {
            const el = document.querySelector(`[data-field-id="field-${firstKey}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }

      // Show toast with undo
      showAIFillToast(keys.length, language, () => {
        // Undo: restore snapshot
        if (undoSnapshotRef.current) {
          updateFields(undoSnapshotRef.current);
          undoSnapshotRef.current = null;
        }
      });
    },
    [fieldValues, updateFields, aiWithCurrentValues.result, isDesktop, language],
  );

  // ---------------------------------------------------------------------------
  // Clear missing fields when user edits them
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (aiMissingFields.size === 0) return;
    const remaining = new Set<string>();
    for (const key of aiMissingFields) {
      const val = fieldValues[key];
      if (val === undefined || val === null || val === '') {
        remaining.add(key);
      }
    }
    if (remaining.size !== aiMissingFields.size) {
      setAiMissingFields(remaining);
    }
  }, [fieldValues, aiMissingFields]);

  // Clear missing fields when AI panel is closed
  useEffect(() => {
    if (!aiPanelOpen) {
      setAiMissingFields(new Set());
    }
  }, [aiPanelOpen]);

  // Cleanup highlight timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-apply AI field updates (lifted from FormAIContent so it works without panel mounted)
  // ---------------------------------------------------------------------------
  const appliedCountRef = useRef(0);

  useEffect(() => {
    const history = aiWithCurrentValues.conversationHistory;
    const total = history.length;
    if (total <= appliedCountRef.current) return;

    for (let i = appliedCountRef.current; i < total; i++) {
      const turn = history[i];
      if (
        turn.role === 'assistant' &&
        turn.result &&
        Object.keys(turn.result.fieldUpdates).length > 0
      ) {
        handleApplyAIUpdates(turn.result.fieldUpdates);
      }
    }
    appliedCountRef.current = total;
  }, [aiWithCurrentValues.conversationHistory, handleApplyAIUpdates]);

  // Reset applied count when conversation is cleared
  useEffect(() => {
    if (aiWithCurrentValues.conversationHistory.length === 0) {
      appliedCountRef.current = 0;
    }
  }, [aiWithCurrentValues.conversationHistory.length]);

  // ---------------------------------------------------------------------------
  // Clear form handler
  // ---------------------------------------------------------------------------
  const [showClearDialog, setShowClearDialog] = useState(false);

  const handleClearForm = useCallback(() => {
    setShowClearDialog(true);
  }, []);

  const handleConfirmClear = useCallback(() => {
    setShowClearDialog(false);
    reset();
    aiWithCurrentValues.clearConversation();
    appliedCountRef.current = 0;
  }, [reset, aiWithCurrentValues]);

  // ---------------------------------------------------------------------------
  // View mode: form vs chat (mobile uses this to swap content, desktop toggles docked panel)
  // ---------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<'form' | 'chat'>('form');

  const handleViewModeChange = useCallback((mode: 'form' | 'chat') => {
    setViewMode(mode);
    if (isDesktop) {
      setAiPanelOpen(mode === 'chat');
    }
  }, [isDesktop]);

  // Sync: when desktop panel is closed via X button, switch back to 'form'
  useEffect(() => {
    if (isDesktop && !aiPanelOpen && viewMode === 'chat') {
      setViewMode('form');
    }
  }, [isDesktop, aiPanelOpen, viewMode]);

  // ---------------------------------------------------------------------------
  // Warn before unload if dirty (N6)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ---------------------------------------------------------------------------
  // Field change handler (delegates to hook)
  // Also handles auto-timestamp: when a signature field is filled, auto-set
  // the date_signed field (if it exists and is currently empty).
  // ---------------------------------------------------------------------------
  const handleFieldChange = useCallback(
    (key: string, value: FormFieldValue) => {
      updateField(key, value);

      // Auto-timestamp: when a signature is captured, fill date_signed
      if (template && value != null) {
        const fieldDef = template.fields.find((f) => f.key === key);
        if (fieldDef?.type === 'signature' && (value as SignatureValue)?.url) {
          const hasDateSigned = template.fields.some((f) => f.key === 'date_signed' && f.type === 'date');
          const currentDateValue = fieldValues['date_signed'];
          if (hasDateSigned && !currentDateValue) {
            const today = new Date().toISOString().split('T')[0];
            updateField('date_signed', today);
          }
        }
      }
    },
    [updateField, template, fieldValues],
  );

  // ---------------------------------------------------------------------------
  // Submit flow — validate -> show confirm dialog -> submit via hook
  // ---------------------------------------------------------------------------
  const handleSubmitRequest = useCallback(() => {
    if (!template) return;

    // Validate (uses useFormValidation which skips hidden conditional fields -- C5 fix)
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      // Scroll to first error (N7 fix: match data-field-id="field-{key}")
      const firstErrorKey = Object.keys(validationErrors)[0];
      const el = document.querySelector(`[data-field-id="field-${firstErrorKey}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  }, [template, validate]);

  const handleConfirmSubmit = useCallback(async () => {
    setShowConfirmDialog(false);
    await submit();
    // On success, status transitions to 'submitted' via the hook
  }, [submit]);

  // ---------------------------------------------------------------------------
  // Save draft handler (for manual save button)
  // ---------------------------------------------------------------------------
  const handleSaveDraft = useCallback(async () => {
    await saveDraft();
  }, [saveDraft]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const handleBack = useCallback(() => {
    // Auto-save flush on unmount will handle saving
    navigate('/forms');
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Usage info for the AI panel (from the last result)
  // ---------------------------------------------------------------------------
  const aiUsage = aiWithCurrentValues.result?.usage
    ? { used: aiWithCurrentValues.result.usage.dailyUsed, limit: aiWithCurrentValues.result.usage.dailyLimit }
    : null;

  // ---------------------------------------------------------------------------
  // RENDER: Loading state
  // ---------------------------------------------------------------------------

  if (templateLoading || isCreating) {
    return (
      <AppShell language={language} onLanguageChange={setLanguage} showSearch={false}>
        <FormSkeleton />
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Error state
  // ---------------------------------------------------------------------------

  if (templateError || !template) {
    return (
      <AppShell language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-base font-medium text-foreground">
            {templateError ? t.loadError : t.notFound}
          </p>
          <Button variant="outline" onClick={() => navigate('/forms')}>
            {t.backToForms}
          </Button>
        </div>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Success state (after submission)
  // ---------------------------------------------------------------------------

  if (status === 'submitted') {
    return (
      <AppShell language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className={cn(
              'flex items-center justify-center',
              'h-16 w-16 rounded-full',
              'bg-green-100 dark:bg-green-900/30',
              'animate-in zoom-in-50 duration-200',
            )}
          >
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">{t.successTitle}</h2>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {t.successDescription}
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => navigate('/forms')}>
              {t.backToFormsBtn}
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Form fill page
  // ---------------------------------------------------------------------------

  const canSubmit = !isSubmitting && !isSaving;
  const aiDisabled = !hasAiTools || status === 'submitted';

  // True if any field has a non-empty value (for clear button — isDirty resets after auto-save)
  const hasFieldContent = Object.values(fieldValues).some(
    (v) => v !== undefined && v !== null && v !== '',
  );

  // Desktop: render the docked panel via AppShell's aiPanel prop.
  // IMPORTANT: Only pass a truthy value when the panel is actually open,
  // because AppShell always renders the wrapper <aside> when aiPanel is truthy.
  const desktopAIPanel = isDesktop && aiPanelOpen ? (
    <DockedFormAIPanel
      open={aiPanelOpen}
      onClose={() => setAiPanelOpen(false)}
      askForm={aiWithCurrentValues.askForm}
      conversationHistory={aiWithCurrentValues.conversationHistory}
      isLoading={aiWithCurrentValues.isLoading}
      error={aiWithCurrentValues.error}
      onClear={aiWithCurrentValues.clearConversation}
      language={language}
      template={template}
      usage={aiUsage}
      voiceState={voiceRecording}
      onStartHeroRecording={startHeroRecording}
      onStartInputBarRecording={startInputBarRecording}
      onStopRecording={stopRecording}
      onCancelRecording={cancelRecording}
      onRegisterTranscriptionCallback={registerInputBarTranscription}
    />
  ) : null;

  // Back button for AppShell top nav bar (matches DishGuide/Recipes pattern)
  const headerLeft = (
    <button
      type="button"
      onClick={handleBack}
      className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
      title={language === 'es' ? 'Volver a formularios' : 'Back to forms'}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      aiPanel={desktopAIPanel}
      headerLeft={headerLeft}
      overflow="hidden"
    >
      {/* Own scroll container — no ContentArea padding gap */}
      <div className="h-full overflow-y-auto">
        <div className="max-w-reading mx-auto px-4 md:px-6 lg:px-8 pb-24 md:pb-6">
          {/* Header -- sticky with title, clear button, save indicator */}
          <FormHeader
            template={template}
            language={language}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
            onClear={handleClearForm}
            clearDisabled={!hasFieldContent}
          />

          {/* Content area — form fields or AI chat based on viewMode */}
          {(isDesktop || viewMode === 'form') && (
            <>
              {/* Progress bar */}
              <div className="pt-3 pb-2">
                <FormProgressBar fields={template.fields} values={fieldValues} />
              </div>

              {/* Form body -- sections and fields */}
              <div className="pt-2">
                <FormBody
              fields={template.fields}
              values={fieldValues}
              errors={errors}
              language={language}
              onFieldChange={handleFieldChange}
              aiHighlightedFields={aiHighlightedFields}
              aiMissingFields={aiMissingFields}
            />
          </div>
        </>
      )}

      {/* Mobile chat view — inline AI conversation (replaces form body) */}
      {!isDesktop && viewMode === 'chat' && (
        <FormAIContent
          askForm={aiWithCurrentValues.askForm}
          conversationHistory={aiWithCurrentValues.conversationHistory}
          isLoading={aiWithCurrentValues.isLoading}
          error={aiWithCurrentValues.error}
          onClear={aiWithCurrentValues.clearConversation}
          language={language}
          template={template}
          className="h-[calc(100dvh-15rem)]"
          voiceState={voiceRecording}
          onStartHeroRecording={startHeroRecording}
          onStartInputBarRecording={startInputBarRecording}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          onRegisterTranscriptionCallback={registerInputBarTranscription}
        />
      )}

      {/* Bottom spacer on mobile (form mode only — chat fills viewport naturally) */}
      {(isDesktop || viewMode === 'form') && <div className="h-32 md:h-0" />}

        </div>{/* end max-w-reading */}
      </div>{/* end scroll container */}

      {/* Unified floating toolbar — hidden on desktop when docked AI panel is open */}
      {(!isDesktop || !aiPanelOpen) && (
        <FormToolbar
          language={language}
          isRecording={voiceRecording.isRecording}
          isTranscribing={voiceRecording.isTranscribing}
          audioLevel={voiceRecording.audioLevel}
          elapsedSeconds={voiceRecording.elapsedSeconds}
          isWarning={voiceRecording.isWarning}
          onStartRecording={startHeroRecording}
          onStopRecording={stopRecording}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          isDirty={isDirty}
          isSaving={isSaving}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmitRequest}
        />
      )}

      {/* Submit confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.submitConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.submitConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.submitConfirmCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t.submitConfirmSubmit}
                </>
              ) : (
                t.submitConfirmSubmit
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear form confirmation dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.clearConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.clearConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.clearConfirmCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.clearConfirmClear}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default FormDetail;
