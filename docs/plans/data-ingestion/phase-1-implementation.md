# Phase 1: Database Foundation + Session Management — Implementation Plan

**Plan Date:** 2026-02-19
**Status:** In Progress (~50% complete)
**Depends On:** Existing product tables (6 tables, 44 rows — verified clean)

---

## What's Already Built

### Database (migration: `20260219170000_create_ingestion_tables.sql`)

| Object | Status | Notes |
|--------|--------|-------|
| `ingestion_sessions` table | DONE | 15 columns, CHECK constraints on enums |
| `ingestion_messages` table | DONE | 7 columns, FK cascade to sessions |
| 3 indexes | DONE | `idx_ingestion_sessions_created_by`, `_status`, `idx_ingestion_messages_session_id` |
| `updated_at` trigger | DONE | `trg_ingestion_sessions_updated_at` with `search_path = public` |
| RLS on `ingestion_sessions` | DONE | 6 policies (admin/manager SELECT, user own SELECT, admin INSERT/UPDATE/DELETE) |
| RLS on `ingestion_messages` | DONE | 3 policies (user own SELECT/INSERT, admin DELETE) |
| AI prompt seed | DONE | `ingest-prep-recipe` in `ai_prompts` table (EN+ES) |

**Existing enum values (CHECK constraints):**
- `product_table`: `prep_recipes`, `plate_specs`, `foh_plate_specs`, `wines`, `cocktails`, `beer_liquor_list`
- `ingestion_method`: `chat`, `file_upload`, `image_upload`, `edit`
- `status`: `drafting`, `review`, `publishing`, `published`, `failed`, `abandoned`

### Frontend

| File | Status | Notes |
|------|--------|-------|
| `src/types/ingestion.ts` | DONE | `ProductType`, `IngestionMethod`, `PrepRecipeDraft`, `ChatMessage`, `DraftState`, helpers |
| `src/hooks/use-ingestion-session.ts` | DONE | `createSession`, `loadSession`, `saveDraft`, `listSessions` + concurrency control |
| `src/hooks/use-ingest-chat.ts` | DONE | `sendMessage`, `structureText` — calls `/ingest` edge function |
| `src/contexts/IngestDraftContext.tsx` | DONE | 52+ dispatch actions, full reducer for ingredients/procedure/metadata |
| `src/pages/IngestPage.tsx` | DONE | Single page with mobile/desktop layouts, chat + editor + preview |
| `src/components/ingest/ProductTypeNavbar.tsx` | DONE | Product type selector with dirty indicators |
| `src/components/ingest/MethodTabs.tsx` | DONE | Chat/File/Photo tabs (file + photo are stubs) |
| `src/components/ingest/ChatIngestionPanel.tsx` | DONE | Message list, input, read-only draft preview cards, auto-scroll |
| `src/components/ingest/IngestPreview.tsx` | DONE | Full recipe preview with batch scaling |
| `src/components/ingest/DraftPreviewCard.tsx` | DONE | Inline draft summary in chat |
| `src/components/ingest/MobileModeTabs.tsx` | DONE | Chat/Preview/Edit segment control |
| Sidebar "Ingest" link | DONE | Admin-only, Plus icon, `/admin/ingest` |
| Route `/admin/ingest` | DONE | `ProtectedRoute requiredRole="admin"` |

---

## What's Missing

### Database — 4 items

#### 1. `sub_recipe_links` table

Purpose: Many-to-many linkage between recipes (e.g., plate spec references a prep recipe).

```sql
CREATE TABLE public.sub_recipe_links (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  parent_table TEXT NOT NULL CHECK (parent_table IN (
    'prep_recipes','plate_specs','foh_plate_specs','wines','cocktails','beer_liquor_list'
  )),
  parent_id UUID NOT NULL,
  child_table TEXT NOT NULL CHECK (child_table IN (
    'prep_recipes','plate_specs','foh_plate_specs','wines','cocktails','beer_liquor_list'
  )),
  child_id UUID NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_table, parent_id, child_table, child_id)
);
```

RLS:
- SELECT: authenticated `USING (true)` (read by anyone logged in)
- INSERT/UPDATE/DELETE: admin only via `has_role(auth.uid(), 'admin'::user_role)`

Indexes:
- `idx_sub_recipe_links_parent` on `(parent_table, parent_id)`
- `idx_sub_recipe_links_child` on `(child_table, child_id)`

#### 2. `product_translations` table

Purpose: Per-field translation overlay for bilingual content, avoiding schema bloat.

```sql
CREATE TABLE public.product_translations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  product_table TEXT NOT NULL CHECK (product_table IN (
    'prep_recipes','plate_specs','foh_plate_specs','wines','cocktails','beer_liquor_list'
  )),
  product_id UUID NOT NULL,
  field_path TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'en',
  translated_lang TEXT NOT NULL DEFAULT 'es',
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_table, product_id, field_path, translated_lang)
);
```

RLS:
- SELECT: authenticated `USING (true)`
- INSERT/UPDATE/DELETE: admin only

Indexes:
- `idx_product_translations_lookup` on `(product_table, product_id)`

Trigger:
- `updated_at` auto-update (same pattern as `ingestion_sessions`)

#### 3. `product-assets` storage bucket

Purpose: Store uploaded images and files (recipe cards, PDFs, menu photos).

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-assets',
  'product-assets',
  false,
  10485760,  -- 10MB
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
);
```

Storage policies:
- SELECT (download): authenticated users
- INSERT (upload): admin only
- UPDATE: admin only
- DELETE: admin only

#### 4. `source_session_id` FK on all 6 product tables

Purpose: Trace published products back to the ingestion session that created them.

```sql
ALTER TABLE public.prep_recipes
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.plate_specs
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.foh_plate_specs
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.wines
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.cocktails
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);

ALTER TABLE public.beer_liquor_list
  ADD COLUMN source_session_id UUID REFERENCES public.ingestion_sessions(id);
```

No index needed (rarely queried by this column).

### Frontend — 5 items

#### 5. `IngestDashboard.tsx` page

Purpose: List all ingestion sessions with status badges, search, and filter.

**Location:** `src/pages/IngestDashboard.tsx`

**Requirements:**
- Calls `listSessions()` from `useIngestionSession` hook
- Shows sessions in a card list or table:
  - Product type icon + label
  - Draft name (from `draft_data.name` or "Untitled")
  - Status badge (color-coded: drafting=yellow, review=blue, published=green, abandoned=gray, failed=red)
  - Method icon (chat/file/image/edit)
  - Last updated (relative time)
  - Created date
- Filter by status (tabs or dropdown)
- Filter by product type
- Search by draft name
- "New Product" button → navigates to `/admin/ingest/new`
- Click session row → navigates to `/admin/ingest/:sessionId`
- Empty state: illustration + "No ingestion sessions yet" + CTA button
- Admin-only page (already gated by route)

#### 6. `IngestWizard.tsx` page

Purpose: Step-through wizard to pick product type + ingestion method before creating a session.

**Location:** `src/pages/IngestWizard.tsx`

**Requirements:**
- Step 1: Select product type (6 options, only `prep_recipe` enabled, others show "Coming Soon")
  - Use cards with icons, not just buttons
  - Highlight selected card
- Step 2: Select ingestion method
  - Chat with AI (MessageSquare icon) — "Describe your recipe in natural language"
  - Upload File (Upload icon) — "PDF, Excel, Word, or TXT" — disabled, "Coming in Phase 3"
  - Take Photo (Camera icon) — "Photo of recipe card or menu" — disabled, "Coming in Phase 3"
- "Create Session" button → calls `createSession(productTable)` → navigates to `/admin/ingest/:sessionId`
- Back button on Step 2 → returns to Step 1
- Cancel → navigates back to `/admin/ingest`

#### 7. Three missing routes in `App.tsx`

Add to the existing ingestion route section:

```tsx
<Route path="/admin/ingest" element={
  <ProtectedRoute requiredRole="admin">
    <IngestDashboard />
  </ProtectedRoute>
} />
<Route path="/admin/ingest/new" element={
  <ProtectedRoute requiredRole="admin">
    <IngestWizard />
  </ProtectedRoute>
} />
<Route path="/admin/ingest/:sessionId" element={
  <ProtectedRoute requiredRole="admin">
    <IngestPage />
  </ProtectedRoute>
} />
<Route path="/admin/ingest/edit/:table/:id" element={
  <ProtectedRoute requiredRole="admin">
    <IngestPage />
  </ProtectedRoute>
} />
```

**Note:** The existing `/admin/ingest` route currently points to `IngestPage`. It must be changed to point to `IngestDashboard` instead. `IngestPage` moves to the `:sessionId` route.

`IngestPage` needs to be updated to:
- Read `sessionId` from URL params (`useParams`)
- Call `loadSession(sessionId)` on mount
- Read `table` and `id` from URL params for edit mode
- For edit mode: fetch existing product row, create session with `ingestion_method: 'edit'`, pre-fill draft

#### 8. Edit buttons on 5 CardView components

Add an admin-only pencil (Edit) button to each CardView. The button navigates to `/admin/ingest/edit/:table/:id`.

**Pattern (same for all 5):**

```tsx
import { useAuth } from '@/hooks/use-auth';
import { Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Inside the component:
const { isAdmin } = useAuth();
const navigate = useNavigate();

// In the header/title row, next to existing buttons:
{isAdmin && (
  <Button
    variant="outline"
    size="sm"
    className="h-8 px-2"
    onClick={() => navigate(`/admin/ingest/edit/${tableName}/${item.id}`)}
  >
    <Pencil className="h-4 w-4" />
  </Button>
)}
```

**Per-component specifics:**

| Component | File | Table Name | Item ID | Placement |
|-----------|------|------------|---------|-----------|
| WineCardView | `src/components/wines/WineCardView.tsx` | `wines` | `wine.id` | Header row, after title |
| CocktailCardView | `src/components/cocktails/CocktailCardView.tsx` | `cocktails` | `cocktail.id` | Header row, after title |
| DishCardView | `src/components/dishes/DishCardView.tsx` | `foh_plate_specs` | `dish.id` | Header row, after title |
| RecipeCardView | `src/components/recipes/RecipeCardView.tsx` | `recipe.type === 'prep' ? 'prep_recipes' : 'plate_specs'` | `recipe.id` | Title row, before "Ask a Question" |
| BeerLiquorCardView | `src/components/beer-liquor/BeerLiquorCardView.tsx` | `beer_liquor_list` | `item.id` | Header row, after title |

#### 9. Regenerate TypeScript types

After pushing the new migration, run:

```bash
npx supabase gen types --lang=typescript --local > src/integrations/supabase/types.ts
```

This syncs the generated types with the new `ingestion_sessions`, `ingestion_messages`, `sub_recipe_links`, and `product_translations` tables.

---

## Implementation Order

All tasks organized by dependency. Items at the same level can be done in parallel.

### Step 1: Database migration (single migration file)

Create `supabase/migrations/20260220_phase1_complete_tables.sql` containing:
1. `sub_recipe_links` table + RLS + indexes
2. `product_translations` table + RLS + indexes + trigger
3. `product-assets` storage bucket + policies
4. `source_session_id` column on all 6 product tables

Then: `npx supabase db push`

### Step 2: Regenerate types

```bash
npx supabase gen types --lang=typescript --local > src/integrations/supabase/types.ts
```

### Step 3: Frontend (can be parallelized)

**3a.** `IngestDashboard.tsx` — new page
**3b.** `IngestWizard.tsx` — new page
**3c.** Route updates in `App.tsx` + `IngestPage.tsx` session loading from URL params
**3d.** Edit buttons on 5 CardView components

### Step 4: Smoke test

See testing plan below.

---

## Testing Plan

### Database Tests (Supabase SQL Editor)

```sql
-- 1. Verify new tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('sub_recipe_links', 'product_translations');
-- Expected: both rows

-- 2. Verify source_session_id column on all 6 product tables
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'source_session_id'
ORDER BY table_name;
-- Expected: 6 rows (one per product table)

-- 3. Verify storage bucket
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'product-assets';
-- Expected: 1 row, public=false, file_size_limit=10485760

-- 4. Verify RLS enabled on new tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('sub_recipe_links', 'product_translations');
-- Expected: both rowsecurity = true

-- 5. Verify policy count on new tables
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('sub_recipe_links', 'product_translations')
GROUP BY tablename;
-- Expected: 4 policies per table

-- 6. Test sub_recipe_links insert (as admin via SQL Editor)
INSERT INTO sub_recipe_links (parent_table, parent_id, child_table, child_id, context)
SELECT 'plate_specs', ps.id, 'prep_recipes', pr.id, 'finishing sauce'
FROM plate_specs ps, prep_recipes pr
WHERE ps.slug = 'bone-in-ribeye' AND pr.slug = 'red-wine-demi-glace';
-- Expected: 1 row inserted

-- 7. Test unique constraint
-- Run the same INSERT again
-- Expected: unique violation error

-- 8. Clean up test data
DELETE FROM sub_recipe_links
WHERE parent_table = 'plate_specs' AND child_table = 'prep_recipes';
```

### Frontend Tests (Browser)

**Dashboard (`/admin/ingest`):**
1. Navigate to `/admin/ingest` — should show IngestDashboard
2. Verify "New Product" button is visible
3. If no sessions exist, verify empty state message
4. Click "New Product" → should navigate to `/admin/ingest/new`

**Wizard (`/admin/ingest/new`):**
1. Verify Step 1 shows 6 product type cards
2. Only "Prep Recipe" should be clickable, others show "Coming Soon"
3. Select "Prep Recipe" → Step 2 appears
4. Only "Chat with AI" should be clickable
5. Click "Create Session" → should create DB session and navigate to `/admin/ingest/:sessionId`

**Session (`/admin/ingest/:sessionId`):**
1. Verify IngestPage loads with session data from URL
2. Paste a recipe description in chat → AI structures it
3. Draft preview card appears in chat (read-only summary)
4. Switch to Edit mode → editor shows with structured data
5. Make edits → verify dirty flag appears
6. Verify auto-save fires (check `updated_at` in DB)

**Edit Mode (from CardView):**
1. Navigate to any product viewer (e.g., `/wines`)
2. Select a wine → WineCardView opens
3. Verify pencil (Edit) button is visible (admin user only)
4. Click Edit → should navigate to `/admin/ingest/edit/wines/:id`
5. IngestPage should load with product data pre-filled in draft
6. Repeat for all 5 CardView components

**Non-admin test:**
1. Log in as a non-admin user
2. Verify `/admin/ingest` redirects or shows unauthorized
3. Verify Edit pencil buttons are NOT visible on CardViews

---

## Files Changed / Created Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `supabase/migrations/20260220_phase1_complete_tables.sql` | sub_recipe_links + product_translations + storage + source_session_id |
| CREATE | `src/pages/IngestDashboard.tsx` | Session list page |
| CREATE | `src/pages/IngestWizard.tsx` | Product type + method wizard |
| MODIFY | `src/App.tsx` | Update routes (4 ingestion routes) |
| MODIFY | `src/pages/IngestPage.tsx` | Read sessionId/table/id from URL params |
| MODIFY | `src/components/wines/WineCardView.tsx` | Add admin Edit button |
| MODIFY | `src/components/cocktails/CocktailCardView.tsx` | Add admin Edit button |
| MODIFY | `src/components/dishes/DishCardView.tsx` | Add admin Edit button |
| MODIFY | `src/components/recipes/RecipeCardView.tsx` | Add admin Edit button |
| MODIFY | `src/components/beer-liquor/BeerLiquorCardView.tsx` | Add admin Edit button |
| REGEN  | `src/integrations/supabase/types.ts` | Regenerate from DB schema |

**Total: 1 migration, 2 new pages, 7 modified files, 1 regenerated file**
