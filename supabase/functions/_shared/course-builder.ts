/**
 * Shared utilities for the Course Builder AI pipeline.
 *
 * Used by:
 *   - build-course (outline + content + chat_edit)
 *   - build-course-element (single element regeneration)
 *
 * Provides:
 *   - assembleSourceMaterial() — fetches full sections + products, serializes for AI
 *   - computeContentHash() — SHA-256 hash for source_refs change tracking
 *   - estimateTokens() — rough token count for context budgeting
 *   - serializeElementForAI() — convert element to AI-readable text
 *   - parseAIOutlineResponse() — validate & normalize outline from AI
 *   - parseAIElementResponse() — validate & normalize element content from AI
 */

import type { SupabaseClient } from "./supabase.ts";
import { CONTENT_SERIALIZERS, SOURCE_TABLE } from "./content.ts";

// =============================================================================
// TYPES
// =============================================================================

export interface SourceRef {
  table: string;
  id: string;
  content_hash: string;
}

export interface SourceProduct {
  table: string;
  ids: string[];
}

export interface OutlineElement {
  type: "content" | "feature" | "media" | "product_viewer";
  key: string;
  title_en: string;
  title_es: string;
  ai_instructions: string;
  sort_order: number;
  source_refs: SourceRef[];
  variant?: string;
  media_type?: string;
  image_source?: string;
  product_image_ref?: string;
  products?: Array<{
    table: string;
    id: string;
    name_en: string;
    name_es: string;
  }>;
}

export interface OutlineSection {
  title_en: string;
  title_es: string;
  elements: OutlineElement[];
}

export interface AIOutlineResponse {
  sections: OutlineSection[];
}

export interface AIElementResponse {
  title_en?: string;
  title_es?: string;
  body_en: string;
  body_es: string;
  variant?: string;
}

export interface AIChatEditAction {
  key: string;
  action: "update" | "insert" | "delete";
  // deno-lint-ignore no-explicit-any
  element?: Record<string, any>;
  insert_after?: string;
}

export interface AIChatEditResponse {
  modified_elements: AIChatEditAction[];
}

export interface AssembledMaterial {
  text: string;
  hashes: Map<string, string>; // key: "table:id", value: sha256 hash
  names: Map<string, string>;  // key: "table:id", value: product name (EN)
  namesEs: Map<string, string>; // key: "table:id", value: product name (ES)
  tokenEstimate: number;
}

// =============================================================================
// CONTENT HASH (using Web Crypto API available in Deno)
// =============================================================================

/**
 * Compute SHA-256 hex hash of a string.
 * Uses the Deno-native crypto.subtle API.
 * Note: MD5 is not supported in Deno's crypto.subtle — use SHA-256 instead.
 */
export async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Rough token estimate: ~0.75 tokens per English word.
 * Good enough for context window budgeting.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 0.75);
}

// =============================================================================
// SOURCE MATERIAL ASSEMBLY
// =============================================================================

/**
 * Fetch full sections via get_full_sections() + products from their tables.
 * Returns assembled text with section headers and a hash map for source_refs.
 *
 * @param sourceSections - Array of manual_sections UUIDs
 * @param sourceProducts - Array of {table, ids} for product tables
 * @param supabase - Service-role client
 * @param language - 'en' or 'es'
 */
export async function assembleSourceMaterial(
  sourceSections: string[] | undefined,
  sourceProducts: SourceProduct[] | undefined,
  supabase: SupabaseClient,
  language: "en" | "es" = "en",
): Promise<AssembledMaterial> {
  const parts: string[] = [];
  const hashes = new Map<string, string>();
  const names = new Map<string, string>();
  const namesEs = new Map<string, string>();

  // ── 1. Fetch full manual sections ──────────────────────────────────────
  if (sourceSections && sourceSections.length > 0) {
    const { data: sections, error } = await supabase.rpc("get_full_sections", {
      section_ids: sourceSections,
    });

    if (error) {
      console.error("[course-builder] get_full_sections error:", error.message);
    } else if (sections && sections.length > 0) {
      for (const sec of sections) {
        const content =
          language === "es" && sec.content_es
            ? sec.content_es
            : sec.content_en;
        if (!content) continue;

        const hash = await computeContentHash(content);
        hashes.set(`manual_sections:${sec.id}`, hash);

        const title =
          language === "es" && sec.title_es ? sec.title_es : sec.title_en;
        parts.push(`=== Manual Section: ${title} ===\n${content}`);
      }
    }
  }

  // ── 2. Fetch products from each table ──────────────────────────────────
  if (sourceProducts && sourceProducts.length > 0) {
    for (const group of sourceProducts) {
      const tableName = SOURCE_TABLE[group.table] || group.table;
      if (!group.ids || group.ids.length === 0) continue;

      try {
        const { data: items, error } = await supabase
          .from(tableName)
          .select("*")
          .in("id", group.ids);

        if (error) {
          console.error(
            `[course-builder] Product fetch error (${tableName}):`,
            error.message,
          );
          continue;
        }

        if (!items || items.length === 0) continue;

        const serializer = CONTENT_SERIALIZERS[group.table];
        if (!serializer) {
          console.warn(
            `[course-builder] No serializer for table: ${group.table}`,
          );
          continue;
        }

        for (const item of items) {
          const serialized = serializer(item as Record<string, unknown>, language);
          const hash = await computeContentHash(serialized);
          hashes.set(`${group.table}:${item.id}`, hash);
          parts.push(serialized);

          // Collect denormalized names for product_viewer insertion
          const nameField = group.table === "foh_plate_specs" ? "menu_name" : "name";
          const nameEsField = group.table === "foh_plate_specs" ? "menu_name_es" : "name_es";
          names.set(`${group.table}:${item.id}`, (item[nameField] as string) || "");
          namesEs.set(`${group.table}:${item.id}`, (item[nameEsField] as string) || "");
        }
      } catch (err) {
        console.error(
          `[course-builder] Product fetch exception (${tableName}):`,
          err,
        );
      }
    }
  }

  const text = parts.join("\n\n");
  return {
    text,
    hashes,
    names,
    namesEs,
    tokenEstimate: estimateTokens(text),
  };
}

/**
 * Fetch source material for a single element's source_refs.
 * Used by content generation and element regeneration.
 */
export async function fetchElementSourceMaterial(
  sourceRefs: SourceRef[],
  supabase: SupabaseClient,
  language: "en" | "es" = "en",
): Promise<string> {
  if (!sourceRefs || sourceRefs.length === 0) return "";

  // Group refs by table
  const grouped = new Map<string, string[]>();
  for (const ref of sourceRefs) {
    const existing = grouped.get(ref.table) || [];
    existing.push(ref.id);
    grouped.set(ref.table, existing);
  }

  const parts: string[] = [];

  // Fetch manual sections via get_full_sections
  const manualIds = grouped.get("manual_sections");
  if (manualIds && manualIds.length > 0) {
    const { data: sections } = await supabase.rpc("get_full_sections", {
      section_ids: manualIds,
    });
    if (sections) {
      for (const sec of sections) {
        const content =
          language === "es" && sec.content_es
            ? sec.content_es
            : sec.content_en;
        if (content) {
          const title =
            language === "es" && sec.title_es ? sec.title_es : sec.title_en;
          parts.push(`=== ${title} ===\n${content}`);
        }
      }
    }
  }

  // Fetch products from each table
  for (const [table, ids] of grouped.entries()) {
    if (table === "manual_sections") continue;
    const tableName = SOURCE_TABLE[table] || table;
    const serializer = CONTENT_SERIALIZERS[table];
    if (!serializer) continue;

    try {
      const { data: items } = await supabase
        .from(tableName)
        .select("*")
        .in("id", ids);

      if (items) {
        for (const item of items) {
          parts.push(serializer(item as Record<string, unknown>, language));
        }
      }
    } catch (err) {
      console.error(
        `[course-builder] fetchElementSourceMaterial error (${tableName}):`,
        err,
      );
    }
  }

  return parts.join("\n\n");
}

// =============================================================================
// ELEMENT SERIALIZATION (for AI context)
// =============================================================================

/**
 * Convert a course element to AI-readable text for context.
 * Used when the AI needs to see existing elements (e.g., chat_edit mode).
 */
// deno-lint-ignore no-explicit-any
export function serializeElementForAI(element: Record<string, any>): string {
  const parts: string[] = [
    `[${element.type}] key="${element.key}" title="${element.title_en || ""}"`,
  ];

  if (element.variant) parts.push(`variant: ${element.variant}`);
  if (element.ai_instructions) parts.push(`instructions: ${element.ai_instructions}`);
  if (element.body_en) parts.push(`content:\n${element.body_en}`);
  if (element.products && Array.isArray(element.products)) {
    parts.push(`products: ${element.products.map((p: { name_en?: string }) => p.name_en).join(", ")}`);
  }
  if (element.status) parts.push(`status: ${element.status}`);

  return parts.join("\n");
}

// =============================================================================
// AI RESPONSE PARSERS & VALIDATORS
// =============================================================================

/**
 * Validate and normalize outline response from AI.
 * Ensures required fields exist on sections and elements.
 */
export function parseAIOutlineResponse(
  // deno-lint-ignore no-explicit-any
  json: any,
): AIOutlineResponse | null {
  if (!json || !Array.isArray(json.sections)) {
    console.error("[course-builder] Invalid outline: missing sections array");
    return null;
  }

  const sections: OutlineSection[] = [];

  for (let si = 0; si < json.sections.length; si++) {
    const rawSection = json.sections[si];
    if (!rawSection.title_en || !rawSection.title_es) {
      console.warn(`[course-builder] Section ${si}: missing title_en or title_es, skipping`);
      continue;
    }

    if (!Array.isArray(rawSection.elements)) {
      console.warn(`[course-builder] Section ${si}: elements is not an array, using empty`);
      rawSection.elements = [];
    }

    const elements: OutlineElement[] = [];
    for (let ei = 0; ei < rawSection.elements.length; ei++) {
      const rawEl = rawSection.elements[ei];

      // Validate required fields
      if (!rawEl.type || !rawEl.key || !rawEl.title_en || !rawEl.title_es) {
        console.warn(
          `[course-builder] Section ${si}, Element ${ei}: missing required field, skipping`,
        );
        continue;
      }

      // Normalize type
      const validTypes = ["content", "feature", "media", "product_viewer"];
      if (!validTypes.includes(rawEl.type)) {
        console.warn(
          `[course-builder] Section ${si}, Element ${ei}: invalid type "${rawEl.type}", skipping`,
        );
        continue;
      }

      elements.push({
        type: rawEl.type,
        key: rawEl.key,
        title_en: rawEl.title_en,
        title_es: rawEl.title_es,
        ai_instructions: rawEl.ai_instructions || "",
        sort_order: rawEl.sort_order ?? ei,
        source_refs: Array.isArray(rawEl.source_refs) ? rawEl.source_refs : [],
        variant: rawEl.variant || undefined,
        media_type: rawEl.media_type || undefined,
        image_source: rawEl.image_source || undefined,
        product_image_ref: rawEl.product_image_ref || undefined,
      });
    }

    sections.push({
      title_en: rawSection.title_en,
      title_es: rawSection.title_es,
      elements,
    });
  }

  if (sections.length === 0) {
    console.error("[course-builder] No valid sections in outline response");
    return null;
  }

  return { sections };
}

/**
 * Validate and normalize element content response from AI.
 * Ensures body_en and body_es exist.
 */
export function parseAIElementResponse(
  // deno-lint-ignore no-explicit-any
  json: any,
): AIElementResponse | null {
  if (!json) {
    console.error("[course-builder] Empty element response");
    return null;
  }

  if (!json.body_en || typeof json.body_en !== "string") {
    console.error("[course-builder] Element response missing body_en");
    return null;
  }

  return {
    title_en: json.title_en || undefined,
    title_es: json.title_es || undefined,
    body_en: json.body_en,
    body_es: json.body_es || json.body_en, // fallback to English if no Spanish
    variant: json.variant || undefined,
  };
}

/**
 * Validate and normalize chat_edit response from AI.
 */
export function parseAIChatEditResponse(
  // deno-lint-ignore no-explicit-any
  json: any,
): AIChatEditResponse | null {
  if (!json || !Array.isArray(json.modified_elements)) {
    console.error("[course-builder] Invalid chat_edit response: missing modified_elements array");
    return null;
  }

  const validActions = ["update", "insert", "delete"];
  const actions: AIChatEditAction[] = [];

  for (const item of json.modified_elements) {
    if (!item.key || !validActions.includes(item.action)) {
      console.warn("[course-builder] chat_edit: invalid action item, skipping:", item);
      continue;
    }
    actions.push({
      key: item.key,
      action: item.action,
      element: item.element || undefined,
      insert_after: item.insert_after || undefined,
    });
  }

  return { modified_elements: actions };
}

// =============================================================================
// MAX TOKEN CONSTANTS
// =============================================================================

export const MAX_TOKENS_OUTLINE = 100000;
export const MAX_TOKENS_CONTENT = 2000;
export const MAX_TOKENS_FEATURE = 800;
export const MAX_TOKENS_MEDIA_CAPTION = 300;
export const MAX_TOKENS_CHAT_EDIT = 4000;

export const TEMPERATURE_OUTLINE = 0.6;
export const TEMPERATURE_CONTENT = 0.5;

/**
 * Get the max_tokens value for an element type.
 */
export function getMaxTokensForElement(elementType: string): number {
  switch (elementType) {
    case "content":
      return MAX_TOKENS_CONTENT;
    case "feature":
      return MAX_TOKENS_FEATURE;
    case "media":
      return MAX_TOKENS_MEDIA_CAPTION;
    case "product_viewer":
      return 0;
    default:
      return MAX_TOKENS_CONTENT;
  }
}
