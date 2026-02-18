/**
 * useRealtimeWebRTC
 *
 * React hook for WebRTC-based voice conversation with OpenAI Realtime API.
 * Provides native audio handling for smooth, gap-free playback.
 *
 * Key benefits over WebSocket approach:
 * - Native browser audio buffering/jitter management
 * - Lower latency (direct P2P-like connection)
 * - No manual PCM/WAV encoding needed
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface UseRealtimeWebRTCOptions {
  language: 'en' | 'es';
  groupId: string;
  /** Product domain for product-context voice sessions */
  domain?: string;
  /** Action key (e.g. practicePitch, quizMe) */
  action?: string;
  /** Full item data for product context */
  itemContext?: Record<string, unknown>;
  /** Listen-only mode: skip mic, auto-disconnect after AI speaks */
  listenOnly?: boolean;
  /** Skip AI greeting — connect with mic ready but don't trigger AI to speak first */
  skipGreeting?: boolean;
  onTranscript?: (entry: TranscriptEntry) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: WebRTCVoiceState) => void;
}

// Product search tool names that the realtime-search function supports
const PRODUCT_SEARCH_TOOLS = new Set([
  'search_dishes',
  'search_wines',
  'search_cocktails',
  'search_recipes',
  'search_beer_liquor',
  'search_steps_of_service',
]);

export type WebRTCVoiceState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'processing'
  | 'speaking';

export interface UseRealtimeWebRTCReturn {
  state: WebRTCVoiceState;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: TranscriptEntry[];
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// =============================================================================
// HOOK
// =============================================================================

export function useRealtimeWebRTC(options: UseRealtimeWebRTCOptions): UseRealtimeWebRTCReturn {
  const { language, groupId, domain, action, itemContext, listenOnly, skipGreeting, onTranscript, onError, onStateChange } = options;

  // State
  const [state, setState] = useState<WebRTCVoiceState>('disconnected');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const ephemeralKeyRef = useRef<string | null>(null);
  const assistantTextRef = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const sessionReadyRef = useRef(false);
  const messageHandlerRef = useRef<(event: MessageEvent) => void>(() => {});

  // Derived state
  const isConnected = state !== 'disconnected' && state !== 'connecting';
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';

  // Update state and notify
  const updateState = useCallback((newState: WebRTCVoiceState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Add transcript entry
  const addTranscript = useCallback((role: 'user' | 'assistant', text: string) => {
    const entry: TranscriptEntry = {
      role,
      text,
      timestamp: Date.now(),
    };
    setTranscript(prev => [...prev, entry]);
    onTranscript?.(entry);
  }, [onTranscript]);

  // Handle tool calls (search_handbook + product search tools)
  const handleToolCall = useCallback(async (name: string, callId: string, args: string) => {
    const isHandbook = name === 'search_handbook';
    const isProduct = PRODUCT_SEARCH_TOOLS.has(name);

    if (!isHandbook && !isProduct) {
      console.log('[WebRTC] Unknown tool:', name);
      return;
    }

    try {
      const parsedArgs = JSON.parse(args);
      const query = parsedArgs.query;
      console.log(`[WebRTC] Tool call: ${name}, query:`, query);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Call search edge function with tool parameter
      const response = await fetch(`${SUPABASE_URL}/functions/v1/realtime-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, language, groupId, tool: name }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const result = await response.json();
      console.log('[WebRTC] Search returned', result.sections?.length || 0, 'results');

      // Send result back via data channel
      if (dcRef.current?.readyState === 'open') {
        dcRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: result.content,
          },
        }));

        // Request response with the tool result
        dcRef.current.send(JSON.stringify({ type: 'response.create' }));
      }
    } catch (err) {
      console.error('[WebRTC] Tool call failed:', err);

      // Send error response
      if (dcRef.current?.readyState === 'open') {
        dcRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: language === 'es'
              ? 'La búsqueda falló. Por favor intenta de nuevo.'
              : 'Search failed. Please try again.',
          },
        }));
        dcRef.current.send(JSON.stringify({ type: 'response.create' }));
      }
    }
  }, [language, groupId]);

  // Handle data channel messages
  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[WebRTC] Event:', data.type);

      switch (data.type) {
        // Session ready
        case 'session.created':
        case 'session.updated':
          console.log('[WebRTC] Session ready');
          sessionReadyRef.current = true;
          updateState('connected');
          // In product mode, trigger AI greeting if data channel is already open
          if (dcRef.current?.readyState === 'open' && domain && action && !skipGreeting) {
            console.log('[WebRTC] Product mode — triggering AI greeting');
            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
          }
          break;

        // User started speaking
        case 'input_audio_buffer.speech_started':
          console.log('[WebRTC] User speech started');
          updateState('listening');
          break;

        // User stopped speaking
        case 'input_audio_buffer.speech_stopped':
          console.log('[WebRTC] User speech stopped');
          updateState('processing');
          break;

        // User transcript
        case 'conversation.item.input_audio_transcription.completed':
          if (data.transcript) {
            console.log('[WebRTC] User transcript:', data.transcript);
            addTranscript('user', data.transcript);
          }
          break;

        // AI response started
        case 'response.created':
          console.log('[WebRTC] AI response started');
          assistantTextRef.current = '';
          break;

        // AI is speaking (audio handled natively by WebRTC)
        case 'response.output_audio.delta':
        case 'response.audio.delta':
          if (state !== 'speaking') {
            updateState('speaking');
          }
          break;

        // AI transcript delta
        case 'response.output_audio_transcript.delta':
        case 'response.audio_transcript.delta':
          if (data.delta) {
            assistantTextRef.current += data.delta;
          }
          break;

        // AI transcript complete
        case 'response.output_audio_transcript.done':
        case 'response.audio_transcript.done':
          if (assistantTextRef.current) {
            console.log('[WebRTC] AI transcript:', assistantTextRef.current);
            addTranscript('assistant', assistantTextRef.current);
            assistantTextRef.current = '';
          }
          break;

        // Tool call
        case 'response.function_call_arguments.done':
          console.log('[WebRTC] Tool call:', data.name, data.call_id);
          handleToolCall(data.name, data.call_id, data.arguments);
          break;

        // Response complete
        case 'response.done':
          console.log('[WebRTC] AI response complete');
          if (listenOnly) {
            // Check if this response was just a tool call (no audio output)
            const outputItems = data.response?.output || [];
            const hasAudio = outputItems.some(
              (item: any) => item.type === 'message'
            );
            if (hasAudio || outputItems.length === 0) {
              // Real audio response finished — soft disconnect
              // DON'T close the peer connection yet — audio is still buffering through WebRTC
              // Resources are cleaned up on next connect() or component unmount
              updateState('disconnected');
            } else {
              console.log('[WebRTC] Tool-call response — waiting for audio response');
            }
          } else {
            setTimeout(() => {
              if (pcRef.current?.connectionState === 'connected') {
                updateState('connected');
              }
            }, 300);
          }
          break;

        // Error
        case 'error':
          console.error('[WebRTC] Server error:', data.error);
          const errorMsg = data.error?.message || 'Unknown error';
          setError(errorMsg);
          onError?.(errorMsg);
          break;

        default:
          // Log unhandled for debugging
          if (!data.type?.startsWith('rate_limits')) {
            console.log('[WebRTC] Unhandled:', data.type);
          }
      }
    } catch (err) {
      console.error('[WebRTC] Failed to parse message:', err);
    }
  }, [state, updateState, addTranscript, handleToolCall, onError, domain, action, listenOnly]);

  // Keep message handler ref in sync (fixes stale closure)
  useEffect(() => {
    messageHandlerRef.current = handleDataChannelMessage;
  }, [handleDataChannelMessage]);

  // Cleanup
  const cleanup = useCallback(() => {
    console.log('[WebRTC] Cleaning up...');

    // Abort any in-flight connect
    abortRef.current?.abort();
    abortRef.current = null;

    // Reset session ready flag
    sessionReadyRef.current = false;

    // Close data channel
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Remove audio element
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }

    ephemeralKeyRef.current = null;
    updateState('disconnected');
  }, [updateState]);

  // Connect
  const connect = useCallback(async () => {
    if (pcRef.current) {
      // Clean up stale connection (e.g., listen-only audio still draining)
      console.log('[WebRTC] Cleaning up previous connection');
      cleanup();
    }

    // Abort any previous in-flight connect
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    try {
      setError(null);
      setTranscript([]); // Clear transcript for "Listen again"
      updateState('connecting');

      // =========================================================================
      // 1. GET EPHEMERAL KEY FROM OUR SERVER
      // =========================================================================
      console.log('[WebRTC] Getting ephemeral key...');

      const { data: { session } } = await supabase.auth.getSession();
      if (signal.aborted) { console.log('[WebRTC] Connect aborted'); return; }
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const sessionBody: Record<string, unknown> = { groupId, language };
      if (domain) sessionBody.domain = domain;
      if (action) sessionBody.action = action;
      if (itemContext) sessionBody.itemContext = itemContext;
      if (listenOnly) sessionBody.listenOnly = true;

      const sessionResponse = await fetch(`${SUPABASE_URL}/functions/v1/realtime-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionBody),
        signal,
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.message || errorData.error || 'Failed to create session');
      }

      const { ephemeralKey } = await sessionResponse.json();
      if (signal.aborted) { console.log('[WebRTC] Connect aborted'); return; }
      ephemeralKeyRef.current = ephemeralKey;
      console.log('[WebRTC] Ephemeral key obtained');

      // =========================================================================
      // 2. CREATE PEER CONNECTION
      // =========================================================================
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      if (signal.aborted) {
        console.log('[WebRTC] Connect aborted');
        pc.close();
        pcRef.current = null;
        return;
      }

      // =========================================================================
      // 3. SET UP AUDIO PLAYBACK (automatic via WebRTC!)
      // =========================================================================
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      pc.ontrack = (e) => {
        console.log('[WebRTC] Received audio track');
        audioEl.srcObject = e.streams[0];
      };

      // =========================================================================
      // 4. ADD MICROPHONE (skip in listen-only mode)
      // =========================================================================
      if (!listenOnly) {
        console.log('[WebRTC] Requesting microphone...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (signal.aborted) {
          console.log('[WebRTC] Connect aborted');
          stream.getTracks().forEach(track => track.stop());
          pc.close();
          pcRef.current = null;
          audioElRef.current = null;
          return;
        }

        mediaStreamRef.current = stream;
        pc.addTrack(stream.getTracks()[0]);
        console.log('[WebRTC] Microphone connected');
      } else {
        // Add receive-only audio transceiver so SDP has an audio media section
        // (OpenAI requires it) without triggering a microphone permission prompt
        pc.addTransceiver('audio', { direction: 'recvonly' });
        console.log('[WebRTC] Listen-only mode — receive-only audio (no microphone)');
      }

      // =========================================================================
      // 5. CREATE DATA CHANNEL FOR EVENTS
      // =========================================================================
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('[WebRTC] Data channel open');
        // In product mode, trigger AI greeting only if session is already ready
        if (sessionReadyRef.current && domain && action && !skipGreeting) {
          console.log('[WebRTC] Product mode — triggering AI greeting');
          dc.send(JSON.stringify({ type: 'response.create' }));
        }
      };

      dc.onmessage = (event) => messageHandlerRef.current(event);

      dc.onerror = (e) => {
        console.error('[WebRTC] Data channel error:', e);
      };

      dc.onclose = () => {
        console.log('[WebRTC] Data channel closed');
      };

      // =========================================================================
      // 6. ESTABLISH CONNECTION VIA SDP
      // =========================================================================
      console.log('[WebRTC] Creating offer...');
      const offer = await pc.createOffer();
      if (signal.aborted) { console.log('[WebRTC] Connect aborted'); cleanup(); return; }

      await pc.setLocalDescription(offer);
      if (signal.aborted) { console.log('[WebRTC] Connect aborted'); cleanup(); return; }

      console.log('[WebRTC] Sending SDP to OpenAI...');
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime?model=gpt-realtime-2025-08-28', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
        signal,
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error('[WebRTC] SDP error:', sdpResponse.status, errorText);
        throw new Error('Failed to establish WebRTC connection');
      }

      const answerSdp = await sdpResponse.text();
      if (signal.aborted) { console.log('[WebRTC] Connect aborted'); cleanup(); return; }

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      if (signal.aborted) { console.log('[WebRTC] Connect aborted'); cleanup(); return; }

      console.log('[WebRTC] Connection established!');

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          cleanup();
        }
      };

    } catch (err) {
      // Silently ignore intentional abort
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('[WebRTC] Connect aborted');
        return;
      }
      console.error('[WebRTC] Connect failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMsg);
      onError?.(errorMsg);
      cleanup();
    }
  }, [groupId, language, domain, action, itemContext, listenOnly, cleanup, onError, updateState]);

  // Disconnect
  const disconnect = useCallback(() => {
    console.log('[WebRTC] Disconnecting');
    cleanup();
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    connect,
    disconnect,
    error,
  };
}
