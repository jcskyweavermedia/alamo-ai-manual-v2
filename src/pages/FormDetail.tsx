import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useFormTemplate } from '@/hooks/use-form-template';
import { useFormSubmission } from '@/hooks/use-form-submission';
import { FormHeader } from '@/components/forms/FormHeader';
import { FormProgressBar } from '@/components/forms/FormProgressBar';
import { FormBody } from '@/components/forms/FormBody';
import { FormFooter } from '@/components/forms/FormFooter';
import { FormSkeleton } from '@/components/forms/FormSkeleton';
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
import type { FormFieldValue } from '@/types/forms';

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
  },
} as const;

// =============================================================================
// FORM DETAIL PAGE
// =============================================================================

const FormDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const t = STRINGS[language];

  // Fetch template by slug
  const { template, isLoading: templateLoading, error: templateError } = useFormTemplate(slug ?? null);

  // ---------------------------------------------------------------------------
  // Core submission hook — draft creation, field updates, auto-save, validation, submit
  // ---------------------------------------------------------------------------
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
    saveDraft,
    validate,
    submit,
  } = useFormSubmission({ template });

  // Local UI state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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
  // ---------------------------------------------------------------------------
  const handleFieldChange = useCallback(
    (key: string, value: FormFieldValue) => {
      updateField(key, value);
    },
    [updateField],
  );

  // ---------------------------------------------------------------------------
  // Submit flow — validate → show confirm dialog → submit via hook
  // ---------------------------------------------------------------------------
  const handleSubmitRequest = useCallback(() => {
    if (!template) return;

    // Validate (uses useFormValidation which skips hidden conditional fields — C5 fix)
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

  return (
    <AppShell language={language} onLanguageChange={setLanguage} showSearch={false}>
      {/* Header — sticky with back button, title, save indicator */}
      <FormHeader
        template={template}
        language={language}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        onBack={handleBack}
      />

      {/* Progress bar — with breathing room below header */}
      <div className="pt-4 pb-2">
        <FormProgressBar fields={template.fields} values={fieldValues} />
      </div>

      {/* Form body — sections and fields */}
      <div className="pt-2">
      <FormBody
        fields={template.fields}
        values={fieldValues}
        errors={errors}
        language={language}
        onFieldChange={handleFieldChange}
      />
      </div>

      {/* Footer — Save Draft + Submit (sticky on mobile) */}
      <FormFooter
        isDirty={isDirty}
        isSaving={isSaving}
        isSubmitting={isSubmitting}
        canSubmit={canSubmit}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmitRequest}
        language={language}
      />

      {/* Bottom spacer on mobile so content is not hidden behind sticky footer + tab bar */}
      <div className="h-32 md:h-0" />

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
    </AppShell>
  );
};

export default FormDetail;
