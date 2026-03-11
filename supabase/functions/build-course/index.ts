/**
 * Build-Course Edge Function
 *
 * Three-step AI course generation pipeline:
 *   1. outline  — generate course structure from source material
 *   2. content  — populate all elements with full content
 *   3. chat_edit — modify elements via free-text instruction
 *
 * Auth: verify_jwt=false — manual JWT verification via authenticateWithUser()
 * Deploy: npx supabase functions deploy build-course --no-verify-jwt
 */

import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithUser, AuthError } from "../_shared/auth.ts";
import { callClaude, callClaudeWithTimeout, ClaudeError, type ContentBlock } from "../_shared/anthropic.ts";
import { fetchPromptBySlug } from "../_shared/prompt-helpers.ts";
import { generateEmbedding } from "../_shared/embeddings.ts";
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";
import { checkUsage, UsageError } from "../_shared/usage.ts";
import {
  assembleSourceMaterial,
  fetchElementSourceMaterial,
  serializeElementForAI,
  parseAIOutlineResponse,
  parseAIChatEditResponse,
  parseFullContentResponse,
  parsePass1Response,
  parsePass2Response,
  computeContentHash,
  estimateTokens,
  getMaxTokensForElement,
  FULL_CONTENT_SCHEMA,
  PASS1_SCHEMA,
  PASS2_SECTION_SCHEMA,
  MAX_TOKENS_OUTLINE,
  MAX_TOKENS_FULL_CONTENT,
  MAX_TOKENS_PASS1,
  MAX_TOKENS_PASS2_SECTION,
  MAX_TOKENS_CHAT_EDIT,
  TEMPERATURE_OUTLINE,
  TEMPERATURE_CONTENT,
  STRUCTURE_PLAN_SCHEMA,
  CONTENT_WRITE_SCHEMA,
  MAX_TOKENS_STRUCTURE_PLAN,
  MAX_TOKENS_CONTENT_WRITE,
  MAX_TOKENS_LAYOUT,
  TRANSLATION_SCHEMA,
  PAGE_HEADER_TRANSLATION_SCHEMA,
  MAX_TOKENS_TRANSLATION,
  parseStructurePlanResponse,
  parseContentWriteResponse,
  parseTranslationResponse,
  DEPTH_PREVIEW_SCHEMA,
  MAX_TOKENS_DEPTH_PREVIEW,
  parseDepthPreviewResponse,
  DEPTH_BLUEPRINTS,
  validateBlueprintCompliance,
  type ElementBlueprint,
  type SourceProduct,
  type SourceRef,
} from "../_shared/course-builder.ts";

// =============================================================================
// TYPES
// =============================================================================

interface BuildCourseRequest {
  step: "outline" | "content" | "chat_edit" | "full_content" | "assemble" | "pass1" | "pass2" | "structure_plan" | "content_write" | "pass3" | "translate" | "depth_preview";
  groupId: string;
  language?: "en" | "es";

  // For outline step
  wizard_type?: string;
  course_title?: string;
  course_description?: string;
  teacher_level?: string;
  ai_instructions?: string;
  source_sections?: string[];
  source_products?: SourceProduct[];

  // For content + chat_edit + full_content + assemble steps
  course_id?: string;

  // For chat_edit + assemble steps
  section_id?: string;
  instruction?: string;

  // For translate step
  translate_page_header?: boolean;
}

// =============================================================================
// JSON SCHEMAS FOR STRUCTURED OUTPUT
// =============================================================================

const OUTLINE_SCHEMA = {
  type: "object" as const,
  properties: {
    sections: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title_en: { type: "string" as const },
          title_es: { type: "string" as const },
          elements: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                type: {
                  type: "string" as const,
                  enum: ["content", "feature", "media", "page_header", "section_header", "card_grid", "comparison", "script_block"],
                },
                key: { type: "string" as const },
                title_en: { type: "string" as const },
                title_es: { type: "string" as const },
                ai_instructions: { type: "string" as const },
                sort_order: { type: "number" as const },
                source_refs: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      table: { type: "string" as const },
                      id: { type: "string" as const },
                      content_hash: { type: "string" as const },
                    },
                    required: ["table", "id", "content_hash"],
                    additionalProperties: false,
                  },
                },
                variant: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                media_type: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                image_source: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                product_image_ref: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                // section_header fields (null for other types)
                number_label: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                subtitle_en: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                subtitle_es: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                // page_header fields (null for other types)
                badge_en: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                badge_es: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                badge_icon: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                tagline_en: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                tagline_es: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                icon: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                icon_label_en: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                icon_label_es: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
              },
              required: [
                "type",
                "key",
                "title_en",
                "title_es",
                "ai_instructions",
                "sort_order",
                "source_refs",
                "variant",
                "media_type",
                "image_source",
                "product_image_ref",
                "number_label",
                "subtitle_en",
                "subtitle_es",
                "badge_en",
                "badge_es",
                "badge_icon",
                "tagline_en",
                "tagline_es",
                "icon",
                "icon_label_en",
                "icon_label_es",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["title_en", "title_es", "elements"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
};

// =============================================================================
// ELEMENT CONTENT SCHEMAS — Strict JSON schemas for each element type.
// Adding a new element? Add one entry here + one in ELEMENT_REGISTRY below.
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

const ELEMENT_CARD_GRID_SCHEMA = {
  type: "object" as const,
  properties: {
    variant: { type: "string" as const, enum: ["icon_tile", "menu_item", "bilingual"] },
    columns: { type: "number" as const },
    cards: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          icon: { type: "string" as const },
          icon_bg: { type: "string" as const, enum: ["orange", "yellow", "green", "blue", "purple"] },
          title_en: { type: "string" as const },
          title_es: { type: "string" as const },
          body_en: { type: "string" as const },
          body_es: { type: "string" as const },
        },
        required: ["icon", "icon_bg", "title_en", "title_es", "body_en", "body_es"],
        additionalProperties: false,
      },
    },
  },
  required: ["variant", "columns", "cards"],
  additionalProperties: false,
};

const ELEMENT_COMPARISON_CORRECT_INCORRECT_SCHEMA = {
  type: "object" as const,
  properties: {
    variant: { type: "string" as const, enum: ["correct_incorrect"] },
    positive: {
      type: "object" as const,
      properties: {
        tag_en: { type: "string" as const },
        tag_es: { type: "string" as const },
        title_en: { type: "string" as const },
        title_es: { type: "string" as const },
        items_en: { type: "array" as const, items: { type: "string" as const } },
        items_es: { type: "array" as const, items: { type: "string" as const } },
      },
      required: ["tag_en", "tag_es", "title_en", "title_es", "items_en", "items_es"],
      additionalProperties: false,
    },
    negative: {
      type: "object" as const,
      properties: {
        tag_en: { type: "string" as const },
        tag_es: { type: "string" as const },
        title_en: { type: "string" as const },
        title_es: { type: "string" as const },
        items_en: { type: "array" as const, items: { type: "string" as const } },
        items_es: { type: "array" as const, items: { type: "string" as const } },
      },
      required: ["tag_en", "tag_es", "title_en", "title_es", "items_en", "items_es"],
      additionalProperties: false,
    },
  },
  required: ["variant", "positive", "negative"],
  additionalProperties: false,
};

const ELEMENT_COMPARISON_MISS_FIX_SCHEMA = {
  type: "object" as const,
  properties: {
    variant: { type: "string" as const, enum: ["miss_fix"] },
    pairs: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          tag_en: { type: "string" as const },
          tag_es: { type: "string" as const },
          items_en: {
            type: "array" as const,
            items: { type: "string" as const },
            minItems: 2,
            maxItems: 2,
          },
          items_es: {
            type: "array" as const,
            items: { type: "string" as const },
            minItems: 2,
            maxItems: 2,
          },
        },
        required: ["tag_en", "tag_es", "items_en", "items_es"],
        additionalProperties: false,
      },
    },
  },
  required: ["variant", "pairs"],
  additionalProperties: false,
};

const ELEMENT_SCRIPT_BLOCK_SCHEMA = {
  type: "object" as const,
  properties: {
    header_en: { type: "string" as const },
    header_es: { type: "string" as const },
    header_icon: { type: "string" as const },
    lines: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          text_en: { type: "string" as const },
          text_es: { type: "string" as const },
        },
        required: ["text_en", "text_es"],
        additionalProperties: false,
      },
    },
  },
  required: ["header_en", "header_es", "header_icon", "lines"],
  additionalProperties: false,
};

// =============================================================================
// ELEMENT REGISTRY — Single source of truth for each element type's content generation.
// To add a new element type: add one entry here with schema + systemPrompt.
// The content loop uses this registry automatically — no if/else chains to update.
// =============================================================================

interface ElementRegistryEntry {
  schema: Record<string, unknown>;
  schemaName: string;
  // deno-lint-ignore no-explicit-any
  getSchema?: (el: any) => { schema: Record<string, unknown>; schemaName: string };
  systemPrompt: string;            // Runtime — set from DB prompt before content loop
  systemPromptSlug: string;        // DB slug — fetched at runtime for single-element regen
  // deno-lint-ignore no-explicit-any
  mergeResult: (el: any, result: any) => Record<string, unknown>;
}

const ELEMENT_REGISTRY: Record<string, ElementRegistryEntry> = {
  card_grid: {
    schema: ELEMENT_CARD_GRID_SCHEMA,
    schemaName: "card_grid_element",
    systemPromptSlug: "course-element-card-grid",
    systemPrompt: `You are generating a card grid for an Alamo Prime training course.

WHAT THIS ELEMENT LOOKS LIKE:
A grid of rounded cards (2 or 3 columns on desktop, stacked on mobile). Each card has:
- An emoji icon inside a colored gradient tile (44×44px)
- A bold title (15px)
- A body paragraph (13px, muted color)

THREE VARIANTS — the variant is already chosen, match its purpose:
- icon_tile: Concept cards with gradient icon tiles. Use for goals, features, highlights, key concepts. Generate 3-6 cards.
- menu_item: Large emoji + orange top bar accent. Use for menu items, dishes, products. Generate 2-4 cards.
- bilingual: EN/ES side-by-side phrase cards. Use for key hospitality phrases. Generate 4-6 cards.

RULES:
- icon: Pick a single emoji that visually represents the card's topic
- icon_bg: Choose from orange, yellow, green, blue, purple — vary across cards for visual interest
- title_en/title_es: Short, punchy (2-5 words). Not sentences.
- body_en/body_es: 1-2 sentences max. Specific and actionable.
- Bilingual: natural hospitality Spanish, not literal translation
- Use ONLY data from the source material. Never invent menu items, prices, or allergens.`,
    mergeResult: (_el, result) => ({ ...result, status: "generated" }),
  },

  comparison: {
    schema: ELEMENT_COMPARISON_CORRECT_INCORRECT_SCHEMA,
    schemaName: "comparison_element",
    systemPromptSlug: "course-element-comparison",
    getSchema: (el) => el.variant === "miss_fix"
      ? { schema: ELEMENT_COMPARISON_MISS_FIX_SCHEMA, schemaName: "comparison_miss_fix_element" }
      : { schema: ELEMENT_COMPARISON_CORRECT_INCORRECT_SCHEMA, schemaName: "comparison_correct_incorrect_element" },
    systemPrompt: `You are generating a comparison element for an Alamo Prime training course.

WHAT THIS ELEMENT LOOKS LIKE:

VARIANT "correct_incorrect" — Two side-by-side cards:
  LEFT (dark bg): The RIGHT way — tag (e.g. "Correct"), title, bullet list with orange + markers
  RIGHT (light bg): The WRONG way — tag (e.g. "Incorrect"), title, bullet list with gray − markers
  Use for: visual standards, service approach comparisons, presentation dos/don'ts
  Generate 3-5 bullet items per side. Each bullet is 1 sentence.

VARIANT "miss_fix" — Vertical stack of paired rows:
  Each pair has a red "Miss" row (the mistake) and a green "Fix" row (the correction)
  Use for: common mistakes, error patterns, things staff get wrong
  Generate 3-5 pairs. Each row is 1-2 sentences. Be specific — quote exact wrong/right language.
  items_en/items_es arrays must have exactly 2 items: [miss_text, fix_text]

RULES:
- Tags: Use clear, short labels (e.g. "Do This" / "Haz Esto", "Not This" / "No Hagas Esto", "Miss" / "Error", "Fix" / "Solución")
- Titles: 2-4 words that name the comparison (e.g. "Steak Temperature Language")
- Be specific: reference real products, temperatures, phrases from source material
- Bilingual: natural hospitality Spanish, not literal translation`,
    mergeResult: (_el, result) => ({ ...result, status: "generated" }),
  },

  script_block: {
    schema: ELEMENT_SCRIPT_BLOCK_SCHEMA,
    schemaName: "script_block_element",
    systemPromptSlug: "course-element-script-block",
    systemPrompt: `You are generating a script block for an Alamo Prime training course.

WHAT THIS ELEMENT LOOKS LIKE:
A card with a colored header bar (orange, with an emoji icon and title) followed by bilingual script lines.
Each line shows the English text prominently with the Spanish translation in italic below.
Staff use this as a reference card — exact phrases they can memorize and use on the floor.

STRUCTURE:
- header_en/header_es: Short title for the script card (e.g. "Greeting Script" / "Guión de Bienvenida")
- header_icon: Single emoji that represents the script topic (e.g. "🎙️", "🍷", "👋")
- lines: Array of dialogue lines or script phrases. Generate 4-8 lines.

RULES:
- Each line should be a complete, natural-sounding phrase a server/bartender would actually say
- text_en: The English phrase, written as natural speech (contractions, casual tone)
- text_es: The Spanish version — natural hospitality Spanish, not word-for-word translation
- Keep industry terms in English when standard (e.g., "medium-rare", brand names)
- Order lines in the natural flow of the conversation (greeting → introduction → recommendation → close)
- Include stage directions in brackets when helpful: "[if they hesitate]", "[for wine tables]"
- Reference specific products, dishes, or prices from the source material`,
    mergeResult: (_el, result) => ({ ...result, status: "generated" }),
  },

  content: {
    schema: ELEMENT_CONTENT_SCHEMA,
    schemaName: "content_element",
    systemPromptSlug: "course-element-builder",
    systemPrompt: "", // Uses the DB-fetched contentPrompt (set at runtime)
    mergeResult: (_el, result) => ({
      body_en: result.body_en,
      body_es: result.body_es,
      status: "generated",
    }),
  },

  feature: {
    schema: ELEMENT_FEATURE_SCHEMA,
    schemaName: "feature_element",
    systemPromptSlug: "course-feature-element",
    systemPrompt: "", // Uses the DB-fetched featurePrompt + variant addition (set at runtime)
    mergeResult: (_el, result) => ({
      body_en: result.body_en,
      body_es: result.body_es,
      ...(result.variant ? { variant: result.variant } : {}),
      status: "generated",
    }),
  },

  media: {
    schema: ELEMENT_CONTENT_SCHEMA,
    schemaName: "media_element",
    systemPromptSlug: "course-element-media",
    systemPrompt: `You are writing a caption and alt-text description for an image in an Alamo Prime training course. The image is a visual anchor that supports the surrounding educational content.

RULES:
- body_en: Write a 1-2 sentence descriptive caption that explains what the image shows and why it matters for staff training. Be specific — reference product names, plating details, or techniques from the source material.
- body_es: Natural Spanish translation of the caption.
- Keep it concise but informative. This appears below the image as context.
- You MUST return valid JSON matching the schema.`,
    mergeResult: (_el, result) => ({
      caption_en: result.body_en,
      caption_es: result.body_es,
      status: "generated",
    }),
  },
};

const CHAT_EDIT_SCHEMA = {
  type: "object" as const,
  properties: {
    modified_elements: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          key: { type: "string" as const },
          action: {
            type: "string" as const,
            enum: ["update", "insert", "delete"],
          },
          element: {
            anyOf: [
              {
                type: "object" as const,
                properties: {
                  type: { type: "string" as const },
                  key: { type: "string" as const },
                  title_en: { type: "string" as const },
                  title_es: { type: "string" as const },
                  body_en: { type: "string" as const },
                  body_es: { type: "string" as const },
                  ai_instructions: { type: "string" as const },
                  variant: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
                  sort_order: { type: "number" as const },
                  status: { type: "string" as const },
                },
                required: ["type", "key", "title_en", "title_es", "body_en", "body_es", "ai_instructions", "variant", "sort_order", "status"],
                additionalProperties: false,
              },
              { type: "null" as const },
            ],
          },
          insert_after: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
        },
        required: ["key", "action", "element", "insert_after"],
        additionalProperties: false,
      },
    },
  },
  required: ["modified_elements"],
  additionalProperties: false,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Verify user has manager or admin role.
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

/**
 * Generate a URL-safe slug from a title.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

// =============================================================================
// STEP: OUTLINE
// =============================================================================

async function handleOutline(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  // Validate: either course_id (load wizard_config from DB) or course_title (legacy inline)
  if (!body.course_id && !body.course_title?.trim()) {
    return errorResponse("bad_request", "course_id or course_title is required", 400);
  }

  // If course_id provided, load wizard_config from existing course
  let courseTitle = body.course_title || "";
  let courseDescription = body.course_description || "";
  let wizardType = body.wizard_type || "custom";
  let teacherLevel = body.teacher_level || "professional";
  let aiInstructions = body.ai_instructions || "";
  let sourceSections = body.source_sections || [];
  let sourceProducts = body.source_products || [];
  let existingCourseId = body.course_id;

  if (body.course_id) {
    const { data: existingCourse, error: fetchErr } = await supabase
      .from("courses")
      .select("id, title_en, title_es, description_en, course_type, teacher_level, wizard_config, group_id")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (fetchErr || !existingCourse) {
      return errorResponse("not_found", "Course not found or access denied", 404);
    }

    courseTitle = existingCourse.title_en || courseTitle;
    courseDescription = existingCourse.description_en || courseDescription;
    wizardType = existingCourse.course_type || wizardType;
    teacherLevel = existingCourse.teacher_level || teacherLevel;

    // Extract wizard_config fields
    const wc = existingCourse.wizard_config as Record<string, unknown> | null;
    if (wc) {
      aiInstructions = (wc.ai_instructions as string) || aiInstructions;
      sourceSections = (wc.source_sections as string[]) || sourceSections;
      sourceProducts = (wc.source_products as SourceProduct[]) || sourceProducts;
    }
  }

  console.log("[build-course] Outline: assembling source material...");

  // ── 1. Assemble source material ────────────────────────────────────────
  const material = await assembleSourceMaterial(
    sourceSections,
    sourceProducts,
    supabase,
    language,
  );

  console.log(
    `[build-course] Source material: ${material.tokenEstimate} estimated tokens, ${material.hashes.size} sources`,
  );

  // Warn if very large
  if (material.tokenEstimate > 80000) {
    console.warn(
      `[build-course] Large context: ${material.tokenEstimate} tokens. Output quality may degrade.`,
    );
  }

  // ── 2. Fetch AI prompt ─────────────────────────────────────────────────
  let promptTemplate: string | null = null;

  // Shared reasoning framework used by both generic and rollout outlines
  const OUTLINE_REASONING_FRAMEWORK = `
BEFORE YOU OUTPUT ANYTHING, WORK THROUGH THESE STAGES INTERNALLY:

STAGE 1 — INVENTORY YOUR TOOLS
You have 8 element types. Understand what each one DOES to a learner:
  page_header    — Course hero block. YOU MUST fill ALL page_header fields in the outline:
                   badge_en/badge_es: short pill text (e.g. "One-Day Rollout" / "Lanzamiento de un Día")
                   badge_icon: single emoji for the badge pill (e.g. "🎯")
                   title_en/title_es: use | pipe to split light|bold (e.g. "The One-Day Luxury Upgrade|Black Truffle Day")
                   tagline_en/tagline_es: 1-sentence description (e.g. "A limited-run experience in aroma, timing, and tableside excellence.")
                   icon: single emoji for the icon tile (e.g. "🍄")
                   icon_label_en/icon_label_es: 1-2 word label below icon (e.g. "Truffle Service" / "Servicio Trufa")
                   ONE per page maximum. Always the FIRST element. Sets the visual tone.
  section_header — Sub-section divider. YOU MUST fill ALL section_header fields in the outline:
                   number_label: number + theme (e.g. "1 — Make It Count"). Code stamps the correct number; AI sets the theme.
                   title_en/title_es: use | pipe to split light|bold (e.g. "Why This Rollout|Exists")
                   subtitle_en/subtitle_es: 1 confident sentence about what the section covers
                   Use to create visual sections within a page. Auto-inserts a divider line above.
  content        — The workhorse. Rich markdown (##, ###, bullets, numbered lists, tables, **bold**).
                   Use for explanations, procedures, comparisons, narratives, scenarios.
                   Set lead: true for intro paragraphs (larger, lighter text — no title, no markdown).
  card_grid      — Multi-card grid. 3 variants:
                   icon_tile: 44px gradient icon tile + title + body. For goals, features, highlights.
                   menu_item: Large emoji + orange top bar. For menu items, dishes, products.
                   bilingual: EN/ES side-by-side cards. For key phrases, translations.
                   Set columns: 2 or 3.
  comparison     — Side-by-side or stacked panels. 2 variants:
                   correct_incorrect: Dark positive + light negative side-by-side. For visual standards.
                   miss_fix: Vertical stack of miss/fix pairs with colored tags. For common mistakes.
  feature        — A visual interruption that forces the eye to stop. 7 tonal variants:
                   tip: Practical shortcut or guest-facing talking point. Tone: helpful, insider.
                   best_practice: The "right way" distilled. Tone: authoritative, proven.
                   caution: Something that goes wrong often. Tone: experienced, preventive.
                   warning: Hard stop — allergens, safety, legal. Tone: urgent, non-negotiable.
                   did_you_know: Surprising fact that reframes understanding. Tone: curious, memorable.
                   key_point: The one thing to remember from this section. Tone: crystallized, definitive.
                   standout: Dark banner with radial glow. Non-negotiable rule. Tone: authoritative, urgent.
                   A feature is NOT a summary paragraph in a colored box — it is a SIGNAL.
  script_block   — Bilingual conversation/script lines with colored header. For exact service phrases,
                   tableside dialogue, greeting scripts. Shows EN primary + ES italic secondary.
  media          — A visual anchor. 3 sources:
                   product_image: Real product photo from the database. Set product_image_ref to the product UUID.
                   ai_generated: Conceptual illustration (e.g., "correct vs incorrect plating").
                   upload: Placeholder for admin to add their own photo.
                   Place media where a visual teaches faster than words.

STAGE 2 — MINE THE SOURCE MATERIAL
Read the source material with these 5 extraction lenses:
  A. CORE KNOWLEDGE — What must every staff member know after this course?
  B. DANGER ZONES — Allergens, temperatures, common mistakes, legal/compliance concerns → warning or caution
  C. GUEST-FACING MOMENTS — Flavor descriptions, pairing suggestions, origin stories, upsell pathways → tip
  D. SURPRISE FACTORS — Counter-intuitive facts, behind-the-scenes details, memorable stats → did_you_know
  E. VISUAL OPPORTUNITIES — Plating standards, product appearance, labels, technique demos → media

STAGE 3 — DESIGN THE LEARNING ARC
Design a journey, not a list:
  OPENING — Hook them in the first 10 seconds. Use a surprising fact, a scenario, a visual, or a bold statement.
            Do NOT open with "In this course you will learn..."
  MIDDLE — Teach in a natural sequence: simple → complex, familiar → unfamiliar, or service-flow order.
  CLOSING — Crystallize the most important takeaway in a key_point.

STAGE 4 — PLAN THE RHYTHM
Alternate between teaching modes:
  - Start with page_header as the first element (once per page)
  - Use section_header to introduce each major topic
  - No two content elements back-to-back without a feature, card_grid, or media between them
  - Use card_grid for groups of 2-6 items (goals, menu items, key concepts)
  - Use comparison for visual standards (correct/incorrect) or common mistakes (miss/fix)
  - Use script_block for exact service language and bilingual phrases
  - No section starts the same way as the previous section
  - Do not use the same feature variant twice in a row
  - Include at least 1 media element per section when source material supports it
  - Higher feature density in first and last sections (attention peaks there)

STAGE 5 — WRITE DETAILED AI_INSTRUCTIONS
The ai_instructions field is the brief for a separate AI that generates the actual content.
Every ai_instructions MUST specify:
  1. WHAT to write (topic, specific data points)
  2. HOW to frame it (scenario? comparison table? step-by-step? guest dialogue?)
  3. WHAT ANGLE (guest-facing? operational? knowledge-building?)
  4. WHAT SOURCE DATA to reference by name
Minimum 20 words per ai_instructions. Be specific.
  GOOD: "Write a scenario where a server approaches a 4-top who ordered ribeyes. Walk through wine pairing suggestions using the Caymus and Jordan Cab data. Include sample dialogue."
  BAD: "Write about wine service."

ANTI-PATTERNS — DO NOT:
  X Cookie-cutter sections (every section starting content → tip → key_point)
  X Generic titles ("Introduction", "Overview", "Key Takeaways")
  X Orphan features (a warning not preceded by the content explaining why)
  X Wall of content (4+ content elements with no features or media)
  X Lazy ai_instructions (under 20 words)
  X Identical section structure (if section 2 matches section 1's element type sequence, restructure)
  X Filler elements (every element must earn its place)
  X Opening with "In this course/section you will learn..."`;

  if (wizardType === "menu_rollout") {
    // Rollout-specific prompt: stored in ai_prompts table (customizable per restaurant)
    promptTemplate = await fetchPromptBySlug(
      supabase,
      "course-outline-rollout",
      language,
    );

    if (!promptTemplate) {
      // Minimal fallback — the DB prompt is the source of truth
      promptTemplate = `You are a hospitality training director designing a menu rollout briefing. Your audience is FOH staff — tips-motivated, bilingual, reading on phones.

TASK: Generate a CONCISE training page for a menu rollout. This is a pre-shift brief, NOT a textbook. Staff learn products from dedicated product viewers — your job is the operational wrapper.
Keep it to 2-3 sections max. Match output depth to input weight — brief instructions = brief output.
Use Apple-keynote-inspired titles with | pipe for light|bold splits. Section number_labels: just "1", "2", "3".
Include failure path elements (what to say when things go wrong). End with a feature(standout) with BOTH title AND body.
Generate bilingual titles (title_en + title_es). Assign unique keys. Set sort_order sequentially.
Include source_refs with correct hashes. Set unused fields to null. Return valid JSON matching the schema.`;
    }

    // Always append the element-type reasoning framework (platform-level, shared across all courses)
    promptTemplate = `${promptTemplate}\n\n${OUTLINE_REASONING_FRAMEWORK}`;
  } else {
    // Generic prompt for custom/standard courses
    promptTemplate = await fetchPromptBySlug(
      supabase,
      "course-outline-generator",
      language,
    );

    if (!promptTemplate) {
      promptTemplate = `You are a hospitality training director designing a course for Alamo Prime, a premium steakhouse in Miami. Your audience is FOH staff — servers, bartenders, hosts — ages 21-35, bilingual, energetic, tips-motivated. You are NOT writing an encyclopedia. You are designing a learning JOURNEY that builds confidence.

TASK: Generate a course outline from the source material provided. The outline defines the structure — what topics to cover, in what order, with what element types, and how they flow together as a learning experience.

OUTPUT RULES:
- Generate 3-6 sections depending on source material depth
- Each section: 4-8 elements with a clear pedagogical purpose
- Each section must have a different internal rhythm (not the same element pattern)
- Every section ends with a key_point — the one testable takeaway
- NEVER hallucinate product data — only reference products in the source material
- Generate bilingual titles (title_en + title_es) — specific and engaging, not generic
- Assign unique, descriptive keys (e.g., "hook-wagyu-story", "tip-upsell-cab", "warn-shellfish")
- Set sort_order sequentially within each section (0, 1, 2...)
- Include source_refs with correct hashes for each element
- Set variant for feature elements; set media_type/image_source/product_image_ref for media elements
- Set unused fields to null
- You MUST return valid JSON matching the schema.`;
    }

    // Always append the element-type reasoning framework (platform-level, shared across all courses)
    promptTemplate = `${promptTemplate}\n\n${OUTLINE_REASONING_FRAMEWORK}`;
  }

  // ── 3. Build the user prompt with wizard context ───────────────────────
  const wizardContext = [
    wizardType ? `WIZARD TYPE: ${wizardType}` : null,
    `COURSE TITLE: ${courseTitle}`,
    courseDescription ? `COURSE DESCRIPTION: ${courseDescription}` : null,
    teacherLevel ? `TEACHER LEVEL: ${teacherLevel}` : null,
    aiInstructions ? `ADMIN INSTRUCTIONS: ${aiInstructions}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Include hash map so the AI can set source_refs with correct hashes
  const hashContext = Array.from(material.hashes.entries())
    .map(([key, hash]) => `${key} -> ${hash}`)
    .join("\n");

  const userPrompt = `${wizardContext}

AVAILABLE SOURCE HASHES (use these for source_refs):
${hashContext}

SOURCE MATERIAL:
${material.text}`;

  console.log(`[build-course] Outline user prompt length: ${userPrompt.length} chars`);
  console.log(`[build-course] Source products count: ${sourceProducts.length} groups`);
  console.log(`[build-course] Source sections count: ${sourceSections.length}`);
  if (material.text.length < 100) {
    console.warn(`[build-course] WARNING: Very little source material (${material.text.length} chars). AI may generate a thin outline.`);
  }

  // ── 4. Check credits ──────────────────────────────────────────────────
  const credits = await getCreditCost(
    supabase,
    groupId,
    "course_builder",
    "outline",
  );

  const usageInfo = await checkUsage(supabase, userId, groupId);
  if (!usageInfo) {
    return errorResponse("forbidden", "Not a member of this group", 403);
  }
  if (!usageInfo.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429);
  }

  // ── 5. Call AI ─────────────────────────────────────────────────────────
  console.log("[build-course] Outline: calling OpenAI...");

  const aiResponse = await callClaude<{ sections: unknown[] }>({
    messages: [
      { role: "system", content: promptTemplate },
      { role: "user", content: userPrompt },
    ],
    schema: OUTLINE_SCHEMA,
    schemaName: "course_outline",
    temperature: TEMPERATURE_OUTLINE,
    maxTokens: MAX_TOKENS_OUTLINE,
  });

  // ── 6. Parse and validate ──────────────────────────────────────────────
  const outline = parseAIOutlineResponse(aiResponse);
  if (!outline) {
    return errorResponse("ai_error", "Failed to parse outline response", 500);
  }

  console.log(
    `[build-course] Outline generated: ${outline.sections.length} sections`,
  );

  // ── 6b. Deterministic product_viewer insertion (menu_rollout) ──────────
  if (wizardType === "menu_rollout" && sourceProducts.length > 0) {
    const allProducts: Array<{
      table: string;
      id: string;
      name_en: string;
      name_es: string;
    }> = [];

    for (const group of sourceProducts) {
      for (const id of group.ids) {
        allProducts.push({
          table: group.table,
          id,
          name_en: material.names.get(`${group.table}:${id}`) || "",
          name_es: material.namesEs.get(`${group.table}:${id}`) || "",
        });
      }
    }

    if (allProducts.length > 0) {
      const productSections = allProducts.map((prod, idx) => ({
        title_en: prod.name_en || `Product ${idx + 1}`,
        title_es: prod.name_es || `Producto ${idx + 1}`,
        elements: [
          {
            type: "product_viewer" as const,
            key: `product_viewer_${idx + 1}`,
            title_en: prod.name_en,
            title_es: prod.name_es,
            ai_instructions: "",
            sort_order: 0,
            source_refs: [
              { table: prod.table, id: prod.id, content_hash: "" },
            ],
            products: [prod],
          },
        ],
      }));

      // Keep all AI-generated training sections, append product viewers after
      outline.sections = [...outline.sections, ...productSections];

      console.log(
        `[build-course] Rollout: ${outline.sections.length - allProducts.length} training sections + ${allProducts.length} product_viewer sections`,
      );
    }
  }

  // ── 7. Create or update course in database ──────────────────────────────
  let courseId: string;

  if (existingCourseId) {
    // Update existing course status to 'outline'
    const { error: updateError } = await supabase
      .from("courses")
      .update({ status: "outline" })
      .eq("id", existingCourseId);

    if (updateError) {
      console.error("[build-course] Course update error:", updateError.message);
      return errorResponse("db_error", "Failed to update course: " + updateError.message, 500);
    }

    courseId = existingCourseId;
    console.log(`[build-course] Course updated: ${courseId}`);

    // Delete any existing sections (outline is being regenerated)
    await supabase.from("course_sections").delete().eq("course_id", courseId);
  } else {
    // Create new course (legacy / inline mode)
    const courseSlug = generateSlug(courseTitle);
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({
        group_id: groupId,
        slug: courseSlug,
        title_en: courseTitle,
        title_es: courseTitle,
        description_en: courseDescription || null,
        course_type: wizardType,
        teacher_level: teacherLevel,
        status: "outline",
        version: 1,
        created_by: userId,
        wizard_config: {
          wizard_type: wizardType,
          source_sections: sourceSections,
          source_products: sourceProducts,
          teacher_level: teacherLevel,
          ai_instructions: aiInstructions,
        },
      })
      .select("id")
      .single();

    if (courseError) {
      console.error("[build-course] Course insert error:", courseError.message);
      return errorResponse("db_error", "Failed to create course: " + courseError.message, 500);
    }

    courseId = course.id;
    console.log(`[build-course] Course created: ${courseId}`);
  }

  // ── 8. Post-process: stamp number_label on section_headers ────────────
  // The outline AI generates number_label but code ensures correct sequential numbering
  // Format: "1 — Theme" where theme is extracted from the bold part of the title
  let sectionHeaderCount = 0;
  for (const sec of outline.sections) {
    for (const el of sec.elements) {
      if (el.type === "section_header") {
        sectionHeaderCount++;
        const titleParts = (el.title_en || "").split("|");
        const theme = titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : titleParts[0].trim();
        el.number_label = `${sectionHeaderCount} — ${theme}`;
      }
    }
  }

  // ── 9. Create sections with elements JSONB ─────────────────────────────
  // section_header and page_header are fully populated by the outline AI — mark as "generated"
  const headerTypes = new Set(["section_header", "page_header"]);
  const sectionRows = outline.sections.map((sec, idx) => ({
    course_id: courseId,
    group_id: groupId,
    slug: generateSlug(sec.title_en) || `section-${idx + 1}`,
    title_en: sec.title_en,
    title_es: sec.title_es,
    sort_order: idx,
    section_type: "lesson",
    generation_status: "outline",
    elements: sec.elements.map((el) => ({
      ...el,
      status: el.type === "product_viewer" ? "reviewed"
        : headerTypes.has(el.type) ? "generated"
        : "outline",
      ...(el.type === "product_viewer" || headerTypes.has(el.type) ? {} : { body_en: null, body_es: null }),
    })),
  }));

  const { data: sections, error: sectionsError } = await supabase
    .from("course_sections")
    .insert(sectionRows)
    .select("id, title_en, sort_order, elements");

  if (sectionsError) {
    console.error(
      "[build-course] Sections insert error:",
      sectionsError.message,
    );
    // Clean up the course if sections fail
    await supabase.from("courses").delete().eq("id", courseId);
    return errorResponse(
      "db_error",
      "Failed to create sections: " + sectionsError.message,
      500,
    );
  }

  // ── 9. Track credits ───────────────────────────────────────────────────
  await trackAndIncrement(supabase, userId, groupId, credits, {
    domain: "course_builder",
    action: "outline",
    edge_function: "build-course",
    model: "claude-sonnet-4-6",
    tokens_input: material.tokenEstimate,
    tokens_output: estimateTokens(JSON.stringify(aiResponse)),
  });

  // ── 10. Return ─────────────────────────────────────────────────────────
  return jsonResponse({
    course_id: courseId,
    sections: sections.map(
      (s: { id: string; title_en: string; sort_order: number; elements: unknown[] }) => ({
        section_id: s.id,
        title_en: s.title_en,
        sort_order: s.sort_order,
        elements: s.elements,
      }),
    ),
    source_material_summary: `Used ${material.hashes.size} source records (${material.tokenEstimate} estimated tokens)`,
    estimated_build_time_seconds: outline.sections.reduce(
      (acc, s) => acc + s.elements.length * 3,
      0,
    ),
  });
}

// =============================================================================
// STEP: CONTENT
// =============================================================================

async function handleContent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id) {
    return errorResponse("bad_request", "course_id is required", 400);
  }

  // ── 1. Fetch course + sections ─────────────────────────────────────────
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title_en, teacher_level, wizard_config, status")
    .eq("id", body.course_id)
    .eq("group_id", groupId)
    .single();

  if (courseError || !course) {
    return errorResponse("not_found", "Course not found", 404);
  }

  const { data: sections, error: sectionsError } = await supabase
    .from("course_sections")
    .select("id, title_en, elements, sort_order, generation_status")
    .eq("course_id", body.course_id)
    .order("sort_order", { ascending: true });

  if (sectionsError || !sections || sections.length === 0) {
    return errorResponse("not_found", "No sections found", 404);
  }

  // ── 2. Check usage before starting ─────────────────────────────────
  const contentUsageInfo = await checkUsage(supabase, userId, groupId);
  if (!contentUsageInfo || !contentUsageInfo.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429);
  }

  // ── 2b. Update course status to 'generating' ─────────────────────────
  await supabase
    .from("courses")
    .update({ status: "generating" })
    .eq("id", body.course_id);

  // ── 3. Fetch DB prompts for content + feature (fallbacks inline) ──────
  let contentPrompt = await fetchPromptBySlug(
    supabase,
    "course-element-builder",
    language,
  );

  if (!contentPrompt) {
    contentPrompt = `You are writing training content for Alamo Prime, a premium steakhouse in Miami. Your audience is FOH staff — servers, bartenders, hosts — ages 21-35, bilingual, tips-motivated, reading on their phones.

YOUR VOICE:
Write like a great GM briefing the team before a packed Saturday night. Warm. Direct. Confident. A little fun.
- Say "you" not "the server" — say "your guest" not "the customer"
- Use contractions: "don't", "you'll", "here's", "that's"
- Be specific: "135°F medium-rare" not "appropriate temperature"
- Be direct: "Never serve shellfish without asking about allergies" not "It would be advisable to inquire"

TEACHER LEVEL GUIDE:
  friendly: Encouraging, uses analogies, celebrates small wins. "Think of it like this..."
  professional: Clear, structured, balanced warmth. Default hospitality voice.
  strict: Direct, precise, no fluff. "Here's what you need to know. Period."
  expert: Deep industry context, assumes baseline knowledge, insider language.

FORMATTING RULES:
1. SHORT PARAGRAPHS: 2-3 sentences max. Staff read on phones. Keep text flowing, not dense.
2. BULLET LIMIT: Maximum 4 bullets in a row, then SWITCH FORMAT — use a paragraph bridge, a table, a scenario, or a numbered list. Never write a wall of 8+ bullets.
3. NUMBERED LISTS: Use for sequential steps, procedures, or ranked priorities.
4. TABLES: Excellent for comparisons (cuts of steak, wine regions, cocktail specs). Use when comparing 3+ items.
5. BOLD: Use **bold** for terms to memorize, temperatures, allergens, key phrases. Not for decoration.
6. HEADERS: Use ### for subsections within the element. Keep hierarchy clean.

ENGAGEMENT TECHNIQUES:
1. SCENARIOS: "Imagine a guest asks..." or "Picture this:" or "It's 7:30pm and your table just ordered..." — make learning feel real.
2. EXACT DIALOGUE: When teaching guest-facing skills, write the EXACT WORDS they can say in quotes. Make them memorizable.
3. CONTRAST: Show the WRONG way and RIGHT way side by side. "Instead of: 'We have a nice Cabernet' — Try: 'The Jordan Cabernet has these dark cherry notes that stand up perfectly to the ribeye.'"
4. SENSORY LANGUAGE: Use words they can taste, smell, see. "Buttery," "smoky," "deep ruby," "bright citrus."
5. THE "WHY": Always explain WHY something matters. Staff follow rules better when they understand the reason.

ACCURACY:
- Use ONLY data from the source material. Never invent menu items, prices, temperatures, or allergens.
- Cite specific quantities, temperatures, and times exactly from the source.

BILINGUAL:
- Generate BOTH body_en and body_es
- Spanish should be natural — as if a bilingual GM is explaining in Spanish, not Google Translate
- Keep industry terms in English when standard (medium-rare, dry-aged, brand names)

You MUST return valid JSON matching the schema.`;
  }

  let featurePrompt = await fetchPromptBySlug(
    supabase,
    "course-feature-element",
    language,
  );

  if (!featurePrompt) {
    featurePrompt = `You are writing a highlighted callout box for an Alamo Prime training course. This is NOT a content block — it's a visual interruption that demands attention. It should FEEL different from surrounding content. Short, punchy, memorable.

VOICE: Warm, direct, hospitality-driven. Use "you/your" — speak directly to the server/bartender/host.

GENERAL RULES:
- Use **bold** for the single most important phrase
- Generate both body_en and body_es (natural hospitality Spanish, not literal)
- Keep industry terms in English when standard
- You MUST return valid JSON matching the schema`;
  }

  // Variant-specific prompt additions for feature elements
  const FEATURE_VARIANT_PROMPTS: Record<string, string> = {
    tip: `VARIANT: TIP — "Use it tonight"
PURPOSE: Something SPECIFIC and ACTIONABLE they can do on their very next shift.
TONE: Encouraging, slightly conspiratorial — like a senior server sharing a secret.
STRUCTURE: Lead with the ACTION (start with a verb: "Try saying...", "Before you approach..."). 1-3 sentences max. Include exact language or a concrete action. End with the result.
EXAMPLE: "**When a table orders steak, don't ask 'Would you like wine?'** — that's a yes/no question. Try: 'For your ribeyes, I'd love to pour you our Jordan Cabernet — want me to bring a taste?' Offering a taste converts 3x more."`,

    best_practice: `VARIANT: BEST PRACTICE — "How the best do it"
PURPOSE: A validated technique from top performers. Aspirational, not mandatory.
TONE: Confident, slightly admiring — "See what she does? That's why her section is always full."
STRUCTURE: Frame as what THE BEST people do. Describe the specific behavior. Explain WHY it works. 2-4 sentences.
EXAMPLE: "**The highest-earning servers greet within 30 seconds — but don't rush to take the order.** They say something personal: 'Welcome in — looks like you're celebrating tonight!' Guests who feel seen in the first minute tip 18-22% more."`,

    caution: `VARIANT: CAUTION — "Watch out"
PURPOSE: Flags moderate concerns — common mistakes, easy-to-miss details that lead to comped meals or frustrated kitchens.
TONE: Firm but not scary. "Heads up — this is where most people mess up."
STRUCTURE: Lead with the MISTAKE or risk. Explain what goes wrong. Give the CORRECT approach in 1 sentence. 2-3 sentences.
EXAMPLE: "**Don't assume 'medium' means the same thing to every guest.** Some mean pink center; others mean barely any pink. Confirm: 'Just a touch of pink in the center — is that right?' This 5-second check prevents 80% of steak send-backs."`,

    warning: `VARIANT: WARNING — "This is not optional"
PURPOSE: CRITICAL safety, allergen, legal, or procedural concerns. Getting this wrong has serious consequences.
TONE: Serious, direct, zero ambiguity. Drop the casual tone. Full authority.
STRUCTURE: Lead with the RISK in bold. State the specific danger. State the required action in imperative language. Include specific allergens, temperatures, or time limits from source. 2-5 sentences.
EXAMPLE: "**ALWAYS ask about shellfish allergies before recommending the Lobster Bisque or Cioppino.** Shellfish is a top-8 allergen — anaphylaxis can occur within minutes. Exact words: 'Does anyone at the table have any food allergies I should know about?' This question is mandatory for EVERY table."`,

    did_you_know: `VARIANT: DID YOU KNOW — "Wow, really?"
PURPOSE: A surprising, memorable fact that creates an emotional reaction. Something they'll WANT to share with guests. Builds product passion.
TONE: Enthusiastic, sharing-a-discovery. "Get this..."
STRUCTURE: Lead with the surprising fact — front-load the "wow." 1-3 sentences. Connect it to something they can SHARE with guests. Tie it to a selling angle if possible.
EXAMPLE: "**Our dry-aging room runs at exactly 34°F and 85% humidity for a minimum of 28 days.** Each ribeye loses about 15% of its weight to evaporation — that's why dry-aged costs more, but the flavor is incredibly concentrated. Tell your guests: 'We literally aged the flavor in.'"`,

    key_point: `VARIANT: KEY POINT — "If you remember one thing"
PURPOSE: The single most important, testable takeaway. What will appear on the quiz. What the GM will ask about in pre-shift.
TONE: Clear, definitive, confident. No hedging. This is THE answer.
STRUCTURE: ONE core idea — not three, not a list, ONE thing. State it as a clear, declarative sentence in bold. Optionally add 1 sentence of context. Frame as something testable. 1-3 sentences. Ruthlessly concise.
EXAMPLE: "**Always pour wine for the host to taste BEFORE filling the table's glasses.** If the bottle is corked or oxidized, you catch it with one pour instead of a full table of disappointed guests. Host tastes first. Every time. No exceptions."`,

    standout: `VARIANT: STANDOUT — "Non-Negotiable"
PURPOSE: A hard-line directive. The one rule that cannot be bent. Dark banner with urgency.
TONE: Authoritative, no-nonsense. This is the line in the sand — zero exceptions.
STRUCTURE: Title = bold, action-oriented statement (imperative verb). Body = 2-4 sentences explaining WHY this matters and WHAT happens if you skip it. Lead with urgency. End with a clear consequence or accountability statement.
EXAMPLE: "**Sell the Aroma Moment Before the Order Locks.** Mention Black Truffle Day before the order locks, position it as a limited luxury upgrade, and time it with heat so the aroma hits immediately. If you wait until after they've decided, you've missed the sell."`,
  };

  // Wire runtime prompts into the registry (content + feature use DB-fetched prompts)
  ELEMENT_REGISTRY.content.systemPrompt = contentPrompt;
  ELEMENT_REGISTRY.feature.systemPrompt = featurePrompt;

  // ── 4. Process each section (registry-driven) ──────────────────────────
  // The ELEMENT_REGISTRY defines the schema, prompt, and merge strategy for each type.
  // To add a new element type: add one entry to ELEMENT_REGISTRY above — no loop changes needed.
  let totalCompletedElements = 0;
  const failedElements: string[] = [];
  let totalCredits = 0;

  for (const section of sections) {
    // deno-lint-ignore no-explicit-any
    const elements: any[] = section.elements || [];
    let sectionModified = false;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];

      // Only generate for outline-status elements
      if (el.status !== "outline") continue;

      // Skip product_viewer elements (rendered by frontend, no AI content needed)
      if (el.type === "product_viewer") {
        elements[i] = { ...el, status: "reviewed" };
        sectionModified = true;
        totalCompletedElements++;
        continue;
      }

      // Look up registry for this element type
      const registry = ELEMENT_REGISTRY[el.type];
      if (!registry) {
        console.warn(`[build-course] Content: unknown element type "${el.type}", skipping`);
        continue;
      }

      try {
        const sourceText = await fetchElementSourceMaterial(
          el.source_refs || [],
          supabase,
          language,
        );

        const teacherLevel = course.teacher_level || "professional";
        const sectionIdx = sections.findIndex((s: { id: string }) => s.id === section.id);

        // Build system prompt — feature gets variant addition, others use registry prompt
        let systemPrompt = registry.systemPrompt;
        if (el.type === "feature" && el.variant && FEATURE_VARIANT_PROMPTS[el.variant]) {
          systemPrompt = `${systemPrompt}\n\n${FEATURE_VARIANT_PROMPTS[el.variant]}`;
        }

        // Section context: position + previous element summary
        const sectionPosition = `SECTION: "${section.title_en}" (Section ${sectionIdx + 1} of ${sections.length})`;
        const prevElement = i > 0 ? elements[i - 1] : null;
        const prevContext = prevElement
          ? `PREVIOUS ELEMENT: ${prevElement.type}${prevElement.variant ? ` (${prevElement.variant})` : ""} — "${prevElement.title_en}"`
          : null;

        const userPrompt = [
          sectionPosition,
          prevContext,
          `ELEMENT: ${el.title_en}`,
          `TYPE: ${el.type}`,
          el.variant ? `VARIANT: ${el.variant}` : null,
          `TEACHER LEVEL: ${teacherLevel}`,
          el.ai_instructions ? `INSTRUCTIONS: ${el.ai_instructions}` : null,
          sourceText ? `\nSOURCE MATERIAL:\n${sourceText}` : null,
        ].filter(Boolean).join("\n");

        // Resolve schema — some types (comparison) pick schema based on variant
        const resolved = registry.getSchema
          ? registry.getSchema(el)
          : { schema: registry.schema, schemaName: registry.schemaName };

        const maxTokens = getMaxTokensForElement(el.type);
        console.log(`[build-course] Content: generating ${el.type} "${el.key}" (${maxTokens} max tokens)`);

        const aiResult = await callClaude({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          schema: resolved.schema,
          schemaName: resolved.schemaName,
          temperature: TEMPERATURE_CONTENT,
          maxTokens,
        });

        if (aiResult) {
          const merged = registry.mergeResult(el, aiResult);
          elements[i] = { ...el, ...merged };
        } else {
          elements[i] = { ...el, status: "generated" };
        }
        sectionModified = true;
        totalCompletedElements++;
      } catch (err) {
        const errorMsg = err instanceof ClaudeError ? err.message : "Unexpected error";
        console.error(`[build-course] Content: failed for ${el.key}:`, err);
        failedElements.push(`${section.title_en}/${el.key}: ${errorMsg}`);
        elements[i] = { ...el, status: "error", error: errorMsg };
        sectionModified = true;
      }
    }

    // Save updated elements JSONB
    if (sectionModified) {
      const { error: updateError } = await supabase
        .from("course_sections")
        .update({
          elements,
          generation_status: "generated",
        })
        .eq("id", section.id);

      if (updateError) {
        console.error(
          `[build-course] Section update error (${section.id}):`,
          updateError.message,
        );
      }

      // Track credit per section
      const creditCost = await getCreditCost(
        supabase,
        groupId,
        "course_builder",
        "content_section",
      );
      totalCredits += creditCost;

      await trackAndIncrement(supabase, userId, groupId, creditCost, {
        domain: "course_builder",
        action: "content_section",
        edge_function: "build-course",
        model: "claude-sonnet-4-6",
        metadata: { section_id: section.id, elements_count: elements.length },
      });
    }
  }

  // ── 5. Update course status ────────────────────────────────────────────
  const finalStatus = failedElements.length === 0 ? "review" : "generating";
  await supabase
    .from("courses")
    .update({ status: finalStatus })
    .eq("id", body.course_id);

  console.log(
    `[build-course] Content complete: ${totalCompletedElements} elements built, ${failedElements.length} failed`,
  );

  return jsonResponse({
    course_id: body.course_id,
    sections_built: sections.length,
    elements_built: totalCompletedElements,
    errors: failedElements,
    credits_consumed: totalCredits,
  });
}

// =============================================================================
// STEP: CHAT_EDIT
// =============================================================================

async function handleChatEdit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id) {
    return errorResponse("bad_request", "course_id is required", 400);
  }
  if (!body.section_id) {
    return errorResponse("bad_request", "section_id is required", 400);
  }
  if (!body.instruction?.trim()) {
    return errorResponse("bad_request", "instruction is required", 400);
  }

  // ── 1. Fetch section + course metadata ──────────────────────────────
  const { data: section, error: sectionError } = await supabase
    .from("course_sections")
    .select("id, title_en, elements, course_id")
    .eq("id", body.section_id)
    .eq("course_id", body.course_id)
    .single();

  if (sectionError || !section) {
    return errorResponse("not_found", "Section not found", 404);
  }

  const { data: chatCourse } = await supabase
    .from("courses")
    .select("title_en, teacher_level")
    .eq("id", body.course_id)
    .single();

  const chatTeacherLevel = chatCourse?.teacher_level || "professional";
  const chatCourseTitle = chatCourse?.title_en || "";

  // ── 2. Serialize existing elements for context ─────────────────────────
  // deno-lint-ignore no-explicit-any
  const elementsContext = (section.elements || []).map((el: any) =>
    serializeElementForAI(el),
  ).join("\n---\n");

  // ── 3. Check credits ──────────────────────────────────────────────────
  const credits = await getCreditCost(
    supabase,
    groupId,
    "course_builder",
    "chat_edit",
  );

  const usageInfo = await checkUsage(supabase, userId, groupId);
  if (!usageInfo || !usageInfo.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429);
  }

  // ── 4. Call AI ─────────────────────────────────────────────────────────
  const systemPrompt = `You are modifying elements in a training course for Alamo Prime, a premium steakhouse in Miami. The audience is FOH staff — servers, bartenders, hosts.

VOICE: Write like a great GM briefing the team. Warm, direct, confident. Use "you/your", contractions, specific details. Match teacher level: ${chatTeacherLevel}.

YOUR TASK: You receive the current elements in a section and an instruction from the admin. Return a list of modifications.

For each modification, specify:
- key: the element key being modified (or a new key for inserts)
- action: "update" (modify existing), "insert" (add new), or "delete" (remove)
- element: the full updated/new element data (null for deletes)
- insert_after: key of the element to insert after (null unless inserting)

CONTENT RULES:
- When writing content elements: use short paragraphs (2-3 sentences), max 4 bullets in a row, scenarios, exact guest dialogue, sensory language
- When writing feature elements: match the variant tone (tip = actionable, warning = serious, did_you_know = surprising, key_point = one testable takeaway)
- When updating: include ALL fields (type, key, title_en, title_es, body_en, body_es, ai_instructions, variant, sort_order, status)
- Generate BOTH body_en and body_es (natural hospitality Spanish)
- For new elements, set status to "generated"
- NEVER invent facts not in the existing content or source material
- You MUST return valid JSON matching the schema.`;

  const userPrompt = [
    chatCourseTitle ? `COURSE: ${chatCourseTitle}` : null,
    `SECTION: ${section.title_en}`,
    `\nCURRENT ELEMENTS:\n${elementsContext}`,
    `\nINSTRUCTION: ${body.instruction}`,
  ].filter(Boolean).join("\n");

  console.log("[build-course] Chat edit: calling OpenAI...");

  try {
    const aiResult = await callClaude({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      schema: CHAT_EDIT_SCHEMA,
      schemaName: "chat_edit",
      temperature: TEMPERATURE_CONTENT,
      maxTokens: MAX_TOKENS_CHAT_EDIT,
    });

    const parsed = parseAIChatEditResponse(aiResult);
    if (!parsed) {
      return errorResponse("ai_error", "Failed to parse chat edit response", 500);
    }

    // ── 5. Apply modifications to elements array ───────────────────────
    // deno-lint-ignore no-explicit-any
    let elements: any[] = [...(section.elements || [])];

    for (const mod of parsed.modified_elements) {
      if (mod.action === "delete") {
        elements = elements.filter((el) => el.key !== mod.key);
      } else if (mod.action === "update" && mod.element) {
        const idx = elements.findIndex((el) => el.key === mod.key);
        if (idx >= 0) {
          elements[idx] = { ...elements[idx], ...mod.element, status: "generated" };
        }
      } else if (mod.action === "insert" && mod.element) {
        const insertIdx = mod.insert_after
          ? elements.findIndex((el) => el.key === mod.insert_after) + 1
          : elements.length;
        elements.splice(insertIdx, 0, { ...mod.element, status: "generated" });
      }
    }

    // ── 6. Save updated elements ─────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("course_sections")
      .update({ elements })
      .eq("id", body.section_id);

    if (updateError) {
      console.error(
        "[build-course] Chat edit save error:",
        updateError.message,
      );
      return errorResponse("db_error", "Failed to save modifications", 500);
    }

    // ── 7. Track credits ─────────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, credits, {
      domain: "course_builder",
      action: "chat_edit",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
    });

    return jsonResponse({
      section_id: body.section_id,
      modifications: parsed.modified_elements.length,
      elements,
    });
  } catch (err) {
    if (err instanceof ClaudeError) {
      return errorResponse("ai_error", err.message, err.status);
    }
    throw err;
  }
}

// =============================================================================
// STEP: FULL CONTENT (Pass 1 — Expert Writer)
// =============================================================================

async function handleFullContent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id) {
    return errorResponse("bad_request", "course_id is required for full_content step", 400);
  }

  try {
    // ── 1. Load course ──────────────────────────────────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, title_en, title_es, description_en, course_type, teacher_level, wizard_config, group_id")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (courseErr || !course) {
      return errorResponse("not_found", "Course not found or access denied", 404);
    }

    // ── 2. Load sections (outline must exist) ────────────────────────────
    const { data: sections, error: secErr } = await supabase
      .from("course_sections")
      .select("id, title_en, title_es, elements, source_refs, sort_order")
      .eq("course_id", body.course_id)
      .order("sort_order");

    if (secErr || !sections || sections.length === 0) {
      return errorResponse("bad_request", "Course has no sections. Generate an outline first.", 400);
    }

    // Verify sections have elements
    const hasElements = sections.some((s: { elements: unknown[] }) => s.elements && s.elements.length > 0);
    if (!hasElements) {
      return errorResponse("bad_request", "Course sections have no elements. Generate an outline first.", 400);
    }

    // ── 3. Check credits ────────────────────────────────────────────────
    const creditCost = await getCreditCost(supabase, groupId, "course_builder", "full_content");
    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo || !usageInfo.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429);
    }

    // ── 4. Assemble source material ─────────────────────────────────────
    const wizardConfig = course.wizard_config || {};
    const sourceSections = wizardConfig.source_sections || [];
    const sourceProducts = wizardConfig.source_products || [];

    const material = await assembleSourceMaterial(
      sourceSections,
      sourceProducts,
      supabase,
      language,
    );

    // ── 5. Build outline summary for the writer ─────────────────────────
    const outlineSummary = sections.map((s: { id: string; title_en: string; title_es: string; elements: Array<{ type: string; key: string; title_en: string; ai_instructions: string; variant?: string }> }, i: number) => {
      const elementList = (s.elements || []).map((el, ei: number) => {
        let desc = `    ${ei + 1}. [${el.type}] "${el.title_en}"`;
        if (el.variant) desc += ` (variant: ${el.variant})`;
        if (el.ai_instructions) desc += `\n       Instructions: ${el.ai_instructions}`;
        return desc;
      }).join("\n");
      return `Section ${i + 1}: "${s.title_en}" / "${s.title_es}" (id: ${s.id})\n  Elements:\n${elementList}`;
    }).join("\n\n");

    // ── 6. Fetch prompt ─────────────────────────────────────────────────
    const writerPrompt = await fetchPromptBySlug(supabase, "course-full-content-writer", language) ||
      "You are a hospitality training content writer. Write clear, flowing bilingual content.";

    // ── 7. Build system + user messages ─────────────────────────────────
    const systemMessage = `${writerPrompt}

Teacher level: ${course.teacher_level || "professional"}
Course type: ${course.course_type || "custom"}
Course title: ${course.title_en}

CRITICAL: You MUST return content for every section listed below. Use the section_id exactly as provided.

COURSE OUTLINE:
${outlineSummary}`;

    const userMessage = `Using the source material below, write complete bilingual (EN + ES) training content for each section of this course.

SOURCE MATERIAL:
${material.text}

Write flowing, well-structured content for each section. The content should naturally map to the element types in the outline. Return JSON with a sections array, each having section_id, content_en, content_es, and teaching_notes.`;

    // ── 8. Call OpenAI ───────────────────────────────────────────────────
    console.log(`[build-course] full_content: ${sections.length} sections, ~${material.tokenEstimate} source tokens`);

    const aiResponse = await callClaude({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      schema: FULL_CONTENT_SCHEMA,
      schemaName: "full_content_response",
      maxTokens: MAX_TOKENS_FULL_CONTENT,
      temperature: TEMPERATURE_CONTENT,
    });

    const parsed = parseFullContentResponse(aiResponse);
    if (!parsed) {
      return errorResponse("ai_error", "Failed to parse full content response from AI", 500);
    }

    // ── 9. Write draft_content to each section ──────────────────────────
    for (const sec of parsed.sections) {
      const { error: updateErr } = await supabase
        .from("course_sections")
        .update({
          draft_content: {
            content_en: sec.content_en,
            content_es: sec.content_es,
            teaching_notes: sec.teaching_notes || null,
          },
          generation_status: "prose_ready",
        })
        .eq("id", sec.section_id)
        .eq("course_id", body.course_id);

      if (updateErr) {
        console.error(`[build-course] Failed to save draft_content for section ${sec.section_id}:`, updateErr.message);
      }
    }

    // ── 10. Update course status ────────────────────────────────────────
    await supabase
      .from("courses")
      .update({ status: "prose_ready" })
      .eq("id", body.course_id);

    // ── 11. Track credits ───────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, creditCost, {
      domain: "course_builder",
      action: "full_content",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
    });

    console.log(`[build-course] full_content complete: ${parsed.sections.length} sections written`);

    return jsonResponse({
      sections: parsed.sections.map(s => ({
        section_id: s.section_id,
        has_content: true,
      })),
      sections_written: parsed.sections.length,
    });

  } catch (err) {
    if (err instanceof ClaudeError) {
      return errorResponse("ai_error", err.message, err.status);
    }
    throw err;
  }
}

// =============================================================================
// STEP: ASSEMBLE (Pass 2 — Per-section element assembly)
// =============================================================================

async function handleAssemble(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id || !body.section_id) {
    return errorResponse("bad_request", "course_id and section_id are required for assemble step", 400);
  }

  try {
    // ── 1. Load course metadata ─────────────────────────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, teacher_level, course_type, group_id")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (courseErr || !course) {
      return errorResponse("not_found", "Course not found or access denied", 404);
    }

    // ── 2. Load section with draft_content + elements ────────────────────
    const { data: section, error: secErr } = await supabase
      .from("course_sections")
      .select("id, title_en, title_es, elements, draft_content, generation_status")
      .eq("id", body.section_id)
      .eq("course_id", body.course_id)
      .single();

    if (secErr || !section) {
      return errorResponse("not_found", "Section not found", 404);
    }

    if (!section.draft_content) {
      return errorResponse("bad_request", "Section has no draft_content. Run full_content step first.", 400);
    }

    const elements = section.elements || [];
    if (elements.length === 0) {
      return errorResponse("bad_request", "Section has no elements to assemble.", 400);
    }

    // ── 3. Check credits ────────────────────────────────────────────────
    const creditCost = await getCreditCost(supabase, groupId, "course_builder", "assemble_section");
    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo || !usageInfo.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429);
    }

    // ── 4. Assemble each element ────────────────────────────────────────
    const prose = section.draft_content;
    const contentEn = prose.content_en || "";
    const contentEs = prose.content_es || "";

    // deno-lint-ignore no-explicit-any
    const assembledElements: any[] = [];

    for (const el of elements) {
      // Skip product_viewer — these are deterministic, not AI-generated
      if (el.type === "product_viewer") {
        assembledElements.push({ ...el, status: "generated" });
        continue;
      }

      // Skip already-generated elements (supports partial re-runs)
      if (el.status === "generated" || el.status === "reviewed") {
        assembledElements.push(el);
        continue;
      }

      // Look up registry for this element type
      const registry = ELEMENT_REGISTRY[el.type];
      if (!registry) {
        console.warn(`[build-course] assemble: no registry for type "${el.type}", skipping`);
        assembledElements.push(el);
        continue;
      }

      // Resolve schema (some types have variant-specific schemas)
      const resolved = registry.getSchema
        ? registry.getSchema(el)
        : { schema: registry.schema, schemaName: registry.schemaName };

      // Build assembly prompt
      const assemblySystem = `You are assembling structured training content for an Alamo Prime restaurant course.

You will receive:
1. The FULL SECTION PROSE — flowing content that was written by an expert training writer
2. A specific ELEMENT to fill — with its type, variant, and instructions

Your job: Extract the content from the prose that best matches this element's purpose and format it into the exact JSON schema provided. Use the element's ai_instructions as guidance for what content to pick.

Teacher level: ${course.teacher_level || "professional"}
Section: "${section.title_en}"

${registry.systemPrompt}`;

      const assemblyUser = `FULL SECTION CONTENT (English):
${contentEn}

FULL SECTION CONTENT (Spanish):
${contentEs}

ELEMENT TO FILL:
Type: ${el.type}${el.variant ? ` (variant: ${el.variant})` : ""}
Title: ${el.title_en} / ${el.title_es}
Instructions: ${el.ai_instructions || "Use the most relevant content from the section prose."}

Extract the appropriate content from the section prose above and format it into the required JSON schema. Ensure both EN and ES content is provided.`;

      try {
        const result = await callClaude({
          messages: [
            { role: "system", content: assemblySystem },
            { role: "user", content: assemblyUser },
          ],
          schema: resolved.schema,
          schemaName: resolved.schemaName,
          maxTokens: getMaxTokensForElement(el.type),
          temperature: TEMPERATURE_CONTENT,
        });

        const merged = registry.mergeResult(el, result);
        assembledElements.push({ ...el, ...merged });
      } catch (elErr) {
        console.error(`[build-course] assemble element "${el.key}" error:`, elErr);
        assembledElements.push(el); // Keep original on error
      }
    }

    // ── 5. Save assembled elements ──────────────────────────────────────
    const { error: saveErr } = await supabase
      .from("course_sections")
      .update({
        elements: assembledElements,
        generation_status: "generated",
      })
      .eq("id", body.section_id);

    if (saveErr) {
      console.error(`[build-course] Failed to save assembled elements:`, saveErr.message);
      return errorResponse("server_error", "Failed to save assembled elements", 500);
    }

    // ── 6. Track credits ────────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, creditCost, {
      domain: "course_builder",
      action: "assemble_section",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
    });

    console.log(`[build-course] assemble complete: section ${body.section_id}, ${assembledElements.length} elements`);

    return jsonResponse({
      section_id: body.section_id,
      elements: assembledElements,
      elements_assembled: assembledElements.filter((e: { status: string }) => e.status === "generated").length,
    });

  } catch (err) {
    if (err instanceof ClaudeError) {
      return errorResponse("ai_error", err.message, err.status);
    }
    throw err;
  }
}

// =============================================================================
// STEP: PASS 1 — Content Writer (creates sections with prose, no elements)
// =============================================================================

async function handlePass1(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id) {
    return errorResponse("bad_request", "course_id is required for pass1 step", 400);
  }

  try {
    // ── 1. Load course (must have wizard_config) ─────────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, title_en, title_es, description_en, course_type, teacher_level, wizard_config, group_id")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (courseErr || !course) {
      return errorResponse("not_found", "Course not found or access denied", 404);
    }

    const wizardConfig = course.wizard_config || {};
    if (!wizardConfig.source_products && !wizardConfig.source_sections) {
      return errorResponse("bad_request", "Course has no wizard_config with source material", 400);
    }

    // ── 2. Check credits + usage BEFORE any destructive operations ─────
    const creditCost = await getCreditCost(supabase, groupId, "course_builder", "pass1");
    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo) {
      return errorResponse("forbidden", "Not a member of this group", 403);
    }
    if (!usageInfo.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429);
    }

    // ── 3. Assemble source material ────────────────────────────────────
    const sourceSections = wizardConfig.source_sections || [];
    const sourceProducts = wizardConfig.source_products || [];

    const material = await assembleSourceMaterial(
      sourceSections,
      sourceProducts,
      supabase,
      language,
    );

    console.log(`[build-course] pass1: ${material.tokenEstimate} estimated tokens, ${material.hashes.size} sources`);

    // ── 4. Delete any existing sections (supports rebuild) ──────────────
    await supabase.from("course_sections").delete().eq("course_id", body.course_id);

    // ── 5. Fetch system prompt from DB ──────────────────────────────────
    const systemPrompt = await fetchPromptBySlug(supabase, "course-pass1-content-writer", language) ||
      "You are an expert hospitality training content writer. Write clear, engaging, bilingual training material organized into logical sections.";

    // ── 6. Build user message with wizard context ────────────────────────
    const wizardContext = [
      `COURSE TITLE: ${course.title_en}`,
      course.description_en ? `COURSE DESCRIPTION: ${course.description_en}` : null,
      course.course_type ? `COURSE TYPE: ${course.course_type}` : null,
      `TEACHER LEVEL: ${course.teacher_level || "professional"}`,
      wizardConfig.ai_instructions ? `ADMIN INSTRUCTIONS: ${wizardConfig.ai_instructions}` : null,
    ].filter(Boolean).join("\n");

    const userMessage = `${wizardContext}

SOURCE MATERIAL:
${material.text}

Write complete bilingual training content organized into logical sections. Return JSON matching the schema.`;

    // ── 7. Call OpenAI ──────────────────────────────────────────────────
    console.log(`[build-course] pass1: calling OpenAI...`);

    const aiResponse = await callClaude({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      schema: PASS1_SCHEMA,
      schemaName: "pass1_content_writer",
      maxTokens: MAX_TOKENS_PASS1,
      temperature: TEMPERATURE_CONTENT,
    });

    // ── 8. Parse response ───────────────────────────────────────────────
    const parsed = parsePass1Response(aiResponse);
    if (!parsed) {
      return errorResponse("ai_error", "Failed to parse pass1 response from AI", 500);
    }

    console.log(`[build-course] pass1: ${parsed.sections.length} sections written`);

    // ── 9. Create section rows with draft_content, no elements ──────────
    const sectionRows = parsed.sections.map((sec, idx) => ({
      course_id: body.course_id,
      group_id: groupId,
      slug: generateSlug(sec.title_en) || `section-${idx + 1}`,
      title_en: sec.title_en,
      title_es: sec.title_es,
      sort_order: idx,
      section_type: "lesson",
      generation_status: "prose_ready",
      elements: [],  // No elements yet — Pass 2 creates them
      draft_content: {
        content_en: sec.content_en,
        content_es: sec.content_es,
        teaching_notes: sec.teaching_notes,
      },
    }));

    const { data: sections, error: sectionsError } = await supabase
      .from("course_sections")
      .insert(sectionRows)
      .select("id, title_en, title_es, sort_order");

    if (sectionsError) {
      console.error("[build-course] pass1: sections insert error:", sectionsError.message);
      return errorResponse("db_error", "Failed to create sections: " + sectionsError.message, 500);
    }

    // ── 10. Update course status ────────────────────────────────────────
    await supabase
      .from("courses")
      .update({ status: "prose_ready" })
      .eq("id", body.course_id);

    // ── 11. Track credits ───────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, creditCost, {
      domain: "course_builder",
      action: "pass1",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
      tokens_input: material.tokenEstimate,
      tokens_output: estimateTokens(JSON.stringify(aiResponse)),
    });

    // ── 12. Return created section IDs ──────────────────────────────────
    return jsonResponse({
      sections: sections.map(
        (s: { id: string; title_en: string; title_es: string; sort_order: number }) => ({
          section_id: s.id,
          title_en: s.title_en,
          title_es: s.title_es,
          sort_order: s.sort_order,
        }),
      ),
      sections_created: sections.length,
    });

  } catch (err) {
    if (err instanceof ClaudeError) {
      return errorResponse("ai_error", err.message, err.status);
    }
    if (err instanceof UsageError) {
      return errorResponse("server_error", err.message, 500);
    }
    throw err;
  }
}

// =============================================================================
// STEP: PASS 2 — Layout Architect (reads prose, decides elements, fills content)
// =============================================================================

async function handlePass2(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id || !body.section_id) {
    return errorResponse("bad_request", "course_id and section_id are required for pass2 step", 400);
  }

  try {
    // ── 1. Load course metadata ──────────────────────────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, teacher_level, course_type, group_id")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (courseErr || !course) {
      return errorResponse("not_found", "Course not found or access denied", 404);
    }

    // ── 2. Load section's draft_content ──────────────────────────────────
    const { data: section, error: secErr } = await supabase
      .from("course_sections")
      .select("id, title_en, title_es, draft_content, generation_status, sort_order")
      .eq("id", body.section_id)
      .eq("course_id", body.course_id)
      .single();

    if (secErr || !section) {
      return errorResponse("not_found", "Section not found", 404);
    }

    if (!section.draft_content) {
      return errorResponse("bad_request", "Section has no draft_content. Run pass1 first.", 400);
    }

    // ── 3. Check credits ────────────────────────────────────────────────
    const creditCost = await getCreditCost(supabase, groupId, "course_builder", "pass2_section");
    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo) {
      return errorResponse("forbidden", "Not a member of this group", 403);
    }
    if (!usageInfo.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429);
    }

    // ── 4. Fetch system prompt from DB ──────────────────────────────────
    const systemPrompt = await fetchPromptBySlug(supabase, "course-pass2-layout-architect", language) ||
      "You are a visual layout architect for restaurant training courses. Transform prose into structured UI elements.";

    // ── 5. Build user message with section prose ────────────────────────
    const prose = section.draft_content;
    const isFirstSection = section.sort_order === 0;

    const userMessage = `SECTION: "${section.title_en}" / "${section.title_es}"
TEACHER LEVEL: ${course.teacher_level || "professional"}
COURSE TYPE: ${course.course_type || "custom"}
IS FIRST SECTION: ${isFirstSection ? "YES — include a page_header as the first element" : "NO — do NOT include a page_header"}

SECTION PROSE (English):
${prose.content_en || ""}

SECTION PROSE (Spanish):
${prose.content_es || ""}

TEACHING NOTES:
${prose.teaching_notes || "None"}

Read the prose above and design the best visual layout using structured elements. Return JSON matching the schema.`;

    // ── 6. Call OpenAI ──────────────────────────────────────────────────
    console.log(`[build-course] pass2: section "${section.title_en}" — calling OpenAI...`);

    const aiResponse = await callClaude({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      schema: PASS2_SECTION_SCHEMA,
      schemaName: "pass2_layout_architect",
      maxTokens: MAX_TOKENS_PASS2_SECTION,
      temperature: TEMPERATURE_CONTENT,
    });

    // ── 7. Parse and post-process ────────────────────────────────────────
    const parsed = parsePass2Response(aiResponse);
    if (!parsed) {
      console.error("[build-course] pass2: raw AI response for section", body.section_id, ":",
        JSON.stringify(aiResponse)?.substring(0, 1000));
      return errorResponse("ai_error", "Failed to parse pass2 response from AI", 500);
    }

    // Stamp status: 'generated', ensure sort_order is sequential, number section_headers
    // Use section.sort_order (0-based) for globally correct numbering across per-section pass2 calls
    let sectionHeaderCount = 0;
    const processedElements = parsed.elements.map((el, idx) => {
      const stamped = { ...el, status: "generated", sort_order: idx };

      if (el.type === "section_header") {
        sectionHeaderCount++;
        const globalNum = section.sort_order + sectionHeaderCount;
        const titleParts = (el.title_en as string || "").split("|");
        const theme = titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : titleParts[0].trim();
        stamped.number_label = `${globalNum} — ${theme}`;
      }

      return stamped;
    });

    // ── 8. Save elements to section ──────────────────────────────────────
    const { error: saveErr } = await supabase
      .from("course_sections")
      .update({
        elements: processedElements,
        generation_status: "generated",
      })
      .eq("id", body.section_id);

    if (saveErr) {
      console.error("[build-course] pass2: save error:", saveErr.message);
      return errorResponse("db_error", "Failed to save elements", 500);
    }

    // ── 9. Track credits ────────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, creditCost, {
      domain: "course_builder",
      action: "pass2_section",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
      metadata: { section_id: body.section_id, elements_count: processedElements.length },
    });

    console.log(`[build-course] pass2 complete: section "${section.title_en}", ${processedElements.length} elements`);

    // ── 10. Return ──────────────────────────────────────────────────────
    return jsonResponse({
      section_id: body.section_id,
      elements: processedElements,
      elements_created: processedElements.length,
    });

  } catch (err) {
    if (err instanceof ClaudeError) {
      return errorResponse("ai_error", err.message, err.status);
    }
    if (err instanceof UsageError) {
      return errorResponse("server_error", err.message, 500);
    }
    throw err;
  }
}

// =============================================================================
// HELPER: Load attachment files from storage as Claude content blocks
// =============================================================================

/**
 * Downloads files from course-media storage and converts them to Claude
 * multimodal content blocks (image, document, or text).
 * Enforces: max 5 files, max 10MB per file, max 40MB total.
 * Gracefully skips files that fail to download (non-fatal).
 */
// deno-lint-ignore no-explicit-any
async function loadAttachmentBlocks(supabase: any, paths: string[]): Promise<ContentBlock[]> {
  const MAX_FILES = 5;
  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
  const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40 MB total budget

  // Enforce max file count server-side
  const safePaths = paths.slice(0, MAX_FILES);
  if (paths.length > MAX_FILES) {
    console.warn(`[build-course] attachment count ${paths.length} exceeds max ${MAX_FILES}, truncating`);
  }

  const blocks: ContentBlock[] = [];
  let totalBytes = 0;
  console.log(`[build-course] loading ${safePaths.length} attachments`);

  for (const path of safePaths) {
    try {
      const { data, error } = await supabase.storage
        .from("course-media")
        .download(path);

      if (error || !data) {
        console.error(`[build-course] attachment download failed: ${path}`, error?.message);
        continue;
      }

      const blob = data as Blob;
      const mimeType = blob.type || "application/octet-stream";

      // Enforce per-file and total size limits
      if (blob.size > MAX_FILE_BYTES) {
        console.warn(`[build-course] skipping oversized attachment (${(blob.size / 1024 / 1024).toFixed(1)}MB): ${path}`);
        continue;
      }
      if (totalBytes + blob.size > MAX_TOTAL_BYTES) {
        console.warn(`[build-course] total attachment budget exceeded, skipping remaining files`);
        break;
      }
      totalBytes += blob.size;

      if (mimeType === "text/plain") {
        // Text files → text content block with filename header
        const text = await blob.text();
        const fileName = path.split("/").pop() || path;
        blocks.push({ type: "text", text: `[Attached file: ${fileName}]\n${text}` });
      } else if (mimeType === "application/pdf") {
        // PDF → document content block (base64, chunked encoding)
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const base64 = uint8ToBase64(bytes);
        blocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        });
      } else if (mimeType.startsWith("image/")) {
        // Images → image content block (base64, chunked encoding)
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const base64 = uint8ToBase64(bytes);
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data: base64 },
        });
      } else {
        console.warn(`[build-course] skipping unsupported attachment type: ${mimeType} for ${path}`);
      }
    } catch (err) {
      console.error(`[build-course] attachment error for ${path}:`, err);
      // Non-fatal — skip and continue
    }
  }

  console.log(`[build-course] ${blocks.length} attachment blocks loaded (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
  return blocks;
}

/** Efficient Uint8Array → base64 encoding using chunked String.fromCharCode */
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32KB chunks to avoid call stack limits
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

// =============================================================================
// STEP: STRUCTURE PLAN — Pass 1 (section titles + page_header + briefs)
// =============================================================================

async function handleStructurePlan(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id) {
    return errorResponse("bad_request", "course_id is required for structure_plan step", 400);
  }

  try {
    // ── 1. Load course ─────────────────────────────────────────────────
    console.log(`[build-course] structure_plan: loading course ${body.course_id} for group ${groupId}`);
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, title_en, title_es, description_en, course_type, teacher_level, wizard_config, group_id")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (courseErr || !course) {
      console.error(`[build-course] structure_plan: course load failed`, courseErr);
      return errorResponse("not_found", "Course not found or access denied", 404);
    }

    console.log(`[build-course] structure_plan: course loaded. wizard_config keys: ${JSON.stringify(Object.keys(course.wizard_config || {}))}`);
    const wizardConfig = course.wizard_config || {};
    if (!wizardConfig.source_products && !wizardConfig.source_sections) {
      console.error(`[build-course] structure_plan: no source material. wizard_config: ${JSON.stringify(wizardConfig)}`);
      return errorResponse("bad_request", "Course has no wizard_config with source material. Add source products or manual sections in the wizard.", 400);
    }

    // ── 2. Check credits ───────────────────────────────────────────────
    const creditCost = await getCreditCost(supabase, groupId, "course_builder", "structure_plan");
    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo) return errorResponse("forbidden", "Not a member of this group", 403);
    if (!usageInfo.can_ask) return errorResponse("limit_exceeded", "Usage limit reached", 429);

    // ── 3. Assemble source material ────────────────────────────────────
    const sourceSections = wizardConfig.source_sections || [];
    const sourceProducts = wizardConfig.source_products || [];
    const material = await assembleSourceMaterial(sourceSections, sourceProducts, supabase, language);

    console.log(`[build-course] structure_plan: ${material.tokenEstimate} estimated tokens, ${material.hashes.size} sources`);

    // ── 4. Fetch system prompt (DIRECTION layer from DB) ─────────────
    const wizardType = course.course_type || "custom"; // generic default, not domain-specific
    const normalizedWizard = wizardType.replace(/_/g, "-");
    const directionSlug = `${normalizedWizard}-pass1`;
    let systemPrompt = await fetchPromptBySlug(supabase, directionSlug, language);
    if (!systemPrompt) {
      // Fallback: generic structure planner (no wizard-specific direction)
      systemPrompt = await fetchPromptBySlug(supabase, "course-structure-planner", language) ||
        "You are a course structure planner for a restaurant training platform. Design a course structure with a hero page_header, logical sections, and writing briefs.";
      console.log(`[build-course] structure_plan: no direction prompt for "${directionSlug}", falling back to generic`);
    } else {
      console.log(`[build-course] structure_plan: using direction prompt "${directionSlug}"`);
    }

    // ── 5. Build user message (DEPTH layer from code constant) ────────
    const depthConfig = getDepthConfig(wizardConfig);

    const wizardContext = [
      `COURSE TITLE: ${course.title_en}`,
      course.description_en ? `COURSE DESCRIPTION: ${course.description_en}` : null,
      course.course_type ? `COURSE TYPE: ${course.course_type}` : null,
      `TEACHER LEVEL: ${course.teacher_level || "professional"}`,
      wizardConfig.ai_instructions ? `ADMIN INSTRUCTIONS: ${wizardConfig.ai_instructions}` : null,
    ].filter(Boolean).join("\n");

    // Depth blueprint (code constant) — replaces old buildDepthConstraints()
    const blueprintBlock = DEPTH_BLUEPRINTS[depthConfig.tier] || DEPTH_BLUEPRINTS.standard;
    const customInstructions = depthConfig.tier === "custom" && depthConfig.customPrompt
      ? `\nCUSTOM INSTRUCTIONS:\n"${depthConfig.customPrompt.slice(0, 500)}"`
      : "";

    const wordBudgetBlock = `WORD BUDGET:
- Total course budget: ~${depthConfig.totalWordBudget} words
- Per-section range: ${depthConfig.wordCountRange} words
- Assign a target_words value to each section. The sum should approximate the total budget.`;

    const userMessage = `${wizardContext}

${blueprintBlock}${customInstructions}

${wordBudgetBlock}

SOURCE MATERIAL:
${material.text}

Design a course structure. Return JSON matching the schema.
- Create a compelling page_header (hero) with badge, title (use | for light|bold split), tagline, and icon.
- Follow the SECTION BLUEPRINT above for section count and element structure.
- Include source_hints listing which source IDs (format: "table:uuid") are most relevant to each section.
- Set target_words for each section based on the WORD BUDGET above.`;

    // ── 5b. Load attachment content blocks (if any) ─────────────────
    const attachmentPaths = (wizardConfig.attachments as string[]) || [];
    let userContent: string | ContentBlock[] = userMessage;
    if (attachmentPaths.length > 0) {
      const attachmentBlocks = await loadAttachmentBlocks(supabase, attachmentPaths);
      if (attachmentBlocks.length > 0) {
        userContent = [
          { type: "text" as const, text: userMessage },
          ...attachmentBlocks,
        ];
      }
    }

    // ── 6. Call Claude ─────────────────────────────────────────────────
    console.log("[build-course] structure_plan: calling Claude...");

    const aiResponse = await callClaudeWithTimeout({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      schema: STRUCTURE_PLAN_SCHEMA,
      schemaName: "structure_plan",
      maxTokens: getMaxTokensForPass("structure_plan", depthConfig.tier),
      temperature: 0.6,
    });

    // ── 7. Parse response ──────────────────────────────────────────────
    const parsed = parseStructurePlanResponse(aiResponse);
    if (!parsed) {
      return errorResponse("ai_error", "Failed to parse structure_plan response", 500);
    }

    console.log(`[build-course] structure_plan: ${parsed.sections.length} sections planned`);

    // ── 8. Delete existing sections (AFTER AI succeeds — prevents data loss on failure) ──
    const { error: deleteErr } = await supabase.from("course_sections").delete().eq("course_id", body.course_id);
    if (deleteErr) {
      console.error("[build-course] structure_plan: delete sections error:", deleteErr.message);
      return errorResponse("db_error", "Failed to clear existing sections: " + deleteErr.message, 500);
    }

    // ── 9. Store page_header_data on course ────────────────────────────
    const { error: courseUpdateErr } = await supabase
      .from("courses")
      .update({
        page_header_data: parsed.page_header,
        status: "outline",
      })
      .eq("id", body.course_id);

    if (courseUpdateErr) {
      console.error("[build-course] structure_plan: course update error:", courseUpdateErr.message);
    }

    // ── 10. Create section rows with briefs ─────────────────────────────
    const sectionRows = parsed.sections.map((sec, idx) => ({
      course_id: body.course_id,
      group_id: groupId,
      slug: generateSlug(sec.title_en) || `section-${idx + 1}`,
      title_en: sec.title_en,
      title_es: sec.title_es || "",
      sort_order: idx,
      section_type: "lesson",
      generation_status: "planned",
      elements: [],
      draft_content: {
        brief_en: sec.brief_en,
        source_hints: sec.source_hints || [],
        target_words: sec.target_words,
        // Blueprint from Pass 1 — preserved through Pass 2 via spread merge, read by Pass 3
        ...(sec.element_blueprint ? { element_blueprint: sec.element_blueprint } : {}),
      },
    }));

    const { data: sections, error: sectionsError } = await supabase
      .from("course_sections")
      .insert(sectionRows)
      .select("id, title_en, title_es, sort_order");

    if (sectionsError) {
      console.error("[build-course] structure_plan: sections insert error:", sectionsError.message);
      // Attempt to restore course status since sections failed
      await supabase.from("courses").update({ status: "draft" }).eq("id", body.course_id);
      return errorResponse("db_error", "Failed to create sections: " + sectionsError.message, 500);
    }

    // ── 11. Track credits ──────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, creditCost, {
      domain: "course_builder",
      action: "structure_plan",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
      tokens_input: material.tokenEstimate,
      tokens_output: estimateTokens(JSON.stringify(aiResponse)),
    });

    // ── 12. Return ─────────────────────────────────────────────────────
    return jsonResponse({
      page_header_data: parsed.page_header,
      sections: sections.map(
        (s: { id: string; title_en: string; title_es: string; sort_order: number }) => ({
          section_id: s.id,
          title_en: s.title_en,
          title_es: s.title_es,
          sort_order: s.sort_order,
        }),
      ),
      sections_created: sections.length,
    });
  } catch (err) {
    if (err instanceof ClaudeError) return errorResponse("ai_error", err.message, err.status);
    if (err instanceof UsageError) return errorResponse("server_error", err.message, 500);
    throw err;
  }
}

// =============================================================================
// DEPTH CONSTRAINTS HELPER
// =============================================================================

function buildDepthConstraints(wizardConfig: Record<string, unknown>): string {
  const depth = (wizardConfig.depth as string) || "standard";
  const notes = (wizardConfig.depth_notes as string) || "";

  if (depth === "custom") {
    const prompt = ((wizardConfig.depth_custom_prompt as string) || "").slice(0, 500);
    return prompt
      ? `DEPTH CONSTRAINTS (custom):\n"${prompt}"`
      : "";
  }

  const ranges: Record<string, { sections: string; elements: string }> = {
    quick:    { sections: "1-3", elements: "2-4" },
    standard: { sections: "3-6", elements: "3-6" },
    deep:     { sections: "5-9", elements: "4-8" },
  };

  const r = ranges[depth] || ranges.standard;
  let block = `DEPTH CONSTRAINTS:
- Tier: ${depth}
- Target sections: ${r.sections}
- Target elements per section: ${r.elements}
- Do NOT exceed the upper section limit.`;

  if (notes) block += `\n- User notes: "${notes.slice(0, 300)}"`;
  return block;
}

interface DepthConfig {
  tier: string;
  notes: string;
  customPrompt: string;
  sectionRange: string;
  briefStyle: string;
  wordCountRange: string;
  contentStyle: string;
  skipBeverageSearch: boolean;
  skipStepsSearch: boolean;
  elementCountRange: string;
  allowedElementTypes: string[];
  elementDensityNote: string;
  totalWordBudget: number;
}

function getDepthConfig(wizardConfig: Record<string, unknown>): DepthConfig {
  const depth = (wizardConfig.depth as string) || "standard";
  const notes = ((wizardConfig.depth_notes as string) || "").slice(0, 300);
  const customPrompt = (wizardConfig.depth_custom_prompt as string) || "";

  const configs: Record<string, Omit<DepthConfig, "tier" | "notes" | "customPrompt">> = {
    quick: {
      sectionRange: "1-3",
      briefStyle: "terse",
      wordCountRange: "50-150",
      contentStyle: "bullet_points",
      skipBeverageSearch: true,
      skipStepsSearch: true,
      elementCountRange: "2-4",
      allowedElementTypes: ["content", "feature", "section_header", "card_grid", "comparison", "script_block"],
      elementDensityNote: "Concise layout (2-4 elements). Vary element types across sections — avoid repeating the same type in consecutive sections. Use card_grid for lists of 3+ parallel items, comparison for do/don't scenarios, script_block for guest-facing dialogue. Keep each element brief.",
      totalWordBudget: 300,
    },
    standard: {
      sectionRange: "3-6",
      briefStyle: "standard",
      wordCountRange: "300-800",
      contentStyle: "teaching_prose",
      skipBeverageSearch: false,
      skipStepsSearch: false,
      elementCountRange: "3-6",
      allowedElementTypes: ["content", "feature", "section_header", "card_grid", "comparison", "script_block", "media"],
      elementDensityNote: "Balanced mix of elements. Use card_grid or comparison when content supports it.",
      totalWordBudget: 2400,
    },
    deep: {
      sectionRange: "5-9",
      briefStyle: "detailed",
      wordCountRange: "600-1200",
      contentStyle: "comprehensive",
      skipBeverageSearch: false,
      skipStepsSearch: false,
      elementCountRange: "4-8",
      allowedElementTypes: ["content", "feature", "section_header", "card_grid", "comparison", "script_block", "media"],
      elementDensityNote: "Rich layout using the full element palette. Include script_blocks for guest-facing dialogue and comparisons for training scenarios.",
      totalWordBudget: 5400,
    },
  };

  const config = configs[depth] || configs.standard;
  return { tier: depth, notes, customPrompt, ...config };
}

function getMaxTokensForPass(
  pass: "structure_plan" | "content_write" | "layout",
  tier: string,
): number {
  const overrides: Record<string, Record<string, number>> = {
    quick: { structure_plan: 2048, content_write: 2048, layout: 4096 },
    standard: { structure_plan: 4096, content_write: 8192, layout: 16384 },
    deep: { structure_plan: 4096, content_write: 12288, layout: 16384 },
  };
  return overrides[tier]?.[pass] ?? overrides.standard[pass];
}

// =============================================================================
// STEP: DEPTH PREVIEW — Stateless AI call for depth tier descriptions
// =============================================================================

async function handleDepthPreview(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  if (!body.course_id) {
    return errorResponse("bad_request", "course_id is required for depth_preview step", 400);
  }

  console.log(`[build-course] depth_preview: loading course ${body.course_id}`);

  // 1. Load course
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, title_en, description_en, course_type, wizard_config")
    .eq("id", body.course_id)
    .eq("group_id", groupId)
    .single();

  if (courseErr || !course) {
    console.error(`[build-course] depth_preview: course load failed`, courseErr);
    return errorResponse("not_found", "Course not found", 404);
  }

  // 2. Check usage
  const usageInfo = await checkUsage(supabase, userId, groupId);
  if (!usageInfo) return errorResponse("forbidden", "Not a member of this group", 403);
  if (!usageInfo.can_ask) return errorResponse("limit_exceeded", "Usage limit reached", 429);

  const wizardConfig = (course.wizard_config || {}) as Record<string, unknown>;
  const language = (body.language as string) || "en";

  // 3. Validate source material exists
  const sourceSections = (wizardConfig.source_sections as string[]) || [];
  const sourceProducts = (wizardConfig.source_products as Array<{ table: string; ids: string[] }>) || [];

  if (sourceSections.length === 0 && sourceProducts.length === 0) {
    return errorResponse("bad_request", "Course has no source material configured. Add items first.", 400);
  }

  try {
    // 4. Assemble source material (lightweight — just summaries)
    const material = await assembleSourceMaterial(sourceSections, sourceProducts, supabase, language);

    console.log(`[build-course] depth_preview: ${material.tokenEstimate} estimated tokens`);

    // 5. Fetch system prompt
    const systemPrompt = await fetchPromptBySlug(supabase, "course-depth-preview", language) ||
      "You are a course architect for a restaurant training platform. Given menu items or training material, describe three depth tiers (quick, standard, deep) for a training course. Be specific to the actual items — reference real dish names, ingredients, and techniques.";

    // 6. Build user message
    const userMessage = `COURSE TITLE: ${course.title_en}
${course.description_en ? `COURSE DESCRIPTION: ${course.description_en}` : ""}
COURSE TYPE: ${course.course_type || "menu_rollout"}

SOURCE MATERIAL:
${material.text}

Describe 3 depth tiers for this training course:
- quick (1-3 sections): fast briefing, key highlights only
- standard (3-6 sections): well-rounded staff training
- deep (5-9 sections): comprehensive deep-dive with advanced topics

For each tier, provide:
1. section_count: recommended number of sections within the range
2. summary: one sentence describing what this tier covers
3. topics: array of short section topic names

Be specific to the actual source material — reference real item names.`;

    // 7. Call Claude
    console.log("[build-course] depth_preview: calling Claude...");
    const aiResponse = await callClaudeWithTimeout({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      schema: DEPTH_PREVIEW_SCHEMA,
      schemaName: "depth_preview",
      maxTokens: MAX_TOKENS_DEPTH_PREVIEW,
      temperature: 0.4,
    });

    // 8. Parse response
    const parsed = parseDepthPreviewResponse(aiResponse);
    if (!parsed) {
      return errorResponse("ai_error", "Failed to parse depth_preview response", 500);
    }

    console.log(`[build-course] depth_preview: quick=${parsed.quick.section_count}, standard=${parsed.standard.section_count}, deep=${parsed.deep.section_count}`);

    // 9. Return (stateless — no DB write, no credits)
    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof ClaudeError) return errorResponse("ai_error", err.message, err.status);
    if (err instanceof UsageError) return errorResponse("server_error", err.message, 500);
    throw err;
  }
}

// =============================================================================
// STEP: CONTENT WRITE — Pass 2 (per-section prose with search augmentation)
// =============================================================================

async function handleContentWrite(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id || !body.section_id) {
    return errorResponse("bad_request", "course_id and section_id are required for content_write step", 400);
  }

  try {
    // ── 1. Load course ─────────────────────────────────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, title_en, course_type, teacher_level, wizard_config, group_id")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (courseErr || !course) return errorResponse("not_found", "Course not found", 404);

    // ── 2. Load section ────────────────────────────────────────────────
    const { data: section, error: secErr } = await supabase
      .from("course_sections")
      .select("id, title_en, title_es, draft_content, generation_status, sort_order")
      .eq("id", body.section_id)
      .eq("course_id", body.course_id)
      .single();

    if (secErr || !section) return errorResponse("not_found", "Section not found", 404);

    // ── 2b. Load sibling sections for course context ──────────────────
    const { data: allSections } = await supabase
      .from("course_sections")
      .select("id, title_en, sort_order")
      .eq("course_id", body.course_id)
      .order("sort_order");

    const siblingTitles = (allSections || [])
      .map((s: { id: string; title_en: string; sort_order: number }) =>
        `${s.sort_order + 1}. ${s.title_en}${s.id === body.section_id ? " ← (this section)" : ""}`
      )
      .join("\n");
    const totalSections = allSections?.length || 1;

    const draftContent = section.draft_content || {};
    if (!draftContent.brief_en) {
      return errorResponse("bad_request", "Section has no brief. Run structure_plan first.", 400);
    }

    // ── 3. Check credits ───────────────────────────────────────────────
    const creditCost = await getCreditCost(supabase, groupId, "course_builder", "content_write");
    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo) return errorResponse("forbidden", "Not a member of this group", 403);
    if (!usageInfo.can_ask) return errorResponse("limit_exceeded", "Usage limit reached", 429);

    // ── 4. Assemble source material (filtered by source_hints if available) ──
    const wizardConfig = course.wizard_config || {};
    const depthConfig = getDepthConfig(wizardConfig);
    let sourceSections = wizardConfig.source_sections || [];
    let sourceProducts = wizardConfig.source_products || [];

    // Filter source material using source_hints from Pass 1
    const sourceHints: string[] = draftContent.source_hints || [];
    if (sourceHints.length > 0) {
      const hintTables = new Map<string, string[]>();
      for (const hint of sourceHints) {
        const [table, id] = hint.split(":");
        if (table && id) {
          const existing = hintTables.get(table) || [];
          existing.push(id);
          hintTables.set(table, existing);
        }
      }

      // Filter manual sections
      const manualHintIds = hintTables.get("manual_sections");
      if (manualHintIds) {
        sourceSections = sourceSections.filter((id: string) => manualHintIds.includes(id));
      }

      // Filter products — rebuild sourceProducts array with only hinted IDs
      if (sourceProducts.length > 0) {
        const filteredProducts: Array<{ table: string; ids: string[] }> = [];
        for (const group of sourceProducts) {
          const hintIds = hintTables.get(group.table);
          if (hintIds) {
            const filtered = group.ids.filter((id: string) => hintIds.includes(id));
            if (filtered.length > 0) {
              filteredProducts.push({ table: group.table, ids: filtered });
            }
          }
        }
        if (filteredProducts.length > 0) {
          sourceProducts = filteredProducts;
        }
        // If no hints matched any products, fall back to full source
      }
    }

    const material = await assembleSourceMaterial(sourceSections, sourceProducts, supabase, language);

    console.log(`[build-course] content_write: section "${section.title_en}" — ${material.tokenEstimate} tokens source`);

    // ── 5. Search augmentation (based on course_type) ──────────────────
    const relatedParts: string[] = [];

    if (course.course_type === "menu_rollout") {
      try {
        // Embed the brief for semantic search
        const searchQuery = draftContent.brief_en;
        const queryEmbedding = await generateEmbedding(searchQuery);
        const embeddingJson = JSON.stringify(queryEmbedding);

        // Build search promises conditionally based on depth tier
        // deno-lint-ignore no-explicit-any
        const searchPromises: Array<{ label: string; promise: Promise<any> }> = [];

        if (!depthConfig.skipBeverageSearch) {
          searchPromises.push({
            label: "wines",
            promise: supabase.rpc("search_wines", {
              search_query: searchQuery,
              query_embedding: embeddingJson,
              result_limit: 3,
            }),
          });
          searchPromises.push({
            label: "cocktails",
            promise: supabase.rpc("search_cocktails", {
              search_query: searchQuery,
              query_embedding: embeddingJson,
              result_limit: 3,
            }),
          });
          searchPromises.push({
            label: "beer_liquor",
            promise: supabase.rpc("search_beer_liquor", {
              search_query: searchQuery,
              query_embedding: embeddingJson,
              result_limit: 3,
            }),
          });
        }

        if (!depthConfig.skipStepsSearch) {
          searchPromises.push({
            label: "steps_of_service",
            promise: supabase.rpc("search_steps_of_service", {
              search_query: searchQuery,
              query_embedding: embeddingJson,
              p_group_id: groupId,
              p_position: "server",
              search_language: language,
              result_limit: 5,
            }),
          });
        }

        searchPromises.push({
          label: "dishes",
          promise: supabase.rpc("search_dishes", {
            search_query: searchQuery,
            query_embedding: embeddingJson,
            result_limit: 3,
          }),
        });

        const settledResults = await Promise.allSettled(
          searchPromises.map((sp) => sp.promise),
        );

        // Collect results from settled promises (Supabase thenables always fulfill,
        // so also check .value.error for RPC failures)
        // deno-lint-ignore no-explicit-any
        const extractData = (result: PromiseSettledResult<any>, label: string) => {
          if (result.status === "rejected") {
            console.warn(`[build-course] search_augment ${label}: rejected:`, result.reason);
            return null;
          }
          if (result.value?.error) {
            console.warn(`[build-course] search_augment ${label}: RPC error:`, result.value.error.message);
            return null;
          }
          return result.value?.data || null;
        };

        // deno-lint-ignore no-explicit-any
        const searchResults = new Map<string, any[]>();
        for (let i = 0; i < searchPromises.length; i++) {
          const data = extractData(settledResults[i], searchPromises[i].label);
          if (data && data.length > 0) {
            searchResults.set(searchPromises[i].label, data);
          }
        }

        const wines = searchResults.get("wines");
        const cocktails = searchResults.get("cocktails");
        const beerLiquor = searchResults.get("beer_liquor");
        const steps = searchResults.get("steps_of_service");
        const dishes = searchResults.get("dishes");

        if (wines && wines.length > 0) {
          relatedParts.push("=== Wine Pairings ===");
          for (const w of wines) relatedParts.push(`- ${w.name}: ${w.snippet || ""}`);
        }
        if (cocktails && cocktails.length > 0) {
          relatedParts.push("=== Cocktail Pairings ===");
          for (const c of cocktails) relatedParts.push(`- ${c.name}: ${c.snippet || ""}`);
        }
        if (beerLiquor && beerLiquor.length > 0) {
          relatedParts.push("=== Beer & Liquor Pairings ===");
          for (const b of beerLiquor) relatedParts.push(`- ${b.name}: ${b.snippet || ""}`);
        }
        if (steps && steps.length > 0) {
          relatedParts.push("=== Steps of Service ===");
          for (const s of steps) relatedParts.push(`- ${s.title}: ${s.snippet || ""}`);
        }
        if (dishes && dishes.length > 0) {
          relatedParts.push("=== Similar Existing Dishes ===");
          for (const d of dishes) relatedParts.push(`- ${d.name}: ${d.snippet || ""}`);
        }
      } catch (searchErr) {
        // Search augmentation is best-effort — don't fail the whole call
        console.warn("[build-course] content_write: search augmentation error:", searchErr);
      }
    }

    // ── 6. Fetch system prompt ─────────────────────────────────────────
    const systemPrompt = await fetchPromptBySlug(supabase, "course-content-writer", language) ||
      "You are an expert hospitality training content writer. Write clear, engaging English training material.";

    // ── 7. Build user message ──────────────────────────────────────────
    const targetWords = draftContent.target_words as number | undefined;
    const wordTarget = targetWords ?? depthConfig.wordCountRange;

    const userMessage = [
      `COURSE CONTEXT:`,
      `- Course: "${course.title_en}"`,
      `- This is section ${(section.sort_order || 0) + 1} of ${totalSections}`,
      `- All sections:`,
      siblingTitles,
      ``,
      `SECTION: "${section.title_en}"`,
      `TEACHER LEVEL: ${course.teacher_level || "professional"}`,
      `COURSE TYPE: ${course.course_type || "custom"}`,
      ``,
      `DEPTH CONSTRAINTS:`,
      `- Tier: ${depthConfig.tier}`,
      `- Target word count: ${typeof wordTarget === "number" ? `~${wordTarget} words` : `${wordTarget} words`}`,
      `- Content style: ${
        depthConfig.contentStyle === "bullet_points"
          ? "Bullet points and key facts ONLY. No flowing prose. Be terse and scannable."
          : depthConfig.contentStyle === "comprehensive"
          ? "Comprehensive coverage with scenarios, dialogue, and sensory descriptions."
          : "Teaching prose. Clear, engaging paragraphs with specific details."
      }`,
      depthConfig.notes ? `- Admin notes: "${depthConfig.notes}"` : "",
      typeof wordTarget === "number"
        ? `- IMPORTANT: Your output for content_en MUST be approximately ${wordTarget} words. Do NOT exceed ${Math.round(wordTarget * 1.3)} words.`
        : "",
      ``,
      `WRITING BRIEF:`,
      draftContent.brief_en,
      ``,
      `SOURCE MATERIAL:`,
      material.text || "(no source material)",
      relatedParts.length > 0 ? `\nRELATED CONTEXT (supplementary — use if relevant):\n${relatedParts.join("\n")}` : "",
      ``,
      depthConfig.tier === "quick"
        ? `Write CONCISE training content — bullet points and key facts only. Target exactly ${wordTarget || "50-150"} words. Return JSON matching the schema.`
        : "Write training content in English for this section, respecting the word target above. Return JSON matching the schema.",
    ].join("\n");

    // ── 8. Call Claude ─────────────────────────────────────────────────
    console.log(`[build-course] content_write: section "${section.title_en}" — calling Claude...`);

    const aiResponse = await callClaudeWithTimeout({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      schema: CONTENT_WRITE_SCHEMA,
      schemaName: "content_write",
      maxTokens: getMaxTokensForPass("content_write", depthConfig.tier),
      temperature: 0.5,
    });

    // ── 9. Parse response ──────────────────────────────────────────────
    const parsed = parseContentWriteResponse(aiResponse);
    if (!parsed) {
      console.error("[build-course] content_write: raw AI response for section", body.section_id, ":",
        JSON.stringify(aiResponse)?.substring(0, 1000));
      await supabase.from("course_sections").update({ generation_status: "prose_error" }).eq("id", body.section_id);
      return errorResponse("ai_error", "Failed to parse content_write response", 500);
    }

    // ── 10. Save to section (JSONB merge — preserve brief) ──────────────
    const updatedDraftContent = {
      ...draftContent,  // preserves brief_en, source_hints, AND element_blueprint (Pass 3 reads it)
      content_en: parsed.content_en,
      content_es: "",
      teaching_notes: parsed.teaching_notes,
    };

    const { error: saveErr } = await supabase
      .from("course_sections")
      .update({
        draft_content: updatedDraftContent,
        generation_status: "prose_ready",
      })
      .eq("id", body.section_id);

    if (saveErr) {
      console.error("[build-course] content_write: save error:", saveErr.message);
      return errorResponse("db_error", "Failed to save content", 500);
    }

    // ── 11. Track credits ──────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, creditCost, {
      domain: "course_builder",
      action: "content_write",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
      tokens_input: material.tokenEstimate,
      tokens_output: estimateTokens(JSON.stringify(aiResponse)),
      metadata: { section_id: body.section_id },
    });

    console.log(`[build-course] content_write complete: section "${section.title_en}"`);

    // ── 12. Return ─────────────────────────────────────────────────────
    return jsonResponse({
      section_id: body.section_id,
      content_en: parsed.content_en,
      content_es: "",
      teaching_notes: parsed.teaching_notes,
    });
  } catch (err) {
    // Persist prose_error on AI/usage failures so Pass 3 and retries can check DB status
    if (body.section_id) {
      await supabase.from("course_sections").update({ generation_status: "prose_error" }).eq("id", body.section_id);
    }
    if (err instanceof ClaudeError) return errorResponse("ai_error", err.message, err.status);
    if (err instanceof UsageError) return errorResponse("server_error", err.message, 500);
    throw err;
  }
}

// =============================================================================
// STEP: PASS 3 — Layout Architect (reads prose, decides elements, fills content)
// =============================================================================

async function handlePass3(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  const language = body.language || "en";

  if (!body.course_id || !body.section_id) {
    return errorResponse("bad_request", "course_id and section_id are required for pass3 step", 400);
  }

  try {
    // ── 1. Load course (include page_header_data for section 0) ─────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, teacher_level, course_type, group_id, page_header_data, wizard_config")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (courseErr || !course) return errorResponse("not_found", "Course not found", 404);

    const wizardConfig = (course.wizard_config || {}) as Record<string, unknown>;
    const depthConfig = getDepthConfig(wizardConfig);

    // ── 2. Load section ────────────────────────────────────────────────
    const { data: section, error: secErr } = await supabase
      .from("course_sections")
      .select("id, title_en, title_es, draft_content, generation_status, sort_order")
      .eq("id", body.section_id)
      .eq("course_id", body.course_id)
      .single();

    if (secErr || !section) return errorResponse("not_found", "Section not found", 404);

    if (!section.draft_content || !section.draft_content.content_en) {
      return errorResponse("bad_request", "Section has no draft_content prose. Run content_write first.", 400);
    }

    if (section.generation_status === "prose_error") {
      return errorResponse("bad_request", "Section has prose_error status. Fix content before layout.", 400);
    }

    // ── 3. Check credits ───────────────────────────────────────────────
    const creditCost = await getCreditCost(supabase, groupId, "course_builder", "pass2_section");
    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo) return errorResponse("forbidden", "Not a member of this group", 403);
    if (!usageInfo.can_ask) return errorResponse("limit_exceeded", "Usage limit reached", 429);

    // ── 4. Fetch system prompt (try new formatter first, fall back to old) ──
    const systemPrompt = await fetchPromptBySlug(supabase, "course-pass3-formatter", language) ||
      await fetchPromptBySlug(supabase, "course-pass2-layout-architect", language) ||
      "You are a content formatter for restaurant training courses.";

    // ── 5. Build user message — blueprint-driven or legacy ─────────────
    const prose = section.draft_content;
    const blueprint = prose.element_blueprint as ElementBlueprint[] | undefined;

    let blueprintBlock = "";
    if (blueprint && blueprint.length > 0) {
      blueprintBlock = `
ELEMENT BLUEPRINT (follow EXACTLY — do not add, remove, or reorder):
${blueprint.map((bp: ElementBlueprint, i: number) => `  ${i + 1}. ${bp.type}${bp.variant ? ` (variant: ${bp.variant})` : ""}`).join("\n")}

You MUST produce exactly ${blueprint.length} elements in this order.
Fill each slot with content from the prose below.
Do NOT add extra elements. Do NOT skip elements. Do NOT reorder.
The content element is the MAIN body — put the bulk of information there using rich markdown.`;
      console.log(`[build-course] pass3: blueprint has ${blueprint.length} elements: ${blueprint.map(b => b.type).join(", ")}`);
    } else {
      // Backward compat: no blueprint, use old depth constraints
      blueprintBlock = `
DEPTH CONSTRAINTS:
- Tier: ${depthConfig.tier}
- Target elements per section: ${depthConfig.elementCountRange}
- ${depthConfig.elementDensityNote}`;
      console.log(`[build-course] pass3: no blueprint, using legacy depth constraints`);
    }

    const userMessage = `SECTION: "${section.title_en}"
TEACHER LEVEL: ${course.teacher_level || "professional"}
COURSE TYPE: ${course.course_type || "custom"}
${blueprintBlock}

SECTION PROSE (English):
${prose.content_en || ""}

TEACHING NOTES:
${prose.teaching_notes || "None"}

${blueprint ? "Fill the blueprint slots with content from the prose above." : "Design the visual layout for this section using structured elements."} All content should be in English only. Do NOT include a page_header element. Return JSON matching the schema.`;

    // ── 6. Call Claude ─────────────────────────────────────────────────
    console.log(`[build-course] pass3: section "${section.title_en}" — calling Claude...`);

    // deno-lint-ignore no-explicit-any
    let aiResponse: any = await callClaudeWithTimeout({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      schema: PASS2_SECTION_SCHEMA,
      schemaName: "pass2_layout_architect",
      maxTokens: getMaxTokensForPass("layout", depthConfig.tier),
      temperature: TEMPERATURE_CONTENT,
    });

    // ── 6b. Blueprint compliance check (before parsing strips elements) ──
    if (blueprint && blueprint.length > 0 && Array.isArray(aiResponse?.elements)) {
      const compliance = validateBlueprintCompliance(
        aiResponse.elements as Array<{ type?: string; [key: string]: unknown }>,
        blueprint,
      );
      if (compliance.severity === "fail") {
        console.warn(`[build-course] pass3: blueprint compliance FAIL for "${section.title_en}": ${compliance.issues.join("; ")}`);
        // One server-side retry with correction note
        try {
          const correctionMessage = `Your previous output had these issues: ${compliance.issues.join("; ")}. Please try again following the ELEMENT BLUEPRINT EXACTLY.`;
          aiResponse = await callClaudeWithTimeout({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
              { role: "assistant", content: JSON.stringify(aiResponse) },
              { role: "user", content: correctionMessage },
            ],
            schema: PASS2_SECTION_SCHEMA,
            schemaName: "pass2_layout_architect",
            maxTokens: getMaxTokensForPass("layout", depthConfig.tier),
            temperature: TEMPERATURE_CONTENT,
          });
          console.log(`[build-course] pass3: retry completed for "${section.title_en}"`);
        } catch (retryErr) {
          console.warn(`[build-course] pass3: retry failed for "${section.title_en}", proceeding with first attempt:`, retryErr);
        }
      } else if (compliance.severity === "warn") {
        console.warn(`[build-course] pass3: blueprint compliance WARN for "${section.title_en}": ${compliance.issues.join("; ")}`);
      } else {
        console.log(`[build-course] pass3: blueprint compliance OK for "${section.title_en}"`);
      }
    }

    // ── 7. Parse and post-process ──────────────────────────────────────
    const parsed = parsePass2Response(aiResponse);
    if (!parsed) {
      console.error("[build-course] pass3: raw AI response for section", body.section_id, ":",
        JSON.stringify(aiResponse)?.substring(0, 1000));
      return errorResponse("ai_error", "Failed to parse pass3 layout response", 500);
    }

    // Defense-in-depth: strip any AI-generated page_header elements
    parsed.elements = parsed.elements.filter(el => el.type !== "page_header");

    if (parsed.elements.length === 0) {
      return errorResponse("ai_error", "AI returned no valid layout elements after filtering", 500);
    }

    // Deterministic page_header prepend for section 0
    // deno-lint-ignore no-explicit-any
    let finalElements: Array<Record<string, any>> = [];

    if (section.sort_order === 0 && course.page_header_data) {
      const ph = course.page_header_data;
      finalElements.push({
        type: "page_header",
        key: "page-header-hero",
        title_en: ph.title_en || "",
        title_es: "",
        badge_en: ph.badge_en || "",
        badge_es: "",
        badge_icon: ph.badge_icon || "",
        tagline_en: ph.tagline_en || "",
        tagline_es: "",
        icon: ph.icon || "",
        icon_label_en: ph.icon_label_en || "",
        icon_label_es: "",
        status: "generated",
        sort_order: 0,
      });
    }

    // Stamp status and sort_order on AI-generated elements
    const startIdx = finalElements.length;
    let sectionHeaderCount = 0;
    for (let idx = 0; idx < parsed.elements.length; idx++) {
      const el = parsed.elements[idx];
      const stamped = { ...el, status: "generated", sort_order: startIdx + idx };

      if (el.type === "section_header") {
        sectionHeaderCount++;
        // Use sort_order + 1 as the section number (0-indexed to 1-indexed)
        const sectionNum = section.sort_order + 1;
        const titleParts = (el.title_en as string || "").split("|");
        const theme = titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : titleParts[0].trim();
        stamped.number_label = `${sectionNum} — ${theme}`;
      }

      finalElements.push(stamped);
    }

    const processedElements = finalElements;

    // ── 8. Save elements ───────────────────────────────────────────────
    const { error: saveErr } = await supabase
      .from("course_sections")
      .update({
        elements: processedElements,
        generation_status: "generated",
      })
      .eq("id", body.section_id);

    if (saveErr) {
      console.error("[build-course] pass3: save error:", saveErr.message);
      return errorResponse("db_error", "Failed to save elements", 500);
    }

    // ── 9. Track credits ───────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, creditCost, {
      domain: "course_builder",
      action: "pass2_section",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
      metadata: { section_id: body.section_id, elements_count: processedElements.length },
    });

    console.log(`[build-course] pass3 complete: section "${section.title_en}", ${processedElements.length} elements`);

    // ── 10. Return ─────────────────────────────────────────────────────
    return jsonResponse({
      section_id: body.section_id,
      elements: processedElements,
      elements_created: processedElements.length,
    });
  } catch (err) {
    if (err instanceof ClaudeError) return errorResponse("ai_error", err.message, err.status);
    if (err instanceof UsageError) return errorResponse("server_error", err.message, 500);
    throw err;
  }
}

// =============================================================================
// STEP: TRANSLATE — Pass 4 (per-section EN→ES translation)
// =============================================================================

async function handleTranslate(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  groupId: string,
  body: BuildCourseRequest,
): Promise<Response> {
  if (!body.course_id || !body.section_id) {
    return errorResponse("bad_request", "course_id and section_id are required for translate step", 400);
  }

  try {
    // ── 1. Load course ─────────────────────────────────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, group_id, page_header_data")
      .eq("id", body.course_id)
      .eq("group_id", groupId)
      .single();

    if (courseErr || !course) return errorResponse("not_found", "Course not found", 404);

    // ── 2. Load section ────────────────────────────────────────────────
    const { data: section, error: secErr } = await supabase
      .from("course_sections")
      .select("id, title_en, title_es, elements, draft_content, generation_status, sort_order")
      .eq("id", body.section_id)
      .eq("course_id", body.course_id)
      .single();

    if (secErr || !section) return errorResponse("not_found", "Section not found", 404);

    if (section.generation_status !== "generated") {
      return errorResponse("bad_request", `Section status is '${section.generation_status}', must be 'generated' for translation`, 400);
    }

    if (!section.elements || !Array.isArray(section.elements) || section.elements.length === 0) {
      return errorResponse("bad_request", "Section has no elements to translate", 400);
    }

    // ── 3. Check credits ───────────────────────────────────────────────
    const creditCost = await getCreditCost(supabase, groupId, "course_builder", "translate");
    const usageInfo = await checkUsage(supabase, userId, groupId);
    if (!usageInfo) return errorResponse("forbidden", "Not a member of this group", 403);
    if (!usageInfo.can_ask) return errorResponse("limit_exceeded", "Usage limit reached", 429);

    // ── 4. Build EN content summary for translation ────────────────────
    const elementSummary = section.elements
      .filter((el: Record<string, unknown>) => el.type !== "page_header")
      .map((el: Record<string, unknown>) => {
        const summary: Record<string, unknown> = { key: el.key, type: el.type };
        if (el.title_en) summary.title_en = el.title_en;
        if (el.body_en) summary.body_en = el.body_en;
        if (el.subtitle_en) summary.subtitle_en = el.subtitle_en;
        if (el.header_en) summary.header_en = el.header_en;
        if (el.caption_en) summary.caption_en = el.caption_en;
        if (Array.isArray(el.cards)) {
          summary.cards = (el.cards as Array<Record<string, unknown>>).map(c => ({
            title_en: c.title_en, body_en: c.body_en,
          }));
        }
        if (el.positive) {
          const p = el.positive as Record<string, unknown>;
          summary.positive = { tag_en: p.tag_en, title_en: p.title_en, items_en: p.items_en };
        }
        if (el.negative) {
          const n = el.negative as Record<string, unknown>;
          summary.negative = { tag_en: n.tag_en, title_en: n.title_en, items_en: n.items_en };
        }
        if (Array.isArray(el.pairs)) {
          summary.pairs = (el.pairs as Array<Record<string, unknown>>).map(p => ({
            tag_en: p.tag_en, items_en: p.items_en,
          }));
        }
        if (Array.isArray(el.lines)) {
          summary.lines = (el.lines as Array<Record<string, unknown>>).map(l => ({
            text_en: l.text_en,
          }));
        }
        return summary;
      });

    // ── 5. Fetch system prompt ─────────────────────────────────────────
    const systemPrompt = await fetchPromptBySlug(supabase, "course-translator", "en") ||
      "You are a professional Spanish translator for a restaurant training platform.";

    // ── 6. Build user message ──────────────────────────────────────────
    const draftContent = section.draft_content || {};
    const userMessage = [
      `SECTION TITLE: "${section.title_en}"`,
      "",
      `SECTION PROSE (English):`,
      draftContent.content_en || "(no prose)",
      "",
      `ELEMENTS TO TRANSLATE:`,
      JSON.stringify(elementSummary, null, 2),
      "",
      "Translate all English content to natural Latin American Spanish. Return JSON matching the schema.",
      "Each element in the response must have a 'key' matching the input element key.",
    ].join("\n");

    // ── 7. Call Claude ─────────────────────────────────────────────────
    console.log(`[build-course] translate: section "${section.title_en}" — calling Claude...`);

    const aiResponse = await callClaudeWithTimeout({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      schema: TRANSLATION_SCHEMA,
      schemaName: "section_translation",
      maxTokens: MAX_TOKENS_TRANSLATION,
      temperature: 0.3,
    });

    // ── 8. Parse response ──────────────────────────────────────────────
    const parsed = parseTranslationResponse(aiResponse);
    if (!parsed) {
      return errorResponse("ai_error", "Failed to parse translation response", 500);
    }

    // ── 9. Merge _es fields into existing elements ─────────────────────
    const translationMap = new Map(parsed.elements.map(el => [el.key, el]));
    // deno-lint-ignore no-explicit-any
    const mergedElements = section.elements.map((el: Record<string, any>) => {
      if (el.type === "page_header") return el; // handled separately
      const tr = translationMap.get(el.key);
      if (!tr) return el;

      const merged = { ...el };
      if (tr.title_es) merged.title_es = tr.title_es;
      if (tr.body_es) merged.body_es = tr.body_es;
      if (tr.subtitle_es) merged.subtitle_es = tr.subtitle_es;
      if (tr.header_es) merged.header_es = tr.header_es;
      if (tr.caption_es) merged.caption_es = tr.caption_es;

      // Merge card translations by index
      if (tr.cards && Array.isArray(merged.cards)) {
        for (let i = 0; i < Math.min(tr.cards.length, merged.cards.length); i++) {
          if (tr.cards[i].title_es) merged.cards[i].title_es = tr.cards[i].title_es;
          if (tr.cards[i].body_es) merged.cards[i].body_es = tr.cards[i].body_es;
        }
      }

      // Merge comparison translations
      if (tr.positive && merged.positive) {
        merged.positive = { ...merged.positive, ...tr.positive };
      }
      if (tr.negative && merged.negative) {
        merged.negative = { ...merged.negative, ...tr.negative };
      }

      // Merge pairs translations by index
      if (tr.pairs && Array.isArray(merged.pairs)) {
        for (let i = 0; i < Math.min(tr.pairs.length, merged.pairs.length); i++) {
          if (tr.pairs[i].tag_es) merged.pairs[i].tag_es = tr.pairs[i].tag_es;
          if (tr.pairs[i].items_es) merged.pairs[i].items_es = tr.pairs[i].items_es;
        }
      }

      // Merge lines translations by index
      if (tr.lines && Array.isArray(merged.lines)) {
        for (let i = 0; i < Math.min(tr.lines.length, merged.lines.length); i++) {
          if (tr.lines[i].text_es) merged.lines[i].text_es = tr.lines[i].text_es;
        }
      }

      return merged;
    });

    // ── 10. Save ───────────────────────────────────────────────────────
    const updatedDraftContent = {
      ...(section.draft_content || {}),
      content_es: parsed.content_es,
    };

    const { error: saveErr } = await supabase
      .from("course_sections")
      .update({
        title_es: parsed.title_es,
        elements: mergedElements,
        draft_content: updatedDraftContent,
        generation_status: "translated",
      })
      .eq("id", body.section_id);

    if (saveErr) {
      console.error("[build-course] translate: save error:", saveErr.message);
      return errorResponse("db_error", "Failed to save translation", 500);
    }

    // ── 11. Translate page_header if requested (first section) ─────────
    if (body.translate_page_header && section.sort_order === 0 && course.page_header_data) {
      try {
        const ph = course.page_header_data;
        const phMessage = [
          "Translate this course page header to Spanish:",
          JSON.stringify({
            badge_en: ph.badge_en,
            title_en: ph.title_en,
            tagline_en: ph.tagline_en,
            icon_label_en: ph.icon_label_en,
          }),
          "Return JSON matching the schema.",
        ].join("\n");

        const phResponse = await callClaudeWithTimeout({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: phMessage },
          ],
          schema: PAGE_HEADER_TRANSLATION_SCHEMA,
          schemaName: "page_header_translation",
          maxTokens: 512,
          temperature: 0.3,
        });

        if (phResponse && phResponse.title_es) {
          const updatedPageHeader = {
            ...ph,
            badge_es: phResponse.badge_es || "",
            title_es: phResponse.title_es,
            tagline_es: phResponse.tagline_es || "",
            icon_label_es: phResponse.icon_label_es || "",
          };

          await supabase.from("courses").update({ page_header_data: updatedPageHeader }).eq("id", body.course_id);

          // Also update the page_header element in section 0's elements
          const phElement = mergedElements.find((el: Record<string, unknown>) => el.type === "page_header");
          if (phElement) {
            phElement.title_es = phResponse.title_es;
            phElement.badge_es = phResponse.badge_es || "";
            phElement.tagline_es = phResponse.tagline_es || "";
            phElement.icon_label_es = phResponse.icon_label_es || "";

            await supabase.from("course_sections").update({ elements: mergedElements }).eq("id", body.section_id);
          }
        }
      } catch (phErr) {
        // Page header translation is non-fatal
        console.warn("[build-course] translate: page_header translation error (non-fatal):", phErr);
      }
    }

    // ── 12. Track credits ──────────────────────────────────────────────
    await trackAndIncrement(supabase, userId, groupId, creditCost, {
      domain: "course_builder",
      action: "translate",
      edge_function: "build-course",
      model: "claude-sonnet-4-6",
      metadata: { section_id: body.section_id },
    });

    console.log(`[build-course] translate complete: section "${section.title_en}"`);

    // ── 13. Return ─────────────────────────────────────────────────────
    return jsonResponse({
      section_id: body.section_id,
      title_es: parsed.title_es,
      content_es: parsed.content_es,
      elements: mergedElements,
      generation_status: "translated",
    });
  } catch (err) {
    if (err instanceof ClaudeError) return errorResponse("ai_error", err.message, err.status);
    if (err instanceof UsageError) return errorResponse("server_error", err.message, 500);
    throw err;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[build-course] Request received");

  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────
    const { userId, supabase } = await authenticateWithUser(req);
    console.log("[build-course] Authenticated user:", userId);

    // ── 2. Verify manager/admin role ─────────────────────────────────────
    const resolvedGroupId = await verifyManagerRole(supabase, userId);
    if (!resolvedGroupId) {
      return errorResponse(
        "forbidden",
        "Manager or admin role required",
        403,
      );
    }

    // ── 3. Parse request ─────────────────────────────────────────────────
    const body = (await req.json()) as BuildCourseRequest;
    // Always use the server-resolved groupId — never trust body.groupId
    const groupId = resolvedGroupId;

    if (!body.step) {
      return errorResponse("bad_request", "step is required (outline | content | chat_edit | full_content | assemble | pass1 | pass2 | structure_plan | content_write | pass3 | translate | depth_preview)", 400);
    }

    console.log(`[build-course] Step: ${body.step} | Group: ${groupId}`);

    // ── 4. Route to step handler ─────────────────────────────────────────
    switch (body.step) {
      case "outline":
        return await handleOutline(supabase, userId, groupId, body);
      case "content":
        return await handleContent(supabase, userId, groupId, body);
      case "chat_edit":
        return await handleChatEdit(supabase, userId, groupId, body);
      case "full_content":
        return await handleFullContent(supabase, userId, groupId, body);
      case "assemble":
        return await handleAssemble(supabase, userId, groupId, body);
      case "pass1":
        return await handlePass1(supabase, userId, groupId, body);
      case "pass2":
        return await handlePass2(supabase, userId, groupId, body);
      case "structure_plan":
        return await handleStructurePlan(supabase, userId, groupId, body);
      case "content_write":
        return await handleContentWrite(supabase, userId, groupId, body);
      case "pass3":
        return await handlePass3(supabase, userId, groupId, body);
      case "translate":
        return await handleTranslate(supabase, userId, groupId, body);
      case "depth_preview":
        return await handleDepthPreview(supabase, userId, groupId, body);
      default:
        return errorResponse(
          "bad_request",
          `Invalid step: ${body.step}. Must be outline, content, chat_edit, full_content, assemble, pass1, pass2, structure_plan, content_write, pass3, translate, or depth_preview`,
          400,
        );
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse("unauthorized", err.message, 401);
    }
    if (err instanceof UsageError) {
      return errorResponse("server_error", err.message, 500);
    }
    if (err instanceof ClaudeError) {
      return errorResponse("ai_error", err.message, err.status);
    }
    console.error("[build-course] Unexpected error:", err);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
