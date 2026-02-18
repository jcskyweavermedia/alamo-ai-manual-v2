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
  /** Tool name: search_handbook (default), search_dishes, search_wines, etc. */
  tool?: string;
}

// Maps product search tool names to their RPC function names
const PRODUCT_SEARCH_TOOLS: Record<string, string> = {
  search_dishes: 'search_dishes',
  search_wines: 'search_wines',
  search_cocktails: 'search_cocktails',
  search_recipes: 'search_recipes',
  search_beer_liquor: 'search_beer_liquor',
};

// Table + columns to fetch for full-detail enrichment after search
const ENRICH_CONFIG: Record<string, { table: string; columns: string }> = {
  search_dishes: {
    table: 'foh_plate_specs',
    columns: 'id, menu_name, plate_type, short_description, detailed_description, ingredients, key_ingredients, flavor_profile, allergens, upsell_notes, notes',
  },
  search_wines: {
    table: 'wines',
    columns: 'id, name, producer, region, country, vintage, varietal, style, body, tasting_notes, producer_notes, notes',
  },
  search_cocktails: {
    table: 'cocktails',
    columns: 'id, name, style, glass, ingredients, key_ingredients, procedure, tasting_notes, description, notes',
  },
  search_beer_liquor: {
    table: 'beer_liquor_list',
    columns: 'id, name, category, subcategory, producer, country, description, style, notes',
  },
  // search_recipes handled specially (UNION of prep_recipes + plate_specs)
};

// deno-lint-ignore no-explicit-any
function formatDishDetail(d: any): string {
  const parts = [`## ${d.menu_name}`];
  if (d.plate_type) parts.push(`Type: ${d.plate_type}`);
  if (d.short_description) parts.push(d.short_description);
  if (d.detailed_description) parts.push(d.detailed_description);
  if (d.ingredients?.length) parts.push(`Ingredients: ${d.ingredients.join(', ')}`);
  if (d.key_ingredients?.length) parts.push(`Key Ingredients: ${d.key_ingredients.join(', ')}`);
  if (d.flavor_profile?.length) parts.push(`Flavor: ${d.flavor_profile.join(', ')}`);
  if (d.allergens?.length) parts.push(`Allergens: ${d.allergens.join(', ')}`);
  if (d.upsell_notes) parts.push(`Upsell: ${d.upsell_notes}`);
  if (d.notes) parts.push(`Notes: ${d.notes}`);
  return parts.join('\n');
}

// deno-lint-ignore no-explicit-any
function formatWineDetail(w: any): string {
  const parts = [`## ${w.name}`];
  if (w.producer) parts.push(`Producer: ${w.producer}`);
  if (w.varietal) parts.push(`Varietal: ${w.varietal}`);
  if (w.style) parts.push(`Style: ${w.style}`);
  if (w.body) parts.push(`Body: ${w.body}`);
  if (w.region || w.country) parts.push(`Origin: ${[w.region, w.country].filter(Boolean).join(', ')}`);
  if (w.vintage) parts.push(`Vintage: ${w.vintage}`);
  if (w.tasting_notes) parts.push(`Tasting: ${w.tasting_notes}`);
  if (w.producer_notes) parts.push(`Producer Notes: ${w.producer_notes}`);
  if (w.notes) parts.push(`Notes: ${w.notes}`);
  return parts.join('\n');
}

// deno-lint-ignore no-explicit-any
function formatCocktailDetail(c: any): string {
  const parts = [`## ${c.name}`];
  if (c.style) parts.push(`Style: ${c.style}`);
  if (c.glass) parts.push(`Glass: ${c.glass}`);
  if (c.description) parts.push(c.description);
  if (c.ingredients) parts.push(`Ingredients: ${c.ingredients}`);
  if (c.key_ingredients) parts.push(`Key Ingredients: ${c.key_ingredients}`);
  if (c.procedure) {
    const procText = typeof c.procedure === 'string' ? c.procedure : JSON.stringify(c.procedure);
    parts.push(`Procedure: ${procText}`);
  }
  if (c.tasting_notes) parts.push(`Tasting: ${c.tasting_notes}`);
  if (c.notes) parts.push(`Notes: ${c.notes}`);
  return parts.join('\n');
}

// deno-lint-ignore no-explicit-any
function formatBeerLiquorDetail(b: any): string {
  const parts = [`## ${b.name}`];
  if (b.category) parts.push(`Category: ${b.category}`);
  if (b.subcategory) parts.push(`Subcategory: ${b.subcategory}`);
  if (b.producer) parts.push(`Producer: ${b.producer}`);
  if (b.country) parts.push(`Country: ${b.country}`);
  if (b.style) parts.push(`Style: ${b.style}`);
  if (b.description) parts.push(b.description);
  if (b.notes) parts.push(`Notes: ${b.notes}`);
  return parts.join('\n');
}

// deno-lint-ignore no-explicit-any
function formatPrepRecipeDetail(r: any): string {
  const parts = [`## ${r.name} (Prep Recipe)`];
  if (r.prep_type) parts.push(`Type: ${r.prep_type}`);
  if (r.yield_qty) parts.push(`Yield: ${r.yield_qty} ${r.yield_unit || ''}`);
  if (r.shelf_life_value) parts.push(`Shelf Life: ${r.shelf_life_value} ${r.shelf_life_unit || ''}`);
  if (r.ingredients) {
    const ingText = typeof r.ingredients === 'string' ? r.ingredients : JSON.stringify(r.ingredients);
    parts.push(`Ingredients: ${ingText}`);
  }
  if (r.procedure) {
    const procText = typeof r.procedure === 'string' ? r.procedure : JSON.stringify(r.procedure);
    parts.push(`Procedure: ${procText}`);
  }
  if (r.training_notes) {
    const tnText = typeof r.training_notes === 'string' ? r.training_notes : JSON.stringify(r.training_notes);
    parts.push(`Training Notes: ${tnText}`);
  }
  return parts.join('\n');
}

// deno-lint-ignore no-explicit-any
function formatPlateSpecDetail(p: any): string {
  const parts = [`## ${p.name} (Plate Spec)`];
  if (p.plate_type) parts.push(`Type: ${p.plate_type}`);
  if (p.components) {
    const compText = typeof p.components === 'string' ? p.components : JSON.stringify(p.components);
    parts.push(`Components: ${compText}`);
  }
  if (p.assembly_procedure) {
    const procText = typeof p.assembly_procedure === 'string' ? p.assembly_procedure : JSON.stringify(p.assembly_procedure);
    parts.push(`Assembly: ${procText}`);
  }
  if (p.allergens?.length) parts.push(`Allergens: ${p.allergens.join(', ')}`);
  if (p.notes) parts.push(`Notes: ${p.notes}`);
  return parts.join('\n');
}

// Tool → formatter mapping for simple (single-table) tools
const FORMATTERS: Record<string, (row: unknown) => string> = {
  search_dishes: formatDishDetail,
  search_wines: formatWineDetail,
  search_cocktails: formatCocktailDetail,
  search_beer_liquor: formatBeerLiquorDetail,
};

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
    const { query, language = 'en', groupId, tool = 'search_handbook' }: SearchRequest = await req.json();

    if (!query || !groupId) {
      return new Response(JSON.stringify({ error: 'Missing query or groupId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[realtime-search] Query:', query, 'Language:', language, 'Tool:', tool, 'User:', userId);

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

    // =========================================================================
    // PRODUCT SEARCH (search_dishes, search_wines, etc.)
    // =========================================================================
    const productRpc = PRODUCT_SEARCH_TOOLS[tool];
    if (productRpc) {
      console.log('[realtime-search] Product search via RPC:', productRpc);

      const rpcParams: Record<string, unknown> = {
        search_query: query,
        result_limit: 3,
      };
      if (embedding) {
        rpcParams.query_embedding = JSON.stringify(embedding);
      }

      const { data: productResults, error: productError } = await supabase.rpc(productRpc, rpcParams);

      if (productError) {
        console.error('[realtime-search] Product search error:', productError);
      }

      if (!productResults?.length) {
        return new Response(JSON.stringify({
          content: language === 'es'
            ? "No encontré productos relevantes."
            : "No relevant products found.",
          sections: [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ---------------------------------------------------------------
      // Enrich: fetch full row data from source tables (like handbook does)
      // ---------------------------------------------------------------
      // deno-lint-ignore no-explicit-any
      const ids = productResults.map((r: any) => r.id);
      let formatted = '';

      if (tool === 'search_recipes') {
        // Recipes come from UNION: split by source_table
        // deno-lint-ignore no-explicit-any
        const prepIds = productResults.filter((r: any) => r.source_table === 'prep_recipe').map((r: any) => r.id);
        // deno-lint-ignore no-explicit-any
        const plateIds = productResults.filter((r: any) => r.source_table === 'plate_spec').map((r: any) => r.id);
        const parts: string[] = [];

        if (prepIds.length) {
          const { data: prepRows } = await supabase
            .from('prep_recipes')
            .select('id, name, prep_type, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, ingredients, procedure, training_notes')
            .in('id', prepIds);
          if (prepRows) parts.push(...prepRows.map(formatPrepRecipeDetail));
        }
        if (plateIds.length) {
          const { data: plateRows } = await supabase
            .from('plate_specs')
            .select('id, name, plate_type, components, assembly_procedure, allergens, notes')
            .in('id', plateIds);
          if (plateRows) parts.push(...plateRows.map(formatPlateSpecDetail));
        }
        formatted = parts.join('\n\n---\n\n');
      } else {
        // Single-table tools: fetch full rows and format
        const config = ENRICH_CONFIG[tool];
        const formatter = FORMATTERS[tool];
        if (config && formatter) {
          const { data: fullRows } = await supabase
            .from(config.table)
            .select(config.columns)
            .in('id', ids);
          if (fullRows) {
            formatted = fullRows.map(formatter).join('\n\n---\n\n');
          }
        }
      }

      // Fallback: if enrichment failed, use search snippets
      if (!formatted) {
        // deno-lint-ignore no-explicit-any
        formatted = productResults.map((r: any) => {
          const name = r.menu_name || r.name || 'Unknown';
          const snippet = r.snippet || r.description || r.short_description || '';
          return `## ${name}\n${snippet}`;
        }).join('\n\n---\n\n');
      }

      // Truncate for voice context window
      const truncated = formatted.length > 5000
        ? formatted.substring(0, 5000) + '...'
        : formatted;

      console.log('[realtime-search] Returning', productResults.length, 'enriched product results, chars:', truncated.length);

      return new Response(JSON.stringify({
        content: truncated,
        // deno-lint-ignore no-explicit-any
        sections: productResults.map((r: any) => ({
          slug: r.slug || r.id,
          title: r.menu_name || r.name,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // SOS SEARCH (search_steps_of_service)
    // =========================================================================
    if (tool === 'search_steps_of_service') {
      console.log('[realtime-search] SOS search via RPC: search_steps_of_service');

      // deno-lint-ignore no-explicit-any
      const rpcParams: Record<string, any> = {
        search_query: query,
        p_group_id: groupId,
        search_language: language,
        result_limit: 5,
      };
      if (embedding) {
        rpcParams.query_embedding = JSON.stringify(embedding);
      }

      const { data: sosResults, error: sosError } = await supabase.rpc('search_steps_of_service', rpcParams);

      if (sosError) {
        console.error('[realtime-search] SOS search error:', sosError);
      }

      if (!sosResults?.length) {
        return new Response(JSON.stringify({
          content: language === 'es'
            ? "No encontré información relevante en los pasos de servicio."
            : "No relevant information found in the steps of service.",
          sections: [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Format SOS results — snippet already has highlighted text
      // deno-lint-ignore no-explicit-any
      const formatted = sosResults.map((r: any) => {
        const title = r.title || r.section_key || 'Unknown';
        // Strip <mark> tags for voice context
        const snippet = (r.snippet || '').replace(/<\/?mark>/g, '');
        return `## ${title}\n${snippet}`;
      }).join('\n\n---\n\n');

      const truncated = formatted.length > 3000
        ? formatted.substring(0, 3000) + '...'
        : formatted;

      console.log('[realtime-search] Returning', sosResults.length, 'SOS results');

      return new Response(JSON.stringify({
        content: truncated,
        // deno-lint-ignore no-explicit-any
        sections: sosResults.map((r: any) => ({
          slug: r.section_key,
          title: r.title,
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================================
    // HANDBOOK SEARCH (default: search_handbook)
    // =========================================================================

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

    // deno-lint-ignore no-explicit-any
    console.log('[realtime-search] Found', results.length, 'results:', results.map((r: any) => r.slug));

    // Fetch full content for results
    // deno-lint-ignore no-explicit-any
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
