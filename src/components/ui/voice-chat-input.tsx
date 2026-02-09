/**
 * VoiceChatInput Component
 * 
 * A composite input component with voice recording capability.
 * Includes microphone button, wave/send action button, and elapsed time display.
 * 
 * Icon states:
 * - Empty: Mic + Wave (disabled, "Coming soon")
 * - Has text: Mic + Send
 * - Recording: Mic (pulsing red) + Stop + Timer
 * - Transcribing: Mic (disabled) + Loader
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
    voiceMode: language === 'es' ? 'Próximamente' : 'Coming soon',
    voiceModeActive: language === 'es' ? 'Modo voz' : 'Voice mode',
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

  // Handle action button click (send/stop)
  const handleActionClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (hasText && !isProcessing) {
      onSubmit();
    }
    // Wave icon click does nothing (future voice mode)
  };

  // Determine action button state
  const getActionButton = () => {
    // Transcribing: show loader
    if (isTranscribing) {
      return (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled
          className="shrink-0"
          aria-label={labels.transcribing}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      );
    }

    // Can retry: show retry button
    if (canRetry) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => retryTranscription()}
                className="shrink-0"
                aria-label={labels.retry}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{labels.retry}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Recording: show stop button
    if (isRecording) {
      return (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          onClick={handleActionClick}
          className="shrink-0"
          aria-label={labels.stop}
        >
          <Square className="h-4 w-4" />
        </Button>
      );
    }

    // Has text: show send button
    if (hasText) {
      return (
        <Button
          type="button"
          size="icon"
          onClick={handleActionClick}
          disabled={isProcessing}
          className="shrink-0"
          aria-label={labels.send}
        >
          <Send className="h-4 w-4" />
        </Button>
      );
    }

    // Default: show wave icon (voice mode if enabled, otherwise disabled)
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant={voiceEnabled ? 'outline' : 'ghost'}
              disabled={!voiceEnabled}
              onClick={() => voiceEnabled && onVoiceMode?.()}
              className={cn(
                'shrink-0',
                !voiceEnabled && 'opacity-50'
              )}
              aria-label={voiceEnabled ? labels.voiceModeActive : labels.voiceMode}
            >
              <AudioWaveform className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{voiceEnabled ? labels.voiceModeActive : labels.voiceMode}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className={cn('flex gap-sm items-center', className)}>
      {/* Text Input */}
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isTranscribing ? labels.transcribing : placeholder}
        disabled={disabled || isTranscribing}
        className="flex-1"
      />

      {/* Button Group */}
      <div className="flex gap-xs items-center">
        {/* Recording Timer Badge */}
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

        {/* Mic Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant={isRecording ? 'destructive' : 'ghost'}
                onClick={handleMicClick}
                disabled={!canRecord && !isRecording}
                className={cn(
                  'shrink-0 relative',
                  isRecording && (isWarning ? 'recording-indicator-warning' : 'recording-indicator'),
                  isRecording && 'bg-destructive text-destructive-foreground'
                )}
                aria-label={isRecording ? labels.stop : labels.record}
              >
                <Mic className="h-4 w-4" />
              </Button>
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

        {/* Action Button (Wave/Send/Stop/Loader) */}
        {getActionButton()}
      </div>
    </div>
  );
}
