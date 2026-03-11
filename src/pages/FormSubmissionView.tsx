import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/components/auth';
import { FormBody } from '@/components/forms/FormBody';
import { ArchiveWizardDialog } from '@/components/forms/ArchiveWizardDialog';
import { Button } from '@/components/ui/button';
import type { FormFieldDefinition, FormFieldValues, FormSubmissionStatus } from '@/types/forms';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    submittedBy: 'Submitted by',
    subject: 'Subject',
    submitted: 'Submitted',
    notFound: 'Submission not found',
    back: 'Back to Forms',
    loadError: 'Failed to load submission',
  },
  es: {
    submittedBy: 'Enviado por',
    subject: 'Sujeto',
    submitted: 'Enviado',
    notFound: 'Envio no encontrado',
    back: 'Volver a formularios',
    loadError: 'Error al cargar el envio',
  },
};

// =============================================================================
// DATA TYPES
// =============================================================================

interface SubmissionData {
  id: string;
  templateId: string;
  fieldValues: FormFieldValues;
  fieldsSnapshot: FormFieldDefinition[] | null;
  filledBy: string;
  submittedBy: string | null;
  subjectUserId: string | null;
  submittedAt: string | null;
  createdAt: string;
  templateVersion: number;
  aiSessionId: string | null;
  templateTitle: string;
  templateTitleEs: string | null;
  status: FormSubmissionStatus;
}

// =============================================================================
// COMPONENT
// =============================================================================

function FormSubmissionView() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = STRINGS[language];

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [filledByName, setFilledByName] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // Fetch submission + template metadata
  useEffect(() => {
    if (!submissionId) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('form_submissions')
        .select('*, form_templates(*)')
        .eq('id', submissionId)
        .single();

      if (cancelled) return;

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Not found');
        setIsLoading(false);
        return;
      }

      const template = data.form_templates as Record<string, unknown> | null;

      const mapped: SubmissionData = {
        id: data.id,
        templateId: data.template_id,
        fieldValues: (data.field_values ?? {}) as FormFieldValues,
        fieldsSnapshot: (data.fields_snapshot ?? null) as FormFieldDefinition[] | null,
        filledBy: data.filled_by,
        submittedBy: data.submitted_by ?? null,
        subjectUserId: data.subject_user_id ?? null,
        submittedAt: data.submitted_at ?? null,
        createdAt: data.created_at,
        templateVersion: data.template_version,
        aiSessionId: data.ai_session_id ?? null,
        templateTitle: (template?.title_en as string) ?? 'Form',
        templateTitleEs: (template?.title_es as string) ?? null,
        status: data.status as FormSubmissionStatus,
      };

      setSubmission(mapped);

      // Fetch filler name
      if (mapped.filledBy) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', mapped.filledBy)
          .single();
        if (!cancelled && profile?.full_name) {
          setFilledByName(profile.full_name);
        }
      }

      // Fetch subject name
      if (mapped.subjectUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', mapped.subjectUserId)
          .single();
        if (!cancelled && profile?.full_name) {
          setSubjectName(profile.full_name);
        }
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      language === 'es' ? 'es' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    );
  };

  // Derive title
  const title = submission
    ? (language === 'es' && submission.templateTitleEs
        ? submission.templateTitleEs
        : submission.templateTitle)
    : '';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error || !submission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          {submission === null && !error ? t.notFound : (error ?? t.loadError)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/forms')}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {t.back}
        </Button>
      </div>
    );
  }

  // Resolve fields: prefer frozen snapshot, fall back to empty array
  const fields = submission.fieldsSnapshot ?? [];

  // No-op change handler for read-only mode
  const noop = () => {};

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/forms')}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted/80 transition-colors"
            aria-label={t.back}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-semibold truncate mx-3">{title}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted/80 transition-colors"
              aria-label="Print"
            >
              <Printer className="h-4 w-4" />
            </button>
            {submission.status === 'submitted' && (
              <button
                onClick={() => setArchiveDialogOpen(true)}
                className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted/80 transition-colors"
                aria-label="Archive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Metadata banner */}
        <div className="bg-muted/50 rounded-xl px-4 py-3 space-y-1 text-sm mb-6">
          {filledByName && (
            <div>
              <span className="text-muted-foreground">{t.submittedBy}:</span>{' '}
              <span className="font-medium">{filledByName}</span>
            </div>
          )}
          {subjectName && (
            <div>
              <span className="text-muted-foreground">{t.subject}:</span>{' '}
              <span className="font-medium">{subjectName}</span>
            </div>
          )}
          {submission.submittedAt && (
            <div>
              <span className="text-muted-foreground">{t.submitted}:</span>{' '}
              <span className="font-medium">{formatDate(submission.submittedAt)}</span>
            </div>
          )}
        </div>

        {/* Form body in read-only mode */}
        {fields.length > 0 && (
          <FormBody
            fields={fields}
            values={submission.fieldValues}
            errors={{}}
            language={language}
            onFieldChange={noop}
            readOnly
          />
        )}
      </div>

      {/* Archive Wizard Dialog */}
      {submissionId && (
        <ArchiveWizardDialog
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
          submissionId={submissionId}
          language={language}
          onArchived={() => navigate('/forms')}
        />
      )}
    </div>
  );
}

export default FormSubmissionView;
