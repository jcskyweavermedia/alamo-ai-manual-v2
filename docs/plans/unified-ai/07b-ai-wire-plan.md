╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Phase 7B: Unified Product Chatbot

 Context

 The 5 minimal AI sheet components (DishAISheet, WineAISheet, etc.) have a critical bug and a UX gap:

 1. Bug: The "questions" action sends action: 'questions' which triggers ACTION MODE in the edge function, using   
 the template "List 4-5 common guest questions..." instead of the user's typed question. The user's freeform       
 question is completely ignored.
 2. UX gap: The minimal sheets (text input + flat response) lack voice input, TTS output, conversation mode, and   
 chat history — all features that already exist in the main /ask chatbot page.

 Goal: Replace all 5 AI sheets with a single rich chatbot component that reuses existing components
 (VoiceChatInput, AIAnswerCard, VoiceTranscript, VoiceModeButton) and routes each action to the correct mode.      

 Architecture Decision

 Use /ask as the unified backend (not /ask-product) because it already has:
 - DB-driven prompts from ai_prompts table (slug: action-{domain}-{action})
 - Chat sessions + message history (chat_sessions + chat_messages tables)
 - 3-round tool calling loop with all 6 search tools
 - All 6 domains (manual + 5 products)
 - itemContext + action parameters already accepted
 - Pairing enrichment for food pairing actions
 - Off-topic detection

 The /ask-product function becomes legacy (keep, don't touch).

 Mode Routing

 Each action maps to one of three modes:
 Mode: conversation
 Actions: practicePitch, explainToGuest (wines/cocktails), quizMe
 Behavior: WebRTC voice. AI speaks first ("Sell me the [item]!"). Interactive back-and-forth.
 ────────────────────────────────────────
 Mode: tts
 Actions: samplePitch, wineDetails, teachMe, foodPairings, suggestPairing
 Behavior: Call /ask for text → call new /tts for audio → auto-play. Show text + audio indicator.
 ────────────────────────────────────────
 Mode: chat
 Actions: questions (all domains)
 Behavior: Text + mic input. User types/speaks freely. No action sent — uses search mode so user's question is     
   actually answered.
 After any initial response, the chatbot stays open for follow-up via text input.

 ---
 Implementation Steps (Dependency Order)

 Step 1: Action config metadata

 Create src/data/ai-action-config.ts

 Centralize all 18 actions with mode metadata:
 export type AIActionMode = 'tts' | 'conversation' | 'chat';

 export interface AIActionConfig {
   key: string;
   label: string;
   labelEs: string;
   icon: string;
   mode: AIActionMode;
   autoTrigger: boolean; // true = AI responds immediately
 }

 export const PRODUCT_AI_ACTIONS: Record<string, AIActionConfig[]> = {
   dishes: [
     { key: 'practicePitch', label: 'Practice a pitch', labelEs: 'Practica un pitch', icon: 'mic', mode:
 'conversation', autoTrigger: true },
     { key: 'samplePitch', label: 'Hear a sample pitch', labelEs: 'Escucha un pitch', icon: 'play', mode: 'tts',   
 autoTrigger: true },
     { key: 'teachMe', label: 'Teach Me', labelEs: 'Ensenname', icon: 'graduation-cap', mode: 'tts', autoTrigger:  
 true },
     { key: 'questions', label: 'Have any questions?', labelEs: 'Tienes preguntas?', icon: 'help-circle', mode:    
 'chat', autoTrigger: false },
   ],
   wines: [ /* explainToGuest→conversation, wineDetails→tts, foodPairings→tts, questions→chat */ ],
   cocktails: [ /* explainToGuest→conversation, samplePitch→tts, foodPairings→tts, questions→chat */ ],
   recipes: [ /* teachMe→tts, quizMe→conversation, questions→chat */ ],
   beer_liquor: [ /* teachMe→tts, suggestPairing→tts, questions→chat */ ],
 };

 export function getActionConfig(domain: string, key: string): AIActionConfig | undefined;

 Dependencies: None

 ---
 Step 2: Extend useAskAI hook

 Modify src/hooks/use-ask-ai.ts

 Add product fields to AskOptions:
 export interface AskOptions {
   expand?: boolean;
   context?: { sectionId?: string; sectionTitle?: string };
   // NEW: Product AI fields (already accepted by /ask backend)
   domain?: string;
   action?: string;
   itemContext?: Record<string, unknown>;
   sessionId?: string;
 }

 Pass these in the request body to /ask. Add sessionId and mode to AskResult.

 Dependencies: None

 ---
 Step 3: Fix /ask search mode — include itemContext

 Modify supabase/functions/ask/index.ts (~line 958)

 When itemContext is provided but no action (search/chat mode), serialize the item context and append to the       
 system prompt:
 // After existing system prompt assembly, before joining:
 if (!isActionMode && itemContext) {
   const contextText = serializeItemContext(domain, itemContext);
   systemParts.push(
     `The user is currently viewing this item:\n${contextText}\nUse this context to answer their question. Search  
 for additional information only if needed.`
   );
 }

 This fixes the "questions" bug by design — freeform questions will be sent WITHOUT action, entering search mode,  
 but WITH itemContext so the AI knows what item the user is viewing.

 Dependencies: None

 ---
 Step 4: Create /tts edge function

 Create supabase/functions/tts/index.ts

 Simple function: text in, audio out.
 - Auth: manual JWT verification (same pattern as /ask)
 - Validate text is non-empty and < 4096 chars
 - Call OpenAI POST /v1/audio/speech with { model: 'tts-1', input: text, voice: 'cedar', response_format: 'mp3' }  
 - Stream MP3 binary back with Content-Type: audio/mpeg
 - No usage increment (already counted by /ask call)
 - verify_jwt: false (manual auth)

 Dependencies: None

 ---
 Step 5: Create useTTS hook

 Create src/hooks/use-tts.ts

 Simple hook for text-to-speech playback:
 interface UseTTSReturn {
   speak: (text: string) => Promise<void>;
   stop: () => void;
   isPlaying: boolean;
   isGenerating: boolean;
   error: string | null;
 }

 Internally: calls /tts edge function, creates Blob → URL.createObjectURL → plays via HTMLAudioElement. Cleanup on 
  unmount.

 Dependencies: Step 4

 ---
 Step 6: Enhance /realtime-session for product context

 Modify supabase/functions/realtime-session/index.ts

 Accept new optional fields: domain, action, itemContext.

 When present:
 1. Load action prompt from ai_prompts table (slug: voice-action-{domain}-{action}, fall back to
 action-{domain}-{action})
 2. Serialize item context using existing serializeItemContext() (port/import from /ask)
 3. Build instructions: [base-persona] + [domain prompt] + [action prompt] + [serialized item context]
 4. Register product search tools (search_dishes, search_wines, etc.) alongside search_handbook in session config  

 When absent: keep existing behavior (loads from routing_prompts table).

 Dependencies: Step 7 (DB migration for voice prompts)

 ---
 Step 7: Database migration — voice action prompts

 Create migration supabase/migrations/YYYYMMDD_HHMMSS_add_voice_action_prompts.sql

 Insert conversation-mode prompts optimized for spoken interaction:
 - voice-action-dishes-practicePitch: "The user wants to practice pitching this dish. Open with 'Alright, sell me  
 the [dish name]! Go ahead!' Then evaluate their pitch..."
 - voice-action-wines-explainToGuest: "Open with 'I'm a guest who just asked about this wine. Tell me about it!'   
 Listen and give feedback..."
 - voice-action-cocktails-explainToGuest: Similar for cocktails
 - voice-action-recipes-quizMe: "Quiz the user about this recipe. Ask ONE question at a time. Wait for answer. 5   
 questions total, then score."

 All with category: 'voice', voice: 'cedar', bilingual EN/ES.

 Dependencies: None

 ---
 Step 8: Enhance /realtime-search for product tools

 Modify supabase/functions/realtime-search/index.ts

 Accept tool parameter in request body. Route to corresponding PG RPC function:
 - search_handbook → existing manual search (default)
 - search_dishes, search_wines, search_cocktails, search_recipes, search_beer_liquor → call matching RPC with      
 embedding + FTS

 Dependencies: None

 ---
 Step 9: Extend useRealtimeWebRTC hook

 Modify src/hooks/use-realtime-webrtc.ts

 1. Accept optional domain, action, itemContext in options
 2. Pass them to /realtime-session in the connect request body
 3. Extend handleToolCall to dispatch product search tool names to /realtime-search with tool parameter

 Dependencies: Steps 6, 8

 ---
 Step 10: Create useProductChat composite hook

 Create src/hooks/use-product-chat.ts

 Orchestrates all three modes:
 interface UseProductChatOptions {
   domain: string;
   itemContext: Record<string, unknown>;
   itemName: string;
 }

 interface UseProductChatReturn {
   messages: ChatMessage[];
   isLoading: boolean;
   error: string | null;
   // TTS
   isPlaying: boolean;
   isGenerating: boolean;
   // Voice (WebRTC)
   voiceState: WebRTCVoiceState;
   voiceTranscript: TranscriptEntry[];
   // Actions
   startAction: (config: AIActionConfig) => Promise<void>;
   sendMessage: (text: string) => Promise<void>;
   stopAudio: () => void;
   connectVoice: () => Promise<void>;
   disconnectVoice: () => void;
   reset: () => void;
 }

 startAction(config) logic:
 - tts: Call useAskAI.ask(config.label, { domain, action: config.key, itemContext }) → get text → call
 useTTS.speak(text) → add to messages
 - conversation: Call useRealtimeWebRTC.connect({ domain, action: config.key, itemContext }) → AI speaks first →   
 user responds
 - chat: No auto-trigger. Wait for sendMessage().

 sendMessage(text) logic:
 - Call useAskAI.ask(text, { domain, itemContext }) — NO action sent → search mode with item context
 - Add user message + assistant response to messages

 Composes: useAskAI (Step 2), useTTS (Step 5), useRealtimeWebRTC (Step 9)

 Dependencies: Steps 2, 5, 9

 ---
 Step 11: Create ProductChatSheet component

 Create src/components/shared/ProductChatSheet.tsx

 Single unified component replacing all 5 AI sheets:
 interface ProductChatSheetProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   actionConfig: AIActionConfig | null;
   domain: string;
   itemName: string;
   itemContext: Record<string, unknown>;
 }

 Layout (bottom sheet, max 85vh):
 Header: [Action label] — [Item name]
 ─────────────────────────────────
 Body (scrollable):
   TTS mode: AIAnswerCard + audio indicator
   Conversation mode: VoiceTranscript + VoiceModeButton
   Chat mode: Message thread (user bubbles + AIAnswerCards)
 ─────────────────────────────────
 Footer:
   VoiceChatInput (text + mic)
   (shown in chat mode, or after TTS/conversation for follow-up)

 Reused existing components:
 - VoiceChatInput (src/components/ui/voice-chat-input.tsx)
 - AIAnswerCard (src/components/ui/ai-answer-card.tsx)
 - VoiceTranscript (src/components/manual/VoiceTranscript.tsx)
 - VoiceModeButton (src/components/ui/voice-mode-button.tsx)
 - Sheet from shadcn/ui

 Dependencies: Step 10

 ---
 Step 12: Update 5 CardView components + cleanup

 Modify 5 files:
 - src/components/dishes/DishCardView.tsx
 - src/components/wines/WineCardView.tsx
 - src/components/cocktails/CocktailCardView.tsx
 - src/components/recipes/RecipeCardView.tsx
 - src/components/beer-liquor/BeerLiquorCardView.tsx

 For each:
 1. Remove AI sheet import → import ProductChatSheet + PRODUCT_AI_ACTIONS + getActionConfig
 2. Replace activeAction state type to string | null
 3. Render action buttons from PRODUCT_AI_ACTIONS[domain]
 4. Replace AI sheet component:
 <ProductChatSheet
   open={activeAction !== null}
   onOpenChange={(open) => { if (!open) setActiveAction(null); }}
   actionConfig={activeAction ? getActionConfig(domain, activeAction) ?? null : null}
   domain={domain}
   itemName={item.name}
   itemContext={item as unknown as Record<string, unknown>}
 />

 Delete 5 old AI sheet files:
 - src/components/dishes/DishAISheet.tsx
 - src/components/wines/WineAISheet.tsx
 - src/components/cocktails/CocktailAISheet.tsx
 - src/components/recipes/RecipeAISheet.tsx
 - src/components/beer-liquor/BeerLiquorAISheet.tsx

 Dependencies: Step 11

 ---
 Parallel Execution Groups
 ┌───────┬──────────────────────────┬────────────────────────┐
 │ Group │          Steps           │ Can run simultaneously │
 ├───────┼──────────────────────────┼────────────────────────┤
 │ A     │ 1, 2, 3, 4, 7, 8         │ All independent        │
 ├───────┼──────────────────────────┼────────────────────────┤
 │ B     │ 5 (needs 4), 6 (needs 7) │ After group A          │
 ├───────┼──────────────────────────┼────────────────────────┤
 │ C     │ 9 (needs 6, 8)           │ After group B          │
 ├───────┼──────────────────────────┼────────────────────────┤
 │ D     │ 10 (needs 2, 5, 9)       │ After group C          │
 ├───────┼──────────────────────────┼────────────────────────┤
 │ E     │ 11 (needs 10)            │ After group D          │
 ├───────┼──────────────────────────┼────────────────────────┤
 │ F     │ 12 (needs 11)            │ Final cleanup          │
 └───────┴──────────────────────────┴────────────────────────┘
 Verification Plan

 TTS Mode Test (samplePitch, teachMe, foodPairings, etc.)

 1. Open dish card → tap "Hear a sample pitch"
 2. Verify: sheet opens, loading indicator, text appears, audio auto-plays
 3. Verify: after audio, text input appears for follow-up
 4. Type follow-up question → verify it gets answered using item context

 Conversation Mode Test (practicePitch, quizMe)

 1. Open dish card → tap "Practice a pitch"
 2. Verify: WebRTC connects, AI speaks first ("Sell me the [dish]!")
 3. Speak a pitch → verify AI gives feedback
 4. For quizMe: verify AI asks one question, waits, evaluates, asks next

 Chat Mode Test (questions)

 1. Open any card → tap "Have any questions?"
 2. Verify: text input visible immediately (no auto-trigger)
 3. Type "What allergens does this dish have?" → verify actual answer (not generic template)
 4. Verify: mic button works for voice input
 5. Verify: can send multiple follow-up questions

 Cross-Domain Tests

 - Test all 5 domains have working buttons
 - Verify item context is passed (AI response references actual item)
 - Test bilingual (switch to ES, verify AI responds in Spanish)

 Critical Files Reference
 ┌───────────────────────────────────────────────────┬─────────────────────────────────────┐
 │                       File                        │               Action                │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/data/ai-action-config.ts                      │ CREATE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/hooks/use-ask-ai.ts                           │ MODIFY (add product fields)         │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/hooks/use-tts.ts                              │ CREATE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/hooks/use-product-chat.ts                     │ CREATE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/hooks/use-realtime-webrtc.ts                  │ MODIFY (product context + tools)    │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/shared/ProductChatSheet.tsx        │ CREATE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ supabase/functions/ask/index.ts                   │ MODIFY (itemContext in search mode) │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ supabase/functions/tts/index.ts                   │ CREATE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ supabase/functions/realtime-session/index.ts      │ MODIFY (product context)            │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ supabase/functions/realtime-search/index.ts       │ MODIFY (product tool routing)       │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ supabase/migrations/...voice_prompts.sql          │ CREATE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/dishes/DishCardView.tsx            │ MODIFY (use ProductChatSheet)       │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/wines/WineCardView.tsx             │ MODIFY                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/cocktails/CocktailCardView.tsx     │ MODIFY                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/recipes/RecipeCardView.tsx         │ MODIFY                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/beer-liquor/BeerLiquorCardView.tsx │ MODIFY                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/dishes/DishAISheet.tsx             │ DELETE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/wines/WineAISheet.tsx              │ DELETE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/cocktails/CocktailAISheet.tsx      │ DELETE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/recipes/RecipeAISheet.tsx          │ DELETE                              │
 ├───────────────────────────────────────────────────┼─────────────────────────────────────┤
 │ src/components/beer-liquor/BeerLiquorAISheet.tsx  │ DELETE                              │
 └───────────────────────────────────────────────────┴─────────────────────────────────────┘