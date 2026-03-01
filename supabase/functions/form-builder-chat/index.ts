/**
 * Form Builder Chat Edge Function
 *
 * Conversational AI assistant for iteratively building and modifying form
 * templates. Admins send messages (text, images, files) and the AI returns
 * structured form updates (add/remove/modify fields, update metadata).
 *
 * Admin/manager only. Uses GPT-4o-mini with structured JSON schema output.
 * Auth: verify_jwt=false -- manual JWT verification via authenticateWithClaims()
 */

import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithClaims, AuthError } from "../_shared/auth.ts";
import { checkUsage, incrementUsage, UsageError } from "../_shared/usage.ts";

// =============================================================================
// CONSTANTS
// =============================================================================

const OPENAI_TIMEOUT_MS = 45_000;
const MAX_MESSAGE_LENGTH = 10_000;
const MAX_FILE_CONTENT_LENGTH = 50_000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CONTENT_LENGTH = 2_000;

// =============================================================================
// LANGUAGE INSTRUCTIONS
// =============================================================================

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Respond in English. When generating field labels, provide both English (label) and Spanish (label_es). The message and changeSummary should be in English.",
  es: "Responde en espanol. Cuando generes etiquetas de campo, proporciona tanto ingles (label) como espanol (label_es). El message y changeSummary deben estar en espanol.",
};

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const BUILDER_CHAT_SYSTEM_PROMPT = `You are a form builder AI assistant for Alamo Prime steakhouse. You help admins create and modify digital form templates through conversation.

## Context
This is a restaurant operations app. Forms are used for: employee write-ups, injury reports, incident reports, daily checklists, food safety logs, equipment maintenance, etc. The forms are filled by managers, sometimes with AI assistance.

## Available Field Types
- text: Single-line text (names, titles, short answers)
- textarea: Multi-line text (descriptions, narratives, explanations)
- number: Numeric input
- date: Date picker (ISO YYYY-MM-DD)
- time: Time picker (24h HH:MM)
- select: Dropdown single-select (provide options array)
- checkbox: Multi-select checkboxes (provide options array)
- yes_no: Yes/No toggle
- signature: Finger/stylus signature pad (use for sign-off fields)
- image: Camera photo upload (use for evidence photos)
- header: Section header (display only, for visual grouping)

## Field Design Rules
- field.key: Use snake_case, descriptive, unique (e.g., employee_name, date_of_incident)
- field.section: Group related fields (e.g., "Employee Information", "Incident Details", "Signatures")
- field.order: Sequential integers starting at 1
- field.ai_hint: Write a short instruction for the AI that fills this field (e.g., "Extract the full legal name of the employee from the user's description")
- field.hint: ALWAYS provide a short helper text for every input field (not headers). This text appears below the field and guides the user on what to enter. Examples: "Enter the employee's full legal name", "Select the date the incident occurred", "Describe what happened in detail". This is required for BOTH new form generation AND when adding individual fields.
- For select/checkbox: Provide complete options arrays
- Start each major section with a header field for visual structure
- Place signature fields at the end
- Place image fields in an "Attachments" or "Evidence" section near the end
- Use yes_no for Yes/No questions, select for 4+ options

## Available AI Tools (for aiTools recommendation)
- search_contacts: Search contacts directory (hospitals, emergency services, management)
- search_manual: Search operations manual for SOPs, policies, procedures, employee handbook
- search_products: Search product databases (dishes, wines, cocktails, recipes, ingredients)
- search_standards: Search for quality standards, dress code, appearance, cleanliness expectations
- search_steps_of_service: Search for service flow, greeting, tableside, and guest interaction protocols

## Tool Recommendation Rules
- Employee-related forms (write-ups, disciplinary, termination, onboarding, HR) -> search_manual (policies, handbook)
- Injury/accident/medical forms -> search_contacts (hospitals, doctors) + search_manual (safety procedures)
- Food-related forms (temperature logs, waste, spoilage, prep, safety) -> search_products + search_manual
- Service/guest-facing forms (complaints, incident reports, quality) -> search_steps_of_service + search_standards
- Checklists involving appearance, uniforms, cleanliness -> search_standards
- Opening/closing checklists -> search_standards + search_steps_of_service
- Equipment/maintenance forms -> search_manual
- If none of the above clearly apply, recommend search_manual at minimum (most forms benefit from policy lookup)

## Current Form State
CURRENT_FORM_BLOCK

## Rules
- If the current form has no fields and the user describes a full form, generate everything (fields, instructions, title, etc.)
- If the user asks for specific changes, make ONLY those changes. Don't reorganize or modify fields the user didn't mention.
- Field keys you reference in fieldsToModify or fieldsToRemove MUST exist in the current form's field list above.
- New field keys (fieldsToAdd) must NOT conflict with existing keys.
- Always return changeSummary with human-readable bullet points describing what you changed.
- Return null for any formUpdates property you are NOT changing.
- When adding fields, assign order values continuing from the highest existing order value.
- When adding fields via fieldsToAdd, ALWAYS include a helpful hint for each non-header field. The hint should be a short sentence guiding the user.
- When suggesting instructions, write them as step-by-step numbered instructions for form-filling AI.
- When recommending aiTools, only recommend tools that are relevant to the form's purpose.
- For the icon field, choose a single emoji character that best represents the form's purpose (e.g., 📋, ⚠️, 🩺, 🍽️). For iconColor, choose a matching background color from: blue, red, orange, amber, green, emerald, purple, pink, slate, gray.
- confidence: 0.0-1.0 reflecting how well you understood the request. Use lower values when guessing.

LANGUAGE_INSTRUCTION`;

// =============================================================================
// HELPER: Build current form context block
// =============================================================================

interface CurrentFormField {
  key: string;
  label: string;
  label_es: string;
  type: string;
  section: string;
  required: boolean;
  options?: string[];
  order: number;
}

interface CurrentForm {
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  iconColor?: string;
  fields: CurrentFormField[];
  instructionsEn: string;
  instructionsEs: string;
  aiTools: string[];
}

function buildCurrentFormBlock(form: CurrentForm): string {
  const lines: string[] = [];

  lines.push(`Title (EN): "${form.titleEn || "(empty)"}"`);
  lines.push(`Title (ES): "${form.titleEs || "(empty)"}"`);
  lines.push(`Description (EN): "${form.descriptionEn || "(empty)"}"`);
  lines.push(`Description (ES): "${form.descriptionEs || "(empty)"}"`);
  lines.push(`Icon: ${form.icon || "(none)"}`);
  lines.push(`Icon Color: ${form.iconColor || "blue"}`);
  lines.push(`AI Tools: ${form.aiTools?.length ? form.aiTools.join(", ") : "(none)"}`);
  lines.push("");

  if (!form.fields || form.fields.length === 0) {
    lines.push("Fields: (none — this is an empty form)");
  } else {
    lines.push(`Fields (${form.fields.length}):`);
    for (const f of form.fields) {
      const reqLabel = f.required ? ", REQUIRED" : "";
      const labelPart = f.label_es
        ? `"${f.label}" / ES: "${f.label_es}"`
        : `"${f.label}"`;
      let line = `  ${f.order}. ${f.key} (${f.type}${reqLabel}) — ${labelPart} [section: ${f.section}]`;
      if (f.options?.length) {
        line += ` options: ${JSON.stringify(f.options)}`;
      }
      lines.push(line);
    }
  }

  lines.push("");
  if (form.instructionsEn) {
    lines.push(`Instructions (EN):\n${form.instructionsEn}`);
  } else {
    lines.push("Instructions (EN): (none)");
  }
  if (form.instructionsEs) {
    lines.push(`Instructions (ES):\n${form.instructionsEs}`);
  }

  return lines.join("\n");
}

// =============================================================================
// JSON SCHEMA (OpenAI structured output, strict: true)
// =============================================================================

const FIELD_TYPE_ENUM = [
  "text", "textarea", "number", "date", "time",
  "select", "checkbox", "yes_no", "signature",
  "image", "header",
];

const BUILDER_CHAT_RESPONSE_SCHEMA = {
  name: "form_builder_chat_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Conversational response to the admin",
      },
      formUpdates: {
        type: "object",
        description: "Form changes. Use null for any property not being changed.",
        properties: {
          titleEn: { type: ["string", "null"] },
          titleEs: { type: ["string", "null"] },
          descriptionEn: { type: ["string", "null"] },
          descriptionEs: { type: ["string", "null"] },
          icon: { type: ["string", "null"] },
          iconColor: { type: ["string", "null"], description: "Background color name" },
          instructionsEn: { type: ["string", "null"] },
          instructionsEs: { type: ["string", "null"] },
          aiTools: {
            anyOf: [
              { type: "array", items: { type: "string" } },
              { type: "null" },
            ],
          },
          fieldsToAdd: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string", description: "snake_case unique identifier" },
                    label: { type: "string", description: "Display label (English)" },
                    label_es: { type: "string", description: "Display label (Spanish)" },
                    type: {
                      type: "string",
                      enum: FIELD_TYPE_ENUM,
                    },
                    section: { type: "string", description: "Visual grouping name" },
                    required: { type: "boolean" },
                    placeholder: { type: "string" },
                    hint: { type: "string" },
                    ai_hint: { type: "string", description: "Extraction guidance for the AI" },
                    options: {
                      type: "array",
                      items: { type: "string" },
                      description: "For select/checkbox types",
                    },
                    order: { type: "number" },
                  },
                  required: [
                    "key", "label", "label_es", "type", "section",
                    "required", "placeholder", "hint", "ai_hint",
                    "options", "order",
                  ],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          fieldsToRemove: {
            anyOf: [
              { type: "array", items: { type: "string" } },
              { type: "null" },
            ],
          },
          fieldsToModify: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string", description: "Existing field key to modify" },
                    label: { type: ["string", "null"] },
                    label_es: { type: ["string", "null"] },
                    type: { anyOf: [{ type: "string", enum: FIELD_TYPE_ENUM }, { type: "null" }] },
                    required: { type: ["boolean", "null"] },
                    placeholder: { type: ["string", "null"] },
                    section: { type: ["string", "null"] },
                    hint: { type: ["string", "null"] },
                    ai_hint: { type: ["string", "null"] },
                    options: {
                      anyOf: [
                        { type: "array", items: { type: "string" } },
                        { type: "null" },
                      ],
                    },
                  },
                  required: [
                    "key", "label", "label_es", "type", "required",
                    "placeholder", "section", "hint", "ai_hint", "options",
                  ],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          reorderedFieldKeys: {
            anyOf: [
              { type: "array", items: { type: "string" } },
              { type: "null" },
            ],
          },
        },
        required: [
          "titleEn", "titleEs", "descriptionEn", "descriptionEs",
          "icon", "iconColor", "instructionsEn", "instructionsEs", "aiTools",
          "fieldsToAdd", "fieldsToRemove", "fieldsToModify",
          "reorderedFieldKeys",
        ],
        additionalProperties: false,
      },
      changeSummary: {
        type: "array",
        items: { type: "string" },
        description: "Human-readable bullet points describing changes made",
      },
      confidence: {
        type: "number",
        description: "0.0-1.0 confidence in understanding the request",
      },
    },
    required: ["message", "formUpdates", "changeSummary", "confidence"],
    additionalProperties: false,
  },
};

// =============================================================================
// HELPER: Validate AI response against current form
// =============================================================================

interface ParsedResponse {
  message: string;
  formUpdates: {
    titleEn: string | null;
    titleEs: string | null;
    descriptionEn: string | null;
    descriptionEs: string | null;
    icon: string | null;
    iconColor: string | null;
    instructionsEn: string | null;
    instructionsEs: string | null;
    aiTools: string[] | null;
    fieldsToAdd: CurrentFormField[] | null;
    fieldsToRemove: string[] | null;
    fieldsToModify: Array<{
      key: string;
      label: string | null;
      label_es: string | null;
      type: string | null;
      required: boolean | null;
      placeholder: string | null;
      section: string | null;
      hint: string | null;
      ai_hint: string | null;
      options: string[] | null;
    }> | null;
    reorderedFieldKeys: string[] | null;
  };
  changeSummary: string[];
  confidence: number;
}

function validateAndFilterResponse(
  parsed: ParsedResponse,
  currentForm: CurrentForm,
): ParsedResponse {
  const existingKeys = new Set(currentForm.fields.map((f) => f.key));

  // 1. Filter fieldsToRemove to only existing keys
  const validRemovals = (parsed.formUpdates.fieldsToRemove || []).filter((k) =>
    existingKeys.has(k)
  );

  // 2. Filter fieldsToModify to only existing keys
  const validMods = (parsed.formUpdates.fieldsToModify || []).filter((m) =>
    existingKeys.has(m.key)
  );

  // 3. Filter fieldsToAdd — reject keys that already exist
  const validAdds = (parsed.formUpdates.fieldsToAdd || []).filter(
    (f) => !existingKeys.has(f.key)
  );

  // 4. Validate reorderedFieldKeys is a valid permutation
  let validReorder: string[] | null = null;
  if (parsed.formUpdates.reorderedFieldKeys?.length) {
    // Compute what the final key set should be after removals + additions
    const removalSet = new Set(validRemovals);
    const afterRemoval = currentForm.fields
      .filter((f) => !removalSet.has(f.key))
      .map((f) => f.key);
    const afterAdd = [...afterRemoval, ...validAdds.map((f) => f.key)];
    const expectedKeys = new Set(afterAdd);
    const reorderKeys = new Set(parsed.formUpdates.reorderedFieldKeys);

    const isValid =
      expectedKeys.size === reorderKeys.size &&
      [...expectedKeys].every((k) => reorderKeys.has(k));

    if (isValid) {
      validReorder = parsed.formUpdates.reorderedFieldKeys;
    } else {
      console.log(
        "[form-builder-chat] Dropping invalid reorder: expected",
        expectedKeys.size,
        "keys, got",
        reorderKeys.size,
      );
    }
  }

  // 5. Validate aiTools — only known tool IDs
  const VALID_TOOL_IDS = new Set([
    "search_contacts",
    "search_manual",
    "search_products",
    "search_standards",
    "search_steps_of_service",
  ]);
  const validTools = parsed.formUpdates.aiTools
    ? parsed.formUpdates.aiTools.filter((t) => VALID_TOOL_IDS.has(t))
    : null;

  return {
    message: parsed.message || "",
    formUpdates: {
      titleEn: parsed.formUpdates.titleEn,
      titleEs: parsed.formUpdates.titleEs,
      descriptionEn: parsed.formUpdates.descriptionEn,
      descriptionEs: parsed.formUpdates.descriptionEs,
      icon: parsed.formUpdates.icon,
      iconColor: parsed.formUpdates.iconColor,
      instructionsEn: parsed.formUpdates.instructionsEn,
      instructionsEs: parsed.formUpdates.instructionsEs,
      aiTools: validTools,
      fieldsToAdd: validAdds.length > 0 ? validAdds : null,
      fieldsToRemove: validRemovals.length > 0 ? validRemovals : null,
      fieldsToModify: validMods.length > 0 ? validMods : null,
      reorderedFieldKeys: validReorder,
    },
    changeSummary: Array.isArray(parsed.changeSummary)
      ? parsed.changeSummary
      : [],
    confidence: typeof parsed.confidence === "number"
      ? parsed.confidence
      : 0.5,
  };
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
      return errorResponse(
        "forbidden",
        "Admin or manager access required",
        403,
      );
    }

    // 3. Parse + validate
    const body = await req.json();
    const {
      message,
      currentForm,
      conversationHistory = [],
      imageBase64,
      fileContent,
      fileName,
      language = "en",
      groupId,
    } = body;

    if (!groupId) {
      return errorResponse("bad_request", "groupId is required", 400);
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return errorResponse("bad_request", "message is required", 400);
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return errorResponse(
        "bad_request",
        `message must be ${MAX_MESSAGE_LENGTH} chars or fewer`,
        400,
      );
    }

    if (!currentForm || !Array.isArray(currentForm.fields)) {
      return errorResponse(
        "bad_request",
        "currentForm with fields array is required",
        400,
      );
    }

    if (fileContent && typeof fileContent === "string" && fileContent.length > MAX_FILE_CONTENT_LENGTH) {
      return errorResponse(
        "bad_request",
        `fileContent must be ${MAX_FILE_CONTENT_LENGTH} chars or fewer`,
        400,
      );
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
    const langInstruction =
      LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
    const currentFormBlock = buildCurrentFormBlock(currentForm as CurrentForm);
    const systemPrompt = BUILDER_CHAT_SYSTEM_PROMPT
      .replace("CURRENT_FORM_BLOCK", currentFormBlock)
      .replace("LANGUAGE_INSTRUCTION", langInstruction);

    // 6. Build conversation messages
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    // Add sanitized conversation history (max 10, each trimmed to 2,000 chars)
    const sanitizedHistory = (Array.isArray(conversationHistory) ? conversationHistory : [])
      .filter(
        (m: { role: string; content: string }) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
      }));

    messages.push(...sanitizedHistory);

    // 7. Build the current user message (may include image/file)
    // deno-lint-ignore no-explicit-any
    const userContentParts: any[] = [];

    // Text part — always present
    let textContent = message.trim();
    if (fileContent && typeof fileContent === "string") {
      const nameInfo = fileName ? ` (from file: ${fileName})` : "";
      textContent += `\n\n--- Attached file content${nameInfo} ---\n${fileContent}`;
    }
    userContentParts.push({ type: "text", text: textContent });

    // Image part — optional (vision)
    if (imageBase64 && typeof imageBase64 === "string") {
      userContentParts.push({
        type: "image_url",
        image_url: { url: imageBase64, detail: "auto" },
      });
      console.log("[form-builder-chat] Image attached (vision mode)");
    }

    // If we have only a text part and no image, use simple string content
    if (userContentParts.length === 1 && !imageBase64) {
      messages.push({ role: "user", content: textContent });
    } else {
      messages.push({ role: "user", content: userContentParts });
    }

    console.log(
      `[form-builder-chat] ${currentForm.fields?.length || 0} fields, ` +
      `${sanitizedHistory.length} history msgs, ` +
      `msg: ${message.length} chars, ` +
      `image: ${imageBase64 ? "yes" : "no"}, ` +
      `file: ${fileContent ? `${fileContent.length} chars` : "no"}`,
    );

    // 8. Call OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[form-builder-chat] OPENAI_API_KEY not configured");
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
              json_schema: BUILDER_CHAT_RESPONSE_SCHEMA,
            },
            max_tokens: 4000,
            temperature: 0.5,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(
          "[form-builder-chat] OpenAI error:",
          response.status,
          errText,
        );
        return errorResponse(
          "ai_error",
          "Failed to process form builder request",
          500,
        );
      }

      const data = await response.json();

      // Check for truncated response
      if (data.choices[0].finish_reason === "length") {
        console.error(
          "[form-builder-chat] OpenAI response truncated (finish_reason: length)",
        );
        return errorResponse(
          "ai_malformed",
          "The AI returned an incomplete response. Try a simpler request.",
          500,
        );
      }

      let parsed: ParsedResponse;
      try {
        parsed = JSON.parse(data.choices[0].message.content);
      } catch (parseErr) {
        console.error("[form-builder-chat] JSON.parse failed:", parseErr);
        return errorResponse(
          "ai_malformed",
          "The AI returned an invalid response. Please try again.",
          500,
        );
      }

      // 9. Server-side validation: filter field references against current form
      const validated = validateAndFilterResponse(
        parsed,
        currentForm as CurrentForm,
      );

      console.log(
        "[form-builder-chat] AI result:",
        JSON.stringify({
          adds: validated.formUpdates.fieldsToAdd?.length ?? 0,
          removes: validated.formUpdates.fieldsToRemove?.length ?? 0,
          modifies: validated.formUpdates.fieldsToModify?.length ?? 0,
          reorder: validated.formUpdates.reorderedFieldKeys ? "yes" : "no",
          metaChanges: [
            validated.formUpdates.titleEn != null ? "title" : null,
            validated.formUpdates.icon != null ? "icon" : null,
            validated.formUpdates.instructionsEn != null ? "instructions" : null,
            validated.formUpdates.aiTools != null ? "tools" : null,
          ].filter(Boolean),
          confidence: validated.confidence,
          changeSummaryCount: validated.changeSummary.length,
          finish: data.choices[0].finish_reason,
        }),
      );

      // 10. Increment usage (non-blocking)
      try {
        await incrementUsage(supabase, userId, groupId);
      } catch (usageErr) {
        console.error("[form-builder-chat] incrementUsage failed:", usageErr);
      }

      // 11. Return validated response
      return jsonResponse({
        message: validated.message,
        formUpdates: validated.formUpdates,
        changeSummary: validated.changeSummary,
        confidence: validated.confidence,
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
    console.error("[form-builder-chat] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
