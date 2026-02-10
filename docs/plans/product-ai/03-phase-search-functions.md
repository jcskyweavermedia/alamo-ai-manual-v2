# Phase 3 — Search Functions (DB Layer)

> PostgreSQL functions for each domain search (FTS + vector hybrid). ~1 session.

## Context

Phase 2 created 6 product tables with `search_vector` (tsvector/GIN) and `embedding` (vector/HNSW) columns on every table. Phase 4 will populate the embeddings. This phase creates the PostgreSQL RPC functions that combine full-text search and vector similarity via **Reciprocal Rank Fusion (RRF)** — the same proven pattern used by `hybrid_search_manual` for manual sections.

Products are **English-only** (per master plan scope decision), so there is no `language` parameter. The AI translates to Spanish in its response when needed.

---

## Prerequisites

- [x] Phase 2 complete: all 6 product tables exist with data
- [x] GIN indexes on `search_vector` columns (created in Phase 2)
- [x] HNSW indexes on `embedding` columns (created in Phase 2)
- [x] FTS triggers auto-populate `search_vector` on INSERT/UPDATE (created in Phase 2)
- [ ] Embeddings populated (Phase 4) — **functions will still work without embeddings** (FTS-only mode), but RRF quality improves once embeddings exist

> **Important:** Phase 3 and Phase 4 can run in parallel. The search functions gracefully handle NULL embeddings — they simply return FTS-only results until embeddings are generated.

---

## Reference: Existing `hybrid_search_manual` Pattern

The existing manual search function (migration `20260207235340`) establishes the RRF pattern all product functions will follow:

```
1. Accept: search_query (text), query_embedding (vector), result_limit, keyword_weight, vector_weight
2. CTE kw:  FTS ranked results using ts_rank + plainto_tsquery
3. CTE vec: Vector ranked results using <=> cosine distance
4. CTE combined: RRF merge — score = kw_weight/(60+kw_rank) + vec_weight/(60+vec_rank)
5. JOIN back to source table for output columns
6. Return: id, slug, name, snippet (ts_headline), score
```

Key constants: **k = 60** (RRF smoothing), default weights **0.4 keyword / 0.6 vector**.

---

## Migration Strategy

**One migration** containing all 5 search functions:

| Migration Name | Purpose |
|---------------|---------|
| `create_product_search_functions` | 5 `CREATE OR REPLACE FUNCTION` statements |

Pushed via `npx supabase db push`.

---

## Common Function Signature

All 5 functions share this structure:

```sql
CREATE OR REPLACE FUNCTION public.search_{domain}(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  combined_score FLOAT
  -- plus domain-specific columns listed below
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$ ... $$;
```

### Parameter Notes

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| `search_query` | *(required)* | User's question text, used for FTS |
| `query_embedding` | *(required)* | Pre-computed 1536d vector from the edge function (OpenAI `text-embedding-3-small`) |
| `result_limit` | `5` | Product tables have 5–15 rows. Default 5 is generous. The edge function will typically request 3–5. |
| `keyword_weight` | `0.4` | FTS weight in RRF combination |
| `vector_weight` | `0.6` | Vector weight in RRF combination — semantic match gets slightly more weight |

### Why `SECURITY DEFINER`?

The functions are called via Supabase RPC from edge functions using the **service role key**. `SECURITY DEFINER` ensures the function runs as the owner (postgres), bypassing RLS. The edge function handles authentication and authorization before calling these functions.

### Why `STABLE`?

The functions perform read-only queries. Marking them `STABLE` allows PostgreSQL to optimize repeated calls within the same transaction.

---

## Function 1: `search_dishes`

**Source table:** `foh_plate_specs`

**Extra return columns:** `plate_type TEXT`, `is_top_seller BOOLEAN`

**Snippet source:** `short_description` + `detailed_description` (concatenated for `ts_headline`)

```sql
CREATE OR REPLACE FUNCTION public.search_dishes(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  plate_type TEXT,
  is_top_seller BOOLEAN,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  -- Keyword results ranked by FTS relevance
  kw AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(d.search_vector, ts_query) DESC
      ) AS pos
    FROM foh_plate_specs d
    WHERE d.search_vector @@ ts_query
      AND d.status = 'published'
    LIMIT result_limit * 2
  ),

  -- Vector results ranked by cosine similarity
  vec AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        ORDER BY d.embedding <=> query_embedding
      ) AS pos
    FROM foh_plate_specs d
    WHERE d.embedding IS NOT NULL
      AND d.status = 'published'
    LIMIT result_limit * 2
  ),

  -- RRF combination: score = weight / (k + rank), k = 60
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )

  SELECT
    c.id,
    d.slug,
    d.menu_name,
    ts_headline('english',
      COALESCE(d.short_description, '') || ' ' || COALESCE(d.detailed_description, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    d.plate_type,
    d.is_top_seller,
    c.score
  FROM combined c
  JOIN foh_plate_specs d ON d.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

**Row count:** 12 dishes — FTS and vector each scan all 12 (trivial).

---

## Function 2: `search_wines`

**Source table:** `wines`

**Extra return columns:** `varietal TEXT`, `style TEXT`

**Snippet source:** `tasting_notes` + `producer_notes`

```sql
CREATE OR REPLACE FUNCTION public.search_wines(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  varietal TEXT,
  style TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  kw AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(w.search_vector, ts_query) DESC
      ) AS pos
    FROM wines w
    WHERE w.search_vector @@ ts_query
      AND w.status = 'published'
    LIMIT result_limit * 2
  ),

  vec AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (
        ORDER BY w.embedding <=> query_embedding
      ) AS pos
    FROM wines w
    WHERE w.embedding IS NOT NULL
      AND w.status = 'published'
    LIMIT result_limit * 2
  ),

  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )

  SELECT
    c.id,
    w.slug,
    w.name,
    ts_headline('english',
      COALESCE(w.tasting_notes, '') || ' ' || COALESCE(w.producer_notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    w.varietal,
    w.style,
    c.score
  FROM combined c
  JOIN wines w ON w.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

**Row count:** 5 wines.

---

## Function 3: `search_cocktails`

**Source table:** `cocktails`

**Extra return columns:** `style TEXT`

**Snippet source:** `description` + `tasting_notes`

```sql
CREATE OR REPLACE FUNCTION public.search_cocktails(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  style TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  kw AS (
    SELECT
      ct.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(ct.search_vector, ts_query) DESC
      ) AS pos
    FROM cocktails ct
    WHERE ct.search_vector @@ ts_query
      AND ct.status = 'published'
    LIMIT result_limit * 2
  ),

  vec AS (
    SELECT
      ct.id,
      ROW_NUMBER() OVER (
        ORDER BY ct.embedding <=> query_embedding
      ) AS pos
    FROM cocktails ct
    WHERE ct.embedding IS NOT NULL
      AND ct.status = 'published'
    LIMIT result_limit * 2
  ),

  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )

  SELECT
    c.id,
    ct.slug,
    ct.name,
    ts_headline('english',
      COALESCE(ct.description, '') || ' ' || COALESCE(ct.tasting_notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    ct.style,
    c.score
  FROM combined c
  JOIN cocktails ct ON ct.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

**Row count:** 5 cocktails.

---

## Function 4: `search_recipes`

**Source tables:** `prep_recipes` UNION `plate_specs`

**Extra return columns:** `source_table TEXT`

**Snippet source:** Varies by source table (see below)

This is the most complex function because it searches across **two tables** and unions the results before applying RRF.

### Design Decision: UNION Approach

| Option | Pros | Cons |
|--------|------|------|
| **A: UNION in each CTE** | Single function, single RRF pass | Slightly more complex SQL |
| B: Two separate functions | Simpler per-function | Caller must merge results, two RPC calls |
| C: Materialized view | Clean single-table search | Extra maintenance, trigger complexity |

**Chosen: Option A** — Union the two tables inside the FTS and vector CTEs, then apply a single RRF pass across all results. This gives the best ranking because a prep recipe and a plate spec about the same dish compete fairly for the same result slots.

### Source Identification

Each row carries a `source_table TEXT` field: `'prep_recipe'` or `'plate_spec'`. The edge function uses this to fetch the full row from the correct table when needed.

```sql
CREATE OR REPLACE FUNCTION public.search_recipes(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  source_table TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  -- Union both tables for FTS
  all_fts AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           ts_rank(r.search_vector, ts_query) AS rank
    FROM prep_recipes r
    WHERE r.search_vector @@ ts_query
      AND r.status = 'published'
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           ts_rank(p.search_vector, ts_query) AS rank
    FROM plate_specs p
    WHERE p.search_vector @@ ts_query
      AND p.status = 'published'
  ),
  kw AS (
    SELECT af.id, af.src,
           ROW_NUMBER() OVER (ORDER BY af.rank DESC) AS pos
    FROM all_fts af
    LIMIT result_limit * 2
  ),

  -- Union both tables for vector similarity
  all_vec AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           r.embedding <=> query_embedding AS dist
    FROM prep_recipes r
    WHERE r.embedding IS NOT NULL
      AND r.status = 'published'
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           p.embedding <=> query_embedding AS dist
    FROM plate_specs p
    WHERE p.embedding IS NOT NULL
      AND p.status = 'published'
  ),
  vec AS (
    SELECT av.id, av.src,
           ROW_NUMBER() OVER (ORDER BY av.dist ASC) AS pos
    FROM all_vec av
    LIMIT result_limit * 2
  ),

  -- RRF combination
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      COALESCE(kw.src, vec.src) AS src,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  ),

  -- Build output with snippets from the correct source table
  with_names AS (
    SELECT
      c.id,
      c.src,
      c.score,
      CASE c.src
        WHEN 'prep_recipe' THEN r.slug
        WHEN 'plate_spec' THEN p.slug
      END AS slug,
      CASE c.src
        WHEN 'prep_recipe' THEN r.name
        WHEN 'plate_spec' THEN p.name
      END AS name,
      CASE c.src
        WHEN 'prep_recipe' THEN COALESCE(r.name, '') || ' ' || COALESCE(r.prep_type, '') || ' ' || COALESCE(array_to_string(r.tags, ' '), '')
        WHEN 'plate_spec' THEN COALESCE(p.name, '') || ' ' || COALESCE(p.plate_type, '') || ' ' || COALESCE(p.notes, '')
      END AS headline_text
    FROM combined c
    LEFT JOIN prep_recipes r  ON c.src = 'prep_recipe' AND r.id = c.id
    LEFT JOIN plate_specs  p  ON c.src = 'plate_spec'  AND p.id = c.id
  )

  SELECT
    wn.id,
    wn.slug,
    wn.name,
    ts_headline('english',
      wn.headline_text,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    wn.src,
    wn.score
  FROM with_names wn
  WHERE wn.score > 0
  ORDER BY wn.score DESC
  LIMIT result_limit;
END;
$$;
```

**Row count:** 4 prep_recipes + 3 plate_specs = 7 total rows searched.

### Edge Case: Same Dish in Both Tables

A dish like "Bone-In Ribeye" may exist in both `prep_recipes` (as a related prep) and `plate_specs` (as the plate). The UNION approach correctly treats them as separate results with separate IDs. The AI can use `source_table` to distinguish between a recipe and a plating spec.

---

## Function 5: `search_beer_liquor`

**Source table:** `beer_liquor_list`

**Extra return columns:** `category TEXT`, `subcategory TEXT`

**Snippet source:** `description` + `style` + `notes`

```sql
CREATE OR REPLACE FUNCTION public.search_beer_liquor(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  snippet TEXT,
  category TEXT,
  subcategory TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery;
BEGIN
  ts_query := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH
  kw AS (
    SELECT
      bl.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(bl.search_vector, ts_query) DESC
      ) AS pos
    FROM beer_liquor_list bl
    WHERE bl.search_vector @@ ts_query
      AND bl.status = 'published'
    LIMIT result_limit * 2
  ),

  vec AS (
    SELECT
      bl.id,
      ROW_NUMBER() OVER (
        ORDER BY bl.embedding <=> query_embedding
      ) AS pos
    FROM beer_liquor_list bl
    WHERE bl.embedding IS NOT NULL
      AND bl.status = 'published'
    LIMIT result_limit * 2
  ),

  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (
        keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
        vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      )::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )

  SELECT
    c.id,
    bl.slug,
    bl.name,
    ts_headline('english',
      COALESCE(bl.description, '') || ' ' || COALESCE(bl.style, '') || ' ' || COALESCE(bl.notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
    ),
    bl.category,
    bl.subcategory,
    c.score
  FROM combined c
  JOIN beer_liquor_list bl ON bl.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

**Row count:** 15 items (7 beers + 8 liquors).

---

## Graceful Degradation: No Embeddings Yet

Since Phase 3 and Phase 4 can run in parallel, the search functions must handle the case where `embedding` columns are all NULL (embeddings haven't been generated yet).

**How it works:**

1. The `vec` CTE has `WHERE d.embedding IS NOT NULL` — with all NULLs, this returns **zero rows**
2. The `FULL OUTER JOIN` in `combined` still includes all `kw` results (FTS matches)
3. RRF score degrades gracefully: `score = keyword_weight / (60 + kw_pos) + 0` — still a valid ranking
4. Once embeddings are populated (Phase 4), vector results appear automatically — no function changes needed

**Result:** Functions work in FTS-only mode immediately after Phase 2, then automatically improve to hybrid mode after Phase 4.

---

## Implementation Steps

### Step 1: Create the Migration

```bash
cd "C:\Users\juanc\CascadeProjects\Restaurant App\alamo-ai-manual-v2"
npx supabase migration new create_product_search_functions
```

### Step 2: Write the SQL

Place all 5 `CREATE OR REPLACE FUNCTION` statements in the migration file. Order doesn't matter (no dependencies between functions).

File: `supabase/migrations/YYYYMMDDHHMMSS_create_product_search_functions.sql`

```sql
-- ============================================================
-- Product Search Functions (FTS + Vector Hybrid via RRF)
-- ============================================================
-- Pattern: Same as hybrid_search_manual (manual sections)
-- English-only (no language parameter)
-- Gracefully degrades to FTS-only when embeddings are NULL
-- ============================================================

-- 1. search_dishes
CREATE OR REPLACE FUNCTION public.search_dishes(...) ...;

-- 2. search_wines
CREATE OR REPLACE FUNCTION public.search_wines(...) ...;

-- 3. search_cocktails
CREATE OR REPLACE FUNCTION public.search_cocktails(...) ...;

-- 4. search_recipes (UNION: prep_recipes + plate_specs)
CREATE OR REPLACE FUNCTION public.search_recipes(...) ...;

-- 5. search_beer_liquor
CREATE OR REPLACE FUNCTION public.search_beer_liquor(...) ...;
```

### Step 3: Push to Cloud

```bash
npx supabase db push
```

### Step 4: Verify

Run the verification queries (next section).

---

## Verification Checklist

### All 5 Functions Exist

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'search_dishes', 'search_wines', 'search_cocktails',
    'search_recipes', 'search_beer_liquor'
  )
ORDER BY routine_name;
-- Expected: 5 rows
```

### FTS-Only Mode Works (Before Embeddings)

These tests work even with NULL embeddings — they exercise the FTS path only. A zero vector is used as a placeholder (no semantic match possible).

```sql
-- Helper: generate a 1536-dimension zero vector for testing
-- Used in all test queries below
-- (Once embeddings exist in Phase 4, replace with a real query embedding)

-- Test search_dishes: "ribeye" should match
SELECT name, combined_score
FROM search_dishes(
  'ribeye steak',
  (SELECT array_fill(0::real, ARRAY[1536])::vector),
  5
);
-- Expected: at least "16oz Bone-In Ribeye" returned via FTS
```

```sql
-- Test search_wines: "bordeaux" should match Château Margaux
SELECT name, varietal, combined_score
FROM search_wines(
  'bordeaux cabernet',
  (SELECT array_fill(0::real, ARRAY[1536])::vector),
  5
);
-- Expected: at least "Château Margaux 2018" returned
```

```sql
-- Test search_cocktails: "espresso" should match Espresso Martini
SELECT name, style, combined_score
FROM search_cocktails(
  'espresso coffee',
  (SELECT array_fill(0::real, ARRAY[1536])::vector),
  5
);
-- Expected: at least "Espresso Martini" returned
```

```sql
-- Test search_recipes: "chimichurri" should match across prep_recipes
SELECT name, source_table, combined_score
FROM search_recipes(
  'chimichurri herb',
  (SELECT array_fill(0::real, ARRAY[1536])::vector),
  5
);
-- Expected: at least "Chimichurri" from prep_recipes returned
```

```sql
-- Test search_beer_liquor: "bourbon" should match
SELECT name, category, subcategory, combined_score
FROM search_beer_liquor(
  'bourbon whiskey',
  (SELECT array_fill(0::real, ARRAY[1536])::vector),
  5
);
-- Expected: at least one Bourbon item returned
```

### Zero Results Don't Error

```sql
-- Search for nonsense should return empty, not error
SELECT * FROM search_dishes(
  'xyzzy foobar',
  (SELECT array_fill(0::real, ARRAY[1536])::vector),
  5
);
-- Expected: 0 rows, no error
```

### Function Signatures Match Expected Return Types

```sql
-- Check return columns for search_dishes
SELECT parameter_name, data_type
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND specific_name LIKE 'search_dishes%'
  AND parameter_mode = 'OUT'
ORDER BY ordinal_position;
-- Expected: id (uuid), slug (text), name (text), snippet (text),
--           plate_type (text), is_top_seller (boolean), combined_score (double precision)
```

### Callable via Supabase RPC

After deployment, the functions are automatically exposed as Supabase RPC endpoints:

```typescript
// From edge function (service role client):
const { data, error } = await supabase.rpc('search_dishes', {
  search_query: 'ribeye',
  query_embedding: embeddingVector,  // 1536-dim float array
  result_limit: 3
});
```

This will be the primary calling pattern in Phase 5 (`/ask-product` edge function).

---

## Summary: Return Type Reference

| Function | Extra Columns | Source Table(s) | Row Count |
|----------|--------------|-----------------|-----------|
| `search_dishes` | `plate_type`, `is_top_seller` | `foh_plate_specs` | 12 |
| `search_wines` | `varietal`, `style` | `wines` | 5 |
| `search_cocktails` | `style` | `cocktails` | 5 |
| `search_recipes` | `source_table` | `prep_recipes` + `plate_specs` | 7 |
| `search_beer_liquor` | `category`, `subcategory` | `beer_liquor_list` | 15 |

All functions return the common columns: `id UUID`, `slug TEXT`, `name TEXT`, `snippet TEXT`, `combined_score FLOAT`.

---

## Files Created/Modified

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_create_product_search_functions.sql` | Created — 5 PG search functions |

No frontend files are modified in this phase.

---

## Edge Cases & Notes

### Empty `search_query`

If the user's question is empty or produces an empty tsquery, the `kw` CTE returns 0 rows. Only vector results (if embeddings exist) contribute to the score. This is acceptable — the edge function should validate non-empty queries before calling these functions.

### Special Characters in Query

`plainto_tsquery` safely handles special characters, quotes, and punctuation — it strips them and produces a valid tsquery. No SQL injection risk.

### Very Short Queries (1 word)

Single-word queries like "ribeye" work well with FTS. Vector search adds semantic context (e.g., matching "steak" even if the word "ribeye" doesn't appear). This is the primary value of hybrid search.

### `result_limit * 2` in CTEs

Each CTE fetches up to `result_limit * 2` candidates before RRF merging. This ensures enough overlap between FTS and vector results for meaningful fusion. With small tables (5–15 rows), this effectively scans most or all rows anyway.

### Future: Adding Filters

The current functions don't support filters (e.g., `plate_type = 'entree'`). If needed in a future phase, add optional filter parameters:

```sql
-- Future extension example:
CREATE OR REPLACE FUNCTION public.search_dishes(
  search_query TEXT,
  query_embedding vector(1536),
  result_limit INT DEFAULT 5,
  keyword_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6,
  filter_plate_type TEXT DEFAULT NULL  -- optional filter
)
```

This is out of scope for Phase 3 but noted here for reference.
