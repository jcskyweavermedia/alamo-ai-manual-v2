# Phase 1 — Audit & Prep

> Clean up before building. Prerequisite for all other phases.

## Context

Before building any product DB tables (Phase 2), we need to finalize the schema spec, generate the still-missing manual section embeddings, and rename the demo group. These are prerequisite cleanup tasks that ensure Phase 2 starts from a clean, accurate baseline.

---

## Task 1: Update `table-schema-products.md`

**File:** `docs/table-schema-products.md`

Apply all amendments from the master plan. The schema doc is the source of truth for Phase 2 migrations.

### Additions per table

| Table | Columns to Add |
|-------|---------------|
| `foh_plate_specs` | `slug TEXT UNIQUE NOT NULL`, `image TEXT`, `plate_type TEXT NOT NULL`, `allergens TEXT[] NOT NULL`, `embedding vector(1536)`, `search_vector tsvector` |
| `wines` | `slug TEXT UNIQUE NOT NULL`, `image TEXT`, `embedding vector(1536)`, `search_vector tsvector` |
| `cocktails` | `slug TEXT UNIQUE NOT NULL`, `image TEXT`, `embedding vector(1536)`, `search_vector tsvector` |
| `beer_liquor_list` | `slug TEXT UNIQUE NOT NULL`, `embedding vector(1536)`, `search_vector tsvector` |
| `prep_recipes` | `slug TEXT UNIQUE NOT NULL`, `embedding vector(1536)`, `search_vector tsvector` |
| `plate_specs` | `slug TEXT UNIQUE NOT NULL`, `embedding vector(1536)`, `search_vector tsvector` |

### Removals

- Remove `concept_id UUID NOT NULL` from `prep_recipes` (current line 34)
- Remove `concept_id UUID NOT NULL` from `plate_specs` (current line 150)

### Placement rules

- `slug` goes right after `id` (first content column)
- `image`/`images` stays where it is (or goes after slug if being added new)
- `plate_type` and `allergens` go in the middle with other content fields on `foh_plate_specs`
- `embedding` and `search_vector` go at the end, before `created_by`

### Exact edits — `foh_plate_specs`

**Before:**
```sql
foh_plate_specs (
  id UUID PRIMARY KEY,

  plate_spec_id UUID NOT NULL,
  menu_name TEXT NOT NULL,
  ...
```

**After:**
```sql
foh_plate_specs (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,

  plate_spec_id UUID NOT NULL,
  menu_name TEXT NOT NULL,
  plate_type TEXT NOT NULL,       -- appetizer | entree | side | dessert

  ...

  allergens TEXT[] NOT NULL,
  allergy_notes TEXT NOT NULL,
  upsell_notes TEXT NOT NULL,
  notes TEXT NOT NULL,

  image TEXT,

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL,

  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### Exact edits — `wines`

**Add after `id`:**
```sql
  slug TEXT UNIQUE NOT NULL,
```

**Add before `ai_ingestion_meta`:**
```sql
  image TEXT,

  embedding vector(1536),
  search_vector tsvector,
```

### Exact edits — `cocktails`

Same pattern as wines: add `slug` after `id`, add `image`, `embedding`, `search_vector` before `ai_ingestion_meta`.

### Exact edits — `beer_liquor_list`

Add `slug` after `id`. Add `embedding` and `search_vector` before `ai_ingestion_meta`. **No `image` column** (B&L stays image-less).

### Exact edits — `prep_recipes`

**Remove** `concept_id UUID NOT NULL`. Add `slug` after `id`. Add `embedding` and `search_vector` before `ai_ingestion_meta`.

### Exact edits — `plate_specs`

**Remove** `concept_id UUID NOT NULL`. Add `slug` after `id`. Add `embedding` and `search_vector` before `ai_ingestion_meta`.

---

## Task 2: Generate Manual Section Embeddings

**Edge function:** `supabase/functions/embed-sections/index.ts` (already deployed)

### Current state

- 30 non-category sections exist in `manual_sections`
- 0/30 have `embedding_en` populated
- 0/30 have `embedding_es` populated
- Both columns are `vector(1536)` with HNSW indexes already created

### How the function works

1. Fetches up to 20 sections where `embedding_en IS NULL` and `is_category = false`
2. For each section, builds embedding text: `Title + Category + Tags + Content`
3. Calls OpenAI `text-embedding-3-small` to generate 1536-dimension vectors
4. Generates both EN and ES embeddings per section
5. Updates `embedding_en` and `embedding_es` columns
6. 100ms delay between sections to avoid rate limits

### Invocation

Call the edge function **2 times** (it processes max 20 per call, we have 30 sections):

```bash
# Call 1: embed first 20 sections
curl -X POST "https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/embed-sections" \
  -H "Authorization: Bearer <PUBLISHABLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Call 2: embed remaining 10 sections
curl -X POST "https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/embed-sections" \
  -H "Authorization: Bearer <PUBLISHABLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verification

```sql
-- Should return 30
SELECT count(*) FROM manual_sections
WHERE is_category = false AND embedding_en IS NOT NULL AND embedding_es IS NOT NULL;

-- Should return 0 (no sections left without embeddings)
SELECT count(*) FROM manual_sections
WHERE is_category = false AND (embedding_en IS NULL OR embedding_es IS NULL);
```

---

## Task 3: Rename "Demo Restaurant" → "Alamo Prime"

### Current state

From seed migration `20260206014834_...sql` (lines 441-447):
```sql
INSERT INTO public.groups (id, name, slug, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Restaurant',
  'demo-restaurant',
  'Default demo location for development'
);
```

### Migration SQL

Create a new migration via `npx supabase migration new rename_group_alamo_prime`:

```sql
-- Rename "Demo Restaurant" group to "Alamo Prime"
UPDATE public.groups
SET name = 'Alamo Prime',
    slug = 'alamo-prime',
    description = 'Alamo Prime Steakhouse'
WHERE id = '00000000-0000-0000-0000-000000000001';
```

Then push: `npx supabase db push`

### Side effects

- **Join URL changes:** `/join/demo-restaurant` → `/join/alamo-prime`
- Check for any hardcoded `demo-restaurant` references in frontend code (grep for it)
- Update MEMORY.md join URL reference

---

## Implementation Order

1. **Update schema doc** — edit `docs/table-schema-products.md` directly
2. **Create group rename migration** — `npx supabase migration new rename_group_alamo_prime`, write SQL, `npx supabase db push`
3. **Generate embeddings** — call edge function twice via curl, verify with SQL query

---

## Verification Checklist

- [ ] `table-schema-products.md` has `slug`, `embedding`, `search_vector` on all 6 tables
- [ ] `foh_plate_specs` has `plate_type TEXT NOT NULL` and `allergens TEXT[] NOT NULL` added
- [ ] `concept_id` removed from `prep_recipes` and `plate_specs`
- [ ] `is_top_seller` confirmed present on `foh_plate_specs`, `wines`, `cocktails`
- [ ] Migration for group rename created and pushed to cloud
- [ ] Group name = "Alamo Prime", slug = "alamo-prime" verified in DB
- [ ] 30/30 manual sections have `embedding_en IS NOT NULL`
- [ ] 30/30 manual sections have `embedding_es IS NOT NULL`
