/**
 * Course Evaluate Edge Function
 *
 * Three MVP actions:
 *   1. grade_mc           — Server-side MC grading (no AI, checks correct option)
 *   2. section_evaluation — AI dual feedback after quiz completion
 *   3. course_final       — Comprehensive AI evaluation (manager-only)
 *
 * Deferred actions:
 *   - grade_voice             — Phase 7 (Voice Quiz)
 *   - module_test_evaluation  — Phase 8 (Module Tests)
 *   - conversation_evaluation — Phase 9 (Interactive AI Quiz)
 *
 * Auth: verify_jwt=false — manual JWT verification via authenticateWithUser()
 * Credit tracking: grade_mc=0, section_evaluation=1, course_final=1
 * Model: gpt-5.2 (reasoning model)
 */

import { corsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithUser, AuthError } from "../_shared/auth.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";
import { callOpenAI, OpenAIError } from "../_shared/openai.ts";
import { checkUsage, UsageError } from "../_shared/usage.ts";
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";

// =============================================================================
// SECTION EVALUATION SCHEMA (dual feedback — structured output)
// =============================================================================

const sectionEvalSchema = {
  type: "object" as const,
  properties: {
    competency_level: {
      type: "string" as const,
      enum: ["novice", "competent", "proficient", "expert"],
    },
    student_feedback: {
      type: "object" as const,
      properties: {
        strengths: { type: "array" as const, items: { type: "string" as const } },
        areas_for_improvement: { type: "array" as const, items: { type: "string" as const } },
        encouragement: { type: "string" as const },
      },
      required: ["strengths", "areas_for_improvement", "encouragement"],
      additionalProperties: false,
    },
    manager_feedback: {
      type: "object" as const,
      properties: {
        competency_gaps: { type: "array" as const, items: { type: "string" as const } },
        recommended_actions: { type: "array" as const, items: { type: "string" as const } },
        risk_level: {
          type: "string" as const,
          enum: ["low", "medium", "high"],
        },
      },
      required: ["competency_gaps", "recommended_actions", "risk_level"],
      additionalProperties: false,
    },
  },
  required: ["competency_level", "student_feedback", "manager_feedback"],
  additionalProperties: false,
};

// =============================================================================
// TYPES
// =============================================================================

interface SectionEvalResult {
  competency_level: string;
  student_feedback: {
    strengths: string[];
    areas_for_improvement: string[];
    encouragement: string;
  };
  manager_feedback: {
    competency_gaps: string[];
    recommended_actions: string[];
    risk_level: string;
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[evaluate] Request received");

  try {
    // 1. Authenticate (users taking quizzes, not just managers)
    const { userId, supabase } = await authenticateWithUser(req);

    // 2. Parse request
    const body = await req.json();
    const { action, language = "en", groupId } = body;

    if (!action) {
      return errorResponse("bad_request", "action is required", 400);
    }
    if (!groupId) {
      return errorResponse("bad_request", "groupId is required", 400);
    }

    console.log(`[evaluate] Action: ${action} | Lang: ${language}`);

    // 3. Route to action handler
    switch (action) {
      case "grade_mc":
        return await handleGradeMC(supabase, userId, body, language);

      case "section_evaluation":
        return await handleSectionEvaluation(supabase, userId, groupId, body, language);

      case "course_final":
        return await handleCourseFinal(supabase, userId, groupId, body, language);

      // ── Deferred actions ──────────────────────────────────────────────
      // Phase 7: Voice quiz grading
      case "grade_voice":
        return errorResponse("not_implemented", "Voice quiz grading is not yet available (Phase 7)", 501);

      // Phase 8: Module/certification test evaluation
      case "module_test_evaluation":
        return errorResponse("not_implemented", "Module test evaluation is not yet available (Phase 8)", 501);

      // Phase 9: Interactive AI conversational assessment evaluation
      case "conversation_evaluation":
        return errorResponse("not_implemented", "Conversation evaluation is not yet available (Phase 9)", 501);

      default:
        return errorResponse("bad_request", `Unknown action: ${action}`, 400);
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
    console.error("[evaluate] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});

// =============================================================================
// ACTION 1: grade_mc — Server-side MC grading (no AI call, 0 credits)
// =============================================================================

async function handleGradeMC(
  supabase: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
  language: string,
) {
  const { attempt_id, question_id, selected_option, time_spent_seconds = 0 } = body;

  if (!attempt_id || !question_id || !selected_option) {
    return errorResponse("bad_request", "attempt_id, question_id, and selected_option are required", 400);
  }

  // Verify attempt belongs to user and is in_progress
  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select("id, user_id, status")
    .eq("id", attempt_id)
    .single();

  if (attemptError || !attempt) {
    return errorResponse("not_found", "Quiz attempt not found", 404);
  }
  if (attempt.user_id !== userId) {
    return errorResponse("forbidden", "Not your quiz attempt", 403);
  }
  if (attempt.status !== "in_progress") {
    return errorResponse("bad_request", "Quiz attempt is not in progress", 400);
  }

  // Check for duplicate answer (idempotency guard)
  const { count: existingCount } = await supabase
    .from("quiz_attempt_answers")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attempt_id)
    .eq("question_id", question_id);

  if (existingCount && existingCount > 0) {
    return errorResponse("bad_request", "Question already answered", 400);
  }

  // Fetch question with correct answer
  const { data: question, error: questionError } = await supabase
    .from("quiz_questions")
    .select("id, options, question_en, question_es, explanation_en, explanation_es, section_id")
    .eq("id", question_id)
    .single();

  if (questionError || !question) {
    return errorResponse("not_found", "Question not found", 404);
  }

  // Find correct option
  const options = question.options as Array<Record<string, unknown>>;
  const correctOption = options.find((o) => o.correct === true);
  const isCorrect = selected_option === correctOption?.id;

  const isEs = language === "es";
  const correctText = isEs && correctOption?.text_es
    ? correctOption.text_es as string
    : correctOption?.text_en as string;

  const explanation = isEs && question.explanation_es
    ? question.explanation_es
    : question.explanation_en || null;

  // Insert answer record
  const { error: answerError } = await supabase
    .from("quiz_attempt_answers")
    .insert({
      attempt_id,
      question_id,
      selected_option: selected_option as string,
      is_correct: isCorrect,
      time_spent_seconds: time_spent_seconds as number,
    });

  if (answerError) {
    console.error("[evaluate:grade_mc] Answer insert error:", answerError.message);
    return errorResponse("server_error", "Failed to save answer", 500);
  }

  // Update question analytics via RPC (best-effort, don't block grading)
  try {
    const { error: rpcErr } = await supabase.rpc("increment_quiz_question_stats", {
      p_question_id: question_id,
      p_was_correct: isCorrect,
    });
    if (rpcErr) {
      // Fallback: direct update if RPC is not yet deployed
      await supabase
        .from("quiz_questions")
        .update({
          times_shown: ((question as Record<string, unknown>).times_shown as number || 0) + 1,
          times_correct: ((question as Record<string, unknown>).times_correct as number || 0) + (isCorrect ? 1 : 0),
        })
        .eq("id", question_id);
    }
  } catch {
    console.error("[evaluate:grade_mc] Analytics update failed (non-critical)");
  }

  console.log(`[evaluate:grade_mc] Question ${question_id}: ${isCorrect ? "correct" : "incorrect"}`);

  return jsonResponse({
    is_correct: isCorrect,
    correct_option_id: correctOption?.id,
    correct_option_text: correctText,
    explanation,
  });
}

// =============================================================================
// ACTION 2: section_evaluation — Dual feedback after quiz completion (1 credit)
// =============================================================================

async function handleSectionEvaluation(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  body: Record<string, unknown>,
  language: string,
) {
  const { attempt_id, section_id, enrollment_id } = body;

  if (!attempt_id || !section_id) {
    return errorResponse("bad_request", "attempt_id and section_id are required", 400);
  }

  // Fetch attempt and verify ownership
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("id", attempt_id)
    .eq("user_id", userId)
    .single();

  if (!attempt) {
    return errorResponse("not_found", "Quiz attempt not found", 404);
  }

  // Fetch all answers for this attempt with questions
  const { data: answers } = await supabase
    .from("quiz_attempt_answers")
    .select("*, quiz_questions(*)")
    .eq("attempt_id", attempt_id);

  if (!answers || answers.length === 0) {
    return errorResponse("bad_request", "No answers found for this attempt", 400);
  }

  // Calculate score (MC only for MVP — voice answers deferred to Phase 7)
  let totalPoints = 0;
  let earnedPoints = 0;

  for (const answer of answers) {
    const question = answer.quiz_questions as Record<string, unknown> | null;
    if (!question) {
      console.warn("[evaluate:section] Skipping answer with inaccessible question:", answer.id);
      continue;
    }
    // MC questions: 100 points each
    totalPoints += 100;
    earnedPoints += answer.is_correct ? 100 : 0;
  }

  const finalScore = totalPoints > 0
    ? Math.round((earnedPoints / totalPoints) * 100)
    : 0;

  // Fetch course via section to get quiz_config for passing score
  const { data: section } = await supabase
    .from("course_sections")
    .select("title_en, title_es, course_id")
    .eq("id", section_id)
    .single();

  // Get passing score from course.quiz_config
  let passingScore = 70; // default
  if (section?.course_id) {
    const { data: course } = await supabase
      .from("courses")
      .select("quiz_config")
      .eq("id", section.course_id)
      .single();

    if (course?.quiz_config) {
      const qc = course.quiz_config as Record<string, unknown>;
      passingScore = (qc.passing_score as number) || 70;
    }
  }

  const passed = finalScore >= passingScore;

  // Determine competency level
  let competencyLevel: string;
  if (finalScore >= 90) competencyLevel = "expert";
  else if (finalScore >= 80) competencyLevel = "proficient";
  else if (finalScore >= 60) competencyLevel = "competent";
  else competencyLevel = "novice";

  // Mark attempt as completed
  await supabase
    .from("quiz_attempts")
    .update({
      status: "completed",
      score: finalScore,
      passed,
      competency_score: finalScore,
    })
    .eq("id", attempt_id);

  // Update section_progress
  if (enrollment_id) {
    const { data: progress } = await supabase
      .from("section_progress")
      .select("id, quiz_attempts")
      .eq("user_id", userId)
      .eq("section_id", section_id)
      .maybeSingle();

    if (progress) {
      const updates: Record<string, unknown> = {
        quiz_score: finalScore,
        quiz_passed: passed,
        quiz_attempts: (progress.quiz_attempts || 0) + 1,
      };

      await supabase
        .from("section_progress")
        .update(updates)
        .eq("id", progress.id);
    }
  }

  // Check usage before AI call
  const usage = await checkUsage(supabase, userId, groupId);
  if (!usage?.can_ask) {
    return jsonResponse({
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      student_feedback: {
        strengths: [],
        areas_for_improvement: [],
        encouragement: passed
          ? language === "es" ? "Aprobaste el quiz!" : "You passed the quiz!"
          : language === "es" ? "Sigue practicando!" : "Keep practicing!",
      },
    });
  }

  // Fetch evaluation prompt
  const { data: promptData } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", "quiz-section-evaluation")
    .eq("is_active", true)
    .single();

  if (!promptData) {
    return jsonResponse({
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      student_feedback: {
        strengths: [],
        areas_for_improvement: [],
        encouragement: passed
          ? language === "es" ? "Aprobaste!" : "You passed!"
          : language === "es" ? "Sigue intentando!" : "Keep trying!",
      },
    });
  }

  // Build context for AI
  const isEs = language === "es";
  const systemPrompt = isEs && promptData.prompt_es
    ? promptData.prompt_es
    : promptData.prompt_en;

  const answersContext = answers
    .map((a: Record<string, unknown>) => {
      const q = a.quiz_questions as Record<string, unknown>;
      const questionText = isEs && q.question_es ? q.question_es : q.question_en;
      return `Q: ${questionText}\nAnswer: ${a.is_correct ? "CORRECT" : "INCORRECT"} (selected: ${a.selected_option})`;
    })
    .join("\n\n");

  const sectionTitle = isEs && section?.title_es
    ? section.title_es
    : section?.title_en || "Unknown";

  const userPrompt = `Section: ${sectionTitle}\nOverall Score: ${finalScore}%\nPassed: ${passed ? "Yes" : "No"}\nCompetency Level: ${competencyLevel}\n\nQuiz Results:\n${answersContext}\n\nGenerate the dual evaluation feedback.`;

  // Call OpenAI (with graceful degradation)
  console.log("[evaluate:section] Calling OpenAI for dual feedback...");

  let evalResult: SectionEvalResult;
  try {
    evalResult = await callOpenAI<SectionEvalResult>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      schema: sectionEvalSchema,
      schemaName: "section_evaluation",
      maxTokens: 1000,
      model: "gpt-5.2",
    });
  } catch (err) {
    console.error("[evaluate:section] AI error:", err instanceof Error ? err.message : err);
    return jsonResponse({
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      student_feedback: {
        strengths: [],
        areas_for_improvement: [],
        encouragement: passed ? "Well done!" : "Keep practicing!",
      },
    });
  }

  // Track credit usage (1 credit for section_evaluation)
  const credits = await getCreditCost(supabase, groupId, "course_player", "quiz_mc");
  // section_evaluation uses AI so it costs 1 credit regardless of quiz_mc cost
  await trackAndIncrement(supabase, userId, groupId, Math.max(credits, 1), {
    domain: "course_player",
    action: "section_evaluation",
    edge_function: "course-evaluate",
    model: "gpt-5.2",
  });

  // NOTE: evaluations table does not exist yet (Phase 8).
  // Evaluation storage is deferred — the student_feedback is returned directly.
  // When the evaluations table is created, uncomment the following:
  //
  // await supabase.from("evaluations").insert({
  //   user_id: userId,
  //   enrollment_id: enrollment_id || null,
  //   section_id,
  //   eval_type: "quiz",
  //   student_feedback: evalResult.student_feedback,
  //   manager_feedback: evalResult.manager_feedback,
  //   competency_level: evalResult.competency_level || competencyLevel,
  // });

  console.log(`[evaluate:section] Score: ${finalScore}%, Level: ${evalResult.competency_level}`);

  // Return ONLY student feedback (manager feedback stays server-side)
  return jsonResponse({
    score: finalScore,
    passed,
    competency_level: evalResult.competency_level || competencyLevel,
    student_feedback: evalResult.student_feedback,
  });
}

// =============================================================================
// ACTION 3: course_final — Comprehensive AI evaluation (manager-only, 1 credit)
// =============================================================================

async function handleCourseFinal(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
  body: Record<string, unknown>,
  language: string,
) {
  const { target_user_id } = body;

  if (!target_user_id) {
    return errorResponse("bad_request", "target_user_id is required", 400);
  }

  // 1. Verify caller is manager or admin
  //    get_user_role() uses auth.uid() which is not set on service-role client,
  //    so we query group_memberships directly.
  const { data: membership } = await supabase
    .from("group_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .single();

  const callerRole = membership?.role as string | null;
  if (!callerRole || (callerRole !== "manager" && callerRole !== "admin")) {
    return errorResponse("forbidden", "Only managers and admins can generate course evaluations", 403);
  }

  // 2. Fetch all course enrollments for target user
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("*, courses(title_en, title_es)")
    .eq("user_id", target_user_id as string)
    .eq("group_id", groupId);

  if (!enrollments || enrollments.length === 0) {
    return errorResponse("not_found", "No course enrollments found for this user", 404);
  }

  // 3. Fetch all section progress with quiz scores
  const { data: allProgress } = await supabase
    .from("section_progress")
    .select("*, course_sections(title_en, title_es)")
    .eq("user_id", target_user_id as string);

  // 4. Check usage limits
  const usage = await checkUsage(supabase, userId, groupId);
  if (!usage?.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429);
  }

  // 5. Build context for AI
  const isEs = language === "es";

  const enrollmentContext = (enrollments ?? [])
    .map((e: Record<string, unknown>) => {
      const course = e.courses as Record<string, unknown> | null;
      const title = isEs && course?.title_es ? course.title_es : course?.title_en || "Unknown";
      return `Course: ${title}\n  Status: ${e.status}\n  Completed: ${e.completed_sections}/${e.total_sections} sections\n  Final Score: ${e.final_score ?? "N/A"}\n  Final Passed: ${e.final_passed ?? "N/A"}`;
    })
    .join("\n\n");

  const progressContext = (allProgress ?? [])
    .map((p: Record<string, unknown>) => {
      const section = p.course_sections as Record<string, unknown> | null;
      const title = isEs && section?.title_es ? section.title_es : section?.title_en || "Unknown";
      return `Section: ${title}\n  Status: ${p.status}\n  Quiz Score: ${p.quiz_score ?? "N/A"}\n  Quiz Passed: ${p.quiz_passed ?? "N/A"}\n  Quiz Attempts: ${p.quiz_attempts ?? 0}\n  Time Spent: ${p.time_spent_seconds ?? 0}s`;
    })
    .join("\n\n");

  // 6. Fetch evaluation prompt
  const { data: promptData } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", "quiz-section-evaluation")
    .eq("is_active", true)
    .single();

  const systemPrompt = promptData
    ? (isEs && promptData.prompt_es ? promptData.prompt_es : promptData.prompt_en)
    : "You are an expert training evaluator for a restaurant. Generate a comprehensive evaluation based on the student's performance across all courses.";

  const userPrompt = `COMPREHENSIVE COURSE EVALUATION (all courses combined)

Course Enrollments:
${enrollmentContext}

Section Progress:
${progressContext || "No section progress data available."}

Generate a comprehensive dual evaluation with:
1. competency_level (novice/competent/proficient/expert) - based on overall performance
2. student_feedback with strengths, areas_for_improvement, and encouragement
3. manager_feedback with competency_gaps, recommended_actions, and risk_level`;

  // 7. Call OpenAI
  console.log("[evaluate:course_final] Calling OpenAI for comprehensive evaluation...");

  const evalResult = await callOpenAI<SectionEvalResult>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    schema: sectionEvalSchema,
    schemaName: "course_final_evaluation",
    maxTokens: 1200,
    model: "gpt-5.2",
  });

  // 8. Track credit usage (1 credit for course_final)
  await trackAndIncrement(supabase, userId, groupId, 1, {
    domain: "course_player",
    action: "course_final",
    edge_function: "course-evaluate",
    model: "gpt-5.2",
  });

  // NOTE: evaluations table does not exist yet (Phase 8).
  // Evaluation storage is deferred. When the evaluations table is created, uncomment:
  //
  // await supabase.from("evaluations").insert({
  //   user_id: target_user_id as string,
  //   eval_type: "course_final",
  //   student_feedback: evalResult.student_feedback,
  //   manager_feedback: evalResult.manager_feedback,
  //   competency_level: evalResult.competency_level,
  //   evaluated_by: userId,
  // });

  console.log(`[evaluate:course_final] Level: ${evalResult.competency_level}`);

  // 9. Return both feedbacks (caller is manager)
  return jsonResponse({
    competency_level: evalResult.competency_level,
    student_feedback: evalResult.student_feedback,
    manager_feedback: evalResult.manager_feedback,
    cached: false,
  });
}
