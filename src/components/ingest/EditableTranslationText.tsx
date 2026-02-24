/**
 * EditableTranslationText
 *
 * Inline tap-to-edit wrapper for translated text in ES preview mode.
 * Shows a pencil icon on hover; tapping swaps to a textarea that saves on blur.
 */

import { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableTranslationTextProps {
  fieldPath: string;
  englishText: string;
  translatedText: string | null;
  onSave: (fieldPath: string, newText: string) => void;
  className?: string;
}

export function EditableTranslationText({
  fieldPath,
  englishText,
  translatedText,
  onSave,
  className,
}: EditableTranslationTextProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(translatedText ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external changes
  useEffect(() => {
    if (!editing) {
      setValue(translatedText ?? '');
    }
  }, [translatedText, editing]);

  // Auto-focus + auto-size when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editing]);

  const hasTranslation = translatedText != null && translatedText.trim() !== '';

  // Untranslated: show English fallback with dashed border, no edit
  if (!hasTranslation) {
    return (
      <span
        className={cn(
          'inline text-sm text-foreground/60 border-b border-dashed border-muted-foreground/40',
          className,
        )}
      >
        {englishText}
        <span className="ml-1 text-[10px] text-muted-foreground">(EN)</span>
      </span>
    );
  }

  // Edit mode: textarea
  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
        }}
        onBlur={() => {
          setEditing(false);
          if (value.trim() && value !== translatedText) {
            onSave(fieldPath, value.trim());
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            textareaRef.current?.blur();
          }
        }}
        className={cn(
          'w-full text-sm leading-relaxed resize-none rounded-md border border-primary/40 bg-primary/5 px-2 py-1 outline-none focus:ring-1 focus:ring-primary/40',
          className,
        )}
        rows={1}
      />
    );
  }

  // Display mode: translated text with hover pencil
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}
      className={cn(
        'group/edit inline cursor-pointer rounded-sm hover:bg-primary/5 transition-colors',
        className,
      )}
    >
      {translatedText}
      <Pencil className="inline-block ml-1 h-3 w-3 text-muted-foreground opacity-0 group-hover/edit:opacity-60 transition-opacity" />
    </span>
  );
}
