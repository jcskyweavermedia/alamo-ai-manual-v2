Phase 3F: Two-Call Pipeline Refactor

 Date: 2026-02-20
 Status: Plan
 Scope: Prep recipes only (other product types follow same pattern later)

 ---
 Context

 The current ingestion system has two AI modes: structure (forced JSON Schema, guarantees draft) and chat   
 (tool-calling with update_draft, unreliable). The chat mode bug — AI skips calling update_draft, returning 
  draft: null — has been patched twice and still fails. The root cause is architectural: relying on the AI  
 to voluntarily call a tool is unreliable with tool_choice: "auto".

 New architecture: Every message goes through a two-call pipeline:
 1. Call 1 — Chat (gpt-5.2): AI converses freely with search tools. No update_draft.
 2. Call 2 — Extract (gpt-5-mini-2025-08-07): Reads the exchange, returns structured JSON via forced        
 schema. Deterministic.

 ---
 Implementation Phases

 Phase 1: Database Migration

 New file: supabase/migrations/YYYYMMDD_ingest_pipeline_prompts.sql

 1. Insert ingest-chat-prep-recipe prompt (Call 1 system prompt)
   - Bilingual EN/ES, category='system', domain=NULL
   - Describes conversational role, available tools (search_recipes, search_products, web_search)
   - Web search rule: "NEVER use web_search without first asking the user for permission"
   - No mention of update_draft or JSON Schema
   - Knows current draft state (appended at runtime)
 2. Insert ingest-extract-prep-recipe prompt (Call 2 system prompt)
   - Bilingual EN/ES
   - Instructions: read exchange, merge new recipe data into current draft
   - Rules: preserve existing data, group ingredients/procedure, mark critical steps, infer allergens       
   - Output: { has_updates: boolean, draft: PrepRecipeDraft }
 3. Deactivate old prompts: ingest-chat-system, ingest-prep-recipe → is_active = false

 Phase 2: Edge Function Refactor

 Modify: supabase/functions/ingest/index.ts

 Remove

 - handleStructure() function
 - handleChat() function
 - CHAT_TOOLS array (replaced by PIPELINE_TOOLS)
 - deepMerge() helper (no longer needed — Call 2 returns full draft, not partials)
 - mode validation (accept but ignore for backward compat)

 Add

 - PIPELINE_TOOLS array: search_recipes + search_products + web_search (OpenAI built-in). No update_draft.  
 - EXTRACT_RESPONSE_SCHEMA: wraps existing PREP_RECIPE_DRAFT_SCHEMA with has_updates: boolean
 - handlePipeline() — single function replacing both old handlers:

 handlePipeline flow:
   1. Load or create session (same as current handleChat)
   2. Load message history (last 20)
   3. Fetch chat prompt: slug = 'ingest-chat-prep-recipe'
      - Append current draft state to system prompt
   4. Save user message to ingestion_messages

   5. CALL 1 — Chat (gpt-5.2, tools: PIPELINE_TOOLS, tool_choice: "auto")
      - Tool loop (max 3 rounds) for search_recipes, search_products
      - web_search is server-executed by OpenAI (no local handling)
      - Extract final text: call1Text

   6. Save call1Text to ingestion_messages

   7. CALL 2 — Extract (gpt-5-mini-2025-08-07, json_schema forced)
      - Fetch extract prompt: slug = 'ingest-extract-prep-recipe'
      - Input: "CURRENT DRAFT:\n{json}\n\nUSER MESSAGE:\n{content}\n\nASSISTANT RESPONSE:\n{call1Text}"     
      - Response: { has_updates, draft }

   8. If has_updates === true:
      - currentDraft = extractResult.draft
      - Add slug, images fields
      - Save to ingestion_sessions (bump draft_version)
      - Save extraction message to ingestion_messages

   9. Return { sessionId, message: call1Text, draft, confidence, missingFields }

 Update main handler

 // Replace mode dispatch with single call:
 return await handlePipeline(supabase, userId, body, openaiApiKey);

 Phase 3: Frontend Hook Simplification

 Modify: src/hooks/use-ingest-chat.ts

 - Remove structureText() method entirely
 - Remove StructureResult type
 - Merge confidence and missingFields into ChatResult
 - Keep only sendMessage(content, sessionId?) → ChatResult | null
 - Remove mode from request body (backend ignores it)

 Updated interface:
 export interface UseIngestChatReturn {
   sendMessage: (content: string, sessionId?: string) => Promise<ChatResult | null>;
   isProcessing: boolean;
   error: string | null;
 }

 Phase 4: Frontend Page Simplification

 Modify: src/pages/IngestPage.tsx

 - Remove hasDraftContent check and mode branching
 - Replace with single call: await sendMessage(content, currentSessionId || undefined)
 - Remove structureText from hook destructuring
 - Remove state.draft from dependency array (no longer needed for routing)

 ---
 Key Design Decisions
 Decision: How does Call 2 signal "no update"?
 Choice: has_updates: boolean in schema
 Rationale: Simpler than diffing two full drafts
 ────────────────────────────────────────
 Decision: What context does Call 2 receive?
 Choice: Latest exchange only + current draft
 Rationale: Full history is unnecessary; keeps tokens low
 ────────────────────────────────────────
 Decision: Web search permission flow
 Choice: AI asks in text, user approves next turn
 Rationale: No special UI needed; prompt-enforced
 ────────────────────────────────────────
 Decision: Prompts stored where?
 Choice: ai_prompts table (slug lookup)
 Rationale: Easy to update without redeploying; extensible to other product types
 ────────────────────────────────────────
 Decision: Remove old handlers?
 Choice: Yes, fully replace
 Rationale: Old code is the bug source; keeping it adds confusion
 ────────────────────────────────────────
 Decision: Call 2 model
 Choice: gpt-5-mini-2025-08-07
 Rationale: Fast, cheap, sufficient for extraction
 ---
 Files Changed
 File: supabase/migrations/YYYYMMDD_ingest_pipeline_prompts.sql
 Action: CREATE
 Description: 2 new prompt rows, deactivate 2 old
 ────────────────────────────────────────
 File: supabase/functions/ingest/index.ts
 Action: MODIFY
 Description: Replace 2 handlers with 1 pipeline; update tools; add extract schema
 ────────────────────────────────────────
 File: src/hooks/use-ingest-chat.ts
 Action: MODIFY
 Description: Remove structureText; single sendMessage method
 ────────────────────────────────────────
 File: src/pages/IngestPage.tsx
 Action: MODIFY
 Description: Remove mode routing; always sendMessage
 No changes to: ChatIngestionPanel, IngestDraftContext, IngestPreview, PrepRecipeEditor,
 types/ingestion.ts, use-ingestion-session.ts

 ---
 Backward Compatibility

 - Edge function still accepts mode field (ignores it) — old frontend versions won't break
 - Response shape { sessionId, message, draft, confidence, missingFields } is unchanged
 - Database tables ingestion_sessions and ingestion_messages are unchanged
 - Deploy order: migration → edge function → frontend (each step is independently safe)

 ---
 Verification

 1. TypeScript check: npx tsc --noEmit — 0 errors
 2. Deploy edge function: npx supabase functions deploy ingest
 3. Push migration: npx supabase db push
 4. Test — first message: Type a recipe description → verify draft appears in preview
 5. Test — follow-up: Refine the recipe ("add garlic", "shelf life is 5 days") → verify draft updates       
 6. Test — no-update message: Send "hello" or "what tools do you have?" → verify draft stays unchanged      
 7. Test — search: Mention "chimichurri" → verify AI references existing recipes
 8. Test — web search: Ask about a technique → verify AI asks permission before searching
 9. Check edge function logs: MCP get_logs for 200 status codes on both calls
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌