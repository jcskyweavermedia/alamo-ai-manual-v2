/**
 * Embed Products Edge Function
 *
 * Generates OpenAI embeddings for all 6 product tables.
 * English-only (single `embedding` column per table).
 * Follows the same pattern as embed-sections.
 *
 * Auth: verify_jwt=false — admin-only batch operation via service role key.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// =============================================================================
// TYPES
// =============================================================================

interface EmbedProductsRequest {
  table?: string;
  rowId?: string;
  batchSize?: number;
}

interface TableResult {
  processed: number;
  total: number;
}

// All product tables in processing order
const ALL_TABLES = [
  "prep_recipes",
  "plate_specs",
  "foh_plate_specs",
  "wines",
  "cocktails",
  "beer_liquor_list",
] as const;

type ProductTable = (typeof ALL_TABLES)[number];

// Columns to SELECT per table (id + text-builder fields only)
const TABLE_COLUMNS: Record<ProductTable, string> = {
  prep_recipes:
    "id, name, prep_type, tags, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, ingredients, procedure",
  plate_specs:
    "id, name, plate_type, menu_category, tags, components, assembly_procedure, notes",
  foh_plate_specs:
    "id, menu_name, plate_type, short_description, detailed_description, key_ingredients, flavor_profile, allergens, upsell_notes",
  wines:
    "id, name, producer, vintage, varietal, region, country, style, body, tasting_notes, producer_notes",
  cocktails:
    "id, name, style, glass, key_ingredients, ingredients, procedure, tasting_notes, description",
  beer_liquor_list:
    "id, name, category, subcategory, producer, country, style, description, notes",
};

// =============================================================================
// TEXT BUILDERS (one per table)
// =============================================================================

function buildPrepRecipeText(row: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`Name: ${row.name}`);
  if (row.prep_type) parts.push(`Type: ${row.prep_type}`);

  const tags = row.tags as string[] | null;
  if (tags?.length) parts.push(`Tags: ${tags.join(", ")}`);

  if (row.yield_qty || row.yield_unit) {
    parts.push(
      `Yield: ${row.yield_qty ?? ""} ${row.yield_unit ?? ""}`.trim()
    );
  }
  if (row.shelf_life_value || row.shelf_life_unit) {
    parts.push(
      `Shelf Life: ${row.shelf_life_value ?? ""} ${row.shelf_life_unit ?? ""}`.trim()
    );
  }

  // ingredients: JSONB [{ group_name, items: [{ name, ... }] }]
  const ingredients = row.ingredients as
    | { items: { name: string }[] }[]
    | null;
  if (ingredients?.length) {
    const names = ingredients.flatMap((g) => g.items.map((i) => i.name));
    parts.push(`Ingredients: ${names.join(", ")}`);
  }

  // procedure: JSONB [{ group_name, steps: [{ instruction, ... }] }]
  const procedure = row.procedure as
    | { steps: { instruction: string }[] }[]
    | null;
  if (procedure?.length) {
    const steps = procedure.flatMap((g) => g.steps.map((s) => s.instruction));
    parts.push(`Procedure: ${steps.join(" ")}`);
  }

  return parts.join("\n");
}

function buildPlateSpecText(row: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`Name: ${row.name}`);
  if (row.plate_type) parts.push(`Type: ${row.plate_type}`);
  if (row.menu_category) parts.push(`Category: ${row.menu_category}`);

  const tags = row.tags as string[] | null;
  if (tags?.length) parts.push(`Tags: ${tags.join(", ")}`);

  // components: JSONB [{ group_name, items: [{ name, ... }] }]
  const components = row.components as
    | { items: { name: string }[] }[]
    | null;
  if (components?.length) {
    const names = components.flatMap((g) => g.items.map((i) => i.name));
    parts.push(`Components: ${names.join(", ")}`);
  }

  // assembly_procedure: JSONB [{ group_name, steps: [{ instruction, ... }] }]
  const assembly = row.assembly_procedure as
    | { steps: { instruction: string }[] }[]
    | null;
  if (assembly?.length) {
    const steps = assembly.flatMap((g) => g.steps.map((s) => s.instruction));
    parts.push(`Assembly: ${steps.join(" ")}`);
  }

  if (row.notes) parts.push(`Notes: ${row.notes}`);

  return parts.join("\n");
}

function buildFohPlateSpecText(row: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`Menu Name: ${row.menu_name}`);
  if (row.plate_type) parts.push(`Type: ${row.plate_type}`);
  if (row.short_description)
    parts.push(`Short Description: ${row.short_description}`);
  if (row.detailed_description)
    parts.push(`Detailed Description: ${row.detailed_description}`);

  // key_ingredients: text[] (PostgreSQL array)
  const keyIngredients = row.key_ingredients as string[] | null;
  if (keyIngredients?.length)
    parts.push(`Key Ingredients: ${keyIngredients.join(", ")}`);

  // flavor_profile: text[] (PostgreSQL array)
  const flavor = row.flavor_profile as string[] | null;
  if (flavor?.length) parts.push(`Flavor Profile: ${flavor.join(", ")}`);

  // allergens: text[] (PostgreSQL array)
  const allergens = row.allergens as string[] | null;
  if (allergens?.length) parts.push(`Allergens: ${allergens.join(", ")}`);

  if (row.upsell_notes) parts.push(`Upsell Notes: ${row.upsell_notes}`);

  return parts.join("\n");
}

function buildWineText(row: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`Name: ${row.name}`);
  if (row.producer) parts.push(`Producer: ${row.producer}`);
  if (row.vintage) parts.push(`Vintage: ${row.vintage}`);
  if (row.varietal) parts.push(`Varietal: ${row.varietal}`);

  const region = [row.region, row.country].filter(Boolean).join(", ");
  if (region) parts.push(`Region: ${region}`);

  const styleBody = [row.style, row.body ? `Body: ${row.body}` : null]
    .filter(Boolean)
    .join(", ");
  if (styleBody) parts.push(`Style: ${styleBody}`);

  if (row.tasting_notes) parts.push(`Tasting Notes: ${row.tasting_notes}`);
  if (row.producer_notes) parts.push(`Producer Notes: ${row.producer_notes}`);

  return parts.join("\n");
}

function buildCocktailText(row: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`Name: ${row.name}`);
  if (row.style) parts.push(`Style: ${row.style}`);
  if (row.glass) parts.push(`Glass: ${row.glass}`);

  // key_ingredients: text (plain string)
  if (row.key_ingredients)
    parts.push(`Key Ingredients: ${row.key_ingredients}`);

  // ingredients: JSONB RecipeIngredientGroup[]
  const groups = (row.ingredients as any[]) || [];
  const ingredientNames = groups
    .flatMap((g: any) => (g.items || []).map((i: any) =>
      [i.quantity, i.unit, i.name].filter(Boolean).join(' ').trim()
    ))
    .filter(Boolean);
  if (ingredientNames.length) parts.push(`Ingredients: ${ingredientNames.join(', ')}`);

  // procedure: JSONB [{ step, instruction }]
  const procedure = row.procedure as
    | { instruction: string }[]
    | null;
  if (procedure?.length) {
    const steps = procedure.map((s) => s.instruction);
    parts.push(`Procedure: ${steps.join(" ")}`);
  }

  if (row.tasting_notes) parts.push(`Tasting Notes: ${row.tasting_notes}`);
  if (row.description) parts.push(`Description: ${row.description}`);

  return parts.join("\n");
}

function buildBeerLiquorText(row: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`Name: ${row.name}`);
  if (row.category) parts.push(`Category: ${row.category}`);
  if (row.subcategory) parts.push(`Subcategory: ${row.subcategory}`);
  if (row.producer) parts.push(`Producer: ${row.producer}`);
  if (row.country) parts.push(`Country: ${row.country}`);
  if (row.style) parts.push(`Style: ${row.style}`);
  if (row.description) parts.push(`Description: ${row.description}`);
  if (row.notes) parts.push(`Notes: ${row.notes}`);

  return parts.join("\n");
}

// Map table name → text builder
const TEXT_BUILDERS: Record<
  ProductTable,
  (row: Record<string, unknown>) => string
> = {
  prep_recipes: buildPrepRecipeText,
  plate_specs: buildPlateSpecText,
  foh_plate_specs: buildFohPlateSpecText,
  wines: buildWineText,
  cocktails: buildCocktailText,
  beer_liquor_list: buildBeerLiquorText,
};

// =============================================================================
// EMBEDDING HELPER
// =============================================================================

async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[embed-products] Request received");

  try {
    // =========================================================================
    // 1. VALIDATE CONFIGURATION
    // =========================================================================
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[embed-products] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // 2. PARSE REQUEST
    // =========================================================================
    let table: string | undefined;
    let rowId: string | undefined;
    let batchSize = 50;

    try {
      const body = (await req.json()) as EmbedProductsRequest;
      table = body.table;
      rowId = body.rowId;
      if (body.batchSize && body.batchSize > 0) batchSize = body.batchSize;
    } catch {
      // Empty body is fine — process all tables
    }

    // Validate table name if provided
    if (table && !ALL_TABLES.includes(table as ProductTable)) {
      return new Response(
        JSON.stringify({
          error: `Invalid table: ${table}. Valid: ${ALL_TABLES.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const targetTables: ProductTable[] = table
      ? [table as ProductTable]
      : [...ALL_TABLES];

    console.log(
      `[embed-products] Targets: ${targetTables.join(", ")}, batchSize: ${batchSize}`
    );

    // =========================================================================
    // 3. PROCESS EACH TABLE
    // =========================================================================
    let totalProcessed = 0;
    let totalFetched = 0;
    const allErrors: string[] = [];
    const tableResults: Record<string, TableResult> = {};

    for (const tbl of targetTables) {
      const columns = TABLE_COLUMNS[tbl];
      const buildText = TEXT_BUILDERS[tbl];

      // Build query
      let query = supabase.from(tbl).select(columns);

      if (rowId) {
        // Single row mode — embed even if already has embedding
        query = query.eq("id", rowId);
      } else {
        // Batch mode — only rows with NULL embedding
        query = query.is("embedding", null);
      }

      const { data: rows, error: fetchError } = await query.limit(batchSize);

      if (fetchError) {
        console.error(
          `[embed-products] Fetch error on ${tbl}:`,
          fetchError.message
        );
        allErrors.push(`${tbl}: fetch failed — ${fetchError.message}`);
        continue;
      }

      if (!rows || rows.length === 0) {
        console.log(`[embed-products] ${tbl}: no rows need embedding`);
        continue;
      }

      console.log(`[embed-products] ${tbl}: processing ${rows.length} rows`);
      let tableProcessed = 0;

      for (const row of rows) {
        try {
          const text = buildText(row as Record<string, unknown>);
          const embedding = await generateEmbedding(text, OPENAI_API_KEY);

          const { error: updateError } = await supabase
            .from(tbl)
            .update({ embedding: JSON.stringify(embedding) })
            .eq("id", row.id);

          if (updateError) {
            console.error(
              `[embed-products] Update failed for ${tbl}/${row.id}:`,
              updateError.message
            );
            allErrors.push(
              `${tbl}/${row.id}: update failed — ${updateError.message}`
            );
          } else {
            tableProcessed++;
            const label =
              (row as Record<string, unknown>).name ||
              (row as Record<string, unknown>).menu_name ||
              row.id;
            console.log(`[embed-products] ${tbl}: ${label}`);
          }

          // 100ms delay between API calls
          if (rows.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          const msg =
            error instanceof Error ? error.message : "Unknown error";
          console.error(
            `[embed-products] Error on ${tbl}/${row.id}:`,
            msg
          );
          allErrors.push(`${tbl}/${row.id}: ${msg}`);
        }
      }

      tableResults[tbl] = {
        processed: tableProcessed,
        total: rows.length,
      };
      totalProcessed += tableProcessed;
      totalFetched += rows.length;
    }

    // =========================================================================
    // 4. RETURN RESULT
    // =========================================================================
    console.log(
      `[embed-products] Complete. Processed: ${totalProcessed}/${totalFetched}, Errors: ${allErrors.length}`
    );

    return new Response(
      JSON.stringify({
        processed: totalProcessed,
        total: totalFetched,
        errors: allErrors.length > 0 ? allErrors : undefined,
        tables: tableResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[embed-products] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
