/**
 * Refine Form Instructions Edge Function
 *
 * Multi-turn AI conversation for refining form template instructions.
 * The admin writes raw instructions, the AI refines them to be maximally
 * useful for the form-filling AI (ask-form). Returns refined instructions
 * with an explanation and suggestions.
 *
 * Admin/manager only. Uses GPT-4o-mini with JSON output mode.
 * Auth: verify_jwt=false -- manual JWT verification via authenticateWithClaims()
 */

import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithClaims, AuthError } from "../_shared/auth.ts";
import { checkUsage, incrementUsage, UsageError } from "../_shared/usage.ts";

// =============================================================================
// TYPES
// =============================================================================

interface FieldSummary {
  key: string;
  type: string;
  label: string;
  label_es?: string;
  required: boolean;
  options?: string[];
  ai_hint?: string;
}

interface RefineRequest {
  rawInstructions: string;
  templateContext: {
    title: string;
    fields: FieldSummary[];
    enabledTools: string[];
  };
  currentMetadata?: {
    titleEn: string;
    titleEs: string;
    descriptionEn: string;
    descriptionEs: string;
  };
  language: "en" | "es";
  conversationHistory?: Array<{ role: string; content: string }>;
  groupId: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_INSTRUCTIONS_LENGTH = 5000;
const MAX_HISTORY_MESSAGES = 6;
const OPENAI_TIMEOUT_MS = 30_000;

// Valid background colors for emoji icons
const VALID_ICON_COLORS = [
  "blue", "red", "orange", "amber", "green",
  "emerald", "purple", "pink", "slate", "gray",
];

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const REFINE_SYSTEM_PROMPT = `You are an instruction writer for Alamo Prime's form system. Your job is to take a restaurant manager's raw notes about a form and produce clear, human-friendly step-by-step instructions.

Today's date is YYYY-MM-DD.

## Important: These Instructions Serve Two Audiences

1. **Employees** read these instructions to understand how to fill out the form correctly.
2. **An AI assistant** also reads these same instructions to help employees fill the form via voice, chat, or manual entry.

Because the AI is smart and understands natural language, you should **optimize the instructions for human readability**. Write them as if you're explaining the process to a new employee — clear, friendly, and easy to follow. The AI will understand them just fine.

## Background: What the AI Can Do

The form-filling AI (ask-form) can:
- Read the form's field definitions and these instructions
- Extract values from what the employee says or types
- Call search tools if enabled (see below)
- Ask follow-up questions for missing required fields

## Available Search Tools

AVAILABLE_TOOLS_BLOCK

## The Form's Fields

FIELDS_BLOCK

## Writing Guidelines

1. **Use numbered steps separated by blank lines** — Each step should be its own paragraph for easy scanning. Aim for 5-10 steps.

2. **Write in plain, natural language** — Avoid technical jargon, field key names, or JSON references. Say "Enter the employee's full name" not "Populate the employee_name field."

3. **Mention what to look up** — If a step involves searching contacts, the manual, or products, say so naturally. Example: "Look up the nearest hospital in the contacts directory."

4. **Explain conditional steps clearly** — Example: "If the employee was transported to a hospital, record the hospital name and contact information."

5. **Highlight required information** — Make it clear which pieces of information are mandatory. Example: "Make sure to include the date, employee name, and manager signature — these are required."

6. **Keep it concise but complete** — Cover what the admin intended. Don't add extra steps they didn't ask for.

7. **Preserve the admin's intent** — Only clarify and organize what they wrote. Don't invent new requirements.

## Valid Tool IDs

TOOL_IDS_BLOCK

CURRENT_METADATA_BLOCK

## Icon
For suggestedIcon, choose a single emoji character that best represents the form's purpose (e.g., 📋, ⚠️, 🩺, 🍽️, 🔥, ⭐, 👥, 🛡️).
For suggestedIconColor, choose a matching background color from: blue, red, orange, amber, green, emerald, purple, pink, slate, gray.

## Field Label Review

Review the field labels listed above. If any have spelling errors, bad capitalization, or missing/incorrect Spanish translations, include corrections in suggestedFieldCorrections. Only include fields that actually need changes — return an empty array if all labels are fine. Use the field's \`key\` to identify it.

## Your Output

Respond with a JSON object:
{
  "refinedInstructions": "The step-by-step instructions in English. Use numbered steps (1. 2. 3.) with a blank line between each step. Write in natural, human-friendly language.",
  "refinedInstructionsEs": "The same instructions translated to natural Spanish, keeping the same numbered-step format.",
  "recommendedTools": ["REQUIRED: Array of tool IDs this form needs. Pick from the valid tool IDs list. Most forms need at least search_manual. Example: [\"search_manual\", \"search_contacts\"]"],
  "suggestedSystemPrompt": "Optional hidden system-level instructions for the AI only (technical details, business rules, edge cases the employee doesn't need to see). Leave empty string if not needed.",
  "suggestedTitleEn": "Spell-checked, properly capitalized English title for the form (e.g. 'Employee Write-Up Form')",
  "suggestedTitleEs": "Spanish translation of the title (e.g. 'Formulario de Amonestación')",
  "suggestedDescriptionEn": "1-2 sentence description of the form's purpose in English",
  "suggestedDescriptionEs": "Same description in Spanish",
  "suggestedIcon": "A single emoji character that best represents the form",
  "suggestedIconColor": "Background color from: blue, red, orange, amber, green, emerald, purple, pink, slate, gray",
  "suggestedFieldCorrections": [{"key": "field_key", "label": "Corrected English Label", "label_es": "Corrected Spanish Label"}],
  "explanation": "A friendly paragraph explaining what you organized and why, written to the admin. Mention any title/description/icon/field label changes you made.",
  "suggestions": ["Optional tips for the admin, e.g., 'Consider enabling the contacts search so the AI can auto-fill hospital info'"]
}

IMPORTANT RULES:
- Always output both English and Spanish instructions.
- The recommendedTools array must only contain IDs from the valid tool IDs list above.
- The suggestedIcon must be a single emoji character. The suggestedIconColor must be one of: blue, red, orange, amber, green, emerald, purple, pink, slate, gray.
- ALWAYS recommend at least one tool. Most forms benefit from search_manual at minimum. Analyze the instructions and pick every tool that could help the AI fill this form.
- ALWAYS provide suggestedTitleEn, suggestedTitleEs, suggestedDescriptionEn, suggestedDescriptionEs, and suggestedIcon.
- Fix spelling errors in the title. Use proper Title Case capitalization.
- If the admin left title_es, description_en, or description_es empty, generate appropriate values.`;

// =============================================================================
// ALL VALID TOOL IDS
// =============================================================================

const ALL_TOOL_IDS = [
  "search_contacts",
  "search_manual",
  "search_products",
  "search_standards",
  "search_steps_of_service",
];

// =============================================================================
// HELPER: buildToolDescriptions
// =============================================================================

function buildToolDescriptions(enabledTools: string[]): string {
  const TOOL_DESCRIPTIONS: Record<string, string> = {
    search_contacts:
      "search_contacts(query, category?) -- Searches the restaurant's contact directory " +
      "(hospitals, emergency services, management, vendors, insurance). Use when the form " +
      "needs to look up phone numbers, addresses, or contact persons. Categories: " +
      "emergency, medical, management, vendor, government, insurance.",

    search_manual:
      "search_manual(query) -- Searches the restaurant operations manual for SOPs, " +
      "policies, safety protocols, and procedures. Use when the form instructions " +
      "reference company policies, standard procedures, or the employee handbook. " +
      "The actual RPC is search_manual_v2 (hybrid FTS + vector search).",

    search_products:
      "search_products(query, domain) -- Searches product databases. Domains: dishes, " +
      "wines, cocktails, recipes, beer_liquor. Use when the form relates to menu items, " +
      "food safety incidents, or product-related issues.",

    search_standards:
      "search_manual(query) -- (Alias) Searches the operations manual focusing on " +
      "restaurant standards, quality expectations, and service protocols. Same underlying " +
      "function as search_manual.",

    search_steps_of_service:
      "search_manual(query) -- (Alias) Searches the operations manual focusing on " +
      "steps of service, guest interaction protocols, and FOH procedures. Same underlying " +
      "function as search_manual, but instruction should hint the query toward service steps.",
  };

  // Always show ALL tools so the AI knows what it can recommend
  const allDescriptions = ALL_TOOL_IDS
    .map((id) => TOOL_DESCRIPTIONS[id])
    .filter(Boolean);

  const enabledNote = enabledTools.length > 0
    ? `\n\nCurrently enabled on this form: ${enabledTools.join(", ")}`
    : "\n\nNo tools are currently enabled. Recommend whichever tools would help based on the instructions.";

  return (
    "The form-filling AI can use these search tools:\n" +
    allDescriptions.map((d, i) => `${i + 1}. ${d}`).join("\n") +
    enabledNote
  );
}

// =============================================================================
// HELPER: buildFieldsSummary
// =============================================================================

function buildFieldsSummary(fields: FieldSummary[]): string {
  if (!fields || fields.length === 0) {
    return "No fields defined yet.";
  }

  return fields
    .map((f, i) => {
      const labelPart = f.label_es
        ? `"${f.label}" / ES: "${f.label_es}"`
        : `"${f.label}"`;
      const parts = [
        `${i + 1}. ${f.key} (${f.type}${f.required ? ", REQUIRED" : ""}) -- ${labelPart}`,
      ];
      if (f.options?.length) {
        parts.push(`   Options: ${JSON.stringify(f.options)}`);
      }
      if (f.ai_hint) {
        parts.push(`   AI Hint: "${f.ai_hint}"`);
      }
      return parts.join("\n");
    })
    .join("\n");
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const { userId, supabase } = await authenticateWithClaims(req);

    // 2. Admin/manager check
    const { data: membership } = await supabase
      .from("group_memberships")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!membership || !["admin", "manager"].includes(membership.role)) {
      return errorResponse("forbidden", "Admin or manager access required", 403);
    }

    // 3. Parse + validate
    const body: RefineRequest = await req.json();
    const {
      rawInstructions,
      templateContext,
      language = "en",
      conversationHistory = [],
      groupId,
    } = body;

    if (!rawInstructions?.trim()) {
      return errorResponse("bad_request", "rawInstructions is required", 400);
    }
    if (rawInstructions.length > MAX_INSTRUCTIONS_LENGTH) {
      return errorResponse(
        "bad_request",
        `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} chars or fewer`,
        400,
      );
    }
    if (!templateContext?.title || !templateContext?.fields) {
      return errorResponse(
        "bad_request",
        "templateContext with title and fields is required",
        400,
      );
    }
    if (!groupId) {
      return errorResponse("bad_request", "groupId is required", 400);
    }

    // 4. Check usage
    const usage = await checkUsage(supabase, userId, groupId);
    if (!usage) {
      return errorResponse("forbidden", "Not a member of this group", 403);
    }
    if (!usage.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429);
    }

    // 5. Build system prompt
    const toolBlock = buildToolDescriptions(templateContext.enabledTools || []);
    const fieldsBlock = buildFieldsSummary(templateContext.fields);
    const today = new Date().toISOString().split("T")[0];
    const toolIdsBlock = ALL_TOOL_IDS.map((id) => `- ${id}`).join("\n");

    // Current metadata block (so AI can see what the admin already has)
    const meta = body.currentMetadata;
    const metadataBlock = meta
      ? [
          `## Current Form Metadata`,
          `Title (EN): "${meta.titleEn || ""}"`,
          `Title (ES): "${meta.titleEs || ""}"`,
          `Description (EN): "${meta.descriptionEn || ""}"`,
          `Description (ES): "${meta.descriptionEs || ""}"`,
          ``,
          `Review and improve these. Fix spelling errors, use proper Title Case capitalization,`,
          `and translate missing fields to the other language.`,
        ].join("\n")
      : "## Current Form Metadata\nNo metadata provided. Generate title and description from the instructions.";

    const systemPrompt = REFINE_SYSTEM_PROMPT
      .replace("YYYY-MM-DD", today)
      .replace("AVAILABLE_TOOLS_BLOCK", toolBlock)
      .replace("FIELDS_BLOCK", fieldsBlock)
      .replace("TOOL_IDS_BLOCK", toolIdsBlock)
      .replace("CURRENT_METADATA_BLOCK", metadataBlock);

    // 6. Assemble messages (system + history max 6 + user)
    const sanitizedHistory = conversationHistory
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, 2000),
      }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...sanitizedHistory,
      { role: "user", content: rawInstructions },
    ];

    // 7. Call OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[refine] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "refine_form_response",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    refinedInstructions: { type: "string", description: "Step-by-step instructions in English" },
                    refinedInstructionsEs: { type: "string", description: "Same instructions in Spanish" },
                    recommendedTools: { type: "array", items: { type: "string" }, description: "Tool IDs from the valid list" },
                    suggestedSystemPrompt: { type: "string", description: "Hidden AI-only instructions, or empty string" },
                    suggestedTitleEn: { type: "string", description: "Spell-checked English title in Title Case" },
                    suggestedTitleEs: { type: "string", description: "Spanish translation of the title" },
                    suggestedDescriptionEn: { type: "string", description: "1-2 sentence English description" },
                    suggestedDescriptionEs: { type: "string", description: "1-2 sentence Spanish description" },
                    suggestedIcon: { type: "string", description: "A single emoji character representing this form" },
                    suggestedIconColor: { type: "string", description: "Background color name from: blue, red, orange, amber, green, emerald, purple, pink, slate, gray" },
                    explanation: { type: "string", description: "Friendly summary of what was changed, for the admin" },
                    suggestions: { type: "array", items: { type: "string" }, description: "Optional tips for the admin" },
                    suggestedFieldCorrections: {
                      type: "array",
                      description: "Corrections for field labels with spelling errors or missing translations. Empty array if all labels are fine.",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string", description: "The field key to correct" },
                          label: { type: "string", description: "Corrected English label" },
                          label_es: { type: "string", description: "Corrected or new Spanish label" },
                        },
                        required: ["key", "label", "label_es"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: [
                    "refinedInstructions", "refinedInstructionsEs", "recommendedTools",
                    "suggestedSystemPrompt", "suggestedTitleEn", "suggestedTitleEs",
                    "suggestedDescriptionEn", "suggestedDescriptionEs", "suggestedIcon", "suggestedIconColor",
                    "explanation", "suggestions", "suggestedFieldCorrections",
                  ],
                  additionalProperties: false,
                },
              },
            },
            max_tokens: 2500,
            temperature: 0.4,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("[refine] OpenAI error:", response.status, errText);
        return errorResponse("ai_error", "Failed to refine instructions", 500);
      }

      const data = await response.json();

      // Check for truncated response before parsing
      if (data.choices[0].finish_reason === "length") {
        console.error(
          "[refine] OpenAI response truncated (finish_reason: length)",
        );
        return errorResponse(
          "ai_malformed",
          "The AI returned an invalid response. Please try again.",
          500,
        );
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data.choices[0].message.content);
      } catch (parseErr) {
        console.error("[refine] JSON.parse failed:", parseErr);
        return errorResponse(
          "ai_malformed",
          "The AI returned an invalid response. Please try again.",
          500,
        );
      }

      // 8. Increment usage (non-blocking — incrementUsage returns a native Promise)
      try {
        await incrementUsage(supabase, userId, groupId);
      } catch (usageErr) {
        console.error("[refine] incrementUsage failed:", usageErr);
      }

      // 9. Build updated conversation history for multi-turn support
      const updatedHistory = [
        ...sanitizedHistory,
        { role: "user" as const, content: rawInstructions },
        {
          role: "assistant" as const,
          content: data.choices[0].message.content,
        },
      ];

      // 10. Filter recommended tools to valid IDs only
      const rawTools = Array.isArray(parsed.recommendedTools) ? parsed.recommendedTools : [];
      const validTools = rawTools.filter((t: unknown) =>
        typeof t === "string" && ALL_TOOL_IDS.includes(t),
      );

      // 11. Validate suggested icon (non-empty emoji) and icon color
      const rawIcon = typeof parsed.suggestedIcon === "string" ? parsed.suggestedIcon.trim() : "";
      const validIcon = rawIcon.length > 0 ? rawIcon : undefined;
      const rawIconColor = typeof parsed.suggestedIconColor === "string" ? parsed.suggestedIconColor.trim() : "";
      const validIconColor = VALID_ICON_COLORS.includes(rawIconColor) ? rawIconColor : undefined;

      // 12. Extract metadata fields (non-empty strings only)
      const titleEn = typeof parsed.suggestedTitleEn === "string" && parsed.suggestedTitleEn.trim()
        ? parsed.suggestedTitleEn.trim() : undefined;
      const titleEs = typeof parsed.suggestedTitleEs === "string" && parsed.suggestedTitleEs.trim()
        ? parsed.suggestedTitleEs.trim() : undefined;
      const descEn = typeof parsed.suggestedDescriptionEn === "string" && parsed.suggestedDescriptionEn.trim()
        ? parsed.suggestedDescriptionEn.trim() : undefined;
      const descEs = typeof parsed.suggestedDescriptionEs === "string" && parsed.suggestedDescriptionEs.trim()
        ? parsed.suggestedDescriptionEs.trim() : undefined;

      // 12b. Validate field corrections: only keep corrections for keys that exist in the input fields
      const rawCorrections = Array.isArray(parsed.suggestedFieldCorrections) ? parsed.suggestedFieldCorrections : [];
      const fieldKeys = new Set((templateContext.fields || []).map((f: FieldSummary) => f.key));
      const validCorrections = rawCorrections.filter(
        (c: Record<string, unknown>) =>
          typeof c.key === "string" &&
          typeof c.label === "string" &&
          typeof c.label_es === "string" &&
          fieldKeys.has(c.key as string),
      );

      console.log("[refine] AI metadata:", JSON.stringify({
        titleEn, titleEs, descEn, descEs, icon: validIcon, iconColor: validIconColor,
        toolCount: validTools.length, fieldCorrections: validCorrections.length,
        finish: data.choices[0].finish_reason,
      }));

      // 13. Return
      return jsonResponse({
        refinedInstructions: parsed.refinedInstructions || "",
        refinedInstructionsEs: parsed.refinedInstructionsEs || "",
        recommendedTools: validTools,
        suggestedSystemPrompt: parsed.suggestedSystemPrompt || "",
        suggestedTitleEn: titleEn,
        suggestedTitleEs: titleEs,
        suggestedDescriptionEn: descEn,
        suggestedDescriptionEs: descEs,
        suggestedIcon: validIcon,
        suggestedIconColor: validIconColor,
        suggestedFieldCorrections: validCorrections,
        explanation: parsed.explanation || "",
        suggestions: parsed.suggestions || [],
        conversationHistory: updatedHistory,
        usage: {
          dailyUsed: usage.daily_count + 1,
          dailyLimit: usage.daily_limit,
          monthlyUsed: usage.monthly_count + 1,
          monthlyLimit: usage.monthly_limit,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse("Unauthorized", error.message, 401);
    }
    if (error instanceof UsageError) {
      return errorResponse("server_error", error.message, 500);
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse("timeout", "AI request timed out", 504);
    }
    console.error("[refine] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
