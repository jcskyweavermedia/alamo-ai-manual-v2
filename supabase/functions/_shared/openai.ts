/**
 * Shared OpenAI call wrapper with structured JSON output.
 * Primary: OpenAI GPT-5.2. Fallback: Claude Sonnet on transient failures.
 * Includes automatic retry with exponential backoff for transient errors (429, 529, 503).
 */

// ── Friendly bilingual error message ──────────────────────────────────────────
export const AI_UNAVAILABLE_MESSAGE = {
  en: "Tastly AI is temporarily unavailable. Please try again in a few minutes, or contact your admin.",
  es: "Tastly AI no está disponible temporalmente. Intenta de nuevo en unos minutos, o contacta a tu administrador.",
};

export interface CallOpenAIOptions {
  messages: Array<{ role: string; content: string }>;
  schema: Record<string, unknown>;
  schemaName: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  signal?: AbortSignal;
}

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
  }
}

// ── Retry config ─────────────────────────────────────────────────────────────
const RETRYABLE_STATUSES = new Set([429, 529, 503]);
const MAX_RETRIES = 2; // 3 total attempts for OpenAI, then fallback

async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000) + Math.random() * 500;
      console.log(`[openai] Retry ${attempt}/${MAX_RETRIES} after ${Math.round(delayMs)}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const response = await fetch(url, init);

    if (response.ok) return response;

    lastStatus = response.status;
    lastBody = await response.text();
    console.error(`[openai] Error ${lastStatus} (attempt ${attempt + 1}):`, lastBody);

    if (!RETRYABLE_STATUSES.has(lastStatus)) break;
  }

  throw new OpenAIError(`AI request failed (${lastStatus})`, lastStatus);
}

// ── Claude fallback helper ───────────────────────────────────────────────────
// Direct fetch to Anthropic API — cannot import callClaude (circular dependency:
// anthropic.ts already imports from openai.ts).

async function claudeFallback<T>(options: CallOpenAIOptions): Promise<T> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    throw new OpenAIError("Both AI providers unavailable", 503);
  }

  console.log("[fallback] OpenAI unavailable — falling back to Claude Sonnet");

  // Separate system messages from conversation messages
  const systemParts: string[] = [];
  const conversationMessages: Array<{ role: string; content: string }> = [];

  for (const msg of options.messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      conversationMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = {
    model: "claude-sonnet-4-6",
    max_tokens: options.maxTokens ?? 1000,
    messages: conversationMessages,
    tools: [
      {
        name: options.schemaName,
        description: "Generate structured output matching this schema.",
        input_schema: options.schema,
      },
    ],
    tool_choice: { type: "tool", name: options.schemaName },
  };

  if (systemParts.length > 0) {
    body.system = systemParts.join("\n\n");
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fallback] Claude also failed ${response.status}:`, errorText);
    throw new OpenAIError("Both AI providers unavailable", 503);
  }

  // deno-lint-ignore no-explicit-any
  const data: any = await response.json();

  // Extract from tool_use content block
  // deno-lint-ignore no-explicit-any
  const toolUseBlock = data.content?.find((block: any) => block.type === "tool_use");
  if (!toolUseBlock?.input) {
    console.error("[fallback] No tool_use block in Claude response:", JSON.stringify(data.content));
    throw new OpenAIError("Empty fallback response", 500);
  }

  return toolUseBlock.input as T;
}

/**
 * Call OpenAI with structured JSON output (json_schema mode, strict: true).
 * Returns the parsed JSON content.
 * On transient failure (429/529/503) after retries, falls back to Claude Sonnet.
 * Throws OpenAIError on failure (missing key, HTTP error, empty/invalid response).
 */
export async function callOpenAI<T = unknown>(options: CallOpenAIOptions): Promise<T> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new OpenAIError("AI service not configured", 500);
  }

  const model = options.model || "gpt-5.2";

  // Reasoning models (gpt-5*, o1*, o3*) only support temperature=1 and
  // use max_completion_tokens instead of max_tokens.
  const isReasoningModel = /^(gpt-5|o[13])/.test(model);

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = {
    model,
    messages: options.messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: options.schemaName,
        strict: true,
        schema: options.schema,
      },
    },
    max_completion_tokens: options.maxTokens ?? 1000,
  };

  if (!isReasoningModel) {
    body.temperature = options.temperature ?? 0.5;
  }

  let response: Response;
  try {
    response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    // OpenAI retries exhausted — fallback to Claude if it was a transient error
    if (err instanceof OpenAIError && RETRYABLE_STATUSES.has(err.status)) {
      return claudeFallback<T>(options);
    }
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new OpenAIError("Empty response from AI", 500);
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    console.error("[openai] JSON parse error:", content);
    throw new OpenAIError("Invalid AI response format", 500);
  }
}

/**
 * Call OpenAI with an AbortController timeout.
 * Supabase edge functions have a 150s wall-clock limit, so we use 90s timeout
 * to leave headroom for auth, DB ops, and search augmentation.
 */
export async function callOpenAIWithTimeout<T = unknown>(
  options: CallOpenAIOptions,
  timeoutMs = 90_000,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await callOpenAI<T>({ ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OpenAIError("AI request timed out", 504);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
