# Phase 2: Search Function Upgrades

**Parent**: [00-master-plan.md](./00-master-plan.md)
**Status**: Audited — Ready to implement
**Dependencies**: None (can run in parallel with Phase 1)
**Blocks**: Phase 3 (Unified Text AI), Phase 4 (Voice Pipeline)

### Audit Log (2026-02-11)

**Round 1** — Plan reviewed against existing migrations and edge functions:

| Check | Status |
|-------|--------|
| Existing `search_dishes` signature matches plan base | Confirmed — `(search_query, query_embedding, result_limit, keyword_weight, vector_weight)` |
| Existing `search_wines` signature matches | Confirmed |
| Existing `search_cocktails` signature matches | Confirmed |
| Existing `search_recipes` UNION pattern preserved | Confirmed — LEFT JOIN with `prep_recipes` + `plate_specs` |
| Existing `search_beer_liquor` signature matches | Confirmed |
| `hybrid_search_manual` adaptive weighting pattern | Confirmed — `kw_stats` CTE with `CASE` scoring |
| CTE alias conventions match originals | Confirmed — `kw`, `vec`, `combined` (not renamed) |
| `SECURITY DEFINER SET search_path` on all | Confirmed |
| No breaking signature changes for existing callers | Confirmed — only default `result_limit` changed, all callers pass explicit values |

**Round 2** — Deep cross-reference against actual schema + edge function RPC calls:

| Check | Status |
|-------|--------|
| `manual_sections` column names (`search_vector_en/es`, `title_en/es`, `content_en/es`, `embedding_en/es`) | Confirmed — all match actual CREATE TABLE |
| Product table column refs (`search_vector`, `embedding`, `menu_name`, etc.) | Confirmed — all match actual migration SQL |
| Edge functions pass `result_limit` explicitly | Confirmed — `/ask`=5, `/ask-product`=5, `/realtime-voice`=2, `/realtime-search`=2 |
| `::FLOAT` cast on `combined` CTE score (all 6 functions) | **Fixed** — `search_manual_v2` was missing `(CASE ... END)::FLOAT` |
| `::INT` cast on `kw_stats` (all 6 functions) | **Fixed** — `search_manual_v2` was missing `COUNT(*)::INT` |
| `search_recipes` documentation vs SQL consistency | **Fixed** — text said "count from all_fts" but SQL correctly counts from `kw` |
| Diff template CTE aliases match actual SQL | **Fixed** — changed `k.pos`/`v.pos` to `kw.pos`/`vec.pos` |
| Objective #4 "optional similarity floor" | **Fixed** — removed (not implemented in this phase) |

---

## Objective

Standardize all search functions into a consistent, unified pattern so the Phase 3 edge function can call any of them interchangeably. Specific goals:

1. **Create `search_manual_v2`** — a new hybrid RRF function for manual sections, replacing the current split (`search_manual` FTS-only + `hybrid_search_manual` hybrid)
2. **Upgrade all 5 product search functions** with adaptive weighting and wider defaults
3. **Ensure consistent call pattern** across all 6 functions for the unified edge function
4. **Improve recall** via wider result limits and richer snippets

---

## Current State Audit

### 7 Functions Across 2 Patterns

| Function | Type | Default Limit | Adaptive Weighting | Status Filter | Language |
|----------|------|--------------|-------------------|---------------|----------|
| `search_manual` | FTS only | 20 | N/A | `is_category=false` | EN/ES |
| `hybrid_search_manual` | FTS + vector RRF | 10 | Yes (0-hit fallback) | `is_category=false` | EN/ES |
| `search_dishes` | FTS + vector RRF | 5 | No | `status='published'` | EN only |
| `search_wines` | FTS + vector RRF | 5 | No | `status='published'` | EN only |
| `search_cocktails` | FTS + vector RRF | 5 | No | `status='published'` | EN only |
| `search_recipes` | FTS + vector RRF | 5 | No | `status='published'` | EN only |
| `search_beer_liquor` | FTS + vector RRF | 5 | No | `status='published'` | EN only |

### Signature Inconsistencies

| Parameter | `hybrid_search_manual` | Product Functions |
|-----------|----------------------|-------------------|
| `search_query` | TEXT | TEXT |
| `query_embedding` | vector(1536) | vector(1536) |
| `search_language` | TEXT DEFAULT 'en' | *(missing)* |
| `result_limit` | INT DEFAULT 10 | INT DEFAULT 5 |
| `keyword_weight` | FLOAT DEFAULT 0.4 | FLOAT DEFAULT 0.4 |
| `vector_weight` | FLOAT DEFAULT 0.6 | FLOAT DEFAULT 0.6 |

### Return Type Inconsistencies

| Field | `hybrid_search_manual` | Product Functions |
|-------|----------------------|-------------------|
| Title/name | `title TEXT` | `name TEXT` |
| Score | `combined_score FLOAT` | `combined_score FLOAT` |
| Extra | `category, tags, file_path` | domain-specific fields |

### Current Edge Function Usage

| Edge Function | Calls | Result Limit |
|---------------|-------|-------------|
| `/ask` | `hybrid_search_manual` → fallback `search_manual` | 5 |
| `/ask-product` | `search_dishes`, `search_wines`, etc. (dynamic) | 5 |
| `/realtime-voice` | `hybrid_search_manual` → fallback `search_manual` | 2 |
| `/realtime-search` | `hybrid_search_manual` → fallback `search_manual` | 2 |

---

## Target State

### 6 Unified Search Functions

| Function | Type | Default Limit | Adaptive Weighting | Language |
|----------|------|--------------|-------------------|----------|
| **`search_manual_v2`** | FTS + vector RRF | **8** | **Yes** | EN/ES |
| `search_dishes` (v2) | FTS + vector RRF | **8** | **Yes** | EN only |
| `search_wines` (v2) | FTS + vector RRF | **8** | **Yes** | EN only |
| `search_cocktails` (v2) | FTS + vector RRF | **8** | **Yes** | EN only |
| `search_recipes` (v2) | FTS + vector RRF | **8** | **Yes** | EN only |
| `search_beer_liquor` (v2) | FTS + vector RRF | **8** | **Yes** | EN only |

### Consistent Input Signature (Product Functions)

```
(search_query TEXT, query_embedding vector(1536), result_limit INT DEFAULT 8,
 keyword_weight FLOAT DEFAULT 0.4, vector_weight FLOAT DEFAULT 0.6)
```

### Manual Search Signature (extra `search_language`)

```
(search_query TEXT, query_embedding vector(1536), search_language TEXT DEFAULT 'en',
 result_limit INT DEFAULT 8, keyword_weight FLOAT DEFAULT 0.4, vector_weight FLOAT DEFAULT 0.6)
```

> **Why not add `search_language` to product functions?** Products are English-only (per scope decision in product-ai master plan). Adding an unused parameter creates false expectations. The Phase 3 unified edge function simply passes `search_language` only when calling `search_manual_v2`.

### Unified Return Pattern

All functions return at minimum:

```
id              UUID
slug            TEXT
name            TEXT          -- "name" everywhere (manual returns title renamed to name)
snippet         TEXT          -- ts_headline with <mark> tags
combined_score  FLOAT         -- RRF score
```

Plus domain-specific extras:

| Function | Extra Columns |
|----------|--------------|
| `search_manual_v2` | `category TEXT, tags TEXT[], file_path TEXT` |
| `search_dishes` | `plate_type TEXT, is_top_seller BOOLEAN` |
| `search_wines` | `varietal TEXT, style TEXT` |
| `search_cocktails` | `style TEXT` |
| `search_recipes` | `source_table TEXT` |
| `search_beer_liquor` | `category TEXT, subcategory TEXT` |

---

## Changes Per Function

### 1. NEW: `search_manual_v2`

**Why new function instead of modifying existing?**

The current `/ask`, `/realtime-voice`, and `/realtime-search` edge functions call `hybrid_search_manual` and `search_manual` by name. Modifying them in-place would break those edge functions if signatures change. Creating a new function preserves backward compatibility until Phase 3 rewrites the edge functions and Phase 8 drops the old ones.

**Changes from `hybrid_search_manual`:**

| Aspect | `hybrid_search_manual` | `search_manual_v2` |
|--------|----------------------|-------------------|
| Default `result_limit` | 10 | **8** |
| Return field name | `title` | **`name`** (renamed for consistency) |
| Snippet `MaxWords` | 35 | **50** (richer context) |
| Snippet `MinWords` | 15 | **20** |
| Internal fetch multiple | `result_limit * 2` | `result_limit * 2` (unchanged) |
| Adaptive weighting | Yes (already has it) | Yes (carried over) |

**Full signature:**

```sql
CREATE OR REPLACE FUNCTION public.search_manual_v2(
  search_query      TEXT,
  query_embedding   vector(1536),
  search_language   TEXT DEFAULT 'en',
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,           -- was "title" in hybrid_search_manual
  snippet         TEXT,
  category        TEXT,
  tags            TEXT[],
  combined_score  FLOAT,
  file_path       TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
```

**Implementation:** Copy from `hybrid_search_manual` with the above adjustments. The adaptive weighting logic (0-hit FTS → 100% vector) is preserved.

---

### 2. UPGRADE: `search_dishes`

**Changes:**

| Aspect | Current | Upgraded |
|--------|---------|---------|
| Default `result_limit` | 5 | **8** |
| Snippet `MaxWords` | 35 | **50** |
| Snippet `MinWords` | 15 | **20** |
| Adaptive weighting | No | **Yes** |

**Adaptive weighting addition:**

```sql
-- Add kw_stats CTE (matching hybrid_search_manual pattern):
kw_stats AS (
  SELECT COUNT(*) AS hit_count FROM kw
),

-- Modify scoring in combined CTE:
CASE
  WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
    COALESCE(1.0 / (60 + v.pos), 0)
  ELSE
    keyword_weight * COALESCE(1.0 / (60 + k.pos), 0) +
    vector_weight * COALESCE(1.0 / (60 + v.pos), 0)
END AS combined_score
```

**No other changes.** Status filter, NULL handling, SECURITY DEFINER all stay the same.

---

### 3. UPGRADE: `search_wines`

Same upgrade pattern as `search_dishes`:
- Default `result_limit`: 5 → **8**
- Snippet `MaxWords`: 35 → **50**, `MinWords`: 15 → **20**
- Add adaptive weighting (kw_stats CTE + CASE scoring)

---

### 4. UPGRADE: `search_cocktails`

Same upgrade pattern:
- Default `result_limit`: 5 → **8**
- Snippet `MaxWords`: 35 → **50**, `MinWords`: 15 → **20**
- Add adaptive weighting

---

### 5. UPGRADE: `search_recipes`

Same upgrade pattern, but this function is more complex (UNION across `prep_recipes` + `plate_specs`):
- Default `result_limit`: 5 → **8**
- Snippet `MaxWords`: 35 → **50**, `MinWords`: 15 → **20**
- Add adaptive weighting — applied to the combined CTE after the UNION, counting FTS hits across both tables

**Special consideration:** The `kw_stats` CTE counts from the ranked `kw` CTE (which already unions both tables via `all_fts`). This correctly detects whether *any* FTS hits exist across both recipe tables:

```sql
-- After kw CTE (which ranks all_fts results):
kw_stats AS (
  SELECT COUNT(*)::INT AS hit_count FROM kw
),
```

---

### 6. UPGRADE: `search_beer_liquor`

Same upgrade pattern as `search_dishes`:
- Default `result_limit`: 5 → **8**
- Snippet `MaxWords`: 35 → **50**, `MinWords`: 15 → **20**
- Add adaptive weighting

---

## What We DON'T Change

| Item | Reason |
|------|--------|
| `search_manual` (FTS-only) | Kept for backward compat — `/ask` fallback path uses it |
| `hybrid_search_manual` | Kept for backward compat — `/ask`, `/realtime-voice`, `/realtime-search` use it |
| Edge functions | Not modified until Phase 3 (text AI) and Phase 4 (voice) |
| RRF constant (k=60) | No evidence it needs tuning; consistent across all functions |
| Default weights (0.4/0.6) | Working well; unified edge function can override per-call |
| Product function signatures | No new params added — `result_limit` default changes, callers that pass explicitly are unaffected |

---

## Backward Compatibility

### Existing callers that pass `result_limit` explicitly

| Edge Function | Call | Passes `result_limit` | Impact |
|---------------|------|----------------------|--------|
| `/ask` | `hybrid_search_manual(..., result_limit: 5)` | Yes, explicit 5 | **None** — overrides new default |
| `/ask-product` | `search_*(... , result_limit: 5)` | Yes, explicit 5 | **None** — overrides new default |
| `/realtime-voice` | `hybrid_search_manual(..., result_limit: 2)` | Yes, explicit 2 | **None** — overrides new default |
| `/realtime-search` | `hybrid_search_manual(..., result_limit: 2)` | Yes, explicit 2 | **None** — overrides new default |

All existing callers pass `result_limit` explicitly, so the default change from 5→8 has **zero impact** on existing behavior.

### Adaptive weighting impact on existing callers

The adaptive weighting only activates when FTS returns 0 hits. In this scenario, the current behavior is:
- **Current**: 0.4 * 0 + 0.6 * vector_score = 0.6 * vector_score (works, but suboptimal)
- **Upgraded**: 1.0 * vector_score (pure vector, better recall)

This is a strict improvement — better results in edge cases, identical behavior in normal cases.

---

## Migration SQL

### Single Migration File

All changes in one `CREATE OR REPLACE FUNCTION` migration:

**Migration name**: `upgrade_search_functions_v2`

### Execution Order

1. Create `search_manual_v2` (new function)
2. Replace `search_dishes` (CREATE OR REPLACE)
3. Replace `search_wines` (CREATE OR REPLACE)
4. Replace `search_cocktails` (CREATE OR REPLACE)
5. Replace `search_recipes` (CREATE OR REPLACE)
6. Replace `search_beer_liquor` (CREATE OR REPLACE)

> **Note:** `CREATE OR REPLACE FUNCTION` preserves existing grants and doesn't require dropping/recreating. Safe for in-place upgrades.

---

## `search_manual_v2` — Full SQL

```sql
CREATE OR REPLACE FUNCTION public.search_manual_v2(
  search_query      TEXT,
  query_embedding   vector(1536),
  search_language   TEXT DEFAULT 'en',
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  category        TEXT,
  tags            TEXT[],
  combined_score  FLOAT,
  file_path       TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query    tsquery;
  ts_config   regconfig;
BEGIN
  -- Determine language config
  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
  ELSE
    ts_config := 'english'::regconfig;
  END IF;

  ts_query := plainto_tsquery(ts_config, search_query);

  RETURN QUERY
  WITH kw AS (
    SELECT
      ms.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(
        CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END,
        ts_query
      ) DESC) AS pos
    FROM public.manual_sections ms
    WHERE ms.is_category = false
      AND CASE WHEN search_language = 'es' THEN ms.search_vector_es ELSE ms.search_vector_en END @@ ts_query
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      ms.id,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE
            WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL
              THEN ms.embedding_es
            ELSE ms.embedding_en
          END <=> query_embedding
      ) AS pos
    FROM public.manual_sections ms
    WHERE ms.is_category = false
      AND CASE
            WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL
              THEN ms.embedding_es
            ELSE ms.embedding_en
          END IS NOT NULL
    ORDER BY
      CASE
        WHEN search_language = 'es' AND ms.embedding_es IS NOT NULL
          THEN ms.embedding_es
        ELSE ms.embedding_en
      END <=> query_embedding
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    ms.id,
    ms.slug,
    CASE
      WHEN search_language = 'es' AND ms.title_es IS NOT NULL AND ms.title_es <> ''
        THEN ms.title_es
      ELSE ms.title_en
    END AS name,
    ts_headline(
      ts_config,
      CASE
        WHEN search_language = 'es' AND ms.content_es IS NOT NULL AND ms.content_es <> ''
          THEN ms.content_es
        ELSE ms.content_en
      END,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ) AS snippet,
    ms.category,
    ms.tags,
    c.score AS combined_score,
    ms.file_path
  FROM combined c
  JOIN public.manual_sections ms ON ms.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

---

## Product Function Upgrade Template

Each product function gets the same 3 modifications. Below is the pattern using `search_dishes` as an example. The other 4 follow identically (with their own table/column references).

### Diff Summary (applies to all 5 product functions)

```diff
 -- Parameter default change:
-  result_limit      INT DEFAULT 5,
+  result_limit      INT DEFAULT 8,

 -- Add kw_stats CTE after kw CTE:
+  kw_stats AS (
+    SELECT COUNT(*) AS hit_count FROM kw
+  ),

 -- Modify scoring in combined CTE:
-  keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
-  vector_weight * COALESCE(1.0 / (60 + vec.pos), 0) AS combined_score
+  (CASE
+    WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
+      COALESCE(1.0 / (60 + vec.pos), 0)
+    ELSE
+      keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
+      vector_weight * COALESCE(1.0 / (60 + vec.pos), 0)
+  END)::FLOAT AS combined_score

 -- Snippet change:
-  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
+  'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
```

### `search_recipes` Special Case

The `search_recipes` function has a UNION pattern across `prep_recipes` + `plate_specs`. The `kw_stats` CTE counts from the combined `all_fts` CTE:

```sql
-- After all_fts CTE:
kw_stats AS (
  SELECT COUNT(*) AS hit_count FROM all_fts
),
```

The adaptive weighting is applied in the `combined` CTE (same as other functions).

---

## Full SQL for Each Upgraded Product Function

### `search_dishes` (v2)

```sql
CREATE OR REPLACE FUNCTION public.search_dishes(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  plate_type      TEXT,
  is_top_seller   BOOLEAN,
  combined_score  FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery := plainto_tsquery('english', search_query);
BEGIN
  RETURN QUERY
  WITH
  kw AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(d.search_vector, ts_query) DESC
      ) AS pos
    FROM public.foh_plate_specs d
    WHERE d.search_vector @@ ts_query
      AND d.status = 'published'
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      d.id,
      ROW_NUMBER() OVER (
        ORDER BY d.embedding <=> query_embedding
      ) AS pos
    FROM public.foh_plate_specs d
    WHERE d.embedding IS NOT NULL
      AND d.status = 'published'
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    c.id,
    d.slug,
    d.menu_name,
    ts_headline('english',
      COALESCE(d.short_description, '') || ' ' || COALESCE(d.detailed_description, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    d.plate_type,
    d.is_top_seller,
    c.score
  FROM combined c
  JOIN public.foh_plate_specs d ON d.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

### `search_wines` (v2)

```sql
CREATE OR REPLACE FUNCTION public.search_wines(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  varietal        TEXT,
  style           TEXT,
  combined_score  FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery := plainto_tsquery('english', search_query);
BEGIN
  RETURN QUERY
  WITH
  kw AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(w.search_vector, ts_query) DESC
      ) AS pos
    FROM public.wines w
    WHERE w.search_vector @@ ts_query
      AND w.status = 'published'
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      w.id,
      ROW_NUMBER() OVER (
        ORDER BY w.embedding <=> query_embedding
      ) AS pos
    FROM public.wines w
    WHERE w.embedding IS NOT NULL
      AND w.status = 'published'
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    c.id,
    w.slug,
    w.name,
    ts_headline('english',
      COALESCE(w.tasting_notes, '') || ' ' || COALESCE(w.producer_notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    w.varietal,
    w.style,
    c.score
  FROM combined c
  JOIN public.wines w ON w.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

### `search_cocktails` (v2)

```sql
CREATE OR REPLACE FUNCTION public.search_cocktails(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  style           TEXT,
  combined_score  FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery := plainto_tsquery('english', search_query);
BEGIN
  RETURN QUERY
  WITH
  kw AS (
    SELECT
      ct.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(ct.search_vector, ts_query) DESC
      ) AS pos
    FROM public.cocktails ct
    WHERE ct.search_vector @@ ts_query
      AND ct.status = 'published'
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      ct.id,
      ROW_NUMBER() OVER (
        ORDER BY ct.embedding <=> query_embedding
      ) AS pos
    FROM public.cocktails ct
    WHERE ct.embedding IS NOT NULL
      AND ct.status = 'published'
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    c.id,
    ct.slug,
    ct.name,
    ts_headline('english',
      COALESCE(ct.description, '') || ' ' || COALESCE(ct.tasting_notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    ct.style,
    c.score
  FROM combined c
  JOIN public.cocktails ct ON ct.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

### `search_recipes` (v2)

```sql
CREATE OR REPLACE FUNCTION public.search_recipes(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  source_table    TEXT,
  combined_score  FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery := plainto_tsquery('english', search_query);
BEGIN
  RETURN QUERY
  WITH
  all_fts AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           ts_rank(r.search_vector, ts_query) AS rank
    FROM public.prep_recipes r
    WHERE r.search_vector @@ ts_query
      AND r.status = 'published'
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           ts_rank(p.search_vector, ts_query) AS rank
    FROM public.plate_specs p
    WHERE p.search_vector @@ ts_query
      AND p.status = 'published'
  ),
  kw AS (
    SELECT af.id, af.src,
           ROW_NUMBER() OVER (ORDER BY af.rank DESC) AS pos
    FROM all_fts af
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  all_vec AS (
    SELECT r.id, 'prep_recipe'::TEXT AS src,
           r.embedding <=> query_embedding AS dist
    FROM public.prep_recipes r
    WHERE r.embedding IS NOT NULL
      AND r.status = 'published'
    UNION ALL
    SELECT p.id, 'plate_spec'::TEXT AS src,
           p.embedding <=> query_embedding AS dist
    FROM public.plate_specs p
    WHERE p.embedding IS NOT NULL
      AND p.status = 'published'
  ),
  vec AS (
    SELECT av.id, av.src,
           ROW_NUMBER() OVER (ORDER BY av.dist ASC) AS pos
    FROM all_vec av
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      COALESCE(kw.src, vec.src) AS src,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  ),
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
    LEFT JOIN public.prep_recipes r  ON c.src = 'prep_recipe' AND r.id = c.id
    LEFT JOIN public.plate_specs  p  ON c.src = 'plate_spec'  AND p.id = c.id
  )
  SELECT
    wn.id,
    wn.slug,
    wn.name,
    ts_headline('english',
      wn.headline_text,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
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

### `search_beer_liquor` (v2)

```sql
CREATE OR REPLACE FUNCTION public.search_beer_liquor(
  search_query      TEXT,
  query_embedding   vector(1536),
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  name            TEXT,
  snippet         TEXT,
  category        TEXT,
  subcategory     TEXT,
  combined_score  FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query tsquery := plainto_tsquery('english', search_query);
BEGIN
  RETURN QUERY
  WITH
  kw AS (
    SELECT
      bl.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(bl.search_vector, ts_query) DESC
      ) AS pos
    FROM public.beer_liquor_list bl
    WHERE bl.search_vector @@ ts_query
      AND bl.status = 'published'
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      bl.id,
      ROW_NUMBER() OVER (
        ORDER BY bl.embedding <=> query_embedding
      ) AS pos
    FROM public.beer_liquor_list bl
    WHERE bl.embedding IS NOT NULL
      AND bl.status = 'published'
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS id,
      (CASE
        WHEN (SELECT hit_count FROM kw_stats) = 0 THEN
          COALESCE(1.0 / (60 + vec.pos), 0)
        ELSE
          keyword_weight * COALESCE(1.0 / (60 + kw.pos), 0) +
          vector_weight  * COALESCE(1.0 / (60 + vec.pos), 0)
      END)::FLOAT AS score
    FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    c.id,
    bl.slug,
    bl.name,
    ts_headline('english',
      COALESCE(bl.description, '') || ' ' || COALESCE(bl.style, '') || ' ' || COALESCE(bl.notes, ''),
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ),
    bl.category,
    bl.subcategory,
    c.score
  FROM combined c
  JOIN public.beer_liquor_list bl ON bl.id = c.id
  WHERE c.score > 0
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;
```

---

## Verification Checklist

After applying the migration, verify:

### Function Existence

- [ ] `search_manual_v2` exists in `pg_proc`
- [ ] `search_dishes` updated (check `pg_proc.prosrc` for `kw_stats`)
- [ ] `search_wines` updated
- [ ] `search_cocktails` updated
- [ ] `search_recipes` updated
- [ ] `search_beer_liquor` updated

### Backward Compatibility

- [ ] `search_manual` (FTS-only) still exists and works
- [ ] `hybrid_search_manual` still exists and works
- [ ] Existing edge functions (`/ask`, `/ask-product`, `/realtime-voice`, `/realtime-search`) still return results

### New Defaults

- [ ] `search_manual_v2` default `result_limit` = 8
- [ ] All product functions default `result_limit` = 8
- [ ] Existing callers passing explicit `result_limit` are unaffected

### Adaptive Weighting

- [ ] `search_dishes`: Query with no FTS hits returns pure vector results
- [ ] `search_wines`: Same
- [ ] `search_cocktails`: Same
- [ ] `search_recipes`: Same (across both tables)
- [ ] `search_beer_liquor`: Same
- [ ] `search_manual_v2`: Adaptive weighting works (inherited from `hybrid_search_manual`)

### Result Quality

- [ ] `search_manual_v2` returns `name` (not `title`) — matches product pattern
- [ ] All snippets use `MaxWords=50, MinWords=20`
- [ ] All functions return `combined_score > 0` only (no zero-score results)
- [ ] `search_recipes` correctly unions `prep_recipes` + `plate_specs`

### Security

- [ ] All 6 functions have `SECURITY DEFINER` + `SET search_path = 'public'`
- [ ] Supabase security advisors report no new warnings

---

## SQL Test Queries (Post-Migration)

```sql
-- 1. Verify all functions exist
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname IN (
  'search_manual_v2', 'search_dishes', 'search_wines',
  'search_cocktails', 'search_recipes', 'search_beer_liquor'
)
AND pronamespace = 'public'::regnamespace;

-- 2. Test search_manual_v2 (FTS + vector hybrid)
-- Use a real query embedding for proper test
SELECT * FROM search_manual_v2(
  'opening procedures',
  (SELECT embedding_en FROM manual_sections WHERE slug = 'opening-procedures' LIMIT 1),
  'en', 5
);

-- 3. Test adaptive weighting — gibberish FTS query, meaningful embedding
SELECT * FROM search_dishes(
  'xyznonexistent',
  (SELECT embedding FROM foh_plate_specs LIMIT 1),
  5
);
-- Expected: Should return vector-only results (adaptive weighting kicks in)

-- 4. Test default result_limit = 8
SELECT COUNT(*) FROM search_wines(
  'red wine',
  (SELECT embedding FROM wines LIMIT 1)
);
-- Expected: up to 8 results (or fewer if < 8 published wines)

-- 5. Verify backward compatibility — old functions still work
SELECT COUNT(*) FROM hybrid_search_manual(
  'dress code',
  (SELECT embedding_en FROM manual_sections WHERE slug = 'dress-code' LIMIT 1),
  'en', 5
);

SELECT COUNT(*) FROM search_manual(
  'dress code', 'en', 5
);

-- 6. Verify snippet length (should be longer than before)
SELECT slug, name, LENGTH(snippet) AS snippet_len
FROM search_dishes(
  'steak',
  (SELECT embedding FROM foh_plate_specs LIMIT 1),
  3
);

-- 7. Verify search_recipes unions both tables
SELECT slug, name, source_table
FROM search_recipes(
  'ribeye',
  (SELECT embedding FROM plate_specs LIMIT 1),
  5
);
```

---

## File Outputs

This phase produces **one migration file**:

```
supabase/migrations/YYYYMMDDHHMMSS_upgrade_search_functions_v2.sql
```

No edge function changes. No frontend changes. Pure database function updates.

---

## Estimated Effort

- Migration writing: ~30 minutes (SQL already drafted above)
- Pre-push audit: ~15 minutes
- Push + post-push verification: ~15 minutes
- Total: ~1 hour
