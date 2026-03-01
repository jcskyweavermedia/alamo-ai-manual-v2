/**
 * Generate Form Template Edge Function
 *
 * AI-generates a complete bilingual form template from text description,
 * image of a paper form, or extracted file content. Returns a draft with
 * fields, instructions, tool recommendations, and confidence score.
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
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_FILE_CONTENT_LENGTH = 50_000;

// =============================================================================
// LANGUAGE INSTRUCTIONS
// =============================================================================

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Generate all content in English as the primary language, and include Spanish translations in the _es fields. The aiMessage and toolRecommendations.reason should be in English.",
  es: "Genera todo el contenido en espanol como idioma principal, e incluye traducciones al ingles en los campos _en. El aiMessage y toolRecommendations.reason deben estar en espanol.",
};

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const GENERATE_SYSTEM_PROMPT = `You are a form template designer for Alamo Prime steakhouse. Given a description, image, or document of a form, produce a complete digital form template.

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
- yes_no: Yes/No toggle (use for binary yes/no questions)
- signature: Finger/stylus signature pad (use for sign-off fields)
- image: Camera photo upload (use for evidence photos)
- header: Section header (display only, for visual grouping)

## Field Design Rules
- field.key: Use snake_case, descriptive, unique (e.g., employee_name, date_of_incident)
- field.section: Group related fields (e.g., "Employee Information", "Incident Details", "Signatures")
- field.order: Sequential integers starting at 1
- field.ai_hint: Write a short instruction for the AI that fills this field (e.g., "Extract the full legal name of the employee from the user's description")
- field.hint: ALWAYS provide a short helper text for every input field (not headers). This text appears below the field and guides the user on what to enter. Examples: "Enter the employee's full legal name", "Select the date the incident occurred", "Describe what happened in detail".
- For select/checkbox: Provide complete options arrays
- Start each major section with a header field for visual structure
- Place signature fields at the end
- Place image fields in an "Attachments" or "Evidence" section near the end
- Use yes_no for binary yes/no questions, select for 4+ options

## Tool Recommendation Rules
- Employee-related forms (write-ups, disciplinary, termination, onboarding, HR) -> search_manual (policies, handbook)
- Injury/accident/medical forms -> search_contacts (hospitals, doctors) + search_manual (safety procedures)
- Food-related forms (temperature logs, waste, spoilage, prep, safety) -> search_products + search_manual
- Service/guest-facing forms (complaints, incident reports, quality) -> search_steps_of_service + search_standards
- Checklists involving appearance, uniforms, cleanliness -> search_standards
- Opening/closing checklists -> search_standards + search_steps_of_service
- Equipment/maintenance forms -> search_manual
- If none of the above clearly apply, recommend search_manual at minimum (most forms benefit from policy lookup)

## Instructions Design
Write numbered step-by-step instructions that tell the form-filling AI how to process user input for this form. Reference specific field keys and tool names. Keep to 5-10 steps.

## Icon
For the icon field, choose a single emoji character that best represents the form's purpose (e.g., 📋, ⚠️, 🩺, 🍽️). For icon_color, choose a matching background color from: blue, red, orange, amber, green, emerald, purple, pink, slate, gray.

## Output
Generate a complete form template with:
- Bilingual titles and descriptions
- All fields with proper types, labels (EN + ES), sections, and ai_hints
- Refined instructions referencing tools and field keys
- Tool recommendations with explanations
- A confidence score (0-1) reflecting how well you understood the request
- A list of missingFields if you had to guess at anything
- An aiMessage explaining your design decisions

LANGUAGE_INSTRUCTION`;

// =============================================================================
// JSON SCHEMA (OpenAI structured output)
// =============================================================================

const FORM_TEMPLATE_DRAFT_SCHEMA = {
  name: "form_template_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title_en: { type: "string" },
      title_es: { type: "string" },
      description_en: { type: "string" },
      description_es: { type: "string" },
      icon: {
        type: "string",
        description:
          "A single emoji character representing this form",
      },
      icon_color: {
        type: "string",
        description:
          "Background color. One of: blue, red, orange, amber, green, emerald, purple, pink, slate, gray",
      },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "snake_case unique identifier" },
            label: { type: "string", description: "Display label (English)" },
            label_es: { type: "string", description: "Display label (Spanish)" },
            type: {
              type: "string",
              enum: [
                "text",
                "textarea",
                "number",
                "date",
                "time",
                "select",
                "checkbox",
                "yes_no",
                "signature",
                "image",
                "header",
              ],
            },
            required: { type: "boolean" },
            placeholder: { type: "string" },
            section: { type: "string", description: "Visual grouping name" },
            hint: { type: "string" },
            ai_hint: {
              type: "string",
              description: "Extraction guidance for the AI",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description: "For select/checkbox types",
            },
            order: { type: "number" },
          },
          required: [
            "key",
            "label",
            "label_es",
            "type",
            "required",
            "placeholder",
            "section",
            "hint",
            "ai_hint",
            "options",
            "order",
          ],
          additionalProperties: false,
        },
      },
      instructions_en: { type: "string" },
      instructions_es: { type: "string" },
      ai_tools: {
        type: "array",
        items: { type: "string" },
        description:
          "Recommended tools: search_contacts, search_manual, search_products, search_standards, search_steps_of_service",
      },
      confidence: { type: "number" },
      missingFields: {
        type: "array",
        items: { type: "string" },
      },
      aiMessage: { type: "string" },
      toolRecommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tool: { type: "string" },
            reason: { type: "string" },
          },
          required: ["tool", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "title_en",
      "title_es",
      "description_en",
      "description_es",
      "icon",
      "icon_color",
      "fields",
      "instructions_en",
      "instructions_es",
      "ai_tools",
      "confidence",
      "missingFields",
      "aiMessage",
      "toolRecommendations",
    ],
    additionalProperties: false,
  },
};

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
      description,
      imageBase64,
      fileContent,
      fileName,
      language = "en",
      groupId,
    } = body;

    if (!groupId) {
      return errorResponse("bad_request", "groupId is required", 400);
    }

    // Exactly one input mode required
    const inputCount = [description, imageBase64, fileContent].filter(
      Boolean,
    ).length;
    if (inputCount === 0) {
      return errorResponse(
        "bad_request",
        "One of description, imageBase64, or fileContent is required",
        400,
      );
    }
    if (inputCount > 1) {
      return errorResponse(
        "bad_request",
        "Only one of description, imageBase64, or fileContent should be provided",
        400,
      );
    }

    // Length validation
    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      return errorResponse(
        "bad_request",
        `Description must be ${MAX_DESCRIPTION_LENGTH} chars or fewer`,
        400,
      );
    }
    if (fileContent && fileContent.length > MAX_FILE_CONTENT_LENGTH) {
      return errorResponse(
        "bad_request",
        `File content must be ${MAX_FILE_CONTENT_LENGTH} chars or fewer`,
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
    const systemPrompt = GENERATE_SYSTEM_PROMPT.replace(
      "LANGUAGE_INSTRUCTION",
      langInstruction,
    );

    // 6. Build user message based on input mode
    // deno-lint-ignore no-explicit-any
    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (description) {
      // Text description mode
      messages.push({
        role: "user",
        content: `Create a form template based on this description:\n\n${description}`,
      });
      console.log(
        `[generate-form-template] Text mode, ${description.length} chars`,
      );
    } else if (imageBase64) {
      // Image mode (paper form photo) -- vision
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract the form structure from this image. Identify all fields, " +
              "their types, sections, and any instructions visible on the form.",
          },
          {
            type: "image_url",
            image_url: { url: imageBase64, detail: "high" },
          },
        ],
      });
      console.log("[generate-form-template] Image mode (vision)");
    } else if (fileContent) {
      // File content mode (pre-extracted text from PDF/DOCX/TXT)
      const nameInfo = fileName ? ` (from file: ${fileName})` : "";
      messages.push({
        role: "user",
        content: `Create a form template from this document content${nameInfo}:\n\n${fileContent}`,
      });
      console.log(
        `[generate-form-template] File mode, ${fileContent.length} chars${nameInfo}`,
      );
    }

    // 7. Call OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[generate-form-template] OPENAI_API_KEY not configured");
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
              json_schema: FORM_TEMPLATE_DRAFT_SCHEMA,
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
          "[generate-form-template] OpenAI error:",
          response.status,
          errText,
        );
        return errorResponse(
          "ai_error",
          "Failed to generate form template",
          500,
        );
      }

      const data = await response.json();

      // Check for truncated response
      if (data.choices[0].finish_reason === "length") {
        console.error(
          "[generate-form-template] OpenAI response truncated (finish_reason: length)",
        );
        return errorResponse(
          "ai_malformed",
          "The AI returned an incomplete response. Try a simpler description.",
          500,
        );
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data.choices[0].message.content);
      } catch (parseErr) {
        console.error(
          "[generate-form-template] JSON.parse failed:",
          parseErr,
        );
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
        console.error("[generate] incrementUsage failed:", usageErr);
      }

      // 9. Structure the response: split draft fields from metadata
      const draft = {
        title_en: parsed.title_en || "",
        title_es: parsed.title_es || "",
        description_en: parsed.description_en || "",
        description_es: parsed.description_es || "",
        icon: parsed.icon || "📋",
        icon_color: parsed.icon_color || "blue",
        fields: parsed.fields || [],
        instructions_en: parsed.instructions_en || "",
        instructions_es: parsed.instructions_es || "",
        ai_tools: parsed.ai_tools || [],
      };

      return jsonResponse({
        draft,
        confidence: parsed.confidence ?? 0.5,
        missingFields: parsed.missingFields || [],
        aiMessage: parsed.aiMessage || "",
        toolRecommendations: parsed.toolRecommendations || [],
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
    console.error("[generate-form-template] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
