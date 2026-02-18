import { useState, useRef, useEffect } from 'react';
import {
  GraduationCap,
  Send,
  RotateCcw,
  MessageSquarePlus,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ChatBubble } from './ChatBubble';
import type { TutorMessage } from '@/types/training';

interface TutorChatPanelProps {
  messages: TutorMessage[];
  readinessScore: number;
  suggestTest: boolean;
  isSending: boolean;
  existingSessions: any[];
  onSendMessage: (text: string) => void;
  onResumeSession: (session: any) => void;
  onStartNewSession: () => void;
  onTakeTest?: () => void;
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

function ReadinessBar({ score, language }: { score: number; language: 'en' | 'es' }) {
  const barColor = score >= 75
    ? 'bg-green-500'
    : score >= 40
      ? 'bg-amber-500'
      : 'bg-blue-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">
          {language === 'es' ? 'Preparacion' : 'Readiness'}
        </span>
        <span className="text-foreground font-semibold">{score}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}

export function TutorChatPanel({
  messages,
  readinessScore,
  suggestTest,
  isSending,
  existingSessions,
  onSendMessage,
  onResumeSession,
  onStartNewSession,
  onTakeTest,
  language,
  className,
}: TutorChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const showResume = messages.length === 0 && existingSessions.length > 0;
  const showEmpty = messages.length === 0 && existingSessions.length === 0;
  const isEs = language === 'es';

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Readiness bar */}
      <div className="px-4 py-2 border-b shrink-0">
        <ReadinessBar score={readinessScore} language={language} />
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {showEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {isEs
                ? 'Envia un mensaje para comenzar a practicar.'
                : 'Send a message to start practicing.'}
            </p>
          </div>
        )}

        {showResume && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              {isEs ? 'Tienes sesiones anteriores' : 'You have previous sessions'}
            </p>
            {existingSessions.slice(0, 3).map((sess: any) => (
              <Card
                key={sess.id}
                className="cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => onResumeSession(sess)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(sess.updated_at).toLocaleDateString(
                        isEs ? 'es' : 'en',
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {isEs ? 'Preparacion' : 'Readiness'}: {sess.readiness_score ?? 0}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={onStartNewSession}>
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              {isEs ? 'Nueva sesion' : 'New session'}
            </Button>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble
            key={`${i}-${msg.timestamp}`}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString(
                  isEs ? 'es' : 'en',
                  { hour: '2-digit', minute: '2-digit' }
                )
              : ''
            }
          />
        ))}

        {isSending && <LoadingDots />}

        {suggestTest && onTakeTest && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-300 hover:bg-green-50"
              onClick={onTakeTest}
            >
              <ClipboardCheck className="h-4 w-4 mr-2" />
              {isEs
                ? 'Tomar el Examen de Certificacion'
                : 'Take the Certification Test'}
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
          placeholder={isEs ? 'Escribe tu respuesta...' : 'Type your answer...'}
          disabled={isSending}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim() || isSending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
