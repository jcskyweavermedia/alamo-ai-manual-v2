// =============================================================================
// SignatureFieldInput — react-signature-canvas based signature pad
// Full-width canvas h-[160px], touch-action:none
// Clear + Confirm buttons. After confirm: preview image + Re-sign
// Value: SignatureValue (contains base64 data URL)
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition, SignatureValue } from '@/types/forms';

interface SignatureFieldInputProps {
  field: FormFieldDefinition;
  value: SignatureValue | null;
  onChange: (value: SignatureValue | null) => void;
  disabled?: boolean;
  error?: string;
}

export function SignatureFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: SignatureFieldInputProps) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const fieldId = `field-${field.key}`;

  const handleClear = useCallback(() => {
    sigRef.current?.clear();
    setIsEmpty(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;

    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
    onChange({
      url: dataUrl,
      signed_at: new Date().toISOString(),
      signed_by: '', // Filled by the submission hook with current user
    });
  }, [onChange]);

  const handleReSign = useCallback(() => {
    onChange(null);
    setIsEmpty(true);
  }, [onChange]);

  const handleEnd = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setIsEmpty(false);
    }
  }, []);

  // Show preview if signature has been confirmed
  if (value?.url) {
    return (
      <div className="space-y-2">
        <div
          className={cn(
            'w-full h-[160px] rounded-lg border bg-card flex items-center justify-center',
            error && 'border-destructive'
          )}
        >
          <img
            src={value.url}
            alt="Signature"
            className="max-w-full max-h-full object-contain p-2"
          />
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReSign}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Re-sign
          </Button>
        )}
      </div>
    );
  }

  // Show canvas for drawing
  return (
    <div className="space-y-2">
      <div
        className={cn(
          'w-full h-[160px] rounded-lg border bg-card overflow-hidden',
          error && 'border-destructive'
        )}
        style={{ touchAction: 'none' }}
      >
        <SignatureCanvas
          ref={sigRef}
          penColor="currentColor"
          canvasProps={{
            id: fieldId,
            className: 'w-full h-full',
            'aria-label': `Signature pad for ${field.label}`,
          }}
          onEnd={handleEnd}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className="gap-2"
        >
          <Eraser className="h-4 w-4" />
          Clear
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleConfirm}
          disabled={disabled || isEmpty}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          Confirm
        </Button>
      </div>
    </div>
  );
}
