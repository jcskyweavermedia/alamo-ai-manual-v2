/**
 * Ingest Edge Function — Two-Call Pipeline
 *
 * Every message goes through:
 *   Call 1 (Chat) — gpt-5.2 via Responses API. Search tools + web_search_preview
 *                    (wines only). No update_draft.
 *   Call 2 (Extract) — gpt-5-mini-2025-08-07 reads the exchange, returns structured
 *                       JSON via forced schema. Deterministic.
 *
 * Admin-only. Creates/updates ingestion_sessions and ingestion_messages rows.
 *
 * Auth: verify_jwt=false — manual JWT verification via getClaims()
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// CORS
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// =============================================================================
// TYPES
// =============================================================================

interface IngestRequest {
  mode?: "pipeline"; // reserved for future modes
  sessionId?: string;
  productTable: string;
  content: string;
  language?: "en" | "es";
}

// EnrichSuggestion removed — web enrichment is now built into
// the two-call pipeline in ingest-vision and ingest-file edge functions

interface PrepRecipeDraft {
  name: string;
  prepType: string;
  tags: string[];
  yieldQty: number;
  yieldUnit: string;
  shelfLifeValue: number;
  shelfLifeUnit: string;
  ingredients: IngredientGroup[];
  procedure: ProcedureGroup[];
  batchScaling: BatchScaling;
  trainingNotes: TrainingNotes;
  confidence: number;
  missingFields: string[];
  aiMessage: string;
}

interface IngredientGroup {
  group_name: string;
  order: number;
  items: IngredientItem[];
}

interface IngredientItem {
  name: string;
  quantity: number;
  unit: string;
  allergens: string[];
}

interface ProcedureGroup {
  group_name: string;
  order: number;
  steps: ProcedureStep[];
}

interface ProcedureStep {
  step_number: number;
  instruction: string;
  critical: boolean;
}

interface BatchScaling {
  scalable: boolean;
  scaling_method: string;
  notes: string;
  exceptions: string[];
}

interface TrainingNotes {
  notes: string;
  common_mistakes: string[];
  quality_checks: string[];
}

interface WineDraft {
  name: string;
  producer: string;
  region: string;
  country: string;
  vintage: string | null;
  varietal: string;
  blend: boolean;
  style: string;
  body: string;
  tastingNotes: string;
  producerNotes: string;
  notes: string;
  image?: string | null;
  isTopSeller: boolean;
  confidence: number;
  missingFields: string[];
  aiMessage: string;
}

interface CocktailDraft {
  name: string;
  style: string;
  glass: string;
  ingredients: string;
  keyIngredients: string;
  procedure: Array<{ step: number; instruction: string }>;
  tastingNotes: string;
  description: string;
  notes: string;
  isTopSeller: boolean;
  confidence: number;
  missingFields: string[];
  aiMessage: string;
}

type ProductDraft = PrepRecipeDraft | WineDraft | CocktailDraft;

interface IngestResponse {
  sessionId: string;
  message: string;
  draft: ProductDraft | null;
  confidence?: number;
  missingFields?: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_TOOL_ROUNDS = 3;

const VALID_PRODUCT_TABLES = new Set([
  "prep_recipes",
  "plate_specs",
  "foh_plate_specs",
  "wines",
  "cocktails",
  "beer_liquor_list",
]);

const SEARCH_FN_MAP: Record<string, string> = {
  foh_plate_specs: "search_dishes",
  wines: "search_wines",
  cocktails: "search_cocktails",
  beer_liquor_list: "search_beer_liquor",
  prep_recipes: "search_recipes",
  plate_specs: "search_recipes",
};

// =============================================================================
// HELPERS
// =============================================================================

function jsonResponse(data: IngestResponse | { error: string; message?: string }, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: string, message?: string, status = 400): Response {
  const body: { error: string; message?: string } = { error };
  if (message) body.message = message;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Generate a URL-safe slug from a recipe name.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// =============================================================================
// OPENAI STRUCTURED OUTPUT SCHEMA (PrepRecipeDraft)
// =============================================================================

const PREP_RECIPE_DRAFT_SCHEMA = {
  name: "recipe_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      prepType: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      yieldQty: { type: "number" },
      yieldUnit: { type: "string" },
      shelfLifeValue: { type: "number" },
      shelfLifeUnit: { type: "string" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_name: { type: "string" },
            order: { type: "number" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                  allergens: { type: "array", items: { type: "string" } },
                },
                required: ["name", "quantity", "unit", "allergens"],
                additionalProperties: false,
              },
            },
          },
          required: ["group_name", "order", "items"],
          additionalProperties: false,
        },
      },
      procedure: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_name: { type: "string" },
            order: { type: "number" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step_number: { type: "number" },
                  instruction: { type: "string" },
                  critical: { type: "boolean" },
                },
                required: ["step_number", "instruction", "critical"],
                additionalProperties: false,
              },
            },
          },
          required: ["group_name", "order", "steps"],
          additionalProperties: false,
        },
      },
      batchScaling: {
        type: "object",
        properties: {
          scalable: { type: "boolean" },
          scaling_method: { type: "string" },
          notes: { type: "string" },
          exceptions: { type: "array", items: { type: "string" } },
        },
        required: ["scalable", "scaling_method", "notes", "exceptions"],
        additionalProperties: false,
      },
      trainingNotes: {
        type: "object",
        properties: {
          notes: { type: "string" },
          common_mistakes: { type: "array", items: { type: "string" } },
          quality_checks: { type: "array", items: { type: "string" } },
        },
        required: ["notes", "common_mistakes", "quality_checks"],
        additionalProperties: false,
      },
      confidence: { type: "number", description: "0-1 confidence score" },
      missingFields: {
        type: "array",
        items: { type: "string" },
        description: "Fields the AI couldn't determine from the input",
      },
      aiMessage: {
        type: "string",
        description: "Brief summary of what was extracted or updated in this turn",
      },
    },
    required: [
      "name",
      "prepType",
      "tags",
      "yieldQty",
      "yieldUnit",
      "shelfLifeValue",
      "shelfLifeUnit",
      "ingredients",
      "procedure",
      "batchScaling",
      "trainingNotes",
      "confidence",
      "missingFields",
      "aiMessage",
    ],
    additionalProperties: false,
  },
};

// =============================================================================
// OPENAI STRUCTURED OUTPUT SCHEMA (WineDraft)
// =============================================================================

const WINE_DRAFT_SCHEMA = {
  name: "wine_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      producer: { type: "string" },
      region: { type: "string" },
      country: { type: "string" },
      vintage: { type: ["string", "null"], description: "Vintage year as string, or null for NV wines" },
      varietal: { type: "string" },
      blend: { type: "boolean" },
      style: { type: "string", enum: ["red", "white", "rosé", "sparkling"] },
      body: { type: "string", enum: ["light", "medium", "full"] },
      tastingNotes: { type: "string" },
      producerNotes: { type: "string" },
      notes: { type: "string", description: "Service notes, food pairings" },
      isTopSeller: { type: "boolean" },
      confidence: { type: "number", description: "0-1 confidence score" },
      missingFields: {
        type: "array",
        items: { type: "string" },
        description: "Fields the AI couldn't determine from the input",
      },
      aiMessage: {
        type: "string",
        description: "Brief summary of what was extracted or updated in this turn",
      },
    },
    required: [
      "name", "producer", "region", "country", "vintage", "varietal",
      "blend", "style", "body", "tastingNotes", "producerNotes", "notes",
      "isTopSeller", "confidence", "missingFields", "aiMessage",
    ],
    additionalProperties: false,
  },
};

// =============================================================================
// OPENAI STRUCTURED OUTPUT SCHEMA (CocktailDraft)
// =============================================================================

const COCKTAIL_DRAFT_SCHEMA = {
  name: "cocktail_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      style: { type: "string", enum: ["classic", "modern", "tiki", "refresher"] },
      glass: { type: "string", description: "Glass type, e.g., Rocks, Coupe, Highball, Nick & Nora, Collins" },
      ingredients: { type: "string", description: "Full ingredient list with measurements, one per line" },
      keyIngredients: { type: "string", description: "Primary spirits/mixers summary" },
      procedure: {
        type: "array",
        items: {
          type: "object",
          properties: {
            step: { type: "number" },
            instruction: { type: "string" },
          },
          required: ["step", "instruction"],
          additionalProperties: false,
        },
        description: "Ordered preparation steps",
      },
      tastingNotes: { type: "string" },
      description: { type: "string", description: "Cocktail story, history, or context" },
      notes: { type: "string", description: "Service notes, garnish details, technique tips" },
      isTopSeller: { type: "boolean" },
      confidence: { type: "number", description: "0-1 confidence score" },
      missingFields: {
        type: "array",
        items: { type: "string" },
        description: "Fields the AI couldn't determine from the input",
      },
      aiMessage: {
        type: "string",
        description: "Brief summary of what was extracted or updated in this turn",
      },
    },
    required: [
      "name", "style", "glass", "ingredients", "keyIngredients",
      "procedure", "tastingNotes", "description", "notes",
      "isTopSeller", "confidence", "missingFields", "aiMessage",
    ],
    additionalProperties: false,
  },
};

// =============================================================================
// PROMPT SLUG MAP — productTable → {chat, extract} prompt slugs
// =============================================================================

const PROMPT_SLUG_MAP: Record<string, { chat: string; extract: string }> = {
  prep_recipes: { chat: "ingest-chat-prep-recipe", extract: "ingest-extract-prep-recipe" },
  wines: { chat: "ingest-chat-wine", extract: "ingest-extract-wine" },
  cocktails: { chat: "ingest-chat-cocktail", extract: "ingest-extract-cocktail" },
};

// =============================================================================
// EXTRACT RESPONSE SCHEMA — built dynamically per product type
// =============================================================================

function buildExtractResponseSchema(productTable: string) {
  const draftSchema = productTable === "wines"
    ? WINE_DRAFT_SCHEMA.schema
    : productTable === "cocktails"
      ? COCKTAIL_DRAFT_SCHEMA.schema
      : PREP_RECIPE_DRAFT_SCHEMA.schema;

  return {
    name: "extract_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        has_updates: {
          type: "boolean",
          description: "true if the exchange contains new product data to merge into the draft",
        },
        draft: draftSchema,
      },
      required: ["has_updates", "draft"],
      additionalProperties: false,
    },
  };
}

// =============================================================================
// PIPELINE TOOLS — Responses API format (Call 1)
// =============================================================================

// Responses API uses flat tool format: { type, name, description, parameters }
// deno-lint-ignore no-explicit-any
const BASE_RESPONSES_TOOLS: any[] = [
  {
    type: "function",
    name: "search_recipes",
    description: "Search existing prep recipes in the database. Use this when the user mentions an ingredient or sub-recipe that might already exist (e.g., 'chimichurri', 'demi-glace', 'compound butter').",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for recipe name or ingredient",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "search_products",
    description: "Search across all product tables to check for duplicates or find related products. Use this when the user describes a product that might already exist.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for product name",
        },
        table: {
          type: "string",
          enum: ["foh_plate_specs", "wines", "cocktails", "beer_liquor_list", "prep_recipes", "plate_specs"],
          description: "Which product table to search (optional, searches dishes by default)",
        },
      },
      required: ["query"],
    },
  },
];

/**
 * Build Responses API tools array for a given product table.
 * Wines get web_search_preview prepended; all others get only function tools.
 */
// deno-lint-ignore no-explicit-any
function buildResponsesTools(productTable: string): any[] {
  if (productTable === "wines") {
    return [
      { type: "web_search_preview", search_context_size: "medium" },
      ...BASE_RESPONSES_TOOLS,
    ];
  }
  return [...BASE_RESPONSES_TOOLS];
}

// =============================================================================
// PIPELINE HANDLER
// =============================================================================

async function handlePipeline(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  body: IngestRequest,
  openaiApiKey: string
): Promise<Response> {
  const { content, productTable, language = "en", sessionId: existingSessionId } = body;

  console.log(
    `[ingest] Pipeline: sessionId=${existingSessionId || "new"}, productTable=${productTable}, language=${language}`
  );

  // -------------------------------------------------------------------------
  // 1. Load or create session
  // -------------------------------------------------------------------------
  let sessionId: string;
  // deno-lint-ignore no-explicit-any
  let currentDraft: Record<string, any> = {};
  let draftVersion = 1;

  if (existingSessionId) {
    const { data: session, error: sessionError } = await supabase
      .from("ingestion_sessions")
      .select("id, draft_data, draft_version, status, created_by")
      .eq("id", existingSessionId)
      .single();

    if (sessionError || !session) {
      console.error("[ingest] Session not found:", existingSessionId, sessionError?.message);
      return errorResponse("not_found", "Ingestion session not found", 404);
    }

    if (session.created_by !== userId) {
      return errorResponse("Forbidden", "You do not own this session", 403);
    }

    if (session.status !== "drafting" && session.status !== "review") {
      return errorResponse("bad_request", `Session is ${session.status} and cannot be edited`, 400);
    }

    sessionId = session.id;
    currentDraft = session.draft_data || {};
    draftVersion = session.draft_version || 1;
  } else {
    const { data: session, error: sessionError } = await supabase
      .from("ingestion_sessions")
      .insert({
        product_table: productTable,
        ingestion_method: "chat",
        status: "drafting",
        created_by: userId,
      })
      .select("id")
      .single();

    if (sessionError) {
      console.error("[ingest] Failed to create session:", sessionError.message);
      return errorResponse("server_error", "Failed to create ingestion session", 500);
    }

    sessionId = session.id;
    console.log(`[ingest] Created new session: ${sessionId}`);
  }

  // -------------------------------------------------------------------------
  // 2. Load message history (last 20 messages)
  // -------------------------------------------------------------------------
  const { data: historyRows, error: historyError } = await supabase
    .from("ingestion_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  if (historyError) {
    console.error("[ingest] Failed to load message history:", historyError.message);
  }

  // deno-lint-ignore no-explicit-any
  const historyMessages: { role: string; content: string }[] = (historyRows || []).map((msg: any) => ({
    role: msg.role,
    content: msg.content,
  }));

  console.log(`[ingest] Loaded ${historyMessages.length} history messages`);

  // -------------------------------------------------------------------------
  // 3. Fetch chat prompt (Call 1 system prompt)
  // -------------------------------------------------------------------------
  const { data: chatPromptRow, error: chatPromptError } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", PROMPT_SLUG_MAP[productTable]?.chat || "ingest-chat-prep-recipe")
    .eq("is_active", true)
    .single();

  if (chatPromptError) {
    console.error("[ingest] Failed to load chat prompt:", chatPromptError.message);
    return errorResponse("server_error", "Failed to load AI prompt", 500);
  }

  const baseChatPrompt = language === "es" && chatPromptRow.prompt_es
    ? chatPromptRow.prompt_es
    : chatPromptRow.prompt_en;

  // Append current draft context so the AI knows the current state
  const draftContext = Object.keys(currentDraft).length > 0
    ? `\n\nCurrent draft state:\n\`\`\`json\n${JSON.stringify(currentDraft, null, 2)}\n\`\`\``
    : "\n\nNo draft data yet. This is a fresh session.";

  const chatSystemPrompt = baseChatPrompt + draftContext;

  // -------------------------------------------------------------------------
  // 4. Save user message
  // -------------------------------------------------------------------------
  const { error: userMsgError } = await supabase
    .from("ingestion_messages")
    .insert({
      session_id: sessionId,
      role: "user",
      content: content,
    });

  if (userMsgError) {
    console.error("[ingest] Failed to save user message:", userMsgError.message);
  }

  // -------------------------------------------------------------------------
  // 5. CALL 1 — Chat (gpt-5.2, Responses API)
  // -------------------------------------------------------------------------
  const responsesTools = buildResponsesTools(productTable);

  // Build input messages for Responses API
  // deno-lint-ignore no-explicit-any
  const inputMessages: any[] = [
    ...historyMessages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: content },
  ];

  console.log(`[ingest] Call 1 — Responses API (gpt-5.2, ${responsesTools.length} tools)...`);

  let aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      instructions: chatSystemPrompt,
      input: inputMessages,
      tools: responsesTools,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error(`[ingest] Call 1 OpenAI error ${aiResponse.status}:`, errText);
    return errorResponse("ai_error", `AI error: ${errText.slice(0, 200)}`, 500);
  }

  // deno-lint-ignore no-explicit-any
  let aiData: any = await aiResponse.json();

  // Tool loop (max MAX_TOOL_ROUNDS rounds) for search_recipes, search_products
  // web_search_call items are handled server-side by OpenAI — we skip them
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Collect function_call items from output (skip web_search_call, message, etc.)
    // deno-lint-ignore no-explicit-any
    const functionCalls = (aiData.output || []).filter((item: any) => item.type === "function_call");

    if (functionCalls.length === 0) {
      break;
    }

    console.log(
      `[ingest] Call 1 round ${round + 1}: ${functionCalls.length} function call(s)`
    );

    // Process each function call and build results
    // deno-lint-ignore no-explicit-any
    const toolResults: any[] = [];

    // deno-lint-ignore no-explicit-any
    for (const fc of functionCalls) {
      const fnName = fc.name;
      const callId = fc.call_id;

      if (fnName === "search_recipes") {
        try {
          const fnArgs = JSON.parse(fc.arguments);
          const query = fnArgs.query || "";
          console.log(`[ingest] search_recipes: "${query}"`);

          const { data, error: rpcError } = await supabase.rpc("search_recipes", {
            search_query: query,
            query_embedding: null,
            result_limit: 5,
          });

          if (rpcError) {
            console.error("[ingest] search_recipes RPC error:", rpcError.message);
          }

          // deno-lint-ignore no-explicit-any
          const results = (data || []).map((r: any) => ({
            id: r.id,
            slug: r.slug,
            name: r.name,
            source_table: r.source_table,
            snippet: r.snippet,
          }));

          toolResults.push({
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(results),
          });
        } catch (toolError) {
          console.error("[ingest] search_recipes error:", toolError);
          toolResults.push({
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ error: "Failed to search recipes" }),
          });
        }
      } else if (fnName === "search_products") {
        try {
          const fnArgs = JSON.parse(fc.arguments);
          const query = fnArgs.query || "";
          const table = fnArgs.table || "foh_plate_specs";
          const searchFn = SEARCH_FN_MAP[table] || "search_dishes";

          console.log(`[ingest] search_products: query="${query}", table="${table}", fn="${searchFn}"`);

          const { data, error: rpcError } = await supabase.rpc(searchFn, {
            search_query: query,
            query_embedding: null,
            result_limit: 5,
          });

          if (rpcError) {
            console.error(`[ingest] ${searchFn} RPC error:`, rpcError.message);
          }

          // deno-lint-ignore no-explicit-any
          const results = (data || []).map((r: any) => ({
            id: r.id,
            slug: r.slug,
            name: r.name,
            source_table: r.source_table || table,
            snippet: r.snippet,
          }));

          toolResults.push({
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(results),
          });
        } catch (toolError) {
          console.error("[ingest] search_products error:", toolError);
          toolResults.push({
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ error: "Failed to search products" }),
          });
        }
      } else {
        console.warn(`[ingest] Unknown function called: ${fnName}`);
        toolResults.push({
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ error: `Unknown function: ${fnName}` }),
        });
      }
    }

    // Follow-up call with tool results via previous_response_id
    const isLastRound = round === MAX_TOOL_ROUNDS - 1;
    aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        instructions: chatSystemPrompt,
        previous_response_id: aiData.id,
        input: toolResults,
        ...(isLastRound ? {} : { tools: responsesTools }),
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[ingest] Call 1 follow-up error ${aiResponse.status}:`, errText);
      return errorResponse("ai_error", `AI error: ${errText.slice(0, 200)}`, 500);
    }

    aiData = await aiResponse.json();
  }

  // -------------------------------------------------------------------------
  // 6. Extract final text from Call 1 (Responses API output format)
  // -------------------------------------------------------------------------
  // deno-lint-ignore no-explicit-any
  const messageItem = (aiData.output || []).find((item: any) => item.type === "message");
  const call1Text = messageItem?.content
    // deno-lint-ignore no-explicit-any
    ?.find((c: any) => c.type === "output_text")?.text?.trim() || "";

  if (!call1Text) {
    console.warn("[ingest] Call 1 returned empty text response");
  }

  console.log(`[ingest] Call 1 complete: ${call1Text.length} chars`);

  // -------------------------------------------------------------------------
  // 7. Save Call 1 assistant message
  // -------------------------------------------------------------------------
  if (call1Text) {
    const { error: call1MsgError } = await supabase
      .from("ingestion_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        content: call1Text,
      });

    if (call1MsgError) {
      console.error("[ingest] Failed to save Call 1 message:", call1MsgError.message);
    }
  }

  // -------------------------------------------------------------------------
  // 8. CALL 2 — Extract (gpt-5-mini-2025-08-07, forced json_schema)
  // -------------------------------------------------------------------------
  const { data: extractPromptRow, error: extractPromptError } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", PROMPT_SLUG_MAP[productTable]?.extract || "ingest-extract-prep-recipe")
    .eq("is_active", true)
    .single();

  if (extractPromptError) {
    console.error("[ingest] Failed to load extract prompt:", extractPromptError.message);
    // Non-fatal: we can still return the chat response without extraction
    return jsonResponse({
      sessionId,
      message: call1Text,
      draft: Object.keys(currentDraft).length > 0 ? currentDraft as unknown as ProductDraft : null,
    });
  }

  const extractSystemPrompt = language === "es" && extractPromptRow.prompt_es
    ? extractPromptRow.prompt_es
    : extractPromptRow.prompt_en;

  const draftJson = Object.keys(currentDraft).length > 0
    ? JSON.stringify(currentDraft, null, 2)
    : "{}";

  const extractUserContent = `CURRENT DRAFT:\n${draftJson}\n\nUSER MESSAGE:\n${content}\n\nASSISTANT RESPONSE:\n${call1Text}`;

  console.log("[ingest] Call 2 — Extract (gpt-5-mini-2025-08-07, json_schema)...");

  const extractResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini-2025-08-07",
      messages: [
        { role: "system", content: extractSystemPrompt },
        { role: "user", content: extractUserContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: buildExtractResponseSchema(productTable),
      },
      max_completion_tokens: 4000,
    }),
  });

  if (!extractResponse.ok) {
    const errText = await extractResponse.text();
    console.error(`[ingest] Call 2 OpenAI error ${extractResponse.status}:`, errText);
    // Non-fatal: return chat response with current draft
    return jsonResponse({
      sessionId,
      message: call1Text,
      draft: Object.keys(currentDraft).length > 0 ? currentDraft as unknown as ProductDraft : null,
    });
  }

  const extractData = await extractResponse.json();
  const extractRaw = extractData.choices?.[0]?.message?.content;

  if (!extractRaw) {
    console.error("[ingest] Call 2 returned empty content");
    return jsonResponse({
      sessionId,
      message: call1Text,
      draft: Object.keys(currentDraft).length > 0 ? currentDraft as unknown as ProductDraft : null,
    });
  }

  // -------------------------------------------------------------------------
  // 9. Parse extraction result
  // -------------------------------------------------------------------------
  let extractResult: { has_updates: boolean; draft: ProductDraft };
  try {
    extractResult = JSON.parse(extractRaw);
  } catch (parseError) {
    console.error("[ingest] Call 2 returned invalid JSON:", extractRaw);
    return jsonResponse({
      sessionId,
      message: call1Text,
      draft: Object.keys(currentDraft).length > 0 ? currentDraft as unknown as ProductDraft : null,
    });
  }

  console.log(
    `[ingest] Call 2 result: has_updates=${extractResult.has_updates}, confidence=${extractResult.draft?.confidence}`
  );

  // -------------------------------------------------------------------------
  // 10. If has_updates, save updated draft to session
  // -------------------------------------------------------------------------
  if (extractResult.has_updates && extractResult.draft) {
    currentDraft = extractResult.draft as unknown as Record<string, unknown>;

    // Add slug (not in AI schema, needed by frontend)
    if (extractResult.draft.name) {
      // deno-lint-ignore no-explicit-any
      (currentDraft as any).slug = generateSlug(extractResult.draft.name);
    }
    // Type-specific defaults
    if (productTable === "wines") {
      // Wine uses single `image` field — ensure it exists
      if ((currentDraft as Record<string, unknown>).image === undefined) {
        (currentDraft as Record<string, unknown>).image = null;
      }
    } else if (productTable === "cocktails") {
      // Cocktail uses single `image` field — ensure it exists
      if ((currentDraft as Record<string, unknown>).image === undefined) {
        (currentDraft as Record<string, unknown>).image = null;
      }
    } else {
      // Prep recipe uses `images` array
      // deno-lint-ignore no-explicit-any
      (currentDraft as any).images = (currentDraft as any).images || [];
    }

    const newVersion = draftVersion + 1;

    const { error: updateError } = await supabase
      .from("ingestion_sessions")
      .update({
        draft_data: currentDraft,
        draft_version: newVersion,
        ai_confidence: extractResult.draft.confidence,
        missing_fields: extractResult.draft.missingFields,
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("[ingest] Failed to update session draft:", updateError.message);
    } else {
      console.log(`[ingest] Draft updated to version ${newVersion}`);
    }

    // Save extraction as a message for audit trail
    const { error: extractMsgError } = await supabase
      .from("ingestion_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        content: `[Extract] ${extractResult.draft.aiMessage || "Draft updated"}`,
        draft_updates: extractResult.draft,
      });

    if (extractMsgError) {
      console.error("[ingest] Failed to save extraction message:", extractMsgError.message);
    }
  }

  // -------------------------------------------------------------------------
  // 11. Return response
  // -------------------------------------------------------------------------
  const draftToReturn = extractResult.draft || (
    Object.keys(currentDraft).length > 0
      ? currentDraft as unknown as ProductDraft
      : null
  );

  // Ensure slug and type-specific defaults on returned draft
  if (draftToReturn) {
    // deno-lint-ignore no-explicit-any
    const d = draftToReturn as any;
    if (!d.slug && d.name) {
      d.slug = generateSlug(d.name);
    }
    if (productTable === "wines" || productTable === "cocktails") {
      if (d.image === undefined) d.image = null;
    } else {
      if (!d.images) d.images = [];
    }
  }

  console.log(`[ingest] Pipeline complete: sessionId=${sessionId}, hasUpdates=${extractResult.has_updates}`);

  return jsonResponse({
    sessionId,
    message: call1Text,
    draft: draftToReturn,
    confidence: extractResult.draft?.confidence,
    missingFields: extractResult.draft?.missingFields,
  });
}

// =============================================================================
// (Enrich handler removed — web enrichment is now built into the two-call
//  pipeline in ingest-vision and ingest-file edge functions)
// =============================================================================

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[ingest] Request received");

  try {
    // =========================================================================
    // 1. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[ingest] Missing or invalid Authorization header");
      return errorResponse("Unauthorized", "Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user's token for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.log("[ingest] Invalid token:", claimsError?.message);
      return errorResponse("Unauthorized", "Invalid token", 401);
    }

    const userId = claimsData.claims.sub as string;
    console.log("[ingest] Authenticated user:", userId);

    // Service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. ADMIN CHECK
    // =========================================================================
    const { data: membership, error: membershipError } = await supabase
      .from("group_memberships")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      console.log("[ingest] User has no group membership:", membershipError?.message);
      return errorResponse("Forbidden", "No group membership found", 403);
    }

    if (membership.role !== "admin") {
      console.log(`[ingest] User role is "${membership.role}", admin required`);
      return errorResponse("Forbidden", "Admin access required", 403);
    }

    console.log("[ingest] Admin access confirmed");

    // =========================================================================
    // 3. PARSE AND VALIDATE REQUEST
    // =========================================================================
    const body = (await req.json()) as IngestRequest;

    // Validate content
    if (!body.content?.trim()) {
      return errorResponse("bad_request", "content is required", 400);
    }

    // Validate productTable
    if (!body.productTable || !VALID_PRODUCT_TABLES.has(body.productTable)) {
      return errorResponse(
        "bad_request",
        `productTable must be one of: ${[...VALID_PRODUCT_TABLES].join(", ")}`,
        400
      );
    }

    // Validate language
    if (body.language && !["en", "es"].includes(body.language)) {
      return errorResponse("bad_request", 'language must be "en" or "es"', 400);
    }

    console.log(`[ingest] Table: ${body.productTable} | Lang: ${body.language || "en"}`);

    // =========================================================================
    // 4. GET OPENAI API KEY
    // =========================================================================
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[ingest] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    // =========================================================================
    // 5. DISPATCH TO HANDLER
    // =========================================================================
    return await handlePipeline(supabase, userId, body, openaiApiKey);
  } catch (error) {
    console.error("[ingest] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
