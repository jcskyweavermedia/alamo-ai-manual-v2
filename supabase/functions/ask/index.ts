/**
 * Unified AI Assistant Edge Function
 *
 * Single endpoint serving all 6 viewer contexts (manual, dishes, wines,
 * cocktails, recipes, beer_liquor). Replaces both the old /ask and
 * /ask-product edge functions.
 *
 * Two modes:
 *   1. Action mode — button presses with full card context (no search)
 *   2. Search mode — freeform questions with OpenAI tool use (6 search tools)
 *
 * Features:
 *   - DB-driven prompts from ai_prompts table
 *   - Chat session memory via chat_sessions + chat_messages
 *   - Tool-use loop (max 3 rounds) with 6 hybrid search functions
 *   - Manual content expansion (full section fetch for manual domain)
 *   - Pairing enrichment for foodPairings/suggestPairing actions
 *   - Bilingual (EN/ES) with language-aware search and prompts
 *   - Backward compatible with existing useAskAI hook (domain defaults to 'manual')
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

type ContextType =
  | "manual"
  | "dishes"
  | "wines"
  | "cocktails"
  | "recipes"
  | "beer_liquor"
  | "training";

const VALID_CONTEXTS: ContextType[] = [
  "manual",
  "dishes",
  "wines",
  "cocktails",
  "recipes",
  "beer_liquor",
  "training",
];

interface UnifiedAskRequest {
  question: string;
  groupId: string;
  domain?: ContextType; // Optional for backward compat — defaults to 'manual'
  language?: "en" | "es";
  expand?: boolean;
  sessionId?: string;
  action?: string;
  itemContext?: Record<string, unknown>;
  context?: {
    sectionId?: string;
    sectionTitle?: string;
  } | null;
}

interface UnifiedCitation {
  id: string;
  slug: string;
  name: string;
  title: string; // Alias for backward compat with useAskAI
  domain: ContextType;
}

interface UsageInfo {
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

interface UnifiedAskResponse {
  answer: string;
  citations: UnifiedCitation[];
  usage: UsageInfo;
  mode: "action" | "search";
  sessionId: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
  usage?: UsageInfo;
}

interface TrainingAskRequest {
  domain: 'training';
  question: string;
  language: 'en' | 'es';
  groupId: string;
  section_id: string;
  content_context: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  session_summary?: string;
  topics_covered?: string[];
  topics_total?: string[];
}

interface TrainingAskResponse {
  reply: string;
  suggested_replies: string[];
  topics_update: {
    covered: string[];
    total: string[];
  };
  should_suggest_quiz: boolean;
}

interface SearchResult {
  id: string;
  slug: string;
  name: string;
  snippet: string;
  // Manual-specific
  category?: string;
  tags?: string[];
  file_path?: string;
  // Product-specific
  plate_type?: string;
  is_top_seller?: boolean;
  varietal?: string;
  style?: string;
  subcategory?: string;
  source_table?: string;
  combined_score?: number;
}

// Maps search function names → context types (for citation tagging)
const SEARCH_FN_TO_CONTEXT: Record<string, ContextType> = {
  search_manual_v2: "manual",
  search_dishes: "dishes",
  search_wines: "wines",
  search_cocktails: "cocktails",
  search_recipes: "recipes",
  search_beer_liquor: "beer_liquor",
};

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_TOOL_ROUNDS = 3;

const PAIRING_ACTIONS = new Set(["foodPairings", "suggestPairing"]);

const QUESTION_STOP_WORDS = [
  "what", "how", "why", "when", "where", "who", "which",
  "explain", "describe", "tell", "show",
  "is", "are", "the", "a", "an",
  "do", "does", "can", "could", "should", "would",
  "about", "me",
];

const OFF_TOPIC_PATTERNS = [
  /\b(weather|forecast|temperature outside)\b/i,
  /\b(sports?|score|game|nfl|nba|mlb)\b/i,
  /\b(news|politics|election|president)\b/i,
  /\b(celebrity|movie|tv show|netflix|music|song)\b/i,
  /\b(joke|riddle|fun fact|trivia)\b/i,
  /\b(math|calcul|equation|algorithm|coding|program)/i,
  /\b(write me a|compose|draft a letter|essay)\b/i,
  /\b(who are you|what are you|your name)\b/i,
  /\b(stock|crypto|bitcoin|invest)\b/i,
  /\b(relationship|dating|love advice)\b/i,
];

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Respond in English.",
  es: "Responde en español. El contenido del producto está en inglés — tradúcelo naturalmente al español en tu respuesta.",
};

// Hardcoded fallback if ai_prompts table is empty/unreachable
const FALLBACK_SYSTEM_PROMPT =
  "You are the AI assistant for Alamo Prime, a premium steakhouse. You help restaurant staff with menu knowledge, recipes, service techniques, and operational questions. Be professional, concise, and helpful.";

// =============================================================================
// SEARCH TOOL DEFINITIONS (OpenAI function calling)
// =============================================================================

// deno-lint-ignore no-explicit-any
const SEARCH_TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "search_manual_v2",
      description:
        "Search the restaurant operations manual — SOPs, policies, training materials, and culture guide.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query — key terms about the topic",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_dishes",
      description:
        "Search the dish menu — appetizers, entrees, sides, desserts. Returns menu names, descriptions, allergens, flavor profiles, and upsell notes.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query — dish name, ingredient, allergen, or type",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_wines",
      description:
        "Search the wine list — varietals, regions, producers, tasting notes, and pairing suggestions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query — varietal, region, style, or pairing",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_cocktails",
      description:
        "Search the cocktail menu — mixed drinks, ingredients, preparation methods, and presentation.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query — cocktail name, spirit, ingredient, or style",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_recipes",
      description:
        "Search BOH kitchen recipes — prep recipes and plate specifications. Returns ingredients, procedures, yield, shelf life, and training notes.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query — recipe name, ingredient, technique, or dish",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_beer_liquor",
      description:
        "Search the beer and spirits list — brands, categories, styles, serving notes, and descriptions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query — beer name, spirit type, brand, or style",
          },
        },
        required: ["query"],
      },
    },
  },
];

// =============================================================================
// HELPER: Response builders
// =============================================================================

function jsonResponse(
  data: UnifiedAskResponse | ErrorResponse,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  error: string,
  message?: string,
  status = 400,
  usage?: UsageInfo
): Response {
  const body: ErrorResponse = { error };
  if (message) body.message = message;
  if (usage) body.usage = usage;
  return jsonResponse(body as unknown as UnifiedAskResponse, status);
}

// =============================================================================
// HELPER: getQueryEmbedding
// =============================================================================

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.error("[ask] OPENAI_API_KEY not configured, skipping vector search");
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ask] OpenAI embedding error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("[ask] Failed to generate query embedding:", error);
    return null;
  }
}

// =============================================================================
// HELPER: executeSearch
// =============================================================================

async function executeSearch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  fnName: string,
  searchQuery: string,
  queryEmbedding: number[] | null,
  language: string
): Promise<SearchResult[]> {
  if (!queryEmbedding) {
    console.error(`[ask] No embedding for search (${fnName}), skipping`);
    return [];
  }

  // Build RPC params — all functions share the same base signature
  const params: Record<string, unknown> = {
    search_query: searchQuery,
    query_embedding: JSON.stringify(queryEmbedding),
    result_limit: 5,
  };

  // search_manual_v2 has an extra search_language param
  if (fnName === "search_manual_v2") {
    params.search_language = language;
  }

  const { data, error } = await supabase.rpc(fnName, params);

  if (error) {
    console.error(`[ask] Search error (${fnName}):`, error.message);
    return [];
  }

  return data || [];
}

// =============================================================================
// HELPER: formatSearchResults (for OpenAI tool responses)
// =============================================================================

function formatSearchResults(results: SearchResult[]): string {
  if (!results.length) return "No results found.";

  return results
    .map((r, i) => {
      const parts = [`${i + 1}. ${r.name} (${r.slug})`];
      if (r.snippet)
        parts.push(`   ${r.snippet.replace(/<\/?mark>/g, "")}`);
      // Manual-specific
      if (r.category) parts.push(`   Category: ${r.category}`);
      // Product-specific
      if (r.plate_type) parts.push(`   Type: ${r.plate_type}`);
      if (r.is_top_seller) parts.push(`   \u2605 Top Seller`);
      if (r.varietal) parts.push(`   Varietal: ${r.varietal}`);
      if (r.style) parts.push(`   Style: ${r.style}`);
      if (r.subcategory) parts.push(`   Subcategory: ${r.subcategory}`);
      if (r.source_table) parts.push(`   Source: ${r.source_table}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

// =============================================================================
// HELPER: stripStopWords (improves FTS matching)
// =============================================================================

function stripStopWords(query: string): string {
  const stripped = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => !QUESTION_STOP_WORDS.includes(w) && w.length > 1)
    .join(" ");
  return stripped || query; // Fallback to original if all words stripped
}

// =============================================================================
// HELPER: normalizeKeys — converts camelCase keys to snake_case so the
// serializer works whether the frontend sends camelCase or DB sends snake_case
// =============================================================================

function normalizeKeys(item: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    result[key] = value;
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (snakeKey !== key && !(snakeKey in result)) {
      result[snakeKey] = value;
    }
  }
  return result;
}

// =============================================================================
// HELPER: serializeItemContext (carried over verbatim from /ask-product)
// =============================================================================

function serializeItemContext(
  domain: ContextType,
  rawItem: Record<string, unknown>
): string {
  const item = normalizeKeys(rawItem);
  switch (domain) {
    case "dishes":
      return [
        `Dish: ${item.menu_name || item.name}`,
        `Type: ${item.plate_type}`,
        item.short_description
          ? `Description: ${item.short_description}`
          : null,
        item.detailed_description
          ? `Details: ${item.detailed_description}`
          : null,
        item.key_ingredients
          ? `Key Ingredients: ${
              Array.isArray(item.key_ingredients)
                ? item.key_ingredients.join(", ")
                : item.key_ingredients
            }`
          : null,
        item.flavor_profile
          ? `Flavor: ${
              Array.isArray(item.flavor_profile)
                ? item.flavor_profile.join(", ")
                : item.flavor_profile
            }`
          : null,
        item.allergens
          ? `Allergens: ${
              Array.isArray(item.allergens)
                ? item.allergens.join(", ")
                : item.allergens
            }`
          : null,
        item.allergy_notes ? `Allergy Notes: ${item.allergy_notes}` : null,
        item.upsell_notes ? `Upsell Notes: ${item.upsell_notes}` : null,
        item.notes ? `Notes: ${item.notes}` : null,
        item.is_top_seller ? "This is a TOP SELLER." : null,
      ]
        .filter(Boolean)
        .join("\n");

    case "wines":
      return [
        `Wine: ${item.name}`,
        `Producer: ${item.producer}`,
        item.vintage ? `Vintage: ${item.vintage}` : null,
        `Varietal: ${item.varietal}`,
        `Region: ${[item.region, item.country].filter(Boolean).join(", ")}`,
        `Style: ${item.style}, Body: ${item.body}`,
        item.tasting_notes ? `Tasting Notes: ${item.tasting_notes}` : null,
        item.producer_notes ? `Producer Notes: ${item.producer_notes}` : null,
        item.is_top_seller ? "This is a TOP SELLER." : null,
      ]
        .filter(Boolean)
        .join("\n");

    case "cocktails":
      return [
        `Cocktail: ${item.name}`,
        `Style: ${item.style}`,
        `Glass: ${item.glass}`,
        item.key_ingredients
          ? `Key Ingredients: ${item.key_ingredients}`
          : null,
        item.ingredients ? `Full Ingredients: ${item.ingredients}` : null,
        item.tasting_notes ? `Tasting Notes: ${item.tasting_notes}` : null,
        item.description ? `Description: ${item.description}` : null,
        item.notes ? `Notes: ${item.notes}` : null,
        item.is_top_seller ? "This is a TOP SELLER." : null,
      ]
        .filter(Boolean)
        .join("\n");

    case "recipes": {
      const parts: (string | null)[] = [
        `Recipe: ${item.name}`,
        item.prep_type ? `Type: ${item.prep_type}` : null,
        item.plate_type ? `Type: ${item.plate_type}` : null,
        item.menu_category ? `Category: ${item.menu_category}` : null,
        item.tags
          ? `Tags: ${
              Array.isArray(item.tags) ? item.tags.join(", ") : item.tags
            }`
          : null,
        item.yield_qty
          ? `Yield: ${item.yield_qty} ${item.yield_unit || ""}`
          : null,
        item.shelf_life_value
          ? `Shelf Life: ${item.shelf_life_value} ${
              item.shelf_life_unit || ""
            }`
          : null,
      ];

      // prep_recipes.ingredients: JSONB [{ group_name, items: [{ name, quantity, unit }] }]
      // deno-lint-ignore no-explicit-any
      const ingredients = item.ingredients as any[] | null;
      if (Array.isArray(ingredients)) {
        const ingItems = ingredients.flatMap(
          // deno-lint-ignore no-explicit-any
          (g: any) => g.items?.map((i: any) => {
            const qty = i.quantity != null ? `${i.quantity}` : '';
            const unit = i.unit && i.unit !== 'to taste' ? ` ${i.unit}` : (i.unit === 'to taste' ? ' to taste' : '');
            const prefix = qty || unit ? `${qty}${unit} ` : '';
            return `${prefix}${i.name}`;
          }) || []
        );
        if (ingItems.length) parts.push(`Ingredients: ${ingItems.join(", ")}`);
      }

      // prep_recipes.procedure: JSONB [{ group_name, steps: [{ instruction }] }]
      // deno-lint-ignore no-explicit-any
      const procedure = item.procedure as any[] | null;
      if (Array.isArray(procedure)) {
        const steps = procedure.flatMap(
          // deno-lint-ignore no-explicit-any
          (g: any) => g.steps?.map((s: any) => s.instruction) || []
        );
        if (steps.length) parts.push(`Procedure: ${steps.join(" ")}`);
      }

      // plate_specs.components: JSONB [{ group_name, items: [{ name, quantity, unit }] }]
      // deno-lint-ignore no-explicit-any
      const components = item.components as any[] | null;
      if (Array.isArray(components)) {
        const compItems = components.flatMap(
          // deno-lint-ignore no-explicit-any
          (g: any) => g.items?.map((i: any) => {
            const qty = i.quantity != null ? `${i.quantity}` : '';
            const unit = i.unit ? ` ${i.unit}` : '';
            const prefix = qty || unit ? `${qty}${unit} ` : '';
            return `${prefix}${i.name}`;
          }) || []
        );
        if (compItems.length) parts.push(`Components: ${compItems.join(", ")}`);
      }

      // plate_specs.assembly_procedure: JSONB [{ group_name, steps: [{ instruction }] }]
      // deno-lint-ignore no-explicit-any
      const assembly = item.assembly_procedure as any[] | null;
      if (Array.isArray(assembly)) {
        const steps = assembly.flatMap(
          // deno-lint-ignore no-explicit-any
          (g: any) => g.steps?.map((s: any) => s.instruction) || []
        );
        if (steps.length) parts.push(`Assembly: ${steps.join(" ")}`);
      }

      // prep_recipes.training_notes: JSONB
      if (item.training_notes) {
        const tn = item.training_notes;
        parts.push(
          `Training Notes: ${typeof tn === "string" ? tn : JSON.stringify(tn)}`
        );
      }

      // plate_specs.notes: TEXT
      if (item.notes) parts.push(`Notes: ${item.notes}`);

      return parts.filter(Boolean).join("\n");
    }

    case "beer_liquor":
      return [
        `Name: ${item.name}`,
        `Category: ${item.category}`,
        item.subcategory ? `Subcategory: ${item.subcategory}` : null,
        item.producer ? `Producer: ${item.producer}` : null,
        item.country ? `Country: ${item.country}` : null,
        item.style ? `Style: ${item.style}` : null,
        item.description ? `Description: ${item.description}` : null,
        item.notes ? `Notes: ${item.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n");

    default:
      return JSON.stringify(item);
  }
}

// =============================================================================
// HELPER: enrichWithMenuItems (pairing actions only)
// =============================================================================

async function enrichWithMenuItems(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  item: Record<string, unknown>,
  domain: ContextType
): Promise<{ menuText: string; dishCitations: UnifiedCitation[] }> {
  const queryParts: string[] = [];

  if (domain === "wines") {
    if (item.style) queryParts.push(String(item.style));
    if (item.body) queryParts.push(String(item.body));
    if (item.varietal) queryParts.push(String(item.varietal));
  } else if (domain === "cocktails") {
    if (item.style) queryParts.push(String(item.style));
    if (item.key_ingredients) queryParts.push(String(item.key_ingredients));
  } else if (domain === "beer_liquor") {
    if (item.style) queryParts.push(String(item.style));
    if (item.category) queryParts.push(String(item.category));
  }

  const searchQuery = queryParts.join(" ") || "steak entree";

  const queryEmbedding = await getQueryEmbedding(searchQuery);
  if (!queryEmbedding) {
    return { menuText: "", dishCitations: [] };
  }

  const results = await executeSearch(
    supabase,
    "search_dishes",
    searchQuery,
    queryEmbedding,
    "en"
  );

  if (!results.length) {
    return { menuText: "", dishCitations: [] };
  }

  const menuText =
    "\n\nAlamo Prime Menu Items (suggest pairings from these):\n" +
    results
      .map((r) => {
        const parts = [`- ${r.name}`];
        if (r.plate_type) parts.push(` (${r.plate_type})`);
        if (r.is_top_seller) parts.push(" \u2605 Top Seller");
        return parts.join("");
      })
      .join("\n");

  const dishCitations: UnifiedCitation[] = results.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    title: r.name,
    domain: "dishes" as ContextType,
  }));

  return { menuText, dishCitations };
}

// =============================================================================
// HELPER: callOpenAI
// =============================================================================

async function callOpenAI(
  apiKey: string,
  // deno-lint-ignore no-explicit-any
  params: Record<string, any>
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        ...params,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// =============================================================================
// HELPER: handleTrainingDomain
// =============================================================================

async function handleTrainingDomain(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  apiKey: string,
  request: TrainingAskRequest
): Promise<TrainingAskResponse> {
  const {
    question,
    language,
    section_id,
    content_context,
    conversation_history = [],
    session_summary,
    topics_covered = [],
    topics_total = [],
  } = request;

  // Fetch training-teacher prompt from ai_prompts table
  const { data: prompts, error: promptError } = await supabase
    .from("ai_prompts")
    .select("slug, prompt_en, prompt_es")
    .eq("slug", "training-teacher")
    .eq("is_active", true)
    .single();

  if (promptError) {
    console.error("[ask:training] Prompt load error:", promptError.message);
    throw new Error("Failed to load training prompt");
  }

  const basePrompt = language === "es" && prompts.prompt_es
    ? prompts.prompt_es
    : prompts.prompt_en;

  // Build system prompt with context
  const systemParts: string[] = [basePrompt];

  // Add content context
  systemParts.push(
    `\n\n## Content Being Taught\n${content_context}`
  );

  // Add session summary if provided
  if (session_summary) {
    systemParts.push(
      `\n\n## Session Summary\n${session_summary}`
    );
  }

  // Add topic tracking
  const remainingTopics = topics_total.filter(t => !topics_covered.includes(t));
  if (remainingTopics.length > 0) {
    systemParts.push(
      `\n\n## Remaining Topics\n${remainingTopics.join(", ")}`
    );
  }
  if (topics_covered.length > 0) {
    systemParts.push(
      `\n\n## Topics Already Covered\n${topics_covered.join(", ")}`
    );
  }

  const systemPrompt = systemParts.join("\n");

  // Build conversation messages (system + recent 10 history + user question)
  // deno-lint-ignore no-explicit-any
  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add recent conversation history (last 10 messages)
  const recentHistory = conversation_history.slice(-10);
  messages.push(...recentHistory);

  // Add current question
  messages.push({ role: "user", content: question });

  // Define JSON schema for structured output
  const responseSchema = {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description: "The teacher's response to the student's question or statement"
      },
      suggested_replies: {
        type: "array",
        items: { type: "string" },
        description: "3-4 suggested follow-up questions or responses for the student"
      },
      topics_update: {
        type: "object",
        properties: {
          covered: {
            type: "array",
            items: { type: "string" },
            description: "Updated list of topics that have been covered"
          },
          total: {
            type: "array",
            items: { type: "string" },
            description: "Updated list of all topics"
          }
        },
        required: ["covered", "total"],
        additionalProperties: false
      },
      should_suggest_quiz: {
        type: "boolean",
        description: "Whether to suggest a quiz at this point"
      }
    },
    required: ["reply", "suggested_replies", "topics_update", "should_suggest_quiz"],
    additionalProperties: false
  };

  console.log("[ask:training] Calling OpenAI with structured output...");

  // Call OpenAI with structured JSON output
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 800,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "training_response",
            strict: true,
            schema: responseSchema
          }
        }
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from OpenAI");
  }

  // Parse and validate JSON response
  let parsed: TrainingAskResponse;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error("[ask:training] Failed to parse OpenAI response:", content);
    throw new Error("Invalid JSON response from OpenAI");
  }

  // Validate required fields
  if (!parsed.reply || !Array.isArray(parsed.suggested_replies) ||
      !parsed.topics_update || typeof parsed.should_suggest_quiz !== 'boolean') {
    console.error("[ask:training] Invalid response structure:", parsed);
    throw new Error("Invalid response structure from OpenAI");
  }

  return parsed;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[ask] Request received");

  try {
    // =========================================================================
    // 1. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[ask] Missing or invalid Authorization header");
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
      console.log("[ask] Invalid token:", claimsError?.message);
      return errorResponse("Unauthorized", "Invalid token", 401);
    }

    const userId = claimsData.claims.sub as string;
    console.log("[ask] Authenticated user:", userId);

    // Service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. PARSE AND VALIDATE REQUEST
    // =========================================================================
    const body = (await req.json()) as UnifiedAskRequest;
    const {
      question,
      language = "en",
      groupId,
      expand = false,
      action,
      itemContext,
      context = null,
    } = body;

    // Backward compat: domain defaults to 'manual' when not provided
    const domain: ContextType = body.domain && VALID_CONTEXTS.includes(body.domain)
      ? body.domain
      : "manual";

    if (!question?.trim()) {
      return errorResponse("bad_request", "Question is required", 400);
    }

    if (!groupId) {
      return errorResponse("bad_request", "Group ID is required", 400);
    }

    const isActionMode = !!(action && itemContext);

    console.log(
      `[ask] Domain: ${domain} | Mode: ${isActionMode ? "action" : "search"} | Action: ${action || "none"} | Lang: ${language}`
    );

    // =========================================================================
    // 3. TRAINING DOMAIN HANDLER (early branch)
    // =========================================================================
    if (domain === 'training') {
      // Validate required training-specific fields
      const trainingBody = body as unknown as TrainingAskRequest;

      if (!trainingBody.section_id) {
        return errorResponse("bad_request", "section_id is required for training domain", 400);
      }

      if (!trainingBody.content_context) {
        return errorResponse("bad_request", "content_context is required for training domain", 400);
      }

      console.log("[ask] Training domain: section_id =", trainingBody.section_id);

      // Check usage limits
      const { data: usageData, error: usageError } = await supabase.rpc(
        "get_user_usage",
        { _user_id: userId, _group_id: groupId }
      );

      if (usageError) {
        console.error("[ask:training] Usage check error:", usageError.message);
        return errorResponse("server_error", "Failed to check usage limits", 500);
      }

      const usage = usageData?.[0];
      if (!usage) {
        return errorResponse("forbidden", "Not a member of this group", 403);
      }

      const usageInfo: UsageInfo = {
        daily: { used: usage.daily_count, limit: usage.daily_limit },
        monthly: { used: usage.monthly_count, limit: usage.monthly_limit },
      };

      if (!usage.can_ask) {
        const limitType =
          usage.daily_count >= usage.daily_limit ? "daily" : "monthly";
        console.log("[ask:training] Usage limit exceeded:", limitType);
        return errorResponse(
          "limit_exceeded",
          limitType === "daily"
            ? language === "es"
              ? "Límite diario alcanzado. Intenta mañana."
              : "Daily question limit reached. Try again tomorrow."
            : language === "es"
            ? "Límite mensual alcanzado."
            : "Monthly question limit reached.",
          429,
          usageInfo
        );
      }

      // Get OpenAI API key
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        console.error("[ask:training] OPENAI_API_KEY not configured");
        return errorResponse("server_error", "AI service not configured", 500);
      }

      // Call training handler
      let trainingResponse: TrainingAskResponse;
      try {
        trainingResponse = await handleTrainingDomain(
          supabase,
          OPENAI_API_KEY,
          trainingBody
        );
      } catch (error) {
        console.error("[ask:training] Handler error:", error);
        return errorResponse("ai_error", "Failed to generate training response", 500);
      }

      // Increment usage
      const { data: newUsage, error: incrementError } = await supabase.rpc(
        "increment_usage",
        { _user_id: userId, _group_id: groupId }
      );

      if (incrementError) {
        console.error("[ask:training] Failed to increment usage:", incrementError.message);
      }

      const updatedUsage: UsageInfo = newUsage?.[0]
        ? {
            daily: {
              used: newUsage[0].daily_count,
              limit: newUsage[0].daily_limit,
            },
            monthly: {
              used: newUsage[0].monthly_count,
              limit: newUsage[0].monthly_limit,
            },
          }
        : usageInfo;

      console.log(
        `[ask:training] Success — reply length: ${trainingResponse.reply.length}, suggestions: ${trainingResponse.suggested_replies.length}`
      );

      // Return training response (cast to match return type)
      return jsonResponse({
        answer: trainingResponse.reply,
        citations: [],
        usage: updatedUsage,
        mode: "action",
        sessionId: "",
        // Include training-specific fields
        ...trainingResponse,
      } as unknown as UnifiedAskResponse);
    }

    // =========================================================================
    // 4. OFF-TOPIC GUARD (before usage check — no penalty)
    // =========================================================================
    const isOffTopic = OFF_TOPIC_PATTERNS.some((p) => p.test(question));
    if (isOffTopic) {
      console.log("[ask] Off-topic question detected");
      return jsonResponse({
        answer:
          language === "es"
            ? "Soy el asistente de capacitaci\u00f3n de Alamo Prime \u2014 puedo ayudarte con items del men\u00fa, recetas, t\u00e9cnicas de servicio y operaciones del restaurante. \u00bfEn qu\u00e9 te puedo ayudar?"
            : "I'm the Alamo Prime training assistant \u2014 I can help with menu items, recipes, service techniques, and restaurant operations. What would you like to know?",
        citations: [],
        usage: { daily: { used: 0, limit: 0 }, monthly: { used: 0, limit: 0 } },
        mode: "search",
        sessionId: "",
      });
    }

    // =========================================================================
    // 5. CHECK USAGE LIMITS
    // =========================================================================
    const { data: usageData, error: usageError } = await supabase.rpc(
      "get_user_usage",
      { _user_id: userId, _group_id: groupId }
    );

    if (usageError) {
      console.error("[ask] Usage check error:", usageError.message);
      return errorResponse("server_error", "Failed to check usage limits", 500);
    }

    const usage = usageData?.[0];
    if (!usage) {
      return errorResponse("forbidden", "Not a member of this group", 403);
    }

    const usageInfo: UsageInfo = {
      daily: { used: usage.daily_count, limit: usage.daily_limit },
      monthly: { used: usage.monthly_count, limit: usage.monthly_limit },
    };

    if (!usage.can_ask) {
      const limitType =
        usage.daily_count >= usage.daily_limit ? "daily" : "monthly";
      console.log("[ask] Usage limit exceeded:", limitType);
      return errorResponse(
        "limit_exceeded",
        limitType === "daily"
          ? language === "es"
            ? "L\u00edmite diario alcanzado. Intenta ma\u00f1ana."
            : "Daily question limit reached. Try again tomorrow."
          : language === "es"
          ? "L\u00edmite mensual alcanzado."
          : "Monthly question limit reached.",
        429,
        usageInfo
      );
    }

    // =========================================================================
    // 6. SESSION MANAGEMENT
    // =========================================================================
    const contextId = context?.sectionId || null;

    const { data: sessionId, error: sessionError } = await supabase.rpc(
      "get_or_create_chat_session",
      {
        _user_id: userId,
        _group_id: groupId,
        _context_type: domain,
        _context_id: contextId,
        _mode: "text",
        _expiry_hours: 4,
      }
    );

    if (sessionError) {
      console.error("[ask] Session error:", sessionError.message);
      // Non-fatal: continue without session
    }

    const activeSessionId = sessionId || "";

    // Load chat history for context injection
    // deno-lint-ignore no-explicit-any
    let historyMessages: { role: string; content: string }[] = [];
    if (activeSessionId) {
      const { data: history, error: histError } = await supabase.rpc(
        "get_chat_history",
        {
          _session_id: activeSessionId,
          _max_messages: 20,
          _max_tokens: 4000,
        }
      );

      if (histError) {
        console.error("[ask] History error:", histError.message);
      } else if (history?.length) {
        historyMessages = history.map(
          // deno-lint-ignore no-explicit-any
          (msg: any) => ({
            role: msg.role as string,
            content: msg.content as string,
          })
        );
        console.log("[ask] Loaded", historyMessages.length, "history messages");
      }
    }

    // =========================================================================
    // 7. LOAD PROMPTS FROM ai_prompts TABLE
    // =========================================================================
    const promptSlugs = [
      "base-persona",
      "tool-map",
      "behavior-rules",
      `domain-${domain}`,
      ...(isActionMode ? [`action-${domain}-${action}`] : []),
    ];

    const { data: prompts, error: promptError } = await supabase
      .from("ai_prompts")
      .select("slug, category, prompt_en, prompt_es")
      .in("slug", promptSlugs)
      .eq("is_active", true);

    if (promptError) {
      console.error("[ask] Prompt load error:", promptError.message);
    }

    // Build prompt map for easy lookup
    const promptMap = new Map(
      // deno-lint-ignore no-explicit-any
      (prompts || []).map((p: any) => [p.slug, p])
    );

    // Helper to get prompt text in the right language
    // deno-lint-ignore no-explicit-any
    const getPrompt = (slug: string): string | undefined => {
      const p = promptMap.get(slug);
      if (!p) return undefined;
      const langField = language === "es" ? "prompt_es" : "prompt_en";
      return p[langField] || p.prompt_en; // Fall back to EN if ES is null
    };

    // Assemble system prompt
    const systemParts: string[] = [];

    // Base persona (always)
    systemParts.push(getPrompt("base-persona") || FALLBACK_SYSTEM_PROMPT);

    // Domain context (always)
    const domainPrompt = getPrompt(`domain-${domain}`);
    if (domainPrompt) systemParts.push(domainPrompt);

    if (isActionMode) {
      // Action mode: add action instruction + language instruction
      const actionPrompt = getPrompt(`action-${domain}-${action}`);
      if (actionPrompt) systemParts.push(actionPrompt);
      const langInstruction =
        LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
      systemParts.push(
        `Rules:\n- Use ONLY the product data provided below \u2014 never invent facts\n- Be warm, professional, and encouraging\n- ${langInstruction}\n- Keep responses focused and actionable`
      );
    } else {
      // Search mode: add tool map + behavior rules + language instruction
      const toolMap = getPrompt("tool-map");
      if (toolMap) systemParts.push(toolMap);
      const behaviorRules = getPrompt("behavior-rules");
      if (behaviorRules) systemParts.push(behaviorRules);
      const langInstruction =
        LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
      systemParts.push(langInstruction);

      // If itemContext provided in search mode, include it so the AI knows
      // what item the user is viewing (e.g. for "questions" chat mode)
      if (itemContext && domain !== "manual") {
        const contextText = serializeItemContext(domain, itemContext);
        systemParts.push(
          `The user is currently viewing this item:\n---\n${contextText}\n---\nAnswer the user's question using the product data above FIRST. Be accurate — cite exact quantities, ingredients, and details as shown. Only use search tools if the question asks about something NOT covered in the data above.`
        );
      }
    }

    const systemPrompt = systemParts.filter(Boolean).join("\n\n");

    // =========================================================================
    // 8. OPENAI CONFIG
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[ask] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    // =========================================================================
    // 9. BRANCH: ACTION MODE vs SEARCH MODE
    // =========================================================================
    let answer: string;
    let citations: UnifiedCitation[];
    const mode: "action" | "search" = isActionMode ? "action" : "search";

    if (isActionMode) {
      // =====================================================================
      // ACTION MODE
      // =====================================================================

      // Validate action exists in ai_prompts
      if (!promptMap.has(`action-${domain}-${action}`)) {
        return errorResponse(
          "bad_request",
          `Invalid action "${action}" for domain "${domain}"`,
          400
        );
      }

      // Serialize item context to structured text
      let contextText = serializeItemContext(domain, itemContext!);
      let extraCitations: UnifiedCitation[] = [];

      // Pairing enrichment: fetch real menu items for pairing actions
      if (PAIRING_ACTIONS.has(action!)) {
        console.log("[ask] Enriching with menu items for pairing action");
        const { menuText, dishCitations } = await enrichWithMenuItems(
          supabase,
          itemContext!,
          domain
        );
        contextText += menuText;
        extraCitations = dishCitations;
      }

      // Pitch actions (samplePitch, wineDetails) get a tight token cap
      const PITCH_ACTIONS = new Set(["samplePitch", "wineDetails"]);
      const isPitch = PITCH_ACTIONS.has(action!);
      const actionMaxTokens = isPitch ? 150 : 600;

      console.log("[ask] Action mode: calling OpenAI... (max_tokens:", actionMaxTokens, ")");

      const aiData = await callOpenAI(OPENAI_API_KEY, {
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: contextText },
        ],
        max_tokens: actionMaxTokens,
        temperature: isPitch ? 0.7 : 0.4,
      });

      answer = aiData.choices?.[0]?.message?.content?.trim();

      if (!answer) {
        return errorResponse("ai_error", "Failed to generate answer", 500);
      }

      // Build citations: the item itself + any pairing dishes
      const itemName =
        (itemContext!.menu_name as string) ||
        (itemContext!.menuName as string) ||
        (itemContext!.name as string) ||
        "Unknown";
      const itemSlug = (itemContext!.slug as string) || "";
      const itemId = (itemContext!.id as string) || "";

      citations = [
        { id: itemId, slug: itemSlug, name: itemName, title: itemName, domain },
        ...extraCitations,
      ];
    } else {
      // =====================================================================
      // SEARCH MODE
      // =====================================================================

      // Build initial messages
      // deno-lint-ignore no-explicit-any
      const messages: any[] = [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: question },
      ];

      const allSearchResults: { result: SearchResult; fnName: string }[] = [];

      console.log("[ask] Search mode: calling OpenAI with tools...");

      let aiData = await callOpenAI(OPENAI_API_KEY, {
        messages,
        tools: SEARCH_TOOLS,
        tool_choice: "auto",
        max_tokens: 800,
        temperature: 0.3,
      });

      // Tool-use loop (max 3 rounds)
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const assistantMsg = aiData.choices?.[0]?.message;

        // If no tool calls, we have the final answer
        if (!assistantMsg?.tool_calls?.length) {
          break;
        }

        console.log(
          `[ask] Round ${round + 1}: AI requested ${assistantMsg.tool_calls.length} tool call(s)`
        );

        // Add assistant message with tool_calls to conversation
        messages.push(assistantMsg);

        // Execute each tool call
        for (const toolCall of assistantMsg.tool_calls) {
          const fnName = toolCall.function.name;
          const fnArgs = JSON.parse(toolCall.function.arguments);
          const rawQuery = fnArgs.query;

          // Strip stop words for better FTS matching
          const searchQuery = stripStopWords(rawQuery);

          console.log(
            `[ask] Executing tool: ${fnName}(query="${searchQuery}")`
          );

          // Generate embedding for the search query (use raw query for semantic matching)
          const queryEmbedding = await getQueryEmbedding(rawQuery);

          // Dispatch to the correct PG function
          const results = await executeSearch(
            supabase,
            fnName,
            searchQuery,
            queryEmbedding,
            language
          );

          // Collect results for citation building
          allSearchResults.push(
            ...results.map((r) => ({ result: r, fnName }))
          );

          // Format results as tool response
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: formatSearchResults(results),
          });

          console.log(`[ask] ${fnName}: ${results.length} results`);
        }

        // Follow-up call with tool results (no tools on final round)
        const isLastRound = round === MAX_TOOL_ROUNDS - 1;
        aiData = await callOpenAI(OPENAI_API_KEY, {
          messages,
          ...(isLastRound
            ? {}
            : { tools: SEARCH_TOOLS, tool_choice: "auto" }),
          max_tokens: 800,
          temperature: 0.3,
        });
      }

      // Manual content expansion (domain='manual' only)
      if (domain === "manual" && allSearchResults.length > 0) {
        const manualResults = allSearchResults
          .filter((r) => r.fnName === "search_manual_v2")
          .slice(0, 3);

        if (manualResults.length > 0) {
          const topSlugs = manualResults.map((r) => r.result.slug);
          const { data: fullSections } = await supabase
            .from("manual_sections")
            .select("id, slug, title_en, title_es, content_en, content_es")
            .in("slug", topSlugs);

          if (fullSections?.length) {
            const manualContext = fullSections
              // deno-lint-ignore no-explicit-any
              .map((s: any) => {
                const title =
                  language === "es" && s.title_es ? s.title_es : s.title_en;
                const content =
                  language === "es" && s.content_es
                    ? s.content_es
                    : s.content_en;
                const truncated =
                  content?.length > 8000
                    ? content.substring(0, 8000) + "..."
                    : content;
                return `## ${title}\n${truncated || ""}`;
              })
              .join("\n\n---\n\n");

            // Inject as supplementary context
            messages.push({
              role: "user",
              content: `Here is the full manual content for the most relevant sections:\n\n${manualContext}`,
            });

            console.log("[ask] Manual expansion: re-calling OpenAI with full content...");

            // One more OpenAI call to synthesize with full content
            aiData = await callOpenAI(OPENAI_API_KEY, {
              messages,
              max_tokens: expand ? 1200 : 500,
              temperature: 0.3,
            });
          }
        }
      }

      // Product content expansion (non-manual domains)
      // Search snippets are sparse — fetch full records so the AI has real data
      const productSearchResults = allSearchResults.filter(
        (r) => r.fnName !== "search_manual_v2"
      );
      if (productSearchResults.length > 0) {
        const topProducts = productSearchResults.slice(0, 3);

        // Map search function → { table, domain } for fetching full records
        const SEARCH_FN_TABLE: Record<string, { table: string; domain: ContextType }> = {
          search_dishes: { table: "foh_plate_specs", domain: "dishes" },
          search_wines: { table: "wines", domain: "wines" },
          search_cocktails: { table: "cocktails", domain: "cocktails" },
          search_beer_liquor: { table: "beer_liquor_list", domain: "beer_liquor" },
        };

        // For search_recipes, source_table distinguishes prep_recipe vs plate_spec
        const SOURCE_TABLE_MAP: Record<string, string> = {
          prep_recipe: "prep_recipes",
          plate_spec: "plate_specs",
        };

        // Group IDs by table
        const idsByTable = new Map<string, { ids: string[]; domain: ContextType }>();
        for (const { result: r, fnName } of topProducts) {
          let tableName: string;
          let itemDomain: ContextType;

          if (fnName === "search_recipes") {
            tableName = SOURCE_TABLE_MAP[r.source_table || ""] || "prep_recipes";
            itemDomain = "recipes";
          } else {
            const mapping = SEARCH_FN_TABLE[fnName];
            if (!mapping) continue;
            tableName = mapping.table;
            itemDomain = mapping.domain;
          }

          const entry = idsByTable.get(tableName) || { ids: [], domain: itemDomain };
          entry.ids.push(r.id);
          idsByTable.set(tableName, entry);
        }

        // Fetch full records and serialize
        const expandedParts: string[] = [];
        for (const [tableName, { ids, domain: itemDomain }] of idsByTable) {
          const { data: fullRecords } = await supabase
            .from(tableName)
            .select("*")
            .in("id", ids);

          if (fullRecords?.length) {
            for (const record of fullRecords) {
              expandedParts.push(serializeItemContext(itemDomain, record));
            }
          }
        }

        if (expandedParts.length > 0) {
          messages.push({
            role: "user",
            content: `Here is the full product data for the most relevant items:\n\n${expandedParts.join("\n\n---\n\n")}`,
          });

          console.log("[ask] Product expansion: re-calling OpenAI with full records...");

          aiData = await callOpenAI(OPENAI_API_KEY, {
            messages,
            max_tokens: 800,
            temperature: 0.3,
          });
        }
      }

      // Extract answer
      const finalMsg = aiData.choices?.[0]?.message;
      answer = finalMsg?.content?.trim();

      if (!answer) {
        // If no tool calls produced results and AI didn't answer, return canned response
        if (allSearchResults.length === 0) {
          answer =
            language === "es"
              ? "No encontr\u00e9 informaci\u00f3n relevante sobre esta pregunta. Intenta reformularla o busca directamente."
              : "I couldn't find relevant information about this question. Try rephrasing or search directly.";
        } else {
          return errorResponse("ai_error", "Failed to generate answer", 500);
        }
      }

      // Build citations from search results (deduplicate by id)
      const seenIds = new Set<string>();
      citations = [];
      for (const { result: r, fnName } of allSearchResults) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          citations.push({
            id: r.id,
            slug: r.slug,
            name: r.name,
            title: r.name, // Backward compat alias
            domain: SEARCH_FN_TO_CONTEXT[fnName] || domain,
          });
        }
      }
    }

    // =========================================================================
    // 10. PERSIST MESSAGES (fire-and-forget)
    // =========================================================================
    if (activeSessionId) {
      try {
        // Save user message
        await supabase.from("chat_messages").insert({
          session_id: activeSessionId,
          role: "user",
          content: question,
          input_mode: "text",
        });

        // Save assistant message
        const tokensUsed = null; // Token counting deferred to Phase 8
        await supabase.from("chat_messages").insert({
          session_id: activeSessionId,
          role: "assistant",
          content: answer,
          citations:
            citations.length > 0 ? JSON.stringify(citations) : null,
          tokens_used: tokensUsed,
        });

        // Update session counters (fetch-then-update: safe for sequential user requests)
        const { data: session } = await supabase
          .from("chat_sessions")
          .select("message_count")
          .eq("id", activeSessionId)
          .single();

        await supabase
          .from("chat_sessions")
          .update({
            message_count: (session?.message_count || 0) + 2,
            last_active_at: new Date().toISOString(),
          })
          .eq("id", activeSessionId);
      } catch (persistError) {
        console.error("[ask] Message persistence error:", persistError);
        // Non-fatal: continue to return answer
      }
    }

    // =========================================================================
    // 11. INCREMENT USAGE + RETURN RESPONSE
    // =========================================================================
    const { data: newUsage, error: incrementError } = await supabase.rpc(
      "increment_usage",
      { _user_id: userId, _group_id: groupId }
    );

    if (incrementError) {
      console.error(
        "[ask] Failed to increment usage:",
        incrementError.message
      );
    }

    const updatedUsage: UsageInfo = newUsage?.[0]
      ? {
          daily: {
            used: newUsage[0].daily_count,
            limit: newUsage[0].daily_limit,
          },
          monthly: {
            used: newUsage[0].monthly_count,
            limit: newUsage[0].monthly_limit,
          },
        }
      : usageInfo;

    console.log(
      `[ask] Success \u2014 mode: ${mode}, domain: ${domain}, citations: ${citations.length}, answer length: ${answer.length}`
    );

    return jsonResponse({
      answer,
      citations,
      usage: updatedUsage,
      mode,
      sessionId: activeSessionId,
    });
  } catch (error) {
    console.error("[ask] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
