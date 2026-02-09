/**
 * Embed Sections Edge Function
 * 
 * Generates OpenAI embeddings for manual sections.
 * Called manually or triggered when content changes.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =============================================================================
// TYPES
// =============================================================================

interface EmbedRequest {
  sectionId?: string; // Optional: embed specific section, otherwise embed all with NULL embeddings
}

interface Section {
  id: string;
  title_en: string;
  title_es: string | null;
  content_en: string | null;
  content_es: string | null;
  category: string;
  tags: string[] | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

function buildEmbeddingText(section: Section, language: 'en' | 'es'): string {
  const title = language === 'es' && section.title_es ? section.title_es : section.title_en;
  const content = language === 'es' && section.content_es ? section.content_es : section.content_en;
  const tags = section.tags?.join(', ') || '';
  
  return `Title: ${title}\nCategory: ${section.category}\nTags: ${tags}\nContent: ${content || ''}`;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[embed-sections] Request received');

  try {
    // =========================================================================
    // 1. VALIDATE CONFIGURATION
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[embed-sections] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. PARSE REQUEST
    // =========================================================================
    let sectionId: string | undefined;
    
    try {
      const body = await req.json() as EmbedRequest;
      sectionId = body.sectionId;
    } catch {
      // Empty body is fine - will process all sections with NULL embeddings
    }

    // =========================================================================
    // 3. FETCH SECTIONS TO EMBED
    // =========================================================================
    let query = supabase
      .from('manual_sections')
      .select('id, title_en, title_es, content_en, content_es, category, tags')
      .eq('is_category', false);

    if (sectionId) {
      query = query.eq('id', sectionId);
      console.log('[embed-sections] Processing specific section:', sectionId);
    } else {
      // Find sections with NULL embeddings
      query = query.is('embedding_en', null);
      console.log('[embed-sections] Processing sections with NULL embeddings');
    }

    const { data: sections, error: fetchError } = await query.limit(20);

    if (fetchError) {
      console.error('[embed-sections] Fetch error:', fetchError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sections', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sections || sections.length === 0) {
      console.log('[embed-sections] No sections need embedding');
      return new Response(
        JSON.stringify({ message: 'No sections need embedding', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[embed-sections] Processing ${sections.length} sections`);

    // =========================================================================
    // 4. GENERATE EMBEDDINGS
    // =========================================================================
    let processed = 0;
    const errors: string[] = [];

    for (const section of sections) {
      try {
        const updates: Record<string, unknown> = {};

        // English embedding (always generate if content exists)
        if (section.content_en) {
          const textEn = buildEmbeddingText(section, 'en');
          const embeddingEn = await generateEmbedding(textEn, OPENAI_API_KEY);
          updates.embedding_en = JSON.stringify(embeddingEn);
          console.log(`[embed-sections] Generated EN embedding for: ${section.title_en}`);
        }

        // Spanish embedding (only if Spanish content exists)
        if (section.content_es) {
          const textEs = buildEmbeddingText(section, 'es');
          const embeddingEs = await generateEmbedding(textEs, OPENAI_API_KEY);
          updates.embedding_es = JSON.stringify(embeddingEs);
          console.log(`[embed-sections] Generated ES embedding for: ${section.title_en}`);
        }

        // Update database
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('manual_sections')
            .update(updates)
            .eq('id', section.id);

          if (updateError) {
            console.error(`[embed-sections] Update failed for ${section.id}:`, updateError.message);
            errors.push(`${section.title_en}: ${updateError.message}`);
          } else {
            processed++;
            console.log(`[embed-sections] ✓ ${section.title_en}`);
          }
        }

        // Small delay to avoid rate limiting
        if (sections.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[embed-sections] Error processing ${section.id}:`, errorMessage);
        errors.push(`${section.title_en}: ${errorMessage}`);
      }
    }

    // =========================================================================
    // 5. RETURN RESULT
    // =========================================================================
    console.log(`[embed-sections] Complete. Processed: ${processed}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        processed,
        total: sections.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[embed-sections] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
