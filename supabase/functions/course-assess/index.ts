/**
 * Course Assess Edge Function
 *
 * Conversational assessment — AI-led conversation to evaluate a trainee's
 * knowledge of a course section. Uses quiz_questions as topic guides,
 * stores messages in conversation_messages child table, and tracks
 * running competency on quiz_attempts (quiz_mode='conversation').
 *
 * Two actions:
 *   1. start   — Creates a new quiz_attempt + sends the AI's opening question
 *   2. message — Continues the conversation, persists messages, returns AI reply
 *
 * Auth: verify_jwt=false — manual JWT verification via getUser()
 */

import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithUser, AuthError } from "../_shared/auth.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import { loadSectionContent } from "../_shared/content.ts";
import { callOpenAI, OpenAIError } from "../_shared/openai.ts";
import { checkUsage, incrementUsage, UsageError } from "../_shared/usage.ts";

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
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Step 1: CORS + OPTIONS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
      );
    }

    if (action !== "start" && action !== "message") {
      return errorResponse("bad_request", `Unknown action: ${action}`, 400);
    }

    if (action === "message" && (!message || !attempt_id)) {
      return errorResponse(
        "bad_request",
        "message and attempt_id are required for action='message'",
        400,
      );
    }

    // M4: Message length validation
    if (action === "message" && typeof message === "string" && message.length > 4000) {
      return errorResponse("bad_request", "Message too long (max 4000 characters)", 400);
    }

    console.log(`[course-assess] Action: ${action} | Section: ${section_id} | Lang: ${language}`);

    // Step 4: CHECK USAGE QUOTA
    const usage = await checkUsage(supabase, userId, groupId);
    if (!usage) {
      return errorResponse("forbidden", "Not a member of this group", 403);
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
      );
    }

    // Route to the appropriate handler
    if (action === "start") {
      return await handleStart(supabase, userId, section_id, enrollment_id, language, groupId);
    } else {
      return await handleMessage(
        supabase,
        userId,
        attempt_id,
        message,
        language,
        groupId,
      );
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse("Unauthorized", err.message, 401);
    }
    if (err instanceof OpenAIError) {
      return errorResponse("ai_error", err.message, err.status);
    }
    if (err instanceof UsageError) {
      return errorResponse("server_error", err.message, 500);
    }
    console.error("[course-assess] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500,
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
): Promise<Response> {
  // M5: Verify enrollment belongs to this user
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("id", enrollmentId)
    .eq("user_id", userId)
    .single();

  if (!enrollment) {
    return errorResponse("forbidden", "Enrollment not found or not yours", 403);
  }

  // m1: Prevent concurrent in-progress conversation assessments for same section
  const { count: inProgressCount } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("section_id", sectionId)
    .eq("quiz_mode", "conversation")
    .eq("status", "in_progress");

  if ((inProgressCount || 0) > 0) {
    return errorResponse(
      "conflict",
      "You already have an in-progress conversation assessment for this section",
      409,
    );
  }

  // Step 5a: Load active quiz questions for the section
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
    );
  }

  console.log(`[course-assess:start] Found ${questions.length} questions`);

  // Create quiz_attempt
  const { count } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("section_id", sectionId);

  const attemptNumber = (count || 0) + 1;

  const { data: newAttempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      section_id: sectionId,
      enrollment_id: enrollmentId,
      attempt_number: attemptNumber,
      quiz_mode: "conversation",
      status: "in_progress",
      transcript_expires_at: new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .select("id")
    .single();

  if (attemptError || !newAttempt) {
    console.error("[course-assess:start] Attempt create error:", attemptError?.message);
    return errorResponse("server_error", "Failed to create assessment attempt", 500);
  }

  const attemptId = newAttempt.id as string;
  console.log(`[course-assess:start] Created attempt: ${attemptId} (attempt #${attemptNumber})`);

  // Load section content
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, content_source, content_ids, title_en, title_es")
    .eq("id", sectionId)
    .eq("status", "published");

  const contentContext =
    sections && sections.length > 0
      ? await loadSectionContent(supabase, sections, language)
      : "";

  // Step 6: BUILD SYSTEM PROMPT
  const systemPrompt = await buildSystemPrompt(
    supabase,
    questions,
    contentContext,
    language,
  );
  if (!systemPrompt) {
    return errorResponse("server_error", "Assessment prompt not configured", 500);
  }

  // Step 7: BUILD MESSAGES + CALL OPENAI
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

  // Step 8: VALIDATE AI RESPONSE
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

  // Step 9: PERSIST (M1: check for errors)
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
    return errorResponse("server_error", "Failed to persist conversation messages", 500);
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

  // Step 10: INCREMENT USAGE
  await incrementUsage(supabase, userId, groupId);

  console.log(
    `[course-assess:start] Reply ready | Score: ${competencyScore} | Topics: ${coveredIds.length}/${questions.length} | WrapUp: ${shouldWrapUp}`,
  );

  // Step 11: RETURN CLIENT-SAFE RESPONSE
  return jsonResponse({
    reply: aiResponse.reply,
    topics_covered: coveredIds.length,
    topics_total: questions.length,
    teaching_moment: teachingMoment,
    wrap_up: shouldWrapUp,
    attempt_id: attemptId,
  });
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
): Promise<Response> {
  // Step 5b-a: Load attempt and verify ownership
  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select(
      "id, user_id, status, quiz_mode, section_id, enrollment_id, competency_score, questions_covered, teaching_moments, additional_questions_asked",
    )
    .eq("id", attemptId)
    .single();

  if (attemptError || !attempt) {
    return errorResponse("not_found", "Attempt not found", 404);
  }
  if (attempt.user_id !== userId) {
    return errorResponse("forbidden", "Not your attempt", 403);
  }
  if (attempt.status !== "in_progress") {
    return errorResponse("bad_request", "Attempt not in progress", 400);
  }
  if (attempt.quiz_mode !== "conversation") {
    return errorResponse("bad_request", "Not a conversation attempt", 400);
  }

  const sectionId = attempt.section_id as string;
  const currentTeachingMoments = (attempt.teaching_moments as number) || 0;
  const currentAdditionalAsked = (attempt.additional_questions_asked as number) || 0;

  // Step 5b-b: Load active questions for topics_total (needed for force-wrap-up response)
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

    // Insert the user message and a wrap-up assistant message (M1: check errors)
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

    // Update attempt status
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
    });
  }

  // Step 5b-c: Load section content
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, content_source, content_ids, title_en, title_es")
    .eq("id", sectionId)
    .eq("status", "published");

  const contentContext =
    sections && sections.length > 0
      ? await loadSectionContent(supabase, sections, language)
      : "";

  // Step 5b-d: Load conversation history (last 20 messages)
  const { data: messages } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: true });

  const historySlice = (messages || []).slice(-20);

  // Step 6: BUILD SYSTEM PROMPT
  const systemPrompt = await buildSystemPrompt(
    supabase,
    questions || [],
    contentContext,
    language,
  );
  if (!systemPrompt) {
    return errorResponse("server_error", "Assessment prompt not configured", 500);
  }

  // Step 7: BUILD MESSAGES + CALL OPENAI
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

  // Step 8: VALIDATE AI RESPONSE
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

  // Step 9: PERSIST (M1: check for errors)
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
    return errorResponse("server_error", "Failed to persist conversation messages", 500);
  }

  // Update quiz_attempts with running state
  const attemptUpdate: Record<string, unknown> = {
    competency_score: competencyScore,
    questions_covered: allCoveredIds,
  };

  if (teachingMoment) {
    attemptUpdate.teaching_moments = currentTeachingMoments + 1;
  }

  // M3: Count additional topics beyond preloaded question set using topics_assessed text
  // topics_assessed are human-readable labels, not UUIDs — count topics that are genuinely new
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

  // Step 10: INCREMENT USAGE
  await incrementUsage(supabase, userId, groupId);

  console.log(
    `[course-assess:message] Reply ready | Score: ${competencyScore} | Topics: ${allCoveredIds.length}/${topicsTotal} | Teaching: ${teachingMoment} | WrapUp: ${shouldWrapUp}`,
  );

  // Step 11: RETURN CLIENT-SAFE RESPONSE
  return jsonResponse({
    reply: aiResponse.reply,
    topics_covered: allCoveredIds.length,
    topics_total: topicsTotal,
    teaching_moment: teachingMoment,
    wrap_up: shouldWrapUp,
    attempt_id: attemptId,
  });
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
