/**
 * Build-Course-Element Edge Function
 *
 * Regenerates a SINGLE element in a course section with new or modified
 * instructions. Used by:
 *   - The per-element AI button (inline prompt)
 *   - The AI chat panel (for single-element changes)
 *
 * Auth: verify_jwt=false — manual JWT verification via authenticateWithUser()
 * Deploy: npx supabase functions deploy build-course-element --no-verify-jwt
 */

import { getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithUser, AuthError } from "../_shared/auth.ts";
import { callClaude, ClaudeError } from "../_shared/anthropic.ts";
import { fetchPromptBySlug } from "../_shared/prompt-helpers.ts";
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";
import { checkUsage, UsageError } from "../_shared/usage.ts";
import {
  fetchElementSourceMaterial,
  parseAIElementResponse,
  getMaxTokensForElement,
  serializeElementForAI,
  TEMPERATURE_CONTENT,
} from "../_shared/course-builder.ts";

// =============================================================================
// TYPES
// =============================================================================

interface BuildElementRequest {
  groupId: string;
  language?: "en" | "es";
  courseId: string;
  sectionId: string;
  elementKey: string;
  instruction?: string;
}

// =============================================================================
// JSON SCHEMAS FOR STRUCTURED OUTPUT
// =============================================================================

const ELEMENT_CONTENT_SCHEMA = {
  type: "object" as const,
  properties: {
    body_en: { type: "string" as const },
    body_es: { type: "string" as const },
  },
  required: ["body_en", "body_es"],
  additionalProperties: false,
};

const ELEMENT_FEATURE_SCHEMA = {
  type: "object" as const,
  properties: {
    body_en: { type: "string" as const },
    body_es: { type: "string" as const },
    variant: { type: "string" as const },
  },
  required: ["body_en", "body_es", "variant"],
  additionalProperties: false,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Verify user has manager or admin role and return group_id.
 */
// deno-lint-ignore no-explicit-any
async function verifyManagerRole(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("group_memberships")
    .select("role, group_id")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  if (data.role !== "manager" && data.role !== "admin") return null;
  return data.group_id;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  console.log("[build-course-element] Request received");

  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────
    const { userId, supabase } = await authenticateWithUser(req);
    console.log("[build-course-element] Authenticated user:", userId);

    // ── 2. Verify manager/admin role ─────────────────────────────────────
    const resolvedGroupId = await verifyManagerRole(supabase, userId);
    if (!resolvedGroupId) {
      return errorResponse(
        "forbidden",
        "Manager or admin role required",
        403,
        cors,
      );
    }

    // ── 3. Parse and validate request ────────────────────────────────────
    const body = (await req.json()) as BuildElementRequest;
    // Always use the server-resolved groupId — never trust body.groupId
    const groupId = resolvedGroupId;
    const language = body.language || "en";

    if (!body.courseId) {
      return errorResponse("bad_request", "courseId is required", 400, cors);
    }
    if (!body.sectionId) {
      return errorResponse("bad_request", "sectionId is required", 400, cors);
    }
    if (!body.elementKey) {
      return errorResponse("bad_request", "elementKey is required", 400, cors);
    }

    console.log(
      `[build-course-element] Course: ${body.courseId} | Section: ${body.sectionId} | Key: ${body.elementKey}`,
    );

    // ── 4. Fetch section and find element ────────────────────────────────
    const { data: section, error: sectionError } = await supabase
      .from("course_sections")
      .select("id, title_en, elements, course_id")
      .eq("id", body.sectionId)
      .eq("course_id", body.courseId)
      .single();

    if (sectionError || !section) {
      return errorResponse("not_found", "Section not found", 404, cors);
    }

    // deno-lint-ignore no-explicit-any
    const elements: any[] = section.elements || [];
    const elementIdx = elements.findIndex(
      // deno-lint-ignore no-explicit-any
      (el: any) => el.key === body.elementKey,
    );

    if (elementIdx < 0) {
      return errorResponse(
        "not_found",
        `Element with key "${body.elementKey}" not found in section`,
        404,
        cors,
      );
    }

    const element = elements[elementIdx];

    // Skip product_viewer elements
    if (element.type === "product_viewer") {
      return errorResponse(
        "bad_request",
        "Product viewer elements cannot be regenerated",
        400,
        cors,
      );
    }

    // ── 5. Fetch course metadata ─────────────────────────────────────────
    const { data: course } = await supabase
      .from("courses")
      .select("title_en, teacher_level")
      .eq("id", body.courseId)
      .single();

    const teacherLevel = course?.teacher_level || "professional";
    const courseTitle = course?.title_en || "";

    // ── 6. Check credits ─────────────────────────────────────────────────
    const credits = await getCreditCost(
      supabase,
      groupId,
      "course_builder",
      "content_element",
    );

    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo) {
      return errorResponse("forbidden", "Not a member of this group", 403, cors);
    }
    if (!usageInfo.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429, cors);
    }

    // ── 7. Fetch source material ─────────────────────────────────────────
    const sourceText = await fetchElementSourceMaterial(
      element.source_refs || [],
      supabase,
      language,
    );

    // ── 8. Serialize surrounding elements for context ───────────────────
    // deno-lint-ignore no-explicit-any
    const elementsContext = elements.map((el: any) => serializeElementForAI(el)).join("\n---\n");

    // ── 9. Build prompt and call AI ──────────────────────────────────────
    const isFeature = element.type === "feature";
    const isMedia = element.type === "media";
    const structuredTypes = ["page_header", "section_header", "card_grid", "comparison", "script_block"];
    const isStructured = structuredTypes.includes(element.type);

    let updatedElement;

    if (isStructured) {
      // ── Structured element types (return full JSONB) ──
      const structuredSchemas: Record<string, string> = {
        page_header: `{ "badge_en": "short label e.g. New Menu", "badge_es": "Spanish badge", "badge_icon": "single emoji", "title_en": "Light Text|Bold Text (use | to split light/bold parts, e.g. Celebrate Mom in Style|Mother's Day Feature)", "title_es": "Spanish title using same light|bold format", "tagline_en": "one-line tagline", "tagline_es": "Spanish tagline", "icon": "single emoji", "icon_label_en": "short icon label", "icon_label_es": "Spanish icon label" }`,
        section_header: `{ "number_label": "e.g. 1 — AT A GLANCE", "title_en": "Light Text|Bold Text (use | to split light/bold parts, e.g. Mother's Day Feature|At a Glance)", "title_es": "Spanish title using same light|bold format", "subtitle_en": "optional subtitle", "subtitle_es": "Spanish subtitle" }`,
        card_grid: `{ "variant": "${element.variant || "icon_tile"}", "columns": ${element.columns || 3}, "cards": [{ "icon": "emoji", "icon_bg": "orange|yellow|green|blue|purple", "title_en": "string", "title_es": "string", "body_en": "string", "body_es": "string" }] }`,
        comparison: element.variant === "miss_fix"
          ? `{ "variant": "miss_fix", "pairs": [{ "tag_en": "Miss", "tag_es": "Error", "items_en": ["miss text", "fix text"], "items_es": ["texto error", "texto solución"] }] }`
          : `{ "variant": "correct_incorrect", "positive": { "tag_en": "string", "tag_es": "string", "title_en": "string", "title_es": "string", "items_en": ["bullet"], "items_es": ["punto"] }, "negative": { ... same ... } }`,
        script_block: `{ "header_en": "string", "header_es": "string", "header_icon": "emoji", "lines": [{ "text_en": "string", "text_es": "string" }] }`,
      };

      const instructions = body.instruction || element.ai_instructions || "Generate content for this element.";
      const prevElement = elementIdx > 0 ? elements[elementIdx - 1] : null;
      const prevContext = prevElement
        ? `PREVIOUS ELEMENT: ${prevElement.type}${prevElement.variant ? ` (${prevElement.variant})` : ""} — "${prevElement.title_en}"`
        : null;

      // Include the current element's existing values so the AI can see what it's editing
      const currentJson = JSON.stringify(element, null, 2);

      const systemPrompt = `You are editing a structured ${element.type} element for an Alamo Prime training course.
The element ALREADY has content. You are modifying it based on the user's instructions.

CURRENT ELEMENT JSON:
${currentJson}

Return a JSON object matching this schema:
${structuredSchemas[element.type] || "{}"}
Bilingual: ALL text fields need both _en and _es versions.
IMPORTANT: For page_header and section_header, the title_en field uses a "|" delimiter to separate light-weight text from bold text. Example: "Celebrate Mom in Style|Mother's Day Feature" renders as "Celebrate Mom in Style" (light) + "Mother's Day Feature" (bold). Preserve this format.
TEACHER LEVEL: ${teacherLevel}`;

      const userPrompt = [
        courseTitle ? `COURSE: ${courseTitle}` : null,
        `SECTION: "${section.title_en}"`,
        `\nALL ELEMENTS IN THIS SECTION (for context):\n${elementsContext}`,
        `\nTARGET ELEMENT: ${element.title_en}`,
        `TYPE: ${element.type}`,
        element.variant ? `VARIANT: ${element.variant}` : null,
        `INSTRUCTIONS: ${instructions}`,
        sourceText ? `\nSOURCE MATERIAL:\n${sourceText}` : null,
      ].filter(Boolean).join("\n");

      const maxTokens = getMaxTokensForElement(element.type);
      console.log(`[build-course-element] Generating structured ${element.type} "${element.key}" (${maxTokens} max tokens)`);

      const aiResult = await callClaude({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema: { type: "object" as const, properties: {}, additionalProperties: true },
        schemaName: `${element.type}_element`,
        temperature: TEMPERATURE_CONTENT,
        maxTokens,
      });

      if (!aiResult) {
        return errorResponse("ai_error", "Failed to parse AI response", 500, cors);
      }

      updatedElement = {
        ...element,
        ...aiResult,
        status: "generated",
        ...(body.instruction ? { ai_instructions: body.instruction } : {}),
      };
    } else {
      // ── Original body_en/body_es element types ──
      const promptSlug = isFeature
        ? "course-feature-element"
        : "course-element-builder";
      let systemPrompt = await fetchPromptBySlug(supabase, promptSlug, language);

      if (isMedia) {
        systemPrompt = `You are writing a caption and alt-text description for an image in an Alamo Prime training course.
RULES:
- body_en: Write a 1-2 sentence descriptive caption that explains what the image shows and why it matters.
- body_es: Natural Spanish translation of the caption.
- You MUST return valid JSON matching the schema.`;
      } else if (!systemPrompt) {
        systemPrompt = isFeature
          ? `You are writing a highlighted callout box for an Alamo Prime training course. This is NOT a content block — it's a visual interruption. Short, punchy, memorable.
VOICE: Warm, direct, hospitality-driven. Use "you/your" — speak directly to the staff.
RULES:
- Use **bold** for the single most important phrase
- Generate both body_en and body_es (natural hospitality Spanish)
- You MUST return valid JSON matching the schema`
          : `You are writing training content for Alamo Prime, a premium steakhouse in Miami. Your audience is FOH staff — ages 21-35, tips-motivated, reading on phones.
VOICE: Like a great GM briefing the team. Warm, direct, confident. Use "you/your", contractions, specific details.
FORMATTING: Short paragraphs (2-3 sentences). Max 4 bullets in a row then switch format. Use tables for comparisons. Use scenarios and exact guest dialogue.
ACCURACY: Use ONLY source material data. Never invent facts.
BILINGUAL: Generate body_en and body_es. Natural hospitality Spanish.
You MUST return valid JSON matching the schema.`;
      }

      // Append variant-specific guidance for features
      if (isFeature && element.variant) {
        const variantPrompts: Record<string, string> = {
          tip: `\nVARIANT: TIP — Actionable advice for TONIGHT. Lead with a verb. 1-3 sentences. Include exact language or action.`,
          best_practice: `\nVARIANT: BEST PRACTICE — How top performers do it. "The highest-earning servers..." 2-4 sentences. Explain WHY it works.`,
          caution: `\nVARIANT: CAUTION — Common mistake to avoid. Lead with the MISTAKE. Give the correct approach. 2-3 sentences.`,
          warning: `\nVARIANT: WARNING — CRITICAL safety/allergen concern. Lead with RISK in bold. State danger + required action. 2-5 sentences. Serious tone.`,
          did_you_know: `\nVARIANT: DID YOU KNOW — Surprising memorable fact. Front-load the "wow." 1-3 sentences. Connect to something they can share with guests.`,
          key_point: `\nVARIANT: KEY POINT — ONE testable takeaway. Bold declarative sentence. No lists, no hedging. 1-3 sentences max.`,
          standout: `\nVARIANT: STANDOUT — Non-negotiable rule or critical process. Dark banner style. Lead with urgency. Bold declarative title. 2-4 sentences explaining consequences of not following this.`,
        };
        systemPrompt += variantPrompts[element.variant] || "";
      }

      // Build user prompt with full context
      const instructions =
        body.instruction || element.ai_instructions || "Generate content for this element.";

      // Previous element context for narrative continuity
      const prevElement = elementIdx > 0 ? elements[elementIdx - 1] : null;
      const prevContext = prevElement
        ? `PREVIOUS ELEMENT: ${prevElement.type}${prevElement.variant ? ` (${prevElement.variant})` : ""} — "${prevElement.title_en}"`
        : null;

      const userPrompt = [
        courseTitle ? `COURSE: ${courseTitle}` : null,
        `SECTION: "${section.title_en}"`,
        `\nALL ELEMENTS IN THIS SECTION (for context):\n${elementsContext}`,
        `\nTARGET ELEMENT: ${element.title_en}`,
        `TYPE: ${element.type}`,
        isFeature && element.variant ? `VARIANT: ${element.variant}` : null,
        `TEACHER LEVEL: ${teacherLevel}`,
        `INSTRUCTIONS: ${instructions}`,
        element.body_en
          ? `\nCURRENT CONTENT (for reference):\n${element.body_en.substring(0, 2000)}`
          : null,
        sourceText ? `\nSOURCE MATERIAL:\n${sourceText}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const schema = isFeature ? ELEMENT_FEATURE_SCHEMA : ELEMENT_CONTENT_SCHEMA;
      const schemaName = isFeature ? "feature_element" : "content_element";
      const maxTokens = getMaxTokensForElement(element.type);

      console.log(
        `[build-course-element] Generating ${element.type} "${element.key}" (${maxTokens} max tokens)`,
      );

      const aiResult = await callClaude({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        schema,
        schemaName,
        temperature: TEMPERATURE_CONTENT,
        maxTokens,
      });

      // ── 10. Parse and validate response ──────────────────────────────────
      const parsed = parseAIElementResponse(aiResult);
      if (!parsed) {
        return errorResponse("ai_error", "Failed to parse AI response", 500, cors);
      }

      // ── 11. Update element in JSONB array ────────────────────────────────
      // Media elements use caption_en/caption_es, not body_en/body_es
      const contentFields = isMedia
        ? { caption_en: parsed.body_en, caption_es: parsed.body_es }
        : { body_en: parsed.body_en, body_es: parsed.body_es };

      updatedElement = {
        ...element,
        ...contentFields,
        status: "generated",
        ...(parsed.variant ? { variant: parsed.variant } : {}),
        ...(body.instruction ? { ai_instructions: body.instruction } : {}),
      };
    }

    elements[elementIdx] = updatedElement;

    const { error: updateError } = await supabase
      .from("course_sections")
      .update({ elements })
      .eq("id", body.sectionId);

    if (updateError) {
      console.error(
        "[build-course-element] Save error:",
        updateError.message,
      );
      return errorResponse("db_error", "Failed to save element", 500, cors);
    }

    // ── 11. Track credits ────────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, credits, {
      domain: "course_builder",
      action: "content_element",
      edge_function: "build-course-element",
      model: "claude-sonnet-4-6",
      metadata: {
        course_id: body.courseId,
        section_id: body.sectionId,
        element_key: body.elementKey,
      },
    });

    console.log(
      `[build-course-element] Success: ${element.key} regenerated`,
    );

    // ── 12. Return ───────────────────────────────────────────────────────
    return jsonResponse({
      element: updatedElement,
      tokenUsage: {
        estimated_input: sourceText
          ? Math.ceil(sourceText.split(/\s+/).length * 0.75)
          : 0,
      },
    }, 200, cors);
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse("unauthorized", err.message, 401, cors);
    }
    if (err instanceof UsageError) {
      return errorResponse("server_error", err.message, 500, cors);
    }
    if (err instanceof ClaudeError) {
      return errorResponse("ai_error", err.message, err.status, cors);
    }
    console.error("[build-course-element] Unexpected error:", err);
    return errorResponse("server_error", "An unexpected error occurred", 500, cors);
  }
});
