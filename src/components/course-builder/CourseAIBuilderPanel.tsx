// =============================================================================
// CourseAIBuilderPanel — Right-side AI chat panel for the course builder
// Chat interface with quick-start chips, message history, and change summaries.
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCourseBuilderChat } from '@/hooks/use-course-builder-chat';
import type { CourseBuilderChatMessage } from '@/types/course-builder';

const STRINGS = {
  en: {
    title: 'AI Builder',
    placeholder: 'Ask the AI to modify your course...',
    send: 'Send',
    clear: 'Clear chat',
    empty: 'Ask the AI to help build your course. Try one of the suggestions below.',
    chipTip: 'Add a tip about...',
    chipExpand: 'Expand this section',
    chipConcise: 'Make more concise',
    chipTakeaways: 'Add key takeaways',
    chipSimplify: 'Rewrite for beginners',
    chipScenario: 'Add a practice scenario',
    changes: 'Changes:',
  },
  es: {
    title: 'Constructor IA',
    placeholder: 'Pide a la IA que modifique tu curso...',
    send: 'Enviar',
    clear: 'Limpiar chat',
    empty: 'Pide a la IA que te ayude a construir tu curso. Prueba una de las sugerencias.',
    chipTip: 'Agregar un consejo sobre...',
    chipExpand: 'Expandir esta seccion',
    chipConcise: 'Hacer mas conciso',
    chipTakeaways: 'Agregar puntos clave',
    chipSimplify: 'Reescribir para principiantes',
    chipScenario: 'Agregar un escenario de practica',
    changes: 'Cambios:',
  },
};

interface CourseAIBuilderPanelProps {
  language: 'en' | 'es';
}

export function CourseAIBuilderPanel({ language }: CourseAIBuilderPanelProps) {
  const t = STRINGS[language];
  const { sendMessage, messages, isLoading, clearChat } = useCourseBuilderChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    sendMessage(trimmed, language);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChip = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const chips = [
    t.chipTip,
    t.chipExpand,
    t.chipConcise,
    t.chipTakeaways,
    t.chipSimplify,
    t.chipScenario,
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 pb-3 mb-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t.title}</h3>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={clearChat}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {t.clear}
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center py-4">
              {t.empty}
            </p>
            {/* Quick-start chips */}
            <div className="flex flex-wrap gap-2 justify-center">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChip(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary/20 text-primary hover:bg-primary/5 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} language={language} />
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 pt-3 mt-3 border-t">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Chat bubble ---
function ChatBubble({ message, language }: { message: CourseBuilderChatMessage; language: 'en' | 'es' }) {
  const t = STRINGS[language];
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted',
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Change summary for assistant messages */}
        {!isUser && message.changeSummary && message.changeSummary.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-1">
              {t.changes}
            </p>
            <ul className="text-xs space-y-0.5 opacity-80">
              {message.changeSummary.map((change, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="shrink-0 mt-0.5">-</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
