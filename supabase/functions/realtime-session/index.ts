/**
 * Realtime Session Edge Function
 * 
 * Mints an ephemeral OpenAI API key for WebRTC connections.
 * Handles authentication, group membership, and usage limit checks.
 * Fetches system prompt from routing_prompts table.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SessionRequest {
  groupId: string;
  language: 'en' | 'es';
  promptSlug?: string; // Optional: defaults to 'assistant'
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

    // Verify token by getting user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.log('[realtime-session] Invalid token:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    console.log('[realtime-session] Authenticated user:', userId);

    // =========================================================================
    // 2. PARSE REQUEST
    // =========================================================================
    const { groupId, language = 'en', promptSlug = 'assistant' }: SessionRequest = await req.json();

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
    // 4. FETCH PROMPT FROM DATABASE
    // =========================================================================
    const { data: promptData, error: promptError } = await supabase
      .from('routing_prompts')
      .select('prompt_en, prompt_es, voice')
      .eq('slug', promptSlug)
      .eq('is_active', true)
      .single();

    if (promptError || !promptData) {
      console.error('[realtime-session] Prompt not found:', promptSlug, promptError?.message);
      return new Response(JSON.stringify({ 
        error: 'prompt_not_found',
        message: `Prompt "${promptSlug}" not found or inactive`,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Select prompt based on language (fallback to English)
    const systemPrompt = language === 'es' && promptData.prompt_es 
      ? promptData.prompt_es 
      : promptData.prompt_en;
    
    const voice = promptData.voice || 'cedar';

    console.log('[realtime-session] Using prompt:', promptSlug, 'voice:', voice);

    // =========================================================================
    // 5. MINT EPHEMERAL KEY FROM OPENAI
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[realtime-session] OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionConfig = {
      model: 'gpt-realtime-2025-08-28',
      voice,
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
    };

    console.log('[realtime-session] Requesting ephemeral key from OpenAI...');

    const openaiResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
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
    console.log('[realtime-session] Ephemeral key created, expires:', openaiData.client_secret?.expires_at);

    // =========================================================================
    // 6. RETURN EPHEMERAL KEY TO CLIENT
    // =========================================================================
    return new Response(JSON.stringify({
      ephemeralKey: openaiData.client_secret?.value,
      expiresAt: openaiData.client_secret?.expires_at,
      userId,
      groupId,
      language,
      promptSlug,
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
