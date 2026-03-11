/**
 * Shared utilities for the Course Builder AI pipeline.
 *
 * Used by:
 *   - build-course (outline + content + chat_edit + pass1 + pass2)
 *   - build-course-element (single element regeneration)
 *
 * Provides:
 *   - assembleSourceMaterial() — fetches full sections + products, serializes for AI
 *   - computeContentHash() — SHA-256 hash for source_refs change tracking
 *   - estimateTokens() — rough token count for context budgeting
 *   - serializeElementForAI() — convert element to AI-readable text
 *   - parseAIOutlineResponse() — validate & normalize outline from AI
 *   - parseAIElementResponse() — validate & normalize element content from AI
 *   - parsePass1Response() — validate Pass 1 content writer response
 *   - parsePass2Response() — validate Pass 2 layout architect response
 *   - PASS1_SCHEMA / PASS2_SECTION_SCHEMA — JSON schemas for structured output
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
  type:
    | "content" | "feature" | "media" | "product_viewer"
    | "page_header" | "section_header" | "card_grid" | "comparison" | "script_block";
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
  // New element fields (JSONB additive)
  lead?: boolean;
  number_label?: string;
  subtitle_en?: string;
  subtitle_es?: string;
  columns?: number;
  // deno-lint-ignore no-explicit-any
  cards?: any[];
  // deno-lint-ignore no-explicit-any
  positive?: any;
  // deno-lint-ignore no-explicit-any
  negative?: any;
  // deno-lint-ignore no-explicit-any
  pairs?: any[];
  header_en?: string;
  header_es?: string;
  header_icon?: string;
  // deno-lint-ignore no-explicit-any
  lines?: any[];
  badge_en?: string;
  badge_es?: string;
  badge_icon?: string;
  tagline_en?: string;
  tagline_es?: string;
  icon?: string;
  icon_label_en?: string;
  icon_label_es?: string;
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

// =============================================================================
// ELEMENT BLUEPRINT TYPES + DEPTH TIER CONSTANTS
// =============================================================================

export interface ElementBlueprint {
  type: string;
  variant?: string;
}

const VALID_BLUEPRINT_TYPES = new Set([
  "content", "feature", "section_header", "card_grid", "comparison", "script_block", "media",
]);

/**
 * Depth tier blueprints — injected into Pass 1 user message.
 * Controls section count, element structure, and word budgets per tier.
 * Direction (what to teach) comes from DB prompts. Depth (how much) comes from here.
 */
export const DEPTH_BLUEPRINTS: Readonly<Record<string, string>> = Object.freeze({
  quick: `SECTION BLUEPRINT (quick tier):
Target: 1-3 sections, ~300 words total. No single section should exceed 150 words.

Each section MUST follow this exact structure:
  1. section_header — always first
  2. content — main body. ALL section information goes here. Use rich markdown
     (## headings, **bold**, bullets, > blockquotes). This IS the section.
  3. ONE accent element — pick the BEST fit for this section's content:
     • card_grid (variant: icon_tile) if there are 3+ parallel facts to display (limit 3-4 cards)
     • script_block if there is guest-facing dialogue or service language
     • comparison (variant: miss_fix) if there is a right/wrong contrast
     • feature (variant: standout|tip|key_point) if there is a non-negotiable rule or callout

ACCENT ROTATION RULE: Each section's accent type MUST differ from the previous
section's accent. You see all sections — enforce this.

Output element_blueprint per section: exactly 3 items in the order above.
Write a 1-sentence brief per section.`,

  standard: `SECTION BLUEPRINT (standard tier):
Target: 3-6 sections, ~2400 words total. No single section should exceed 500 words.

Each section MUST follow this structure:
  1. section_header — always first
  2. content — main body with rich markdown
  3. 1-2 accent elements — AI picks types, vary across sections:
     • card_grid (icon_tile | menu_item) for parallel facts or menu items (limit 3-5 cards)
     • script_block for guest-facing dialogue
     • comparison (correct_incorrect | miss_fix) for right/wrong contrasts
     • feature (any variant) for callouts, rules, tips
  4. Optional closing: content block OR feature(key_point)

Vary accent types across consecutive sections. 4-6 elements per section total.
Write 2-3 sentence briefs.`,

  deep: `SECTION BLUEPRINT (deep tier):
Target: 5-9 sections, ~5400 words total. No single section should exceed 700 words.

Each section MUST include:
  1. section_header — always first
  2-N. Multiple content blocks interspersed with 2-4 accent elements.
       You have full ordering freedom. Use the full element palette:
       content, card_grid, script_block, comparison, feature, media.
       Limit card_grids to 3-5 cards each.
  Last. feature(key_point) — REQUIRED to close every section.

5-8 elements per section. No two content blocks back-to-back without a
visual element between them. Write 3-4 detailed sentence briefs.`,

  custom: `SECTION BLUEPRINT (custom tier):
The admin provided a custom depth prompt (see CUSTOM INSTRUCTIONS below).

REFERENCE — here are our standard blueprints:
• Quick: section_header → content → 1 accent. 3 elements/section, 1-3 sections.
• Standard: section_header → content → 1-2 accents → optional closing. 4-6 elements/section, 3-6 sections.
• Deep: section_header → multiple content+accents → feature(key_point). 5-8 elements/section, 5-9 sections.

Read the custom instructions and decide the best blueprint. You may mix approaches.
HARD RULES (cannot be overridden by custom prompt):
  - Every section MUST start with section_header
  - Every section MUST have at least 1 content element
  - Output element_blueprint per section`,
});

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
  if (element.lead) parts.push(`lead: true`);
  if (element.ai_instructions) parts.push(`instructions: ${element.ai_instructions}`);
  if (element.body_en) parts.push(`content:\n${element.body_en}`);
  if (element.products && Array.isArray(element.products)) {
    parts.push(`products: ${element.products.map((p: { name_en?: string }) => p.name_en).join(", ")}`);
  }
  // New element type fields
  if (element.number_label) parts.push(`number_label: ${element.number_label}`);
  if (element.subtitle_en) parts.push(`subtitle: ${element.subtitle_en}`);
  if (element.tagline_en) parts.push(`tagline: ${element.tagline_en}`);
  if (element.badge_en) parts.push(`badge: ${element.badge_en}`);
  if (element.header_en) parts.push(`header: ${element.header_en}`);
  if (element.cards && Array.isArray(element.cards)) {
    parts.push(`cards: ${element.cards.length} items`);
  }
  if (element.lines && Array.isArray(element.lines)) {
    parts.push(`lines: ${element.lines.length} items`);
  }
  if (element.pairs && Array.isArray(element.pairs)) {
    parts.push(`pairs: ${element.pairs.length} items`);
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
      const validTypes = [
        "content", "feature", "media", "product_viewer",
        "page_header", "section_header", "card_grid", "comparison", "script_block",
      ];
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
        // New element fields (pass through if present)
        lead: rawEl.lead || undefined,
        number_label: rawEl.number_label || undefined,
        subtitle_en: rawEl.subtitle_en || undefined,
        subtitle_es: rawEl.subtitle_es || undefined,
        columns: rawEl.columns || undefined,
        cards: rawEl.cards || undefined,
        positive: rawEl.positive || undefined,
        negative: rawEl.negative || undefined,
        pairs: rawEl.pairs || undefined,
        header_en: rawEl.header_en || undefined,
        header_es: rawEl.header_es || undefined,
        header_icon: rawEl.header_icon || undefined,
        lines: rawEl.lines || undefined,
        badge_en: rawEl.badge_en || undefined,
        badge_es: rawEl.badge_es || undefined,
        badge_icon: rawEl.badge_icon || undefined,
        tagline_en: rawEl.tagline_en || undefined,
        tagline_es: rawEl.tagline_es || undefined,
        icon: rawEl.icon || undefined,
        icon_label_en: rawEl.icon_label_en || undefined,
        icon_label_es: rawEl.icon_label_es || undefined,
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
// PASS 1 SCHEMA (Content Writer — creates sections with prose)
// =============================================================================

export const PASS1_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title_en: { type: "string", description: "Engaging section title in English" },
          title_es: { type: "string", description: "Section title in Spanish" },
          content_en: { type: "string", description: "Full flowing prose content in English for this section" },
          content_es: { type: "string", description: "Full flowing prose content in Spanish for this section" },
          teaching_notes: { type: "string", description: "Brief instructor guidance for this section" },
        },
        required: ["title_en", "title_es", "content_en", "content_es", "teaching_notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
};

export const MAX_TOKENS_PASS1 = 100000;

/**
 * Validate and normalize the Pass 1 (content writer) response.
 * Sections must have titles and content — no section_id needed (sections are created fresh).
 */
export function parsePass1Response(
  // deno-lint-ignore no-explicit-any
  json: any,
): { sections: Array<{ title_en: string; title_es: string; content_en: string; content_es: string; teaching_notes: string }> } | null {
  if (!json || !Array.isArray(json.sections)) {
    console.error("[course-builder] Invalid pass1 response: missing sections array");
    return null;
  }

  const sections: Array<{ title_en: string; title_es: string; content_en: string; content_es: string; teaching_notes: string }> = [];

  for (const item of json.sections) {
    if (!item.title_en || !item.content_en) {
      console.warn("[course-builder] pass1: section missing title_en or content_en, skipping");
      continue;
    }
    sections.push({
      title_en: item.title_en,
      title_es: item.title_es || item.title_en,
      content_en: item.content_en,
      content_es: item.content_es || item.content_en,
      teaching_notes: item.teaching_notes || "",
    });
  }

  if (sections.length === 0) {
    console.error("[course-builder] No valid sections in pass1 response");
    return null;
  }

  return { sections };
}

// =============================================================================
// PASS 2 SECTION SCHEMA (Layout Architect — decides elements, fills content)
// =============================================================================

export const PASS2_SECTION_SCHEMA = {
  type: "object",
  properties: {
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["content", "feature", "media", "section_header", "card_grid", "comparison", "script_block"],
          },
          key: { type: "string" },
          title_en: { type: "string" },
          sort_order: { type: "number" },
          // content / feature fields
          body_en: { anyOf: [{ type: "string" }, { type: "null" }] },
          variant: { anyOf: [{ type: "string" }, { type: "null" }] },
          lead: { anyOf: [{ type: "boolean" }, { type: "null" }] },
          icon: { anyOf: [{ type: "string" }, { type: "null" }] },
          // card_grid fields
          columns: { anyOf: [{ type: "number" }, { type: "null" }] },
          cards: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    icon: { type: "string" },
                    icon_bg: { type: "string" },
                    title_en: { type: "string" },
                    body_en: { type: "string" },
                  },
                  required: ["icon", "icon_bg", "title_en", "body_en"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          // comparison fields
          positive: {
            anyOf: [
              {
                type: "object",
                properties: {
                  tag_en: { type: "string" },
                  title_en: { type: "string" },
                  items_en: { type: "array", items: { type: "string" } },
                },
                required: ["tag_en", "title_en", "items_en"],
                additionalProperties: false,
              },
              { type: "null" },
            ],
          },
          negative: {
            anyOf: [
              {
                type: "object",
                properties: {
                  tag_en: { type: "string" },
                  title_en: { type: "string" },
                  items_en: { type: "array", items: { type: "string" } },
                },
                required: ["tag_en", "title_en", "items_en"],
                additionalProperties: false,
              },
              { type: "null" },
            ],
          },
          pairs: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tag_en: { type: "string" },
                    items_en: { type: "array", items: { type: "string" } },
                  },
                  required: ["tag_en", "items_en"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          // script_block fields
          header_en: { anyOf: [{ type: "string" }, { type: "null" }] },
          header_icon: { anyOf: [{ type: "string" }, { type: "null" }] },
          lines: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text_en: { type: "string" },
                  },
                  required: ["text_en"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          // section_header fields
          number_label: { anyOf: [{ type: "string" }, { type: "null" }] },
          subtitle_en: { anyOf: [{ type: "string" }, { type: "null" }] },
          // media fields
          media_type: { anyOf: [{ type: "string" }, { type: "null" }] },
          image_source: { anyOf: [{ type: "string" }, { type: "null" }] },
          caption_en: { anyOf: [{ type: "string" }, { type: "null" }] },
          ai_image_prompt: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["type", "key", "sort_order"],
        additionalProperties: false,
      },
    },
  },
  required: ["elements"],
  additionalProperties: false,
};

export const MAX_TOKENS_PASS2_SECTION = 16384;

/**
 * Validate and normalize Pass 2 (layout architect) response.
 * Each element must have type, key, and titles.
 */
export function parsePass2Response(
  // deno-lint-ignore no-explicit-any
  json: any,
): { elements: Array<Record<string, unknown>> } | null {
  // Recovery: AI might return array directly
  if (Array.isArray(json)) {
    json = { elements: json };
  }
  // Recovery: nested wrapper
  if (!Array.isArray(json?.elements) && json && typeof json === 'object') {
    for (const key of Object.keys(json)) {
      if (Array.isArray(json[key]?.elements)) {
        json = json[key];
        break;
      }
      if (Array.isArray(json[key]) && json[key].length > 0 && json[key][0]?.type) {
        json = { elements: json[key] };
        break;
      }
    }
  }

  if (!json || !Array.isArray(json.elements)) {
    console.error("[course-builder] Invalid pass2 response: missing elements array");
    console.error("[course-builder] pass2 response shape:", JSON.stringify({
      type: typeof json,
      isArray: Array.isArray(json),
      keys: json && typeof json === 'object' ? Object.keys(json) : [],
      elementsType: typeof json?.elements,
      sample: JSON.stringify(json)?.substring(0, 500),
    }));
    return null;
  }

  const validTypes = [
    "content", "feature", "media", "section_header",
    "card_grid", "comparison", "script_block",
  ];

  // deno-lint-ignore no-explicit-any
  const elements: Array<Record<string, any>> = [];

  for (let i = 0; i < json.elements.length; i++) {
    const el = json.elements[i];
    if (!el.type || !el.key) {
      console.warn(`[course-builder] pass2: element ${i} missing type or key, skipping`);
      continue;
    }
    if (!validTypes.includes(el.type)) {
      console.warn(`[course-builder] pass2: element ${i} invalid type "${el.type}", skipping`);
      continue;
    }

    // Per-type required field validation
    let typeValid = true;
    switch (el.type) {
      case "content":
        if (!el.body_en || typeof el.body_en !== "string") {
          console.warn(`[course-builder] pass2: element ${i} (content) missing body_en, skipping`);
          typeValid = false;
        }
        break;
      case "feature":
        if (!el.variant || !el.body_en || typeof el.body_en !== "string") {
          console.warn(`[course-builder] pass2: element ${i} (feature) missing variant or body_en, skipping`);
          typeValid = false;
        }
        break;
      case "section_header":
        if (!el.title_en || typeof el.title_en !== "string") {
          console.warn(`[course-builder] pass2: element ${i} (section_header) missing title_en, skipping`);
          typeValid = false;
        }
        break;
      case "card_grid":
        if (!Array.isArray(el.cards) || el.cards.length === 0) {
          console.warn(`[course-builder] pass2: element ${i} (card_grid) missing or empty cards, skipping`);
          typeValid = false;
        }
        break;
      case "comparison":
        if (!el.variant) {
          console.warn(`[course-builder] pass2: element ${i} (comparison) missing variant, skipping`);
          typeValid = false;
        }
        break;
      case "script_block":
        if (!el.header_en || !Array.isArray(el.lines) || el.lines.length === 0) {
          console.warn(`[course-builder] pass2: element ${i} (script_block) missing header_en or lines, skipping`);
          typeValid = false;
        }
        break;
      case "media":
        if (!el.media_type) {
          console.warn(`[course-builder] pass2: element ${i} (media) missing media_type, skipping`);
          typeValid = false;
        }
        break;
    }
    if (!typeValid) continue;

    // Strip null values to keep JSONB clean
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(el)) {
      if (v !== null && v !== undefined) {
        cleaned[k] = v;
      }
    }

    if (typeof cleaned.sort_order !== 'number') {
      cleaned.sort_order = i;
    }

    elements.push(cleaned);
  }

  if (elements.length === 0) {
    console.error("[course-builder] No valid elements in pass2 response");
    return null;
  }

  return { elements };
}

// =============================================================================
// STRUCTURE PLAN SCHEMA (Pass 1 — Structure Planner)
// =============================================================================

export const STRUCTURE_PLAN_SCHEMA = {
  type: "object",
  properties: {
    page_header: {
      type: "object",
      properties: {
        badge_en: { type: "string", description: "Short badge/label in English (e.g. 'New Menu')" },
        badge_icon: { type: "string", description: "Single emoji for the badge" },
        title_en: { type: "string", description: "Course hero title in English. Use | to separate light|bold parts." },
        tagline_en: { type: "string", description: "One-line tagline in English" },
        icon: { type: "string", description: "Single emoji representing the course" },
        icon_label_en: { type: "string", description: "Short icon label in English" },
      },
      required: ["badge_en", "title_en", "tagline_en", "icon"],
      additionalProperties: false,
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title_en: { type: "string", description: "Section title in English" },
          brief_en: { type: "string", description: "Writing brief for what this section should cover" },
          target_words: { type: "number", description: "Target word count for this section's content" },
          source_hints: {
            type: "array",
            items: { type: "string" },
            description: "Array of source identifiers relevant to this section (e.g. 'manual_sections:uuid', 'foh_plate_specs:uuid')",
          },
          element_blueprint: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["content","feature","section_header","card_grid","comparison","script_block","media"] },
                variant: { anyOf: [{ type: "string" }, { type: "null" }] },
              },
              required: ["type"],
              additionalProperties: false,
            },
            description: "Ordered list of element types for this section (from tier blueprint)",
          },
        },
        required: ["title_en", "brief_en", "target_words"],
        additionalProperties: false,
      },
    },
  },
  required: ["page_header", "sections"],
  additionalProperties: false,
};

export const MAX_TOKENS_STRUCTURE_PLAN = 4096;

// =============================================================================
// CONTENT WRITE SCHEMA (Pass 2 — Content Writer, per-section)
// =============================================================================

export const CONTENT_WRITE_SCHEMA = {
  type: "object",
  properties: {
    content_en: { type: "string", description: "Training content in English for this section" },
    teaching_notes: { type: "string", description: "Brief instructor guidance for this section" },
  },
  required: ["content_en", "teaching_notes"],
  additionalProperties: false,
};

export const MAX_TOKENS_CONTENT_WRITE = 8192;

// =============================================================================
// LAYOUT SCHEMA (Pass 3 — reuses PASS2_SECTION_SCHEMA with reduced max_tokens)
// =============================================================================

export const MAX_TOKENS_LAYOUT = 16384;

// =============================================================================
// TRANSLATION SCHEMA (Pass 4 — per-section EN→ES translation)
// =============================================================================

export const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    title_es: { type: "string", description: "Section title in Spanish" },
    content_es: { type: "string", description: "Full prose content translated to Spanish" },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "Must match the input element key" },
          title_es: { anyOf: [{ type: "string" }, { type: "null" }] },
          body_es: { anyOf: [{ type: "string" }, { type: "null" }] },
          subtitle_es: { anyOf: [{ type: "string" }, { type: "null" }] },
          header_es: { anyOf: [{ type: "string" }, { type: "null" }] },
          caption_es: { anyOf: [{ type: "string" }, { type: "null" }] },
          cards: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title_es: { type: "string" },
                    body_es: { type: "string" },
                  },
                  required: ["title_es", "body_es"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          positive: {
            anyOf: [
              {
                type: "object",
                properties: {
                  tag_es: { type: "string" },
                  title_es: { type: "string" },
                  items_es: { type: "array", items: { type: "string" } },
                },
                required: ["tag_es", "title_es", "items_es"],
                additionalProperties: false,
              },
              { type: "null" },
            ],
          },
          negative: {
            anyOf: [
              {
                type: "object",
                properties: {
                  tag_es: { type: "string" },
                  title_es: { type: "string" },
                  items_es: { type: "array", items: { type: "string" } },
                },
                required: ["tag_es", "title_es", "items_es"],
                additionalProperties: false,
              },
              { type: "null" },
            ],
          },
          pairs: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tag_es: { type: "string" },
                    items_es: { type: "array", items: { type: "string" } },
                  },
                  required: ["tag_es", "items_es"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          lines: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text_es: { type: "string" },
                  },
                  required: ["text_es"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
        },
        required: ["key"],
        additionalProperties: false,
      },
    },
  },
  required: ["title_es", "content_es", "elements"],
  additionalProperties: false,
};

export const PAGE_HEADER_TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    badge_es: { type: "string" },
    title_es: { type: "string" },
    tagline_es: { type: "string" },
    icon_label_es: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["badge_es", "title_es", "tagline_es"],
  additionalProperties: false,
};

export const MAX_TOKENS_TRANSLATION = 8192;

// =============================================================================
// TRANSLATION RESPONSE PARSER
// =============================================================================

export interface TranslationElementResponse {
  key: string;
  title_es?: string;
  body_es?: string;
  subtitle_es?: string;
  header_es?: string;
  caption_es?: string;
  // deno-lint-ignore no-explicit-any
  cards?: any[];
  // deno-lint-ignore no-explicit-any
  positive?: any;
  // deno-lint-ignore no-explicit-any
  negative?: any;
  // deno-lint-ignore no-explicit-any
  pairs?: any[];
  // deno-lint-ignore no-explicit-any
  lines?: any[];
}

export interface TranslationResponse {
  title_es: string;
  content_es: string;
  elements: TranslationElementResponse[];
}

/**
 * Validate and normalize translation response from Pass 4.
 */
export function parseTranslationResponse(
  // deno-lint-ignore no-explicit-any
  json: any,
): TranslationResponse | null {
  if (!json) {
    console.error("[course-builder] Empty translation response");
    return null;
  }

  if (!json.title_es || typeof json.title_es !== "string") {
    console.error("[course-builder] translation: missing title_es");
    return null;
  }

  if (!json.content_es || typeof json.content_es !== "string") {
    console.error("[course-builder] translation: missing content_es");
    return null;
  }

  if (!Array.isArray(json.elements)) {
    console.error("[course-builder] translation: missing elements array");
    return null;
  }

  const elements: TranslationElementResponse[] = [];
  for (const el of json.elements) {
    if (!el.key) {
      console.warn("[course-builder] translation: element missing key, skipping");
      continue;
    }
    elements.push(el);
  }

  return {
    title_es: json.title_es,
    content_es: json.content_es,
    elements,
  };
}

// =============================================================================
// STRUCTURE PLAN PARSER
// =============================================================================

export interface StructurePlanSection {
  title_en: string;
  title_es?: string;
  brief_en: string;
  target_words: number;
  source_hints?: string[];
  element_blueprint?: ElementBlueprint[];  // blueprint from Pass 1
}

export interface StructurePlanPageHeader {
  badge_en: string;
  badge_es?: string;
  badge_icon?: string;
  title_en: string;
  title_es?: string;
  tagline_en: string;
  tagline_es?: string;
  icon: string;
  icon_label_en?: string;
  icon_label_es?: string;
}

export interface StructurePlanResponse {
  page_header: StructurePlanPageHeader;
  sections: StructurePlanSection[];
}

/**
 * Validate and normalize the structure plan response from Pass 1.
 */
export function parseStructurePlanResponse(
  // deno-lint-ignore no-explicit-any
  json: any,
): StructurePlanResponse | null {
  if (!json || !json.page_header || !Array.isArray(json.sections)) {
    console.error("[course-builder] Invalid structure_plan: missing page_header or sections array");
    return null;
  }

  const ph = json.page_header;
  if (!ph.title_en) {
    console.error("[course-builder] structure_plan: page_header missing title_en");
    return null;
  }

  const sections: StructurePlanSection[] = [];
  for (let i = 0; i < json.sections.length; i++) {
    const sec = json.sections[i];
    if (!sec.title_en || !sec.brief_en) {
      console.warn(`[course-builder] structure_plan: section ${i} missing required fields, skipping`);
      continue;
    }
    sections.push({
      title_en: sec.title_en,
      title_es: sec.title_es || "",
      brief_en: sec.brief_en,
      target_words: typeof sec.target_words === "number" ? sec.target_words : 300,
      source_hints: Array.isArray(sec.source_hints) ? sec.source_hints : undefined,
      element_blueprint: Array.isArray(sec.element_blueprint)
        ? sec.element_blueprint.filter(
            (bp: { type?: string; variant?: string }) =>
              bp.type && typeof bp.type === "string" && VALID_BLUEPRINT_TYPES.has(bp.type)
          ).map((bp: { type: string; variant?: string }) => ({
            type: bp.type,
            ...(bp.variant ? { variant: bp.variant } : {}),
          }))
        : undefined,
    });
  }

  if (sections.length === 0) {
    console.error("[course-builder] No valid sections in structure_plan response");
    return null;
  }

  return {
    page_header: {
      badge_en: ph.badge_en || "",
      badge_es: ph.badge_es || "",
      badge_icon: ph.badge_icon || undefined,
      title_en: ph.title_en,
      title_es: ph.title_es || "",
      tagline_en: ph.tagline_en || "",
      tagline_es: ph.tagline_es || "",
      icon: ph.icon || "📚",
      icon_label_en: ph.icon_label_en || undefined,
      icon_label_es: ph.icon_label_es || undefined,
    },
    sections,
  };
}

// =============================================================================
// BLUEPRINT COMPLIANCE VALIDATOR
// =============================================================================

export interface BlueprintComplianceResult {
  valid: boolean;
  severity: "ok" | "warn" | "fail";
  issues: string[];
}

/**
 * Validate Pass 3 output against an element_blueprint.
 * Run on RAW AI elements (before parsePass2Response strips invalid ones).
 *
 * Severity:
 * - ok: exact match or ±1 element
 * - warn: ±2 elements or type mismatch — log and proceed
 * - fail: >2 element diff OR no content element — triggers 1 server-side retry
 */
export function validateBlueprintCompliance(
  rawElements: Array<{ type?: string; [key: string]: unknown }>,
  blueprint: ElementBlueprint[],
): BlueprintComplianceResult {
  const issues: string[] = [];

  // Filter out page_header from raw elements (added deterministically, not by AI)
  const aiElements = rawElements.filter(el => el.type !== "page_header");

  // Count check
  const countDiff = Math.abs(aiElements.length - blueprint.length);
  if (countDiff > 0) {
    issues.push(`Element count: expected ${blueprint.length}, got ${aiElements.length} (diff: ${countDiff})`);
  }

  // Type order check (up to the shorter array's length)
  const checkLen = Math.min(aiElements.length, blueprint.length);
  for (let i = 0; i < checkLen; i++) {
    const expected = blueprint[i];
    const actual = aiElements[i];
    if (actual.type !== expected.type) {
      issues.push(`Element ${i}: expected ${expected.type}, got ${actual.type}`);
    }
    if (expected.variant && actual.variant !== expected.variant) {
      issues.push(`Element ${i}: expected variant ${expected.variant}, got ${actual.variant || "none"}`);
    }
  }

  // Content presence check (hard rule)
  const hasContent = aiElements.some(el => el.type === "content");
  if (!hasContent && blueprint.some(bp => bp.type === "content")) {
    issues.push("CRITICAL: No content element found — blueprint requires at least one");
  }

  // Determine severity
  let severity: "ok" | "warn" | "fail" = "ok";
  if (countDiff > 2 || (!hasContent && blueprint.some(bp => bp.type === "content"))) {
    severity = "fail";
  } else if (countDiff > 0 || issues.length > 0) {
    severity = issues.some(i => i.includes("expected")) ? "warn" : "ok";
  }

  // Refine: if count is off by ≤1 and types mostly match, stay at warn
  if (severity === "ok" && issues.length > 0) severity = "warn";
  if (severity === "warn" && countDiff <= 1 && issues.length <= 2) severity = "warn"; // keep

  return {
    valid: severity !== "fail",
    severity,
    issues,
  };
}

// =============================================================================
// CONTENT WRITE PARSER
// =============================================================================

export interface ContentWriteResponse {
  content_en: string;
  content_es?: string;
  teaching_notes: string;
}

/**
 * Validate and normalize the content write response from Pass 2.
 */
export function parseContentWriteResponse(
  // deno-lint-ignore no-explicit-any
  json: any,
): ContentWriteResponse | null {
  if (!json) {
    console.error("[course-builder] Empty content_write response");
    return null;
  }

  if (!json.content_en || typeof json.content_en !== "string") {
    console.error("[course-builder] content_write: missing or invalid content_en");
    return null;
  }

  return {
    content_en: json.content_en,
    content_es: json.content_es || "",
    teaching_notes: json.teaching_notes || "",
  };
}

// =============================================================================
// COMPLETENESS VALIDATORS (used by frontend retry logic)
// =============================================================================

/**
 * Validate structure plan completeness. Returns array of issue strings (empty = valid).
 * Accepts both the raw AI response (page_header) and the edge function response (page_header_data).
 */
export function validateStructurePlan(
  // deno-lint-ignore no-explicit-any
  data: any,
): string[] {
  const issues: string[] = [];
  if (!data) { issues.push("No data returned"); return issues; }
  // Support both raw AI response (page_header) and edge function response (page_header_data)
  const ph = data.page_header_data || data.page_header;
  if (!ph) issues.push("Missing page_header");
  else {
    if (!ph.title_en) issues.push("page_header missing title_en");
    if (!ph.badge_en) issues.push("page_header missing badge_en");
  }
  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    issues.push("No sections returned");
  } else {
    for (let i = 0; i < data.sections.length; i++) {
      const s = data.sections[i];
      if (!s.title_en) issues.push(`Section ${i}: missing title_en`);
      if (!s.brief_en) issues.push(`Section ${i}: missing brief_en`);
    }
  }
  return issues;
}

/**
 * Validate content write completeness. Returns array of issue strings (empty = valid).
 */
export function validateContentWrite(
  // deno-lint-ignore no-explicit-any
  data: any,
): string[] {
  const issues: string[] = [];
  if (!data) { issues.push("No data returned"); return issues; }
  if (!data.content_en || typeof data.content_en !== "string" || data.content_en.length < 50) {
    issues.push(`content_en too short or missing (${data.content_en?.length || 0} chars, need 50+)`);
  }
  if (!data.teaching_notes || typeof data.teaching_notes !== "string") {
    issues.push("teaching_notes missing");
  }
  return issues;
}

/**
 * Validate layout (pass3) response completeness. Returns array of issue strings (empty = valid).
 */
export function validateLayoutResponse(
  // deno-lint-ignore no-explicit-any
  data: any,
): string[] {
  const issues: string[] = [];
  if (!data) { issues.push("No data returned"); return issues; }
  if (!Array.isArray(data.elements) || data.elements.length === 0) {
    issues.push("No elements returned");
    return issues;
  }

  for (let i = 0; i < data.elements.length; i++) {
    const el = data.elements[i];
    if (!el.type) issues.push(`Element ${i}: missing type`);
    if (!el.key) issues.push(`Element ${i}: missing key`);

    // Per-type validation
    switch (el.type) {
      case "content":
        if (!el.body_en || typeof el.body_en !== 'string')
          issues.push(`Element ${i} (content): missing body_en`);
        break;
      case "feature":
        if (!el.variant) issues.push(`Element ${i} (feature): missing variant`);
        if (!el.body_en || typeof el.body_en !== 'string')
          issues.push(`Element ${i} (feature): missing body_en`);
        break;
      case "section_header":
        if (!el.title_en) issues.push(`Element ${i} (section_header): missing title_en`);
        break;
      case "media":
        if (!el.media_type) issues.push(`Element ${i} (media): missing media_type`);
        break;
    }

    if (el.type === "card_grid" && (!Array.isArray(el.cards) || el.cards.length === 0)) {
      issues.push(`Element ${i} (card_grid): empty cards array`);
    }
    if (el.type === "comparison") {
      if (!el.variant) issues.push(`Element ${i} (comparison): missing variant`);
      else if (el.variant === "miss_fix" && (!Array.isArray(el.pairs) || el.pairs.length === 0))
        issues.push(`Element ${i} (comparison/miss_fix): empty pairs`);
      else if (el.variant !== "miss_fix" && (!el.positive || !el.negative))
        issues.push(`Element ${i} (comparison): missing positive or negative`);
    }
    if (el.type === "script_block" && (!Array.isArray(el.lines) || el.lines.length === 0)) {
      issues.push(`Element ${i} (script_block): empty lines array`);
    }
  }
  return issues;
}

// =============================================================================
// FULL CONTENT SCHEMA (Legacy Pass 1 — kept for backward compat)
// =============================================================================

export const FULL_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section_id: { type: "string", description: "UUID of the course section" },
          content_en: { type: "string", description: "Full flowing prose content in English for this section" },
          content_es: { type: "string", description: "Full flowing prose content in Spanish for this section" },
          teaching_notes: { type: "string", description: "Brief instructor guidance for this section" },
        },
        required: ["section_id", "content_en", "content_es"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
};

export const MAX_TOKENS_FULL_CONTENT = 100000;

/**
 * Validate and normalize the full content response from Pass 1.
 */
export function parseFullContentResponse(
  // deno-lint-ignore no-explicit-any
  json: any,
): { sections: Array<{ section_id: string; content_en: string; content_es: string; teaching_notes?: string }> } | null {
  if (!json || !Array.isArray(json.sections)) {
    console.error("[course-builder] Invalid full_content response: missing sections array");
    return null;
  }

  const sections: Array<{ section_id: string; content_en: string; content_es: string; teaching_notes?: string }> = [];

  for (const item of json.sections) {
    if (!item.section_id || !item.content_en) {
      console.warn("[course-builder] full_content: section missing section_id or content_en, skipping");
      continue;
    }
    sections.push({
      section_id: item.section_id,
      content_en: item.content_en,
      content_es: item.content_es || item.content_en,
      teaching_notes: item.teaching_notes || undefined,
    });
  }

  if (sections.length === 0) {
    console.error("[course-builder] No valid sections in full_content response");
    return null;
  }

  return { sections };
}

// =============================================================================
// DEPTH PREVIEW SCHEMA (Wizard depth tier selector)
// =============================================================================

export const DEPTH_PREVIEW_SCHEMA = {
  type: "object" as const,
  properties: {
    quick: {
      type: "object" as const,
      properties: {
        section_count: { type: "number" as const, description: "Recommended number of sections (1-3)" },
        summary: { type: "string" as const, description: "1-sentence summary of what this tier covers" },
        topics: { type: "array" as const, items: { type: "string" as const }, description: "Short section topic names" },
      },
      required: ["section_count", "summary", "topics"],
      additionalProperties: false as const,
    },
    standard: {
      type: "object" as const,
      properties: {
        section_count: { type: "number" as const, description: "Recommended number of sections (3-6)" },
        summary: { type: "string" as const, description: "1-sentence summary" },
        topics: { type: "array" as const, items: { type: "string" as const }, description: "Short section topic names" },
      },
      required: ["section_count", "summary", "topics"],
      additionalProperties: false as const,
    },
    deep: {
      type: "object" as const,
      properties: {
        section_count: { type: "number" as const, description: "Recommended number of sections (5-9)" },
        summary: { type: "string" as const, description: "1-sentence summary" },
        topics: { type: "array" as const, items: { type: "string" as const }, description: "Short section topic names" },
      },
      required: ["section_count", "summary", "topics"],
      additionalProperties: false as const,
    },
  },
  required: ["quick", "standard", "deep"],
  additionalProperties: false as const,
};

export const MAX_TOKENS_DEPTH_PREVIEW = 2048;

interface DepthTierPreview {
  section_count: number;
  summary: string;
  topics: string[];
}

export function parseDepthPreviewResponse(raw: unknown): { quick: DepthTierPreview; standard: DepthTierPreview; deep: DepthTierPreview } | null {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== "object") return null;

    for (const tier of ["quick", "standard", "deep"]) {
      const t = (obj as Record<string, unknown>)[tier];
      if (!t || typeof t !== "object") return null;
      const rec = t as Record<string, unknown>;
      if (typeof rec.section_count !== "number") return null;
      if (typeof rec.summary !== "string") return null;
      if (!Array.isArray(rec.topics)) return null;
    }

    return obj as { quick: DepthTierPreview; standard: DepthTierPreview; deep: DepthTierPreview };
  } catch {
    return null;
  }
}

// =============================================================================
// MAX TOKEN CONSTANTS
// =============================================================================

export const MAX_TOKENS_OUTLINE = 100000;
export const MAX_TOKENS_CONTENT = 2000;
export const MAX_TOKENS_FEATURE = 800;
export const MAX_TOKENS_MEDIA_CAPTION = 300;
export const MAX_TOKENS_CHAT_EDIT = 4000;
export const MAX_TOKENS_SECTION_HEADER = 200;
export const MAX_TOKENS_CARD_GRID = 1500;
export const MAX_TOKENS_COMPARISON = 1200;
export const MAX_TOKENS_SCRIPT_BLOCK = 1500;
export const MAX_TOKENS_PAGE_HEADER = 300;

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
    case "page_header":
      return MAX_TOKENS_PAGE_HEADER;
    case "section_header":
      return MAX_TOKENS_SECTION_HEADER;
    case "card_grid":
      return MAX_TOKENS_CARD_GRID;
    case "comparison":
      return MAX_TOKENS_COMPARISON;
    case "script_block":
      return MAX_TOKENS_SCRIPT_BLOCK;
    default:
      return MAX_TOKENS_CONTENT;
  }
}
