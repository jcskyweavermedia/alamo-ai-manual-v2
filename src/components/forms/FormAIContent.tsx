/**
 * FormAIContent
 *
 * Shared content for both desktop panel and mobile drawer.
 * Contains: conversation area (scrollable) + input bar (sticky bottom).
 * Maps over conversationHistory to render appropriate entry types.
 *
 * Voice recording is owned by FormDetail and forwarded via props.
 * The empty state shows a large tappable mic circle (hero mic).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Trash2, Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExtractedFieldsCard } from './ai/ExtractedFieldsCard';
import { FollowUpBubble } from './ai/FollowUpBubble';
import { UserMessageBubble } from './ai/UserMessageBubble';
import { AttachmentMenu } from './ai/AttachmentMenu';
import { AttachmentChip, type AttachmentData } from './ai/AttachmentChip';
import { formatRecordingTime, isRecordingSupported } from '@/hooks/use-voice-recording';
import type { FormTemplate } from '@/types/forms';
import type { AskFormResult, ConversationTurn, AttachmentInput } from '@/hooks/use-ask-form';

// =============================================================================
// TYPES
// =============================================================================

/** Voice state forwarded from the parent (FormDetail owns useVoiceRecording) */
export interface VoiceStateProps {
  isRecording: boolean;
  isTranscribing: boolean;
  elapsedSeconds: number;
  isWarning: boolean;
  audioLevel: number;
}

interface FormAIContentProps {
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
  className?: string;
  /** Voice state from parent */
  voiceState: VoiceStateProps;
  /** Start recording in hero mode (auto-send on transcription) */
  onStartHeroRecording: () => void;
  /** Start recording in input-bar mode (inject into textarea) */
  onStartInputBarRecording: () => void;
  /** Stop the current recording */
  onStopRecording: () => void;
  /** Cancel the current recording */
  onCancelRecording: () => void;
  /** Register callback so parent can route input-bar transcriptions into textarea */
  onRegisterTranscriptionCallback: (cb: ((text: string) => void) | null) => void;
}

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    placeholder: 'Describe...',
    placeholderTranscribing: 'Transcribing...',
    send: 'Send',
    stop: 'Stop recording',
    record: 'Voice input',
    clear: 'Clear conversation',
    emptyTitle: 'AI Form Assistant',
    emptyDesc: 'Describe the situation in your own words — text, voice, or photo — and AI will fill the form for you.',
    loading: 'Thinking...',
    tapToSpeak: 'Tap to speak',
    recording: 'Recording...',
    recordingDesc: 'Speak now, tap to stop',
    transcribing: 'Transcribing...',
  },
  es: {
    placeholder: 'Describe...',
    placeholderTranscribing: 'Transcribiendo...',
    send: 'Enviar',
    stop: 'Detener grabacion',
    record: 'Entrada de voz',
    clear: 'Limpiar conversacion',
    emptyTitle: 'Asistente IA de Formularios',
    emptyDesc: 'Describe la situacion en tus propias palabras — texto, voz o foto — y la IA llenara el formulario por ti.',
    loading: 'Pensando...',
    tapToSpeak: 'Toca para hablar',
    recording: 'Grabando...',
    recordingDesc: 'Habla ahora, toca para detener',
    transcribing: 'Transcribiendo...',
  },
} as const;

// =============================================================================
// HELPERS
// =============================================================================

let attachmentIdCounter = 0;

function fileToAttachmentData(file: File): AttachmentData {
  return {
    id: `att-${++attachmentIdCounter}`,
    name: file.name,
    type: file.type,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
  };
}

/** MIME types that need server-side extraction (sent as base64) */
const BINARY_FILE_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

async function fileToAttachmentInput(file: File): Promise<AttachmentInput> {
  if (file.type.startsWith('image/') || BINARY_FILE_TYPES.has(file.type)) {
    // Images and binary documents -> base64 data URL (server extracts text for docs)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          type: file.type.startsWith('image/') ? 'image' : 'file',
          name: file.name,
          mimeType: file.type,
          content: reader.result as string,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  } else {
    // Plain text files -> read as text client-side
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          type: 'file',
          name: file.name,
          mimeType: file.type,
          content: (reader.result as string).slice(0, 50000),
        });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FormAIContent({
  askForm,
  conversationHistory,
  isLoading,
  error,
  onClear,
  language,
  template,
  className,
  voiceState,
  onStartHeroRecording,
  onStartInputBarRecording,
  onStopRecording,
  onCancelRecording,
  onRegisterTranscriptionCallback,
}: FormAIContentProps) {
  const t = STRINGS[language];
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<AttachmentData[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<Map<string, File>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { isRecording, isTranscribing, elapsedSeconds, isWarning, audioLevel } = voiceState;

  // Register transcription callback for input-bar mode
  useEffect(() => {
    const cb = (text: string) => {
      setInputValue((prev) => (prev ? `${prev} ${text}` : text));
      inputRef.current?.focus();
    };
    onRegisterTranscriptionCallback(cb);
    return () => onRegisterTranscriptionCallback(null);
  }, [onRegisterTranscriptionCallback]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationHistory.length, isLoading]);

  // Handle file selection from AttachmentMenu
  const handleFileSelect = useCallback((files: FileList) => {
    const newAttachments: AttachmentData[] = [];
    const newFiles = new Map(attachmentFiles);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const data = fileToAttachmentData(file);
      newAttachments.push(data);
      newFiles.set(data.id, file);
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setAttachmentFiles(newFiles);
  }, [attachmentFiles]);

  // Remove attachment
  const handleRemoveAttachment = useCallback(
    (id: string) => {
      setAttachments((prev) => {
        const att = prev.find((a) => a.id === id);
        if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
        return prev.filter((a) => a.id !== id);
      });
      setAttachmentFiles((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [],
  );

  // Paste handler for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const data = fileToAttachmentData(file);
          const newFiles = new Map(attachmentFiles);
          newFiles.set(data.id, file);
          setAttachments((prev) => [...prev, data]);
          setAttachmentFiles(newFiles);
          return;
        }
      }
    }
  }, [attachmentFiles]);

  // Send message
  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isLoading) return;

    // Convert files to AttachmentInput for the API
    const attachmentInputs: AttachmentInput[] = [];
    for (const att of attachments) {
      const file = attachmentFiles.get(att.id);
      if (file) {
        try {
          const input = await fileToAttachmentInput(file);
          attachmentInputs.push(input);
        } catch {
          // Skip failed conversions
        }
      }
    }

    // Clear input state
    setInputValue('');
    setAttachments([]);
    setAttachmentFiles(new Map());

    // Call the hook
    await askForm(trimmed || 'Please analyze the attached file(s).', {
      attachments: attachmentInputs.length > 0 ? attachmentInputs : undefined,
    });

    // Focus input for follow-up
    inputRef.current?.focus();
  }, [inputValue, attachments, attachmentFiles, isLoading, askForm]);

  // Handle Enter key (Shift+Enter for new line), Escape cancels recording
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape' && isRecording) {
        e.preventDefault();
        onCancelRecording();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, isRecording, onCancelRecording],
  );

  const hasHistory = conversationHistory.length > 0;
  const supported = isRecordingSupported();

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Conversation area (scrollable) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Empty state — large tappable mic circle */}
        {!hasHistory && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center py-8 px-4 h-full min-h-[200px]">
            {/* Large mic circle */}
            <div className="relative mb-4">
              {/* Audio-level ring for recording */}
              {isRecording && (
                <span
                  className="absolute inset-0 rounded-full bg-destructive/30 pointer-events-none"
                  style={{
                    transform: `scale(${1 + audioLevel * 0.5})`,
                    opacity: 0.2 + audioLevel * 0.6,
                    transition: 'transform 100ms ease-out, opacity 100ms ease-out',
                  }}
                />
              )}
              <button
                type="button"
                onClick={isRecording ? onStopRecording : onStartHeroRecording}
                disabled={!supported || isTranscribing}
                className={cn(
                  'relative flex items-center justify-center',
                  'h-20 w-20 rounded-full',
                  'transition-all duration-200',
                  'shadow-lg',
                  isRecording
                    ? 'bg-destructive text-destructive-foreground ring-2 ring-offset-2 ring-offset-background ring-destructive/40'
                    : isTranscribing
                      ? 'bg-orange-500 text-white'
                      : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95',
                  (!supported || isTranscribing) && !isRecording && 'opacity-40 cursor-not-allowed',
                )}
                aria-label={isRecording ? t.stop : t.tapToSpeak}
              >
                {isTranscribing ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-7 w-7" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
            </div>

            {/* Timer below when recording */}
            {isRecording && (
              <span
                className={cn(
                  'text-sm font-mono tabular-nums px-3 py-1 rounded-md mb-2',
                  'animate-in fade-in-0 duration-200',
                  isWarning
                    ? 'bg-warning/20 text-warning-foreground'
                    : 'bg-destructive/10 text-destructive',
                )}
              >
                {formatRecordingTime(elapsedSeconds)}
              </span>
            )}

            {/* Title and description change based on state */}
            <p className="text-lg font-bold text-foreground mb-1">
              {isRecording ? t.recording : isTranscribing ? t.transcribing : t.emptyTitle}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
              {isRecording ? t.recordingDesc : isTranscribing ? '' : t.emptyDesc}
            </p>
          </div>
        )}

        {/* Conversation turns */}
        {conversationHistory.map((turn, index) => {
          if (turn.role === 'user') {
            return (
              <UserMessageBubble
                key={`user-${index}`}
                message={turn.content}
                attachments={turn.attachments}
              />
            );
          }

          // Assistant turn
          const r = turn.result;
          return (
            <div key={`assistant-${index}`} className="space-y-2">
              {/* Extracted fields card */}
              {r && Object.keys(r.fieldUpdates).length > 0 && (
                <ExtractedFieldsCard
                  result={r}
                  template={template}
                  language={language}
                />
              )}

              {/* AI message (if no fields extracted, show the message as a bubble) */}
              {r && Object.keys(r.fieldUpdates).length === 0 && r.message && (
                <FollowUpBubble question={r.message} />
              )}

              {/* Follow-up question */}
              {r?.followUpQuestion && (
                <FollowUpBubble question={r.followUpQuestion} />
              )}
            </div>
          );
        })}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{t.loading}</span>
          </div>
        )}

        {/* Error display */}
        {error && !isLoading && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Input bar (sticky bottom) */}
      <div className="shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-sm">
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2">
            {attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                attachment={att}
                onRemove={handleRemoveAttachment}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2 py-2">
          {/* Attachment menu */}
          <AttachmentMenu
            language={language}
            disabled={isLoading || isRecording || isTranscribing}
            onFileSelect={handleFileSelect}
          />

          {/* Mic button with audio level ring (input-bar mode) */}
          <div className="relative shrink-0">
            {isRecording && (
              <span
                className="absolute inset-0 rounded-full bg-destructive/30 pointer-events-none"
                style={{
                  transform: `scale(${1 + audioLevel * 0.5})`,
                  opacity: 0.2 + audioLevel * 0.6,
                  transition: 'transform 100ms ease-out, opacity 100ms ease-out',
                }}
              />
            )}
            <button
              type="button"
              className={cn(
                'relative flex items-center justify-center shrink-0',
                'h-9 w-9 rounded-full',
                'transition-colors duration-150',
                isRecording
                  ? 'bg-destructive text-destructive-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                (!supported || isLoading || isTranscribing) && 'opacity-40 cursor-not-allowed',
              )}
              disabled={!supported || isLoading || isTranscribing}
              onClick={isRecording ? onStopRecording : onStartInputBarRecording}
              aria-label={isRecording ? t.stop : t.record}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Recording timer */}
          {isRecording && (
            <span
              className={cn(
                'text-xs font-mono tabular-nums px-2 py-1 rounded-md shrink-0',
                isWarning
                  ? 'bg-warning/20 text-warning-foreground'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              {formatRecordingTime(elapsedSeconds)}
            </span>
          )}

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isTranscribing ? t.placeholderTranscribing : t.placeholder}
            disabled={isLoading || isTranscribing}
            rows={1}
            className={cn(
              'flex-1 resize-none',
              'px-3 py-2 rounded-xl',
              'bg-muted/50 dark:bg-muted/30',
              'border border-border/50 focus:border-primary/50',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-1 focus:ring-primary/30',
              'disabled:opacity-50',
              'transition-colors duration-150',
            )}
          />

          {/* Send / Stop button — 36px perfect circle */}
          {isRecording ? (
            <button
              type="button"
              onClick={onStopRecording}
              className={cn(
                'flex items-center justify-center shrink-0',
                'h-9 w-9 rounded-full',
                'bg-destructive text-destructive-foreground',
              )}
              aria-label={t.stop}
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || isTranscribing || (!inputValue.trim() && attachments.length === 0)}
              className={cn(
                'flex items-center justify-center shrink-0',
                'h-9 w-9 rounded-full',
                'bg-primary text-primary-foreground',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'transition-colors duration-150',
              )}
              aria-label={t.send}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Clear conversation link */}
        {hasHistory && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={onClear}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md',
                'text-[11px] text-muted-foreground',
                'hover:text-foreground hover:bg-muted/50',
                'transition-colors duration-100',
              )}
            >
              <Trash2 className="h-3 w-3" />
              {t.clear}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
