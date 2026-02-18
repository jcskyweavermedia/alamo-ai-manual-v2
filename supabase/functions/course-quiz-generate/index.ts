/**
 * Course Quiz Generate Edge Function
 *
 * Generates quiz questions (MC + voice) from section content using AI.
 * If active questions already exist for the section, returns those (shuffled).
 * Persists generated questions to quiz_questions table.
 * Returns client-safe version (MC options have no `correct` field).
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =============================================================================
// CONTENT SERIALIZATION (mirrors use-learning-session.ts patterns)
// =============================================================================

function serializeManualSection(item: Record<string, unknown>, lang: string): string {
  const content = lang === "es" && item.content_es
    ? item.content_es as string
    : item.content_en as string;
  return content?.substring(0, 4000) || "";
}

function serializeDish(d: Record<string, unknown>): string {
  const parts = [
    `Dish: ${d.menu_name || d.name}`,
    d.plate_type ? `Type: ${d.plate_type}` : null,
    d.short_description ? `Description: ${d.short_description}` : null,
    d.key_ingredients ? `Key Ingredients: ${(d.key_ingredients as string[]).join(", ")}` : null,
    d.allergens ? `Allergens: ${(d.allergens as string[]).join(", ") || "none"}` : null,
    d.preparation_notes ? `Preparation: ${d.preparation_notes}` : null,
    d.upsell_notes ? `Upsell: ${d.upsell_notes}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

function serializeWine(w: Record<string, unknown>): string {
  const parts = [
    `Wine: ${w.name}`,
    w.region ? `Region: ${w.region}` : null,
    w.grape_varieties ? `Grapes: ${(w.grape_varieties as string[]).join(", ")}` : null,
    w.tasting_notes ? `Tasting: ${w.tasting_notes}` : null,
    w.food_pairings ? `Pairings: ${(w.food_pairings as string[]).join(", ")}` : null,
    w.serving_temp ? `Serving Temp: ${w.serving_temp}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

function serializeCocktail(c: Record<string, unknown>): string {
  const parts = [
    `Cocktail: ${c.name}`,
    c.category ? `Category: ${c.category}` : null,
    c.base_spirit ? `Base Spirit: ${c.base_spirit}` : null,
    c.ingredients ? `Ingredients: ${(c.ingredients as string[]).join(", ")}` : null,
    c.flavor_profile ? `Flavor: ${c.flavor_profile}` : null,
    c.garnish ? `Garnish: ${c.garnish}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

function serializeBeerLiquor(b: Record<string, unknown>): string {
  const parts = [
    `${b.item_type || "Item"}: ${b.name}`,
    b.category ? `Category: ${b.category}` : null,
    b.style ? `Style: ${b.style}` : null,
    b.origin ? `Origin: ${b.origin}` : null,
    b.abv ? `ABV: ${b.abv}%` : null,
    b.tasting_notes ? `Tasting: ${b.tasting_notes}` : null,
    b.food_pairings ? `Pairings: ${(b.food_pairings as string[]).join(", ")}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

function serializeRecipe(r: Record<string, unknown>): string {
  const parts = [
    `Recipe: ${r.menu_name || r.name}`,
    r.short_description ? `Description: ${r.short_description}` : null,
  ];
  if (r.ingredients && Array.isArray(r.ingredients)) {
    const ingredientList = (r.ingredients as Array<Record<string, unknown>>)
      .map((i) => `${i.qty || ""} ${i.unit || ""} ${i.item || ""}`.trim())
      .join(", ");
    parts.push(`Ingredients: ${ingredientList}`);
  }
  if (r.procedure && Array.isArray(r.procedure)) {
    const steps = (r.procedure as Array<Record<string, unknown>>)
      .map((s) => `${s.step}: ${s.text}`)
      .join("; ");
    parts.push(`Procedure: ${steps}`);
  }
  return parts.filter(Boolean).join("\n");
}

const CONTENT_SERIALIZERS: Record<string, (item: Record<string, unknown>, lang?: string) => string> = {
  manual_sections: serializeManualSection,
  foh_plate_specs: serializeDish,
  plate_specs: serializeRecipe,
  prep_recipes: serializeRecipe,
  wines: serializeWine,
  cocktails: serializeCocktail,
  beer_liquor_list: serializeBeerLiquor,
};

// Table name mapping (content_source → actual table name)
const SOURCE_TABLE: Record<string, string> = {
  manual_sections: "manual_sections",
  foh_plate_specs: "foh_plate_specs",
  plate_specs: "plate_specs",
  prep_recipes: "prep_recipes",
  wines: "wines",
  cocktails: "cocktails",
  beer_liquor_list: "beer_liquor_list",
};

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
          question_type: {
            type: "string" as const,
            enum: ["multiple_choice", "voice"],
          },
          question_en: { type: "string" as const },
          question_es: { type: "string" as const },
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
          explanation_en: { type: "string" as const },
          explanation_es: { type: "string" as const },
          rubric: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                criterion: { type: "string" as const },
                points: { type: "number" as const },
                description: { type: "string" as const },
              },
              required: ["criterion", "points", "description"],
              additionalProperties: false,
            },
          },
          difficulty: {
            type: "string" as const,
            enum: ["easy", "medium", "hard"],
          },
        },
        required: [
          "question_type",
          "question_en",
          "question_es",
          "options",
          "explanation_en",
          "explanation_es",
          "rubric",
          "difficulty",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[quiz-generate] Request received");

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
    const { data: claimsData, error: claimsError } =
      await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return errorResponse("Unauthorized", "Invalid token", 401);
    }

    const userId = claimsData.claims.sub as string;
    console.log("[quiz-generate] User:", userId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. PARSE REQUEST
    // =========================================================================
    const body = await req.json();
    const {
      section_id,
      course_id,
      mode = "section_quiz",  // 'section_quiz' | 'module_test'
      language = "en",
      groupId,
      question_count,
      force_regenerate = false,
    } = body;

    if (mode === "module_test") {
      if (!course_id) {
        return errorResponse("bad_request", "course_id is required for module_test mode", 400);
      }
      if (!groupId) {
        return errorResponse("bad_request", "groupId is required", 400);
      }
      return await handleModuleTestGenerate(supabase, userId, course_id, language, groupId, question_count, force_regenerate);
    }

    if (!section_id) {
      return errorResponse("bad_request", "section_id is required", 400);
    }
    if (!groupId) {
      return errorResponse("bad_request", "groupId is required", 400);
    }

    // =========================================================================
    // 3. CHECK USAGE LIMITS
    // =========================================================================
    const { data: usageData, error: usageError } = await supabase.rpc(
      "get_user_usage",
      { _user_id: userId, _group_id: groupId }
    );

    if (usageError) {
      console.error("[quiz-generate] Usage check error:", usageError.message);
      return errorResponse("server_error", "Failed to check usage limits", 500);
    }

    const usage = usageData?.[0];
    if (!usage) {
      return errorResponse("forbidden", "Not a member of this group", 403);
    }

    if (!usage.can_ask) {
      const limitType =
        usage.daily_count >= usage.daily_limit ? "daily" : "monthly";
      return errorResponse(
        "limit_exceeded",
        limitType === "daily"
          ? language === "es"
            ? "Límite diario alcanzado. Intenta mañana."
            : "Daily question limit reached. Try again tomorrow."
          : language === "es"
          ? "Límite mensual alcanzado."
          : "Monthly question limit reached.",
        429
      );
    }

    // =========================================================================
    // 4. FETCH SECTION CONFIG
    // =========================================================================
    const { data: section, error: sectionError } = await supabase
      .from("course_sections")
      .select("id, content_source, content_ids, quiz_enabled, quiz_question_count, quiz_passing_score, title_en, title_es")
      .eq("id", section_id)
      .single();

    if (sectionError || !section) {
      console.error("[quiz-generate] Section not found:", sectionError?.message);
      return errorResponse("not_found", "Section not found", 404);
    }

    if (!section.quiz_enabled) {
      return errorResponse("bad_request", "Quiz is not enabled for this section", 400);
    }

    const numQuestions = question_count || section.quiz_question_count || 5;
    const passingScore = section.quiz_passing_score || 70;

    console.log(
      `[quiz-generate] Section: ${section.title_en} | Source: ${section.content_source} | Questions: ${numQuestions}`
    );

    // =========================================================================
    // 5. CHECK FOR EXISTING QUESTIONS
    // =========================================================================
    if (!force_regenerate) {
      const { data: existing, error: existingError } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("section_id", section_id)
        .eq("is_active", true);

      if (!existingError && existing && existing.length >= numQuestions) {
        console.log(
          `[quiz-generate] Found ${existing.length} existing questions, reusing`
        );

        // Fetch enrollment for this user
        const { data: enrollment } = await supabase
          .from("course_enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", (
            await supabase
              .from("course_sections")
              .select("course_id")
              .eq("id", section_id)
              .single()
          ).data?.course_id)
          .single();

        if (!enrollment) {
          return errorResponse("bad_request", "Not enrolled in this course", 400);
        }

        // Get next attempt number
        const { count: prevAttempts } = await supabase
          .from("quiz_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("section_id", section_id);

        const attemptNumber = (prevAttempts || 0) + 1;

        // Create quiz attempt
        const { data: attempt, error: attemptError } = await supabase
          .from("quiz_attempts")
          .insert({
            user_id: userId,
            section_id,
            enrollment_id: enrollment.id,
            attempt_number: attemptNumber,
            status: "in_progress",
          })
          .select("id")
          .single();

        if (attemptError) {
          console.error("[quiz-generate] Attempt create error:", attemptError.message);
          return errorResponse("server_error", "Failed to create quiz attempt", 500);
        }

        // Shuffle and pick the requested number
        const selected = shuffle(existing).slice(0, numQuestions);

        return jsonResponse({
          questions: selected.map((q: Record<string, unknown>) =>
            toClientQuestion(q, language)
          ),
          attempt_id: attempt.id,
          total_questions: selected.length,
          passing_score: passingScore,
        });
      }
    }

    // =========================================================================
    // 6. FETCH CONTENT FOR AI GENERATION
    // =========================================================================
    const contentSource = section.content_source;
    const contentIds = section.content_ids || [];
    let contentText = "";

    if (contentSource === "custom" || contentIds.length === 0) {
      return errorResponse(
        "bad_request",
        "Cannot generate quiz for sections without content",
        400
      );
    }

    const tableName = SOURCE_TABLE[contentSource];
    if (!tableName) {
      return errorResponse("bad_request", `Unknown content source: ${contentSource}`, 400);
    }

    const { data: contentItems, error: contentError } = await supabase
      .from(tableName)
      .select("*")
      .in("id", contentIds);

    if (contentError || !contentItems || contentItems.length === 0) {
      console.error("[quiz-generate] Content fetch error:", contentError?.message);
      return errorResponse("server_error", "Failed to fetch section content", 500);
    }

    const serializer = CONTENT_SERIALIZERS[contentSource];
    contentText = contentItems
      .map((item: Record<string, unknown>) => serializer(item, language))
      .join("\n\n---\n\n");

    console.log(
      `[quiz-generate] Content serialized: ${contentText.length} chars from ${contentItems.length} items`
    );

    // =========================================================================
    // 7. FETCH QUIZ GENERATOR PROMPT
    // =========================================================================
    const { data: promptData, error: promptError } = await supabase
      .from("ai_prompts")
      .select("prompt_en, prompt_es")
      .eq("slug", "quiz-generator")
      .eq("is_active", true)
      .single();

    if (promptError || !promptData) {
      console.error("[quiz-generate] Prompt not found:", promptError?.message);
      return errorResponse("server_error", "Quiz generator prompt not configured", 500);
    }

    const systemPrompt =
      language === "es" && promptData.prompt_es
        ? promptData.prompt_es
        : promptData.prompt_en;

    // =========================================================================
    // 8. CALL OPENAI
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return errorResponse("server_error", "AI service not configured", 500);
    }

    const sectionTitle =
      language === "es" && section.title_es
        ? section.title_es
        : section.title_en;

    const userPrompt = `Generate ${numQuestions} quiz questions for the section "${sectionTitle}" using ONLY this training content:\n\n${contentText}`;

    console.log("[quiz-generate] Calling OpenAI...");

    const aiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
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
              name: "quiz_generation",
              strict: true,
              schema: quizGenerationSchema,
            },
          },
          temperature: 0.7,
          max_tokens: 3000,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[quiz-generate] OpenAI error:", aiResponse.status, errorText);
      return errorResponse("ai_error", "Failed to generate quiz questions", 500);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return errorResponse("ai_error", "Empty response from AI", 500);
    }

    let parsed: { questions: Array<Record<string, unknown>> };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[quiz-generate] JSON parse error:", content);
      return errorResponse("ai_error", "Invalid AI response format", 500);
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return errorResponse("ai_error", "No questions in AI response", 500);
    }

    console.log(`[quiz-generate] AI generated ${parsed.questions.length} questions`);

    // Increment usage (AI call consumed)
    await supabase.rpc("increment_usage", {
      _user_id: userId,
      _group_id: groupId,
    });

    // =========================================================================
    // 9. PERSIST QUESTIONS TO DB
    // =========================================================================
    const insertRows = parsed.questions.map((q) => ({
      section_id,
      question_type: q.question_type,
      question_en: q.question_en,
      question_es: q.question_es,
      explanation_en: q.explanation_en || null,
      explanation_es: q.explanation_es || null,
      options:
        q.question_type === "multiple_choice"
          ? (q.options as Array<Record<string, unknown>>).map((o) => ({
              id: o.id,
              text_en: o.text_en,
              text_es: o.text_es,
              correct: o.correct,
            }))
          : null,
      rubric:
        q.question_type === "voice"
          ? q.rubric
          : null,
      difficulty: q.difficulty || "medium",
      source: "ai",
      is_active: true,
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from("quiz_questions")
      .insert(insertRows)
      .select("*");

    if (insertError) {
      console.error("[quiz-generate] Insert error:", insertError.message);
      return errorResponse("server_error", "Failed to save quiz questions", 500);
    }

    console.log(`[quiz-generate] Saved ${insertedQuestions.length} questions to DB`);

    // =========================================================================
    // 10. CREATE QUIZ ATTEMPT
    // =========================================================================
    // Fetch enrollment
    const { data: sectionForCourse } = await supabase
      .from("course_sections")
      .select("course_id")
      .eq("id", section_id)
      .single();

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", sectionForCourse?.course_id)
      .single();

    if (!enrollment) {
      return errorResponse("bad_request", "Not enrolled in this course", 400);
    }

    // Get next attempt number
    const { count: prevAttempts } = await supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("section_id", section_id);

    const attemptNumber = (prevAttempts || 0) + 1;

    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: userId,
        section_id,
        enrollment_id: enrollment.id,
        attempt_number: attemptNumber,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (attemptError) {
      console.error("[quiz-generate] Attempt create error:", attemptError.message);
      return errorResponse("server_error", "Failed to create quiz attempt", 500);
    }

    // =========================================================================
    // 11. RETURN CLIENT-SAFE RESPONSE
    // =========================================================================
    return jsonResponse({
      questions: insertedQuestions.map((q: Record<string, unknown>) =>
        toClientQuestion(q, language)
      ),
      attempt_id: attempt.id,
      total_questions: insertedQuestions.length,
      passing_score: passingScore,
    });
  } catch (err) {
    console.error("[quiz-generate] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});

// =============================================================================
// MODULE TEST GENERATION HANDLER
// =============================================================================

const moduleTestSchema = {
  type: "object" as const,
  properties: {
    questions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          question_type: {
            type: "string" as const,
            enum: ["multiple_choice", "voice"],
          },
          question_en: { type: "string" as const },
          question_es: { type: "string" as const },
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
          explanation_en: { type: "string" as const },
          explanation_es: { type: "string" as const },
          rubric: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                criterion: { type: "string" as const },
                points: { type: "number" as const },
                description: { type: "string" as const },
              },
              required: ["criterion", "points", "description"],
              additionalProperties: false,
            },
          },
          difficulty: {
            type: "string" as const,
            enum: ["easy", "medium", "hard"],
          },
          source_section_index: { type: "number" as const },
        },
        required: [
          "question_type",
          "question_en",
          "question_es",
          "options",
          "explanation_en",
          "explanation_es",
          "rubric",
          "difficulty",
          "source_section_index",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

async function handleModuleTestGenerate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  courseId: string,
  language: string,
  groupId: string,
  questionCount?: number,
  forceRegenerate = false,
) {
  console.log(`[quiz-generate:module_test] Course: ${courseId}`);

  // 1. Check usage limits
  const { data: usageData, error: usageError } = await supabase.rpc(
    "get_user_usage",
    { _user_id: userId, _group_id: groupId }
  );

  if (usageError) {
    return errorResponse("server_error", "Failed to check usage limits", 500);
  }
  const usage = usageData?.[0];
  if (!usage?.can_ask) {
    return errorResponse("limit_exceeded", "Usage limit reached", 429);
  }

  // 2. Fetch ALL published sections for this course
  const { data: sections, error: sectionsError } = await supabase
    .from("course_sections")
    .select("id, content_source, content_ids, title_en, title_es, sort_order")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (sectionsError || !sections || sections.length === 0) {
    return errorResponse("not_found", "No published sections found for this course", 404);
  }

  const numQuestions = questionCount || Math.max(10, sections.length * 2);

  // 3. Check for existing module-test questions
  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("course_id", courseId)
      .eq("is_active", true);

    if (existing && existing.length >= numQuestions) {
      console.log(`[quiz-generate:module_test] Reusing ${existing.length} existing questions`);
      return await createModuleTestAttemptAndRespond(
        supabase, userId, courseId, shuffle(existing).slice(0, numQuestions), sections, language, numQuestions
      );
    }
  }

  // 4. Fetch and serialize content from all sections
  const sectionContents: string[] = [];
  for (const sec of sections) {
    const contentSource = sec.content_source as string;
    const contentIds = (sec.content_ids || []) as string[];

    if (contentSource === "custom" || contentIds.length === 0) {
      const title = language === "es" && sec.title_es ? sec.title_es : sec.title_en;
      sectionContents.push(`=== Section: ${title} ===\n(No content available)`);
      continue;
    }

    const tableName = SOURCE_TABLE[contentSource];
    if (!tableName) continue;

    const { data: items } = await supabase
      .from(tableName)
      .select("*")
      .in("id", contentIds);

    if (!items || items.length === 0) continue;

    const serializer = CONTENT_SERIALIZERS[contentSource];
    const title = language === "es" && sec.title_es ? sec.title_es : sec.title_en;
    const serialized = items
      .map((item: Record<string, unknown>) => serializer(item, language))
      .join("\n");
    sectionContents.push(`=== Section: ${title} ===\n${serialized}`);
  }

  const contentText = sectionContents.join("\n\n");
  console.log(`[quiz-generate:module_test] Content: ${contentText.length} chars from ${sections.length} sections`);

  // 5. Fetch module-test-generator prompt
  const { data: promptData } = await supabase
    .from("ai_prompts")
    .select("prompt_en, prompt_es")
    .eq("slug", "module-test-generator")
    .eq("is_active", true)
    .single();

  if (!promptData) {
    return errorResponse("server_error", "Module test generator prompt not configured", 500);
  }

  const systemPrompt = language === "es" && promptData.prompt_es
    ? promptData.prompt_es
    : promptData.prompt_en;

  // 6. Fetch course title
  const { data: course } = await supabase
    .from("courses")
    .select("title_en, title_es, passing_score")
    .eq("id", courseId)
    .single();

  const courseTitle = course
    ? (language === "es" && course.title_es ? course.title_es : course.title_en)
    : "Unknown Course";
  const passingScore = course?.passing_score || 70;

  // 7. Call OpenAI
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return errorResponse("server_error", "AI service not configured", 500);
  }

  const sectionList = sections.map((s, i) => `${i}. ${s.title_en}`).join(", ");
  const userPrompt = `Generate ${numQuestions} certification test questions for the course "${courseTitle}".

Sections (use source_section_index to reference): ${sectionList}

Distribute questions across all sections (minimum 1 per section). Use ONLY this training content:

${contentText}`;

  console.log("[quiz-generate:module_test] Calling OpenAI...");

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
          name: "module_test_generation",
          strict: true,
          schema: moduleTestSchema,
        },
      },
      temperature: 0.7,
      max_tokens: 5000,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error("[quiz-generate:module_test] OpenAI error:", aiResponse.status, errorText);
    return errorResponse("ai_error", "Failed to generate test questions", 500);
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content;

  if (!content) {
    return errorResponse("ai_error", "Empty response from AI", 500);
  }

  let parsed: { questions: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(content);
  } catch {
    return errorResponse("ai_error", "Invalid AI response format", 500);
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    return errorResponse("ai_error", "No questions in AI response", 500);
  }

  console.log(`[quiz-generate:module_test] AI generated ${parsed.questions.length} questions`);

  // Increment usage
  await supabase.rpc("increment_usage", {
    _user_id: userId,
    _group_id: groupId,
  });

  // 8. Persist questions with both section_id and course_id
  const insertRows = parsed.questions.map((q) => {
    const sectionIdx = Math.min(
      Math.max(0, (q.source_section_index as number) || 0),
      sections.length - 1
    );
    return {
      section_id: sections[sectionIdx].id,
      course_id: courseId,
      question_type: q.question_type,
      question_en: q.question_en,
      question_es: q.question_es,
      explanation_en: q.explanation_en || null,
      explanation_es: q.explanation_es || null,
      options:
        q.question_type === "multiple_choice"
          ? (q.options as Array<Record<string, unknown>>).map((o) => ({
              id: o.id,
              text_en: o.text_en,
              text_es: o.text_es,
              correct: o.correct,
            }))
          : null,
      rubric: q.question_type === "voice" ? q.rubric : null,
      difficulty: q.difficulty || "medium",
      source: "ai",
      is_active: true,
    };
  });

  const { data: insertedQuestions, error: insertError } = await supabase
    .from("quiz_questions")
    .insert(insertRows)
    .select("*");

  if (insertError) {
    console.error("[quiz-generate:module_test] Insert error:", insertError.message);
    return errorResponse("server_error", "Failed to save test questions", 500);
  }

  // 9. Create module_test_attempts row and respond
  return await createModuleTestAttemptAndRespond(
    supabase, userId, courseId, insertedQuestions, sections, language, passingScore
  );
}

async function createModuleTestAttemptAndRespond(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  courseId: string,
  questions: Array<Record<string, unknown>>,
  sections: Array<Record<string, unknown>>,
  language: string,
  passingScore: number,
) {
  // Fetch enrollment
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .single();

  if (!enrollment) {
    return errorResponse("bad_request", "Not enrolled in this course", 400);
  }

  // Get next attempt number
  const { count: prevAttempts } = await supabase
    .from("module_test_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("course_id", courseId);

  const attemptNumber = (prevAttempts || 0) + 1;

  // Create module_test_attempts row
  const { data: attempt, error: attemptError } = await supabase
    .from("module_test_attempts")
    .insert({
      user_id: userId,
      course_id: courseId,
      enrollment_id: enrollment.id,
      attempt_number: attemptNumber,
      total_questions: questions.length,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (attemptError) {
    console.error("[quiz-generate:module_test] Attempt error:", attemptError.message);
    return errorResponse("server_error", "Failed to create test attempt", 500);
  }

  // Build section map: questionId → sectionId
  const sectionMap: Record<string, string> = {};
  for (const q of questions) {
    sectionMap[q.id as string] = q.section_id as string;
  }

  return jsonResponse({
    questions: questions.map((q) => toClientQuestion(q, language)),
    attempt_id: attempt.id,
    total_questions: questions.length,
    passing_score: passingScore,
    section_map: sectionMap,
    mode: "module_test",
  });
}

// =============================================================================
// HELPER: Convert DB question to client-safe format (no correct answers)
// =============================================================================

function toClientQuestion(
  q: Record<string, unknown>,
  language: string
): Record<string, unknown> {
  const isEs = language === "es";
  const base: Record<string, unknown> = {
    id: q.id,
    question_type: q.question_type,
    question: isEs && q.question_es ? q.question_es : q.question_en,
    difficulty: q.difficulty,
  };

  if (q.question_type === "multiple_choice" && q.options) {
    // Strip `correct` field from options
    base.options = (q.options as Array<Record<string, unknown>>).map((o) => ({
      id: o.id,
      text: isEs && o.text_es ? o.text_es : o.text_en,
    }));
  }

  if (q.question_type === "voice" && q.rubric) {
    // Provide a brief rubric summary (criteria names only, no point values)
    const criteria = q.rubric as Array<Record<string, unknown>>;
    base.rubric_summary = criteria
      .map((c) => c.criterion || c.description)
      .join(", ");
  }

  return base;
}
