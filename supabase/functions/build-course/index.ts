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
import { callOpenAI, OpenAIError } from "../_shared/openai.ts";
import { fetchPromptBySlug } from "../_shared/prompt-helpers.ts";
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";
import { checkUsage, UsageError } from "../_shared/usage.ts";
import {
  assembleSourceMaterial,
  fetchElementSourceMaterial,
  serializeElementForAI,
  parseAIOutlineResponse,
  parseAIElementResponse,
  parseAIChatEditResponse,
  computeContentHash,
  estimateTokens,
  getMaxTokensForElement,
  MAX_TOKENS_OUTLINE,
  MAX_TOKENS_CHAT_EDIT,
  TEMPERATURE_OUTLINE,
  TEMPERATURE_CONTENT,
  type SourceProduct,
  type SourceRef,
} from "../_shared/course-builder.ts";

// =============================================================================
// TYPES
// =============================================================================

interface BuildCourseRequest {
  step: "outline" | "content" | "chat_edit";
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

  // For content + chat_edit steps
  course_id?: string;

  // For chat_edit step
  section_id?: string;
  instruction?: string;
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
                  enum: ["content", "feature", "media"],
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
You have exactly 3 element types. Understand what each one DOES to a learner:
  content  — The workhorse. Rich markdown (##, ###, bullets, numbered lists, tables, **bold**).
             Use for explanations, procedures, comparisons, narratives, scenarios.
  feature  — A visual interruption that forces the eye to stop. 6 tonal variants:
             tip: Practical shortcut or guest-facing talking point. Tone: helpful, insider.
             best_practice: The "right way" distilled. Tone: authoritative, proven.
             caution: Something that goes wrong often. Tone: experienced, preventive.
             warning: Hard stop — allergens, safety, legal. Tone: urgent, non-negotiable.
             did_you_know: Surprising fact that reframes understanding. Tone: curious, memorable.
             key_point: The one thing to remember from this section. Tone: crystallized, definitive.
             A feature is NOT a summary paragraph in a colored box — it is a SIGNAL.
  media    — A visual anchor. 3 sources:
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
  - No two content elements back-to-back without a feature or media between them
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
    // Rollout-specific prompt: generates exactly 1 intro section
    promptTemplate = await fetchPromptBySlug(
      supabase,
      "course-outline-rollout",
      language,
    );

    if (!promptTemplate) {
      promptTemplate = `You are a hospitality training director designing a menu rollout course for Alamo Prime, a premium steakhouse in Miami. Your audience is FOH staff — servers, bartenders, hosts — ages 21-35, bilingual, energetic, tips-motivated.

TASK: Generate EXACTLY ONE introductory section for a menu rollout course.
Product detail sections are added separately — do NOT create product-specific sections or a summary/outro section.

THE INTRO SECTION MUST COVER:
1. Rollout overview — what is being rolled out and WHY (make it exciting, not procedural)
2. Timing and availability — when it starts, how long, lunch/dinner/all day
3. Service instructions — how to present to guests, what to say tableside
4. Key talking points — exact language to describe and recommend
5. Operational details servers MUST know

${OUTLINE_REASONING_FRAMEWORK}

OUTPUT RULES:
- Generate exactly 1 section titled with the rollout name (make it engaging, not "Introduction to...")
- Include 4-8 elements with varied types and rhythm
- End with a key_point element — the one testable takeaway
- Generate bilingual titles (title_en + title_es)
- Assign unique, descriptive keys (e.g., "hook-surprise-rollout", "tip-upsell-pairing", "warn-allergen-dairy")
- Set sort_order sequentially (0, 1, 2...)
- Include source_refs with correct hashes for each element
- Set variant for feature elements; set media_type/image_source/product_image_ref for media elements
- Set unused fields to null
- You MUST return valid JSON matching the schema.`;
    }
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

${OUTLINE_REASONING_FRAMEWORK}

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

  const aiResponse = await callOpenAI<{ sections: unknown[] }>({
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
      // Take only the first section (AI should generate exactly 1 intro)
      const introSection = outline.sections[0];

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

      // Simple: intro + products. No outro.
      outline.sections = [introSection, ...productSections];

      console.log(
        `[build-course] Rollout: 1 intro + ${allProducts.length} product_viewer sections (no outro)`,
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

  // ── 8. Create sections with elements JSONB ─────────────────────────────
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
      status: el.type === "product_viewer" ? "reviewed" : "outline",
      ...(el.type === "product_viewer" ? {} : { body_en: null, body_es: null }),
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
    model: "gpt-5.2",
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

  // ── 2. Update course status to 'generating' ───────────────────────────
  await supabase
    .from("courses")
    .update({ status: "generating" })
    .eq("id", body.course_id);

  // ── 3. Fetch the element-builder prompt ────────────────────────────────
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
  };

  // ── 4. Process each section ────────────────────────────────────────────
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

      try {
        // Fetch relevant source material for this element
        const sourceText = await fetchElementSourceMaterial(
          el.source_refs || [],
          supabase,
          language,
        );

        // Build element-specific prompt with variant injection and section context
        const isFeature = el.type === "feature";
        const isMedia = el.type === "media";
        const teacherLevel = course.teacher_level || "professional";

        // Build system prompt: base + variant-specific addition for features
        let systemPrompt: string;
        if (isFeature) {
          const variantAddition = FEATURE_VARIANT_PROMPTS[el.variant] || "";
          systemPrompt = variantAddition
            ? `${featurePrompt}\n\n${variantAddition}`
            : featurePrompt;
        } else if (isMedia) {
          systemPrompt = `You are writing a caption and alt-text description for an image in an Alamo Prime training course. The image is a visual anchor that supports the surrounding educational content.

RULES:
- body_en: Write a 1-2 sentence descriptive caption that explains what the image shows and why it matters for staff training. Be specific — reference product names, plating details, or techniques from the source material.
- body_es: Natural Spanish translation of the caption.
- Keep it concise but informative. This appears below the image as context.
- You MUST return valid JSON matching the schema.`;
        } else {
          systemPrompt = contentPrompt;
        }

        // Section context: position + previous element summary
        const sectionIdx = sections.findIndex((s: { id: string }) => s.id === section.id);
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
          isFeature && el.variant ? `VARIANT: ${el.variant}` : null,
          `TEACHER LEVEL: ${teacherLevel}`,
          el.ai_instructions
            ? `INSTRUCTIONS: ${el.ai_instructions}`
            : null,
          sourceText
            ? `\nSOURCE MATERIAL:\n${sourceText}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

        const schema = isFeature
          ? ELEMENT_FEATURE_SCHEMA
          : ELEMENT_CONTENT_SCHEMA;
        const schemaName = isFeature
          ? "feature_element"
          : "content_element";
        const maxTokens = getMaxTokensForElement(el.type);

        console.log(
          `[build-course] Content: generating ${el.type} "${el.key}" (${maxTokens} max tokens)`,
        );

        const aiResult = await callOpenAI({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          schema,
          schemaName,
          temperature: TEMPERATURE_CONTENT,
          maxTokens,
        });

        const parsed = parseAIElementResponse(aiResult);
        if (!parsed) {
          failedElements.push(`${section.title_en}/${el.key}: invalid AI response`);
          elements[i] = { ...el, status: "error", error: "Invalid AI response" };
          sectionModified = true;
          continue;
        }

        // Update element with generated content
        // Media elements use caption_en/caption_es, not body_en/body_es
        const contentFields = isMedia
          ? { caption_en: parsed.body_en, caption_es: parsed.body_es }
          : { body_en: parsed.body_en, body_es: parsed.body_es };

        elements[i] = {
          ...el,
          ...contentFields,
          status: "generated",
          ...(parsed.variant ? { variant: parsed.variant } : {}),
        };
        sectionModified = true;
        totalCompletedElements++;
      } catch (err) {
        const errorMsg =
          err instanceof OpenAIError ? err.message : "Unexpected error";
        console.error(
          `[build-course] Content: failed for ${el.key}:`,
          err,
        );
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
        model: "gpt-5.2",
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
    const aiResult = await callOpenAI({
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
      model: "gpt-5.2",
    });

    return jsonResponse({
      section_id: body.section_id,
      modifications: parsed.modified_elements.length,
      elements,
    });
  } catch (err) {
    if (err instanceof OpenAIError) {
      return errorResponse("ai_error", err.message, err.status);
    }
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
      return errorResponse("bad_request", "step is required (outline | content | chat_edit)", 400);
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
      default:
        return errorResponse(
          "bad_request",
          `Invalid step: ${body.step}. Must be outline, content, or chat_edit`,
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
    if (err instanceof OpenAIError) {
      return errorResponse("ai_error", err.message, err.status);
    }
    console.error("[build-course] Unexpected error:", err);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
