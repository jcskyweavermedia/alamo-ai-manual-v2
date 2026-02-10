# Phase 2 — Database Tables & Seed Data

> Create all 6 product tables + migrate mock data. ~2 sessions.

## Context

Phase 1 (Audit & Prep) is complete. The schema spec (`docs/table-schema-products.md`) has all amendments applied, embeddings are generated, and the group is renamed to "Alamo Prime." This phase creates the actual database tables, inserts seed data converted from mock TypeScript files, and sets up RLS, indexes, and FTS triggers.

---

## Prerequisites

- [x] `table-schema-products.md` finalized with all amendments
- [x] `pgvector` extension installed (v0.8.0)
- [x] `pgcrypto` extension installed (in `extensions` schema)
- [x] `has_role(uuid, user_role)` function exists
- [x] Manual sections embeddings generated (30/30)
- [x] Group renamed to "Alamo Prime"

---

## Migration Strategy

Two migrations, run sequentially:

| # | Migration Name | Purpose | Depends On |
|---|---------------|---------|------------|
| 1 | `create_product_tables` | DDL: 6 tables, indexes, FTS triggers, RLS policies | Nothing |
| 2 | `seed_product_data` | INSERT: all mock data into 6 tables | Migration 1 |

Both are pushed together via `npx supabase db push`.

---

## Migration 1: DDL — `create_product_tables`

### Scope

- 6 CREATE TABLE statements
- 12 indexes (6 GIN for tsvector + 6 HNSW for vector)
- 6 trigger functions + 6 triggers (auto-update `search_vector`)
- 24 RLS policies (4 per table: SELECT, INSERT, UPDATE, DELETE)

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| `plate_spec_id` on `foh_plate_specs` is **nullable** | Only 3 of 12 mock dishes have a matching plate spec. Schema spec says NOT NULL, but we relax this for practical seed data. Can be tightened later when all plate specs exist. |
| No `concept_id` on any table | Dropped per master plan scope decision (single-restaurant app). |
| `created_by` has no FK to `auth.users` | Keeps seed migrations portable. Stores UUID of the creating user/system. |
| `created_at`/`updated_at` default to `now()` | Standard audit columns with server-side defaults. |
| All `status` fields default to `'published'` | Seed data is production-ready. Draft workflow is future scope. |
| All `version` fields default to `1` | Initial seed version. |

---

### Table 1: `prep_recipes`

```sql
CREATE TABLE public.prep_recipes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  prep_type TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  yield_qty NUMERIC NOT NULL,
  yield_unit TEXT NOT NULL,

  shelf_life_value INTEGER NOT NULL,
  shelf_life_unit TEXT NOT NULL,

  tags TEXT[] NOT NULL DEFAULT '{}',
  images JSONB NOT NULL DEFAULT '[]',

  ingredients JSONB NOT NULL,
  procedure JSONB NOT NULL,
  batch_scaling JSONB NOT NULL DEFAULT '{}',
  training_notes JSONB NOT NULL DEFAULT '{}',

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Row count:** 4 (Red Wine Demi-Glace, Chimichurri, Herb Compound Butter, Creamed Spinach)

---

### Table 2: `plate_specs`

```sql
CREATE TABLE public.plate_specs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  plate_type TEXT NOT NULL,
  menu_category TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  allergens TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  images JSONB NOT NULL DEFAULT '[]',

  components JSONB NOT NULL,
  assembly_procedure JSONB NOT NULL,
  notes TEXT NOT NULL DEFAULT '',

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Row count:** 3 (16oz Bone-In Ribeye, Grilled Skirt Steak w/ Chimichurri, Steakhouse Wedge Salad)

---

### Table 3: `foh_plate_specs`

```sql
CREATE TABLE public.foh_plate_specs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  plate_spec_id UUID REFERENCES public.plate_specs(id),  -- nullable: not all dishes have a plate spec yet
  menu_name TEXT NOT NULL,
  plate_type TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  short_description TEXT NOT NULL,
  detailed_description TEXT NOT NULL,

  ingredients TEXT[] NOT NULL DEFAULT '{}',
  key_ingredients TEXT[] NOT NULL DEFAULT '{}',

  flavor_profile TEXT[] NOT NULL DEFAULT '{}',

  allergens TEXT[] NOT NULL DEFAULT '{}',
  allergy_notes TEXT NOT NULL DEFAULT '',
  upsell_notes TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',

  image TEXT,

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Row count:** 12 (3 appetizers, 4 entrees, 3 sides, 2 desserts)

---

### Table 4: `wines`

```sql
CREATE TABLE public.wines (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  producer TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  vintage TEXT,

  varietal TEXT NOT NULL,
  blend BOOLEAN NOT NULL DEFAULT FALSE,
  style TEXT NOT NULL,
  body TEXT NOT NULL,

  tasting_notes TEXT NOT NULL,
  producer_notes TEXT NOT NULL DEFAULT '',

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  notes TEXT NOT NULL DEFAULT '',

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  image TEXT,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Row count:** 5 (Chateau Margaux, Cloudy Bay, Whispering Angel, Veuve Clicquot, Erath Pinot Noir)

---

### Table 5: `cocktails`

```sql
CREATE TABLE public.cocktails (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  style TEXT NOT NULL,
  glass TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  ingredients TEXT NOT NULL,
  key_ingredients TEXT NOT NULL,

  procedure JSONB NOT NULL,
  tasting_notes TEXT NOT NULL,
  description TEXT NOT NULL,

  notes TEXT NOT NULL DEFAULT '',

  is_top_seller BOOLEAN NOT NULL DEFAULT FALSE,

  image TEXT,

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Row count:** 5 (Old Fashioned, Espresso Martini, Mai Tai, Penicillin, Paloma)

---

### Table 6: `beer_liquor_list`

```sql
CREATE TABLE public.beer_liquor_list (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,

  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,

  producer TEXT NOT NULL,
  country TEXT NOT NULL,

  description TEXT NOT NULL,
  style TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,

  notes TEXT NOT NULL DEFAULT '',

  embedding vector(1536),
  search_vector tsvector,

  ai_ingestion_meta JSONB NOT NULL DEFAULT '{"source_type":"seed_migration","confidence_score":1.0,"missing_fields":[],"last_ai_generated_at":null}',

  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Row count:** 15 (7 beers + 8 liquors)

---

### Indexes

Each table gets 2 indexes: one GIN for full-text search, one HNSW for vector similarity.

```sql
-- prep_recipes
CREATE INDEX idx_prep_recipes_search ON prep_recipes USING gin(search_vector);
CREATE INDEX idx_prep_recipes_embedding ON prep_recipes USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- plate_specs
CREATE INDEX idx_plate_specs_search ON plate_specs USING gin(search_vector);
CREATE INDEX idx_plate_specs_embedding ON plate_specs USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- foh_plate_specs
CREATE INDEX idx_foh_plate_specs_search ON foh_plate_specs USING gin(search_vector);
CREATE INDEX idx_foh_plate_specs_embedding ON foh_plate_specs USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- wines
CREATE INDEX idx_wines_search ON wines USING gin(search_vector);
CREATE INDEX idx_wines_embedding ON wines USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- cocktails
CREATE INDEX idx_cocktails_search ON cocktails USING gin(search_vector);
CREATE INDEX idx_cocktails_embedding ON cocktails USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- beer_liquor_list
CREATE INDEX idx_beer_liquor_search ON beer_liquor_list USING gin(search_vector);
CREATE INDEX idx_beer_liquor_embedding ON beer_liquor_list USING hnsw(embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

### FTS Trigger Functions

One trigger function per table. Each builds a `tsvector` from the table's searchable text columns.

#### `prep_recipes`

```sql
CREATE OR REPLACE FUNCTION update_prep_recipes_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.prep_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prep_recipes_search_vector
  BEFORE INSERT OR UPDATE ON prep_recipes
  FOR EACH ROW EXECUTE FUNCTION update_prep_recipes_search_vector();
```

#### `plate_specs`

```sql
CREATE OR REPLACE FUNCTION update_plate_specs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.plate_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.menu_category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plate_specs_search_vector
  BEFORE INSERT OR UPDATE ON plate_specs
  FOR EACH ROW EXECUTE FUNCTION update_plate_specs_search_vector();
```

#### `foh_plate_specs`

```sql
CREATE OR REPLACE FUNCTION update_foh_plate_specs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.menu_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.plate_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.detailed_description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.key_ingredients, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.upsell_notes, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_foh_plate_specs_search_vector
  BEFORE INSERT OR UPDATE ON foh_plate_specs
  FOR EACH ROW EXECUTE FUNCTION update_foh_plate_specs_search_vector();
```

#### `wines`

```sql
CREATE OR REPLACE FUNCTION update_wines_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.producer, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.varietal, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.region, '') || ' ' || coalesce(NEW.country, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '') || ' ' || coalesce(NEW.body, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.tasting_notes, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.producer_notes, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wines_search_vector
  BEFORE INSERT OR UPDATE ON wines
  FOR EACH ROW EXECUTE FUNCTION update_wines_search_vector();
```

#### `cocktails`

```sql
CREATE OR REPLACE FUNCTION update_cocktails_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.key_ingredients, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.ingredients, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.tasting_notes, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cocktails_search_vector
  BEFORE INSERT OR UPDATE ON cocktails
  FOR EACH ROW EXECUTE FUNCTION update_cocktails_search_vector();
```

#### `beer_liquor_list`

```sql
CREATE OR REPLACE FUNCTION update_beer_liquor_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.producer, '') || ' ' || coalesce(NEW.country, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.style, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_beer_liquor_search_vector
  BEFORE INSERT OR UPDATE ON beer_liquor_list
  FOR EACH ROW EXECUTE FUNCTION update_beer_liquor_search_vector();
```

---

### RLS Policies

Enable RLS on all 6 tables. Same pattern as `manual_sections`:

- **SELECT:** All authenticated users can read
- **INSERT / UPDATE / DELETE:** Admin only (via `has_role(auth.uid(), 'admin')`)

```sql
-- Repeat this block for each table:
-- prep_recipes, plate_specs, foh_plate_specs, wines, cocktails, beer_liquor_list

ALTER TABLE public.{TABLE} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view {TABLE}"
  ON public.{TABLE} FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert {TABLE}"
  ON public.{TABLE} FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update {TABLE}"
  ON public.{TABLE} FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete {TABLE}"
  ON public.{TABLE} FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

Total: 24 policies (4 per table x 6 tables).

---

## Migration 2: Seed Data — `seed_product_data`

### Constants

```sql
-- Admin user UUID (created_by for all seed rows)
-- This is the single admin account: juancarlosmarchan@skyweavermedia.com
DO $$ DECLARE admin_uid UUID := 'dbf867c5-30f1-4ec1-9a97-c1f7ce6488d4'; BEGIN
-- ... all INSERTs use admin_uid ...
END $$;
```

### Seed order (respects FK dependencies)

1. `prep_recipes` (4 rows) — no dependencies
2. `plate_specs` (3 rows) — no dependencies (references prep_recipes by slug in JSONB, not FK)
3. `foh_plate_specs` (12 rows) — depends on `plate_specs` for `plate_spec_id` FK
4. `wines` (5 rows) — no dependencies
5. `cocktails` (5 rows) — no dependencies
6. `beer_liquor_list` (15 rows) — no dependencies

**Total: 44 rows across 6 tables.**

---

### Mock → DB Field Mapping

#### `prep_recipes` (4 rows)

| Mock Field | DB Column | Transform |
|------------|-----------|-----------|
| `id` | *(dropped)* | Auto-generated UUID |
| `slug` | `slug` | Direct |
| `name` | `name` | Direct |
| `category` | `prep_type` | Rename only: `'sauce'`, `'base'`, `'compound-butter'` |
| `tags` | `tags` | Direct (TEXT[]) |
| `image` | `images` | Wrap: `'["url"]'::jsonb` |
| `allergens` | *(not in table)* | Dropped — allergens tracked at ingredient level in JSONB |
| `yield` (`"1.5 qt"`) | `yield_qty` + `yield_unit` | Split: `1.5` / `'qt'` |
| `shelfLife` (`"7 days"`) | `shelf_life_value` + `shelf_life_unit` | Split: `7` / `'days'` |
| `ingredientGroups` | `ingredients` | Convert to DB JSONB contract (see below) |
| `procedureGroups` | `procedure` | Convert to DB JSONB contract (see below) |
| `batchScaling` (string) | `batch_scaling` | Convert to JSONB struct |
| `trainingNotes` (string) | `training_notes` | Convert to JSONB struct |

**ingredients JSONB conversion example** (Red Wine Demi-Glace):

```json
[
  {
    "group_name": "Base",
    "order": 1,
    "items": [
      { "name": "Veal Stock", "quantity": 2, "unit": "qt", "prep_note": null, "allergens": [] },
      { "name": "Dry red wine (Cabernet)", "quantity": 750, "unit": "ml", "prep_note": null, "allergens": [] },
      { "name": "Mirepoix, fine dice", "quantity": 1, "unit": "cup", "prep_note": null, "allergens": [] },
      { "name": "Tomato paste", "quantity": 2, "unit": "tbsp", "prep_note": null, "allergens": [] }
    ]
  },
  {
    "group_name": "Finish",
    "order": 2,
    "items": [
      { "name": "Unsalted butter, cold", "quantity": 2, "unit": "tbsp", "prep_note": null, "allergens": ["dairy"] },
      { "name": "Fresh thyme leaves", "quantity": 1, "unit": "tsp", "prep_note": null, "allergens": [] },
      { "name": "Kosher salt & black pepper", "quantity": null, "unit": "to taste", "prep_note": null, "allergens": [] }
    ]
  }
]
```

**procedure JSONB conversion example** (Red Wine Demi-Glace):

```json
[
  {
    "group_name": "Reduction",
    "order": 1,
    "steps": [
      { "step_number": 1, "instruction": "Sweat mirepoix in heavy-bottom saucepan over medium heat until translucent (5-6 min).", "critical": false },
      { "step_number": 2, "instruction": "Add tomato paste, cook stirring 2 min until darkened slightly.", "critical": false },
      { "step_number": 3, "instruction": "Deglaze with red wine. Reduce by half over medium-high (15-20 min).", "critical": false },
      { "step_number": 4, "instruction": "Add veal stock. Simmer and reduce by half (45-60 min), skimming impurities.", "critical": false }
    ]
  },
  {
    "group_name": "Finish & Store",
    "order": 2,
    "steps": [
      { "step_number": 1, "instruction": "Strain through fine-mesh sieve, pressing solids. Discard solids.", "critical": false },
      { "step_number": 2, "instruction": "Return to clean pan — sauce should coat a spoon (nappe consistency).", "critical": true },
      { "step_number": 3, "instruction": "Off heat: monte au beurre — whisk in cold butter one piece at a time.", "critical": false },
      { "step_number": 4, "instruction": "Season with salt, pepper, thyme. Cool rapidly in ice bath.", "critical": true },
      { "step_number": 5, "instruction": "Transfer to labeled deli containers. Date and refrigerate.", "critical": false }
    ]
  }
]
```

**batch_scaling JSONB conversion example**:

```json
{
  "scalable": true,
  "base_yield": { "quantity": 1.5, "unit": "qt" },
  "scaling_method": "linear",
  "exceptions": [],
  "notes": "Scales linearly. Double batch: use wider pot to maintain reduction speed. +20 min total."
}
```

**training_notes JSONB conversion example**:

```json
{
  "common_mistakes": [],
  "quality_checks": ["Nappe = sauce coats and clings to a spoon without dripping immediately."],
  "notes": "Too thin -> reduce further. Too thick -> thin with stock."
}
```

---

#### `plate_specs` (3 rows)

| Mock Field | DB Column | Transform |
|------------|-----------|-----------|
| `id` | *(dropped)* | Auto-generated UUID |
| `slug` | `slug` | Direct |
| `name` | `name` | Direct |
| `category` | `plate_type` | Rename only: `'entree'`, `'appetizer'` |
| *(none)* | `menu_category` | Set same as `plate_type` (e.g., `'entree'`) |
| `tags` | `tags` | Direct (TEXT[]) |
| `allergens` | `allergens` | Direct (TEXT[]) |
| `image` | `images` | Wrap: `'["url"]'::jsonb` |
| `componentGroups` | `components` | Convert to DB JSONB contract |
| `assemblyGroups` | `assembly_procedure` | Convert to DB JSONB contract |
| `platingNotes` | `notes` | Direct |

**components JSONB conversion** — same contract as schema doc:

```json
[
  {
    "group_name": "Grill",
    "order": 1,
    "items": [
      { "type": "raw", "name": "Bone-in ribeye, 1.5\" thick", "quantity": 16, "unit": "oz", "order": 1, "allergens": [] },
      { "type": "prep_recipe", "name": "Herb Compound Butter", "prep_recipe_ref": "herb-compound-butter", "quantity": 1, "unit": "pc", "order": 2 }
    ]
  }
]
```

**assembly_procedure JSONB conversion** — same contract as schema doc:

```json
[
  {
    "group_name": "Grill",
    "order": 1,
    "steps": [
      { "step_number": 1, "instruction": "Temper steak 30-45 min before grilling. Season generously with salt and pepper.", "critical": false },
      { "step_number": 2, "instruction": "Grill over high heat: sear 4-5 min per side for medium-rare (130°F).", "critical": true },
      { "step_number": 3, "instruction": "Rest 5-7 min on cutting board, loosely tented with foil.", "critical": false }
    ]
  }
]
```

---

#### `foh_plate_specs` (12 rows)

| Mock Field | DB Column | Transform |
|------------|-----------|-----------|
| `id` | *(dropped)* | Auto-generated UUID |
| `slug` | `slug` | Direct |
| *(none)* | `plate_spec_id` | Look up `plate_specs.id` by matching slug. NULL for dishes without a plate spec. |
| `name` | `menu_name` | Rename |
| `category` | `plate_type` | Rename: `'appetizer'`, `'entree'`, `'side'`, `'dessert'` |
| `shortDescription` | `short_description` | Direct |
| `detailedDescription` | `detailed_description` | Direct |
| `ingredients` | `ingredients` | Direct (TEXT[]) |
| `keyIngredients` | `key_ingredients` | Direct (TEXT[]) |
| `flavorProfile` | `flavor_profile` | Direct (TEXT[]) |
| `allergens` | `allergens` | Direct (TEXT[]) |
| `allergyNotes` | `allergy_notes` | Direct |
| `upsellNotes` | `upsell_notes` | Direct |
| `notes` | `notes` | Direct |
| `image` | `image` | Direct (single TEXT URL) |
| `topSeller` | `is_top_seller` | Rename |
| `aiResponses` | *(dropped)* | Replaced by live `/ask-product` calls |

**plate_spec_id resolution:**

| FOH Dish Slug | Matching Plate Spec Slug | Has FK? |
|---------------|-------------------------|---------|
| `16oz-bone-in-ribeye` | `bone-in-ribeye` | Yes |
| `steakhouse-wedge-salad` *(if added)* | `steakhouse-wedge-salad` | Yes |
| All other 10 dishes | *(none)* | NULL |

Note: The FOH `16oz-bone-in-ribeye` slug differs from the plate spec `bone-in-ribeye` slug. The plate_spec_id FK lookup uses the plate_specs table ID, not slug matching. We'll use a subquery:

```sql
plate_spec_id = (SELECT id FROM plate_specs WHERE slug = 'bone-in-ribeye')
```

---

#### `wines` (5 rows)

| Mock Field | DB Column | Transform |
|------------|-----------|-----------|
| `id` | *(dropped)* | Auto-generated UUID |
| `slug` | `slug` | Direct |
| `name` | `name` | Direct |
| `producer` | `producer` | Direct |
| `region` | `region` | Direct |
| `country` | `country` | Direct |
| `vintage` | `vintage` | Direct (null for NV) |
| `grape` | `varietal` | Rename |
| `isBlend` | `blend` | Rename |
| `style` | `style` | Direct |
| `body` | `body` | Direct |
| `tastingNotes` | `tasting_notes` | Rename |
| `producerStory` | `producer_notes` | Rename |
| `notes` | `notes` | Direct |
| `topSeller` | `is_top_seller` | Rename |
| `image` | `image` | Direct |
| `aiResponses` | *(dropped)* | Replaced by live AI |

---

#### `cocktails` (5 rows)

| Mock Field | DB Column | Transform |
|------------|-----------|-----------|
| `id` | *(dropped)* | Auto-generated UUID |
| `slug` | `slug` | Direct |
| `name` | `name` | Direct |
| `style` | `style` | Direct |
| `glass` | `glass` | Direct |
| `ingredients` | `ingredients` | Direct (TEXT, comma-separated string) |
| `keyIngredients` | `key_ingredients` | Direct (TEXT, comma-separated string) |
| `procedure` | `procedure` | Direct — already matches DB JSON contract: `[{step, instruction}]` |
| `tastingNotes` | `tasting_notes` | Rename |
| `description` | `description` | Direct |
| `notes` | `notes` | Direct |
| `topSeller` | `is_top_seller` | Rename |
| `image` | `image` | Direct |
| `aiResponses` | *(dropped)* | Replaced by live AI |

---

#### `beer_liquor_list` (15 rows)

| Mock Field | DB Column | Transform |
|------------|-----------|-----------|
| `id` | *(dropped)* | Auto-generated UUID |
| `slug` | `slug` | Direct |
| `name` | `name` | Direct |
| `category` | `category` | Direct: `'Beer'` or `'Liquor'` |
| `subcategory` | `subcategory` | Direct: `'Bock'`, `'Lager'`, `'Bourbon'`, etc. |
| `producer` | `producer` | Direct |
| `country` | `country` | Direct |
| `description` | `description` | Direct |
| `style` | `style` | Direct |
| `notes` | `notes` | Direct |

Simplest table — all fields map directly with no transforms.

---

### Example Seed INSERT (one per table)

#### prep_recipes

```sql
INSERT INTO prep_recipes (slug, name, prep_type, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, tags, images, ingredients, procedure, batch_scaling, training_notes, created_by)
VALUES (
  'red-wine-demi-glace',
  'Red Wine Demi-Glace',
  'sauce',
  1.5, 'qt',
  7, 'days',
  ARRAY['signature', 'mother sauce', 'slow cook'],
  '["https://picsum.photos/seed/demi-glace/400/300"]'::jsonb,
  '[{"group_name":"Base","order":1,"items":[...]}]'::jsonb,
  '[{"group_name":"Reduction","order":1,"steps":[...]}]'::jsonb,
  '{"scalable":true,"base_yield":{"quantity":1.5,"unit":"qt"},"scaling_method":"linear","exceptions":[],"notes":"Scales linearly. Double batch: use wider pot to maintain reduction speed. +20 min total."}'::jsonb,
  '{"common_mistakes":[],"quality_checks":["Nappe = sauce coats and clings to a spoon without dripping immediately."],"notes":"Too thin -> reduce further. Too thick -> thin with stock."}'::jsonb,
  admin_uid
);
```

#### wines

```sql
INSERT INTO wines (slug, name, producer, region, country, vintage, varietal, blend, style, body, tasting_notes, producer_notes, notes, is_top_seller, image, created_by)
VALUES (
  'chateau-margaux-2018',
  'Château Margaux 2018',
  'Château Margaux',
  'Margaux, Bordeaux',
  'France',
  '2018',
  'Cabernet Sauvignon blend',
  true,
  'red',
  'full',
  'Deep garnet with violet rim. Aromas of blackcurrant, cedar, and violet...',
  'First Growth Bordeaux estate with history dating to 1590...',
  'Pair with prime ribeye or rack of lamb. Serve at 64°F...',
  true,
  'https://images.unsplash.com/photo-1586370434639-0fe43b2d32e6?w=400&h=600&fit=crop',
  admin_uid
);
```

#### beer_liquor_list

```sql
INSERT INTO beer_liquor_list (slug, name, category, subcategory, producer, country, description, style, notes, created_by)
VALUES (
  'shiner-bock',
  'Shiner Bock',
  'Beer',
  'Bock',
  'Spoetzl Brewery',
  'USA',
  'Texas'' most iconic dark lager with rich malt character...',
  'Malty, smooth, amber',
  'Serve at 38-42°F in a pint glass or frosted mug...',
  admin_uid
);
```

---

### String Escaping Strategy

All seed data will use PostgreSQL dollar-quoting (`$TXT$...$TXT$`) for long text fields containing single quotes and special characters. This avoids error-prone manual escaping.

```sql
-- Example:
short_description = $TXT$Our signature queso blanco loaded with smoked brisket, pico de gallo, and jalapeños. The perfect shareable starter that hooks the table from the first chip.$TXT$
```

---

## Implementation Order

### Session 1: DDL Migration

1. Create migration file: `npx supabase migration new create_product_tables`
2. Write full DDL SQL:
   - 6 CREATE TABLE statements
   - 12 indexes (GIN + HNSW)
   - 6 trigger functions + 6 triggers
   - 6 ALTER TABLE ENABLE RLS + 24 policies
3. Push: `npx supabase db push`
4. Verify: all 6 tables exist, RLS enabled, indexes created

### Session 2: Seed Migration

1. Create migration file: `npx supabase migration new seed_product_data`
2. Write seed SQL inside a `DO $$ ... END $$` block:
   - Declare `admin_uid` constant
   - INSERT 4 `prep_recipes` rows
   - INSERT 3 `plate_specs` rows
   - INSERT 12 `foh_plate_specs` rows (with `plate_spec_id` subqueries)
   - INSERT 5 `wines` rows
   - INSERT 5 `cocktails` rows
   - INSERT 15 `beer_liquor_list` rows
3. Push: `npx supabase db push`
4. Verify: row counts, search_vector auto-populated, RLS working

---

## Verification Checklist

### Structure

```sql
-- All 6 tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('prep_recipes', 'plate_specs', 'foh_plate_specs', 'wines', 'cocktails', 'beer_liquor_list')
ORDER BY tablename;
-- Expected: 6 rows
```

### Row Counts

```sql
SELECT 'prep_recipes' AS tbl, count(*) FROM prep_recipes
UNION ALL SELECT 'plate_specs', count(*) FROM plate_specs
UNION ALL SELECT 'foh_plate_specs', count(*) FROM foh_plate_specs
UNION ALL SELECT 'wines', count(*) FROM wines
UNION ALL SELECT 'cocktails', count(*) FROM cocktails
UNION ALL SELECT 'beer_liquor_list', count(*) FROM beer_liquor_list;
-- Expected: 4, 3, 12, 5, 5, 15
```

### FTS Triggers Working

```sql
-- All search_vector columns should be non-null after seed inserts
SELECT 'prep_recipes' AS tbl, count(*) FILTER (WHERE search_vector IS NULL) AS missing FROM prep_recipes
UNION ALL SELECT 'plate_specs', count(*) FILTER (WHERE search_vector IS NULL) FROM plate_specs
UNION ALL SELECT 'foh_plate_specs', count(*) FILTER (WHERE search_vector IS NULL) FROM foh_plate_specs
UNION ALL SELECT 'wines', count(*) FILTER (WHERE search_vector IS NULL) FROM wines
UNION ALL SELECT 'cocktails', count(*) FILTER (WHERE search_vector IS NULL) FROM cocktails
UNION ALL SELECT 'beer_liquor_list', count(*) FILTER (WHERE search_vector IS NULL) FROM beer_liquor_list;
-- Expected: all 0
```

### Embeddings (NULL — populated in Phase 4)

```sql
-- All embedding columns should be NULL (Phase 4 generates these)
SELECT 'prep_recipes' AS tbl, count(*) FILTER (WHERE embedding IS NOT NULL) AS has_emb FROM prep_recipes
UNION ALL SELECT 'plate_specs', count(*) FILTER (WHERE embedding IS NOT NULL) FROM plate_specs
UNION ALL SELECT 'foh_plate_specs', count(*) FILTER (WHERE embedding IS NOT NULL) FROM foh_plate_specs
UNION ALL SELECT 'wines', count(*) FILTER (WHERE embedding IS NOT NULL) FROM wines
UNION ALL SELECT 'cocktails', count(*) FILTER (WHERE embedding IS NOT NULL) FROM cocktails
UNION ALL SELECT 'beer_liquor_list', count(*) FILTER (WHERE embedding IS NOT NULL) FROM beer_liquor_list;
-- Expected: all 0
```

### Indexes

```sql
SELECT indexname FROM pg_indexes
WHERE tablename IN ('prep_recipes', 'plate_specs', 'foh_plate_specs', 'wines', 'cocktails', 'beer_liquor_list')
  AND indexname LIKE 'idx_%'
ORDER BY indexname;
-- Expected: 12 indexes (2 per table)
```

### RLS

```sql
SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE tablename IN ('prep_recipes', 'plate_specs', 'foh_plate_specs', 'wines', 'cocktails', 'beer_liquor_list')
GROUP BY tablename
ORDER BY tablename;
-- Expected: 4 policies per table, 6 tables
```

### FTS Search Test

```sql
-- Test FTS on wines
SELECT name, ts_rank(search_vector, q) AS rank
FROM wines, to_tsquery('english', 'bordeaux | cabernet') q
WHERE search_vector @@ q
ORDER BY rank DESC;
-- Expected: Château Margaux should appear
```

### RLS Test (anon vs authenticated)

```sql
-- Via Supabase client with publishable key (authenticated):
-- SELECT * FROM wines; → should return 5 rows

-- Via Supabase client without auth:
-- SELECT * FROM wines; → should return 0 rows (RLS blocks)
```

### FK Integrity

```sql
-- foh_plate_specs → plate_specs FK
SELECT f.slug, f.plate_spec_id, p.slug AS plate_slug
FROM foh_plate_specs f
LEFT JOIN plate_specs p ON p.id = f.plate_spec_id
WHERE f.plate_spec_id IS NOT NULL;
-- Expected: 2-3 rows with valid joins
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_create_product_tables.sql` | Created — DDL migration |
| `supabase/migrations/YYYYMMDDHHMMSS_seed_product_data.sql` | Created — Seed data migration |

No frontend files are modified in this phase. Mock data files remain untouched (they'll be replaced in Phase 6).
