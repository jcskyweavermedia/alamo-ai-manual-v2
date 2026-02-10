# Phase 4 — Generate Product Embeddings

> Create `embed-products` edge function and populate all 44 product rows with vector embeddings. ~1 session.

## Context

Phase 2 created 6 product tables with 44 total rows. Each table has an `embedding vector(1536)` column (currently NULL) and an HNSW index ready for cosine similarity search. This phase builds an edge function to generate OpenAI embeddings for every product row, following the exact pattern established by `embed-sections`.

Phase 3 (Search Functions) can run in parallel — search functions work structurally without embeddings; the vector component simply returns no results until embeddings exist.

---

## Prerequisites

- [x] 6 product tables created with `embedding vector(1536)` columns
- [x] 44 rows seeded (4 + 3 + 12 + 5 + 5 + 15)
- [x] HNSW indexes on all 6 `embedding` columns
- [x] `OPENAI_API_KEY` set in Supabase secrets
- [x] `embed-sections` function deployed (reference implementation)

---

## Differences from `embed-sections`

| Aspect | `embed-sections` | `embed-products` |
|--------|-------------------|-------------------|
| Tables | 1 (`manual_sections`) | 6 product tables |
| Languages | Dual (EN + ES → 2 columns) | English-only (1 `embedding` column) |
| Batch limit | 20 rows per call | 50 rows per call (44 total, want single-pass) |
| Scope | All or single `sectionId` | All, single table, or single row |
| Text builder | 1 function | 6 table-specific functions |
| Auth | Publishable key | Service role key (no user auth needed) |

---

## Edge Function: `embed-products`

### File

```
supabase/functions/embed-products/index.ts
```

Single file. No separate modules needed — total is ~250 lines.

### Request

```
POST /functions/v1/embed-products
Authorization: Bearer <SERVICE_ROLE_KEY>
Content-Type: application/json
```

```typescript
interface EmbedProductsRequest {
  table?: string;   // Optional: limit to one table (e.g., "wines")
  rowId?: string;   // Optional: embed single row by UUID
  batchSize?: number; // Optional: max rows per table (default 50)
}
```

- No params → embed all NULL-embedding rows across all 6 tables
- `table` only → embed NULL-embedding rows in that table
- `rowId` + `table` → embed that specific row (re-embed even if non-NULL)

### Response

```typescript
interface EmbedProductsResponse {
  processed: number;
  total: number;
  errors?: string[];
  tables: Record<string, { processed: number; total: number }>;
}
```

Success example:
```json
{
  "processed": 44,
  "total": 44,
  "tables": {
    "prep_recipes": { "processed": 4, "total": 4 },
    "plate_specs": { "processed": 3, "total": 3 },
    "foh_plate_specs": { "processed": 12, "total": 12 },
    "wines": { "processed": 5, "total": 5 },
    "cocktails": { "processed": 5, "total": 5 },
    "beer_liquor_list": { "processed": 15, "total": 15 }
  }
}
```

Idempotent re-run (all rows already embedded):
```json
{
  "processed": 0,
  "total": 0,
  "tables": {}
}
```

---

## Embedding Text Builders

Each table gets a dedicated text builder. The builder concatenates key fields into a structured text block that captures the row's semantic meaning. Fields are ordered by importance (title first, supplementary details last).

### `prep_recipes`

```
Name: Red Wine Demi-Glace
Type: sauce
Tags: signature, mother sauce, slow cook
Yield: 1.5 qt, Shelf Life: 7 days
Ingredients: Veal Stock, Dry red wine (Cabernet), Mirepoix fine dice, Tomato paste, Unsalted butter cold, Fresh thyme leaves, Kosher salt & black pepper
Procedure: Sweat mirepoix in heavy-bottom saucepan... [all step instructions joined by space]
```

**Fields used:** `name`, `prep_type`, `tags` (joined), `yield_qty`+`yield_unit`, `shelf_life_value`+`shelf_life_unit`, `ingredients` JSONB → extract all `items[].name`, `procedure` JSONB → extract all `steps[].instruction`

### `plate_specs`

```
Name: 16oz Bone-In Ribeye
Type: entree
Category: entree
Tags: signature, grill, premium
Components: Ribeye steak, Herb Compound Butter, Red Wine Demi-Glace, Fingerling potatoes roasted, Broccolini
Assembly: Season steak generously with salt... [all step instructions joined by space]
Notes: Resting the steak is non-negotiable...
```

**Fields used:** `name`, `plate_type`, `menu_category`, `tags` (joined), `components` JSONB → extract all `items[].name`, `assembly_procedure` JSONB → extract all `steps[].instruction`, `notes`

### `foh_plate_specs`

```
Menu Name: Loaded Queso
Type: appetizer
Short Description: Our signature queso blanco loaded with smoked brisket...
Detailed Description: Alamo Prime's Loaded Queso is the appetizer that sets the tone...
Key Ingredients: White American cheese, Smoked brisket, Roasted jalapeños, Pickled red onion
Flavor Profile: Rich, Smoky, Savory, Spicy
Allergens: dairy, gluten
Upsell Notes: Great shareable starter...
```

**Fields used:** `menu_name`, `plate_type`, `short_description`, `detailed_description`, `key_ingredients` (joined), `flavor_profile` (joined), `allergens` (joined), `upsell_notes`

### `wines`

```
Name: Château Margaux 2018
Producer: Château Margaux
Vintage: 2018
Varietal: Cabernet Sauvignon blend
Region: Margaux, Bordeaux, France
Style: full-bodied, Body: full
Tasting Notes: Deep garnet with violet rim. Aromas of blackcurrant...
Producer Notes: First Growth Bordeaux estate with history dating to 1590...
```

**Fields used:** `name`, `producer`, `vintage` (if non-null), `varietal`, `region`+`country`, `style`+`body`, `tasting_notes`, `producer_notes`

### `cocktails`

```
Name: Old Fashioned
Style: classic
Glass: Rocks
Key Ingredients: Bourbon, Angostura bitters
Ingredients: 2 oz Bourbon, 0.5 oz Demerara syrup, 2 dashes Angostura bitters, Orange peel
Procedure: Add bourbon, syrup, and bitters to mixing glass with ice... [all step instructions joined by space]
Tasting Notes: Rich, warm, and subtly sweet with deep caramel and vanilla...
Description: The Old Fashioned is the original cocktail...
```

**Fields used:** `name`, `style`, `glass`, `key_ingredients`, `ingredients`, `procedure` JSONB → extract all `[].instruction`, `tasting_notes`, `description`

### `beer_liquor_list`

```
Name: Shiner Bock
Category: Beer
Subcategory: Bock
Producer: Spoetzl Brewery
Country: USA
Style: Malty, smooth, amber
Description: Texas' most iconic dark lager with rich malt character...
Notes: Serve at 38-42°F in a pint glass or frosted mug...
```

**Fields used:** `name`, `category`, `subcategory`, `producer`, `country`, `style`, `description`, `notes`

---

## JSONB Field Extraction

The complex tables (`prep_recipes`, `plate_specs`, `cocktails`) have JSONB columns that need flattening into text.

### `prep_recipes.ingredients` → extract ingredient names

```typescript
// Structure: [{ group_name, order, items: [{ name, quantity, unit, ... }] }]
const names = row.ingredients
  .flatMap((g: any) => g.items.map((i: any) => i.name))
  .join(', ');
```

### `prep_recipes.procedure` → extract step instructions

```typescript
// Structure: [{ group_name, order, steps: [{ step_number, instruction, critical }] }]
const steps = row.procedure
  .flatMap((g: any) => g.steps.map((s: any) => s.instruction))
  .join(' ');
```

### `plate_specs.components` → extract component names

```typescript
// Structure: [{ group_name, order, items: [{ type, name, quantity, unit, ... }] }]
const names = row.components
  .flatMap((g: any) => g.items.map((i: any) => i.name))
  .join(', ');
```

### `plate_specs.assembly_procedure` → extract step instructions

```typescript
// Structure: [{ group_name, order, steps: [{ step_number, instruction, critical }] }]
const steps = row.assembly_procedure
  .flatMap((g: any) => g.steps.map((s: any) => s.instruction))
  .join(' ');
```

### `cocktails.procedure` → extract step instructions

```typescript
// Structure: [{ step, instruction }]
const steps = row.procedure
  .map((s: any) => s.instruction)
  .join(' ');
```

---

## Function Structure (Pseudocode)

```
1. Handle CORS preflight

2. Validate config (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

3. Create Supabase client with service role key

4. Parse request body → { table?, rowId?, batchSize? }

5. Define table list:
   ALL_TABLES = ['prep_recipes', 'plate_specs', 'foh_plate_specs',
                  'wines', 'cocktails', 'beer_liquor_list']
   targetTables = table ? [table] : ALL_TABLES

6. For each table in targetTables:
   a. Build SELECT query for table columns
   b. If rowId: filter by id = rowId
      Else: filter by embedding IS NULL
   c. Limit by batchSize (default 50)
   d. Fetch rows

   e. For each row:
      i.   Call table-specific text builder
      ii.  Call OpenAI text-embedding-3-small
      iii. Update row: SET embedding = <vector>
      iv.  100ms delay between API calls
      v.   Track success/failure

7. Return JSON summary
```

### Table-Specific Select Columns

Each table only fetches the columns needed for the text builder + `id` for the update:

| Table | SELECT columns |
|-------|---------------|
| `prep_recipes` | `id, name, prep_type, tags, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, ingredients, procedure` |
| `plate_specs` | `id, name, plate_type, menu_category, tags, components, assembly_procedure, notes` |
| `foh_plate_specs` | `id, menu_name, plate_type, short_description, detailed_description, key_ingredients, flavor_profile, allergens, upsell_notes` |
| `wines` | `id, name, producer, vintage, varietal, region, country, style, body, tasting_notes, producer_notes` |
| `cocktails` | `id, name, style, glass, key_ingredients, ingredients, procedure, tasting_notes, description` |
| `beer_liquor_list` | `id, name, category, subcategory, producer, country, style, description, notes` |

---

## Deployment & Invocation

### Deploy

```bash
npx supabase functions deploy embed-products
```

### Invoke — All Tables (Single Call)

With 44 rows and default `batchSize: 50`, one call embeds everything:

```bash
curl -X POST "https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/embed-products" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Invoke — Single Table

```bash
curl -X POST "https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/embed-products" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"table": "wines"}'
```

### Invoke — Single Row (Re-embed)

```bash
curl -X POST "https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/embed-products" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"table": "wines", "rowId": "<uuid>"}'
```

---

## Auth Decision

**Use `verify_jwt: false` for this function.**

Rationale: This is an admin-only batch operation invoked via service role key from the terminal or backend. It does not serve end users. The service role key in the `Authorization` header authenticates the caller. This matches the pattern where internal tooling functions skip JWT verification.

The function itself validates that `SUPABASE_SERVICE_ROLE_KEY` is present and uses it for all DB operations (bypassing RLS).

---

## Verification

### SQL Queries (Run After Invocation)

```sql
-- 1. Embedding counts per table (all should match row counts)
SELECT 'prep_recipes' AS tbl, count(*) AS embedded FROM prep_recipes WHERE embedding IS NOT NULL
UNION ALL
SELECT 'plate_specs', count(*) FROM plate_specs WHERE embedding IS NOT NULL
UNION ALL
SELECT 'foh_plate_specs', count(*) FROM foh_plate_specs WHERE embedding IS NOT NULL
UNION ALL
SELECT 'wines', count(*) FROM wines WHERE embedding IS NOT NULL
UNION ALL
SELECT 'cocktails', count(*) FROM cocktails WHERE embedding IS NOT NULL
UNION ALL
SELECT 'beer_liquor_list', count(*) FROM beer_liquor_list WHERE embedding IS NOT NULL;
-- Expected: 4, 3, 12, 5, 5, 15

-- 2. Zero rows with NULL embeddings
SELECT 'prep_recipes' AS tbl, count(*) AS missing FROM prep_recipes WHERE embedding IS NULL
UNION ALL
SELECT 'plate_specs', count(*) FROM plate_specs WHERE embedding IS NULL
UNION ALL
SELECT 'foh_plate_specs', count(*) FROM foh_plate_specs WHERE embedding IS NULL
UNION ALL
SELECT 'wines', count(*) FROM wines WHERE embedding IS NULL
UNION ALL
SELECT 'cocktails', count(*) FROM cocktails WHERE embedding IS NULL
UNION ALL
SELECT 'beer_liquor_list', count(*) FROM beer_liquor_list WHERE embedding IS NULL;
-- Expected: all 0

-- 3. Embedding dimension check (should be 1536)
SELECT slug, array_length(embedding::text::float[], 1) AS dims
FROM wines LIMIT 1;
-- Expected: 1536

-- 4. Cosine similarity sanity check (two red wines should be more similar than wine vs beer)
SELECT
  a.slug AS slug_a,
  b.slug AS slug_b,
  1 - (a.embedding <=> b.embedding) AS cosine_similarity
FROM wines a, wines b
WHERE a.slug = 'chateau-margaux-2018' AND b.slug = 'erath-pinot-noir-2021';
-- Expected: high similarity (> 0.7) — both are wines

SELECT
  w.slug AS wine_slug,
  b.slug AS beer_slug,
  1 - (w.embedding <=> b.embedding) AS cosine_similarity
FROM wines w, beer_liquor_list b
WHERE w.slug = 'chateau-margaux-2018' AND b.slug = 'shiner-bock';
-- Expected: lower similarity than wine-to-wine comparison
```

### Idempotency Check

```bash
# Second invocation should process 0 rows
curl -X POST "https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/embed-products" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: { "processed": 0, "total": 0, "tables": {} }
```

### Edge Function Logs

```bash
# Check for errors in deployment logs
npx supabase functions logs embed-products --project-ref nxeorbwqsovybfttemrw
```

Or use the Supabase MCP `get_logs` tool with service `edge-function`.

---

## Performance Estimates

| Metric | Value |
|--------|-------|
| OpenAI API call | ~200ms per row |
| Rate limit delay | 100ms per row |
| Total for 44 rows | ~13 seconds |
| OpenAI cost (text-embedding-3-small) | < $0.01 |
| Storage per embedding | 6,144 bytes (1536 × 4 bytes) |
| Total storage for 44 rows | ~264 KB |

---

## Implementation Checklist

- [ ] Create `supabase/functions/embed-products/index.ts`
- [ ] 6 text builder functions (one per table)
- [ ] `generateEmbedding()` helper (reuse pattern from embed-sections)
- [ ] CORS headers (copy from embed-sections)
- [ ] Request parsing (table, rowId, batchSize)
- [ ] Table loop with per-row processing
- [ ] 100ms delay between OpenAI calls
- [ ] Error tracking with per-table breakdown
- [ ] Deploy: `npx supabase functions deploy embed-products`
- [ ] Invoke: single curl call (all tables, batchSize 50)
- [ ] Verify: SQL queries for counts, dimensions, cosine similarity
- [ ] Verify: idempotent re-run returns 0 processed
- [ ] Check security advisor for any new warnings
