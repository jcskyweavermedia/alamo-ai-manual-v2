Here is Claude's plan:                                                                                     
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Data Ingestion System - Implementation Plan

 First action after approval: Copy this plan to docs/plans/data-ingestion/README.md in the project repo.    

 Context

 The Alamo Prime restaurant app currently has 6 product tables (prep_recipes, plate_specs, foh_plate_specs, 
  wines, cocktails, beer_liquor_list) with 44 seeded rows, read-only viewers, and AI-powered Q&A. There is  
 no way to create or edit products through the app. All data was loaded via SQL migrations.

 This plan adds a full AI-powered data ingestion system that lets admins:
 - Create new products through conversation, file upload, or image upload
 - Edit existing published products through the same structured editor
 - Use a drag-and-drop editor for refinement before publishing
 - Use full WebRTC realtime voice conversations with the AI to build products
 - Access everything via a sidebar nav item (admin-only)

 ---
 Architecture Overview

 Admin UI (/admin/ingest)
   |
   +-- IngestDashboard (recent drafts, "New Product" button)
   +-- IngestWizard (pick product type + ingestion method)
   +-- IngestSession (split: ingestion input + live editor/preview)
   +-- Product "Edit" button on each CardView (admin only) → opens editor pre-filled
         |
         +-- ChatIngestionPanel (conversation to build product)
         +-- FileUploadZone (PDF, Excel, Word, TXT)
         +-- ImageUploadZone (photo → AI vision extraction)
         +-- ProductEditor (structured DnD editor)
               +-- IngredientsEditor (drag-and-drop grouped ingredients)
               +-- ProcedureEditor (drag-and-drop grouped steps)
               +-- BatchEditor (batch multiplier controls)
               +-- SubRecipeLinker (search + link prep_recipes)
               +-- TranslationPanel (EN/ES per-field control)
               +-- ImageGalleryEditor (upload/manage images)
         +-- ReviewPanel → Save → Embed → Publish

 ---
 Phase 1: Database Foundation + Session Management

 New Tables (Migration: create_ingestion_tables.sql)

 ingestion_sessions - Tracks each ingestion attempt
 - id UUID PK, product_table TEXT, ingestion_method TEXT (chat/file/image/manual)
 - status TEXT (drafting/reviewing/published/abandoned)
 - draft_data JSONB (matches target table schema exactly)
 - product_id UUID (set when published to real table)
 - ai_confidence NUMERIC, missing_fields TEXT[]
 - source_file_name TEXT, source_file_type TEXT
 - created_by UUID, timestamps

 ingestion_messages - Chat history for conversational ingestion
 - id UUID PK, session_id UUID FK→ingestion_sessions
 - role TEXT (user/assistant/system), content TEXT
 - draft_updates JSONB (structured changes the AI applied)
 - tool_calls JSONB, created_at

 sub_recipe_links - Many-to-many recipe linkage
 - parent_table TEXT, parent_id UUID, child_table TEXT, child_id UUID
 - context TEXT (where in the parent this sub-recipe is used)
 - UNIQUE constraint on (parent_table, parent_id, child_table, child_id)

 product_translations - Per-field translation overlay
 - product_table TEXT, product_id UUID, field_path TEXT
 - source_lang/translated_lang, source_text/translated_text
 - is_approved BOOLEAN, approved_by UUID

 Storage Bucket

 - product-assets bucket for images + uploaded files (10MB limit)
 - Admin upload, authenticated read

 Schema Modifications

 - Add source_session_id UUID FK to all 6 product tables (optional link to ingestion session)

 RLS Policies

 - Admin-only CRUD on all new tables (same pattern as existing product tables)

 Frontend (Phase 1)

 - src/types/ingestion.ts - TypeScript interfaces
 - src/hooks/use-ingestion-session.ts - Core session hook (CRUD)
 - src/pages/IngestDashboard.tsx - Session list with status badges
 - src/pages/IngestWizard.tsx - Product type + method picker
 - Routes: /admin/ingest, /admin/ingest/new, /admin/ingest/:sessionId, /admin/ingest/edit/:table/:id        

 Edit Existing Products

 - Add "Edit" button (admin-only, pencil icon) to all 5 CardView components
 - Edit button creates a new ingestion session with ingestion_method: 'edit'
 - Pre-fills draft_data from the existing product row
 - Same editor UI, but on publish → UPDATE instead of INSERT

 ---
 Phase 2: /ingest Edge Function - Text Structuring + Chat

 New Edge Function: supabase/functions/ingest/index.ts

 Mode: structure - Raw text → structured product JSON
 - Receives raw text + target product_table
 - Uses schema-aware prompt per table with response_format: { type: "json_schema" }
 - Returns structured data matching the target table's JSONB contracts

 Mode: chat - Multi-turn conversation
 - Loads history from ingestion_messages
 - OpenAI with tool calling:
   - update_draft - AI updates specific fields on the draft
   - search_recipes - Search existing prep_recipes for sub-recipe linking
   - search_products - Search any product table to avoid duplicates
 - Each AI response: conversational reply + draft_updates JSONB
 - Auto-saves draft to ingestion_sessions.draft_data

 AI Model: gpt-4o-mini (consistent with existing functions)
 Auth: Same pattern as /ask (verify_jwt=false, manual auth, service role for DB)

 AI Prompts (seeded into ai_prompts table)

 - ingest-system-{table} per product table (schema-aware structuring prompts)
 - ingest-chat-system for conversation mode

 Frontend (Phase 2)

 - src/components/ingest/ChatIngestionPanel.tsx - Chat UI with message list, text input, and full WebRTC    
 voice mode
   - Text mode: Type/paste text → send as chat message
   - Voice mode: Full duplex WebRTC conversation via GPT-4o Realtime (reuses existing useRealtimeWebRTC     
 hook + /realtime-session edge function)
   - Voice mode needs a new realtime-session prompt variant for ingestion context (AI knows it's building a 
  product, can call update_draft tool)
   - New /realtime-voice tool definition: update_product_draft so the voice AI can update fields during     
 conversation
 - src/components/ingest/DraftPreview.tsx - Read-only preview of current draft (updates live as voice AI    
 modifies draft)
 - src/pages/IngestSession.tsx - Split layout: input left, preview right (mobile: tabs)

 ---
 Phase 3: File Upload + Image Upload

 New Edge Function: supabase/functions/ingest-file/index.ts

 - Receives file via multipart/form-data
 - PDF: pdf-parse via esm.sh → extract text
 - Excel (.xlsx): SheetJS via esm.sh → parse to JSON rows
 - Word (.docx): Mammoth via esm.sh → plain text
 - TXT: Direct text extraction
 - After extracting text, calls same structuring logic as /ingest mode structure

 New Edge Function: supabase/functions/ingest-vision/index.ts

 - Receives image via multipart/form-data
 - Sends base64 image to GPT-4o (full model, not mini - vision quality matters)
 - Schema-aware prompt → structured product JSON directly from image

 Frontend (Phase 3)

 - src/hooks/use-file-upload.ts - File validation, upload to storage, call edge function
 - src/hooks/use-image-upload.ts - Image preview, upload, call vision
 - src/components/ingest/FileUploadZone.tsx - Drag-and-drop zone with type badges
 - src/components/ingest/ImageUploadZone.tsx - Image upload with mobile camera button

 ---
 Phase 4: Product Editor with Drag-and-Drop

 New Dependency: @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities

 - Touch-friendly, React-native, lightweight (~12KB gzipped)
 - Works with shadcn/ui cards

 Hooks

 - src/hooks/use-ingredient-editor.ts - Reducer-based state: ADD/REMOVE/REORDER groups,
 ADD/UPDATE/REMOVE/MOVE items between groups
 - src/hooks/use-procedure-editor.ts - Same pattern for procedure steps

 Components (src/components/ingest/editor/)
 ┌─────────────────────────┬───────────────────────────────────────────────────────────────┐
 │        Component        │                            Purpose                            │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ ProductEditor.tsx       │ Master editor, renders fields based on product table config   │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ IngredientsEditor.tsx   │ DnD sortable ingredient groups                                │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ IngredientGroupCard.tsx │ Collapsible group with drag handle                            │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ IngredientItemRow.tsx   │ Inline-editable: qty, unit, name, allergens, sub-recipe badge │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ ProcedureEditor.tsx     │ DnD sortable procedure groups                                 │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ ProcedureGroupCard.tsx  │ Collapsible group with drag handle                            │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ ProcedureStepRow.tsx    │ Inline-editable: instruction, critical toggle                 │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ MetadataFields.tsx      │ Name, slug (auto-gen), type/category, tags, status            │
 ├─────────────────────────┼───────────────────────────────────────────────────────────────┤
 │ TagEditor.tsx           │ Chip-based tag input                                          │
 └─────────────────────────┴───────────────────────────────────────────────────────────────┘
 Product-Specific Editor Configs

 Each product table renders different editor sections:
 - prep_recipes: metadata, ingredients, procedure, batchScaling, trainingNotes, images, translation
 - plate_specs: metadata, components (with prep_recipe refs), assembly procedure, notes, images,
 translation, auto-build dish guide
 - foh_plate_specs: metadata, descriptions, ingredients list, flavor profile, allergens, image
 - wines: metadata (producer, region, vintage, varietal, style, body), tasting notes, producer notes, web   
 enrich
 - cocktails: metadata (style, glass), text ingredients, procedure, tasting notes, web enrich
 - beer_liquor_list: metadata (category, subcategory, producer, country, style), description, web enrich    

 ---
 Phase 5: Sub-Recipe Linking + Image Gallery + Batch Editor

 - SubRecipeLinker.tsx - Search existing prep_recipes by name, link as chips, writes to sub_recipe_links    
 table
 - ImageGalleryEditor.tsx - Upload to Supabase storage, reorder thumbnails, delete, set primary
 - BatchEditor.tsx - Editable batch multipliers (0.5x, 1x, 1.5x, 2x, 3x), custom multipliers, notes,        
 exceptions per batch size

 ---
 Phase 6: Translation System

 - TranslationPanel.tsx - Per-field checkboxes, "Translate Selected" button, preview translations
 - Default translatable: procedure steps + notes (for prep_recipes/plate_specs)
 - Chef controls which fields to translate before saving
 - Add translate mode to /ingest edge function (uses gpt-4o-mini)
 - Translations stored in product_translations table (overlay approach, no schema changes)

 ---
 Phase 7: Web Search Enrichment

 - Add enrich mode to /ingest edge function
 - Uses OpenAI Responses API with web_search_preview tool (keeps dependencies minimal)
 - EnrichmentButton.tsx on wine/cocktail/beer editors - "Search Web for Details"
 - Shows enrichment suggestions per field, admin accepts/rejects each
 - Especially valuable for: wine tasting notes + producer notes, cocktail history/description, beer/liquor  
 style descriptions

 ---
 Phase 8: Auto-Build Dish Guide from Plate Spec

 - AutoBuildDishGuide.tsx - Button on plate spec editor: "Generate Dish Guide"
 - AI reads plate spec + all linked prep_recipes
 - Generates: allergens (aggregated), descriptions, flavor profile, upsell notes, key ingredients
 - Creates foh_plate_specs draft linked via plate_spec_id FK
 - Records source recipes in sub_recipe_links for traceability

 ---
 Phase 9: Save/Publish Pipeline + Embedding

 1. Validate required fields
 2. Auto-generate slug from name
 3. INSERT into real product table (status = 'published')
 4. Update ingestion_sessions.product_id + status = 'published'
 5. Call /embed-products with { table, rowId } for embedding generation
 6. Set ai_ingestion_meta with source info
 7. Write sub_recipe_links records
 8. Write product_translations records
 9. Invalidate react-query cache
 10. Auto-save draft every 30 seconds for recovery

 ---
 Phase 10: Polish + Mobile UX

 - Mobile: tabbed layout (Input | Preview | Editor) instead of side-by-side
 - Loading states: skeletons for AI processing, file parsing, image analysis
 - Error handling: retry buttons, save-and-resume on failure
 - Dashboard: filter by status/type, search sessions
 - Sidebar nav: "Ingest" link for admin users
 - Keyboard: Ctrl+S save draft, Escape close panels

 ---
 Key Technical Decisions
 Decision: Voice mode
 Choice: Full WebRTC via GPT-4o Realtime
 Rationale: Immersive chef experience; reuses existing realtime infrastructure
 ────────────────────────────────────────
 Decision: Edit support
 Choice: Create + Edit via same editor
 Rationale: "Edit" button on CardViews, pre-fills draft from existing product
 ────────────────────────────────────────
 Decision: Navigation
 Choice: Sidebar nav item (admin-only)
 Rationale: Consistent with existing app navigation
 ────────────────────────────────────────
 Decision: Draft storage
 Choice: JSONB in ingestion_sessions.draft_data
 Rationale: One session = one draft, schema matches target table
 ────────────────────────────────────────
 Decision: File processing
 Choice: Server-side (edge functions)
 Rationale: Avoids large client bundles, works on mobile
 ────────────────────────────────────────
 Decision: Translation
 Choice: Separate product_translations table
 Rationale: Avoids schema bloat, supports future languages
 ────────────────────────────────────────
 Decision: Web search
 Choice: OpenAI Responses API with web_search_preview
 Rationale: Minimal new dependencies
 ────────────────────────────────────────
 Decision: DnD library
 Choice: @dnd-kit
 Rationale: Touch-friendly, React-native, lightweight, works with shadcn
 ────────────────────────────────────────
 Decision: Vision model
 Choice: GPT-4o (full)
 Rationale: Vision quality matters for recipe cards/labels
 ────────────────────────────────────────
 Decision: Chat/structure model
 Choice: gpt-4o-mini
 Rationale: Consistent with existing functions, fast, cheap
 ────────────────────────────────────────
 Decision: Embedding
 Choice: Reuse existing /embed-products
 Rationale: Centralized, already tested
 ---
 Critical Files to Reference During Implementation
 File: supabase/functions/ask/index.ts
 Why: Auth pattern, CORS, OpenAI calls, tool-use loops
 ────────────────────────────────────────
 File: supabase/functions/embed-products/index.ts
 Why: Text builders per table, embedding pipeline
 ────────────────────────────────────────
 File: src/types/products.ts
 Why: Product type interfaces the editor must match
 ────────────────────────────────────────
 File: supabase/migrations/20260210170132_create_product_tables.sql
 Why: Full schema, JSONB contracts, trigger patterns
 ────────────────────────────────────────
 File: src/hooks/use-ask-product.ts
 Why: Pattern for edge function calls from frontend
 ────────────────────────────────────────
 File: src/components/recipes/RecipeCardView.tsx
 Why: Existing ingredient/procedure display to match visually
 ────────────────────────────────────────
 File: src/components/manual/AskAboutContent.tsx
 Why: Existing chat UI pattern to follow
 ---
 New Files Summary

 Edge Functions (3): ingest/index.ts, ingest-file/index.ts, ingest-vision/index.ts
 Migrations (5): ingestion tables, RLS, storage bucket, source_session_id, AI prompts
 Types (1): src/types/ingestion.ts
 Hooks (5): use-ingestion-session, use-file-upload, use-image-upload, use-ingredient-editor,
 use-procedure-editor
 Pages (3): IngestDashboard, IngestWizard, IngestSession
 Components (20+): Ingestion UI (7) + Editor (13+)
 Config updates: App.tsx routes, Sidebar nav, package.json deps