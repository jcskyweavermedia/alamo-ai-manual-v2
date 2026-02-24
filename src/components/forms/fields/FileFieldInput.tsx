// =============================================================================
// FileFieldInput — File upload with list display
// Native <input type="file">. File list: icon + name + size + remove.
// Value: FileValue[]
// =============================================================================

import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FileIcon, Plus, X, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition, FileValue } from '@/types/forms';

interface FileFieldInputProps {
  field: FormFieldDefinition;
  value: FileValue[];
  onChange: (value: FileValue[]) => void;
  disabled?: boolean;
  error?: string;
  submissionId?: string | null;
}

/** Format bytes to human-readable size */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: FileFieldInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const files = value ?? [];

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected || selected.length === 0) return;

      const newFiles: FileValue[] = Array.from(selected).map((file) => ({
        url: URL.createObjectURL(file),
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_at: new Date().toISOString(),
      }));

      onChange([...files, ...newFiles]);

      // Reset input so user can re-select the same file
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [files, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = files.filter((_, i) => i !== index);
      onChange(updated);
    },
    [files, onChange]
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
        multiple
        onChange={handleFileChange}
        disabled={disabled}
        className="sr-only"
        aria-required={field.required || undefined}
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {files.map((file, index) => (
            <div
              key={`${file.filename}-${index}`}
              className="flex items-center gap-2 h-11 px-3 rounded-lg border bg-muted/50"
            >
              <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{file.filename}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatFileSize(file.size_bytes)}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={`Remove ${file.filename}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add file button / dropzone */}
      {!disabled && (
        <button
          type="button"
          onClick={handleAddClick}
          className={cn(
            'w-full h-11 rounded-lg border-2 border-dashed border-muted-foreground/25',
            'flex items-center justify-center gap-2',
            'text-sm text-muted-foreground',
            'hover:border-muted-foreground/50 hover:text-foreground',
            'transition-colors cursor-pointer',
            error && 'border-destructive/50'
          )}
        >
          <Paperclip className="h-4 w-4" />
          Add file
        </button>
      )}

      {/* Empty state when disabled and no files */}
      {disabled && files.length === 0 && (
        <div className="h-11 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm">
          No files attached
        </div>
      )}
    </div>
  );
}
