/**
 * useTTS Hook
 *
 * Text-to-speech playback via the /tts edge function.
 * Calls OpenAI TTS, receives MP3, plays via HTMLAudioElement.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface UseTTSReturn {
  /** Convert text to speech and play it */
  speak: (text: string) => Promise<void>;
  /** Stop current playback */
  stop: () => void;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Whether audio is being generated (API call in progress) */
  isGenerating: boolean;
  /** Error from the last operation */
  error: string | null;
}

export function useTTS(): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Cleanup audio resources
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const speak = useCallback(async (text: string) => {
    // Stop any current playback
    cleanup();
    setError(null);
    setIsGenerating(true);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Call /tts edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice: 'nova' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `TTS failed (${response.status})`);
      }

      // Create blob and play
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        setError('Audio playback failed');
      };

      setIsGenerating(false);
      await audio.play();
    } catch (err) {
      setIsGenerating(false);
      const message = err instanceof Error ? err.message : 'TTS failed';
      setError(message);
      console.error('[useTTS] Error:', err);
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return { speak, stop, isPlaying, isGenerating, error };
}
