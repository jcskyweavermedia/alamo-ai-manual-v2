# Step 10: WebRTC Migration for Smooth Audio Playback

## Problem Statement

The current voice assistant audio playback is **choppy and not fluid**. Users experience audible gaps and stuttering during AI voice responses.

## Root Cause

OpenAI explicitly recommends WebRTC over WebSocket for browser clients:

> "When connecting to a Realtime model from the client (like a web browser or mobile device), we recommend using WebRTC rather than WebSockets for more consistent performance."

> "When connecting to a Realtime model via WebRTC, you don't have to handle audio events from the model in the same granular way you must with WebSockets."

**Current architecture (problematic):**
```
Browser → WebSocket → Edge Function (relay) → WebSocket → OpenAI
         [choppy]     [double latency]        [manual audio handling]
```

**Target architecture (WebRTC):**
```
Browser → WebRTC → OpenAI (direct audio stream)
         [native jitter buffering, hardware-accelerated playback]
```

---

## Implementation Overview

| Step | Description | Files | Estimated Time |
|------|-------------|-------|----------------|
| 1 | Create ephemeral key edge function | `supabase/functions/realtime-session/index.ts` | 30 min |
| 2 | Create search tool edge function | `supabase/functions/realtime-search/index.ts` | 20 min |
| 3 | Create WebRTC hook | `src/hooks/use-realtime-webrtc.ts` | 1.5 hr |
| 4 | Update VoiceConversation component | `src/components/voice/VoiceConversation.tsx` | 45 min |
| 5 | Add session configuration | `src/lib/realtime-config.ts` | 20 min |
| 6 | Testing & cleanup | Various | 1 hr |

**Total estimated time: 4-5 hours**

---

## Step 1: Create Ephemeral Key Edge Function

### Purpose
Mint a short-lived OpenAI API key that the browser can use directly. This keeps our main API key secure on the server while allowing the client to establish a direct WebRTC connection.

### File: `supabase/functions/realtime-session/index.ts`

```typescript
/**
 * Realtime Session Edge Function
 * 
 * Mints an ephemeral OpenAI API key for WebRTC connections.
 * Handles authentication, group membership, and usage limit checks.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SessionRequest {
  groupId: string;
  language: 'en' | 'es';
}

interface SessionResponse {
  ephemeralKey: string;
  expiresAt: string;
  sessionConfig: object;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[realtime-session] Request received');

    // =========================================================================
    // 1. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.log('[realtime-session] Invalid token:', claimsError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log('[realtime-session] Authenticated user:', userId);

    // =========================================================================
    // 2. PARSE REQUEST
    // =========================================================================
    const { groupId, language = 'en' }: SessionRequest = await req.json();

    if (!groupId) {
      return new Response(JSON.stringify({ error: 'Missing groupId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // 3. CHECK PERMISSIONS & USAGE
    // =========================================================================
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check membership and role
    const { data: membershipData, error: membershipError } = await supabase
      .from('group_memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .single();

    if (membershipError || !membershipData) {
      console.log('[realtime-session] User not a member of group');
      return new Response(JSON.stringify({ error: 'Not a member of this group' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check voice_enabled policy
    const { data: policyData } = await supabase
      .from('role_policies')
      .select('voice_enabled, can_use_ai')
      .eq('group_id', groupId)
      .eq('role', membershipData.role)
      .single();

    if (!policyData?.voice_enabled) {
      console.log('[realtime-session] Voice not enabled for role:', membershipData.role);
      return new Response(JSON.stringify({ 
        error: 'voice_disabled',
        message: language === 'es' ? 'Voz no habilitada para tu rol' : 'Voice not enabled for your role',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check usage limits
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_user_usage', { _user_id: userId, _group_id: groupId });

    if (usageError) {
      console.error('[realtime-session] Usage check error:', usageError.message);
      return new Response(JSON.stringify({ error: 'Failed to check usage limits' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const usage = usageData?.[0];
    if (!usage?.can_ask) {
      console.log('[realtime-session] Usage limit exceeded');
      return new Response(JSON.stringify({ 
        error: 'limit_exceeded',
        message: language === 'es' ? 'Límite alcanzado' : 'Limit reached',
        daily_count: usage?.daily_count,
        daily_limit: usage?.daily_limit,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // 4. MINT EPHEMERAL KEY FROM OPENAI
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[realtime-session] OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build session config for OpenAI
    const systemPrompt = language === 'es'
      ? `Eres un asistente de voz para gerentes y personal del restaurante.

COMPORTAMIENTO CRÍTICO:
1. Para CUALQUIER pregunta sobre políticas, procedimientos, temperaturas, estándares → SIEMPRE usa search_handbook PRIMERO
2. Da un breve reconocimiento: "Déjame verificar eso..." antes de buscar
3. Solo responde con contenido del manual - nunca inventes políticas
4. Si no se encuentra: "No veo eso en el manual. Pregunta a tu gerente."

GUÍAS DE VOZ:
- Mantén las respuestas a 2-3 oraciones máximo
- Sé cálido, útil y conversacional`
      : `You are a voice assistant for restaurant managers and staff.

CRITICAL BEHAVIOR:
1. For ANY question about policies, procedures, temperatures, standards → ALWAYS use search_handbook FIRST
2. Give a brief acknowledgment: "Let me check that..." before searching
3. Only answer from handbook content - never invent policies
4. If not found: "I don't see that in the handbook. Ask your manager."

VOICE GUIDELINES:
- Keep responses to 2-3 sentences maximum
- Be warm, helpful, and conversational`;

    const sessionConfig = {
      session: {
        type: 'realtime',
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy',
        instructions: systemPrompt,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
        tools: [
          {
            type: 'function',
            name: 'search_handbook',
            description: 'Search the restaurant training handbook. ALWAYS use this before answering questions about policies, procedures, temperatures, standards, or operations.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'What to search for in the handbook',
                },
              },
              required: ['query'],
            },
          },
        ],
        tool_choice: 'auto',
      },
    };

    console.log('[realtime-session] Requesting ephemeral key from OpenAI...');

    const openaiResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[realtime-session] OpenAI error:', openaiResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiData = await openaiResponse.json();
    console.log('[realtime-session] Ephemeral key created, expires:', openaiData.expires_at);

    // =========================================================================
    // 5. RETURN EPHEMERAL KEY TO CLIENT
    // =========================================================================
    return new Response(JSON.stringify({
      ephemeralKey: openaiData.value,
      expiresAt: openaiData.expires_at,
      userId,
      groupId,
      language,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[realtime-session] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### Config: Add to `supabase/config.toml`

```toml
[functions.realtime-session]
verify_jwt = false
```

---

## Step 2: Create Search Tool Edge Function

### Purpose
Handle `search_handbook` tool calls from the client. Since we're no longer relaying through a WebSocket, the client needs to call this directly when the AI requests a tool.

### File: `supabase/functions/realtime-search/index.ts`

```typescript
/**
 * Realtime Search Edge Function
 * 
 * Handles search_handbook tool calls from the WebRTC client.
 * Uses hybrid search (FTS + vector) for best results.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  query: string;
  language: 'en' | 'es';
  groupId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[realtime-search] Request received');

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Parse request
    const { query, language = 'en', groupId }: SearchRequest = await req.json();

    if (!query || !groupId) {
      return new Response(JSON.stringify({ error: 'Missing query or groupId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[realtime-search] Query:', query, 'Language:', language);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify membership
    const { data: membershipData } = await supabase
      .from('group_memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .single();

    if (!membershipData) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment usage
    await supabase.rpc('increment_usage', { _user_id: userId, _group_id: groupId });
    console.log('[realtime-search] Usage incremented');

    // Generate embedding for hybrid search
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let embedding: number[] | null = null;

    if (OPENAI_API_KEY) {
      try {
        const embResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query,
          }),
        });

        if (embResponse.ok) {
          const embData = await embResponse.json();
          embedding = embData.data[0].embedding;
        }
      } catch (e) {
        console.log('[realtime-search] Embedding failed, falling back to keyword search');
      }
    }

    // Perform search
    let results;
    if (embedding) {
      // Hybrid search
      const { data, error } = await supabase.rpc('hybrid_search_manual', {
        search_query: query,
        query_embedding: JSON.stringify(embedding),
        search_language: language,
        result_limit: 2,
      });
      results = data;
      if (error) console.error('[realtime-search] Hybrid search error:', error);
    } else {
      // Keyword-only fallback
      const { data, error } = await supabase.rpc('search_manual', {
        search_query: query,
        search_language: language,
        result_limit: 2,
      });
      results = data;
      if (error) console.error('[realtime-search] Keyword search error:', error);
    }

    if (!results?.length) {
      console.log('[realtime-search] No results found');
      return new Response(JSON.stringify({
        content: "No relevant information found in the handbook.",
        sections: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch full content for results
    const slugs = results.map((r: any) => r.slug);
    const { data: sections } = await supabase
      .from('manual_sections')
      .select('slug, title_en, title_es, content_en, content_es')
      .in('slug', slugs);

    if (!sections?.length) {
      return new Response(JSON.stringify({
        content: "No relevant information found in the handbook.",
        sections: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format for voice response
    const formatted = sections.map(s => {
      const title = language === 'es' && s.title_es ? s.title_es : s.title_en;
      const content = language === 'es' && s.content_es ? s.content_es : s.content_en;
      const truncated = content && content.length > 2500 
        ? content.substring(0, 2500) + '...'
        : content;
      return `## ${title}\n${truncated || ''}`;
    }).join('\n\n---\n\n');

    console.log('[realtime-search] Returning', sections.length, 'sections');

    return new Response(JSON.stringify({
      content: formatted,
      sections: sections.map(s => ({
        slug: s.slug,
        title: language === 'es' && s.title_es ? s.title_es : s.title_en,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[realtime-search] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### Config: Add to `supabase/config.toml`

```toml
[functions.realtime-search]
verify_jwt = false
```

---

## Step 3: Create WebRTC Hook

### Purpose
Main React hook that manages the WebRTC connection lifecycle, audio streams, and data channel communication.

### File: `src/hooks/use-realtime-webrtc.ts`

```typescript
/**
 * useRealtimeWebRTC
 * 
 * React hook for WebRTC-based voice conversation with OpenAI Realtime API.
 * Provides native audio handling for smooth, gap-free playback.
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
  onTranscript?: (entry: TranscriptEntry) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: WebRTCVoiceState) => void;
}

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
  const { language, groupId, onTranscript, onError, onStateChange } = options;

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

  // Handle tool calls (search_handbook)
  const handleToolCall = useCallback(async (name: string, callId: string, args: string) => {
    if (name !== 'search_handbook') {
      console.log('[WebRTC] Unknown tool:', name);
      return;
    }

    try {
      const parsedArgs = JSON.parse(args);
      const query = parsedArgs.query;
      console.log('[WebRTC] Tool call: search_handbook, query:', query);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Call search edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/realtime-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, language, groupId }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const result = await response.json();
      console.log('[WebRTC] Search returned', result.sections?.length || 0, 'sections');

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
            output: 'Search failed. Please try again.',
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
          updateState('connected');
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
          setTimeout(() => {
            if (pcRef.current?.connectionState === 'connected') {
              updateState('connected');
            }
          }, 300);
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
  }, [state, updateState, addTranscript, handleToolCall, onError]);

  // Cleanup
  const cleanup = useCallback(() => {
    console.log('[WebRTC] Cleaning up...');

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
      console.warn('[WebRTC] Already connected');
      return;
    }

    try {
      setError(null);
      updateState('connecting');

      // =========================================================================
      // 1. GET EPHEMERAL KEY FROM OUR SERVER
      // =========================================================================
      console.log('[WebRTC] Getting ephemeral key...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const sessionResponse = await fetch(`${SUPABASE_URL}/functions/v1/realtime-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId, language }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.message || errorData.error || 'Failed to create session');
      }

      const { ephemeralKey } = await sessionResponse.json();
      ephemeralKeyRef.current = ephemeralKey;
      console.log('[WebRTC] Ephemeral key obtained');

      // =========================================================================
      // 2. CREATE PEER CONNECTION
      // =========================================================================
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

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
      // 4. ADD MICROPHONE
      // =========================================================================
      console.log('[WebRTC] Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      pc.addTrack(stream.getTracks()[0]);
      console.log('[WebRTC] Microphone connected');

      // =========================================================================
      // 5. CREATE DATA CHANNEL FOR EVENTS
      // =========================================================================
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('[WebRTC] Data channel open');
      };

      dc.onmessage = handleDataChannelMessage;

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
      await pc.setLocalDescription(offer);

      console.log('[WebRTC] Sending SDP to OpenAI...');
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        throw new Error('Failed to establish WebRTC connection');
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      console.log('[WebRTC] Connection established!');

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          cleanup();
        }
      };

    } catch (err) {
      console.error('[WebRTC] Connect failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMsg);
      onError?.(errorMsg);
      cleanup();
    }
  }, [groupId, language, handleDataChannelMessage, cleanup, onError, updateState]);

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
```

---

## Step 4: Update VoiceConversation Component

### Purpose
Update the existing voice conversation component to use the new WebRTC hook instead of the WebSocket-based hook.

### File: `src/components/voice/VoiceConversation.tsx`

**Changes needed:**
1. Import `useRealtimeWebRTC` instead of `useRealtimeVoice`
2. The API is identical, so minimal changes required
3. Remove any audio-player related code (no longer needed)

```typescript
// Change this import:
import { useRealtimeVoice } from '@/hooks/use-realtime-voice';

// To this:
import { useRealtimeWebRTC } from '@/hooks/use-realtime-webrtc';

// And update the hook call:
const {
  state,
  isConnected,
  isListening,
  isSpeaking,
  transcript,
  connect,
  disconnect,
  error,
} = useRealtimeWebRTC({
  language,
  groupId,
  onTranscript: handleTranscript,
  onError: handleError,
  onStateChange: handleStateChange,
});
```

---

## Step 5: Configuration Updates

### File: `supabase/config.toml`

Add the new functions:

```toml
[functions.realtime-session]
verify_jwt = false

[functions.realtime-search]
verify_jwt = false
```

---

## Step 6: Files to Delete/Deprecate

After WebRTC migration is complete and tested:

| File | Action | Reason |
|------|--------|--------|
| `src/lib/audio-player.ts` | Delete | WebRTC handles audio natively |
| `src/lib/audio-recorder.ts` | Delete | WebRTC handles mic natively |
| `public/audio-worklet-processor.js` | Delete | No longer needed |
| `src/hooks/use-realtime-voice.ts` | Keep as fallback | For browsers without WebRTC |
| `supabase/functions/realtime-voice/index.ts` | Keep as fallback | For WebSocket fallback |

---

## Testing Checklist

### Functional Tests
- [ ] User can start voice conversation
- [ ] Audio plays smoothly without gaps
- [ ] User speech is transcribed correctly
- [ ] AI responses are transcribed correctly
- [ ] Tool calls (search_handbook) work
- [ ] Search results are incorporated into AI response
- [ ] User can end conversation
- [ ] Error states are handled gracefully

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

### Edge Cases
- [ ] Network disconnection mid-conversation
- [ ] Microphone permission denied
- [ ] Usage limit reached
- [ ] Voice not enabled for role
- [ ] Session expiry during conversation

---

## Rollback Plan

If issues are discovered:

1. Revert `VoiceConversation.tsx` to use `useRealtimeVoice`
2. Keep WebSocket relay active in `supabase/functions/realtime-voice`
3. Both paths can coexist during testing

---

## References

- [OpenAI Realtime API Guide](https://platform.openai.com/docs/guides/realtime)
- [OpenAI WebRTC Connection Guide](https://platform.openai.com/docs/guides/realtime-webrtc)
- [OpenAI Client Secrets API](https://platform.openai.com/docs/api-reference/realtime-sessions/create-realtime-client-secret)
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
