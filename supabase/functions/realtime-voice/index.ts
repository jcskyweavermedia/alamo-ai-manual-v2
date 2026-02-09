/**
 * Realtime Voice Edge Function
 * 
 * WebSocket relay between client and OpenAI Realtime API.
 * Handles authentication, usage limits, and handbook search tool calls.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// CONSTANTS
// =============================================================================

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, upgrade, connection, sec-websocket-key, sec-websocket-version, sec-websocket-extensions, sec-websocket-protocol',
};

// =============================================================================
// TYPES
// =============================================================================

interface SessionConfig {
  language: 'en' | 'es';
  groupId: string;
  userId: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate query embedding using OpenAI text-embedding-3-small
 */
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.log('[realtime-voice] OPENAI_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[realtime-voice] OpenAI embedding error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[realtime-voice] Failed to generate embedding:', error);
    return null;
  }
}

/**
 * Handle search_handbook tool call using existing hybrid search
 */
async function handleSearchHandbook(
  supabase: SupabaseClient,
  query: string,
  language: 'en' | 'es'
): Promise<string> {
  console.log('[realtime-voice] Tool call: search_handbook, query:', query);

  // Generate embedding for hybrid search
  const embedding = await getQueryEmbedding(query);
  
  if (!embedding) {
    // Fallback to keyword-only search
    const { data: results, error } = await supabase.rpc('search_manual', {
      search_query: query,
      search_language: language,
      result_limit: 2,
    });
    
    if (error || !results?.length) {
      console.log('[realtime-voice] No results found (keyword search)');
      return "No relevant information found in the handbook.";
    }
    
    return formatSearchResults(supabase, results, language);
  }

  // Hybrid search (FTS + vector)
  const { data: results, error } = await supabase.rpc('hybrid_search_manual', {
    search_query: query,
    query_embedding: JSON.stringify(embedding),
    search_language: language,
    result_limit: 2,
  });

  if (error || !results?.length) {
    console.log('[realtime-voice] No results found');
    return "No relevant information found in the handbook.";
  }

  return formatSearchResults(supabase, results, language);
}

/**
 * Format search results for voice context
 */
async function formatSearchResults(
  supabase: SupabaseClient,
  results: Array<{ slug: string }>,
  language: 'en' | 'es'
): Promise<string> {
  const slugs = results.map(r => r.slug);
  const { data: sections } = await supabase
    .from('manual_sections')
    .select('slug, title_en, title_es, content_en, content_es')
    .in('slug', slugs);

  if (!sections?.length) {
    return "No relevant information found in the handbook.";
  }

  const formatted = sections.map(s => {
    const title = language === 'es' && s.title_es ? s.title_es : s.title_en;
    const content = language === 'es' && s.content_es ? s.content_es : s.content_en;
    // Truncate to 2500 chars for voice context
    const truncated = content && content.length > 2500 
      ? content.substring(0, 2500) + '...'
      : content;
    return `## ${title}\n${truncated || ''}`;
  }).join('\n\n---\n\n');

  console.log('[realtime-voice] Returning', sections.length, 'sections');
  return formatted;
}

/**
 * Build the session.update payload for OpenAI
 */
function buildSessionUpdate(language: 'en' | 'es') {
  const systemPrompt = language === 'es'
    ? `Eres un asistente de voz para gerentes y personal del restaurante Alamo Prime.

COMPORTAMIENTO CRÍTICO:
1. Para CUALQUIER pregunta sobre políticas, procedimientos, temperaturas, estándares, limpieza, seguridad u operaciones → SIEMPRE llama a search_handbook PRIMERO
2. Da un breve reconocimiento: "Déjame verificar eso..." antes de buscar
3. Solo responde con contenido del manual - nunca inventes políticas
4. Si no se encuentra: "No veo eso en el manual. Pregunta a tu gerente o consulta con Recursos Humanos."

GUÍAS DE VOZ:
- Mantén las respuestas a 2-3 oraciones máximo
- Sé cálido, útil y conversacional

EJEMPLOS DE CUÁNDO BUSCAR:
- "¿Cuál es la política de descansos?" → buscar
- "¿Cómo manejo una queja?" → buscar
- "¿A qué temperatura el walk-in?" → buscar
- "¡Gracias!" → no buscar, solo responder`
    : `You are a voice assistant for Alamo Prime restaurant managers and staff.

CRITICAL BEHAVIOR:
1. For ANY question about policies, procedures, temperatures, standards, cleaning, safety, or operations → ALWAYS call search_handbook FIRST
2. Give a brief acknowledgment: "Let me check that..." before searching
3. Only answer from handbook content - never invent policies
4. If not found: "I don't see that in the handbook. Ask your manager or check with HR."

VOICE GUIDELINES:
- Keep responses to 2-3 sentences maximum
- Be warm, helpful, and conversational

EXAMPLES OF WHEN TO SEARCH:
- "What's the break policy?" → search
- "How do I handle a complaint?" → search
- "What temperature for the walk-in?" → search
- "Thanks!" → don't search, just respond`;

  return {
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      voice: 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 800,
      },
      instructions: systemPrompt,
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
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[realtime-voice] Request received');

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = req.headers.get('upgrade');
  if (upgradeHeader?.toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ error: 'Expected WebSocket upgrade' }), {
      status: 426,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Parse query params
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const groupId = url.searchParams.get('groupId');
  const language = (url.searchParams.get('language') || 'en') as 'en' | 'es';

  if (!token || !groupId) {
    return new Response(JSON.stringify({ error: 'Missing token or groupId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ==========================================================================
  // AUTHENTICATE USER
  // ==========================================================================
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client with user's token for auth verification
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  
  if (claimsError || !claimsData?.claims) {
    console.log('[realtime-voice] Invalid token:', claimsError?.message);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = claimsData.claims.sub as string;
  console.log('[realtime-voice] Authenticated user:', userId);

  // Service role client for database operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ==========================================================================
  // CHECK PERMISSIONS AND USAGE
  // ==========================================================================
  
  // Check voice_enabled from role_policies
  const { data: membershipData, error: membershipError } = await supabase
    .from('group_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .single();

  if (membershipError || !membershipData) {
    console.log('[realtime-voice] User not a member of group');
    return new Response(JSON.stringify({ error: 'Not a member of this group' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: policyData } = await supabase
    .from('role_policies')
    .select('voice_enabled, can_use_ai')
    .eq('group_id', groupId)
    .eq('role', membershipData.role)
    .single();

  // Check if voice is specifically enabled for this role
  if (!policyData?.voice_enabled) {
    console.log('[realtime-voice] Voice not enabled for role:', membershipData.role);
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
    console.error('[realtime-voice] Usage check error:', usageError.message);
    return new Response(JSON.stringify({ error: 'Failed to check usage limits' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const usage = usageData?.[0];
  if (!usage?.can_ask) {
    console.log('[realtime-voice] Usage limit exceeded');
    return new Response(JSON.stringify({ 
      error: 'limit_exceeded',
      message: language === 'es' ? 'Límite alcanzado' : 'Limit reached',
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ==========================================================================
  // ESTABLISH WEBSOCKET CONNECTION
  // ==========================================================================
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error('[realtime-voice] OPENAI_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'Service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Upgrade to WebSocket
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Connect to OpenAI Realtime API
  let openaiSocket: WebSocket | null = null;
  let usageIncremented = false;
  let turnResponseRequested = false;

  const config: SessionConfig = { language, groupId, userId };

  clientSocket.onopen = () => {
    console.log('[realtime-voice] Client connected, connecting to OpenAI...');
    
    openaiSocket = new WebSocket(OPENAI_REALTIME_URL, [
      'realtime',
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      'openai-beta.realtime-v1',
    ]);

    openaiSocket.onopen = () => {
      console.log('[realtime-voice] Connected to OpenAI Realtime API');
    };

    openaiSocket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // ----------------------------------------------------------------------
        // Turn lifecycle: explicitly request a response after audio is committed.
        // ----------------------------------------------------------------------
        if (data.type === 'input_audio_buffer.speech_started') {
          turnResponseRequested = false;
        }

        if (data.type === 'input_audio_buffer.committed') {
          // With server_vad, OpenAI will commit automatically.
          // We request a response explicitly to avoid "response.done: failed" with empty output.
          if (!turnResponseRequested) {
            turnResponseRequested = true;
            console.log('[realtime-voice] input_audio_buffer.committed -> requesting response.create (text+audio)');
            openaiSocket?.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['text', 'audio'],
              },
            }));
          }
        }
        
        // Handle session.created - send our config
        if (data.type === 'session.created') {
          console.log('[realtime-voice] Session created, sending config...');
          const sessionUpdate = buildSessionUpdate(config.language);
          openaiSocket?.send(JSON.stringify(sessionUpdate));
        }
        
        // Handle session.updated - confirm config accepted
        if (data.type === 'session.updated') {
          console.log('[realtime-voice] Session config accepted by OpenAI');
        }
        
        // ----------------------------------------------------------------------
        // Response + tool-call logging (verbose for debugging)
        // ----------------------------------------------------------------------
        if (data.type === 'response.created') {
          console.log('[realtime-voice] response.created, id:', data.response?.id);
        }

        if (data.type === 'response.done') {
          // Log full response structure for debugging
          const response = data.response;
          console.log('[realtime-voice] response.done - status:', response?.status);
          console.log('[realtime-voice] response.done - output items:', response?.output?.length || 0);

          if (response?.status && response.status !== 'completed') {
            // OpenAI sometimes puts failure info into status_details
            console.log('[realtime-voice] response.done - status_details:', JSON.stringify(response.status_details ?? null));
          }

          if (response?.output) {
            response.output.forEach((item: any, i: number) => {
              console.log(`[realtime-voice] output[${i}] type:`, item.type, 'status:', item.status);
              if (item.type === 'function_call') {
                console.log(`[realtime-voice] output[${i}] function:`, item.name, 'call_id:', item.call_id);
              }
            });
          }

          // Allow next turn
          turnResponseRequested = false;
        }

        if (data.type === 'error') {
          console.error('[realtime-voice] OpenAI error event:', JSON.stringify(data.error));
        }

        // Log all output_item events for debugging
        if (data.type === 'response.output_item.added') {
          console.log('[realtime-voice] output_item.added - type:', data.item?.type);
        }
        
        if (data.type === 'response.output_item.done') {
          console.log('[realtime-voice] output_item.done - type:', data.item?.type, 'status:', data.item?.status);
        }

        // Also listen for function_call_arguments events
        if (data.type === 'response.function_call_arguments.done') {
          console.log('[realtime-voice] function_call_arguments.done - call_id:', data.call_id, 'args:', data.arguments);
        }

        // ----------------------------------------------------------------------
        // Handle tool calls (current event format)
        // ----------------------------------------------------------------------
        const handleToolCall = async (payload: { name: string; call_id: string; arguments: string }) => {
          console.log('[realtime-voice] Tool call:', payload.name);

          if (payload.name !== 'search_handbook') return;

          try {
            const args = JSON.parse(payload.arguments || '{}') as { query?: string };
            const query = args.query?.trim();
            if (!query) {
              throw new Error('Missing query');
            }

            const result = await handleSearchHandbook(supabase, query, config.language);

            const functionOutput = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: payload.call_id,
                output: result,
              },
            };
            openaiSocket?.send(JSON.stringify(functionOutput));

            // After tool output is injected, explicitly request continuation WITH audio.
            // CRITICAL: Must include modalities to ensure audio output is generated.
            openaiSocket?.send(JSON.stringify({ 
              type: 'response.create',
              response: {
                modalities: ['text', 'audio']
              }
            }));
          } catch (e) {
            console.error('[realtime-voice] Tool call error:', e);

            const errorOutput = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: payload.call_id,
                output: config.language === 'es'
                  ? 'Error al buscar en el manual. Intenta de nuevo.'
                  : 'Error searching the handbook. Please try again.',
              },
            };
            openaiSocket?.send(JSON.stringify(errorOutput));
            openaiSocket?.send(JSON.stringify({ 
              type: 'response.create',
              response: {
                modalities: ['text', 'audio']
              }
            }));
          }
        };

        // Current recommended tool-call signal: response.output_item.done
        if (data.type === 'response.output_item.done' && data.item?.type === 'function_call') {
          const item = data.item as { name: string; call_id: string; arguments: string };
          await handleToolCall(item);
        }

        // Increment usage on first response (per session)
        if (data.type === 'response.done' && !usageIncremented) {
          usageIncremented = true;
          const { error: incrementError } = await supabase
            .rpc('increment_usage', { _user_id: config.userId, _group_id: config.groupId });
          if (incrementError) {
            console.error('[realtime-voice] Failed to increment usage:', incrementError.message);
          } else {
            console.log('[realtime-voice] Usage incremented');
          }
        }
        
        // Relay message to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
      } catch (e) {
        console.error('[realtime-voice] Error processing OpenAI message:', e);
      }
    };

    openaiSocket.onerror = (error) => {
      console.error('[realtime-voice] OpenAI WebSocket error:', error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ 
          type: 'error', 
          error: { message: 'Connection to AI service failed' } 
        }));
      }
    };

    openaiSocket.onclose = (event) => {
      console.log('[realtime-voice] OpenAI connection closed:', event.code, event.reason);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1000, 'AI service disconnected');
      }
    };
  };

  clientSocket.onmessage = (event) => {
    // Relay client messages to OpenAI
    if (openaiSocket?.readyState === WebSocket.OPEN) {
      openaiSocket.send(event.data);
    }
  };

  clientSocket.onerror = (error) => {
    console.error('[realtime-voice] Client WebSocket error:', error);
  };

  clientSocket.onclose = () => {
    console.log('[realtime-voice] Client disconnected');
    if (openaiSocket?.readyState === WebSocket.OPEN) {
      openaiSocket.close();
    }
  };

  return response;
});
