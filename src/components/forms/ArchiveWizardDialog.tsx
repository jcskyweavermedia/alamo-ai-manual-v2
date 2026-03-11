// =============================================================================
// ArchiveWizardDialog — captures reason, manager name, and signature before
// archiving a submitted form. Uses existing SignatureFieldInput component.
// =============================================================================

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SignatureFieldInput } from '@/components/forms/fields/SignatureFieldInput';
import type { SignatureValue, FormFieldDefinition } from '@/types/forms';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    title: 'Archive Form',
    description:
      'Submitted forms cannot be deleted. However, you can archive it so it no longer appears in active results.',
    reasonLabel: 'Reason for archiving',
    reasonPlaceholder: 'e.g. Duplicate submission, resolved issue...',
    managerLabel: 'Manager Name',
    managerPlaceholder: 'Full name of authorizing manager',
    signatureLabel: 'Manager Signature',
    cancel: 'Cancel',
    archive: 'Archive',
    archiving: 'Archiving...',
    successToast: 'Form archived',
    errorToast: 'Failed to archive form',
  },
  es: {
    title: 'Archivar Formulario',
    description:
      'Los formularios enviados no se pueden eliminar. Sin embargo, puedes archivarlo para que no aparezca en los resultados activos.',
    reasonLabel: 'Razón para archivar',
    reasonPlaceholder: 'ej. Envío duplicado, problema resuelto...',
    managerLabel: 'Nombre del Gerente',
    managerPlaceholder: 'Nombre completo del gerente autorizante',
    signatureLabel: 'Firma del Gerente',
    cancel: 'Cancelar',
    archive: 'Archivar',
    archiving: 'Archivando...',
    successToast: 'Formulario archivado',
    errorToast: 'Error al archivar formulario',
  },
} as const;

// Synthetic field definition for the reusable SignatureFieldInput
const ARCHIVE_SIGNATURE_FIELD: FormFieldDefinition = {
  key: 'archive_signature',
  label: 'Manager Signature',
  type: 'signature',
  required: true,
  order: 0,
};

// =============================================================================
// PROPS
// =============================================================================

interface ArchiveWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  language: 'en' | 'es';
  onArchived: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ArchiveWizardDialog({
  open,
  onOpenChange,
  submissionId,
  language,
  onArchived,
}: ArchiveWizardDialogProps) {
  const t = STRINGS[language];
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [reason, setReason] = useState('');
  const [managerName, setManagerName] = useState('');
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid =
    reason.trim().length > 0 &&
    managerName.trim().length > 0 &&
    signature !== null;

  const resetForm = useCallback(() => {
    setReason('');
    setManagerName('');
    setSignature(null);
    setIsSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetForm();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm],
  );

  const handleArchive = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from('form_submissions')
      .update({
        status: 'archived' as const,
        archive_reason: reason.trim(),
        archive_manager_name: managerName.trim(),
        archive_signature: signature as unknown as Record<string, unknown>,
        archived_by: user?.id ?? null,
        archived_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (error) {
      toast.error(t.errorToast);
      setIsSubmitting(false);
      return;
    }

    toast.success(t.successToast);
    queryClient.invalidateQueries({ queryKey: ['filing-cabinet-submissions'] });
    resetForm();
    onOpenChange(false);
    onArchived();
  }, [
    isValid,
    isSubmitting,
    reason,
    managerName,
    signature,
    user?.id,
    submissionId,
    t,
    queryClient,
    resetForm,
    onOpenChange,
    onArchived,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="archive-reason">{t.reasonLabel}</Label>
            <Textarea
              id="archive-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.reasonPlaceholder}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Manager Name */}
          <div className="space-y-2">
            <Label htmlFor="archive-manager">{t.managerLabel}</Label>
            <Input
              id="archive-manager"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder={t.managerPlaceholder}
              disabled={isSubmitting}
            />
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <Label>{t.signatureLabel}</Label>
            <SignatureFieldInput
              field={ARCHIVE_SIGNATURE_FIELD}
              value={signature}
              onChange={setSignature}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {t.cancel}
          </Button>
          <Button
            variant="default"
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleArchive}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSubmitting ? t.archiving : t.archive}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
