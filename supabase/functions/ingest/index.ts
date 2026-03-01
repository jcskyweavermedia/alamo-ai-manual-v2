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
  mode?: "pipeline" | "translate" | "generate-dish-guide" | "batch-extract";
  sessionId?: string;
  productTable: string;
  content: string;
  language?: "en" | "es";
  department?: "kitchen" | "bar";
}

interface TranslateRequest {
  mode: "translate";
  productTable: string;
  productId: string;
  targetLang: string;
  fields: Array<{ fieldPath: string; sourceText: string }>;
}

// EnrichSuggestion removed — web enrichment is now built into
// the two-call pipeline in ingest-vision and ingest-file edge functions

interface PrepRecipeDraft {
  name: string;
  prepType: string;
  department?: "kitchen" | "bar";
  tags: string[];
  yieldQty: number;
  yieldUnit: string;
  shelfLifeValue: number;
  shelfLifeUnit: string;
  ingredients: IngredientGroup[];
  procedure: ProcedureGroup[];
  batchScaling: BatchScaling;
  trainingNotes: TrainingNotes;
  isFeatured: boolean;
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
  isFeatured: boolean;
  confidence: number;
  missingFields: string[];
  aiMessage: string;
}

interface CocktailIngredientItem {
  name: string;
  quantity: number;
  unit: string;
  prep_recipe_ref: string | null;
}

interface CocktailIngredientGroup {
  group_name: string;
  order: number;
  items: CocktailIngredientItem[];
}

interface CocktailDraft {
  name: string;
  style: string;
  glass: string;
  ingredients: CocktailIngredientGroup[];
  keyIngredients: string;
  procedure: Array<{ step: number; instruction: string }>;
  tastingNotes: string;
  description: string;
  notes: string;
  isTopSeller: boolean;
  isFeatured: boolean;
  confidence: number;
  missingFields: string[];
  aiMessage: string;
}

interface PlateComponentItem {
  type: "raw" | "prep_recipe";
  name: string;
  quantity: number;
  unit: string;
  order: number;
  allergens?: string[];
  prep_recipe_ref?: string;
}

interface PlateComponentGroup {
  group_name: string;
  order: number;
  items: PlateComponentItem[];
}

interface RecipeImage {
  url: string;
  alt?: string;
  caption?: string;
}

interface PlateSpecDraft {
  name: string;
  slug: string;
  plateType: string;
  menuCategory: string;
  tags: string[];
  allergens: string[];
  components: PlateComponentGroup[];
  assemblyProcedure: ProcedureGroup[];
  notes: string;
  images: RecipeImage[];
  confidence?: number;
  missingFields?: string[];
  aiMessage?: string;
  dishGuide?: unknown;
  dishGuideStale?: boolean;
}

interface FohPlateSpecDraft {
  menuName: string;
  slug: string;
  plateType: string;
  plateSpecId: string | null;
  shortDescription: string;
  detailedDescription: string;
  ingredients: string[];
  keyIngredients: string[];
  flavorProfile: string[];
  allergens: string[];
  allergyNotes: string;
  upsellNotes: string;
  notes: string;
  image: string | null;
  isTopSeller: boolean;
  isFeatured: boolean;
}

interface GenerateDishGuideRequest {
  mode: "generate-dish-guide";
  sessionId: string;
  plateSpec: PlateSpecDraft;
  productTable?: string;
}

type ProductDraft = PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft;

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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
      department: {
        type: "string",
        enum: ["kitchen", "bar"],
        description: "kitchen = BOH food prep, bar = syrups, infusions, bitters, shrubs, cordials, tinctures",
      },
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
      isFeatured: { type: "boolean", description: "Whether this item is a featured item" },
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
      "department",
      "tags",
      "yieldQty",
      "yieldUnit",
      "shelfLifeValue",
      "shelfLifeUnit",
      "ingredients",
      "procedure",
      "batchScaling",
      "trainingNotes",
      "isFeatured",
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
      isFeatured: { type: "boolean", description: "Whether this item is a featured item" },
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
      "isTopSeller", "isFeatured", "confidence", "missingFields", "aiMessage",
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
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_name: { type: "string", description: "Group label, e.g., 'Ingredients' or 'Garnish'" },
            order: { type: "number", description: "Display order (1-based)" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Ingredient name" },
                  quantity: { type: "number", description: "Amount (0 if not specified)" },
                  unit: { type: "string", description: "Unit of measurement (oz, dash, ml, etc.)" },
                  prep_recipe_ref: { type: ["string", "null"], description: "Slug of a house-made bar prep recipe if the user says this ingredient is made in-house (e.g. 'mojito-syrup'). Use kebab-case slug derived from the recipe name. null if not a house-made ingredient." },
                },
                required: ["name", "quantity", "unit", "prep_recipe_ref"],
                additionalProperties: false,
              },
            },
          },
          required: ["group_name", "order", "items"],
          additionalProperties: false,
        },
        description: "Structured ingredient groups with individual items (same format as prep recipes)",
      },
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
      isFeatured: { type: "boolean", description: "Whether this item is a featured item" },
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
      "isTopSeller", "isFeatured", "confidence", "missingFields", "aiMessage",
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
  plate_specs: { chat: "ingest-chat-plate-spec", extract: "ingest-extract-plate-spec" },
};

/** Bar prep uses separate prompts when department === 'bar' */
const BAR_PREP_PROMPT_SLUGS = { chat: "ingest-chat-bar-prep", extract: "ingest-extract-bar-prep" };

// =============================================================================
// OPENAI STRUCTURED OUTPUT SCHEMA (PlateSpecDraft)
// =============================================================================

const PLATE_SPEC_DRAFT_SCHEMA = {
  name: "plate_spec_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      plateType: { type: "string", enum: ["entree", "appetizer", "side", "dessert"] },
      menuCategory: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      allergens: { type: "array", items: { type: "string" } },
      components: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_name: { type: "string" },
            order: { type: "integer" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["raw", "prep_recipe"] },
                  name: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                  order: { type: "integer" },
                  allergens: {
                    type: ["array", "null"],
                    items: { type: "string" },
                    description: "Allergen tags for raw items; null for prep_recipe items",
                  },
                  prep_recipe_ref: {
                    type: ["string", "null"],
                    description: "Slug of linked prep recipe; null for raw items",
                  },
                },
                required: ["type", "name", "quantity", "unit", "order", "allergens", "prep_recipe_ref"],
                additionalProperties: false,
              },
            },
          },
          required: ["group_name", "order", "items"],
          additionalProperties: false,
        },
      },
      assemblyProcedure: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_name: { type: "string" },
            order: { type: "integer" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step_number: { type: "integer" },
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
      notes: { type: "string" },
      isFeatured: { type: "boolean", description: "Whether this item is a featured item" },
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
      "plateType",
      "menuCategory",
      "tags",
      "allergens",
      "components",
      "assemblyProcedure",
      "notes",
      "isFeatured",
      "confidence",
      "missingFields",
      "aiMessage",
    ],
    additionalProperties: false,
  },
};

// =============================================================================
// DISH GUIDE STRUCTURED OUTPUT SCHEMA (for generate-dish-guide mode)
// =============================================================================

const DISH_GUIDE_SCHEMA = {
  name: "dish_guide",
  strict: true,
  schema: {
    type: "object",
    properties: {
      shortDescription: { type: "string" },
      detailedDescription: { type: "string" },
      flavorProfile: { type: "array", items: { type: "string" } },
      allergyNotes: { type: "string" },
      upsellNotes: { type: "string" },
    },
    required: ["shortDescription", "detailedDescription", "flavorProfile", "allergyNotes", "upsellNotes"],
    additionalProperties: false,
  },
};

// =============================================================================
// EXTRACT RESPONSE SCHEMA — built dynamically per product type
// =============================================================================

function buildExtractResponseSchema(productTable: string) {
  let draftSchema;
  if (productTable === "wines") {
    draftSchema = WINE_DRAFT_SCHEMA.schema;
  } else if (productTable === "cocktails") {
    draftSchema = COCKTAIL_DRAFT_SCHEMA.schema;
  } else if (productTable === "plate_specs") {
    draftSchema = PLATE_SPEC_DRAFT_SCHEMA.schema;
  } else {
    draftSchema = PREP_RECIPE_DRAFT_SCHEMA.schema;
  }

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
    description: "Search existing prep recipes in the database. Use this when the user mentions an ingredient or sub-recipe that might already exist (e.g., 'chimichurri', 'demi-glace', 'compound butter', 'honey-ginger syrup'). Use filter_department to narrow results.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for recipe name or ingredient",
        },
        filter_department: {
          type: "string",
          enum: ["kitchen", "bar"],
          description: "Filter by department. Use 'bar' when searching for syrups, infusions, bitters, shrubs. Use 'kitchen' for sauces, stocks, marinades. Omit to search all.",
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
  const { content, productTable, language = "en", sessionId: existingSessionId, department: reqDepartment } = body;

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
  // Use request-level department (first message) OR draft-level department (subsequent messages)
  // deno-lint-ignore no-explicit-any
  const isBarPrep = productTable === "prep_recipes" &&
    ((currentDraft as any).department === "bar" || reqDepartment === "bar");
  const promptSlugs = isBarPrep ? BAR_PREP_PROMPT_SLUGS : PROMPT_SLUG_MAP[productTable];

  const { data: chatPromptRow, error: chatPromptError } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", promptSlugs?.chat || "ingest-chat-prep-recipe")
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
          const filterDept = fnArgs.filter_department || null;
          console.log(`[ingest] search_recipes: "${query}" dept=${filterDept}`);

          const { data, error: rpcError } = await supabase.rpc("search_recipes", {
            search_query: query,
            query_embedding: null,
            result_limit: 5,
            filter_department: filterDept,
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
    .eq("slug", promptSlugs?.extract || "ingest-extract-prep-recipe")
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
    // Preserve fields that AI extraction never returns (images, dishGuide, etc.)
    // because `additionalProperties: false` strips them from the schema output.
    const preservedImages = (currentDraft as any).images;        // RecipeImage[] | undefined
    const preservedDishGuide = (currentDraft as any).dishGuide;  // FohPlateSpecDraft | null | undefined
    const preservedDishGuideStale = (currentDraft as any).dishGuideStale; // boolean | undefined
    const preservedImage = (currentDraft as any).image;          // string | null (wine/cocktail)

    currentDraft = extractResult.draft as unknown as Record<string, unknown>;

    // Add slug (not in AI schema, needed by frontend)
    if (extractResult.draft.name) {
      // deno-lint-ignore no-explicit-any
      (currentDraft as any).slug = generateSlug(extractResult.draft.name);
    }
    // Type-specific defaults + restore preserved fields
    if (productTable === "wines") {
      // Wine uses single `image` field — preserve user-uploaded image
      (currentDraft as Record<string, unknown>).image =
        (currentDraft as Record<string, unknown>).image ?? preservedImage ?? null;
    } else if (productTable === "cocktails") {
      // Cocktail uses single `image` field — preserve user-uploaded image
      (currentDraft as Record<string, unknown>).image =
        (currentDraft as Record<string, unknown>).image ?? preservedImage ?? null;
    } else {
      // Prep recipe & plate spec use `images` array — preserve user-uploaded images
      // deno-lint-ignore no-explicit-any
      (currentDraft as any).images =
        Array.isArray((currentDraft as any).images) && (currentDraft as any).images.length > 0
          ? (currentDraft as any).images
          : (preservedImages || []);
    }

    // Cocktail defaults: ensure ingredients array exists
    if (productTable === "cocktails") {
      if (!(currentDraft as any).ingredients) (currentDraft as any).ingredients = [];
    }

    // Prep recipe defaults: ensure department is set (use request-level department as fallback)
    if (productTable === "prep_recipes") {
      if (!(currentDraft as any).department) (currentDraft as any).department = reqDepartment || "kitchen";
    }

    // Restore plate spec-specific fields (dishGuide, dishGuideStale)
    if (productTable === "plate_specs") {
      if (preservedDishGuide !== undefined) {
        (currentDraft as any).dishGuide = (currentDraft as any).dishGuide ?? preservedDishGuide;
      }
      if (preservedDishGuideStale !== undefined) {
        // If AI updated the BOH draft, mark dishGuide as stale
        (currentDraft as any).dishGuideStale = preservedDishGuide ? true : false;
      }
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
    // Cocktail defaults: ensure ingredients array exists
    if (productTable === "cocktails") {
      if (!d.ingredients) d.ingredients = [];
    }
    // Prep recipe defaults: ensure department is set (use request-level department as fallback)
    if (productTable === "prep_recipes") {
      if (!d.department) d.department = reqDepartment || "kitchen";
    }
    // Plate spec defaults: align wire format with client PlateSpecDraft type
    if (productTable === "plate_specs") {
      if (d.dishGuide === undefined) d.dishGuide = null;
      if (d.dishGuideStale === undefined) d.dishGuideStale = false;
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
// GENERATE DISH GUIDE HANDLER
// =============================================================================

/**
 * Extract all unique prep_recipe_ref slugs from plate spec components.
 */
function extractPrepRecipeRefsFromPlateSpec(plateSpec: PlateSpecDraft): string[] {
  const refs = new Set<string>();
  for (const group of plateSpec.components || []) {
    for (const item of group.items || []) {
      if (item.type === "prep_recipe" && item.prep_recipe_ref) {
        refs.add(item.prep_recipe_ref);
      }
    }
  }
  return [...refs];
}

/**
 * Fetch full prep recipe rows by slug (batched query, max 10).
 */
// deno-lint-ignore no-explicit-any
async function fetchLinkedPrepRecipes(supabase: any, slugs: string[]): Promise<any[]> {
  if (!slugs.length) return [];

  const limited = slugs.slice(0, 10);
  if (slugs.length > 10) {
    console.warn(`[ingest] Dish guide: ${slugs.length} prep_recipe refs found, using first 10`);
  }

  try {
    const { data, error } = await supabase
      .from("prep_recipes")
      .select("slug, name, prep_type, ingredients, procedure, tags, yield_qty, yield_unit, shelf_life_value, shelf_life_unit")
      .in("slug", limited)
      .eq("status", "published");

    if (error) {
      console.error("[ingest] Linked prep recipe fetch error:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[ingest] Linked prep recipe fetch exception:", err);
    return [];
  }
}

/**
 * Serialize a linked prep recipe for inclusion in dish guide AI context.
 */
// deno-lint-ignore no-explicit-any
function serializeLinkedRecipe(recipe: any): string {
  const parts: (string | null)[] = [
    `Linked Recipe: ${recipe.name} (${recipe.slug})`,
    recipe.prep_type ? `Type: ${recipe.prep_type}` : null,
    recipe.yield_qty ? `Yield: ${recipe.yield_qty} ${recipe.yield_unit || ""}` : null,
  ];

  // Ingredients with allergen tags
  const allAllergens = new Set<string>();
  if (Array.isArray(recipe.ingredients)) {
    // deno-lint-ignore no-explicit-any
    const items = recipe.ingredients.flatMap((g: any) =>
      // deno-lint-ignore no-explicit-any
      g.items?.map((i: any) => {
        let text = i.name;
        if (i.quantity != null) {
          const unit = i.unit ? ` ${i.unit}` : "";
          text = `${i.quantity}${unit} ${text}`;
        }
        if (i.allergens?.length) {
          text += ` [ALLERGENS: ${i.allergens.join(", ")}]`;
          for (const a of i.allergens) allAllergens.add(a);
        }
        return text;
      }) || []
    );
    if (items.length) parts.push(`Ingredients: ${items.join(", ")}`);
  }

  if (allAllergens.size) {
    parts.push(`Contains Allergens: ${[...allAllergens].join(", ")}`);
  }

  // Procedure
  if (Array.isArray(recipe.procedure)) {
    // deno-lint-ignore no-explicit-any
    const steps = recipe.procedure.flatMap((g: any) =>
      // deno-lint-ignore no-explicit-any
      g.steps?.map((s: any) => s.instruction) || []
    );
    if (steps.length) parts.push(`Procedure: ${steps.join(" ")}`);
  }

  return parts.filter(Boolean).join("\n");
}

/**
 * Build AI context string from plate spec + linked prep recipes.
 */
// deno-lint-ignore no-explicit-any
function buildDishGuideContext(plateSpec: PlateSpecDraft, linkedRecipes: any[]): string {
  const parts: string[] = [];

  // Plate spec metadata
  parts.push(`Plate Spec: ${plateSpec.name}`);
  parts.push(`Plate Type: ${plateSpec.plateType}`);
  if (plateSpec.menuCategory) parts.push(`Menu Category: ${plateSpec.menuCategory}`);
  if (plateSpec.tags?.length) parts.push(`Tags: ${plateSpec.tags.join(", ")}`);
  if (plateSpec.allergens?.length) parts.push(`Allergens: ${plateSpec.allergens.join(", ")}`);

  // Components
  if (plateSpec.components?.length) {
    parts.push("\nComponents:");
    for (const group of plateSpec.components) {
      parts.push(`  ${group.group_name}:`);
      for (const item of group.items || []) {
        const qty = item.quantity != null ? `${item.quantity}` : "";
        const unit = item.unit ? ` ${item.unit}` : "";
        const prefix = qty || unit ? `${qty}${unit} ` : "";
        const type = item.type === "prep_recipe" ? " [prep recipe]" : "";
        const ref = item.prep_recipe_ref ? ` (ref: ${item.prep_recipe_ref})` : "";
        const allergenStr = item.allergens?.length ? ` [ALLERGENS: ${item.allergens.join(", ")}]` : "";
        parts.push(`    - ${prefix}${item.name}${type}${ref}${allergenStr}`);
      }
    }
  }

  // Assembly procedure
  if (plateSpec.assemblyProcedure?.length) {
    parts.push("\nAssembly Procedure:");
    for (const group of plateSpec.assemblyProcedure) {
      parts.push(`  ${group.group_name}:`);
      for (const step of group.steps || []) {
        const critical = step.critical ? " [CRITICAL]" : "";
        parts.push(`    ${step.step_number}. ${step.instruction}${critical}`);
      }
    }
  }

  if (plateSpec.notes) parts.push(`\nNotes: ${plateSpec.notes}`);

  // Linked prep recipes
  if (linkedRecipes.length) {
    parts.push("\n--- Linked Prep Recipes (referenced by components above) ---");
    for (const recipe of linkedRecipes) {
      parts.push(serializeLinkedRecipe(recipe));
      parts.push(""); // blank line between recipes
    }
  }

  return parts.join("\n");
}

async function handleGenerateDishGuide(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  body: GenerateDishGuideRequest,
  openaiApiKey: string
): Promise<Response> {
  const { sessionId, plateSpec } = body;

  console.log(`[ingest] Generate dish guide: sessionId=${sessionId}, plate="${plateSpec?.name}"`);

  // -------------------------------------------------------------------------
  // 1. Validate input
  // -------------------------------------------------------------------------
  if (!plateSpec || !plateSpec.name) {
    return errorResponse("bad_request", "plateSpec with name is required", 400);
  }

  if (!plateSpec.components?.length) {
    return errorResponse("bad_request", "plateSpec must have at least one component group", 400);
  }

  // -------------------------------------------------------------------------
  // 2. Resolve linked prep_recipes server-side
  // -------------------------------------------------------------------------
  const prepRecipeRefs = extractPrepRecipeRefsFromPlateSpec(plateSpec);
  console.log(`[ingest] Dish guide: ${prepRecipeRefs.length} prep_recipe ref(s) to resolve`);

  const linkedRecipes = await fetchLinkedPrepRecipes(supabase, prepRecipeRefs);
  console.log(`[ingest] Dish guide: ${linkedRecipes.length} linked recipe(s) fetched`);

  // -------------------------------------------------------------------------
  // 3. Load the generate-dish-guide prompt from ai_prompts
  // -------------------------------------------------------------------------
  const { data: promptRow, error: promptError } = await supabase
    .from("ai_prompts")
    .select("prompt_en")
    .eq("slug", "generate-dish-guide")
    .eq("is_active", true)
    .single();

  // Fallback system prompt if DB prompt not found
  const defaultSystemPrompt = `You are a menu copywriter and server training specialist for Alamo Prime, an upscale steakhouse.

Given a detailed plate spec (components, assembly procedure, allergens, and linked prep recipes), generate a Front-of-House Dish Guide for server training and guest communication.

Output:
- shortDescription: A natural, enthusiastic 2-3 sentence sales pitch a server would say to a guest. Include flavor highlights and what makes this dish special. Write it as confident, warm dialogue — the kind of thing a top-performing server at a premium steakhouse would actually say tableside.
- detailedDescription: 4-6 sentences that tell the story of the dish. Weave in notable preparation details (e.g., "marinated for 24 hours", "slow-roasted over mesquite", "hand-pulled daily") and any nuances that make it unique. The tone should educate the server while also selling the dish — a server who reads this should feel the passion behind the plate and be able to relay that excitement to the guest.
- flavorProfile: 3-6 flavor descriptors (e.g., "smoky", "rich", "herbaceous", "bright acidity").
- allergyNotes: Practical allergy guidance for servers. List ALL allergens found in components and linked recipes. Include cross-contamination notes if relevant.
- upsellNotes: 2-3 selling points and pairing suggestions using GENERAL CATEGORIES ONLY. Never recommend a specific wine, cocktail, or menu item by name — items may change. Instead suggest categories like "a bold red wine", "a full-bodied Malbec-style red", "a refreshing citrus cocktail", "one of our signature sides", "a classic accompaniment like creamed spinach or roasted potatoes". If the dish already includes sides, focus on beverage pairings. If it has no sides, suggest adding one.

Rules:
- Be accurate — reflect the actual ingredients and preparation from the plate spec
- Include ALL allergens from both raw ingredients and linked prep recipes
- Use warm, appetizing language appropriate for an upscale steakhouse
- Do not invent ingredients or details not present in the plate spec
- NEVER reference specific menu items by name in upsellNotes — use general categories only`;

  let systemPrompt: string;
  if (promptError || !promptRow) {
    console.warn("[ingest] Dish guide prompt not found in DB, using default");
    systemPrompt = defaultSystemPrompt;
  } else {
    systemPrompt = promptRow.prompt_en;
  }

  // -------------------------------------------------------------------------
  // 4. Build AI context string
  // -------------------------------------------------------------------------
  const contextText = buildDishGuideContext(plateSpec, linkedRecipes);

  console.log(`[ingest] Dish guide context: ${contextText.length} chars`);

  // -------------------------------------------------------------------------
  // 5. Call OpenAI with structured output
  // -------------------------------------------------------------------------
  console.log("[ingest] Dish guide: calling OpenAI (gpt-5-mini-2025-08-07, json_schema)...");

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini-2025-08-07",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a Front-of-House Dish Guide for the following plate spec:\n\n${contextText}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: DISH_GUIDE_SCHEMA,
        },
        max_completion_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[ingest] Dish guide OpenAI error ${aiResponse.status}:`, errText);
      return errorResponse("ai_error", `AI error: ${errText.slice(0, 200)}`, 500);
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content;

    if (!raw) {
      console.error("[ingest] Dish guide returned empty content");
      return errorResponse("ai_error", "Dish guide generation returned empty response", 500);
    }

    let aiOutput: {
      shortDescription: string;
      detailedDescription: string;
      flavorProfile: string[];
      allergyNotes: string;
      upsellNotes: string;
    };

    try {
      aiOutput = JSON.parse(raw);
    } catch (_parseError) {
      console.error("[ingest] Dish guide returned invalid JSON:", raw);
      return errorResponse("ai_error", "Dish guide generation returned invalid JSON", 500);
    }

    // -------------------------------------------------------------------------
    // 6. Compute auto-fill fields server-side
    // -------------------------------------------------------------------------
    const menuName = plateSpec.name;
    const plateType = plateSpec.plateType;

    // Deduplicated allergens: union of all component item allergens + plate spec allergens
    const allergenSet = new Set<string>();
    for (const a of plateSpec.allergens || []) allergenSet.add(a);
    for (const group of plateSpec.components || []) {
      for (const item of group.items || []) {
        for (const a of item.allergens || []) allergenSet.add(a);
      }
    }
    // Also include allergens from linked prep recipes
    for (const recipe of linkedRecipes) {
      if (Array.isArray(recipe.ingredients)) {
        // deno-lint-ignore no-explicit-any
        for (const g of recipe.ingredients as any[]) {
          // deno-lint-ignore no-explicit-any
          for (const i of (g.items || []) as any[]) {
            if (Array.isArray(i.allergens)) {
              for (const a of i.allergens) allergenSet.add(a);
            }
          }
        }
      }
    }
    const allergens = [...allergenSet];

    // All component item names
    const ingredientsList: string[] = [];
    for (const group of plateSpec.components || []) {
      for (const item of group.items || []) {
        ingredientsList.push(item.name);
      }
    }

    // Key ingredients: first item from each component group (most prominent per station)
    const keyIngredients: string[] = [];
    for (const group of plateSpec.components || []) {
      if (group.items?.length) {
        keyIngredients.push(group.items[0].name);
      }
    }

    // Image: first plate spec image URL if any
    const image = plateSpec.images?.length ? plateSpec.images[0].url : null;

    // -------------------------------------------------------------------------
    // 7. Merge auto-fill + AI output into FohPlateSpecDraft
    // -------------------------------------------------------------------------
    const dishGuide: FohPlateSpecDraft = {
      menuName,
      slug: generateSlug(menuName),
      plateType,
      plateSpecId: null, // set at publish time
      shortDescription: aiOutput.shortDescription,
      detailedDescription: aiOutput.detailedDescription,
      ingredients: ingredientsList,
      keyIngredients,
      flavorProfile: aiOutput.flavorProfile,
      allergens,
      allergyNotes: aiOutput.allergyNotes,
      upsellNotes: aiOutput.upsellNotes,
      notes: "",
      image,
      isTopSeller: false,
      isFeatured: false,
    };

    console.log(`[ingest] Dish guide generated: "${menuName}", ${allergens.length} allergens, ${keyIngredients.length} key ingredients`);

    // -------------------------------------------------------------------------
    // 8. Return response
    // -------------------------------------------------------------------------
    return new Response(JSON.stringify({ dishGuide }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ingest] Dish guide generation exception:", err);
    return errorResponse("server_error", "Dish guide generation failed unexpectedly", 500);
  }
}

// =============================================================================
// TRANSLATE HANDLER
// =============================================================================

async function handleTranslate(
  supabase: any,
  userId: string,
  body: TranslateRequest,
  openaiApiKey: string
): Promise<Response> {
  const { productTable, productId, targetLang, fields } = body;

  console.log(`[ingest] Translate: table=${productTable}, id=${productId}, lang=${targetLang}, fields=${fields.length}`);

  if (!productId) {
    return errorResponse("bad_request", "productId is required for translate mode", 400);
  }
  if (!fields || !fields.length) {
    return errorResponse("bad_request", "fields array is required and must not be empty", 400);
  }
  if (fields.length > 50) {
    return errorResponse("bad_request", "Maximum 50 fields per translation batch", 400);
  }

  // Build the translation prompt
  const fieldsForAI = fields.map((f, i) => `[${i}] ${f.fieldPath}: "${f.sourceText}"`).join("\n");

  const systemPrompt = `You are a professional bilingual translator for a high-end steakhouse restaurant.
Translate the following English restaurant operations text to Latin American Spanish.

Rules:
- Maintain all culinary terminology accurately (e.g., "sear" → "sellar", "deglaze" → "deglasear")
- Keep cooking measurements in their original units (°F, oz, cups) — do not convert
- Preserve the instructional, professional tone
- Keep proper nouns unchanged (brand names, recipe names)
- For ingredient names, use Latin American Spanish variants (not Castilian)
- If a term has no standard Spanish equivalent, keep the English term in quotes
- Translate each field independently; do not add or remove content
- Return ONLY the JSON object with translations array`;

  const userContent = `Translate these ${fields.length} fields to ${targetLang}:\n\n${fieldsForAI}`;

  const translationSchema = {
    name: "translation_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        translations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "number", description: "The field index from the input" },
              translated_text: { type: "string" },
            },
            required: ["index", "translated_text"],
            additionalProperties: false,
          },
        },
      },
      required: ["translations"],
      additionalProperties: false,
    },
  };

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: translationSchema,
        },
        max_completion_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[ingest] Translate OpenAI error ${aiResponse.status}:`, errText);
      return errorResponse("ai_error", `Translation AI error: ${errText.slice(0, 200)}`, 500);
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content;

    if (!raw) {
      console.error("[ingest] Translate returned empty content");
      return errorResponse("ai_error", "Translation returned empty response", 500);
    }

    const parsed = JSON.parse(raw);

    // Map indices back to field paths
    const translations = (parsed.translations || []).map((t: any) => ({
      fieldPath: fields[t.index]?.fieldPath || `unknown_${t.index}`,
      translatedText: t.translated_text,
    }));

    console.log(`[ingest] Translate complete: ${translations.length} fields translated`);

    return new Response(JSON.stringify({ translations }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ingest] Translate exception:", err);
    return errorResponse("server_error", "Translation failed unexpectedly", 500);
  }
}

// =============================================================================
// BATCH EXTRACT — Beer/Liquor bulk ingestion
// =============================================================================

const BEER_LIQUOR_BATCH_SCHEMA = {
  name: "beer_liquor_batch",
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: ["Beer", "Liquor"] },
            subcategory: {
              type: "string",
              description:
                "Beer: IPA, Lager, Stout, Pilsner, Wheat, Ale, Bock, Porter, Sour, etc. Liquor: Bourbon, Scotch, Vodka, Gin, Rum, Tequila, Mezcal, Whiskey, Brandy, Cognac, etc.",
            },
            producer: { type: "string", description: "Brewery or distillery" },
            country: { type: "string" },
            description: {
              type: "string",
              description: "1-3 sentence product description",
            },
            style: {
              type: "string",
              description: "Specific style/flavor profile",
            },
            notes: {
              type: "string",
              description: "Tasting notes, service temp, pairings",
            },
            isFeatured: { type: "boolean" },
            confidence: {
              type: "number",
              description: "0-1 confidence score based on completeness of extracted info",
            },
          },
          required: [
            "name",
            "category",
            "subcategory",
            "producer",
            "country",
            "description",
            "style",
            "notes",
            "isFeatured",
            "confidence",
          ],
          additionalProperties: false,
        },
      },
      aiMessage: { type: "string" },
    },
    required: ["items", "aiMessage"],
    additionalProperties: false,
  },
};

const BATCH_CHUNK_SIZE = 25;

/**
 * Split text into chunks of roughly `chunkSize` non-empty lines each.
 */
function chunkText(text: string, chunkSize: number): string[] {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length <= chunkSize) return [lines.join("\n")];

  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize).join("\n"));
  }
  return chunks;
}

interface BatchExtractRequest {
  mode: "batch-extract";
  content: string;
  sessionId?: string;
}

async function handleBatchExtract(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  body: BatchExtractRequest,
  openaiApiKey: string
): Promise<Response> {
  const { content, sessionId: existingSessionId } = body;

  console.log(
    `[ingest] Batch extract: sessionId=${existingSessionId || "new"}, contentLen=${content.length}`
  );

  // -------------------------------------------------------------------------
  // 1. Load or create session
  // -------------------------------------------------------------------------
  let sessionId: string;

  if (existingSessionId) {
    const { data: session, error: sessionError } = await supabase
      .from("ingestion_sessions")
      .select("id, status, created_by")
      .eq("id", existingSessionId)
      .single();

    if (sessionError || !session) {
      return errorResponse("not_found", "Ingestion session not found", 404);
    }
    if (session.created_by !== userId) {
      return errorResponse("Forbidden", "You do not own this session", 403);
    }
    sessionId = session.id;
  } else {
    const { data: session, error: sessionError } = await supabase
      .from("ingestion_sessions")
      .insert({
        product_table: "beer_liquor_list",
        ingestion_method: "batch",
        status: "drafting",
        created_by: userId,
      })
      .select("id")
      .single();

    if (sessionError) {
      console.error("[ingest] Failed to create batch session:", sessionError.message);
      return errorResponse("server_error", "Failed to create ingestion session", 500);
    }
    sessionId = session.id;
    console.log(`[ingest] Created batch session: ${sessionId}`);
  }

  // -------------------------------------------------------------------------
  // 2. Fetch existing beer/liquor names for duplicate detection
  // -------------------------------------------------------------------------
  const { data: existingItems } = await supabase
    .from("beer_liquor_list")
    .select("id, name")
    .eq("status", "published");

  const existingMap = new Map<string, { id: string; name: string }>();
  if (existingItems) {
    for (const item of existingItems) {
      existingMap.set(item.name.toLowerCase().trim(), { id: item.id, name: item.name });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Chunk input and call AI for each chunk
  // -------------------------------------------------------------------------
  const chunks = chunkText(content, BATCH_CHUNK_SIZE);
  console.log(`[ingest] Batch: ${chunks.length} chunk(s) to process`);

  // deno-lint-ignore no-explicit-any
  const allItems: any[] = [];
  let lastAiMessage = "";
  const failedChunks: number[] = [];

  // Retry helper for transient OpenAI errors
  async function callWithRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 2000): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === retries) throw err;
        console.warn(`[ingest] Retry ${attempt + 1} after ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw new Error("Unreachable");
  }

  // Process all chunks in parallel with retry + partial failure handling
  const chunkResults = await Promise.allSettled(
    chunks.map(async (chunk, i) => {
      console.log(`[ingest] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);

      return callWithRetry(async () => {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-5-mini-2025-08-07",
            max_completion_tokens: 16000,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: `You are a beverage industry expert helping a steakhouse restaurant catalog their beer and liquor inventory.

Extract EVERY item from the provided list. For each item:
- Determine if it is Beer or Liquor
- Use your knowledge to fill in missing fields (country, subcategory, producer, style, etc.)
- Generate a professional 1-3 sentence description if not provided
- Generate tasting notes and service recommendations if not provided
- Set isFeatured to false by default
- Set confidence based on how much info was available vs inferred (1.0 = all provided, 0.5 = mostly inferred)

Common subcategories:
- Beer: IPA, Lager, Stout, Pilsner, Wheat, Ale, Bock, Porter, Sour, Pale Ale, Amber, Blonde, Hefeweizen
- Liquor: Bourbon, Scotch, Vodka, Gin, Rum, Tequila, Mezcal, Whiskey, Rye, Brandy, Cognac, Aperitif, Digestif, Amaro

Do NOT skip any items. Extract everything, even if information is minimal.`,
              },
              {
                role: "user",
                content: `Extract all beer and liquor items from this list:\n\n${chunk}`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: BEER_LIQUOR_BATCH_SCHEMA,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI API error (${response.status}): ${errText}`);
        }

        const aiResult = await response.json();
        const rawContent = aiResult.choices?.[0]?.message?.content;

        if (!rawContent) {
          throw new Error("No content in AI response");
        }

        const parsed = JSON.parse(rawContent);
        return { items: parsed.items || [], aiMessage: parsed.aiMessage || "" };
      });
    })
  );

  // Collect successful chunks + log failed ones
  for (const [i, result] of chunkResults.entries()) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
      if (result.value.aiMessage) lastAiMessage = result.value.aiMessage;
    } else {
      console.error(`[ingest] Chunk ${i + 1} failed:`, result.reason);
      failedChunks.push(i + 1);
    }
  }

  // If ALL chunks failed, return error
  if (allItems.length === 0 && failedChunks.length > 0) {
    return errorResponse(
      "ai_error",
      `All ${failedChunks.length} chunk(s) failed during extraction. Please try again.`,
      502
    );
  }

  // -------------------------------------------------------------------------
  // 4. Flag duplicates
  // -------------------------------------------------------------------------
  let duplicateCount = 0;
  const enrichedItems = allItems.map((item) => {
    const key = item.name.toLowerCase().trim();
    const existing = existingMap.get(key);
    if (existing) {
      duplicateCount++;
      return { ...item, duplicateOf: existing };
    }
    return { ...item, duplicateOf: null };
  });

  // -------------------------------------------------------------------------
  // 5. Save to session draft_data
  // -------------------------------------------------------------------------
  const { error: updateErr } = await supabase
    .from("ingestion_sessions")
    .update({
      draft_data: { items: enrichedItems },
      status: "drafting",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (updateErr) {
    console.error("[ingest] Failed to save batch draft:", updateErr.message);
  }

  console.log(
    `[ingest] Batch extract complete: ${enrichedItems.length} items, ${duplicateCount} duplicates`
  );

  return new Response(
    JSON.stringify({
      sessionId,
      items: enrichedItems,
      totalExtracted: enrichedItems.length,
      duplicates: duplicateCount,
      message: failedChunks.length > 0
        ? `Extracted ${enrichedItems.length} items. Chunks ${failedChunks.join(", ")} of ${chunks.length} failed — try re-extracting the remaining items.`
        : lastAiMessage,
      failedChunks,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

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
    // deno-lint-ignore no-explicit-any
    const body = (await req.json()) as any;

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

    // Batch extract mode — beer/liquor bulk ingestion, separate handler
    if (body.mode === "batch-extract") {
      if (!body.content?.trim()) {
        return errorResponse("bad_request", "content is required for batch extraction", 400);
      }
      return await handleBatchExtract(supabase, userId, body as BatchExtractRequest, openaiApiKey);
    }

    // Generate dish guide mode — separate request shape, no productTable/content required
    if (body.mode === "generate-dish-guide") {
      return await handleGenerateDishGuide(supabase, userId, body as GenerateDishGuideRequest, openaiApiKey);
    }

    // Cast to IngestRequest for pipeline/translate modes
    const ingestBody = body as IngestRequest;

    // Validate content (not required for translate mode)
    if (ingestBody.mode !== "translate" && !ingestBody.content?.trim()) {
      return errorResponse("bad_request", "content is required", 400);
    }

    // Validate productTable
    if (!ingestBody.productTable || !VALID_PRODUCT_TABLES.has(ingestBody.productTable)) {
      return errorResponse(
        "bad_request",
        `productTable must be one of: ${[...VALID_PRODUCT_TABLES].join(", ")}`,
        400
      );
    }

    // Validate language
    if (ingestBody.language && !["en", "es"].includes(ingestBody.language)) {
      return errorResponse("bad_request", 'language must be "en" or "es"', 400);
    }

    console.log(`[ingest] Table: ${ingestBody.productTable} | Lang: ${ingestBody.language || "en"}`);

    if (ingestBody.mode === "translate") {
      return await handleTranslate(supabase, userId, ingestBody as unknown as TranslateRequest, openaiApiKey);
    }

    return await handlePipeline(supabase, userId, ingestBody, openaiApiKey);
  } catch (error) {
    console.error("[ingest] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
