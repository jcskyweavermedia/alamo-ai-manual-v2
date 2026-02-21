/**
 * VoiceChatInput Component
 *
 * A composite input component with voice recording capability.
 * 2-icon layout: Mic (left) | Text Input | Waveform/Send (right, orange).
 *
 * Icon states (right button, solid orange circle):
 * - Empty (no text): AudioWaveform — triggers onVoiceMode (live voice)
 * - Has text: Send — submits text
 * - Recording: Square (stop, destructive red) — stops recording
 * - Transcribing: Loader2 spinning, disabled
 * - Can retry: RotateCcw outline
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Mic, AudioWaveform, Send, Square, Loader2, RotateCcw } from 'lucide-react';
import {
  useVoiceRecording,
  formatRecordingTime,
  isRecordingSupported,
} from '@/hooks/use-voice-recording';

// =============================================================================
// TYPES
// =============================================================================

interface VoiceChatInputProps {
  /** Current input value */
  value: string;
  /** Called when input value changes */
  onChange: (value: string) => void;
  /** Called when user submits (send button or Enter) */
  onSubmit: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Whether a request is loading (affects send button) */
  isLoading?: boolean;
  /** Language for transcription and labels */
  language?: 'en' | 'es';
  /** Whether voice mode is enabled for user */
  voiceEnabled?: boolean;
  /** Called when voice mode button is clicked */
  onVoiceMode?: () => void;
  /** Additional className */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function VoiceChatInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  isLoading = false,
  language = 'en',
  voiceEnabled = false,
  onVoiceMode,
  className,
}: VoiceChatInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Voice recording hook
  const {
    isRecording,
    isTranscribing,
    elapsedSeconds,
    isWarning,
    canRetry,
    startRecording,
    stopRecording,
    cancelRecording,
    retryTranscription,
  } = useVoiceRecording({
    language,
    onTranscription: (text) => {
      // Append transcribed text to existing value
      const newValue = value ? `${value} ${text}` : text;
      onChange(newValue);
      // Focus input after transcription
      inputRef.current?.focus();
    },
  });

  // Derived state
  const hasText = value.trim().length > 0;
  const canRecord = isRecordingSupported() && !disabled && !isLoading;
  const isProcessing = isLoading || isTranscribing;

  // Labels
  const labels = {
    record: language === 'es' ? 'Grabar voz' : 'Record voice',
    stop: language === 'es' ? 'Detener grabación' : 'Stop recording',
    send: language === 'es' ? 'Enviar' : 'Send',
    retry: language === 'es' ? 'Reintentar transcripción' : 'Retry transcription',
    voiceMode: language === 'es' ? 'Modo voz' : 'Voice mode',
    transcribing: language === 'es' ? 'Transcribiendo...' : 'Transcribing...',
    micNotSupported: language === 'es'
      ? 'Micrófono no disponible'
      : 'Microphone not available',
  };

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && hasText && !isProcessing) {
      e.preventDefault();
      onSubmit();
    }
    // Escape cancels recording
    if (e.key === 'Escape' && isRecording) {
      e.preventDefault();
      cancelRecording();
    }
  };

  // Handle mic button click
  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (canRecord) {
      startRecording();
    }
  };

  // Handle right action button click
  const handleActionClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (hasText && !isProcessing) {
      onSubmit();
    } else if (!hasText && voiceEnabled) {
      onVoiceMode?.();
    }
  };

  // Base styles for the right-side circle button
  const circleBase = 'shrink-0 flex items-center justify-center w-9 h-9 rounded-full transition-colors';

  // Determine right action button (plain <button> to avoid Button min-h/px overrides)
  const getActionButton = () => {
    // Transcribing: show loader (orange, disabled)
    if (isTranscribing) {
      return (
        <button
          type="button"
          disabled
          className={cn(circleBase, 'bg-orange-500 text-white opacity-70')}
          aria-label={labels.transcribing}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </button>
      );
    }

    // Can retry: show retry button (outline)
    if (canRetry) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => retryTranscription()}
                className={cn(circleBase, 'border border-input text-foreground hover:bg-accent')}
                aria-label={labels.retry}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{labels.retry}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Recording: stop button (red)
    if (isRecording) {
      return (
        <button
          type="button"
          onClick={handleActionClick}
          className={cn(circleBase, 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
          aria-label={labels.stop}
        >
          <Square className="h-4 w-4" />
        </button>
      );
    }

    // Has text: send button (orange)
    if (hasText) {
      return (
        <button
          type="button"
          onClick={handleActionClick}
          disabled={isProcessing}
          className={cn(circleBase, 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50')}
          aria-label={labels.send}
        >
          <Send className="h-4 w-4" />
        </button>
      );
    }

    // Default: AudioWaveform (orange circle) — triggers voice mode
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!voiceEnabled}
              onClick={() => voiceEnabled && onVoiceMode?.()}
              className={cn(
                circleBase,
                'bg-orange-500 text-white hover:bg-orange-600',
                !voiceEnabled && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={labels.voiceMode}
            >
              <AudioWaveform className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{labels.voiceMode}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className={cn('flex gap-sm items-center', className)}>
      {/* Recording Timer Badge (left edge when recording) */}
      {isRecording && (
        <span
          className={cn(
            'text-small font-mono tabular-nums px-2 py-1 rounded-md',
            isWarning
              ? 'bg-warning/20 text-warning-foreground dark:bg-warning/10'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          {formatRecordingTime(elapsedSeconds)}
        </span>
      )}

      {/* Text Input (flex-1) */}
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isTranscribing ? labels.transcribing : placeholder}
        disabled={disabled || isTranscribing}
        className="flex-1 focus-visible:ring-orange-500"
      />

      {/* Right button group: Mic + Action */}
      <div className="flex gap-1 items-center">
        {/* Mic Button — plain icon, no background */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleMicClick}
                disabled={!canRecord && !isRecording}
                className={cn(
                  'shrink-0 relative flex items-center justify-center w-9 h-9 rounded-full transition-colors',
                  'disabled:pointer-events-none disabled:opacity-50',
                  isRecording
                    ? cn(
                        'bg-destructive text-destructive-foreground',
                        isWarning ? 'recording-indicator-warning' : 'recording-indicator'
                      )
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={isRecording ? labels.stop : labels.record}
              >
                <Mic className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {!canRecord && !isRecording
                  ? labels.micNotSupported
                  : isRecording
                    ? labels.stop
                    : labels.record}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Action Button — Waveform/Send/Stop/Loader (orange circle) */}
        {getActionButton()}
      </div>
    </div>
  );
}
