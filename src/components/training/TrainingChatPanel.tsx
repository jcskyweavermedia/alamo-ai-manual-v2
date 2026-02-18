import { useState, useRef, useEffect } from 'react';
import {
  GraduationCap,
  Send,
  RotateCcw,
  MessageSquarePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ChatBubble } from './ChatBubble';
import { SuggestedReplyChips } from './SuggestedReplyChips';
import { ProgressStrip } from './ProgressStrip';
import type { ConversationMessage } from '@/types/training';

interface TrainingChatPanelProps {
  sectionTitle: string;
  messages: ConversationMessage[];
  suggestedReplies: string[];
  topicsCovered: string[];
  topicsTotal: string[];
  shouldSuggestQuiz?: boolean;
  isSending: boolean;
  conversationId: string | null;
  existingConversations: any[];
  onSendMessage: (text: string) => void;
  onResumeSession: (conversation: any) => void;
  onStartNewSession: () => void;
  onStartQuiz?: () => void;
  language: 'en' | 'es';
  className?: string;
}

function LoadingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrainingChatPanel({
  sectionTitle,
  messages,
  suggestedReplies,
  topicsCovered,
  topicsTotal,
  shouldSuggestQuiz = false,
  isSending,
  conversationId,
  existingConversations,
  onSendMessage,
  onResumeSession,
  onStartNewSession,
  onStartQuiz,
  language,
  className,
}: TrainingChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showResume =
    messages.length === 0 && existingConversations.length > 0;
  const showEmpty =
    messages.length === 0 && existingConversations.length === 0;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <GraduationCap className="h-5 w-5 text-primary shrink-0" />
        <h3 className="text-sm font-semibold truncate">
          {language === 'es' ? 'Maestro IA' : 'AI Teacher'}
        </h3>
      </div>

      {/* Progress strip */}
      {topicsTotal.length > 0 && (
        <div className="px-4 py-2 border-b shrink-0">
          <ProgressStrip
            covered={topicsCovered.length}
            total={topicsTotal.length}
            language={language}
          />
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {showEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {language === 'es'
                ? 'Envía un mensaje para comenzar tu sesión de aprendizaje.'
                : 'Send a message to start your learning session.'}
            </p>
          </div>
        )}

        {showResume && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              {language === 'es'
                ? 'Tienes sesiones anteriores'
                : 'You have previous sessions'}
            </p>
            {existingConversations.slice(0, 3).map((conv: any) => (
              <Card
                key={conv.id}
                className="cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => onResumeSession(conv)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(conv.updated_at).toLocaleDateString(
                        language === 'es' ? 'es' : 'en',
                        {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {conv.messages?.length ?? 0}{' '}
                      {language === 'es' ? 'mensajes' : 'messages'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onStartNewSession}
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              {language === 'es' ? 'Nueva sesión' : 'New session'}
            </Button>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble
            key={`${i}-${msg.timestamp}`}
            role={msg.role}
            content={msg.content}
            timestamp={new Date(msg.timestamp).toLocaleTimeString(
              language === 'es' ? 'es' : 'en',
              { hour: '2-digit', minute: '2-digit' }
            )}
          />
        ))}

        {isSending && <LoadingDots />}

        {!isSending && suggestedReplies.length > 0 && messages.length > 0 && (
          <SuggestedReplyChips
            chips={suggestedReplies}
            onSelect={(chip) => onSendMessage(chip)}
            disabled={isSending}
          />
        )}

        {shouldSuggestQuiz && onStartQuiz && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-300 hover:bg-green-50"
              onClick={onStartQuiz}
            >
              {language === 'es'
                ? '¿Listo para el quiz?'
                : 'Ready for the quiz?'}
            </Button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t shrink-0">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            language === 'es'
              ? 'Escribe tu respuesta...'
              : 'Type your answer...'
          }
          disabled={isSending}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isSending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
