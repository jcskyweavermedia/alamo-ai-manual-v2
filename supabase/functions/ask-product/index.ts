/**
 * Ask Product Edge Function
 *
 * AI assistant for product-specific questions (dishes, wines, cocktails,
 * recipes, beer & liquor). Two modes:
 *
 * 1. Action mode — button presses with full card context (no search)
 * 2. Open question mode — freeform questions with OpenAI tool use
 *    (function calling) to search the right product table
 *
 * Auth: verify_jwt=false — manual JWT verification via getClaims()
 * (same pattern as /ask).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// =============================================================================
// TYPES
// =============================================================================

type ProductDomain = "dishes" | "wines" | "cocktails" | "recipes" | "beer_liquor";

const VALID_DOMAINS: ProductDomain[] = [
  "dishes",
  "wines",
  "cocktails",
  "recipes",
  "beer_liquor",
];

interface AskProductRequest {
  question: string;
  domain: ProductDomain;
  language: "en" | "es";
  groupId: string;
  action?: string;
  itemContext?: Record<string, unknown>;
}

interface ProductCitation {
  id: string;
  slug: string;
  name: string;
  domain: ProductDomain;
}

interface UsageInfo {
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

interface AskProductResponse {
  answer: string;
  citations: ProductCitation[];
  usage: UsageInfo;
  mode: "action" | "search";
}

interface ErrorResponse {
  error: string;
  message?: string;
  usage?: UsageInfo;
}

interface SearchResult {
  id: string;
  slug: string;
  name: string;
  snippet: string;
  plate_type?: string;
  is_top_seller?: boolean;
  varietal?: string;
  style?: string;
  category?: string;
  subcategory?: string;
  source_table?: string;
  combined_score?: number;
}

// =============================================================================
// CONSTANTS: ACTION PROMPTS
// =============================================================================

const ACTION_PROMPTS: Record<string, Record<string, string>> = {
  dishes: {
    practicePitch:
      "Generate a natural, enthusiastic 2-3 sentence sales pitch a server would say to a guest about this dish. Include flavor highlights and what makes it special. Write it as dialogue the server would actually say.",
    samplePitch:
      "Write a polished, confident server pitch for this dish (3-4 sentences). Include the dish name naturally, mention key ingredients, flavor profile, and a compelling reason to order it. Make it sound like a top-performing server at a premium steakhouse.",
    teachMe:
      "Teach the server about this dish in a structured way:\n1. What it is and why guests love it\n2. Key ingredients and flavor profile\n3. Allergen awareness\n4. Best upsell opportunities\n5. One insider tip",
    questions:
      "List 4-5 common guest questions about this dish and provide clear, confident answers. Include questions about allergens, preparation, modifications, and pairings.",
  },
  wines: {
    explainToGuest:
      "Generate a natural, confident 2-3 sentence wine recommendation a server would say to a guest. Mention the grape, region, and key tasting notes in accessible language (not overly technical).",
    wineDetails:
      "Write a polished sommelier-style pitch for this wine (3-4 sentences). Include producer story, tasting notes, and what makes it special. Make it sound knowledgeable but approachable.",
    foodPairings:
      "Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this wine. For each pairing, explain WHY it works (flavor complement, contrast, etc.). Use the wine's tasting notes and style to justify each pairing.",
    questions:
      "List 4-5 common guest questions about this wine and provide confident answers. Include questions about taste, food pairings, serving temperature, and comparisons to other wines.",
  },
  cocktails: {
    explainToGuest:
      "Generate a natural, enthusiastic 2-3 sentence cocktail recommendation a server would say to a guest. Mention the spirit base, key flavors, and who would enjoy it.",
    samplePitch:
      "Write a polished bartender-style pitch for this cocktail (3-4 sentences). Include the preparation method, flavor profile, and what makes it special at Alamo Prime.",
    foodPairings:
      "Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this cocktail. For each pairing, explain WHY it works (flavor complement, contrast, palate cleanse, etc.).",
    questions:
      "List 4-5 common guest questions about this cocktail and provide confident answers. Include questions about flavor, strength, spirit options, and modifications.",
  },
  recipes: {
    teachMe:
      "Teach the cook about this recipe in a structured way:\n1. What it is and its role on the menu\n2. Critical steps that must be followed exactly\n3. Common mistakes and how to avoid them\n4. Quality checks (what does \"done right\" look like?)\n5. Storage and shelf life reminders",
    quizMe:
      "Generate 5 quiz questions about this recipe to test the cook's knowledge. Mix question types:\n- 2 knowledge recall (ingredients, temps, times)\n- 2 situational (what do you do if...)\n- 1 quality check (how do you know when...)\nProvide answers after all questions.",
    questions:
      "Answer the question using the recipe data provided. Focus on practical, actionable information relevant to kitchen execution.",
  },
  beer_liquor: {
    teachMe:
      "Teach the server about this beverage in a structured way:\n1. What it is (style, origin, producer)\n2. Tasting notes and flavor profile\n3. How to serve it (glassware, temperature)\n4. Who typically orders it (guest profile)\n5. One interesting fact or talking point",
    suggestPairing:
      "Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this beverage. For each pairing, explain WHY it works. Consider the beverage's flavor profile, weight, and carbonation.",
    questions:
      "Answer the question using the product data provided. Focus on practical service knowledge.",
  },
};

// =============================================================================
// CONSTANTS: LANGUAGE INSTRUCTIONS
// =============================================================================

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Respond in English.",
  es: "Responde en español. El contenido del producto está en inglés — tradúcelo naturalmente al español en tu respuesta.",
};

// =============================================================================
// CONSTANTS: SEARCH TOOLS (OpenAI function calling)
// =============================================================================

// deno-lint-ignore no-explicit-any
const SEARCH_TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "search_dishes",
      description:
        "Search the dish menu (appetizers, entrees, sides, desserts). Use when the question is about a specific dish, menu item, food allergens, or dish recommendations.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Search query — key terms about the dish (e.g., "ribeye steak", "gluten free appetizer", "top seller entree")',
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
        "Search the wine list. Use when the question is about wines, varietals, regions, or wine pairings.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Search query — key terms about wine (e.g., "full bodied red", "sauvignon blanc", "bordeaux")',
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
        "Search the cocktail menu. Use when the question is about cocktails, mixed drinks, or cocktail ingredients.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Search query — key terms about cocktails (e.g., "bourbon classic", "espresso martini", "tiki")',
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
        "Search kitchen recipes (prep recipes and plate specs). Use when the question is about how to make something, ingredients, cooking procedures, or kitchen prep.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Search query — key terms about recipes (e.g., "chimichurri", "demi glace", "ribeye plating")',
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
        "Search the beer and spirits list. Use when the question is about beers, liquors, spirits, bourbon, whiskey, or draft selections.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Search query — key terms about beer/liquor (e.g., "bourbon", "IPA", "tequila", "scotch")',
          },
        },
        required: ["query"],
      },
    },
  },
];

// =============================================================================
// CONSTANTS: DOMAIN HINTS
// =============================================================================

const DOMAIN_HINT: Record<ProductDomain, string> = {
  dishes: "The user is currently viewing the dish menu.",
  wines: "The user is currently viewing the wine list.",
  cocktails: "The user is currently viewing the cocktail menu.",
  recipes: "The user is currently viewing kitchen recipes.",
  beer_liquor: "The user is currently viewing the beer & spirits list.",
};

// =============================================================================
// CONSTANTS: PAIRING ACTIONS
// =============================================================================

const PAIRING_ACTIONS = new Set(["foodPairings", "suggestPairing"]);

// Maps search function names to their product domain (for citation tagging)
const SEARCH_FN_TO_DOMAIN: Record<string, ProductDomain> = {
  search_dishes: "dishes",
  search_wines: "wines",
  search_cocktails: "cocktails",
  search_recipes: "recipes",
  search_beer_liquor: "beer_liquor",
};

// =============================================================================
// HELPER: serializeItemContext
// =============================================================================

function serializeItemContext(
  domain: ProductDomain,
  item: Record<string, unknown>
): string {
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
        const names = ingredients.flatMap(
          // deno-lint-ignore no-explicit-any
          (g: any) => g.items?.map((i: any) => i.name) || []
        );
        if (names.length) parts.push(`Ingredients: ${names.join(", ")}`);
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

      // plate_specs.components: JSONB [{ group_name, items: [{ name }] }]
      // deno-lint-ignore no-explicit-any
      const components = item.components as any[] | null;
      if (Array.isArray(components)) {
        const names = components.flatMap(
          // deno-lint-ignore no-explicit-any
          (g: any) => g.items?.map((i: any) => i.name) || []
        );
        if (names.length) parts.push(`Components: ${names.join(", ")}`);
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

      // prep_recipes.training_notes: JSONB (only exists on prep_recipes, not plate_specs)
      if (item.training_notes) {
        const tn = item.training_notes;
        parts.push(
          `Training Notes: ${typeof tn === "string" ? tn : JSON.stringify(tn)}`
        );
      }

      // plate_specs.notes: TEXT (only exists on plate_specs, not prep_recipes)
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
// HELPER: getQueryEmbedding
// =============================================================================

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.error("[ask-product] OPENAI_API_KEY not configured");
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
      console.error(
        "[ask-product] OpenAI embedding error:",
        response.status,
        errorText
      );
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("[ask-product] Failed to generate query embedding:", error);
    return null;
  }
}

// =============================================================================
// HELPER: executeSearch
// =============================================================================

// deno-lint-ignore no-explicit-any
async function executeSearch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  toolName: string,
  query: string,
  queryEmbedding: number[]
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc(toolName, {
    search_query: query,
    query_embedding: JSON.stringify(queryEmbedding),
    result_limit: 5,
    keyword_weight: 0.4,
    vector_weight: 0.6,
  });

  if (error) {
    console.error(
      `[ask-product] Search error (${toolName}):`,
      error.message
    );
    return [];
  }

  return data || [];
}

// =============================================================================
// HELPER: formatSearchResults
// =============================================================================

function formatSearchResults(results: SearchResult[]): string {
  if (!results.length) return "No results found.";

  return results
    .map((r, i) => {
      const parts = [`${i + 1}. ${r.name} (${r.slug})`];
      if (r.snippet)
        parts.push(`   ${r.snippet.replace(/<\/?mark>/g, "")}`);
      if (r.plate_type) parts.push(`   Type: ${r.plate_type}`);
      if (r.is_top_seller) parts.push(`   ★ Top Seller`);
      if (r.varietal) parts.push(`   Varietal: ${r.varietal}`);
      if (r.style) parts.push(`   Style: ${r.style}`);
      if (r.category) parts.push(`   Category: ${r.category}`);
      if (r.subcategory) parts.push(`   Subcategory: ${r.subcategory}`);
      if (r.source_table) parts.push(`   Source: ${r.source_table}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

// =============================================================================
// HELPER: enrichWithMenuItems (pairing actions only)
// =============================================================================

async function enrichWithMenuItems(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  item: Record<string, unknown>,
  domain: ProductDomain
): Promise<{ menuText: string; dishCitations: ProductCitation[] }> {
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
    queryEmbedding
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
        if (r.is_top_seller) parts.push(" ★ Top Seller");
        return parts.join("");
      })
      .join("\n");

  const dishCitations: ProductCitation[] = results.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    domain: "dishes" as ProductDomain,
  }));

  return { menuText, dishCitations };
}

// =============================================================================
// HELPER: Response builders
// =============================================================================

function jsonResponse(
  data: AskProductResponse | ErrorResponse,
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
  return jsonResponse(body as unknown as AskProductResponse, status);
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[ask-product] Request received");

  try {
    // =========================================================================
    // 1. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[ask-product] Missing or invalid Authorization header");
      return errorResponse(
        "Unauthorized",
        "Missing authorization header",
        401
      );
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
      console.log("[ask-product] Invalid token:", claimsError?.message);
      return errorResponse("Unauthorized", "Invalid token", 401);
    }

    const userId = claimsData.claims.sub as string;
    console.log("[ask-product] Authenticated user:", userId);

    // Service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. PARSE AND VALIDATE REQUEST
    // =========================================================================
    const body = (await req.json()) as AskProductRequest;
    const {
      question,
      domain,
      language = "en",
      groupId,
      action,
      itemContext,
    } = body;

    if (!question?.trim()) {
      return errorResponse("bad_request", "Question is required", 400);
    }

    if (!groupId) {
      return errorResponse("bad_request", "Group ID is required", 400);
    }

    if (!domain || !VALID_DOMAINS.includes(domain)) {
      return errorResponse(
        "bad_request",
        `Invalid domain. Must be one of: ${VALID_DOMAINS.join(", ")}`,
        400
      );
    }

    console.log(
      `[ask-product] Domain: ${domain} | Mode: ${
        action && itemContext ? "action" : "search"
      } | Action: ${action || "none"} | Lang: ${language}`
    );

    // =========================================================================
    // 3. CHECK USAGE LIMITS
    // =========================================================================
    const { data: usageData, error: usageError } = await supabase.rpc(
      "get_user_usage",
      { _user_id: userId, _group_id: groupId }
    );

    if (usageError) {
      console.error("[ask-product] Usage check error:", usageError.message);
      return errorResponse(
        "server_error",
        "Failed to check usage limits",
        500
      );
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
      console.log("[ask-product] Usage limit exceeded:", limitType);
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

    // =========================================================================
    // 4. OPENAI CONFIG
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[ask-product] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    // =========================================================================
    // 5. BRANCH: ACTION MODE vs OPEN QUESTION MODE
    // =========================================================================
    let answer: string;
    let citations: ProductCitation[];
    let mode: "action" | "search";

    if (action && itemContext) {
      // =====================================================================
      // ACTION MODE
      // =====================================================================
      mode = "action";

      // Validate action exists for this domain
      const domainPrompts = ACTION_PROMPTS[domain];
      if (!domainPrompts || !domainPrompts[action]) {
        return errorResponse(
          "bad_request",
          `Invalid action "${action}" for domain "${domain}"`,
          400
        );
      }

      const actionInstruction = domainPrompts[action];
      const langInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;

      // Serialize item context to structured text
      let contextText = serializeItemContext(domain, itemContext);
      let extraCitations: ProductCitation[] = [];

      // Pairing enrichment: fetch real menu items for pairing actions
      if (PAIRING_ACTIONS.has(action)) {
        console.log("[ask-product] Enriching with menu items for pairing action");
        const { menuText, dishCitations } = await enrichWithMenuItems(
          supabase,
          itemContext,
          domain
        );
        contextText += menuText;
        extraCitations = dishCitations;
      }

      // Build system prompt
      const systemPrompt = `You are a training assistant for Alamo Prime steakhouse.
${actionInstruction}

Rules:
- Use ONLY the product data provided below — never invent facts
- Be warm, professional, and encouraging
- ${langInstruction}
- Keep responses focused and actionable`;

      console.log("[ask-product] Action mode: calling OpenAI...");

      const aiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: contextText },
            ],
            max_tokens: 600,
            temperature: 0.4,
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(
          "[ask-product] AI API error:",
          aiResponse.status,
          errorText
        );
        return errorResponse("ai_error", "Failed to generate answer", 500);
      }

      const aiData = await aiResponse.json();
      answer = aiData.choices?.[0]?.message?.content?.trim();

      if (!answer) {
        return errorResponse("ai_error", "Failed to generate answer", 500);
      }

      // Build citations: the item itself + any pairing dishes
      const itemName =
        (itemContext.menu_name as string) ||
        (itemContext.name as string) ||
        "Unknown";
      const itemSlug = (itemContext.slug as string) || "";
      const itemId = (itemContext.id as string) || "";

      citations = [
        { id: itemId, slug: itemSlug, name: itemName, domain },
        ...extraCitations,
      ];
    } else {
      // =====================================================================
      // OPEN QUESTION MODE
      // =====================================================================
      mode = "search";

      const langInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
      const domainHint = DOMAIN_HINT[domain];

      const systemPrompt = `You are a knowledgeable assistant for Alamo Prime steakhouse. Answer questions about the restaurant's menu, drinks, and recipes.

${domainHint}

You have access to search tools for each product domain. Use them to find relevant products before answering. You may call multiple tools if a question spans domains (e.g., "what wine pairs with the ribeye?" → search wines AND dishes).

Rules:
- Always search before answering — do not guess product details
- Cite specific products by name in your answer
- If no results found, say "I don't have information about that in our current menu."
- ${langInstruction}
- Be concise: 2-4 sentences + bullets if needed`;

      console.log("[ask-product] Open question mode: calling OpenAI with tools...");

      // Initial call with tool definitions
      const initialResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: question },
            ],
            tools: SEARCH_TOOLS,
            tool_choice: "auto",
            max_tokens: 800,
            temperature: 0.3,
          }),
        }
      );

      if (!initialResponse.ok) {
        const errorText = await initialResponse.text();
        console.error(
          "[ask-product] AI API error:",
          initialResponse.status,
          errorText
        );
        return errorResponse("ai_error", "Failed to generate answer", 500);
      }

      const initialData = await initialResponse.json();
      const assistantMessage = initialData.choices?.[0]?.message;

      // Collect all search results for citations (tagged with source function)
      const allSearchResults: { result: SearchResult; fnName: string }[] = [];

      if (assistantMessage?.tool_calls?.length) {
        // AI wants to call search tools
        console.log(
          `[ask-product] AI requested ${assistantMessage.tool_calls.length} tool call(s)`
        );

        // deno-lint-ignore no-explicit-any
        const toolResultMessages: any[] = [];

        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          const fnArgs = JSON.parse(toolCall.function.arguments);
          const searchQuery = fnArgs.query;

          console.log(
            `[ask-product] Executing tool: ${fnName}(query="${searchQuery}")`
          );

          // Generate embedding for the search query
          const queryEmbedding = await getQueryEmbedding(searchQuery);

          let results: SearchResult[] = [];
          if (queryEmbedding) {
            results = await executeSearch(
              supabase,
              fnName,
              searchQuery,
              queryEmbedding
            );
          }

          allSearchResults.push(...results.map((r) => ({ result: r, fnName })));

          const formattedResults = formatSearchResults(results);
          console.log(
            `[ask-product] ${fnName}: ${results.length} results`
          );

          toolResultMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: formattedResults,
          });
        }

        // Follow-up call with tool results
        console.log("[ask-product] Sending tool results back to OpenAI...");

        const followUpResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: question },
                assistantMessage,
                ...toolResultMessages,
              ],
              max_tokens: 800,
              temperature: 0.3,
            }),
          }
        );

        if (!followUpResponse.ok) {
          const errorText = await followUpResponse.text();
          console.error(
            "[ask-product] AI follow-up error:",
            followUpResponse.status,
            errorText
          );
          return errorResponse("ai_error", "Failed to generate answer", 500);
        }

        const followUpData = await followUpResponse.json();
        answer = followUpData.choices?.[0]?.message?.content?.trim();
      } else if (assistantMessage?.content) {
        // AI answered directly without tool calls
        console.log("[ask-product] AI answered without tool calls");
        answer = assistantMessage.content.trim();
      } else {
        console.error("[ask-product] Empty AI response");
        return errorResponse("ai_error", "Failed to generate answer", 500);
      }

      if (!answer) {
        return errorResponse("ai_error", "Failed to generate answer", 500);
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
            domain: SEARCH_FN_TO_DOMAIN[fnName] || domain,
          });
        }
      }
    }

    // =========================================================================
    // 6. INCREMENT USAGE COUNTER
    // =========================================================================
    const { data: newUsage, error: incrementError } = await supabase.rpc(
      "increment_usage",
      { _user_id: userId, _group_id: groupId }
    );

    if (incrementError) {
      console.error(
        "[ask-product] Failed to increment usage:",
        incrementError.message
      );
    } else {
      console.log("[ask-product] Usage incremented:", newUsage?.[0]);
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

    // =========================================================================
    // 7. RETURN RESPONSE
    // =========================================================================
    console.log(
      `[ask-product] Success — mode: ${mode}, citations: ${citations.length}, answer length: ${answer.length}`
    );

    return jsonResponse({
      answer,
      citations,
      usage: updatedUsage,
      mode,
    });
  } catch (error) {
    console.error("[ask-product] Unexpected error:", error);
    return errorResponse(
      "server_error",
      "An unexpected error occurred",
      500
    );
  }
});
