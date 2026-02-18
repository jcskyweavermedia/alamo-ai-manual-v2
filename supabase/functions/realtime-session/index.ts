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
  /** Product domain for product-context conversations */
  domain?: string;
  /** Action key (e.g. practicePitch, quizMe) */
  action?: string;
  /** Full item data for product context */
  itemContext?: Record<string, unknown>;
  /** Listen-only mode: disable VAD, strip tools, AI speaks once */
  listenOnly?: boolean;
}

// Product search tool definitions for WebRTC sessions
const PRODUCT_SEARCH_TOOL_DEFS: Record<string, { name: string; description: string }> = {
  dishes: { name: 'search_dishes', description: 'Search the dish menu for appetizers, entrees, sides, and desserts.' },
  wines: { name: 'search_wines', description: 'Search the wine list for varietals, regions, and tasting notes.' },
  cocktails: { name: 'search_cocktails', description: 'Search cocktails for ingredients, styles, and recipes.' },
  recipes: { name: 'search_recipes', description: 'Search prep recipes and plate specs for procedures, ingredients, and training.' },
  beer_liquor: { name: 'search_beer_liquor', description: 'Search beers and liquors for styles, producers, and descriptions.' },
  steps_of_service: { name: 'search_steps_of_service', description: 'Search the Steps of Service manual for service procedures, guest interaction techniques, and professional standards.' },
};

// Normalize camelCase keys to snake_case so the serializer works with either format
function normalizeKeys(item: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    result[key] = value;
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (snakeKey !== key && !(snakeKey in result)) {
      result[snakeKey] = value;
    }
  }
  return result;
}

// Serialize item context to text (mirrors /ask function logic)
function serializeItemContext(domain: string, rawItem: Record<string, unknown>): string {
  const item = normalizeKeys(rawItem);
  const parts: (string | null)[] = [];

  switch (domain) {
    case 'dishes':
      parts.push(`Dish: ${item.menu_name || item.name}`);
      if (item.plate_type) parts.push(`Type: ${item.plate_type}`);
      if (item.short_description) parts.push(`Description: ${item.short_description}`);
      if (item.detailed_description) parts.push(`Details: ${item.detailed_description}`);
      if (item.ingredients) parts.push(`All Ingredients: ${Array.isArray(item.ingredients) ? item.ingredients.join(', ') : item.ingredients}`);
      if (item.key_ingredients) parts.push(`Key Ingredients: ${Array.isArray(item.key_ingredients) ? item.key_ingredients.join(', ') : item.key_ingredients}`);
      if (item.flavor_profile) parts.push(`Flavor: ${Array.isArray(item.flavor_profile) ? item.flavor_profile.join(', ') : item.flavor_profile}`);
      if (item.allergens) parts.push(`Allergens: ${Array.isArray(item.allergens) ? item.allergens.join(', ') : item.allergens}`);
      if (item.upsell_notes) parts.push(`Upsell Notes: ${item.upsell_notes}`);
      if (item.notes) parts.push(`Notes: ${item.notes}`);
      break;
    case 'wines':
      parts.push(`Wine: ${item.name}`);
      if (item.producer) parts.push(`Producer: ${item.producer}`);
      if (item.varietal) parts.push(`Varietal: ${item.varietal}`);
      if (item.region) parts.push(`Region: ${[item.region, item.country].filter(Boolean).join(', ')}`);
      if (item.vintage) parts.push(`Vintage: ${item.vintage}`);
      if (item.style) parts.push(`Style: ${item.style}`);
      if (item.body) parts.push(`Body: ${item.body}`);
      if (item.tasting_notes) parts.push(`Tasting Notes: ${item.tasting_notes}`);
      if (item.producer_notes) parts.push(`Producer Notes: ${item.producer_notes}`);
      if (item.notes) parts.push(`Notes: ${item.notes}`);
      break;
    case 'cocktails':
      parts.push(`Cocktail: ${item.name}`);
      if (item.style) parts.push(`Style: ${item.style}`);
      if (item.glass) parts.push(`Glass: ${item.glass}`);
      if (item.ingredients) parts.push(`Ingredients: ${item.ingredients}`);
      if (item.key_ingredients) parts.push(`Key Ingredients: ${item.key_ingredients}`);
      if (item.procedure) parts.push(`Procedure: ${typeof item.procedure === 'string' ? item.procedure : JSON.stringify(item.procedure)}`);
      if (item.tasting_notes) parts.push(`Tasting Notes: ${item.tasting_notes}`);
      if (item.description) parts.push(`Description: ${item.description}`);
      if (item.notes) parts.push(`Notes: ${item.notes}`);
      break;
    case 'recipes': {
      parts.push(`Recipe: ${item.name}`);
      if (item.prep_type) parts.push(`Type: ${item.prep_type}`);
      if (item.plate_type) parts.push(`Type: ${item.plate_type}`);
      if (item.yield_qty) parts.push(`Yield: ${item.yield_qty} ${item.yield_unit || ''}`);
      if (item.shelf_life_value) parts.push(`Shelf Life: ${item.shelf_life_value} ${item.shelf_life_unit || ''}`);
      // Serialize full ingredients with quantities
      if (item.ingredients) {
        const ingText = typeof item.ingredients === 'string'
          ? item.ingredients
          : JSON.stringify(item.ingredients);
        // Truncate to 2000 chars for context window
        parts.push(`Ingredients: ${ingText.length > 2000 ? ingText.substring(0, 2000) + '...' : ingText}`);
      }
      if (item.components) {
        const compText = typeof item.components === 'string'
          ? item.components
          : JSON.stringify(item.components);
        parts.push(`Components: ${compText.length > 2000 ? compText.substring(0, 2000) + '...' : compText}`);
      }
      if (item.procedure || item.assembly_procedure) {
        const procData = item.procedure || item.assembly_procedure;
        const procText = typeof procData === 'string' ? procData : JSON.stringify(procData);
        parts.push(`Procedure: ${procText.length > 2000 ? procText.substring(0, 2000) + '...' : procText}`);
      }
      if (item.training_notes) {
        const tnText = typeof item.training_notes === 'string' ? item.training_notes : JSON.stringify(item.training_notes);
        parts.push(`Training Notes: ${tnText}`);
      }
      if (item.notes) parts.push(`Notes: ${item.notes}`);
      break;
    }
    case 'beer_liquor':
      parts.push(`Name: ${item.name}`);
      if (item.category) parts.push(`Category: ${item.category}`);
      if (item.subcategory) parts.push(`Subcategory: ${item.subcategory}`);
      if (item.producer) parts.push(`Producer: ${item.producer}`);
      if (item.country) parts.push(`Country: ${item.country}`);
      if (item.style) parts.push(`Style: ${item.style}`);
      if (item.description) parts.push(`Description: ${item.description}`);
      if (item.notes) parts.push(`Notes: ${item.notes}`);
      break;
    case 'steps_of_service':
      parts.push(`Position: ${item.position}`);
      if (item.section_key) parts.push(`Section: ${item.section_key}`);
      if (item.title_en) parts.push(`Topic: ${item.title_en}`);
      if (item.content_en) parts.push(`Content: ${(item.content_en as string).substring(0, 500)}`);
      break;
    default:
      parts.push(JSON.stringify(item));
  }

  return parts.filter(Boolean).join('\n');
}

// Pitch actions that need minimal context (no allergens, upsell, producer, etc.)
const PITCH_ACTIONS = new Set(['samplePitch', 'wineDetails']);
// Listen-only actions that still need tools (search_dishes, search_handbook, etc.)
const LISTEN_WITH_TOOLS = new Set(['foodPairings', 'suggestPairing', 'listen2ndApproach']);

// Slim context serializer for pitch actions — only essential fields
function serializePitchContext(domain: string, rawItem: Record<string, unknown>): string {
  const item = normalizeKeys(rawItem);
  switch (domain) {
    case 'dishes':
      return [
        `Dish: ${item.menu_name || item.name}`,
        item.plate_type ? `Type: ${item.plate_type}` : null,
        item.short_description ? `Description: ${item.short_description}` : null,
        item.key_ingredients ? `Key Ingredients: ${Array.isArray(item.key_ingredients) ? item.key_ingredients.join(', ') : item.key_ingredients}` : null,
        item.flavor_profile ? `Flavor: ${Array.isArray(item.flavor_profile) ? item.flavor_profile.join(', ') : item.flavor_profile}` : null,
      ].filter(Boolean).join('\n');
    case 'wines':
      return [
        `Wine: ${item.name}`,
        item.varietal ? `Varietal: ${item.varietal}` : null,
        `Region: ${[item.region, item.country].filter(Boolean).join(', ')}`,
        item.style ? `Style: ${item.style}` : null,
        item.body ? `Body: ${item.body}` : null,
        item.tasting_notes ? `Tasting Notes: ${item.tasting_notes}` : null,
      ].filter(Boolean).join('\n');
    case 'cocktails':
      return [
        `Cocktail: ${item.name}`,
        item.style ? `Style: ${item.style}` : null,
        item.key_ingredients ? `Key Ingredients: ${item.key_ingredients}` : null,
        item.tasting_notes ? `Tasting Notes: ${item.tasting_notes}` : null,
      ].filter(Boolean).join('\n');
    default:
      return serializeItemContext(domain, rawItem);
  }
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
    const { groupId, language = 'en', promptSlug = 'assistant', domain, action, itemContext, listenOnly }: SessionRequest = await req.json();

    if (!groupId) {
      return new Response(JSON.stringify({ error: 'Missing groupId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isProductMode = !!(domain && action && itemContext);

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
    let systemPrompt: string;
    let voice = 'cedar';

    if (isProductMode) {
      // Product mode: fetch voice action prompt from ai_prompts
      const voiceSlug = `voice-action-${domain}-${action}`;
      const fallbackSlug = `action-${domain}-${action}`;

      console.log('[realtime-session] Product mode — trying prompt:', voiceSlug);

      const { data: voicePrompt } = await supabase
        .from('ai_prompts')
        .select('prompt_en, prompt_es, voice')
        .eq('slug', voiceSlug)
        .eq('is_active', true)
        .single();

      let actionPromptText: string;
      if (voicePrompt) {
        actionPromptText = language === 'es' && voicePrompt.prompt_es
          ? voicePrompt.prompt_es
          : voicePrompt.prompt_en;
        voice = voicePrompt.voice || 'cedar';
        console.log('[realtime-session] Using voice prompt:', voiceSlug);
      } else {
        // Fall back to text action prompt
        console.log('[realtime-session] Voice prompt not found, falling back to:', fallbackSlug);
        const { data: textPrompt } = await supabase
          .from('ai_prompts')
          .select('prompt_en, prompt_es, voice')
          .eq('slug', fallbackSlug)
          .eq('is_active', true)
          .single();

        actionPromptText = textPrompt
          ? (language === 'es' && textPrompt.prompt_es ? textPrompt.prompt_es : textPrompt.prompt_en)
          : 'Help the user with this product.';
      }

      // Fetch base persona and domain prompt in parallel
      const [{ data: basePrompt }, { data: domainPrompt }] = await Promise.all([
        supabase
          .from('ai_prompts')
          .select('prompt_en, prompt_es')
          .eq('slug', 'base-persona')
          .eq('is_active', true)
          .single(),
        supabase
          .from('ai_prompts')
          .select('prompt_en, prompt_es')
          .eq('slug', `domain-${domain}`)
          .eq('is_active', true)
          .single(),
      ]);

      const baseText = basePrompt
        ? (language === 'es' && basePrompt.prompt_es ? basePrompt.prompt_es : basePrompt.prompt_en)
        : 'You are the AI assistant for Alamo Prime steakhouse.';

      const domainText = domainPrompt
        ? (language === 'es' && domainPrompt.prompt_es ? domainPrompt.prompt_es : domainPrompt.prompt_en)
        : '';

      // Serialize item context — use slim version for pitch actions
      const isPitch = PITCH_ACTIONS.has(action!);
      const itemText = isPitch
        ? serializePitchContext(domain!, itemContext!)
        : serializeItemContext(domain!, itemContext!);

      const promptParts = [baseText];
      if (domainText) promptParts.push(domainText);
      promptParts.push(actionPromptText);
      promptParts.push(`Here is the item the user is working with:\n${itemText}`);
      promptParts.push(language === 'es' ? 'Responde en español.' : 'Respond in English.');

      systemPrompt = promptParts.join('\n\n');

      console.log('[realtime-session] Product prompt assembled, voice:', voice);
    } else {
      // Standard mode: fetch from routing_prompts
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

      systemPrompt = language === 'es' && promptData.prompt_es
        ? promptData.prompt_es
        : promptData.prompt_en;
      voice = promptData.voice || 'cedar';

      console.log('[realtime-session] Using prompt:', promptSlug, 'voice:', voice);
    }

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

    // Build tools list — always include handbook, add product tools in product mode
    // deno-lint-ignore no-explicit-any
    const tools: any[] = [
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
    ];

    // Add all product search tools in product mode (enables cross-domain search)
    if (isProductMode) {
      for (const toolDef of Object.values(PRODUCT_SEARCH_TOOL_DEFS)) {
        tools.push({
          type: 'function',
          name: toolDef.name,
          description: toolDef.description,
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: `What to search for`,
              },
            },
            required: ['query'],
          },
        });
      }
      console.log('[realtime-session] Added product search tools:', Object.keys(PRODUCT_SEARCH_TOOL_DEFS).join(', '));
    }

    // deno-lint-ignore no-explicit-any
    const sessionConfig: Record<string, any> = {
      model: 'gpt-realtime-2025-08-28',
      voice,
      instructions: systemPrompt,
      tools: listenOnly && !LISTEN_WITH_TOOLS.has(action || '') ? [] : tools,
      tool_choice: listenOnly && !LISTEN_WITH_TOOLS.has(action || '') ? 'none' : 'auto',
    };

    if (!listenOnly) {
      // Conversation mode: enable VAD + transcription
      sessionConfig.input_audio_transcription = { model: 'whisper-1' };
      sessionConfig.turn_detection = {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 800,
      };
    }
    // Listen-only: no turn_detection, no transcription = AI speaks once then waits

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
