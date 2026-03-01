/**
 * Ingest-Vision Edge Function
 *
 * Handles image uploads (recipe cards, menu photos, handwritten notes, plated
 * dishes), sends the image to GPT-5.2 vision with structured output, and
 * returns a PrepRecipeDraft.
 *
 * Admin-only. Creates/updates ingestion_sessions and ingestion_messages rows.
 * Uploads the original image to Supabase Storage (product-assets bucket).
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
  linkedPrepRecipes?: Array<{ prep_recipe_ref: string; name: string; quantity: number; unit: string }>;
  tastingNotes: string;
  description: string;
  notes: string;
  isTopSeller: boolean;
  confidence: number;
  missingFields: string[];
  aiMessage: string;
}

type ProductDraft = PrepRecipeDraft | WineDraft | CocktailDraft;

interface IngestVisionResponse {
  sessionId: string;
  message: string;
  draft: ProductDraft | null;
  confidence?: number;
  missingFields?: string[];
  fileName?: string;
  imageUrl?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_FILE_SIZE = 10_485_760; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VALID_PRODUCT_TABLES = new Set([
  "prep_recipes",
  "plate_specs",
  "foh_plate_specs",
  "wines",
  "cocktails",
  "beer_liquor_list",
]);

// =============================================================================
// HELPERS
// =============================================================================

function jsonResponse(data: IngestVisionResponse | { error: string; message?: string }, status = 200): Response {
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
      confidence: { type: "number", description: "0-1 confidence score" },
      missingFields: {
        type: "array",
        items: { type: "string" },
        description: "Fields the AI couldn't determine from the input",
      },
      aiMessage: {
        type: "string",
        description: "Friendly message explaining what was structured and any assumptions made",
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
        description: "Friendly message explaining what was structured and any assumptions made",
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
      linkedPrepRecipes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            prep_recipe_ref: { type: "string", description: "Slug of the linked prep recipe" },
            name: { type: "string", description: "Display name of the prep recipe" },
            quantity: { type: "number", description: "Amount used in the cocktail" },
            unit: { type: "string", description: "Unit of measurement (oz, dash, barspoon, etc.)" },
          },
          required: ["prep_recipe_ref", "name", "quantity", "unit"],
          additionalProperties: false,
        },
        description: "House-made bar prep ingredients linked to prep recipes (syrups, infusions, bitters, etc.)",
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
        description: "Friendly message explaining what was structured and any assumptions made",
      },
    },
    required: [
      "name", "style", "glass", "ingredients", "keyIngredients",
      "procedure", "linkedPrepRecipes", "tastingNotes", "description", "notes",
      "isTopSeller", "confidence", "missingFields", "aiMessage",
    ],
    additionalProperties: false,
  },
};

// =============================================================================
// OPENAI STRUCTURED OUTPUT SCHEMA (BeerLiquorBatch — vision extraction)
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
                "Beer: IPA, Lager, Stout, Pilsner, Wheat, Ale, Bock, Porter, Sour, etc. Liquor: Bourbon, Scotch, Vodka, Gin, Rum, Tequila, Mezcal, Whiskey, Rye, Brandy, Cognac, etc.",
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

// =============================================================================
// PROMPT SLUG MAP — productTable → prompt slug for file/image uploads
// =============================================================================

const FILE_PROMPT_MAP: Record<string, string> = {
  prep_recipes: "ingest-file-prep-recipe",
  wines: "ingest-file-wine",
  cocktails: "ingest-file-cocktail",
};

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[ingest-vision] Request received");

  try {
    // =========================================================================
    // 1. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[ingest-vision] Missing or invalid Authorization header");
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
      console.log("[ingest-vision] Invalid token:", claimsError?.message);
      return errorResponse("Unauthorized", "Invalid token", 401);
    }

    const userId = claimsData.claims.sub as string;
    console.log("[ingest-vision] Authenticated user:", userId);

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
      console.log("[ingest-vision] User has no group membership:", membershipError?.message);
      return errorResponse("Forbidden", "No group membership found", 403);
    }

    if (membership.role !== "admin") {
      console.log(`[ingest-vision] User role is "${membership.role}", admin required`);
      return errorResponse("Forbidden", "Admin access required", 403);
    }

    console.log("[ingest-vision] Admin access confirmed");

    // =========================================================================
    // 3. PARSE MULTIPART FORM DATA
    // =========================================================================
    const formData = await req.formData();

    const productTable = formData.get("productTable") as string | null;
    const language = (formData.get("language") as string | null) || "en";
    const sessionId = formData.get("sessionId") as string | null;
    const department = formData.get("department") as string | null;
    const extractOnly = formData.get("extractOnly") === "true";

    // =========================================================================
    // 4. VALIDATE COMMON INPUTS
    // =========================================================================

    // Validate productTable
    if (!productTable || !VALID_PRODUCT_TABLES.has(productTable)) {
      return errorResponse(
        "bad_request",
        `productTable must be one of: ${[...VALID_PRODUCT_TABLES].join(", ")}`,
        400
      );
    }

    // Validate language
    if (language && !["en", "es"].includes(language)) {
      return errorResponse("bad_request", 'language must be "en" or "es"', 400);
    }

    // Beer/liquor batch path handles its own multi-file validation (section 6c).
    // All other paths require exactly one image file — validate that here.
    const file = productTable !== "beer_liquor_list"
      ? formData.get("file") as File | null
      : null;

    if (productTable !== "beer_liquor_list") {
      if (!file || !(file instanceof File)) {
        console.log("[ingest-vision] No file provided or not a File object");
        return errorResponse("bad_request", "file is required and must be a File", 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        console.log(`[ingest-vision] File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`);
        return errorResponse("bad_request", `File size exceeds 10MB limit (${file.size} bytes)`, 400);
      }

      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        console.log(`[ingest-vision] Invalid MIME type: ${file.type}`);
        return errorResponse(
          "bad_request",
          `Invalid file type "${file.type}". Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
          400
        );
      }

      console.log(
        `[ingest-vision] File: ${file.name} (${file.size} bytes, ${file.type}), table=${productTable}, lang=${language}`
      );
    }

    // =========================================================================
    // 5. GET OPENAI API KEY
    // =========================================================================
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[ingest-vision] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    // =========================================================================
    // 6. CONVERT IMAGE TO BASE64 (non-batch paths only)
    // =========================================================================
    let dataUrl = "";
    let arrayBuffer: ArrayBuffer | null = null;

    if (file) {
      arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const mimeType = file.type;
      dataUrl = `data:${mimeType};base64,${base64}`;

      console.log(`[ingest-vision] Image converted to base64 (${base64.length} chars)`);
    }

    // =========================================================================
    // 6b. EXTRACT-ONLY MODE (OCR — skip storage, session, structured AI)
    // =========================================================================
    if (extractOnly) {
      console.log("[ingest-vision] extractOnly=true — running OCR-only pipeline");

      const ocrResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an OCR assistant. Extract ALL visible text from the image exactly as written. Output only the extracted text, one item per line. Do not add commentary or formatting.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all text from this image. List each item on its own line." },
                { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
              ],
            },
          ],
          max_completion_tokens: 4000,
          temperature: 0,
        }),
      });

      if (!ocrResponse.ok) {
        const errText = await ocrResponse.text();
        console.error(`[ingest-vision] OCR error ${ocrResponse.status}:`, errText);
        return errorResponse("ai_error", "Failed to extract text from image", 500);
      }

      const ocrData = await ocrResponse.json();
      const extractedText = ocrData.choices?.[0]?.message?.content || "";

      console.log(`[ingest-vision] OCR complete: ${extractedText.length} chars extracted`);

      return new Response(
        JSON.stringify({ extractedText, fileName: file.name, length: extractedText.length }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // =========================================================================
    // 6c. BEER/LIQUOR BATCH VISION — multi-image + text, structured extraction
    // =========================================================================
    if (productTable === "beer_liquor_list") {
      // Read all images + optional text from FormData
      const allImages = formData.getAll("file").filter(
        (f): f is File => f instanceof File,
      );
      const textContent = formData.get("textContent") as string | null;

      // Validate: need at least 1 image OR textContent
      if (allImages.length === 0 && !textContent?.trim()) {
        return errorResponse("bad_request", "At least one image or text content is required", 400);
      }

      // Validate each image
      for (const img of allImages) {
        if (img.size > MAX_FILE_SIZE) {
          return errorResponse("bad_request", `File "${img.name}" exceeds 10MB limit (${img.size} bytes)`, 400);
        }
        if (!ALLOWED_MIME_TYPES.has(img.type)) {
          return errorResponse(
            "bad_request",
            `Invalid file type "${img.type}" for "${img.name}". Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
            400,
          );
        }
      }

      console.log(
        `[ingest-vision] beer_liquor_list batch: ${allImages.length} image(s), textContent=${textContent ? textContent.length + " chars" : "none"}`,
      );

      // Convert all images to base64 content blocks
      // deno-lint-ignore no-explicit-any
      const imageBlocks: any[] = [];
      for (const img of allImages) {
        const ab = await img.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        imageBlocks.push({
          type: "image_url",
          image_url: { url: `data:${img.type};base64,${b64}`, detail: "high" },
        });
      }

      // Build user message — instructions/text + all image blocks
      const userText = textContent?.trim()
        ? `The user provided these instructions/text along with ${allImages.length > 0 ? "the images" : "no images"}:\n\n${textContent}\n\nExtract all beer and liquor items from the images and text above.`
        : `Extract all beer and liquor items from ${allImages.length === 1 ? "this image" : "these images"}. Pay attention to the layout — if there are columns, headers, or groupings, use them to correctly categorize each item.`;

      // deno-lint-ignore no-explicit-any
      const userContent: any[] = [
        { type: "text", text: userText },
        ...imageBlocks,
      ];

      const batchResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.2",
          messages: [
            {
              role: "system",
              content: `You are a beverage industry expert helping a steakhouse restaurant catalog their beer and liquor inventory.

You may receive text content AND/OR images. Extract items from ALL sources. The text may contain instructions, context, or additional items to extract.

IMPORTANT: Pay attention to the VISUAL LAYOUT of any images:
- If the image has columns, understand what each column represents (e.g., category, brand, style, price)
- If items are grouped under headers, use those headers as category/subcategory context
- If there are two columns, do NOT treat column headers as items
- Preserve the relationships between items and their categories/groups

Extract EVERY beer and liquor item from all provided sources. For each item:
- Determine if it is Beer or Liquor
- Use visual context (column headers, groupings, section labels) to correctly categorize
- Use your knowledge to fill in missing fields (country, subcategory, producer, style, etc.)
- Generate a professional 1-3 sentence description
- Generate tasting notes and service recommendations
- Set isFeatured to false by default
- Set confidence based on how much info was available vs inferred (1.0 = all clearly visible, 0.5 = mostly inferred)

Common subcategories:
- Beer: IPA, Lager, Stout, Pilsner, Wheat, Ale, Bock, Porter, Sour, Pale Ale, Amber, Blonde, Hefeweizen
- Liquor: Bourbon, Scotch, Vodka, Gin, Rum, Tequila, Mezcal, Whiskey, Rye, Brandy, Cognac, Aperitif, Digestif, Amaro

Do NOT skip any items. Extract everything visible in images and mentioned in text.`,
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: BEER_LIQUOR_BATCH_SCHEMA,
          },
          reasoning_effort: "medium",
          max_completion_tokens: 16000,
        }),
      });

      if (!batchResponse.ok) {
        const errText = await batchResponse.text();
        console.error(`[ingest-vision] Batch vision error ${batchResponse.status}:`, errText);
        return errorResponse("ai_error", "Failed to extract items from input", 500);
      }

      const batchData = await batchResponse.json();
      const rawBatchContent = batchData.choices?.[0]?.message?.content;

      if (!rawBatchContent) {
        console.error("[ingest-vision] Batch vision returned empty content");
        return errorResponse("ai_error", "AI returned empty response", 500);
      }

      // deno-lint-ignore no-explicit-any
      let parsed: { items: any[]; aiMessage: string };
      try {
        parsed = JSON.parse(rawBatchContent);
      } catch (_parseError) {
        console.error("[ingest-vision] Failed to parse batch vision response:", rawBatchContent);
        return errorResponse("ai_error", "AI returned invalid JSON", 500);
      }

      // Duplicate detection against existing published items
      const { data: existingItems } = await supabase
        .from("beer_liquor_list")
        .select("id, name")
        .eq("status", "published");

      const existingMap = new Map<string, { id: string; name: string }>();
      if (existingItems) {
        // deno-lint-ignore no-explicit-any
        for (const item of existingItems as any[]) {
          existingMap.set(item.name.toLowerCase().trim(), { id: item.id, name: item.name });
        }
      }

      let duplicateCount = 0;
      // deno-lint-ignore no-explicit-any
      const enrichedItems = (parsed.items || []).map((item: any) => {
        const key = item.name.toLowerCase().trim();
        const existing = existingMap.get(key);
        if (existing) {
          duplicateCount++;
          return { ...item, duplicateOf: existing };
        }
        return { ...item, duplicateOf: null };
      });

      // Build source file name for session record
      const sourceFileName = allImages.length > 0
        ? allImages.map((f) => f.name).join(", ")
        : "text-input";
      const sourceFileType = allImages.length > 0
        ? allImages[0].type
        : "text/plain";
      const ingestionMethod = allImages.length > 0 ? "image_upload" : "text_upload";

      // Create batch session
      const { data: batchSession, error: batchSessionError } = await supabase
        .from("ingestion_sessions")
        .insert({
          product_table: "beer_liquor_list",
          ingestion_method: ingestionMethod,
          status: "drafting",
          created_by: userId,
          source_file_name: sourceFileName,
          source_file_type: sourceFileType,
          draft_data: { items: enrichedItems },
        })
        .select("id")
        .single();

      // deno-lint-ignore no-explicit-any
      const batchSessionId = (batchSession as any)?.id || crypto.randomUUID();
      if (batchSessionError) {
        console.error("[ingest-vision] Failed to create batch session:", batchSessionError.message);
      }

      console.log(
        `[ingest-vision] Batch complete: ${enrichedItems.length} items, ${duplicateCount} duplicates (${allImages.length} images, ${textContent ? "with" : "no"} text)`,
      );

      return new Response(
        JSON.stringify({
          sessionId: batchSessionId,
          items: enrichedItems,
          totalExtracted: enrichedItems.length,
          duplicates: duplicateCount,
          message: parsed.aiMessage || "",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // =========================================================================
    // 7. UPLOAD ORIGINAL IMAGE TO STORAGE
    // =========================================================================
    const effectiveSessionId = sessionId || crypto.randomUUID();
    const timestamp = Date.now();
    const storagePath = `uploads/${effectiveSessionId}/${timestamp}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("product-assets")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[ingest-vision] Storage upload failed:", uploadError.message);
      // Non-fatal: continue without stored image
    } else {
      console.log(`[ingest-vision] Image uploaded to storage: ${storagePath}`);
    }

    // Get public URL for the uploaded image
    let imageUrl = "";
    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from("product-assets")
        .getPublicUrl(storagePath);

      imageUrl = publicUrlData?.publicUrl || "";
      console.log(`[ingest-vision] Public image URL: ${imageUrl}`);
    }

    // =========================================================================
    // 8. CREATE OR LOAD INGESTION SESSION
    // =========================================================================
    let activeSessionId: string;
    let existingDraft: ProductDraft | null = null;

    if (sessionId) {
      // Load existing session and verify ownership
      const { data: existingSession, error: sessionError } = await supabase
        .from("ingestion_sessions")
        .select("id, status, created_by, draft_data")
        .eq("id", sessionId)
        .single();

      if (sessionError || !existingSession) {
        console.error("[ingest-vision] Session not found:", sessionId, sessionError?.message);
        return errorResponse("not_found", "Ingestion session not found", 404);
      }

      if (existingSession.created_by !== userId) {
        console.log("[ingest-vision] Session ownership mismatch");
        return errorResponse("Forbidden", "You do not own this session", 403);
      }

      if (existingSession.status !== "drafting" && existingSession.status !== "review") {
        console.log(`[ingest-vision] Session status is ${existingSession.status}, not editable`);
        return errorResponse("bad_request", `Session is ${existingSession.status} and cannot be edited`, 400);
      }

      existingDraft = (existingSession.draft_data as ProductDraft) || null;
      activeSessionId = existingSession.id;
      console.log(`[ingest-vision] Loaded existing session: ${activeSessionId}`);
    } else {
      // Create new session
      const { data: newSession, error: sessionError } = await supabase
        .from("ingestion_sessions")
        .insert({
          product_table: productTable,
          ingestion_method: "image_upload",
          status: "drafting",
          created_by: userId,
          source_file_name: file.name,
          source_file_type: file.type,
        })
        .select("id")
        .single();

      if (sessionError) {
        console.error("[ingest-vision] Failed to create session:", sessionError.message);
        return errorResponse("server_error", "Failed to create ingestion session", 500);
      }

      activeSessionId = newSession.id as string;
      console.log(`[ingest-vision] Created new session: ${activeSessionId}`);
    }

    // =========================================================================
    // 9. SAVE USER MESSAGE
    // =========================================================================
    const userMessageContent = `Image uploaded: ${file.name} (${file.size} bytes)`;

    const { error: userMsgError } = await supabase
      .from("ingestion_messages")
      .insert({
        session_id: activeSessionId,
        role: "user",
        content: userMessageContent,
      });

    if (userMsgError) {
      console.error("[ingest-vision] Failed to save user message:", userMsgError.message);
      // Non-fatal: continue with AI call
    }

    // =========================================================================
    // 10. FETCH SYSTEM PROMPT FROM ai_prompts
    // =========================================================================
    // Use bar-specific prompt when department is "bar" and productTable is prep_recipes
    const isBarPrep = productTable === "prep_recipes" && department === "bar";
    const promptSlug = isBarPrep ? "ingest-file-bar-prep" : (FILE_PROMPT_MAP[productTable] || "ingest-file-prep-recipe");
    const { data: promptRow, error: promptError } = await supabase
      .from("ai_prompts")
      .select("prompt_en, prompt_es")
      .eq("slug", promptSlug)
      .eq("is_active", true)
      .single();

    if (promptError) {
      console.error("[ingest-vision] Failed to load prompt:", promptError.message);
      return errorResponse("server_error", "Failed to load AI prompt", 500);
    }

    const systemPrompt = language === "es" && promptRow.prompt_es
      ? promptRow.prompt_es
      : promptRow.prompt_en;

    // =========================================================================
    // 11. CALL OPENAI — Wine: two-call pipeline, Prep: single call
    // =========================================================================

    const isWine = productTable === "wines";
    let draft: ProductDraft;

    if (isWine) {
      // --- Wine: Call 1 (Responses API + web_search_preview + vision) ---
      console.log("[ingest-vision] Wine: Call 1 — Responses API with web search + vision...");

      const wineUserText = existingDraft && existingDraft.name
        ? `This is an additional image for an existing wine draft. Current draft:\n\n${JSON.stringify(existingDraft, null, 2)}\n\nLook at this image and search the web for this wine. Merge any new information into the draft, filling in empty fields like tasting notes, producer notes, and service recommendations.`
        : "Look at this wine label image. Extract all visible information (name, producer, vintage, varietal, region). Then search the web for this wine to find: detailed tasting notes (aromas, palate, finish), producer background and winemaking philosophy, body classification, and food pairing recommendations for a steakhouse. Provide a comprehensive analysis.";

      const call1Response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.2",
          instructions: systemPrompt,
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: wineUserText },
              { type: "input_image", image_url: dataUrl },
            ],
          }],
          tools: [{ type: "web_search_preview", search_context_size: "medium" }],
        }),
      });

      if (!call1Response.ok) {
        const errText = await call1Response.text();
        console.error(`[ingest-vision] Wine Call 1 error ${call1Response.status}:`, errText);
        return errorResponse("ai_error", "Failed to analyze wine image (web search)", 500);
      }

      const call1Data = await call1Response.json();

      // Extract text from Responses API output
      let call1Text = "";
      for (const item of (call1Data.output || [])) {
        if (item.type === "message") {
          for (const block of (item.content || [])) {
            if (block.type === "output_text") {
              call1Text += block.text + "\n";
            }
          }
        }
      }

      if (!call1Text.trim()) {
        console.error("[ingest-vision] Wine Call 1 returned empty text output");
        return errorResponse("ai_error", "AI returned empty wine analysis", 500);
      }

      console.log(`[ingest-vision] Wine Call 1 complete: ${call1Text.length} chars of analysis`);

      // --- Wine: Call 2 (Chat Completions + json_schema) ---
      console.log("[ingest-vision] Wine: Call 2 — structured extraction...");

      const call2UserContent = existingDraft && existingDraft.name
        ? `CURRENT DRAFT:\n${JSON.stringify(existingDraft, null, 2)}\n\nASSISTANT ANALYSIS (from image + web research):\n${call1Text}\n\nMerge the analysis into the existing draft. Preserve all existing non-empty values. Fill in empty fields from the analysis.`
        : `ASSISTANT ANALYSIS (from image + web research):\n${call1Text}\n\nExtract all wine data into the structured format. Fill in ALL fields — use the web research to provide complete tasting notes, producer notes, and service recommendations.`;

      const call2Response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-mini-2025-08-07",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: call2UserContent },
          ],
          response_format: {
            type: "json_schema",
            json_schema: WINE_DRAFT_SCHEMA,
          },
          max_completion_tokens: 4000,
        }),
      });

      if (!call2Response.ok) {
        const errText = await call2Response.text();
        console.error(`[ingest-vision] Wine Call 2 error ${call2Response.status}:`, errText);
        return errorResponse("ai_error", "Failed to structure wine data", 500);
      }

      const call2Data = await call2Response.json();
      const rawContent = call2Data.choices?.[0]?.message?.content;

      if (!rawContent) {
        console.error("[ingest-vision] Wine Call 2 returned empty content");
        return errorResponse("ai_error", "AI returned empty structured wine response", 500);
      }

      try {
        draft = JSON.parse(rawContent) as WineDraft;
      } catch (_parseError) {
        console.error("[ingest-vision] Failed to parse Wine Call 2 response as JSON:", rawContent);
        return errorResponse("ai_error", "AI returned invalid JSON for wine", 500);
      }

      console.log("[ingest-vision] Wine two-call pipeline complete");

    } else {
      // --- Prep recipe / Cocktail: Single call (Chat Completions + json_schema) ---
      const isCocktail = productTable === "cocktails";
      const draftSchema = isCocktail ? COCKTAIL_DRAFT_SCHEMA : PREP_RECIPE_DRAFT_SCHEMA;
      const productLabel = isCocktail ? "cocktail" : "recipe";

      console.log(`[ingest-vision] Calling OpenAI (vision + json_schema) for ${productLabel}...`);

      let visionUserText: string;
      if (existingDraft && existingDraft.name) {
        visionUserText = isCocktail
          ? `This is an additional image for an existing cocktail draft. Here is the current draft data:\n\n${JSON.stringify(existingDraft, null, 2)}\n\nMerge any new information from this image into the existing draft. Keep all existing data intact and add or update fields with new information from the image. Look for ingredients, measurements, glassware, garnish, and technique details.`
          : `This is an additional image for an existing recipe draft. Here is the current draft data:\n\n${JSON.stringify(existingDraft, null, 2)}\n\nMerge any new information from this image into the existing draft. Keep all existing data intact and add or update fields with new information from the image. If the image contains shelf life, yield, allergens, or other metadata not yet in the draft, include them.`;
      } else {
        visionUserText = isCocktail
          ? "Extract and structure the cocktail recipe from this image. If the image shows a recipe card, bar menu, spec sheet, or cocktail photo, extract all details including ingredients with measurements, glassware, technique, and garnish. If the image shows a finished cocktail, describe the likely recipe and suggest a spec."
          : "Extract and structure the recipe from this image. If the image shows a recipe card, menu item, handwritten notes, or any food preparation instructions, extract all details. If the image shows a finished dish, describe the likely preparation method, ingredients, and technique.";
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.2",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: visionUserText,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: dataUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: draftSchema,
          },
          reasoning_effort: "medium",
          max_completion_tokens: 4000,
        }),
      });

      if (!openaiResponse.ok) {
        const errText = await openaiResponse.text();
        console.error(`[ingest-vision] OpenAI error ${openaiResponse.status}:`, errText);
        return errorResponse("ai_error", `Failed to analyze ${productLabel} image`, 500);
      }

      const aiData = await openaiResponse.json();
      const rawContent = aiData.choices?.[0]?.message?.content;

      if (!rawContent) {
        console.error("[ingest-vision] OpenAI returned empty content");
        return errorResponse("ai_error", "AI returned empty response", 500);
      }

      try {
        draft = JSON.parse(rawContent) as ProductDraft;
      } catch (_parseError) {
        console.error("[ingest-vision] Failed to parse AI response as JSON:", rawContent);
        return errorResponse("ai_error", "AI returned invalid JSON", 500);
      }
    }

    // =========================================================================
    // 12. POST-PROCESS: ADD SLUG & IMAGES
    // =========================================================================

    // Add slug (not in AI schema, needed by frontend)
    // deno-lint-ignore no-explicit-any
    (draft as any).slug = generateSlug(draft.name);

    // Type-specific post-processing
    if (isWine || productTable === "cocktails") {
      // Wine and cocktail use single `image` string field
      // deno-lint-ignore no-explicit-any
      const existingImage: string | null = (existingDraft as any)?.image || null;
      // deno-lint-ignore no-explicit-any
      (draft as any).image = imageUrl || existingImage || null;
    } else {
      // Prep recipe uses `images` array (RecipeImage objects: {url, alt, caption})
      // deno-lint-ignore no-explicit-any
      const existingImages: Array<{url: string; alt: string; caption: string}> = (existingDraft as any)?.images || [];
      // deno-lint-ignore no-explicit-any
      (draft as any).images = imageUrl
        ? [...existingImages, { url: imageUrl, alt: file?.name || 'Uploaded image', caption: '' }]
        : existingImages;
    }

    // Cocktail defaults: ensure linkedPrepRecipes array exists
    if (productTable === "cocktails") {
      // deno-lint-ignore no-explicit-any
      if (!(draft as any).linkedPrepRecipes) (draft as any).linkedPrepRecipes = [];
    }

    // Prep recipe defaults: ensure department is set
    if (productTable === "prep_recipes") {
      // deno-lint-ignore no-explicit-any
      if (!(draft as any).department) (draft as any).department = "kitchen";
    }

    console.log(
      `[ingest-vision] Structured draft: name="${draft.name}", confidence=${draft.confidence}, missing=${draft.missingFields.length}`
    );

    // =========================================================================
    // 13. SAVE DRAFT TO SESSION
    // =========================================================================
    const { error: updateError } = await supabase
      .from("ingestion_sessions")
      .update({
        draft_data: draft,
        ai_confidence: draft.confidence,
        missing_fields: draft.missingFields,
      })
      .eq("id", activeSessionId);

    if (updateError) {
      console.error("[ingest-vision] Failed to save draft to session:", updateError.message);
      // Non-fatal: we still return the draft to the client
    }

    // =========================================================================
    // 14. SAVE AI MESSAGE TO ingestion_messages
    // =========================================================================
    const { error: aiMsgError } = await supabase
      .from("ingestion_messages")
      .insert({
        session_id: activeSessionId,
        role: "assistant",
        content: draft.aiMessage,
        draft_updates: draft,
      });

    if (aiMsgError) {
      console.error("[ingest-vision] Failed to save AI message:", aiMsgError.message);
      // Non-fatal
    }

    // =========================================================================
    // 15. RETURN RESPONSE
    // =========================================================================
    console.log(`[ingest-vision] Vision analysis complete: sessionId=${activeSessionId}`);

    return jsonResponse({
      sessionId: activeSessionId,
      message: draft.aiMessage,
      draft,
      confidence: draft.confidence,
      missingFields: draft.missingFields,
      fileName: file.name,
      imageUrl: imageUrl || undefined,
    });
  } catch (error) {
    console.error("[ingest-vision] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
