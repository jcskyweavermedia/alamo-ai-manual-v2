# Data Ingestion System - Implementation Plan

> **First action after approval**: Create `docs/plans/data-ingestion/` folder and copy this plan as `README.md`.

---

## Context

The Alamo Prime app has 6 product tables with 44 seeded rows, read-only viewers, and AI Q&A. **There is no way to create or edit products through the app** -- all data was loaded via SQL migrations.

This plan adds an **AI-powered data ingestion system** letting admins create and edit products via conversation, file upload, or image upload, with a structured editor for refinement before publishing.

**Build order: UX first, wire up later.** We build the full interface with local state and mock data, validate the chef experience, then connect the backend.

---

## Feature Overview

| Feature | Description |
|---------|-------------|
| **Product Type Navbar** | Persistent top pills bar to switch between Prep Recipe, Plate Spec, Dish Guide, Wine, Cocktail, Beer/Liquor -- one tap to switch, unsaved drafts indicated with dots |
| **AI Chat Builder** | Conversational interface (text + voice) where the chef describes a product and the AI structures it. Inline preview card auto-updates in the chat. |
| **WebRTC Voice Mode** | Full duplex voice conversation via GPT-4o Realtime to build products hands-free |
| **File Upload** | PDF, Excel, Word, TXT -- AI extracts and structures product data |
| **Image Upload** | Photo of recipe card, menu, wine label -- GPT-4o vision extracts data |
| **Structured Editor** | Inline-editable form with accordion sections. Ingredients/procedures reorderable via arrow buttons (mobile) or DnD (desktop). |
| **Sub-Recipe Linking** | Search and link existing prep_recipes as components in plate specs and cocktails |
| **Batch Calculator** | Editable batch multipliers per prep recipe |
| **Translation (EN/ES)** | Per-field translation control. Default: procedure + notes. Content-hash addressed (stable across reordering). |
| **Web Search Enrichment** | AI searches the web for wine tasting notes, producer info, cocktail history, beer descriptions |
| **Auto-Build Dish Guide** | Generate FOH dish guide from a plate spec by aggregating all linked prep recipes |
| **Edit Existing Products** | "Edit" button on every product CardView opens the same editor pre-filled |
| **Draft Management** | Auto-save, session recovery, optimistic concurrency with version counter |

---

## Architecture

```
/admin/ingest (single page, no wizard)
  |
  +-- Top Navbar: [ Prep Recipe | Plate Spec | Dish Guide | Wine | Cocktail | Beer/Liquor ]
  |                 (scrollable on mobile, dot indicators for active drafts)
  |
  +-- Method Tabs: [ Chat with AI | Upload File | Take Photo ]
  |                 (inline tabs, NOT a separate step)
  |
  +-- Mobile Modes: [ Chat | Preview | Edit ]  (full-screen, bottom segment control)
  +-- Desktop: Chat panel right (like aiPanel) + Preview/Edit in main content
  |
  +-- Components:
        +-- ChatIngestionPanel (text + voice, inline draft preview cards)
        +-- FileUploadZone (drag-drop, type badges)
        +-- ImageUploadZone (camera button on mobile)
        +-- ProductEditor (accordion sections, inline editing)
              +-- IngredientsEditor (arrow-button reordering on mobile, DnD on desktop)
              +-- ProcedureEditor (same pattern)
              +-- BatchEditor, SubRecipeLinker, TranslationPanel, ImageGalleryEditor
        +-- Sticky bottom bar: [Save Draft] [Publish]
```

---

## Implementation Phases (UX First, Wire Later)

### Phase 1A: Prep Recipe Ingestion -- Page Shell + Chat UI

**Goal**: The page exists, routing works, product navbar renders, chat interface is functional with local state. No backend calls yet.

**Routing + Navigation**:
- Add `/admin/ingest` route to `App.tsx`, protected by admin role
- Add "Ingest" link in Sidebar for admin users (below existing nav items)
- `src/pages/IngestPage.tsx` -- single page component

**Page Layout**:
- Uses `AppShell` (existing layout shell)
- **Product Type Navbar**: Horizontal scrollable pills bar at the top of content area
  - 6 pills: Prep Recipe, Plate Spec, Dish Guide, Wine, Cocktail, Beer/Liquor
  - Visual pattern: reuse existing filter pill style from `RecipeGrid.tsx` (rounded-lg bg-muted p-1, active: bg-background shadow-sm)
  - Only "Prep Recipe" is active; others show "Coming Soon" tooltip
  - Dot indicator (6px circle, bg-primary) on pills with unsaved drafts
- **Method Tabs** below navbar: `[ Chat with AI | Upload File | Take Photo ]`
  - Uses existing shadcn `Tabs`/`TabsList`/`TabsTrigger`
  - "Chat with AI" is default active
  - "Upload File" and "Take Photo" show placeholder UI for now

**Chat Interface** (local state only):
- `src/components/ingest/ChatIngestionPanel.tsx`
  - Scrollable message list (user messages + AI response placeholders)
  - Text input pinned to bottom (reuses existing `VoiceChatInput` component pattern)
  - Voice button (UI only, no recording wired yet)
  - Messages stored in React state (`useState<ChatMessage[]>`)
  - On send: add user message to state, show a mock AI response with a hardcoded preview card

**Inline Draft Preview Card** (in chat stream):
- `src/components/ingest/DraftPreviewCard.tsx`
  - Renders inside the chat message list as the AI's "response"
  - Shows: recipe name, prep type, yield, shelf life, ingredient count, procedure step count
  - Read-only summary card (no action buttons)
  - Uses existing card styling (bg-card, rounded-lg, shadow)
  - For Phase 1A: populated from hardcoded mock data

**Mobile Mode Segment Control**:
- Bottom segment control: `[ Chat | Preview | Edit ]`
  - Only "Chat" is functional in 1A
  - "Preview" and "Edit" show empty states with "Build a recipe first" message
  - Uses existing `Tabs` component, compact pill variant

**Types**:
- `src/types/ingestion.ts` -- ChatMessage, DraftState, ProductType enum, IngestionMethod enum, PrepRecipeDraft interface

**Files created in Phase 1A**:
```
src/pages/IngestPage.tsx
src/types/ingestion.ts
src/components/ingest/ProductTypeNavbar.tsx
src/components/ingest/MethodTabs.tsx
src/components/ingest/ChatIngestionPanel.tsx
src/components/ingest/DraftPreviewCard.tsx
src/components/ingest/MobileModeTabs.tsx
+ App.tsx route update
+ Sidebar.tsx nav link update
```

**Test**: Navigate to /admin/ingest -> see product pills with "Prep Recipe" selected -> type a message -> see it appear in chat -> see a read-only draft preview card -> tap between Chat/Preview/Edit modes on mobile.

---

### Phase 1B: Prep Recipe Editor UI

**Goal**: Full structured editor for prep recipes. All editing is local state -- no database saves yet.

**Draft State Management**:
- `src/hooks/use-prep-recipe-draft.ts` -- Reducer-based hook managing the full PrepRecipeDraft
  - Actions: SET_NAME, SET_PREP_TYPE, SET_YIELD, SET_SHELF_LIFE, SET_TAGS, ADD_INGREDIENT_GROUP, REMOVE_INGREDIENT_GROUP, ADD_INGREDIENT, UPDATE_INGREDIENT, REMOVE_INGREDIENT, MOVE_INGREDIENT_UP/DOWN, MOVE_GROUP_UP/DOWN, ADD_PROCEDURE_GROUP, ADD_STEP, UPDATE_STEP, REMOVE_STEP, MOVE_STEP_UP/DOWN, SET_BATCH_SCALING, SET_IMAGES, SET_ALL (for AI-populated data)
  - State shape matches `prep_recipes` table schema exactly (ingredients JSONB, procedure JSONB, etc.)

**Editor Component**:
- `src/components/ingest/editor/PrepRecipeEditor.tsx` -- Master editor for prep recipes
  - Accordion sections (using existing shadcn `Accordion`):
    1. **Recipe Info** (always open by default): name, prep_type (dropdown), tags (chip input)
    2. **Yield & Shelf Life**: yield_qty + yield_unit, shelf_life_value + shelf_life_unit
    3. **Ingredients**: grouped ingredient editor (see below)
    4. **Procedure**: grouped procedure editor (see below)
    5. **Batch Scaling**: notes field, multiplier list (editable)
    6. **Training Notes**: QA checks, common mistakes (text areas)
  - Sticky bottom bar: [Save Draft] [Publish] buttons (disabled/no-op in 1B, wired in Phase 2)

**Ingredients Editor**:
- `src/components/ingest/editor/IngredientsEditor.tsx`
  - List of `IngredientGroupCard` components
  - "Add Group" button at bottom
  - Each group is collapsible with a header (group name, editable inline, tap-to-edit)
- `src/components/ingest/editor/IngredientGroupCard.tsx`
  - Group header: drag handle area (visual only for now), inline-editable group name, up/down arrow buttons, delete button
  - List of `IngredientItemRow` inside
  - "Add Ingredient" button at bottom of group
- `src/components/ingest/editor/IngredientItemRow.tsx`
  - Row: [up/down arrows] [qty input] [unit dropdown] [name input] [allergen chips] [delete X]
  - All fields are inline-editable (tap to focus)
  - Compact layout: qty (w-16) + unit (w-20) + name (flex-1) + delete (w-8)
  - Touch-friendly: minimum 44px row height

**Procedure Editor**:
- `src/components/ingest/editor/ProcedureEditor.tsx`
  - Same grouped pattern as ingredients
  - Groups represent phases (e.g., "Prep", "Cook", "Finish")
- `src/components/ingest/editor/ProcedureGroupCard.tsx`
  - Group header: name, up/down, delete
  - List of `ProcedureStepRow`
- `src/components/ingest/editor/ProcedureStepRow.tsx`
  - Row: [up/down arrows] [step number (auto)] [instruction textarea] [critical toggle] [delete X]
  - Instruction is a multi-line textarea (auto-grows)
  - "Critical" toggle marks important steps (visual: red left border)

**Metadata Components**:
- `src/components/ingest/editor/MetadataFields.tsx` -- Name input, prep_type select, yield/shelf-life fields
- `src/components/ingest/editor/TagEditor.tsx` -- Chip input for tags (type + enter to add, X to remove)

**Preview Mode** (connects to Mobile Mode Tabs from 1A):
- `src/components/ingest/IngestPreview.tsx`
  - Renders the current draft exactly as the published recipe would look
  - Reuses existing `IngredientsColumn` + `ProcedureColumn` + `BatchSizeSelector` from `src/components/recipes/`
  - Read-only view -- "Edit" floating button to switch to Edit mode

**Wire Chat -> Editor**:
- DraftPreviewCard is a read-only summary (no action buttons)
- Draft state is shared via React context: `IngestDraftContext` wrapping IngestPage

**Files created in Phase 1B**:
```
src/hooks/use-prep-recipe-draft.ts
src/contexts/IngestDraftContext.tsx
src/components/ingest/editor/PrepRecipeEditor.tsx
src/components/ingest/editor/IngredientsEditor.tsx
src/components/ingest/editor/IngredientGroupCard.tsx
src/components/ingest/editor/IngredientItemRow.tsx
src/components/ingest/editor/ProcedureEditor.tsx
src/components/ingest/editor/ProcedureGroupCard.tsx
src/components/ingest/editor/ProcedureStepRow.tsx
src/components/ingest/editor/MetadataFields.tsx
src/components/ingest/editor/TagEditor.tsx
src/components/ingest/IngestPreview.tsx
```

**Test**: Type a recipe in chat -> see read-only preview card -> switch to Edit mode -> see full editor with accordion sections -> add/edit/delete/reorder ingredients and procedure steps -> switch to Preview mode -> see it rendered like the existing recipe viewer -> switch back to Edit -> changes persist.

---

### Phase 1C: Desktop Layout + Polish

**Goal**: Desktop split layout, responsive polish, and product-type switching UX.

**Desktop Layout** (>1024px):
- Main content area: Preview or Edit mode
- Right panel (aiPanel pattern from AppShell): Chat interface docked on right side (w-80 xl:w-96)
- Same content, just repositioned -- no new components needed, just responsive conditionals

**Product Type Switching**:
- `IngestDraftContext` holds a `Map<ProductType, DraftState>`
- Switching pills auto-saves current draft to context (local, not DB)
- Dot indicator appears on pills with non-empty drafts
- Switching back restores exactly where you left off (chat history, draft data, active mode)
- Only prompts "discard?" when navigating AWAY from `/admin/ingest` with unsaved drafts

**Polish**:
- Empty states: "Start by describing your recipe" in chat, "No recipe yet" in preview
- Transitions: smooth slide between Chat/Preview/Edit modes
- Form validation visual feedback (red borders on invalid fields, but no blocking)
- Auto-slug generation from name (live preview under name field)
- Responsive ingredient row: stacks on very narrow screens (<375px)

**Test**: On desktop, see chat on the right, editor on the left simultaneously. Switch to "Wine" pill -> see "Coming Soon". Switch back to "Prep Recipe" -> draft is intact. Resize to mobile -> modes switch to full-screen tabs.

---

### Phase 2A: Wire Up Backend -- Database + Edge Function

**Goal**: Connect the UI to real persistence. Chat with actual AI.

**Database Migrations**:
- `create_ingestion_tables.sql`: `ingestion_sessions` + `ingestion_messages` tables
  - `ingestion_sessions`: id, product_table (CHECK), ingestion_method (CHECK), status (CHECK), draft_data JSONB, draft_version INT, product_id, editing_product_id, ai_confidence, missing_fields[], source_file_name, source_file_type, created_by, timestamps
  - `ingestion_messages`: id, session_id FK CASCADE, role, content, draft_updates JSONB, tool_calls JSONB, created_at
- `create_ingestion_rls.sql`: Admin+manager view/create, creator updates own drafts, admin-only delete
- `seed_ingestion_ai_prompts.sql`: Schema-aware prompt for prep_recipes in `ai_prompts` table

**Edge Function**: `supabase/functions/ingest/index.ts`
- Mode `structure`: raw text -> structured prep_recipe JSON via gpt-4o-mini with json_schema response_format
- Mode `chat`: multi-turn conversation with `update_draft` tool calling (MAX_TOOL_ROUNDS=3)
- Auth: verify_jwt=false, manual auth via getUser(), service role for DB writes
- Pattern: follows existing `/ask` function structure

**Frontend Wiring**:
- `src/hooks/use-ingestion-session.ts` -- Create/load/save session to Supabase (replaces local-only state)
- `src/hooks/use-ingest-chat.ts` -- Send message to `/ingest` edge function, receive AI response + draft updates
- Replace mock AI responses in ChatIngestionPanel with real edge function calls
- Auto-save draft to DB every 5 seconds (debounced), using `draft_version` for optimistic concurrency
- Loading states: skeleton in preview card while AI processes

**Test**: Type a real recipe description -> AI returns structured preview card with parsed ingredients/procedure -> iterate via follow-up messages -> AI updates draft in real-time.

---

### Phase 2B: Publish Pipeline + Edit Mode

**Goal**: Save drafts to DB, publish to real product tables, edit existing products.

**Publish Flow** (wires up the [Publish] button):
1. Validate required fields (name, ingredients, procedure)
2. Auto-generate slug (kebab-case from name, check uniqueness)
3. INSERT into `prep_recipes` with `status='published'`, `created_by = auth.uid()`
4. Update `ingestion_sessions.product_id` + `status='published'`
5. Set `ai_ingestion_meta`: `{source_type:'chat_ingestion', confidence_score, missing_fields, last_ai_generated_at}`
6. Call `/embed-products` with `{table:'prep_recipes', rowId}` for embedding generation
7. Invalidate react-query cache for `useSupabaseRecipes`
8. Navigate to `/recipes` with the new recipe selected
9. Success toast: "Recipe published!"

**Save Draft** (wires up [Save Draft] button):
- Saves current draft_data to ingestion_sessions
- Status stays 'drafting'
- Toast: "Draft saved"

**Edit Existing Products**:
- Add "Edit" pencil button (admin-only) to `RecipeCardView.tsx`
- On click: create ingestion session with `ingestion_method='edit'`, `editing_product_id=recipe.id`, `draft_data` pre-filled from product row
- Redirect to `/admin/ingest` with session loaded
- On publish: UPDATE existing row instead of INSERT, bump `version` column

**IngestDashboard** (minimal):
- List of recent sessions at the top of IngestPage (collapsible section)
- Each row: product name, type badge, status badge, last edited time, "Resume" button
- Clicking "Resume" loads that session

**Test**: Full flow: chat -> AI builds recipe -> edit in editor -> publish -> recipe appears in viewer -> search finds it -> edit button on card -> opens editor pre-filled -> modify -> re-publish.

---

### Phase 3: All Product Types + Voice + Upload

**Goal**: Expand beyond prep recipes, add voice and file/image upload.

**All 6 Product Types**:
- Schema-aware prompts seeded for all 6 tables
- Product-type-specific editor configs:
  - `plate_specs`: components (with prep_recipe refs), assembly procedure, allergens
  - `foh_plate_specs`: descriptions, flavor profile, allergens, upsell notes
  - `wines`: producer, region, vintage, varietal, style, body, tasting notes
  - `cocktails`: style, glass, text ingredients, procedure
  - `beer_liquor_list`: category, subcategory, producer, style, description
- All product type pills active in navbar

**WebRTC Voice Mode**:
- New `realtime-session` prompt variant: `voice-action-ingest-{table}`
- New tool: `update_product_draft` (updates object sent to `/ingest`)
- Client-side handler in `useRealtimeWebRTC` intercepts tool call -> calls `/ingest` -> result back via data channel
- Voice button in ChatIngestionPanel activates WebRTC mode
- Draft preview updates live during voice conversation

**File Upload**:
- Storage bucket migration (`product-assets`, 10MB, admin upload)
- `/ingest-file` edge function: client uploads to storage first, then edge function downloads + parses
  - PDF: `pdf-parse` via esm.sh `?bundle`
  - Excel: SheetJS via esm.sh
  - DOCX: ZIP parse + extract XML (no Mammoth)
  - TXT: direct extraction
- `FileUploadZone.tsx` component in "Upload File" tab
- `use-file-upload.ts` hook

**Image Upload**:
- `/ingest-vision` edge function: GPT-4o with base64 image + schema prompt
- `ImageUploadZone.tsx` with mobile camera button
- `use-image-upload.ts` hook

**Sub-Recipe Linking**:
- `sub_recipe_links` table migration (UUIDs, CHECK constraints, link_type enum)
- `SubRecipeLinker.tsx` component: search existing prep_recipes, link as chips
- `search_existing_recipes` tool added to chat mode

---

### Phase 4: Translation + Web Enrichment + DnD Desktop

**Goal**: Bilingual support, web search for beverages, desktop DnD enhancement.

**Translation**:
- `product_translations` table migration (content-hash addressed: md5(source_text))
- `/ingest-translate` edge function (gpt-4o-mini, temperature 0.2)
- `TranslationPanel.tsx`: per-field checkboxes, "Translate Selected" button
- Default: procedure + notes auto-translate before publish

**Web Enrichment**:
- `/ingest-enrich` edge function (OpenAI Responses API + web_search_preview)
- `EnrichmentButton.tsx` on wine/cocktail/beer editors
- Suggestions UI: accept/reject per field

**Desktop DnD** (enhancement, not required for mobile):
- Add `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- IngredientsEditor + ProcedureEditor: DnD on desktop (>768px), arrow buttons on mobile
- Cross-group drag for moving items between groups

---

### Phase 5: Auto-Build Dish Guide + Polish

**Goal**: Complete ecosystem, polish.

- Auto-build FOH dish guide from plate spec + linked prep recipes
- Batch editor (editable multipliers, custom amounts, exceptions)
- Image gallery editor (upload, reorder, delete, set primary)
- Dashboard filters, search, analytics
- Loading skeletons, error handling, retry buttons
- Keyboard shortcuts (Ctrl+S save, Escape close)
- Accessibility: ARIA labels, focus management

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build order** | UX first, wire later | Validate chef experience before investing in backend |
| No wizard | Single page, pills + method tabs | Zero extra taps to start |
| Mobile reorder | Arrow buttons (up/down) | Reliable in kitchen. DnD desktop-only (Phase 4). |
| Draft state (Phase 1) | React context + reducer | Fast iteration, no backend dependency |
| Draft persistence (Phase 2) | JSONB in `ingestion_sessions.draft_data` | One session = one draft, matches target table schema |
| Draft concurrency | `draft_version` optimistic locking | 5-second debounced auto-save |
| Translation keying | `md5(source_text)` hash | Stable across reordering |
| sub_recipe_links | UUIDs, CHECK constraints, link_type enum | Proper FKs, reverse lookups |
| Edge function split | `/ingest`, `/ingest-translate`, `/ingest-enrich`, `/ingest-file`, `/ingest-vision` | Different API formats, model params |
| File upload | Client -> Storage -> edge function downloads | Avoids 6MB request body limit |
| DOCX parsing | ZIP + extract XML | Mammoth unreliable in Deno |
| Voice | Full WebRTC, `update_product_draft` tool | Tool call -> `/ingest` -> result via data channel |
| Edit existing | Same editor, `ingestion_method='edit'` | UPDATE on publish instead of INSERT |

---

## Critical Files to Reference

| File | Why |
|------|-----|
| `src/components/recipes/RecipeGrid.tsx` | Filter pill pattern for product type navbar |
| `src/components/recipes/RecipeCardView.tsx` | Existing recipe display to match in preview mode |
| `src/components/recipes/IngredientsColumn.tsx` | Ingredient display pattern to reuse in preview |
| `src/components/recipes/ProcedureColumn.tsx` | Procedure display pattern to reuse in preview |
| `src/components/recipes/BatchSizeSelector.tsx` | Batch UI to reuse in preview |
| `src/components/ui/voice-chat-input.tsx` | Text input pattern for chat |
| `src/components/ui/tabs.tsx` | shadcn Tabs for method tabs + mobile modes |
| `src/components/ui/accordion.tsx` | shadcn Accordion for editor sections |
| `src/components/layout/AppShell.tsx` | Page shell with aiPanel for desktop split |
| `src/pages/Ask.tsx` | Chat page layout pattern |
| `src/types/products.ts` | PrepRecipe, RecipeIngredientGroup, RecipeProcedureGroup interfaces |
| `supabase/functions/ask/index.ts` | Auth pattern, CORS, tool-use loops for edge function |
| `supabase/functions/embed-products/index.ts` | Text builders, single-row embedding |
| `supabase/functions/realtime-session/index.ts` | Prompt variants, tool definitions for voice |
| `supabase/migrations/20260210170132_create_product_tables.sql` | Full schema, JSONB contracts |

---

## Phase 1A Files (First Implementation)

```
NEW:
  src/pages/IngestPage.tsx
  src/types/ingestion.ts
  src/components/ingest/ProductTypeNavbar.tsx
  src/components/ingest/MethodTabs.tsx
  src/components/ingest/ChatIngestionPanel.tsx
  src/components/ingest/DraftPreviewCard.tsx
  src/components/ingest/MobileModeTabs.tsx

MODIFIED:
  src/App.tsx                    (add /admin/ingest route)
  src/components/layout/Sidebar.tsx  (add Ingest nav link for admin)
```

## Verification

### Phase 1A Test
1. Login as admin -> sidebar shows "Ingest" link
2. Navigate to `/admin/ingest` -> "Prep Recipe" pill selected, chat visible
3. Type message -> appears in chat list
4. Mock AI response with read-only draft preview card appears
5. Switch to Edit mode via segment control
6. On mobile: segment control switches between Chat/Preview/Edit
7. On desktop: responsive layout adjusts appropriately

### Phase 1B Test
1. Switch to Edit mode -> see full accordion editor
2. Add ingredient group "Base" -> add items (qty, unit, name)
3. Reorder items with arrow buttons -> order updates
4. Add procedure group "Cook" -> add steps
5. Toggle a step as "critical" -> red border appears
6. Switch to Preview -> see recipe rendered like existing viewer
7. Switch between product type pills -> draft saved locally, dot indicator shows
