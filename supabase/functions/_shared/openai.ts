/**
 * Shared OpenAI call wrapper with structured JSON output.
 */

export interface CallOpenAIOptions {
  messages: Array<{ role: string; content: string }>;
  schema: Record<string, unknown>;
  schemaName: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
  }
}

/**
 * Call OpenAI with structured JSON output (json_schema mode, strict: true).
 * Returns the parsed JSON content.
 * Throws OpenAIError on failure (missing key, HTTP error, empty/invalid response).
 */
export async function callOpenAI<T = unknown>(options: CallOpenAIOptions): Promise<T> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new OpenAIError("AI service not configured", 500);
  }

  const model = options.model || "gpt-4o-mini";

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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[openai] Error ${response.status}:`, errorText);
    throw new OpenAIError("Failed to get AI response", response.status);
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
