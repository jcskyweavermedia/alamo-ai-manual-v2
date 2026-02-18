/**
 * TTS Edge Function
 *
 * Converts text to speech using OpenAI's TTS API.
 * Returns MP3 audio binary. Auth: manual JWT verification.
 * No usage increment — already counted by the /ask call that generated the text.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // =========================================================================
    // 1. AUTHENTICATE USER
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    // =========================================================================
    // 2. PARSE & VALIDATE
    // =========================================================================
    const { text, voice = "nova" } = await req.json();

    if (!text || typeof text !== "string") {
      return errorResponse("Missing or invalid 'text' field", 400);
    }

    if (text.length > 4096) {
      return errorResponse("Text exceeds 4096 character limit", 400);
    }

    console.log(
      `[tts] User ${user.id}, text length: ${text.length}, voice: ${voice}`
    );

    // =========================================================================
    // 3. CALL OPENAI TTS
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[tts] OPENAI_API_KEY not configured");
      return errorResponse("Service not configured", 500);
    }

    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice,
        response_format: "mp3",
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("[tts] OpenAI error:", ttsResponse.status, errorText);
      return errorResponse("TTS generation failed", 502);
    }

    console.log("[tts] Audio generated successfully");

    // =========================================================================
    // 4. STREAM AUDIO BACK
    // =========================================================================
    return new Response(ttsResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[tts] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});
