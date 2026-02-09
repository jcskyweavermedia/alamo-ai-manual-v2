/**
 * Realtime Search Edge Function
 * 
 * Handles search_handbook tool calls from the WebRTC client.
 * Uses hybrid search (FTS + vector) for best results.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.log('[realtime-search] Invalid token:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Parse request
    const { query, language = 'en', groupId }: SearchRequest = await req.json();

    if (!query || !groupId) {
      return new Response(JSON.stringify({ error: 'Missing query or groupId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[realtime-search] Query:', query, 'Language:', language, 'User:', userId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify membership
    const { data: membershipData } = await supabase
      .from('group_memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .single();

    if (!membershipData) {
      console.log('[realtime-search] User not a member of group');
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
        console.log('[realtime-search] Generating embedding...');
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
          console.log('[realtime-search] Embedding generated, dimensions:', embedding?.length);
        } else {
          console.log('[realtime-search] Embedding API error:', embResponse.status);
        }
      } catch (e) {
        console.log('[realtime-search] Embedding failed, falling back to keyword search:', e);
      }
    }

    // Perform search
    let results;
    if (embedding) {
      // Hybrid search (FTS + vector with RRF)
      console.log('[realtime-search] Running hybrid search...');
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
      console.log('[realtime-search] Running keyword search...');
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
        content: language === 'es' 
          ? "No encontré información relevante en el manual."
          : "No relevant information found in the handbook.",
        sections: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[realtime-search] Found', results.length, 'results:', results.map((r: any) => r.slug));

    // Fetch full content for results
    const slugs = results.map((r: any) => r.slug);
    const { data: sections, error: sectionsError } = await supabase
      .from('manual_sections')
      .select('slug, title_en, title_es, content_en, content_es')
      .in('slug', slugs);

    if (sectionsError) {
      console.error('[realtime-search] Sections fetch error:', sectionsError);
    }

    if (!sections?.length) {
      return new Response(JSON.stringify({
        content: language === 'es' 
          ? "No encontré información relevante en el manual."
          : "No relevant information found in the handbook.",
        sections: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format for voice response - truncate for voice brevity
    const formatted = sections.map(s => {
      const title = language === 'es' && s.title_es ? s.title_es : s.title_en;
      const content = language === 'es' && s.content_es ? s.content_es : s.content_en;
      // Truncate to ~2500 chars for voice context window
      const truncated = content && content.length > 2500 
        ? content.substring(0, 2500) + '...'
        : content;
      return `## ${title}\n${truncated || ''}`;
    }).join('\n\n---\n\n');

    console.log('[realtime-search] Returning', sections.length, 'sections, total chars:', formatted.length);

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
