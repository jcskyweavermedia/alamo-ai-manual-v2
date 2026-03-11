// =============================================================================
// BeerLiquorAIIngestPanel — AI-powered chat panel for beer & liquor ingestion
// Phase 1: UI Shell only (no real AI calls) — stubbed assistant response
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, FileText, X, Loader2, Mic, Sparkles, Beer } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { chatMdComponents } from '@/lib/chat-markdown';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// LOCAL TYPES
// =============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: { type: 'image' | 'file'; name: string; preview?: string }[];
}

interface QueuedAttachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  preview?: string;
  dataUrl?: string;
  textContent?: string;
}

interface BeerLiquorAIIngestPanelProps {
  language?: 'en' | 'es';
}

// =============================================================================
// THINKING INDICATOR
// =============================================================================

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-pulse"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BeerLiquorAIIngestPanel({ language = 'en' }: BeerLiquorAIIngestPanelProps) {
  const { toast } = useToast();

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachments, setAttachments] = useState<QueuedAttachment[]>([]);

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef(attachments);

  // Keep ref in sync
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
    };
  }, []);

  // Auto-grow textarea
  const MAX_TEXTAREA_HEIGHT = 120;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const clamped = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = clamped + 'px';
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [input]);

  // Auto-scroll on new messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length, isProcessing]);

  // File handling
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    let hasImage = attachments.some((att) => att.type === 'image');
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        if (hasImage) return;
        hasImage = true;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachments((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: 'image',
              name: file.name,
              preview: URL.createObjectURL(file),
              dataUrl,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.txt') || file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: 'file',
              name: file.name,
              textContent: (reader.result as string).slice(0, 50000),
            },
          ]);
        };
        reader.readAsText(file);
      } else {
        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: 'file',
            name: file.name,
          },
        ]);
      }
    });
    e.target.value = '';
  }, [attachments]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((att) => att.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((att) => att.id !== id);
    });
  }, []);

  // Send message (Phase 1 stub — no real AI)
  const handleSend = useCallback(() => {
    if (!input.trim() && !attachments.length) return;
    if (isProcessing) return;

    const messageText = input.trim() || (
      attachments.some((att) => att.type === 'image')
        ? 'Add a beer or spirit based on this image.'
        : 'Add a beer or spirit based on this file.'
    );

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
      attachments: attachments.map((att) => ({
        type: att.type,
        name: att.name,
        preview: att.type === 'image' ? att.dataUrl : undefined,
      })),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsProcessing(true);

    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'Thanks! I can see your request. AI ingestion will be wired up in Phase 2 — for now, items can be added manually from the ingest dashboard.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsProcessing(false);
    }, 1500);
  }, [input, attachments, isProcessing]);

  // Keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick-start chips
  const handleChipClick = useCallback((text: string | null) => {
    if (text === null) {
      fileInputRef.current?.click();
      return;
    }
    setInput(text);
    inputRef.current?.focus();
  }, []);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isProcessing;

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">

        {/* ========== Header ========== */}
        <div className="shrink-0 border-b px-4 py-3 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <Beer className="h-4 w-4 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">AI Beer & Liquor Builder</p>
            <p className="text-xs text-muted-foreground mt-0.5">Describe a beer or spirit to add it to the list</p>
          </div>
        </div>

        {/* ========== Messages area ========== */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4"
        >
          {/* Empty state */}
          {messages.length === 0 && !isProcessing && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                AI Beer & Liquor Builder
              </h3>
              <p className="text-xs text-muted-foreground mb-5 max-w-[280px]">
                Describe a beer or spirit — text, voice, or image
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-[380px]">
                {([
                  { label: 'Add a local beer', prompt: 'Add a local Texas craft beer to the list' },
                  { label: 'Add a whiskey', prompt: 'Add a premium bourbon or whiskey to the list' },
                  { label: 'Add from image', prompt: null },
                  { label: 'Add from menu', prompt: 'I have a menu with beverages to add' },
                ] as { label: string; prompt: string | null }[]).map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleChipClick(chip.prompt)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-full border',
                      'bg-card hover:bg-accent/50 transition-colors',
                      'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-1">
              <div
                className={cn(
                  'flex gap-2.5',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-foreground/[0.06] text-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMdComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Attachment thumbnails in user messages */}
                  {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {msg.attachments.map((att, i) =>
                        att.type === 'image' && att.preview ? (
                          <img
                            key={i}
                            src={att.preview}
                            alt={att.name}
                            className="h-12 w-12 rounded-md object-cover border border-border"
                          />
                        ) : (
                          <div
                            key={i}
                            className="h-12 px-2 rounded-md border border-border bg-muted/50 flex items-center gap-1.5"
                          >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                              {att.name}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {isProcessing && (
            <div className="flex gap-2.5 justify-start">
              <div className="bg-muted rounded-2xl px-3.5 py-2.5">
                <ThinkingDots />
              </div>
            </div>
          )}
        </div>

        {/* ========== Attachment strip ========== */}
        {attachments.length > 0 && (
          <div className="border-t border-border pt-2 pb-1 px-4">
            <div className="flex gap-2 overflow-x-auto">
              {attachments.map((att) => (
                <div key={att.id} className="relative shrink-0 group">
                  {att.type === 'image' && att.preview ? (
                    <img
                      src={att.preview}
                      alt={att.name}
                      className="h-16 w-16 rounded-md object-cover border border-border"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-md border border-border bg-muted flex flex-col items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[56px] px-1">
                        {att.name.split('.').pop()?.toUpperCase()}
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

        {/* ========== Input bar ========== */}
        <div className="shrink-0 border-t p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.docx"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex items-end gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach file</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    toast({
                      title: 'Coming soon',
                      description: 'Voice input coming in Phase 2.',
                    })
                  }
                  aria-label="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Voice input</TooltipContent>
            </Tooltip>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe a beer or spirit..."
              rows={1}
              className={cn(
                'flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2',
                'text-sm placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-1 focus:ring-ring',
                'min-h-[36px] overflow-hidden',
              )}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className={cn(
                    'h-9 w-9 shrink-0 rounded-lg',
                    'bg-orange-500 text-white hover:bg-orange-600',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Send message</TooltipContent>
            </Tooltip>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}