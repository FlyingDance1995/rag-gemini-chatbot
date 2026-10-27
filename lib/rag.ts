import { prisma } from "./prisma";
import { toVectorLiteral } from "./vector";
import { TaskType } from "@google/generative-ai";

export const TOP_K = 5;

export interface RetrievedChunk {
  id: string;
  content: string;
  documentId: string;
  filename: string;
  distance: number;
}

export interface SourceRef {
  documentId: string;
  filename: string;
  chunkId: string;
  snippet: string;
  distance: number;
}

export async function retrieve(
  userId: string,
  questionEmbedding: number[],
  k = TOP_K
): Promise<RetrievedChunk[]> {
  const qVecLiteral = toVectorLiteral(questionEmbedding);

  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      c.id,
      c.content,
      c."documentId",
      d.filename,
      c.embedding <=> ${qVecLiteral}::vector AS distance
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE c."userId" = ${userId}
    ORDER BY c.embedding <=> ${qVecLiteral}::vector
    LIMIT ${k}
  `;

  return rows;
}

export function buildSources(retrieved: RetrievedChunk[]): SourceRef[] {
  return retrieved.map((r) => ({
    documentId: r.documentId,
    filename: r.filename,
    chunkId: r.id,
    snippet: r.content.slice(0, 200),
    distance: r.distance,
  }));
}

export function buildPrompt(
  question: string,
  retrieved: RetrievedChunk[]
): string {
  const contextBlock =
    retrieved.length > 0
      ? retrieved
          .map(
            (r, i) =>
              `--- Source [${i + 1}] (${r.filename}) ---\n${r.content}`
          )
          .join("\n\n")
      : "(No relevant documents found for this user.)";

  return `You are a helpful assistant that answers questions based ONLY on the provided context below.
If the context does not contain enough information to answer the question, say "I don't have enough information in the provided documents to answer this question."
Always respond in the same language the user is asking in.

Context:
${contextBlock}

Question: ${question}

Answer:`;
}
