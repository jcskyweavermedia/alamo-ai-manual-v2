/**
 * VoiceTranscript
 * 
 * Displays voice conversation transcript entries in a chat-style layout.
 * Shows the last N entries (default 5) with auto-scroll to latest.
 * 
 * Part of Step 11: Integrated Voice Chat Mode
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranscriptEntry } from '@/hooks/use-realtime-webrtc';

// =============================================================================
// TYPES
// =============================================================================

interface VoiceTranscriptProps {
  /** Transcript entries to display */
  entries: TranscriptEntry[];
  /** Maximum entries to show (default 5) */
  maxEntries?: number;
  /** Current language */
  language: 'en' | 'es';
  /** Optional className */
  className?: string;
}

// =============================================================================
// LOCALIZED STRINGS
// =============================================================================

const strings = {
  en: {
    you: 'You',
    assistant: 'Assistant',
    listening: 'Listening...',
  },
  es: {
    you: 'Tú',
    assistant: 'Asistente',
    listening: 'Escuchando...',
  },
};

// =============================================================================
// TRANSCRIPT ENTRY COMPONENT
// =============================================================================

interface TranscriptBubbleProps {
  entry: TranscriptEntry;
  language: 'en' | 'es';
  isNew?: boolean;
}

function TranscriptBubble({ entry, language, isNew = false }: TranscriptBubbleProps) {
  const t = strings[language];
  const isUser = entry.role === 'user';

  return (
    <div
      className={cn(
        'flex flex-col gap-1 max-w-[85%]',
        isUser ? 'ml-auto items-end' : 'mr-auto items-start',
        isNew && 'animate-in fade-in-0 slide-in-from-bottom-2 duration-300'
      )}
    >
      {/* Role label */}
      <span className="text-xs font-medium text-muted-foreground px-1">
        {isUser ? t.you : t.assistant}
      </span>
      
      {/* Message bubble */}
      <div
        className={cn(
          'px-3 py-2 rounded-2xl text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        {entry.text}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VoiceTranscript({
  entries,
  maxEntries = 5,
  language,
  className,
}: VoiceTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const t = strings[language];

  // Get the last N entries
  const visibleEntries = entries.slice(-maxEntries);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    // ScrollArea uses a viewport inside - scroll the container's last child into view
    if (containerRef.current) {
      const lastChild = containerRef.current.lastElementChild;
      lastChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [entries.length]);

  // Empty state
  if (visibleEntries.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-4 bg-muted-foreground/50 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <span className="text-sm">{t.listening}</span>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('flex-1', className)}>
      <div ref={containerRef} className="space-y-3 py-3 px-1">
        {visibleEntries.map((entry, index) => {
          // Mark the last entry as "new" for animation
          const isNew = index === visibleEntries.length - 1;
          
          return (
            <TranscriptBubble
              key={`${entry.timestamp}-${index}`}
              entry={entry}
              language={language}
              isNew={isNew}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}
