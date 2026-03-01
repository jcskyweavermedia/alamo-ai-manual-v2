// =============================================================================
// PreviewModal — Full-screen overlay preview of the form
// Triggered by Eye icon in BuilderTopBar
// Shows LivePreview content at full width with close button
// =============================================================================

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LivePreview } from './LivePreview';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  language: 'en' | 'es';
}

export function PreviewModal({ open, onClose, language }: PreviewModalProps) {
  if (!open) return null;

  const isEn = language === 'en';

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
        <h2 className="text-sm font-semibold">
          {isEn ? 'Form Preview' : 'Vista previa del formulario'}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
          aria-label={isEn ? 'Close preview' : 'Cerrar vista previa'}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto">
          <LivePreview language={language} />
        </div>
      </div>
    </div>
  );
}
