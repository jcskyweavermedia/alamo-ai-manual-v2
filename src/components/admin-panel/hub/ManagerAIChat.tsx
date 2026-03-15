// =============================================================================
// ManagerAIChat -- Chat conversation display for the training manager AI
// =============================================================================

import { useEffect, useRef } from 'react';
import { Sparkles, User } from 'lucide-react';
import type { ManagerAIMessage } from '@/hooks/use-ask-training-manager';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ManagerAIChatProps {
  messages: ManagerAIMessage[];
  isLoading: boolean;
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManagerAIChat({ messages, isLoading, language }: ManagerAIChatProps) {
  const t = ADMIN_STRINGS[language];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-8 text-center">
        <Sparkles className="h-8 w-8 mx-auto mb-3 text-orange-500" />
        <p className="text-sm font-medium text-foreground mb-1">{t.managerChatWelcome}</p>
        <p className="text-xs text-muted-foreground">{t.managerChatHint}</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
      <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-orange-500 text-white'
                : 'bg-muted text-foreground'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="whitespace-pre-wrap [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4">
                  {msg.content}
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
            </div>
            <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
