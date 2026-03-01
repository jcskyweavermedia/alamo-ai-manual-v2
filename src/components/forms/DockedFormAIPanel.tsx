/**
 * DockedFormAIPanel
 *
 * Desktop-only docked AI panel for form filling (>= 1024px).
 * Pushes content left rather than overlaying.
 * Mirrors DockedProductAIPanel pattern — same sizing, animation, escape key.
 */

import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UsageMeter } from '@/components/ui/usage-meter';
import { FormAIContent } from './FormAIContent';
import type { VoiceStateProps } from './FormAIContent';
import type { FormTemplate } from '@/types/forms';
import type { AskFormResult, ConversationTurn, AttachmentInput } from '@/hooks/use-ask-form';

// =============================================================================
// TYPES
// =============================================================================

interface DockedFormAIPanelProps {
  open: boolean;
  onClose: () => void;
  askForm: (
    question: string,
    options?: { attachments?: AttachmentInput[] },
  ) => Promise<AskFormResult | null>;
  conversationHistory: ConversationTurn[];
  isLoading: boolean;
  error: string | null;
  onClear: () => void;
  language: 'en' | 'es';
  template: FormTemplate | undefined;
  usage?: { used: number; limit: number } | null;
  /** Voice state from parent */
  voiceState: VoiceStateProps;
  onStartHeroRecording: () => void;
  onStartInputBarRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onRegisterTranscriptionCallback: (cb: ((text: string) => void) | null) => void;
}

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    title: 'AI Assistant',
    close: 'Close',
    remaining: 'remaining today',
  },
  es: {
    title: 'Asistente IA',
    close: 'Cerrar',
    remaining: 'restantes hoy',
  },
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function DockedFormAIPanel({
  open,
  onClose,
  askForm,
  conversationHistory,
  isLoading,
  error,
  onClear,
  language,
  template,
  usage,
  voiceState,
  onStartHeroRecording,
  onStartInputBarRecording,
  onStopRecording,
  onCancelRecording,
  onRegisterTranscriptionCallback,
}: DockedFormAIPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const t = STRINGS[language];

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus panel on mount
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className={cn(
        'w-80 xl:w-96 shrink-0 h-full',
        'flex flex-col',
        'border-l border-border bg-background/95 backdrop-blur-sm shadow-xl',
        'animate-in slide-in-from-right-4 fade-in-0 duration-500 ease-out',
      )}
      role="complementary"
      aria-label={t.title}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center shrink-0',
              'w-8 h-8 rounded-[10px]',
              'bg-primary/10 dark:bg-primary/15',
            )}
          >
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="text-base font-semibold truncate">{t.title}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t.close}</span>
        </Button>
      </div>

      {/* Usage meter */}
      {usage && (
        <div className="px-4 py-2 border-b border-border/50 shrink-0">
          <UsageMeter
            used={usage.used}
            total={usage.limit}
            label={t.remaining}
            showIcon
          />
        </div>
      )}

      {/* Content */}
      <FormAIContent
        askForm={askForm}
        conversationHistory={conversationHistory}
        isLoading={isLoading}
        error={error}
        onClear={onClear}
        language={language}
        template={template}
        className="flex-1 min-h-0"
        voiceState={voiceState}
        onStartHeroRecording={onStartHeroRecording}
        onStartInputBarRecording={onStartInputBarRecording}
        onStopRecording={onStopRecording}
        onCancelRecording={onCancelRecording}
        onRegisterTranscriptionCallback={onRegisterTranscriptionCallback}
      />
    </aside>
  );
}
