/**
 * useVoiceRecording Hook
 *
 * Handles microphone access, audio recording, and transcription via OpenAI Whisper.
 *
 * Features:
 * - MediaRecorder with audio/webm format
 * - Elapsed time tracking
 * - Configurable max recording duration (default 60s)
 * - Optional silence detection via AudioContext + AnalyserNode
 * - Error handling for permissions and transcription
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// =============================================================================
// TYPES
// =============================================================================

type RecordingState = 'idle' | 'recording' | 'transcribing';

interface UseVoiceRecordingOptions {
  /** Language hint for transcription ('en' | 'es') */
  language?: 'en' | 'es';
  /** Callback when transcription completes */
  onTranscription?: (text: string) => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
  /** Auto-stop after this many ms of silence. 0 = disabled (default) */
  silenceTimeoutMs?: number;
  /** Max recording duration in seconds (default: 60) */
  maxRecordingSeconds?: number;
}

interface UseVoiceRecordingReturn {
  /** Current recording state */
  state: RecordingState;
  /** Is currently recording */
  isRecording: boolean;
  /** Is currently transcribing */
  isTranscribing: boolean;
  /** Elapsed recording time in seconds */
  elapsedSeconds: number;
  /** Whether in warning zone (near max time) */
  isWarning: boolean;
  /** Current error message */
  error: string | null;
  /** Whether retry is available (has failed audio blob) */
  canRetry: boolean;
  /** Current audio input level (0–1), updated ~10fps while recording */
  audioLevel: number;
  /** Start recording from microphone */
  startRecording: () => Promise<void>;
  /** Stop recording and begin transcription */
  stopRecording: () => Promise<void>;
  /** Cancel recording without transcription */
  cancelRecording: () => void;
  /** Retry transcription of last failed audio */
  retryTranscription: () => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useVoiceRecording(options: UseVoiceRecordingOptions = {}): UseVoiceRecordingReturn {
  const { language = 'en', onTranscription, onError, silenceTimeoutMs = 0, maxRecordingSeconds = 60 } = options;

  // Configurable limits
  const maxSeconds = maxRecordingSeconds;
  const warningSeconds = maxSeconds - 10;

  // State
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const lastLevelUpdateRef = useRef<number>(0);

  // Derived state
  const canRetry = lastAudioBlobRef.current !== null && state === 'idle' && error !== null;
  const isRecording = state === 'recording';
  const isTranscribing = state === 'transcribing';
  const isWarning = elapsedSeconds >= warningSeconds;

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Reset audio level
    setAudioLevel(0);

    // Cancel silence detection animation frame
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Close AudioContext used for silence detection
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping media recorder:', e);
      }
    }
    mediaRecorderRef.current = null;

    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear chunks
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Transcribe audio blob
  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    console.log(`Transcribing audio: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', language);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('transcribe', {
        body: formData,
      });

      if (invokeError) {
        console.error('Transcription invoke error:', invokeError);
        throw new Error(invokeError.message || 'Transcription failed');
      }

      if (data?.error) {
        console.error('Transcription API error:', data.error);
        throw new Error(data.error);
      }

      return data?.text || null;
    } catch (err) {
      console.error('Transcription error:', err);
      throw err;
    }
  }, [language]);

  // Start recording
  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      // Request microphone access
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      console.log('Microphone access granted');

      // Determine supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      console.log(`Using mimeType: ${mimeType}`);

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, chunks:', chunksRef.current.length);
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        const errorMessage = 'Recording failed. Please try again.';
        setError(errorMessage);
        onError?.(errorMessage);
        cleanup();
        setState('idle');
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setState('recording');
      setElapsedSeconds(0);

      // Start elapsed time counter
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          // Auto-stop at max time
          if (next >= maxSeconds) {
            console.log('Auto-stopping at max recording time');
            // Use setTimeout to avoid state update during render
            setTimeout(() => {
              if (mediaRecorderRef.current?.state === 'recording') {
                stopRecordingInternal();
              }
            }, 0);
          }
          return next;
        });
      }, 1000);

      // Set up silence detection if enabled
      if (silenceTimeoutMs > 0) {
        try {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          lastSoundTimeRef.current = Date.now();

          const checkSilence = () => {
            // Bail out if recording has already stopped
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
              return;
            }

            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

            // Throttled audio level update (~10fps)
            const now = Date.now();
            if (now - lastLevelUpdateRef.current > 100) {
              lastLevelUpdateRef.current = now;
              setAudioLevel(Math.min(average / 80, 1)); // normalize: 80+ → 1.0
            }

            if (average > 10) {
              lastSoundTimeRef.current = Date.now();
            } else if (Date.now() - lastSoundTimeRef.current > silenceTimeoutMs) {
              console.log('Auto-stopping due to silence');
              // Use setTimeout(0) to avoid calling during rAF
              setTimeout(() => stopRecordingInternal(), 0);
              return;
            }

            animFrameRef.current = requestAnimationFrame(checkSilence);
          };

          animFrameRef.current = requestAnimationFrame(checkSilence);
          console.log(`Silence detection enabled (timeout: ${silenceTimeoutMs}ms)`);
        } catch (err) {
          console.warn('Failed to set up silence detection:', err);
          // Non-fatal — recording continues without silence detection
        }
      }

    } catch (err) {
      console.error('Error starting recording:', err);
      
      let errorMessage = 'Failed to access microphone.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        }
      }

      setError(errorMessage);
      onError?.(errorMessage);
      toast({
        title: language === 'es' ? 'Error de micrófono' : 'Microphone Error',
        description: errorMessage,
        variant: 'destructive',
      });
      cleanup();
      setState('idle');
    }
  }, [cleanup, language, onError, silenceTimeoutMs, maxSeconds]);

  // Internal stop recording (for auto-stop)
  const stopRecordingInternal = useCallback(async () => {
    if (!mediaRecorderRef.current || state !== 'recording') {
      return;
    }

    // Stop timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState('transcribing');

    // Wait for final data
    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve();
        return;
      }

      recorder.onstop = async () => {
        // Stop stream tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Create audio blob
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
        console.log(`Created audio blob: ${audioBlob.size} bytes`);

        if (audioBlob.size < 1000) {
          const errorMessage = language === 'es' 
            ? 'Grabación muy corta. Por favor, intenta de nuevo.'
            : 'Recording too short. Please try again.';
          setError(errorMessage);
          onError?.(errorMessage);
          toast({
            title: language === 'es' ? 'Error' : 'Error',
            description: errorMessage,
            variant: 'destructive',
          });
          setState('idle');
          setElapsedSeconds(0);
          chunksRef.current = [];
          resolve();
          return;
        }

        try {
          const text = await transcribeAudio(audioBlob);
          if (text) {
            console.log(`Transcription result: ${text.substring(0, 50)}...`);
            onTranscription?.(text);
            // Clear saved blob on success
            lastAudioBlobRef.current = null;
          } else {
            const errorMessage = language === 'es'
              ? 'No se pudo transcribir el audio.'
              : 'Could not transcribe audio.';
            setError(errorMessage);
            onError?.(errorMessage);
            // Save blob for retry
            lastAudioBlobRef.current = audioBlob;
          }
        } catch (err) {
          const errorMessage = language === 'es'
            ? 'Error al transcribir. Por favor, intenta de nuevo.'
            : 'Transcription failed. Please try again.';
          setError(errorMessage);
          onError?.(errorMessage);
          // Save blob for retry
          lastAudioBlobRef.current = audioBlob;
          toast({
            title: language === 'es' ? 'Error de transcripción' : 'Transcription Error',
            description: errorMessage,
            variant: 'destructive',
          });
        } finally {
          setState('idle');
          setElapsedSeconds(0);
          chunksRef.current = [];
          mediaRecorderRef.current = null;
          resolve();
        }
      };

      recorder.stop();
    });
  }, [state, language, onTranscription, onError, transcribeAudio]);

  // Stop recording (public API)
  const stopRecording = useCallback(async () => {
    await stopRecordingInternal();
  }, [stopRecordingInternal]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    console.log('Cancelling recording');
    cleanup();
    setState('idle');
    setElapsedSeconds(0);
    setError(null);
    lastAudioBlobRef.current = null;
  }, [cleanup]);

  // Retry transcription with last saved audio
  const retryTranscription = useCallback(async () => {
    if (!lastAudioBlobRef.current || state !== 'idle') {
      return;
    }

    const audioBlob = lastAudioBlobRef.current;
    setError(null);
    setState('transcribing');

    try {
      const text = await transcribeAudio(audioBlob);
      if (text) {
        console.log(`Retry transcription result: ${text.substring(0, 50)}...`);
        onTranscription?.(text);
        lastAudioBlobRef.current = null;
      } else {
        const errorMessage = language === 'es'
          ? 'No se pudo transcribir el audio.'
          : 'Could not transcribe audio.';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = language === 'es'
        ? 'Error al transcribir. Por favor, intenta de nuevo.'
        : 'Transcription failed. Please try again.';
      setError(errorMessage);
      onError?.(errorMessage);
      toast({
        title: language === 'es' ? 'Error de transcripción' : 'Transcription Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setState('idle');
    }
  }, [state, language, transcribeAudio, onTranscription, onError]);

  return {
    state,
    isRecording,
    isTranscribing,
    elapsedSeconds,
    isWarning,
    error,
    canRetry,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    retryTranscription,
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Format seconds as MM:SS
 */
export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if browser supports audio recording
 */
export function isRecordingSupported(): boolean {
  return !!(
    navigator.mediaDevices?.getUserMedia &&
    window.MediaRecorder
  );
}
