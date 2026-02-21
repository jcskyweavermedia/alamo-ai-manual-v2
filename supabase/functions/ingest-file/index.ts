/**
 * Ingest-File Edge Function
 *
 * Handles file uploads (PDF, DOCX, TXT), extracts text, then structures the
 * content into a ProductDraft using GPT-5.2 structured output.
 *
 * Wines use a two-call pipeline: Responses API with web_search_preview (Call 1)
 * followed by Chat Completions with json_schema (Call 2).
 * Prep recipes use a single Chat Completions call.
 *
 * Admin-only. Creates/updates ingestion_sessions and ingestion_messages rows.
 * Uploads original file to product-assets storage bucket.
 *
 * Auth: verify_jwt=false -- manual JWT verification via getClaims()
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@1.4.0";
import mammoth from "https://esm.sh/mammoth@1.11.0";

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
  tastingNotes: string;
  description: string;
  notes: string;
  isTopSeller: boolean;
  confidence: number;
  missingFields: string[];
  aiMessage: string;
}

type ProductDraft = PrepRecipeDraft | WineDraft | CocktailDraft;

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_FILE_SIZE = 10485760; // 10 MB

const VALID_PRODUCT_TABLES = new Set([
  "prep_recipes",
  "plate_specs",
  "foh_plate_specs",
  "wines",
  "cocktails",
  "beer_liquor_list",
]);

const VALID_MIME_TYPES = new Set([
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// =============================================================================
// HELPERS
// =============================================================================

// deno-lint-ignore no-explicit-any
function jsonResponse(data: any, status = 200): Response {
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
        description: "Friendly message explaining what was structured and any assumptions made",
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
      "procedure", "tastingNotes", "description", "notes",
      "isTopSeller", "confidence", "missingFields", "aiMessage",
    ],
    additionalProperties: false,
  },
};

// =============================================================================
// PROMPT SLUG MAP — productTable → prompt slug for file uploads
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

  console.log("[ingest-file] Request received");

  try {
    // =========================================================================
    // 1. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[ingest-file] Missing or invalid Authorization header");
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
      console.log("[ingest-file] Invalid token:", claimsError?.message);
      return errorResponse("Unauthorized", "Invalid token", 401);
    }

    const userId = claimsData.claims.sub as string;
    console.log("[ingest-file] Authenticated user:", userId);

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
      console.log("[ingest-file] User has no group membership:", membershipError?.message);
      return errorResponse("Forbidden", "No group membership found", 403);
    }

    if (membership.role !== "admin") {
      console.log(`[ingest-file] User role is "${membership.role}", admin required`);
      return errorResponse("Forbidden", "Admin access required", 403);
    }

    console.log("[ingest-file] Admin access confirmed");

    // =========================================================================
    // 3. PARSE MULTIPART FORM DATA
    // =========================================================================
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const productTable = formData.get("productTable") as string | null;
    const language = (formData.get("language") as string | null) || "en";
    const sessionId = formData.get("sessionId") as string | null;

    // =========================================================================
    // 4. VALIDATE INPUTS
    // =========================================================================

    // Validate file exists and is a File object
    if (!file || !(file instanceof File)) {
      console.log("[ingest-file] No file provided or invalid file object");
      return errorResponse("bad_request", "file is required and must be a File", 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.log(`[ingest-file] File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`);
      return errorResponse(
        "bad_request",
        `File size ${(file.size / 1048576).toFixed(1)}MB exceeds 10MB limit`,
        400
      );
    }

    // Validate file MIME type
    if (!VALID_MIME_TYPES.has(file.type)) {
      console.log(`[ingest-file] Invalid file type: ${file.type}`);
      return errorResponse(
        "bad_request",
        `Unsupported file type "${file.type}". Accepted: PDF, DOCX, TXT`,
        400
      );
    }

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

    console.log(
      `[ingest-file] File: "${file.name}" (${file.type}, ${file.size} bytes) | Table: ${productTable} | Lang: ${language}`
    );

    // =========================================================================
    // 5. EXTRACT TEXT FROM FILE
    // =========================================================================
    let extractedText: string;

    if (file.type === "text/plain") {
      extractedText = await file.text();
      console.log(`[ingest-file] TXT extracted: ${extractedText.length} chars`);
    } else if (file.type === "application/pdf") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      extractedText = text;
      console.log(`[ingest-file] PDF extracted: ${extractedText.length} chars`);
    } else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      extractedText = result.value;
      console.log(`[ingest-file] DOCX extracted: ${extractedText.length} chars`);
    } else {
      // Should not reach here due to MIME validation above
      return errorResponse("bad_request", "Unsupported file type", 400);
    }

    // Check extracted text is not empty
    if (!extractedText || !extractedText.trim()) {
      console.log("[ingest-file] Extracted text is empty");
      return errorResponse(
        "bad_request",
        "Could not extract any text from the uploaded file. The file may be empty or contain only images.",
        400
      );
    }

    console.log(`[ingest-file] Text extraction complete: ${extractedText.length} chars`);

    // =========================================================================
    // 6. UPLOAD ORIGINAL FILE TO STORAGE
    // =========================================================================
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const timestamp = Date.now();
    const effectiveSessionId = sessionId || "new";
    const storagePath = `uploads/${effectiveSessionId}/${timestamp}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("product-assets")
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[ingest-file] Storage upload failed:", uploadError.message);
      // Non-fatal: continue without storage upload
    } else {
      console.log(`[ingest-file] File uploaded to storage: ${storagePath}`);
    }

    // =========================================================================
    // 7. CREATE OR LOAD INGESTION SESSION
    // =========================================================================
    let activeSessionId: string;
    let existingDraft: ProductDraft | null = null;

    if (sessionId) {
      // Load existing session — verify ownership and editable status
      const { data: session, error: sessionError } = await supabase
        .from("ingestion_sessions")
        .select("id, status, created_by, draft_data")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        console.error("[ingest-file] Session not found:", sessionId, sessionError?.message);
        return errorResponse("not_found", "Ingestion session not found", 404);
      }

      if (session.created_by !== userId) {
        console.log("[ingest-file] Session ownership mismatch");
        return errorResponse("Forbidden", "You do not own this session", 403);
      }

      if (session.status !== "drafting" && session.status !== "review") {
        console.log(`[ingest-file] Session status is ${session.status}, not editable`);
        return errorResponse(
          "bad_request",
          `Session is ${session.status} and cannot be edited`,
          400
        );
      }

      existingDraft = (session.draft_data as ProductDraft) || null;
      activeSessionId = session.id;
      console.log(`[ingest-file] Using existing session: ${activeSessionId}`);
    } else {
      // Create new session
      const { data: session, error: sessionError } = await supabase
        .from("ingestion_sessions")
        .insert({
          product_table: productTable,
          ingestion_method: "file_upload",
          source_file_name: file.name,
          source_file_type: file.type,
          status: "drafting",
          created_by: userId,
        })
        .select("id")
        .single();

      if (sessionError) {
        console.error("[ingest-file] Failed to create session:", sessionError.message);
        return errorResponse("server_error", "Failed to create ingestion session", 500);
      }

      activeSessionId = session.id as string;
      console.log(`[ingest-file] Created new session: ${activeSessionId}`);
    }

    // If we uploaded with "new" as placeholder, update storage path with real session ID
    if (!sessionId && !uploadError) {
      const newStoragePath = `uploads/${activeSessionId}/${timestamp}-${file.name}`;
      // Move file from placeholder path to real session path
      const { error: moveError } = await supabase.storage
        .from("product-assets")
        .move(storagePath, newStoragePath);

      if (moveError) {
        console.error("[ingest-file] Failed to move file to session path:", moveError.message);
        // Non-fatal: file is still accessible at the old path
      } else {
        console.log(`[ingest-file] File moved to: ${newStoragePath}`);
      }
    }

    // =========================================================================
    // 8. SAVE USER MESSAGE
    // =========================================================================
    const preview = extractedText.length > 500
      ? extractedText.substring(0, 500) + "..."
      : extractedText;

    const userMessageContent = `File uploaded: ${file.name}\n\nExtracted content (${extractedText.length} chars):\n${preview}`;

    const { error: userMsgError } = await supabase
      .from("ingestion_messages")
      .insert({
        session_id: activeSessionId,
        role: "user",
        content: userMessageContent,
      });

    if (userMsgError) {
      console.error("[ingest-file] Failed to save user message:", userMsgError.message);
      // Non-fatal: continue with AI call
    }

    // =========================================================================
    // 9. FETCH SYSTEM PROMPT
    // =========================================================================
    const promptSlug = FILE_PROMPT_MAP[productTable] || "ingest-file-prep-recipe";
    const { data: promptRow, error: promptError } = await supabase
      .from("ai_prompts")
      .select("prompt_en, prompt_es")
      .eq("slug", promptSlug)
      .eq("is_active", true)
      .single();

    if (promptError) {
      console.error("[ingest-file] Failed to load prompt:", promptError.message);
      return errorResponse("server_error", "Failed to load AI prompt", 500);
    }

    const systemPrompt = language === "es" && promptRow.prompt_es
      ? promptRow.prompt_es
      : promptRow.prompt_en;

    // =========================================================================
    // 10. GET OPENAI API KEY
    // =========================================================================
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[ingest-file] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    // =========================================================================
    // 11. CALL OPENAI — Wine: two-call pipeline, Prep: single call
    // =========================================================================

    const isWine = productTable === "wines";
    let draft: ProductDraft;

    if (isWine) {
      // -----------------------------------------------------------------
      // Wine: Call 1 — Responses API + web_search_preview
      // -----------------------------------------------------------------
      console.log("[ingest-file] Wine: Call 1 — Responses API with web search...");

      const wineUserText = existingDraft && existingDraft.name
        ? `This is an additional file for an existing wine draft. Current draft:\n\n${JSON.stringify(existingDraft, null, 2)}\n\nHere is the extracted text from the file:\n\n${extractedText}\n\nAnalyze the file content and search the web for this wine. Merge any new information into the draft, filling in empty fields like tasting notes, producer notes, and service recommendations.`
        : `Here is a wine document to analyze:\n\n${extractedText}\n\nExtract all wine information from the document. Then search the web for this wine to find: detailed tasting notes (aromas, palate, finish), producer background and winemaking philosophy, body classification, and food pairing recommendations for a steakhouse. Provide a comprehensive analysis.`;

      const call1Response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.2",
          instructions: systemPrompt,
          input: wineUserText,
          tools: [{ type: "web_search_preview", search_context_size: "medium" }],
        }),
      });

      if (!call1Response.ok) {
        const errText = await call1Response.text();
        console.error(`[ingest-file] Wine Call 1 (Responses API) error ${call1Response.status}:`, errText);
        return errorResponse("ai_error", "Failed to analyze wine with web search", 500);
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
        console.error("[ingest-file] Wine Call 1 returned no text output");
        return errorResponse("ai_error", "AI web search returned empty response", 500);
      }

      console.log(`[ingest-file] Wine Call 1 complete: ${call1Text.length} chars of analysis`);

      // -----------------------------------------------------------------
      // Wine: Call 2 — Chat Completions + json_schema (structured extraction)
      // -----------------------------------------------------------------
      console.log("[ingest-file] Wine: Call 2 — structured extraction...");

      const call2UserContent = existingDraft && existingDraft.name
        ? `CURRENT DRAFT:\n${JSON.stringify(existingDraft, null, 2)}\n\nASSISTANT ANALYSIS (from document + web research):\n${call1Text}\n\nMerge the analysis into the existing draft. Preserve all existing non-empty values. Fill in empty fields from the analysis.`
        : `ASSISTANT ANALYSIS (from document + web research):\n${call1Text}\n\nExtract all wine data into the structured format. Fill in ALL fields — use the web research to provide complete tasting notes, producer notes, and service recommendations.`;

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
        console.error(`[ingest-file] Wine Call 2 (Chat Completions) error ${call2Response.status}:`, errText);
        return errorResponse("ai_error", "Failed to structure wine data", 500);
      }

      const call2Data = await call2Response.json();
      const rawContent = call2Data.choices?.[0]?.message?.content;

      if (!rawContent) {
        console.error("[ingest-file] Wine Call 2 returned empty content");
        return errorResponse("ai_error", "AI returned empty structured response", 500);
      }

      try {
        draft = JSON.parse(rawContent) as WineDraft;
      } catch (_parseError) {
        console.error("[ingest-file] Failed to parse Wine Call 2 response as JSON:", rawContent);
        return errorResponse("ai_error", "AI returned invalid JSON", 500);
      }

    } else {
      // -----------------------------------------------------------------
      // Prep recipe / Cocktail: Single call (Chat Completions + json_schema)
      // -----------------------------------------------------------------
      const isCocktail = productTable === "cocktails";
      const draftSchema = isCocktail ? COCKTAIL_DRAFT_SCHEMA : PREP_RECIPE_DRAFT_SCHEMA;
      const productLabel = isCocktail ? "cocktail" : "recipe";

      console.log(`[ingest-file] Calling OpenAI (GPT-5.2, json_schema) for ${productLabel}...`);

      let userMessageText: string;

      if (existingDraft && existingDraft.name) {
        userMessageText = isCocktail
          ? `This is an additional file for an existing cocktail draft. Here is the current draft data:\n\n${JSON.stringify(existingDraft, null, 2)}\n\nMerge any new information from the following extracted text into the existing draft. Keep all existing data intact and add or update fields with new information. Look for ingredients, measurements, glassware, garnish, and technique details.\n\nExtracted text:\n${extractedText}`
          : "This is an additional file for an existing recipe draft. Here is the current draft data:\n\n" +
            JSON.stringify(existingDraft, null, 2) +
            "\n\nMerge any new information from the following extracted text into the existing draft. Keep all existing data intact and add or update fields with new information.\n\nExtracted text:\n" +
            extractedText;
      } else {
        userMessageText = isCocktail
          ? `Here is a cocktail document to structure. Extract all cocktail details including ingredients with measurements, glassware, technique, garnish, and tasting notes:\n\n${extractedText}`
          : `Here is a recipe document to structure:\n\n${extractedText}`;
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
            { role: "user", content: userMessageText },
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
        console.error(`[ingest-file] OpenAI error ${openaiResponse.status}:`, errText);
        return errorResponse("ai_error", `Failed to structure ${productLabel} from file`, 500);
      }

      const aiData = await openaiResponse.json();
      const rawContent = aiData.choices?.[0]?.message?.content;

      if (!rawContent) {
        console.error("[ingest-file] OpenAI returned empty content");
        return errorResponse("ai_error", "AI returned empty response", 500);
      }

      try {
        draft = JSON.parse(rawContent) as ProductDraft;
      } catch (_parseError) {
        console.error("[ingest-file] Failed to parse AI response as JSON:", rawContent);
        return errorResponse("ai_error", "AI returned invalid JSON", 500);
      }
    }

    // Add slug (not in AI schema, needed by frontend)
    // deno-lint-ignore no-explicit-any
    (draft as any).slug = generateSlug(draft.name);

    // Type-specific post-processing
    if (isWine || productTable === "cocktails") {
      // Wine and cocktail use single `image` string field — preserve existing
      // deno-lint-ignore no-explicit-any
      const existingImage: string | null = (existingDraft as any)?.image || null;
      // deno-lint-ignore no-explicit-any
      (draft as any).image = existingImage;
    } else {
      // Prep recipe uses `images` array — preserve existing
      // deno-lint-ignore no-explicit-any
      const existingImages: Array<{url: string; alt: string; caption: string}> = (existingDraft as any)?.images || [];
      // deno-lint-ignore no-explicit-any
      (draft as any).images = existingImages;
    }

    console.log(
      `[ingest-file] Structured draft: name="${draft.name}", confidence=${draft.confidence}, missing=${draft.missingFields.length}`
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
      console.error("[ingest-file] Failed to save draft to session:", updateError.message);
      // Non-fatal: we still return the draft to the client
    }

    // =========================================================================
    // 14. SAVE AI MESSAGE
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
      console.error("[ingest-file] Failed to save AI message:", aiMsgError.message);
      // Non-fatal
    }

    // =========================================================================
    // 15. RETURN RESPONSE
    // =========================================================================
    console.log(`[ingest-file] Complete: sessionId=${activeSessionId}, file="${file.name}"`);

    return jsonResponse({
      sessionId: activeSessionId,
      message: draft.aiMessage,
      draft,
      confidence: draft.confidence,
      missingFields: draft.missingFields,
      fileName: file.name,
      extractedLength: extractedText.length,
    });
  } catch (error) {
    console.error("[ingest-file] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
