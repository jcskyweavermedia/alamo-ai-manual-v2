/**
 * Generate-Image Edge Function
 *
 * Creates context-aware AI-generated placeholder images via DALL-E 3.
 * Uploads the result to Supabase Storage (product-assets bucket).
 *
 * Admin-only. Auth: verify_jwt=false, manual JWT verification.
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

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: string, message?: string, status = 400): Response {
  const body: { error: string; message?: string } = { error };
  if (message) body.message = message;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

const VALID_TABLES = new Set([
  "prep_recipes",
  "plate_specs",
  "foh_plate_specs",
  "wines",
  "cocktails",
  "beer_liquor_list",
]);

function buildDallePrompt(
  productTable: string,
  name: string,
  prepType: string,
  description?: string,
): string {
  const desc = description ? `, ${description}` : "";

  switch (productTable) {
    case "prep_recipes": {
      const typeMap: Record<string, string> = {
        sauce: `Professional kitchen photo of ${name} sauce in a clear deli container, prep kitchen setting, top-down angle, clean stainless steel background${desc}`,
        marinade: `Professional kitchen photo of ${name} marinade in a lexan container, prep kitchen setting, top-down angle, clean stainless steel background${desc}`,
        stock: `Professional kitchen photo of ${name} in a large stockpot, commercial kitchen, warm lighting${desc}`,
        base: `Professional kitchen photo of ${name} in a large stockpot, commercial kitchen, warm lighting${desc}`,
        cut: `Professional kitchen photo of ${name} portioned on a sheet tray, prep station, clean cutting board${desc}`,
        butchery: `Professional kitchen photo of ${name} portioned on a sheet tray, prep station, clean cutting board${desc}`,
      };
      return (
        typeMap[prepType.toLowerCase()] ||
        `Professional kitchen photo of ${name} in a prep container, commercial kitchen setting, top-down angle, clean stainless steel background${desc}`
      );
    }
    case "plate_specs":
    case "foh_plate_specs":
      return `Beautiful restaurant plate presentation of ${name}, fine dining, dramatic lighting, clean white plate, overhead angle${desc}`;
    case "wines":
      return `Professional wine photo of ${name}, restaurant setting, wine glass with appropriate pour, elegant lighting${desc}`;
    case "cocktails":
      return `Professional cocktail photo of ${name}, bar setting, garnished, dramatic lighting, clean background${desc}`;
    case "beer_liquor_list":
      return `Professional beverage photo of ${name}, bar setting, proper glassware, warm lighting${desc}`;
    default:
      return `Professional food photo of ${name}, restaurant setting, clean presentation${desc}`;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[generate-image] Request received");

  try {
    // =========================================================================
    // 1. AUTHENTICATE USER
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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.log("[generate-image] Invalid token:", userError?.message);
      return errorResponse("Unauthorized", "Invalid token", 401);
    }

    const userId = user.id;
    console.log("[generate-image] Authenticated user:", userId);

    // Service role client for storage operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. ADMIN CHECK
    // =========================================================================
    const { data: membership, error: membershipError } = await supabase
      .from("group_memberships")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      return errorResponse("Forbidden", "No group membership found", 403);
    }

    if (membership.role !== "admin") {
      return errorResponse("Forbidden", "Admin access required", 403);
    }

    // =========================================================================
    // 3. PARSE & VALIDATE REQUEST
    // =========================================================================
    const body = await req.json();
    const { productTable, name, prepType, description, sessionId } = body as {
      productTable?: string;
      name?: string;
      prepType?: string;
      description?: string;
      sessionId?: string;
    };

    if (!name?.trim()) {
      return errorResponse("bad_request", "name is required", 400);
    }

    if (!productTable || !VALID_TABLES.has(productTable)) {
      return errorResponse(
        "bad_request",
        `productTable must be one of: ${[...VALID_TABLES].join(", ")}`,
        400,
      );
    }

    // =========================================================================
    // 4. GET OPENAI API KEY
    // =========================================================================
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[generate-image] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    // =========================================================================
    // 5. BUILD PROMPT & CALL DALL-E 3
    // =========================================================================
    const prompt = buildDallePrompt(productTable, name, prepType || "", description);
    console.log("[generate-image] DALL-E prompt:", prompt);

    const dalleResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });

    if (!dalleResponse.ok) {
      const errText = await dalleResponse.text();
      console.error(`[generate-image] DALL-E error ${dalleResponse.status}:`, errText);
      return errorResponse("ai_error", "Failed to generate image", 500);
    }

    const dalleData = await dalleResponse.json();
    const tempImageUrl = dalleData.data?.[0]?.url;

    if (!tempImageUrl) {
      console.error("[generate-image] DALL-E returned no image URL");
      return errorResponse("ai_error", "AI returned no image", 500);
    }

    console.log("[generate-image] DALL-E image generated, downloading...");

    // =========================================================================
    // 6. DOWNLOAD GENERATED IMAGE
    // =========================================================================
    const imageResponse = await fetch(tempImageUrl);
    if (!imageResponse.ok) {
      console.error(`[generate-image] Failed to download image: ${imageResponse.status}`);
      return errorResponse("server_error", "Failed to download generated image", 500);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    console.log(`[generate-image] Downloaded ${imageBuffer.byteLength} bytes`);

    // =========================================================================
    // 7. UPLOAD TO SUPABASE STORAGE
    // =========================================================================
    const storagePath = `generated/${sessionId || "no-session"}/${Date.now()}-ai-generated.png`;

    const { error: uploadError } = await supabase.storage
      .from("product-assets")
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("[generate-image] Storage upload failed:", uploadError.message);
      return errorResponse("server_error", "Failed to store generated image", 500);
    }

    const { data: publicUrlData } = supabase.storage
      .from("product-assets")
      .getPublicUrl(storagePath);

    if (!publicUrlData?.publicUrl) {
      console.error("[generate-image] Failed to generate public URL");
      return errorResponse("server_error", "Failed to generate public URL", 500);
    }

    const imageUrl = publicUrlData.publicUrl;
    console.log(`[generate-image] Stored at: ${imageUrl}`);

    // =========================================================================
    // 8. RETURN RESPONSE
    // =========================================================================
    return jsonResponse({ imageUrl, prompt });
  } catch (error) {
    console.error("[generate-image] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
