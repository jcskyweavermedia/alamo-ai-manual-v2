/**
 * Course Tutor Edge Function
 *
 * Practice Tutor — conversational AI for course-level practice.
 * Asks open-ended questions, evaluates readiness 0-100, suggests test at 75+.
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
// CONTENT SERIALIZERS (same as course-quiz-generate)
// =============================================================================

function serializeManualSection(item: Record<string, unknown>, lang: string): string {
  const content = lang === "es" && item.content_es
    ? item.content_es as string
    : item.content_en as string;
  return content?.substring(0, 4000) || "";
}

function serializeDish(d: Record<string, unknown>): string {
  return [
    `Dish: ${d.menu_name || d.name}`,
    d.short_description ? `Description: ${d.short_description}` : null,
    d.key_ingredients ? `Key Ingredients: ${(d.key_ingredients as string[]).join(", ")}` : null,
    d.allergens ? `Allergens: ${(d.allergens as string[]).join(", ") || "none"}` : null,
  ].filter(Boolean).join("\n");
}

function serializeWine(w: Record<string, unknown>): string {
  return [
    `Wine: ${w.name}`,
    w.region ? `Region: ${w.region}` : null,
    w.tasting_notes ? `Tasting: ${w.tasting_notes}` : null,
  ].filter(Boolean).join("\n");
}

function serializeCocktail(c: Record<string, unknown>): string {
  return [
    `Cocktail: ${c.name}`,
    c.ingredients ? `Ingredients: ${c.ingredients}` : null,
    c.tasting_notes ? `Tasting: ${c.tasting_notes}` : null,
  ].filter(Boolean).join("\n");
}

function serializeBeerLiquor(b: Record<string, unknown>): string {
  return [
    `${b.category || "Item"}: ${b.name}`,
    b.style ? `Style: ${b.style}` : null,
    b.description ? `Description: ${b.description}` : null,
  ].filter(Boolean).join("\n");
}

function serializeRecipe(r: Record<string, unknown>): string {
  return [
    `Recipe: ${r.menu_name || r.name}`,
    r.short_description ? `Description: ${r.short_description}` : null,
  ].filter(Boolean).join("\n");
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse request
    const body = await req.json();
    const { course_id, language = "en", groupId, message, session_id } = body;

    if (!course_id || !groupId || !message) {
      return errorResponse("bad_request", "course_id, groupId, and message are required", 400);
    }

    // 3. Check usage limits
    const { data: usageData } = await supabase.rpc("get_user_usage", {
      _user_id: userId,
      _group_id: groupId,
    });

    const usage = usageData?.[0];
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

    let contentContext = "";
    if (sections && sections.length > 0) {
      const parts: string[] = [];
      for (const sec of sections) {
        const contentSource = sec.content_source as string;
        const contentIds = (sec.content_ids || []) as string[];
        if (contentSource === "custom" || contentIds.length === 0) continue;

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
        parts.push(`=== ${title} ===\n${serialized}`);
      }
      contentContext = parts.join("\n\n");
    }

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

    // Add conversation history (last 20 messages)
    const historySlice = existingMessages.slice(-20);
    for (const msg of historySlice) {
      aiMessages.push({ role: msg.role, content: msg.content });
    }

    // Add current user message
    aiMessages.push({ role: "user", content: message });

    // 8. Call OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return errorResponse("server_error", "AI service not configured", 500);
    }

    console.log("[course-tutor] Calling OpenAI...");

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: aiMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "tutor_response",
            strict: true,
            schema: tutorResponseSchema,
          },
        },
        temperature: 0.6,
        max_tokens: 800,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[course-tutor] OpenAI error:", aiResponse.status, errorText);
      return errorResponse("ai_error", "Failed to get tutor response", 500);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return errorResponse("ai_error", "Empty response from tutor", 500);
    }

    let tutorResponse: {
      reply: string;
      readiness_score: number;
      suggest_test: boolean;
      topics_covered: string[];
      questions_asked: number;
      correct_answers: number;
    };

    try {
      tutorResponse = JSON.parse(content);
    } catch {
      return errorResponse("ai_error", "Invalid tutor response format", 500);
    }

    // Increment usage
    await supabase.rpc("increment_usage", {
      _user_id: userId,
      _group_id: groupId,
    });

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
      // Fetch enrollment
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
    console.error("[course-tutor] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
