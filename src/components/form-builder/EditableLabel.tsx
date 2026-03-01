// =============================================================================
// EditableLabel — Inline editable label for WYSIWYG canvas fields
// Click to edit, blur/Enter to save, Escape to cancel
// Shows required asterisk toggle
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface EditableLabelProps {
  value: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function EditableLabel({
  value,
  required,
  placeholder = 'Field label',
  onChange,
  className,
}: EditableLabelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when external value changes
  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  // Auto-focus on edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
    } else {
      setDraft(value);
    }
  }, [draft, value, onChange]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setDraft(value);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
      // Stop propagation to prevent canvas click handler
      e.stopPropagation();
    },
    [commitEdit, cancelEdit],
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'text-[13px] font-semibold leading-none tracking-tight',
          'bg-transparent border-b border-primary outline-none',
          'text-foreground/80 dark:text-foreground/70',
          'w-full py-0.5',
          className,
        )}
        placeholder={placeholder}
        data-canvas-action
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={cn(
        'text-[13px] font-semibold leading-none tracking-tight cursor-text',
        'text-foreground/80 dark:text-foreground/70',
        'hover:border-b hover:border-dashed hover:border-muted-foreground/40',
        !value && 'italic text-muted-foreground',
        className,
      )}
      data-canvas-action
    >
      {value || placeholder}
      {required && (
        <span className="text-destructive ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </span>
  );
}
