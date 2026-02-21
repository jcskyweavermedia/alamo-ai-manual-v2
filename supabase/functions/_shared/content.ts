/**
 * Shared content serializers and loading helpers.
 *
 * Canonical versions — use the richer serializers (from course-quiz-generate)
 * that include all fields for better AI context.
 */

import type { SupabaseClient } from "./supabase.ts";

// =============================================================================
// SERIALIZERS
// =============================================================================

export function serializeManualSection(item: Record<string, unknown>, lang: string): string {
  const content = lang === "es" && item.content_es
    ? item.content_es as string
    : item.content_en as string;
  return content?.substring(0, 4000) || "";
}

export function serializeDish(d: Record<string, unknown>): string {
  return [
    `Dish: ${d.menu_name || d.name}`,
    d.plate_type ? `Type: ${d.plate_type}` : null,
    d.short_description ? `Description: ${d.short_description}` : null,
    d.key_ingredients ? `Key Ingredients: ${(d.key_ingredients as string[]).join(", ")}` : null,
    d.allergens ? `Allergens: ${(d.allergens as string[]).join(", ") || "none"}` : null,
    d.preparation_notes ? `Preparation: ${d.preparation_notes}` : null,
    d.upsell_notes ? `Upsell: ${d.upsell_notes}` : null,
  ].filter(Boolean).join("\n");
}

export function serializeWine(w: Record<string, unknown>): string {
  return [
    `Wine: ${w.name}`,
    w.region ? `Region: ${w.region}` : null,
    w.grape_varieties ? `Grapes: ${(w.grape_varieties as string[]).join(", ")}` : null,
    w.tasting_notes ? `Tasting: ${w.tasting_notes}` : null,
    w.food_pairings ? `Pairings: ${(w.food_pairings as string[]).join(", ")}` : null,
    w.serving_temp ? `Serving Temp: ${w.serving_temp}` : null,
  ].filter(Boolean).join("\n");
}

export function serializeCocktail(c: Record<string, unknown>): string {
  return [
    `Cocktail: ${c.name}`,
    c.category ? `Category: ${c.category}` : null,
    c.base_spirit ? `Base Spirit: ${c.base_spirit}` : null,
    c.ingredients ? `Ingredients: ${(c.ingredients as string[]).join(", ")}` : null,
    c.flavor_profile ? `Flavor: ${c.flavor_profile}` : null,
    c.garnish ? `Garnish: ${c.garnish}` : null,
  ].filter(Boolean).join("\n");
}

export function serializeBeerLiquor(b: Record<string, unknown>): string {
  return [
    `${b.item_type || "Item"}: ${b.name}`,
    b.category ? `Category: ${b.category}` : null,
    b.style ? `Style: ${b.style}` : null,
    b.origin ? `Origin: ${b.origin}` : null,
    b.abv ? `ABV: ${b.abv}%` : null,
    b.tasting_notes ? `Tasting: ${b.tasting_notes}` : null,
    b.food_pairings ? `Pairings: ${(b.food_pairings as string[]).join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

export function serializeRecipe(r: Record<string, unknown>): string {
  const parts: (string | null)[] = [
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

// =============================================================================
// LOOKUP MAPS
// =============================================================================

export const CONTENT_SERIALIZERS: Record<string, (item: Record<string, unknown>, lang?: string) => string> = {
  manual_sections: serializeManualSection,
  foh_plate_specs: serializeDish,
  plate_specs: serializeRecipe,
  prep_recipes: serializeRecipe,
  wines: serializeWine,
  cocktails: serializeCocktail,
  beer_liquor_list: serializeBeerLiquor,
};

export const SOURCE_TABLE: Record<string, string> = {
  manual_sections: "manual_sections",
  foh_plate_specs: "foh_plate_specs",
  plate_specs: "plate_specs",
  prep_recipes: "prep_recipes",
  wines: "wines",
  cocktails: "cocktails",
  beer_liquor_list: "beer_liquor_list",
};

// =============================================================================
// CONTENT LOADER
// =============================================================================

/**
 * Load and serialize content for an array of course sections.
 * Returns a single string with all content, separated by section headers.
 *
 * @param includePlaceholders - If true, emit "(No content available)" for sections
 *   with no content (custom or empty). Used by module test generation so the AI
 *   knows all sections exist.
 */
export async function loadSectionContent(
  supabase: SupabaseClient,
  sections: Array<Record<string, unknown>>,
  language: string,
  includePlaceholders = false,
): Promise<string> {
  const parts: string[] = [];

  for (const sec of sections) {
    const contentSource = sec.content_source as string;
    const contentIds = (sec.content_ids || []) as string[];
    const title = language === "es" && sec.title_es ? sec.title_es : sec.title_en;

    if (contentSource === "custom" || contentIds.length === 0) {
      if (includePlaceholders) {
        parts.push(`=== ${title} ===\n(No content available)`);
      }
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
    const serialized = items
      .map((item: Record<string, unknown>) => serializer(item, language))
      .join("\n");
    parts.push(`=== ${title} ===\n${serialized}`);
  }

  return parts.join("\n\n");
}
