/**
 * Ask Form Edge Function
 *
 * AI assistant for form filling — extracts structured field values from
 * unstructured natural language input (text, voice transcript, image
 * description). Supports multi-turn conversation with tool use.
 *
 * Tools (conditionally enabled per template.ai_tools):
 *   - search_contacts: FTS-only contact directory search
 *   - search_manual: hybrid (FTS + vector) manual search
 *   - search_products: hybrid (FTS + vector) multi-domain product search
 *
 * Auth: verify_jwt=false -- manual JWT verification via authenticateWithClaims()
 */

import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithClaims, AuthError } from "../_shared/auth.ts";
import { checkUsage, incrementUsage, UsageError } from "../_shared/usage.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";

// =============================================================================
// TYPES
// =============================================================================

interface AskFormRequest {
  question: string;
  templateId: string;
  currentValues?: Record<string, unknown>;
  language?: "en" | "es";
  groupId: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  sessionId?: string;
}

interface ToolResultSummary {
  tool: string;
  query: string;
  resultCount: number;
  topResult?: string;
}

interface FormCitation {
  source: string;
  title: string;
  snippet: string;
}

interface AskFormResponse {
  fieldUpdates: Record<string, unknown>;
  missingFields: string[];
  followUpQuestion: string | null;
  message: string;
  toolResults: ToolResultSummary[];
  citations: FormCitation[];
  usage: {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  };
  sessionId: string;
}

// deno-lint-ignore no-explicit-any
type FormFieldDef = any;

// deno-lint-ignore no-explicit-any
type FormTemplateRow = any;

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_TOOL_ROUNDS = 3;
const MAX_QUESTION_LENGTH = 5000;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_LENGTH = 2000;
const OPENAI_TIMEOUT_MS = 45_000;

const NON_FILLABLE_TYPES = new Set([
  "header",
  "instructions",
  "signature",
  "image",
  "file",
]);

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Respond in English.",
  es: "Responde en espanol.",
};

// =============================================================================
// BASE IDENTITY PROMPT
// =============================================================================

const BASE_IDENTITY_PROMPT = `You are the AI form assistant for Alamo Prime steakhouse. You help restaurant staff fill out operational forms (write-ups, injury reports, etc.) by extracting structured field values from unstructured natural language input.

Today's date is YYYY-MM-DD.

Your job:
1. Read the user's description of the situation.
2. Extract values for as many form fields as possible.
3. Use available tools to look up missing information (contacts, manual procedures).
4. Report which required fields are still missing and ask about them.
5. Be factual, professional, and concise.

CRITICAL RULES:
- Only populate fields defined in the form schema below. Never invent field keys.
- For select/radio fields, the value MUST be one of the defined options (exact match).
- For checkbox fields, the value MUST be an array of strings from the defined options.
- For date fields, output ISO 8601 format: YYYY-MM-DD.
- For time fields, output 24-hour format: HH:MM.
- For datetime fields, output ISO 8601: YYYY-MM-DDTHH:MM.
- For number fields, output a numeric value (not a string).
- Never populate signature, image, or file fields -- those require user interaction.
- If you cannot determine a field value with confidence, omit it from fieldUpdates and include the field key in missingFields.
- Do not overwrite existing field values unless the user explicitly corrects them.
- fieldUpdates REPLACE previous values for the same key (not merge).
- If conditional fields depend on a controlling field, set the controlling field value too.

Your response MUST be a JSON object with this exact structure:

{
  "fieldUpdates": { "<field_key>": "<value matching field type>" },
  "missingFields": ["<required_field_key>"],
  "followUpQuestion": "<question about missing fields or null>",
  "message": "<your conversational response to the user>"
}`;

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOL_SEARCH_CONTACTS = {
  type: "function",
  function: {
    name: "search_contacts",
    description:
      "Search the restaurant's contacts database (hospitals, emergency services, " +
      "management, vendors, insurance). Use when the form needs contact information.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query -- e.g., "hospital", "regional manager", "insurance"',
        },
        category: {
          type: "string",
          description: "Optional category filter",
          enum: [
            "emergency",
            "medical",
            "management",
            "vendor",
            "government",
            "insurance",
          ],
        },
      },
      required: ["query"],
    },
  },
};

const TOOL_SEARCH_MANUAL = {
  type: "function",
  function: {
    name: "search_manual",
    description:
      "Search the restaurant operations manual for policies, procedures, safety protocols, and SOPs.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query -- e.g., "injury reporting procedure", "write-up policy"',
        },
      },
      required: ["query"],
    },
  },
};

const TOOL_SEARCH_PRODUCTS = {
  type: "function",
  function: {
    name: "search_products",
    description:
      "Search the restaurant's menu, recipes, wines, cocktails, and beverages.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query -- e.g., "ribeye allergens", "chimichurri recipe"',
        },
        domain: {
          type: "string",
          description: "Which product database to search",
          enum: ["dishes", "wines", "cocktails", "recipes", "beer_liquor"],
        },
      },
      required: ["query", "domain"],
    },
  },
};

// deno-lint-ignore no-explicit-any
const TOOL_REGISTRY: Record<string, any> = {
  search_contacts: TOOL_SEARCH_CONTACTS,
  search_manual: TOOL_SEARCH_MANUAL,
  search_products: TOOL_SEARCH_PRODUCTS,
};

// =============================================================================
// HELPER: getQueryEmbedding
// =============================================================================

async function getQueryEmbedding(
  query: string,
  apiKey: string,
): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
        "[ask-form] OpenAI embedding error:",
        response.status,
        errorText,
      );
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("[ask-form] Failed to generate query embedding:", error);
    return null;
  }
}

// =============================================================================
// HELPER: evaluateCondition
// =============================================================================

function evaluateCondition(
  condition: { field: string; operator: string; value: unknown },
  values: Record<string, unknown>,
): boolean {
  const fieldValue = values[condition.field];
  switch (condition.operator) {
    case "eq":
      return fieldValue === condition.value;
    case "neq":
      return fieldValue !== condition.value;
    case "in":
      return (
        Array.isArray(condition.value) &&
        condition.value.includes(fieldValue)
      );
    case "exists":
      return (
        fieldValue !== undefined && fieldValue !== null && fieldValue !== ""
      );
    default:
      return true;
  }
}

// =============================================================================
// HELPER: buildSystemPrompt
// =============================================================================

function buildSystemPrompt(
  template: FormTemplateRow,
  currentValues: Record<string, unknown>,
  language: "en" | "es",
): string {
  const langInstruction =
    LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;

  const fields = (template.fields || []) as FormFieldDef[];
  const fillableFields = fields.filter(
    (f: FormFieldDef) => !NON_FILLABLE_TYPES.has(f.type),
  );

  const today = new Date().toISOString().split("T")[0];

  const fieldLines = fillableFields.map((f: FormFieldDef, i: number) => {
    const label =
      language === "es" ? f.label_es || f.label : f.label;
    const parts = [
      `  [${i + 1}] ${f.key} (${f.type}${f.required ? ", REQUIRED" : ""})`,
      `      Label: "${label}"`,
    ];
    if (f.options?.length) {
      parts.push(`      Options: ${JSON.stringify(f.options)}`);
    }
    if (f.ai_hint) {
      parts.push(`      AI Hint: "${f.ai_hint}"`);
    }
    if (f.condition) {
      const condMet = evaluateCondition(f.condition, currentValues);
      if (!condMet) {
        parts.push(
          `      (Hidden until ${f.condition.field} ${f.condition.operator} ${JSON.stringify(f.condition.value)})`,
        );
      }
    }
    const cv = currentValues[f.key];
    parts.push(
      `      Current Value: ${cv !== undefined && cv !== null && cv !== "" ? JSON.stringify(cv) : "<empty>"}`,
    );
    return parts.join("\n");
  });

  const filledKeys = fillableFields
    .filter((f: FormFieldDef) => {
      const v = currentValues[f.key];
      return v !== undefined && v !== null && v !== "";
    })
    .map(
      (f: FormFieldDef) =>
        `  - ${f.key} = ${JSON.stringify(currentValues[f.key])}`,
    );

  const filledSummary = filledKeys.length
    ? `\nALREADY-FILLED FIELDS (${filledKeys.length} of ${fillableFields.length}):\n${filledKeys.join("\n")}`
    : "\nALREADY-FILLED FIELDS: none";

  const formTitle =
    language === "es"
      ? template.title_es || template.title_en
      : template.title_en;
  const instructions =
    language === "es" ? template.instructions_es : template.instructions_en;

  return `${BASE_IDENTITY_PROMPT.replace("YYYY-MM-DD", today)}
- ${langInstruction}

=== FORM: ${formTitle} ===

FIELDS (${fillableFields.length} fillable fields):

${fieldLines.join("\n\n")}
${filledSummary}
${instructions ? `\n=== FORM INSTRUCTIONS ===\n${instructions}` : ""}`;
}

// =============================================================================
// HELPER: getToolsForTemplate
// =============================================================================

// deno-lint-ignore no-explicit-any
function getToolsForTemplate(template: FormTemplateRow): any[] {
  // deno-lint-ignore no-explicit-any
  const tools: any[] = [];
  for (const toolName of template.ai_tools || []) {
    if (TOOL_REGISTRY[toolName]) {
      tools.push(TOOL_REGISTRY[toolName]);
    }
  }
  return tools;
}

// =============================================================================
// HELPER: executeTool
// =============================================================================

async function executeTool(
  supabase: SupabaseClient,
  toolName: string,
  // deno-lint-ignore no-explicit-any
  args: Record<string, any>,
  language: string,
  groupId: string,
  apiKey: string,
  // deno-lint-ignore no-explicit-any
): Promise<{ results: any[]; citation: FormCitation | null }> {
  switch (toolName) {
    case "search_contacts": {
      // FTS-only (no embedding needed)
      const { data, error } = await supabase.rpc("search_contacts", {
        search_query: args.query,
        match_count: 5,
        p_group_id: groupId,
        p_category: args.category || null,
      });

      if (error) {
        console.error(
          "[ask-form] search_contacts error:",
          error.message,
        );
        return { results: [], citation: null };
      }

      const results = data || [];
      const citation: FormCitation | null = results.length > 0
        ? {
            source: "contacts",
            title: `Contact: ${results[0].name}`,
            snippet: [
              results[0].category,
              results[0].phone,
              results[0].contact_person,
            ]
              .filter(Boolean)
              .join(" | "),
          }
        : null;

      return { results, citation };
    }

    case "search_manual": {
      // Hybrid search with embedding
      const embedding = await getQueryEmbedding(args.query, apiKey);
      if (!embedding) {
        return { results: [], citation: null };
      }

      const { data, error } = await supabase.rpc("search_manual_v2", {
        search_query: args.query,
        query_embedding: JSON.stringify(embedding),
        search_language: language,
        result_limit: 3,
      });

      if (error) {
        console.error(
          "[ask-form] search_manual error:",
          error.message,
        );
        return { results: [], citation: null };
      }

      const results = data || [];
      const citation: FormCitation | null = results.length > 0
        ? {
            source: "manual",
            title: results[0].name || results[0].slug,
            snippet: results[0].snippet
              ? results[0].snippet.replace(/<\/?mark>/g, "")
              : "",
          }
        : null;

      return { results, citation };
    }

    case "search_products": {
      // Hybrid search with embedding, multi-domain
      const domain = args.domain || "dishes";
      const fnMap: Record<string, string> = {
        dishes: "search_dishes",
        wines: "search_wines",
        cocktails: "search_cocktails",
        recipes: "search_recipes",
        beer_liquor: "search_beer_liquor",
      };
      const fnName = fnMap[domain] || "search_dishes";

      const embedding = await getQueryEmbedding(args.query, apiKey);
      if (!embedding) {
        return { results: [], citation: null };
      }

      const { data, error } = await supabase.rpc(fnName, {
        search_query: args.query,
        query_embedding: JSON.stringify(embedding),
        result_limit: 5,
        keyword_weight: 0.4,
        vector_weight: 0.6,
      });

      if (error) {
        console.error(
          `[ask-form] ${fnName} error:`,
          error.message,
        );
        return { results: [], citation: null };
      }

      const results = data || [];
      const citation: FormCitation | null = results.length > 0
        ? {
            source: `products/${domain}`,
            title: results[0].name || results[0].slug,
            snippet: results[0].snippet
              ? results[0].snippet.replace(/<\/?mark>/g, "")
              : "",
          }
        : null;

      return { results, citation };
    }

    default:
      console.warn(`[ask-form] Unknown tool: ${toolName}`);
      return { results: [], citation: null };
  }
}

// =============================================================================
// HELPER: formatToolResults (for OpenAI tool response messages)
// =============================================================================

// deno-lint-ignore no-explicit-any
function formatToolResults(toolName: string, results: any[]): string {
  if (!results.length) return "No results found.";

  switch (toolName) {
    case "search_contacts":
      return results
        // deno-lint-ignore no-explicit-any
        .map((r: any, i: number) => {
          const parts = [`${i + 1}. ${r.name}`];
          if (r.category) parts.push(`   Category: ${r.category}`);
          if (r.subcategory) parts.push(`   Subcategory: ${r.subcategory}`);
          if (r.phone) parts.push(`   Phone: ${r.phone}`);
          if (r.contact_person)
            parts.push(`   Contact Person: ${r.contact_person}`);
          if (r.address) parts.push(`   Address: ${r.address}`);
          if (r.email) parts.push(`   Email: ${r.email}`);
          if (r.notes) parts.push(`   Notes: ${r.notes}`);
          return parts.join("\n");
        })
        .join("\n\n");

    case "search_manual":
      return results
        // deno-lint-ignore no-explicit-any
        .map((r: any, i: number) => {
          const parts = [`${i + 1}. ${r.name || r.slug}`];
          if (r.snippet)
            parts.push(`   ${r.snippet.replace(/<\/?mark>/g, "")}`);
          if (r.category) parts.push(`   Category: ${r.category}`);
          return parts.join("\n");
        })
        .join("\n\n");

    case "search_products":
      return results
        // deno-lint-ignore no-explicit-any
        .map((r: any, i: number) => {
          const parts = [`${i + 1}. ${r.name} (${r.slug})`];
          if (r.snippet)
            parts.push(`   ${r.snippet.replace(/<\/?mark>/g, "")}`);
          if (r.plate_type) parts.push(`   Type: ${r.plate_type}`);
          if (r.category) parts.push(`   Category: ${r.category}`);
          return parts.join("\n");
        })
        .join("\n\n");

    default:
      return JSON.stringify(results, null, 2);
  }
}

// =============================================================================
// HELPER: extractJsonFromResponse
// =============================================================================

function extractJsonFromResponse(
  text: string,
): Record<string, unknown> | null {
  // Tier 1: pure JSON
  try {
    return JSON.parse(text);
  } catch {
    /* not pure JSON */
  }

  // Tier 2: code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {
      /* invalid JSON in code block */
    }
  }

  // Tier 3: brace extraction
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      /* invalid JSON in braces */
    }
  }

  return null;
}

// =============================================================================
// HELPER: validateFieldUpdates
// =============================================================================

function validateFieldUpdates(
  fields: FormFieldDef[],
  updates: Record<string, unknown>,
): { valid: Record<string, unknown>; invalid: string[] } {
  const fieldMap = new Map(
    fields.map((f: FormFieldDef) => [f.key, f]),
  );
  const valid: Record<string, unknown> = {};
  const invalid: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    const field = fieldMap.get(key);

    // Unknown field key
    if (!field) {
      invalid.push(key);
      continue;
    }

    // Non-fillable field type
    if (NON_FILLABLE_TYPES.has(field.type)) {
      invalid.push(key);
      continue;
    }

    // Select/Radio validation: must be one of the defined options
    if (
      (field.type === "select" || field.type === "radio") &&
      field.options?.length
    ) {
      if (typeof value !== "string" || !field.options.includes(value)) {
        invalid.push(key);
        continue;
      }
    }

    // Checkbox validation: must be array of valid options
    if (field.type === "checkbox" && field.options?.length) {
      if (
        !Array.isArray(value) ||
        !value.every((v: unknown) =>
          typeof v === "string" && field.options!.includes(v)
        )
      ) {
        invalid.push(key);
        continue;
      }
    }

    // Number validation
    if (field.type === "number") {
      const num = typeof value === "number" ? value : Number(value);
      if (isNaN(num)) {
        invalid.push(key);
        continue;
      }
      valid[key] = num;
      continue;
    }

    // Date validation: YYYY-MM-DD
    if (field.type === "date" && typeof value === "string") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        invalid.push(key);
        continue;
      }
    }

    // Time validation: HH:MM
    if (field.type === "time" && typeof value === "string") {
      if (!/^\d{2}:\d{2}$/.test(value)) {
        invalid.push(key);
        continue;
      }
    }

    valid[key] = value;
  }

  return { valid, invalid };
}

// =============================================================================
// HELPER: resolveContactLookups
// =============================================================================

async function resolveContactLookups(
  supabase: SupabaseClient,
  fields: FormFieldDef[],
  updates: Record<string, unknown>,
  groupId: string,
): Promise<Record<string, unknown>> {
  const resolved = { ...updates };

  for (const field of fields) {
    if (field.type !== "contact_lookup") continue;

    const aiValue = updates[field.key];
    if (!aiValue || typeof aiValue !== "string") continue;

    try {
      const { data, error } = await supabase.rpc("search_contacts", {
        search_query: aiValue,
        match_count: 1,
        p_group_id: groupId,
        p_category: field.validation?.contact_category || null,
      });

      if (error) {
        console.error(
          `[ask-form] Contact lookup error for "${field.key}":`,
          error.message,
        );
        continue;
      }

      if (data?.[0]) {
        resolved[field.key] = {
          contact_id: data[0].id,
          name: data[0].name,
          phone: data[0].phone,
          contact_person: data[0].contact_person,
        };
      }
    } catch (err) {
      console.error(
        `[ask-form] Contact lookup exception for "${field.key}":`,
        err,
      );
    }
  }

  return resolved;
}

// =============================================================================
// HELPER: callOpenAI
// =============================================================================

async function callOpenAI(
  apiKey: string,
  // deno-lint-ignore no-explicit-any
  params: Record<string, any>,
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
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
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// HELPER: UUID format validation
// =============================================================================

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str,
  );
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // =========================================================================
  // Step 1: CORS preflight
  // =========================================================================
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[ask-form] Request received");

  try {
    // =========================================================================
    // Step 2: Authenticate via authenticateWithClaims(req)
    // =========================================================================
    const { userId, supabase } = await authenticateWithClaims(req);
    console.log("[ask-form] Authenticated user:", userId);

    // =========================================================================
    // Step 3: Parse + validate request body
    // =========================================================================
    const body = (await req.json()) as AskFormRequest;
    const {
      question,
      templateId,
      currentValues = {},
      language = "en",
      groupId,
      conversationHistory = [],
      sessionId,
    } = body;

    // Validate question
    if (!question?.trim()) {
      return errorResponse("bad_request", "Question is required", 400);
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return errorResponse(
        "bad_request",
        `Question must be ${MAX_QUESTION_LENGTH} characters or fewer`,
        400,
      );
    }

    // Validate templateId (UUID format)
    if (!templateId || !isValidUUID(templateId)) {
      return errorResponse(
        "bad_request",
        "Valid templateId (UUID) is required",
        400,
      );
    }

    // Validate groupId
    if (!groupId) {
      return errorResponse("bad_request", "Group ID is required", 400);
    }

    console.log(
      `[ask-form] Template: ${templateId} | Lang: ${language} | History: ${conversationHistory.length} msgs`,
    );

    // =========================================================================
    // Step 4: Check usage limits via checkUsage()
    // =========================================================================
    const usage = await checkUsage(supabase, userId, groupId);

    if (!usage) {
      return errorResponse("forbidden", "Not a member of this group", 403);
    }

    if (!usage.can_ask) {
      const limitType =
        usage.daily_count >= usage.daily_limit ? "daily" : "monthly";
      console.log("[ask-form] Usage limit exceeded:", limitType);
      return jsonResponse(
        {
          error: "limit_exceeded",
          message:
            limitType === "daily"
              ? language === "es"
                ? "Limite diario alcanzado. Intenta manana."
                : "Daily question limit reached. Try again tomorrow."
              : language === "es"
                ? "Limite mensual alcanzado."
                : "Monthly question limit reached.",
          usage: {
            dailyUsed: usage.daily_count,
            dailyLimit: usage.daily_limit,
            monthlyUsed: usage.monthly_count,
            monthlyLimit: usage.monthly_limit,
          },
        },
        429,
      );
    }

    // =========================================================================
    // Step 5: Fetch template via service client (published + group_id match)
    // =========================================================================
    const { data: template, error: templateError } = await supabase
      .from("form_templates")
      .select("*")
      .eq("id", templateId)
      .eq("status", "published")
      .eq("group_id", groupId)
      .single();

    if (templateError || !template) {
      console.error(
        "[ask-form] Template fetch error:",
        templateError?.message || "Not found",
      );
      return errorResponse(
        "not_found",
        "Form template not found or not published",
        404,
      );
    }

    console.log(
      `[ask-form] Template loaded: "${template.title_en}" | AI tools: ${(template.ai_tools || []).join(", ") || "none"}`,
    );

    // =========================================================================
    // Step 6: Build system prompt via buildSystemPrompt()
    // =========================================================================
    const systemPrompt = buildSystemPrompt(template, currentValues, language);

    // =========================================================================
    // Step 7: Assemble messages: system + history (max 6, each max 2000 chars) + user
    // =========================================================================
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    // Sanitize and add conversation history (max 6 messages, each max 2000 chars)
    const sanitizedHistory = conversationHistory
      .slice(-MAX_HISTORY_MESSAGES)
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_HISTORY_MESSAGE_LENGTH),
      }));

    messages.push(...sanitizedHistory);
    messages.push({ role: "user", content: question.trim() });

    // =========================================================================
    // Step 8: Tool-use loop (max 3 rounds) with OpenAI gpt-4o-mini
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[ask-form] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    // Get tools enabled for this template
    const tools = getToolsForTemplate(template);
    const hasTools = tools.length > 0;

    const toolResultSummaries: ToolResultSummary[] = [];
    const citations: FormCitation[] = [];

    console.log(
      `[ask-form] Calling OpenAI${hasTools ? ` with ${tools.length} tool(s)` : ""}...`,
    );

    // Initial OpenAI call
    // deno-lint-ignore no-explicit-any
    const initialParams: Record<string, any> = {
      messages,
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.3,
    };

    if (hasTools) {
      initialParams.tools = tools;
      initialParams.tool_choice = "auto";
    }

    let aiData = await callOpenAI(OPENAI_API_KEY, initialParams);

    // Tool-use loop
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const assistantMsg = aiData.choices?.[0]?.message;

      // If no tool calls, we have the final answer
      if (!assistantMsg?.tool_calls?.length) {
        break;
      }

      console.log(
        `[ask-form] Round ${round + 1}: AI requested ${assistantMsg.tool_calls.length} tool call(s)`,
      );

      // Add assistant message with tool_calls to conversation
      messages.push(assistantMsg);

      // Execute each tool call
      // deno-lint-ignore no-explicit-any
      for (const toolCall of assistantMsg.tool_calls as any[]) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          console.error(
            `[ask-form] Failed to parse tool args for ${fnName}:`,
            toolCall.function.arguments,
          );
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: "Error: Invalid tool arguments",
          });
          continue;
        }

        console.log(
          `[ask-form] Executing tool: ${fnName}(${JSON.stringify(fnArgs)})`,
        );

        const { results, citation } = await executeTool(
          supabase,
          fnName,
          fnArgs,
          language,
          groupId,
          OPENAI_API_KEY,
        );

        // Record tool result summary
        toolResultSummaries.push({
          tool: fnName,
          query: (fnArgs.query as string) || "",
          resultCount: results.length,
          topResult: results.length > 0
            ? results[0].name || results[0].slug || undefined
            : undefined,
        });

        // Record citation
        if (citation) {
          citations.push(citation);
        }

        // Format results as tool response
        const formattedResults = formatToolResults(fnName, results);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: formattedResults,
        });

        console.log(`[ask-form] ${fnName}: ${results.length} results`);
      }

      // Follow-up OpenAI call with tool results
      const isLastRound = round === MAX_TOOL_ROUNDS - 1;
      // deno-lint-ignore no-explicit-any
      const followUpParams: Record<string, any> = {
        messages,
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.3,
      };

      // Only provide tools if not on the last round (force final answer)
      if (!isLastRound && hasTools) {
        followUpParams.tools = tools;
        followUpParams.tool_choice = "auto";
      }

      aiData = await callOpenAI(OPENAI_API_KEY, followUpParams);
    }

    // =========================================================================
    // Step 9: Extract JSON from final answer via extractJsonFromResponse()
    // =========================================================================
    const finalMsg = aiData.choices?.[0]?.message;
    const rawContent = finalMsg?.content?.trim() || "";

    let parsedResponse = extractJsonFromResponse(rawContent);

    // Fallback: if JSON parsing failed entirely, return the raw text as message
    if (!parsedResponse) {
      console.warn(
        "[ask-form] Failed to parse JSON from AI response, returning raw text",
      );
      parsedResponse = {
        fieldUpdates: {},
        missingFields: [],
        followUpQuestion: null,
        message: rawContent || "I was unable to process your request. Please try again.",
      };
    }

    const rawFieldUpdates =
      (parsedResponse.fieldUpdates as Record<string, unknown>) || {};
    const aiMissingFields =
      (parsedResponse.missingFields as string[]) || [];
    const followUpQuestion =
      (parsedResponse.followUpQuestion as string | null) || null;
    const aiMessage = (parsedResponse.message as string) || "";

    // =========================================================================
    // Step 10: Validate field updates via validateFieldUpdates()
    // =========================================================================
    const templateFields = (template.fields || []) as FormFieldDef[];
    const { valid: validUpdates, invalid: invalidKeys } =
      validateFieldUpdates(templateFields, rawFieldUpdates);

    if (invalidKeys.length > 0) {
      console.warn(
        `[ask-form] Dropped ${invalidKeys.length} invalid field(s): ${invalidKeys.join(", ")}`,
      );
    }

    // =========================================================================
    // Step 11: Resolve contact lookups via resolveContactLookups()
    // =========================================================================
    const resolvedUpdates = await resolveContactLookups(
      supabase,
      templateFields,
      validUpdates,
      groupId,
    );

    // =========================================================================
    // Step 12: Compute missing required fields
    // =========================================================================
    const fillableFields = templateFields.filter(
      (f: FormFieldDef) => !NON_FILLABLE_TYPES.has(f.type),
    );
    const requiredFields = fillableFields.filter(
      (f: FormFieldDef) => f.required,
    );

    // Merge current values with new updates to determine what's still missing
    const mergedValues = { ...currentValues, ...resolvedUpdates };

    const missingFields = requiredFields
      .filter((f: FormFieldDef) => {
        // If field is conditional and condition is not met, it's not required
        if (f.condition) {
          const condMet = evaluateCondition(f.condition, mergedValues);
          if (!condMet) return false;
        }
        const v = mergedValues[f.key];
        return v === undefined || v === null || v === "";
      })
      .map((f: FormFieldDef) => f.key);

    // Merge AI-reported missing fields with computed ones (deduplicate)
    const allMissingFields = [
      ...new Set([...missingFields, ...aiMissingFields]),
    ];

    // =========================================================================
    // Step 13: Increment usage + return structured response
    // =========================================================================
    await incrementUsage(supabase, userId, groupId).catch((err) => {
      console.error("[ask-form] Failed to increment usage:", err);
    });

    // Re-fetch usage for response
    let updatedUsage = {
      dailyUsed: usage.daily_count + 1,
      dailyLimit: usage.daily_limit,
      monthlyUsed: usage.monthly_count + 1,
      monthlyLimit: usage.monthly_limit,
    };

    // Use a stable session ID: prefer the one passed in, else generate one
    const responseSessionId = sessionId || crypto.randomUUID();

    const response: AskFormResponse = {
      fieldUpdates: resolvedUpdates,
      missingFields: allMissingFields,
      followUpQuestion,
      message: aiMessage,
      toolResults: toolResultSummaries,
      citations,
      usage: updatedUsage,
      sessionId: responseSessionId,
    };

    console.log(
      `[ask-form] Success -- fields: ${Object.keys(resolvedUpdates).length}, missing: ${allMissingFields.length}, tools: ${toolResultSummaries.length}, followUp: ${followUpQuestion ? "yes" : "no"}`,
    );

    return jsonResponse(response);
  } catch (error) {
    // Handle specific error types
    if (error instanceof AuthError) {
      console.log("[ask-form] Auth error:", error.message);
      return errorResponse("Unauthorized", error.message, 401);
    }

    if (error instanceof UsageError) {
      console.error("[ask-form] Usage error:", error.message);
      return errorResponse("server_error", error.message, 500);
    }

    // Handle AbortError from timeout
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error("[ask-form] OpenAI request timed out");
      return errorResponse(
        "timeout",
        "AI request timed out. Please try again.",
        504,
      );
    }

    console.error("[ask-form] Unexpected error:", error);
    return errorResponse(
      "server_error",
      "An unexpected error occurred",
      500,
    );
  }
});
