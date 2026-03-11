/**
 * Generate-Image Edge Function
 *
 * Creates context-aware AI-generated images via DALL-E 3.
 * Two modes:
 *   - product (default): Product photography, stored in product-assets bucket
 *   - course: Educational illustrations for course content, stored in course-media bucket
 *
 * Admin/Manager only. Auth: verify_jwt=false, manual JWT verification.
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

/**
 * Returns the DALL-E size parameter based on product type.
 * Portrait (1024x1792) for bottles/glasses displayed in tall containers.
 * Landscape (1792x1024) for plated dishes and prep items displayed wide.
 */
function getDalleSize(productTable: string): "1024x1792" | "1792x1024" {
  switch (productTable) {
    case "wines":
    case "cocktails":
    case "beer_liquor_list":
      return "1024x1792"; // Portrait — matches aspect-[2/3] and aspect-[3/4] viewer containers
    default:
      return "1792x1024"; // Landscape — plates, prep recipes
  }
}

function buildDallePrompt(
  productTable: string,
  name: string,
  prepType: string,
  description?: string,
  category?: string,
): string {
  const desc = description ? `, ${description}` : "";
  const cat = (category || "").toLowerCase().trim();

  switch (productTable) {
    case "prep_recipes": {
      const typeMap: Record<string, string> = {
        sauce: `Professional food photography of ${name} sauce in a clear deli container on a clean stainless steel surface, cool white backdrop, soft overhead light, subject isolated, no background clutter${desc}`,
        marinade: `Professional food photography of ${name} marinade in a lexan container on a clean stainless steel surface, cool white backdrop, soft overhead light, subject isolated, no background clutter${desc}`,
        stock: `Professional food photography of ${name} in a heavy-bottomed stockpot on a stainless steel surface, warm natural side light, no background clutter${desc}`,
        base: `Professional food photography of ${name} in a heavy-bottomed stockpot on a stainless steel surface, warm natural side light, no background clutter${desc}`,
        cut: `Professional food photography of ${name} portioned on a clean sheet tray, stainless steel surface, cool overhead light, no background clutter${desc}`,
        butchery: `Professional food photography of ${name} portioned on a clean sheet tray, stainless steel surface, cool overhead light, no background clutter${desc}`,
      };
      return (
        typeMap[prepType.toLowerCase()] ||
        `Professional food photography of ${name} in a prep container on a clean stainless steel surface, cool white backdrop, soft overhead light, subject isolated, no background clutter${desc}`
      );
    }

    case "plate_specs":
    case "foh_plate_specs": {
      const isSeafood = /shrimp|lobster|salmon|tuna|halibut|cod|crab|oyster|scallop|fish|seafood/i.test(name);
      const surfaceKey = isSeafood ? "seafood" : (cat || "entree");

      const surfaces: Record<string, { surface: string; light: string }> = {
        entree:    { surface: "dark matte slate plate on rough black granite",    light: "dramatic single side light from left at 30 degrees, warm tungsten" },
        protein:   { surface: "dark matte slate plate on rough black granite",    light: "dramatic single side light from left at 30 degrees, warm tungsten" },
        seafood:   { surface: "cool grey ceramic plate on pale blue-grey stone",  light: "soft cool natural side lighting from left" },
        appetizer: { surface: "warm cream ceramic plate on light natural oak",    light: "gentle warm side light from left" },
        starter:   { surface: "warm cream ceramic plate on light natural oak",    light: "gentle warm side light from left" },
        salad:     { surface: "white ceramic plate on clean white marble",        light: "bright diffused natural light" },
        dessert:   { surface: "white ceramic plate on warm ivory marble",         light: "warm soft diffused light" },
      };

      const s = surfaces[surfaceKey] || surfaces["entree"];
      return `Professional food photography of ${name} plated on a ${s.surface}, 20 degree elevated front angle showing depth and height, ${s.light}, shallow depth of field, subject isolated on clean surface, no restaurant background, no props, generous negative space around plate${desc}`;
    }

    case "wines": {
      const wineStyles: Record<string, { surface: string; backdrop: string; light: string }> = {
        red:       { surface: "burnished dark slate",              backdrop: "deep burgundy-to-charcoal gradient backdrop",   light: "warm amber rim light from left, single tungsten source" },
        white:     { surface: "pale cream marble",                 backdrop: "warm ivory-to-white gradient backdrop",         light: "cool soft diffused daylight" },
        sparkling: { surface: "champagne gold marble",             backdrop: "pale gold-to-ivory gradient backdrop",          light: "bright crisp natural light" },
        champagne: { surface: "champagne gold marble",             backdrop: "pale gold-to-ivory gradient backdrop",          light: "bright crisp natural light" },
        rosé:      { surface: "blush rose quartz stone",           backdrop: "soft pink-to-cream gradient backdrop",         light: "warm afternoon light" },
        rose:      { surface: "blush rose quartz stone",           backdrop: "soft pink-to-cream gradient backdrop",         light: "warm afternoon light" },
        dessert:   { surface: "rich dark walnut wood",             backdrop: "deep amber-to-brown gradient backdrop",        light: "warm candlelight glow from left" },
        port:      { surface: "rich dark walnut wood",             backdrop: "deep amber-to-brown gradient backdrop",        light: "warm candlelight glow from left" },
        fortified: { surface: "rich dark walnut wood",             backdrop: "deep amber-to-brown gradient backdrop",        light: "warm candlelight glow from left" },
      };

      // Determine style key from category, falling back to keyword detection in description
      let styleKey = cat;
      if (!styleKey || !wineStyles[styleKey]) {
        const full = `${cat} ${desc}`.toLowerCase();
        if (/sparkling|champagne|prosecco|cava|crémant|cremant/.test(full)) styleKey = "sparkling";
        else if (/ros[eé]/.test(full)) styleKey = "rose";
        else if (/dessert|port|sherry|sautern|ice wine|fortified/.test(full)) styleKey = "dessert";
        else if (/\bred\b|cabernet|merlot|malbec|pinot noir|syrah|shiraz|zinfandel|tempranillo|sangiovese/.test(full)) styleKey = "red";
        else styleKey = "white";
      }

      const w = wineStyles[styleKey] || wineStyles["white"];
      return `Professional product photography of ${name} wine bottle standing upright centered in frame with a filled wine glass beside it, on a ${w.surface}, ${w.backdrop}, ${w.light}, 25 degree elevated front angle, shallow depth of field, subject isolated on clean surface, no bar or restaurant setting, generous negative space, single soft cast shadow${desc}`;
    }

    case "cocktails": {
      const moods: Record<string, { surface: string; backdrop: string; light: string }> = {
        amber:    { surface: "aged barrel oak with visible wood grain",    backdrop: "deep amber-to-espresso gradient backdrop",    light: "warm tungsten glow from left at low angle" },
        bright:   { surface: "white Italian marble",                       backdrop: "cool white-to-pearl gradient backdrop",        light: "soft diffused studio daylight" },
        tropical: { surface: "natural woven rattan texture",               backdrop: "warm sandy terracotta gradient backdrop",      light: "bright warm sun-toned light" },
        midnight: { surface: "black honed basalt",                         backdrop: "true black-to-deep navy gradient backdrop",    light: "single dramatic spot light, cold blue rim light" },
      };

      const mood = moods[cat] ? cat : "bright";
      const m = moods[mood];
      return `Professional drink photography of ${name} cocktail in proper glassware, garnished, on a ${m.surface}, ${m.backdrop}, ${m.light}, 25 degree elevated front angle, shallow depth of field, subject isolated on clean surface, no bar or restaurant setting, generous negative space, single soft cast shadow${desc}`;
    }

    case "beer_liquor_list": {
      const variants: Record<string, { surface: string; backdrop: string; light: string }> = {
        "light-beer":  { surface: "honey-toned pine wood with visible grain",        backdrop: "warm gold-to-cream gradient backdrop",         light: "bright warm light, condensation on glass" },
        "dark-beer":   { surface: "espresso oak barrel stave",                       backdrop: "deep brown-to-black gradient backdrop",        light: "low warm glow from left" },
        "ipa-craft":   { surface: "weathered pine with warm amber tones",            backdrop: "warm natural amber-to-cream backdrop",         light: "warm natural light" },
        "whiskey":     { surface: "aged charred oak barrelhead",                     backdrop: "rich amber-to-mahogany gradient backdrop",     light: "warm tungsten single source from left" },
        "vodka-gin":   { surface: "frosted pale grey glass panel",                   backdrop: "cool silver-white gradient backdrop",          light: "bright diffused crisp light" },
        "rum":         { surface: "weathered tropical teak wood",                    backdrop: "warm caramel-honey gradient backdrop",         light: "warm natural light from left" },
        "tequila":     { surface: "rough terracotta tile",                           backdrop: "warm desert ochre gradient backdrop",          light: "warm golden light from left" },
        "spirit":      { surface: "dark polished slate",                             backdrop: "charcoal-to-black gradient backdrop",          light: "single warm source light from left" },
      };

      const s = variants[cat] || variants["spirit"];
      return `Professional product photography of ${name} bottle standing upright centered in frame with a filled glass beside it, on a ${s.surface}, ${s.backdrop}, ${s.light}, 25 degree elevated front angle, shallow depth of field, subject isolated on clean surface, no bar setting, generous negative space, single soft cast shadow${desc}`;
    }

    default:
      return `Professional food photography of ${name}, isolated on clean surface, soft directional lighting, no background clutter${desc}`;
  }
}

// =============================================================================
// COURSE IMAGE PROMPT BUILDER
// =============================================================================

type CourseImageType = "educational" | "concept" | "scenario" | "infographic";

function buildCourseImagePrompt(
  imageType: CourseImageType,
  aiInstructions: string,
  elementTitle: string,
): string {
  const styleGuide = `Clean, professional, instructional style illustration.
NOT photorealistic for concepts — more like a high-quality infographic or training manual illustration.
White or light neutral background. No text overlays. Safe for workplace training materials.`;

  switch (imageType) {
    case "educational":
      return `${styleGuide} Create an educational illustration showing: ${aiInstructions}. Context: ${elementTitle}`;
    case "concept":
      return `${styleGuide} Create a concept diagram or visual explanation of: ${aiInstructions}. Context: ${elementTitle}`;
    case "scenario":
      return `${styleGuide} Create a professional workplace scenario illustration showing: ${aiInstructions}. Restaurant/hospitality setting. No identifiable faces.`;
    case "infographic":
      return `${styleGuide} Create a clean infographic-style illustration for: ${aiInstructions}. Use visual hierarchy, icons, and clear layout.`;
    default:
      return `${styleGuide} ${aiInstructions}`;
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
    // 2. ADMIN/MANAGER CHECK
    // =========================================================================
    const { data: membership, error: membershipError } = await supabase
      .from("group_memberships")
      .select("role, group_id")
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      return errorResponse("Forbidden", "No group membership found", 403);
    }

    if (membership.role !== "admin" && membership.role !== "manager") {
      return errorResponse("Forbidden", "Admin or manager access required", 403);
    }

    // =========================================================================
    // 3. PARSE & VALIDATE REQUEST — branch by mode
    // =========================================================================
    const body = await req.json();
    const mode = (body.mode as string) || "product";

    // =========================================================================
    // 4. GET OPENAI API KEY
    // =========================================================================
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[generate-image] OPENAI_API_KEY not configured");
      return errorResponse("server_error", "AI service not configured", 500);
    }

    // =========================================================================
    // MODE: COURSE — Educational illustration via DALL-E 3
    // =========================================================================
    if (mode === "course") {
      const { courseId, elementKey, prompt: promptOverride, imageType, aiInstructions, elementTitle } = body as {
        courseId?: string;
        elementKey?: string;
        prompt?: string;
        imageType?: CourseImageType;
        aiInstructions?: string;
        elementTitle?: string;
      };

      if (!courseId) {
        return errorResponse("bad_request", "courseId is required for course mode", 400);
      }
      if (!elementKey) {
        return errorResponse("bad_request", "elementKey is required for course mode", 400);
      }
      if (!promptOverride && !aiInstructions) {
        return errorResponse("bad_request", "Either prompt or aiInstructions is required", 400);
      }

      // Build the DALL-E prompt
      const coursePrompt = promptOverride ||
        buildCourseImagePrompt(
          imageType || "educational",
          aiInstructions || "",
          elementTitle || "",
        );

      const courseSize = "1024x1024";
      console.log(`[generate-image] Course mode DALL-E prompt (${courseSize}):`, coursePrompt);

      // Call DALL-E 3
      const dalleResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: coursePrompt,
          n: 1,
          size: courseSize,
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
      const revisedPrompt = dalleData.data?.[0]?.revised_prompt;

      if (!tempImageUrl) {
        console.error("[generate-image] DALL-E returned no image URL");
        return errorResponse("ai_error", "AI returned no image", 500);
      }

      console.log("[generate-image] Course image generated, downloading...");

      // Download the image
      const imageResponse = await fetch(tempImageUrl);
      if (!imageResponse.ok) {
        console.error(`[generate-image] Failed to download image: ${imageResponse.status}`);
        return errorResponse("server_error", "Failed to download generated image", 500);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      console.log(`[generate-image] Downloaded ${imageBuffer.byteLength} bytes`);

      // Upload to course-media bucket
      const storagePath = `courses/${courseId}/elements/${elementKey}/${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("course-media")
        .upload(storagePath, imageBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) {
        console.error("[generate-image] Course media upload failed:", uploadError.message);
        return errorResponse("server_error", "Failed to store generated image", 500);
      }

      // course-media is a private bucket — use signed URL (1 year expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("course-media")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error("[generate-image] Failed to generate signed URL:", signedUrlError?.message);
        return errorResponse("server_error", "Failed to generate image URL", 500);
      }

      const imageUrl = signedUrlData.signedUrl;
      console.log(`[generate-image] Course image stored at: ${imageUrl}`);

      return jsonResponse({
        imageUrl,
        revised_prompt: revisedPrompt || coursePrompt,
        mode: "course",
      });
    }

    // =========================================================================
    // MODE: PRODUCT (default) — Product photography
    // =========================================================================
    const { productTable, name, prepType, description, category, sessionId } = body as {
      productTable?: string;
      name?: string;
      prepType?: string;
      description?: string;
      category?: string;
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
    // 5. BUILD PROMPT & CALL DALL-E 3
    // =========================================================================
    const prompt = buildDallePrompt(productTable, name, prepType || "", description, category);
    const size = getDalleSize(productTable);
    console.log(`[generate-image] DALL-E prompt (${size}):`, prompt);

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
        size,
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
    return jsonResponse({ imageUrl, prompt, mode: "product" });
  } catch (error) {
    console.error("[generate-image] Unexpected error:", error);
    return errorResponse("server_error", "An unexpected error occurred", 500);
  }
});
