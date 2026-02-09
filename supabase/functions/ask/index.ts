/**
 * AI Assistant Edge Function
 * 
 * Grounded Q&A using hybrid search (FTS + vector) + Lovable AI.
 * Enforces role-based usage limits (daily/monthly).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =============================================================================
// TYPES
// =============================================================================

interface AskRequest {
  question: string;
  language: 'en' | 'es';
  groupId: string;
  expand?: boolean; // Request expanded/detailed answer
  context?: {
    sectionId?: string;
    sectionTitle?: string;
  } | null;
}

interface Citation {
  id: string;
  slug: string;
  title: string;
}

interface UsageInfo {
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

interface AskResponse {
  answer: string;
  citations: Citation[];
  usage: UsageInfo;
}

interface ErrorResponse {
  error: string;
  message?: string;
  usage?: UsageInfo;
}

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  snippet: string;
  category: string;
  tags: string[];
  file_path: string;
  rank?: number;
  combined_score?: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function jsonResponse(data: AskResponse | ErrorResponse, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: string, message?: string, status = 400, usage?: UsageInfo): Response {
  const body: ErrorResponse = { error };
  if (message) body.message = message;
  if (usage) body.usage = usage;
  return jsonResponse(body as unknown as AskResponse, status);
}

/**
 * Generate query embedding using OpenAI text-embedding-3-small
 */
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.log('[ask] OPENAI_API_KEY not configured, skipping vector search');
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
      console.error('[ask] OpenAI embedding error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[ask] Failed to generate query embedding:', error);
    return null;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[ask] Request received');

  try {
    // =========================================================================
    // 1. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[ask] Missing or invalid Authorization header');
      return errorResponse('Unauthorized', 'Missing authorization header', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client with user's token for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.log('[ask] Invalid token:', claimsError?.message);
      return errorResponse('Unauthorized', 'Invalid token', 401);
    }

    const userId = claimsData.claims.sub as string;
    console.log('[ask] Authenticated user:', userId);

    // Service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. PARSE REQUEST
    // =========================================================================
    const body = await req.json() as AskRequest;
    const { question, language = 'en', groupId, expand = false, context = null } = body;

    if (!question?.trim()) {
      console.log('[ask] Missing question');
      return errorResponse('bad_request', 'Question is required', 400);
    }

    if (!groupId) {
      console.log('[ask] Missing groupId');
      return errorResponse('bad_request', 'Group ID is required', 400);
    }

    // Extract section context for AI prompt (NOT for FTS)
    const sectionContext = context?.sectionTitle ? `About "${context.sectionTitle}"` : null;

    console.log('[ask] Question:', question.substring(0, 100), '| Language:', language, '| Group:', groupId, sectionContext ? `| Context: ${sectionContext}` : '');

    // =========================================================================
    // 3. OFF-TOPIC DETECTION (before usage check - don't penalize for off-topic)
    // =========================================================================
    // Quick heuristic check for clearly off-topic questions
    const offTopicPatterns = [
      // Personal/general knowledge
      /\b(weather|sports|news|politics|celebrity|movie|music|game|joke|story)\b/i,
      // Math/programming help
      /\b(calculate|compute|code|program|algorithm|equation|solve for|derivative)\b/i,
      // General AI assistant requests
      /\b(write me a|compose|create a poem|tell me about yourself|who are you)\b/i,
      // Completely unrelated
      /\b(stock market|bitcoin|crypto|investment advice|relationship|dating)\b/i,
    ];

    const isObviouslyOffTopic = offTopicPatterns.some(pattern => pattern.test(question));
    if (isObviouslyOffTopic) {
      console.log('[ask] Off-topic question detected');
      return jsonResponse({
        answer: language === 'es'
          ? 'Solo puedo responder preguntas sobre operaciones y procedimientos del restaurante basándome en el manual. ¿Tienes alguna pregunta sobre seguridad alimentaria, procedimientos de limpieza u operaciones?'
          : "I can only answer questions about restaurant operations and procedures based on the manual. Do you have a question about food safety, cleaning procedures, or operations?",
        citations: [],
        usage: { daily: { used: 0, limit: 0 }, monthly: { used: 0, limit: 0 } }, // Placeholder - not fetched for off-topic
        isOffTopic: true,
      } as AskResponse & { isOffTopic?: boolean });
    }

    // =========================================================================
    // 4. CHECK USAGE LIMITS
    // =========================================================================
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_user_usage', { _user_id: userId, _group_id: groupId });

    if (usageError) {
      console.error('[ask] Usage check error:', usageError.message);
      return errorResponse('server_error', 'Failed to check usage limits', 500);
    }

    const usage = usageData?.[0];
    if (!usage) {
      console.log('[ask] User not a member of group');
      return errorResponse('forbidden', 'Not a member of this group', 403);
    }

    const usageInfo: UsageInfo = {
      daily: { used: usage.daily_count, limit: usage.daily_limit },
      monthly: { used: usage.monthly_count, limit: usage.monthly_limit },
    };

    if (!usage.can_ask) {
      const limitType = usage.daily_count >= usage.daily_limit ? 'daily' : 'monthly';
      console.log('[ask] Usage limit exceeded:', limitType);
      return errorResponse(
        'limit_exceeded',
        limitType === 'daily'
          ? (language === 'es' ? 'Límite diario alcanzado. Intenta mañana.' : 'Daily question limit reached. Try again tomorrow.')
          : (language === 'es' ? 'Límite mensual alcanzado.' : 'Monthly question limit reached.'),
        429,
        usageInfo
      );
    }

    // =========================================================================
    // 5. RETRIEVE RELEVANT CONTENT (HYBRID SEARCH: FTS + Vector)
    // =========================================================================
    // Strip common question words that hurt FTS matching
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'explain', 'describe', 'tell', 'show', 'is', 'are', 'the', 'a', 'an', 'do', 'does', 'can', 'could', 'should', 'would', 'about', 'me'];
    const searchQuery = question
      .toLowerCase()
      .split(/\s+/)
      .filter(word => !questionWords.includes(word) && word.length > 1)
      .join(' ')
      || question; // Fallback to original if all words stripped
    
    // Generate query embedding for vector search
    const queryEmbedding = await getQueryEmbedding(question);
    
    let searchResults: SearchResult[] | null = null;
    
    // Try hybrid search first (if we have embeddings)
    if (queryEmbedding) {
      console.log('[ask] Using hybrid search (FTS + vector)...');
      const { data, error } = await supabase.rpc('hybrid_search_manual', {
        search_query: searchQuery,
        query_embedding: JSON.stringify(queryEmbedding),
        search_language: language,
        result_limit: 5,
      });
      
      if (!error && data) {
        searchResults = data;
        console.log('[ask] Hybrid search found', searchResults?.length || 0, 'results');
      } else {
        console.error('[ask] Hybrid search failed:', error?.message);
      }
    }
    
    // Fallback to keyword-only FTS if hybrid search failed or no embeddings
    if (!searchResults) {
      console.log('[ask] Falling back to keyword search...');
      const { data, error } = await supabase.rpc('search_manual', {
        search_query: searchQuery,
        search_language: language,
        result_limit: 5,
      });
      
      if (error) {
        console.error('[ask] Search error:', error.message);
        return errorResponse('server_error', 'Failed to search manual', 500);
      }
      searchResults = data;
    }

    console.log('[ask] Found', searchResults?.length || 0, 'relevant sections');

    // =========================================================================
    // 6. CHECK IF WE HAVE ENOUGH CONTEXT
    // =========================================================================
    if (!searchResults || searchResults.length === 0) {
      console.log('[ask] No relevant content found');
      return jsonResponse({
        answer: language === 'es'
          ? 'No encontré información relevante en el manual sobre esta pregunta. Intenta reformularla o busca directamente en el manual.'
          : "I couldn't find relevant information in the manual about this question. Try rephrasing or search the manual directly.",
        citations: [],
        usage: usageInfo,
      });
    }

    // =========================================================================
    // 6. FETCH FULL CONTENT FOR TOP RESULTS
    // =========================================================================
    // Get the slugs of top results to fetch full content
    const topSlugs = searchResults.slice(0, 3).map((r: { slug: string }) => r.slug);
    
    // Fetch full content for better AI context
    const { data: fullSections, error: sectionsError } = await supabase
      .from('manual_sections')
      .select('id, slug, title_en, title_es, content_en, content_es')
      .in('slug', topSlugs);

    if (sectionsError) {
      console.error('[ask] Failed to fetch full content:', sectionsError.message);
      // Fall back to snippets
    }

    // Build context from full content if available, otherwise use snippets
    let manualContext: string;
    if (fullSections && fullSections.length > 0) {
      manualContext = fullSections.map((s) => {
        const title = language === 'es' && s.title_es ? s.title_es : s.title_en;
        const content = language === 'es' && s.content_es ? s.content_es : s.content_en;
        // Increased from 2000 to 4000 chars to include more content
        const truncatedContent = content && content.length > 8000 
          ? content.substring(0, 8000) + '...'
          : content;
        return `## ${title}\n${truncatedContent || ''}`;
      }).join('\n\n---\n\n');
      console.log('[ask] Using full content for context');
    } else {
      manualContext = searchResults.map((r: { title: string; snippet: string }) =>
        `## ${r.title}\n${r.snippet.replace(/<\/?mark>/g, '')}`
      ).join('\n\n---\n\n');
      console.log('[ask] Using snippets for context');
    }

    const citations: Citation[] = searchResults.map((r: { id: string; slug: string; title: string }) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
    }));

    // =========================================================================
    // 8. CALL LOVABLE AI (GROUNDED PROMPT)
    // =========================================================================
    // Build system prompt based on expand mode
    const conciseInstructions = language === 'es'
      ? '- Sé conciso: 1-2 oraciones + viñetas si es necesario'
      : '- Be concise: 1-2 sentences + bullets if needed';
    
    const expandedInstructions = language === 'es'
      ? '- Proporciona una respuesta detallada y completa\n- Incluye todos los pasos relevantes, explicaciones y contexto\n- Usa viñetas o listas numeradas para mayor claridad'
      : '- Provide a detailed and comprehensive answer\n- Include all relevant steps, explanations, and context\n- Use bullet points or numbered lists for clarity';

    const systemPrompt = language === 'es'
      ? `Eres un entrenador de restaurante para Alamo Prime, un steakhouse americano moderno. Ayuda al equipo a entender operaciones, políticas y cultura usando el manual de entrenamiento.

Reglas:
- Sintetiza respuestas del contenido relevante—no requieras coincidencias exactas
${expand ? expandedInstructions : conciseInstructions}
- Si no está cubierto, di "Pregunta a tu gerente sobre esto."
- Nunca inventes políticas o datos que no estén en el manual
- Sé cálido y alentador`
      : `You are a restaurant trainer for Alamo Prime, a modern American steakhouse. Help team members understand operations, policies, and culture using the training manual below.

Rules:
- Synthesize answers from relevant content—don't require exact wording matches
${expand ? expandedInstructions : conciseInstructions}
- If truly not covered, say "Ask your manager about this."
- Never invent policies or facts not in the manual
- Be warm and encouraging`;

    // Build user prompt with optional section context
    const contextPrefix = sectionContext 
      ? (language === 'es' ? `(${sectionContext}) ` : `(${sectionContext}) `)
      : '';
    
    const userPrompt = language === 'es'
      ? `Pregunta: ${contextPrefix}${question}\n\nContenido del manual:\n${manualContext}`
      : `Question: ${contextPrefix}${question}\n\nManual content:\n${manualContext}`;

    console.log('[ask] Calling Lovable AI...', expand ? '(expanded mode)' : '(concise mode)');

    const aiGatewayUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('[ask] LOVABLE_API_KEY not configured');
      return errorResponse('server_error', 'AI service not configured', 500);
    }

    const aiResponse = await fetch(aiGatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: expand ? 1200 : 500,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[ask] AI API error:', aiResponse.status, errorText);
      return errorResponse('ai_error', 'Failed to generate answer', 500);
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      console.error('[ask] Empty AI response');
      return errorResponse('ai_error', 'Failed to generate answer', 500);
    }

    console.log('[ask] AI response received, length:', answer.length);

    // =========================================================================
    // 8. INCREMENT USAGE COUNTER
    // =========================================================================
    const { data: newUsage, error: incrementError } = await supabase
      .rpc('increment_usage', { _user_id: userId, _group_id: groupId });

    if (incrementError) {
      // Log but don't fail the request - answer was generated
      console.error('[ask] Failed to increment usage:', incrementError.message);
    } else {
      console.log('[ask] Usage incremented:', newUsage?.[0]);
    }

    // Update usage info with new counts
    const updatedUsage: UsageInfo = newUsage?.[0]
      ? {
          daily: { used: newUsage[0].daily_count, limit: newUsage[0].daily_limit },
          monthly: { used: newUsage[0].monthly_count, limit: newUsage[0].monthly_limit },
        }
      : usageInfo;

    // =========================================================================
    // 9. RETURN ANSWER + CITATIONS
    // =========================================================================
    console.log('[ask] Success - returning answer with', citations.length, 'citations');

    return jsonResponse({
      answer,
      citations,
      usage: updatedUsage,
    });

  } catch (error) {
    console.error('[ask] Unexpected error:', error);
    return errorResponse('server_error', 'An unexpected error occurred', 500);
  }
});
