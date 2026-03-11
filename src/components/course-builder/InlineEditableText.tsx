// =============================================================================
// InlineEditableText — WYSIWYG inline text editing for course builder elements.
// Renders as transparent textarea that inherits player CSS classes.
// Also exports InlineEditableSplitTitle for "|"-delimited light|bold titles.
// =============================================================================

import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { courseMdComponents } from '@/lib/chat-markdown';

// =============================================================================
// InlineEditableText
// =============================================================================

interface InlineEditableTextProps {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  markdown?: boolean;
  darkBg?: boolean;
  minHeight?: string;
}

export function InlineEditableText({
  value,
  onChange,
  onCommit,
  onFocus,
  placeholder = '',
  className = '',
  multiline = false,
  markdown = false,
  darkBg = false,
  minHeight = 'min-h-[24px]',
}: InlineEditableTextProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onCommit?.(value);
  }, [onCommit, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLTextAreaElement).blur();
    }
  }, [multiline]);

  // Markdown mode: show rendered markdown when not focused
  if (markdown && !isFocused) {
    return (
      <div
        className={cn(
          className,
          minHeight,
          'cursor-text rounded-sm transition-colors',
          'hover:ring-1 hover:ring-primary/10',
          darkBg && 'text-white [&_p]:text-white/60 [&_li]:text-white/60 [&_strong]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_blockquote]:text-white/50',
          !value && 'italic opacity-40',
        )}
        onClick={(e) => {
          e.stopPropagation();
          setIsFocused(true);
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
        data-inline-editable="true"
      >
        {value ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={courseMdComponents}>
            {value}
          </ReactMarkdown>
        ) : (
          placeholder
        )}
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      placeholder={placeholder}
      rows={1}
      style={{ fieldSizing: 'content' } as React.CSSProperties}
      className={cn(
        // Player CSS classes passed via className prop
        className,
        // Override to make it look inline
        'border-0 bg-transparent shadow-none outline-none ring-0 focus-visible:ring-0 p-0 m-0 w-full resize-none',
        // Focus highlight
        'focus:ring-1 focus:ring-primary/20 focus:rounded-sm',
        // Empty state
        'placeholder:text-muted-foreground/40 placeholder:italic',
        // Min height
        minHeight,
        // Dark bg mode
        darkBg && 'text-white caret-white placeholder:text-white/30',
        // Multiline max height
        markdown && isFocused && 'max-h-[400px] overflow-y-auto font-mono text-sm',
      )}
      data-inline-editable="true"
    />
  );
}

// =============================================================================
// InlineEditableSplitTitle
// =============================================================================

interface InlineEditableSplitTitleProps {
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  lightClassName?: string;
  boldClassName?: string;
  wrapperClassName?: string;
  darkBg?: boolean;
}

export function InlineEditableSplitTitle({
  value,
  onChange,
  onCommit,
  onFocus,
  placeholder = 'Title...',
  lightClassName = 'block font-light',
  boldClassName = 'font-black',
  wrapperClassName = '',
  darkBg = false,
}: InlineEditableSplitTitleProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onCommit?.(value);
  }, [onCommit, value]);

  // Parse split title
  const pipeIndex = value.indexOf('|');
  const lightPart = pipeIndex >= 0 ? value.slice(0, pipeIndex).trim() : null;
  const boldPart = pipeIndex >= 0 ? value.slice(pipeIndex + 1).trim() : value.trim();

  if (isFocused) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        rows={1}
        style={{ fieldSizing: 'content' } as React.CSSProperties}
        className={cn(
          wrapperClassName,
          boldClassName,
          'border-0 bg-transparent shadow-none outline-none ring-0 focus-visible:ring-0 p-0 m-0 w-full resize-none',
          'focus:ring-1 focus:ring-primary/20 focus:rounded-sm',
          'placeholder:text-muted-foreground/40 placeholder:italic',
          'min-h-[32px]',
          darkBg && 'text-white caret-white placeholder:text-white/30',
        )}
        data-inline-editable="true"
        autoFocus
      />
    );
  }

  return (
    <div
      className={cn(
        wrapperClassName,
        'cursor-text rounded-sm transition-colors min-h-[32px]',
        'hover:ring-1 hover:ring-primary/10',
        !value && 'italic opacity-40',
      )}
      onClick={(e) => {
        e.stopPropagation();
        setIsFocused(true);
        setTimeout(() => textareaRef.current?.focus(), 0);
      }}
      data-inline-editable="true"
    >
      {value ? (
        <>
          {lightPart && <span className={lightClassName}>{lightPart}</span>}
          <span className={boldClassName}>{boldPart}</span>
        </>
      ) : (
        <span className={boldClassName}>{placeholder}</span>
      )}
    </div>
  );
}
