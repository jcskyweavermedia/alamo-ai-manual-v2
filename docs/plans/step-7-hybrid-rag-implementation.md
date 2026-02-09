# Step 7: Hybrid RAG Implementation Plan

## Overview

Hybrid search combining **keyword search** (PostgreSQL FTS) + **vector search** (pgvector + OpenAI embeddings). Embeddings auto-generate when content changes via `pg_net` trigger.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Content Update Flow                               │
│  INSERT/UPDATE manual_sections                                       │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Trigger: update_manual_section_search_vectors              │    │
│  │  1. Update FTS vectors (sync, in-DB)                        │    │
│  │  2. NULL out embedding columns                              │    │
│  │  3. Call /embed-sections via pg_net (async HTTP)            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼ (async)                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Edge Function: /embed-sections                              │    │
│  │  1. Fetch section content                                    │    │
│  │  2. Call OpenAI text-embedding-3-small                       │    │
│  │  3. Store embedding in manual_sections                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Query Flow                                        │
│  User asks: "What should I wear?"                                    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Edge Function: /ask                                         │    │
│  │  1. Generate query embedding (OpenAI)                        │    │
│  │  2. Call hybrid_search_manual()                              │    │
│  │  3. Build context + call Lovable AI                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  RPC: hybrid_search_manual()                                 │    │
│  │  ┌────────────────┐    ┌────────────────┐                   │    │
│  │  │  FTS Search    │    │ Vector Search  │                   │    │
│  │  │  (keywords)    │    │ (semantic)     │                   │    │
│  │  └───────┬────────┘    └───────┬────────┘                   │    │
│  │          └──────────┬──────────┘                             │    │
│  │                     ▼                                        │    │
│  │          Reciprocal Rank Fusion                              │    │
│  │                     │                                        │    │
│  │                     ▼                                        │    │
│  │              Top 5 Results                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Database Migration

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add embedding columns (1536 dims for text-embedding-3-small)
ALTER TABLE public.manual_sections
ADD COLUMN IF NOT EXISTS embedding_en vector(1536),
ADD COLUMN IF NOT EXISTS embedding_es vector(1536);

-- Create HNSW indexes for fast vector search
CREATE INDEX IF NOT EXISTS idx_manual_sections_embedding_en 
ON public.manual_sections 
USING hnsw (embedding_en vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_manual_sections_embedding_es 
ON public.manual_sections 
USING hnsw (embedding_es vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

### Step 2: Update Trigger (Auto-Embed via pg_net)

```sql
CREATE OR REPLACE FUNCTION public.update_manual_section_search_vectors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  supabase_url TEXT;
  anon_key TEXT;
  content_changed BOOLEAN := false;
BEGIN
  -- Build English search vector (existing)
  NEW.search_vector_en := 
    setweight(to_tsvector('english', coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content_en, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'C');
  
  -- Build Spanish search vector (existing)
  NEW.search_vector_es := 
    setweight(to_tsvector('spanish', coalesce(NEW.title_es, NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.content_es, NEW.content_en, '')), 'B') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  
  -- Check if content changed (for embedding regeneration)
  IF TG_OP = 'INSERT' THEN
    content_changed := true;
  ELSIF TG_OP = 'UPDATE' THEN
    content_changed := (
      OLD.content_en IS DISTINCT FROM NEW.content_en OR
      OLD.content_es IS DISTINCT FROM NEW.content_es OR
      OLD.title_en IS DISTINCT FROM NEW.title_en OR
      OLD.title_es IS DISTINCT FROM NEW.title_es
    );
  END IF;
  
  -- If content changed, null embeddings and trigger async regeneration
  IF content_changed AND NOT NEW.is_category THEN
    NEW.embedding_en := NULL;
    NEW.embedding_es := NULL;
    
    -- Get Supabase config from environment
    supabase_url := current_setting('app.settings.supabase_url', true);
    anon_key := current_setting('app.settings.anon_key', true);
    
    -- Async call to embed-sections (fire and forget)
    IF supabase_url IS NOT NULL AND anon_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/embed-sections',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || anon_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('sectionId', NEW.id)
      );
    END IF;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
```

**Note:** The `app.settings` values need to be configured. Alternative: hardcode the project URL/key in the function or use a simpler approach (see Step 2b).

---

### Step 2b: Simpler Trigger (Without pg_net Config)

If pg_net config is complex, use a simpler approach - just NULL the embeddings, and have a one-time backfill + manual re-run when needed:

```sql
CREATE OR REPLACE FUNCTION public.update_manual_section_search_vectors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Build FTS vectors (existing logic)
  NEW.search_vector_en := 
    setweight(to_tsvector('english', coalesce(NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content_en, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'C');
  
  NEW.search_vector_es := 
    setweight(to_tsvector('spanish', coalesce(NEW.title_es, NEW.title_en, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.content_es, NEW.content_en, '')), 'B') ||
    setweight(to_tsvector('spanish', array_to_string(NEW.tags, ' ')), 'C');
  
  -- NULL embeddings if content changed (will be regenerated on next embed-sections call)
  IF TG_OP = 'INSERT' OR 
     OLD.content_en IS DISTINCT FROM NEW.content_en OR
     OLD.content_es IS DISTINCT FROM NEW.content_es OR
     OLD.title_en IS DISTINCT FROM NEW.title_en OR
     OLD.title_es IS DISTINCT FROM NEW.title_es THEN
    IF NOT NEW.is_category THEN
      NEW.embedding_en := NULL;
      NEW.embedding_es := NULL;
    END IF;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
```

Then call `/embed-sections` manually after content updates, or set up a simple cron as backup.

---

### Step 3: Edge Function - embed-sections

```typescript
// supabase/functions/embed-sections/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { sectionId } = await req.json().catch(() => ({}));

    // Build query - specific section or all with NULL embeddings
    let query = supabase
      .from('manual_sections')
      .select('id, title_en, title_es, content_en, content_es, category, tags')
      .eq('is_category', false);

    if (sectionId) {
      query = query.eq('id', sectionId);
    } else {
      query = query.is('embedding_en', null);
    }

    const { data: sections, error: fetchError } = await query.limit(20);
    if (fetchError) throw fetchError;

    if (!sections?.length) {
      return new Response(
        JSON.stringify({ message: 'No sections need embedding', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[embed-sections] Processing ${sections.length} sections`);

    let processed = 0;

    for (const section of sections) {
      const updates: Record<string, any> = {};

      // English embedding
      if (section.content_en) {
        const text = `Title: ${section.title_en}\nCategory: ${section.category}\nTags: ${section.tags?.join(', ') || ''}\nContent: ${section.content_en}`;
        updates.embedding_en = await generateEmbedding(text, OPENAI_API_KEY);
      }

      // Spanish embedding (if content exists)
      if (section.content_es) {
        const text = `Title: ${section.title_es || section.title_en}\nCategory: ${section.category}\nTags: ${section.tags?.join(', ') || ''}\nContent: ${section.content_es}`;
        updates.embedding_es = await generateEmbedding(text, OPENAI_API_KEY);
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('manual_sections')
          .update(updates)
          .eq('id', section.id);

        if (error) {
          console.error(`[embed-sections] Failed ${section.id}:`, error.message);
        } else {
          processed++;
          console.log(`[embed-sections] ✓ ${section.title_en}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ processed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[embed-sections] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateEmbedding(text: string, apiKey: string): Promise<string> {
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
  // Return as JSON string for pgvector
  return JSON.stringify(data.data[0].embedding);
}
```

---

### Step 4: Hybrid Search RPC Function

```sql
CREATE OR REPLACE FUNCTION public.hybrid_search_manual(
  search_query TEXT,
  query_embedding vector(1536),
  search_language TEXT DEFAULT 'en',
  result_limit INT DEFAULT 10,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  snippet TEXT,
  category TEXT,
  tags TEXT[],
  combined_score FLOAT,
  file_path TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
  ts_config regconfig;
BEGIN
  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
    ts_query := plainto_tsquery('spanish', search_query);
  ELSE
    ts_config := 'english'::regconfig;
    ts_query := plainto_tsquery('english', search_query);
  END IF;

  RETURN QUERY
  WITH 
  -- Keyword results with position
  kw AS (
    SELECT 
      ms.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(
        CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END,
        ts_query
      ) DESC) as pos
    FROM manual_sections ms
    WHERE ms.is_category = false
      AND CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END @@ ts_query
    LIMIT result_limit * 2
  ),
  
  -- Vector results with position
  vec AS (
    SELECT 
      ms.id,
      ROW_NUMBER() OVER (ORDER BY 
        CASE WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL 
             THEN ms.embedding_es ELSE ms.embedding_en END <=> query_embedding
      ) as pos
    FROM manual_sections ms
    WHERE ms.is_category = false
      AND CASE WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL 
               THEN ms.embedding_es ELSE ms.embedding_en END IS NOT NULL
    LIMIT result_limit * 2
  ),
  
  -- RRF combination: score = 1/(k + rank), k=60
  combined AS (
    SELECT 
      COALESCE(kw.id, vec.id) as id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT as score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  
  SELECT 
    c.id,
    ms.slug,
    CASE WHEN search_language = 'es' AND ms.title_es IS NOT NULL THEN ms.title_es ELSE ms.title_en END,
    ts_headline(ts_config, 
      COALESCE(CASE WHEN search_language = 'es' AND ms.content_es IS NOT NULL THEN ms.content_es ELSE ms.content_en END, ''),
      ts_query, 'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'),
    ms.category,
    ms.tags,
    c.score,
    ms.file_path
  FROM combined c
  JOIN manual_sections ms ON ms.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

---

### Step 5: Update /ask Edge Function

Add query embedding and hybrid search:

```typescript
// In supabase/functions/ask/index.ts

// Add at top
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// New helper function
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null;
  
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
    if (!response.ok) return null;
    const data = await response.json();
    return data.data[0].embedding;
  } catch {
    return null;
  }
}

// In main handler, replace search call:
const queryEmbedding = await getQueryEmbedding(question);

let searchResults;
if (queryEmbedding) {
  // Hybrid search
  const { data, error } = await supabase.rpc('hybrid_search_manual', {
    search_query: searchQuery,
    query_embedding: JSON.stringify(queryEmbedding),
    search_language: language,
    result_limit: 5,
  });
  if (!error) searchResults = data;
}

// Fallback to keyword-only if hybrid failed
if (!searchResults) {
  const { data, error } = await supabase.rpc('search_manual', {
    search_query: searchQuery,
    search_language: language,
    result_limit: 5,
  });
  if (error) throw error;
  searchResults = data;
}
```

---

### Step 6: Backfill Existing Content

One-time call after deployment:

```bash
# Via curl or Supabase dashboard
POST /functions/v1/embed-sections
Body: {}
```

This will find all sections with NULL embeddings and generate them.

---

## File Changes Summary

| File | Action |
|------|--------|
| Migration SQL | Enable pgvector, add columns, indexes, update trigger, add hybrid_search RPC |
| `supabase/functions/embed-sections/index.ts` | **New** |
| `supabase/functions/ask/index.ts` | Add query embedding + hybrid search |
| `supabase/config.toml` | Add embed-sections function |

---

## Required Secret

| Secret | Value |
|--------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key |

---

## How Auto-Embedding Works

1. **Content inserted/updated** in `manual_sections`
2. **Trigger fires:**
   - Updates FTS vectors (sync)
   - NULLs embedding columns
   - Calls `/embed-sections` via pg_net (async)
3. **embed-sections runs:**
   - Fetches the section
   - Calls OpenAI for embedding
   - Stores in database

**Fallback:** If pg_net call fails, embeddings stay NULL. Next `/embed-sections` call (manual or via backfill) will regenerate.

---

## Implementation Order

| Step | Task | Time |
|------|------|------|
| 1 | Add OPENAI_API_KEY secret | 2 min |
| 2 | Run database migration | 5 min |
| 3 | Create embed-sections function | 10 min |
| 4 | Update /ask function | 10 min |
| 5 | Backfill existing content | 2 min |
| 6 | Test with sample queries | 10 min |

**Total: ~40 minutes**
