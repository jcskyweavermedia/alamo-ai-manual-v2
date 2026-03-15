/**
 * Course Quiz Generate Edge Function (Rewritten for Phase 5)
 *
 * Generates a pool of bilingual MC quiz questions from course section content
 * using AI, persists them to quiz_questions, and creates a quiz_attempt.
 *
 * Three modes:
 *   - section_quiz      — generates questions for a SINGLE section
 *   - course_quiz       — generates questions across ALL sections (course-level assessment)
 *   - generate_pool_only — admin builder mode: generates + persists questions WITHOUT
 *                          creating a quiz attempt or requiring enrollment
 *
 * Content is assembled from course_sections.elements JSONB (new architecture).
 * Quiz configuration is read from courses.quiz_config JSONB.
 *
 * Auth: verify_jwt=false — manual JWT verification via authenticateWithUser()
 * Deploy: npx supabase functions deploy course-quiz-generate --no-verify-jwt
 */

import { getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithUser, AuthError } from "../_shared/auth.ts";
import { callOpenAI, OpenAIError } from "../_shared/openai.ts";
import { fetchPromptBySlug } from "../_shared/prompt-helpers.ts";
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";
import { checkUsage, UsageError } from "../_shared/usage.ts";
// estimateTokens available from course-builder.ts if needed for future use

// =============================================================================
// TYPES
// =============================================================================

interface QuizConfig {
  quiz_mode: string;
  question_count: number;
  question_pool_size: number;
  passing_score: number;
  max_attempts: number | null;
  cooldown_minutes: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_feedback_immediately: boolean;
}

interface CourseElement {
  type: string;
  key: string;
  title_en?: string;
  title_es?: string;
  body_en?: string;
  body_es?: string;
  caption_en?: string;
  caption_es?: string;
  variant?: string;
  products?: Array<{ name_en?: string; name_es?: string }>;
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
}

interface GeneratedQuestion {
  question_en: string;
  question_es: string;
  explanation_en: string;
  explanation_es: string;
  options: Array<{
    id: string;
    text_en: string;
    text_es: string;
    correct: boolean;
  }>;
  difficulty: "easy" | "medium" | "hard";
  source_element_key: string | null;
}

// Default quiz config if courses.quiz_config is null/incomplete
const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  quiz_mode: "multiple_choice",
  question_count: 10,
  question_pool_size: 15,
  passing_score: 70,
  max_attempts: null,
  cooldown_minutes: 0,
  shuffle_questions: true,
  shuffle_options: true,
  show_feedback_immediately: true,
};

// =============================================================================
// HELPERS
// =============================================================================

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Count words in a string.
 */
function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Extract readable text from a course section's elements JSONB.
 * Concatenates body_en/body_es (or caption) from content/feature/media elements.
 */
function extractTextFromElements(
  elements: CourseElement[],
  language: "en" | "es",
  sectionTitle?: string,
): string {
  const parts: string[] = [];

  if (sectionTitle) {
    parts.push(`=== Section: ${sectionTitle} ===`);
  }

  for (const el of elements) {
    const isEs = language === "es";
    const title =
      isEs && el.title_es ? el.title_es : el.title_en || "";

    switch (el.type) {
      case "content":
      case "feature": {
        const body = isEs && el.body_es ? el.body_es : el.body_en || "";
        if (body) {
          parts.push(title ? `--- ${title} ---\n${body}` : body);
        }
        break;
      }
      case "media": {
        const caption =
          isEs && el.caption_es ? el.caption_es : el.caption_en || "";
        if (caption) {
          parts.push(`[Image: ${title}] ${caption}`);
        }
        break;
      }
      case "product_viewer": {
        // Include product names only
        if (el.products && Array.isArray(el.products)) {
          const names = el.products
            .map((p) => (isEs && p.name_es ? p.name_es : p.name_en || ""))
            .filter(Boolean)
            .join(", ");
          if (names) {
            parts.push(`[Products: ${names}]`);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return parts.join("\n\n");
}

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
// OPENAI STRUCTURED OUTPUT SCHEMA
// =============================================================================

const quizGenerationSchema = {
  type: "object" as const,
  properties: {
    questions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          question_en: { type: "string" as const },
          question_es: { type: "string" as const },
          explanation_en: { type: "string" as const },
          explanation_es: { type: "string" as const },
          options: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                id: { type: "string" as const },
                text_en: { type: "string" as const },
                text_es: { type: "string" as const },
                correct: { type: "boolean" as const },
              },
              required: ["id", "text_en", "text_es", "correct"],
              additionalProperties: false,
            },
          },
          difficulty: {
            type: "string" as const,
            enum: ["easy", "medium", "hard"],
          },
          source_element_key: {
            type: ["string", "null"] as unknown as "string",
          },
        },
        required: [
          "question_en",
          "question_es",
          "explanation_en",
          "explanation_es",
          "options",
          "difficulty",
          "source_element_key",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

// =============================================================================
// FALLBACK PROMPT (used when ai_prompts.slug = 'quiz-pool-generator' not found)
// =============================================================================

const FALLBACK_QUIZ_PROMPT = `You are a bilingual quiz question generator for Alamo Prime, a premium steakhouse training program.

TASK: Generate multiple-choice quiz questions based ONLY on the provided source material.

RULES:
1. Each question must have exactly 4 options with exactly 1 correct answer.
2. Generate BOTH English (question_en, explanation_en) and Spanish (question_es, explanation_es) versions. Spanish should be natural hospitality Spanish — not a literal translation.
3. Distribute difficulty levels: approximately 30% easy, 50% medium, 20% hard.
4. Include a clear explanation for the correct answer (2-3 sentences) that references specific facts from the source material.
5. Questions should test UNDERSTANDING and APPLICATION — not memorization of trivial details.
6. Reference specific facts, procedures, ingredients, or service standards from the source material.
7. Each option ID should be a short unique string (e.g., "a", "b", "c", "d").
8. For source_element_key: include the key of the element that the question primarily tests. Use null if the question draws from multiple elements.
9. Avoid "all of the above" or "none of the above" options.
10. Make wrong answers plausible — they should be common misconceptions or reasonable-sounding alternatives.

OUTPUT: Return valid JSON matching the provided schema.`;

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  console.log("[quiz-generate] Request received");

  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────
    const { userId, supabase } = await authenticateWithUser(req);
    console.log("[quiz-generate] User:", userId);

    // ── 2. Verify manager/admin role ─────────────────────────────────────
    const resolvedGroupId = await verifyManagerRole(supabase, userId);
    if (!resolvedGroupId) {
      return errorResponse("forbidden", "Manager or admin role required", 403, cors);
    }
    const groupId = resolvedGroupId;

    // ── 3. Parse request ─────────────────────────────────────────────────
    const body = await req.json();
    const {
      section_id,
      course_id,
      mode = "section_quiz",
      language = "en",
      force_regenerate = false,
    } = body;

    if (mode === "generate_pool_only") {
      if (!course_id) {
        return errorResponse("bad_request", "course_id is required for generate_pool_only mode", 400, cors);
      }
      return await handleGeneratePoolOnly(
        supabase, userId, course_id, language as "en" | "es", groupId, force_regenerate, cors,
      );
    }

    if (mode === "course_quiz") {
      if (!course_id) {
        return errorResponse("bad_request", "course_id is required for course_quiz mode", 400, cors);
      }
      return await handleCourseQuiz(
        supabase, userId, course_id, language as "en" | "es", groupId, force_regenerate, cors,
      );
    }

    // section_quiz mode
    if (!section_id) {
      return errorResponse("bad_request", "section_id is required", 400, cors);
    }
    if (!course_id) {
      return errorResponse("bad_request", "course_id is required", 400, cors);
    }

    return await handleSectionQuiz(
      supabase, userId, course_id, section_id, language as "en" | "es", groupId, force_regenerate, cors,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse("unauthorized", err.message, 401, cors);
    }
    if (err instanceof OpenAIError) {
      return errorResponse("ai_error", err.message, err.status, cors);
    }
    if (err instanceof UsageError) {
      return errorResponse("server_error", err.message, 500, cors);
    }
    console.error("[quiz-generate] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500,
      cors,
    );
  }
});

// =============================================================================
// SECTION QUIZ HANDLER
// =============================================================================

async function handleSectionQuiz(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  courseId: string,
  sectionId: string,
  language: "en" | "es",
  groupId: string,
  forceRegenerate: boolean,
  cors: Record<string, string>,
) {
  console.log(`[quiz-generate:section] Course: ${courseId} | Section: ${sectionId}`);

  // ── 1. Fetch course with quiz_config ─────────────────────────────────
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title_en, title_es, quiz_config, group_id")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    return errorResponse("not_found", "Course not found", 404, cors);
  }
  if (course.group_id !== groupId) {
    return errorResponse("forbidden", "Course does not belong to your group", 403, cors);
  }

  const quizConfig: QuizConfig = { ...DEFAULT_QUIZ_CONFIG, ...(course.quiz_config || {}) };
  const poolSize = quizConfig.question_pool_size || 15;
  const questionCount = quizConfig.question_count || 10;

  // ── 2. Fetch section ─────────────────────────────────────────────────
  const { data: section, error: sectionError } = await supabase
    .from("course_sections")
    .select("id, title_en, title_es, elements, course_id")
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .single();

  if (sectionError || !section) {
    return errorResponse("not_found", "Section not found", 404, cors);
  }

  const sectionTitle = language === "es" && section.title_es
    ? section.title_es
    : section.title_en;

  // ── 3. Check for existing questions ──────────────────────────────────
  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("course_id", courseId)
      .eq("section_id", sectionId)
      .eq("is_active", true);

    if (existing && existing.length >= questionCount) {
      console.log(`[quiz-generate:section] Reusing ${existing.length} existing questions`);
      return await createAttemptAndRespond(
        supabase, userId, courseId, sectionId, existing, language, quizConfig, cors,
      );
    }
  }

  // ── 4. Extract content from elements JSONB ───────────────────────────
  const elements: CourseElement[] = section.elements || [];
  const contentText = extractTextFromElements(elements, language, sectionTitle);

  const words = wordCount(contentText);
  console.log(`[quiz-generate:section] Content: ${contentText.length} chars, ~${words} words from ${elements.length} elements`);

  if (words < 200) {
    return errorResponse(
      "bad_request",
      "Not enough content to generate quiz questions. Section needs at least 200 words of content.",
      400,
      cors,
    );
  }

  // Truncate if too long (~50K tokens = ~37K words)
  const maxWords = 37000;
  let truncatedContent = contentText;
  if (words > maxWords) {
    const wordsArr = contentText.split(/\s+/);
    truncatedContent = wordsArr.slice(0, maxWords).join(" ");
    console.log(`[quiz-generate:section] Content truncated from ${words} to ${maxWords} words`);
  }

  // ── 5. Check credits and usage ───────────────────────────────────────
  const credits = await getCreditCost(supabase, groupId, "course_builder", "quiz_pool");
  const usageInfo = await checkUsage(supabase, userId, groupId);
  if (!usageInfo) {
    return errorResponse("forbidden", "Not a member of this group", 403, cors);
  }
  if (!usageInfo.can_ask) {
    return errorResponse(
      "limit_exceeded",
      language === "es"
        ? "Limite de uso alcanzado. Intenta mas tarde."
        : "Usage limit reached. Try again later.",
      429,
      cors,
    );
  }

  // ── 6. Fetch quiz generator prompt ───────────────────────────────────
  let systemPrompt = await fetchPromptBySlug(supabase, "quiz-pool-generator", language);
  if (!systemPrompt) {
    console.log("[quiz-generate:section] Prompt not found in ai_prompts, using fallback");
    systemPrompt = FALLBACK_QUIZ_PROMPT;
  }

  // ── 7. Build element key list for source_element_key targeting ───────
  const elementKeys = elements
    .filter((el) => el.type === "content" || el.type === "feature")
    .map((el) => el.key)
    .join(", ");

  // ── 8. Call OpenAI ───────────────────────────────────────────────────
  const courseTitle = language === "es" && course.title_es
    ? course.title_es
    : course.title_en;

  const userPrompt = `Generate ${poolSize} multiple-choice quiz questions for the section "${sectionTitle}" from the course "${courseTitle}".

Difficulty distribution: approximately ${Math.round(poolSize * 0.3)} easy, ${Math.round(poolSize * 0.5)} medium, ${Math.round(poolSize * 0.2)} hard.

Available element keys for source_element_key: ${elementKeys || "none"}

Use ONLY this training content:

${truncatedContent}`;

  console.log("[quiz-generate:section] Calling OpenAI...");

  const parsed = await callOpenAI<{ questions: GeneratedQuestion[] }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    schema: quizGenerationSchema,
    schemaName: "quiz_pool_generation",
    maxTokens: 8000,
  });

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    return errorResponse("ai_error", "No questions in AI response", 500, cors);
  }

  console.log(`[quiz-generate:section] AI generated ${parsed.questions.length} questions`);

  // ── 9. Track credits ─────────────────────────────────────────────────
  await trackAndIncrement(supabase, userId, groupId, credits, {
    domain: "course_builder",
    action: "quiz_pool",
    edge_function: "course-quiz-generate",
    model: "gpt-5.2",
    metadata: {
      course_id: courseId,
      section_id: sectionId,
      mode: "section_quiz",
      questions_generated: parsed.questions.length,
    },
  });

  // ── 10. Deactivate old questions for this section (if force regenerate) ──
  if (forceRegenerate) {
    const { error: deactivateError } = await supabase
      .from("quiz_questions")
      .update({ is_active: false, is_archived: true })
      .eq("section_id", sectionId)
      .eq("is_active", true);

    if (deactivateError) {
      console.error("[quiz-generate:section] Deactivate old questions error:", deactivateError.message);
    }
  }

  // ── 11. Persist questions to quiz_questions ──────────────────────────
  const groupIdForQuestions = await getGroupIdForQuiz(supabase, courseId);

  const insertRows = parsed.questions.map((q) => ({
    course_id: courseId,
    section_id: sectionId,
    group_id: groupIdForQuestions,
    question_type: "multiple_choice" as const,
    question_en: q.question_en,
    question_es: q.question_es,
    explanation_en: q.explanation_en || null,
    explanation_es: q.explanation_es || null,
    options: q.options.map((o) => ({
      id: o.id,
      text_en: o.text_en,
      text_es: o.text_es,
      correct: o.correct,
    })),
    rubric: null,
    difficulty: q.difficulty || "medium",
    source_element_key: q.source_element_key || null,
    source_refs: [],
    is_active: true,
    is_archived: false,
    source: "ai",
  }));

  const { data: insertedQuestions, error: insertError } = await supabase
    .from("quiz_questions")
    .insert(insertRows)
    .select("*");

  if (insertError) {
    console.error("[quiz-generate:section] Insert error:", insertError.message);
    return errorResponse("server_error", "Failed to save quiz questions", 500, cors);
  }

  console.log(`[quiz-generate:section] Saved ${insertedQuestions.length} questions to DB`);

  // ── 12. Create attempt and respond ───────────────────────────────────
  return await createAttemptAndRespond(
    supabase, userId, courseId, sectionId, insertedQuestions, language, quizConfig, cors,
  );
}

// =============================================================================
// COURSE QUIZ HANDLER
// =============================================================================

async function handleCourseQuiz(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  courseId: string,
  language: "en" | "es",
  groupId: string,
  forceRegenerate: boolean,
  cors: Record<string, string>,
) {
  console.log(`[quiz-generate:course] Course: ${courseId}`);

  // ── 1. Fetch course with quiz_config ─────────────────────────────────
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title_en, title_es, quiz_config, group_id")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    return errorResponse("not_found", "Course not found", 404, cors);
  }
  if (course.group_id !== groupId) {
    return errorResponse("forbidden", "Course does not belong to your group", 403, cors);
  }

  const quizConfig: QuizConfig = { ...DEFAULT_QUIZ_CONFIG, ...(course.quiz_config || {}) };
  const poolSize = quizConfig.question_pool_size || 30;
  const questionCount = quizConfig.question_count || 10;

  // ── 2. Fetch ALL sections for this course ────────────────────────────
  const { data: sections, error: sectionsError } = await supabase
    .from("course_sections")
    .select("id, title_en, title_es, elements, sort_order")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (sectionsError || !sections || sections.length === 0) {
    return errorResponse("not_found", "No published sections found for this course", 404, cors);
  }

  // ── 3. Check for existing course-level questions ─────────────────────
  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("course_id", courseId)
      .is("section_id", null)  // course-level questions have null section_id
      .eq("is_active", true);

    if (existing && existing.length >= questionCount) {
      console.log(`[quiz-generate:course] Reusing ${existing.length} existing course-level questions`);
      return await createAttemptAndRespond(
        supabase, userId, courseId, null, existing, language, quizConfig, cors,
      );
    }
  }

  // ── 4. Extract content from ALL sections ─────────────────────────────
  const contentParts: string[] = [];
  const allElementKeys: string[] = [];
  // deno-lint-ignore no-explicit-any
  const sectionMap: Array<{ id: string; title_en: string; index: number }> = [];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const elements: CourseElement[] = sec.elements || [];
    const title = language === "es" && sec.title_es ? sec.title_es : sec.title_en;
    const text = extractTextFromElements(elements, language, title);
    if (text) {
      contentParts.push(text);
    }

    // Collect element keys
    elements
      .filter((el: CourseElement) => el.type === "content" || el.type === "feature")
      .forEach((el: CourseElement) => allElementKeys.push(el.key));

    sectionMap.push({ id: sec.id, title_en: sec.title_en, index: i });
  }

  const contentText = contentParts.join("\n\n");
  const words = wordCount(contentText);

  console.log(`[quiz-generate:course] Content: ${contentText.length} chars, ~${words} words from ${sections.length} sections`);

  if (words < 200) {
    return errorResponse(
      "bad_request",
      "Not enough content to generate quiz questions. Course needs at least 200 words of content across its sections.",
      400,
      cors,
    );
  }

  // Truncate if too long
  const maxWords = 37000;
  let truncatedContent = contentText;
  if (words > maxWords) {
    const wordsArr = contentText.split(/\s+/);
    truncatedContent = wordsArr.slice(0, maxWords).join(" ");
    console.log(`[quiz-generate:course] Content truncated from ${words} to ${maxWords} words`);
  }

  // ── 5. Check credits and usage ───────────────────────────────────────
  const credits = await getCreditCost(supabase, groupId, "course_builder", "quiz_pool");
  const usageInfo = await checkUsage(supabase, userId, groupId);
  if (!usageInfo) {
    return errorResponse("forbidden", "Not a member of this group", 403, cors);
  }
  if (!usageInfo.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429, cors);
  }

  // ── 6. Fetch quiz generator prompt ───────────────────────────────────
  let systemPrompt = await fetchPromptBySlug(supabase, "quiz-pool-generator", language);
  if (!systemPrompt) {
    console.log("[quiz-generate:course] Prompt not found, using fallback");
    systemPrompt = FALLBACK_QUIZ_PROMPT;
  }

  // ── 7. Call OpenAI ───────────────────────────────────────────────────
  const courseTitle = language === "es" && course.title_es
    ? course.title_es
    : course.title_en;

  const sectionList = sectionMap.map((s) => s.title_en).join(", ");

  const userPrompt = `Generate ${poolSize} multiple-choice quiz questions for the ENTIRE course "${courseTitle}".

This is a course-level assessment covering ALL sections: ${sectionList}

Distribute questions across all sections (at least 1 question per section).
Difficulty distribution: approximately ${Math.round(poolSize * 0.3)} easy, ${Math.round(poolSize * 0.5)} medium, ${Math.round(poolSize * 0.2)} hard.

Available element keys for source_element_key: ${allElementKeys.join(", ") || "none"}

Use ONLY this training content:

${truncatedContent}`;

  console.log("[quiz-generate:course] Calling OpenAI...");

  const parsed = await callOpenAI<{ questions: GeneratedQuestion[] }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    schema: quizGenerationSchema,
    schemaName: "quiz_pool_generation",
    maxTokens: 12000,
  });

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    return errorResponse("ai_error", "No questions in AI response", 500, cors);
  }

  console.log(`[quiz-generate:course] AI generated ${parsed.questions.length} questions`);

  // ── 8. Track credits ─────────────────────────────────────────────────
  await trackAndIncrement(supabase, userId, groupId, credits, {
    domain: "course_builder",
    action: "quiz_pool",
    edge_function: "course-quiz-generate",
    model: "gpt-5.2",
    metadata: {
      course_id: courseId,
      mode: "course_quiz",
      sections_count: sections.length,
      questions_generated: parsed.questions.length,
    },
  });

  // ── 9. Deactivate old course-level questions if force regenerate ─────
  if (forceRegenerate) {
    const { error: deactivateError } = await supabase
      .from("quiz_questions")
      .update({ is_active: false, is_archived: true })
      .eq("course_id", courseId)
      .is("section_id", null)
      .eq("is_active", true);

    if (deactivateError) {
      console.error("[quiz-generate:course] Deactivate old questions error:", deactivateError.message);
    }
  }

  // ── 10. Persist questions ────────────────────────────────────────────
  const groupIdForQuestions = await getGroupIdForQuiz(supabase, courseId);

  const insertRows = parsed.questions.map((q) => ({
    course_id: courseId,
    section_id: null, // course-level — not tied to a specific section
    group_id: groupIdForQuestions,
    question_type: "multiple_choice" as const,
    question_en: q.question_en,
    question_es: q.question_es,
    explanation_en: q.explanation_en || null,
    explanation_es: q.explanation_es || null,
    options: q.options.map((o) => ({
      id: o.id,
      text_en: o.text_en,
      text_es: o.text_es,
      correct: o.correct,
    })),
    rubric: null,
    difficulty: q.difficulty || "medium",
    source_element_key: q.source_element_key || null,
    source_refs: [],
    is_active: true,
    is_archived: false,
    source: "ai",
  }));

  const { data: insertedQuestions, error: insertError } = await supabase
    .from("quiz_questions")
    .insert(insertRows)
    .select("*");

  if (insertError) {
    console.error("[quiz-generate:course] Insert error:", insertError.message);
    return errorResponse("server_error", "Failed to save quiz questions", 500, cors);
  }

  console.log(`[quiz-generate:course] Saved ${insertedQuestions.length} questions to DB`);

  // ── 11. Create attempt and respond ───────────────────────────────────
  return await createAttemptAndRespond(
    supabase, userId, courseId, null, insertedQuestions, language, quizConfig, cors,
  );
}

// =============================================================================
// GENERATE POOL ONLY HANDLER (admin builder — no enrollment or attempt)
// =============================================================================

async function handleGeneratePoolOnly(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  courseId: string,
  language: "en" | "es",
  groupId: string,
  forceRegenerate: boolean,
  cors: Record<string, string>,
) {
  console.log(`[quiz-generate:pool-only] Course: ${courseId}`);

  // ── 1. Fetch course with quiz_config ─────────────────────────────────
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title_en, title_es, quiz_config, group_id")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    return errorResponse("not_found", "Course not found", 404, cors);
  }
  if (course.group_id !== groupId) {
    return errorResponse("forbidden", "Course does not belong to your group", 403, cors);
  }

  const quizConfig: QuizConfig = { ...DEFAULT_QUIZ_CONFIG, ...(course.quiz_config || {}) };
  const poolSize = quizConfig.question_pool_size || 30;

  // ── 2. Fetch ALL sections for this course ────────────────────────────
  const { data: sections, error: sectionsError } = await supabase
    .from("course_sections")
    .select("id, title_en, title_es, elements, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (sectionsError || !sections || sections.length === 0) {
    return errorResponse("not_found", "No sections found for this course", 404, cors);
  }

  // ── 3. Extract content from ALL sections ─────────────────────────────
  const contentParts: string[] = [];
  const allElementKeys: string[] = [];

  for (const sec of sections) {
    const elements: CourseElement[] = sec.elements || [];
    const title = language === "es" && sec.title_es ? sec.title_es : sec.title_en;
    const text = extractTextFromElements(elements, language, title);
    if (text) {
      contentParts.push(text);
    }

    elements
      .filter((el: CourseElement) => el.type === "content" || el.type === "feature")
      .forEach((el: CourseElement) => allElementKeys.push(el.key));
  }

  const contentText = contentParts.join("\n\n");
  const words = wordCount(contentText);

  console.log(`[quiz-generate:pool-only] Content: ${contentText.length} chars, ~${words} words from ${sections.length} sections`);

  if (words < 200) {
    return errorResponse(
      "bad_request",
      "Not enough content to generate quiz questions. Course needs at least 200 words of content across its sections.",
      400,
      cors,
    );
  }

  // Truncate if too long
  const maxWords = 37000;
  let truncatedContent = contentText;
  if (words > maxWords) {
    const wordsArr = contentText.split(/\s+/);
    truncatedContent = wordsArr.slice(0, maxWords).join(" ");
    console.log(`[quiz-generate:pool-only] Content truncated from ${words} to ${maxWords} words`);
  }

  // ── 4. Check credits and usage ───────────────────────────────────────
  const credits = await getCreditCost(supabase, groupId, "course_builder", "quiz_pool");
  const usageInfo = await checkUsage(supabase, userId, groupId);
  if (!usageInfo) {
    return errorResponse("forbidden", "Not a member of this group", 403, cors);
  }
  if (!usageInfo.can_ask) {
    return errorResponse(
      "limit_exceeded",
      language === "es"
        ? "Limite de uso alcanzado. Intenta mas tarde."
        : "Usage limit reached. Try again later.",
      429,
      cors,
    );
  }

  // ── 5. Fetch quiz generator prompt ───────────────────────────────────
  let systemPrompt = await fetchPromptBySlug(supabase, "quiz-pool-generator", language);
  if (!systemPrompt) {
    console.log("[quiz-generate:pool-only] Prompt not found, using fallback");
    systemPrompt = FALLBACK_QUIZ_PROMPT;
  }

  // ── 6. Call OpenAI ───────────────────────────────────────────────────
  const courseTitle = language === "es" && course.title_es
    ? course.title_es
    : course.title_en;

  const sectionList = sections.map((s: { title_en: string }) => s.title_en).join(", ");

  const userPrompt = `Generate ${poolSize} multiple-choice quiz questions for the ENTIRE course "${courseTitle}".

This is a question pool covering ALL sections: ${sectionList}

Distribute questions across all sections (at least 1 question per section).
Difficulty distribution: approximately ${Math.round(poolSize * 0.3)} easy, ${Math.round(poolSize * 0.5)} medium, ${Math.round(poolSize * 0.2)} hard.

Available element keys for source_element_key: ${allElementKeys.join(", ") || "none"}

Use ONLY this training content:

${truncatedContent}`;

  console.log("[quiz-generate:pool-only] Calling OpenAI...");

  const parsed = await callOpenAI<{ questions: GeneratedQuestion[] }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    schema: quizGenerationSchema,
    schemaName: "quiz_pool_generation",
    maxTokens: 12000,
  });

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    return errorResponse("ai_error", "No questions in AI response", 500, cors);
  }

  console.log(`[quiz-generate:pool-only] AI generated ${parsed.questions.length} questions`);

  // ── 7. Track credits ─────────────────────────────────────────────────
  await trackAndIncrement(supabase, userId, groupId, credits, {
    domain: "course_builder",
    action: "quiz_pool",
    edge_function: "course-quiz-generate",
    model: "gpt-5.2",
    metadata: {
      course_id: courseId,
      mode: "generate_pool_only",
      sections_count: sections.length,
      questions_generated: parsed.questions.length,
    },
  });

  // ── 8. Deactivate old questions if force regenerate ──────────────────
  if (forceRegenerate) {
    const { error: deactivateError } = await supabase
      .from("quiz_questions")
      .update({ is_active: false, is_archived: true })
      .eq("course_id", courseId)
      .is("section_id", null)
      .eq("is_active", true);

    if (deactivateError) {
      console.error("[quiz-generate:pool-only] Deactivate old questions error:", deactivateError.message);
    }
  }

  // ── 9. Persist questions to quiz_questions ──────────────────────────
  const groupIdForQuestions = await getGroupIdForQuiz(supabase, courseId);

  const insertRows = parsed.questions.map((q) => ({
    course_id: courseId,
    section_id: null,
    group_id: groupIdForQuestions,
    question_type: "multiple_choice" as const,
    question_en: q.question_en,
    question_es: q.question_es,
    explanation_en: q.explanation_en || null,
    explanation_es: q.explanation_es || null,
    options: q.options.map((o) => ({
      id: o.id,
      text_en: o.text_en,
      text_es: o.text_es,
      correct: o.correct,
    })),
    rubric: null,
    difficulty: q.difficulty || "medium",
    source_element_key: q.source_element_key || null,
    source_refs: [],
    is_active: true,
    is_archived: false,
    source: "ai",
  }));

  const { data: insertedQuestions, error: insertError } = await supabase
    .from("quiz_questions")
    .insert(insertRows)
    .select("*");

  if (insertError) {
    console.error("[quiz-generate:pool-only] Insert error:", insertError.message);
    return errorResponse("server_error", "Failed to save quiz questions", 500, cors);
  }

  console.log(`[quiz-generate:pool-only] Saved ${insertedQuestions.length} questions to DB`);

  // ── 10. Return questions directly (no attempt, no enrollment) ────────
  return jsonResponse({
    questions: insertedQuestions,
    total_generated: insertedQuestions.length,
  }, 200, cors);
}

// =============================================================================
// SHARED: Create quiz attempt and build response
// =============================================================================

async function createAttemptAndRespond(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  courseId: string,
  sectionId: string | null,
  // deno-lint-ignore no-explicit-any
  questionPool: Array<Record<string, any>>,
  language: "en" | "es",
  quizConfig: QuizConfig,
  cors: Record<string, string>,
) {
  const questionCount = quizConfig.question_count || 10;
  const passingScore = quizConfig.passing_score || 70;

  // ── 1. Fetch enrollment ────────────────────────────────────────────────
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .single();

  if (!enrollment) {
    return errorResponse("bad_request", "Not enrolled in this course", 400, cors);
  }

  // ── 2. Check max attempts ─────────────────────────────────────────────
  if (quizConfig.max_attempts) {
    const attemptFilter = supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("course_id", courseId);

    if (sectionId) {
      attemptFilter.eq("section_id", sectionId);
    } else {
      attemptFilter.is("section_id", null);
    }

    const { count: prevAttempts } = await attemptFilter;

    if ((prevAttempts || 0) >= quizConfig.max_attempts) {
      return errorResponse(
        "limit_exceeded",
        language === "es"
          ? `Has alcanzado el maximo de ${quizConfig.max_attempts} intentos.`
          : `Maximum of ${quizConfig.max_attempts} attempts reached.`,
        429,
        cors,
      );
    }
  }

  // ── 3. Get next attempt number ─────────────────────────────────────────
  const attemptCountFilter = supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("course_id", courseId);

  if (sectionId) {
    attemptCountFilter.eq("section_id", sectionId);
  } else {
    attemptCountFilter.is("section_id", null);
  }

  const { count: prevAttemptCount } = await attemptCountFilter;
  const attemptNumber = (prevAttemptCount || 0) + 1;

  // ── 4. Select questions for this attempt ───────────────────────────────
  let selected = [...questionPool];
  if (quizConfig.shuffle_questions) {
    selected = shuffle(selected);
  }
  selected = selected.slice(0, questionCount);

  const questionIds = selected.map((q) => q.id);

  // ── 5. Create quiz_attempt ─────────────────────────────────────────────
  const quizMode = "multiple_choice";

  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      course_id: courseId,
      section_id: sectionId,
      enrollment_id: enrollment.id,
      attempt_number: attemptNumber,
      quiz_mode: quizMode,
      status: "in_progress",
      questions_covered: questionIds,
    })
    .select("id")
    .single();

  if (attemptError) {
    console.error("[quiz-generate] Attempt create error:", attemptError.message);
    return errorResponse("server_error", "Failed to create quiz attempt", 500, cors);
  }

  // ── 6. Increment times_shown on selected questions ─────────────────────
  // Note: times_shown and times_correct are updated by course-quiz-submit
  // when the attempt is completed. The questions_covered UUID[] on the attempt
  // row tracks which questions were shown for this attempt.

  // ── 7. Build client-safe response ──────────────────────────────────────
  return jsonResponse({
    questions: selected.map((q) => toClientQuestion(q, language, quizConfig.shuffle_options)),
    attempt_id: attempt.id,
    total_questions: selected.length,
    passing_score: passingScore,
    mode: quizMode,
    quiz_config: {
      show_feedback_immediately: quizConfig.show_feedback_immediately,
      max_attempts: quizConfig.max_attempts,
    },
  }, 200, cors);
}

// =============================================================================
// HELPER: Get group_id from course for quiz_questions insert
// =============================================================================

// deno-lint-ignore no-explicit-any
async function getGroupIdForQuiz(supabase: any, courseId: string): Promise<string | null> {
  const { data } = await supabase
    .from("courses")
    .select("group_id")
    .eq("id", courseId)
    .single();
  return data?.group_id || null;
}

// =============================================================================
// HELPER: Convert DB question to client-safe format (no correct answers)
// =============================================================================

function toClientQuestion(
  // deno-lint-ignore no-explicit-any
  q: Record<string, any>,
  language: string,
  shuffleOptions = true,
): Record<string, unknown> {
  const isEs = language === "es";

  const base: Record<string, unknown> = {
    id: q.id,
    question_type: q.question_type,
    question: isEs && q.question_es ? q.question_es : q.question_en,
    difficulty: q.difficulty,
  };

  if (q.question_type === "multiple_choice" && q.options) {
    // deno-lint-ignore no-explicit-any
    let opts = (q.options as Array<Record<string, any>>).map((o) => ({
      id: o.id,
      text: isEs && o.text_es ? o.text_es : o.text_en,
    }));
    if (shuffleOptions) {
      opts = shuffle(opts);
    }
    base.options = opts;
  }

  return base;
}
