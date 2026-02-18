/**
 * Course Evaluate Edge Function
 *
 * Three actions:
 *   1. grade_mc — Server-side MC grading (no AI, checks correct option)
 *   2. grade_voice — AI evaluation of voice transcription against rubric
 *   3. section_evaluation — AI dual feedback after quiz completion
 *
 * Auth: verify_jwt=false — manual JWT verification via getClaims()
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// CORS
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// =============================================================================
// HELPERS
// =============================================================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: string, message?: string, status = 400) {
  const body: Record<string, unknown> = { error };
  if (message) body.message = message;
  return jsonResponse(body, status);
}

// =============================================================================
// VOICE EVALUATION SCHEMA (OpenAI structured output)
// =============================================================================

const voiceEvalSchema = {
  type: "object" as const,
  properties: {
    total_score: { type: "number" as const },
    criteria_scores: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          criterion: { type: "string" as const },
          points_earned: { type: "number" as const },
          points_possible: { type: "number" as const },
          met: { type: "boolean" as const },
        },
        required: ["criterion", "points_earned", "points_possible", "met"],
        additionalProperties: false,
      },
    },
    feedback_en: { type: "string" as const },
    feedback_es: { type: "string" as const },
  },
  required: ["total_score", "criteria_scores", "feedback_en", "feedback_es"],
  additionalProperties: false,
};

// =============================================================================
// SECTION EVALUATION SCHEMA (dual feedback)
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
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[evaluate] Request received");

  try {
    // =========================================================================
    // 1. AUTHENTICATE
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", "Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseAuth.auth.getUser(token);

    if (userError || !userData?.user) {
      return errorResponse("Unauthorized", "Invalid token", 401);
    }

    const userId = userData.user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. PARSE REQUEST
    // =========================================================================
    const body = await req.json();
    const { action, language = "en", groupId } = body;

    if (!action) {
      return errorResponse("bad_request", "action is required", 400);
    }
    if (!groupId) {
      return errorResponse("bad_request", "groupId is required", 400);
    }

    console.log(`[evaluate] Action: ${action} | Lang: ${language}`);

    // =========================================================================
    // 3. ROUTE TO ACTION HANDLER
    // =========================================================================
    switch (action) {
      case "grade_mc":
        return await handleGradeMC(supabase, userId, body, language);

      case "grade_voice":
        return await handleGradeVoice(supabase, userId, groupId, body, language);

      case "section_evaluation":
        return await handleSectionEvaluation(supabase, userId, groupId, body, language);

      case "module_test_evaluation":
        return await handleModuleTestEvaluation(supabase, userId, groupId, body, language);

      case "course_final":
        return await handleCourseFinal(supabase, userId, groupId, body, language);

      default:
        return errorResponse("bad_request", `Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error("[evaluate] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});

// =============================================================================
// ACTION A: grade_mc — Server-side MC grading (no AI call)
// =============================================================================

async function handleGradeMC(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
  language: string,
) {
  const { attempt_id, question_id, selected_option, time_spent_seconds = 0, attempt_type = "section_quiz" } = body;

  if (!attempt_id || !question_id || !selected_option) {
    return errorResponse("bad_request", "attempt_id, question_id, and selected_option are required", 400);
  }

  const isModuleTest = attempt_type === "module_test";
  const attemptsTable = isModuleTest ? "module_test_attempts" : "quiz_attempts";
  const answersTable = isModuleTest ? "module_test_answers" : "quiz_attempt_answers";

  // Verify attempt belongs to user and is in_progress
  const { data: attempt, error: attemptError } = await supabase
    .from(attemptsTable)
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
    .from(answersTable)
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
  const answerRow: Record<string, unknown> = {
    attempt_id,
    question_id,
    selected_option: selected_option as string,
    is_correct: isCorrect,
    time_spent_seconds: time_spent_seconds as number,
  };
  if (isModuleTest) {
    answerRow.section_id = question.section_id;
  }

  const { error: answerError } = await supabase
    .from(answersTable)
    .insert(answerRow);

  if (answerError) {
    console.error("[evaluate:grade_mc] Answer insert error:", answerError.message);
    return errorResponse("server_error", "Failed to save answer", 500);
  }

  // Update question analytics (best-effort, don't block grading)
  try {
    const { error: rpcErr } = await supabase.rpc("increment_quiz_question_stats", {
      _question_id: question_id,
      _was_correct: isCorrect,
    });
    if (rpcErr) {
      // RPC doesn't exist — fallback to direct update
      await supabase
        .from("quiz_questions")
        .update({
          times_shown: ((question as Record<string, unknown>).times_shown as number || 0) + 1,
          times_correct: ((question as Record<string, unknown>).times_correct as number || 0) + (isCorrect ? 1 : 0),
        })
        .eq("id", question_id);
    }
  } catch {
    // Analytics failure should never block grading
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
// ACTION B: grade_voice — AI rubric evaluation
// =============================================================================

async function handleGradeVoice(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  groupId: string,
  body: Record<string, unknown>,
  language: string,
) {
  const { attempt_id, question_id, transcription, time_spent_seconds = 0, attempt_type = "section_quiz" } = body;

  if (!attempt_id || !question_id || !transcription) {
    return errorResponse("bad_request", "attempt_id, question_id, and transcription are required", 400);
  }

  const isModuleTest = attempt_type === "module_test";
  const attemptsTable = isModuleTest ? "module_test_attempts" : "quiz_attempts";
  const answersTable = isModuleTest ? "module_test_answers" : "quiz_attempt_answers";

  // Check for duplicate answer
  const { count: existingVoiceCount } = await supabase
    .from(answersTable)
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attempt_id)
    .eq("question_id", question_id);

  if (existingVoiceCount && existingVoiceCount > 0) {
    return errorResponse("bad_request", "Question already answered", 400);
  }

  // Verify attempt
  const { data: attempt } = await supabase
    .from(attemptsTable)
    .select(isModuleTest ? "id, user_id, status, course_id" : "id, user_id, status, section_id")
    .eq("id", attempt_id)
    .single();

  if (!attempt || attempt.user_id !== userId || attempt.status !== "in_progress") {
    return errorResponse("forbidden", "Invalid or completed quiz attempt", 403);
  }

  // Fetch question with rubric
  const { data: question } = await supabase
    .from("quiz_questions")
    .select("id, question_en, question_es, rubric, section_id")
    .eq("id", question_id)
    .single();

  if (!question || !question.rubric) {
    return errorResponse("not_found", "Voice question not found", 404);
  }

  // Validate question belongs to this attempt (section check for section_quiz only)
  if (!isModuleTest && question.section_id !== attempt.section_id) {
    return errorResponse("forbidden", "Question does not belong to this quiz", 403);
  }

  // Check usage limits
  const { data: usageData } = await supabase.rpc("get_user_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  const usage = usageData?.[0];
  if (!usage?.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429);
  }

  // Fetch evaluator prompt
  const { data: promptData } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", "quiz-voice-evaluator")
    .eq("is_active", true)
    .single();

  if (!promptData) {
    return errorResponse("server_error", "Voice evaluator prompt not configured", 500);
  }

  const systemPrompt =
    language === "es" && promptData.prompt_es
      ? promptData.prompt_es
      : promptData.prompt_en;

  const isEs = language === "es";
  const questionText = isEs && question.question_es
    ? question.question_es
    : question.question_en;

  const rubricText = (question.rubric as Array<Record<string, unknown>>)
    .map((r) => `- ${r.criterion}: ${r.points} points — ${r.description}`)
    .join("\n");

  const userPrompt = `Question: ${questionText}\n\nRubric:\n${rubricText}\n\nStudent's answer (transcription):\n"${transcription}"\n\nEvaluate this answer against the rubric.`;

  // Call OpenAI
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return errorResponse("server_error", "AI service not configured", 500);
  }

  console.log("[evaluate:grade_voice] Calling OpenAI...");

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "voice_evaluation",
          strict: true,
          schema: voiceEvalSchema,
        },
      },
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error("[evaluate:grade_voice] OpenAI error:", aiResponse.status, errorText);
    return errorResponse("ai_error", "Failed to evaluate answer", 500);
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content;

  if (!content) {
    return errorResponse("ai_error", "Empty evaluation response", 500);
  }

  let evalResult: {
    total_score: number;
    criteria_scores: Array<{
      criterion: string;
      points_earned: number;
      points_possible: number;
      met: boolean;
    }>;
    feedback_en: string;
    feedback_es: string;
  };

  try {
    evalResult = JSON.parse(content);
  } catch {
    console.error("[evaluate:grade_voice] Parse error:", content);
    return errorResponse("ai_error", "Invalid evaluation format", 500);
  }

  // Increment usage
  await supabase.rpc("increment_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  // Persist answer
  const voiceScore = Math.min(100, Math.max(0, Math.round(evalResult.total_score)));
  const passed = voiceScore >= 70;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const voiceAnswerRow: Record<string, unknown> = {
    attempt_id,
    question_id,
    transcription: transcription as string,
    voice_score: voiceScore,
    voice_feedback_en: evalResult.feedback_en,
    voice_feedback_es: evalResult.feedback_es,
    is_correct: passed,
    time_spent_seconds: time_spent_seconds as number,
    transcription_expires_at: expiresAt.toISOString(),
  };
  if (isModuleTest) {
    voiceAnswerRow.section_id = question.section_id;
  }

  const { error: answerError } = await supabase
    .from(answersTable)
    .insert(voiceAnswerRow);

  if (answerError) {
    console.error("[evaluate:grade_voice] Answer insert error:", answerError.message);
    return errorResponse("server_error", "Failed to save voice answer", 500);
  }

  // Update question analytics
  await supabase
    .from("quiz_questions")
    .update({
      times_shown: ((question as Record<string, unknown>).times_shown as number || 0) + 1,
      times_correct: ((question as Record<string, unknown>).times_correct as number || 0) + (passed ? 1 : 0),
    })
    .eq("id", question_id);

  console.log(`[evaluate:grade_voice] Score: ${voiceScore}/100, passed: ${passed}`);

  const feedback = isEs ? evalResult.feedback_es : evalResult.feedback_en;

  return jsonResponse({
    voice_score: voiceScore,
    criteria_scores: evalResult.criteria_scores,
    feedback,
    passed,
  });
}

// =============================================================================
// ACTION C: section_evaluation — Dual feedback after quiz completion
// =============================================================================

async function handleSectionEvaluation(
  supabase: ReturnType<typeof createClient>,
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

  // Fetch all answers for this attempt
  const { data: answers } = await supabase
    .from("quiz_attempt_answers")
    .select("*, quiz_questions(*)")
    .eq("attempt_id", attempt_id);

  if (!answers || answers.length === 0) {
    return errorResponse("bad_request", "No answers found for this attempt", 400);
  }

  // Calculate score
  let totalPoints = 0;
  let earnedPoints = 0;

  for (const answer of answers) {
    const question = answer.quiz_questions as Record<string, unknown> | null;
    if (!question) {
      console.warn("[evaluate:section] Skipping answer with inaccessible question:", answer.id);
      continue;
    }
    if (question.question_type === "multiple_choice") {
      totalPoints += 100;
      earnedPoints += answer.is_correct ? 100 : 0;
    } else if (question.question_type === "voice") {
      totalPoints += 100;
      earnedPoints += answer.voice_score || 0;
    }
  }

  const finalScore = totalPoints > 0
    ? Math.round((earnedPoints / totalPoints) * 100)
    : 0;

  // Fetch section config for passing score
  const { data: section } = await supabase
    .from("course_sections")
    .select("quiz_passing_score, title_en, title_es, course_id")
    .eq("id", section_id)
    .single();

  const passingScore = section?.quiz_passing_score || 70;
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
      completed_at: new Date().toISOString(),
    })
    .eq("id", attempt_id);

  // Update section_progress
  if (enrollment_id) {
    // Get current progress
    const { data: progress } = await supabase
      .from("section_progress")
      .select("id, quiz_attempts")
      .eq("user_id", userId)
      .eq("section_id", section_id)
      .maybeSingle();

    if (progress) {
      // Record quiz score for informational display only.
      // Section completion is driven by reading content, not by quiz pass.
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
  const { data: usageData } = await supabase.rpc("get_user_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  const usage = usageData?.[0];
  if (!usage?.can_ask) {
    // Return basic result without AI feedback if limit reached
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
    // Fallback without AI feedback
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
      if (q.question_type === "multiple_choice") {
        return `Q: ${questionText}\nAnswer: ${a.is_correct ? "CORRECT" : "INCORRECT"} (selected: ${a.selected_option})`;
      } else {
        return `Q: ${questionText}\nVoice answer: "${a.transcription || "(no transcription)"}"\nScore: ${a.voice_score}/100`;
      }
    })
    .join("\n\n");

  const sectionTitle = isEs && section?.title_es
    ? section.title_es
    : section?.title_en || "Unknown";

  const userPrompt = `Section: ${sectionTitle}\nOverall Score: ${finalScore}%\nPassed: ${passed ? "Yes" : "No"}\nCompetency Level: ${competencyLevel}\n\nQuiz Results:\n${answersContext}\n\nGenerate the dual evaluation feedback.`;

  // Call OpenAI
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return jsonResponse({
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      student_feedback: {
        strengths: [],
        areas_for_improvement: [],
        encouragement: passed ? "Congratulations!" : "Keep studying!",
      },
    });
  }

  console.log("[evaluate:section] Calling OpenAI for dual feedback...");

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "section_evaluation",
          strict: true,
          schema: sectionEvalSchema,
        },
      },
      temperature: 0.4,
      max_tokens: 1000,
    }),
  });

  if (!aiResponse.ok) {
    console.error("[evaluate:section] OpenAI error:", aiResponse.status);
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

  const aiData = await aiResponse.json();
  const aiContent = aiData.choices?.[0]?.message?.content;

  let evalResult: {
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
  };

  try {
    evalResult = JSON.parse(aiContent);
  } catch {
    console.error("[evaluate:section] Parse error");
    return jsonResponse({
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      student_feedback: {
        strengths: [],
        areas_for_improvement: [],
        encouragement: passed ? "You passed!" : "Keep trying!",
      },
    });
  }

  // Increment usage
  await supabase.rpc("increment_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  // Persist evaluation to DB (both student and manager feedback)
  await supabase.from("evaluations").insert({
    user_id: userId,
    enrollment_id: enrollment_id || null,
    section_id,
    eval_type: "quiz",
    student_feedback: evalResult.student_feedback,
    manager_feedback: evalResult.manager_feedback,
    competency_level: evalResult.competency_level || competencyLevel,
  });

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
// ACTION D: module_test_evaluation — Certification test with per-section breakdown
// =============================================================================

async function handleModuleTestEvaluation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  groupId: string,
  body: Record<string, unknown>,
  language: string,
) {
  const { attempt_id, course_id, enrollment_id } = body;

  if (!attempt_id || !course_id) {
    return errorResponse("bad_request", "attempt_id and course_id are required", 400);
  }

  // Fetch attempt and verify ownership
  const { data: attempt } = await supabase
    .from("module_test_attempts")
    .select("*")
    .eq("id", attempt_id)
    .eq("user_id", userId)
    .single();

  if (!attempt) {
    return errorResponse("not_found", "Module test attempt not found", 404);
  }

  // Fetch all answers for this attempt with questions
  const { data: answers } = await supabase
    .from("module_test_answers")
    .select("*, quiz_questions(*)")
    .eq("attempt_id", attempt_id);

  if (!answers || answers.length === 0) {
    return errorResponse("bad_request", "No answers found for this attempt", 400);
  }

  // Fetch all sections for per-section breakdown
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, title_en, title_es")
    .eq("course_id", course_id)
    .eq("status", "published");

  const sectionTitleMap = new Map<string, { en: string; es: string }>();
  for (const s of (sections || [])) {
    sectionTitleMap.set(s.id, { en: s.title_en, es: s.title_es || s.title_en });
  }

  // Calculate score — overall and per-section
  let totalPoints = 0;
  let earnedPoints = 0;
  const sectionScoresMap = new Map<string, { earned: number; total: number; count: number }>();

  for (const answer of answers) {
    const question = answer.quiz_questions as Record<string, unknown> | null;
    if (!question) continue;

    const sectionId = answer.section_id as string;
    if (!sectionScoresMap.has(sectionId)) {
      sectionScoresMap.set(sectionId, { earned: 0, total: 0, count: 0 });
    }
    const sectionAcc = sectionScoresMap.get(sectionId)!;

    if (question.question_type === "multiple_choice") {
      totalPoints += 100;
      sectionAcc.total += 100;
      const points = answer.is_correct ? 100 : 0;
      earnedPoints += points;
      sectionAcc.earned += points;
    } else if (question.question_type === "voice") {
      totalPoints += 100;
      sectionAcc.total += 100;
      const points = answer.voice_score || 0;
      earnedPoints += points;
      sectionAcc.earned += points;
    }
    sectionAcc.count += 1;
  }

  const finalScore = totalPoints > 0
    ? Math.round((earnedPoints / totalPoints) * 100)
    : 0;

  // Fetch course for passing score
  const { data: course } = await supabase
    .from("courses")
    .select("passing_score, title_en, title_es")
    .eq("id", course_id)
    .single();

  const passingScore = course?.passing_score || 70;
  const passed = finalScore >= passingScore;

  // Competency level
  let competencyLevel: string;
  if (finalScore >= 90) competencyLevel = "expert";
  else if (finalScore >= 80) competencyLevel = "proficient";
  else if (finalScore >= 60) competencyLevel = "competent";
  else competencyLevel = "novice";

  // Per-section scores
  const isEs = language === "es";
  const sectionScores = Array.from(sectionScoresMap.entries()).map(([sId, acc]) => {
    const titles = sectionTitleMap.get(sId);
    return {
      section_id: sId,
      section_title: titles ? (isEs ? titles.es : titles.en) : "Unknown",
      score: acc.total > 0 ? Math.round((acc.earned / acc.total) * 100) : 0,
      questions_count: acc.count,
    };
  });

  // Mark attempt as completed
  await supabase
    .from("module_test_attempts")
    .update({
      status: "completed",
      score: finalScore,
      passed,
      section_scores: sectionScores,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attempt_id);

  // Update course_enrollments
  if (enrollment_id) {
    const updates: Record<string, unknown> = {
      final_score: finalScore,
      final_passed: passed,
      module_test_attempts: (attempt.attempt_number || 1),
    };
    if (passed) {
      updates.status = "completed";
      updates.completed_at = new Date().toISOString();
    }
    await supabase
      .from("course_enrollments")
      .update(updates)
      .eq("id", enrollment_id);
  }

  // Check usage before AI call
  const { data: usageData } = await supabase.rpc("get_user_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  const usage = usageData?.[0];
  if (!usage?.can_ask) {
    return jsonResponse({
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      section_scores: sectionScores,
      student_feedback: {
        strengths: [],
        areas_for_improvement: [],
        encouragement: passed
          ? isEs ? "Aprobaste el examen!" : "You passed the certification test!"
          : isEs ? "Sigue practicando!" : "Keep practicing!",
      },
    });
  }

  // Fetch evaluation prompt
  const { data: promptData } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", "module-test-evaluation")
    .eq("is_active", true)
    .single();

  if (!promptData) {
    return jsonResponse({
      score: finalScore,
      passed,
      competency_level: competencyLevel,
      section_scores: sectionScores,
      student_feedback: {
        strengths: [],
        areas_for_improvement: [],
        encouragement: passed ? "Congratulations!" : "Keep studying!",
      },
    });
  }

  // Build context
  const systemPrompt = isEs && promptData.prompt_es
    ? promptData.prompt_es
    : promptData.prompt_en;

  const answersContext = answers
    .map((a: Record<string, unknown>) => {
      const q = a.quiz_questions as Record<string, unknown>;
      const questionText = isEs && q.question_es ? q.question_es : q.question_en;
      const titles = sectionTitleMap.get(a.section_id as string);
      const sTitle = titles ? (isEs ? titles.es : titles.en) : "Unknown";
      if (q.question_type === "multiple_choice") {
        return `[${sTitle}] Q: ${questionText}\nAnswer: ${a.is_correct ? "CORRECT" : "INCORRECT"}`;
      } else {
        return `[${sTitle}] Q: ${questionText}\nVoice: "${a.transcription || "(none)"}"\nScore: ${a.voice_score}/100`;
      }
    })
    .join("\n\n");

  const sectionBreakdown = sectionScores
    .map((s) => `${s.section_title}: ${s.score}% (${s.questions_count} questions)`)
    .join("\n");

  const courseTitle = course
    ? (isEs && course.title_es ? course.title_es : course.title_en)
    : "Unknown";

  const userPrompt = `Course: ${courseTitle}\nOverall Score: ${finalScore}%\nPassed: ${passed ? "Yes" : "No"}\nCompetency Level: ${competencyLevel}\n\nPer-Section Breakdown:\n${sectionBreakdown}\n\nTest Results:\n${answersContext}\n\nGenerate the dual evaluation feedback.`;

  // Call OpenAI
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return jsonResponse({
      score: finalScore, passed, competency_level: competencyLevel, section_scores: sectionScores,
      student_feedback: { strengths: [], areas_for_improvement: [], encouragement: "Done!" },
    });
  }

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "module_test_evaluation",
          strict: true,
          schema: sectionEvalSchema,
        },
      },
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  if (!aiResponse.ok) {
    return jsonResponse({
      score: finalScore, passed, competency_level: competencyLevel, section_scores: sectionScores,
      student_feedback: { strengths: [], areas_for_improvement: [], encouragement: passed ? "Well done!" : "Keep practicing!" },
    });
  }

  const aiData = await aiResponse.json();
  const aiContent = aiData.choices?.[0]?.message?.content;
  let evalResult: { competency_level: string; student_feedback: Record<string, unknown>; manager_feedback: Record<string, unknown> };

  try {
    evalResult = JSON.parse(aiContent);
  } catch {
    return jsonResponse({
      score: finalScore, passed, competency_level: competencyLevel, section_scores: sectionScores,
      student_feedback: { strengths: [], areas_for_improvement: [], encouragement: passed ? "You passed!" : "Keep trying!" },
    });
  }

  // Increment usage
  await supabase.rpc("increment_usage", { _user_id: userId, _group_id: groupId });

  // Persist evaluation
  await supabase.from("evaluations").insert({
    user_id: userId,
    enrollment_id: enrollment_id || null,
    eval_type: "module_test",
    student_feedback: evalResult.student_feedback,
    manager_feedback: evalResult.manager_feedback,
    competency_level: evalResult.competency_level || competencyLevel,
  });

  return jsonResponse({
    score: finalScore,
    passed,
    competency_level: evalResult.competency_level || competencyLevel,
    section_scores: sectionScores,
    student_feedback: evalResult.student_feedback,
  });
}

// =============================================================================
// ACTION E: course_final — Comprehensive AI evaluation (manager-only)
// =============================================================================

async function handleCourseFinal(
  supabase: ReturnType<typeof createClient>,
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
  const { data: roleData } = await supabase.rpc("get_user_role", {
    _user_id: userId,
    _group_id: groupId,
  });

  const callerRole = roleData as string | null;
  if (!callerRole || (callerRole !== "manager" && callerRole !== "admin")) {
    return errorResponse("forbidden", "Only managers and admins can generate course evaluations", 403);
  }

  // 2. Check for cached course_final evaluation (< 24h old)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: cachedEval } = await supabase
    .from("evaluations")
    .select("*")
    .eq("user_id", target_user_id as string)
    .eq("eval_type", "course_final")
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cachedEval) {
    console.log("[evaluate:course_final] Returning cached evaluation");
    return jsonResponse({
      competency_level: cachedEval.competency_level,
      student_feedback: cachedEval.student_feedback,
      manager_feedback: cachedEval.manager_feedback,
      cached: true,
    });
  }

  // 3. Fetch all course enrollments for target user
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("*, courses(title_en, title_es)")
    .eq("user_id", target_user_id as string)
    .eq("group_id", groupId);

  if (!enrollments || enrollments.length === 0) {
    return errorResponse("not_found", "No course enrollments found for this user", 404);
  }

  // 4. Fetch all section progress with quiz scores
  const { data: allProgress } = await supabase
    .from("section_progress")
    .select("*, course_sections(title_en, title_es)")
    .eq("user_id", target_user_id as string);

  // 5. Fetch existing quiz evaluations for context
  const { data: existingEvals } = await supabase
    .from("evaluations")
    .select("section_id, competency_level, student_feedback, manager_feedback")
    .eq("user_id", target_user_id as string)
    .eq("eval_type", "quiz")
    .order("created_at", { ascending: false });

  // 6. Check usage limits
  const { data: usageData } = await supabase.rpc("get_user_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  const usage = usageData?.[0];
  if (!usage?.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429);
  }

  // 7. Build context for AI
  const isEs = language === "es";

  const enrollmentContext = (enrollments ?? [])
    .map((e: Record<string, unknown>) => {
      const course = e.courses as Record<string, unknown> | null;
      const title = isEs && course?.title_es ? course.title_es : course?.title_en || "Unknown";
      return `Course: ${title}\n  Status: ${e.status}\n  Completed: ${e.completed_sections}/${e.total_sections} sections\n  Final Score: ${e.final_score ?? "N/A"}`;
    })
    .join("\n\n");

  const progressContext = (allProgress ?? [])
    .map((p: Record<string, unknown>) => {
      const section = p.course_sections as Record<string, unknown> | null;
      const title = isEs && section?.title_es ? section.title_es : section?.title_en || "Unknown";
      return `Section: ${title}\n  Status: ${p.status}\n  Quiz Score: ${p.quiz_score ?? "N/A"}\n  Quiz Passed: ${p.quiz_passed ?? "N/A"}\n  Time Spent: ${p.time_spent_seconds}s`;
    })
    .join("\n\n");

  const evalContext = (existingEvals ?? [])
    .slice(0, 10) // Limit to last 10
    .map((ev: Record<string, unknown>) => {
      const mf = ev.manager_feedback as Record<string, unknown> | null;
      return `Level: ${ev.competency_level}\n  Gaps: ${(mf?.competency_gaps as string[] || []).join(", ")}\n  Risk: ${mf?.risk_level || "unknown"}`;
    })
    .join("\n");

  // 8. Fetch evaluation prompt
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
${progressContext}

Previous Quiz Evaluations:
${evalContext || "None"}

Generate a comprehensive dual evaluation with:
1. competency_level (novice/competent/proficient/expert) - based on overall performance
2. student_feedback with strengths, areas_for_improvement, and encouragement
3. manager_feedback with competency_gaps, recommended_actions, and risk_level`;

  // 9. Call OpenAI
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return errorResponse("server_error", "AI service not configured", 500);
  }

  console.log("[evaluate:course_final] Calling OpenAI for comprehensive evaluation...");

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "course_final_evaluation",
          strict: true,
          schema: sectionEvalSchema,
        },
      },
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error("[evaluate:course_final] OpenAI error:", aiResponse.status, errorText);
    return errorResponse("ai_error", "Failed to generate evaluation", 500);
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content;

  if (!content) {
    return errorResponse("ai_error", "Empty evaluation response", 500);
  }

  let evalResult: {
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
  };

  try {
    evalResult = JSON.parse(content);
  } catch {
    console.error("[evaluate:course_final] Parse error:", content);
    return errorResponse("ai_error", "Invalid evaluation format", 500);
  }

  // 10. Increment usage
  await supabase.rpc("increment_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  // 11. Persist evaluation
  await supabase.from("evaluations").insert({
    user_id: target_user_id as string,
    eval_type: "course_final",
    student_feedback: evalResult.student_feedback,
    manager_feedback: evalResult.manager_feedback,
    competency_level: evalResult.competency_level,
    evaluated_by: userId,
  });

  console.log(`[evaluate:course_final] Level: ${evalResult.competency_level}`);

  // 12. Return both feedbacks (caller is manager)
  return jsonResponse({
    competency_level: evalResult.competency_level,
    student_feedback: evalResult.student_feedback,
    manager_feedback: evalResult.manager_feedback,
    cached: false,
  });
}
