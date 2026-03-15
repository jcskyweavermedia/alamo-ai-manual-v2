/**
 * Course Tutor Edge Function
 *
 * Practice Tutor — conversational AI for course-level practice.
 * Asks open-ended questions, evaluates readiness 0-100, suggests test at 75+.
 *
 * Auth: verify_jwt=false — manual JWT verification via getUser()
 *
 * Schema (Phase 2):
 *   - course_sections.elements JSONB[] — content stored as element objects
 *   - course_conversations — persistent chat (replaces dropped tutor_sessions)
 *   - courses.teacher_id FK → ai_teachers (unchanged)
 *   - courses.quiz_config JSONB — quiz settings
 */

import { getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { authenticateWithUser, AuthError } from "../_shared/auth.ts";
import { callOpenAI, OpenAIError } from "../_shared/openai.ts";
import { checkUsage, UsageError } from "../_shared/usage.ts";
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";
import { fetchPromptBySlug, assembleSystemPrompt } from "../_shared/prompt-helpers.ts";

// =============================================================================
// ELEMENT CONTENT EXTRACTOR
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
  source_refs?: Array<{ table: string; id: string }>;
}

/**
 * Extract readable text content from a section's elements JSONB array.
 * Processes content, feature (all variants), and media elements.
 * Returns a markdown-style string suitable for AI context.
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
        // Feature elements may have a title + body, and/or sub-items
        const title = (isEs && el.title_es) ? el.title_es : el.title_en;
        const body = (isEs && el.body_es) ? el.body_es : el.body_en;

        const featureParts: string[] = [];
        if (title) featureParts.push(`**${title}**`);
        if (body) featureParts.push(body);

        // Sub-items (for list/grid/accordion/timeline features)
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
        // Include media captions as context
        const caption = (isEs && el.caption_es) ? el.caption_es : el.caption_en;
        if (caption) {
          parts.push(`[Image/Media: ${caption}]`);
        }
        break;
      }

      default:
        // Unknown element types — try to extract any body content
        {
          const body = (isEs && el.body_es) ? el.body_es : el.body_en;
          if (body) parts.push(body);
        }
        break;
    }
  }

  return parts.join("\n\n");
}

/**
 * Load content for all sections of a course by extracting from elements JSONB.
 * Returns a single markdown string with section headers.
 */
function extractAllSectionsContent(
  sections: Array<Record<string, unknown>>,
  language: "en" | "es",
): string {
  const parts: string[] = [];

  for (const sec of sections) {
    const title = (language === "es" && sec.title_es)
      ? sec.title_es as string
      : sec.title_en as string;
    const elements = (sec.elements || []) as CourseElement[];
    const content = extractElementsContent(elements, language);

    if (content) {
      parts.push(`=== ${title} ===\n${content}`);
    }
  }

  return parts.join("\n\n");
}

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
  const origin = req.headers.get("Origin");
  const cors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  console.log("[course-tutor] Request received");

  try {
    // 1. Authenticate (write operation — validates token not revoked)
    const { userId, supabase } = await authenticateWithUser(req);

    // 2. Parse request
    const body = await req.json();
    const { course_id, section_id, language = "en", groupId, message, conversation_id } = body;

    if (!course_id || !groupId || !message) {
      return errorResponse("bad_request", "course_id, groupId, and message are required", 400, cors);
    }

    // Message length validation
    if (typeof message === "string" && message.length > 4000) {
      return errorResponse("bad_request", "Message too long (max 4000 characters)", 400, cors);
    }

    const lang = language as "en" | "es";

    // 3. Check usage limits
    const usage = await checkUsage(supabase, userId, groupId);
    if (!usage?.can_ask) {
      return errorResponse("limit_exceeded", "Usage limit reached", 429, cors);
    }

    // 4. Fetch course sections with elements (new schema)
    // If section_id is provided, load only that section; otherwise load all
    const sectionsQuery = supabase
      .from("course_sections")
      .select("id, elements, title_en, title_es, sort_order")
      .eq("course_id", course_id)
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (section_id) {
      sectionsQuery.eq("id", section_id);
    }

    const { data: sections } = await sectionsQuery;

    const contentContext = sections && sections.length > 0
      ? extractAllSectionsContent(sections, lang)
      : "";

    // 5. Assemble 4-layer system prompt
    const [globalRules, practicePrompt] = await Promise.all([
      fetchPromptBySlug(supabase, "teacher-global-rules", lang),
      fetchPromptBySlug(supabase, "practice-tutor", lang),
    ]);

    // Fall back to fetching practice-tutor directly if slug-based fetch failed
    let modePrompt = practicePrompt;
    if (!modePrompt) {
      const { data: promptData } = await supabase
        .from("ai_prompts")
        .select("prompt_en, prompt_es")
        .eq("slug", "practice-tutor")
        .eq("is_active", true)
        .single();

      if (promptData) {
        modePrompt = (lang === "es" && promptData.prompt_es)
          ? promptData.prompt_es
          : promptData.prompt_en;
      }
    }

    if (!modePrompt) {
      return errorResponse("server_error", "Tutor prompt not configured", 500, cors);
    }

    // 5b. Look up teacher persona for this course
    const { data: courseTeacher } = await supabase
      .from("courses")
      .select("teacher_id, ai_teachers!teacher_id(persona_en, persona_es, prompt_en, prompt_es)")
      .eq("id", course_id)
      .single();

    let persona = "";
    if (courseTeacher?.teacher_id && courseTeacher?.ai_teachers) {
      const t = courseTeacher.ai_teachers as Record<string, unknown>;
      persona = (lang === "es" && t.persona_es)
        ? t.persona_es as string
        : (t.persona_en ?? t.prompt_en ?? "") as string;
    }

    // 6. Load existing conversation from course_conversations
    let existingMessages: Array<{ role: string; content: string; timestamp?: string }> = [];
    let existingConversation: Record<string, unknown> | null = null;
    let conversationId = conversation_id;

    if (conversationId) {
      const { data: convo } = await supabase
        .from("course_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .single();

      if (convo) {
        existingConversation = convo;
        existingMessages = (convo.messages as Array<{ role: string; content: string; timestamp?: string }>) || [];
      }
    }

    // Include session context (topics tracked so far) in prompt
    const sessionContext = existingConversation
      ? {
          topics_covered: (existingConversation.topics_discussed as string[]) || [],
          session_summary: (existingConversation.session_summary as string) || undefined,
        }
      : null;

    const assembledSystemPrompt = assembleSystemPrompt({
      globalRules,
      persona,
      modePrompt,
      contentMd: contentContext,
      session: sessionContext,
    });

    // 7. Build messages for OpenAI
    const aiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: assembledSystemPrompt },
    ];

    // Keep last 20 messages for context window management
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
      maxTokens: 1500,
    });

    // Track credits (course_player/tutor)
    const credits = await getCreditCost(supabase, groupId, "course_player", "tutor");
    await trackAndIncrement(supabase, userId, groupId, credits, {
      domain: "course_player",
      action: "tutor",
      edge_function: "course-tutor",
      model: "gpt-5.2",
      metadata: { course_id: courseId, section_id: sectionId },
    });

    // 9. Upsert course_conversations
    const now = new Date().toISOString();
    const updatedMessages = [
      ...existingMessages,
      { role: "user", content: message, timestamp: now },
      {
        role: "assistant",
        content: tutorResponse.reply,
        timestamp: now,
        readiness_score: tutorResponse.readiness_score,
      },
    ];

    // Merge topics: existing + newly covered
    const existingTopics = (existingConversation?.topics_discussed as string[]) || [];
    const allTopics = [...new Set([...existingTopics, ...tutorResponse.topics_covered])];

    if (existingConversation) {
      // Update existing conversation record
      const { error: updateError } = await supabase
        .from("course_conversations")
        .update({
          messages: updatedMessages,
          topics_discussed: allTopics,
        })
        .eq("id", conversationId);

      if (updateError) {
        console.error("[course-tutor] Conversation update error:", updateError.message);
      }
    } else {
      // Fetch enrollment for linking
      const { data: enrollment } = await supabase
        .from("course_enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", course_id)
        .maybeSingle();

      const { data: newConvo, error: insertError } = await supabase
        .from("course_conversations")
        .insert({
          user_id: userId,
          course_id,
          section_id: section_id || null,
          enrollment_id: enrollment?.id || null,
          messages: updatedMessages,
          topics_discussed: allTopics,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[course-tutor] Conversation insert error:", insertError.message);
      } else {
        conversationId = newConvo.id;
      }
    }

    console.log(`[course-tutor] Readiness: ${tutorResponse.readiness_score}, Suggest: ${tutorResponse.suggest_test}`);

    return jsonResponse({
      reply: tutorResponse.reply,
      readiness_score: tutorResponse.readiness_score,
      suggest_test: tutorResponse.suggest_test,
      topics_covered: tutorResponse.topics_covered,
      conversation_id: conversationId,
    }, 200, cors);
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
    console.error("[course-tutor] Unhandled error:", err);
    return errorResponse(
      "server_error",
      err instanceof Error ? err.message : "Internal server error",
      500,
      cors,
    );
  }
});
