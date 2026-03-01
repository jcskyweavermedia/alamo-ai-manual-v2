/**
 * FormHeroMicButton
 *
 * Large, prominent microphone button for the form header.
 * Replaces the old FormAIFillButton (sparkles pill).
 *
 * Visual states:
 * - Idle (no history): h-12 w-12 orange circle, Mic icon h-6 w-6
 * - Idle (has history): h-10 w-10 orange circle, Mic icon h-5 w-5
 * - Recording: red bg, audio-level ring, Square stop icon, timer badge
 * - Transcribing: orange bg, Loader2 spinner, disabled
 */

import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRecordingTime, isRecordingSupported } from '@/hooks/use-voice-recording';

interface FormHeroMicButtonProps {
  language: 'en' | 'es';
  disabled?: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  elapsedSeconds: number;
  isWarning: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  hasHistory: boolean;
}

const STRINGS = {
  en: {
    record: 'Tap to speak',
    stop: 'Stop recording',
    transcribing: 'Transcribing...',
  },
  es: {
    record: 'Toca para hablar',
    stop: 'Detener grabacion',
    transcribing: 'Transcribiendo...',
  },
} as const;

export function FormHeroMicButton({
  language,
  disabled,
  isRecording,
  isTranscribing,
  audioLevel,
  elapsedSeconds,
  isWarning,
  onStartRecording,
  onStopRecording,
  hasHistory,
}: FormHeroMicButtonProps) {
  const t = STRINGS[language];
  const supported = isRecordingSupported();
  const isActive = isRecording || isTranscribing;

  // Size based on whether there's conversation history
  const large = !hasHistory;
  const sizeClass = large ? 'h-12 w-12' : 'h-10 w-10';
  const iconClass = large ? 'h-6 w-6' : 'h-5 w-5';

  const handleClick = () => {
    if (isRecording) {
      onStopRecording();
    } else if (!isTranscribing) {
      onStartRecording();
    }
  };

  const ariaLabel = isRecording
    ? t.stop
    : isTranscribing
      ? t.transcribing
      : t.record;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Timer badge (shown beside button when recording) */}
      {isRecording && (
        <span
          className={cn(
            'text-xs font-mono tabular-nums px-2 py-1 rounded-md',
            'animate-in fade-in-0 duration-200',
            isWarning
              ? 'bg-warning/20 text-warning-foreground'
              : 'bg-destructive/10 text-destructive',
          )}
        >
          {formatRecordingTime(elapsedSeconds)}
        </span>
      )}

      {/* Mic button with audio-level ring */}
      <div className="relative shrink-0">
        {/* Audio-level ring */}
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
          onClick={handleClick}
          disabled={disabled || !supported || isTranscribing}
          className={cn(
            'relative flex items-center justify-center',
            sizeClass,
            'rounded-full',
            'transition-all duration-200',
            'shadow-md',
            // State-based colors
            isRecording
              ? 'bg-destructive text-destructive-foreground'
              : isTranscribing
                ? 'bg-orange-500 text-white'
                : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95',
            // Disabled
            (disabled || !supported || isTranscribing) &&
              !isRecording &&
              'opacity-40 cursor-not-allowed',
            // Active ring when panel is active (recording/transcribing)
            isActive && 'ring-2 ring-offset-2 ring-offset-background ring-destructive/40',
          )}
          aria-label={ariaLabel}
        >
          {isTranscribing ? (
            <Loader2 className={cn(iconClass, 'animate-spin')} />
          ) : isRecording ? (
            <Square className={cn(large ? 'h-5 w-5' : 'h-4 w-4')} />
          ) : (
            <Mic className={iconClass} />
          )}
        </button>
      </div>
    </div>
  );
}
