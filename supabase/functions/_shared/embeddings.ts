/**
 * Shared OpenAI embedding helper.
 * Uses text-embedding-3-small (1536 dimensions).
 * Extracted from embed-products for reuse by course builder search augmentation.
 */

export async function generateEmbedding(text: string, timeoutMs = 15_000): Promise<number[]> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // Truncate to avoid token limits
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[embeddings] OpenAI error:", err);
      throw new Error(`Embedding failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Embedding request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
