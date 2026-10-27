import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { requireEnv } from "./env";
import { toVectorLiteral } from "./vector";

const EMBED_CONCURRENCY = 5;
// gemini-embedding-001 outputs 3072 dims, text-embedding-004/embedding-001 output 768
// We accept any positive length and store as-is; pgvector column must match
const EMBED_DIMENSIONS = 768;

// Lazy singleton — never called at module load time (build-safe)
let _genAI: GoogleGenerativeAI | null = null;

export function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"));
  }
  return _genAI;
}

export function getChatModel() {
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  return getGenAI().getGenerativeModel({ model: modelName });
}

/**
 * Embed text using Gemini REST API v1 directly.
 * The @google/generative-ai SDK hardcodes v1beta which doesn't support
 * text-embedding-004. We call v1 endpoint via fetch instead.
 */
export async function embedText(
  text: string,
  taskType: TaskType
): Promise<number[]> {
  const apiKey = requireEnv("GEMINI_API_KEY");

  // Try embedding models in order of preference
  const candidates = [
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`,
      model: "models/gemini-embedding-001",
    },
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`,
      model: "models/text-embedding-004",
    },
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent`,
      model: "models/embedding-001",
    },
  ];

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const response = await fetch(candidate.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: candidate.model,
        content: { parts: [{ text }] },
        taskType: taskType.toString(),
      }),
    });

    if (response.status === 404) {
      lastError = new Error(`Model ${candidate.model} not found (404)`);
      continue; // try next candidate
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`[Gemini Embed Error] ${response.status} ${response.statusText}: ${err}`);
    }

    const data = await response.json() as { embedding: { values: number[] } };
    const values = data.embedding?.values;

    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`Invalid embedding response: empty values`);
    }

    // Warn if dimension doesn't match schema (vector(768))
    if (values.length !== EMBED_DIMENSIONS) {
      console.warn(`⚠️  Embedding model returned ${values.length} dims, schema expects ${EMBED_DIMENSIONS}. Using first ${EMBED_DIMENSIONS} dims.`);
      return values.slice(0, EMBED_DIMENSIONS);
    }

    return values;
  }

  throw lastError ?? new Error("All embedding models failed");
}

async function embedWithRetry(
  text: string,
  taskType: TaskType,
  maxRetries = 3
): Promise<number[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await embedText(text, taskType);
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("5"));
      if (!isRetryable || attempt === maxRetries) throw err;
      const waitMs = Math.pow(2, attempt) * 500;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error("embedWithRetry: unreachable");
}

export async function embedBatch(
  texts: string[]
): Promise<{ content: string; vectorLiteral: string }[]> {
  const results: { content: string; vectorLiteral: string }[] = [];

  for (let i = 0; i < texts.length; i += EMBED_CONCURRENCY) {
    const batch = texts.slice(i, i + EMBED_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (text) => {
        const values = await embedWithRetry(text, TaskType.RETRIEVAL_DOCUMENT);
        return { content: text, vectorLiteral: toVectorLiteral(values) };
      })
    );
    results.push(...batchResults);
  }

  return results;
}
