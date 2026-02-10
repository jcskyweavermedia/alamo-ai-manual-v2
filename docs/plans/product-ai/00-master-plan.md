# Product AI System — Master Plan

## Overview

Transition from mock frontend data to a production database-backed system where every product viewer (Dishes, Wines, Cocktails, Recipes, Beer & Liquor) is:

1. **Persisted** in Supabase PostgreSQL tables
2. **Searchable** via dedicated search functions (FTS + vector)
3. **AI-grounded** — the assistant can query any product domain using tool-use (function calling)
4. **Scalable** to 1000+ concurrent users with no architectural changes

---

## Current State (as of 2026-02-10)

| Component | Status |
|-----------|--------|
| Manual sections | 34 rows in DB, FTS indexes, embeddings pending |
| `/ask` edge function | Production-ready, hybrid search, usage limits |
| Dish viewer UI | Complete (mock data, 12 dishes) — has card view + AI sheet |
| Wine viewer UI | Complete (mock data, 5 wines) — has card view + AI sheet |
| Cocktail viewer UI | Complete (mock data, 5 cocktails) — has card view + AI sheet |
| Recipe viewer UI | Complete (mock data, 7 recipes) — has card view, **NO AI sheet** |
| Beer & Liquor viewer UI | Partial (mock data, 15 items) — **list only, NO card view, NO AI sheet, NO images** |
| AI buttons in viewers | Render mock `aiResponses` strings — NOT dynamic |
| Product DB tables | **Do not exist** |
| Product search functions | **Do not exist** |
| Product embeddings | **Do not exist** |
| AI tool-use / function calling | **Does not exist** |

---

## Scope Decisions

| Decision | Rationale |
|----------|-----------|
| **Products are English-only** | Unlike manual sections (which have `content_en`/`content_es`), product tables store content in single TEXT fields. AI can translate on-the-fly when the user's language is ES. Bilingual columns can be added in a future phase if needed. |
| **`concept_id` dropped from all tables** | No `concepts` table exists. This is a single-restaurant app (Alamo Prime). Multi-tenancy can be added later via a migration if needed. Removes unnecessary complexity from Phase 2. |
| **Admin CRUD is out of scope** | Product data is managed via SQL seed migrations. An admin UI for creating/editing products is a future phase. The `ai_ingestion_meta` field supports a future AI-assisted data entry workflow. |
| **Beer & Liquor stays image-less** | B&L is a catalog/list domain (spirits, beers). No card images needed. A simple detail card view will be built, but without hero images. |

---

## Target Architecture

```
User taps AI button on a Wine card
  → Frontend sends: { question, domain: "wines", itemContext: { full card data } }
  → Edge function `/ask-product`:
      1. Authenticate + check usage limits
      2. If action-based (e.g., "practice pitch"), use itemContext directly — no search needed
      3. If open question, route to domain search function
      4. AI calls tool: search_wines({ query, filters })
      5. Retrieves top results from DB (FTS + vector)
      6. AI synthesizes grounded answer
      7. Returns answer + citations
```

### AI Function Calling (Tool Use)

The AI assistant will have access to **5 search tools**, one per domain:

| Tool | Table(s) | Returns |
|------|----------|---------|
| `search_recipes` | `prep_recipes` + `plate_specs` | Ingredients, procedures, scaling notes |
| `search_dishes` | `foh_plate_specs` (+ `plate_specs` join) | Selling points, allergens, flavor, upsell |
| `search_wines` | `wines` | Tasting notes, pairings, producer story |
| `search_cocktails` | `cocktails` | Recipe, technique, tasting notes |
| `search_beer_liquor` | `beer_liquor_list` | Style, description, pairing notes |

The AI decides **which tool to call** based on the user's question and the current viewer context.

---

## Known Mock → Schema Mismatches

These naming and structural differences must be resolved when wiring viewers to the DB (Phase 6). **DB column names are authoritative.** TypeScript types will be regenerated from the DB schema.

### Wine Field Mismatches

| Mock Field | DB Column | Action |
|------------|-----------|--------|
| `grape` | `varietal` | Rename in frontend types |
| `isBlend` | `blend` | Rename in frontend types |
| `producerStory` | `producer_notes` | Rename in frontend types |

### Dish Field Mismatches

| Mock Field | DB Column | Action |
|------------|-----------|--------|
| `name` | `menu_name` | Rename in frontend types |
| `category` | `plate_type` | Rename + add to `foh_plate_specs` schema |
| `allergens[]` | *(missing from FOH schema)* | Add `allergens TEXT[]` to `foh_plate_specs` |
| `topSeller` | `is_top_seller` | Rename in frontend types |

### Recipe Structural Mismatches

| Mock Field | DB Column(s) | Action |
|------------|-------------|--------|
| `yield: "1.5 qt"` | `yield_qty NUMERIC` + `yield_unit TEXT` | Split in seed data, update renderer |
| `shelfLife: "7 days"` | `shelf_life_value INTEGER` + `shelf_life_unit TEXT` | Split in seed data, update renderer |
| `batchScaling: string` | `batch_scaling JSONB` | Convert to JSONB structure, update renderer |
| `trainingNotes: string` | `training_notes JSONB` | Convert to JSONB structure, update renderer |
| `ingredientGroups: [...]` | `ingredients JSONB` | Match DB contract format, update renderer |
| `category` | `prep_type` / `plate_type` | Rename in frontend types |

### Common Across All Domains

| Mock Field | DB Equivalent | Notes |
|------------|---------------|-------|
| `slug` | Will add `slug TEXT UNIQUE NOT NULL` | Currently frontend-only, moving to DB |
| `image` | Will add `image TEXT` | Currently hardcoded URLs |
| `aiResponses` | Removed entirely | Replaced by live `/ask-product` calls |
| *(missing)* | `status`, `version` | DB-only fields (draft/published workflow) |
| *(missing)* | `ai_ingestion_meta` | DB-only field (future AI data entry) |
| *(missing)* | `created_by`, `created_at`, `updated_at` | DB-only audit fields |

---

## Phases

### Phase 1 — Audit & Prep
> Clean up before building. ~1 session.

- Audit all mock data shapes against `table-schema-products.md` (documented above)
- Update `table-schema-products.md` with all amendments:
  - Add `slug`, `image`, `embedding`, `search_vector` to all tables
  - Add `plate_type` and `allergens TEXT[]` to `foh_plate_specs`
  - Remove `concept_id` from `prep_recipes` and `plate_specs`
  - Verify `is_top_seller` on `foh_plate_specs`, `wines`, `cocktails`
- Generate manual section embeddings (pending from earlier phase)
- Rename "Demo Restaurant" group to "Alamo Prime"

**Deliverable:** Updated `table-schema-products.md` with all amendments applied, embeddings generated, group renamed.

**Detailed plan:** `01-phase-audit-prep.md`

---

### Phase 2 — Database Tables & Seed Data
> Create all 6 product tables + migrate mock data. ~2 sessions.

- Write migrations for: `foh_plate_specs`, `wines`, `cocktails`, `beer_liquor_list`, `prep_recipes`, `plate_specs`
- Add `slug`, `image`/`images`, `is_top_seller`, embedding columns where needed
- **No `concept_id`** — dropped per scope decision
- Add FTS `tsvector` columns + GIN indexes on every searchable text field
- Add `vector(1536)` embedding columns + HNSW indexes for semantic search
- Write seed migrations to insert current mock data into each table
  - Wine seed: map `grape` → `varietal`, `isBlend` → `blend`, `producerStory` → `producer_notes`
  - Dish seed: map `name` → `menu_name`, `category` → `plate_type`, `topSeller` → `is_top_seller`
  - Recipe seed: split `yield` → `yield_qty` + `yield_unit`, `shelfLife` → `shelf_life_value` + `shelf_life_unit`, convert `batchScaling`/`trainingNotes` to JSONB
- Add RLS policies (read: authenticated, write: admin only)
- Verify all 6 tables populated and queryable

**Deliverable:** 6 new tables with data, indexes, RLS.

**Detailed plan:** `02-phase-db-tables.md`

---

### Phase 3 — Search Functions (DB Layer)
> PostgreSQL functions for each domain search. ~1 session.

- Create `search_dishes(query, match_count)` — FTS + vector hybrid over `foh_plate_specs`
- Create `search_wines(query, match_count)` — hybrid over `wines`
- Create `search_cocktails(query, match_count)` — hybrid over `cocktails`
- Create `search_recipes(query, match_count)` — hybrid over `prep_recipes` + `plate_specs`
- Create `search_beer_liquor(query, match_count)` — hybrid over `beer_liquor_list`
- All follow the same RRF (Reciprocal Rank Fusion) pattern as `hybrid_search_manual`
- Each returns: id, slug, name, snippet, score
- Note: `language` parameter not needed — products are English-only. The AI translates to ES in the response when needed.

**Deliverable:** 5 PG search functions, tested via SQL.

**Detailed plan:** `03-phase-search-functions.md`

---

### Phase 4 — Generate Product Embeddings
> Extend embed-sections to handle product tables. ~1 session.

- Create new edge function `embed-products` (or extend `embed-sections`)
- For each table, build embedding text from relevant columns (name + description + notes + ingredients etc.)
- Generate embeddings for all rows in all 6 tables
- Verify non-null embeddings across all tables

**Deliverable:** All product rows have vector embeddings.

**Detailed plan:** `04-phase-embeddings.md`

---

### Phase 5 — `/ask-product` Edge Function
> The AI brain with function calling. ~2 sessions.

- New edge function: `/ask-product`
- Accepts: `{ question, domain, language, groupId, action?, itemContext? }`
- **Action mode** (button press): Uses `itemContext` + action type to generate response directly (no search needed)
  - "Practice pitch" → System prompt + full card context → AI generates pitch
  - "Teach me" → System prompt + full card context → AI generates lesson
- **Open question mode**: Uses OpenAI function calling (tool use)
  - Define 5 tool schemas (one per search domain)
  - AI decides which to call based on question + domain hint
  - Function executes corresponding PG search function
  - AI synthesizes answer from results
- Shares auth, usage limits, CORS from existing `/ask`
- Returns: `{ answer, citations, usage }`

**Deliverable:** Deployed edge function handling all product AI queries.

**Detailed plan:** `05-phase-ask-product.md`

---

### Phase 6 — Wire Viewers to Database
> Replace mock data with Supabase queries. ~2–3 sessions.

- Regenerate `types.ts` from DB schema (`supabase gen types typescript`)
- Create data hooks: `useSupabaseDishes()`, `useSupabaseWines()`, `useSupabaseCocktails()`, `useSupabaseRecipes()`, `useSupabaseBeerLiquor()`
- Each hook: fetches from Supabase, maps DB column names to component-friendly types
- Add loading states, error states, empty states
- Keep existing viewer hooks (`useDishViewer`, etc.) but swap data source
- Update TypeScript types to match DB schema (replace mock types)
- **Update component renderers** where DB structure differs from mock:
  - `RecipeCardView`: handle split `yield_qty`/`yield_unit`, JSONB `batch_scaling`/`training_notes`, JSONB `ingredients`/`procedure` contracts
  - `DishCardView`: use `menu_name`, `plate_type`, structured `allergens[]`
  - `WineCardView`: use `varietal`, `blend`, `producer_notes`
- **Build `BeerLiquorCardView.tsx`** from scratch (B&L currently only has a list view):
  - Simple detail card: name, category, subcategory, producer, country, style, description, notes
  - No hero image (B&L stays image-less)
  - Include AI action buttons (matching the pattern of other card views)
- **Build `useBeerLiquorViewer` hook** with prev/next navigation (matching other viewer hooks)
- Wire swipe navigation + header prev/next to new B&L viewer
- Verify all grids and card views render correctly with DB data

**Deliverable:** All viewers powered by Supabase. Mock data files unused.

**Detailed plan:** `06-phase-wire-viewers.md`

---

### Phase 7 — Wire AI Buttons
> Connect UI buttons to `/ask-product`. ~1–2 sessions.

- Replace static `aiResponses` with calls to `/ask-product` in action mode
- Each AI button sends: action type + full card context (serialized item data)
- Update existing AI sheets (`DishAISheet`, `WineAISheet`, `CocktailAISheet`) to:
  - Show loading spinner while AI generates
  - Display streamed/complete response
  - Handle errors gracefully
- **Create `RecipeAISheet.tsx`** from scratch (does not exist yet):
  - AI buttons for recipes: "Teach me", "Quiz me", "Ask a question"
  - Wire into `RecipeCardView`
- **Create `BeerLiquorAISheet.tsx`** from scratch (does not exist yet):
  - AI buttons for B&L: "Teach me", "Suggest pairing", "Ask a question"
  - Wire into new `BeerLiquorCardView`
- Add "Ask a question" freeform input to each AI sheet (open question mode)

**Deliverable:** All 5 viewers have working AI buttons. Freeform questions work per domain.

**Detailed plan:** `07-phase-wire-ai-buttons.md`

---

### Phase 8 — Integration Testing & Polish
> End-to-end testing, performance, edge cases. ~1 session.

- Test all 5 viewers: grid → card → AI buttons → freeform question
- Test cross-domain questions ("what wine pairs with the ribeye?")
- Test usage limits (daily/monthly counters shared with manual AI)
- Test bilingual: UI language toggle works, AI responds in selected language
- Audit RLS: ensure anon users can't read, authenticated can read, admin can write
- Performance check: page load times, search latency, AI response time
- Verify mobile/iPad/desktop layouts still work
- Run `npx tsc --noEmit` — zero errors
- Security audit: no exposed service keys, no SQL injection vectors

**Deliverable:** Production-ready system.

**Detailed plan:** `08-phase-testing-polish.md`

---

## Schema Amendments Needed

Based on the audit, the following changes to `table-schema-products.md` are needed before Phase 2:

| Table | Addition | Reason |
|-------|----------|--------|
| `foh_plate_specs` | `slug TEXT UNIQUE NOT NULL` | URL routing, cross-references |
| `foh_plate_specs` | `image TEXT` | Card thumbnail |
| `foh_plate_specs` | `plate_type TEXT NOT NULL` | Category (appetizer/entree/side/dessert) — mock has it, schema doesn't |
| `foh_plate_specs` | `allergens TEXT[] NOT NULL` | Allergen badges in UI — mock has it, FOH schema doesn't |
| `foh_plate_specs` | `embedding vector(1536)` | Semantic search |
| `foh_plate_specs` | `search_vector tsvector` | Full-text search |
| `wines` | `slug TEXT UNIQUE NOT NULL` | URL routing |
| `wines` | `image TEXT` | Card thumbnail |
| `wines` | `embedding vector(1536)` | Semantic search |
| `wines` | `search_vector tsvector` | Full-text search |
| `cocktails` | `slug TEXT UNIQUE NOT NULL` | URL routing |
| `cocktails` | `image TEXT` | Card thumbnail |
| `cocktails` | `embedding vector(1536)` | Semantic search |
| `cocktails` | `search_vector tsvector` | Full-text search |
| `beer_liquor_list` | `slug TEXT UNIQUE NOT NULL` | URL routing |
| `beer_liquor_list` | `embedding vector(1536)` | Semantic search |
| `beer_liquor_list` | `search_vector tsvector` | Full-text search |
| `prep_recipes` | `slug TEXT UNIQUE NOT NULL` | URL routing, cross-references |
| `prep_recipes` | `embedding vector(1536)` | Semantic search |
| `prep_recipes` | `search_vector tsvector` | Full-text search |
| `plate_specs` | `slug TEXT UNIQUE NOT NULL` | URL routing, cross-references |
| `plate_specs` | `embedding vector(1536)` | Semantic search |
| `plate_specs` | `search_vector tsvector` | Full-text search |

Additionally:
- **Remove** `concept_id` from `prep_recipes` and `plate_specs` (dropped per scope decision)
- **Verify** `is_top_seller` already present on `foh_plate_specs`, `wines`, `cocktails` (added in prior session)

---

## Scalability Considerations (1000 Users)

| Concern | Approach |
|---------|----------|
| DB connections | Supabase connection pooling (PgBouncer) — no app changes needed |
| Search latency | HNSW indexes on embeddings, GIN indexes on tsvector — sub-100ms |
| AI rate limits | Usage counters per user (existing), OpenAI tier rate limits |
| Edge function cold starts | Deno isolates warm in ~50ms, no concern at 1000 users |
| Concurrent reads | RLS + read replicas if needed (Supabase Pro plan) |
| Data size | ~100 product rows total — trivial for PostgreSQL |
| Frontend bundle | Mock data removal shrinks bundle; lazy-loaded viewers |

No architectural changes needed. The current stack (Supabase + Edge Functions + OpenAI) handles 1000 users out of the box.

---

## Dependency Graph

```
Phase 1 (Audit)
  ↓
Phase 2 (DB Tables)
  ↓
Phase 3 (Search Functions)  ←→  Phase 4 (Embeddings)
  ↓                                ↓
Phase 5 (/ask-product Edge Function)
  ↓
Phase 6 (Wire Viewers + Build B&L Card View)  ←→  Phase 7 (Wire AI Buttons + Build Recipe/B&L AI Sheets)
  ↓                                                  ↓
Phase 8 (Testing & Polish)
```

Phases 3 and 4 can run in parallel. Phases 6 and 7 can run in parallel.

---

## File Organization

```
docs/plans/product-ai/
  00-master-plan.md          ← this file
  01-phase-audit-prep.md
  02-phase-db-tables.md
  03-phase-search-functions.md
  04-phase-embeddings.md
  05-phase-ask-product.md
  06-phase-wire-viewers.md
  07-phase-wire-ai-buttons.md
  08-phase-testing-polish.md
```

Each phase plan will contain:
- Exact files to create/modify
- SQL migrations
- TypeScript interfaces
- Edge function code structure
- Verification steps
