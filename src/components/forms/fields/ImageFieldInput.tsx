// =============================================================================
// ImageFieldInput — Image upload with thumbnail grid
// Native <input type="file" accept="image/*"> (NO capture attr)
// 80x80 thumbnail grid. Max 5. Remove button per image. Add (+) button.
// Value: ImageValue[]
// =============================================================================

import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition, ImageValue } from '@/types/forms';

const MAX_IMAGES = 5;

interface ImageFieldInputProps {
  field: FormFieldDefinition;
  value: ImageValue[];
  onChange: (value: ImageValue[]) => void;
  disabled?: boolean;
  error?: string;
  submissionId?: string | null;
}

export function ImageFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: ImageFieldInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const images = value ?? [];
  const canAddMore = images.length < MAX_IMAGES;

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remaining = MAX_IMAGES - images.length;
      const filesToProcess = Array.from(files).slice(0, remaining);

      // Create object URLs for preview (will be replaced by uploaded URLs later)
      const newImages: ImageValue[] = filesToProcess.map((file) => ({
        url: URL.createObjectURL(file),
        caption: file.name,
        uploaded_at: new Date().toISOString(),
      }));

      onChange([...images, ...newImages]);

      // Reset input so user can re-select the same file
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [images, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = images.filter((_, i) => i !== index);
      onChange(updated);
    },
    [images, onChange]
  );

  const handleAddClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        disabled={disabled || !canAddMore}
        className="sr-only"
        aria-required={field.required || undefined}
      />

      {/* Thumbnail grid + Add button */}
      <div className="flex flex-wrap gap-2">
        {images.map((img, index) => (
          <div
            key={`${img.url}-${index}`}
            className="relative w-20 h-20 rounded-lg border bg-muted overflow-hidden group"
          >
            <img
              src={img.url}
              alt={img.caption ?? `Image ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className={cn(
                  'absolute top-0.5 right-0.5 h-5 w-5 rounded-full',
                  'bg-destructive text-destructive-foreground',
                  'flex items-center justify-center',
                  'opacity-0 group-hover:opacity-100 focus:opacity-100',
                  'transition-opacity'
                )}
                aria-label={`Remove image ${index + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Add button */}
        {canAddMore && !disabled && (
          <button
            type="button"
            onClick={handleAddClick}
            className={cn(
              'w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25',
              'flex flex-col items-center justify-center gap-1',
              'text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground',
              'transition-colors cursor-pointer',
              error && 'border-destructive/50'
            )}
          >
            <Plus className="h-5 w-5" />
            <span className="text-[10px]">Add</span>
          </button>
        )}

        {/* Empty state when no images */}
        {images.length === 0 && (canAddMore && disabled) && (
          <div className="w-20 h-20 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Count indicator */}
      <p className="text-xs text-muted-foreground mt-1.5">
        {images.length} / {MAX_IMAGES} images
      </p>
    </div>
  );
}
