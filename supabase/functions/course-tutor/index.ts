/**
 * Course Tutor Edge Function
 *
 * Practice Tutor — conversational AI for course-level practice.
 * Asks open-ended questions, evaluates readiness 0-100, suggests test at 75+.
 *
 * Auth: verify_jwt=false — manual JWT verification via getClaims()
 */

import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithClaims, AuthError } from "../_shared/auth.ts";
import { loadSectionContent } from "../_shared/content.ts";
import { callOpenAI, OpenAIError } from "../_shared/openai.ts";
import { checkUsage, incrementUsage, UsageError } from "../_shared/usage.ts";

// =============================================================================
// TUTOR RESPONSE SCHEMA
// =============================================================================

const tutorResponseSchema = {
  type: "object" as const,
  properties: {
    reply: { type: "string" as const },
    readiness_score: { type: "number" as const },
    suggest_test: { type: "boolean" as const },
    topics_covered: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    questions_asked: { type: "number" as const },
    correct_answers: { type: "number" as const },
  },
  required: ["reply", "readiness_score", "suggest_test", "topics_covered", "questions_asked", "correct_answers"],
  additionalProperties: false,
};

interface TutorResponse {
  reply: string;
  readiness_score: number;
  suggest_test: boolean;
  topics_covered: string[];
  questions_asked: number;
  correct_answers: number;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[course-tutor] Request received");

  try {
    // 1. Authenticate
    const { userId, supabase } = await authenticateWithClaims(req);

    // 2. Parse request
    const body = await req.json();
    const { course_id, language = "en", groupId, message, session_id } = body;

    if (!course_id || !groupId || !message) {
      return errorResponse("bad_request", "course_id, groupId, and message are required", 400);
    }

    // 3. Check usage limits
    const usage = await checkUsage(supabase, userId, groupId);
    if (!usage?.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429);
    }

    // 4. Fetch practice-tutor system prompt
    const { data: promptData } = await supabase
      .from("ai_prompts")
      .select("prompt_en, prompt_es")
      .eq("slug", "practice-tutor")
      .eq("is_active", true)
      .single();

    if (!promptData) {
      return errorResponse("server_error", "Tutor prompt not configured", 500);
    }

    const systemPrompt = language === "es" && promptData.prompt_es
      ? promptData.prompt_es
      : promptData.prompt_en;

    // 5. Fetch all course sections and their content
    const { data: sections } = await supabase
      .from("course_sections")
      .select("id, content_source, content_ids, title_en, title_es")
      .eq("course_id", course_id)
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    const contentContext = sections && sections.length > 0
      ? await loadSectionContent(supabase, sections, language)
      : "";

    // 6. Load existing session if provided
    let existingMessages: Array<{ role: string; content: string }> = [];
    let existingSession: Record<string, unknown> | null = null;

    if (session_id) {
      const { data: session } = await supabase
        .from("tutor_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();

      if (session) {
        existingSession = session;
        existingMessages = (session.messages as Array<{ role: string; content: string }>) || [];
      }
    }

    // 7. Build messages for OpenAI
    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: `${systemPrompt}\n\nCourse Content:\n${contentContext}` },
    ];

    const historySlice = existingMessages.slice(-20);
    for (const msg of historySlice) {
      aiMessages.push({ role: msg.role, content: msg.content });
    }
    aiMessages.push({ role: "user", content: message });

    // 8. Call OpenAI
    console.log("[course-tutor] Calling OpenAI...");

    const tutorResponse = await callOpenAI<TutorResponse>({
      messages: aiMessages,
      schema: tutorResponseSchema,
      schemaName: "tutor_response",
      temperature: 0.6,
      maxTokens: 800,
    });

    // Increment usage
    await incrementUsage(supabase, userId, groupId);

    // 9. Upsert tutor_sessions
    const now = new Date().toISOString();
    const updatedMessages = [
      ...existingMessages,
      { role: "user", content: message, timestamp: now },
      { role: "assistant", content: tutorResponse.reply, timestamp: now, readinessScore: tutorResponse.readiness_score },
    ];

    let sessionId = session_id;

    if (existingSession) {
      await supabase
        .from("tutor_sessions")
        .update({
          messages: updatedMessages,
          questions_asked: tutorResponse.questions_asked,
          correct_answers: tutorResponse.correct_answers,
          readiness_score: tutorResponse.readiness_score,
          readiness_suggested: tutorResponse.suggest_test,
          topics_covered: tutorResponse.topics_covered,
          updated_at: now,
        })
        .eq("id", session_id);
    } else {
      const { data: enrollment } = await supabase
        .from("course_enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", course_id)
        .maybeSingle();

      const { data: newSession, error: insertError } = await supabase
        .from("tutor_sessions")
        .insert({
          user_id: userId,
          course_id,
          enrollment_id: enrollment?.id || null,
          messages: updatedMessages,
          questions_asked: tutorResponse.questions_asked,
          correct_answers: tutorResponse.correct_answers,
          readiness_score: tutorResponse.readiness_score,
          readiness_suggested: tutorResponse.suggest_test,
          topics_covered: tutorResponse.topics_covered,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[course-tutor] Session insert error:", insertError.message);
      } else {
        sessionId = newSession.id;
      }
    }

    console.log(`[course-tutor] Readiness: ${tutorResponse.readiness_score}, Suggest: ${tutorResponse.suggest_test}`);

    return jsonResponse({
      reply: tutorResponse.reply,
      readiness_score: tutorResponse.readiness_score,
      suggest_test: tutorResponse.suggest_test,
      topics_covered: tutorResponse.topics_covered,
      session_id: sessionId,
    });
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
    console.error("[course-tutor] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
