/**
 * Shared Claude API caller with structured JSON output via tool use.
 * Primary: Claude (Anthropic). Fallback: OpenAI GPT-5.2 on transient failures.
 * Includes automatic retry with exponential backoff for transient errors (429, 529, 503).
 */

import { callOpenAI } from "./openai.ts";

// ── Content block types for multimodal messages ──────────────────────────────
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export interface CallClaudeOptions {
  messages: Array<{ role: string; content: string | ContentBlock[] }>;
  schema: Record<string, unknown>;
  schemaName: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  signal?: AbortSignal;
}

export class ClaudeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ClaudeError";
    this.status = status;
  }
}

// ── Retry config ─────────────────────────────────────────────────────────────
const RETRYABLE_STATUSES = new Set([429, 529, 503]);
const MAX_RETRIES = 2; // 3 total attempts for Claude, then fallback

async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000) + Math.random() * 500;
      console.log(`[claude] Retry ${attempt}/${MAX_RETRIES} after ${Math.round(delayMs)}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const response = await fetch(url, init);

    if (response.ok) return response;

    lastStatus = response.status;
    lastBody = await response.text();
    console.error(`[claude] Error ${lastStatus} (attempt ${attempt + 1}):`, lastBody);

    if (!RETRYABLE_STATUSES.has(lastStatus)) break;
  }

  throw new ClaudeError(`AI request failed (${lastStatus})`, lastStatus);
}

// ── OpenAI fallback helper ───────────────────────────────────────────────────
// Converts Claude-format messages to OpenAI string messages and calls GPT-5.2

function toOpenAIMessages(
  messages: Array<{ role: string; content: string | ContentBlock[] }>,
): Array<{ role: string; content: string }> {
  return messages.map((msg) => {
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content };
    }
    // Extract text from ContentBlock[] — drop images/docs for fallback
    const text = (msg.content as ContentBlock[])
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n\n");
    return { role: msg.role, content: text };
  });
}

async function openAIFallback<T>(options: CallClaudeOptions): Promise<T> {
  console.log("[fallback] Claude unavailable — falling back to OpenAI GPT-5.2");
  return await callOpenAI<T>({
    messages: toOpenAIMessages(options.messages),
    schema: options.schema,
    schemaName: options.schemaName,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    model: "gpt-5.2",
  });
}

/**
 * Call Claude via Anthropic Messages API with structured output (tool use).
 * On transient failure (429/529/503) after retries, falls back to OpenAI GPT-5.2.
 * Extracts system messages into top-level `system` parameter.
 * Uses tool_choice to force structured JSON matching the provided schema.
 */
export async function callClaude<T = unknown>(
  options: CallClaudeOptions,
): Promise<T> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    // No Claude key at all — go straight to OpenAI
    console.log("[claude] No ANTHROPIC_API_KEY — using OpenAI directly");
    return openAIFallback<T>(options);
  }

  const model = options.model || "claude-sonnet-4-6";

  // ── Separate system messages from conversation messages ──
  // Claude uses `system` as a top-level parameter, not inside messages.
  // Content can be a string or ContentBlock[] (multimodal).
  const systemParts: string[] = [];
  const conversationMessages: Array<{ role: string; content: string | ContentBlock[] }> = [];

  for (const msg of options.messages) {
    if (msg.role === "system") {
      // System messages are always strings; extract text if ContentBlock[] is passed
      if (typeof msg.content === "string") {
        systemParts.push(msg.content);
      } else {
        const textParts = (msg.content as ContentBlock[])
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text);
        if (textParts.length > 0) systemParts.push(textParts.join("\n\n"));
      }
    } else {
      // User/assistant messages: pass content as-is (API accepts both string and ContentBlock[])
      conversationMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // ── Detect schema type ──
  // If schema has defined properties → tool use (structured output)
  // If schema is permissive (no properties) → text mode with JSON parsing
  const schemaProps = options.schema.properties as
    | Record<string, unknown>
    | undefined;
  const hasDefinedProperties =
    schemaProps && Object.keys(schemaProps).length > 0;

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = {
    model,
    max_tokens: options.maxTokens ?? 8192,
    messages: conversationMessages,
  };

  if (systemParts.length > 0) {
    body.system = systemParts.join("\n\n");
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  if (hasDefinedProperties) {
    // Tool use mode: force structured output via tool_choice
    body.tools = [
      {
        name: options.schemaName,
        description: "Generate structured output matching this schema.",
        input_schema: options.schema,
      },
    ];
    body.tool_choice = { type: "tool", name: options.schemaName };
  } else {
    // Text mode: append JSON instruction to system prompt for permissive schemas
    body.system =
      (body.system || "") +
      "\n\nYou MUST respond with ONLY a valid JSON object. No markdown fences, no explanation — just the JSON.";
  }

  // ── Make API request (with automatic retry for 429/529/503) ──
  let response: Response;
  try {
    response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    // Claude retries exhausted — fallback to OpenAI if it was a transient error
    if (err instanceof ClaudeError && RETRYABLE_STATUSES.has(err.status)) {
      return openAIFallback<T>(options);
    }
    throw err;
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await response.json();

  if (data.stop_reason === "max_tokens") {
    console.error(
      `[claude] Response truncated — max_tokens reached (${options.maxTokens})`,
    );
    throw new ClaudeError(
      `AI response truncated (max_tokens=${options.maxTokens}). Output may be incomplete.`,
      500,
    );
  }

  // ── Extract result ──
  if (hasDefinedProperties) {
    // Tool use mode: extract from tool_use content block
    // deno-lint-ignore no-explicit-any
    const toolUseBlock = data.content?.find(
      (block: any) => block.type === "tool_use",
    );
    if (!toolUseBlock?.input) {
      console.error(
        "[claude] No tool_use block in response:",
        JSON.stringify(data.content),
      );
      throw new ClaudeError("Empty or invalid structured response", 500);
    }
    return toolUseBlock.input as T;
  } else {
    // Text mode: parse JSON from text content
    // deno-lint-ignore no-explicit-any
    const textBlock = data.content?.find(
      (block: any) => block.type === "text",
    );
    if (!textBlock?.text) {
      throw new ClaudeError("Empty text response", 500);
    }
    let jsonStr = textBlock.text.trim();
    // Strip markdown code fences if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      console.error("[claude] JSON parse error:", jsonStr.substring(0, 500));
      throw new ClaudeError("Invalid JSON in AI response", 500);
    }
  }
}

/**
 * Call Claude with an AbortController timeout.
 * Supabase edge functions have a 150s wall-clock limit, so we use 90s timeout
 * to leave headroom for auth, DB ops, and search augmentation.
 */
export async function callClaudeWithTimeout<T = unknown>(
  options: CallClaudeOptions,
  timeoutMs = 90_000,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await callClaude<T>({ ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ClaudeError('AI request timed out', 504);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
