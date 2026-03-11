import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, AlertCircle, Printer, Mail, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FormBody } from '@/components/forms/FormBody';
import { ArchiveWizardDialog } from '@/components/forms/ArchiveWizardDialog';
import { buildFormEmail } from '@/lib/form-utils';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition, FormFieldValues, FormSubmissionStatus } from '@/types/forms';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    back: 'Back',
    submittedBy: 'Submitted by',
    subject: 'Subject',
    notFound: 'Submission not found',
    loadError: 'Failed to load',
    print: 'Print',
    email: 'Email',
    archive: 'Archive',
  },
  es: {
    back: 'Volver',
    submittedBy: 'Enviado por',
    subject: 'Sujeto',
    notFound: 'Envío no encontrado',
    loadError: 'Error al cargar',
    print: 'Imprimir',
    email: 'Correo',
    archive: 'Archivar',
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface FilingCabinetViewerProps {
  submissionId: string;
  language: 'en' | 'es';
  onBack: () => void;
}

interface ViewerData {
  templateTitle: string;
  fieldsSnapshot: FormFieldDefinition[];
  fieldValues: FormFieldValues;
  filledByName: string | null;
  subjectName: string | null;
  submittedAt: string | null;
  createdAt: string;
  status: FormSubmissionStatus;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string, language: 'en' | 'es'): string {
  return new Date(dateStr).toLocaleDateString(
    language === 'es' ? 'es' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FilingCabinetViewer({
  submissionId,
  language,
  onBack,
}: FilingCabinetViewerProps) {
  const t = STRINGS[language];

  const [data, setData] = useState<ViewerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Fetch the submission with its parent template
        const { data: row, error: fetchErr } = await supabase
          .from('form_submissions')
          .select('*, form_templates(*)')
          .eq('id', submissionId)
          .single();

        if (cancelled) return;

        if (fetchErr || !row) {
          setError(t.notFound);
          setIsLoading(false);
          return;
        }

        // 2. Resolve filler name from profiles
        let filledByName: string | null = null;
        if (row.filled_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', row.filled_by)
            .single();
          if (!cancelled && profile) {
            filledByName = profile.full_name ?? null;
          }
        }

        // 3. Resolve subject name if present
        let subjectName: string | null = null;
        if (row.subject_user_id) {
          const { data: subjectProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', row.subject_user_id)
            .single();
          if (!cancelled && subjectProfile) {
            subjectName = subjectProfile.full_name ?? null;
          }
        }

        if (cancelled) return;

        // 4. Determine the template title based on language
        const template = row.form_templates as Record<string, unknown> | null;
        const titleEn = (template?.title_en as string) ?? 'Form';
        const titleEs = (template?.title_es as string) ?? null;
        const templateTitle =
          language === 'es' && titleEs ? titleEs : titleEn;

        setData({
          templateTitle,
          fieldsSnapshot: (row.fields_snapshot ?? []) as FormFieldDefinition[],
          fieldValues: (row.field_values ?? {}) as FormFieldValues,
          filledByName,
          subjectName,
          submittedAt: row.submitted_at as string | null,
          createdAt: row.created_at as string,
          status: row.status as FormSubmissionStatus,
        });
      } catch {
        if (!cancelled) {
          setError(t.loadError);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [submissionId, language, t.notFound, t.loadError]);

  // ---------------------------------------------------------------------------
  // ACTION HANDLERS (must be declared before early returns — Rules of Hooks)
  // ---------------------------------------------------------------------------

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleEmail = useCallback(() => {
    if (!data) return;
    const mailto = buildFormEmail(
      data.templateTitle,
      data.fieldsSnapshot,
      data.fieldValues,
      {
        filledByName: data.filledByName,
        subjectName: data.subjectName,
        submittedAt: data.submittedAt,
        createdAt: data.createdAt,
      },
      language,
    );
    window.open(mailto, '_blank');
  }, [data, language]);

  // Archive dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // LOADING STATE
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ERROR STATE
  // ---------------------------------------------------------------------------

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 px-5">
        <AlertCircle className="h-8 w-8 text-destructive/70" />
        <p className="text-sm text-muted-foreground text-center">
          {error ?? t.loadError}
        </p>
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'mt-2 flex items-center gap-1.5',
            'text-sm font-medium text-primary',
            'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.back}
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN RENDER
  // ---------------------------------------------------------------------------

  const displayDate = data.submittedAt ?? data.createdAt;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Compact header */}
      <div className="px-5 pt-4 pb-3 border-b border-border/50 no-print">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label={t.back}
            className={cn(
              'flex items-center justify-center',
              'w-7 h-7 rounded-lg',
              'hover:bg-muted/70 active:scale-95',
              'transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h2 className="text-base font-semibold text-foreground truncate flex-1">
            {data.templateTitle}
          </h2>

          {/* Action buttons */}
          <button
            type="button"
            onClick={handlePrint}
            aria-label={t.print}
            title={t.print}
            className={cn(
              'flex items-center justify-center',
              'w-7 h-7 rounded-lg',
              'hover:bg-muted/70 active:scale-95',
              'transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Printer className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={handleEmail}
            aria-label={t.email}
            title={t.email}
            className={cn(
              'flex items-center justify-center',
              'w-7 h-7 rounded-lg',
              'hover:bg-muted/70 active:scale-95',
              'transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Archive button — only for submitted forms */}
          {data.status === 'submitted' && (
            <button
              type="button"
              onClick={() => setArchiveDialogOpen(true)}
              aria-label={t.archive}
              title={t.archive}
              className={cn(
                'flex items-center justify-center',
                'w-7 h-7 rounded-lg',
                'hover:bg-muted/70 active:scale-95',
                'transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="px-5 py-3 border-b border-border/50 space-y-0.5 print-form-content">
        {data.filledByName && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{t.submittedBy}:</span>{' '}
            {data.filledByName}
          </p>
        )}
        {data.subjectName && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{t.subject}:</span>{' '}
            {data.subjectName}
          </p>
        )}
        <p className="text-xs text-muted-foreground/70">
          {formatDate(displayDate, language)}
        </p>
      </div>

      {/* Form body (read-only, scrollable) */}
      <div className="overflow-y-auto flex-1 px-5 pt-4 print-form-content">
        <FormBody
          fields={data.fieldsSnapshot}
          values={data.fieldValues}
          errors={{}}
          language={language}
          onFieldChange={() => {}}
          readOnly={true}
        />
      </div>

      {/* Archive Wizard Dialog */}
      <ArchiveWizardDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        submissionId={submissionId}
        language={language}
        onArchived={onBack}
      />
    </div>
  );
}
