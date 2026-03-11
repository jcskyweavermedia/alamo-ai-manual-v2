/**
 * WizardInputToolbar
 *
 * Button row for WizardRichInput: Paperclip, Camera, Mic + timer badge.
 * Uses hidden file inputs for camera capture and file upload.
 */

import { useRef } from 'react';
import { Paperclip, Camera, Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRecordingTime, isRecordingSupported } from '@/hooks/use-voice-recording';

interface WizardInputToolbarProps {
  enableVoice?: boolean;
  enableAttachments?: boolean;
  enableCamera?: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  isWarning: boolean;
  elapsedSeconds: number;
  onMicClick: () => void;
  onFileSelect: (files: FileList) => void;
  language?: 'en' | 'es';
}

export function WizardInputToolbar({
  enableVoice = true,
  enableAttachments = true,
  enableCamera = true,
  isRecording,
  isTranscribing,
  isWarning,
  elapsedSeconds,
  onMicClick,
  onFileSelect,
  language = 'en',
}: WizardInputToolbarProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canRecord = isRecordingSupported();

  // Don't render empty toolbar wrapper
  if (!enableVoice && !enableAttachments && !enableCamera) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files);
      e.target.value = '';
    }
  };

  const btnBase = cn(
    'flex items-center justify-center shrink-0',
    'h-8 w-8 rounded-full',
    'transition-colors duration-150',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  );
  const btnIdle = 'text-muted-foreground hover:text-foreground hover:bg-muted';

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border/50">
      {/* Paperclip — file upload */}
      {enableAttachments && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording || isTranscribing}
          className={cn(btnBase, btnIdle)}
          aria-label={language === 'es' ? 'Adjuntar archivo' : 'Attach file'}
        >
          <Paperclip className="h-4 w-4" />
        </button>
      )}

      {/* Camera — photo capture */}
      {enableCamera && (
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isRecording || isTranscribing}
          className={cn(btnBase, btnIdle)}
          aria-label={language === 'es' ? 'Tomar foto' : 'Take photo'}
        >
          <Camera className="h-4 w-4" />
        </button>
      )}

      {/* Mic — voice recording */}
      {enableVoice && (
        <>
          <button
            type="button"
            onClick={onMicClick}
            disabled={isTranscribing || (!canRecord && !isRecording)}
            className={cn(
              btnBase,
              isRecording
                ? cn(
                    'bg-destructive text-destructive-foreground',
                    isWarning ? 'recording-indicator-warning' : 'recording-indicator',
                  )
                : isTranscribing
                  ? 'text-muted-foreground cursor-wait'
                  : btnIdle,
            )}
            aria-label={
              isRecording
                ? language === 'es' ? 'Detener grabaci\u00f3n' : 'Stop recording'
                : language === 'es' ? 'Grabar voz' : 'Record voice'
            }
          >
            {isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>

          {/* Timer badge */}
          {isRecording && (
            <span
              className={cn(
                'text-[11px] font-mono tabular-nums',
                isWarning ? 'text-destructive font-semibold' : 'text-muted-foreground',
              )}
            >
              {formatRecordingTime(elapsedSeconds)}
            </span>
          )}
        </>
      )}

      {/* Hidden file inputs */}
      {enableCamera && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />
      )}
      {enableAttachments && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,.txt,.pdf,application/pdf,text/plain"
          multiple
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
