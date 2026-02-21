import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, FileText, X, Loader2, Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useVoiceRecording, formatRecordingTime, isRecordingSupported } from '@/hooks/use-voice-recording';
import { useLanguage } from '@/hooks/use-language';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { DraftPreviewCard } from './DraftPreviewCard';
import { ThinkingIndicator } from './ThinkingIndicator';
import type { ChatMessage, PrepRecipeDraft, WineDraft, QueuedAttachment } from '@/types/ingestion';

/** Compact markdown components for chat bubbles */
const chatMdComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-sm font-bold mt-2 mb-1" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-sm font-bold mt-2 mb-1" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm font-semibold mt-1.5 mb-0.5" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm leading-relaxed mb-1.5 last:mb-0" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-4 mb-1.5 space-y-0.5 text-sm" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-4 mb-1.5 space-y-0.5 text-sm" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm leading-relaxed" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-bold" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>{children}</em>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-primary/30 pl-2 my-1 text-muted-foreground italic text-sm" {...props}>{children}</blockquote>
  ),
  code: ({ children, ...props }) => (
    <code className="bg-background/50 rounded px-1 py-0.5 text-xs font-mono" {...props}>{children}</code>
  ),
};

// =============================================================================
// MOCK DATA (Phase 1A -- replaced by AI in Phase 2A)
// =============================================================================

const MOCK_DRAFT: PrepRecipeDraft = {
  name: 'Chimichurri Sauce',
  slug: 'chimichurri-sauce',
  prepType: 'sauce',
  tags: ['argentinian', 'steak', 'herb'],
  yieldQty: 2,
  yieldUnit: 'qt',
  shelfLifeValue: 5,
  shelfLifeUnit: 'days',
  ingredients: [
    {
      group_name: 'Herb Base',
      order: 1,
      items: [
        { name: 'Fresh parsley, finely chopped', quantity: 2, unit: 'cups', allergens: [] },
        { name: 'Fresh oregano, finely chopped', quantity: 0.5, unit: 'cup', allergens: [] },
        { name: 'Garlic, minced', quantity: 8, unit: 'cloves', allergens: [] },
      ],
    },
    {
      group_name: 'Liquid',
      order: 2,
      items: [
        { name: 'Red wine vinegar', quantity: 0.5, unit: 'cup', allergens: [] },
        { name: 'Extra virgin olive oil', quantity: 1, unit: 'cup', allergens: [] },
        { name: 'Lemon juice', quantity: 2, unit: 'tbsp', allergens: [] },
      ],
    },
    {
      group_name: 'Seasoning',
      order: 3,
      items: [
        { name: 'Red pepper flakes', quantity: 1, unit: 'tsp', allergens: [] },
        { name: 'Kosher salt', quantity: 1, unit: 'tbsp', allergens: [] },
        { name: 'Black pepper, freshly ground', quantity: 0.5, unit: 'tsp', allergens: [] },
      ],
    },
  ],
  procedure: [
    {
      group_name: 'Prep',
      order: 1,
      steps: [
        { step_number: 1, instruction: 'Finely chop parsley and oregano. Mince garlic.' },
        { step_number: 2, instruction: 'Combine herbs and garlic in a mixing bowl.' },
      ],
    },
    {
      group_name: 'Mix',
      order: 2,
      steps: [
        { step_number: 1, instruction: 'Add red wine vinegar, lemon juice, and red pepper flakes.' },
        { step_number: 2, instruction: 'Slowly drizzle in olive oil while stirring continuously.', critical: true },
        { step_number: 3, instruction: 'Season with salt and pepper. Taste and adjust.' },
      ],
    },
    {
      group_name: 'Store',
      order: 3,
      steps: [
        { step_number: 1, instruction: 'Transfer to a labeled deli container. Refrigerate immediately.', critical: true },
        { step_number: 2, instruction: 'Let rest at least 2 hours before service for flavors to meld.' },
      ],
    },
  ],
  batchScaling: {
    scalable: true,
    scaling_method: 'linear',
    base_yield: { quantity: 2, unit: 'qt' },
    notes: 'Scales linearly. For large batches, use food processor for herbs.',
    exceptions: [],
  },
  trainingNotes: {
    notes: 'Chimichurri should be bright green and slightly chunky, not a paste.',
    common_mistakes: ['Over-processing herbs into a paste', 'Using dried herbs instead of fresh'],
    quality_checks: ['Bright green color', 'Visible herb pieces', 'Balanced acid-to-oil ratio'],
  },
  images: [],
};

function createMockResponse(userMessage: string): { content: string; draft: PrepRecipeDraft } {
  return {
    content: `I've structured your recipe based on your description. Here's what I put together for the **${MOCK_DRAFT.name}**:

- **3 ingredient groups** with 9 total ingredients
- **3 procedure phases** with 7 steps (2 marked critical)
- Yield: 2 qt, shelf life: 5 days

Take a look at the preview below and let me know if you'd like to adjust anything.`,
    draft: MOCK_DRAFT,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

interface ChatIngestionPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, attachments?: QueuedAttachment[]) => void;
  isProcessing?: boolean;
  className?: string;
  isUploading?: boolean;
  uploadingFileName?: string;
  /** Product type label for the empty-state heading */
  productLabel?: string;
  /** Number of messages loaded from a previous session (shown with a divider) */
  historyMessageCount?: number;
}

export function ChatIngestionPanel({
  messages,
  onSendMessage,
  isProcessing = false,
  className,
  isUploading = false,
  uploadingFileName,
  productLabel = 'Recipe',
  historyMessageCount = 0,
}: ChatIngestionPanelProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<QueuedAttachment[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const { language } = useLanguage();

  const {
    isRecording,
    isTranscribing,
    elapsedSeconds,
    isWarning,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecording({
    language,
    silenceTimeoutMs: 4000,
    maxRecordingSeconds: 120,
    onTranscription: (text) => {
      setInput((prev) => prev ? `${prev} ${text}` : text);
      inputRef.current?.focus();
    },
  });

  // Auto-grow textarea when input changes
  const MAX_TEXTAREA_HEIGHT = 120; // ~5 lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const clamped = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = clamped + 'px';
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [input]);

  // Auto-scroll to bottom on new messages or when processing starts
  // Use container scrollTop instead of scrollIntoView to avoid scrolling
  // ancestor containers (which pushes the whole page down in edit mode)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, isProcessing]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: QueuedAttachment[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      type: file.type.startsWith('image/') ? 'image' as const : 'document' as const,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    // Clean up object URLs
    attachments.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview); });

    onSendMessage(trimmed, attachments.length > 0 ? [...attachments] : undefined);
    setInput('');
    setAttachments([]);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isRecording) {
      e.preventDefault();
      cancelRecording();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setAttachments((prev) => [...prev, {
            id: crypto.randomUUID(),
            file,
            preview: URL.createObjectURL(file),
            type: 'image',
          }]);
          return;
        }
      }
    }
  }, []);

  return (
    <div className={cn('flex flex-col h-full', className)} onPaste={handlePaste}>
      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-[40px] leading-none mb-3">👨‍🍳</span>
            <h3 className="text-base font-semibold text-foreground mb-1">AI {productLabel} Builder</h3>
            <p className="text-xs text-muted-foreground mb-5 max-w-[280px]">
              Create a {productLabel.toLowerCase()} by chatting or adding files and images
            </p>

            <div className="w-full max-w-[320px] space-y-2">
              {/* Chat suggestion */}
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="flex items-center gap-3 w-full rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent/50"
              >
                <span className="text-[22px] leading-none shrink-0">💬</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Describe your {productLabel.toLowerCase()}</p>
                  <p className="text-xs text-muted-foreground">Type details and I'll structure them</p>
                </div>
              </button>

              {/* Attachment suggestion */}
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                className="flex items-center gap-3 w-full rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent/50"
              >
                <span className="text-[22px] leading-none shrink-0">📎</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Add files or images</p>
                  <p className="text-xs text-muted-foreground">PDF, Word, text, or photos</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={msg.id}>
            {/* History divider — shown after the last historical message */}
            {historyMessageCount > 0 && index === historyMessageCount && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 border-t border-border" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                  Previous conversation
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}

            <div className="space-y-2">
              {/* Message bubble */}
              <div className={cn(
                'flex gap-2.5',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}>
                {msg.role === 'assistant' && (
                  <span className={cn(
                    'text-[18px] leading-none shrink-0 mt-0.5',
                    index < historyMessageCount && 'opacity-60'
                  )}>
                    🤖
                  </span>
                )}
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-foreground/[0.06] text-foreground'
                    : 'bg-muted text-foreground',
                  index < historyMessageCount && 'opacity-60'
                )}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMdComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === 'user' && (
                  <span className={cn(
                    'text-[18px] leading-none shrink-0 mt-0.5',
                    index < historyMessageCount && 'opacity-60'
                  )}>
                    👤
                  </span>
                )}
              </div>

              {/* Draft preview card (inline in chat) */}
              {msg.role === 'assistant' && msg.draftPreview && (
                <div className="ml-9">
                  <DraftPreviewCard draft={msg.draftPreview} />
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-2.5 justify-start">
            <span className="text-[18px] leading-none shrink-0 mt-0.5">🤖</span>
            <div className="bg-muted rounded-lg px-3 py-2">
              <ThinkingIndicator />
            </div>
          </div>
        )}

        <div />
      </div>

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div className="border-t border-border pt-2 pb-1 px-1">
          <div className="flex gap-2 overflow-x-auto pt-2 pr-2">
            {attachments.map((att) => (
              <div key={att.id} className="relative shrink-0 group">
                {att.type === 'image' ? (
                  <img
                    src={att.preview!}
                    alt={att.file.name}
                    className="h-16 w-16 rounded-md object-cover border border-border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md border border-border bg-muted flex flex-col items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[56px] px-1">
                      {att.file.name.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-border pt-3">
        {/* Upload in-progress indicator */}
        {isUploading && uploadingFileName && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-muted text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span className="truncate">Processing {uploadingFileName}...</span>
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* Attachment button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  disabled={isProcessing || isUploading}
                  onClick={() => attachInputRef.current?.click()}
                  aria-label="Add attachment"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{language === 'es' ? 'Adjuntar archivo' : 'Attach file'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Mic button with live audio ring */}
          <div className="relative shrink-0">
            {isRecording && (
              <span
                className="absolute inset-0 rounded-md bg-destructive/30 pointer-events-none"
                style={{
                  transform: `scale(${1 + audioLevel * 0.5})`,
                  opacity: 0.2 + audioLevel * 0.6,
                  transition: 'transform 100ms ease-out, opacity 100ms ease-out',
                }}
              />
            )}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isRecording ? 'destructive' : 'ghost'}
                    size="icon"
                    className="relative h-9 w-9"
                    disabled={!isRecordingSupported() || isProcessing || isUploading || isTranscribing}
                    onClick={isRecording ? stopRecording : startRecording}
                    aria-label={isRecording ? 'Stop recording' : 'Record voice'}
                  >
                    {isTranscribing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
              <TooltipContent>
                <p>{isTranscribing
                  ? (language === 'es' ? 'Transcribiendo...' : 'Transcribing...')
                  : isRecording
                    ? (language === 'es' ? 'Detener grabación' : 'Stop recording')
                    : (language === 'es' ? 'Grabar voz' : 'Record voice')
                }</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          </div>

          {/* Recording timer */}
          {isRecording && (
            <span className={cn(
              'text-xs font-mono tabular-nums px-2 py-1 rounded-md shrink-0',
              isWarning
                ? 'bg-warning/20 text-warning-foreground'
                : 'bg-destructive/10 text-destructive'
            )}>
              {formatRecordingTime(elapsedSeconds)}
            </span>
          )}

          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isTranscribing ? (language === 'es' ? 'Transcribiendo...' : 'Transcribing...') : `Describe your ${productLabel.toLowerCase()}...`}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm py-2 overflow-y-hidden"
            rows={1}
            disabled={isUploading || isTranscribing}
          />

          {/* Send / Stop / Transcribing button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                {isRecording ? (
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={stopRecording}
                    aria-label="Stop recording"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : isTranscribing ? (
                  <Button size="icon" disabled aria-label="Transcribing">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSubmit}
                    disabled={(!input.trim() && attachments.length === 0) || isProcessing || isUploading}
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRecording
                  ? (language === 'es' ? 'Detener grabación' : 'Stop recording')
                  : isTranscribing
                    ? (language === 'es' ? 'Transcribiendo...' : 'Transcribing...')
                    : (language === 'es' ? 'Enviar mensaje' : 'Send message')
                }</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Hidden file input (accepts all types) */}
      <input
        ref={attachInputRef}
        type="file"
        accept="image/*,.pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
    </div>
  );
}

// Re-export mock helpers for use in IngestPage
export { createMockResponse, MOCK_DRAFT };
