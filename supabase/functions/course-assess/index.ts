/**
 * Course Assess Edge Function
 *
 * Conversational assessment — AI-led conversation to evaluate a trainee's
 * knowledge of a course section. Uses quiz_questions as topic guides,
 * stores messages in conversation_messages child table, and tracks
 * running competency on quiz_attempts (quiz_mode='interactive_ai').
 *
 * Two actions:
 *   1. start   — Creates a new quiz_attempt + sends the AI's opening question
 *   2. message — Continues the conversation, persists messages, returns AI reply
 *
 * Auth: verify_jwt=false — manual JWT verification via getUser()
 *
 * Schema (Phase 2):
 *   - course_sections.elements JSONB[] — content stored as element objects
 *   - quiz_attempts, quiz_questions, conversation_messages — Phase 9 tables
 *     (not yet created as of Phase 5A; this function will return a clear error
 *      until those tables are migrated)
 *
 * Phase 9 TODO: Interactive AI quiz is a Phase 9 feature. This function
 * provides a minimal working implementation that will activate once the
 * quiz tables are rebuilt. Until then, it returns a helpful error message
 * directing clients to use MC quizzes instead.
 */

import { getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithUser, AuthError } from "../_shared/auth.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import { callOpenAI, OpenAIError } from "../_shared/openai.ts";
import { checkUsage, UsageError } from "../_shared/usage.ts";
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";

// =============================================================================
// ELEMENT CONTENT EXTRACTOR (same as course-tutor)
// =============================================================================

interface CourseElement {
  type: string;
  key?: string;
  title_en?: string;
  title_es?: string;
  body_en?: string;
  body_es?: string;
  caption_en?: string;
  caption_es?: string;
  items?: Array<{
    title_en?: string;
    title_es?: string;
    body_en?: string;
    body_es?: string;
  }>;
}

/**
 * Extract readable text content from a section's elements JSONB array.
 */
function extractElementsContent(
  elements: CourseElement[],
  language: "en" | "es",
): string {
  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    return "";
  }

  const parts: string[] = [];

  for (const el of elements) {
    const isEs = language === "es";

    switch (el.type) {
      case "content": {
        const body = (isEs && el.body_es) ? el.body_es : el.body_en;
        if (body) {
          const title = (isEs && el.title_es) ? el.title_es : el.title_en;
          if (title) {
            parts.push(`### ${title}\n${body}`);
          } else {
            parts.push(body);
          }
        }
        break;
      }

      case "feature": {
        const title = (isEs && el.title_es) ? el.title_es : el.title_en;
        const body = (isEs && el.body_es) ? el.body_es : el.body_en;

        const featureParts: string[] = [];
        if (title) featureParts.push(`**${title}**`);
        if (body) featureParts.push(body);

        if (el.items && Array.isArray(el.items)) {
          for (const item of el.items) {
            const itemTitle = (isEs && item.title_es) ? item.title_es : item.title_en;
            const itemBody = (isEs && item.body_es) ? item.body_es : item.body_en;
            if (itemTitle && itemBody) {
              featureParts.push(`- ${itemTitle}: ${itemBody}`);
            } else if (itemTitle) {
              featureParts.push(`- ${itemTitle}`);
            } else if (itemBody) {
              featureParts.push(`- ${itemBody}`);
            }
          }
        }

        if (featureParts.length > 0) {
          parts.push(featureParts.join("\n"));
        }
        break;
      }

      case "media": {
        const caption = (isEs && el.caption_es) ? el.caption_es : el.caption_en;
        if (caption) {
          parts.push(`[Image/Media: ${caption}]`);
        }
        break;
      }

      default: {
        const body = (isEs && el.body_es) ? el.body_es : el.body_en;
        if (body) parts.push(body);
        break;
      }
    }
  }

  return parts.join("\n\n");
}

// =============================================================================
// TYPES
// =============================================================================

interface AssessmentAIResponse {
  reply: string;
  competency_score: number;
  questions_covered: string[];
  topics_assessed: string[];
  needs_more_evaluation: boolean;
  teaching_moment: boolean;
  wrap_up: boolean;
  internal_notes: string;
}

// =============================================================================
// OPENAI STRUCTURED OUTPUT SCHEMA
// =============================================================================

const assessmentResponseSchema = {
  type: "object" as const,
  properties: {
    reply: { type: "string" as const },
    competency_score: { type: "number" as const },
    questions_covered: {
      type: "array" as const,
      items: { type: "string" as const, description: "UUID from the [ID: ...] tag of each covered question" },
      description: "Array of question UUIDs (from [ID: ...] tags) that were discussed in this exchange",
    },
    topics_assessed: {
      type: "array" as const,
      items: { type: "string" as const, description: "Short topic label" },
      description: "Human-readable topic names discussed (for metadata only)",
    },
    needs_more_evaluation: { type: "boolean" as const },
    teaching_moment: { type: "boolean" as const },
    wrap_up: { type: "boolean" as const },
    internal_notes: { type: "string" as const },
  },
  required: [
    "reply",
    "competency_score",
    "questions_covered",
    "topics_assessed",
    "needs_more_evaluation",
    "teaching_moment",
    "wrap_up",
    "internal_notes",
  ],
  additionalProperties: false,
};

// =============================================================================
// OPENAI RETRY WRAPPER
// =============================================================================

async function callOpenAIWithRetry<T>(params: Parameters<typeof callOpenAI<T>>[0], maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callOpenAI<T>(params);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(`[course-assess] OpenAI attempt ${attempt + 1} failed, retrying...`, err instanceof Error ? err.message : err);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // backoff: 1s, 2s
      }
    }
  }
  throw lastError;
}

// =============================================================================
// TABLE AVAILABILITY CHECK
// =============================================================================

/**
 * Check if a table exists and is accessible. Returns true if the table
 * is available, false if it's not (e.g., dropped and not yet recreated).
 */
async function tableExists(supabase: SupabaseClient, tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .limit(0);

    // If error contains "relation ... does not exist", table is not available
    if (error && (error.message?.includes("does not exist") || error.code === "42P01")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = getCorsHeaders(origin);

  // Step 1: CORS + OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  console.log("[course-assess] Request received");

  try {
    // Step 2: AUTHENTICATE
    const { userId, supabase } = await authenticateWithUser(req);
    console.log("[course-assess] User:", userId);

    // Step 3: PARSE + VALIDATE
    const body = await req.json();
    const {
      action,
      section_id,
      enrollment_id,
      language = "en",
      groupId,
      message,
      attempt_id,
    } = body;

    if (!action || !section_id || !enrollment_id || !groupId) {
      return errorResponse(
        "bad_request",
        "action, section_id, enrollment_id, and groupId are required",
        400,
        cors,
      );
    }

    if (action !== "start" && action !== "message") {
      return errorResponse("bad_request", `Unknown action: ${action}`, 400, cors);
    }

    if (action === "message" && (!message || !attempt_id)) {
      return errorResponse(
        "bad_request",
        "message and attempt_id are required for action='message'",
        400,
        cors,
      );
    }

    // Message length validation
    if (action === "message" && typeof message === "string" && message.length > 4000) {
      return errorResponse("bad_request", "Message too long (max 4000 characters)", 400, cors);
    }

    console.log(`[course-assess] Action: ${action} | Section: ${section_id} | Lang: ${language}`);

    // Step 3b: CHECK TABLE AVAILABILITY
    // quiz_attempts, quiz_questions, and conversation_messages were dropped in
    // Phase 2 teardown. They will be rebuilt in Phase 9 (Interactive AI Quiz).
    // Until then, return a clear error directing clients to MC quizzes.
    const quizTablesReady = await tableExists(supabase, "quiz_attempts");
    if (!quizTablesReady) {
      console.warn("[course-assess] quiz_attempts table not available — Phase 9 tables not yet migrated");
      return errorResponse(
        "not_available",
        language === "es"
          ? "La evaluacion interactiva con IA aun no esta disponible. Usa el quiz de opcion multiple."
          : "Interactive AI assessment is not yet available. Please use the multiple choice quiz.",
        503,
        cors,
      );
    }

    // Step 4: CHECK USAGE QUOTA
    const usage = await checkUsage(supabase, userId, groupId);
    if (!usage) {
      return errorResponse("forbidden", "Not a member of this group", 403, cors);
    }
    if (!usage.can_ask) {
      const limitType = usage.daily_count >= usage.daily_limit ? "daily" : "monthly";
      return errorResponse(
        "limit_exceeded",
        limitType === "daily"
          ? language === "es"
            ? "Limite diario alcanzado. Intenta manana."
            : "Daily question limit reached. Try again tomorrow."
          : language === "es"
            ? "Limite mensual alcanzado."
            : "Monthly question limit reached.",
        429,
        cors,
      );
    }

    // Route to the appropriate handler
    if (action === "start") {
      return await handleStart(supabase, userId, section_id, enrollment_id, language, groupId, cors);
    } else {
      return await handleMessage(
        supabase,
        userId,
        attempt_id,
        message,
        language,
        groupId,
        cors,
      );
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse("Unauthorized", err.message, 401, cors);
    }
    if (err instanceof OpenAIError) {
      return errorResponse("ai_error", err.message, err.status, cors);
    }
    if (err instanceof UsageError) {
      return errorResponse("server_error", err.message, 500, cors);
    }
    console.error("[course-assess] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500,
      cors,
    );
  }
});

// =============================================================================
// ACTION: start — Begin a new conversational assessment
// =============================================================================

async function handleStart(
  supabase: SupabaseClient,
  userId: string,
  sectionId: string,
  enrollmentId: string,
  language: string,
  groupId: string,
  cors: Record<string, string>,
): Promise<Response> {
  // Verify enrollment belongs to this user
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("id", enrollmentId)
    .eq("user_id", userId)
    .single();

  if (!enrollment) {
    return errorResponse("forbidden", "Enrollment not found or not yours", 403, cors);
  }

  // Prevent concurrent in-progress conversation assessments for same section
  const { count: inProgressCount } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("section_id", sectionId)
    .eq("quiz_mode", "interactive_ai")
    .eq("status", "in_progress");

  if ((inProgressCount || 0) > 0) {
    return errorResponse(
      "conflict",
      "You already have an in-progress conversation assessment for this section",
      409,
      cors,
    );
  }

  // Load active quiz questions for the section (topic guides for the AI)
  const { data: questions, error: questionsError } = await supabase
    .from("quiz_questions")
    .select(
      "id, question_en, question_es, options, rubric, question_type, explanation_en, explanation_es",
    )
    .eq("section_id", sectionId)
    .eq("is_active", true);

  if (questionsError || !questions || questions.length === 0) {
    console.error("[course-assess:start] No questions found:", questionsError?.message);
    return errorResponse(
      "bad_request",
      "No published quiz questions found for this section. Generate questions first.",
      400,
      cors,
    );
  }

  console.log(`[course-assess:start] Found ${questions.length} questions`);

  // Create quiz_attempt (quiz_mode = 'interactive_ai' for Phase 9)
  const { count } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("section_id", sectionId);

  const attemptNumber = (count || 0) + 1;

  // Resolve course_id from the enrollment
  const { data: enrollData } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("id", enrollmentId)
    .single();

  if (!enrollData?.course_id) {
    return errorResponse("not_found", "Enrollment not found", 404, cors);
  }

  const { data: newAttempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      course_id: enrollData.course_id,
      section_id: sectionId,
      enrollment_id: enrollmentId,
      attempt_number: attemptNumber,
      quiz_mode: "interactive_ai",
      status: "in_progress",
      transcript_expires_at: new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .select("id")
    .single();

  if (attemptError || !newAttempt) {
    console.error("[course-assess:start] Attempt create error:", attemptError?.message);
    return errorResponse("server_error", "Failed to create assessment attempt", 500, cors);
  }

  const attemptId = newAttempt.id as string;
  console.log(`[course-assess:start] Created attempt: ${attemptId} (attempt #${attemptNumber})`);

  // Load section content from elements JSONB (new schema)
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, elements, title_en, title_es")
    .eq("id", sectionId)
    .eq("status", "published");

  let contentContext = "";
  if (sections && sections.length > 0) {
    const sec = sections[0];
    const lang = language as "en" | "es";
    const elements = (sec.elements || []) as CourseElement[];
    const title = (lang === "es" && sec.title_es) ? sec.title_es : sec.title_en;
    const content = extractElementsContent(elements, lang);
    if (content) {
      contentContext = `=== ${title} ===\n${content}`;
    }
  }

  // BUILD SYSTEM PROMPT
  const systemPrompt = await buildSystemPrompt(
    supabase,
    questions,
    contentContext,
    language,
  );
  if (!systemPrompt) {
    return errorResponse("server_error", "Assessment prompt not configured", 500, cors);
  }

  // BUILD MESSAGES + CALL OPENAI
  const syntheticStart =
    language === "es"
      ? "Estoy listo para comenzar la evaluacion."
      : "I'm ready to start the assessment.";

  const aiMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: syntheticStart },
  ];

  console.log("[course-assess:start] Calling OpenAI...");

  const aiResponse = await callOpenAIWithRetry<AssessmentAIResponse>({
    messages: aiMessages,
    schema: assessmentResponseSchema,
    schemaName: "assessment_response",
    temperature: 0.6,
    maxTokens: 1000,
  });

  // VALIDATE AI RESPONSE
  const competencyScore = Math.min(100, Math.max(0, Math.round(aiResponse.competency_score)));
  const validQuestionIds = new Set(questions.map((q: Record<string, unknown>) => q.id as string));
  const coveredIds = (aiResponse.questions_covered || []).filter((id) =>
    validQuestionIds.has(id),
  );

  let shouldWrapUp = aiResponse.wrap_up;
  if (shouldWrapUp && coveredIds.length < 3 && questions.length >= 3) {
    shouldWrapUp = false;
  }

  const teachingMoment = aiResponse.teaching_moment || false;

  // PERSIST messages to conversation_messages
  const { error: msgInsertError } = await supabase.from("conversation_messages").insert([
    {
      attempt_id: attemptId,
      role: "user",
      content: syntheticStart,
    },
    {
      attempt_id: attemptId,
      role: "assistant",
      content: aiResponse.reply,
      metadata: {
        competency_score: competencyScore,
        teaching_moment: teachingMoment,
        wrap_up: shouldWrapUp,
        internal_notes: aiResponse.internal_notes,
      },
    },
  ]);
  if (msgInsertError) {
    console.error("[course-assess:start] Message insert error:", msgInsertError.message);
    return errorResponse("server_error", "Failed to persist conversation messages", 500, cors);
  }

  // Update quiz_attempts with running state
  const attemptUpdate: Record<string, unknown> = {
    competency_score: competencyScore,
    questions_covered: coveredIds,
  };

  if (shouldWrapUp) {
    attemptUpdate.status = "awaiting_evaluation";
  }

  const { error: attemptUpdateError } = await supabase
    .from("quiz_attempts")
    .update(attemptUpdate)
    .eq("id", attemptId);
  if (attemptUpdateError) {
    console.error("[course-assess:start] Attempt update error:", attemptUpdateError.message);
  }

  // Track credits (course_player/quiz_interactive)
  const startCredits = await getCreditCost(supabase, groupId, "course_player", "quiz_interactive");
  await trackAndIncrement(supabase, userId, groupId, startCredits, {
    domain: "course_player",
    action: "quiz_interactive",
    edge_function: "course-assess",
    model: "gpt-5.2",
    metadata: { attempt_id: attemptId, section_id: sectionId },
  });

  console.log(
    `[course-assess:start] Reply ready | Score: ${competencyScore} | Topics: ${coveredIds.length}/${questions.length} | WrapUp: ${shouldWrapUp}`,
  );

  // RETURN CLIENT-SAFE RESPONSE
  return jsonResponse({
    reply: aiResponse.reply,
    topics_covered: coveredIds.length,
    topics_total: questions.length,
    teaching_moment: teachingMoment,
    wrap_up: shouldWrapUp,
    attempt_id: attemptId,
  }, 200, cors);
}

// =============================================================================
// ACTION: message — Continue the conversational assessment
// =============================================================================

async function handleMessage(
  supabase: SupabaseClient,
  userId: string,
  attemptId: string,
  message: string,
  language: string,
  groupId: string,
  cors: Record<string, string>,
): Promise<Response> {
  // Load attempt and verify ownership
  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select(
      "id, user_id, status, quiz_mode, section_id, enrollment_id, competency_score, questions_covered, teaching_moments, additional_questions_asked",
    )
    .eq("id", attemptId)
    .single();

  if (attemptError || !attempt) {
    return errorResponse("not_found", "Attempt not found", 404, cors);
  }
  if (attempt.user_id !== userId) {
    return errorResponse("forbidden", "Not your attempt", 403, cors);
  }
  if (attempt.status !== "in_progress") {
    return errorResponse("bad_request", "Attempt not in progress", 400, cors);
  }
  if (attempt.quiz_mode !== "interactive_ai") {
    return errorResponse("bad_request", "Not an interactive AI attempt", 400, cors);
  }

  const sectionId = attempt.section_id as string;
  const currentTeachingMoments = (attempt.teaching_moments as number) || 0;
  const currentAdditionalAsked = (attempt.additional_questions_asked as number) || 0;

  // Load active questions for topics_total
  const { data: questions } = await supabase
    .from("quiz_questions")
    .select(
      "id, question_en, question_es, options, rubric, question_type, explanation_en, explanation_es",
    )
    .eq("section_id", sectionId)
    .eq("is_active", true);

  const topicsTotal = questions?.length || 0;

  // Check conversation length
  const { count: messageCount } = await supabase
    .from("conversation_messages")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId);

  const userMessageCount = Math.floor((messageCount || 0) / 2);

  // Handle __WRAP_UP__ sentinel or max messages reached
  const isForceWrapUp = message === "__WRAP_UP__" || userMessageCount >= 20;

  if (isForceWrapUp) {
    const wrapUpReply =
      language === "es"
        ? "Hemos cubierto mucho material. Permiteme preparar tu evaluacion."
        : "We've covered a lot of ground. Let me put together your evaluation!";

    const { error: wrapMsgErr } = await supabase.from("conversation_messages").insert([
      { attempt_id: attemptId, role: "user", content: message },
      {
        attempt_id: attemptId,
        role: "assistant",
        content: wrapUpReply,
        metadata: { wrap_up: true },
      },
    ]);
    if (wrapMsgErr) {
      console.error("[course-assess:message] Wrap-up message insert error:", wrapMsgErr.message);
    }

    const { error: wrapUpdateErr } = await supabase
      .from("quiz_attempts")
      .update({ status: "awaiting_evaluation" })
      .eq("id", attemptId);
    if (wrapUpdateErr) {
      console.error("[course-assess:message] Wrap-up attempt update error:", wrapUpdateErr.message);
    }

    console.log(
      `[course-assess:message] Force wrap-up | Reason: ${message === "__WRAP_UP__" ? "user_button" : "max_messages"}`,
    );

    return jsonResponse({
      reply: wrapUpReply,
      topics_covered: ((attempt.questions_covered as string[]) || []).length,
      topics_total: topicsTotal,
      teaching_moment: false,
      wrap_up: true,
      attempt_id: attemptId,
    }, 200, cors);
  }

  // Load section content from elements JSONB (new schema)
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, elements, title_en, title_es")
    .eq("id", sectionId)
    .eq("status", "published");

  let contentContext = "";
  if (sections && sections.length > 0) {
    const sec = sections[0];
    const lang = language as "en" | "es";
    const elements = (sec.elements || []) as CourseElement[];
    const title = (lang === "es" && sec.title_es) ? sec.title_es : sec.title_en;
    const content = extractElementsContent(elements, lang);
    if (content) {
      contentContext = `=== ${title} ===\n${content}`;
    }
  }

  // Load conversation history (last 20 messages)
  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: true });

  const historySlice = (messages || []).slice(-20);

  // BUILD SYSTEM PROMPT
  const systemPrompt = await buildSystemPrompt(
    supabase,
    questions || [],
    contentContext,
    language,
  );
  if (!systemPrompt) {
    return errorResponse("server_error", "Assessment prompt not configured", 500, cors);
  }

  // BUILD MESSAGES + CALL OPENAI
  const aiMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of historySlice) {
    aiMessages.push({ role: msg.role, content: msg.content });
  }
  aiMessages.push({ role: "user", content: message });

  console.log(
    `[course-assess:message] Calling OpenAI (history: ${historySlice.length} msgs)...`,
  );

  const aiResponse = await callOpenAIWithRetry<AssessmentAIResponse>({
    messages: aiMessages,
    schema: assessmentResponseSchema,
    schemaName: "assessment_response",
    temperature: 0.6,
    maxTokens: 1000,
  });

  // VALIDATE AI RESPONSE
  const competencyScore = Math.min(100, Math.max(0, Math.round(aiResponse.competency_score)));
  const validQuestionIds = new Set(
    (questions || []).map((q: Record<string, unknown>) => q.id as string),
  );
  const coveredIds = (aiResponse.questions_covered || []).filter((id) =>
    validQuestionIds.has(id),
  );

  // Merge new covered IDs with previously covered ones (cumulative)
  const previousCovered = (attempt.questions_covered as string[]) || [];
  const allCoveredIds = [...new Set([...previousCovered, ...coveredIds])];

  let shouldWrapUp = aiResponse.wrap_up;
  if (shouldWrapUp && allCoveredIds.length < 3 && topicsTotal >= 3) {
    shouldWrapUp = false;
  }

  const teachingMoment = aiResponse.teaching_moment || false;

  // PERSIST messages to conversation_messages
  const messagesToInsert: Array<Record<string, unknown>> = [
    {
      attempt_id: attemptId,
      role: "user",
      content: message,
    },
    {
      attempt_id: attemptId,
      role: "assistant",
      content: aiResponse.reply,
      metadata: {
        competency_score: competencyScore,
        teaching_moment: teachingMoment,
        wrap_up: shouldWrapUp,
        topics_assessed: aiResponse.topics_assessed,
        internal_notes: aiResponse.internal_notes,
      },
    },
  ];

  const { error: msgInsertErr } = await supabase.from("conversation_messages").insert(messagesToInsert);
  if (msgInsertErr) {
    console.error("[course-assess:message] Message insert error:", msgInsertErr.message);
    return errorResponse("server_error", "Failed to persist conversation messages", 500, cors);
  }

  // Update quiz_attempts with running state
  const attemptUpdate: Record<string, unknown> = {
    competency_score: competencyScore,
    questions_covered: allCoveredIds,
  };

  if (teachingMoment) {
    attemptUpdate.teaching_moments = currentTeachingMoments + 1;
  }

  // Count additional topics beyond preloaded question set
  const coveredTopicCount = allCoveredIds.length;
  const assessedTopicCount = (aiResponse.topics_assessed || []).length;
  const newAdditional = Math.max(0, assessedTopicCount - coveredTopicCount);
  if (newAdditional > 0 && newAdditional > currentAdditionalAsked) {
    attemptUpdate.additional_questions_asked = newAdditional;
  }

  if (shouldWrapUp) {
    attemptUpdate.status = "awaiting_evaluation";
  }

  const { error: attemptUpdateErr } = await supabase
    .from("quiz_attempts")
    .update(attemptUpdate)
    .eq("id", attemptId);
  if (attemptUpdateErr) {
    console.error("[course-assess:message] Attempt update error:", attemptUpdateErr.message);
  }

  // Track credits (course_player/quiz_interactive)
  const msgCredits = await getCreditCost(supabase, groupId, "course_player", "quiz_interactive");
  await trackAndIncrement(supabase, userId, groupId, msgCredits, {
    domain: "course_player",
    action: "quiz_interactive",
    edge_function: "course-assess",
    model: "gpt-5.2",
    metadata: { attempt_id: attemptId, section_id: sectionId },
  });

  console.log(
    `[course-assess:message] Reply ready | Score: ${competencyScore} | Topics: ${allCoveredIds.length}/${topicsTotal} | Teaching: ${teachingMoment} | WrapUp: ${shouldWrapUp}`,
  );

  // RETURN CLIENT-SAFE RESPONSE
  return jsonResponse({
    reply: aiResponse.reply,
    topics_covered: allCoveredIds.length,
    topics_total: topicsTotal,
    teaching_moment: teachingMoment,
    wrap_up: shouldWrapUp,
    attempt_id: attemptId,
  }, 200, cors);
}

// =============================================================================
// HELPER: Build the full system prompt with questions context
// =============================================================================

async function buildSystemPrompt(
  supabase: SupabaseClient,
  questions: Array<Record<string, unknown>>,
  contentContext: string,
  language: string,
): Promise<string | null> {
  // Fetch the assessment-conductor prompt from ai_prompts
  const { data: promptData } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", "assessment-conductor")
    .eq("is_active", true)
    .single();

  if (!promptData) {
    console.error("[course-assess] Assessment prompt 'assessment-conductor' not found");
    return null;
  }

  const basePrompt =
    language === "es" && promptData.prompt_es
      ? promptData.prompt_es
      : promptData.prompt_en;

  // Build questions context (with correct answers -- server-side only!)
  const isEs = language === "es";
  const questionsContext = questions
    .map((q, i) => {
      const qText =
        isEs && q.question_es ? (q.question_es as string) : (q.question_en as string);
      const opts = q.options as Array<Record<string, unknown>> | null;
      const correct = opts?.find((o) => o.correct === true);
      const correctText = correct
        ? isEs && correct.text_es
          ? (correct.text_es as string)
          : (correct.text_en as string)
        : "";
      const explanation =
        isEs && q.explanation_es
          ? (q.explanation_es as string)
          : (q.explanation_en as string);
      return `Topic ${i + 1} [ID: ${q.id}]: ${qText}\nCorrect Answer: ${correctText}${explanation ? `\nExplanation: ${explanation}` : ""}`;
    })
    .join("\n\n");

  return `${basePrompt}

ASSESSMENT TOPICS (${questions.length} topics to cover):
${questionsContext}

IMPORTANT: When reporting questions_covered, you MUST return the exact UUID strings from the [ID: ...] tags above. Do NOT return topic text or numbers.

TRAINING CONTENT:
${contentContext}`;
}
