/**
 * Thin wrapper around OpenAI text-embedding-3-small.
 *
 * Returns null instead of throwing so callers can fall back gracefully
 * to keyword-only search when OpenAI is unavailable or unconfigured.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

// OpenAI hard limit for text-embedding-3-small is 8191 tokens (~32K chars).
// Slicing at 32000 chars is a safe approximation.
const MAX_INPUT_CHARS = 32_000;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, MAX_INPUT_CHARS),
      }),
    });
    if (!res.ok) {
      console.error(`[embeddings] OpenAI error ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as OpenAIEmbeddingResponse;
    return data.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("[embeddings] fetch failed:", err);
    return null;
  }
}
